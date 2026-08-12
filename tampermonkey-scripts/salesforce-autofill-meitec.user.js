// ==UserScript==
// @name         Salesforce Auto-Fill Ultimate (Meitec)
// @namespace    http://tampermonkey.net/
// @version      8.3
// @description  極速調校版：三軌自動化（手当 / デイリーサマリー / 申請）挑戰 Salesforce API 同步極限
// @author       YourDebatePartner
// @match        *://*.force.com/*
// @match        *://*.salesforce.com/*
// @match        *://*.visualforce.com/*
// @allFrames    true
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("[Debug-Core] 🚀 三軌自動化腳本 V8.3 已載入！(競速調校版)");

    // 🏆 競速核心配置區
    const CONFIG = {
        RESET_DELAY_MS: 100,
        MODAL_WARMUP_MS: 600,
        API_SYNC_MS: 800,
        HUMAN_CLICK_DELAY: 30
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function isElementStrictlyVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
    }

    async function waitForElement(selector, timeout = 8000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const els = document.querySelectorAll(selector);
            for (let el of els) {
                if (isElementStrictlyVisible(el)) return el;
            }
            await sleep(100);
        }
        return null;
    }

    async function waitUntilSystemReady() {
        const start = Date.now();
        while (Date.now() - start < 5000) {
            const spinners = document.querySelectorAll('.slds-spinner, .loading-mask, [aria-busy="true"]');
            let isBusy = false;
            for (let s of spinners) {
                if (isElementStrictlyVisible(s)) {
                    isBusy = true;
                    break;
                }
            }
            if (!isBusy) {
                await sleep(300);
                return true;
            }
            await sleep(100);
        }
        return false;
    }

    async function waitForCondition(conditionFn, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (conditionFn()) return true;
            await sleep(100);
        }
        return false;
    }

    async function forceClick(element) {
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(CONFIG.HUMAN_CLICK_DELAY);
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
        await sleep(20);
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        await sleep(CONFIG.HUMAN_CLICK_DELAY);
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        element.click();
    }

    async function setNativeValue(element, value) {
        if (!element) return;
        element.focus();
        try {
            if (element.tagName.toLowerCase() === 'select') {
                element.value = value;
            } else {
                let proto = Object.getPrototypeOf(element);
                let descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                while (proto && !descriptor) {
                    proto = Object.getPrototypeOf(proto);
                    if (proto) descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                }
                if (descriptor && descriptor.set) {
                    descriptor.set.call(element, value);
                } else {
                    element.value = value;
                }
            }
        } catch (e) {
            element.value = value;
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(50);
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        if (document.activeElement === element) {
            document.body.focus();
        }
    }

    function findButtonByText(text, container = document) {
        const buttons = container.querySelectorAll('button');
        for (let btn of buttons) {
            if (btn.textContent.trim() === text && isElementStrictlyVisible(btn)) return btn;
        }
        return null;
    }

    // --- 流程 1：手当 ---
    async function processAllowanceModal() {
        console.log("[Debug-Allowance] 🎯 偵測到「手当」彈窗...");

        await waitUntilSystemReady();
        console.log(`[Debug-Allowance] ⏳ 暖機等待 ${CONFIG.MODAL_WARMUP_MS}ms...`);
        await sleep(CONFIG.MODAL_WARMUP_MS);

        const targetCell = await waitForElement('div[title="交通費不支給"]', 3000);
        if (targetCell) {
            await forceClick(targetCell);
            await sleep(200);
        }

        const quantityInput = await waitForElement('input.timesheet-pc-allowance-dialog__body__table-input-quantity', 2000);
        if (quantityInput) {
            await setNativeValue(quantityInput, '1');
            console.log("[Debug-Allowance] 數值已填寫。");
        }

        await waitUntilSystemReady();
        console.log(`[Debug-Allowance] ⏳ 同步等待 ${CONFIG.API_SYNC_MS}ms...`);
        await sleep(CONFIG.API_SYNC_MS);

        const regBtn = findButtonByText('登録');
        if (regBtn) {
            console.log("[Debug-Allowance] 🔘 點擊「登録」按鈕。");
            await forceClick(regBtn);
        } else {
            console.error("[Debug-Allowance] ❌ 找不到可見的「登録」按鈕。");
        }
    }

    // --- 流程 2：デイリーサマリー ---
    async function processDailySummary() {
        console.log("[Debug-Summary] 🎯 偵測到「デイリーサマリー」...");
        await waitUntilSystemReady();

        const isFormReady = await waitForCondition(() => document.querySelectorAll('.task__extended__item-list__item').length >= 15, 15000);
        if (!isFormReady) return;
        await sleep(CONFIG.MODAL_WARMUP_MS);

        for (let i = 0; i < 5; i++) {
            const items = document.querySelectorAll('.task__extended__item-list__item.task-hierarchy');
            if (!items[i]) continue;
            const clickableDiv = items[i].querySelector('.container') || items[i].firstElementChild || items[i];
            await forceClick(clickableDiv);

            if (await waitForCondition(() => findButtonByText('お気に入りから検索'), 8000)) {
                await forceClick(findButtonByText('お気に入りから検索'));
            } else continue;

            const firstResult = await waitForElement('.favorite-search-result-table__scrollable [role="columnheader"]', 8000);
            if (firstResult) await forceClick(firstResult);

            if (await waitForCondition(() => {
                const btn = findButtonByText('決定');
                return btn && !btn.hasAttribute('disabled');
            }, 5000)) {
                await forceClick(findButtonByText('決定'));
            }
            await waitForCondition(() => !document.querySelector('.ExtendedItemHierarchyDialog__Title-sc-1x0hxr-3'), 5000);
            await sleep(400);
        }

        const allItems = document.querySelectorAll('.task__extended__item-list__item');
        if (allItems.length >= 15) {
            await setNativeValue(allItems[5].querySelector('select'), 'B');
            await sleep(100);
            await setNativeValue(allItems[6].querySelector('select'), 'B');

            const inputValues = [
                { index: 10, val: 'SRD' }, { index: 11, val: '740200' },
                { index: 12, val: 'クラウド技術' }, { index: 13, val: 'AWS(Amazon Web Services)' },
                { index: 14, val: 'サーバ設計' }
            ];
            for (let target of inputValues) {
                const inputElement = allItems[target.index].querySelector('input');
                if (inputElement) {
                    await setNativeValue(inputElement, target.val);
                    await sleep(50);
                }
            }
        }

        let actualWorkTime = null;
        const timeLabels = document.querySelectorAll('.Header__TimeLabel-sc-yduymy-6');
        for (let tl of timeLabels) {
            const labelSpan = tl.querySelector('.Header__Label-sc-yduymy-7');
            if (labelSpan && labelSpan.textContent.trim() === '実労働時間') {
                const timeSpan = tl.querySelector('.Header__Time-sc-yduymy-9');
                if (timeSpan) {
                    actualWorkTime = timeSpan.textContent.trim();
                    break;
                }
            }
        }

        if (actualWorkTime) {
            const taskRowTimeInput = await waitForElement('.TaskRow__TaskTime-sc-kefadh-12 input', 3000);
            if (taskRowTimeInput) await setNativeValue(taskRowTimeInput, actualWorkTime);
        }

        await waitUntilSystemReady();
        await sleep(CONFIG.API_SYNC_MS);

        const saveAndCloseBtn = findButtonByText('保存して閉じる');
        if (saveAndCloseBtn) {
            await forceClick(saveAndCloseBtn);
            console.log("[Debug-Summary] 點擊保存。");

            const isWarningDialogAppeared = await waitForCondition(() => {
                const dialogText = document.querySelector('.commons-dialogs-confirm-dialog__content p');
                return dialogText && dialogText.textContent.includes('作業時間が登録されていない');
            }, 1500);

            if (isWarningDialogAppeared) {
                console.warn("[Debug-Summary] ⚠️ 偵測到「作業時間未登錄」警告彈窗！");
                const cancelBtn = document.querySelector('[data-testid="commons-dialogs-confirm-dialog__cancel-button"]') || findButtonByText('キャンセル');

                if (cancelBtn) {
                    await forceClick(cancelBtn);
                    console.log("[Debug-Summary] 🛑 已點擊「キャンセル」。");
                    await sleep(500);

                    const retrySaveBtn = findButtonByText('保存して閉じる');
                    if (retrySaveBtn) {
                        await forceClick(retrySaveBtn);
                        console.log("[Debug-Summary] 🔄 再次點擊保存。");
                    } else {
                        console.error("[Debug-Summary] ❌ 找不到第二次保存的按鈕。");
                    }
                }
            }
        } else {
            console.error("[Debug-Summary] ❌ 找不到保存按鈕。");
        }
    }

    // --- 流程 3：申請 (勤務時間変更) ---
    async function processRequestModal() {
        console.log("[Debug-Request] 🎯 偵測到「申請」彈窗...");
        await waitUntilSystemReady();
        await sleep(CONFIG.MODAL_WARMUP_MS);

        // 1. 尋找「勤務時間変更」按鈕
        let changeTimeBtn = null;
        const buttons = document.querySelectorAll('button.timesheet-pc-dialogs-daily-att-request-dialog-menu__item-button');
        for (let btn of buttons) {
            if (btn.textContent.includes('勤務時間変更') && isElementStrictlyVisible(btn)) {
                changeTimeBtn = btn;
                break;
            }
        }

        if (changeTimeBtn) {
            console.log("[Debug-Request] 🔘 點擊「勤務時間変更」...");
            await forceClick(changeTimeBtn);
            await sleep(CONFIG.MODAL_WARMUP_MS); // 等待表單展開
        } else {
            console.warn("[Debug-Request] ⚠️ 未找到「勤務時間変更」按鈕，可能已在表單內。");
        }

        await waitUntilSystemReady();
        await sleep(CONFIG.API_SYNC_MS);

        // 2. 尋找表單底部的「申請」按鈕 (摒棄動態 hash class，使用語義化尋找)
        const applyBtn = findButtonByText('申請');
        if (applyBtn) {
            console.log("[Debug-Request] 🔘 點擊「申請」按鈕。");
            await forceClick(applyBtn);
        } else {
            console.error("[Debug-Request] ❌ 找不到「申請」按鈕。");
        }
    }

    // 狀態控管模組
    const AppState = {
        allowance: { handled: false, processing: false, resetTimeout: null },
        summary: { handled: false, processing: false, resetTimeout: null },
        request: { handled: false, processing: false, resetTimeout: null }
    };

    const observer = new MutationObserver((mutations) => {
        // --- 1. 手当 判斷 ---
        const visibleAllowanceHeader = Array.from(document.querySelectorAll('.commons-dialog-frame__header-title'))
            .find(h => h.textContent.trim() === '手当' && isElementStrictlyVisible(h));

        if (visibleAllowanceHeader) {
            if (AppState.allowance.resetTimeout) {
                clearTimeout(AppState.allowance.resetTimeout);
                AppState.allowance.resetTimeout = null;
            }
            if (!AppState.allowance.handled && !AppState.allowance.processing) {
                AppState.allowance.processing = true;
                processAllowanceModal().finally(() => {
                    console.log("[Debug-Allowance] 流程執行完畢。");
                    AppState.allowance.handled = true;
                    AppState.allowance.processing = false;
                });
            }
        } else {
            if (AppState.allowance.handled && !AppState.allowance.processing && !AppState.allowance.resetTimeout) {
                AppState.allowance.resetTimeout = setTimeout(() => {
                    AppState.allowance.handled = false;
                    AppState.allowance.resetTimeout = null;
                }, CONFIG.RESET_DELAY_MS);
            }
        }

        // --- 2. デイリーサマリー 判斷 ---
        const visibleSummaryHeader = Array.from(document.querySelectorAll('.Header__Title-sc-edpl2r-1'))
            .find(h => h.textContent.trim() === 'デイリーサマリー' && isElementStrictlyVisible(h));

        if (visibleSummaryHeader) {
            if (AppState.summary.resetTimeout) {
                clearTimeout(AppState.summary.resetTimeout);
                AppState.summary.resetTimeout = null;
            }
            if (!AppState.summary.handled && !AppState.summary.processing) {
                AppState.summary.processing = true;
                processDailySummary().finally(() => {
                    console.log("[Debug-Summary] 流程執行完畢。");
                    AppState.summary.handled = true;
                    AppState.summary.processing = false;
                });
            }
        } else {
            if (AppState.summary.handled && !AppState.summary.processing && !AppState.summary.resetTimeout) {
                AppState.summary.resetTimeout = setTimeout(() => {
                    AppState.summary.handled = false;
                    AppState.summary.resetTimeout = null;
                }, CONFIG.RESET_DELAY_MS);
            }
        }

        // --- 3. 申請 判斷 ---
        const visibleRequestHeader = Array.from(document.querySelectorAll('.commons-dialog-frame__header-title'))
            .find(h => h.textContent.trim() === '申請' && isElementStrictlyVisible(h));

        if (visibleRequestHeader) {
            if (AppState.request.resetTimeout) {
                clearTimeout(AppState.request.resetTimeout);
                AppState.request.resetTimeout = null;
            }
            if (!AppState.request.handled && !AppState.request.processing) {
                AppState.request.processing = true;
                processRequestModal().finally(() => {
                    console.log("[Debug-Request] 流程執行完畢。");
                    AppState.request.handled = true;
                    AppState.request.processing = false;
                });
            }
        } else {
            if (AppState.request.handled && !AppState.request.processing && !AppState.request.resetTimeout) {
                AppState.request.resetTimeout = setTimeout(() => {
                    AppState.request.handled = false;
                    AppState.request.resetTimeout = null;
                }, CONFIG.RESET_DELAY_MS);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();