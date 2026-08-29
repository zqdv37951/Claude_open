// ==UserScript==
// @name         Network-Level Ad Blocker + Conditional Lazy Load Trigger (Universal Pro)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  廣告攔截全站生效,僅在 /books/ 閱讀頁觸發懶加載滾動
// @author       Gemini
// @match        *://*.roumanm.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function() {
    'use strict';

    const BLOCKED_PATTERNS = [/ar01\.xyz/i, /taboola\.com/i];

    function isBlocked(url) {
        if (!url) return false;
        try {
            return BLOCKED_PATTERNS.some(re => re.test(url.toString()));
        } catch (e) {
            return false;
        }
    }

    // ---------- 廣告攔截區塊:全站生效,不分頁面 ----------
    try {
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
            const url = (typeof input === 'string') ? input : (input && input.url);
            if (isBlocked(url)) {
                console.log('[網路攔截] 已封鎖 fetch:', url);
                return Promise.reject(new Error('Blocked by userscript'));
            }
            return originalFetch.apply(this, arguments);
        };

        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            if (isBlocked(url)) {
                console.log('[網路攔截] 已封鎖 XHR:', url);
                arguments[1] = 'about:blank';
            }
            return originalXHROpen.apply(this, arguments);
        };

        function interceptElementSrc(tagName) {
            try {
                const proto = document.createElement(tagName).constructor.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'src');
                if (!descriptor || descriptor.configurable === false) return;

                Object.defineProperty(proto, 'src', {
                    get: descriptor.get,
                    set: function(value) {
                        if (isBlocked(value)) {
                            console.log(`[網路攔截] 已封鎖 ${tagName}.src:`, value);
                            return;
                        }
                        descriptor.set.call(this, value);
                    },
                    configurable: true
                });
            } catch (e) {
                console.log(`[網路攔截] ${tagName} 攔截設定失敗,已略過:`, e.message);
            }
        }
        interceptElementSrc('script');
        interceptElementSrc('img');
        interceptElementSrc('iframe');

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (['SCRIPT', 'IMG', 'IFRAME'].includes(node.tagName) && isBlocked(node.src)) {
                        node.remove();
                    }
                    if (node.tagName === 'A' && isBlocked(node.href)) {
                        node.remove();
                    }
                });
            }
        });

        const startObservation = setInterval(() => {
            if (document.documentElement) {
                observer.observe(document.documentElement, { childList: true, subtree: true });
                clearInterval(startObservation);
            }
        }, 10);
    } catch (e) {
        console.log('[網路攔截] 廣告攔截區塊初始化失敗:', e.message);
    }

    // ---------- 頁面類型判斷 ----------
    // 書籍閱讀頁:路徑包含 "/books/",不管後面接什麼章節編號
    function isBookPage() {
        // 要求 /books/ 後面至少有兩個路徑片段,例如 /books/cma6bfve8006bc8t3o7lb5gce/0
        return /^\/books\/[^\/]+\/[^\/]+/.test(location.pathname);
    }

    console.log('[頁面判斷] 目前路徑:', location.pathname, '| 是書籍頁:', isBookPage());

    // ---------- 進場滾動區塊:只在 /books/ 底下的閱讀頁執行 ----------
    if (isBookPage()) {
        try {
            function scrollDownThenJumpBack() {
                const originalY = window.scrollY;
                const speed = 400;
                let currentPosition = originalY;

                const scrollDownInterval = setInterval(() => {
                    const pageHeight = document.documentElement.scrollHeight;
                    window.scrollTo(0, currentPosition);
                    currentPosition += speed;

                    if (currentPosition >= pageHeight) {
                        clearInterval(scrollDownInterval);
                        console.log("[懶加載] 已滾到底部,準備跳回原位。");
                        setTimeout(() => {
                            window.scrollTo(0, originalY);
                            console.log("[懶加載] 已瞬間跳回原位。");
                        }, 300);
                    }
                }, 10);
            }

            function triggerScrollWhenReady() {
                console.log("[懶加載] 觸發滾動流程開始(書籍頁)。document.readyState =", document.readyState);
                setTimeout(scrollDownThenJumpBack, 500);
            }

            if (document.readyState === 'complete') {
                triggerScrollWhenReady();
            } else {
                window.addEventListener('load', triggerScrollWhenReady);
            }
        } catch (e) {
            console.log('[懶加載] 滾動區塊初始化失敗:', e.message);
        }
    } else {
        console.log('[懶加載] 非書籍頁,跳過滾動流程。');
    }

})();
