# Tampermonkey Userscripts

個人 Chrome Tampermonkey 安裝的 userscript 備份,方便日後查閱、重建或移到
新機器時快速還原。從 Tampermonkey 匯出的完整備份(`.txt`,JSON 格式,含
`source`(Base64)與每個腳本的 `storage` 自訂設定)還原時的腳本原始碼,
逐一解碼存成獨立的 `.user.js` 檔案。備份匯出時間:2026-08-12。

## 腳本清單

| 檔案 | 名稱 | 用途 | 適用網站 |
|---|---|---|---|
| [`csdn-greener.user.js`](csdn-greener.user.js) | CSDNGreener | CSDN 廣告完全過濾、免登入、個性化排版(第三方社群腳本,來源 GreasyFork) | `*.csdn.net` |
| [`zhihu-enhancement.user.js`](zhihu-enhancement.user.js) | Zhihu enhancement | 知乎介面增強:移除登入彈窗、屏蔽指定分類/關鍵字/用戶、收起回答等(第三方社群腳本) | `www.zhihu.com` |
| [`amazon-teikibin-auto-cancel.user.js`](amazon-teikibin-auto-cancel.user.js) | Amazon 定期便自動化 | 自動偵測並點擊完成 Amazon 定期購入(定期便)退訂流程,含冷卻機制避免誤觸發 | `www.amazon.co.jp/auto-deliveries/*` |
| [`salesforce-autofill-meitec.user.js`](salesforce-autofill-meitec.user.js) | Salesforce Auto-Fill Ultimate | 自製工時/日報/申請表單自動填寫腳本,加速 Salesforce 上的三軌表單操作 | `*.force.com` / `*.salesforce.com` / `*.visualforce.com` |
| [`kcc-elearn-auto-next.user.js`](kcc-elearn-auto-next.user.js) | KCC E-Learn Auto Next Lesson | 全網域(含跨 iframe)深層掃描,自動觸發「次へ」按鈕跳到下一堂課,略過線上課程的手動點擊 | `*.kcc.knowledgewing.com` |

## 安裝方式

1. 安裝瀏覽器擴充功能 [Tampermonkey](https://www.tampermonkey.net/)
2. 開啟 Tampermonkey 儀表板 → 「工具」(Utilities)分頁 →
   「檔案(從本機檔案安裝)」(Import from file),選取對應的 `.user.js`
3. 或直接把 `.user.js` 檔案拖曳到瀏覽器分頁,Tampermonkey 會自動彈出安裝
   確認畫面

## 備註

- 個人設定資訊(GUI 選項、`storage` 內存的自訂偏好值,如 CSDNGreener 的
  版面配置、Zhihu enhancement 的屏蔽關鍵字清單)未包含在此,僅保留腳本
  程式碼本身;換機器時需要在各腳本的設定選單重新調整偏好。
- `csdn-greener.user.js`、`zhihu-enhancement.user.js` 為安裝自 GreasyFork
  等社群來源的第三方腳本,更新時建議直接到原始來源重新下載,而非手動修改
  此備份檔。
- 其餘三支(Amazon、Salesforce、KCC)為個人針對特定網站流程撰寫的自動化
  腳本,內容可能含公司/服務名稱等識別資訊,依需求自行調整或移除。
