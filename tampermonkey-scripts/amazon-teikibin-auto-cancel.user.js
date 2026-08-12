// ==UserScript==
// @name         Amazon 定期便自動化 (0.5s 偵測 + 2s 延遲版)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自動化退訂流程，包含點擊後的冷卻機制
// @author       Gemini
// @match        https://www.amazon.co.jp/auto-deliveries/subscriptionList*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let isWaiting = false; // 冷卻狀態標記

    // 輔助函式：根據文字尋找並點擊元素
    function clickByText(text, selector = 'a, button, span, input') {
        if (isWaiting) return false; // 如果正在冷卻中，跳過偵測

        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
            // 檢查文字內容是否匹配
            if (el.textContent.trim().includes(text) || (el.value && el.value.includes(text))) {
                console.log(`[自動腳本] 成功觸發點擊: ${text}，開始等待 2 秒...`);

                el.click();

                // 進入冷卻狀態
                isWaiting = true;
                setTimeout(() => {
                    isWaiting = false;
                    console.log("[自動腳本] 等待結束，恢復偵測");
                }, 2000);

                return true;
            }
        }
        return false;
    }

    const runFlow = () => {
        const currentUrl = window.location.href;

        // 邏輯 1：跳轉至推薦頁面時，執行返回「定期便商品」
        if (currentUrl.includes("auto-deliveries/recommendations")) {
            clickByText("定期便商品");
            return;
        }

        // 邏輯 2：在詳情頁面執行停止與取消動作
        if (document.body.innerText.includes("ご利用中の定期おトク便の詳細")) {
            // 嘗試點擊「停止」或「取消」
            const stopClicked = clickByText("定期おトク便を停止する");
            if (!stopClicked) {
                clickByText("登録をキャンセルする");
            }
        }
    };

    // 每 500 毫秒（0.5秒）執行一次偵測
    setInterval(runFlow, 500);
})();