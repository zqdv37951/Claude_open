#!/usr/bin/env node
// 產出頁面的外部連結有效性檢查。
//
// 為什麼需要它：`research-guide.md` 一直要求「圖片 URL 必須驗證回 200」，
// 卻對 `url` 欄位沒有任何要求。第一次真的跑起來，94 個非地圖連結裡有 11 個是壞的
// （404 路徑與已不存在的域名）——而頁面上完全看不出來，讀者點下去才發現。
// 這個數字只在這裡寫一次，別的文件要提就指過來。
//
// 用法：node assets/check-links.js <生成的.html> [...更多檔案]
//
// 兩個刻意的設計：
//  ① 先 HEAD 再 GET，再換一個更短的 UA 試一次。很多站台對 HEAD 回 405、對防爬回 403，
//     那不是壞連結。三種方式都失敗才算可疑。
//     UA 那一層是踩過才加的：原本只用完整的 Chrome UA，6 個「可疑」裡有 2 個純粹是
//     被 WAF 擋掉——而我第一次判讀時誤以為變因是「裸網域 vs www」，還照著改了頁面。
//     教訓：**對防爬站台的單次測量不是證據。** 換一個變數重測，才知道自己在測什麼。
//  ② 跳過地圖類連結（google.com/maps、amap、apple maps、geo:）。它們是由引擎用
//     encodeURIComponent 組出來的，永遠會解析，逐個打反而是浪費與擾民。
//
// 退出碼：有可疑連結時 1，全部正常時 0。網路本身不可用時（全部失敗）回 0 並提示，
// 因為那代表「這個環境驗不了」而不是「連結都壞了」——這個區別很重要，不要把
// 環境限制誤報成內容問題。

const fs = require('fs');
const { execFile } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120 Safari/537.36';
// 退避用的第二個 UA。看起來反直覺（更簡略的 UA 反而更容易過），但實測就是如此——
// 有些 WAF 的規則是針對「偽裝成瀏覽器卻沒有其他瀏覽器特徵」的請求。
const UA_ALT = 'Mozilla/5.0';

// 停放域名偵測。**HTTP 200 不代表頁面是對的**：域名被停放時任何路徑都回 200，
// 內容是「此域名待售」。踩過兩次：
//   · laggans.com（麵包店官網）——那次剛好連線被拒才被發現；
//   · pigeonholeyyc.com（餐廳官網）——回 200、/reservations 也回 200，
//     全部是 HugeDomains 的待售頁。差一點就把它當成有效的訂位連結寫進頁面。
// 只認這幾個高辨識度的字串。**刻意不做「用 title 判軟性 404」**——
// 那會在所有 SPA 上誤報：reservation.pc.gc.ca 的深層連結靜態 HTML 一律是
// title「Home Page」（title 由前端設定），照 title 判會把好連結全部判死。
// 通則：偵測要抓「內容明確說自己不是那個網站」，不要抓「內容看起來不像」。
const PARKED = ['is for sale', 'hugedomains', 'buy this domain', 'domain is parked',
  'this domain may be for sale', 'domain for sale'];
function looksParked(bodyText) {
  const b = String(bodyText || '').slice(0, 20000).toLowerCase();
  return PARKED.some(function (sig) { return b.indexOf(sig) !== -1; });
}
const SKIP = ['google.com/maps', 'uri.amap.com', 'maps.apple.com', 'unpkg.com',
  'tile.openstreetmap.org', 'openstreetmap.org/copyright'];

// 序列跑 90 個連結 × 25 秒逾時 = 可能要半小時，實務上沒人會等。
// 併發 8 條、逾時 15 秒，整份頁面約 30 秒內跑完。
// 併發別開太高——同一站台被同時打太多次會回 403，那是自找的假警報。
const CONCURRENCY = 8;
function curl(url, head, ua) {
  return new Promise((resolve) => {
    const args = ['-sS', '-o', '/dev/null', '-L', '--max-time', '15', '-A', ua || UA, '-w', '%{http_code}'];
    if (head) args.push('--head');
    args.push(url);
    execFile('curl', args, { encoding: 'utf8' }, (err, stdout) => {
      resolve((stdout || '').trim() || '000');
    });
  });
}
async function pool(items, worker, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await worker(items[k]); }
  }));
  return out;
}

function fetchBody(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '-L', '--max-time', '15', '-A', UA, url],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => resolve(stdout || ''));
  });
}
const parkedCache = new Map();
async function parkedAt(u) {
  let host;
  try { host = new URL(u).host; } catch (e) { return false; }
  if (parkedCache.has(host)) return parkedCache.get(host);   // 同網域只抓一次
  const r = looksParked(await fetchBody(u));
  parkedCache.set(host, r);
  return r;
}

// 匯出純函式讓 probe.js 能離線證明這條檢查會叫（不需要外網）。
// 加一條沒被證明會叫的檢查，等於給自己「被守著」的錯覺。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { looksParked: looksParked };
}

// ---- 以下是 CLI。**必須有 require.main 守衛**：沒有它，probe.js 一 require 進來
// ---- 就會把整支 CLI 跑起來（印出用法然後 process.exit(2)）。這個洞是加匯出時才踩到的。
if (require.main !== module) return;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：node assets/check-links.js <生成的.html> [...]');
  process.exit(2);
}

const urls = new Set();
files.forEach((f) => {
  const s = fs.readFileSync(f, 'utf8');
  (s.match(/https?:\/\/[^\s"'<>)\\]+/g) || []).forEach((u) => {
    u = u.replace(/[.,;]+$/, '');
    if (!SKIP.some((x) => u.indexOf(x) !== -1)) urls.add(u);
  });
});

const list = [...urls].sort();
console.log(`檢查 ${list.length} 個外部連結（已跳過地圖類，併發 ${CONCURRENCY}）…`);

(async () => {
const codes = await pool(list, async (u) => {
  let code = await curl(u, true);
  if (!/^[23]/.test(code)) code = await curl(u, false);   // HEAD 失敗改用 GET
  if (/^[23]/.test(code)) return (await parkedAt(u)) ? 'PARKED' : code;
  // ③ 換一個更短的 UA 再試。**這是實測出來的：**有些 WAF 專門擋完整的 Chrome UA
  //   字串，對 'Mozilla/5.0' 或 'curl/8' 卻正常放行。
  //     https://smithbilthats.com/  完整 Chrome UA → 403 ／ 'Mozilla/5.0' → 200（重測 3 次都是 200）
  //     https://tavern1883.com/     同上
  //   一次跑下來 6 個可疑連結裡有 2 個是這樣，也就是三分之一的警告是我們自己造成的。
  //   誤報的代價不只是浪費時間：它會讓人去「修」本來好的連結，把好網址換成更差的。
  const alt = await curl(u, false, UA_ALT);
  if (/^[23]/.test(alt)) return (await parkedAt(u)) ? 'PARKED' : alt;
  return alt;
}, CONCURRENCY);
const bad = list.map((u, k) => [u, codes[k]]).filter(([, c]) => !/^[23]/.test(c));

if (bad.length === list.length && list.length > 2) {
  console.log('⚠️ 全部連結都失敗 —— 這幾乎一定是當前環境沒有外網，而不是連結都壞了。');
  console.log('   請在有網路的環境重跑，或人工抽查幾個。**不要據此修改頁面上的連結。**');
  process.exit(0);
}

console.log(`${list.length - bad.length} 個正常`);
if (!bad.length) { console.log('✓ 全部連結可達'); process.exit(0); }
const parked = bad.filter(([, c]) => c === 'PARKED');
const rest = bad.filter(([, c]) => c !== 'PARKED');
if (parked.length) {
  console.log(`\n❌ 域名已被停放 ${parked.length} 個（回 200，內容是「此域名待售」）—— 這是確定的壞連結，必須換掉：`);
  parked.forEach(([u]) => console.log(`  ${u}`));
}
if (rest.length) {
  console.log(`\n可疑連結 ${rest.length} 個（已用兩種 UA 各試過）：`);
  rest.forEach(([u, c]) => console.log(`  ${c}  ${u}`));
}
console.log('\n判讀提示：404 與 DNS 解析失敗幾乎確定是真的壞（要換掉或降級成地圖搜尋）；');
console.log('403 / 503 / 530 / 000 常是防爬或地區限制，**先在別的網路確認再動手**——');
console.log('把環境限制當成內容問題去改，只會把好連結換成更差的。');
process.exit(1);
})();
