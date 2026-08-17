// 契约机械校验引擎：trip 数据结构 + 生成的 HTML 是否符合 page-contract.md。
// 纯函数可单元测试；也可作 CLI 用（node validate.js <生成的.html>）。浏览器不需要它。
//
// 设计原则：只校验"机械可判定"的东西（字段缺失、坐标越界/离群、必需区块标记），
// 美学与文案质量不归它管。errors 必须修复；warnings 供人工判断。

// 校验 trip 数据结构，返回 { errors: [], warnings: [] }
function validateTrip(trip) {
  var errors = [];
  var warnings = [];
  if (!trip || typeof trip !== 'object') {
    return { errors: ['trip 不是对象'], warnings: [] };
  }
  if (!trip.title) errors.push('缺 trip.title');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.startDate || '')) {
    errors.push('trip.startDate 须为 YYYY-MM-DD，当前: ' + trip.startDate);
  }
  if (!trip.disclaimer || String(trip.disclaimer).length < 20) {
    errors.push('缺 trip.disclaimer（全覆盖免责声明）');
  }
  if (!trip.preTrip) warnings.push('缺 trip.preTrip（行前须知）');
  if (!trip.tips || !trip.tips.length) warnings.push('缺 trip.tips（全程贴士）');
  if (!trip.hotelAreas || !trip.hotelAreas.length) warnings.push('缺 trip.hotelAreas（片区酒店）');
  if (!trip.flights) warnings.push('缺 trip.flights（航班区）');

  // trip-extras.md 第2节：highlights 对所有行程都是无条件规则（不因单日/多日、国内/跨国而跳过），
  // 曾经因为没有机械检查而被整批漏掉一次，这里补上防线。
  if (!trip.highlights) {
    warnings.push('缺 trip.highlights（延伸推荐总览，trip-extras.md 第2节规定所有行程都要有）');
  } else {
    ['spots', 'food', 'shops'].forEach(function (key) {
      var arr = trip.highlights[key];
      if (!Array.isArray(arr) || arr.length < 10) {
        warnings.push('trip.highlights.' + key + ' 少于10项（当前 ' + (arr ? arr.length : 0)
          + ' 项），trip-extras.md 第2节要求各分类至少10项');
      }
    });
  }

  (trip.reminders || []).forEach(function (r, i) {
    if (!r.item || typeof r.leadDays !== 'number') {
      errors.push('reminders[' + i + '] 须含 item 与数字 leadDays');
    }
  });

  if (!Array.isArray(trip.days) || !trip.days.length) {
    errors.push('trip.days 缺失或为空');
    return { errors: errors, warnings: warnings };
  }

  var lats = [], lngs = [];
  trip.days.forEach(function (day, di) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) {
      errors.push('days[' + di + '].date 须为 YYYY-MM-DD');
    }
    (day.slots || []).forEach(function (s, si) {
      var at = 'days[' + di + '].slots[' + si + ']';
      if (!s.name) errors.push(at + ' 缺 name');
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
        errors.push(at + ' 缺数字 lat/lng');
        return;
      }
      // 越界通常是 lat/lng 写反（如 lat: 116.4）
      if (s.lat < -90 || s.lat > 90) errors.push(at + ' lat 越界（是否与 lng 写反？）: ' + s.lat);
      if (s.lng < -180 || s.lng > 180) errors.push(at + ' lng 越界: ' + s.lng);
      lats.push(s.lat); lngs.push(s.lng);
      if (s.needsBooking && typeof s.leadDays !== 'number') {
        errors.push(at + ' needsBooking 为 true 但缺数字 leadDays');
      }
    });
    if (!day.slots || !day.slots.length) warnings.push('days[' + di + '] 没有 slots');
  });

  // 离群检测：与中位数偏差 > 3°（约 300km）多半是查错城市/写错数量级
  function median(arr) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    return a[Math.floor(a.length / 2)];
  }
  if (lats.length >= 3) {
    var mLat = median(lats), mLng = median(lngs);
    trip.days.forEach(function (day, di) {
      (day.slots || []).forEach(function (s, si) {
        if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return;
        if (Math.abs(s.lat - mLat) > 3 || Math.abs(s.lng - mLng) > 3) {
          warnings.push('days[' + di + '].slots[' + si + '] "' + s.name
            + '" 坐标疑似离群（与行程中位点差 >3°），请核实: ' + s.lat + ',' + s.lng);
        }
      });
    });
  }
  return { errors: errors, warnings: warnings };
}

// 从生成的 HTML 中提取内嵌的 trip JSON（<script id="trip-data" type="application/json">）
// 返回 trip 对象；缺块或解析失败返回 null。
function extractTripData(html) {
  var m = String(html).match(/<script[^>]*id="trip-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

// 校验生成的 HTML 是否含契约必需的机械标记，返回 { errors, warnings }
function validateHTML(html) {
  var errors = [];
  var warnings = [];
  var s = String(html);
  var checks = [
    ['id="trip-data"', '缺内嵌 trip JSON（<script id="trip-data" type="application/json">）'],
    ['initTravelMap', '未调用 initTravelMap（交互地图）'],
    ['computeReminders', '未调用 computeReminders（提醒计算）'],
    ['renderChecklistHTML', '未调用 renderChecklistHTML（页顶待办清单）'],
    ['gcj02ToWgs84', 'map.js 引擎未完整内联（缺 gcj02ToWgs84）'],
  ];
  checks.forEach(function (c) {
    if (s.indexOf(c[0]) === -1) errors.push(c[1]);
  });
  if (!/leaflet/i.test(s)) errors.push('未引入 Leaflet CSS/JS');
  if (s.indexOf('@media') === -1) errors.push('缺响应式 @media 断点');
  if (s.indexOf('object-fit') === -1) warnings.push('未见 object-fit（图片防变形），请确认');
  if (s.indexOf('trip-data') !== -1 && !extractTripData(s)) {
    errors.push('trip-data 块存在但 JSON 解析失败');
  }
  var trip = extractTripData(s);
  if (trip && trip.disclaimer) {
    var probe = String(trip.disclaimer).slice(0, 15);
    // disclaimer 全文须出现在正文（不只藏在 JSON 里）：JSON 外应至少再出现一次。
    // 已知假警报：若页面用纯前端脚本在运行时才把 trip.disclaimer 写进 DOM
    // （如 el.innerHTML = trip.disclaimer），这段文字只有浏览器执行 JS 后才会出现，
    // 静态字符串扫描看不到、必定触发这条 warning——这种实现方式请改用浏览器
    // （或无头浏览器截图）实际打开页面确认免责声明有渲染出来，不用纠结这条 warning。
    var first = s.indexOf(probe);
    var second = s.indexOf(probe, first + 1);
    if (second === -1) warnings.push('免责声明疑似只在 trip-data JSON 里、未渲染进正文，请确认（前端脚本动态渲染时属已知假警报，见上方注释）');
  }

  // trip-extras.md 第2、3节：highlights 存在时，附近推荐 toggle 面板与每卡地图连结是无条件要做的渲染逻辑，
  // 这里做尽力而为的机械抽查（字符串扫描，抓不到全部情况，仅供人工复核参考）。
  if (trip && trip.highlights) {
    var hasCoordSlot = (trip.days || []).some(function (d) {
      return (d.slots || []).some(function (sl) { return typeof sl.lat === 'number' && typeof sl.lng === 'number'; });
    });
    if (hasCoordSlot && s.indexOf('nearby-toggle') === -1) {
      warnings.push('trip.highlights 存在且有带坐标的 slot，但 HTML 里没见到 "nearby-toggle"，附近推荐面板（trip-extras.md 第3节）疑似漏做，请确认');
    }
    var hasCoordHighlight = ['spots', 'food', 'shops'].some(function (key) {
      return (trip.highlights[key] || []).some(function (it) { return typeof it.lat === 'number' && typeof it.lng === 'number'; });
    });
    if ((hasCoordSlot || hasCoordHighlight) && s.split('buildMapAppLinks(').length - 1 < 3) {
      // 至少 3 次：map.js 里的函数定义 1 次 + initTravelMap 内部调用 1 次 + 延伸推荐卡片至少调用 1 次
      warnings.push('延伸推荐卡片疑似未逐一调用 buildMapAppLinks 生成地图连结（trip-extras.md 第2节「标题连结＋地图连结」），请确认');
    }
    // 版面改版史：曾经从「5列横向卷动」改成「3列横向卷动」，这里只认目前生效的 3 列写法；
    // 若之后再调整行数，记得同步这条字符串，不要留着旧数字继续通过校验。
    if (s.indexOf('.poi-grid') !== -1 && s.indexOf('repeat(3, auto)') === -1) {
      warnings.push('未见 "repeat(3, auto)"，延伸推荐/附近推荐卡片墙疑似不是 trip-extras.md 第2节规定的「3列横向卷动」版面，请确认');
    }
    if (hasCoordSlot && s.indexOf('nearby-toggle') !== -1 && s.indexOf('source-tag') === -1) {
      warnings.push('附近推荐面板存在，但 HTML 里没见到 "source-tag"，面板卡片疑似没标「精选／行程途经」来源标签（trip-extras.md 第2节「分组标记」第4点），请确认');
    }
    // 时间轴站点标题保底规则（trip-extras.md 第5节）：没有 url 的带坐标 slot 也要有地图连结兜底。
    var hasSlotWithoutUrl = (trip.days || []).some(function (d) {
      return (d.slots || []).some(function (sl) {
        return typeof sl.lat === 'number' && typeof sl.lng === 'number' && !sl.url;
      });
    });
    if (hasSlotWithoutUrl && s.indexOf('poi-maplink') === -1) {
      warnings.push('存在没有 url 的带坐标时间轴站点，但 HTML 里没见到 "poi-maplink"，这类站点标题疑似没有地图连结兜底可点（trip-extras.md 第5节），请确认');
    }
  }
  return { errors: errors, warnings: warnings };
}

// 一次跑全：HTML 标记 + 内嵌 trip 结构
function validateAll(html) {
  var h = validateHTML(html);
  var trip = extractTripData(html);
  if (trip) {
    var t = validateTrip(trip);
    h.errors = h.errors.concat(t.errors);
    h.warnings = h.warnings.concat(t.warnings);
  }
  return h;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateTrip: validateTrip,
    validateHTML: validateHTML,
    extractTripData: extractTripData,
    validateAll: validateAll,
  };
  // CLI: node validate.js <生成的.html>
  if (require.main === module) {
    var fs = require('fs');
    var file = process.argv[2];
    if (!file) { console.error('用法: node validate.js <生成的.html>'); process.exit(2); }
    var out = validateAll(fs.readFileSync(file, 'utf8'));
    out.errors.forEach(function (e) { console.error('✗ ERROR   ' + e); });
    out.warnings.forEach(function (w) { console.warn('! WARNING ' + w); });
    if (!out.errors.length) console.log('✓ 契约校验通过' + (out.warnings.length ? '（有 ' + out.warnings.length + ' 条 warning 请人工确认）' : ''));
    process.exit(out.errors.length ? 1 : 0);
  }
}
