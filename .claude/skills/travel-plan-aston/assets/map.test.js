// assets/map.js 的迴歸測試。純 Node、零依賴（只用內建 assert），CLI 直接跑：
//   node <skill目錄>/assets/map.test.js
// map.js 被所有產出頁面共用，改動前先跑這個。
// 重點守著兩件曾經改錯／容易改錯的事：① 高德只在中國境內出現；
// ② 境外的 Google 連結必須是「名稱 + 視野錨點」而不是純座標（純座標只顯示成度分秒）。

var assert = require('assert');
var map = require('./map.js');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ── buildMapAppLinks：境內／境外分流 ──
test('buildMapAppLinks：中國境內只給高德，不給 Google', function () {
  var links = map.buildMapAppLinks(31.2397, 121.4900, '外灘');   // 上海
  assert.strictEqual(links.length, 1, '境內應只有一個連結');
  assert.strictEqual(links[0].label, '高德地圖');
  assert.ok(links[0].url.indexOf('uri.amap.com') !== -1);
  assert.ok(links[0].url.indexOf('coordinate=wgs84') !== -1, '必須宣告 wgs84 讓高德自己換算');
});

test('buildMapAppLinks：境外只給 Google，不附高德', function () {
  [[51.0453, -114.0553, '加拿大'], [35.7148, 139.7967, '日本'], [40.7580, -73.9855, '美國']]
    .forEach(function (c) {
      var links = map.buildMapAppLinks(c[0], c[1], c[2]);
      assert.strictEqual(links.length, 1, c[2] + '：境外應只有一個連結');
      assert.strictEqual(links[0].label, 'Google 地圖');
      assert.ok(links[0].url.indexOf('amap') === -1, c[2] + '：境外不該出現高德');
    });
});

test('buildMapAppLinks：境外用「名稱 + 視野錨點」而非純座標', function () {
  var url = map.buildMapAppLinks(51.0453, -114.0553, 'Studio Bell')[0].url;
  assert.ok(url.indexOf('/maps/search/') !== -1, '要用 search 形式');
  assert.ok(url.indexOf(encodeURIComponent('Studio Bell')) !== -1, '名稱必須進 URL');
  assert.ok(url.indexOf('@51.0453,-114.0553,') !== -1, '座標必須當視野錨點');
  // 純座標式（?api=1&query=lat,lng）是被淘汰的寫法，Google 只會顯示成度分秒
  assert.ok(url.indexOf('query=51.0453%2C-114.0553') === -1, '不該退回純座標查詢');
  assert.ok(url.indexOf('query=51.0453,-114.0553') === -1, '不該退回純座標查詢');
});

test('buildMapAppLinks：名稱含空白與非 ASCII 都要正確編碼', function () {
  var url = map.buildMapAppLinks(51.1781, -115.5989, '硃砂湖 日落')[0].url;
  assert.ok(url.indexOf(' ') === -1, 'URL 不該有裸空白');
  assert.ok(url.indexOf(encodeURIComponent('硃砂湖 日落')) !== -1);
});

// ── buildNavLink：裝置原生導航 ──
test('buildNavLink：iOS 給 Apple Maps，其餘給 geo:', function () {
  var ios = map.buildNavLink(51.1, -115.5, '班夫', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
  assert.ok(ios.indexOf('maps.apple.com') === 0 || ios.indexOf('https://maps.apple.com') === 0);
  var other = map.buildNavLink(51.1, -115.5, '班夫', 'Mozilla/5.0 (Windows NT 10.0)');
  assert.ok(other.indexOf('geo:51.1,-115.5') === 0);
  assert.ok(map.buildNavLink(51.1, -115.5, '班夫', '').indexOf('geo:') === 0, 'UA 為空要降級成 geo:');
});

// ── isInMainlandChina：大陸境內判斷（舊版粗矩形把日本西部、台灣、南北韓都框成「中國境內」） ──
// 回歸：廣島（132.5°E）、大阪、京都、福岡都落在舊矩形內，連結只剩高德、沒有 Google。
test('isInMainlandChina：日本、台灣、韓國等鄰近地區判為境外（舊矩形會誤判成境內）', function () {
  var outside = {
    廣島: [34.39, 132.46], 大阪: [34.69, 135.50], 京都: [35.01, 135.77], 福岡: [33.59, 130.40], 長崎: [32.75, 129.88],
    名古屋: [35.18, 136.91], 那霸: [26.21, 127.68], 首爾: [37.57, 126.98], 釜山: [35.18, 129.07], 濟州: [33.50, 126.53],
    台北: [25.03, 121.57], 台中: [24.15, 120.67], 高雄: [22.63, 120.30], 平壤: [39.02, 125.75], 海參崴: [43.12, 131.89],
    哈巴羅夫斯克: [48.48, 135.08], 烏蘭巴托: [47.92, 106.92], 河內: [21.03, 105.85], 馬尼拉: [14.60, 120.98],
    曼谷: [13.75, 100.50], 加德滿都: [27.70, 85.32], 阿拉木圖: [43.25, 76.89], 比什凱克: [42.87, 74.59],
    東京: [35.68, 139.69], 札幌: [43.06, 141.35], 卡加利: [51.05, -114.06]
  };
  Object.keys(outside).forEach(function (k) {
    assert.strictEqual(map.isInMainlandChina(outside[k][0], outside[k][1]), false, k + ' 應判為境外');
  });
});

test('isInMainlandChina：大陸各地（含邊疆、東北、海南）判為境內', function () {
  var inside = {
    北京: [39.90, 116.40], 上海: [31.23, 121.47], 廣州: [23.13, 113.26], 深圳: [22.54, 114.06], 成都: [30.57, 104.07],
    西安: [34.34, 108.94], 烏魯木齊: [43.83, 87.62], 拉薩: [29.65, 91.12], 哈爾濱: [45.80, 126.53], 昆明: [25.04, 102.71],
    海口: [20.02, 110.35], 三亞: [18.25, 109.50], 大連: [38.91, 121.62], 青島: [36.07, 120.38], 廈門: [24.48, 118.09],
    喀什: [39.47, 75.99], 漠河: [52.97, 122.54], 黑河: [50.25, 127.49], 綏芬河: [44.40, 131.15], 琿春: [42.87, 130.37],
    丹東: [40.12, 124.39], 瑞麗: [24.00, 97.85], 北海: [21.48, 109.12], 敦煌: [40.14, 94.66], 伊寧: [43.92, 81.32]
  };
  Object.keys(inside).forEach(function (k) {
    assert.strictEqual(map.isInMainlandChina(inside[k][0], inside[k][1]), true, k + ' 應判為境內');
  });
});

test('buildMapAppLinks：廣島等日本西部地點只給 Google、不給高德（回歸）', function () {
  [[34.3853, 132.4553, '廣島'], [34.6937, 135.5023, '大阪'], [33.5902, 130.4017, '福岡']].forEach(function (c) {
    var links = map.buildMapAppLinks(c[0], c[1], c[2]);
    assert.strictEqual(links.length, 1, c[2] + '：應只有一個連結');
    assert.strictEqual(links[0].label, 'Google 地圖', c[2] + '：應是 Google 地圖');
    assert.ok(links[0].url.indexOf('amap') === -1, c[2] + '：不該出現高德');
  });
});

// ── gcj02ToWgs84：座標系轉換 ──
test('gcj02ToWgs84：中國境外座標原樣返回', function () {
  [[51.0453, -114.0553], [35.7148, 139.7967], [-33.8688, 151.2093], [34.3853, 132.4553], [25.0330, 121.5654]].forEach(function (c) {
    var r = map.gcj02ToWgs84(c[0], c[1]);
    assert.strictEqual(r.lat, c[0], '境外緯度不該被動');
    assert.strictEqual(r.lng, c[1], '境外經度不該被動');
  });
});

test('gcj02ToWgs84：中國境內座標會位移，量級在數百公尺內', function () {
  var lat = 39.9087, lng = 116.3975;                 // 天安門（GCJ-02）
  var r = map.gcj02ToWgs84(lat, lng);
  assert.notStrictEqual(r.lat, lat, '境內必須被換算');
  var dLat = Math.abs(r.lat - lat), dLng = Math.abs(r.lng - lng);
  // GCJ-02 偏移量約 0.001–0.006 度（百餘公尺到六百公尺），超出這個範圍代表算錯
  assert.ok(dLat > 0.0001 && dLat < 0.01, '緯度位移量級異常：' + dLat);
  assert.ok(dLng > 0.0001 && dLng < 0.01, '經度位移量級異常：' + dLng);
});

// ── routeCoordinates ──
test('routeCoordinates：轉成 Leaflet 的 [lat, lng] 陣列並保持順序', function () {
  assert.deepStrictEqual(
    map.routeCoordinates([{ lat: 1, lng: 2, name: 'a' }, { lat: 3, lng: 4, name: 'b' }]),
    [[1, 2], [3, 4]]);
  assert.deepStrictEqual(map.routeCoordinates([]), []);
});


// ── initTravelMap：用假 Leaflet 驗證它真的建了標記、路線與彈窗 ──
// 這是 map.js 唯一需要 DOM/Leaflet 的函式，用最小 mock 就能把它的契約釘住：
// 標記數 = 點數、編號從 1 連續、單點不畫折線、彈窗帶導航連結、名稱有轉義。
function makeLeafletMock() {
  var rec = { tileUrls: [], icons: [], markers: [], polylines: [], fitBounds: null, popups: [] };
  var chain = { addTo: function () { return this; }, bindPopup: function (h) { rec.popups.push(h); return this; } };
  global.L = {
    map: function () { return { fitBounds: function (c, o) { rec.fitBounds = { coords: c, opts: o }; } }; },
    tileLayer: function (url) { rec.tileUrls.push(url); return Object.create(chain); },
    divIcon: function (o) { rec.icons.push(o); return o; },
    marker: function (ll, o) { rec.markers.push({ ll: ll, icon: o && o.icon }); return Object.create(chain); },
    polyline: function (c, o) { rec.polylines.push({ coords: c, opts: o }); return Object.create(chain); },
  };
  return rec;
}
var PTS = [
  { lat: 51.0447, lng: -114.0719, name: '卡加利塔', time: '10/02 10:00' },
  { lat: 51.1745, lng: -115.5650, name: '班夫大街', time: '10/04 14:00' },
  { lat: 51.3217, lng: -116.1860, name: '夢蓮湖', time: '10/07 07:45' },
];

test('initTravelMap：標記數等於點數，編號從 1 連續且掛 route-pin', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', PTS);
  assert.strictEqual(rec.markers.length, PTS.length);
  rec.icons.forEach(function (ic, i) {
    assert.strictEqual(ic.className, 'route-pin', '標記必須用 route-pin（頁面靠它上樣式）');
    assert.ok(ic.html.indexOf('route-pin__num">' + (i + 1) + '<') !== -1, '編號應為 ' + (i + 1));
  });
  assert.deepStrictEqual(rec.markers[0].ll, [51.0447, -114.0719], '座標順序必須是 [lat, lng]');
});

test('initTravelMap：多點畫虛線折線，單點不畫', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', PTS);
  assert.strictEqual(rec.polylines.length, 1);
  assert.deepStrictEqual(rec.polylines[0].coords, [[51.0447, -114.0719], [51.1745, -115.565], [51.3217, -116.186]]);
  assert.ok(rec.polylines[0].opts.dashArray, '路線應為虛線');

  var rec1 = makeLeafletMock();
  map.initTravelMap('map', [PTS[0]]);
  assert.strictEqual(rec1.polylines.length, 0, '只有一個點不該畫折線');
});

test('initTravelMap：彈窗含序號、名稱、時間與導航連結', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', PTS);
  var p = rec.popups[2];
  assert.ok(p.indexOf('3. 夢蓮湖') !== -1, '彈窗要有序號與名稱');
  assert.ok(p.indexOf('10/07 07:45') !== -1, '彈窗要有時間');
  assert.ok(p.indexOf('geo:') !== -1 || p.indexOf('maps.apple.com') !== -1, '彈窗要有裝置導航連結');
  assert.ok(p.indexOf('google.com/maps') !== -1, '境外點彈窗要有 Google 連結');
  assert.ok(p.indexOf('amap') === -1, '境外點彈窗不該有高德');
});

test('initTravelMap：彈窗名稱有轉義，不會被注入', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', [{ lat: 51, lng: -114, name: '<img src=x onerror=alert(1)>', time: '' }]);
  assert.ok(rec.popups[0].indexOf('<img') === -1, '名稱未轉義，存在 XSS 風險');
  assert.ok(rec.popups[0].indexOf('&lt;img') !== -1);
});

test('initTravelMap：預設 OSM 圖磚，可用 opts.tileUrl 換源', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', PTS);
  assert.ok(rec.tileUrls[0].indexOf('tile.openstreetmap.org') !== -1);
  var rec2 = makeLeafletMock();
  map.initTravelMap('map', PTS, { tileUrl: 'https://mirror.example/{z}/{x}/{y}.png' });
  assert.strictEqual(rec2.tileUrls[0], 'https://mirror.example/{z}/{x}/{y}.png');
});

test('initTravelMap：以全部點位 fitBounds，空清單也不拋錯', function () {
  var rec = makeLeafletMock();
  map.initTravelMap('map', PTS);
  assert.strictEqual(rec.fitBounds.coords.length, 3);
  var rec2 = makeLeafletMock();
  map.initTravelMap('map', []);
  assert.ok(rec2.fitBounds, '空清單仍應呼叫 fitBounds（用預設值），不該拋錯');
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('  ok - ' + t.name); }
  catch (e) { failed += 1; console.error('  FAIL - ' + t.name); console.error('    ' + (e && e.message ? e.message : e)); }
});
console.log('');
if (failed) { console.error(failed + ' / ' + tests.length + ' 個測試失敗'); process.exit(1); }
console.log('全部 ' + tests.length + ' 個測試通過'); process.exit(0);
