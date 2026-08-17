# 通用擴充規格（trip-extras）

本文件補充 `page-contract.md` 未涵蓋、但實測中反覆用到的擴充模式。**除第 1 節明確限定適用情境外，第 2–7 節對所有行程一律適用**——不分單日或多日、國內或跨國、有無航班住宿。第一版曾把整份文件限定在「單日／國內短程行程」，導致生成多日跨國行程（如「卡爾加里 × 洛磯山脈」12天行程）時被誤判為不適用而整批跳過，這是範圍界定錯誤，現已修正：**只有第 1 節（`transit` 取代 `flights`/`hotelAreas`）才是條件式的，第 2–7 節永遠要做，不用先判斷行程類型。**

沿用 `page-contract.md` 的原則：**資料與呈現分離**，以下所有新增區塊都應以 `trip` 物件的欄位承載，由渲染腳本讀取後動態產生 DOM，不手刻靜態內容。

## 1.（條件式）不涉及航班/住宿時，用 `transit` 取代 `flights` / `hotelAreas`

當行程不涉及搭機、不需過夜時（僅限這種情況才套用本節，其餘情況照常用 `flights`/`hotelAreas`）：

```js
trip.transit = {
  outbound: [
    { time: "09:00", leg: "東京駅 —— JR 東海道線（國府津・小田原・熱海方向）", duration: "約55分" },
    { time: "09:55", leg: "藤沢駅 轉乘 江ノ島電鉄（江ノ電，鎌倉方向）", duration: "約10分" }
  ],
  return: [ /* 同構 */ ],
  note: "單程約1小時20分，IC卡參考票價約¥990。實際票價與發車時刻請出發前以乘換案內App確認。"
};
```

- 對應區塊改標題為「交通」，去程／回程各自用時間軸清單呈現。
- `validate.js` 對缺少 `flights`/`hotelAreas` 只會給 WARNING，不是 ERROR；省略時應在頁面上加一行說明（如 `.adapt-note`），註明「本次為當日往返行程，故以交通區塊取代」，讓讀者理解這是有意的調整而非遺漏。

## 2.（一律適用）`highlights`：特色景點／美食／店家總覽（各至少10項）

任何行程都應該有這個區塊：把「值得去、但不一定排進固定時刻表」的景點/美食/店家整理成獨立的參考總覽，不受限於實際走訪順序或天數。單日行程用它承載「附近還有什麼」，多日行程（如跨國自駕）一樣用它承載「這幾個大區域各自有哪些精選景點/餐廳」——原則相同，只是分類維度可能從「距離」換成「區域」（見第 3 節）：

```js
trip.highlights = {
  spotsTitle: "特色景點總覽（10項）",
  spots: [
    { name: "江島神社（奉安殿・辺津宮・中津宮・奥津宮）", note: "日本三大弁財天之一，島上信仰核心",
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
**強烈建議項**：`lat`/`lng`（供第 3 節的「附近推薦」排序使用）、`url`（見下方連結規範）。
**food 專用**：`shop`（來源店家）。**shops 專用**：`category`（分類標籤）。

### 連結規範（沿用 research-guide 的誠實原則，延伸到一般介紹連結）

- `url` 只能是調研時搜尋工具**實際回傳過的網址**，禁止手拼或憑印象猜測網域。
- 找不到可信官方或介紹頁面時，`url` 留空字串或省略該欄位，前端應優雅降級為純文字（不渲染連結），**絕不放可能失效的猜測連結**。
- 渲染時的連結需带外部跳轉標記（如 `↗`）與 `target="_blank" rel="noopener"`。

### 卡片渲染規則（版面、分組、地圖連結）

**這一節的邏輯已經抽成共用引擎 `assets/poi.js`**（跟 `map.js`/`reminders.js` 同一套模式：純函數、瀏覽器與 Node 雙用），生成頁面時把它整份內聯進 `<script>`（見 SKILL.md 步驟 4），呼叫 `poiWallHTML(items, sourceClass, sourceLabel, buildMapAppLinks)` 產生延伸推薦卡片牆——**不要每次重新手刻一遍**，這是本節多次因為各頁面各寫一套、規則改了舊頁面沒跟著改而補救的教訓。`poi.js` 刻意不 `require` `map.js`，`buildMapAppLinks` 由呼叫方（頁面自己的渲染腳本）當參數傳入，兩個引擎檔保持互相獨立。

- **版面**：`spots`／`food`／`shops` 三個清單都用「3 列 × 橫向捲動」排版（`poiWallHTML` 固定輸出 `<div class="poi-grid">`），不要用直向多列網格。對應 CSS（`poi.js` 只產生 HTML、不含 CSS，這段仍要手動寫進頁面的 `<style>`）：

  ```css
  .poi-grid {
    display: grid;
    grid-template-rows: repeat(3, auto);
    grid-auto-flow: column;
    grid-auto-columns: minmax(220px, 1fr);
    gap: 10px 16px;
    overflow-x: auto;
    padding-bottom: 8px; /* 留白避免捲動軸貼齊卡片內容 */
    scroll-snap-type: x proximity;
  }
  .poi-card { scroll-snap-align: start; }
  .poi-scroll-hint { margin: 0 0 0.4rem; font-size: 0.72rem; color: var(--ink-faint); font-family: var(--font-mono); }
  ```

  超過 3 項會自動往右新增一欄、容器橫向捲動；`poiWallHTML`/`nearbyGridHTML` 這時會自動在卡片牆前面加一行 `<p class="poi-scroll-hint">◂ 左右滑動查看更多 ▸</p>` 提示（項目 ≤3、不需要捲動時不會出現這行）——橫向捲動在桌面版不容易被發現，這行提示必須留著，不要手動刪掉。手機與桌面共用同一套 CSS，不用另外寫 `@media` 改成直向單欄。**這套 `.poi-grid` 版面也是第 3 節「附近推薦」面板卡片牆的標準版面**——同一份 CSS、同一個卡片元件（`poi.js` 的 `nearbyGridHTML` 內部就是呼叫 `poiCardHTML`），兩處視覺要一致，不要各寫一套。

- **分組標記**：延伸推薦不只是 `trip.highlights` 原始內容，還要併入第 3 節「附近推薦」面板在計算時、曾經出現在任一站附近清單裡的其他行程站點（`day.slots`）。兩個來源分開列、各自標記清楚：
  1. **精選 highlights**——`trip.highlights.spots`／`food`／`shops` 原始三個分類，維持不變，呼叫 `poiWallHTML(hl.spots, 'highlight', '精選', buildMapAppLinks)`。
  2. **行程途經**——生成每站「附近推薦」面板時，把候選池裡命中、但來源是 `day.slots`（不是 `trip.highlights`）的項目另外收進一個全域集合（見第 3 節「候選池命中記錄」，即 `nearbyGridHTML` 的 `opts.hitStore` 參數）；生成延伸推薦區塊時，把這個集合裡「不在 highlights 內」的項目（用 `poi.js` 的 `sameCore()` 判斷）去重後，呼叫 `poiWallHTML(transitItems, 'transit', '行程途經', buildMapAppLinks)` 列成新的一組，跟精選區分開，避免同一地點兩邊都出現。
  3. `day.slots` 項目未必有 `photo`/`rating`，只顯示 `name` + 一句話（可用該站 `review` 或留空）即可，不用為了湊欄位硬編內容。
  4. **第 3 節「附近推薦」面板本身的卡片也要套用同一套標籤**：面板裡來自 `trip.highlights` 的子清單（如「附近必去景點」「附近必吃餐廳」）呼叫 `nearbyGridHTML(..., { sourceClass: 'highlight', sourceLabel: '精選' })`，來自 `day.slots` 候選池的子清單（「附近行程其他站點」）呼叫 `nearbyGridHTML(..., { sourceClass: 'transit', sourceLabel: '行程途經', hitStore })`——延伸推薦區塊跟附近推薦面板用的是同一個 `poi.js`，不要在兩處各寫一套判斷。
  5. 標籤固定用 `poiCardHTML` 內建輸出的 `.source-tag` 這個 class（精選是 `.highlight` 修飾 class、行程途經是 `.transit`），不要每次改名——`assets/validate.js` 會機械抽查 HTML 裡有沒有 `source-tag` 字串，class 名稱對不上會被誤判成漏做。

- **標題連結＋地圖連結**：卡片標題沿用上面的連結規範——有 `url` 就整個標題包成 `<a>`，沒有就維持純文字（`poiCardHTML` 內建的 `linkOrText` 已經處理）。**額外規則**：只要卡片有 `lat`/`lng`（不論標題有沒有官網連結），都在卡片下方另外加一行地圖連結，呼叫頁面已內聯的 `map.js` 的 `buildMapAppLinks(lat, lng, name)`（跟時間軸地圖彈窗用的是同一個函式：境內只給高德，境外給 Google＋高德）——`poiCardHTML` 會自動處理這步，只要把 `buildMapAppLinks` 當最後一個參數傳進去即可，不用另外手拼。沒有座標就不渲染這一行。這一行固定用 `.poi-maplink` 這個 class 包住，理由同上——`validate.js` 也會抽查這個字串。

## 3.（一律適用）每站「附近特色美食・店家・景點」toggle 面板

行程時間軸的**每一個** `slot`（只要有 `lat`/`lng`，不分單日或多日行程、不分距離遠近）下方，都要加入一個預設收合、點擊展開的面板，即時運算「這一站附近」有哪些地方值得去——**不是為每站各自編一套不同清單**，而是共用同一個候選池：`trip.highlights`（spots/food/shops）**加上**全程 `trip.days[].slots`（排除該站自己），用真實座標算距離、由近到遠排序後全部列出。候選池納入 `day.slots` 是為了讓讀者知道「這一站附近其實還有行程裡的另一站」，不是只有 highlights 裡的項目才算數；也是第 2 節「行程途經」分組的資料來源。

範圍小的行程（如整座島僅 1–2 公里）距離會集中在幾十到幾百公尺；範圍大的行程（如橫跨數百公里的公路旅行）距離可能是幾十到上百公里——**兩種情況都要做**，距離數字本身就是有效資訊（讓讀者知道「這個景點其實離今天住的地方很遠，是路過另一天才會經過的」），不是只有小範圍行程才「適合」。

### 互動規格

- 觸發元件：`<button class="nearby-toggle" data-target="{panelId}" aria-expanded="false">▸ 顯示附近特色美食・店家・景點</button>`
- 內容容器：`<div class="nearby-panel" id="{panelId}" hidden>...</div>`
- 點擊切換 `hidden` 屬性與 `aria-expanded`，按鈕文字同步在「▸ 顯示…」/「▾ 隱藏…」間切換。
- 事件用**事件代理**（在時間軸容器上監聽 click，`event.target.closest('.nearby-toggle')`），不要為每個按鈕各自綁定，避免動態內容重繪後失效。

### 距離計算 + 去重 + 候選池命中記錄：一律呼叫 `poi.js` 的 `nearbyGridHTML`

跟第 2 節一樣，距離計算（Haversine）、去重（排除跟該站「同一家」的項目）、命中記錄，全部已經包進共用引擎 `assets/poi.js` 的 `nearbyGridHTML(items, fromLat, fromLng, stopTitle, opts)`——不要自己重寫一份 haversine 或 `sameCore`：

- **距離計算**：內部用 Haversine 公式（公尺），排序後全部列出（不做數量截斷），每張卡片標示距離（如 `190 m` / `1.2 km`，`formatDist()`）。
- **去重**：避免「魚見亭」這一站的附近清單裡又推薦「魚見亭」自己。用站點標題（`slot.name`，即 `stopTitle` 參數）跟候選項目的 `name`／`shop` 做**寬鬆比對**（`sameCore()`），而非精確字串相等——因為同一地點常有不同寫法（如站點標題寫「片瀬東浜海岸」、highlights 裡登記為「片瀬東浜海水浴場」）。站點標題會先依常見分隔符（`・`、`／`、括號）拆成多個 token 逐一比對，任一命中就從該站的附近清單中排除（`day.slots` 候選池對自己本身的比對也會被排除）。
- **候選池命中記錄**（供第 2 節「行程途經」分組使用）：`opts.hitStore` 傳一個空物件進去，`nearbyGridHTML` 會把「候選池裡命中、且來源是 `day.slots`」的項目自動記進這個物件（跨所有站點去重，一個地點只記一次，key 是 `normalizeName(name)`）。渲染完全部站點的附近面板後，這個物件裡的值就是第 2 節延伸推薦「行程途經」那一組的資料來源——不用另外重新算一次距離或去重。

一站的完整呼叫範例（`hlForNearby` 是 `trip.highlights`，`transitHitNames` 是跨全站共用的同一個物件）：

```js
nearbyGridHTML(hlForNearby.spots, s.lat, s.lng, s.name, { sourceClass: 'highlight', sourceLabel: '精選', mapAppLinksFn: buildMapAppLinks })
nearbyGridHTML(otherSlots, s.lat, s.lng, s.name, { sourceClass: 'transit', sourceLabel: '行程途經', hitStore: transitHitNames, mapAppLinksFn: buildMapAppLinks })
```

### 常見踩坑：`hidden` 屬性被 CSS 蓋過，面板預設變成展開

面板容器用 `hidden` 屬性做預設收合，但如果另外寫了 `.nearby-panel { display: flex; ... }` 這類規則，會蓋過瀏覽器內建的 `[hidden] { display: none }`——class 選擇器的優先權高於瀏覽器對 `hidden` 屬性套用的 UA 樣式，於是所有面板一開始就是展開的，但按鈕文字卻還顯示「▸ 顯示…」，兩者矛盾且不易從程式碼肉眼看出（要真的捲到那段畫面才會發現）。**修法**：額外加一條權重更高的規則 `.nearby-panel[hidden] { display: none; }`，確保 `hidden` 屬性真正生效。生成後建議實際用瀏覽器（或無頭瀏覽器截圖）打開頁面確認面板預設是收合的，不要只憑讀程式碼判斷。

## 4.（一律適用）頁面區塊順序

實測下來，讀者期待的閱讀動線是「先看行前準備與交通，再看真正的時間序行程，地圖緊接在行程後方輔助理解路線，最後才是延伸的總覽參考資料」：

```
行前須知 → 交通 → 【時間軸行程（含每站 nearby 面板）】 → 路線地圖
  → 特色景點・美食・店家總覽 → 免責聲明 → 全程實用貼士 → 日文・外文名詞註解
```

時間序行程表（含地圖）**必須排在** highlights 總覽之前——總覽是延伸參考資料，不是主要內容，不該搶在行程本身前面。

## 5.（一律適用）時間軸站點標題可連結

`slot` 可帶 `url` 欄位（比照第 2 節連結規範），有值時站點標題（`<h4>`）整個包成 `<a target="_blank" rel="noopener">`，方便讀者直接點進官方頁面查詳情，不用另外去 highlights 總覽找對應項目。

**每一站都要有可點的出口，不是只有帶 `url` 的才有**：`slot` 只要有 `lat`/`lng`（時間軸站點的必填欄位，見 page-contract.md），就在標題下方比照第 2 節「標題連結＋地圖連結」的規則，另外加一行呼叫 `buildMapAppLinks(lat, lng, name)` 產生的地圖連結。沒有官網 `url` 的站點標題本身維持純文字（不手拼假連結），但地圖連結這一行等於保底出口，讓每一站不論有沒有官網都至少能點開地圖確認位置。

## 6.（視內容而定，不分行程長短）外文名詞註解（頁面最底部）

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

## 7.（一律適用）預設配色：固定套用「卡爾加里 × 洛磯山脈」色票系統

**所有**行程頁面（不分單日/多日、國內/跨國），**預設直接套用**以下這組色票（來源：使用者提供的「卡爾加里 × 洛磯山脈」行程頁面，經確認喜歡並指定固定使用），不用每次重新設計或詢問使用者偏好；使用者之後若明確給了另一份參考頁面並表示喜歡該配色，才改用那份：

```css
:root {
  /* 淺色（預設） */
  --bg: #f1f4f2;       --surface: #ffffff;   --surface-2: #e7ece9;
  --ink: #1b2422;      --ink-soft: #4b5751;  --ink-faint: #7c8985;
  --line: #d7ded9;
  --teal: #146b6b;     --teal-ink: #0e4f4f;  --teal-soft: #e1f0ee;
  --amber: #a3701f;    --amber-ink: #855c19; --amber-soft: #f5ead2;
  --shadow: 0 1px 2px rgba(20, 30, 28, 0.06), 0 8px 24px -12px rgba(20, 30, 28, 0.18);
  --font-display: 'Iowan Old Style', 'Palatino Linotype', Georgia, 'Noto Serif TC', 'PingFang TC', serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* 深色 */
    --bg: #101614;       --surface: #171f1c;   --surface-2: #1f2925;
    --ink: #e8ece9;      --ink-soft: #a9b5af;  --ink-faint: #74827c;
    --line: #2a3630;
    --teal: #5fc9c4;     --teal-ink: #8fdcd8;  --teal-soft: #16302e;
    --amber: #e3ae5c;    --amber-ink: #eec078; --amber-soft: #3a2e17;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px -12px rgba(0, 0, 0, 0.5);
  }
}

:root[data-theme="dark"] {
  /* 深色（顯式切換時強制覆寫，優先權高於系統設定） */
  --bg: #101614;       --surface: #171f1c;   --surface-2: #1f2925;
  --ink: #e8ece9;      --ink-soft: #a9b5af;  --ink-faint: #74827c;
  --line: #2a3630;
  --teal: #5fc9c4;     --teal-ink: #8fdcd8;  --teal-soft: #16302e;
  --amber: #e3ae5c;    --amber-ink: #eec078; --amber-soft: #3a2e17;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px -12px rgba(0, 0, 0, 0.5);
}
```

用法要點：

- `--teal` 當主色（連結、時間軸圓點、標籤、待辦清單勾選色），`--amber` 當次色（提醒徽章、警示、免責聲明邊框）。
- 標題／區塊大標用 `--font-display`（襯線展示體），內文用 `--font-body`，時間／價格等需要對齊的數字一律用 `--font-mono` 搭配 `font-variant-numeric: tabular-nums`。
- 卡片圓角統一 `10px`（比 `page-contract.md` 原本建議的 `16px` 更內斂，跟隨這組色票的整體氣質），陰影用 `--shadow`。
- 三段式雙主題寫法必須完整照抄（裸 `:root` 淺色 → `@media (prefers-color-scheme: dark)` 搭配 `:not([data-theme="light"])` → `:root[data-theme="dark"]` 再覆寫一次），不要只挑幾個顏色片段、也不要混用其他配色的變數命名。

## 對應 SKILL.md 流程的插入點

- 第 1 節（唯一條件式的一節）與第 2 節的 `trip.highlights` 資料結構屬於「調研補全 + 生成」步驟 3（組織成 `trip` 資料結構）的擴充；第 2 節的「卡片渲染規則」子節則跟第 3、5、6 節一樣，屬於步驟 4（生成風格化 HTML）的必做渲染邏輯。
- 第 2（卡片渲染規則）、3、5、6 節屬於步驟 4（生成風格化 HTML）的必做渲染邏輯，等同 `page-contract.md` 的「必須包含的區塊」——**不限行程類型，一律要做**，第 6 節僅在目的地語言環境含大量外文詞彙時觸發。第 2、3 節的渲染邏輯已抽成 `assets/poi.js`，步驟 4 要跟 `map.js`/`reminders.js` 一起整份內聯進頁面，不要重新手刻。
- 第 4 節可直接併入 `page-contract.md`「必須包含的區塊」章節開頭，作為區塊順序建議，適用所有行程。
- 第 7 節取代 `design-guidelines.md`「配色」一節第一條，作為所有行程的預設配色來源。

## 常見誤區

**不要因為行程是多日／跨國／有航班，就跳過第 2–7 節。** 第 1 節的條件（是否用 `transit` 取代 `flights`/`hotelAreas`）只回答「這一節怎麼組資料」，不代表整份文件只適用單日行程。判斷順序應該是：先無條件套用第 2–7 節，再單獨判斷第 1 節要不要觸發。
