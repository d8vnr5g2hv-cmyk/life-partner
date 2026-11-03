// Life Partner — タイトル（Kani Favoriteの新タイトルから）
// 流れ：スプラッシュ →（タッチ：BGM）→ 当番の1枚目 →（タッチ：ロックがオンなら Face ID）→ 2枚目＋ボイス＋ひとこと →（タッチ）→ ホーム
'use strict';
const Title = (() => {
  const N = 30;
  let root, cv, g, W = 0, H = 0, k = null, step = 0, busy = false, parts = [], face = null, raf = 0, last = 0, hooks = {}, IW = 853, IH = 1843;

  function build() {
    root = h(`<div id="ttl" class="tt-s0">
      <div class="tt-shot a"></div><div class="tt-shot b"></div><div class="tt-vig"></div>
      <canvas class="tt-cv"></canvas><div class="tt-bloom"></div>
      <div class="tt-clock"><b></b><small></small></div>
      <div class="tt-line"></div>
      <div class="tt-touch"></div>
      <div class="tt-splash"><b>LIFE PARTNER</b><small>TAP TO START</small></div>
    </div>`);
    document.body.appendChild(root);
    cv = root.querySelector('.tt-cv'); g = cv.getContext('2d');
    addEventListener('resize', () => { if (step < 3) { size(); faceBox(); } });
  }
  function size() { W = root.clientWidth; H = root.clientHeight; cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  async function setChar(c) {
    k = c; const o = OSHI[c];
    const [a, b] = [root.querySelector('.tt-shot.a'), root.querySelector('.tt-shot.b')];
    await Pic.bg(a, o.title[0], c, 'タイトルの絵が届いたら差し込み');
    await Pic.bg(b, o.title[1], c, 'タイトルの絵が届いたら差し込み');
    const url = await Pic.first([o.title[0]]);
    if (url) { const i = new Image(); i.onload = () => { IW = i.naturalWidth; IH = i.naturalHeight; faceBox(); }; i.src = url; }
  }
  function faceBox() {
    if (!k) return;
    const f = OSHI[k].face, sc = Math.max(W * 1.04 / IW, H * 1.04 / IH), iw = IW * sc, ih = IH * sc;
    face = { x:W / 2 + (f[0] - .5) * iw, y:H / 2 + (f[1] - .5) * ih, rx:f[2] * iw, ry:f[3] * ih };
  }
  function faceFade(p) { if (!face) return 1; const d = Math.hypot((p.x - face.x) / face.rx, (p.y - face.y) / face.ry); return d >= 1.25 ? 1 : d <= .85 ? 0 : (d - .85) / .4; }
  function spawn(any) { const z = Math.random(), near = z > .85; return { x:Math.random() * W, y:any ? Math.random() * H : H + 20, z, near, s:(1.5 + z * 3) * (near ? 2.2 : 1), sway:Math.random() * 6.28, tw:Math.random() * 6.28, vy:-(12 + z * 40) * .35, vx:0, vb:0, col:OSHI[k].motes[Math.random() < .5 ? 0 : 1] }; }
  function loop(t) {
    const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    g.clearRect(0, 0, W, H);
    if (step >= 1 && step < 3) parts.forEach((p, i) => {
      p.sway += dt * 1.3; p.tw += dt * 2;
      p.x += (Math.sin(p.sway) * 14 + .08 * (30 + p.z * 60)) * dt + p.vx * dt; p.y += p.vy * dt + p.vb * dt; p.vx *= .985; p.vb *= .985;
      if (p.y < -40 || p.x > W + 40 || p.x < -40 || p.y > H + 40) { parts[i] = spawn(false); return; }
      const ff = faceFade(p); if (ff <= 0) return;
      const a = (.25 + .5 * (Math.sin(p.tw * .6) * .5 + .5)) * (.5 + p.z * .5);
      g.save(); g.translate(p.x, p.y); g.globalAlpha = a * ff; if (p.near) g.filter = 'blur(2.5px)';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, p.s * 3); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, p.col); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.s * 3, 0, 7); g.fill(); g.restore();
    });
    if (step < 3) raf = requestAnimationFrame(loop);
  }
  function burst(x, y) { for (let i = 0; i < 7; i++) { const p = spawn(true); p.x = x; p.y = y; const a = Math.random() * 6.28, v = 30 + Math.random() * 50; p.vx = Math.cos(a) * v; p.vb = Math.sin(a) * v - 25; parts.push(p); } if (parts.length > N + 40) parts.splice(0, parts.length - N - 40); }
  const clock = () => { const d = new Date(), w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']; root.querySelector('.tt-clock b').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`; root.querySelector('.tt-clock small').textContent = `${d.getMonth() + 1}.${d.getDate()} ${w[d.getDay()]}`; };
  function touch(t, d) { const e = root.querySelector('.tt-touch'); e.className = 'tt-touch'; e.textContent = t; setTimeout(() => { if (step < 3) e.className = 'tt-touch on'; }, d); }

  // o：{ start(), enter(), lock:()=>bool, unlock:async()=>bool }
  async function init(o, who) {
    hooks = o; build(); size(); await setChar(who); faceBox(); clock();
    parts = []; for (let i = 0; i < N; i++) parts.push(spawn(true));
    raf = requestAnimationFrame(loop);
    root.addEventListener('click', onTap);
  }
  async function onTap(e) {
    if (busy) return;
    const r = root.getBoundingClientRect(); if (step >= 1) burst(e.clientX - r.left, e.clientY - r.top);
    if (step === 0) { busy = true; hooks.start(); root.className = 'tt-s1'; step = 1; touch('TOUCH', 2200); await sleep(1500); busy = false; }
    else if (step === 1) {
      if (hooks.lock()) { busy = true; const ok = await hooks.unlock(); busy = false; if (!ok) { touch('もう一度タッチ', 0); return; } }
      smile();
    } else if (step === 2) {
      step = 3; root.querySelector('.tt-touch').className = 'tt-touch'; root.classList.add('go'); hooks.enter();
      setTimeout(() => { cancelAnimationFrame(raf); root.remove(); }, 900);
    }
  }
  async function smile() {
    busy = true;
    root.querySelector('.tt-touch').className = 'tt-touch';
    const b = root.querySelector('.tt-bloom'); b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    root.className = 'tt-s2'; step = 2;
    Sound.voice(k);
    const ln = root.querySelector('.tt-line'); ln.innerHTML = `<b>${esc(OSHI[k].name)}</b>${esc(OSHI[k].hello[D.period()])}`; ln.classList.add('on');
    touch('TOUCH TO ENTER', 1800);
    await sleep(1200); busy = false;
  }
  return { init };
})();
