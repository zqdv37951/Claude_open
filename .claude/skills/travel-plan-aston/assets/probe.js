#!/usr/bin/env node
// 檢查器的自我探測（meta-checker）。
//
// 為什麼需要它：本 skill 靠 validate.js 與 check-refs.js 擋錯，但「檢查器跑完沒報錯」
// 有兩種完全不同的意思——**真的沒問題**，或**那條檢查根本不會叫**。後者更危險：
// 它給人一種被守著的錯覺。這個 skill 已經出現過四條死檢查（validate.js 讀 trip.days，
// 而雙方案行程的 days 藏在 plans[] 裡，於是四條檢查永遠拿到 undefined，安靜地全過）。
//
// 所以規則是：**每條檢查都要餵一次合成陽性，證明它會叫。** 這支腳本就是那件事。
// 做法是拿一份正常的輸入，故意破壞一個地方，然後斷言檢查器有抱怨到對的點上。
//
// 用法：
//   node assets/probe.js                    只探測 check-refs.js（不需要外部檔案）
//   node assets/probe.js <行程頁.html>       連 validate.js 一起探測（需要一份真實行程頁當母本）
//
// 退出碼：0 = 全部檢查都證明會叫；1 = 有死檢查或探測本身出錯。

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const SKILL = path.join(HERE, '..');
let dead = 0;
let probed = 0;
let unreachable = 0;

function ok(name) { console.log('  ok   ' + name); probed++; }
function bad(name, why) { console.log('  ✗ 死檢查 ' + name + '  → ' + why); probed++; dead++; }
// 第三種狀態：不是死檢查，是**這份母本天生打不到**（例如母本一張 <img> 都沒有，
// 「未見 object-fit」就永遠不會觸發）。跟死檢查混在一起報，會逼人去「修」一條沒壞的
// 檢查；完全不報又會讓覆蓋率數字看起來比實際好。所以單獨列出來，換母本才驗得到。
function skip(name, why) { console.log('  ⊘ 母本打不到 ' + name + '  → ' + why); unreachable++; }

// ══════════════════════════════════════════════════════════════
// Part A：validate.js —— 破壞頁面，斷言對應訊息出現
// ══════════════════════════════════════════════════════════════
const page = process.argv[2];
if (!page) {
  console.log('── Part A：validate.js ──');
  console.log('  ⊘ 略過（沒有給行程頁當母本）。要探測 validate.js 請跑：');
  console.log('     node assets/probe.js <一份通過校驗的行程頁.html>');
} else {
  console.log('── Part A：validate.js（母本 ' + path.basename(page) + '）──');
  const V = require(path.join(HERE, 'validate.js'));
  const base = fs.readFileSync(page, 'utf8');
  const TD = /<script id="trip-data"[^>]*>([\s\S]*?)<\/script>/;

  // 只改 trip-data 的 JSON、其餘位元組完全不動——這樣失敗一定來自那個欄位，
  // 不會混進「順手改壞了別的東西」的雜訊。
  function withTrip(fn) {
    const m = base.match(TD);
    const t = JSON.parse(m[1]);
    fn(t);
    return base.slice(0, m.index + m[0].indexOf('>') + 1)
      + JSON.stringify(t)
      + base.slice(m.index + m[0].length - '</script>'.length);
  }

  const cases = [
    ['缺 trip-data（應降級為輔助頁）', () => base.replace('id="trip-data"', 'id="xx"'), '輔助頁'],
    ['缺 initTravelMap',        () => base.replace(/initTravelMap/g, 'xxA'),  'initTravelMap'],
    ['缺 computeReminders',     () => base.replace(/computeReminders/g, 'xxB'), 'computeReminders'],
    ['缺 renderChecklistHTML',  () => base.replace(/renderChecklistHTML/g, 'xxC'), 'renderChecklistHTML'],
    ['缺 gcj02ToWgs84',         () => base.replace(/gcj02ToWgs84/g, 'xxD'),   'gcj02ToWgs84'],
    ['缺 POI_GRID_ROWS',        () => base.replace(/POI_GRID_ROWS/g, 'xxE'),  'POI_GRID_ROWS'],
    ['缺 Leaflet',              () => base.replace(/leaflet/gi, 'xxF'),       'Leaflet'],
    ['缺 @media 斷點',          () => base.replace(/@media/g, '@xxG'),        '@media'],
    ['trip-data JSON 壞掉',     () => base.replace(TD, '<script id="trip-data">{bad}</script>'), 'JSON'],
    ['缺 .route-pin 樣式',      () => base.replace(/\.route-pin[^{]*\{[^}]*\}/g, ''), 'route-pin'],
    ['缺 .todo-item 樣式',      () => base.replace(/\.todo-item[^{]*\{[^}]*\}/g, ''), 'todo-item'],
    ['缺 .pill 樣式（資料驅動）', () => base.replace(/\.pill\{[^}]*\}/g, ''),      '會產生 .pill'],
    ['缺 .status 樣式（資料驅動）', () => base.replace(/\.status[^{]*\{[^}]*\}/g, ''), '會產生 .status'],
    ['缺 <dl>（名詞註解）',     () => base.replace(/<dl/g, '<xxH'),           'glossary'],
    ['缺 min-width:0',          () => base.replace(/min-width:0/g, 'xxI'),    'min-width'],
    ['缺 nav-in',               () => base.replace(/nav-in/g, 'xxJ'),         'nav-in'],
    ['缺 scroll-margin-top',    () => base.replace(/scroll-margin-top/g, 'xxK'), 'scroll-margin-top'],
    ['列印網格沒改成換行',      () => base.replace('repeat(2, auto)', 'repeat(9, auto)'), 'repeat(2, auto)'],
    ['缺 nearby-toggle',        () => base.replace(/nearby-toggle/g, 'xxL'),  'nearby-toggle'],
    ['缺 source-tag',           () => base.replace(/source-tag/g, 'xxM'),     'source-tag'],
    ['缺 poi-maplink',          () => base.replace(/poi-maplink/g, 'xxN'),    'poi-maplink'],
    ['缺 poi-scroll-hint',      () => base.replace(/poi-scroll-hint/g, 'xxO'), 'poi-scroll-hint'],
    ['缺 title',                () => withTrip((t) => delete t.title),        'title'],
    ['startDate 格式錯',        () => withTrip((t) => { t.startDate = '2026/10/01'; }), 'startDate'],
    ['disclaimer 太短',         () => withTrip((t) => { t.disclaimer = '短'; }), 'disclaimer'],
    ['reminders 缺 leadDays',   () => withTrip((t) => { t.reminders[0] = { item: 'x' }; }), 'leadDays'],
    ['day.date 格式錯',         () => withTrip((t) => { t.plans[0].days[0].date = '10/01'; }), 'date'],
    ['slot 缺 name',            () => withTrip((t) => delete t.plans[0].days[0].slots[0].name), 'name'],
    ['slot 缺 lat/lng',         () => withTrip((t) => delete t.plans[0].days[0].slots[0].lat), 'lat/lng'],
    ['lat 越界',                () => withTrip((t) => { t.plans[0].days[0].slots[0].lat = 200; }), '越界'],
    ['座標離群',                () => withTrip((t) => { const s = t.plans[0].days[0].slots[0]; s.lat = 20; s.lng = 20; }), '離群'],
    ['needsBooking 缺 leadDays', () => withTrip((t) => { t.plans[0].days[0].slots[0].needsBooking = true; }), 'needsBooking'],
    ['url 含 &amp;（雙重轉義）', () => withTrip((t) => { t.plans[0].days[0].routes[0].stops[0].url = 'http://x?a=1&amp;b=2'; }), '&amp;'],
    ['plan 缺 days',            () => withTrip((t) => delete t.plans[1].days), 'days'],
    ['兩個 plan 都 recommended', () => withTrip((t) => { t.plans[1].recommended = true; }), 'recommended'],
    ['regions 某類不足 10 項',  () => withTrip((t) => { t.highlights.regions[0].spots.length = 3; }), 'regions'],
    ['有 dining 卻沒渲染',      () => withTrip((t) => { t.plans[0].days[0].dining = [{ meal: '午餐' }]; }), 'dining'],
    ['缺 hotelAreas',           () => withTrip((t) => delete t.hotelAreas),   'hotelAreas'],
    ['缺 preTrip',              () => withTrip((t) => delete t.preTrip),      'preTrip'],
    ['缺 tips',                 () => withTrip((t) => { t.tips = []; }),      'tips'],
    ['缺 flights',              () => withTrip((t) => delete t.flights),      'flights'],
    ['缺 highlights',           () => withTrip((t) => delete t.highlights),   'highlights'],
    ['免責宣告完全沒渲染',      () => base.replace(/disclaimer\)/g, 'xxV)'),  '免責宣告既不在正文裡'],
    ['沒有 plan 標 recommended', () => withTrip((t) => t.plans.forEach((p) => { delete p.recommended; })), 'recommended'],
    ['glossary 有分組但無詞條', () => withTrip((t) => { t.glossary.groups.forEach((g) => { g.items = []; }); }), '沒有任何詞條'],
    ['days 形式但 days 為空',   () => withTrip((t) => { delete t.plans; t.days = []; }), 'trip.days'],
    ['是 HTML 片段不是完整文件', () => '<div><p>只有片段</p></div>',          'HTML 片段'],
    ['<html> 沒有 lang',        () => base.replace(/lang="[^"]*"/, 'data-x="1"'), 'lang 屬性'],
    ['缺雙方案渲染 class',      () => base.replace(/plan-head/g, 'xxP'),      'plan-head'],
    ['缺雨雪備案樣式 .wx',      () => base.replace(/\.wx\b/g, '.xxQ'),        '.wx'],
    ['JSON.parse 沒有保護',     () => base.replace(/try \{\s*trip = JSON\.parse/, 'trip = JSON.parse'), 'try/catch'],
    ['卡片牆缺 tabindex',       () => base.replace(/poi-grid" tabindex="0"/g, 'poi-grid"'), 'tabindex'],
    ['時間軸缺 .tl-num',        () => base.replace(/tl-num/g, 'xxR'),         'tl-num'],
    ['缺 typeof L 守衛',        () => base.replace(/typeof L/g, 'typeof xxS'), 'typeof L'],
    ['缺 object-fit',           () => base.replace(/object-fit/g, 'xxT'),     'object-fit',
      (b) => /<img[\s>]/.test(b) || '母本一張 <img> 都沒有（荒野行程刻意不收照片），這條檢查的前提在此母本不成立'],
    ['沒把 buildMapAppLinks 接上', () => base.replace(/buildMapAppLinks/g, 'xxU').replace('xxU', 'buildMapAppLinks'), 'buildMapAppLinks'],
  ];

  const seen = new Set();
  cases.forEach(([name, mutate, fragment, precondition]) => {
    if (precondition) { const r = precondition(base); if (r !== true) { skip(name, r); return; } }
    let out;
    try { out = V.validateAll(mutate()); }
    catch (e) { bad(name, '探測時拋錯：' + e.message); return; }
    const all = out.errors.concat(out.warnings, out.notes || []);
    all.forEach((m) => seen.add(m));
    if (all.join(' | ').includes(fragment)) ok(name);
    else bad(name, '沒有任何訊息含「' + fragment + '」');
  });

  // ── 覆蓋率：validate.js 有幾條診斷從來沒被任何合成陽性打中 ──
  // 這一段是刻意的自我揭露：只報「幾條檢查會叫」會讓人誤以為全部都被證明過。
  // 沒被打中不等於壞，但等於**沒有證據**——把數字說出來，才知道下一輪該補哪裡。
  const src = fs.readFileSync(path.join(HERE, 'validate.js'), 'utf8');
  const templates = [...src.matchAll(/(?:errors|warnings|notes)\.push\(\s*'((?:[^'\\]|\\.){8,40})/g)]
    .map((m) => m[1].replace(/\\'/g, "'"));
  const uncovered = [...new Set(templates)].filter((t) => ![...seen].some((m) => m.includes(t)));
  const total = new Set(templates).size;
  console.log('  ── 覆蓋率：' + (total - uncovered.length) + '/' + total
    + ' 條 validate.js 診斷有合成陽性佐證'
    + (unreachable ? '（另有 ' + unreachable + ' 條前提不在此母本）' : ''));
  if (uncovered.length) {
    console.log('     還沒有佐證的（不代表壞，代表沒證據）：');
    uncovered.forEach((t) => console.log('       · ' + t.trim().slice(0, 46)));
  }
}

// ══════════════════════════════════════════════════════════════
// Part B：check-refs.js —— 複製整個 skill 到暫存目錄，注入違規後跑
// ══════════════════════════════════════════════════════════════
// 不能就地破壞真的檔案，所以整份複製出去改。這也讓 Part B 不需要任何外部輸入，
// 在任何一份 checkout 上都跑得起來。
console.log('\n── Part B：check-refs.js ──');

function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else fs.copyFileSync(s, d);
  }
}

function runRefs(dir) {
  try {
    execFileSync(process.execPath, [path.join(dir, 'assets', 'check-refs.js')],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

// ⚠️ 下面每一段注入的違規字串都是**執行時拼出來的**，不是字面寫在原始碼裡。
// 原因：check-refs.js 會掃描整個 skill 目錄，包含本檔。若把「壞錨點」「誤字」
// 直接寫成字面值，check-refs 就會在本檔身上報出那些違規——這是本 skill 第四次
// 踩到同一個陷阱（前三次：說明註解裡的示例檔名、頁面錯誤提示裡的 trip-data、
// 誤字表比對到自己）。
// 前三次的解法都是「豁免定義規則的那個檔案」，但豁免清單一長就代表規則不清楚。
// 這裡改用更乾淨的解法：**讓被禁止的字串在磁碟上根本不存在**，於是零豁免。
const J = (a) => a.join('');
const refCases = [
  ['① 交叉引用指到不存在的錨點', 'README.md',
    (s) => s + '\n引用測試 ' + J(['page-contract', '.md#no-such', '-anchor']) + '\n', '錨點不存在'],
  ['② 檔案沒登記進職責表', null, null, '未登記'],
  ['③ 數字對帳（測試數寫錯）', 'README.md',
    (s) => s.replace(/poi\.js 回歸測試（\d+ 個）/, 'poi.js 回歸測試（999 個）'), '實際'],
  ['④ 簡繁誤字', 'README.md',
    (s) => s + '\n這裡' + J(['\u96BB', '有']) + '一句測試用的錯字。\n', '誤字'],
  ['⑤ 位置式引用', 'README.md',
    (s) => s + '\n詳見' + J(['第 3 ', '節']) + '與' + J(['步驟 ', '9']) + '。\n', '位置式引用'],
  ['⑥ 同檔錨點連結指不到', 'README.md',
    (s) => s + '\n[測試](#' + J(['totally-missing', '-anchor']) + ')\n', '同檔錨點連結'],
  ['③b 標題自稱項數與實際不符', 'README.md',
    // 刻意自己追加一整段，不要去改現有標題——綁在具體標題上的注入，
    // 只要那個標題被改名（本輪就發生了）注入就悄悄失效，探測變成假通過。
    (s) => s + '\n## 5 個測試用項目\n\n- 只有這一項\n', '標題自稱'],
  ['⑧ 兩份檔案有逐字相同的規則句', 'README.md',
    (s) => s + '\n' + '這一句是刻意用來測試規則重複偵測的長句子，會同時出現在兩份檔案裡。\n', '規則只能住一個地方',
    ['assets/page-contract.md', (s) => s + '\n' + '這一句是刻意用來測試規則重複偵測的長句子，會同時出現在兩份檔案裡。\n']],
  ['⑨ 裸檔名少了副檔名', 'README.md',
    (s) => s + '\n見 ' + J(['engine-', 'contract']) + ' 的說明。\n', '裸檔名'],
  ['⑩ 用引號章節名指路', 'README.md',
    (s) => s + '\n見 ' + J(['engine-contract', '.md', '「函式簽章」']) + '。\n', '引號章節名'],
  ['③c 「N 項檢查」數字寫錯', 'README.md',
    (s) => s.replace(/(\d+|[一二三四五六七八九十]{1,3})\s*項檢查/, '99 項檢查'), '項檢查'],
  ['⑪ 適配提示詞漏列檔案', 'references/porting-to-other-agents.md',
    (s) => s.replace('- ' + J(['assets/check-', 'links.js']) + '：產出頁面後跑，驗外部連結真的打得開（需要外網）\n', ''),
    '通用適配提示詞'],
  ['⑦ 目錄漏列章節', 'assets/page-contract.md',
    (s) => s.replace('| [列印樣式](#print) | 紙上必做的四件事 |\n', ''), '漏列'],
];

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-refs-'));

// 先確認乾淨的副本本來是通過的——否則後面每一條都會「因為別的原因」而叫，
// 探測就等於什麼都沒證明。
const clean = path.join(tmpRoot, 'clean');
copyTree(SKILL, clean);
const baseRun = runRefs(clean);
if (baseRun.code !== 0) {
  console.log('  ✗ 乾淨副本本來就不通過，Part B 無法判讀：\n' + baseRun.out);
  dead += refCases.length;
  probed += refCases.length;
} else {
  refCases.forEach(([name, file, mutate, fragment, extra], i) => {
    const dir = path.join(tmpRoot, 'case' + i);
    copyTree(SKILL, dir);
    if (file && mutate) {
      const fp = path.join(dir, file);
      fs.writeFileSync(fp, mutate(fs.readFileSync(fp, 'utf8')));
    } else {
      fs.writeFileSync(path.join(dir, 'assets', J(['unregistered-', 'probe', '.md'])), '# 未登記的檔案\n');
    }
    if (extra) {                                    // 有些違規需要動到第二個檔案（如「兩份檔案重複」）
      const fp2 = path.join(dir, extra[0]);
      fs.writeFileSync(fp2, extra[1](fs.readFileSync(fp2, 'utf8')));
    }
    const r = runRefs(dir);
    if (r.code !== 0 && r.out.includes(fragment)) ok(name);
    else if (r.code === 0) bad(name, '注入違規後仍然通過');
    else bad(name, '有報錯但訊息不含「' + fragment + '」');
  });
}
fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log('\n' + probed + ' 條檢查中，' + (probed - dead) + ' 條證明會叫，'
  + dead + ' 條可疑'
  + (unreachable ? '；另有 ' + unreachable + ' 條因母本缺前提而打不到（換一份母本才驗得到，不是壞）' : '') + (dead ? '（必須修——不會叫的檢查比沒有檢查更糟，它給人被守著的錯覺）' : ''));
process.exit(dead ? 1 : 0);
