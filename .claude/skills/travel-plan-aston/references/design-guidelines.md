# 內建美學準則（無 frontend-design 時的兜底）

設計步驟優先呼叫專業設計 skill（`frontend-design` 或 `huashu-design` 花叔Design，任一已安裝即用）；**兩者都未安裝**時，按本準則自己出風格化 HTML，目標是"有性格、不像 AI 預設模板"。這是本倉庫自有的精簡指導，使 skill 可獨立使用。

## 配色 {#palette}

- **所有行程（不分單日／多日、國內／跨國），預設直接套用下方的固定色票**（teal + amber，淺／深雙主題），不用每次重新設計或詢問使用者偏好。
- 使用者明確提供另一份參考頁面並表示喜歡該配色時，優先順序高於上一條：直接沿用對方的 CSS 變數命名與數值（含淺/深雙主題的三段式寫法：裸 `:root` 定義淺色、`@media (prefers-color-scheme: dark)` 搭配 `:not([data-theme="light"])`、`:root[data-theme="dark"]` 三層），完整套用而非只挑幾個顏色片段、也不要混用兩邊變數名。
- 其餘情況（多日跨國行程等不適用上述固定色票時），每趟行程選一套**有性格的配色**（深色背景 + 主題強調色，或清爽淺色 + 一個鮮明主色），不同行程用不同配色以便區分。
- 用 CSS 變數統一定義（如 `--bg`、`--bg-card`、`--text`、`--text-dim`、`--accent`、`--border`），全域性複用。
- 保證文字與背景**高對比**，可讀性第一。


### 固定色票（teal + amber）

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

- `--teal` 當主色（連結、時間軸圓點、標籤、待辦清單勾選色），`--amber` 當次色（提醒徽章、警示、免責宣告邊框）。
- 標題／區塊大標用 `--font-display`（襯線展示體），內文用 `--font-body`，時間／價格等需要對齊的數字一律用 `--font-mono` 搭配 `font-variant-numeric: tabular-nums`。
- 卡片圓角統一 `10px`（比 `page-contract.md` 原本建議的 `16px` 更內斂，跟隨這組色票的整體氣質），陰影用 `--shadow`。
- 三段式雙主題寫法必須完整照抄（裸 `:root` 淺色 → `@media (prefers-color-scheme: dark)` 搭配 `:not([data-theme="light"])` → `:root[data-theme="dark"]` 再覆寫一次），不要只挑幾個顏色片段、也不要混用其他配色的變數命名。

## 排版與佈局 {#layout}

- **響應式，移動 + 桌面都要好看**：手機端單列、主體約 420–480px；**桌面端（≥768px）容器加寬到約 880–960px 居中**，卡片列表（航班/酒店/行前須知/餐飲/景點）用多列網格、地圖更寬。務必寫 `@media` 斷點，別讓大屏只剩一條窄列。
- 層級分明：標題用有個性的字型（襯線/展示體皆可），正文清爽易讀；字號、字重拉開層級。
- **中日文頁面不要內聯 webfont**：CJK 字型動輒數 MB，塞進單檔案會讓頁面大到無法用；外鏈 CDN 字型在離線或受限網路下會靜默回退，看起來像沒設計過。**系統字型棧才是這裡的正確解，不是妥協**——性格靠「角色配對」做出來，不靠載入字型檔：

  ```css
  --font-display: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Songti TC",serif;
  --font-body:    -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang TC","Microsoft JhengHei","Noto Sans TC","Hiragino Sans",sans-serif;
  --font-mono:    ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  ```

  襯線展示體承擔標題與外文名詞（給頁面聲音），CJK 無襯線承擔正文（螢幕上遠比 CJK 襯線好讀），等寬體承擔所有會對齊的數字。
- **卡片化**：分割槽用卡片承載，圓角、充足留白、細邊框或極淡陰影，不要擁擠。
- 一致的視覺語言：圖示、徽章、標籤"藥丸"風格統一（如營業時間/門票/交通用同一套小標籤，`.source-tag` 來源標籤、`.pill` 營業時間/門票標籤、`.dist-tag` 距離標籤都算在內，別讓 `poi.js` 產出的這幾個 class 長得像沒設計過的瀏覽器預設樣式）。

## POI 卡片牆的視覺 {#poi-visuals}

> ⚠️ **本節只列了 `poi.js` 的 class。三個引擎輸出的 class 完整清單見 `assets/engine-contract.md#engine-classes`**——`map.js` 的 `.route-pin` 與 `reminders.js` 的 `.todo-*` 也必須由頁面提供樣式，漏寫會讓地圖示記完全隱形、待辦清單退化成裸列表，而且**不會報錯**。設計步驟請照那張表逐條核對，不要只看本節。

結構與版面（幾列、橫向捲動、滾動提示的觸發時機）由 `assets/engine-contract.md#poi-wall` 與 `assets/poi.js` 定死，這裡只管視覺——`poi.js` 只產生語義化的 class（`.poi-grid`、`.poi-card`、`.source-tag.highlight`/`.source-tag.transit`、`.dist-tag`、`.poi-maplink`、`.poi-scroll-hint`），具體長什麼樣由設計步驟決定：

- **`.source-tag` 的兩個變體要一眼區分**：`.highlight`（精選）用頁面主色調，`.transit`（行程途經）用次色調或中性色——不要兩個用同一個顏色只靠文字區分，那樣在卡片牆快速掃視時起不到分組的作用。可以直接借用上面 [#palette](#palette) 的主色／次色（如 teal/amber 那組配色裡，精選用 `--teal-soft` 底 + `--teal-ink` 字，行程途經用中性的 `--surface-2` 底 + `--ink-soft` 字，或反過來用 amber 當次色，視整體配色而定）。
- **`.poi-scroll-hint` 要低調，不要搶戲**：這只是個「還能往右滑」的輔助提示，用小字號、弱化的次要文字顏色（如 `--ink-faint`）即可，不需要圖示動畫或強調色，喧賓奪主反而分散注意力。
- **`.poi-card` 內容密度**：卡片可能同時有標題＋標籤＋備註＋地圖連結，行距與內邊距要給夠，避免擠成一團；`.poi-maplink` 的小連結建議跟卡片正文有明顯字號差（比正文小一號），視覺上讀作"附屬操作"而非"正文內容"。
- **橫向捲動的視覺邊界**：卡片牆末端如果卡片被截斷一半，讀者更容易意識到還能往右滑；不需要額外做漸層遮罩這類效果，`.poi-scroll-hint` 加上被截斷的卡片邊緣已經足夠。
- **`.route-pin` / `.route-pin__num`（地圖編號標記，`map.js`）**：divIcon 只給了 28×28 的空容器，底色、圓角、序號顏色全要頁面自己寫。用主色實心圓 + 白色等寬序號 + 一圈半透明光暈（`box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal) 35%, transparent)`），在淺色地圖瓦片上才夠顯眼。**這一條最容易漏，漏了地圖上一個點都看不到。**
- **`.todo-*`（頁頂待辦清單，`reminders.js`）**：`.todo-item` 用卡片外觀（背景 + 細邊框 + 圓角），`.todo-deadline` 用主色小徽章（等寬字 + `tabular-nums`）與正文拉開層級，`.todo-item input` 記得設 `accent-color: var(--teal)`，不然勾選框還是瀏覽器預設藍。
- **`.action-link`（航班／酒店／交通的行動按鈕，見 `assets/page-contract.md#action-links`）**：跟卡片裡靜態的 `.poi-maplink` 不同，這是「去預訂/去導航/叫車」這類會觸發實際動作的按鈕，視覺權重要比 `.poi-maplink` 明顯——用主色（如 `--teal-ink`）加粗體或底線強調，讓讀者一眼認出"這個可以點、會帶我去下一步"，不要跟卡片裡其他輔助小字混在一起。

## 季節狀態標籤的視覺 {#status-visuals}

`poi.js` 產出 `.status` 加上 `.season` / `.booking` / `.free` 三個修飾 class，結構由 `assets/conditional-features.md#season-status` 定死，這裡只管長什麼樣：

- **`.season`（季末／封路）用警示色**（如 amber 系的 `--amber-soft` 底 + `--amber-ink` 字）。它是三者裡唯一「錯過就沒有了」的資訊，必須最搶眼。
- **`.booking`（須提前訂）用主色**（`--teal-soft` 底 + `--teal-ink` 字）。是行動提示，權重次之。
- **`.free`（免費）用中性色**（`--surface-2` 底 + `--ink-soft` 字）。是好消息但不急，最弱。
- **三者的視覺權重必須是 season > booking > free**，而且要跟同一張卡上的 `.pill`（價位、難度、英文名）明顯不同——不然讀者掃不出哪個是「時間敏感」的資訊。

## 雙方案與雙強度路線的視覺 {#dual-plan-visuals}

結構與 class 名稱由 `assets/conditional-features.md#dual-plans` 定死，這裡只管長什麼樣：

- **`.plan-head`（方案標頭）**：左側粗邊框（3–4px）承載方案身分——**推薦方案用主色，另一案用次色**，讓讀者掃一眼就知道哪套是建議的。推薦標記用小藥丸而不是大徽章，避免把另一案壓成「錯的選項」。
- **`.route-h` 的 `.easy` / `.mid`**：`.easy` 用主色、`.mid` 用次色。**兩者必須一眼區分，不要只靠文字**——讀者是左右對照著看的，顏色相同就失去並排的意義。
- **`.wx`（雨雪備案）**：弱化底色的小方塊（如 `--surface-2`），跟正文拉開層級。它是「萬一」才會讀的內容，視覺權重要低於路線本身，但又不能低到被忽略——用底色而不是只改字色。
- **`.daytip`（當日貼士）**：左側細邊框 + 次色，**權重低於 `.wx`**。三者的視覺層級應該是：路線 > 備案 > 貼士。
- **並排兩欄的分隔**：桌機並排時用一條細的垂直分隔線（`border-left`）而不是留白，讀者才知道那是兩個平行選項而非上下文；手機堆疊時分隔線要換成水平的。

## 細節 {#details}

- 圖片**嚴禁變形**與載入失敗的降級底色，是硬性約束，寫法見 `assets/page-contract.md#constraints`；視覺上只要記得降級底色要跟本頁色票一致，不要用瀏覽器灰。
- 關鍵資訊（待辦清單、⚠️ 提醒徽章、已預訂標識、免責宣告）用顏色/圖示突出，但剋制，不要花哨到喧賓奪主。
- 適度的過渡/懸停反饋即可，避免炫技動畫拖慢手機。
- 整體追求"精心設計過"的觀感，避免千篇一律的預設灰白卡片。

> 裝了 frontend-design 或 huashu-design 會更出彩；本準則只是保證"沒裝也能拿到一份像樣、好看的頁面"。
