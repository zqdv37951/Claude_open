---
name: travel-plan-aston
description: 把旅行行程做成美觀、離線可讀、手機優先的單一檔案 HTML（互動地圖 + 每日時間軸 + 出發前訂票提醒 + 延伸推薦卡片牆 + 外文名詞對照表）。兩種用法——只給目的地和天數讓它幫你規劃，或丟一份現成計劃讓它直接出頁面。也能產出同一趟行程的補充頁（住宿規劃／比價／裝備清單），並在需要時給雙方案 A/B 與每日雙強度路線。觸發：旅行計劃視覺化、做旅行攻略網頁、行程 HTML、住宿規劃、行程比價頁、travel plan visualization、itinerary page。
---

# 旅行計劃視覺化

把一趟旅行變成單檔 HTML：互動地圖、每日時間軸、出發前訂票提醒。機械邏輯全部由自帶引擎承擔，美學交給設計步驟。

## 這份 skill 的四份權威檔案

規則只住一個地方，不要在別處複述。交叉引用一律寫 `檔名#錨點`。

| 檔案 | 管什麼 | 什麼時候讀 |
|---|---|---|
| `assets/page-contract.md` | **一律適用**：`trip` 資料結構（`page-contract.md#trip-data`）、區塊順序（`page-contract.md#block-order`）、必做區塊（`page-contract.md#blocks`）、外文註解（`page-contract.md#glossary`）、硬性約束（`page-contract.md#constraints`） | 組資料前、生成前 |
| `assets/engine-contract.md` | **引擎**：函式簽章（`engine-contract.md#api`）、class 樣式責任（`engine-contract.md#engine-classes`）、卡片牆／附近面板／地圖連結規則、回歸測試（`engine-contract.md#tests`） | 生成前、內聯引擎時 |
| `assets/conditional-features.md` | **條件式**：`transit` 取代航班住宿（`conditional-features.md#transit`）、雙方案 A/B（`conditional-features.md#dual-plans`）、季節狀態標籤（`conditional-features.md#season-status`） | 組資料前判斷觸發條件 |
| `references/research-guide.md` | 聯網調研規範、第三方 skill 適配 | 調研階段 |

另有 `references/design-guidelines.md`（沒有專業設計 skill 時的內建美學準則，含固定色票 `design-guidelines.md#palette`、佈局 `design-guidelines.md#layout`、卡片視覺 `design-guidelines.md#poi-visuals`、狀態標籤 `design-guidelines.md#status-visuals`、雙方案 `design-guidelines.md#dual-plan-visuals`、細節 `design-guidelines.md#details`）與 `references/porting-to-other-agents.md`（跨 Agent 適配）。

## 第一步：判斷模式

- 使用者**只給目的地+天數**（如「香港 4 天 3 晚」）→ 模式 A（從零規劃）。
- 使用者**已提供行程**（文字或舊 HTML）→ 模式 B（解析既有計劃）。

## 模式 A：從零規劃

1. **先把 brief 問清楚，再開始調研。** 行程頁面是大產出，誤解會被放大——做到第 300 項才發現顆粒度錯了，代價是全部重來。把未知分三類，區別對待：

   | 類別 | 處理 |
   |---|---|
   | 改變**有哪些工作** | 必須問，問完才動 |
   | 改變**已知工作裡的細節** | 便宜就問，否則明說假設 |
   | 自己能決定的 | 直接定，講一句，往下走 |

   **先把問題分成「該自己查的」與「該問對方的」——查得到的絕不問。** 目的地與日期一確定，「有沒有撞連假」「有沒有季節性收季」「需不需要外文對照表」你都查得到；問對方只是把自己的工作推過去，換來更慢的迭代與更差的信任。

   **該問的一次問完，不要刻意分輪。** 唯一正當的分輪理由是「查完才知道要不要問」（例如查到撞連假，才需要問要不要做雙方案）。選項式提問元件一次最多 4 題——**那是工具的 UI 上限，不是設計原則**；對方直接打字回答時就一次收完。

   完整的 11 個分岔點、可直接貼給對方的提問模板、以及「不用回答」清單，見 `references/brief-checklist.md`。真正會改變工作量的第一層只有四項：**交通方式**（決定行程能排什麼）、**清單顆粒度**（篇幅差三倍）、**天數人數組成**（決定強度與房型）、**住宿狀態**（決定要不要給選項、是否多做一份輔助頁）。

   **問的時候一併說出「哪些不用回答」。** 只列要問的，對方會以為沒列的是你漏掉的，然後花時間去查你本來就會查的東西（連假、收季日、營業時間、票價組合、天氣、簽證規則）。把那份清單一起貼出來，他才知道界線在哪——這跟列出問題一樣重要。

   問完之後，**把剩下的假設列成一張表**寫在對話裡再動手——對方沒反對的就算達成共識。

2. 讀 `references/research-guide.md`，聯網調研目的地。
3. 在對話裡用 markdown 提出詳實逐日計劃（早／中／晚、景點、交通、住宿）。
4. 與使用者來回迭代，直到明確確認。
5. 進入「調研補全 + 生成」。

## 模式 B：已有計劃

1. 解析使用者給的行程。**若是本 skill 生成的舊 HTML**：直接解析 `<script id="trip-data" type="application/json">` 的完整 `trip` JSON（資料與呈現分離，別去反解析渲染後的 DOM——必丟欄位）；舊版頁面沒有這塊時才從 DOM／文字提取，**提取時務必先反轉義**，見 `page-contract.md#unescape`。
2. **順手提建議（但別硬來）**：把使用者的計劃對照「完善行程」的維度（行前須知／天氣應對、提前訂票項、點到點交通、節奏與緩衝、當地必吃、片區住宿是否合理等）快速體檢，在**對話裡**給**最多 3–4 條**具體、可選的優化建議。原則：只挑**真實存在的缺口**；計劃本就完整就直說「挺完整」，**不要硬湊、不要說教、不要替使用者重排行程**。一句點出問題 + 一句給方向即可。這是我們區別於「純提示詞轉 HTML」的地方——發揮判斷力，但點到為止。
3. 進入「調研補全 + 生成」（生成不被建議阻塞；採納哪些由使用者定）。

## 調研補全 + 生成

1. **先判斷第三方 skill 適配**（見 `references/research-guide.md#third-party`）：若當前 Agent 可呼叫使用者**已裝**的官方旅行 skill／MCP（飛豬、高德、騰訊地圖、滴滴等），優先用它們拿對應資料。**注意：高德／騰訊回傳 GCJ-02 座標，寫入 `trip` 前必須用 `map.js` 的 `gcj02ToWgs84` 轉成 WGS-84。** 用到的來源登記進 `trip.dataSources`，行動連結寫入 `actionLink`（**只用官方回傳的，絕不手拼**）。沒有這些 skill 就全部走靜態調研，成品不缺區塊。

2. 按 `references/research-guide.md` 聯網補全：座標、真實圖片 URL、評分、營業時間／休息日、門票參考價、需提前訂項及 `leadDays`；行前須知、點到點交通、時令活動、每餐必點菜+參考價；航班給 3–5 個待選班次、酒店按片區+價位推薦、備妥免責宣告與全程貼士。排程體現天氣／季節邏輯。**本 skill 自身不查實時票價。**

3. **查證紀律：看事實之間的「模式」，不只看單條事實。** 營業時間、季節收季日、票價、封路——每一條都要搜過再寫，絕不憑記憶。更重要的是**把查到的結果橫向擺在一起看**：曾經有一趟落磯山行程，五個獨立查詢（纜車、冰川行程、湖區道路、接駁訂位、歷史村）全部回傳同一個日期——那天正好是旅客的回程日，整個行程的排法因此完全改寫。**那個模式才是這趟調研最有價值的產出，而任何單一查詢都揭露不了它。** 季節性目的地尤其要把「收季日」當成跟營業時間同等的必查項（對應 `conditional-features.md#season-status`）。查不到就如實標「請出發前確認」並附官方連結，含糊而誠實勝過肯定而錯誤。

4. **組資料**：按 `assets/page-contract.md#trip-data` 組織 `trip`。同時逐一判斷 `assets/conditional-features.md` 的三項觸發條件。

5. **生成風格化 HTML**：優先呼叫專業設計 skill（`frontend-design` 或 `huashu-design`，任一已安裝即用）；兩者都沒有時按 `references/design-guidelines.md` 自己出。無論哪種方式都要嚴格遵守 `assets/page-contract.md` 與 `assets/engine-contract.md`：
   - 內聯 `map.js`、`reminders.js`、`poi.js`（保證單檔）。**內聯完立刻照 `engine-contract.md#engine-classes` 那張表核對 CSS**——三個引擎只輸出語意 class，樣式全由頁面負責；漏了 `map.js` 的 `.route-pin` 會讓地圖示記**全部隱形**（元素數量還是對的，讀程式碼與數元素都抓不到），漏了 `reminders.js` 的 `.todo-*` 會讓頁頂清單退化成裸列表。
   - 完整 `trip` 以 `<script id="trip-data" type="application/json">` 內嵌。
   - **分塊寫檔，不要一次吐完整頁。** 多日行程頁動輒數千行，一次生成容易在中段出錯且難定位。分段追加（每段約 200–400 行：`<title>`+CSS → tab 導覽+頁頂清單 → 行前須知／交通 → 逐日時間軸 → 地圖 → highlights → 貼士／註解），**每段寫完立刻回報行數**。CSS 那段寫完馬上 grep 一次有沒有混進異常字元——一個錯字塞在 CSS 值裡會靜默廢掉整條宣告。

6. 存成 `<行程名>.html` 到工作目錄。若同時產出住宿規劃、比價這類**單一主題的補充頁**，那是「輔助頁」，適用的規則較少——見 `page-contract.md#page-types`。

7. **機械校驗（必做）**
   ```bash
   node assets/validate.js <生成的.html>     # 契約校驗：欄位、座標、必需區塊、引擎 class、url 雙重轉義
   node assets/check-refs.js                # 文件自身的十一項檢查（改過文件或新增檔案時必跑）
   node assets/check-links.js <生成的.html>  # 外部連結有效性（需要外網，約 30 秒）
   node assets/poi.test.js                  # 改過 poi.js 才需要
   node assets/map.test.js                  # 改過 map.js 才需要
   node assets/reminders.test.js            # 改過 reminders.js 才需要
   node assets/probe.js <生成的.html>        # 改過任何檢查器後必跑：餵合成陽性證明每條檢查真的會叫
   ```
   `validate.js` 分三級輸出，判讀方式不同：**ERROR 必須修掉再重跑**；**WARNING 逐條人工判斷**；**`· 註記` 不是問題**，是「這份頁面的判定前提」（例如輔助頁跳過了哪些檢查、免責宣告是動態渲染所以靜態掃描驗不到）。
   **一份完全合規的頁面應該 0 條 ERROR、0 條 WARNING。** 這是刻意設計的：只要有一條警告會在每份頁面上都出現，整個警告區就會被訓練成可以忽略——所以那類訊息一律降級成註記，不佔警告的位置。
   **另外自己斷言三件事**：①**數量**——brief 說「每區十項」就寫一行腳本數出來確認；②**引擎 class 樣式齊全**——腳本見 `engine-contract.md#engine-classes`；③**外部連結真的打得開**——`check-links.js`，並照它的判讀提示區分「真的壞」與「本環境驗不了」。這三類錯誤在幾千行的頁面裡用看的永遠看不出來。

8. **瀏覽器實測（必做，不能只靠上一步或讀程式碼）**：用 Playwright 實際開啟生成的 HTML，檢查：
   - ① 附近推薦面板預設是**收合**的（`hidden` 真的生效，見 `engine-contract.md#nearby-panel` 的踩坑記錄）
   - ② 卡片牆是「橫向捲動」而不是純直向堆疊（見 `page-contract.md#blocks` 與 `engine-contract.md#poi-wall`）
   - ③ 地圖連結、來源標籤（精選／行程途經）確實渲染出來，不是空字串
   - ④ **地圖上的編號標記真的看得見**（不是只有虛線路線）——`.route-pin` 沒樣式時標記是透明的，`.leaflet-marker-icon` 數量卻完全正常
   - ⑤ 手機寬度（390px）下沒有破版；頂部 tab 導覽是橫向捲動而非換行；點錨點跳轉後標題沒被 sticky 條蓋住
   - ⑥ **區塊順序正確**：時間序行程（含地圖）排在 highlights 總覽**之前**。這一條**靜態掃描查不到**（頁面是前端渲染，區塊由腳本插入，`validate.js` 看不出 DOM 先後），只能實際打開比對：
     ```js
     // 取各區塊在 DOM 裡的實際位置，確認行程在總覽之前
     [...document.querySelectorAll('section[id]')].map(s => s.id)
     ```
     總覽是延伸參考資料，不該搶在行程本身前面（`page-contract.md#block-order`）。
   - ⑦ **主題切換鈕**兩個方向都會切、重新載入後記得選擇（`page-contract.md#theme-toggle`）

   **怎麼量才準（這幾條量錯過，會得到假警報或假通過）**
   ```js
   // ✗ 錯：用子元素 offsetTop 數「有幾行」——align-self:center 的主題鈕本來就跟旁邊
   //   <a> 不同 top，沒換行也會數出 2 行，是必然的假警報。
   new Set([...nav.children].map(c => c.offsetTop)).size

   // ✓ 對：量容器自己
   getComputedStyle(nav).flexWrap        // 必須是 'nowrap'
   nav.getBoundingClientRect().height    // 一行約 47px；接近兩倍才是真換行
   nav.scrollWidth > nav.clientWidth     // 必須 true，否則後面的 tab 點不到
   grid.scrollWidth > grid.clientWidth   // 卡片牆同理
   ```
   **通則：量「容器的溢位與捲動能力」，不要量「子元素排成幾行」。** 子元素的 top／height 會被對齊方式、字級、標籤高度影響，拿它推斷版面必定誤判。

   **用正則去量 CSS 也一樣會騙人**，而且騙的方向是「回報缺東西」，讓人去修沒壞的地方：

   ```js
   // ✗ 錯：@media print{…} 裡面還有嵌套的規則，非貪婪比對停在第一個 } → 抓到空的
   /@media print\{(.*?)\}/s
   // ✗ 錯：選擇器常常是逗號清單，[^{};,]+? 只會抓到最後一個
   //   .day, .poi-card, .plan-head, table{break-inside:avoid} → 只看到 table
   /([^{};,]+?)\{[^{}]*break-inside/
   ```

   這兩個錯法各讓我誤報過一次「頁面缺列印規則」——實際上兩份頁面都是齊的。**量之前先餵一個已知為真的例子確認量法會回報「有」**，跟檢查器要餵合成陽性是同一件事。花括號要配對數，選擇器清單要先按逗號切開。

9. **回報時先講「調研改變了什麼」，不是先講做了哪些區塊。** 使用者要的是判斷依據：哪一條查證結果推翻了原本的排法、哪些事實查不到需要他出發前自己確認、你替他做了哪個他沒要求的取捨。功能清單排在這些後面。**查不到的就明說查不到**，不要用模糊措辭蓋過去。

10. 告訴使用者：之後可把該 HTML 丟回來，說「把第三天的 X 挪到第四天」，會在原結構上修改（直接改內嵌的 `trip-data` JSON 再重渲染）。

## 改動引擎後的傳播 {#propagation}

**三個引擎是「複製進每個頁面」的，不是外鏈。** 所以修好 `assets/poi.js` **不等於**修好既有頁面——頁面裡是舊的副本，帶著你剛修掉的 bug，而且畫面上看不出來。

改動任何引擎後：

1. 跑該引擎的回歸測試（`engine-contract.md#tests`）。
2. **對每一份既有頁面重新內聯**，然後重跑 `node assets/validate.js <頁面>`——它會比對頁面裡的引擎跟 `assets/` 的當前版本，過期會出 WARNING。
3. 重跑瀏覽器實測：引擎改動可能影響渲染（例如 `sameCore` 的比對規則變了，附近推薦面板的項目數就會變）。

**不打算更新的舊頁面請有意識地留著**，並知道它帶著哪些已知 bug——`validate.js` 的過期 WARNING 就是給這個判斷用的，不是要你無條件全部重生成。

## 不做

本 skill **自身**不做：實時票價／機票價格查詢、代訂票、多語言 UI、後端。全程靜態單檔。

> 邊界：使用者若另裝了官方旅行 skill（飛豬／高德／騰訊地圖／滴滴等），實時資料與「預訂／導航／叫車」連結**由其提供、責任在其**——本 skill 只適配呈現，不改變上面「自身不做」的範圍。
