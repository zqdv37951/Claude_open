#!/usr/bin/env node
// 交叉引用完整性檢查器。
//
// 為什麼需要它：本 skill 的規則散在 4 份權威檔案裡，彼此大量交叉引用。
// 早期用「第 N 節」編號引用，結果每次新增章節都讓舊引用悄悄指錯地方——
// 而且不會報錯：使用者照著 validate.js 的警告訊息去查，查到不相干的內容。
// 改成「檔名 + 井號 + 錨點」之後，這支腳本讓「指錯地方」變成可機械偵測的錯誤。
//
// 本腳本查七件事：
//   ① 交叉引用：每個「檔名 + 井號 + 錨點」引用，對應檔案與錨點都必須存在。
//   ② 檔案清單：每個 .md / .js 都必須登記在 porting 檔案的職責表裡。
//   ③ 數字對帳：文件裡寫的測試數／節數／JS 檔數／標題項數／「N 項檢查」必須跟實際相符。
//   ④ 誤字：簡繁轉換留下的錯字（已經是繁體，用 opencc 反查抓不到）。
//   ⑤ 位置式引用：禁止用序號指路——這是本 skill 第一條維護原則，但過去只靠人記得。
//   ⑥ 同檔錨點連結：markdown 的同檔錨點連結必須真的存在。
//   ⑦ 目錄完整性：有「本檔目錄」的檔案，目錄必須列出它自己全部的錨點。
//   ⑧ 規則只住一個地方：兩份檔案不該有逐字相同的規則句。
//   ⑨ 裸檔名：引用別的檔案時不能省掉 .md（省掉就沒人守得到）。
//   ⑩ 引號章節名：不能用「檔名.md「章節名」」指路，要用錨點。
//   ⑪ 通用適配提示詞：那段要整段貼給別的 Agent 的文字，也必須列出每個檔案。
//
// 用法：node assets/check-refs.js        （在 skill 根目錄或 assets/ 下跑都可以）
// 規則：每個「某檔名.md + 井號 + 錨點」引用，對應檔案必須存在，且該檔案必須有同名 {#...} 標記。
// 注意：本檔自己的說明文字裡不要寫出可被上面 REF 正則匹配的示例檔名，否則會自我誤報。

const fs = require('fs');
const path = require('path');

const SKILL = fs.existsSync(path.join(__dirname, '..', 'SKILL.md'))
  ? path.join(__dirname, '..') : process.cwd();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(md|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SKILL);
const rel = (p) => path.relative(SKILL, p);

// 收集每個 .md 提供的錨點
const anchors = new Map();          // basename -> Set(anchor)
const mdByName = new Map();         // basename -> relative path
for (const f of files.filter((f) => f.endsWith('.md'))) {
  const base = path.basename(f);
  mdByName.set(base, rel(f));
  const set = new Set();
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\{#([\w-]+)\}/g)) set.add(m[1]);
  anchors.set(base, set);
}

// ── 檢查一：交叉引用（檔名 + 井號 + 錨點）都指得到嗎 ──
// 掃描所有引用
const errors = [];
let refCount = 0;
const REF = /([A-Za-z0-9_-]+\.md)(#([\w-]+))?/g;

for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 先把外部 URL 抹掉再比對：外部連結裡的「某檔名.md + 井號 + 錨點」
    // （如 https://example.com/docs/foo.md#bar）不是本地引用，
    // 當成斷鏈會製造假陽性——而假陽性一多，真警告就會被一起忽略。
    const scrubbed = line.replace(/\bhttps?:\/\/\S+/g, ' ');
    for (const m of scrubbed.matchAll(REF)) {
      const [, file, , anchor] = m;
      if (path.basename(f) === file && !anchor) continue;   // 自我提及、無錨點，跳過
      refCount++;
      const at = `${rel(f)}:${i + 1}`;
      if (!mdByName.has(file)) {
        errors.push(`${at}  引用了不存在的檔案 ${file}`);
        continue;
      }
      if (anchor && !anchors.get(file).has(anchor)) {
        const have = [...anchors.get(file)].join(', ') || '（該檔案沒有任何錨點）';
        errors.push(`${at}  ${file}#${anchor} —— 錨點不存在。該檔案現有錨點：${have}`);
      }
    }
  });
}

// ── 檢查二：檔案清單完整性 ──
// 規則（刻意收緊到一句可判定的話）：每個 .md / .js 檔案都必須出現在
// references/porting-to-other-agents.md 的「職責表」裡——那張表就是跨 Agent 使用時的
// manifest，別的 Agent 照它讀檔案。漏登記的後果是真的：本 skill 重構後那張表少了三份
// 契約文件，而「通用適配提示詞」那段是要整段貼給別的 Agent 的，對方讀不到引擎契約就會
// 生出「地圖示記全部隱形」的頁面——這個 bug 已經進過 repo 一次。
//
// 兩個刻意的設計決定：
//  ① 比對**相對路徑**（assets/poi.js）而不是 basename。用 basename 會踩子字串陷阱：
//     'poi.js' 是 'poi.test.js' 的子字串，提到後者會讓前者看起來也登記了。
//  ② **豁免 manifest 自己**。那份檔案在表裡寫的是「本文件」而不是自己的檔名，
//     用檔名比對會永遠誤報。這是唯一的豁免，不要再加別的特例——
//     linter 的特例一多，就代表規則本身不夠清晰。
const MANIFEST = 'references/porting-to-other-agents.md';
const manifestPath = files.find((f) => rel(f) === MANIFEST);
if (!manifestPath) {
  errors.push(`找不到 ${MANIFEST}，無法檢查檔案清單完整性`);
} else {
  const doc = fs.readFileSync(manifestPath, 'utf8');
  // 優先只在「職責表」範圍內找（表頭認這一行）；找不到表就退回全文搜尋。
  const tableStart = doc.indexOf('| 類別 | 檔案 |');
  const scope = tableStart === -1 ? doc
    : doc.slice(tableStart, (() => {
        const after = doc.indexOf('\n\n', tableStart);
        return after === -1 ? doc.length : after;
      })());
  for (const f of files) {
    const r = rel(f).split(path.sep).join('/');
    if (r === MANIFEST) continue;                       // 豁免 ②
    if (!scope.includes(r)) {
      errors.push(`${r} 未登記在 ${MANIFEST} 的職責表裡 —— 別的 Agent 照那張表讀檔案，漏登記等於這個檔案不存在`);
    }
  }
}

// ── 檢查三：文件裡寫的數字是否跟實際相符 ──
// 這類漂移發生過三次：測試數（文件寫 8、實際 14）、節數（寫 12、實際 13）、
// JS 檔數（寫「五個」、實際 8）。文件寫錯數字不會壞任何東西，但會讓讀者不信任整份文件，
// 而且沒有任何機制會發現——所以放進這裡機械對帳。
{
  const mdFiles = files.filter((f) => f.endsWith('.md'));
  const readAll = (f) => fs.readFileSync(f, 'utf8');

  // (a) 每支 *.test.js 的實際測試數 vs 文件裡宣稱的數字
  files.filter((f) => f.endsWith('.test.js')).forEach((tf) => {
    const base = path.basename(tf);
    const actual = (readAll(tf).match(/^test\(/gm) || []).length;
    mdFiles.forEach((mf) => {
      readAll(mf).split('\n').forEach((line, i) => {
        if (!line.includes(base)) return;
        const m = line.match(/(\d+)\s*個(?:回歸|迴歸)?測試|（(\d+)\s*個）/);
        if (!m) return;
        const stated = parseInt(m[1] || m[2], 10);
        if (stated !== actual) {
          errors.push(`${rel(mf)}:${i + 1}  寫 ${base} 有 ${stated} 個測試，實際 ${actual} 個`);
        }
      });
    });
  });

  // (b) page-contract 自稱的節數
  const pc = files.find((f) => path.basename(f) === 'page-contract.md');
  if (pc) {
    const txt = readAll(pc);
    const real = (txt.match(/^## /gm) || []).length;
    const m = txt.match(/共 (\d+) 節/);
    if (m && parseInt(m[1], 10) !== real) {
      errors.push(`page-contract.md 自稱「共 ${m[1]} 節」，實際 ${real} 節`);
    }
  }

  // (c) porting 自稱的 JS 檔數
  const pf = files.find((f) => rel(f) === MANIFEST);
  if (pf) {
    const real = files.filter((f) => f.endsWith('.js')).length;
    const m = readAll(pf).match(/(\d+) 個純 JavaScript/);
    if (m && parseInt(m[1], 10) !== real) {
      errors.push(`${MANIFEST} 自稱「${m[1]} 個純 JavaScript 檔案」，實際 ${real} 個`);
    }
  }


  // (e) 文件裡寫的「N 項檢查」vs check-refs.js 實際有幾個檢查區塊
  // 本輪把檢查從十條加到十一條，五個地方的「十項檢查」全部變成錯的——而且沒有任何
  // 機制會發現。這類數字讀者會當索引用（「第十一項是什麼？」），錯了就查不到。
  {
    const self = files.find((f) => path.basename(f) === 'check-refs.js');
    if (self) {
      const real = (readAll(self).match(/^\/\/ ── 檢查/gm) || []).length;
      const CN2 = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
        十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15 };
      mdFiles.forEach((mf) => {
        readAll(mf).split('\n').forEach((line, i) => {
          for (const m of line.matchAll(/(\d+|[一二三四五六七八九十]{1,3})\s*項檢查/g)) {
            const stated = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : CN2[m[1]];
            if (stated && real && stated !== real) {
              errors.push(rel(mf) + ':' + (i + 1) + '  寫「' + m[0] + '」，check-refs.js 實際有 '
                + real + ' 項');
            }
          }
        });
      });
    }
  }

  // (d) 標題自稱的項數 vs 底下清單／表格的實際項數
  // 「六條不可破的維護原則」「三個花過代價才學到的坑」這種標題最容易在增刪一項時忘記改，
  // 而讀者會拿標題的數字當索引用。本輪就親手製造過一次（六 → 七）。
  // 判定邊界：只在算得出項數（> 0）時才比對；算不出來（純散文段落）就跳過，
  // 寧可漏抓也不要製造假警報——假警報一多，真警告會被一起忽略。
  {
    const CN = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
      十一: 11, 十二: 12, 十三: 13, 十四: 14, 十五: 15 };
    mdFiles.forEach((mf) => {
      const lines = readAll(mf).split('\n');
      lines.forEach((line, i) => {
        const lvl = (line.match(/^#+/) || [''])[0].length;
        if (lvl < 2 || lvl > 3) return;
        // 負向後查排除「哪一條」「第三項」這類不是計數的用法
        const h = line.match(/^#{2,3} .*?(?<![哪第任每單其同另])(\d+|[一二三四五六七八九十]{1,3})\s*(?:條|個|項)/);
        if (!h) return;
        const want = /^\d+$/.test(h[1]) ? parseInt(h[1], 10) : CN[h[1]];
        if (!want) return;
        let ord = 0, bul = 0, row = 0, sep = 0, fence = false;
        for (let j = i + 1; j < lines.length; j++) {
          const L = lines[j];
          if (/^```/.test(L)) { fence = !fence; continue; }
          if (fence) continue;                       // 程式碼區塊裡的清單不算
          const m = L.match(/^#+/);
          if (m && m[0].length >= 2 && m[0].length <= lvl) break;
          if (/^\d+\. /.test(L)) ord++;
          else if (/^[-*] /.test(L)) bul++;
          else if (/^\|/.test(L)) { if (/^\|[\s\-:|]+\|\s*$/.test(L)) sep++; else row++; }
        }
        const got = ord || bul || (row - sep);
        if (got > 0 && got !== want) {
          errors.push(rel(mf) + ':' + (i + 1) + '  標題自稱 ' + want + ' 項，底下實際 ' + got
            + ' 項 —— 讀者會拿標題的數字當索引用');
        }
      });
    });
  }
}

// ── 檢查四：簡繁轉換留下的誤字 ──
// 這類錯誤「已經是繁體」，所以用 opencc 反查（簡→繁）抓不到——它只找簡體字，
// 不會發現「隻有」這種用錯變體的情況。而它們讀起來明顯是錯的，會拖累整份文件的可信度。
// 已知來源：opencc 的 s2twp 把副詞「只」轉成量詞「隻」、把「參數」轉成「引數」
//（後者在講 function argument 時是對的，講「brief 的參數」時是錯的，所以只抓明確的搭配）。
{
  const TYPOS = [
    ['隻有', '只有'], ['隻是', '只是'], ['隻要', '只要'], ['隻能', '只能'],
    ['隻剩', '只剩'], ['隻在', '只在'], ['隻用', '只用'], ['隻好', '只好'],
    ['隻確認', '只確認'], ['隻改', '只改'], ['隻看', '只看'], ['隻管', '只管'],
  ];
  // 本檔要排除：規則表裡就寫著那些錯字，掃自己一定全部命中。
  // 這已經是**第三次**踩到「檢查器比對到自己的規則定義」——
  //   ① 說明註解裡的示例檔名被當成斷鏈；
  //   ② 頁面的錯誤提示含 id="trip-data"，騙過了頁面型別偵測；
  //   ③ 這裡的誤字表。
  // 通則：**凡是「規則本身要寫出被禁止的字串」的檢查，都必須排除定義它的那個檔案。**
  files.filter((f) => path.basename(f) !== 'check-refs.js').forEach((f) => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      TYPOS.forEach(([wrong, right]) => {
        if (line.includes(wrong)) {
          errors.push(`${rel(f)}:${i + 1}  誤字「${wrong}」應為「${right}」（簡繁轉換留下的）`);
        }
      });
    });
  });
}

// ── 檢查五：位置式引用（「第 X 節」「步驟 X」）──
// 本 skill 的第一條維護原則就是「交叉引用一律寫 檔名#錨點，不要用序號」，
// 理由是節號會隨內容增減靜默失效。但這條規則過去只寫在文件裡靠人記得，
// 結果 page-contract.md 與 engine-contract.md 累積了 15 處序號引用，
// 而且抽查的每一處都已經指錯地方（engine-contract 寫的「步驟 4」實際是第 5 步、
// 「步驟 7」實際是第 8 步、「第 3 節」指到的是第 4 節）。
// 通則：**能機械擋的規則，就不要只寫在文件裡。**
// 註：下面的正則刻意不會匹配到自己——「第」與「節」之間是字元類而非字面數字，
//     所以本檔不需要豁免（豁免是特例，特例越少越好）。
{
  const POSREF = /第 *[0-9一二三四五六七八九十]+ *(?:節|章|區塊)|步驟 *[0-9]+/g;
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(POSREF)) {
        errors.push(rel(f) + ':' + (i + 1) + '  位置式引用「' + m[0]
          + '」—— 序號會隨內容增減靜默失效，改寫成 檔名#錨點（或直接寫出章節名稱）');
      }
    });
  }
}

// ── 檢查六：同一份檔案內的 markdown 錨點連結 ──
// 檢查 ① 的正則要求「檔名.md」開頭，所以 [文字](#錨點) 這種同檔連結它完全看不到。
// page-contract.md 的目錄整張表都是這種連結——一整類引用原本沒有任何機制守著。
{
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const have = anchors.get(path.basename(f)) || new Set();
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/\]\(#([\w-]+)\)/g)) {
        refCount++;
        if (!have.has(m[1])) {
          errors.push(rel(f) + ':' + (i + 1) + '  同檔錨點連結 #' + m[1]
            + ' 指不到 —— 本檔現有錨點：' + ([...have].join(', ') || '（無）'));
        }
      }
    });
  }
}

// ── 檢查七：目錄完整性 ──
// 節數對帳（檢查 ③）只保證數字寫對，不保證表列完整。page-contract.md 曾經
// 「共 18 節」寫得完全正確，目錄卻只列 12 節——漏掉的 5 節裡有列印樣式與無障礙底線，
// 讀者從目錄跳轉時等於這些規則不存在。
{
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const txt = fs.readFileSync(f, 'utf8');
    const tocStart = txt.indexOf('## 本檔目錄');
    if (tocStart === -1) continue;
    const rest = txt.slice(tocStart + 1);
    const tocEnd = rest.indexOf('\n## ');
    const toc = tocEnd === -1 ? rest : rest.slice(0, tocEnd);
    const listed = new Set([...toc.matchAll(/\]\(#([\w-]+)\)/g)].map((m) => m[1]));
    for (const a of anchors.get(path.basename(f)) || []) {
      if (!listed.has(a)) {
        errors.push(rel(f) + '  「本檔目錄」漏列 #' + a
          + ' —— 目錄是這份檔案唯一的跳轉入口，漏列等於那一節讀者找不到');
      }
    }
  }
}


// ── 檢查八：同一句規則出現在兩份檔案裡 ──
// 「規則只住一個地方」是本 skill 的組織原則，但過去沒有任何機制守著。
// 抓到過一句：座標取捨的判斷理由同時寫在 page-contract 與 research-guide 裡，
// 逐字相同。兩份拷貝一定會漂移，而讀者只會讀到其中一份。
// 判定邊界：排除程式碼區塊（範例本來就會重複），只看 22 字以上的句子——
// 短句（「見下表」「必做」）重複是正常的排版，不是規則重複。
//
// **為什麼只做逐字比對，不做近似比對**：試過三連字元 Jaccard ≥ 0.55，627 句掃出 18 對，
// 其中只有 2 對是真的規則重複；其餘全是「索引列 vs 正文」或「兩句都含同一個 檔名#錨點」
// 造成的相似度虛高。假警報一多，真警告就會被一起忽略——這條在本 skill 已經是明文原則。
// 近似重複改用人工在審視輪次裡看，不機械化。
{
  const seenIn = new Map();
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const txt = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, ' ');
    for (const raw of txt.split(/[。；\n]/)) {
      const key = raw.replace(/[*`>|\-\s]/g, '');
      if (key.length < 22) continue;
      if (!seenIn.has(key)) seenIn.set(key, new Set());
      seenIn.get(key).add(rel(f));
    }
  }
  for (const [sentence, where] of seenIn) {
    if (where.size > 1) {
      errors.push([...where].join(' 與 ') + ' 有逐字相同的規則句 —— 規則只能住一個地方，'
        + '一份留原文、另一份改成指向它：「' + sentence.slice(0, 40) + '…」');
    }
  }
}

// ── 檢查九：裸檔名引用（少了 .md）──
// 「research-guide 的查證紀律」「page-contract 的 dataSources」這種寫法，
// 檢查 ① 的正則（要求 .md 結尾）完全看不到，等於沒人守。改名或搬檔就靜默失效。
// 只掃 .md：.js 裡 SKILL 是變數名、註解裡也常用簡稱，強制加副檔名沒有意義。
{
  const bases = [...mdByName.keys()].map((b) => b.replace(/\.md$/, ''));
  for (const f of files.filter((x) => x.endsWith('.md'))) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const b of bases) {
        const re = new RegExp('(?<![\\w-])' + b + '(?!\\.md)(?![\\w-])', 'g');
        if (re.test(line)) {
          errors.push(rel(f) + ':' + (i + 1) + '  裸檔名「' + b
            + '」少了 .md —— 這種寫法檢查 ① 抓不到，改名或搬檔會靜默失效');
        }
      }
    });
  }
}

// ── 檢查十：用引號章節名指路，而不是錨點 ──
// 「檔名.md「某章節」」看起來比序號穩，但章節改名一樣會靜默失效，而且機械上驗不了。
// 邊界（刻意的）：只認緊接在檔名後面的「」。像「見 SKILL.md 的「怎麼量才準」」那種
// 指向粗體段落（不是標題）的敘述式引用不在此列——那沒有錨點可指，硬要加等於給粗體字
// 發錨點。要求它們改寫只會製造為了通過檢查而寫的假錨點。
{
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/([A-Za-z0-9_-]+\.md)`?」?「/g)) {
        errors.push(rel(f) + ':' + (i + 1) + '  用引號章節名指向 ' + m[1]
          + ' —— 章節改名就失效，也驗不了。給那一節加 {#錨點} 再寫成 檔名#錨點');
      }
    });
  }
}


// ── 檢查十一：通用適配提示詞也要列出每個檔案 ──
// 檢查 ② 守的是「職責表」，但別的 Agent 實際被貼的是「通用適配提示詞」那一段。
// 兩處都是 manifest，漏在哪一邊都等於那個檔案不存在。實測漏了 6 個，
// 其中 check-links.js 與 probe.js 是文件別處明文寫「必跑」的東西。
// 豁免仍然只有 manifest 自己（那段提示詞就是它，不會自我引用）。
{
  const mf = files.find((x) => rel(x) === MANIFEST);
  if (mf) {
    const doc = fs.readFileSync(mf, 'utf8');
    const from = doc.indexOf('## 通用適配提示詞');
    const to = doc.indexOf('## 適配時最容易翻車');
    if (from !== -1 && to !== -1) {
      const scope = doc.slice(from, to);
      for (const f of files) {
        const r = rel(f).split(path.sep).join('/');
        if (r === MANIFEST) continue;
        if (!scope.includes(r)) {
          errors.push(r + ' 沒有出現在 ' + MANIFEST
            + ' 的「通用適配提示詞」裡 —— 那一段是整段貼給別的 Agent 的，漏列等於對方讀不到這個檔案');
        }
      }
    }
  }
}

const anchorCount = [...anchors.values()].reduce((n, set) => n + set.size, 0);
console.log(`掃描 ${files.length} 個檔案：${refCount} 處交叉引用、${anchorCount} 個錨點、${files.length - 1} 個檔案待登記`);
if (errors.length) {
  errors.forEach((e) => console.error('✗ ' + e));
  console.error(`\n${errors.length} 處問題，必須修復。`);
  process.exit(1);
}
console.log('✓ 十一項檢查通過：交叉引用、檔案清單、數字對帳、誤字、位置式引用、同檔錨點、'
  + '目錄完整性、規則單一住所、裸檔名、引號章節名、適配提示詞清單');
