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
  // trip-extras.md 第9节（条件式双方案）：用 trip.plans 时 days 分散在各 plan 里，
  // 先合并出一份供下面既有的 slot/坐标校验使用（Object.assign 产生新对象，不改动调用方传进来的 trip）。
  if (Array.isArray(trip.plans) && trip.plans.length) {
    var mergedDays = [];
    trip.plans.forEach(function (pl, i) {
      if (!pl.name) warnings.push('trip.plans[' + i + '] 缺 name');
      if (!Array.isArray(pl.days) || !pl.days.length) {
        errors.push('trip.plans[' + i + '] (' + (pl.name || '') + ') 缺 days——双方案要求两套都写完整逐日，不能只写差异');
      } else {
        mergedDays = mergedDays.concat(pl.days);
      }
    });
    if (!trip.plans.some(function (pl) { return pl.recommended; })) {
      warnings.push('trip.plans 没有任何一个标 recommended:true——双方案应明说推荐哪一套及理由');
    }
    trip = Object.assign({}, trip, {
      days: (Array.isArray(trip.days) && trip.days.length) ? trip.days : mergedDays
    });
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
    // trip-extras.md 第2节：跨多据点的大范围行程改用 regions 分组，每区各自给满三类。
    // 用了 regions 就不该再要求顶层的扁平 spots/food/shops，否则正确实现会被误判成漏做。
    if (Array.isArray(trip.highlights.regions) && trip.highlights.regions.length) {
      trip.highlights.regions.forEach(function (rg, i) {
        var who = 'trip.highlights.regions[' + i + ']' + (rg.name ? '（' + rg.name + '）' : '');
        if (!rg.name) warnings.push(who + ' 缺 name');
        ['spots', 'food', 'shops'].forEach(function (key) {
          var arr = rg[key];
          if (!Array.isArray(arr) || arr.length < 10) {
            warnings.push(who + '.' + key + ' 少于10项（当前 ' + (arr ? arr.length : 0)
              + ' 项），trip-extras.md 第2节要求分组后每区三类各至少10项');
          }
        });
      });
    } else {
      ['spots', 'food', 'shops'].forEach(function (key) {
        var arr = trip.highlights[key];
        if (!Array.isArray(arr) || arr.length < 10) {
          warnings.push('trip.highlights.' + key + ' 少于10项（当前 ' + (arr ? arr.length : 0)
            + ' 项），trip-extras.md 第2节要求各分类至少10项');
        }
      });
    }
  }

  // trip-extras.md 第12节：url 存进 trip 前必须 html.unescape()。若资料里留着 &amp;，渲染时
  // escapeHTML 会再转一次，浏览器解出来的 href 变成字面的 "?api=1&amp;query=X"——参数名成了
  // amp;query，查询字串整个被忽略。这个 bug 不会报错、页面看起来完全正常，只有真的点下去才发现，
  // 曾经一次让某份行程页 84 个地图连结全数失效，所以列为 ERROR。
  var entityUrls = [];
  (function scanUrl(o) {
    if (o && typeof o === 'object') {
      if (Array.isArray(o)) { o.forEach(scanUrl); return; }
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (k === 'url' && typeof v === 'string' && /&(amp|lt|gt|quot|#39);/.test(v)) entityUrls.push(v);
        else scanUrl(v);
      });
    }
  })(trip);
  if (entityUrls.length) {
    errors.push('有 ' + entityUrls.length + ' 个 url 里残留 HTML 实体（如 &amp;），渲染时会被二次转义、'
      + '导致 query string 失效（trip-extras.md 第12节）。例：' + entityUrls[0].slice(0, 70));
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

  // trip-extras.md 第13节：非中日文语系的目的地，中文显示名（多半是译名或「抵達 XX 機場」这类动作
  // 描述）直接拿去 Google/高德搜必定落空，必须另给 mapQuery 放当地原文名。用坐标粗判目的地语系：
  // 东亚经纬度范围内（中日韩台）中文名本来就搜得到，不提示；范围外才检查。
  var cjkRe = /[一-鿿぀-ヿ]/;
  var eastAsia = lats.length && lats.every(function (v, i) {
    return v >= 20 && v <= 46 && lngs[i] >= 100 && lngs[i] <= 146;
  });
  if (!eastAsia) {
    var noMapQuery = [];
    trip.days.forEach(function (day) {
      (day.slots || []).forEach(function (s) {
        if (cjkRe.test(s.name || '') && !s.mapQuery) noMapQuery.push(s.name);
      });
    });
    if (noMapQuery.length) {
      warnings.push('境外行程有 ' + noMapQuery.length + ' 个中文名站点缺 mapQuery（当地原文名），'
        + '地图连结会拿译名去搜、多半找不到该地点（trip-extras.md 第13节）。例：'
        + noMapQuery.slice(0, 3).join('、'));
    }
  }

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
    // 用 POI_GRID_ROWS 这个内部实现细节当标记，不用 nearbyGridHTML/poiWallHTML 这类公开函数名——
    // 后者是 trip-extras.md 文档里写出来的调用约定，页面自己重刻一份同名函数也会命中、验不出「真的
    // 内联了 poi.js」；POI_GRID_ROWS 只存在于 poi.js 源码内部，没人会凭空重刻出一模一样的变量名。
    ['POI_GRID_ROWS', 'poi.js 引擎未完整内联（缺 POI_GRID_ROWS），延伸推荐/附近推荐可能是页面自己重刻的、不是真的内联 assets/poi.js（见 trip-extras.md 第2、3节）'],
  ];
  checks.forEach(function (c) {
    if (s.indexOf(c[0]) === -1) errors.push(c[1]);
  });
  // trip-extras.md 第8节：顶部 sticky tab 导览一律要做。用 .nav-in 当标记（第8节定死的 class）。
  if (s.indexOf('nav-in') === -1) {
    warnings.push('未见 "nav-in"，页顶 sticky tab 导览（trip-extras.md 第8节，一律适用）疑似漏做，请确认');
  }
  // 最常见的漏做：锚点跳转后标题被 sticky 条盖住，纯读代码看不出来，只有真的点一次才会发现。
  if (s.indexOf('sticky') !== -1 && s.indexOf('scroll-margin-top') === -1) {
    warnings.push('页面有 sticky 元素但未见 "scroll-margin-top"，锚点跳转后区块标题可能被导览条盖住（trip-extras.md 第8节），请确认');
  }
  // ---- 引擎输出的 class 是否有对应样式（trip-extras.md 第11节完整清单） ----
  // 三个引擎只输出语义 class，样式由页面负责。poi.js 那几个漏了一眼就看得出来；
  // map.js / reminders.js 那几个漏了「不会报错、只会安静地消失」——标记变成 28×28 透明 div，
  // .leaflet-marker-icon 数量还是对的，纯读代码与元素计数都抓不到。这里按「触发条件 → 必需 class」抽查。
  [
    ['initTravelMap',       'route-pin',      'error',   '地图编号标记会完全隐形（28×28 透明 div，元素数量正常但看不见）'],
    ['initTravelMap',       'route-pin__num', 'error',   '地图标记里的序号看不见'],
    ['renderChecklistHTML', 'todo-item',      'error',   '页顶待办清单退化成没有样式的裸 <li>'],
    ['renderChecklistHTML', 'todo-deadline',  'warning', '待办日期徽章混在正文里、看不出层级'],
    ['renderChecklistHTML', 'pretrip-todo',   'warning', '待办清单 <ul> 保留浏览器默认项目符号'],
    ['reminderBadgeHTML',   'reminder-badge', 'warning', '时间轴上的「建议提前N天订」徽章变裸文字'],
    ['poiWallHTML',         'hl-card',        'warning', 'POI 卡片少一层样式（poi.js 同时挂 .poi-card 与 .hl-card）'],
  ].forEach(function (row) {
    if (s.indexOf(row[0]) === -1) return;               // 该引擎没被用到就不检查
    if (s.indexOf('.' + row[1]) !== -1) return;         // 已有对应样式规则
    var msg = '页面调用了 ' + row[0] + ' 但 CSS 里没有 .' + row[1]
            + ' 规则 —— ' + row[3] + '（trip-extras.md 第11节完整清单）';
    if (row[2] === 'error') errors.push(msg); else warnings.push(msg);
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
    if ((hasCoordSlot || hasCoordHighlight) && s.split('buildMapAppLinks').length - 1 < 3) {
      // 不用带括号的 'buildMapAppLinks(' 匹配：poi.js 的 mapLinkHTML/poiCardHTML 是把 buildMapAppLinks
      // 当函数引用传进去（如 poiWallHTML(items, 'highlight', '精選', buildMapAppLinks)），源码里不会紧跟
      // 左括号，带括号匹配会在改用 poi.js 后把正确实现误判成漏做。至少 3 次：map.js 定义 1 次 +
      // initTravelMap 内部调用 1 次 + 延伸推荐/附近推荐至少一处把它传给 poi.js。
      warnings.push('延伸推荐卡片疑似未把 buildMapAppLinks 接上地图连结（trip-extras.md 第2节「标题连结＋地图连结」），请确认');
    }
    // 版面改版史：5 列 → 3 列 → 2 列（当前）。这里只认目前生效的 2 列写法；
    // 若之后再调整行数，记得同步这条字符串与 poi.js 的 POI_GRID_ROWS，不要留着旧数字继续通过校验。
    if (s.indexOf('.poi-grid') !== -1 && s.indexOf('repeat(2, auto)') === -1) {
      warnings.push('未见 "repeat(2, auto)"，延伸推荐/附近推荐卡片墙疑似不是 trip-extras.md 第2节规定的「2列横向卷动」版面，请确认');
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
    // 卡片墙超过 2 项（会溢出到第二栏、需要横向卷动）时，poi.js 的 poiWallHTML/nearbyGridHTML
    // 会自动带 poi-scroll-hint 提示；HTML 里没见到就代表滚动提示疑似被手动删掉或没用 poi.js。
    var hasWideCategory = ['spots', 'food', 'shops'].some(function (key) {
      return (trip.highlights[key] || []).length > 2;
    });
    if (hasWideCategory && s.indexOf('poi-scroll-hint') === -1) {
      warnings.push('highlights 有分类项目数 >2（会超出2列版面、需要横向卷动），但 HTML 里没见到 "poi-scroll-hint" 滚动提示，请确认（trip-extras.md 第2节「版面」）');
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
