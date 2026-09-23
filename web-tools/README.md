# Web Tools

單一檔案、不需安裝、直接用瀏覽器開啟即可使用的小工具。

## 檔案清單

| 檔案 | 用途 |
|---|---|
| [`gallery-viewer.html`](gallery-viewer.html) | 本機圖片資料夾瀏覽器。用 File System Access API 選取一個本機資料夾(遞迴掃描含子資料夾的圖片),依檔名自然排序後直接在網頁裡瀏覽,支援雙頁模式、章節(子資料夾)導覽、閱讀進度與最近 5 筆閱讀紀錄記憶、圖片寬度調整。僅支援 Chrome / Edge(Safari 不支援 `showDirectoryPicker`)。 |

## 使用方式

直接用 Chrome 或 Edge 開啟對應的 `.html` 檔案(雙擊或拖曳進瀏覽器分頁即可,不需要伺服器或安裝)。`gallery-viewer.html` 可以放在電腦上任何位置,不需要跟圖片資料夾放在一起;選過一次資料夾後,同一台電腦、同一個瀏覽器重開網頁會透過 IndexedDB 自動記住授權,不用每次重選。
