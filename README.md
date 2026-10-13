# BaiBai Tools (English)

> **Unofficial English port.** This is a community translation of
> [ST-BaiBai-Tools (柏宝箱)](https://github.com/baibai-git/ST-BaiBai-Tools) by **baibai-git (柏柏)**. All credit for the extension goes to the original author.
> Only user-facing text (UI, toasts, logs, docs) was translated; behavior is unchanged.
> The original Chinese README is kept as [README.zh-CN.md](README.zh-CN.md).
>
> The original repository has no license file. This port is published without the author's explicit permission, as a courtesy translation.
>
> **If you are the original author and want this port taken down or changed, open an issue here and it will be removed promptly.**
>
> Report translation problems here. Report bugs in the extension itself upstream.

BaiBai Tools (柏宝箱) is a third-party SillyTavern extension that eases lag on mobile, in long chats, and with large numbers of characters, regexes and presets. Without changing how SillyTavern is used, it takes over some expensive list rendering, API requests, editors and scrolling behavior.

Current version: `0.30.13`

## Features at a glance

- Faster input box, autocomplete and message editing on mobile
- Long chat DOM rendering optimization, reducing layout and paint of off-screen messages
- Chat file manager: faster requests, smoother scrolling, cleanup on close
- Recent chats on the home page open the target chat directly, without first rendering the character's previous chat
- Lazy-loaded avatar thumbnails in the character list, persona list and welcome-page recent chats
- Character search box tuned for pinyin input, reducing frequent searches and repaints caused by Chinese IMEs
- Faster OpenAI preset switching, dragging, toggling, saving and token count refresh
- CodeMirror editors for preset content, custom CSS and character description
- Vue regex group manager with grouping, dragging, bulk moves and deferred saving
- Native World Info optimization and a new World Info layout, reducing lag from native interactions, drawer animations and Select2 initialization
- Custom CSS shadow property, easing lag from writing large CSS when switching themes
- Translate update event save optimization, avoiding useless long-chat saves when auto-translate is off
- Gzip compression of chat save requests, reducing request size over the public internet
- Message completion sound, with built-in audio, an audio URL or a local file
- Auto-retry on failed generation, and limited retries when the reply text hits a blacklist
- BaiBaoKu paging/acceleration: settings, merged extension manifest request, character list, recent chats, lazy-loaded themes, background message generation, batched tokenizer counts

## Chat optimizations

### Long chat rendering optimization

With `Long chat rendering optimization` on, when the current chat holds a lot of message text, the extension applies `content-visibility` and cached placeholder heights to messages so off-screen messages skip layout and paint. On entering a chat it scrolls to the bottom automatically and uses a temporary bottom anchor to absorb height changes during initial loading.

When new messages generate or messages update, the extension keeps the bottom or latest message position as stable as it can, avoiding the jumps, failure to reach the bottom, and repeated reflows common in long chats.

### Load fewer messages

With `Load fewer messages` on, SillyTavern's initial number of loaded messages is limited to at most 10. A value of `0` (load all) or above `10` becomes `10`; `1` to `10` stay as they are. The extension watches the native setting and checks again before a regular or group chat loads.

This limits how many messages are first rendered on the page; SillyTavern still reads the full chat file.

### Chat file manager optimizations

`Faster chat file manager requests` applies only to regular character chats, empty searches and `/api/chats/search` requests. The dialog first renders a lightweight file name list, then fills in file size, message count, date and preview text asynchronously.

`Chat file manager scroll optimization` enables paint containment on chat file rows, easing scroll lag with many chat files.

`Chat file manager cleanup on close` clears the generated chat file DOM after the dialog closes, reducing the page's load afterwards.

Keyword searches and group chats fall back to SillyTavern's original logic automatically.

### Home-to-chat optimization

With `Home-to-chat optimization` on, entering a regular character chat from the welcome page's recent chats opens the clicked chat file directly, instead of first rendering the character's last active chat and then switching.

### Quick edit after deleting messages

With `Quick edit after deleting messages` on, after deleting messages in SillyTavern's delete mode you can open the previous message's editor immediately. If you then press send, continue, impersonate or regenerate, the extension first commits the quickly opened editor, then carries on with the original action.

### Mobile input and scrolling

- `Input box responsiveness`: reduces autocomplete and hotswap recalculation triggered by resize on mobile.
- `Stop keyboard auto-popup`: blocks programmatic auto-focus when entering a chat, opening the chat file manager or entering message edit; tapping the input by hand still works.
- `Disable auto-scroll while editing a message`: suppresses the chat area scroll compensation caused by the mobile keyboard squeezing the layout.
- `Double-click to edit message` / `Triple-click to edit message`: open the message editor quickly; the two switches are mutually exclusive.

### Gzip chat save requests

With `Gzip chat save requests` on, request bodies of `/api/chats/save` and `/api/chats/group/save` are Gzip-compressed when SillyTavern is accessed over the public internet. Local and LAN addresses are skipped automatically; if a compressed request fails, it is retried uncompressed.

### Message completion sound

With `Play a sound when generation finishes` on, the selected sound plays when message generation ends normally. It does not play when you stop generation by hand.

Combined with blacklist auto-retry, the sound waits for the blacklist check: intermediate replies that will be retried do not play it; it plays once when the final reply passes the check, or when the total retries run out and the last reply is kept. Even if that last reply still hits the blacklist, running out of retries plays the sound. With the sound switch off it never plays automatically; cancelling a retry does not play it afterwards.

Three sound sources are supported:

- `Built-in audio`: audio from the extension's `video` folder. Nothing is preloaded when the extension loads; only the selected file is loaded when previewed or played.
- `Audio URL`: the URL is saved in the extension's user settings, suitable for several devices sharing one SillyTavern server configuration.
- `Local file`: saved to this browser's IndexedDB after upload; available only in this browser on this device, never written to SillyTavern user settings.

The settings panel has a `Preview` button and a volume slider, so you can check the result right after switching audio.

On mobile you can turn on `Silent keep-alive during generation`. While a message generates, the extension loops a short inline silent audio, lowering the chance that the browser is frozen in the background and the completion sound cannot play. It runs only on mobile, with the sound on, during generation, and may use slightly more battery.

### Auto-retry failed message generation

The `Auto-retry failed message generation` settings hold both request-failure retry and `Auto-retry on blacklist hit`. They are switched separately but share `Max retries`. Error resends and blacklist regenerations count toward the same per-round total, which is not reset by regenerating. For example, with max retries at 3, after 2 error retries the blacklist has only 1 retry left; only a new generation you start by hand resets the count.

One blacklist entry per line: plain lines match if the reply text contains them, ignoring English case and empty lines; lines written as `/regex/flags` match as a regex, e.g. `/504|bad gateway/i`, `/^\[Error\]/m`. Flags apply as the browser's JS regex flags, commonly `g i m s u y`; without `i` the regex is case-sensitive, and `g`/`y` only affect state, not whether it matches. Invalid regexes and lines that are not a valid `/regex/flags` (e.g. `/foo/` followed by a space, `//`, `/foo/gi!`) are treated as plain text; an invalid regex is reported once in the console. After a regular single-chat generation or regeneration finishes and settles, the text of the round's latest assistant message is read; if any line matches, ST's native regenerate is called, replacing the matched reply without adding a swipe or resending the user message. By default at most 3 extra retries per round in total, settable from 1 to 10; blacklist retry delay is 1.5 seconds, and you can cancel with SillyTavern's Stop button while waiting. If it still matches when the total runs out, retrying stops, the last reply is kept and a notice is shown; what to do next is up to you.

Streaming and non-streaming are both supported; after a streamed request ends abnormally, error text already shown is also checked against the blacklist (e.g. `HTTP 503 Service Unavailable`), and an error abort is not treated as a user stop. Chat history and the separate reasoning field are not scanned; continue, swipes, group chats and auxiliary generations started by other extensions are not handled. While ST's native auto-swipe is on, this feature pauses to avoid double triggers. Blacklist retry notices are titled `Auto-retry on blacklist hit`, separate from the request-failure `Auto-retry on generation failure`. Stopping by hand, switching chats, editing or switching swipes of the message being generated, deleting messages or changing blacklist settings cancels the current retry chain. Even if the stop lands in the start window where SillyTavern rebuilds the request controller (the stop event has fired, but SillyTavern carries on with a new controller), that generation does not re-arm retries, and the interrupted retry count carries over instead of resetting; updating unrelated older messages does not cancel. If the chat saves again while a retry is waiting, the retry waits for the save to finish instead of being dropped.

Message replacement, background task cleanup and chat saving follow native regenerate and the existing background module; the blacklist module no longer deletes, saves or rolls back the chat by itself. Detection depends on the page running; once the page closes, no blacklist detection continues on the server. Streamed content may also show first and then be replaced, and content already processed by other extensions cannot be undone.

## Character and avatar optimizations

### Lazy-load avatar thumbnails

With `Lazy-load avatar thumbnails` on, the character list, persona list and welcome-page recent chats first render off-screen avatars with a placeholder and keep the real `/thumbnail` URL in `data-*`. The real thumbnail loads when the avatar scrolls near the visible area.

`content-visibility` is also applied to character, persona and recent chat rows, and images get `loading="lazy"`, `decoding="async"` and low fetch priority. Browsers without `IntersectionObserver` fall back to native lazy-loading hints.

### Character search box optimization

With `Character search box optimization` on, the extension intercepts input events of the character search box in the capture phase. No search runs during Chinese pinyin composition; one search runs after composition ends, with an extra 300 ms debounce, reducing input lag and DOM repaints with huge character counts.

## Preset optimizations

### Preset backup auto-cleanup

In BaiBai Tools' `BaiBaoKu` tab, `Auto-clean old backups` is on by default; an existing "off" setting is not overwritten. Each successful backup checks the count; across all presets the newest `Regular backups to keep` (default 200) are kept, and over the limit the oldest are deleted first.

- Backups with a note are exempt from auto-cleanup and do not count toward the regular limit; clearing the note makes them eligible again. The list shows regular and protected counts separately.
- When on, over-limit backups are cleaned silently on successful backup, with no confirmation popup. Turning it on by hand or lowering an enabled limit still asks first; cancelling keeps the old setting. Upgrading or reloading the page never triggers deletion by itself.
- Nothing is deleted if a backup save fails or the list or metadata is abnormal; if a deletion fails, this round stops with a notice and retries after the next successful backup. Cleanup never deletes the presets themselves.
- Opening a backup dialog such as notes during cleanup pauses further deletion until the next successful backup. The setting is saved with ST user settings.
- Only BaiBaoKu's existing list and delete endpoints are used; BaiBaoKu needs no changes. This is a count limit maintained while the page runs, not a server disk quota; with the page closed, offline, or with several devices at once, the limit may be exceeded temporarily. Editing notes and cleaning up across devices is not atomic; save notes on important backups before turning cleanup on. Global eviction may clear the history of rarely used presets.

### Fast refresh on preset switch

With `Fast refresh on preset switch` on, switching OpenAI / Chat Completion presets first closes the mobile dropdown, then renders the prompt list as early as possible and refreshes token counts after the list shows. Deleting the current preset selects the next one; deleting the last one selects the first.

### Preset panel collapse

`Preset panel collapse` is on by default. It moves rarely used setting blocks of the OpenAI preset panel into a `Preset settings` collapsible section, reducing the panel's height. Turning it off puts the blocks back where they were.

### Preset entry drag optimization

With `Preset entry drag optimization` on, the extension bypasses native jQuery UI sortable's live squeeze layout. While dragging, the original entry keeps its space, a floating clone follows the pointer, only an insertion line shows, and the order is saved on release.

On mobile only the drag handle on the left can be long-pressed by default; with `Drag whole preset entry on mobile` on, any non-button area of the entry can be long-pressed to start dragging. Normal scrolling cancels a pending drag, reducing mistakes.

### Fast preset actions

With `Fast preset actions` on, enabling/disabling and saving existing prompt entries updates only that row and defers the token count refresh, so the whole list is not rebuilt on every action. Creating a new prompt still uses SillyTavern's original logic.

### Preset favorites

With `Preset groups` on, prompt entries can be starred from the three-dot menu. Starred entries appear as shortcut mirrors in the `Favorites` area below the list header divider; they offer only enable/disable and edit, and take no part in drag ordering, group membership, copying or deleting. Starred entries keep a star shortcut button; the favorites area can expand and collapse, and unmounts its entries after the collapse animation to reduce list DOM.

### CodeMirror editor for preset content

With `CodeMirror editor for preset content` on, CodeMirror replaces the OpenAI prompt entry content textarea, including SillyTavern's expanded editor. Content syncs back to the original form field before saving; if CodeMirror fails to load, the original textarea is restored.

`Auto-save preset after saving an entry` is off by default. When on, saving a prompt entry edit also triggers a save of the current OpenAI preset.

### Batched tokenizer count requests

When BaiBaoKu is available and `Batched tokenizer count requests` is on, Prompt Manager token count refreshes call BaiBaoKu's batch count endpoint, reducing the many single count requests when switching models or refreshing presets. If the endpoint is unavailable, the original token count flow is used.

## Regex list optimizations

With `Fast regex actions` on, a Vue manager takes over the global, preset and character regex lists.

Main capabilities:

- Enabling/disabling, saving and deleting a single regex updates only the affected entry
- Drag ordering of regex entries, moving across groups and saving group membership
- Create, rename, delete and collapse regex groups
- Enable or disable a whole group in one click
- Move groups up/down; ungrouped entries keep a default fallback group
- Bulk select, bulk enable/disable, bulk move, bulk delete and bulk export
- Bulk move selected regexes to global, preset or character regexes
- After importing regexes, the Vue list and group metadata are synced
- Preset regex groups are written into the preset's extension field and travel with export, import and rename of the whole preset
- Regex saves go into a pending queue and are flushed together when the panel closes or on page lifecycle events, reducing repeated saves and reloads during rapid edits

## World Info and editor optimizations

### Native World Info optimization and new World Info layout

With `Native World Info optimization` on, native World Info interactions initialize heavy Select2 controls, character filter options and macro autocomplete logic lazily. With `New World Info layout` on, a Vue list takes over the World Info entry list, with lighter transform-based expand animations.

### Custom CSS editing optimizations

`CodeMirror editor for custom CSS` takes over the custom CSS editor in user settings with CodeMirror, and syncs and applies styles when you leave the editor or on page lifecycle events, reducing style recalculation while typing.

`Theme switch optimization` intercepts long text writes to the native `#customCSS`, redirecting the value to an in-memory JavaScript property, so the browser never lays out and paints large CSS written into a native textarea. Turning it on also turns on the custom CSS CodeMirror editor.

When switching themes on mobile, going to the background and coming back, the extension takes SillyTavern's current theme `power_user.custom_css` as the truth and re-aligns `#custom-style`, the native textarea, the CodeMirror document and the shadow property, avoiding leftover mixes of old and new theme CSS.

### CodeMirror editor for character description

With `CodeMirror editor for character description` on, the character description text area is replaced with a lightweight CodeMirror 6 editor. If it fails to load, SillyTavern's original input is restored.

## BaiBaoKu paging and acceleration

BaiBaoKu switches are in the `BaiBaoKu` tab of the extension settings. The panel shows the service, database driver and Early Bridge status, with a manual refresh button.

These features depend on BaiBaoKu's endpoints or Early Bridge; when unavailable they fall back to SillyTavern's native endpoints.

- `Faster settings get/save`: takes over `/api/settings/get` and `/api/settings/save` through BaiBaoKu Early Bridge.
- `Merged extension manifest request`: at startup, fetches the extension list and manifest cache in one go, cutting the many `/scripts/extensions/.../manifest.json` requests; after install, update, move or branch switch, only the affected extension's manifest is fetched again.
- `Faster character list request`: replaces the empty `/api/characters/all` request with BaiBaoKu's fast character list endpoint.
- `Faster recent chats request`: replaces the home page's `/api/chats/recent` with BaiBaoKu's fast recent chats endpoint.
- `Lazy-load themes`: when switching themes, reads the target theme's configuration on demand, shows a loading state, and applies the theme once loaded.
- `Background message generation`: regular single-character Chat Completion generation uses BaiBaoKu save-generate; the backend writes to the chat file when generation finishes.
- `Batched tokenizer count requests`: Prompt Manager token counts use BaiBaoKu's batch count endpoint.

### Lazy-load themes

With BaiBaoKu settings acceleration on and Early Bridge available, switching themes first intercepts the native theme dropdown change, then reads the target theme's configuration by name through BaiBaoKu. While loading, a "Loading theme..." status shows so users do not think the page has frozen.

Once the theme configuration loads, the extension syncs SillyTavern's theme fields, color bindings, chat display mode and Toastr position, and saves settings; if loading fails, it falls back to the previous theme selection and shows an error. This flow only covers theme switching and does not change how the custom CSS editor saves.

### Background message generation

With `Background message generation` on, `normal` and `regenerate` replies of regular single-character Chat Completion use BaiBaoKu's save-generate endpoint. The front end still starts generation through SillyTavern's normal flow, but the backend writes the AI reply straight into the current chat file when generation finishes, avoiding the loss case where a mobile browser backgrounds, reloads or disconnects after the front end got the reply but before it saved.

Streaming generation still returns content to the front end live; non-streaming waits for the backend to finish. When generation succeeds and the backend has saved it, the extension skips the `/api/chats/save` that would normally follow, avoiding a duplicate save. After a reload, if the current chat still has a background generation job, the extension restores its state by jobId; when the job finishes, the message is restored through SillyTavern's message insert flow, firing the normal render events where possible.

A single `emit_complete_response` or `emit_complete_response_<alphanumeric suffix>` tool carrying the full reply is supported for OpenAI / Custom sources: the upstream request's tool definition is kept, the backend turns the `content` of the tool-argument JSON into normal AI text, and the front-end display and background save use the same content. Tool-argument chunks are shown once all have arrived and been validated; plain text replies still stream live, including error text returned by a proxy. General tool calls are not executed, and requests mixing several tools are not taken over.

Background takeover and request retry are linked through a one-time request marker for this round's main generation, instead of comparing whole request bodies, hashing content or keeping an intent queue with match timeouts. When a preset script clones the JSON after `CHAT_COMPLETION_SETTINGS_READY`, adjusts sampling parameters or prompts, or adds the anti-truncation tool above, it is still recognised as the same generation as long as the marker is kept; the request actually sent keeps the script's changes. The marker only travels in the page's request chain and is removed by the inner request hook before sending; it is not written to KV or passed to the BaiBaoKu backend or remote APIs. It is removed even with auto-retry off or when falling back to native endpoints.

The settings-ready event binds only this round's request marker and does not reject binding early based on tool lists, source or swipe count; those compatibility checks all run when fetch receives the final request, so takeover is not missed after later preset scripts correct the configuration. When not bound, logs distinguish event not received, generation type mismatch, chat switched during preparation, feature turned off and similar reasons, without printing prompts or keys.

The marker is replaced with each new generation, cleared once a request claims it, and expires when generation ends, stops or the chat switches; matching does not fail because preprocessing took more than 60/120 seconds. Without a marker, with a marker from another generation, with a mismatched chat state or unsupported tools, it still falls back conservatively and never takes over auxiliary requests based on URL alone; the console gives the specific skip reason. Once a request is sent, a disconnect or lost response does not fall back to native generation again, avoiding duplicates.

This compatibility needs BaiBaoKu backend `0.6.4` or later, effective after restarting SillyTavern and reloading the page; older backends that do not declare the capability keep native generation and receive no incompatible background jobs.

The backend status panel and the generation module share a cache of online status and tool capability; when only the online flag is known without a capability result, status is queried again, so load order after a reload does not affect background takeover.

SillyTavern's native stop button also cancels the active save-generate job. Cancelling discards content the backend generated but has not saved yet; when the API service returns an explicit error, the front end keeps SillyTavern's native error experience, and after a reload the same failed job already seen on this page is not reported again.

### Long chat batch loading

`Long chat batch loading` is currently disabled. The `Long chat batch loading` switch in the BaiBaoKu panel stays off and cannot be clicked, and the backend fast-get endpoint refuses to enable it. Entering a chat keeps using SillyTavern's native full chat read.

In older versions, with this feature on, opening a large chat first requested the last messages so the page became readable quickly. The full chat was completed in the background; afterwards SillyTavern's chat array was synced, message IDs corrected, scroll position restored and the necessary chat load events fired.

While completing, send, edit, delete, swipe and save were temporarily blocked with the notice "Long chat batch loading: The remaining batches have not finished loading; please wait before doing anything". Save requests were skipped and answered with a front-end success response, so SillyTavern did not show a generic connection error. If BaiBaoKu's full completion failed, SillyTavern's native chat read was tried; completion stopped when the state expired or the chat switched.

## Other optimizations

### Translate update event save optimization

With `Translate update event save optimization` on, when auto-translate is off and a message has no translation cache, the extension skips the translate extension's useless handling in the `MESSAGE_UPDATED` event, avoiding repeated full saves after editing messages in long chats.

If auto-translate is on, or the message already has a cached translation display, the translate extension's original logic still runs.

### Update notice

With `Popup on available update` on, a confirmation popup shows when an update is available. When off, the `new` badge and update button still show.

## Installation

SillyTavern → Extensions → Install extension, and enter:

```
https://github.com/fadust/ST-BaiBai-Tools-en
```

Do not install this alongside the original Chinese version. The in-app update check points to this English repository.

For local testing, the extension folder can also be placed in `public/scripts/extensions/third-party/`.

## Development and build

Source is in `src/`; at runtime the Vite build output `dist/index.js` is loaded (`manifest.json`'s `js` field points to `dist/index.js?ver=<version>`, synced from `package.json` by `scripts/sync-version.mjs`). After changing `src/`, rebuild for it to take effect:

```bash
npm install
npm run build        # production build (with sourcemap and minification)
npm run watch        # development watch build
npx eslint src       # static checks (no-undef etc.)
```

Source layout:

```text
src/
  index.js                entry: module wiring and top-level hookup
  features/               feature modules split out of the old index.js (theme, custom CSS, regex, background generation, etc.)
  preset/                 preset optimizations (split from presetOptimizations.js; index.js is the shared export)
  chat/                   chat optimizations (split from chatOptimizations.js)
  worldinfo/              World Info page optimizations (split from worldInfoPageOptimization.js)
  floorDirectory.js       message manager
  saveGenerateDisplay.js  background generation display component
  settings.html           settings panel template (inlined at build via ?raw)
```

Host SillyTavern modules are referenced through `@sillytavern/*` aliases (e.g. `@sillytavern/script`, `@sillytavern/scripts/utils`), resolved to relative paths at build time and kept external, so they are not bundled. Vue, vue-draggable-next and CodeMirror are bundled from npm dependencies, all inlined into a single `dist/index.js` (one large file loads faster than many lazy chunks in cloud/high-latency setups).

Release flow: change `version` in `package.json` → `npm run build` (prebuild syncs `manifest.json` and refreshes the `?ver=` cache parameter) → commit `src/`, `dist/` and `manifest.json`.

## Compatibility and fallbacks

- Most optimizations can be switched on or off individually in the extension settings panel.
- Features depending on BaiBaoKu check endpoint status; when the endpoint is unavailable, returns errors or conditions are not met, SillyTavern's native behavior is used.
- Faster chat file requests only handle empty searches for regular characters; group chats and keyword searches keep native behavior.
- CodeMirror editors restore the native textarea if they fail to load.
- Gzip save requests are used only over the public internet and retry uncompressed on failure.
- Built-in completion sounds load on demand; whether a URL sound plays depends on browser support and remote access; local files are stored only in this browser; mobile silent keep-alive only raises the chance of background playback and cannot bypass forced system sleep, browsers killing background tabs or power-saving policies.
