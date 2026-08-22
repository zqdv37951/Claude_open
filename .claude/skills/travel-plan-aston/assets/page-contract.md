# 頁面內容契約（給設計步驟）

生成 HTML 時，**設計步驟**（frontend-design / huashu-design / 內建美學準則，見 SKILL.md）負責佈局與美學，但必須包含以下區塊與資料結構，並接入 `map.js` / `reminders.js` / `poi.js` 三個引擎腳本（用 `<script>` 內聯到單檔案 HTML）。三個引擎的函式簽章、輸出 class 的樣式責任、卡片牆與附近面板的渲染規則，全部見 `engine-contract.md`。**條件式功能**（`transit` 取代航班住宿、雙方案 A/B、季節狀態標籤）見 `conditional-features.md`。生成後用 `assets/validate.js` 機械校驗（見 SKILL.md）。

> **本檔是「一律適用」規則的唯一權威。** 交叉引用一律寫成 `檔名#錨點` 形式（如 `engine-contract.md#poi-wall`），不要用「第 N 節」——節號會隨內容增減而失效。改動標題時跑 `node assets/check-refs.js` 確認沒有斷連。

## 本檔目錄

本檔是「一律適用」規則的唯一權威，共 20 節。**刻意不拆檔**——拆成兩份會讓讀者為了一條規則翻兩個地方，違反「規則只住一個地方」。用下表跳轉：

| 節 | 管什麼 |
|---|---|
| [兩種頁面型別](#page-types) | 行程頁與輔助頁的差別，決定哪些規則適用 |
| [輸入資料結構](#trip-data) | `trip` 物件的**完整**形狀（新增欄位必須同步這裡） |
| [區塊順序](#block-order) | 區塊的閱讀動線與先後 |
| [必須包含的區塊](#blocks) | 必須包含的區塊清單（含條件式的每日餐飲） |
| [可選適配元素](#action-links) | 「去預訂／導航／叫車」按鈕的出現條件 |
| [`highlights` 資料結構](#highlights) | 延伸推薦的資料結構、地區分組、座標分層規則 |
| [頁頂 sticky tab 導覽](#tab-nav) | 頁頂 sticky tab 導覽 |
| [時間軸站點的連結出口](#slot-links) | 時間軸站點的連結出口與地圖連結位置 |
| [需要預訂的站點要標出來](#booking) | 需購票／訂位的站點怎麼在時間軸上呈現 |
| [建置時驗不了的東西要列出來](#unverified) | 查不到、驗不了的具體項目怎麼交給讀者 |
| [地圖編號與時間軸的對照](#map-numbering) | 地圖標記的編號怎麼對回行程站點 |
| [淺色／深色主題切換鈕](#theme-toggle) | 淺色／深色切換鈕 |
| [外文名詞註解](#glossary) | 外文名詞註解與詞條欄位 |
| [Mode B：解析既有 HTML 時先反轉義](#unescape) | Mode B 解析既有 HTML 的反轉義 |
| [同一趟行程的姊妹頁](#sibling-pages) | 多份頁面之間的互連、共用 key 與命名邊界 |
| [列印樣式](#print) | 紙上必做的四件事 |
| [trip-data 解析失敗時要看得見](#parse-guard) | 手改 JSON 打錯時頁面該怎麼反應 |
| [無障礙底線](#a11y) | 五條不能破的底線 |
| [硬性約束](#constraints) | 單檔、離線、響應式、圖片等硬性約束 |

## 兩種頁面型別 {#page-types}

本 skill 會產出兩種頁面，`assets/validate.js` 會依「有沒有內嵌 `trip-data`」自動判別，套用不同的必需區塊：

| 型別 | 判別 | 適用規則 |
|---|---|---|
| **行程頁** | 有 `<script id="trip-data">` | 本檔全部規則 + `engine-contract.md` 全部規則 |
| **輔助頁** | 沒有 `trip-data` | 只適用「不論哪種頁面都成立」的部分：[#tab-nav](#tab-nav)、響應式、單檔自包含、`design-guidelines.md#palette` 的三段式雙主題；**不需要**地圖、提醒清單、`trip` 結構 |

輔助頁是指住宿規劃、比價、裝備清單這類**單一主題的補充頁**。它們不該硬套行程頁的必需區塊——曾經發生過住宿規劃頁被校驗器報 7 條 ERROR，全部是「它本來就不該有」的東西。

輔助頁仍然要遵守 `engine-contract.md#engine-classes`：**用到哪個引擎，就要有那個引擎輸出 class 的樣式**（沒用到就不必）。

## 輸入資料結構 {#trip-data}

```js
const trip = {
  title: "香港 4 天 3 晚",
  startDate: "2026-07-15",           // ISO，用於提醒日期計算
  colorScheme: "<每趟行程不同，由設計步驟決定>",

  // 行前須知（按出發日期/季節定製）
  preTrip: {
    weather: {
      summary: "7 月平均 31°C / 26°C，午後 3–6 點常有短時強雷暴，上午與晚上多晴",
      typhoon: "7–9 月為颱風季，出發前 3 天起關注香港天文臺預警（8 號風球以上交通景點關閉）"
    },
    packing: "短袖短褲 + 輕薄防曬衣 + 防滑涼鞋 + 晴雨兩用傘；室內空調極冷，務必帶一件長袖外套",
    payment: "推薦電子八達通（Apple/華為錢包可加，內地卡可充值），另備 500–800 港幣現金給傳統茶餐廳/紅色小巴",
    apps: ["MTR Mobile（港鐵）", "香港天文臺（天氣）", "景點官方 App（如迪士尼查排隊）"],
    ticketTip: "熱門景點門票建議提前 3–7 天網上購買，避免現場排隊"
  },

  // 航班：已預訂高亮；未預訂時給 3-5 個待選班次供自行核實
  // actionLink 可選：僅當連結來自使用者已裝的官方 skill（如飛豬）時給，{label,url}；否則省略，別手拼。
  flights: {
    booked: [ { label, code, time } ],
    candidates: [ { label, code, time, note, actionLink } ]   // note 寫機型/直飛或經停/大致價位區間
  },

  // 酒店：綜合各景點位置，按"片區 + 價位"推薦
  hotelAreas: [
    {
      area: "尖沙咀",
      reason: "靠近星光大道、天星小輪，地鐵交通便利",
      // option 可選 actionLink={label,url}：僅當來自官方 skill（如飛豬酒店/高德周邊搜尋）返回的預訂/詳情連結
      options: [
        { tier: "經濟", name: "...", priceRange: "約 ¥500/晚", note: "..." },
        { tier: "中檔", name: "...", priceRange: "約 ¥1000/晚", note: "..." },
        { tier: "高階", name: "...", priceRange: "約 ¥2000/晚", note: "..." }
      ]
    }
  ],

  // 建置時驗不了的具體項目（見 [#unverified](#unverified)）。免責宣告是法律性質的、
  // 對每份頁面都成立；這一份是「這一趟具體有哪幾件事你得自己確認」。
  unverified: [ { category, item, why, how, where } ],

  disclaimer: "本頁全部資訊（天氣、航班、酒店、餐廳、景點、門票、價格、營業時間、評分、活動等）均為 AI 基於公開資料整理的參考建議，可能不準確或已過時，不保證與實時情況一致；請務必在官方渠道 / 訂票訂房 / 地圖等 App 上核實後再做決定或前往。",

  // 可選：本次若用了使用者已裝的官方旅行 skill（飛豬/高德/騰訊地圖/滴滴等）補資料，在此登記來源，頁面據此註明；沒用到就整個省略。
  // 責任邊界：這些來源的資料實時性/真實性由對方官方 skill 負責，本頁只適配呈現、不背書，措辭中性、不替任一家打廣告。
  dataSources: [
    { name: "高德地圖 skill", scope: "點到點路線規劃、座標", realtime: true },
    { name: "飛豬 flyai",     scope: "航班候選",            realtime: true }
  ],

  // 全程通用避坑貼士
  tips: [
    "戶外活動儘量排在上午 9 點前與晚上 7 點後，下午雷暴時段安排室內（商場/博物館/樂園）",
    "熱門餐廳避開 12–13 點、18–20 點高峰；非高峰幾乎不排隊",
    "如遇颱風預警（8 號風球以上），公共交通與景點會關閉，留酒店休息"
  ],

  reminders: [ { item: "迪士尼樂園門票", leadDays: 7 } ],  // 餵給 computeReminders

  // 延伸推薦總覽。**兩種形式二選一**，判斷門檻與座標規則見 [#highlights](#highlights)。
  // (a) 全域三類（單一據點或範圍小的行程）
  highlights: {
    spotsTitle: "特色景點總覽（10項）",
    spots: [ { name, note, url, lat, lng, status } ],        // status 見 conditional-features.md#season-status
    foodTitle:  "特色美食總覽（10項）",
    food:  [ { name, shop, note, url, lat, lng } ],          // food 專用：shop = 來源店家
    shopsTitle: "特色店家總覽（10項）",
    shops: [ { name, category, note, url, lat, lng } ]       // shops 專用：category = 分類標籤
  },
  // (b) 按地區分組（跨 3 個以上、彼此相距 30 分鐘車程以上的據點時改用這個）
  //     用了 regions 就不必再給頂層的扁平 spots/food/shops。
  //     ⚠️ 下面這塊是**替換**上面那個 highlights，不是並存——同一個物件不能有兩個同名 key，
  //        整段複製走會讓形式 (a) 被靜默覆蓋。二選一，只留一個。
  // highlights: {
    regionsTitle: "五大地區・各 30 選",
    regions: [
      { key: "banff", name: "班夫鎮",
        spots: [ /* 至少 10 項 */ ], food: [ /* 至少 10 項 */ ], shops: [ /* 至少 10 項 */ ] }
  //   ]
  // },

  // 外文名詞註解（視語言環境觸發，見 [#glossary](#glossary)）。用 <dl>/<dt>/<dd> 渲染在頁面最底部。
  glossary: {
    title: "英文—繁體中文對照表",
    note:  "本頁地名、店名多保留原文，以下整理全篇出現過的非中文詞彙。",
    groups: [
      { category: "交通",
        items: [ { term: "Roam Transit", zh: "洛磯山區公共巴士", note: "班夫、坎摩爾、露易絲湖之間的接駁系統" } ] }
    ]
  },

  days: [
    {
      date: "2026-07-15",
      weekday: "週二",
      theme: "港島經典 · 都市印象",        // 當日主題（可選）
      tips: ["上午先排戶外，午後轉室內避雷暴"],   // 當日小貼士（可選）
      // 單日二選一（可選）：同一天、同強度的兩個互斥選擇（迪士尼 vs 海洋公園）。
      // ⚠️ 不要跟 conditional-features.md#dual-plans 的 `routes` 搞混——
      //    `routes` 是同一天的兩種**體力強度**（輕鬆／中等），兩者可以並存。
      alternatives: [
        { label: "方案A 香港迪士尼", summary: "暑期皮克斯限定，成人約 ¥580 起，港鐵迪士尼線直達" },
        { label: "方案B 海洋公園",   summary: "水上樂園重開，聯票約 ¥800，南港島線海洋公園站直達" }
      ],
      slots: [   // 早/中/晚
        {
          period: "morning|noon|evening",
          name: "維多利亞港",
          time: "09:00–12:00",            // 可為單點或時間段
          lat: 22.293, lng: 114.169,      // 座標一律 WGS-84；高德/騰訊返回的是 GCJ-02，須先經 map.js 的 gcj02ToWgs84 轉換再寫入
          photo: "https://...縮圖URL",
          rating: 4.7,
          review: "一句話點評",
          openingHours: "全天開放",        // 可選
          closedDays: "週一休",            // 可選，無則省略
          ticketPrice: "免費 / 纜車套票約 ¥88",  // 可選，參考價（非實時）
          transport: { mode: "天星小輪", fare: "約 ¥3", duration: "約 10 分鐘", actionLink }, // 可選：如何到達本點；actionLink 可選={label,url}，僅當來自官方地圖 skill 的路線規劃/導航連結（高德/騰訊/滴滴）
          seasonal: "暑期限定燈光秀（6/12–8/31）",  // 可選：時令活動
          needsBooking: false,           // 需要提前購票／訂位嗎，見 [#booking](#booking)
          leadDays: 0,                   // needsBooking 為 true 時必填
          bookingKind: "ticket",         // 可選："ticket" | "reserve" | "permit"
          bookingUrl: "https://…/tickets", // 可選：能真的下單的頁面，不是官網首頁
          status: { label: "10/12 封路", kind: "season" }   // 可選，見 conditional-features.md#season-status
        }
      ],
      // 每日雙強度路線 + 天氣備案（條件式，見 conditional-features.md#dual-plans）
      routes: [
        { kind: "easy",                       // "easy" | "mid"
          label: "輕鬆路線",
          // stops 吃跟 slot 同一組預訂欄位（needsBooking / leadDays / bookingKind / bookingUrl）
          stops: [ { time: "09:30", name: "明尼汪卡湖", url: "...", note: "環湖車道沿途五個觀景點" } ] }
      ],
      planB: "下雪時改走弓河谷公園道與強斯頓峽谷，全程低海拔、路況安全。",   // 雨雪備案

      dining: [   // 當日餐飲（**條件式**：有給就必須渲染；把餐廳寫進 slots／routes 也可以）
        {
          meal: "午餐",
          place: "九記牛腩",
          hours: "12:30–22:30，週日休",
          dishes: [ { name: "清湯牛腩面", price: "¥68" }, { name: "咖哩牛腩面", price: "¥72" } ]
        }
      ]
    }
  ],

  // 雙方案（條件式，見 conditional-features.md#dual-plans）。
  // **用了 plans 就不需要頂層的 days** —— 每個 plan 各自帶完整的 days。
  // ⚠️ 所有 `key` 欄位（plans[].key、highlights.regions[].key）**必須符合 /^[a-z0-9-]+$/**。
  //    它們會被串進 DOM id（面板 id）與 URL 錨點（tab 導覽的 href="#rg-<key>"），
  //    帶引號、空白或中文會讓屬性破格或讓錨點對不上——而且是靜默失效。
  //    這不是靠逃逸能解決的：id 與錨點必須字面相同才對得上，所以要約束輸入。
  //    `validate.js` 會檢查。
  plans: [
    { key: "a", name: "方案 A・錯開人潮", recommended: true,
      reason: "山區平日人少、住宿便宜三到四成",
      days: [ /* 與上面 days 同結構，完整逐日 */ ] },
    { key: "b", name: "方案 B・山中過節",
      reason: "節慶氣氛強，但房價高、需極早訂",
      days: [ /* 同上 */ ] }
  ]
};
```

> **資料裡不要寫 markdown 記號。** 所有渲染器都會 `escapeHTML`，所以 `**粗體**` 會原樣印出成「`**粗體**`」。要強調就在渲染端包 `<strong>`。`validate.js` 會抓。

> **這份範例是 `trip` 的完整形狀。** 早期它只涵蓋約六成欄位，`highlights`／`plans`／`routes`／`glossary` 只散落在各章節的散文裡——結果只讀本節的人會組出殘缺的物件。新增欄位時請一併補進這裡，不要只寫在章節散文中。

## 區塊順序 {#block-order}

實測下來，讀者期待的閱讀動線是「先看行前準備與交通，再看真正的時間序行程，地圖緊接在行程後方輔助理解路線，最後才是延伸的總覽參考資料」：

```
[頁頂 sticky tab 導覽（page-contract.md#tab-nav）]
行前須知 → 交通 → 【時間軸行程（含每站 nearby 面板）】 → 路線地圖
  → 特色景點・美食・店家總覽 → 免責宣告 → 建置時驗不了的事 → 全程實用貼士 → 日文・外文名詞註解
```

tab 導覽固定吸附在最頂，不佔區塊順序的位置——它是覆蓋在所有區塊之上的導航層，項目順序跟著上面的區塊順序走。

「建置時驗不了的事」（`page-contract.md#unverified`）緊接在免責宣告之後——它是那句話的具體化，分開放會讓讀者以為兩者無關。

時間序行程表（含地圖）**必須排在** highlights 總覽之前——總覽是延伸參考資料，不是主要內容，不該搶在行程本身前面。

## 必須包含的區塊 {#blocks}

1. **頁頂**：行程標題 + 出發前待辦清單。清單用 `reminders.js` 的 `computeReminders(trip.startDate, trip.reminders)` 再 `renderChecklistHTML(...)` 生成。
2. **行前須知區塊**：展示 `preTrip` 全部——天氣與颱風提醒、穿搭、支付、必備 App、購票時機。突出"日期/季節定製"。
3. **航班區**：`flights.booked` 高亮標"已預訂"；`flights.candidates` 列表展示 3-5 個待選班次，每項標"待選 · 請自行核實預訂"並顯示 `note`。
4. **酒店區（片區 + 價位）**：遍歷 `hotelAreas`，每片區顯示 `area` + `reason`，其下按 `經濟/中檔/高階` 列出 `options`（名稱 + `priceRange` + `note`）。
5. **免責宣告**：在航班/酒店區域附近顯著展示 `trip.disclaimer` 全文。
6. **互動地圖**：`<div id="map">`，呼叫 `initTravelMap('map', points)`，`points` 為所有 slot 按行程順序彙總的 `{lat,lng,name,time}`。引入 Leaflet CSS/JS（CDN）。
7. **每日時間軸**：按天分組，顯示當日 `weekday`/`theme`；早/中/晚分段。`photo`、`rating`、`review` **是條件式的**（見下方說明），有給就必須渲染；每個 slot 卡片另展示存在的 `photo`、`rating`、`review`，並展示存在的可選欄位（`openingHours`、`closedDays`、`ticketPrice`、`transport` 的方式/票價/耗時、`seasonal`）；`needsBooking` 為 true 時插入 `reminderBadgeHTML(leadDays, { kind, url })`，徽章排在標題那一行、本身就是訂票連結（見 [#booking](#booking)）；站點帶 `status` 時用 `poi.js` 的 `statusHTML` 渲染。當日若有 `tips`、`alternatives`（二選一卡片）也要展示。
> **關於 `photo` / `rating` / `review`（條件式，判斷後再決定要不要收）**
>
> 這三個欄位原本列為必須，但實測下來要看行程性質：
>
> - **城市行程值得有**：餐廳、博物館、商場有意義的評分與照片，讀者靠它決定要不要去。
> - **荒野行程往往沒意義**：登山口與觀景台的「評分」多半是雜訊；而 62 個站點就是 62 張圖，**離線可讀與檔案大小都會付出代價**（圖片需連網，離線時全部走降級色塊）。
> - **判斷原則**：這個站點是「有人在經營、會有服務品質差異」的地方嗎？是就值得收評分與照片；是一片風景就不必。
>
> 決定不收時**不要留空欄位**，直接省略；`validate.js` 不會因為缺這三個而報錯，但**有給卻沒渲染會報錯**。

8. **每日餐飲（條件式）**：`day.dining` **有給就必須渲染**（每餐含 `place`、`hours` 與必點菜 `dishes` 的名稱 + 價格）；**沒給也可以**——把餐廳直接寫進 `slots` 或 `routes[].stops` 的做法同樣完整，資訊沒有缺，只是形式不同。

   > 這一條原本列為無條件必須，但實測下來把餐廳併進逐日站點更順（讀者是照時間軸走的，不會另外翻餐飲區塊），而輔助頁（`#page-types`）本來就不該有這個區塊。所以改為條件式：**規則在資料存在時才生效**。`validate.js` 會檢查「有 `dining` 卻沒渲染」，不會要求你一定要有。
9. **建置時驗不了的事（條件式）**：`trip.unverified` 有給就必須渲染成可勾選清單，排在免責宣告之後（見 [#unverified](#unverified)）。
10. **全程實用貼士**：展示 `trip.tips` 列表。

## 可選適配元素 {#action-links}

> 僅當資料來自使用者已裝的官方旅行 skill 時才出現，詳見 `references/research-guide.md#third-party`。

- **行動連結 `actionLink`**：航班 `candidates`、酒店 `options`、`slot.transport` 等若帶 `actionLink={label,url}`，渲染成一個明確的「去預訂 / 導航 / 叫車」按鈕或連結（新標籤開啟）。**沒有就不渲染**，絕不為此手拼連結。各處按鈕文案不同（"去預訂"/"去導航"/"叫車"），不必強求統一措辭，但渲染邏輯一致，可複用這個小函式（不屬於 `poi.js`，各場景自行內聯）：

  ```js
  function actionLinkHTML(actionLink, label) {
    if (!actionLink || !actionLink.url) return '';
    return '<a class="action-link" href="' + escapeHTML(actionLink.url) + '" target="_blank" rel="noopener">'
      + escapeHTML(label || actionLink.label || '前往') + ' →</a>';
  }
  ```
- **與引擎自帶地圖連結的邊界**：`map.js` 在地圖彈窗生成的「導航 / 地圖」點位連結**不屬於 actionLink**——它們按官方公開的免 key URI 規範（Apple Maps、`geo:`、高德 URI API `coordinate=wgs84`、Google Maps URLs）由引擎生成，只做「開啟地圖看這個點」、不承載實時資料主張。**境內只給高德、境外只給 Google（且用「名稱+視野錨點」而非純座標）**，兩條規則見 `engine-contract.md#map-links`；「絕不手拼」約束針對的是預訂/路線類 actionLink，兩者並存不衝突。
- **資料來源 `dataSources`**：若 `trip.dataSources` 非空，在相關區塊或免責宣告附近用一行小字中性註明（如「實時航班/酒店來源：飛豬 skill；路線規劃與天氣來源：高德 skill，時效性由其官方保證」）。措辭**中性、不誇、不推薦某一家**；與 AI 靜態整理的內容（標"參考·可能過時"）做視覺區分即可。
- 這些是**漸進增強**：缺這些欄位時頁面與現在完全一致，不留空塊、不報錯。

## `highlights` 資料結構 {#highlights}

任何行程都應該有這個區塊：把「值得去、但不一定排進固定時刻表」的景點/美食/店家整理成獨立的參考總覽，不受限於實際走訪順序或天數。單日行程用它承載「附近還有什麼」，多日行程（如跨國自駕）一樣用它承載「這幾個大區域各自有哪些精選景點/餐廳」——原則相同，只是分類維度可能從「距離」換成「區域」（見下方「大範圍行程改按「地區」分組」）：

```js
trip.highlights = {
  spotsTitle: "特色景點總覽（10項）",
  spots: [
    { name: "江島神社（奉安殿・辺津宮・中津宮・奧津宮）", note: "日本三大弁財天之一，島上信仰核心",
      url: "http://enoshimajinja.or.jp/", lat: 35.2985, lng: 139.4802 }
    // ...至少10項
  ],
  foodTitle: "特色美食總覽（10項）",
  food: [
    { name: "生しらす丼", shop: "魚見亭／とびっちょ", note: "春末至初冬產季限定",
      url: "https://enoshima-uomitei.com/", lat: 35.2969, lng: 139.4744 }
    // ...至少10項
  ],
  shopsTitle: "特色店家總覽（10項）",
  shops: [
    { name: "あさひ本店", category: "仲見世通り・仙貝老店", note: "丸焼きたこせんべい創始店家",
      url: "https://murasaki-imo.com/", lat: 35.3007, lng: 139.4808 }
    // ...至少10項
  ]
};
```

**必須項**：`name`、`note`。
**強烈建議項**：`lat`/`lng`（供 `engine-contract.md#nearby-panel` 的距離排序使用）、`url`（連結誠實原則見 `engine-contract.md#poi-wall`）。
**food 專用**：`shop`（來源店家）。**shops 專用**：`category`（分類標籤）。

### 大範圍行程改按「地區」分組

跨越多個城鎮／園區的行程（如卡加利＋班夫＋露易絲湖＋坎摩爾＋冰原大道），全域一份 `spots`/`food`/`shops` 會失去意義——讀者在班夫時不需要看到卡加利的餐廳。這種行程改用 `regions` 結構，**每個地區各自給滿三類**：

```js
trip.highlights = {
  regionsTitle: "五大地區・各 30 選",
  regions: [
    { key: "banff", name: "班夫鎮",
      spots: [ /* 10 項 */ ], food: [ /* 10 項 */ ], shops: [ /* 10 項 */ ] },
    { key: "louise", name: "露易絲湖與夢蓮湖", spots: [ /* 10 項 */ ], food: [ /* 10 項 */ ], shops: [ /* 10 項 */ ] }
    // ...
  ]
};
```

判斷門檻：**行程跨越 3 個以上彼此相距 30 分鐘車程以上的據點**時用 `regions`；否則維持原本的全域三類。用 `regions` 時每個地區三類各至少 10 項（總量會顯著高於全域版的 30 項，這是刻意的——地區分組本來就是為了承載更大的資訊量）。

渲染時每個地區一個小節、各自呼叫三次 `poiWallHTML`，卡片元件與標籤完全沿用，不另寫一套。

### 座標分層規則

這是很容易踩到、而且**不會報錯只會靜默消失**的一條：

- `poiWallHTML` **不看 `lat`/`lng`**——沒有座標的項目照樣完整渲染成卡片（只是少一行地圖連結）。
- `nearbyGridHTML` **第一步就 filter 掉沒有座標的項目**。所以沒座標的 highlights 進不了任何一站的附近面板，而且不會有任何警告，面板只會顯示得比預期少。

因此調研時的取捨是：**先確保「你希望出現在附近面板的項目」有座標**，其餘（紀念品、通用美食品項這類本來就不對應單一地點的東西）留在總覽牆即可，不必為了湊座標去硬填一個不精確的點位。**寧可沒有座標，也不要填錯的座標**——山區或郊區一個錯的點位會把人導到錯的路上。

判斷原則：這個項目是「一個可以站上去的地點」嗎？是就補座標，不是（如「楓糖漿」「野牛肉乾」這類品項）就不補。

> 卡片牆的渲染規則見 `engine-contract.md#poi-wall`；附近面板見 `engine-contract.md#nearby-panel`。

## 頁頂 sticky tab 導覽 {#tab-nav}

單檔行程頁很長（多日行程動輒數千行），讀者在手機上捲動找區塊非常痛苦。**所有行程頁面頂部都要有一條吸附式（sticky）分頁導覽**，列出頁面各主要區塊的錨點，點選跳轉。

```html
<nav class="nav"><div class="nav-in">
  <a href="#pretrip">行前總覽</a>
  <a href="#transport">交通方案</a>
  <a href="#itinerary">逐日行程</a>
  <a href="#map">路線地圖</a>
  <a href="#banff">班夫鎮 30 選</a>
  <a href="#tips">實用貼士</a>
  <a href="#glossary">名詞註解</a>
</div></nav>
```

```css
.nav{position:sticky; top:0; z-index:50; background:color-mix(in srgb,var(--bg) 92%,transparent);
  backdrop-filter:blur(10px); border-bottom:1px solid var(--line)}
.nav-in{max-width:960px; margin:0 auto; padding:0 20px; display:flex; gap:4px;
  overflow-x:auto; scrollbar-width:none}          /* 手機上橫向捲動，不換行 */
.nav-in::-webkit-scrollbar{display:none}
.nav a{flex:0 0 auto; padding:11px 12px; font-size:13.5px; color:var(--ink-soft);
  text-decoration:none; white-space:nowrap; border-bottom:2px solid transparent}
.nav a:hover{color:var(--accent); border-bottom-color:var(--accent)}
section{scroll-margin-top:56px}                    /* 錨點跳轉時不被 sticky 條蓋住 */
```

要點:

- **手機上一定要能橫向捲動**（`overflow-x:auto` + `white-space:nowrap` + `flex:0 0 auto`），不要讓 tab 換行成兩三列擠掉版面。
- **每個 `<section>` 必須加 `scroll-margin-top`**，否則點錨點跳過去，標題會被 sticky 導覽條蓋住——這是最常見的漏做。
- 導覽項目跟著 `trip` 實際有的區塊產生（用 `regions` 的行程就每個地區一個 tab），不要寫死一份固定清單。
- 隱藏捲軸但保留捲動能力；不要為了美觀改成 `overflow:hidden`，那會讓後面的 tab 永遠點不到。

## 時間軸站點的連結出口 {#slot-links}

`slot` 可帶 `url` 欄位（連結誠實原則見 `engine-contract.md#poi-wall`），有值時站點標題（`<h4>`）整個包成 `<a target="_blank" rel="noopener">`，方便讀者直接點進官方頁面查詳情，不用另外去 highlights 總覽找對應項目。

**每一站都要有可點的出口，不是只有帶 `url` 的才有**：`slot` 只要有 `lat`/`lng`（時間軸站點的必填欄位，見 `page-contract.md#trip-data`），就在標題下方比照本節「標題連結＋地圖連結」的規則，另外加一行呼叫 `buildMapAppLinks(lat, lng, name)` 產生的地圖連結。沒有官網 `url` 的站點標題本身維持純文字（不手拼假連結），但地圖連結這一行等於保底出口，讓每一站不論有沒有官網都至少能點開地圖確認位置。

### 地圖連結排在標題與時段標籤之間（同一行）

站點的地圖連結**不要另起一行**，要排在「標題」與「上午／午後／傍晚」時段標籤之間，三者同一行：

```
夢蓮湖・岩堆觀景步道   Google 地圖   [上午]
```

實作：`<h4>` 用 `display:flex; align-items:center; gap:8px; flex-wrap:wrap`，地圖連結用 `<span class="poi-maplink poi-maplink--inline">` 而非 `<p class="poi-maplink">`（保留基底 class 讓 `validate.js` 的抽查仍命中）：

```css
.tl h4{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.poi-maplink--inline{margin:0!important;font-size:11px!important;display:inline-flex;align-items:center}
.poi-maplink--inline a{margin-right:0}
```

理由：獨立一行會讓每一站多佔一行高度，多日行程累積下來時間軸變得很鬆散，讀者要滑更久才看完一天。**卡片牆裡的 `.poi-maplink` 維持獨立一行不變**——那裡的卡片本來就是縱向堆疊，沒有這個問題。

## 需要預訂的站點要在時間軸上標出來 {#booking}

行前待辦清單（`trip.reminders`）回答的是「出發前要辦什麼」。但讀者是**照時間軸走的**——他在第五天讀到「班夫纜車」的那一刻，才會想到票的事。如果那一刻頁面不說話，他得回頭翻頁頂清單、再自己去搜官網；中間任何一步斷掉，這條提醒就等於沒有。

**規則：時間軸站點（`day.slots`）與路線停靠點（`day.routes[].stops`）只要需要提前購票或訂位，就在標題旁邊掛一個徽章，而且徽章本身就是訂票連結。**

兩者共用同一組欄位：

| 欄位 | 值 | 說明 |
|---|---|---|
| `needsBooking` | `true` | 觸發徽章。沒有它，後面三個欄位都不會渲染 |
| `leadDays` | 數字 | 建議提前幾天。`validate.js` 要求 `needsBooking` 必有 `leadDays` |
| `bookingKind` | `ticket` ／ `reserve` ／ `permit` | 需購票／需訂位／需通行證。三者以外的值引擎會降級成無 kind 的舊樣式 |
| `bookingUrl` | 網址 | **能真的下單的頁面**，不是官網首頁 |

渲染一律呼叫 `reminders.js` 的 `reminderBadgeHTML(leadDays, { kind, url })`（見 `engine-contract.md#api`），不要自己拼——三種 kind 的用字、class、轉義、以及「沒有 url 就不要做成連結」都在引擎裡。

位置比照 `page-contract.md#slot-links`：**跟標題、地圖連結同一行**，排在地圖連結之後、時段標籤之前。

```
班夫纜車・硫磺山   Google 地圖   需購票 · 建議提前 5 天 ↗   [上午]
```

### 四條紀律

- **`bookingUrl` 查不到就留空。** 只給 `needsBooking` + `leadDays`，徽章會退化成不可點的標籤，提醒作用還在。**填一個看起來合理的官網首頁比空著更糟**——讀者點進去找不到購票入口只會更困惑，而且他會以為你查證過了。`validate.js` 會抓「`bookingUrl` 指向網域首頁」。
- **淡季不要濫標。** 每一個徽章都在要求讀者現在去做一件事。整頁都是「需購票」時，真正會售完的那兩三項就被稀釋掉了。判準是「不先訂的話這一站可能去不成、或要排很久」，不是「這裡要錢」。十月的洛磯山跟七月是兩回事。
- **同一個要求涵蓋多站時，徽章會重複出現——那是對的，但必須完全一致。** 夢蓮湖接駁一張預約涵蓋「轉乘停車場、岩堆觀景步道、湖畔平路、落葉松谷」四站，四個徽章的 `leadDays` 與 `bookingUrl` 必須一模一樣，否則讀者會以為要訂四次（曾經一站寫 30 天、另一站寫 2 天）。**並且只標真的被涵蓋的站**：光是停在露易絲湖轉乘停車場、不轉夢蓮湖的話不需要預約，那一站就不該有徽章。
- **要跟 `trip.reminders` 對得上。** 同一件事出現在兩個地方（頁頂清單、時間軸徽章），兩邊必須說一樣的話。只在其中一邊出現，讀者就會以為另一邊漏了。

## 建置時驗不了的東西要具體列出來 {#unverified}

免責宣告是**法律性質**的：它說「全部資訊都可能不準」。那句話對每一份頁面都成立，所以它不帶任何資訊——讀者看完不知道該去查什麼。

**規則：凡是建置時查不到、或在建置環境驗不了的具體項目，都要列進 `trip.unverified`，並渲染成可勾選的清單。**

```js
trip.unverified = [
  { category: 'A. 訂票連結（在別的網路開一次就知道）',   // 分組，同組的排在一起
    item:  'OpenTable 的三個訂位連結真的能訂到位嗎',      // 一句話講清楚要確認什麼
    why:   '整個 opentable.com 網域在建置環境不可達，連首頁都回 403',  // 為什麼我驗不了
    how:   '直接點那三站的徽章…訂不到就改打電話 (403) 452-3115',        // 怎麼確認、失敗怎麼辦
    where: ['Ten Foot Henry', 'Charbar', 'Pigeonhole'] }              // 影響哪些站點（可選）
];
```

四個欄位缺一不可（`where` 除外）：**只寫「這個沒驗證」等於把問題丟回去**。`why` 讓讀者判斷這條有多可能是真的壞掉；`how` 讓他不用重新研究一遍該怎麼查。

### 什麼該列進來

| 該列 | 不該列 |
|---|---|
| 在建置環境打不開的連結（防爬、地區限制、整域不可達） | 已經確認壞掉的連結——那要**直接修**，不是列出來 |
| 尚未公布的資訊（下一季的賽程、還沒公告的營運日） | 「所有價格都可能變動」這類對每一項都成立的話——那是免責宣告的工作 |
| 只能電話或現場確認的事（非住客能不能訂位、假日營業時間） | 你其實查得到、只是沒查的東西 |
| **行程本身的可行性問題**（把週一休的餐廳排在週一），且你刻意不替使用者改 | 已經替使用者改掉的問題 |

### 兩條紀律

- **這一區的長度是誠實度的指標，不是失敗的指標。** 空的 `unverified` 通常不代表查得徹底，而代表沒有記錄查不到的東西。但也不要為了充數把「查得到只是懶得查」的項目丟進來——那是把自己的工作推給讀者，跟 `references/brief-checklist.md` 說的「查得到的絕不問」是同一條原則。
- **列進來的每一條都要能勾掉。** 渲染成 checkbox，讓讀者能一次做完；`how` 要寫到他照著做就能結案，包含「查完發現真的壞了要怎麼辦」。

## 地圖編號與時間軸的對照 {#map-numbering}

`initTravelMap` 會在地圖標記上印編號（1、2、3…）。**時間軸的站點必須印出同一組編號**，否則讀者在地圖上看到第 7 個點，沒有任何辦法找回那是哪一站——編號變成純裝飾。

三條實作規則：

- **順序必須跟地圖完全一致。** 地圖畫的是 `points` 陣列的順序（推薦方案的日→站）。所以 `mainPlan` 要在時間軸渲染**之前**就決定，並用同一個走訪順序發號：

  ```js
  var mainPlan = plans.filter(function (p) { return p.recommended; })[0] || plans[0];
  var mapNo = 0;                                   // 只對 mainPlan 的站點遞增
  // …渲染每個 slot 時：
  var num = (pl === mainPlan) ? (++mapNo) : null;  // 其他方案沒有編號
  ```

- **只有推薦方案有編號。** 地圖只畫推薦方案（兩套疊在一起看不懂），所以另一方案的站點沒有對應標記。**在那個方案的標頭明說一句**「此方案的站點沒有編號——地圖畫的是推薦方案」，不然讀者會以為漏了。

- **徽章外觀要跟 `.route-pin` 一致**（同色實心圓 + 半透明光暈 + 等寬數字），讀者才會意識到這兩個數字是同一套。改其中一邊的顏色時另一邊要一起改。列印時去掉光暈但**編號要留著**——那正是紙上唯一的對照手段。

地圖的說明文字也要點出這件事，例如「標記上的編號與上方逐日行程一一對應」。

## 淺色／深色主題切換鈕 {#theme-toggle}

`design-guidelines.md#palette` 的色票已經定義了 `:root[data-theme="dark"]` 讓顯式切換優先於系統設定，但**光有 CSS 沒有 UI，讀者無法自己選**。所以頁面要在導覽列右端放一個切換鈕：

```html
<button class="theme-btn" id="theme-btn" type="button" aria-label="切換淺色／深色主題"></button>
```

```js
(function () {
  var root = document.documentElement, btn = document.getElementById('theme-btn');
  function sysDark() { return matchMedia('(prefers-color-scheme: dark)').matches; }
  function cur() { return root.getAttribute('data-theme') || (sysDark() ? 'dark' : 'light'); }
  function paint() { btn.textContent = cur() === 'dark' ? '☀ 淺色' : '☾ 深色'; }
  try { var s = localStorage.getItem('travel-plan-theme'); if (s) root.setAttribute('data-theme', s); } catch (e) {}
  paint();
  btn.addEventListener('click', function () {
    var n = cur() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', n);
    try { localStorage.setItem('travel-plan-theme', n); } catch (e) {}
    paint();
  });
})();
```

三個要點：

- **鈕面文字顯示「要切到哪一邊」**（目前深色就顯示「☀ 淺色」），不是顯示目前狀態——後者會讓人猜不到按下去會發生什麼。
- **用 `localStorage` 記住選擇**，並用 `try/catch` 包起來（隱私模式下 `localStorage` 會拋錯，不能讓整頁的腳本掛掉）。
- **`cur()` 要能處理「系統設定」這第三種狀態**：根元素沒有 `data-theme` 時，得回頭問 `prefers-color-scheme`，否則第一次點擊會切錯方向。

`theme-btn` 用 `margin-left:auto; align-self:center` 靠右。**注意：它的 `align-self:center` 會讓它跟旁邊的 `<a>` 有不同的 `offsetTop`**，所以不要用子元素的 top 值去判斷導覽有沒有換行（見 `SKILL.md` 的瀏覽器實測那一步）。

## 外文名詞註解 {#glossary}

觸發條件是「目的地語言環境」，跟行程是單日或多日、國內或跨國無關：只要頁面上出現大量非中文專有名詞（日文地名/店名、英文地名/機構名、法文/原住民語地名等皆算），就該有這個區塊。日本行程有大量片假名/漢字借詞要註解；北美行程雖多是英文，一樣有 Discovery Pass、Icefields Parkway、Roam Transit 這類外文專有詞彙值得註解。於頁面**最底部**（`全程實用貼士` 之後、`footer` 之前）加入詞彙註解區塊，用繁體中文簡短說明字面意義或背景：

```js
trip.glossary = {
  title: "日文・外文名詞註解",
  note: "本頁地名、店名多保留日文原文，以下整理全篇出現過的非中文詞彙的中文說明。",
  groups: [
    {
      category: "交通",
      items: [
        { term: "江ノ島電鉄／江ノ電", note: "江之島電鐵，連結藤澤與鎌倉之間的路面電車系統" }
        // ...
      ]
    }
    // 依內容性質分組，如「景點」「美食・店家」
  ]
};
```

用 `<dl>`／`<dt>`／`<dd>` 呈現詞條，不要跟正文的 `highlights` 卡片樣式混用，這是查閱型內容，排版應偏字典而非卡片網格。

### 詞條欄位

```js
{ term: "Roam Transit",        // 外文原詞（渲染在 <dt>）
  zh:   "洛磯山區公共巴士",      // 中文對應（獨立一欄，不要跟 note 混在一起）
  note: "班夫、坎摩爾、露易絲湖之間的接駁系統" }   // 說明（渲染在 <dd>）
```

`zh` 與 `note` 要分成兩欄，不要塞成一段 —— 讀者查表時通常只要看 `zh`，`note` 是需要時才讀的補充。桌機用三欄 grid（原詞／中文／說明），手機堆疊成單欄。

## Mode B：解析既有 HTML 時先反轉義 {#unescape}

從既有 HTML 抽出來的文字會帶著 `&amp;`、`&lt;`、`&#39;` 這些實體。這些字串進了 `trip` 之後，`poi.js`／`map.js`／`reminders.js` 的 `escapeHTML` 會**再轉義一次**，頁面上就會看到 `Chinatown &amp; Cultural Centre`、`Relais &amp; Châteaux` 這種雙重轉義的結果。

**規則**：解析既有 HTML 後，`trip` 裡**除了 `url` 以外**的所有字串欄位一律先 `html.unescape()` 一次再存進資料結構。`url` 欄位保持原樣（瀏覽器自己會處理 `&amp;`），不要對它反轉義，否則 query string 會壞掉。

```python
def unescape_except_url(o, path=''):
    if isinstance(o, dict):  return {k: unescape_except_url(v, path+'.'+k) for k, v in o.items()}
    if isinstance(o, list):  return [unescape_except_url(v, path) for v in o]
    if isinstance(o, str) and not path.endswith('.url'): return html.unescape(o)
    return o
```

生成後掃一次成品確認：`document.body.innerText` 裡不該出現任何 `&amp;` 或 `&lt;`。

## 同一趟行程的姊妹頁 {#sibling-pages}

一趟行程可能產出多份頁面（逐日行程 + 住宿規劃 + 比價…見 [#page-types](#page-types)）。它們是一組，不是各自獨立的檔案：

- **必須互相連結。** 把姊妹頁放進 tab 導覽最後一項，標題加 `↗`（如「住宿規劃 ↗」）。讀者沒有別的路可以走——他不會知道另一份檔案存在，更不會去猜檔名。
- **`localStorage` 的 key 必須共用。** 主題偏好用 **`travel-plan-theme`** 這個固定 key，不要各頁自己取名。否則在一頁切成深色、到姊妹頁又跳回系統設定，讀者會以為壞了。這條踩過一次：`trip-theme` 與 `lodging-theme` 各自為政。
- **色票與共用 class 必須一致。** 都套用 `references/design-guidelines.md#palette`。頁面獨有的內容可以有自己的 class（住宿頁的旅館卡片用 `.hotel`、四套組合用 `.combo`），但**不要取跟契約既有 class 相近的名字**——`.plan-h` 與契約的 `.plan-head` 只差兩個字卻是不同東西，這種命名踩過一次。

## 列印樣式 {#print}

**旅遊行程會被印出來帶著走**，所以 `@media print` 不是可選的加分項。四條必做：

| 要處理的 | 為什麼 |
|---|---|
| **`.poi-grid` 改成換行網格** | 這是最關鍵的一條。橫捲軌道在紙上捲不動，維持 `grid-auto-flow:column` 的話**每軌只印出可視的前兩欄** —— 150 項總覽在紙上只剩約 30 項。列印時要 `grid-auto-flow:row` + `grid-template-columns:repeat(auto-fill, minmax(200px, 1fr))` + `overflow:visible`。**用 `auto-fill` 而不是固定 `repeat(2,1fr)`** —— 固定兩欄在窄紙張（或從手機列印）時卡片會撐出去，又變回捲不到的狀態；`auto-fill` 會自己依可用寬度決定欄數，不論紙張多寬都不溢出，並把 `.poi-scroll-hint` 隱藏（紙上滑不動，提示是誤導） |
| **隱藏 `.nav`、`.theme-btn`、`#map-sec`** | sticky 導覽會在每頁重複或蓋住內容；主題鈕在紙上沒意義；地圖圖磚不會列印，留白框只是浪費一頁 |
| **`break-inside: avoid`** | `.day`、`.hotel`、`.poi-card`、`table`、`.plan-head` 不要被切成兩頁；`h2`/`h3` 加 `break-after: avoid`，標題不要落在頁尾 |
| **連結印出網址** | `a[href^="http"]::after { content: " (" attr(href) ")" }` —— 紙上點不了連結，網址必須看得到 |

底色改白、陰影去掉。**收合的面板維持收合**（那是延伸資訊，不是主要內容），已展開的會照樣印出來。

`validate.js` 會檢查頁面有沒有 `@media print`。

## trip-data 解析失敗時要看得見 {#parse-guard}

本 skill **明確邀請使用者把 HTML 丟回來手改 `trip-data`**（「把第三天的 X 挪到第四天」）。所以那塊 JSON 一定會被人手動編輯，而**一個逗號打錯就會讓整頁變空白** —— 渲染腳本是一個大 IIFE，`JSON.parse` 拋錯就什麼都不會渲染，畫面上只剩靜態骨架，而且**對讀者沒有任何線索**。

所以 `JSON.parse` 必須有保護，並且失敗時要**在畫面上說出來**：

```js
var trip;
try {
  trip = JSON.parse(document.getElementById('trip-data').textContent);
} catch (e) {
  document.body.insertAdjacentHTML('afterbegin',
    '<div style="margin:20px;padding:16px 20px;border-left:3px solid #a3701f;background:#f5ead2;' +
    'color:#1b2422;font:15px/1.7 sans-serif">⚠️ 行程資料（<code>trip-data</code>）格式有誤，頁面無法渲染。<br>' +
    '錯誤：' + String(e.message) + '<br>請檢查 <code>&lt;script id="trip-data"&gt;</code> 裡的 JSON——' +
    '最常見的是多一個逗號或少一個引號。</div>');
  return;   // 或 throw，但務必先把訊息放進畫面
}
```

**錯誤訊息要帶上 `e.message`**：`JSON.parse` 的錯誤會指出位置（如 "position 20"），那是唯一能讓人快速找到打錯的地方的線索。只寫「資料有誤」等於沒說。

`validate.js` 會抽查這個保護。

## 無障礙底線 {#a11y}

不追求完整 WCAG 合規，但下面五條是**不能破的底線**——它們都是「不做就有人根本用不了」的層級，而且成本極低：

| 要求 | 為什麼 | 怎麼查 |
|---|---|---|
| `<html lang="zh-Hant">` | 沒有它，螢幕閱讀器會用錯誤的語音引擎念中文 | 一眼可見 |
| **可橫捲容器必須 `tabindex="0"`** | `overflow-x:auto` 的 div 預設不可聚焦，**只用鍵盤的人到不了可視範圍外的卡片**——而卡片牆一軌有 10–47 張。這是 WCAG 2.1.1 的實質障礙，不是細節。`poi.js` 的 `gridOpenTag` 會在項目數超過版面列數時自動加上（含 `role="group"` 與 `aria-label`） | `validate.js` 抽查 |
| **標題層級不跳號** | h2 直接跳 h4 會讓螢幕閱讀器的「依標題導覽」失去層次。視覺上想要小一點就用 CSS 調字級，不要改標籤等級 | 見下方腳本 |
| 互動元件用真 `<button>` | `<div onclick>` 不能用鍵盤觸發、不會被輔助技術當成按鈕 | `validate.js` 可抽查 `[onclick]` |
| `aria-expanded` 與實際狀態同步 | 收合面板的按鈕若不同步，螢幕閱讀器會報錯誤狀態 | 瀏覽器實測 |

標題層級的檢查腳本（瀏覽器 Console 直接跑）：

```js
(() => { let last = 0, bad = [];
  [...document.querySelectorAll('h1,h2,h3,h4')].forEach(h => {
    const l = +h.tagName[1];
    if (last && l > last + 1) bad.push(`h${last} → h${l}：${h.textContent.trim().slice(0, 26)}`);
    last = l; });
  return bad.length ? bad : '沒有跳號'; })();
```

**視覺大小與標題等級是兩件事。** 想要一個小標題就用 `font-size` 調，改成 `<h4>` 只會弄壞導覽層次——這次兩個頁面各犯過一次（hero 裡的 h3、旅館卡片的 h4）。

## 硬性約束 {#constraints}

- 單個 `.html` 檔案，手機優先。**離線能力如實分層**：文字行程（時間軸/清單/須知/貼士）離線可讀；地圖瓦片與圖片需聯網，離線時須優雅降級（見下面圖片降級約束），不許出現破圖圖示或報錯彈窗。對使用者的表述用「離線可讀」，不誇大成"完全離線可用"。
- **資料與呈現分離（迭代修改的基礎）**：完整 `trip` 物件必須以 `<script id="trip-data" type="application/json">…</script>` 原樣內嵌進頁面（包括 `actionLink`、`dataSources`、`leadDays` 等不直接可見的欄位）。後續使用者把 HTML 丟回來改行程時，**直接解析這塊 JSON 修改後重渲染**，不要反向解析渲染後的 DOM（必丟欄位）。
- **地圖的離線降級**：Leaflet 與圖磚都需要連網，離線時**不可以留下一個空白的固定高度容器**，也不可以讓說明文字繼續宣稱「地圖顯示 N 個站點」——那是假話。正確做法：

  ```js
  if (typeof L === 'undefined') {
    // 連 Leaflet 都沒載到：收掉容器，把說明換成誠實的文字
    document.getElementById('map').style.display = 'none';
    document.getElementById('map-note').textContent =
      '地圖需要連網才能顯示。目前離線，站點資訊請看上方逐日行程（每一站都有可點的地圖連結）。';
  } else {
    initTravelMap('map', pts);
  }
  ```

  **呼叫 `initTravelMap` 前必須先檢查 `typeof L`**——不檢查就直接呼叫會拋 `ReferenceError`，而渲染腳本通常是一個大 IIFE，**地圖之後的所有區塊（highlights、貼士、名詞註解）會全部不渲染**。這是「離線可讀」這個承諾最容易破功的地方。`validate.js` 會抽查這個守衛。

- **座標一律 WGS-84**：OSM 瓦片是 WGS-84；來自高德/騰訊（GCJ-02）的座標必須先用 `map.js` 的 `gcj02ToWgs84` 轉換，否則境內點位會偏移一百到幾百米。
- **響應式（手機和桌面都要好看，不能只做窄列）**：手機端單列；桌面端（約 ≥768px）主容器加寬到 **約 880–960px 居中**，卡片列表（航班 / 酒店 / 行前須知 / 餐飲 / 景點）改用**多列網格**、地圖區更寬，別在大屏上留成一條窄列兩邊大片空白。必須包含相應的 `@media` 斷點。
- `map.js`、`reminders.js`、`poi.js` 三個引擎腳本的內容必須內聯進 HTML（不外鏈本地檔案），保證單檔案自包含。
- 每趟行程用不同配色以便區分。
- 圖片**嚴禁變形**：圖片容器固定尺寸/比例，`<img>` 用 `object-fit: cover` + `display:block`（推薦絕對定位 `inset:0` 填滿容器），只裁切不拉伸。
- 圖片**統一降級**：每個 `<img>` 加 `onerror="this.style.display='none'"`，容器自帶與主題配色一致的中性底（純色/漸變均可，可疊景點名文字）——載入失敗或離線時呈現為體面的色塊，絕不露瀏覽器破圖圖示。
- 地圖瓦片源可按需替換：`initTravelMap(id, points, { tileUrl, attribution })` 支援傳入替代瓦片源（預設 OSM；若目標讀者所在網路訪問 OSM 不穩，可換映象源，註明 attribution）。
- 所有聯網資訊（**含天氣、餐廳、景點、評分**，不止航班/酒店）儘量基於公開資料給真實可信資訊，但全部為**參考**、可能不準或過時，**必須**展示覆蓋全部資訊的免責宣告（見 `page-contract.md#blocks` 的「免責宣告」）引導使用者核實。
- 排程應體現**天氣/季節邏輯**：把戶外項目放在涼爽時段（上午、傍晚），午後高溫/雷暴時段安排室內（僅在該目的地確有此類天氣特徵時）。
- `escapeHTML` 函式在 `map.js`、`reminders.js`、`poi.js` 三個檔案中各自定義一份，屬故意重複——三個檔案須各自獨立（Node require 與瀏覽器內聯均不依賴另一方；`poi.js` 需要 `map.js` 的 `buildMapAppLinks` 時也是由呼叫方把函式當引數傳入，不是互相 require），維護時請勿合併去重。
