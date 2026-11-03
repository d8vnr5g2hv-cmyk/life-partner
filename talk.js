// Life Partner — モモトーク（4人と話す・相談する・頼む）
'use strict';
const Talk = (() => {
  let cur = null, listen = false, busy = false;
  const key = k => 'talk:' + k;
  const load = async k => (await DB.get(key(k), { log:[] }));
  async function push(k, text, unread, face) {
    const t = await load(k); t.log.push({ who:k, text, at:Date.now(), unread:!!unread, face }); t.log = t.log.slice(-200); await DB.set(key(k), t);
    if (cur === k && $('chat').classList.contains('on')) draw();
  }
  async function badge() {
    let n = 0; for (const k of ORDER) n += (await load(k)).log.filter(m => m.unread).length;
    $('mtBadge').textContent = n || ''; $('mtBadge').style.display = n ? '' : 'none';
    $('tabTalkN').textContent = n || ''; $('tabTalkN').style.display = n ? '' : 'none';
  }
  async function list() {
    const rows = [];
    for (const k of ORDER) {
      const t = await load(k), last = t.log[t.log.length - 1], un = t.log.filter(m => m.unread).length;
      rows.push(`<div class="row mt-row" data-k="${k}">${Face.img(k, 'normal')}<span class="x"><b>${esc(OSHI[k].name)}</b>${k === DUTY ? '<span class="duty-tag">今日の秘書</span>' : ''}<br><small>${last ? esc(last.text.slice(0, 26)) : 'まだ話していません'}</small></span>${un ? `<em class="un">${un}</em>` : ''}</div>`);
    }
    $('mtList').innerHTML = rows.join('');
  }
  async function open(k, ls = false) {
    cur = k; listen = ls;
    $('chatName').innerHTML = `${esc(OSHI[k].name)}${listen ? '<small>聞くだけモード</small>' : ''}`;
    $('chat').classList.add('on'); $('app').classList.add('chatting');
    const t = await load(k); t.log.forEach(m => { m.unread = false; }); await DB.set(key(k), t); badge();
    if (listen && !t.log.length) await push(k, 'うへ〜、なんでも聞くよ〜。アドバイスはしないから、好きに話して〜');
    draw();
  }
  function close() { $('chat').classList.remove('on'); $('app').classList.remove('chatting'); cur = null; list(); }
  async function draw() {
    const t = await load(cur);
    $('msgs').innerHTML = t.log.map(m => m.who === 'me' ? `<div class="m me">${esc(m.text)}</div>` : `<div class="m-row">${Face.img(cur, m.face || 'normal', 'xs')}<div class="m them">${esc(m.text)}</div></div>`).join('') + (busy ? `<div class="m-row">${Face.img(cur, 'normal', 'xs')}<div class="m them"><span class="dots"><i></i><i></i><i></i></span></div></div>` : '');
    $('msgs').scrollTop = 1e6;
  }
  async function send(text) {
    if (busy || !cur) return; const k = cur;
    const t = await load(k); t.log.push({ who:'me', text:text.slice(0, 500), at:Date.now() }); await DB.set(key(k), t);
    busy = true; draw();
    let r = null;
    if (Api.ready()) r = await Api.call('talk', { who:k, listen, log:t.log.slice(-16).map(m => ({ who:m.who, text:m.text })), ctx:Data.context(Data.pick(text), 10), usual:Data.usualText(), snap:Data.snapshot() });
    busy = false;
    if (!r) r = { lines:[Api.ready() ? '……ごめん、うまく聞き取れなかったみたい' : '（設定でAIをつなぐと、お返事できるようになります）'], face:'normal' };
    for (const l of (r.lines || []).filter(Boolean).slice(0, 4)) await push(k, l, false, r.face);
    // 会話から覚えること・頼まれたこと
    for (const n of (r.notes || []).slice(0, 3)) if (n && n.text && DOMAINS[n.domain]) await Data.add({ domain:n.domain, kind:n.kind || '', text:n.text, date:n.date || D.today(), time:n.time || '', due:n.due || '', amt:n.amt, state:n.state || 'sure', src:'talk' }, true);
    if (r.notes && r.notes.length) Data.touch();
    if (cur === k) { const t2 = await load(k); t2.log.forEach(m => { m.unread = false; }); await DB.set(key(k), t2); }
    draw();
  }
  function bind() {
    $('mtList').onclick = e => { const r = e.target.closest('[data-k]'); if (r) open(r.dataset.k); };
    $('chatBack').onclick = close;
    $('chatForm').onsubmit = e => { e.preventDefault(); const v = $('chatIn').value.trim(); if (v) { $('chatIn').value = ''; send(v); } };
  }
  return { bind, list, open, close, push, badge };
})();
