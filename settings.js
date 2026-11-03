// Life Partner — 設定（ホーム右上の歯車）。ふだんは開かない場所
'use strict';
const Settings = (() => {
  let tab = 'me', dm = 'plan';
  const AREAS = { 大阪:[34.69, 135.50], 東京:[35.68, 139.69], 京都:[35.01, 135.77], 神戸:[34.69, 135.20], 名古屋:[35.18, 136.91], 札幌:[43.06, 141.35], 福岡:[33.59, 130.40] };
  const TABS = { me:'ようへいのこと', money:'お金', usual:'いつもの', app:'アプリ' };

  function open(t) { if (t) tab = t; $('set').classList.add('on'); $('app').classList.add('setting'); render(); }
  function close() { $('set').classList.remove('on'); $('app').classList.remove('setting'); App.refreshAll(); }
  async function render() {
    $('setTabs').innerHTML = Object.entries(TABS).map(([k, v]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('');
    const b = $('setBody');
    if (tab === 'me') {
      const list = Data.of(dm).slice().reverse();
      b.innerHTML = `<p class="mini">会話や一言入力から、分野ごとに増えていきます。違うものは消せます。</p>
        <div class="chips sm">${Object.entries(DOMAINS).map(([k, v]) => `<button data-dm="${k}" class="${k === dm ? 'on' : ''}">${v} ${Data.of(k).length || ''}</button>`).join('')}</div>
        <div class="sec flat">${list.length ? list.slice(0, 80).map(r => `<div class="row"><span class="x">${esc(Data.line(r).slice(1))}<br><small>${r.src === 'talk' ? '会話から' : r.src === 'photo' ? '写真から' : r.src === 'pay' ? '支払い' : '入力'}・${STATES[r.state] || ''}</small></span><button class="del" data-rm="${r.id}">消す</button></div>`).join('') : '<p class="mini">まだありません</p>'}</div>
        <div class="sec flat"><div class="q">この分野に入れる</div><form id="meForm" class="inrow"><input id="meIn" placeholder="例）ベッドは窓際にある"><button class="btn"><span>入れる</span></button></form></div>`;
      $('meForm').onsubmit = async e => { e.preventDefault(); const v = $('meIn').value.trim(); if (!v) return; await Data.add({ domain:dm, text:v, src:'manual' }); render(); };
    }
    if (tab === 'money') {
      const m = Data.money(), mn = Data.moneyNow();
      b.innerHTML = `<div class="sec flat"><div class="q">給料日（毎月）</div><div class="inrow"><input id="mPay" type="number" min="1" max="31" value="${m.payday}"><span>日</span></div>
        <div class="q">手元の残り（今あるお金。財布と口座の、使っていいぶん）</div><div class="inrow"><input id="mCash" type="number" inputmode="numeric" placeholder="${mn.set ? mn.left : '例）30000'}"><button class="btn" id="mCashB"><span>合わせる</span></button></div>
        <p class="mini">${mn.set ? `今の計算では ${yen(mn.left)}（最後に合わせた日：${D.md(m.cash.at.slice(0, 10))}）` : 'まだ設定されていません'}</p></div>
        <div class="sec flat"><div class="q">毎月の支払い</div>${m.pays.map(p => `<div class="row"><span class="x">${esc(p.name)}</span><span class="t">毎月${p.day}日 ${yen(p.amt)}</span><button class="del" data-pdel="${p.id}">消す</button></div>`).join('') || '<p class="mini">まだありません</p>'}
        <form id="payForm" class="inrow3"><input id="pN" placeholder="家賃"><input id="pD" type="number" min="1" max="31" placeholder="27日"><input id="pA" type="number" inputmode="numeric" placeholder="60000"><button class="btn"><span>足す</span></button></form></div>
        <div class="sec flat"><div class="q">ミカの貯金箱</div><p class="mini">今 ${yen(m.pig)}。お金を移したら、手元の残りから引かれます。</p></div>`;
      $('mPay').onchange = async e => { m.payday = Math.min(31, Math.max(1, +e.target.value || 25)); await Data.saveMoney(); toast('給料日を保存しました'); };
      $('mCashB').onclick = async () => { const v = +$('mCash').value; if (!$('mCash').value) return; await Data.setCash(v); toast('手元の残りを合わせました'); render(); };
      $('payForm').onsubmit = async e => { e.preventDefault(); const n = $('pN').value.trim(); if (!n) return; m.pays.push({ id:uid(), name:n, day:Math.min(31, Math.max(1, +$('pD').value || 27)), amt:+$('pA').value || 0 }); await Data.saveMoney(); render(); };
    }
    if (tab === 'usual') {
      const us = Data.usuals();
      b.innerHTML = `<p class="mini">「いつもの」は、毎回AIに渡す「常に覚えていること」です。一言入力で「いつもの」と書くと、これを指します。</p>
        <div class="sec flat">${us.map(u => `<div class="row"><span class="t">${esc(DOMAINS[u.domain] || '')}</span><span class="x">${esc(u.text)}</span><button class="del" data-udel="${u.id}">消す</button></div>`).join('') || '<p class="mini">まだありません。よく出てくるものは、秘書から「いつものに入れる？」と聞きます。</p>'}
        <form id="uForm" class="inrow3"><select id="uD"><option value="food">ご飯</option><option value="food">お酒</option><option value="play">遊び</option><option value="other">ほか</option></select><input id="uT" placeholder="辛ラーメン、チーズ"><button class="btn"><span>足す</span></button></form></div>`;
      $('uForm').onsubmit = async e => { e.preventDefault(); const t = $('uT').value.trim(); if (!t) return; await Data.setUsual(us.concat([{ id:uid(), text:t, domain:$('uD').value }])); render(); };
    }
    if (tab === 'app') {
      const area = await DB.get('area', { name:'大阪' }), skip = await DB.get('skipQ', []);
      b.innerHTML = `<div class="sec flat"><div class="q">AI（GASのウェブアプリ）</div>
          <input id="aU" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(CFG.api && CFG.api.url || '')}">
          <input id="aK" type="password" placeholder="合言葉（ACCESS_KEY）" value="${esc(CFG.api && CFG.api.key || '')}">
          <div class="inrow"><button class="btn" id="aSave"><span>保存</span></button><button class="btn w" id="aTest"><span>つながるか確かめる</span></button></div><p class="mini" id="aMsg"></p></div>
        <div class="sec flat"><div class="q">住んでいるエリア（天気に使います）</div><div class="chips sm">${Object.keys(AREAS).map(n => `<button data-area="${n}" class="${area.name === n ? 'on' : ''}">${n}</button>`).join('')}<button data-area="gps">今いる場所</button></div></div>
        <div class="sec flat"><div class="q">診療所で聞かない質問（習慣でわかるもの）</div><div class="chips sm">${[['sleep', '睡眠'], ['meals', 'ご飯'], ['alcohol', 'お酒'], ['mood', '気分']].map(([k, v]) => `<button data-skip="${k}" class="${skip.includes(k) ? 'on' : ''}">${v}</button>`).join('')}</div></div>
        <div class="sec flat"><div class="q">アプリ</div>
          <div class="row"><span class="x">Face IDでロック</span><button class="sw ${CFG.lock ? 'on' : ''}" id="swLock"></button></div>
          <div class="row"><span class="x">BGM</span><button class="sw ${CFG.bgm ? 'on' : ''}" id="swBgm"></button></div>
          <div class="q">Kani Favoriteの場所（メモロビ動画・ボイスを借ります）</div><input id="fav" value="${esc(CFG.fav)}"><p class="mini">GitHub Pagesで、このアプリから見たFavoriteの場所。例）../kani-favorite/</p></div>
        <div class="sec flat"><div class="q">控え</div><div class="inrow"><button class="btn w" id="ex"><span>書き出す</span></button><label class="btn w"><span>読み込む</span><input type="file" id="im" accept="application/json" hidden></label></div><p class="mini">Life Partner ${VERSION}</p></div>`;
      $('aSave').onclick = async () => { CFG.api = { url:$('aU').value.trim(), key:$('aK').value.trim() }; await saveCfg(); toast('保存しました'); };
      $('aTest').onclick = async () => { CFG.api = { url:$('aU').value.trim(), key:$('aK').value.trim() }; $('aMsg').textContent = '確かめています…'; const r = await Api.call('budget', {}, { retry:1, timeout:20000 }); $('aMsg').textContent = r && r.budget ? `つながりました。今月のAI：${Math.round(r.budget.spent)}円／上限${r.budget.limit}円` : 'つながりませんでした。URLと合言葉を確認してください'; };
      $('fav').onchange = async e => { CFG.fav = e.target.value.trim() || '../kani-favorite/'; if (!/\/$/.test(CFG.fav)) CFG.fav += '/'; Pic.ok.clear(); await saveCfg(); toast('保存しました'); };
      $('swBgm').onclick = async () => { CFG.bgm = !CFG.bgm; await saveCfg(); render(); Sound.bgm(OSHI[DUTY].bgm); };
      $('swLock').onclick = async () => { if (!CFG.lock) { if (await Lock.setup()) { CFG.lock = true; await saveCfg(); toast('次から、開くときにFace IDを使います'); } } else { CFG.lock = false; await saveCfg(); } render(); };
      $('ex').onclick = exportData;
      $('im').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!(await ask('今のデータを消して、控えの中身に置き換えます。よいですか？', '置き換える', 'やめる'))) return; try { await importData(f); toast('読み込みました。再起動します'); setTimeout(() => location.reload(), 900); } catch (err) { toast(String(err.message || err)); } };
    }
  }
  function bind() {
    $('setX').onclick = close;
    $('set').addEventListener('click', async e => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; return render(); }
      const d = e.target.closest('[data-dm]'); if (d) { dm = d.dataset.dm; return render(); }
      const rm = e.target.closest('[data-rm]'); if (rm) { await Data.remove(rm.dataset.rm); return render(); }
      const pd = e.target.closest('[data-pdel]'); if (pd) { const m = Data.money(); m.pays = m.pays.filter(p => p.id !== pd.dataset.pdel); await Data.saveMoney(); return render(); }
      const ud = e.target.closest('[data-udel]'); if (ud) { await Data.setUsual(Data.usuals().filter(u => u.id !== ud.dataset.udel)); return render(); }
      const sk = e.target.closest('[data-skip]'); if (sk) { const s = new Set(await DB.get('skipQ', [])); s.has(sk.dataset.skip) ? s.delete(sk.dataset.skip) : s.add(sk.dataset.skip); await DB.set('skipQ', [...s]); return render(); }
      const ar = e.target.closest('[data-area]'); if (ar) {
        const n = ar.dataset.area;
        if (n === 'gps') { navigator.geolocation.getCurrentPosition(async p => { await DB.set('area', { name:'今いる場所', lat:+p.coords.latitude.toFixed(2), lon:+p.coords.longitude.toFixed(2) }); await DB.del('weather'); Data.loadWeather(true); render(); }, () => toast('場所を取得できませんでした')); return; }
        await DB.set('area', { name:n, lat:AREAS[n][0], lon:AREAS[n][1] }); await DB.del('weather'); Data.loadWeather(true); render(); return;
      }
    });
  }
  return { open, close, bind };
})();
