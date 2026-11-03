// Life Partner — 一言入力（＋）と復唱。どこから入れても同じ記録に入る
'use strict';
const Input = (() => {
  let hint = '', busy = false, last = [];

  // ===== AIがないときの簡易の振り分け =====
  const NUM = /([0-9０-９,，.]+)\s*(万|千)?\s*円?/;
  const toNum = s => Number(String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[,，]/g, ''));
  function amountOf(t) {
    const z = String(t).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    let m = z.match(/([0-9][0-9,.]*)\s*(万|千)?\s*円/) || z.match(/([0-9][0-9,.]*)\s*(万|千)/);
    if (m) { let n = toNum(m[1]); if (m[2] === '万') n *= 10000; if (m[2] === '千') n *= 1000; return Math.round(n) || null; }
    // 単位なしの数字：時刻・日付・回数ではなく、50以上のもの
    const all = [...z.matchAll(/(^|[^0-9\/:：])([0-9][0-9,]*)(?![0-9,]*\s*(時|日|月|分|半|曜|回|:|：|\/|人|個|件|h|時間))/g)].map(x => toNum(x[2])).filter(n => n >= 50);
    return all.length ? all[all.length - 1] : null;
  }
  function dateOf(t) {
    const td = D.today();
    if (/あさって/.test(t)) return D.add(td, 2);
    if (/明日|あした/.test(t)) return D.add(td, 1);
    if (/今日|きょう|今夜/.test(t)) return td;
    let m = t.match(/(\d{1,2})[\/月](\d{1,2})日?/);
    if (m) { const y = new Date().getFullYear(); let k = `${y}-${p2(+m[1])}-${p2(+m[2])}`; if (k < D.add(td, -30)) k = `${y + 1}-${p2(+m[1])}-${p2(+m[2])}`; return k; }
    m = t.match(/(月|火|水|木|金|土|日)曜/);
    if (m) { const w = '日月火水木金土'.indexOf(m[1]); if (/来週/.test(t)) return D.add(D.week(td), 7 + (w + 6) % 7); const n = (w - D.parse(td).getDay() + 7) % 7; return D.add(td, n || 7); }
    return null;
  }
  function timeOf(t) { const m = t.match(/(\d{1,2})\s*(?::|：|時)\s*(\d{2})?(半)?/); if (!m || +m[1] > 29) return ''; return `${p2(+m[1])}:${m[3] ? '30' : p2(+(m[2] || 0))}`; }
  function parseLocal(text) {
    let t = text.trim();
    const us = Data.usuals();
    if (/いつもの/.test(t) && us.length) { const u = us.find(x => x.domain === 'food') || us[0]; t = t.replace(/いつもの/, u.text); }
    const amt = amountOf(t), date = dateOf(t), time = timeOf(t), items = [];
    if (/財布|手元|残高|残り/.test(t) && amt) return { items:[{ domain:'money', kind:'cash', text:`手元の残り ${yen(amt)}`, amt }], echo:`手元${yen(amt)}に合わせたよ` };
    if (/毎月/.test(t) || (/家賃|返済|ローン|代|サブスク/.test(t) && /\d+日/.test(t) && amt)) {
      const day = +(t.match(/(\d{1,2})日/) || [0, 27])[1], name = t.replace(/毎月|\d{1,2}日|[0-9０-９,，]+\s*(万|千)?\s*円?/g, '').trim() || '支払い';
      return { items:[{ domain:'money', kind:'pay', text:name, amt, pay:{ name, day, amt } }], echo:`毎月${day}日の「${name}」を支払い予定に入れたよ` };
    }
    const healthy = /しんど|疲れ|眠い|頭痛|頭が痛|体調|寝不足|だるい|熱っぽ|風邪/.test(t);
    if (/しといて|やっといて|考えといて|言っといて|教えて/.test(t)) items.push({ domain:'todo', kind:'ask', text:t, due:date || '' });
    else if (/まで/.test(t)) items.push({ domain:'todo', kind:'todo', text:t.replace(/^.*?まで\s*/, '') || t, due:date || D.today() });
    else if (healthy && !time) items.push({ domain:'health', kind:'mood', text:t });
    else if (/給料|入金|もらった|収入/.test(t) && amt) items.push({ domain:'money', kind:'in', text:t, amt });
    else if (amt && !time) {
      items.push({ domain:'money', kind:'out', text:t, amt });
      if (/食|飯|ラーメン|弁当|カフェ|コーヒー|昼|夜|朝|出前|酒|ビール/.test(t)) items.push({ domain:'food', kind:'food', text:t.replace(/[0-9０-９,，]+\s*(万|千)?\s*円?\s*$/, '').trim() || t, state:'sure' });
    } else if (date || time) items.push({ domain:'plan', kind:'plan', text:t.replace(/今日|明日|あさって|(\d{1,2})[\/月](\d{1,2})日?|来週|(月|火|水|木|金|土|日)曜日?|\d{1,2}\s*(?::|：|時)\s*(\d{2})?半?(から)?/g, '').trim() || t, date:date || D.today(), time });
    else if (/食べた|飲んだ|ラーメン|ご飯|昼|朝食|夕食|出前|チーズ/.test(t)) items.push({ domain:'food', kind:'food', text:t });
    else if (/やる|やらな|出す|返信|提出|買う/.test(t)) items.push({ domain:'todo', kind:'todo', text:t, due:date || '' });
    else items.push({ domain:hint && DOMAINS[hint] ? hint : 'other', kind:'', text:t });
    const it = items[0];
    const echo = it.domain === 'plan' ? `${D.label(it.date)}${it.time ? 'の' + it.time : ''}「${it.text}」ね。前の日に言うね`
      : it.domain === 'todo' ? (it.kind === 'ask' ? `「${t}」、引き受けたよ。お願いしたことに入れとくね` : `「${it.text}」、やることに入れたよ${it.due ? `。${D.label(it.due)}まで` : ''}`)
      : it.domain === 'money' ? `${yen(it.amt)}${it.kind === 'in' ? '入ったんだね' : 'ね'}。`
      : it.domain === 'food' ? `「${it.text}」ね、ご飯に入れたよ`
      : it.domain === 'health' ? 'そっか……今日は早めに休もうね。体調に入れとく'
      : `「${t}」、覚えとくね`;
    return { items, echo };
  }

  // ===== 保存 =====
  async function save(items, src = 'input') {
    const saved = [];
    for (const x of items || []) {
      if (!x || !x.text && !x.amt) continue;
      if (x.kind === 'cash' && x.amt != null) { await Data.setCash(x.amt); saved.push(await Data.add({ domain:'money', kind:'cash', text:x.text || `手元 ${yen(x.amt)}`, src }, true)); continue; }
      if (x.kind === 'pay' && x.pay) {
        const m = Data.money(); m.pays.push({ id:uid(), name:String(x.pay.name || x.text).slice(0, 20), day:Math.min(31, Math.max(1, +x.pay.day || 27)), amt:Math.round(+x.pay.amt || +x.amt || 0) });
        await Data.saveMoney(); saved.push({ domain:'money', kind:'pay', text:x.text, amt:x.amt, virtual:true }); continue;
      }
      saved.push(await Data.add({ domain:x.domain, kind:x.kind || '', text:x.text, amt:x.amt, date:x.date || D.today(), time:x.time || '', due:x.due || '', state:x.state || 'sure', src }, true));
    }
    return saved;
  }

  // ===== 画面 =====
  function open(h0 = '') {
    hint = h0; Sound.wake();
    const us = Data.usuals();
    $('inUsual').innerHTML = us.length ? us.map((u, i) => `<button data-u="${i}">${esc(u.text)}</button>`).join('') : '';
    $('inHint').textContent = h0 && DOMAINS[h0] ? `「${DOMAINS[h0]}」として入れます` : '予定・お金・ご飯・やること、なんでも一言で';
    $('inSheet').classList.add('on');
    setTimeout(() => $('inText').focus(), 60);
  }
  function close() { $('inSheet').classList.remove('on'); $('inText').blur(); }

  async function submit(text, img) {
    if (busy) return; text = (text || '').trim(); if (!text && !img) return;
    busy = true; close(); $('inText').value = '';
    const k = DUTY;
    showEcho(k, '……', 'normal', [], true);
    let r = null;
    if (Api.ready()) {
      const domains = Data.pick(text || '写真');
      r = await Api.call(img ? 'photo' : 'sort', { text, img, hint, duty:k, usual:Data.usualText(), ctx:Data.context(domains, 6), snap:Data.snapshot() });
    }
    if (!r || !Array.isArray(r.items)) { if (img) { busy = false; hideEcho(); toast('写真から読み取るには、AIの設定が必要です'); return; } r = parseLocal(text); r.face = 'smile'; }
    const saved = await save(r.items, img ? 'photo' : 'input');
    last = saved.filter(x => !x.virtual);
    Data.touch();   // 画面とGASへ
    showEcho(k, r.echo || '覚えたよ', r.face || 'smile', saved);
    Sound.se('ok'); haptic();
    busy = false;
    // いつもの候補
    for (const s of last) { const c = await Data.usualCandidate(s); if (c) { await sleep(1800); if (await ask(`「${c.text}」、よく${c.domain === 'play' ? 'やってる' : '食べてる'}みたい。「いつもの」に入れとく？`, '入れる', 'いいえ', k)) { await Data.setUsual(Data.usuals().concat([{ id:uid(), text:c.text, domain:c.domain }])); toast('「いつもの」に入れました'); } break; } }
    // 割り込みを見直す
    Home.refresh();
  }

  // ===== 復唱 =====
  let echoT = 0;
  function showEcho(k, text, face, saved, wait) {
    const e = $('echo');
    e.innerHTML = `<div class="bubble echo-b">${Face.img(k, face, 'sm')}<div class="echo-t"><b>${esc(OSHI[k].name)}</b>
      <p>${saved.map(s => `<span class="tag">${esc(s.kind === 'pay' ? '支払い' : s.kind === 'cash' ? '手元' : s.kind === 'ask' ? 'お願い' : DOMAINS[s.domain] || '記録')}</span>`).join('')}${wait ? '<span class="dots"><i></i><i></i><i></i></span>' : esc(text)}</p>
      ${wait || !last.length ? '' : '<small>違っていたら、ここをタップして直す</small>'}</div></div>`;
    e.className = 'on'; clearTimeout(echoT);
    if (!wait) echoT = setTimeout(hideEcho, 6000);
  }
  function hideEcho() { $('echo').className = ''; }

  // ===== 直す =====
  function fix() {
    if (!last.length) return hideEcho();
    hideEcho();
    const opts = Object.entries(DOMAINS).filter(([k]) => k !== 'proposal').map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const el = h(`<div class="sheet on" id="fixSheet"><div class="in"><b>直す</b>
      ${last.map((r, i) => `<div class="fixr" data-i="${i}"><select>${opts}</select><input value="${esc(r.text)}"><input class="amt" inputmode="numeric" placeholder="金額" value="${r.amt || ''}"><button class="del" data-del="${i}">消す</button></div>`).join('')}
      <div class="sheet-b"><button class="btn w" data-x><span>やめる</span></button><button class="btn" data-ok><span>保存</span></button></div></div></div>`);
    el.querySelectorAll('.fixr').forEach((row, i) => { row.querySelector('select').value = last[i].domain; });
    el.onclick = async e => {
      if (e.target === el || e.target.closest('[data-x]')) return el.remove();
      const d = e.target.closest('[data-del]'); if (d) { const i = +d.dataset.del; await Data.remove(last[i].id); d.parentNode.remove(); last[i] = null; return; }
      if (e.target.closest('[data-ok]')) {
        for (const row of el.querySelectorAll('.fixr')) { const r = last[+row.dataset.i]; if (!r) continue; const [s, t, a] = [row.querySelector('select'), row.querySelector('input'), row.querySelector('.amt')]; await Data.update(r.id, { domain:s.value, text:t.value, amt:a.value ? Number(a.value) : null }); }
        last = last.filter(Boolean); el.remove(); toast('直しました'); Data.touch();
      }
    };
    $('app').appendChild(el);
  }

  // ===== 写真（長い辺を1024pxに縮めて送る） =====
  function photo(file) {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      submit($('inText').value || '', c.toDataURL('image/jpeg', .8).split(',')[1]);
    };
    img.src = url;
  }

  function bind() {
    $('fab').onclick = () => open('');
    $('inSheet').onclick = e => { if (e.target === $('inSheet')) close(); const u = e.target.closest('[data-u]'); if (u) { const x = Data.usuals()[+u.dataset.u]; const i = $('inText'); i.value = (i.value ? i.value + ' ' : '') + x.text; i.focus(); } };
    $('inForm').onsubmit = e => { e.preventDefault(); submit($('inText').value); };
    $('inPhoto').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) { close(); photo(f); } };
    $('echo').onclick = fix;
  }
  return { bind, open, close, submit, parseLocal };
})();
