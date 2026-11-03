// Life Partner — 起動とタブ
'use strict';
const App = (() => {
  let view = 'home', started = false, day = '';
  const VIEWS = { home:() => Home.refresh(), desk:() => Desk.render(), clinic:() => Clinic.render(), rest:() => Rest.render(), talk:() => Talk.list() };

  function go(v) {
    if (v === 'money') v = 'desk';
    if (!VIEWS[v]) v = 'home';
    view = v;
    document.querySelectorAll('.view').forEach(x => x.classList.toggle('on', x.id === v));
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
    Motes.pause(v !== 'home');
    if (v !== 'talk') { $('chat').classList.remove('on'); $('app').classList.remove('chatting'); }
    VIEWS[v]();
    if (v === 'home') requestAnimationFrame(Home.center);
    $('app').scrollTop = 0;
  }
  function refreshAll() { VIEWS[view](); if (view !== 'home') { Home.refresh(); } }
  async function dutyChanged() { $('tabHomeI').innerHTML = Face.img(DUTY, 'normal', 'tab'); refreshAll(); }

  async function enter(to) {
    started = true; day = D.today();
    $('app').classList.add('on');
    await Home.lobby(); dutyChanged();
    go(to || 'home');
  }
  async function boot() {
    await DB.open(); await loadCfg(); await Data.load(); await loadDuty();
    [Input, Home, Desk, Clinic, Rest, Talk, Settings].forEach(m => m.bind());
    $('tabs').onclick = e => { const b = e.target.closest('button'); if (b) { Sound.se('tap'); go(b.dataset.v); } };
    document.addEventListener('pointerdown', () => Sound.wake(), { capture:true, passive:true });
    Data.onChange(() => { if (started) refreshAll(); });
    Data.loadWeather().then(() => started && view === 'home' && Home.refresh());
    // 日付が変わったら当番を入れ替える
    document.addEventListener('visibilitychange', async () => { if (!document.hidden && started && D.today() !== day) { day = D.today(); await loadDuty(); await Home.lobby(); dutyChanged(); } });
    // 通知から（?go=desk など）はタイトルを飛ばす
    const to = new URLSearchParams(location.search).get('go');
    if (to) {
      if (CFG.lock) {
        const el = h(`<div id="lockCover"><div class="lk-in"><b>LIFE PARTNER</b><button class="btn" id="lkGo"><span>Face IDで開く</span></button></div></div>`);
        document.body.appendChild(el);
        $('lkGo').onclick = async () => { if (await Lock.check()) { el.remove(); Sound.wake(); enter(to); } };
      } else enter(to);
      history.replaceState(null, '', location.pathname);
    } else {
      Title.init({ start:() => { Sound.wake(); Sound.bgm(OSHI[DUTY].bgm); }, lock:() => !!CFG.lock, unlock:() => Lock.check(), enter:() => enter() }, DUTY);
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  return { boot, go, refreshAll, dutyChanged, started:() => started };
})();
window.addEventListener('DOMContentLoaded', () => App.boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;bottom:0;left:0;right:0;background:#fff;color:#c00;font-size:11px;z-index:999;white-space:pre-wrap">${esc(e.stack || e)}</pre>`); }));
