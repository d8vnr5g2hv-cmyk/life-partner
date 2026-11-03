// Life Partner — 土台（小物・保存・音・AIとのやりとり）
'use strict';
const VERSION = '1.0';
const $ = id => document.getElementById(id);
const p2 = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const yen = n => (n < 0 ? '-' : '') + '¥' + Math.abs(Math.round(n || 0)).toLocaleString();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

// ===== 日付 =====
const D = {
  key:d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`,
  today:() => D.key(new Date()),
  parse:k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
  add:(k, n) => { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  diff:(a, b) => Math.round((D.parse(b) - D.parse(a)) / 864e5),   // b − a（日）
  md:k => { const d = D.parse(k); return `${d.getMonth() + 1}.${d.getDate()}`; },
  dow:k => '日月火水木金土'[D.parse(k).getDay()],
  label:k => { const t = D.today(), n = D.diff(t, k); return n === 0 ? '今日' : n === 1 ? '明日' : n === 2 ? 'あさって' : n === -1 ? '昨日' : `${D.md(k)}（${D.dow(k)}）`; },
  now:() => { const d = new Date(); return `${D.today()}（${D.dow(D.today())}）${p2(d.getHours())}:${p2(d.getMinutes())}`; },
  hour:() => new Date().getHours(),
  // 朝（4〜11時）・昼（11〜17時）・夜（17〜翌4時）
  period:() => { const x = new Date().getHours(); return x >= 4 && x < 11 ? 'am' : x >= 11 && x < 17 ? 'pm' : 'night'; },
  week:k => { const d = D.parse(k || D.today()), w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return D.key(d); },   // 月曜はじまり
};

// ===== 小さな保存（端末ごとの設定。消えても困らないものだけ） =====
const LS = {
  get:k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set:(k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};

// ===== 本保存（IndexedDB）。rec＝記録、kv＝設定やまとまったデータ =====
const DB = (() => {
  let db = null;
  function open() {
    if (db) return Promise.resolve(db);
    return new Promise((ok, ng) => {
      const r = indexedDB.open('life-partner', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('rec')) { const s = d.createObjectStore('rec', { keyPath:'id' }); s.createIndex('domain', 'domain'); }
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath:'k' });
      };
      r.onsuccess = () => { db = r.result; ok(db); };
      r.onerror = () => ng(r.error);
    });
  }
  const tx = async (store, mode, fn) => { const d = await open(); return new Promise((ok, ng) => { const t = d.transaction(store, mode), s = t.objectStore(store); const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => ng(t.error); }); };
  return {
    open,
    get:(k, def = null) => tx('kv', 'readonly', s => s.get(k)).then(r => r ? r.v : def),
    set:(k, v) => tx('kv', 'readwrite', s => s.put({ k, v })),
    del:k => tx('kv', 'readwrite', s => s.delete(k)),
    keys:() => tx('kv', 'readonly', s => s.getAllKeys()),
    put:rec => tx('rec', 'readwrite', s => s.put(rec)),
    remove:id => tx('rec', 'readwrite', s => s.delete(id)),
    all:() => tx('rec', 'readonly', s => s.getAll()),
    byDomain:dm => tx('rec', 'readonly', s => s.index('domain').getAll(dm)),
    clear:() => Promise.all([tx('rec', 'readwrite', s => s.clear()), tx('kv', 'readwrite', s => s.clear())]),
  };
})();

// ===== 設定（起動時に読み込んで持っておく） =====
const CFG = { api:null, fav:'../kani-favorite/', bgm:true, lock:false };
async function loadCfg() {
  const c = await DB.get('cfg', {});
  Object.assign(CFG, c || {});
  if (!CFG.fav) CFG.fav = '../kani-favorite/';
  if (!/\/$/.test(CFG.fav)) CFG.fav += '/';
}
const saveCfg = () => DB.set('cfg', { api:CFG.api, fav:CFG.fav, bgm:CFG.bgm, lock:CFG.lock });
// 素材の場所：「fav:」で始まるものは Kani Favorite から借りる
const A = p => !p ? '' : p.startsWith('fav:') ? CFG.fav + p.slice(4) : p;

// ===== トースト・確認 =====
function toast(t, ms = 2400) {
  const e = $('toast'); e.textContent = t; e.className = 'on';
  clearTimeout(e._t); e._t = setTimeout(() => { e.className = ''; }, ms);
}
// 小さな確認（ボタン2つ）。戻り値：true／false
function ask(text, yes = 'はい', no = 'いいえ', who = null) {
  return new Promise(ok => {
    const el = h(`<div class="ask"><div class="ask-in">${who ? `<div class="ask-who">${Face.img(who, 'normal', 'sm')}<b>${esc(OSHI[who].name)}</b></div>` : ''}<p>${esc(text)}</p>
      <div class="ask-b"><button class="btn w" data-v="0"><span>${esc(no)}</span></button><button class="btn" data-v="1"><span>${esc(yes)}</span></button></div></div></div>`);
    el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b && e.target !== el) return; el.remove(); ok(!!(b && b.dataset.v === '1')); };
    $('app').appendChild(el);
  });
}

// ===== AI（GASのウェブアプリ） =====
const Api = {
  ready:() => !!(CFG.api && CFG.api.url && CFG.api.key),
  async call(action, body = {}, opt = {}) {
    if (!Api.ready()) return null;
    for (let n = 0; n < (opt.retry || 2); n++) {
      try {
        const ac = new AbortController(), to = setTimeout(() => ac.abort(), opt.timeout || 60000);
        const res = await fetch(CFG.api.url, { method:'POST', cache:'no-store', signal:ac.signal, body:JSON.stringify(Object.assign({ key:CFG.api.key, action, now:D.now() }, body)) });
        clearTimeout(to);
        const j = JSON.parse(await res.text());
        if (j.error === 'budget') { toast('今月のAIの予算を使い切りました'); return null; }
        if (j.error === 'key') { toast('合言葉が違うみたいです（設定を確認）'); return null; }
        if (j.error) throw new Error(j.error + ' ' + (j.detail || ''));
        return j;
      } catch (e) { console.warn(action, e); await sleep(900 * (n + 1)); }
    }
    return null;
  },
};

// ===== 音（BGM・ボイス・効果音）。iPhoneは画面に触れるまで鳴らせない =====
const Sound = (() => {
  let ctx = null, bgmGain = null, vGain = null, bgmNode = null, bgmSrc = '', voiceNode = null;
  const bufs = new Map(), recent = [];
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgmGain = ctx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(ctx.destination);
      vGain = ctx.createGain(); vGain.gain.value = 1; vGain.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }
  function wake() { init(); if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
  async function load(url) {
    if (bufs.has(url)) return bufs.get(url);
    const p = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(a => new Promise((ok, ng) => ctx.decodeAudioData(a, ok, ng)));
    bufs.set(url, p); p.catch(() => bufs.delete(url));
    return p;
  }
  function ramp(g, v, t) { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setValueAtTime(g.gain.value, n); g.gain.linearRampToValueAtTime(v, n + t); }
  // bgm：{ src, len }（前後0.2秒は継ぎ目用）
  async function bgm(b, vol = .35) {
    init(); if (!ctx) return;
    if (!CFG.bgm || !b) { stopBgm(); return; }
    const url = A(b.src); if (url === bgmSrc && bgmNode) { ramp(bgmGain, vol, .6); return; }
    bgmSrc = url;
    try {
      const buf = await load(url); if (bgmSrc !== url) return;
      if (bgmNode) { try { bgmNode.stop(); } catch (e) {} }
      const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
      if (b.len) { n.loopStart = .2; n.loopEnd = Math.min(buf.duration, .2 + b.len); }
      n.connect(bgmGain); n.start(0, .2); bgmNode = n; bgmGain.gain.value = 0; ramp(bgmGain, vol, 1.2);
    } catch (e) { bgmSrc = ''; }
  }
  function stopBgm(t = .6) { if (!ctx || !bgmNode) return; const n = bgmNode; bgmNode = null; bgmSrc = ''; ramp(bgmGain, 0, t); setTimeout(() => { try { n.stop(); } catch (e) {} }, t * 1000 + 50); }
  function duck(on) { if (ctx && bgmNode) ramp(bgmGain, on ? .1 : .35, .3); }
  async function voice(k, hooks = {}) {
    init(); const list = (OSHI[k] && OSHI[k].voices) || [];
    if (!ctx || !list.length) { if (hooks.end) hooks.end(); return false; }
    const pool = list.filter(v => !recent.includes(v)), src = pool.length ? pool : list, pick = src[Math.floor(Math.random() * src.length)];
    recent.push(pick); if (recent.length > 4) recent.shift();
    try {
      const buf = await load(A(pick));
      if (voiceNode) { try { voiceNode.stop(); } catch (e) {} }
      const n = ctx.createBufferSource(); n.buffer = buf; n.connect(vGain); voiceNode = n;
      duck(true); if (hooks.start) hooks.start();
      n.onended = () => { if (voiceNode === n) { voiceNode = null; duck(false); } if (hooks.end) hooks.end(); };
      n.start(); return true;
    } catch (e) { if (hooks.end) hooks.end(); return false; }
  }
  // 効果音：音源ファイルがなくても鳴るよう、短い音を合成する
  function se(type = 'tap') {
    init(); if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    const P = { tap:[880, .05, .06], ok:[1320, .12, .08], coin:[1760, .18, .1], warn:[440, .2, .08] }[type] || [880, .05, .06];
    o.type = 'sine'; o.frequency.setValueAtTime(P[0], t); if (type === 'ok' || type === 'coin') o.frequency.setValueAtTime(P[0] * 1.5, t + .06);
    g.gain.setValueAtTime(P[2], t); g.gain.exponentialRampToValueAtTime(.0001, t + P[1]);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + P[1] + .02);
  }
  return { wake, bgm, stopBgm, voice, se, duck };
})();

// ===== 書き出し・読み込み（控え） =====
async function exportData() {
  const kv = {}; for (const k of await DB.keys()) kv[k] = await DB.get(k);
  const data = { app:'life-partner', version:VERSION, at:new Date().toISOString(), rec:await DB.all(), kv };
  const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `life-partner_${D.today()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function importData(file) {
  const j = JSON.parse(await file.text());
  if (j.app !== 'life-partner') throw new Error('Life Partnerの控えではありません');
  await DB.clear();
  for (const r of j.rec || []) await DB.put(r);
  for (const [k, v] of Object.entries(j.kv || {})) await DB.set(k, v);
}
