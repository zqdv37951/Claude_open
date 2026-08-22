# 引擎契約

三個引擎腳本（`map.js`、`reminders.js`、`poi.js`）承載本 skill 全部的機械邏輯：地圖、提醒日期計算、POI 卡片牆與附近推薦。生成頁面時**三份都要整份內聯進 HTML**（單檔自包含），並且**不要繞開它們自己重刻一遍** —— 這是本 skill 修過最多次的一類問題：各頁面各寫一套，規則改了舊頁面沒跟著改。

**三個引擎刻意互相獨立**：`poi.js` 不 `require` `map.js`，需要 `buildMapAppLinks` 時由呼叫方（頁面自己的渲染腳本）當引數傳入。`escapeHTML` 在三個檔案裡各定義一份，屬故意重複。維護時請保持這個邊界，不要合併去重。

## 函式簽章 {#api}

| 引擎 | 函式 | 用途 |
|---|---|---|
| `map.js` | `initTravelMap(elementId, points, opts?)` | 初始化 Leaflet 地圖：編號 divIcon 標記、依序虛線路線、點選彈窗。`points` = `[{lat,lng,name,time}]`，座標須為 WGS-84 |
| `map.js` | `buildMapAppLinks(lat, lng, label)` | 產生地圖 App 點位連結，規則見 [#map-links](#map-links) |
| `map.js` | `buildNavLink(lat, lng, label, ua)` | 裝置原生導航連結（iOS → Apple Maps，其餘 → `geo:`） |
| `map.js` | `gcj02ToWgs84(lat, lng)` | GCJ-02 → WGS-84。**高德／騰訊回傳的座標必須先過這一關**，否則 OSM 圖上偏移數百公尺 |
| `reminders.js` | `computeReminders(startDateISO, items)` | 由 `leadDays` 算出實際截止日 |
| `reminders.js` | `renderChecklistHTML(reminders)` | 頁頂待辦清單 HTML |
| `reminders.js` | `reminderBadgeHTML(leadDays, opts?)` | 時間軸上的「要先訂」徽章。`opts = {kind, url}` 時輸出可點的訂票連結，見 [#booking-badge](#booking-badge) |
| `poi.js` | `poiWallHTML(items, sourceClass, sourceLabel, mapAppLinksFn?)` | 延伸推薦卡片牆，見 [#poi-wall](#poi-wall) |
| `poi.js` | `nearbyGridHTML(items, fromLat, fromLng, stopTitle, opts?)` | 每站附近推薦，見 [#nearby-panel](#nearby-panel) |
| `poi.js` | `statusHTML(status)` | 季節狀態標籤。POI 卡片內部會用，**時間軸站點與路線停靠點的 `status` 也要由頁面呼叫它渲染**（`conditional-features.md#season-status`） |

這張表列的是**頁面作者要呼叫的入口**。三個引擎的 `module.exports` 還多出十幾個名字（`sameCore`、`haversineMeters`、`poiCardHTML`、`routeCoordinates` 等），那些是**內部 helper，匯出只為了讓回歸測試在零依賴的情況下夠得到**，不是公開 API——頁面不該直接呼叫它們。（`statusHTML` 是例外，已升為入口函式列在表裡：卡片牆之外的站點也要用它。）文件別處若提到某個 helper（如 `page-contract.md#a11y` 提到 `gridOpenTag`），是在說明引擎內部行為，不是叫你去呼叫。

## 引擎只輸出語意 class，樣式責任在頁面 {#engine-classes}

**三個引擎只輸出語意 class，樣式一律由頁面負責。** 漏寫任何一條，對應元件就會變成沒有樣式的裸元素——而且 `poi.js` 那幾個很顯眼、一眼就看得出來，`map.js` 與 `reminders.js` 那幾個卻**不會報錯、只會安靜地消失**：地圖示記變成 28×28 的透明 div（38 個點全部看不見，但 `.leaflet-marker-icon` 數量是對的，程式檢查抓不到），頁頂待辦清單退化成裸 `<li>`。

這張表是唯一權威清單，生成頁面時逐條核對：

| 引擎 | class | 用途 | 漏寫的後果 |
|---|---|---|---|
| `map.js` | `.route-pin` | 地圖編號標記的圓形底 | **標記完全隱形** |
| `map.js` | `.route-pin__num` | 標記裡的序號文字 | 序號看不見 |
| `reminders.js` | `.pretrip-todo` | 待辦清單 `<ul>` | 清單退化成預設項目符號 |
| `reminders.js` | `.todo-item` | 單一待辦 `<li>` | 沒有卡片外觀 |
| `reminders.js` | `.todo-deadline` | 日期徽章 | 日期混在正文裡看不出來 |
| `reminders.js` | `.todo-text` | 待辦內容 | 缺次級文字色 |
| `reminders.js` | `.reminder-badge` + `.ticket` / `.reserve` / `.permit` | 時間軸上的「要先訂」徽章（`page-contract.md#booking`） | 徽章變裸文字；三種類型分不出來 |
| `poi.js` | `.poi-grid` | 卡片牆容器（2 列 × 橫向捲動） | 退化成直向堆疊 |
| `poi.js` | `.poi-card` `.hl-card` | 卡片本體（**兩個 class 同時掛在同一個元素上**） | 卡片沒有邊框背景 |
| `poi.js` | `.poi-scroll-hint` | 「◂ 左右滑動檢視更多 ▸」 | 提示變裸文字 |
| `poi.js` | `.source-tag` + `.highlight` / `.transit` | 精選／行程途經來源標籤 | 兩組分不出來 |
| `poi.js` | `.dist-tag` | 距離標籤 | 距離混在標題裡 |
| `poi.js` | `.poi-maplink` | 卡片下方地圖連結那一行 | 連結沒有弱化樣式 |
| `poi.js` | `.pill` | 分類標籤（`category`，**接受字串或陣列**，一張卡可掛多個） | 標籤變裸文字 |
| `poi.js` | `.status` + `.season` / `.booking` / `.free` | 季節狀態標籤（`conditional-features.md#season-status`） | 三種狀態失去顏色區別，「10/12 封路」跟「免費」長得一樣 |
| `poi.js` | `.hl-shop` | 美食項目的來源店家 | 缺次級文字色 |
| `poi.js` | `.muted` | 空狀態提示文字 | 缺弱化色 |

**檢查方法**（不要靠肉眼；也不要用「掃引擎原始碼的 class=" "」那種寫法）：

> ⚠️ 本節原本放的是「正則掃三個引擎的 `class="..."`，再比對頁面 CSS」的腳本。**那支腳本有致命盲點**：`poi.js` 有一半的 class 是拼出來的——
> ```js
> '<span class="source-tag ' + escapeHTML(sourceClass) + '">'   // source-tag / highlight / transit
> '<span class="status ' + kind + '">'                          // status / season / booking / free
> ```
> 正則抓不到，所以 `source-tag`、`highlight`、`transit`、`status`、`season`、`booking`、`free` 這 7 個**從來沒被它看過**，它卻回報「缺樣式的 class: 無」。**檢查通過但沒檢查到，比沒有檢查更糟**——它給人被守著的錯覺。所以改成拿**上面那張表**（唯一權威）去比對：

```bash
# 以契約表為準，逐一確認頁面 <style> 裡有對應規則
python3 - <<'EOF'
import re
doc=open('<skill目錄>/assets/engine-contract.md',encoding='utf-8').read()
seg=doc[doc.find('{#engine-classes}'):doc.find('{#poi-wall}')]
listed=sorted(set(re.findall(r'`\.([a-z][a-z0-9_-]*)`',seg)))
page=open('<生成的.html>',encoding='utf-8').read()
css='\n'.join(re.findall(r'<style[\s\S]*?</style>',page))
missing=[c for c in listed if '.'+c not in css]
print(f'契約表列 {len(listed)} 個 class，缺樣式的：', missing or '無')
print('（.leaflet-marker-icon 是 Leaflet 自己的 class，不必上樣式。其餘每一個「缺」都要能說出這頁為什麼用不到它。）')
EOF
```

`assets/validate.js` 從兩個方向自動守這件事：①「呼叫了某個引擎函式卻沒有對應 class 規則」的高風險抽查（`.route-pin`、`.todo-item` 等 7 條）；②**資料驅動核對**——看 `trip` 裡實際有什麼欄位來決定要求什麼 class（有 `category` 就要 `.pill`、有 `status` 就要 `.status` 加上實際出現的那幾種 kind）。這樣既沒有假陽性（沒有那種資料就不要求那個 class），也不會因為 class 是拼接的而漏掉。

## 延伸推薦卡片牆 {#poi-wall}

**這一節的邏輯已經抽成共用引擎 `assets/poi.js`**（跟 `map.js`/`reminders.js` 同一套模式：純函式、瀏覽器與 Node 雙用），生成頁面時把它整份內聯進 `<script>`（見 SKILL.md 的「調研補全 + 生成」），呼叫 `poiWallHTML(items, sourceClass, sourceLabel, buildMapAppLinks)` 產生延伸推薦卡片牆——**不要每次重新手刻一遍**，這是本節多次因為各頁面各寫一套、規則改了舊頁面沒跟著改而補救的教訓。`poi.js` 刻意不 `require` `map.js`，`buildMapAppLinks` 由呼叫方（頁面自己的渲染腳本）當引數傳入，兩個引擎檔保持互相獨立。

- **版面**：`spots`／`food`／`shops` 三個清單都用「2 列 × 橫向捲動」排版（`poiWallHTML` 固定輸出 `<div class="poi-grid">`），不要用直向多列網格。對應 CSS（`poi.js` 只產生 HTML、不含 CSS，這段仍要手動寫進頁面的 `<style>`）：

  ```css
  .poi-grid {
    display: grid;
    grid-template-rows: repeat(2, auto);
    grid-auto-flow: column;
    grid-auto-columns: minmax(220px, 1fr);
    gap: 10px 16px;
    overflow-x: auto;
    padding-bottom: 8px; /* 留白避免捲動軸貼齊卡片內容 */
    scroll-snap-type: x proximity;
  }
  .poi-card { scroll-snap-align: start; }
  .poi-scroll-hint { margin: 0 0 0.4rem; font-size: 0.72rem; color: var(--ink-faint); font-family: var(--font-mono); }

  /* ⚠️ 缺這一條，上面的 overflow-x 完全不會生效 —— 見本節下方「min-width: 0 前提」 */
  .tl > li > div, .route li > div, .day-b, .nearby-panel, #regions-body { min-width: 0; }
  ```

  **`min-width: 0` 前提（漏了會讓整面卡片牆點不到）**：grid／flex 子項的 `min-width` 預設是 `auto`，意思是「不得縮小到比內容更窄」。卡片牆放在時間軸的 `1fr` 欄位裡時，那個欄位會被整排卡片撐開（實測撐到 3760px），`overflow-x: auto` 因此永遠不觸發；而外層 `.day { overflow: hidden }` 又把撐出去的部分裁掉——**結果是超出畫面的卡片既不能捲、也點不到，比純直向堆疊更糟**。

  所以凡是「卡片牆的祖先鏈上有 grid／flex 容器」，都要在那條鏈上補 `min-width: 0`。這個 bug 的特徵是：`grid-template-rows` 與 `grid-auto-flow` 兩個屬性查起來都正確，唯獨 `scrollWidth === clientWidth`——**只量 CSS 屬性抓不到，必須量容器的溢位**（見 SKILL.md 的「怎麼量才準」）。

  超過 2 項會自動往右新增一欄、容器橫向捲動；`poiWallHTML`/`nearbyGridHTML` 這時會自動在卡片牆前面加一行 `<p class="poi-scroll-hint">◂ 左右滑動檢視更多 ▸</p>` 提示（項目 ≤2、不需要捲動時不會出現這行）——橫向捲動在桌面版不容易被發現，這行提示必須留著，不要手動刪掉。手機與桌面共用同一套 CSS，不用另外寫 `@media` 改成直向單欄。**這套 `.poi-grid` 版面也是 `engine-contract.md#nearby-panel` 面板卡片牆的標準版面**——同一份 CSS、同一個卡片元件（`poi.js` 的 `nearbyGridHTML` 內部就是呼叫 `poiCardHTML`），兩處視覺要一致，不要各寫一套。

- **分組標記**：延伸推薦不只是 `trip.highlights` 原始內容，還要併入 `engine-contract.md#nearby-panel` 在計算時、曾經出現在任一站附近清單裡的其他行程站點（`day.slots`）。兩個來源分開列、各自標記清楚：
  1. **精選 highlights**——`trip.highlights.spots`／`food`／`shops` 原始三個分類，維持不變，呼叫 `poiWallHTML(hl.spots, 'highlight', '精選', buildMapAppLinks)`。
  2. **行程途經**——生成每站「附近推薦」面板時，把候選池裡命中、但來源是 `day.slots`（不是 `trip.highlights`）的項目另外收進一個全域集合（見 `engine-contract.md#nearby-panel` 的「候選池命中記錄」，即 `nearbyGridHTML` 的 `opts.hitStore` 引數）；生成延伸推薦區塊時，把這個集合裡「不在 highlights 內」的項目（用 `poi.js` 的 `sameCore()` 判斷）去重後，呼叫 `poiWallHTML(transitItems, 'transit', '行程途經', buildMapAppLinks)` 列成新的一組，跟精選區分開，避免同一地點兩邊都出現。
  3. `day.slots` 項目未必有 `photo`/`rating`，只顯示 `name` + 一句話（可用該站 `review` 或留空）即可，不用為了湊欄位硬編內容。
  4. **`engine-contract.md#nearby-panel` 面板本身的卡片也要套用同一套標籤**：面板裡來自 `trip.highlights` 的子清單（如「附近必去景點」「附近必吃餐廳」）呼叫 `nearbyGridHTML(..., { sourceClass: 'highlight', sourceLabel: '精選' })`，來自 `day.slots` 候選池的子清單（「附近行程其他站點」）呼叫 `nearbyGridHTML(..., { sourceClass: 'transit', sourceLabel: '行程途經', hitStore })`——延伸推薦區塊跟附近推薦面板用的是同一個 `poi.js`，不要在兩處各寫一套判斷。
  5. 標籤固定用 `poiCardHTML` 內建輸出的 `.source-tag` 這個 class（精選是 `.highlight` 修飾 class、行程途經是 `.transit`），不要每次改名——`assets/validate.js` 會機械抽查 HTML 裡有沒有 `source-tag` 字串，class 名稱對不上會被誤判成漏做。

- **標題連結＋地圖連結**：卡片標題沿用本節「連結誠實原則」子節的規範——有 `url` 就整個標題包成 `<a>`，沒有就維持純文字（`poiCardHTML` 內建的 `linkOrText` 已經處理）。**額外規則**：只要卡片有 `lat`/`lng`（不論標題有沒有官網連結），都在卡片下方另外加一行地圖連結，呼叫頁面已內聯的 `map.js` 的 `buildMapAppLinks(lat, lng, name)`（跟時間軸地圖彈窗用的是同一個函式，兩條規則見下方「地圖連結的兩條硬規則」）——`poiCardHTML` 會自動處理這步，只要把 `buildMapAppLinks` 當最後一個引數傳進去即可，不用另外手拼。沒有座標就不渲染這一行。這一行固定用 `.poi-maplink` 這個 class 包住，理由同上——`validate.js` 也會抽查這個字串。

### 連結誠實原則

- `url` 只能是調研時搜尋工具**實際回傳過的網址**，禁止手拼或憑印象猜測網域。
- 找不到可信官方或介紹頁面時，`url` 留空字串或省略該欄位，前端應優雅降級為純文字（不渲染連結），**絕不放可能失效的猜測連結**。
- 渲染時的連結需帶外部跳轉標記（如 `↗`）與 `target="_blank" rel="noopener"`。

## 每站附近推薦面板 {#nearby-panel}

行程時間軸的**每一個** `slot`（只要有 `lat`/`lng`，不分單日或多日行程、不分距離遠近）下方，都要加入一個預設收合、點選展開的面板，即時運算「這一站附近」有哪些地方值得去——**不是為每站各自編一套不同清單**，而是共用同一個候選池：`trip.highlights`（spots/food/shops）**加上**全程 `trip.days[].slots`（排除該站自己），用真實座標算距離、由近到遠排序後全部列出。候選池納入 `day.slots` 是為了讓讀者知道「這一站附近其實還有行程裡的另一站」，不是只有 highlights 裡的項目才算數；也是 `engine-contract.md#poi-wall`「行程途經」分組的資料來源。

範圍小的行程（如整座島僅 1–2 公里）距離會集中在幾十到幾百公尺；範圍大的行程（如橫跨數百公里的公路旅行）距離可能是幾十到上百公里——**兩種情況都要做**，距離數字本身就是有效資訊（讓讀者知道「這個景點其實離今天住的地方很遠，是路過另一天才會經過的」），不是只有小範圍行程才「適合」。

### 互動規格

- 觸發元件：`<button class="nearby-toggle" data-target="{panelId}" aria-expanded="false">▸ 顯示附近特色美食・店家・景點</button>`
- 內容容器：`<div class="nearby-panel" id="{panelId}" hidden>...</div>`
- 點選切換 `hidden` 屬性與 `aria-expanded`，按鈕文字同步在「▸ 顯示…」/「▾ 隱藏…」間切換。
- 事件用**事件代理**（在時間軸容器上監聽 click，`event.target.closest('.nearby-toggle')`），不要為每個按鈕各自繫結，避免動態內容重繪後失效。

### 距離計算 + 去重 + 候選池命中記錄：一律呼叫 `poi.js` 的 `nearbyGridHTML`

跟 `engine-contract.md#poi-wall` 一樣，距離計算（Haversine）、去重（排除跟該站「同一家」的項目）、命中記錄，全部已經包進共用引擎 `assets/poi.js` 的 `nearbyGridHTML(items, fromLat, fromLng, stopTitle, opts)`——不要自己重寫一份 haversine 或 `sameCore`：

- **距離計算**：內部用 Haversine 公式（公尺），排序後全部列出（不做數量截斷），每張卡片標示距離（如 `190 m` / `1.2 km`，`formatDist()`）。
- **去重**：避免「魚見亭」這一站的附近清單裡又推薦「魚見亭」自己。用站點標題（`slot.name`，即 `stopTitle` 引數）跟候選項目的 `name`／`shop` 做**寬鬆比對**（`sameCore()`），而非精確字串相等——因為同一地點常有不同寫法（如站點標題寫「片瀬東浜海岸」、highlights 裡登記為「片瀬東浜海水浴場」）。站點標題會先依常見分隔符（`・`、`／`、括號）拆成多個 token 逐一比對，任一命中就從該站的附近清單中排除（`day.slots` 候選池對自己本身的比對也會被排除）。
- **候選池命中記錄**（供 `engine-contract.md#poi-wall` 的「行程途經」分組使用）：`opts.hitStore` 傳一個空物件進去，`nearbyGridHTML` 會把「候選池裡命中、且來源是 `day.slots`」的項目自動記進這個物件（跨所有站點去重，一個地點只記一次，key 是 `normalizeName(name)`）。渲染完全部站點的附近面板後，這個物件裡的值就是 `engine-contract.md#poi-wall` 延伸推薦「行程途經」那一組的資料來源——不用另外重新算一次距離或去重。

一站的完整呼叫範例（`hlForNearby` 是 `trip.highlights`，`transitHitNames` 是跨全站共用的同一個物件）：

```js
nearbyGridHTML(hlForNearby.spots, s.lat, s.lng, s.name, { sourceClass: 'highlight', sourceLabel: '精選', mapAppLinksFn: buildMapAppLinks })
nearbyGridHTML(otherSlots, s.lat, s.lng, s.name, { sourceClass: 'transit', sourceLabel: '行程途經', hitStore: transitHitNames, mapAppLinksFn: buildMapAppLinks })
```

### 常見踩坑：`hidden` 屬性被 CSS 蓋過，面板預設變成展開

面板容器用 `hidden` 屬性做預設收合，但如果另外寫了 `.nearby-panel { display: flex; ... }` 這類規則，會蓋過瀏覽器內建的 `[hidden] { display: none }`——class 選擇器的優先權高於瀏覽器對 `hidden` 屬性套用的 UA 樣式，於是所有面板一開始就是展開的，但按鈕文字卻還顯示「▸ 顯示…」，兩者矛盾且不易從程式碼肉眼看出（要真的捲到那段畫面才會發現）。**修法**：額外加一條權重更高的規則 `.nearby-panel[hidden] { display: none; }`，確保 `hidden` 屬性真正生效。生成後建議實際用瀏覽器（或無頭瀏覽器截圖）開啟頁面確認面板預設是收合的，不要只憑讀程式碼判斷。

## 地圖連結規則 {#map-links}

**① 高德只在中國境內出現。** `isInChinaBBox(lat, lng)` 為真時只給高德（境內 Google 地圖不可用、底圖座標系還會偏移）；**為假時只給 Google，不要附高德**。日本、加拿大這類境外行程的讀者不會用高德，多一個連結只是噪音。這條是改過一次才拿掉「境外也順手加高德」的，不要改回去。

**② 境外用「名稱 + 視野錨點」，不要用純座標。**

```
✗ https://www.google.com/maps/search/?api=1&query=51.0453,-114.0553
    → Google 地圖只顯示成一串度分秒（51°02'43.1"N 114°03'19.1"W），
      沒有店名、營業時間、評論、照片——而那才是讀者點開地圖想看的東西。

✓ https://www.google.com/maps/search/Studio%20Bell%20國家音樂中心/@51.0453,-114.0553,17z
    → 解析成地點卡片。而且優雅降級：名稱對不上（如「硃砂湖日落」這種中文別名）
      也仍然落在正確座標的視野內，不會像純名稱搜尋那樣跑到別的城市。
```

**絕對不要手拼 Google 的 place URL。** `/maps/place/…/data=!3m1!4b1!4m6!3m5!1s0x53717aaa864fd43b:0x7609799479e4d20e!…!16s%2Fg%2F11cmdqr136` 裡的 `0x…:0x…` 與 `/g/11cmdqr136` 是 Google 內部的 place id，查不到、也拼不出來，**拼錯會指到完全不同的地方**。要這種精準連結只能由官方地圖 skill 回傳。

### 呼叫方對 `buildMapAppLinks` 輸出的信任關係

`buildMapAppLinks` 回傳的 `url` **可以直接插進 `href` 而不再轉義**——因為它是引擎用字面字串 + `encodeURIComponent(label)` 組出來的，不含使用者可控的原始字元。`poi.js` 的 `mapLinkHTML` 與頁面的渲染腳本都依賴這一點。

**改動 `buildMapAppLinks` 時要維持這個保證**：任何進到 URL 的外部字串都必須先過 `encodeURIComponent`。如果哪天改成直接串接未編碼的值，所有呼叫方都會同時變成注入點，而它們不會知道。

## 預訂徽章 {#booking-badge}

`reminderBadgeHTML(leadDays, opts)` 有兩種輸出，差別只在有沒有 `opts.url`：

```js
reminderBadgeHTML(5)
// <span class="reminder-badge">⚠️ 建議提前5天訂</span>        ← 舊呼叫，輸出逐字不變

reminderBadgeHTML(5, { kind: 'ticket', url: 'https://…/tickets' })
// <a class="reminder-badge ticket" href="…" target="_blank" rel="noopener">需購票 · 建議提前 5 天 ↗</a>

reminderBadgeHTML(14, { kind: 'reserve' })
// <span class="reminder-badge reserve">需訂位 · 建議提前 14 天</span>   ← 沒有 url 就不是連結
```

三件由引擎負責、呼叫方不要自己判斷的事：

- **未知 `kind` 整個降級**成無 kind 的舊輸出，不會把不認識的字串寫進 class。
- **`leadDays` 為 0 或缺**時只顯示「需購票」，不會出現「提前 0 天」這種沒有意義的字。
- **沒有 `url` 就渲染成 `<span>`**，不是空連結。查不到訂票頁時這是正確的降級，不是缺陷。

**舊呼叫的輸出必須逐字不變**——這個函式已經內聯進多份既有頁面，輸出一變那些頁面的樣式就對不上。`reminders.test.js` 有一條專門釘住這件事的回歸測試。

## 改動引擎前先跑回歸測試 {#tests}

```bash
node assets/poi.test.js         # 24 個測試：卡片牆、距離排序、去重、字首比對、狀態標籤、轉義、鍵盤可聚焦
node assets/map.test.js         # 14 個測試：境內／境外連結分流、GCJ-02 轉換、initTravelMap（假 Leaflet）
node assets/reminders.test.js   # 16 個測試：日期回推（含預訂徽章的三種形態與向後相容）、日期回推（跨月／跨年／閏年）、清單 class、轉義
```

**三個引擎都有測試，改哪個就跑哪個。** `map.js` 的「高德只在境內」與「境外用名稱+視野錨點」兩條規則、`reminders.js` 的日期回推（最容易被時區坑掉）、`poi.js` 的 `sameCore` 字首佔比規則，都是被測試釘住的——改動時測試紅了，先確認是你的意圖還是迴歸。

`poi.js` 的行數常數 `POI_GRID_ROWS`（目前為 2）同時被三個地方依賴：`poi.js` 自己的滑動提示門檻、`poi.test.js` 的閾值測試、`validate.js` 檢查頁面 CSS 的 `repeat(N, auto)` 字串。**改行數時這三處必須一起改**，只改一處會靜默失效（頁面版面對不上但校驗照樣通過）。
