// 出發前提醒：截止日期計算 + 渲染。瀏覽器與 Node 雙用。

// startDateISO: 'YYYY-MM-DD'；items: [{item, leadDays}]
// 返回按 deadline 升序的 [{item, leadDays, deadline}]，deadline 為 'YYYY-MM-DD'
// 用 UTC 做日期運算，避免本地時區導致的偏移。
function computeReminders(startDateISO, items) {
  return items
    .map(function (it) {
      var d = new Date(startDateISO + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - it.leadDays);
      return { item: it.item, leadDays: it.leadDays, deadline: d.toISOString().slice(0, 10) };
    })
    .sort(function (a, b) {
      return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
    });
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderChecklistHTML(reminders) {
  var lis = reminders.map(function (r) {
    return '<li class="todo-item">'
      + '<input type="checkbox"> '
      + '<span class="todo-deadline">' + r.deadline + '前</span> '
      + '<span class="todo-text">' + escapeHTML(r.item) + '（建議提前' + r.leadDays + '天）</span>'
      + '</li>';
  }).join('');
  return '<ul class="pretrip-todo">' + lis + '</ul>';
}

// 時間軸上的「這一站要先訂」徽章。
//
// opts（可選）：{ kind: 'ticket' | 'reserve' | 'permit', url: '官方訂票／訂位頁' }
//
// 為什麼把「要訂什麼」跟「去哪訂」做成同一個徽章、而不是兩個元素：讀者是照時間軸走的，
// 他在第五天看到「班夫纜車」時才會想到票的事。若那一刻只看到「建議提前 5 天訂」，
// 他還得回頭翻頁頂待辦清單、再自己去搜官網——中間任何一步斷掉，這條提醒就等於沒有。
// 徽章本身就是連結，落點才會跟需求發生的位置一致。
//
// 不給 opts 時輸出跟舊版完全相同，既有頁面不受影響。
function reminderBadgeHTML(leadDays, opts) {
  var o = opts || {};
  var kind = (o.kind === 'ticket' || o.kind === 'reserve' || o.kind === 'permit') ? o.kind : '';
  var WORD = { ticket: '需購票', reserve: '需訂位', permit: '需通行證' };
  var lead = (typeof leadDays === 'number' && leadDays > 0) ? '建議提前 ' + leadDays + ' 天' : '';
  var text = kind
    ? (lead ? WORD[kind] + ' · ' + lead : WORD[kind])
    : ('⚠️ 建議提前' + leadDays + '天訂');
  var cls = 'reminder-badge' + (kind ? ' ' + kind : '');
  if (o.url) {
    return '<a class="' + cls + '" href="' + escapeHTML(o.url) + '" target="_blank" rel="noopener">'
      + escapeHTML(text) + ' ↗</a>';
  }
  return '<span class="' + cls + '">' + escapeHTML(text) + '</span>';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    computeReminders: computeReminders,
    renderChecklistHTML: renderChecklistHTML,
    reminderBadgeHTML: reminderBadgeHTML,
  };
}
