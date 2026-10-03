document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const toggleBtn = document.getElementById('toggleDebug');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0].url;
        const isMedium = url.includes('medium.com') || url.includes('uxplanet.org');
        
        if (isMedium) {
            statusEl.textContent = '✅ Active - Paywalls unlocked';
            statusEl.className = 'status active';
        }
    });
});
