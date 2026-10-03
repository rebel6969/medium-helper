const HOSTS = ['medium.com', 'uxplanet.org'];

function isSupported(url) {
    try {
        const host = new URL(url).hostname;
        return HOSTS.some((h) => host === h || host.endsWith('.' + h));
    } catch (e) {
        return false;
    }
}

function renderDebug(button, on) {
    button.textContent = on ? 'Disable Debug Logs' : 'Enable Debug Logs';
    button.className = on ? 'toggle-on' : 'toggle-off';
}

document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const toggleBtn = document.getElementById('toggleDebug');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs && tabs[0] && tabs[0].url;

        if (url && isSupported(url)) {
            statusEl.textContent = '✅ Active - Paywalls unlocked';
            statusEl.className = 'status active';
        }
    });

    chrome.storage.local.get({ debug: false }, (items) => {
        let on = items.debug === true;
        renderDebug(toggleBtn, on);
        toggleBtn.addEventListener('click', () => {
            on = !on;
            chrome.storage.local.set({ debug: on }, () => renderDebug(toggleBtn, on));
        });
    });
});
