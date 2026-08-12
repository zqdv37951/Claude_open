// ==UserScript==
// @name         KCC E-Learn Auto Next Lesson (Ultimate Scan)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  全網域深層掃描，確保百分之百觸發「次へ」按鈕
// @author       Zhuang Zhenhao
// @match        https://www.kcc.knowledgewing.com/*
// @match        https://cdn.kcc.knowledgewing.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=knowledgewing.com
// @grant        none
// @run-at       document-end
// @allFrames    true
// ==/UserScript==

(function() {
    'use strict';

    const MESSAGE_KEY = 'KCC_VIDEO_FINISHED';

    // 輔助函數：深層尋找並點擊按鈕
    function findAndClickNextButton() {
        // 1. 先嘗試在當前 document 找
        let btn = document.querySelector('button.kc-el-next-btn, .kc-el-next-btn');
        if (btn) return btn;

        // 2. 如果找不到，往最上層 (window.top) 的主文檔找
        try {
            btn = window.top.document.querySelector('button.kc-el-next-btn, .kc-el-next-btn');
            if (btn) return btn;
        } catch (e) { /* 跨域引發錯誤則無視 */ }

        // 3. 如果還是找不到，掃描最上層之下的所有 iframe (排除跨域限制的)
        try {
            const allFrames = window.top.frames;
            for (let i = 0; i < allFrames.length; i++) {
                try {
                    btn = allFrames[i].document.querySelector('button.kc-el-next-btn, .kc-el-next-btn');
                    if (btn) return btn;
                } catch (e) { /* 忽略跨域的 iframe */ }
            }
        } catch (e) { }

        // 4. 嘗試尋找包含 "次へ" 文字的任意按鈕
        const allButtons = document.querySelectorAll('button');
        for (let b of allButtons) {
            if (b.textContent.includes('次へ')) return b;
        }

        return null;
    }

    // 輔助函數：尋找全域函數並執行
    function tryCallGlobalFunction() {
        const funcName = 'clickLearnNext';
        const targets = [window, window.top, window.parent];

        for (let target of targets) {
            try {
                if (target && typeof target[funcName] === 'function') {
                    target[funcName]();
                    return true;
                }
            } catch (e) { }
        }
        return false;
    }

    // ==================== 接收端邏輯 ====================
    // 讓所有層級都當接收端，誰有權限點按鈕就由誰動手
    window.addEventListener('message', function(event) {
        if (!event.origin.includes('knowledgewing.com')) return;

        if (event.data === MESSAGE_KEY) {
            console.log(`[AutoNext] [${window.location.hostname}] 收到結束訊號，開始全面搜捕按鈕...`);

            const nextButton = findAndClickNextButton();
            if (nextButton) {
                console.log('[AutoNext] 🎯 成功捕獲「次へ」按鈕，執行點擊！');
                nextButton.click();
            } else if (tryCallGlobalFunction()) {
                console.log('[AutoNext] 🚀 成功透過全域函數觸發下一課！');
            } else {
                console.warn(`[AutoNext] [${window.location.hostname}] 當前層級依然找不到按鈕，交給其他層級嘗試。`);
            }
        }
    });

    // ==================== 監聽端邏輯 (CDN 影片層) ====================
    if (window.location.hostname === 'cdn.kcc.knowledgewing.com') {
        console.log('[AutoNext] CDN 影片層已就緒，開始監聽時間與阻擋干擾...');

        let videoFinishedReported = false;

        // 解決播放被瀏覽器阻擋 (Playback blocked) 的問題：一發現暫停且有時間就自動點播放
        function checkAutoplayBlock() {
            const video = document.querySelector('video');
            if (video && video.paused && video.currentTime > 0 && !video.ended && !videoFinishedReported) {
                video.play().catch(() => {});
            }
        }
        setInterval(checkAutoplayBlock, 2000);

        // 檢查時間的核心邏輯
        function checkTime() {
            const timeContainer = document.querySelector('.flex.gap-1.h-6.items-center');
            if (!timeContainer) return;

            const timeSpans = timeContainer.querySelectorAll('span');
            if (timeSpans.length < 3) return;

            const currentTime = timeSpans[0].textContent.trim();
            const totalTime = timeSpans[2].textContent.trim();

            if (!currentTime || !totalTime || currentTime === '00:00:00') return;

            if (currentTime === totalTime && !videoFinishedReported) {
                console.log(`[AutoNext] 內層偵測播放結束 (${currentTime}/${totalTime})，群發廣播訊號...`);
                videoFinishedReported = true;

                // 同時向 top 和 parent 發送訊號，確保萬無一失
                if (window.top) window.top.postMessage(MESSAGE_KEY, '*');
                if (window.parent) window.parent.postMessage(MESSAGE_KEY, '*');
            }
        }

        setInterval(checkTime, 1000);
    }
})();