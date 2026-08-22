// assets/reminders.js 的迴歸測試。純 Node、零依賴，CLI 直接跑：
//   node <skill目錄>/assets/reminders.test.js
// 日期回推是最容易被時區坑掉的一類邏輯（本地時區會讓 deadline 差一天），
// 所以這裡刻意用跨月、跨年、閏年的邊界值驗證，而不只驗一般情況。

var assert = require('assert');
var rem = require('./reminders.js');

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

// ── computeReminders：日期回推 ──
test('computeReminders：基本回推正確', function () {
  var r = rem.computeReminders('2026-10-01', [{ item: 'A', leadDays: 7 }]);
  assert.strictEqual(r[0].deadline, '2026-09-24');
  assert.strictEqual(r[0].item, 'A');
  assert.strictEqual(r[0].leadDays, 7);
});

test('computeReminders：leadDays 為 0 就是出發日當天', function () {
  assert.strictEqual(rem.computeReminders('2026-10-01', [{ item: 'A', leadDays: 0 }])[0].deadline, '2026-10-01');
});

test('computeReminders：跨月正確', function () {
  assert.strictEqual(rem.computeReminders('2026-10-01', [{ item: 'A', leadDays: 1 }])[0].deadline, '2026-09-30');
});

test('computeReminders：跨年正確', function () {
  assert.strictEqual(rem.computeReminders('2026-01-05', [{ item: 'A', leadDays: 10 }])[0].deadline, '2025-12-26');
});

test('computeReminders：閏年 2 月不會算錯', function () {
  // 2028 是閏年，3/1 往回推 1 天應為 2/29
  assert.strictEqual(rem.computeReminders('2028-03-01', [{ item: 'A', leadDays: 1 }])[0].deadline, '2028-02-29');
  // 2026 非閏年，3/1 往回推 1 天應為 2/28
  assert.strictEqual(rem.computeReminders('2026-03-01', [{ item: 'A', leadDays: 1 }])[0].deadline, '2026-02-28');
});

test('computeReminders：長天數（42 天）不漂移', function () {
  assert.strictEqual(rem.computeReminders('2026-10-01', [{ item: 'A', leadDays: 42 }])[0].deadline, '2026-08-20');
});

test('computeReminders：依 deadline 升序排序（不是照輸入順序）', function () {
  var r = rem.computeReminders('2026-10-01', [
    { item: '晚', leadDays: 3 }, { item: '早', leadDays: 30 }, { item: '中', leadDays: 14 }]);
  assert.deepStrictEqual(r.map(function (x) { return x.item; }), ['早', '中', '晚']);
});

test('computeReminders：空清單回傳空陣列，不拋錯', function () {
  assert.deepStrictEqual(rem.computeReminders('2026-10-01', []), []);
});

// ── renderChecklistHTML ──
test('renderChecklistHTML：輸出 reminders.js 定死的 class（頁面靠它上樣式）', function () {
  var h = rem.renderChecklistHTML(rem.computeReminders('2026-10-01', [{ item: '門票', leadDays: 7 }]));
  ['pretrip-todo', 'todo-item', 'todo-deadline', 'todo-text'].forEach(function (c) {
    assert.ok(h.indexOf(c) !== -1, '缺 class：' + c);
  });
  assert.ok(h.indexOf('<input type="checkbox">') !== -1, '要有可勾選的核取方塊');
  assert.ok(h.indexOf('2026-09-24') !== -1, '要顯示算出來的截止日');
});

test('renderChecklistHTML：item 有轉義，不會被注入', function () {
  var h = rem.renderChecklistHTML([{ item: '<img src=x onerror=alert(1)>', leadDays: 1, deadline: '2026-09-30' }]);
  assert.ok(h.indexOf('<img') === -1, 'item 未轉義，存在 XSS 風險');
  assert.ok(h.indexOf('&lt;img') !== -1);
});

// ── reminderBadgeHTML ──
test('reminderBadgeHTML：輸出 .reminder-badge 並帶天數', function () {
  var b = rem.reminderBadgeHTML(21);
  assert.ok(b.indexOf('reminder-badge') !== -1);
  assert.ok(b.indexOf('21') !== -1);
});

test('reminderBadgeHTML：不給 opts 時輸出與舊版逐字相同（既有頁面不能被改壞）', function () {
  // 這條是防回歸用的：reminderBadgeHTML 已經被內聯進多份既有頁面，
  // 加新功能時舊呼叫的輸出必須一個字都不變，否則那些頁面的樣式會對不上。
  assert.strictEqual(rem.reminderBadgeHTML(5),
    '<span class="reminder-badge">⚠️ 建議提前5天訂</span>');
});

test('reminderBadgeHTML：三種 kind 各有自己的字與 class', function () {
  var t = rem.reminderBadgeHTML(5, { kind: 'ticket' });
  var r = rem.reminderBadgeHTML(14, { kind: 'reserve' });
  var p = rem.reminderBadgeHTML(14, { kind: 'permit' });
  assert.ok(t.indexOf('class="reminder-badge ticket"') !== -1 && t.indexOf('需購票') !== -1);
  assert.ok(r.indexOf('class="reminder-badge reserve"') !== -1 && r.indexOf('需訂位') !== -1);
  assert.ok(p.indexOf('class="reminder-badge permit"') !== -1 && p.indexOf('需通行證') !== -1);
  // 未知 kind 不能把不認識的字串寫進 class，要整個退回舊行為
  var bogus = rem.reminderBadgeHTML(3, { kind: 'bogus' });
  assert.ok(bogus.indexOf('bogus') === -1, '未知 kind 被寫進了 class');
  assert.strictEqual(bogus, rem.reminderBadgeHTML(3));
});

test('reminderBadgeHTML：有 url 就變成可點的連結，沒有就是純標籤', function () {
  var a = rem.reminderBadgeHTML(5, { kind: 'ticket', url: 'https://x.test/tickets' });
  assert.ok(/^<a /.test(a), '有 url 應該渲染成 <a>');
  assert.ok(a.indexOf('target="_blank"') !== -1 && a.indexOf('rel="noopener"') !== -1);
  assert.ok(a.indexOf('↗') !== -1, '外開連結要有可見的指示');
  var s = rem.reminderBadgeHTML(5, { kind: 'ticket' });
  assert.ok(/^<span /.test(s), '沒有 url 就不該是連結');
});

test('reminderBadgeHTML：leadDays 為 0 或缺時只顯示要訂什麼，不顯示「提前 0 天」', function () {
  var b = rem.reminderBadgeHTML(0, { kind: 'permit' });
  assert.ok(b.indexOf('需通行證') !== -1);
  assert.ok(b.indexOf('0') === -1, '不該出現「提前 0 天」這種沒有意義的字');
});

test('reminderBadgeHTML：url 有轉義，不會被注入屬性', function () {
  var b = rem.reminderBadgeHTML(3, { kind: 'ticket', url: '" onload=alert(1) x="' });
  assert.ok(b.indexOf('onload=alert(1)') === -1 || b.indexOf('&quot;') !== -1,
    'url 未轉義，可以跳出 href 屬性');
  assert.ok(b.indexOf('href="&quot;') !== -1);
});

var failed = 0;
tests.forEach(function (t) {
  try { t.fn(); console.log('  ok - ' + t.name); }
  catch (e) { failed += 1; console.error('  FAIL - ' + t.name); console.error('    ' + (e && e.message ? e.message : e)); }
});
console.log('');
if (failed) { console.error(failed + ' / ' + tests.length + ' 個測試失敗'); process.exit(1); }
console.log('全部 ' + tests.length + ' 個測試通過'); process.exit(0);
