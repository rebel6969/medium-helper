// Runs in the extension's isolated world, where chrome.storage is available, and
// tells content.js (page world) whether debug logging is on.
(function() {
    'use strict';

    function send(on) {
        document.dispatchEvent(new Event(on ? 'medium-helper:debug-on' : 'medium-helper:debug-off'));
    }

    chrome.storage.local.get({ debug: false }, (items) => send(items.debug === true));

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.debug) {
            send(changes.debug.newValue === true);
        }
    });
})();
