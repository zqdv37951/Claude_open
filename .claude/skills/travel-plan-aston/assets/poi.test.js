// assets/poi.js 的回归测试。纯 Node、零依赖（只用内建 assert），CLI 直接跑：
//   node <skill目录>/assets/poi.test.js
// 改 poi.js 时先跑这个，抓破坏性变更；跟 validate.js 一样用 process.exit 传结果给 CI/脚本判断。

var assert = require('assert');
var poi = require('./poi.js');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('escapeHTML 转义 XSS 关键字符', function () {
  assert.strictEqual(poi.escapeHTML('<script>a&b"c\'d</script>'),
    '&lt;script&gt;a&amp;b&quot;c&#39;d&lt;/script&gt;');
});

test('haversineMeters：同点距离为 0', function () {
  assert.strictEqual(poi.haversineMeters(51.0447, -114.0719, 51.0447, -114.0719), 0);
});

test('haversineMeters：已知距离量级正确（约 111km/度纬度）', function () {
  var d = poi.haversineMeters(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111195) < 100, '实际值: ' + d);
});

test('formatDist：<950m 用公尺、>=950m 用公里', function () {
  assert.strictEqual(poi.formatDist(190), '190 m');
  assert.strictEqual(poi.formatDist(1200), '1.2 km');
});

test('sameCore：宽松比对同地不同写法', function () {
  assert.ok(poi.sameCore('片瀬東浜海岸', '片瀬東浜海水浴場'));
  assert.ok(poi.sameCore('Calgary Tower', 'Calgary Tower'));
  assert.ok(!poi.sameCore('Calgary Tower', 'Banff Gondola'));
  assert.ok(!poi.sameCore('', 'x'));
  assert.ok(!poi.sameCore(null, undefined));
});

test('titleTokens / matchesStopTitle：分隔符拆分与逐一比对', function () {
  var tokens = poi.titleTokens('魚見亭／とびっちょ');
  assert.ok(tokens.indexOf('魚見亭') !== -1);
  assert.ok(poi.matchesStopTitle('魚見亭', tokens, '魚見亭／とびっちょ'));
  assert.ok(!poi.matchesStopTitle('Calgary Tower', tokens, '魚見亭／とびっちょ'));
});

test('linkOrText：有 url 才包 <a>，没有维持纯文字，且转义', function () {
  assert.strictEqual(poi.linkOrText('a<b', ''), 'a&lt;b');
  var withUrl = poi.linkOrText('测试', 'https://x.example.com');
  assert.ok(withUrl.indexOf('<a href="https://x.example.com"') === 0);
  assert.ok(withUrl.indexOf('target="_blank" rel="noopener"') !== -1);
});

test('mapLinkHTML：没坐标、没传函式、函式返回空阵列都不渲染', function () {
  var links = function () { return [{ label: 'G', url: 'https://g' }]; };
  assert.strictEqual(poi.mapLinkHTML(undefined, undefined, 'x', links), '');
  assert.strictEqual(poi.mapLinkHTML(1, 2, 'x', undefined), '');
  assert.strictEqual(poi.mapLinkHTML(1, 2, 'x', function () { return []; }), '');
});

test('mapLinkHTML：正常情况渲染出 class 与连结文字', function () {
  var links = function (lat, lng) { return [{ label: 'Google 地圖', url: 'https://maps/?q=' + lat + ',' + lng }]; };
  var out = poi.mapLinkHTML(1.5, 2.5, 'Test', links);
  assert.ok(out.indexOf('class="poi-maplink"') !== -1);
  assert.ok(out.indexOf('Google 地圖') !== -1);
  assert.ok(out.indexOf('1.5,2.5') !== -1);
});

test('poiCardHTML：来源标签、XSS 转义、可选字段齐全时都渲染', function () {
  var links = function () { return [{ label: 'G', url: 'https://g' }]; };
  var card = poi.poiCardHTML(
    { name: '<script>evil()</script>', note: '备注', shop: '店家', category: '分类', lat: 1, lng: 2 },
    'highlight', '精選', '190 m', links
  );
  assert.ok(card.indexOf('<script>evil') === -1, 'name 未转义，存在 XSS 风险');
  assert.ok(card.indexOf('class="source-tag highlight"') !== -1);
  assert.ok(card.indexOf('精選') !== -1);
  assert.ok(card.indexOf('190 m') !== -1);
  assert.ok(card.indexOf('店家') !== -1);
  assert.ok(card.indexOf('分类') !== -1);
  assert.ok(card.indexOf('poi-maplink') !== -1);
});

test('poiCardHTML：没有 distLabel/note/shop/category/坐标时对应片段都不出现', function () {
  var card = poi.poiCardHTML({ name: 'X', note: '' }, 'transit', '行程途經', null, undefined);
  assert.ok(card.indexOf('dist-tag') === -1);
  assert.ok(card.indexOf('hl-shop') === -1);
  assert.ok(card.indexOf('poi-maplink') === -1);
});

test('poiCardHTML：地图搜索优先用 mapQuery（原文名），缺省才退回 name', function () {
  // 页面显示名常是译名或动作描述（「史蒂芬大道步行街」「抵達 YYC 機場」），拿它去 Google 搜必定落空，
  // 所以地图连结要用 mapQuery 里的当地原文名。见 trip-extras.md 第13节。
  var seen = [];
  var spy = function (lat, lng, name) { seen.push(name); return [{ label: 'G', url: 'https://g' }]; };
  poi.poiCardHTML({ name: '史蒂芬大道步行街', mapQuery: 'Stephen Avenue Walk', lat: 51, lng: -114 },
    'highlight', '精選', null, spy);
  assert.strictEqual(seen[0], 'Stephen Avenue Walk', '有 mapQuery 时应该用它去搜');
  poi.poiCardHTML({ name: '史蒂芬大道步行街', lat: 51, lng: -114 }, 'highlight', '精選', null, spy);
  assert.strictEqual(seen[1], '史蒂芬大道步行街', '没有 mapQuery 时退回 name');
});

test('poiWallHTML：空清单返回空字符串', function () {
  assert.strictEqual(poi.poiWallHTML([], 'highlight', '精選'), '');
  assert.strictEqual(poi.poiWallHTML(null, 'highlight', '精選'), '');
});

test('poiWallHTML：滚动提示阈值精确在 2/3 项之间切换', function () {
  var mk = function (n) {
    var arr = [];
    for (var i = 0; i < n; i++) arr.push({ name: 'item' + i });
    return arr;
  };
  assert.ok(poi.poiWallHTML(mk(2), 'highlight', '精選').indexOf('poi-scroll-hint') === -1, '2项不该有提示');
  assert.ok(poi.poiWallHTML(mk(3), 'highlight', '精選').indexOf('poi-scroll-hint') !== -1, '3项应该有提示');
});

test('poiWallHTML：卡片墙容器是 .poi-grid 且每项都带来源标签', function () {
  var out = poi.poiWallHTML([{ name: 'A' }, { name: 'B' }], 'transit', '行程途經');
  assert.ok(out.indexOf('class="poi-grid"') !== -1);
  assert.strictEqual((out.match(/source-tag transit/g) || []).length, 2);
});

test('nearbyGridHTML：按距离升序排序', function () {
  var pool = [
    { name: 'Far', lat: 52.0, lng: -115.0 },
    { name: 'Near', lat: 51.05, lng: -114.07 },
  ];
  var out = poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Stop', {});
  assert.ok(out.indexOf('Near') < out.indexOf('Far'), '应该按距离由近到远排序');
});

test('nearbyGridHTML：排除跟目前站点同名（宽松比对）的项目', function () {
  var pool = [
    { name: 'Calgary Tower', lat: 51.0447, lng: -114.0719 },
    { name: 'Other Spot', lat: 51.05, lng: -114.08 },
  ];
  var out = poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Calgary Tower', {});
  assert.ok(out.indexOf('Other Spot') !== -1);
  assert.ok(out.indexOf('>Calgary Tower<') === -1, '不该推荐自己');
});

test('nearbyGridHTML：hitStore 记录命中项目，跨调用累积去重', function () {
  var hitStore = {};
  var pool = [{ name: 'Shared Spot', lat: 51.05, lng: -114.08 }];
  poi.nearbyGridHTML(pool, 51.0447, -114.0719, 'Stop A', { hitStore: hitStore });
  poi.nearbyGridHTML(pool, 51.05, -114.09, 'Stop B', { hitStore: hitStore });
  assert.strictEqual(Object.keys(hitStore).length, 1, '同一地点两次命中应该只记一次');
});

test('nearbyGridHTML：候选池为空或全被排除时给出提示文字', function () {
  var out = poi.nearbyGridHTML([], 51.0447, -114.0719, 'Stop', {});
  assert.ok(out.indexOf('暫無座標資料') !== -1);
});

// ---- 跑全部测试 ----
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
  console.error(failed + ' / ' + tests.length + ' 个测试失败');
  process.exit(1);
} else {
  console.log('全部 ' + tests.length + ' 个测试通过');
  process.exit(0);
}
