# travel-plan-aston

把一趟旅行變成**單檔 HTML**：互動地圖、每日時間軸、出發前訂票提醒、延伸推薦卡片牆。機械邏輯由三個引擎腳本承擔，美學交給設計步驟。

執行流程看 `SKILL.md`。本檔是**索引**——用來快速找到「某條規則寫在哪」。

## 規則速查：我想知道…

### 資料與區塊

| 問題 | 去哪查 |
|---|---|
| `trip` 物件有哪些欄位？ | `assets/page-contract.md#trip-data` |
| 頁面一定要有哪些區塊？ | `assets/page-contract.md#blocks` |
| 區塊要按什麼順序排？ | `assets/page-contract.md#block-order` |
| 行程頁跟輔助頁（住宿規劃、比價這類）差在哪？ | `assets/page-contract.md#page-types` |
| `highlights` 怎麼組？跨多據點的大範圍行程怎麼分區？座標要補到什麼程度？ | `assets/page-contract.md#highlights` |
| 頂部 sticky tab 導覽怎麼做？ | `assets/page-contract.md#tab-nav` |
| 時間軸站點的標題要連到哪？沒官網的站怎麼辦？ | `assets/page-contract.md#slot-links` |
| 地圖連結要排在哪？為什麼不另起一行？ | `assets/page-contract.md#slot-links` |
| 需要訂票／訂位的站點怎麼標？訂票連結放哪？ | `assets/page-contract.md#booking` |
| 查不到／驗不了的東西怎麼交給讀者？ | `assets/page-contract.md#unverified` |
| 地圖上的編號要怎麼對回行程？ | `assets/page-contract.md#map-numbering` |
| 淺色／深色切換鈕怎麼做？ | `assets/page-contract.md#theme-toggle` |
| 外文名詞註解區塊什麼時候要做？ | `assets/page-contract.md#glossary` |
| 解析舊 HTML 時為什麼要先反轉義？ | `assets/page-contract.md#unescape` |
| 單檔、離線、響應式、圖片防變形的硬性要求？ | `assets/page-contract.md#constraints` |
| 無障礙有哪些不能破的底線？ | `assets/page-contract.md#a11y` |
| trip-data 被改壞時頁面該怎麼反應？ | `assets/page-contract.md#parse-guard` |
| 列印／PDF 要處理什麼？ | `assets/page-contract.md#print` |
| 同一趟行程有多份頁面時怎麼串起來？ | `assets/page-contract.md#sibling-pages` |
| 什麼時候可以渲染「去預訂／導航／叫車」按鈕？ | `assets/page-contract.md#action-links` |

### 引擎

| 問題 | 去哪查 |
|---|---|
| 三個引擎有哪些函式、怎麼呼叫？ | `assets/engine-contract.md#api` |
| **為什麼地圖標記看不見／待辦清單沒樣式？** | `assets/engine-contract.md#engine-classes` |
| 卡片牆的版面、來源標籤、捲動提示規則？ | `assets/engine-contract.md#poi-wall` |
| 每站「附近推薦」面板怎麼做？距離怎麼算？ | `assets/engine-contract.md#nearby-panel` |
| 地圖連結什麼時候給高德、什麼時候給 Google？ | `assets/engine-contract.md#map-links` |
| 預訂徽章的三種形態與降級規則？ | `assets/engine-contract.md#booking-badge` |
| 改動引擎前要跑什麼？ | `assets/engine-contract.md#tests` |

### 條件式功能（先判斷觸發條件，不是每份行程都做）

| 問題 | 去哪查 |
|---|---|
| 單日往返、不涉航班住宿的行程怎麼組資料？ | `assets/conditional-features.md#transit` |
| 什麼時候該做雙方案 A/B 與每日雙強度路線？ | `assets/conditional-features.md#dual-plans` |
| 季節性目的地的「收季」標籤怎麼標？ | `assets/conditional-features.md#season-status` |

### 視覺與調研

| 問題 | 去哪查 |
|---|---|
| 配色用哪一組？雙主題怎麼寫？ | `references/design-guidelines.md#palette` |
| 排版、斷點、桌機寬度？ | `references/design-guidelines.md#layout` |
| 卡片牆的來源標籤、距離標籤長什麼樣？ | `references/design-guidelines.md#poi-visuals` |
| 季節狀態標籤長什麼樣？ | `references/design-guidelines.md#status-visuals` |
| 預訂徽章長什麼樣？ | `references/design-guidelines.md#booking-visuals` |
| 雙方案／雙強度路線長什麼樣？ | `references/design-guidelines.md#dual-plan-visuals` |
| 圖片、徽章、動畫的細節準則？ | `references/design-guidelines.md#details` |
| 開始前該問使用者什麼？哪些該自己查？ | `references/brief-checklist.md` |
| 聯網調研要採集什麼？`url` 要怎麼驗證？ | `references/research-guide.md` |
| 想搬到 Codex 或別的 Agent 上跑？ | `references/porting-to-other-agents.md` |
| 怎麼知道某條檢查不是「永遠不會叫」？ | 跑 `assets/probe.js`，它會餵合成陽性逐條驗證 |

## 術語表

同一件事只用一個叫法。這幾組曾經混用（多半是簡繁轉換留下的痕跡），寫文件時請照這裡：

| 用這個 | 不要用 | 指的是 |
|---|---|---|
| **腳本** | 指令碼 | script。`指令碼` 是簡繁轉換工具的機械譯法，同一份檔案裡兩種混用會讓搜尋漏掉一半 |
| **卡片牆** | — | `poi.js` 產生的 `.poi-grid` 橫捲容器。描述它捲不動時可以說「橫捲軌道」，那是修飾語不是別名 |
| **附近推薦面板** | — | 每站可展開的 `.nearby-panel`。它裡面的子清單叫「附近清單」，是部分不是整體 |
| **輔助頁** | — | 沒有 `trip-data` 的單一主題頁（住宿規劃／比價）。用「單一主題的補充頁」來**定義**它可以，當別名用不行 |
| **姊妹頁** | — | 同一趟行程的多份頁面**之間的關係**，跟「輔助頁」是不同維度：逐日行程頁也是別人的姊妹頁 |
| **延伸推薦總覽** | — | `highlights` 那個區塊。後續提及可簡稱「總覽」 |

另外注意：「卡片清單」指的是航班／酒店／行前須知那種縱向卡片列表，**不是**卡片牆。

## 檔案地圖

```
SKILL.md                            執行流程（判斷模式 → 盤問 → 調研 → 組資料 → 生成 → 校驗 → 回報）
README.md                           本檔：規則索引
assets/
  page-contract.md                  一律適用的規則（唯一權威）
  engine-contract.md                引擎規則
  conditional-features.md           條件式功能
  map.js  reminders.js  poi.js      ← 三份都要原樣內聯進產出的 HTML
  poi.test.js                       poi.js 回歸測試（24 個）
  map.test.js                       map.js 回歸測試（14 個）
  reminders.test.js                 reminders.js 回歸測試（16 個）
  validate.js                       產出頁面的契約校驗
  check-refs.js                     文件自身的十一項檢查（引用、清單、數字、誤字、指路方式）
  check-links.js                    產出頁面的外部連結有效性
  probe.js                          檢查器的自我探測：證明每條檢查真的會叫
references/
  brief-checklist.md                Mode A 的 brief 清單與提問模板
  research-guide.md                 聯網調研規範
  design-guidelines.md              內建美學準則（含固定色票）
  porting-to-other-agents.md        跨 Agent 適配（含檔案職責表）
```

## 常用指令

```bash
node assets/validate.js <生成的.html>   # 產出頁面後必跑
node assets/poi.test.js                # 改過 poi.js 才需要
node assets/map.test.js                # 改過 map.js 才需要
node assets/reminders.test.js          # 改過 reminders.js 才需要
node assets/check-refs.js              # 改過任何文件或新增檔案後必跑（十一項檢查）
node assets/check-links.js <頁面>      # 產出頁面後（需要外網，約 30 秒）
node assets/probe.js <頁面>            # 改過 validate.js／check-refs.js 後必跑
```

## 八條不可破的維護原則

這幾條都是**修過一次才立下的**，改動時請不要繞過：

1. **交叉引用一律寫「檔名 + 井號 + 錨點」，不要用「第 N 節」。** 節號會隨內容增減靜默失效——曾經害 `validate.js` 的 20 條警告全部指錯地方。改完跑 `check-refs.js`。
2. **引擎只輸出語意 class，樣式責任在頁面。** 漏寫 `map.js` 的 `.route-pin` 會讓地圖上所有標記變透明，而元素數量完全正常、讀程式碼抓不到。清單見 `engine-contract.md#engine-classes`。
3. **`POI_GRID_ROWS` 改了要同步三處**：`poi.js` 常數、`poi.test.js` 閾值測試、`validate.js` 檢查頁面 CSS 的 `repeat(N, auto)` 字串。只改一處會靜默失效。
4. **座標一律 WGS-84。** 高德／騰訊回傳 GCJ-02，必須先過 `map.js` 的 `gcj02ToWgs84`，否則 OSM 圖上偏移數百公尺。
5. **新增檔案要登記進 `porting-to-other-agents.md` 的職責表。** 別的 Agent 照那張表讀檔，漏登記等於這個檔案不存在。`check-refs.js` 會擋。
6. **量「容器的溢出與捲動能力」，不要量「子元素排成幾行」。** 為什麼、以及該量哪幾個屬性，見 `SKILL.md` 的瀏覽器實測那一步。
7. **永遠都在的警告等於沒有警告。** `validate.js` 曾經對每一份輔助頁報「本檔是輔助頁」、對每一份行程頁報「免責宣告疑似沒渲染」——後者尤其糟，它懲罰的正是契約強制要求的「資料與呈現分離」。兩條都是 100% 誤報，於是每份頁面跑完都是「通過（有 1 條 warning）」，人就學會了跳過警告區。現在這類訊息走 `· 註記` 通道，**合規頁面應該 0 warning**。
8. **能機械擋的規則，不要只寫在文件裡；而每條檢查都要餵合成陽性證明它會叫。** 上面第 1 條原本只是文件裡的一句話，靠人記得——結果兩份契約累積了 15 處序號引用，抽查的每一處都已經指錯地方。加進 `check-refs.js` 之後同一類錯誤再也回不來。另一面同樣重要：`validate.js` 曾經有四條檢查因為讀錯欄位而**永遠不會叫**，跑起來全過。`assets/probe.js` 就是為此存在——它故意把輸入弄壞，斷言檢查器抱怨到對的點上。**不會叫的檢查比沒有檢查更糟，它給人被守著的錯覺。**

## 三個花過代價才學到的坑

- **雙重轉義**：從既有 HTML 解析出來的字串帶著 `&amp;`，引擎的 `escapeHTML` 會再轉一次，頁面上出現 `Chinatown &amp; Cultural Centre`；更糟的是 URL 裡的 `&amp;` 會讓 Google 收到參數名 `amp;query`，連結全部失效。見 `page-contract.md#unescape`。
- **`min-width: 0`**：grid／flex 子項預設不得縮小到比內容更窄，卡片牆會把欄位撐開到三千多 px，`overflow-x` 永不觸發，外層 `overflow:hidden` 再把它裁掉——卡片既不能捲也點不到。見 `engine-contract.md#poi-wall`。
- **`[hidden]` 被 class 選擇器蓋過**：`.nearby-panel{display:flex}` 的優先權高於瀏覽器對 `hidden` 的 UA 樣式，面板一開始就是展開的，按鈕卻還寫著「顯示」。見 `engine-contract.md#nearby-panel`。
