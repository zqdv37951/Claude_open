# 跨 Agent 適配指南

本 skill 設計為**平臺無關**：核心是一份指令文件（SKILL.md）+ 三份契約 + 10 個純 JavaScript 檔案 + 三份參考文件。沒有繫結任何單一廠商的專有能力。

| 類別 | 檔案 | 進最終頁面? |
|------|------|------------|
| 指令 | `SKILL.md`（工作流）、`README.md`（規則索引與速查表） | — |
| 契約 | `assets/page-contract.md`（一律適用規則）、`assets/engine-contract.md`（引擎規則）、`assets/conditional-features.md`（條件式功能） | — |
| 引擎 | `assets/map.js`、`assets/reminders.js`、`assets/poi.js` | **✅ 三份都要原樣內聯** |
| 工具 | `assets/validate.js`（生成後校驗）、`assets/poi.test.js`／`assets/map.test.js`／`assets/reminders.test.js`（三引擎迴歸測試）、`assets/check-refs.js`（文件自身的十一項檢查）、`assets/check-links.js`（外部連結有效性）、`assets/probe.js`（檢查器的自我探測——證明每條檢查真的會叫） | ❌ |
| 參考 | `references/brief-checklist.md`、`references/research-guide.md`、`references/design-guidelines.md`、本文件 | — |

## 它需要宿主 Agent 提供什麼能力

| 能力 | 用途 | 沒有怎麼辦 |
|------|------|-----------|
| 聯網搜尋 / 網頁抓取 | 調研座標、圖片、天氣、營業時間等 | 退化為模型已知資訊（要標註可能過時） |
| 寫檔案 | 輸出 `.html` | 直接把 HTML 文字返回給使用者 |
| 讀本倉庫檔案 | 讀 assets/ 引擎與契約 | 把引擎內容粘進 prompt |
| 跑 Node（強烈建議） | `validate.js` 契約校驗、`poi.test.js` 迴歸測試、`check-refs.js` 引用檢查、`probe.js` 檢查器自我探測 | 人工對照三份契約逐條檢查；這些腳本都是純 Node、零依賴，能跑就別省 |
| 跑瀏覽器/開啟檔案（可選） | 驗證頁面效果 | 讓使用者自己開啟 |
| 呼叫設計類 skill（可選） | 更好的美學 | 用 `design-guidelines.md` 內建準則 |
| 呼叫第三方旅行 skill（可選，飛豬/高德/騰訊地圖/滴滴等） | 實時航班/酒店/路線規劃/天氣/座標 + 官方行動連結 | 走靜態聯網調研，照常出完整頁面 |

## 三種宿主，三種裝法

**1. Claude Code** —— 放進 skills 目錄：
```bash
ln -sfn "<repo>/travel-plan-aston" ~/.claude/skills/travel-plan-aston
```

**2. OpenAI Codex** —— 同樣有 skills 目錄：
```bash
ln -sfn "<repo>/travel-plan-aston" ~/.codex/skills/travel-plan-aston
```
（若兩端共用一份源，可只放一處真目錄、另一處軟鏈過去。）

**3. 其他 Agent（無 skills 機制）** —— 把 `SKILL.md` 的內容作為系統/任務指令餵給它，並保證它能讀到 `assets/`、`references/` 下的檔案（或一併貼上）。可直接用下面的「通用適配提示詞」。

## 通用適配提示詞（粘給任意 Agent）

```
你將扮演一個「旅行計劃視覺化」工具。請先閱讀我提供的這套檔案並嚴格遵循：
- SKILL.md：工作流（判斷模式 → 聯網調研 → 用設計步驟生成單檔案 HTML）
- README.md：規則索引——「某條規則寫在哪」的速查表，加上不可破的維護原則
- assets/page-contract.md：一律適用的規則——trip 資料結構、區塊順序、必須包含的區塊、頁頂 tab 導覽、**需要購票／訂位的站點要在時間軸標出徽章且徽章本身是訂票連結**、外文名詞註解、硬性約束、兩種頁面型別（行程頁 / 輔助頁）
- assets/engine-contract.md：引擎規則——三引擎函式簽章、**引擎只輸出語義 class、樣式責任在頁面**（漏寫會讓地圖示記全部隱形卻不報錯）、卡片牆與附近面板的渲染規則、地圖連結規則（境內高德／境外只給 Google 且用名稱+視野錨點，不用純座標）
- assets/conditional-features.md：條件式功能——先判斷觸發條件再決定要不要做：transit 取代航班住宿、雙方案 A/B 與每日雙強度路線、季節狀態標籤
- assets/map.js、assets/reminders.js、assets/poi.js：必須原樣內聯進輸出 HTML 的引擎（地圖、提醒、延伸推薦/附近推薦卡片牆）；完整 trip 物件以 <script id="trip-data" type="application/json"> 內嵌
- assets/validate.js：生成後的機械校驗（能跑 Node 就執行，否則人工對照契約）
- assets/poi.test.js／assets/map.test.js／assets/reminders.test.js：改動對應引擎前先跑的迴歸測試
- assets/check-refs.js：改動任何文件後跑。十一項檢查：交叉引用、檔案清單、數字對帳、誤字、位置式引用、同檔錨點、目錄完整性、規則單一住所、裸檔名、引號章節名
- assets/check-links.js：產出頁面後跑，驗外部連結真的打得開（需要外網）
- assets/probe.js：改動 validate.js 或 check-refs.js 後跑。它故意把輸入弄壞，斷言檢查器抱怨到對的點上——不會叫的檢查比沒有檢查更糟
- references/brief-checklist.md：Mode A 開始前的 brief 清單、11 個分岔點與提問模板
- references/research-guide.md：聯網調研規範（圖片用 Special:FilePath 且校驗 200；不查實時票價；全覆蓋免責宣告）
- references/design-guidelines.md：沒有專業設計 skill 時的內建美學準則

請用你自身的聯網搜尋、檔案寫入能力執行。若你沒有某項能力（如不能聯網），就用已知資訊但在頁面免責宣告裡說明，絕不編造可驗證的事實（如不可載入的圖片連結）。
開始前先用一句話複述你將如何執行，確認理解無誤。
```

## 適配時最容易翻車的點

- **圖片**：URL 形式與「必須驗證返回 200」的規則寫在 `references/research-guide.md`（唯一權威，本檔不複述）。要注意的是**別讓模型手拼帶雜湊的直鏈**——那是跨 Agent 適配時最常見的失敗。
- **單檔案自包含**：`map.js`/`reminders.js`/`poi.js` 三個引擎內容都要內聯進 HTML，不要外鏈本地檔案——漏掉 `poi.js` 時延伸推薦總覽與每站附近推薦面板會直接失效（`nearbyGridHTML`/`poiWallHTML` 等未定義）。
- **建置時驗不了的事**：查不到、或在你的執行環境驗不了的具體項目，要列進 `trip.unverified` 並渲染成可勾選清單（`item` / `why` / `how` 三個欄位缺一不可）。**一句籠統的免責宣告不算交代**——它對每份頁面都成立，所以不帶資訊。規則見 `assets/page-contract.md#unverified`。
- **預訂徽章**：需要提前購票／訂位的站點要標在**時間軸上**（不是只放進頁頂待辦清單），徽章本身就是官方訂票頁的連結。查不到訂票頁就留空——**填官網首頁比空著更糟**。規則見 `assets/page-contract.md#booking`（唯一權威，本檔不複述）。
- **免責宣告**：覆蓋全部聯網資訊（天氣/餐廳/評分…），不只是機票酒店。
- **不查實時價**：機票/門票只給參考區間。
- **座標系**：高德/騰訊類工具返回的 GCJ-02 座標須先經 `map.js` 的 `gcj02ToWgs84` 轉成 WGS-84 再入 `trip`，否則 OSM 地圖上偏移幾百米。
- **引擎 class 的樣式**：三個引擎只輸出語義 class，樣式一律由頁面負責，**漏寫不會報錯、只會安靜地消失**。完整清單與後果見 `assets/engine-contract.md#engine-classes`（唯一權威，本檔不複述）。
- **連結有效性**：`url` 欄位跟圖片一樣要驗證。頁面上完全看不出來，讀者點下去才發現。用 `node assets/check-links.js <頁面>`。
- **生成後校驗**：宿主能跑 Node 就執行下面這幾支；不能跑 Node 就人工對照三份契約檢查。

  ```bash
  node assets/validate.js <生成的.html>   # 契約校驗：欄位/座標/必需區塊/引擎 class 樣式
  node assets/poi.test.js                # poi.js 迴歸測試（改過 poi.js 才需要）
  node assets/check-refs.js              # 文件自身的十一項檢查（改過任何文件都要跑）
  node assets/check-links.js <頁面>      # 外部連結有效性（需要外網）
  node assets/probe.js <頁面>            # 檢查器自我探測（改過 validate.js／check-refs.js 才需要）
  ```

  `validate.js` 會依「有沒有內嵌 trip-data」自動判別頁面型別：**行程頁**套全套規則，**輔助頁**（住宿規劃、比價、裝備清單這類單一主題補充頁）只套通用規則，不會因為「沒有地圖/提醒清單」而報一串假 ERROR。
- **改動契約文件後跑 `check-refs.js`**：這套文件彼此大量交叉引用，一律寫成「檔名 + 井號 + 錨點」形式。早期用「第 N 節」編號，結果每次新增章節就讓舊引用悄悄指錯地方——而且不報錯，使用者照著 `validate.js` 的警告去查會查到不相干的內容。`check-refs.js` 讓這件事變成 exit 1 的錯誤，並且連「用序號指路」「用引號章節名指路」「省掉 .md」這幾種繞過錨點的寫法一起擋掉。
