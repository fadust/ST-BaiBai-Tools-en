import { getRequestHeaders } from '@sillytavern/script';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { PRESET_BACKUP_PREVIEW_APP_KEY, PRESET_BACKUP_PREVIEW_DELETE_URL, PRESET_BACKUP_PREVIEW_LIST_URL } from './constants.js';
import { LOG_PREFIX, extensionState, savePresetOptimizationSettings, settings } from './state.js';

export const PRESET_BACKUPS_CLEANED_EVENT = 'bai-bai-preset-backups-cleaned';
export const DEFAULT_PRESET_BACKUP_KEEP_COUNT = 200;

let mutationTail = Promise.resolve();
let cleanupPromise = null;
let cleanupRequested = false;
let changingSettings = false;

export function runPresetBackupMutation(operation) {
    const result = mutationTail.then(operation);
    mutationTail = result.catch(() => {});
    return result;
}

async function requestBackupApi(url, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload || payload.ok === false || payload.error) throw new Error('Invalid backup response');
        return payload.data ?? payload;
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchPresetBackupItems() {
    const data = await requestBackupApi(PRESET_BACKUP_PREVIEW_LIST_URL, {});
    if (!Array.isArray(data.items)) throw new Error('Invalid backup list');
    return data.items;
}

export async function deletePresetBackupFile(fileName) {
    const data = await requestBackupApi(PRESET_BACKUP_PREVIEW_DELETE_URL, { fileName });
    if (data.deleted !== true || data.fileName !== fileName) {
        throw new Error('Backup deletion was not confirmed');
    }
    return data;
}

export function isValidPresetBackupKeepCount(value) {
    return Number.isSafeInteger(value) && value >= 1;
}

export function getPresetBackupCleanupPlan(items, keepCount) {
    if (!Array.isArray(items) || !isValidPresetBackupKeepCount(keepCount)) {
        throw new Error('Invalid backup retention settings or list');
    }
    const names = new Set();
    // Fail closed: never silently filter malformed rows out of a destructive plan.
    const entries = items.map(item => {
        const fileName = item?.fileName;
        const createdAt = item?.createdAt ?? item?.createdAtMs;
        const createdAtMs = typeof createdAt === 'number' ? createdAt
            : typeof createdAt === 'string' && createdAt.trim() ? Date.parse(createdAt) : NaN;
        if (
            typeof fileName !== 'string' || !fileName.trim() || fileName !== fileName.trim()
            || /[/\\\x00-\x1f]/.test(fileName) || !fileName.endsWith('.json') || fileName === 'index.json'
            || names.has(fileName) || !Number.isFinite(createdAtMs) || createdAtMs <= 0
            || typeof item.note !== 'string'
        ) {
            throw new Error('The backup list is missing full time or note information; cleanup stopped');
        }
        names.add(fileName);
        return { fileName, createdAtMs, protected: Boolean(item.note.trim()) };
    });
    const ordinary = entries.filter(item => !item.protected)
        .sort((a, b) => b.createdAtMs - a.createdAtMs || b.fileName.localeCompare(a.fileName));
    return {
        ordinaryCount: ordinary.length,
        protectedCount: entries.length - ordinary.length,
        targets: ordinary.slice(keepCount).reverse(),
    };
}

function canCleanBackups() {
    const view = extensionState[PRESET_BACKUP_PREVIEW_APP_KEY]?.state;
    return settings.presetBackupAutoCleanupEnabled === true
        && !changingSettings
        && !view?.noteDialogOpen && !view?.savingNote
        && !view?.renameDialogOpen && !view?.renaming
        && !view?.deleteDialogOpen && !view?.deleting
        && !view?.batchDeleting && !view?.importingFileName;
}

async function cleanPresetBackups() {
    if (!canCleanBackups()) return;
    const keepCount = settings.presetBackupKeepCount;
    const plan = getPresetBackupCleanupPlan(await fetchPresetBackupItems(), keepCount);
    if (!canCleanBackups() || settings.presetBackupKeepCount !== keepCount) return;
    const deletedFileNames = [];
    try {
        for (const item of plan.targets) {
            if (!canCleanBackups() || settings.presetBackupKeepCount !== keepCount) break;
            await deletePresetBackupFile(item.fileName);
            deletedFileNames.push(item.fileName);
        }
    } finally {
        if (deletedFileNames.length) {
            document.dispatchEvent(new CustomEvent(PRESET_BACKUPS_CLEANED_EVENT, {
                detail: { deletedFileNames },
            }));
        }
    }
}

export function schedulePresetBackupCleanup() {
    if (!canCleanBackups()) return Promise.resolve();
    cleanupRequested = true;
    if (cleanupPromise) return cleanupPromise;
    // ponytail: one page-local queue; cross-device atomic retention needs backend support.
    cleanupPromise = Promise.resolve().then(async () => {
        while (cleanupRequested && canCleanBackups()) {
            cleanupRequested = false;
            await runPresetBackupMutation(cleanPresetBackups);
        }
    }).catch(error => {
        cleanupRequested = false;
        console.warn(`${LOG_PREFIX} Preset backup cleanup stopped`, error);
        globalThis.toastr?.warning(
            'Backup auto-cleanup did not finish and deletion stopped; it will retry after the next successful backup.',
            'Preset backup',
        );
    }).finally(() => {
        cleanupPromise = null;
    });
    return cleanupPromise;
}

async function confirmPresetBackupCleanup(plan, keepCount) {
    const result = await callGenericPopup(`
        <h3>Auto-clean old backups</h3>
        <p>Keep the newest ${keepCount} regular backups across all presets.</p>
        <p>Currently ${plan.ordinaryCount} regular backups and ${plan.protectedCount} protected backups with notes.</p>
        <p>The oldest <strong>${plan.targets.length}</strong> regular backups will be deleted. This cannot be undone.</p>
        <p>Backups with notes are never deleted and do not count. After this, backups over the limit are cleaned up silently after each successful backup, with no popup.</p>
    `, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Confirm and enable',
        cancelButton: 'Cancel',
    });
    return result === POPUP_RESULT.AFFIRMATIVE;
}

export async function changePresetBackupRetentionSettings(enabled, keepCount) {
    if (changingSettings) return false;
    if (!isValidPresetBackupKeepCount(keepCount)) {
        throw new Error('The number to keep must be a whole number greater than zero');
    }
    const needsConfirmation = enabled && (
        settings.presetBackupAutoCleanupEnabled !== true
        || !isValidPresetBackupKeepCount(settings.presetBackupKeepCount)
        || keepCount < settings.presetBackupKeepCount
    );
    changingSettings = true;
    try {
        await cleanupPromise;
        if (needsConfirmation) {
            const plan = await runPresetBackupMutation(async () =>
                getPresetBackupCleanupPlan(await fetchPresetBackupItems(), keepCount));
            if (!await confirmPresetBackupCleanup(plan, keepCount)) return false;
        }
        settings.presetBackupAutoCleanupEnabled = enabled;
        settings.presetBackupKeepCount = keepCount;
        savePresetOptimizationSettings();
    } finally {
        changingSettings = false;
    }
    if (needsConfirmation) void schedulePresetBackupCleanup();
    return true;
}

export function bindPresetBackupRetentionSettings(container) {
    const root = container[0] ?? container;
    const toggle = root.querySelector('#bai_bai_toolkit_preset_backup_auto_cleanup_enabled');
    const count = root.querySelector('#bai_bai_toolkit_preset_backup_keep_count');
    const status = root.querySelector('#bai_bai_toolkit_preset_backup_cleanup_status');
    if (!toggle || !count || !status) return;
    const sync = () => {
        toggle.checked = settings.presetBackupAutoCleanupEnabled === true;
        count.value = isValidPresetBackupKeepCount(settings.presetBackupKeepCount)
            ? settings.presetBackupKeepCount : DEFAULT_PRESET_BACKUP_KEEP_COUNT;
    };
    const update = async () => {
        const enabled = toggle.checked;
        const keepCount = count.valueAsNumber;
        toggle.disabled = count.disabled = true;
        status.hidden = false;
        status.textContent = 'Working...';
        try {
            await changePresetBackupRetentionSettings(enabled, keepCount);
            status.hidden = true;
        } catch (error) {
            console.warn(`${LOG_PREFIX} Failed to change backup retention settings`, error);
            status.textContent = `Settings unchanged: ${error.message}`;
        } finally {
            sync();
            toggle.disabled = count.disabled = false;
        }
    };
    sync();
    toggle.addEventListener('change', update);
    count.addEventListener('change', update);
}
