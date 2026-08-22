// 契約機械校驗引擎：trip 資料結構 + 生成的 HTML 是否符合 page-contract.md。
// 純函式可單元測試；也可作 CLI 用（node validate.js <生成的.html>）。瀏覽器不需要它。
//
// 設計原則：只校驗"機械可判定"的東西（欄位缺失、座標越界/離群、必需區塊標記），
// 美學與文案質量不歸它管。errors 必須修復；warnings 供人工判斷。

// 校驗 trip 資料結構，返回 { errors: [], warnings: [] }

// 預訂欄位的共用校驗（page-contract.md#booking）。slot 與 route stop 共用同一組欄位，
// 所以抽成一個函式，不要在兩個地方各寫一份判斷——那正是規則會漂移的地方。
function checkBooking(o, at) {
  var out = { errors: [], warnings: [] };
  if (!o) return out;
  var KINDS = ['ticket', 'reserve', 'permit'];
  if (o.bookingKind && KINDS.indexOf(o.bookingKind) === -1) {
    out.errors.push(at + ' bookingKind 是 "' + o.bookingKind + '"，只能是 '
      + KINDS.join(' / ') + '（page-contract.md#booking）');
  }
  if (o.bookingUrl && !o.needsBooking) {
    out.errors.push(at + ' 有 bookingUrl 卻沒有 needsBooking:true —— 徽章不會渲染，'
      + '那個訂票連結等於白查（page-contract.md#booking）');
  }
  if (o.bookingUrl) {
    var m = String(o.bookingUrl).match(/^https?:\/\/[^/?#]+([/?#].*)?$/);
    var rest = (m && m[1]) ? m[1] : '/';
    if (rest === '/' || rest === '') {
      out.warnings.push(at + ' bookingUrl 指向網域首頁（' + o.bookingUrl + '）—— '
        + '契約要求的是「能真的下單的頁面」。查不到訂票頁時**留空比填首頁好**：'
        + '徽章會退化成不可點的標籤，仍有提醒作用，而首頁會讓讀者以為你查過了'
        + '（page-contract.md#booking）');
    }
  }
  return out;
}

function validateTrip(trip) {
  var errors = [];
  var warnings = [];
  if (!trip || typeof trip !== 'object') {
    return { errors: ['trip 不是物件'], warnings: [] };
  }
  // conditional-features.md#dual-plans（條件式雙方案）：用 trip.plans 時 days 分散在各 plan 裡，
  // 先合併出一份供下面既有的 slot/座標校驗使用（Object.assign 產生新物件，不改動呼叫方傳進來的 trip）。
  if (Array.isArray(trip.plans) && trip.plans.length) {
    var mergedDays = [];
    trip.plans.forEach(function (pl, i) {
      if (!pl.name) warnings.push('trip.plans[' + i + '] 缺 name');
      if (!Array.isArray(pl.days) || !pl.days.length) {
        errors.push('trip.plans[' + i + '] (' + (pl.name || '') + ') 缺 days——雙方案要求兩套都寫完整逐日，不能只寫差異');
      } else {
        mergedDays = mergedDays.concat(pl.days);
      }
    });
    var recN = trip.plans.filter(function (pl) { return pl.recommended; }).length;
    if (recN === 0) {
      warnings.push('trip.plans 沒有任何一個標 recommended:true —— 它決定地圖用哪一套站點，必須有且只有一個（conditional-features.md#dual-plans）');
    } else if (recN > 1) {
      // recommended 決定地圖顯示哪一套站點，多於一個時行為未定義（兩套疊在一起看不懂）
      errors.push('trip.plans 有 ' + recN + ' 個 recommended:true —— 必須有且只有一個'
        + '（它決定地圖用哪一套站點，見 conditional-features.md#dual-plans）');
    }
    trip = Object.assign({}, trip, {
      days: (Array.isArray(trip.days) && trip.days.length) ? trip.days : mergedDays
    });
  }

  if (!trip.title) errors.push('缺 trip.title');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.startDate || '')) {
    errors.push('trip.startDate 須為 YYYY-MM-DD，當前: ' + trip.startDate);
  }
  if (!trip.disclaimer || String(trip.disclaimer).length < 20) {
    errors.push('缺 trip.disclaimer（全覆蓋免責宣告）');
  }
  if (!trip.preTrip) warnings.push('缺 trip.preTrip（行前須知）—— 必需區塊第 2 條，見 page-contract.md#blocks');
  if (!trip.tips || !trip.tips.length) warnings.push('缺 trip.tips（全程貼士）—— 必需區塊第 9 條，見 page-contract.md#blocks');
  if (!trip.hotelAreas || !trip.hotelAreas.length) warnings.push('缺 trip.hotelAreas（片區酒店）—— 必需區塊第 4 條；不涉及住宿的行程請改用 conditional-features.md#transit');
  if (!trip.flights) warnings.push('缺 trip.flights（航班區）—— 必需區塊第 3 條；不涉及航班的行程請改用 conditional-features.md#transit');

  // page-contract.md#highlights：highlights 對所有行程都是無條件規則（不因單日/多日、國內/跨國而跳過），
  // 曾經因為沒有機械檢查而被整批漏掉一次，這裡補上防線。
  if (!trip.highlights) {
    warnings.push('缺 trip.highlights（延伸推薦總覽，page-contract.md#highlights 規定所有行程都要有）');
  } else {
    // page-contract.md#highlights：跨多據點的大範圍行程改用 regions 分組，每區各自給滿三類。
    // 用了 regions 就不該再要求頂層的扁平 spots/food/shops，否則正確實現會被誤判成漏做。
    if (Array.isArray(trip.highlights.regions) && trip.highlights.regions.length) {
      trip.highlights.regions.forEach(function (rg, i) {
        var who = 'trip.highlights.regions[' + i + ']' + (rg.name ? '（' + rg.name + '）' : '');
        if (!rg.name) warnings.push(who + ' 缺 name');
        ['spots', 'food', 'shops'].forEach(function (key) {
          var arr = rg[key];
          if (!Array.isArray(arr) || arr.length < 10) {
            warnings.push(who + '.' + key + ' 少於10項（當前 ' + (arr ? arr.length : 0)
              + ' 項），page-contract.md#highlights 要求分組後每區三類各至少10項');
          }
        });
      });
    } else {
      ['spots', 'food', 'shops'].forEach(function (key) {
        var arr = trip.highlights[key];
        if (!Array.isArray(arr) || arr.length < 10) {
          warnings.push('trip.highlights.' + key + ' 少於10項（當前 ' + (arr ? arr.length : 0)
            + ' 項），page-contract.md#highlights 要求各分類至少10項');
        }
      });
    }
  }

  // ── glossary 有資料就必須渲染，而且要用字典排版 ──
  // page-contract.md#glossary 規定用 <dl>/<dt>/<dd>，不要跟 highlights 的卡片樣式混用
  //（那是查閱型內容，排版應偏字典而非卡片網格）。這裡查「有資料卻沒渲染」與「用錯排版」。
  if (trip.glossary && (trip.glossary.groups || []).length) {
    var gcount = (trip.glossary.groups || []).reduce(function (n, g) { return n + (g.items || []).length; }, 0);
    if (!gcount) warnings.push('trip.glossary 有 groups 但裡面沒有任何詞條，等於空區塊 —— 補上詞條或整個移除 glossary（page-contract.md#glossary）');
  }

  // ── key 必須是 identifier-safe slug ──
  // plans[].key 與 highlights.regions[].key 會被串進 DOM id 與 URL 錨點
  // （面板 id、tab 導覽的 href="#rg-<key>"）。帶引號會讓屬性破格，帶空白或中文
  // 會讓錨點對不上——而且都是靜默失效，畫面上看不出來。逃逸解決不了這個問題：
  // id 與錨點必須字面相同才對得上，所以只能約束輸入。
  (function () {
    var SLUG = /^[a-z0-9-]+$/;
    (trip.plans || []).forEach(function (pl, i) {
      if (pl.key !== undefined && !SLUG.test(String(pl.key))) {
        errors.push('trip.plans[' + i + '].key = ' + JSON.stringify(pl.key)
          + ' 不符合 /^[a-z0-9-]+$/ —— 它會被串進 DOM id（page-contract.md#trip-data）');
      }
    });
    var rg = (trip.highlights && trip.highlights.regions) || [];
    rg.forEach(function (r, i) {
      if (r.key !== undefined && !SLUG.test(String(r.key))) {
        errors.push('trip.highlights.regions[' + i + '].key = ' + JSON.stringify(r.key)
          + ' 不符合 /^[a-z0-9-]+$/ —— 它會被串進 tab 導覽的錨點 href="#rg-<key>"');
      }
    });
  })();

  // ── trip-data 的字串不得含 markdown 強調記號 ──
  // 每個渲染器都會 escapeHTML，所以 **粗體** 會原樣印在畫面上變成「**粗體**」。
  // 寫資料的時候很容易照著文件的語氣打上去——本輪就打了兩次（一條待辦、一段導語）。
  // 這不會壞掉任何功能，只會讓頁面看起來像沒排版好，而且沒有任何機制會發現。
  (function () {
    var hits = [];
    (function walk(o, path) {
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) { walk(o[k], path + '.' + k); });
      } else if (typeof o === 'string' && /\*\*|__[^_]/.test(o)) {
        hits.push(path + '：«' + o.replace(/\s+/g, ' ').slice(0, 40) + '»');
      }
    })(trip, 'trip');
    if (hits.length) {
      warnings.push('trip-data 有 ' + hits.length + ' 個字串含 markdown 強調記號（** 或 __）—— '
        + '渲染時會被 escapeHTML 原樣印出，畫面上會看到字面星號。要強調就在渲染端包 <strong>，'
        + '不要寫在資料裡：' + hits.slice(0, 3).join('；'));
    }
  })();

  // ── url 不得含 &amp;（雙重轉義，曾經上線過）──
  // 從既有 HTML 解析出來的 url 帶著字面 &amp;，渲染時 escapeHTML 會再轉一次成 &amp;amp;，
  // 瀏覽器解回 &amp; 後 Google 收到的參數名是「amp;query」而不是「query」——沒有搜尋詞，
  // 連結直接開在使用者的所在位置。這個 bug 一次弄壞 84 條連結，而且頁面上看不出異常。
  // 修法見 page-contract.md#unescape。
  (function () {
    var bad = [];
    (function walk(o, path) {
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) { walk(o[k], path + '.' + k); });
      // 認任何以 url/Url/URL 結尾的欄位。原本只認小寫 .url，bookingUrl 這種
      // 駝峰命名的新欄位會靜默繞過——而它正是最需要這條檢查的欄位之一。
      } else if (typeof o === 'string' && /[uU][rR][lL]$/.test(path) && o.indexOf('&amp;') !== -1) {
        bad.push(path);
      }
    })(trip, 'trip');
    if (bad.length) {
      errors.push('有 ' + bad.length + ' 個 url 欄位含字面 "&amp;"（雙重轉義，連結會失效）：'
        + bad.slice(0, 4).join('、') + (bad.length > 4 ? ' …' : '')
        + ' —— 解析既有 HTML 後除 url 外的字串要反轉義，url 本身則要把 &amp; 還原成 &（page-contract.md#unescape）');
    }
  })();

  (trip.reminders || []).forEach(function (r, i) {
    if (!r.item || typeof r.leadDays !== 'number') {
      errors.push('reminders[' + i + '] 須含 item 與數字 leadDays');
    }
  });

  if (!Array.isArray(trip.days) || !trip.days.length) {
    errors.push('trip.days 缺失或為空');
    return { errors: errors, warnings: warnings };
  }

  var lats = [], lngs = [];
  trip.days.forEach(function (day, di) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) {
      errors.push('days[' + di + '].date 須為 YYYY-MM-DD');
    }
    (day.slots || []).forEach(function (s, si) {
      var at = 'days[' + di + '].slots[' + si + ']';
      if (!s.name) errors.push(at + ' 缺 name');
      if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
        errors.push(at + ' 缺數字 lat/lng');
        return;
      }
      // 越界通常是 lat/lng 寫反（如 lat: 116.4）
      if (s.lat < -90 || s.lat > 90) errors.push(at + ' lat 越界（是否與 lng 寫反？）: ' + s.lat);
      if (s.lng < -180 || s.lng > 180) errors.push(at + ' lng 越界: ' + s.lng);
      lats.push(s.lat); lngs.push(s.lng);
      if (s.needsBooking && typeof s.leadDays !== 'number') {
        errors.push(at + ' needsBooking 為 true 但缺數字 leadDays');
      }
      (function (r) { errors.push.apply(errors, r.errors); warnings.push.apply(warnings, r.warnings); })(checkBooking(s, at));
    });
    // 路線停靠點也吃同一組預訂欄位（page-contract.md#booking）。
    // 它們刻意沒有 lat/lng——是路線敘述裡的一站，不是地圖上的點——所以不能併進上面
    // 那個迴圈：那裡缺座標會 return，預訂欄位就整組驗不到。
    (day.routes || []).forEach(function (rt, ri) {
      (rt.stops || []).forEach(function (st, sti) {
        var rat = 'days[' + di + '].routes[' + ri + '].stops[' + sti + ']';
        if (!st.name) errors.push(rat + ' 缺 name');
        if (st.needsBooking && typeof st.leadDays !== 'number') {
          errors.push(rat + ' needsBooking 為 true 但缺數字 leadDays');
        }
        var rb = checkBooking(st, rat);
        errors.push.apply(errors, rb.errors);
        warnings.push.apply(warnings, rb.warnings);
      });
    });
    if (!day.slots || !day.slots.length) warnings.push('days[' + di + '] 沒有 slots');
  });

  // 離群檢測：與中位數偏差 > 3°（約 300km）多半是查錯城市/寫錯數量級
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
            + '" 座標疑似離群（與行程中位點差 >3°），請核實: ' + s.lat + ',' + s.lng);
        }
      });
    });
  }
  return { errors: errors, warnings: warnings };
}

// 從生成的 HTML 中提取內嵌的 trip JSON（<script id="trip-data" type="application/json">）
// 返回 trip 物件；缺塊或解析失敗返回 null。
function extractTripData(html) {
  var m = String(html).match(/<script[^>]*id="trip-data"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

// 校驗生成的 HTML 是否含契約必需的機械標記，返回 { errors, warnings }
function validateHTML(html) {
  var errors = [];
  var warnings = [];
  // notes = 第三種輸出：**不是問題**，只是「這份頁面的判定前提」。
  // 為什麼要分出來：原本「本檔是輔助頁」是一條 WARNING，於是每一份輔助頁跑完都是
  // 「通過（有 1 條 warning 請人工確認）」。永遠都在的警告等於沒有警告——它訓練人
  // 忽略整個警告區。要讓 WARNING 有意義，前提是「完全合規的頁面應該 0 條 warning」。
  var notes = [];
  var s = String(html);

  // 先分辨三種情況，訊息要說對，不然使用者會往錯的方向找問題：
  //  ① 根本不是 HTML（餵到 .txt / .md / JSON）→ 是餵錯檔案，報一串契約違規只會誤導。
  //  ② 是 HTML 片段（有標籤但缺 <html>/<body>）→ 檔案沒錯，是文件結構不完整。
  //     這不是雞蛋裡挑骨頭：沒有 <html> 就沒有 lang 屬性，螢幕閱讀器會用錯的語音引擎念中文
  //     （page-contract.md#a11y）。實際遇過兩個舊頁面是從 <title> 開頭的片段。
  //  ③ 完整文件 → 照常往下驗。
  var hasDoc = /<html[\s>]/i.test(s) || /<body[\s>]/i.test(s);
  var looksHtml = /<(title|div|style|script|p|h1|section)[\s>]/i.test(s);
  if (!hasDoc && !looksHtml) {
    return { errors: ['這個檔案不像 HTML（找不到任何 HTML 標籤）—— 請確認餵進來的是生成的 .html'],
             warnings: [], notHtml: true };
  }
  if (!hasDoc) {
    errors.push('缺 <html> 與 <body> —— 這是 HTML 片段而不是完整文件。'
      + '沒有 <html lang="zh-Hant"> 螢幕閱讀器會用錯誤的語音引擎念中文（page-contract.md#a11y）');
  } else if (!/<html[^>]+lang=/i.test(s)) {
    errors.push('<html> 沒有 lang 屬性 —— 螢幕閱讀器會用錯誤的語音引擎念中文（page-contract.md#a11y）');
  }

  // ---- 頁面型別偵測 ----
  // 本 skill 會產出兩種頁面：
  //  ① 行程頁（有內嵌 trip-data）——完整契約全套適用；
  //  ② 輔助頁（住宿規劃、比價、裝備清單這類單一主題的補充頁）——沒有 trip/地圖/提醒，
  //     硬套行程頁的必需區塊只會得到一串假 ERROR。
  // 曾經發生過：住宿規劃頁被這支腳本報 7 條 ERROR，全部是「它本來就不該有」的東西。
  // 必須認「實際的 script 開標籤」而不是裸的 id 屬性字串。
  // 踩過一次：頁面的錯誤提示文字裡含 &lt;script id="trip-data"&gt; 這串說明，
  // 裸子字串比對會被它騙到，把真的缺 trip-data 的頁面誤判成行程頁——
  // 於是「降級為輔助頁」那條警告不再出現，改成一條看不懂的「JSON 解析失敗」。
  var TRIPDATA_TAG = /<script[^>]+id="trip-data"/;
  var isTripPage = TRIPDATA_TAG.test(s);

  // trip 與 outside 只算一次，下面所有檢查共用。
  // 以前是各段自己呼叫 extractTripData（同一份 JSON 解析了 4 次）、各自剝一次 trip-data 區塊，
  // 結果「這頁有什麼」沒有單一來源——加新檢查時很容易忘了剝 JSON 而做出假陰性（發生過一次）。
  var trip = extractTripData(s);
  // outside = 把 trip-data 那塊 JSON 剝掉後的頁面。**凡是判斷「頁面有沒有渲染／有沒有樣式」
  // 的檢查一律用它，不要用整份 s。** 用 s 今天也不會出錯（trip-data 不會剛好含
  // nearby-toggle 這種字串），但那是運氣不是設計：只要哪天有個 note 寫進相關字眼，
  // 檢查就會被資料本身滿足而靜默失效——而那正是最難發現的一類 bug。
  // 判斷「某欄位有沒有被渲染」時必須用它：
  // 資料本身就含欄位名，不剝掉的話「有資料」會自我滿足「有渲染」。
  var outside = s.replace(/<script id="trip-data"[\s\S]*?<\/script>/, '');
  if (!isTripPage) {
    // 輔助頁只驗「不論哪種頁面都該成立」的那幾條：響應式、tab 導覽、單檔自包含、
    // 以及「用到哪個引擎就要有那個引擎的 class 樣式」（下方引擎 class 檢查會自己判斷）。
    notes.push('未內嵌 trip-data，按「輔助頁」校驗（page-contract.md#page-types）：已跳過地圖／提醒清單／trip 結構這些行程頁專屬的必需區塊。若這其實該是行程頁，那就是漏了內嵌 trip-data。');
  }

  var checks = isTripPage ? [
    ['id="trip-data"', '缺內嵌 trip JSON（<script id="trip-data" type="application/json">）'],
    ['initTravelMap', '未呼叫 initTravelMap（互動地圖）'],
    ['computeReminders', '未呼叫 computeReminders（提醒計算）'],
    ['renderChecklistHTML', '未呼叫 renderChecklistHTML（頁頂待辦清單）'],
    ['gcj02ToWgs84', 'map.js 引擎未完整內聯（缺 gcj02ToWgs84）'],
    // 用 POI_GRID_ROWS 這個內部實現細節當標記，不用 nearbyGridHTML/poiWallHTML 這類公開函式名——
    // 後者是 engine-contract.md 文件裡寫出來的呼叫約定，頁面自己重刻一份同名函式也會命中、驗不出「真的
    // 內聯了 poi.js」；POI_GRID_ROWS 只存在於 poi.js 原始碼內部，沒人會憑空重刻出一模一樣的變數名。
    ['POI_GRID_ROWS', 'poi.js 引擎未完整內聯（缺 POI_GRID_ROWS），延伸推薦/附近推薦可能是頁面自己重刻的、不是真的內聯 assets/poi.js（見 engine-contract.md#poi-wall）'],
  ] : [];
  checks.forEach(function (c) {
    if (s.indexOf(c[0]) === -1) errors.push(c[1]);
  });
  // page-contract.md#tab-nav：頂部 sticky tab 導覽一律要做。用 .nav-in 當標記（該節定死的 class）。
  if (outside.indexOf('nav-in') === -1) {
    warnings.push('未見 "nav-in"，頁頂 sticky tab 導覽（page-contract.md#tab-nav，一律適用）疑似漏做，請確認');
  }
  // 最常見的漏做：錨點跳轉後標題被 sticky 條蓋住，純讀程式碼看不出來，只有真的點一次才會發現。
  if (outside.indexOf('sticky') !== -1 && outside.indexOf('scroll-margin-top') === -1) {
    warnings.push('頁面有 sticky 元素但未見 "scroll-margin-top"，錨點跳轉後區塊標題可能被導覽條蓋住（page-contract.md#tab-nav），請確認');
  }
  // ---- 引擎輸出的 class 是否有對應樣式（engine-contract.md#engine-classes 完整清單） ----
  // 三個引擎只輸出語義 class，樣式由頁面負責。poi.js 那幾個漏了一眼就看得出來；
  // map.js / reminders.js 那幾個漏了「不會報錯、只會安靜地消失」——標記變成 28×28 透明 div，
  // .leaflet-marker-icon 數量還是對的，純讀程式碼與元素計數都抓不到。這裡按「觸發條件 → 必需 class」抽查。
  [
    ['initTravelMap',       'route-pin',      'error',   '地圖編號標記會完全隱形（28×28 透明 div，元素數量正常但看不見）'],
    ['initTravelMap',       'route-pin__num', 'error',   '地圖示記裡的序號看不見'],
    ['renderChecklistHTML', 'todo-item',      'error',   '頁頂待辦清單退化成沒有樣式的裸 <li>'],
    ['renderChecklistHTML', 'todo-deadline',  'warning', '待辦日期徽章混在正文裡、看不出層級'],
    ['renderChecklistHTML', 'pretrip-todo',   'warning', '待辦清單 <ul> 保留瀏覽器預設項目符號'],
    ['reminderBadgeHTML',   'reminder-badge', 'warning', '時間軸上的「建議提前N天訂」徽章變裸文字'],
    ['poiWallHTML',         'hl-card',        'warning', 'POI 卡片少一層樣式（poi.js 同時掛 .poi-card 與 .hl-card）'],
  ].forEach(function (row) {
    if (s.indexOf(row[0]) === -1) return;               // 該引擎沒被用到就不檢查
    if (s.indexOf('.' + row[1]) !== -1) return;         // 已有對應樣式規則
    var msg = '頁面呼叫了 ' + row[0] + ' 但 CSS 裡沒有 .' + row[1]
            + ' 規則 —— ' + row[3] + '（engine-contract.md#engine-classes 完整清單）';
    if (row[2] === 'error') errors.push(msg); else warnings.push(msg);
  });


  // ---- 有站點需要預訂，頁面就必須把徽章渲染出來（page-contract.md#booking）----
  // 這是「有給就必須渲染」那一類：資料標了 needsBooking 卻沒呼叫 reminderBadgeHTML，
  // 讀者在時間軸上完全看不到要訂票這件事——而頁面看起來一切正常，只是少了一個徽章。
  if (trip) {
    var bookDays = (trip.plans && trip.plans.length)
      ? trip.plans.reduce(function (a, pl) { return a.concat(pl.days || []); }, [])
      : (trip.days || []);
    var bookable = [];
    bookDays.forEach(function (d) {
      (d.slots || []).forEach(function (x) { if (x.needsBooking) bookable.push(x); });
      (d.routes || []).forEach(function (rt) {
        (rt.stops || []).forEach(function (x) { if (x.needsBooking) bookable.push(x); });
      });
    });
    // unverified 給了卻沒渲染，等於把「我沒驗到什麼」這件事留在資料裡沒人看見——
    // 而那正是這個欄位存在的唯一理由（page-contract.md#unverified）。
    if ((trip.unverified || []).length && outside.indexOf('unverified') === -1) {
      errors.push('trip.unverified 有 ' + trip.unverified.length + ' 條，但頁面沒有讀這個欄位 —— '
        + '「建置時驗不了的事」是必須渲染的區塊（page-contract.md#unverified）');
    }
    // 三個欄位缺一不可：只寫「這個沒驗證」等於把問題丟回給讀者
    (trip.unverified || []).forEach(function (u, ui) {
      ['item', 'why', 'how'].forEach(function (k) {
        if (!u[k]) {
          errors.push('unverified[' + ui + '] 缺 ' + k
            + ' —— why（為什麼驗不了）與 how（怎麼確認）缺任一條，讀者就得自己重新研究一遍'
            + '（page-contract.md#unverified）');
        }
      });
    });

    // 站點層級的 status 也是「有給就必須渲染」。契約允許 slot／route stop 帶 status
    // （page-contract.md#trip-data），但頁面很容易只在 POI 卡片上處理它——
    // 結果資料放得進去、時間軸上看不到，而且完全不報錯。這個洞是真的踩到過。
    var statusStops = [];
    bookDays.forEach(function (d) {
      (d.slots || []).forEach(function (x) { if (x.status && x.status.label) statusStops.push(x); });
      (d.routes || []).forEach(function (rt) {
        (rt.stops || []).forEach(function (x) { if (x.status && x.status.label) statusStops.push(x); });
      });
    });
    if (statusStops.length && outside.indexOf('statusHTML') === -1) {
      errors.push('有 ' + statusStops.length + ' 個時間軸站點帶 status，但頁面沒有呼叫 statusHTML —— '
        + '那些標籤（如「10/12 封路」）在畫面上完全看不到（conditional-features.md#season-status）');
    }
    if (bookable.length && outside.indexOf('reminderBadgeHTML') === -1) {
      errors.push('有 ' + bookable.length + ' 個站點標了 needsBooking，但頁面沒有呼叫 reminderBadgeHTML —— '
        + '時間軸上看不到「要先訂」這件事（page-contract.md#booking）');
    }
    var withUrl = bookable.filter(function (x) { return x.bookingUrl; }).length;
    if (bookable.length && withUrl === 0) {
      warnings.push('有 ' + bookable.length + ' 個站點標了 needsBooking，但一個 bookingUrl 都沒有 —— '
        + '徽章只會是不可點的標籤。查不到訂票頁是可以接受的答案，但全部都查不到通常代表這一步跳過了'
        + '（page-contract.md#booking）');
    }
  }

  // ---- 資料驅動的 class 樣式核對（engine-contract.md#engine-classes）----
  // 上面那張抽查表只涵蓋 7 個高風險 class。剩下的一半漏了照樣不會報錯，
  // 而 engine-contract 原本 publish 的自查腳本用正則掃引擎原始碼的 class="..."，
  // **抓不到拼接出來的 class**——poi.js 寫的是 class="source-tag ' + sourceClass + '"，
  // 所以 source-tag / highlight / transit / status / season / booking / free 這 7 個
  // 從來沒被那支腳本看過，它卻回報「缺樣式的 class: 無」。
  // **檢查通過但沒檢查到，比沒有檢查更糟**——它給人被守著的錯覺。
  //
  // 這裡改成「看資料決定要求什麼」：卡片上會不會出現 .pill，取決於 trip 裡有沒有
  // category 欄位。這樣既沒有假陽性（沒有那種資料就不要求那個 class），
  // 也不會因為 class 是拼出來的而漏掉。
  if (trip) {
    var styleCSS = (s.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
    var hasCSS = function (c) { return styleCSS.indexOf('.' + c) !== -1; };
    // 把所有 POI 類項目攤平：highlights 三類 + regions 三類 + 每站 slots
    var poiItems = [];
    var hl = trip.highlights || {};
    ['spots', 'food', 'shops'].forEach(function (k) { poiItems = poiItems.concat(hl[k] || []); });
    (hl.regions || []).forEach(function (rg) {
      ['spots', 'food', 'shops'].forEach(function (k) { poiItems = poiItems.concat(rg[k] || []); });
    });
    var allDays2 = (trip.plans && trip.plans.length)
      ? trip.plans.reduce(function (a, pl) { return a.concat(pl.days || []); }, [])
      : (trip.days || []);
    allDays2.forEach(function (d) { poiItems = poiItems.concat(d.slots || []); });

    var need = [];
    var usesPoi = outside.indexOf('poiWallHTML') !== -1 || outside.indexOf('nearbyGridHTML') !== -1;
    if (usesPoi) {
      need.push(['poi-grid', '卡片牆退化成直向堆疊'], ['poi-card', '卡片沒有邊框背景'],
                ['hl-card', 'POI 卡片少一層樣式'], ['source-tag', '精選／行程途經分不出來']);
    }
    if (outside.indexOf('nearbyGridHTML') !== -1) need.push(['dist-tag', '距離標籤混在標題裡']);
    if (poiItems.some(function (it) { return it && it.category; })) {
      need.push(['pill', '分類標籤變裸文字']);
    }
    if (poiItems.some(function (it) { return it && it.shop; })) {
      need.push(['hl-shop', '美食項目的來源店家缺次級文字色']);
    }
    var bkinds = {};
    var bdays = (trip.plans && trip.plans.length)
      ? trip.plans.reduce(function (a, pl) { return a.concat(pl.days || []); }, [])
      : (trip.days || []);
    bdays.forEach(function (d) {
      var mark = function (x) {
        if (!x.needsBooking) return;
        bkinds.__any = true;
        if (x.bookingKind) bkinds[x.bookingKind] = true;
      };
      (d.slots || []).forEach(mark);
      (d.routes || []).forEach(function (rt) { (rt.stops || []).forEach(mark); });
    });
    if (bkinds.__any) {
      need.push(['reminder-badge', '「需先訂」徽章變裸文字']);
      ['ticket', 'reserve', 'permit'].forEach(function (k) {
        if (bkinds[k]) need.push([k, '預訂徽章的 ' + k + ' 這一種沒有自己的顏色']);
      });
    }

    var kinds = {};
    poiItems.forEach(function (it) {
      if (it && it.status && it.status.label) {
        var k = it.status.kind;
        kinds[(k === 'season' || k === 'booking' || k === 'free') ? k : 'free'] = true;
      }
    });
    if (Object.keys(kinds).length) {
      need.push(['status', '三種狀態失去顏色區別，「10/12 封路」跟「免費」長得一樣']);
      Object.keys(kinds).forEach(function (k) {
        need.push([k, 'status 的 ' + k + ' 這一種沒有自己的顏色']);
      });
    }
    need.forEach(function (row) {
      if (!hasCSS(row[0])) {
        warnings.push('資料裡會產生 .' + row[0] + ' 但 CSS 裡沒有這條規則 —— ' + row[1]
          + '（engine-contract.md#engine-classes 是唯一權威清單）');
      }
    });
  }

  if (isTripPage && !/leaflet/i.test(s)) errors.push('未引入 Leaflet CSS/JS');
  if (s.indexOf('@media') === -1) errors.push('缺響應式 @media 斷點');
  // ── 條件式資料「有給就必須渲染」──
  // 這幾個欄位不是每份行程都有，但一旦 trip 裡有資料、頁面卻完全沒讀它，
  // 就是渲染漏做——而且頁面看起來完全正常，只是少了一整個區塊。
  // 頁面是前端渲染，渲染腳本必須存取這些欄位名才可能渲染出來，所以掃字串就抓得到。
  (function () {
    var t = trip;
    if (!t) return;
    var days = (t.plans && t.plans.length)
      ? t.plans.reduce(function (a, p) { return a.concat(p.days || []); }, [])
      : (t.days || []);
    [
      ['dining', function (d) { return (d.dining || []).length; },
        '每日餐飲（page-contract.md#blocks 第 8 條：有給就必須渲染）'],
      ['routes', function (d) { return (d.routes || []).length; },
        '每日雙強度路線（conditional-features.md#dual-plans）'],
      ['planB', function (d) { return !!d.planB; },
        '雨雪備案（conditional-features.md#dual-plans）'],
    ].forEach(function (row) {
      var n = days.reduce(function (a, d) { return a + (row[1](d) ? 1 : 0); }, 0);
      if (n && outside.indexOf(row[0]) === -1) {
        errors.push('有 ' + n + ' 天帶 ' + row[0] + ' 資料，但頁面裡完全找不到這個欄位名 —— '
          + row[2] + ' 疑似漏渲染');
      }
    });
    // 雙方案的渲染 class（conditional-features.md#dual-plans「渲染 class 規格」）
    if (t.plans && t.plans.length) {
      ['plan-head', 'route-h'].forEach(function (c) {
        if (outside.indexOf(c) === -1) {
          warnings.push('用了 trip.plans 但頁面沒見到 .' + c
            + ' —— 雙方案的渲染 class 規格見 conditional-features.md#dual-plans');
        }
      });
      if (days.some(function (d) { return d.planB; }) && outside.indexOf('.wx') === -1) {
        warnings.push('有雨雪備案資料但頁面沒見到 .wx —— 備案區塊疑似沒有專屬樣式（conditional-features.md#dual-plans）');
      }
    }
  })();

  // ── trip-data 的 JSON.parse 必須有保護 ──
  // skill 明確邀請使用者手改 trip-data，一個逗號打錯就讓整頁空白且零線索。
  if (isTripPage && s.indexOf('JSON.parse') !== -1 && !/try\s*\{[^}]*JSON\.parse/.test(s)) {
    errors.push('trip-data 的 JSON.parse 沒有 try/catch 保護 —— 使用者手改 JSON 打錯一個逗號'
      + '就會讓整頁空白且看不出原因（page-contract.md#parse-guard）');
  }

  // ── 必須有列印樣式 ──
  // 行程會被印出來帶著走。沒有 @media print 的話，橫捲軌道在紙上捲不動，
  // 每軌只印出可視的前兩欄——150 項總覽在紙上只剩約 30 項。
  if (s.indexOf('@media print') === -1) {
    warnings.push('沒有 @media print —— 橫捲卡片牆在紙上捲不動，每軌只會印出前兩欄'
      + '（page-contract.md#print）');
  }

  // ── 可橫捲的卡片牆必須可鍵盤聚焦 ──
  // overflow-x:auto 的 div 預設不可聚焦，只用鍵盤的人到不了可視範圍外的卡片（WCAG 2.1.1）。
  // 判斷依據必須是「頁面真的會產生 .poi-grid 元素」（gridOpenTag 是 poi.js 產生它的地方），
  // 不能只看 CSS 有沒有提到 .poi-grid——輔助頁可能在列印樣式裡順手寫了這個選擇器卻沒有卡片牆，
  // 那樣會得到假陽性。這個假陽性是加了列印 CSS 之後才冒出來的。
  var emitsGrid = outside.indexOf('gridOpenTag') !== -1 || outside.indexOf('class="poi-grid"') !== -1;
  if (emitsGrid && outside.indexOf('poi-grid" tabindex="0"') === -1) {
    warnings.push('卡片牆沒見到 tabindex="0" —— 可橫捲容器若不可聚焦，只用鍵盤的人到不了'
      + '可視範圍外的卡片（WCAG 2.1.1）。poi.js 的 gridOpenTag 會在項目數超過版面列數時自動加上');
  }

  // ── 內聯的引擎是不是過期副本 ──
  // 引擎是「複製進每個頁面」的，所以修好引擎不等於修好既有頁面。
  // 這次就發生過：poi.js 的 sameCore 修完，頁面裡仍是舊版，修正到不了成品。
  // 比對方式：去空白後看頁面是否含當前引擎原始碼的完整字串。
  // 用 WARNING 而非 ERROR——舊頁面可能是在某功能出現前產生的，不算「壞」，
  // 但帶著已知 bug 這件事必須讓人看見。
  if (isTripPage) {
    try {
      var fsm = require('fs'), pth = require('path');
      var norm = function (x) { return String(x).replace(/\s+/g, ''); };
      var pageN = norm(s);
      ['map.js', 'reminders.js', 'poi.js'].forEach(function (e) {
        var src = fsm.readFileSync(pth.join(__dirname, e), 'utf8');
        if (pageN.indexOf(norm(src)) === -1) {
          warnings.push('內聯的 ' + e + ' 與 assets/' + e + ' 當前版本不一致（過期副本）—— '
            + '引擎修正不會自動傳播到既有頁面，需重新內聯（見 SKILL.md#propagation）');
        }
      });
    } catch (e) { /* 拿不到引擎原始碼（單獨搬走 validate.js 等情況）就跳過 */ }
  }

  // ── 地圖有編號，時間軸也要有 ──
  // 地圖標記印了 1、2、3…，時間軸卻沒有對照的話，讀者在地圖上看到第 7 個點
  // 沒有任何辦法找回是哪一站，編號變成純裝飾。
  if (isTripPage && outside.indexOf('route-pin__num') !== -1 && outside.indexOf('tl-num') === -1) {
    warnings.push('地圖標記有編號但時間軸沒見到 .tl-num —— 讀者無法把地圖上的第 N 個點'
      + '對回哪一站（page-contract.md#map-numbering）');
  }

  // ── 呼叫 initTravelMap 前必須有 typeof L 守衛 ──
  // 不檢查就直接呼叫，離線時會拋 ReferenceError，而渲染腳本通常是一個大 IIFE，
  // 地圖之後的所有區塊會全部不渲染——「離線可讀」的承諾直接破功。
  if (isTripPage && s.indexOf('initTravelMap') !== -1 && !/typeof\s+L\s*[!=]==?\s*['"]undefined['"]/.test(s)) {
    errors.push('呼叫 initTravelMap 但沒見到 typeof L 的守衛 —— 離線時會拋 ReferenceError，'
      + '把地圖之後的所有區塊一起打掉（page-contract.md#constraints「地圖的離線降級」）');
  }

  // ── glossary 有資料就必須用 <dl> 渲染 ──
  // page-contract.md#glossary 規定用 <dl>/<dt>/<dd>，不要沿用 highlights 的卡片樣式
  //（那是查閱型內容，排版應偏字典而非卡片網格）。頁面是前端渲染，但渲染腳本原始碼裡
  // 會有 '<dl' 字串字面；完全找不到＝沒渲染或用錯排版。
  (function () {
    var t = trip;
    var g = t && t.glossary && (t.glossary.groups || []);
    if (!g || !g.length) return;
    var n = g.reduce(function (a, x) { return a + ((x.items || []).length); }, 0);
    if (n && outside.indexOf('<dl') === -1) {
      errors.push('trip.glossary 有 ' + n + ' 條詞條，但頁面裡完全找不到 <dl —— 外文名詞註解疑似漏渲染，'
        + '或錯用了 highlights 的卡片樣式（page-contract.md#glossary 規定用 dl/dt/dd）');
    }
  })();

  // ── .poi-grid 的 overflow-x 需要祖先鏈上有 min-width:0 才會生效（曾經上線過）──
  // grid/flex 子項的 min-width 預設是 auto（不得縮小到比內容更窄），卡片牆會把所在欄位
  // 撐到三千多 px，overflow-x:auto 永不觸發；外層 overflow:hidden 再把它裁掉——
  // 結果超出畫面的卡片既不能捲也點不到。特徵是 grid-template-rows / grid-auto-flow
  // 查起來都正確，唯獨 scrollWidth === clientWidth，只量 CSS 屬性抓不到。
  if (emitsGrid && !/min-width\s*:\s*0/.test(s)) {
    warnings.push('頁面有 .poi-grid 但 CSS 裡沒見到 min-width:0 —— 卡片牆的 overflow-x 可能不會生效'
      + '（卡片被撐開後遭外層裁掉、既不能捲也點不到）。請在祖先鏈（時間軸 li、路線 li、面板容器）補上，'
      + '並用瀏覽器確認 scrollWidth > clientWidth（engine-contract.md#poi-wall）');
  }

  if (/<img[\s>]/.test(outside) && outside.indexOf('object-fit') === -1) warnings.push('未見 object-fit（圖片防變形），請確認');
  if (TRIPDATA_TAG.test(s) && !trip) {
    errors.push('trip-data 塊存在但 JSON 解析失敗');
  }
  if (trip && trip.disclaimer) {
    var probe = String(trip.disclaimer).slice(0, 15);
    // disclaimer 全文須出現在正文（不只藏在 JSON 裡）：JSON 外應至少再出現一次。
    // 已知假警報：若頁面用純前端腳本在執行時才把 trip.disclaimer 寫進 DOM
    // （如 el.innerHTML = trip.disclaimer），這段文字只有瀏覽器執行 JS 後才會出現，
    // 靜態字串掃描看不到、必定觸發這條 warning——這種實現方式請改用瀏覽器
    // （或無頭瀏覽器截圖）實際開啟頁面確認免責宣告有渲染出來，不用糾結這條 warning。
    var first = s.indexOf(probe);
    var second = s.indexOf(probe, first + 1);
    // 契約強制「資料與呈現分離」（page-contract.md#constraints），所以正確實作的頁面
    // 只會在 trip-data 裡有這段文字一次，靜態掃描永遠找不到第二次——這條檢查原本
    // 因此在**每一份合規頁面**上都誤報。分辨方法：看渲染腳本有沒有讀這個欄位。
    var rendersIt = /\bdisclaimer\b/.test(outside);
    if (second === -1 && !rendersIt) {
      errors.push('免責宣告既不在正文裡、渲染腳本也沒有讀 trip.disclaimer —— 這是必需區塊'
        + '（page-contract.md#blocks 的「免責宣告」）');
    } else if (second === -1) {
      notes.push('免責宣告由渲染腳本動態寫入，靜態掃描驗不到 —— 請在瀏覽器實測那一步確認它真的出現在畫面上。');
    }
  }

  // engine-contract.md#poi-wall／#nearby-panel：highlights 存在時，附近推薦 toggle 面板與每卡地圖連結是無條件要做的渲染邏輯，
  // 這裡做盡力而為的機械抽查（字串掃描，抓不到全部情況，僅供人工複核參考）。
  if (trip && trip.highlights) {
    // 用了 conditional-features.md#dual-plans 的雙方案時，days 分散在 trip.plans[].days 裡，
    // trip.days 是 undefined——直接讀 trip.days 會讓 hasCoordSlot 永遠是 false，
    // 下面整組檢查（nearby-toggle / source-tag / poi-maplink / buildMapAppLinks）全部靜默跳過。
    // 這個死檢查是逐條餵正例才發現的：單一方案的行程驗得到，雙方案的驗不到。
    var allDays = (trip.plans && trip.plans.length)
      ? trip.plans.reduce(function (a, pl) { return a.concat(pl.days || []); }, [])
      : (trip.days || []);
    var hasCoordSlot = allDays.some(function (d) {
      return (d.slots || []).some(function (sl) { return typeof sl.lat === 'number' && typeof sl.lng === 'number'; });
    });
    if (hasCoordSlot && outside.indexOf('nearby-toggle') === -1) {
      warnings.push('trip.highlights 存在且有帶座標的 slot，但 HTML 裡沒見到 "nearby-toggle"，附近推薦面板（engine-contract.md#nearby-panel）疑似漏做，請確認');
    }
    var hasCoordHighlight = ['spots', 'food', 'shops'].some(function (key) {
      return (trip.highlights[key] || []).some(function (it) { return typeof it.lat === 'number' && typeof it.lng === 'number'; });
    });
    if ((hasCoordSlot || hasCoordHighlight) && outside.split('buildMapAppLinks').length - 1 < 3) {
      // 不用帶括號的 'buildMapAppLinks(' 匹配：poi.js 的 mapLinkHTML/poiCardHTML 是把 buildMapAppLinks
      // 當函式引用傳進去（如 poiWallHTML(items, 'highlight', '精選', buildMapAppLinks)），原始碼裡不會緊跟
      // 左括號，帶括號匹配會在改用 poi.js 後把正確實現誤判成漏做。至少 3 次：map.js 定義 1 次 +
      // initTravelMap 內部呼叫 1 次 + 延伸推薦/附近推薦至少一處把它傳給 poi.js。
      warnings.push('延伸推薦卡片疑似未把 buildMapAppLinks 接上地圖連結（engine-contract.md#poi-wall「標題連結＋地圖連結」），請確認');
    }
    // 版面改版史：5 列 → 3 列 → 2 列（當前）。這裡只認目前生效的 2 列寫法；
    // 若之後再調整行數，記得同步這條字串與 poi.js 的 POI_GRID_ROWS，不要留著舊數字繼續通過校驗。
    if (outside.indexOf('.poi-grid') !== -1 && outside.indexOf('repeat(2, auto)') === -1) {
      warnings.push('未見 "repeat(2, auto)"，延伸推薦/附近推薦卡片牆疑似不是 engine-contract.md#poi-wall 規定的「2列橫向捲動」版面，請確認');
    }
    if (hasCoordSlot && outside.indexOf('nearby-toggle') !== -1 && outside.indexOf('source-tag') === -1) {
      warnings.push('附近推薦面板存在，但 HTML 裡沒見到 "source-tag"，面板卡片疑似沒標「精選／行程途經」來源標籤（engine-contract.md#poi-wall「分組標記」第4點），請確認');
    }
    // 時間軸站點標題保底規則（page-contract.md#slot-links）：沒有 url 的帶座標 slot 也要有地圖連結兜底。
    var hasSlotWithoutUrl = allDays.some(function (d) {
      return (d.slots || []).some(function (sl) {
        return typeof sl.lat === 'number' && typeof sl.lng === 'number' && !sl.url;
      });
    });
    if (hasSlotWithoutUrl && outside.indexOf('poi-maplink') === -1) {
      warnings.push('存在沒有 url 的帶座標時間軸站點，但 HTML 裡沒見到 "poi-maplink"，這類站點標題疑似沒有地圖連結兜底可點（page-contract.md#slot-links），請確認');
    }
    // 卡片牆超過 2 項（會溢位到第二欄、需要橫向捲動）時，poi.js 的 poiWallHTML/nearbyGridHTML
    // 會自動帶 poi-scroll-hint 提示；HTML 裡沒見到就代表滾動提示疑似被手動刪掉或沒用 poi.js。
    var hasWideCategory = ['spots', 'food', 'shops'].some(function (key) {
      return (trip.highlights[key] || []).length > 2;
    });
    if (hasWideCategory && outside.indexOf('poi-scroll-hint') === -1) {
      warnings.push('highlights 有分類項目數 >2（會超出2列版面、需要橫向捲動），但 HTML 裡沒見到 "poi-scroll-hint" 滾動提示，請確認（engine-contract.md#poi-wall「版面」）');
    }
  }
  return { errors: errors, warnings: warnings, notes: notes };
}

// 一次跑全：HTML 標記 + 內嵌 trip 結構
function validateAll(html) {
  var h = validateHTML(html);
  if (!h.notes) h.notes = [];
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
    (out.notes || []).forEach(function (nt) { console.log('· 註記     ' + nt); });
    if (!out.errors.length) console.log('✓ 契約校驗通過' + (out.warnings.length ? '（有 ' + out.warnings.length + ' 條 warning 請人工確認）' : ''));
    process.exit(out.errors.length ? 1 : 0);
  }
}
