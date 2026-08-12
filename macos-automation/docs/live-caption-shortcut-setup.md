# LiveCaption2 — 即時字幕切換快捷鍵設定

透過「自動操作」(Automator)把 AppleScript 包成「快速操作」(Quick Action /
サービス),存放在 `~/Library/Services/`,再到「系統設定」的鍵盤快捷鍵頁面
指派組合鍵,達成一鍵切換 macOS 即時字幕(ライブキャプション)開關。

## 檔案放置位置

```
/Users/aston/Library/Services/LiveCaption2.workflow
```

`~/Library/Services/` 是 macOS 存放使用者自訂「服務」(Services)的固定
目錄,任何存在此處、副檔名為 `.workflow` 的 Automator 快速操作,系統會自
動掃描並出現在「系統設定 > 鍵盤 > 鍵盤快速鍵 > 服務」清單中,不需要額外
安裝或註冊。

本 repo 保存的是原始 AppleScript 原始碼:
[`../applescript/live-caption-toggle.applescript`](../applescript/live-caption-toggle.applescript),
`.workflow` 是 Automator 依此原始碼建立出的執行包(二進位 bundle,內容不
適合直接進版控管理,故不存放於此),換新機器或重建時依下方步驟重新產生
即可。

## 建立步驟(換機器 / 重建時使用)

1. 開啟「自動操作」(Automator)
2. 「檔案 > 新建文件」→ 選擇「快速操作」(Quick Action)
3. 上方「工作流程收到目前」設定為「不到任何輸入」(no input),
   「於」設定為「任何應用程式」(any application)
4. 左側搜尋「執行 AppleScript」(Run AppleScript),拖進右側工作流程區域
5. 把 [`live-caption-toggle.applescript`](../applescript/live-caption-toggle.applescript)
   的內容貼入該動作的程式碼區塊(取代預設範本內容)
6. 「檔案 > 儲存」,命名為 `LiveCaption2`
   → 會自動存放到 `~/Library/Services/LiveCaption2.workflow`

## 設定快捷鍵

1. 開啟「系統設定」(System Settings)
2. 左側選單選「サービス」(服務 / Services)
3. 展開「一般」(General)分類,勾選 `LiveCaption2`
4. 雙擊該項目右側的快速鍵欄位,按下想要的組合鍵
   (目前設定為 `⌥1`,即 Option + 1)

設定完成後,在任何 App 底下按下該組合鍵,即可執行腳本切換即時字幕開關,
不需要開啟自動操作或系統設定視窗。

## 注意事項

- 第一次執行前需在「系統設定 > 隱私權與安全性 > 輔助使用」中,允許
  執行此服務的程序(通常是 `System Events` 及觸發服務的前景 App)取得
  輔助使用權限,否則腳本內的 UI 點擊操作會失敗。
- 腳本內尋找目標按鈕/勾選框的邏輯是依「輔助使用」設定頁面目前的 UI 結構
  寫死的(見 `live-caption-toggle.applescript` 內的 fallback 邏輯),
  若日後 macOS 更新導致該頁面版面改變,可能需要用「輔助使用檢查器」
  (Accessibility Inspector,隨 Xcode 附帶)重新確認元件結構並調整腳本。
