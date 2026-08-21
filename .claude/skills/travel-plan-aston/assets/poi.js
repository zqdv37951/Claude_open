// POI 卡片牆引擎：延伸推薦總覽（engine-contract.md#poi-wall）與每站附近推薦面板（#nearby-panel）共用的純函式。
// 瀏覽器與 Node 雙用。刻意不 require map.js/reminders.js（引擎檔案互相獨立，故意不合並去重，
// 維護時保持這個邊界）——需要 map.js 的 buildMapAppLinks 時由呼叫方顯式傳入。

// HTML 轉義，防止 XSS（與 map.js/reminders.js 各自一份，屬故意重複，見 page-contract.md）
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var toRad = function (d) { return d * Math.PI / 180; };
  var dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m) {
  return m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km';
}

// 同一地點常有不同寫法（如「片瀬東浜海岸」vs「片瀬東浜海水浴場」），用寬鬆比對而非精確相等
function normalizeName(s) {
  return String(s || '').replace(/[（）()／/・\s]/g, '');
}
function commonPrefixLen(a, b) {
  var n = Math.min(a.length, b.length), i = 0;
  while (i < n && a.charAt(i) === b.charAt(i)) i += 1;
  return i;
}
// 字首比對用來兜住「同地不同命名尾詞」（片瀬東浜海岸 vs 片瀬東浜海水浴場、
// The Bison 餐廳 vs The Bison Restaurant）。
//
// 曾經用「固定比前 4 個字」，對拉丁文字太寬鬆：'lakelouise' 與 'lakeminnewanka'
// 前 4 字都是 'lake'，會把 Lake Minnewanka 誤判成 Lake Louise——後果是那個站點被
// 靜默排除在附近推薦面板之外，面板只是少一項，畫面上完全看不出異常。
// 而且原本會命中的案例也是「因為錯的理由」命中：thebison 只比到 'theb'，
// 'The Bridge' 一樣會過。
//
// 改成「共同字首必須佔較短字串的 60% 以上」：
//   片瀬東浜海(5) / 片瀬東浜海岸(6)   = 0.83 ✓
//   thebison(8)  / thebison餐廳(11)  = 0.73 ✓
//   lake(4)      / lakelouise(10)    = 0.40 ✗（正確排除）
function sameCore(a, b) {
  if (!a || !b) return false;
  var na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb || na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) return true;
  var p = commonPrefixLen(na, nb);
  return p >= 3 && p / Math.min(na.length, nb.length) >= 0.6;
}
function titleTokens(title) {
  return String(title || '').replace(/[（）()]/g, '・').split(/[・／/]/).map(function (s) { return s.trim(); }).filter(Boolean);
}
function matchesStopTitle(name, tokens, fullTitle) {
  if (!name) return false;
  if (sameCore(name, fullTitle)) return true;
  return tokens.some(function (tok) { return sameCore(name, tok); });
}

function linkOrText(label, url) {
  return url
    ? '<a href="' + escapeHTML(url) + '" target="_blank" rel="noopener">' + escapeHTML(label) + ' ↗</a>'
    : escapeHTML(label);
}

// mapAppLinksFn：呼叫方傳入 map.js 的 buildMapAppLinks（不在這裡 require，保持引擎檔案互相獨立）。
// 沒有座標或沒傳函式就不渲染這一行，不手拼地圖連結。
function mapLinkHTML(lat, lng, name, mapAppLinksFn) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof mapAppLinksFn !== 'function') return '';
  var links = mapAppLinksFn(lat, lng, name) || [];
  if (!links.length) return '';
  return '<p class="poi-maplink">' + links.map(function (l) {
    return '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHTML(l.label) + '</a>';
  }).join('') + '</p>';
}

// category 可以是字串或字串陣列。用陣列是因為一張卡片常常同時要標好幾個維度：
// 英文名 + 價位（$$$）+ 難度（中等）+ 飲食（純素）。
// 這些**都不是 status**——status 只有 season／booking／free 三種，硬把價位塞進去
// 會讓「10/12 封路」跟「$$$」用同一個警示色，警示效果整個消失（真的發生過）。
function pillsHTML(category) {
  if (!category) return '';
  var list = Array.isArray(category) ? category : [category];
  return list.filter(Boolean).map(function (c) {
    return ' <span class="pill">' + escapeHTML(c) + '</span>';
  }).join('');
}

// 季節狀態標籤（conditional-features.md#season-status）。三種 kind 用不同顏色，
// 「季末／封路」必須跟「須提前訂」「免費」一眼分得出來——那是這個標籤存在的理由。
// 曾經因為 poiCardHTML 不認 status，呼叫方把 label 塞進 category 硬渲染，
// 結果 15 個「10/12 封路」全部退化成中性小標籤，警示效果整個消失。
function statusHTML(st) {
  if (!st || !st.label) return '';
  var kind = (st.kind === 'season' || st.kind === 'booking' || st.kind === 'free') ? st.kind : 'free';
  return '<span class="status ' + kind + '">' + escapeHTML(st.label) + '</span>';
}

// it: { name, url, note, shop, category, status, lat, lng }
// sourceClass/sourceLabel：來源標籤（'highlight'+'精選' 或 'transit'+'行程途經'，見 engine-contract.md#poi-wall「分組標記」）
// distLabel：可選，附近推薦面板用（如 "190 m"），延伸推薦總覽不傳
function poiCardHTML(it, sourceClass, sourceLabel, distLabel, mapAppLinksFn) {
  return '<div class="hl-card poi-card"><span class="source-tag ' + escapeHTML(sourceClass) + '">' + escapeHTML(sourceLabel) + '</span>' +
    '<h4>' + linkOrText(it.name, it.url) +
    pillsHTML(it.category) +
    statusHTML(it.status) +
    (distLabel ? '<span class="dist-tag">' + escapeHTML(distLabel) + '</span>' : '') +
    '</h4>' +
    (it.shop ? '<p class="hl-shop">' + escapeHTML(it.shop) + '</p>' : '') +
    (it.note ? '<p>' + escapeHTML(it.note) + '</p>' : '') +
    mapLinkHTML(it.lat, it.lng, it.name, mapAppLinksFn) +
    '</div>';
}

// 版面行數固定 2（engine-contract.md#poi-wall「版面」），超過 2 項才需要滑動提示
var POI_GRID_ROWS = 2;
function scrollHintHTML(itemCount) {
  return itemCount > POI_GRID_ROWS ? '<p class="poi-scroll-hint">◂ 左右滑動檢視更多 ▸</p>' : '';
}

// 卡片牆容器的開標籤。**超過一欄時必須可鍵盤聚焦**——`overflow-x:auto` 的 div 預設
// 不可聚焦，只用鍵盤的人到不了可視範圍外的卡片（WCAG 2.1.1）。加 tabindex="0" 後
// 方向鍵就能原生捲動；role="group" + aria-label 讓螢幕閱讀器知道這是一組可捲動內容。
// 項目數 <= 版面列數（不需要捲動）時不加，避免製造多餘的 Tab 停留點。
function gridOpenTag(itemCount) {
  return itemCount > POI_GRID_ROWS
    ? '<div class="poi-grid" tabindex="0" role="group" aria-label="可左右捲動的卡片列表，共 ' + itemCount + ' 項">'
    : '<div class="poi-grid">';
}

// 延伸推薦總覽／「行程途經」分組用：單純把 items 渲染成卡片牆，不做距離排序或排除
function poiWallHTML(items, sourceClass, sourceLabel, mapAppLinksFn) {
  var list = items || [];
  if (!list.length) return '';
  var cards = list.map(function (it) {
    return poiCardHTML(it, sourceClass, sourceLabel, null, mapAppLinksFn);
  }).join('');
  return scrollHintHTML(list.length) + gridOpenTag(list.length) + cards + '</div>';
}

// 每站附近推薦面板用：按距離排序、排除跟該站同名的項目，可選記錄命中（供「行程途經」分組用）
// opts: { sourceClass, sourceLabel, hitStore, mapAppLinksFn }
function nearbyGridHTML(items, fromLat, fromLng, stopTitle, opts) {
  opts = opts || {};
  var tokens = titleTokens(stopTitle);
  var withDist = (items || [])
    .filter(function (it) { return typeof it.lat === 'number' && typeof it.lng === 'number'; })
    .filter(function (it) { return !matchesStopTitle(it.name, tokens, stopTitle) && !matchesStopTitle(it.shop, tokens, stopTitle); })
    .map(function (it) { return { it: it, dist: haversineMeters(fromLat, fromLng, it.lat, it.lng) }; })
    .sort(function (a, b) { return a.dist - b.dist; });
  if (opts.hitStore) {
    // 記錄命中過的 day.slots 項目，跨全部站點去重（一個地點只記一次），供延伸推薦「行程途經」分組使用
    withDist.forEach(function (row) {
      var key = normalizeName(row.it.name);
      if (key) opts.hitStore[key] = row.it;
    });
  }
  if (!withDist.length) return '<p class="muted">暫無座標資料。</p>';
  var cards = withDist.map(function (row) {
    return poiCardHTML(row.it, opts.sourceClass || 'highlight', opts.sourceLabel || '精選', formatDist(row.dist), opts.mapAppLinksFn);
  }).join('');
  return scrollHintHTML(withDist.length) + gridOpenTag(withDist.length) + cards + '</div>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHTML: escapeHTML,
    haversineMeters: haversineMeters,
    formatDist: formatDist,
    normalizeName: normalizeName,
    commonPrefixLen: commonPrefixLen,
    sameCore: sameCore,
    titleTokens: titleTokens,
    matchesStopTitle: matchesStopTitle,
    pillsHTML: pillsHTML,
    statusHTML: statusHTML,
    linkOrText: linkOrText,
    mapLinkHTML: mapLinkHTML,
    poiCardHTML: poiCardHTML,
    poiWallHTML: poiWallHTML,
    nearbyGridHTML: nearbyGridHTML,
  };
}
