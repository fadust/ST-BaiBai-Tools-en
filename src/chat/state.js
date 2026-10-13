
let settings = {};
let extensionState = {};
let LOG_PREFIX = '[BaiBai Tools]';
let recordLongDomRefresh = null;

function configureChatOptimizations(context = {}) {
    settings = context.settings ?? settings;
    extensionState = context.extensionState ?? extensionState;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    recordLongDomRefresh = context.recordLongDomRefresh ?? recordLongDomRefresh;
}

export {
    LOG_PREFIX,
    configureChatOptimizations,
    extensionState,
    recordLongDomRefresh,
    settings,
};
