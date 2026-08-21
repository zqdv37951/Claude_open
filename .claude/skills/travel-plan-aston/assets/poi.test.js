// assets/poi.js 的迴歸測試。純 Node、零依賴（只用內建 assert），CLI 直接跑：
//   node <skill目錄>/assets/poi.test.js
// 改 poi.js 時先跑這個，抓破壞性變更；跟 validate.js 一樣用 process.exit 傳結果給 CI/腳本判斷。

var assert = require('assert');
var poi = require('./poi.js');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('escapeHTML 轉義 XSS 關鍵字元', function () {
  assert.strictEqual(poi.escapeHTML('<script>a&b"c\'d</script>'),
    '&lt;script&gt;a&amp;b&quot;c&#39;d&lt;/script&gt;');
});

test('haversineMeters：同點距離為 0', function () {
  assert.strictEqual(poi.haversineMeters(51.0447, -114.0719, 51.0447, -114.0719), 0);
});

test('haversineMeters：已知距離量級正確（約 111km/度緯度）', function () {
  var d = poi.haversineMeters(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111195) < 100, '實際值: ' + d);
});

test('formatDist：<950m 用公尺、>=950m 用公里', function () {
  assert.strictEqual(poi.formatDist(190), '190 m');
  assert.strictEqual(poi.formatDist(1200), '1.2 km');
});

test('sameCore：寬鬆比對同地不同寫法', function () {
  assert.ok(poi.sameCore('片瀬東浜海岸', '片瀬東浜海水浴場'));
  assert.ok(poi.sameCore('Calgary Tower', 'Calgary Tower'));
  assert.ok(!poi.sameCore('Calgary Tower', 'Banff Gondola'));
  assert.ok(!poi.sameCore('', 'x'));
  assert.ok(!poi.sameCore(null, undefined));
});

test('titleTokens / matchesStopTitle：分隔符拆分與逐一比對', function () {
  var tokens = poi.titleTokens('魚見亭／とびっちょ');
  assert.ok(tokens.indexOf('魚見亭') !== -1);
  assert.ok(poi.matchesStopTitle('魚見亭', tokens, '魚見亭／とびっちょ'));
  assert.ok(!poi.matchesStopTitle('Calgary Tower', tokens, '魚見亭／とびっちょ'));
});

test('linkOrText：有 url 才包 <a>，沒有維持純文字，且轉義', function () {
  assert.strictEqual(poi.linkOrText('a<b', ''), 'a&lt;b');
  var withUrl = poi.linkOrText('測試', 'https://x.example.com');
  assert.ok(withUrl.indexOf('<a href="https://x.example.com"') === 0);
  assert.ok(withUrl.indexOf('target="_blank" rel="noopener"') !== -1);
});

test('mapLinkHTML：沒座標、沒傳函式、函式返回空陣列都不渲染', function () {
  var links = function () { return [{ label: 'G', url: 'https://g' }]; };
  assert.strictEqual(poi.mapLinkHTML(undefined, undefined, 'x', links), '');
  assert.strictEqual(poi.mapLinkHTML(1, 2, 'x', undefined), '');
  assert.strictEqual(poi.mapLinkHTML(1, 2, 'x', function () { return []; }), '');
});

test('mapLinkHTML：正常情況渲染出 class 與連結文字', function () {
  var links = function (lat, lng) { return [{ label: 'Google 地圖', url: 'https://maps/?q=' + lat + ',' + lng }]; };
  var out = poi.mapLinkHTML(1.5, 2.5, 'Test', links);
  assert.ok(out.indexOf('class="poi-maplink"') !== -1);
  assert.ok(out.indexOf('Google 地圖') !== -1);
  assert.ok(out.indexOf('1.5,2.5') !== -1);
});

test('poiCardHTML：來源標籤、XSS 轉義、可選欄位齊全時都渲染', function () {
  var links = function () { return [{ label: 'G', url: 'https://g' }]; };
  var card = poi.poiCardHTML(
    { name: '<script>evil()</script>', note: '備註', shop: '店家', category: '分類', lat: 1, lng: 2 },
    'highlight', '精選', '190 m', links
  );
  assert.ok(card.indexOf('<script>evil') === -1, 'name 未轉義，存在 XSS 風險');
  assert.ok(card.indexOf('class="source-tag highlight"') !== -1);
  assert.ok(card.indexOf('精選') !== -1);
  assert.ok(card.indexOf('190 m') !== -1);
  assert.ok(card.indexOf('店家') !== -1);
  assert.ok(card.indexOf('分類') !== -1);
  assert.ok(card.indexOf('poi-maplink') !== -1);
});

test('poiCardHTML：沒有 distLabel/note/shop/category/座標時對應片段都不出現', function () {
  var card = poi.poiCardHTML({ name: 'X', note: '' }, 'transit', '行程途經', null, undefined);
  assert.ok(card.indexOf('dist-tag') === -1);
  assert.ok(card.indexOf('hl-shop') === -1);
  assert.ok(card.indexOf('poi-maplink') === -1);
});

test('poiWallHTML：空清單返回空字串', function () {
  assert.strictEqual(poi.poiWallHTML([], 'highlight', '精選'), '');
  assert.strictEqual(poi.poiWallHTML(null, 'highlight', '精選'), '');
});

test('poiWallHTML：滾動提示閾值精確在 2/3 項之間切換', function () {
  var mk = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push({ name: 'item' + i });
    return arr;
  };
  assert.ok(poi.poiWallHTML(mk(2), 'highlight', '精選').indexOf('poi-scroll-hint') === -1, '2項不該有提示');
  assert.ok(poi.poiWallHTML(mk(3), 'highlight', '精選').indexOf('poi-scroll-hint') !== -1, '3項應該有提示');
});

test('poiWallHTML：卡片牆容器是 .poi-grid 且每項都帶來源標籤', function () {
  var out = poi.poiWallHTML([{ name: 'A' }, { name: 'B' }], 'transit', '行程途經');
  assert.ok(out.indexOf('class="poi-grid"') !== -1);
  assert.strictEqual((out.match(/source-tag transit/g) || []).length, 2);
});

test('nearbyGridHTML：按距離升序排序', function () {
  var pool = [
    { name: 'Far', lat: 52.0, lng: -115.0 },
    { name: 'Near', lat: 51.05, lng: -114.07 },
  ];
  var out = poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Stop', {});
  assert.ok(out.indexOf('Near') < out.indexOf('Far'), '應該按距離由近到遠排序');
});

test('nearbyGridHTML：排除跟目前站點同名（寬鬆比對）的項目', function () {
  var pool = [
    { name: 'Calgary Tower', lat: 51.0447, lng: -114.0719 },
    { name: 'Other Spot', lat: 51.05, lng: -114.08 },
  ];
  var out = poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Calgary Tower', {});
  assert.ok(out.indexOf('Other Spot') !== -1);
  assert.ok(out.indexOf('>Calgary Tower<') === -1, '不該推薦自己');
});

test('nearbyGridHTML：hitStore 記錄命中項目，跨呼叫累積去重', function () {
  var hitStore = {};
  var pool = [{ name: 'Shared Spot', lat: 51.05, lng: -114.08 }];
  poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Stop A', { hitStore: hitStore });
  poi.nearbyGridHTML(pool, 51.05, -114.09, 'Stop B', { hitStore: hitStore });
  assert.strictEqual(Object.keys(hitStore).length, 1, '同一地點兩次命中應該只記一次');
});

test('nearbyGridHTML：候選池為空或全被排除時給出提示文字', function () {
  var out = poi.nearbyGridHTML([], 51.0447, -114.0719, 'Stop', {});
  assert.ok(out.indexOf('暫無座標資料') !== -1);
});

// ---- 跑全部測試 ----

test('sameCore：拉丁字首巧合不該誤判成同一地點（迴歸）', function () {
  // 固定 4 字字首的舊規則會讓這幾組命中，後果是附近面板靜默漏掉整個站點
  assert.strictEqual(poi.sameCore('Lake Louise', 'Lake Minnewanka'), false);
  assert.strictEqual(poi.sameCore('The Bison', 'The Bridge'), false);
  assert.strictEqual(poi.sameCore('Banff Avenue', 'Banff Gondola'), false);
});

test('sameCore：同地不同命名尾詞仍要命中', function () {
  assert.strictEqual(poi.sameCore('片瀬東浜海岸', '片瀬東浜海水浴場'), true);
  assert.strictEqual(poi.sameCore('The Bison 餐廳', 'The Bison Restaurant'), true);
  assert.strictEqual(poi.sameCore('River Café', 'River Cafe'), true);
  assert.strictEqual(poi.sameCore('East Village / 和平橋', 'East Village / Peace Bridge'), true);
});

test('sameCore：太短的共同字首不算', function () {
  assert.strictEqual(poi.sameCore('弓河瀑布', '弓湖'), false);
  assert.strictEqual(poi.sameCore('班夫公園', '班夫大街'), false);
});


test('卡片牆超過版面列數時可鍵盤聚焦（WCAG 2.1.1）', function () {
  var mk = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({ name: 'i' + i }); return a; };
  var many = poi.poiWallHTML(mk(10), 'highlight', '精選');
  assert.ok(many.indexOf('tabindex="0"') !== -1, '需要橫向捲動時必須可聚焦，否則鍵盤到不了後面的卡片');
  assert.ok(many.indexOf('role="group"') !== -1);
  assert.ok(many.indexOf('aria-label="可左右捲動的卡片列表，共 10 項"') !== -1);
  // 不需要捲動時不加，避免多餘的 Tab 停留點
  var few = poi.poiWallHTML(mk(2), 'highlight', '精選');
  assert.ok(few.indexOf('tabindex') === -1, '不需捲動時不該加 tabindex');
});


test('poiCardHTML：status 依 kind 渲染成可區分的標籤', function () {
  var mk = function (kind) {
    return poi.poiCardHTML({ name: 'x', status: { label: '10/12 封路', kind: kind } }, 'highlight', '精選');
  };
  assert.ok(mk('season').indexOf('class="status season"') !== -1, '季末必須有自己的 kind class');
  assert.ok(mk('booking').indexOf('class="status booking"') !== -1);
  assert.ok(mk('free').indexOf('class="status free"') !== -1);
  // 未知 kind 要降級成 free，不能把不認識的字串直接寫進 class
  assert.ok(mk('bogus').indexOf('class="status free"') !== -1, '未知 kind 應降級為 free');
  // label 必須轉義
  var xss = poi.poiCardHTML({ name: 'x', status: { label: '<img src=x>', kind: 'season' } }, 'highlight', '精選');
  assert.ok(xss.indexOf('<img') === -1, 'status.label 未轉義，存在 XSS 風險');
  // 沒有 status 就不渲染
  assert.ok(poi.poiCardHTML({ name: 'x' }, 'highlight', '精選').indexOf('class="status') === -1);
});


test('poiCardHTML：category 可以是字串或陣列，多維度標籤各自一個 .pill', function () {
  var one = poi.poiCardHTML({ name: 'x', category: 'Eight' }, 'highlight', '精選');
  assert.strictEqual((one.match(/class="pill"/g) || []).length, 1);
  var many = poi.poiCardHTML({ name: 'x', category: ['Eight', '$$$', '須訂位'] }, 'highlight', '精選');
  assert.strictEqual((many.match(/class="pill"/g) || []).length, 3, '陣列每一項一個 pill');
  // 空值與 falsy 項目不該產生空標籤
  assert.strictEqual((poi.poiCardHTML({ name: 'x', category: ['a', '', null] }, 'highlight', '精選')
    .match(/class="pill"/g) || []).length, 1);
  assert.ok(poi.poiCardHTML({ name: 'x', category: ['<img src=y>'] }, 'highlight', '精選').indexOf('<img') === -1,
    'category 未轉義，存在 XSS 風險');
});

var failed = 0;
tests.forEach(function (t) {
  try {
    t.fn();
    console.log('  ok - ' + t.name);
  } catch (e) {
    failed += 1;
    console.error('  FAIL - ' + t.name);
    console.error('    ' + (e && e.message ? e.message : e));
  }
});
console.log('');
if (failed) {
  console.error(failed + ' / ' + tests.length + ' 個測試失敗');
  process.exit(1);
} else {
  console.log('全部 ' + tests.length + ' 個測試通過');
  process.exit(0);
}
