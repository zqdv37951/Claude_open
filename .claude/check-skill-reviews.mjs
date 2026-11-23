#!/usr/bin/env node
// 審查登記檢查：這個 repo 裡「Claude 會讀取或執行」的項目，是不是都審查過、而且審查之後沒有被改過。
//
// 登記檔：.claude/skill-reviews.json（每個項目一筆：內容指紋、結論、依據、注意事項）。
// 標記綁定「內容指紋」——項目裡任何一個檔案被新增、刪除或修改，指紋就不同，標記立刻失效（STALE），
// 必須重新審查後再用 --mark 重新標記。新出現但沒登記的項目是 UNREVIEWED。
//
// 用法（在 repo 任何位置執行都行）：
//   node .claude/check-skill-reviews.mjs                 檢查；有 STALE／UNREVIEWED／MISSING 就退出碼 1
//   node .claude/check-skill-reviews.mjs --strict        連 CAUTION（有條件通過）也當成失敗
//   node .claude/check-skill-reviews.mjs --remote        另外用 git ls-remote 檢查外掛上游是否已經前進（需要網路）
//   node .claude/check-skill-reviews.mjs --mark <id> --verdict APPROVE|CAUTION|REJECT --summary "<一句話>" [--ref <commit>]
//                                                         重新審查完之後，重算指紋並更新那一筆。這一步是「人或 Claude 真的讀過」的聲明，
//                                                         不是用來讓檢查變綠的快捷鍵。
//
// 標記的意思：ok＝APPROVE（沒問題）；caution＝CAUTION（有敏感行為，但有文件說明、有界限、使用者可控，附注意事項）；
// reject＝REJECT。只有 APPROVE 才是「沒問題」。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const REG = path.join(here, 'skill-reviews.json');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };

const SKIP = new Set(['.git', '.DS_Store', '__pycache__', 'node_modules']);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function walk(abs, rel = '') {
  const st = fs.statSync(abs);
  if (st.isFile()) return [[rel || path.basename(abs), sha(fs.readFileSync(abs))]];
  const out = [];
  for (const name of fs.readdirSync(abs).sort()) {
    if (SKIP.has(name) || name.endsWith('.pyc')) continue;
    out.push(...walk(path.join(abs, name), rel ? rel + '/' + name : name));
  }
  return out;
}
function digestOf(relPath) {
  const abs = path.join(root, relPath);
  if (!fs.existsSync(abs)) return null;
  const lines = walk(abs).map(([p, h]) => p + '\t' + h).join('\n');
  return sha(Buffer.from(lines));
}

const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
const byId = new Map(reg.items.map((i) => [i.id, i]));

// --- 重新標記
if (opt('mark')) {
  const id = opt('mark'), verdict = opt('verdict'), summary = opt('summary');
  const it = byId.get(id);
  if (!it) { console.error('找不到項目 ' + id); process.exit(2); }
  if (!['APPROVE', 'CAUTION', 'REJECT'].includes(verdict) || !summary) {
    console.error('--mark 需要 --verdict APPROVE|CAUTION|REJECT 和 --summary "<一句話>"'); process.exit(2);
  }
  if (it.path) it.digest = digestOf(it.path);
  if (opt('ref')) it.pinnedRef = opt('ref');
  it.verdict = verdict; it.mark = { APPROVE: 'ok', CAUTION: 'caution', REJECT: 'reject' }[verdict];
  it.summary = summary; it.reviewedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
  console.log(`已重新標記 ${id}：${verdict}（${it.mark}）。這代表你已經重新讀過它的內容。`);
  process.exit(0);
}

let bad = 0, warn = 0;
const row = (tag, id, msg) => console.log(`${tag.padEnd(10)} ${id}${msg ? '  — ' + msg : ''}`);

// --- 已登記的項目
for (const it of reg.items) {
  if (it.path) {
    const d = digestOf(it.path);
    if (d === null) { row('MISSING', it.id, '登記了但檔案不存在：' + it.path); bad++; continue; }
    if (d !== it.digest) { row('STALE', it.id, '內容在審查之後被改過，標記失效，需要重新審查（' + it.path + '）'); bad++; continue; }
  }
  if (it.mark === 'reject') { row('REJECT', it.id, it.summary); bad++; continue; }
  if (it.mark === 'caution') { row('CAUTION', it.id, '有條件通過：' + it.summary); warn++; if (flag('strict')) bad++; continue; }
  row('OK', it.id, it.pinnedRef ? '釘在 ' + String(it.pinnedRef).slice(0, 10) : '');
}

// --- 有沒有「新出現但沒登記」的項目
const known = new Set(reg.items.map((i) => i.id));
const found = [];
const list = (d) => (fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).filter((n) => !SKIP.has(n)) : []);
for (const n of list('.claude/skills')) found.push([`skill:${n}`, `.claude/skills/${n}`]);
for (const d of ['.claude/commands', '.claude/agents', '.claude/hooks']) for (const n of list(d)) found.push([`${d.slice(8)}:${n}`, `${d}/${n}`]);
for (const f of ['.claude/settings.json', '.claude/settings.local.json', '.mcp.json', 'CLAUDE.md', '.claude/CLAUDE.md', '.claude/check-skill-reviews.mjs'])
  if (fs.existsSync(path.join(root, f))) found.push([`file:${f}`, f]);
for (const [id, p] of found) if (!known.has(id)) { row('UNREVIEWED', id, '還沒審查過：' + p); bad++; }

// --- 設定檔啟用的外掛必須都有登記
const settingsPath = path.join(root, '.claude/settings.json');
if (fs.existsSync(settingsPath)) {
  const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  for (const k of Object.keys(s.enabledPlugins || {})) if (!known.has('plugin:' + k)) { row('UNREVIEWED', 'plugin:' + k, '設定檔啟用了，但沒有審查登記'); bad++; }
  for (const [m, v] of Object.entries(s.extraKnownMarketplaces || {})) {
    const repo = v.source && v.source.repo;
    const covered = reg.items.some((i) => i.source && i.source.repo === repo);
    if (repo && !covered) { row('UNREVIEWED', 'marketplace:' + m, '來源 ' + repo + ' 沒有對應的審查登記'); bad++; }
  }
}

// --- 外掛上游有沒有前進（要網路）
if (flag('remote')) {
  for (const it of reg.items.filter((i) => i.source && i.source.repo && i.pinnedRef)) {
    const r = spawnSync('git', ['ls-remote', `https://github.com/${it.source.repo}`, 'HEAD'], { encoding: 'utf8', timeout: 60000 });
    const head = (r.stdout || '').split(/\s+/)[0];
    if (!head) { row('REMOTE?', it.id, '查不到上游 HEAD（沒網路或被擋）'); continue; }
    if (head !== it.pinnedRef) { row('UPSTREAM', it.id, `上游已前進：審查時 ${it.pinnedRef.slice(0, 10)}，現在 ${head.slice(0, 10)}——需要重新審查`); bad++; }
    else row('OK', it.id, '上游仍是審查過的版本');
  }
}

console.log(`\n${reg.items.length} 項登記；${bad ? bad + ' 項需要處理' : '全部目前有效'}${warn ? `；${warn} 項是有條件通過（CAUTION）` : ''}`);
process.exit(bad ? 1 : 0);
