(function() {
    'use strict';
    
    // Off unless switched on from the popup. This script runs in the page's world,
    // without chrome.* APIs, so bridge.js relays the stored setting as a DOM event.
    // Messages logged before it arrives are held, then printed or dropped.
    let debug = null;
    const pending = [];

    function setDebug(on) {
        if (debug === null && on) {
            for (const [message, data] of pending) {
                console.log('[Medium Helper]', message, data || '');
            }
        }
        pending.length = 0;
        debug = on;
    }

    document.addEventListener('medium-helper:debug-on', () => setDebug(true));
    document.addEventListener('medium-helper:debug-off', () => setDebug(false));
    
    function log(message, data) {
        if (debug === null) {
            if (pending.length < 50) pending.push([message, data]);
        } else if (debug) {
            console.log('[Medium Helper]', message, data || '');
        }
    }
    
    const OriginalFetch = window.fetch;
    const OriginalXHROpen = XMLHttpRequest.prototype.open;
    
    function unlockGraphQL(data) {
        let modified = false;
        
        if (data.data?.post?.viewerEdge?.fullContent) {
            data.data.post.viewerEdge.fullContent.isLockedPreviewOnly = false;
            data.data.post.viewerEdge.fullContent.validatedShareKey = 'unlocked_via_helper';
            modified = true;
            log('Unlocked post content');
        }
        
        if (data.data?.viewerEdge) {
            data.data.viewerEdge.isUser = true;
            data.data.viewerEdge.shareKey = 'helper_unlock';
            modified = true;
            log('Faked logged-in user');
        }
        
        if (data.data?.post) {
            data.data.post.shareKey = 'helper_key';
            data.data.post.viewerEdge = data.data.post.viewerEdge || {};
            data.data.post.viewerEdge.shareKey = 'helper_key';
            modified = true;
        }
        
        if (data.data?.collection?.viewerEdge) {
            data.data.collection.viewerEdge.isUser = true;
        }
        
        return modified;
    }
    
    window.fetch = async function(...args) {
        const input = args[0];
        const url = input instanceof Request ? input.url : String(input);
        const response = await OriginalFetch.apply(this, args);
        
        if (url.includes('/graphql') && response.clone) {
            const clonedResponse = response.clone();
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await clonedResponse.json();
                    
                    if (data.data) {
                        const modified = unlockGraphQL(data);
                        if (modified) {
                            log('Fetch intercepted & modified:', { url, operation: extractOperationName(args[1]?.body) });
                            return new Response(JSON.stringify(data), {
                                status: response.status,
                                statusText: response.statusText,
                                headers: response.headers
                            });
                        }
                    }
                }
            } catch (e) {
                log('Fetch modification error:', e);
            }
        }
        
        return response;
    };
    
    const XHROpenWrapper = function(method, url) {
        const xhr = this;
        xhr._graphqlUrl = url;
        
        xhr.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && typeof this._graphqlUrl === 'string' && this._graphqlUrl.includes('/graphql')) {
                try {
                    const contentType = this.getResponseHeader('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = JSON.parse(this.responseText);
                        if (data.data) {
                            const modified = unlockGraphQL(data);
                            if (modified) {
                                const modifiedResponse = JSON.stringify(data);
                                Object.defineProperty(this, 'responseText', { value: modifiedResponse, writable: false });
                                Object.defineProperty(this, 'response', { value: modifiedResponse, writable: false });
                                if (this.responseJSON) {
                                    Object.defineProperty(this, 'responseJSON', { value: data, writable: false });
                                }
                                log('XHR intercepted & modified:', { url: this._graphqlUrl });
                            }
                        }
                    }
                } catch (e) {
                    log('XHR modification error:', e);
                }
            }
        });
        
        return OriginalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.open = XHROpenWrapper;
    
    function extractOperationName(body) {
        if (!body) return null;
        try {
            const strBody = typeof body === 'string' ? body : new TextDecoder().decode(body);
            const operationMatch = strBody.match(/"operationName":"([^"]+)"/);
            return operationMatch ? operationMatch[1] : null;
        } catch (e) {
            return null;
        }
    }
    
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .km .kN, .paywall--prompt, .regwall, [data-testid="paywall-prompt"],
            .js-regwall, .paywall-message { display: none !important; }
            .postArticle--full { max-height: none !important; }
        `;
        
        const target = document.head || document.documentElement;
        if (target) {
            target.appendChild(style);
        } else {
            const observer = new MutationObserver((_, obs) => {
                const target = document.head || document.documentElement;
                if (target) {
                    target.appendChild(style);
                    obs.disconnect();
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    }
    
    injectStyles();
    
    log('Medium Helper loaded successfully');
    window.postMessage({ type: 'MEDIUM_HELPER_ACTIVE', status: 'loaded' }, '*');
})();
