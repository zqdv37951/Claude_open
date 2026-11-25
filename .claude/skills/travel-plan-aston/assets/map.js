// Leaflet 地圖引擎。純函式（buildNavLink/buildMapAppLinks/routeCoordinates/gcj02ToWgs84）可單元測試；
// initTravelMap 需瀏覽器 + Leaflet (L)。瀏覽器與 Node 雙用。

// HTML 轉義，防止 XSS
function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 生成跳轉手機地圖導航的連結。
// iOS 不識別 geo: scheme，用 Apple Maps 的 https 通用連結；其餘平臺用 geo:。
// ua 可選（瀏覽器裡傳 navigator.userAgent），不傳則回退 geo:。
function buildNavLink(lat, lng, label, ua) {
  if (ua && /iPhone|iPad|iPod/.test(ua)) {
    return 'https://maps.apple.com/?ll=' + lat + ',' + lng + '&q=' + encodeURIComponent(label);
  }
  return 'geo:' + lat + ',' + lng + '?q=' + lat + ',' + lng + '(' + encodeURIComponent(label) + ')';
}

// 常用地圖 App 的點位連結（免 key 的官方 URI 規範：高德 URI API、Google Maps URLs）。
// 這不是 page-contract 的 actionLink——不承載實時資料主張，只是"開啟地圖看這個點"。
//
// 【高德只在中國境內出現】境內 Google 地圖不可用、底圖座標系還會偏移，所以境內只給高德；
// 境外（日本、加拿大等）**只給 Google，不附高德**——讀者不會用它，多一個連結只是噪音。
// 不要「境外也順手加上高德」，那是本函式改過一次才拿掉的（見 engine-contract.md#map-links）。
//
// 【境外用「名稱 + 視野錨點」而不是純座標】純座標（?api=1&query=51.04,-114.05）在 Google 地圖上
// 只會顯示成一串度分秒，沒有店名、營業時間、評論、照片——而那才是讀者點開地圖想看的東西。
// /maps/search/<名稱>/@lat,lng,zoom 是 Google 自己 UI 產生的 URL 形式，且優雅降級：
// 名稱匹配得上就落在該地點卡片，匹配不上（如中文別名「硃砂湖日落」）也仍然落在正確座標的視野內。
// 注意：Google 內部的 place id（如 !1s0x53717aaa864fd43b:0x7609799479e4d20e、/g/11cmdqr136）
// 查不到也絕不能手拼——拼錯會指到完全不同的地方。要精準 place URL 只能由官方 skill 返回。
//
// 輸入座標一律 WGS-84：高德 URI 用 coordinate=wgs84 宣告由其換算，Google 本身即 WGS-84。
// isInMainlandChina 宣告在下方 GCJ 區塊（函式宣告有提升，此處可用）。
function buildMapAppLinks(lat, lng, label) {
  if (isInMainlandChina(lat, lng)) {
    return [{
      label: '高德地圖',
      url: 'https://uri.amap.com/marker?position=' + lng + ',' + lat
        + '&name=' + encodeURIComponent(label)
        + '&coordinate=wgs84&callnative=1&src=travel-plan-aston',
    }];
  }
  return [{
    label: 'Google 地圖',
    url: 'https://www.google.com/maps/search/' + encodeURIComponent(label)
      + '/@' + lat + ',' + lng + ',17z',
  }];
}

// —— GCJ-02 → WGS-84 座標轉換 ——
// 高德/騰訊地圖返回的座標是 GCJ-02（國測局加密），直接畫在 OSM（WGS-84）瓦片上
// 會偏移一百到幾百米。凡座標來自高德/騰訊類 skill，必須先經此函式轉換。
// 中國境外座標原樣返回（GCJ-02 僅在境內加偏）。
var GCJ_A = 6378245.0;
var GCJ_EE = 0.00669342162296594323;

// 「中國大陸境內」的判斷（決定要給高德還是 Google 連結、要不要做 GCJ-02 換算）。
// 舊版只用一個粗矩形（經度 72–137.83°E、緯度 0.83–55.83°N），那個矩形把日本西半部（廣島、大阪、京都、福岡）、
// 台灣、南北韓、菲律賓、越南……全框了進來：廣島的連結只剩高德、沒有 Google。矩形留著當快速預篩，
// 通過後再用下面這個「大陸輪廓」多邊形判斷。輪廓是簡化過的（頂點間隔數十到上百公里），
// 用途只是選連結供應商，不是行政邊界——**邊境線兩側各約 50 公里內可能判錯**，旅行頁面通常用不到那一帶。
// 不含：台灣、香港、澳門（Google 地圖可用；香港澳門的海岸線在輪廓裡只是近似）。海南島另列一塊。
// 頂點順序：[緯度, 經度]，從西北角起順時鐘。
var CN_MAINLAND = [
  [49.2, 87.4], [47.6, 90.2], [46.6, 91.0], [45.0, 91.0], [44.4, 95.3], [42.8, 96.8], [42.5, 100.0], [42.7, 103.0],
  [41.6, 105.0], [42.5, 109.5], [42.6, 111.0], [43.7, 112.0], [45.0, 113.7], [46.3, 116.0], [47.5, 119.0], [49.6, 117.5],
  [50.3, 119.3], [51.6, 120.0], [52.9, 121.7], [53.5, 123.6], [53.3, 124.0], [52.4, 126.0], [50.3, 127.5], [49.5, 129.5],
  [48.9, 130.7], [47.7, 132.5], [48.4, 134.7], [47.4, 134.2], [46.6, 133.9], [45.9, 133.0], [45.0, 132.5], [44.4, 131.4],
  [43.0, 130.7], [42.5, 130.4], [42.0, 129.2], [41.7, 128.2], [41.4, 126.5], [40.5, 125.5], [39.9, 124.3],
  [39.5, 123.0], [38.9, 122.0], [38.7, 121.1], [39.6, 121.3], [40.6, 122.0], [40.8, 121.1], [39.9, 119.6], [39.0, 117.8],
  [37.7, 119.0], [37.3, 119.9], [37.4, 122.7], [36.9, 122.5], [36.0, 120.9], [35.4, 119.6], [34.6, 119.4], [33.5, 120.5],
  [32.0, 121.9], [31.0, 122.0], [30.0, 121.9], [29.0, 121.9], [27.2, 120.7], [26.4, 120.0], [25.9, 119.7], [25.3, 119.2], [24.7, 118.6], [24.4, 118.2],
  [23.5, 117.2], [22.8, 115.5], [22.5, 114.4], [22.45, 114.3], [22.45, 113.9], [22.1, 113.5], [21.9, 113.0], [21.6, 111.9],
  [21.4, 111.0], [20.9, 110.8], [20.2, 110.2], [21.2, 110.4], [21.3, 109.6], [21.3, 108.6], [21.55, 108.0],
  [22.2, 107.5], [22.0, 106.7], [22.8, 106.0], [23.3, 105.3], [22.7, 104.4], [22.5, 103.9], [22.5, 103.0], [22.2, 102.2],
  [21.2, 101.7], [21.2, 100.1], [22.0, 99.2], [23.2, 98.9], [24.0, 97.6], [25.3, 97.6], [26.0, 98.7], [27.7, 98.7],
  [28.0, 97.3], [28.5, 96.2], [28.2, 94.0], [27.8, 92.6], [27.7, 91.7], [28.3, 90.5], [27.9, 88.9], [28.0, 87.0],
  [28.2, 86.0], [28.5, 85.0], [29.2, 83.9], [30.0, 81.5], [30.8, 79.0], [32.5, 78.7], [34.9, 78.6], [35.5, 78.0],
  [35.5, 77.0], [36.1, 75.5], [36.85, 75.4], [37.3, 74.9], [38.4, 74.9], [39.2, 73.7], [39.7, 73.6], [40.3, 74.8],
  [40.5, 75.7], [41.0, 77.5], [42.2, 80.2], [43.0, 80.3], [44.2, 80.4], [45.2, 82.5], [46.8, 83.0], [47.1, 85.5],
  [48.2, 86.6]
];
var CN_HAINAN = [[20.2, 110.0], [20.2, 111.0], [19.2, 111.0], [18.3, 110.0], [18.1, 109.5], [18.6, 108.6], [19.7, 108.6]];

// 射線法：點在多邊形內（頂點是 [緯度, 經度]）。
function pointInPolygon(lat, lng, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var yi = poly[i][0], xi = poly[i][1], yj = poly[j][0], xj = poly[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function isInMainlandChina(lat, lng) {
  if (!(lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271)) return false;   // 快速預篩
  return pointInPolygon(lat, lng, CN_MAINLAND) || pointInPolygon(lat, lng, CN_HAINAN);
}

// 舊名稱。保留是因為它已經被內聯進多份既有頁面，也出現在舊版文件裡；行為已改成上面的大陸輪廓判斷。
function isInChinaBBox(lat, lng) { return isInMainlandChina(lat, lng); }

function gcjTransformLat(x, y) {
  var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function gcjTransformLng(x, y) {
  var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

function gcj02ToWgs84(lat, lng) {
  if (!isInMainlandChina(lat, lng)) return { lat: lat, lng: lng };
  var dLat = gcjTransformLat(lng - 105.0, lat - 35.0);
  var dLng = gcjTransformLng(lng - 105.0, lat - 35.0);
  var radLat = lat / 180.0 * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { lat: lat - dLat, lng: lng - dLng };
}

// 從有序點位提取 [lat,lng] 陣列，用於連線
function routeCoordinates(points) {
  return (points || []).map(function (p) { return [p.lat, p.lng]; });
}

// 初始化地圖：編號 divIcon 標記、按序虛線路線、點選彈出 名稱+時間+導航連結。
// elementId: 容器 id；points: [{lat, lng, name, time}]（按行程順序，座標須為 WGS-84）
// opts 可選：{ tileUrl, attribution } 替換預設 OSM 瓦片源（如 OSM 訪問不穩時換映象）。
function initTravelMap(elementId, points, opts) {
  opts = opts || {};
  var map = L.map(elementId);
  L.tileLayer(opts.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: opts.attribution || '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  points.forEach(function (p, i) {
    var icon = L.divIcon({
      className: 'route-pin',
      html: '<span class="route-pin__num">' + (i + 1) + '</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    var navLinks = [{ label: '導航', url: buildNavLink(p.lat, p.lng, p.name, ua) }]
      .concat(buildMapAppLinks(p.lat, p.lng, p.name));
    L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(
      '<b>' + (i + 1) + '. ' + escapeHTML(p.name) + '</b><br>'
      + (p.time ? escapeHTML(p.time) + '<br>' : '')
      + navLinks.map(function (l) {
          return '<a href="' + l.url + '">' + escapeHTML(l.label) + '</a>';
        }).join(' · ')
    );
  });

  var coords = routeCoordinates(points);
  if (coords.length > 1) {
    L.polyline(coords, { dashArray: '6 8', weight: 2 }).addTo(map);
  }
  map.fitBounds(coords.length ? coords : [[0, 0]], { padding: [30, 30] });
  return map;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildNavLink: buildNavLink,
    buildMapAppLinks: buildMapAppLinks,
    routeCoordinates: routeCoordinates,
    gcj02ToWgs84: gcj02ToWgs84,
    isInMainlandChina: isInMainlandChina,
    initTravelMap: initTravelMap,
  };
}
