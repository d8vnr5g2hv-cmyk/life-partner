// Life Partner — 診療所（アズライト）と ひと休み（ホシノ）
'use strict';
const Clinic = (() => {
  const Q = [
    { k:'sleep', q:'昨日は何時間寝た？', o:[[4, '4h以下'], [5, '5h'], [6, '6h'], [7, '7h以上']] },
    { k:'meals', q:'今日食べたのは？', o:[['朝', '朝'], ['昼', '昼'], ['夜', '夜'], ['コーヒーだけ', 'コーヒーだけ']], multi:true },
    { k:'alcohol', q:'お酒は？', o:[['none', '飲んでない'], ['some', '少し'], ['lot', 'けっこう']] },
    { k:'mood', q:'気分は？', o:[['good', 'いい'], ['ok', 'ふつう'], ['bad', 'しんどい']] },
  ];
  async function render() {
    Pic.bg($('clinicHero'), OSHI.azurite.clinic || OSHI.azurite.art, 'azurite', '診療所の絵が届いたら差し込み');
    const c = await Data.checkup(D.today());
    // 習慣から分かること（勤務日の朝昼など）は聞かない：設定の「聞かない質問」
    const skip = await DB.get('skipQ', []);
    $('qBox').innerHTML = Q.filter(x => !skip.includes(x.k)).map(x => `<div class="q">${x.q}${c[x.k] != null && (!x.multi || c[x.k].length) ? ' <em>✓</em>' : ''}</div><div class="chips" data-q="${x.k}" ${x.multi ? 'data-multi="1"' : ''}>${x.o.map(([v, l]) => `<button data-v="${v}" class="${x.multi ? (c[x.k] || []).includes(v) ? 'on' : '' : c[x.k] == v ? 'on' : ''}">${l}</button>`).join('')}</div>`).join('');
    // カルテ（7日）
    const wk = await Data.week();
    $('karte').innerHTML = `<div class="bars">${wk.map(x => { const s = x.c.sleep; return `<div class="bar ${s != null && s <= 5 ? 'low' : ''} ${s == null ? 'none' : ''}" style="height:${s == null ? 8 : Math.min(100, s / 8 * 100)}%"><span>${D.dow(x.day)}</span>${s != null ? `<em>${s}</em>` : ''}</div>`; }).join('')}</div>
      <div class="krow"><small>ご飯</small>${wk.map(x => `<i title="${x.day}">${x.food.length + (x.c.meals || []).filter(m => m !== 'コーヒーだけ').length || '・'}</i>`).join('')}</div>
      <div class="krow"><small>お酒</small>${wk.map(x => `<i>${{ none:'−', some:'○', lot:'◎' }[x.c.alcohol] || '・'}</i>`).join('')}</div>`;
    rx();
  }
  async function rx() {
    const key = 'rx:' + D.today(); let r = await DB.get(key);
    if (!r) {
      const c = await Data.checkup(D.today());
      r = { text:c.sleep != null && c.sleep <= 5 ? '陛下、睡眠が足りていません。今夜は24時までに横になってください。お水もコップ3杯' : c.alcohol === 'lot' ? '陛下、昨夜は飲みすぎですね。今日はお水を多めに、お酒はお休みです' : '陛下、今日はお水をコップ3杯。それと、24時までに横になってください', ai:false };
      if (Api.ready() && Object.keys(c).length) {
        const a = await Api.call('rx', { week:(await Data.week()).map(x => ({ day:x.day, c:x.c, food:x.food.map(f => f.text) })), ctx:Data.context(['health', 'food', 'habit'], 10), usual:Data.usualText(), weather:Data.weatherText() });
        if (a && a.text) { r = { text:a.text, ai:true }; await DB.set(key, r); }
      }
    }
    $('rx').innerHTML = `${Face.img('azurite', 'normal', 'xs')}<b>アズライト</b>　${esc(r.text)}`;
  }
  function bind() {
    $('clinic').addEventListener('click', e => { if (e.target.closest('[data-add2]')) Input.open('health'); });
    $('qBox').addEventListener('click', async e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      const g = b.parentNode, k = g.dataset.q, raw = b.dataset.v, v = isNaN(+raw) ? raw : +raw;
      const c = await Data.checkup(D.today());
      if (g.dataset.multi) { const a = new Set(c[k] || []); a.has(v) ? a.delete(v) : a.add(v); await Data.setCheckup(D.today(), { [k]:[...a] }); }
      else await Data.setCheckup(D.today(), { [k]:v });
      Sound.se('tap'); render();
      if (k === 'sleep') sleepAlbum();
    });
  }
  async function sleepAlbum() { const wk = await Data.week(); if (wk.every(x => x.c.sleep >= 6)) Album.add('azurite', '1週間ちゃんと寝た'); }
  return { render, bind };
})();

const Rest = (() => {
  let tmI = 0, left = 0;
  function render() { Pic.bg($('restHero'), OSHI.hoshino.art || OSHI.hoshino.title[0], 'hoshino'); }
  async function zen() {
    const z = $('zen'); z.classList.add('on'); Sound.wake();
    const url = await Pic.first([OSHI.hoshino.nap, OSHI.hoshino.title[0]]);
    z.style.backgroundImage = url ? `url("${url}")` : '';
    Sound.bgm(OSHI.hoshino.bgm, .2);
  }
  function timer(min = 5) {
    clearInterval(tmI); left = min * 60; draw(); $('tmSay').style.display = 'none';
    tmI = setInterval(() => { left--; draw(); if (left <= 0) { clearInterval(tmI); done(); } }, 1000);
  }
  const draw = () => { $('tm').textContent = `${p2(Math.floor(left / 60))}:${p2(left % 60)}`; };
  function done() {
    Sound.voice('hoshino'); Sound.se('ok');
    $('tmSay').innerHTML = `${Face.img('hoshino', 'sleepy', 'xs')}<b>ホシノ</b>　先生〜、時間だよ〜。……もうちょっと休む？`; $('tmSay').style.display = '';
    try { navigator.vibrate && navigator.vibrate([80, 60, 80]); } catch (e) {}
  }
  function bind() {
    $('zen').onclick = () => { $('zen').classList.remove('on'); Sound.bgm(OSHI[DUTY].bgm); };
    $('rest').addEventListener('click', e => {
      const a = e.target.closest('[data-r]'); if (!a) return;
      if (a.dataset.r === 'listen') { App.go('talk'); Talk.open('hoshino', true); }
      if (a.dataset.r === 'zen') zen();
      if (a.dataset.r === 't5') timer(5);
      if (a.dataset.r === 't15') timer(15);
    });
  }
  return { render, bind };
})();
