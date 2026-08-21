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
// isInChinaBBox 宣告在下方 GCJ 區塊（函式宣告有提升，此處可用）。
function buildMapAppLinks(lat, lng, label) {
  if (isInChinaBBox(lat, lng)) {
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

function isInChinaBBox(lat, lng) {
  return lng >= 72.004 && lng <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
}

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
  if (!isInChinaBBox(lat, lng)) return { lat: lat, lng: lng };
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
    initTravelMap: initTravelMap,
  };
}
