// Life Partner — ホーム（左：寮／真ん中：メモロビ／右：作戦室）
'use strict';
const Home = (() => {
  let face2 = false, faceT = 0, briefOpen = true, alertNow = null, video = null;

  // ===== メモロビ =====
  async function lobby() {
    const k = DUTY, o = OSHI[k], box = $('lobMedia');
    box.innerHTML = ''; video = null; face2 = false;
    if (o.lobby.video) {
      const v = h(`<video playsinline muted loop autoplay preload="auto"></video>`);
      v.poster = A(o.lobby.poster || ''); v.src = A(o.lobby.video);
      v.onerror = () => { v.remove(); video = null; still(); };
      box.appendChild(v); video = v; v.play().catch(() => {});
    } else still();
    $('dutyChip').innerHTML = `今日の秘書：<b>${esc(o.name)}</b> ▾`;
    Motes.set(k);
    Sound.bgm(o.bgm);
  }
  async function still() {
    const k = DUTY, o = OSHI[k], box = $('lobMedia');
    let el = box.querySelector('.still'); if (!el) { el = h('<div class="still"></div>'); box.appendChild(el); }
    const p = (o.lobby.img || [])[face2 ? 1 : 0] || o.title[face2 ? 1 : 0];
    const ok = await Pic.bg(el, p, k, 'メモロビの絵が届いたら差し込み');
    if (!ok && face2) Pic.bg(el, o.title[1], k, 'メモロビの絵が届いたら差し込み');
  }
  function tapLobby() {
    Sound.wake();
    if (!briefOpen) { briefOpen = true; $('brief').classList.remove('closed'); return; }
    const k = DUTY, o = OSHI[k];
    if (!video) { face2 = true; still(); clearTimeout(faceT); faceT = setTimeout(() => { face2 = false; still(); }, 4000); }
    const line = o.tap[Math.floor(Math.random() * o.tap.length)];
    $('briefBox').innerHTML = bubble(k, 'smile', `<p>${esc(line)}</p>`);
    Sound.voice(k);
    setTimeout(() => { briefOpen = false; $('brief').classList.add('closed'); }, 3200);
  }

  // ===== ブリーフィング =====
  const bubble = (k, f, inner) => `<div class="bubble brief-b">${Face.img(k, f, 'sm')}<div><div class="who">${esc(OSHI[k].name)}</div>${inner}</div></div>`;
  function localBrief() {
    const k = DUTY, o = OSHI[k], per = D.period(), m = Data.moneyNow(), t = D.today();
    const td = Data.plans(t, 0), tm = Data.plans(D.add(t, 1), 0), t3 = Data.today3(), lines = [];
    const pl = r => `${r.time ? r.time + ' ' : ''}${r.text}`;
    if (per === 'am') {
      if (td.length) lines.push(`今日は ${pl(td[0])}${td.length > 1 ? ` ほか${td.length - 1}件` : ''}`);
      if (t3.length) lines.push(`まずは「${t3[0].text}」から`);
      if (m.set) lines.push(`今日使えるのは${yen(m.perDay)}まで`);
    } else if (per === 'pm') {
      const rest = td.filter(r => !r.time || r.time >= `${p2(new Date().getHours())}:00`);
      if (rest.length) lines.push(`このあと ${pl(rest[0])}`);
      if (t3.length) lines.push(`やることはあと${Data.todos().filter(r => r.kind !== 'ask').length}件`);
      if (m.set) lines.push(`今日は${yen(m.outToday)}使ってて、目安は${yen(m.perDay)}`);
    } else {
      const done = Data.doneSince(t).length;
      lines.push(done ? `今日は${done}件片付けたね` : '今日もおつかれさま');
      if (tm.length) lines.push(`明日は ${pl(tm[0])}`);
      lines.push(new Date().getHours() >= 23 || new Date().getHours() < 4 ? 'そろそろ寝る準備しよ' : '今日のご飯、入れ忘れてない？');
    }
    if (!lines.length) lines.push('今日はまだ何も入ってないよ。＋から一言どうぞ');
    return { intro:o.hello[per], lines:lines.slice(0, 3), face:'normal' };
  }
  async function brief() {
    const k = DUTY, key = `brief:${D.today()}:${D.period()}:${k}`;
    const b = (await DB.get(key)) || localBrief();
    $('briefBox').innerHTML = bubble(k, b.face || 'normal', `<p>${esc(b.intro || '')}</p><ul>${(b.lines || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>`);
    nums();
    // AIのブリーフィング（その時間帯に1回だけ作る）
    if (!(await DB.get(key)) && Api.ready() && !brief.busy) {
      brief.busy = true;
      const r = await Api.call('brief', { duty:k, period:D.period(), snap:Data.snapshot(), ctx:Data.context(['plan', 'todo', 'money', 'health', 'food', 'proposal'], 8), usual:Data.usualText(), local:localBrief().lines });
      brief.busy = false;
      if (r && Array.isArray(r.lines) && r.lines.length) { await DB.set(key, { intro:r.intro || OSHI[k].hello[D.period()], lines:r.lines.slice(0, 3), face:r.face || 'normal' }); if (DUTY === k) brief(); }
    }
  }
  function nums() {
    const m = Data.moneyNow(), np = Data.nextPlan(), nx = m.next;
    $('nums').innerHTML = `<button data-go="desk"><small>今日使える</small><b>${m.set ? yen(m.perDay) : '未設定'}</b></button>
      <button data-go="desk"><small>次の予定</small><b>${np ? esc(`${D.label(np.date) === '今日' ? '' : D.label(np.date) + ' '}${np.time || ''} ${np.text}`.trim()) : 'なし'}</b></button>
      <button data-go="desk"><small>次の支払い</small><b>${nx ? esc(`${nx.name} ${D.md(nx.due)}`) : 'なし'}</b></button>`;
  }
  // ===== 割り込み =====
  async function alerts() {
    const list = await Data.alerts(); alertNow = list[0] || null;
    const e = $('alertBox');
    if (!alertNow) { e.innerHTML = ''; return; }
    e.innerHTML = `<div class="bubble alert-b">${Face.img(alertNow.k, alertNow.f, 'sm')}<div><div class="who">${esc(OSHI[alertNow.k].name)}<span>割り込み</span></div><p>${esc(alertNow.text)}</p><small>タップでわかった</small></div></div>`;
  }
  async function seeAlert() {
    if (!alertNow) return;
    await Data.seeAlert(alertNow.id); await Talk.push(alertNow.k, alertNow.text, true);
    alertNow = null; alerts(); Talk.badge();
  }

  // ===== 時計 =====
  function clock() { const d = new Date(), w = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']; $('ckT').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}`; $('ckD').textContent = `${d.getMonth() + 1}.${d.getDate()} ${w[d.getDay()]}`; }

  // ===== 当番を選ぶ =====
  function pickDuty() {
    const el = h(`<div class="sheet on"><div class="in"><b>今日の秘書を選ぶ</b><p class="mini">今日だけ入れ替わります。明日からはいつもの順番に戻ります。</p>
      <div class="pick4">${ORDER.map(k => `<button data-k="${k}" class="${k === DUTY ? 'on' : ''}">${Face.img(k, 'smile')}<span>${esc(OSHI[k].name)}</span></button>`).join('')}</div></div></div>`);
    el.onclick = async e => { const b = e.target.closest('[data-k]'); if (b) { await setDuty(b.dataset.k); el.remove(); refresh(true); App.dutyChanged(); } else if (e.target === el) el.remove(); };
    $('app').appendChild(el);
  }

  // ===== 寮（左） =====
  async function dorm() {
    $('doors').innerHTML = ORDER.map(k => `<button data-talk="${k}"><span class="door-img" data-k="${k}"></span><span class="door-n">${esc(OSHI[k].name)}の部屋</span></button>`).join('');
    $('doors').querySelectorAll('.door-img').forEach(el => { const k = el.dataset.k; Pic.bg(el, OSHI[k].title[1], k); });
    const al = (await Album.list()).slice().reverse();
    $('album').innerHTML = al.length ? al.map(a => `<div class="pol"><div class="pol-i" data-img="${esc(a.img)}" data-k="${a.k}"></div><p>${D.md(a.day)} ${esc(a.text)}</p></div>`).join('')
      : '<p class="mini">いいことがあった日に、その子の絵が増えていきます。</p>';
    $('album').querySelectorAll('.pol-i').forEach(el => Pic.bg(el, el.dataset.img, el.dataset.k));
  }

  // ===== 作戦室（右） =====
  async function weekStats() {
    const ws = D.week(), t = D.today(), days = D.diff(ws, t) + 1;
    const spent = Data.of('money').filter(r => r.kind === 'out' && r.date >= ws && !r.payKey).reduce((s, r) => s + (r.amt || 0), 0);
    const done = Data.doneSince(ws).length;
    const wk = await Data.week(t), mine = wk.filter(x => x.day >= ws);
    const sl = mine.map(x => x.c.sleep).filter(x => x != null), avg = sl.length ? Math.round(sl.reduce((a, b) => a + b, 0) / sl.length * 10) / 10 : null;
    const noFood = mine.filter(x => !x.food.length && !(x.c.meals || []).length).map(x => D.dow(x.day));
    return { from:ws, days, spent, done, sleep:avg, noFood, recs:Data.of('food').concat(Data.of('money')).filter(r => r.date >= ws).length };
  }
  async function ops() {
    const s = await weekStats(), wk = await DB.get('weekly:' + s.from);
    $('weekNums').innerHTML = `<div><small>片付けた</small><b>${s.done}件</b></div><div><small>使ったお金</small><b>${yen(s.spent)}</b></div><div><small>平均睡眠</small><b>${s.sleep != null ? s.sleep + 'h' : '—'}</b></div>`;
    $('weekBody').innerHTML = wk ? wk.lines.map(l => `<p>${Face.img(l.who, l.face || 'smile', 'xs')}<b>${esc((OSHI[l.who] || {}).name || '')}</b>「${esc(l.text)}」</p>`).join('') + (wk.note ? `<p class="mini">${esc(wk.note)}</p>` : '')
      : `<p class="mini">${s.noFood.length ? `記録がない日：${s.noFood.join('・')}曜日のご飯。` : ''}日曜の夜に4人から週報が届きます。</p>`;
    $('weekBtn').style.display = Api.ready() ? '' : 'none';
  }
  async function makeWeekly(force) {
    const s = await weekStats(), key = 'weekly:' + s.from;
    if (!force && await DB.get(key)) return;
    if (!Api.ready()) return;
    $('weekBody').innerHTML = '<p class="mini">4人が週報を書いています…</p>';
    const r = await Api.call('weekly', { stats:s, snap:Data.snapshot(), ctx:Data.context(['todo', 'money', 'health', 'food', 'work', 'plan'], 20) });
    if (r && Array.isArray(r.lines)) await DB.set(key, { lines:r.lines.filter(l => OSHI[l.who]), note:r.note || '' });
    ops();
  }
  async function consult(text) {
    const box = $('opsLog'); box.insertAdjacentHTML('beforeend', `<div class="m me">${esc(text)}</div>`);
    if (!Api.ready()) { box.insertAdjacentHTML('beforeend', '<div class="m them">（AIの設定をすると、4人が相談に乗ってくれます）</div>'); return; }
    box.insertAdjacentHTML('beforeend', '<div class="m them wait"><span class="dots"><i></i><i></i><i></i></span></div>');
    const r = await Api.call('ops', { topic:text, ctx:Data.context(Data.pick(text), 10), usual:Data.usualText(), snap:Data.snapshot() });
    box.querySelector('.wait')?.remove();
    (r && r.lines || [{ who:DUTY, text:'……ごめん、うまく話せなかった' }]).forEach(l => box.insertAdjacentHTML('beforeend', `<div class="m them">${Face.img(l.who, l.face, 'xs')}<b>${esc((OSHI[l.who] || {}).name || '')}</b> ${esc(l.text)}</div>`));
    box.scrollTop = 1e6;
  }

  // ===== まとめて描く =====
  async function refresh(all) {
    if (all) await lobby();
    clock(); brief(); alerts();
    dorm(); ops();
    Talk.badge();
  }
  function bind() {
    $('lobMedia').onclick = tapLobby;
    $('dutyChip').onclick = e => { e.stopPropagation(); pickDuty(); };
    $('briefBox').onclick = () => { briefOpen = false; $('brief').classList.add('closed'); };
    $('alertBox').onclick = seeAlert;
    $('nums').onclick = e => { const b = e.target.closest('[data-go]'); if (b) App.go(b.dataset.go); };
    $('mtBtn').onclick = () => App.go('talk');
    $('gearBtn').onclick = () => Settings.open();
    $('doors').onclick = e => { const b = e.target.closest('[data-talk]'); if (b) { App.go('talk'); Talk.open(b.dataset.talk); } };
    $('weekBtn').onclick = () => makeWeekly(true);
    $('opsForm').onsubmit = e => { e.preventDefault(); const v = $('opsIn').value.trim(); if (v) { $('opsIn').value = ''; consult(v); } };
    $('opsChips').onclick = e => { const b = e.target.closest('button'); if (b) consult(b.textContent); };
    setInterval(clock, 10000);
    // 日曜の夜は週報を自動で
    if (new Date().getDay() === 0 && new Date().getHours() >= 18) setTimeout(() => makeWeekly(false), 4000);
  }
  function center() { const p = $('pan'); p.scrollLeft = p.clientWidth; }
  return { bind, refresh, center, lobby };
})();

// ===== 光の粒（タイトルと同じ考え方。顔のまわりは消える） =====
const Motes = (() => {
  let cv, g, P = [], k = null, W = 0, H = 0, run = false;
  function size() { if (!cv) return; const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * devicePixelRatio; cv.height = H * devicePixelRatio; g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  const sp = any => ({ x:Math.random() * W, y:any ? Math.random() * H : H + 10, z:Math.random(), s:Math.random() * 6.28 });
  function loop() {
    if (!run) return;
    g.clearRect(0, 0, W, H);
    const o = OSHI[k] || OSHI[ORDER[0]], f = o.face, fx = W * f[0], fy = H * f[1], rx = W * f[2] * 1.4, ry = H * f[3] * 1.4;
    P.forEach((p, i) => {
      p.s += .02; p.y -= .15 + p.z * .35; p.x += Math.sin(p.s) * .25;
      if (p.y < -10) P[i] = sp(false);
      const d = Math.hypot((p.x - fx) / rx, (p.y - fy) / ry), ff = d >= 1.25 ? 1 : d <= .85 ? 0 : (d - .85) / .4; if (!ff) return;
      const a = (.25 + .4 * (Math.sin(p.s * .7) * .5 + .5)) * (.5 + p.z * .5) * ff, r = (1.5 + p.z * 3) * 3;
      const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.35, o.motes[p.z > .5 ? 0 : 1] + '66'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill();
    });
    requestAnimationFrame(loop);
  }
  function set(key) { k = key; if (!cv) { cv = $('motes'); g = cv.getContext('2d'); addEventListener('resize', size); } size(); if (!P.length) for (let i = 0; i < 24; i++) P.push(sp(true)); if (!run) { run = true; loop(); } }
  function pause(on) { if (on) run = false; else if (!run && cv) { run = true; size(); loop(); } }
  return { set, pause, size };
})();
