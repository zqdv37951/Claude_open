// POI 卡片墙引擎：延伸推荐总览（trip-extras.md 第2节）与每站附近推荐面板（第3节）共用的纯函数。
// 浏览器与 Node 双用。刻意不 require map.js/reminders.js（引擎文件互相独立，故意不合并去重，
// 维护时保持这个边界）——需要 map.js 的 buildMapAppLinks 时由调用方显式传入。

// HTML 转义，防止 XSS（与 map.js/reminders.js 各自一份，属故意重复，见 page-contract.md）
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

// 同一地点常有不同写法（如「片瀬東浜海岸」vs「片瀬東浜海水浴場」），用宽松比对而非精确相等
function normalizeName(s) {
  return String(s || '').replace(/[（）()／/・\s]/g, '');
}
function sameCore(a, b) {
  if (!a || !b) return false;
  var na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb || na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) return true;
  var n = Math.min(4, na.length, nb.length);
  return n >= 3 && na.slice(0, n) === nb.slice(0, n); // 前缀比对，兜住同地不同命名尾词的情况
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

// mapAppLinksFn：调用方传入 map.js 的 buildMapAppLinks（不在这里 require，保持引擎文件互相独立）。
// 没有坐标或没传函式就不渲染这一行，不手拼地图连结。
function mapLinkHTML(lat, lng, name, mapAppLinksFn) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof mapAppLinksFn !== 'function') return '';
  var links = mapAppLinksFn(lat, lng, name) || [];
  if (!links.length) return '';
  return '<p class="poi-maplink">' + links.map(function (l) {
    return '<a href="' + l.url + '" target="_blank" rel="noopener">' + escapeHTML(l.label) + '</a>';
  }).join('') + '</p>';
}

// it: { name, url, note, shop, category, lat, lng }
// sourceClass/sourceLabel：来源标签（'highlight'+'精選' 或 'transit'+'行程途經'，见 trip-extras.md 第2节「分组标记」）
// distLabel：可选，附近推荐面板用（如 "190 m"），延伸推荐总览不传
function poiCardHTML(it, sourceClass, sourceLabel, distLabel, mapAppLinksFn) {
  return '<div class="hl-card poi-card"><span class="source-tag ' + escapeHTML(sourceClass) + '">' + escapeHTML(sourceLabel) + '</span>' +
    '<h4>' + linkOrText(it.name, it.url) +
    (it.category ? ' <span class="pill">' + escapeHTML(it.category) + '</span>' : '') +
    (distLabel ? '<span class="dist-tag">' + escapeHTML(distLabel) + '</span>' : '') +
    '</h4>' +
    (it.shop ? '<p class="hl-shop">' + escapeHTML(it.shop) + '</p>' : '') +
    (it.note ? '<p>' + escapeHTML(it.note) + '</p>' : '') +
    mapLinkHTML(it.lat, it.lng, it.name, mapAppLinksFn) +
    '</div>';
}

// 版面行数固定 2（trip-extras.md 第2节「版面」），超过 2 项才需要滑动提示
var POI_GRID_ROWS = 2;
function scrollHintHTML(itemCount) {
  return itemCount > POI_GRID_ROWS ? '<p class="poi-scroll-hint">◂ 左右滑動查看更多 ▸</p>' : '';
}

// 延伸推荐总览／「行程途经」分组用：单纯把 items 渲染成卡片墙，不做距离排序或排除
function poiWallHTML(items, sourceClass, sourceLabel, mapAppLinksFn) {
  var list = items || [];
  if (!list.length) return '';
  var cards = list.map(function (it) {
    return poiCardHTML(it, sourceClass, sourceLabel, null, mapAppLinksFn);
  }).join('');
  return scrollHintHTML(list.length) + '<div class="poi-grid">' + cards + '</div>';
}

// 每站附近推荐面板用：按距离排序、排除跟该站同名的项目，可选记录命中（供「行程途经」分组用）
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
    // 记录命中过的 day.slots 项目，跨全部站点去重（一个地点只记一次），供延伸推荐「行程途经」分组使用
    withDist.forEach(function (row) {
      var key = normalizeName(row.it.name);
      if (key) opts.hitStore[key] = row.it;
    });
  }
  if (!withDist.length) return '<p class="muted">暫無座標資料。</p>';
  var cards = withDist.map(function (row) {
    return poiCardHTML(row.it, opts.sourceClass || 'highlight', opts.sourceLabel || '精選', formatDist(row.dist), opts.mapAppLinksFn);
  }).join('');
  return scrollHintHTML(withDist.length) + '<div class="poi-grid">' + cards + '</div>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHTML: escapeHTML,
    haversineMeters: haversineMeters,
    formatDist: formatDist,
    normalizeName: normalizeName,
    sameCore: sameCore,
    titleTokens: titleTokens,
    matchesStopTitle: matchesStopTitle,
    linkOrText: linkOrText,
    mapLinkHTML: mapLinkHTML,
    poiCardHTML: poiCardHTML,
    poiWallHTML: poiWallHTML,
    nearbyGridHTML: nearbyGridHTML,
  };
}
