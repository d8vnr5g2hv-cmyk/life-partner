// Life Partner — 秘書室（予定・やること・お願い・仕事メモ・お金・貯金箱）
'use strict';
const Desk = (() => {
  let showAll = false;
  const row = (inner, cls = '', attr = '') => `<div class="row ${cls}" ${attr}>${inner}</div>`;

  async function render() {
    const k = DUTY, o = OSHI[k];
    const hero = $('deskHero'); Pic.bg(hero, o.art || o.title[1], k, '秘書室の絵が届いたら差し込み');
    $('deskWho').textContent = `今日の秘書：${o.name}`;
    // 予定
    const pl = Data.plans(D.today(), 30);
    $('dPlan').innerHTML = pl.length ? pl.slice(0, showAll ? 30 : 6).map(r => row(`<span class="t">${D.label(r.date)}${r.time ? '<br>' + r.time : ''}</span><span class="x">${esc(r.text)}</span>`, '', `data-edit="${r.id}"`)).join('')
      + (pl.length > 6 && !showAll ? `<button class="more" data-more>ほか${pl.length - 6}件</button>` : '') : '<p class="mini">予定はまだありません。「金曜19時 坂井さん」のように入れてください。</p>';
    // 今日の3つ
    const t3 = Data.today3(), all = Data.todos().filter(r => r.kind !== 'ask');
    $('dTodo').innerHTML = (t3.length ? t3.map(r => row(`<span class="chk" data-done="${r.id}"></span><span class="x">${esc(r.text)}</span><span class="t">${r.due ? (r.due < D.today() ? '<em>期限切れ</em>' : D.label(r.due)) : ''}</span>`, '', `data-edit="${r.id}"`)).join('') : '<p class="mini">今日のやることはありません。</p>')
      + (all.length > 3 ? `<p class="mini">ほかに${all.length - 3}件あります（エレンが3つに絞っています）</p>` : '');
    // お願い
    const as = Data.asks();
    $('dAsk').innerHTML = as.length ? as.map(r => row(`<span class="chk" data-done="${r.id}"></span><span class="x">${esc(r.text)}</span><span class="t">${r.due ? D.label(r.due) : ''}</span>`, '', `data-edit="${r.id}"`)).join('') : '<p class="mini">「〜しといて」「〜考えといて」で頼めます。</p>';
    // 仕事メモ・片付けた記録
    const wk = Data.of('work').slice(-4).reverse();
    $('dWork').innerHTML = wk.length ? wk.map(r => row(`<span class="t">${D.md(r.date)}</span><span class="x">${esc(r.text)}</span>`, '', `data-edit="${r.id}"`)).join('') : '<p class="mini">今の仕事の内容や、最近やったことを入れておくと、相談に乗るときに使います。</p>';
    const dn = Data.doneSince(D.week());
    $('dDone').innerHTML = `<b class="big1">${dn.length}</b><span>件（今週）</span>` + (dn.length ? `<p class="mini">${dn.slice(-3).reverse().map(r => '✓ ' + esc(r.text)).join('<br>')}</p>` : '');
    money();
  }
  function money() {
    const m = Data.moneyNow();
    $('dMoney').innerHTML = m.set ? `<div><small>給料日まで</small><b>${m.days}日</b></div><div><small>1日に使える</small><b>${yen(m.perDay)}</b></div><div><small>手元の残り</small><b>${yen(m.left)}</b></div>`
      : `<div><small>給料日まで</small><b>${m.days}日</b></div><div style="flex:2"><small>手元の残りが未設定</small><b style="font-size:13px">「財布3000円」と入れるか、設定から</b></div>`;
    $('dPay').innerHTML = m.occ.length ? m.occ.map(o => {
      const soon = !o.paidNow && D.diff(D.today(), o.due) <= 3;
      return row(`<span class="chk" data-pay="${o.id}"></span><span class="x">${esc(o.name)}</span><span class="t ${soon ? 'soon' : ''}">${o.paidNow ? '今月は払った' : D.md(o.due)} ${yen(o.amt)}</span>`, o.paidNow ? 'done' : '');
    }).join('') : '<p class="mini">「家賃 27日 6万」のように入れると、毎月の支払いに入ります。</p>';
    $('pigN').textContent = yen(m.pig);
  }
  async function pig(n) {
    const v = await Data.pigAdd(n); Sound.se('coin'); haptic();
    const lines = ['やった☆ 先生、えらいえらい！', `${yen(n)}でも、ちゃんと増えてるよ☆`, `これで${yen(v)}！ 先生と一緒だと楽しいね`, 'えへへ、先生のそういうとこ好きだよ☆'];
    $('pigSay').innerHTML = `${Face.img('mika', 'smile', 'xs')}<b>ミカ</b>　${esc(lines[Math.floor(Math.random() * lines.length)])}`; $('pigSay').style.display = '';
    money();
  }
  // 1件を直す・消す
  function edit(id) {
    const r = Data.get(id); if (!r) return;
    const el = h(`<div class="sheet on"><div class="in"><b>${esc(DOMAINS[r.domain])}</b>
      <input id="eT" value="${esc(r.text)}">
      ${r.domain === 'plan' ? `<div class="two"><input id="eD" type="date" value="${r.date}"><input id="eTm" type="time" value="${r.time || ''}"></div>` : ''}
      ${r.domain === 'todo' ? `<div class="two"><label class="mini">期限</label><input id="eDue" type="date" value="${r.due || ''}"></div>` : ''}
      <div class="sheet-b"><button class="btn w" data-a="del"><span>消す</span></button>${r.domain === 'todo' ? '<button class="btn w" data-a="drop"><span>やめる</span></button>' : ''}<button class="btn" data-a="ok"><span>保存</span></button></div></div></div>`);
    el.onclick = async e => {
      if (e.target === el) return el.remove();
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'del') await Data.remove(id);
      if (a.dataset.a === 'drop') await Data.update(id, { status:'drop' });
      if (a.dataset.a === 'ok') { const p = { text:$('eT').value }; if ($('eD')) { p.date = $('eD').value || r.date; p.time = $('eTm').value; } if ($('eDue')) p.due = $('eDue').value; await Data.update(id, p); }
      el.remove();
    };
    $('app').appendChild(el);
  }
  function bind() {
    $('desk').addEventListener('click', async e => {
      const d = e.target.closest('[data-done]'); if (d) { e.stopPropagation(); const r = Data.get(d.dataset.done); await Data.update(r.id, { status:'done', doneAt:new Date().toISOString() }); Sound.se('ok'); haptic(); praise(r); checkAlbum(); return; }
      const p = e.target.closest('[data-pay]'); if (p) {
        const o = Data.moneyNow().occ.find(x => x.id === p.dataset.pay); if (!o) return;
        const ymNow = D.today().slice(0, 7);
        await Data.payToggle(o.paidNow ? Object.assign({}, o, { ym:ymNow }) : o); Sound.se('tap'); return;
      }
      if (e.target.closest('[data-more]')) { showAll = true; render(); return; }
      const ed = e.target.closest('[data-edit]'); if (ed) return edit(ed.dataset.edit);
      const add = e.target.closest('[data-add]'); if (add) return Input.open(add.dataset.add);
      const pg = e.target.closest('[data-pig]'); if (pg) return pig(+pg.dataset.pig);
      if (e.target.closest('[data-money]')) return Settings.open('money');
    });
  }
  // 片付けたら、当番がひとこと
  function praise(r) {
    const k = DUTY, o = OSHI[k];
    const L = { mika:['やったね先生☆', 'ようへい先生、えらい！'], hoshino:['うへ〜、えらいえらい〜', '先生、やるじゃん〜'], ellen:['ん、おつかれ', '……やるじゃん、よーへー'], azurite:['お見事です、陛下', 'さすがは陛下です'] }[k] || ['おつかれさま'];
    toast(`${o.name}「${L[Math.floor(Math.random() * L.length)]}」`);
  }
  async function checkAlbum() { if (Data.doneSince(D.week()).length === 10) Album.add('ellen', '1週間で10件片付けた'); }
  return { render, bind };
})();
