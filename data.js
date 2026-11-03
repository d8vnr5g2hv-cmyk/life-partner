// Life Partner — 記録（分野ごと）と、そこから出す数字
'use strict';
const DOMAINS = { plan:'予定', todo:'やること', money:'お金', food:'ご飯', health:'健康', people:'ひと', work:'仕事', play:'遊び', home:'住まい', clothes:'衣服', habit:'習慣', other:'できごと', proposal:'提案' };
const STATES = { sure:'確定', guess:'推定', check:'未確認' };

const Data = (() => {
  let recs = [], money = null, usual = [], hooks = [], syncT = 0, weather = null;
  const MONEY0 = { payday:25, cash:null, pays:[], paid:{}, pig:0, pigLog:[] };

  async function load() {
    recs = await DB.all();
    money = Object.assign({}, MONEY0, await DB.get('money', {}));
    usual = await DB.get('usual', []);
    weather = await DB.get('weather', null);
  }
  const onChange = f => hooks.push(f);
  function changed(what) { hooks.forEach(f => { try { f(what); } catch (e) { console.error(e); } }); clearTimeout(syncT); syncT = setTimeout(sync, 8000); }

  // ===== 記録 =====
  function norm(r) {
    const o = Object.assign({ id:uid(), domain:'other', kind:'', text:'', amt:null, date:D.today(), time:'', due:'', status:'open', state:'sure', src:'input', at:new Date().toISOString() }, r);
    if (!DOMAINS[o.domain]) o.domain = 'other';
    if (o.amt != null && o.amt !== '') o.amt = Math.round(Number(o.amt)) || null; else o.amt = null;
    o.text = String(o.text || '').slice(0, 200);
    return o;
  }
  async function add(r, quiet) { const o = norm(r); recs.push(o); await DB.put(o); if (!quiet) changed(o.domain); return o; }
  async function update(id, patch) { const o = recs.find(x => x.id === id); if (!o) return; Object.assign(o, patch); await DB.put(o); changed(o.domain); return o; }
  async function remove(id) { const i = recs.findIndex(x => x.id === id); if (i < 0) return; const d = recs[i].domain; recs.splice(i, 1); await DB.remove(id); changed(d); }
  const of = dm => recs.filter(r => r.domain === dm);
  const get = id => recs.find(r => r.id === id);

  // ===== 予定・やること =====
  function plans(from = D.today(), days = 14) {
    const to = D.add(from, days);
    return of('plan').filter(r => r.status !== 'drop' && r.date >= from && r.date <= to).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
  }
  const nextPlan = () => { const t = D.today(), now = `${p2(new Date().getHours())}:${p2(new Date().getMinutes())}`; return plans(t, 30).find(r => r.date > t || !r.time || r.time >= now) || null; };
  function todos() {
    return of('todo').filter(r => r.status === 'open').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.at.localeCompare(b.at));
  }
  const today3 = () => todos().filter(r => r.kind !== 'ask').slice(0, 3);
  const asks = () => todos().filter(r => r.kind === 'ask');
  const doneSince = k => of('todo').filter(r => r.status === 'done' && (r.doneAt || '').slice(0, 10) >= k);

  // ===== お金 =====
  const ym = k => k.slice(0, 7);
  function dayIn(ymk, day) { const [y, m] = ymk.split('-').map(Number), last = new Date(y, m, 0).getDate(); return `${ymk}-${p2(Math.min(day, last))}`; }
  const nextMonth = ymk => { const [y, m] = ymk.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${p2(m + 1)}`; };
  function nextPayday() { const t = D.today(), k = dayIn(ym(t), money.payday || 25); return k > t ? k : dayIn(nextMonth(ym(t)), money.payday || 25); }
  // 支払いの「次の回」：今月分を払っていなければ今月（過ぎていても）、払っていれば来月
  function occurrence(p) {
    const t = ym(D.today()); let m = t;
    if (money.paid[p.id + ':' + m]) m = nextMonth(m);
    return { id:p.id, name:p.name, amt:p.amt, due:dayIn(m, p.day), ym:m, paidNow:!!money.paid[p.id + ':' + t] };
  }
  function moneyNow() {
    const t = D.today(), pd = nextPayday(), days = Math.max(1, D.diff(t, pd));
    const occ = money.pays.map(occurrence).sort((a, b) => a.due.localeCompare(b.due));
    const unpaid = occ.filter(o => o.due <= pd);
    const outToday = of('money').filter(r => r.kind === 'out' && r.date === t).reduce((s, r) => s + (r.amt || 0), 0);
    if (!money.cash) return { set:false, days, payday:pd, unpaid, occ, next:occ[0] || null, outToday, left:null, perDay:null, pig:money.pig };
    const since = money.cash.at;
    let left = money.cash.amt;
    of('money').forEach(r => { if (r.at > since && r.amt) left += r.kind === 'in' ? r.amt : -r.amt; });
    (money.pigLog || []).forEach(x => { if (x.at > since) left -= x.amt; });
    const unpaidSum = unpaid.reduce((s, o) => s + (o.amt || 0), 0);
    const perDay = Math.max(0, Math.floor((left - unpaidSum) / days / 100) * 100);
    return { set:true, days, payday:pd, unpaid, occ, next:occ[0] || null, outToday, left, perDay, pig:money.pig, unpaidSum };
  }
  async function saveMoney() { await DB.set('money', money); changed('money'); }
  async function setCash(amt) { money.cash = { amt:Math.round(amt), at:new Date().toISOString() }; await saveMoney(); }
  async function payToggle(o) {
    const key = o.id + ':' + o.ym;
    if (money.paid[key]) { delete money.paid[key]; const r = recs.find(x => x.payKey === key); if (r) await remove(r.id); }
    else { money.paid[key] = true; await add({ domain:'money', kind:'out', text:`${o.name}（支払い）`, amt:o.amt, payKey:key, src:'pay' }, true); }
    await saveMoney();
  }
  async function pigAdd(amt) {
    const before = money.pig; money.pig += amt; (money.pigLog = money.pigLog || []).push({ at:new Date().toISOString(), amt });
    await saveMoney();
    if (Math.floor(money.pig / 1000) > Math.floor(before / 1000)) Album.add('mika', `ミカの貯金箱が${yen(Math.floor(money.pig / 1000) * 1000)}になった`);
    return money.pig;
  }

  // ===== 健康（問診） =====
  const chkKey = k => 'chk:' + k;
  const checkup = k => DB.get(chkKey(k), {});
  async function setCheckup(k, patch) { const c = Object.assign(await checkup(k), patch); await DB.set(chkKey(k), c); changed('health'); return c; }
  async function week(k = D.today()) { const out = []; for (let i = 6; i >= 0; i--) { const d = D.add(k, -i); out.push({ day:d, c:await checkup(d), food:of('food').filter(r => r.date === d) }); } return out; }

  // ===== いつもの =====
  const usuals = () => usual.slice();
  async function setUsual(list) { usual = list; await DB.set('usual', usual); changed('usual'); }
  // 同じ食べ物・飲み物・ゲームが2週間で3回以上 → 「いつもの」に入れるか一度だけ聞く
  async function usualCandidate(r) {
    if (!['food', 'play'].includes(r.domain)) return null;
    const asked = await DB.get('usualAsked', []);
    const name = r.text.replace(/[0-9０-９]+円?|昼|夜|朝|に|を|食べた|飲んだ|やった|した/g, '').trim();
    if (!name || name.length > 20 || asked.includes(name) || usual.some(u => u.text.includes(name))) return null;
    const from = D.add(D.today(), -14);
    const n = of(r.domain).filter(x => x.date >= from && x.text.includes(name)).length;
    if (n < 3) return null;
    asked.push(name); await DB.set('usualAsked', asked);
    return { text:name, domain:r.domain };
  }

  // ===== 天気（Open-Meteo：キー不要。1時間に1回まで） =====
  async function loadWeather(force) {
    if (!force && weather && Date.now() - weather.t < 36e5) return weather;
    const area = await DB.get('area', { name:'大阪', lat:34.69, lon:135.50 });
    try {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lon}&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=3`;
      const j = await (await fetch(u)).json();
      weather = { t:Date.now(), area:area.name, now:Math.round(j.current.temperature_2m), days:j.daily.time.map((d, i) => ({ day:d, max:Math.round(j.daily.temperature_2m_max[i]), min:Math.round(j.daily.temperature_2m_min[i]), rain:j.daily.precipitation_probability_max[i] })) };
      await DB.set('weather', weather);
    } catch (e) {}
    return weather;
  }
  const weatherText = () => !weather ? '' : `${weather.area}：今${weather.now}℃。` + weather.days.slice(0, 2).map((d, i) => `${i ? '明日' : '今日'}${d.min}〜${d.max}℃・降水${d.rain}%`).join('、');

  // ===== AIに渡す材料（質問に関係する分野だけ＋いつもの） =====
  const KEYS = [
    [/寒|暑|部屋|布団|毛布|家具|家電|エアコン|引っ越|掃除|洗濯/, ['home', 'clothes']],
    [/服|着る|着て|コート|ジャケット|靴/, ['clothes']],
    [/金|円|払|給料|貯金|買|節約|返済|家賃|カード/, ['money']],
    [/寝|眠|体|頭|痛|疲|しんど|風邪|酒|飲|体重|運動/, ['health', 'food']],
    [/食|ご飯|飯|ラーメン|昼|夜|朝|腹|弁当|出前/, ['food']],
    [/予定|明日|あさって|週末|土曜|日曜|来週|何時|約束/, ['plan']],
    [/やる|やること|締め切り|期限|資料|仕事|会社|セミナー|上司/, ['todo', 'work']],
    [/ゲーム|ブルアカ|鳴潮|ゼンゼロ|アニメ|漫画|サッカー/, ['play']],
    [/友|飲み会|彼女|母|兄|さん|ちゃん|くん/, ['people', 'plan']],
  ];
  function pick(text) {
    const s = new Set();
    KEYS.forEach(([re, ds]) => { if (re.test(text)) ds.forEach(d => s.add(d)); });
    of('people').forEach(r => { const n = (r.text.match(/^[^\s、。：:]{1,8}/) || [''])[0]; if (n && text.includes(n)) s.add('people'); });
    if (!s.size) ['plan', 'todo', 'money', 'health'].forEach(d => s.add(d));
    return [...s];
  }
  const line = r => `・${r.state !== 'sure' ? `[${STATES[r.state] || r.state}]` : ''}${r.date ? D.md(r.date) : ''}${r.time ? ' ' + r.time : ''} ${r.text}${r.amt ? `（${yen(r.amt)}）` : ''}${r.due ? `〔期限${D.md(r.due)}〕` : ''}${r.domain === 'todo' && r.status !== 'open' ? `〔${r.status === 'done' ? '完了' : r.status}〕` : ''}`;
  function context(domains, per = 12) {
    const parts = [];
    domains.forEach(dm => {
      let list = of(dm);
      if (dm === 'plan') list = plans(D.add(D.today(), -3), 30);
      if (dm === 'todo') list = todos().concat(doneSince(D.add(D.today(), -7)));
      list = list.slice(-per);
      if (list.length) parts.push(`【${DOMAINS[dm]}】\n` + list.map(line).join('\n'));
    });
    return parts.join('\n');
  }
  function usualText() { return usual.length ? '【いつもの】' + usual.map(u => u.text).join('、') : ''; }
  // 今の状況の要約（ブリーフィング・通知・週報で使う）
  function snapshot() {
    const m = moneyNow(), t = D.today();
    return {
      today:D.now(), duty:DUTY, week:Array.from({ length:7 }, (_, i) => ({ day:D.add(t, i), k:dutyOf(D.add(t, i)) })),
      money:m.set ? `給料日まで${m.days}日、1日${yen(m.perDay)}まで、手元${yen(m.left)}、今日使った${yen(m.outToday)}` : `お金は未設定。給料日まで${m.days}日`,
      pays:m.unpaid.map(o => `${o.name} ${D.md(o.due)} ${yen(o.amt)}`).join('、'),
      plans:plans(t, 2).map(r => `${D.label(r.date)}${r.time ? ' ' + r.time : ''} ${r.text}`).join('、'),
      todos:todos().slice(0, 6).map(r => r.text + (r.due ? `（${D.label(r.due)}まで）` : '')).join('、'),
      weather:weatherText(), usual:usual.map(u => u.text).join('、'),
    };
  }

  // ===== 割り込み（得意分野の子が、当番に関係なく出てくる） =====
  async function alerts() {
    const out = [], m = moneyNow(), t = D.today(), hr = new Date().getHours();
    if (m.set && m.perDay < 500) out.push({ id:'money-low', k:'mika', f:'worry', text:`先生……給料日まであと${m.days}日で、1日${yen(m.perDay)}だよ。今日は使わない日にしよ？` });
    else if (m.set && m.perDay > 0 && m.outToday > m.perDay * 1.5) out.push({ id:'money-over', k:'mika', f:'worry', text:`先生、今日はもう${yen(m.outToday)}使ってるよ。明日はちょっと抑えて、一緒にがんばろ？` });
    const late = m.unpaid.filter(o => D.diff(t, o.due) <= 3);
    if (late.length) out.push({ id:'pay-' + late[0].id, k:'mika', f:'normal', text:`${late[0].name}、${D.label(late[0].due)}だよ☆ 払ったら秘書室でチェックしてね` });
    const c1 = await checkup(D.add(t, -1)), c0 = await checkup(t);
    if ((c0.sleep != null && c0.sleep <= 5) && (c1.sleep != null && c1.sleep <= 5)) out.push({ id:'sleep', k:'azurite', f:'worry', text:'陛下、2日続けて睡眠が5時間以下です。今夜は24時までに横になってください' });
    const due = todos().filter(r => r.due && r.due <= D.add(t, 1));
    if (due.length) out.push({ id:'due-' + due[0].id, k:'ellen', f:'normal', text:`よーへー、「${due[0].text}」${due[0].due < t ? '期限すぎてる' : D.label(due[0].due) + 'まで'}。……今のうちにやっとこ` });
    if (hr >= 1 && hr < 4) out.push({ id:'late', k:'hoshino', f:'sleepy', text:'うへ〜、先生、もう寝よ〜？ 明日のおじさんが困っちゃうよ〜' });
    else if (todos().length >= 9) out.push({ id:'many', k:'hoshino', f:'worry', text:'先生〜、やることたまりすぎだよ〜。いらないのは「やめる」にしちゃお？' });
    const seen = await DB.get('seen:' + t, []);
    return out.filter(a => !seen.includes(a.id));
  }
  async function seeAlert(id) { const k = 'seen:' + D.today(), s = await DB.get(k, []); s.push(id); await DB.set(k, s); }

  // ===== GASへ要約を送る（通知を作るため） =====
  async function sync() { if (Api.ready()) Api.call('sync', { snap:snapshot() }, { retry:1, timeout:20000 }); }

  const touch = () => changed('all');
  return { load, onChange, touch, add, update, remove, of, get, plans, nextPlan, todos, today3, asks, doneSince, moneyNow, money:() => money, saveMoney, setCash, payToggle, pigAdd,
    checkup, setCheckup, week, usuals, setUsual, usualCandidate, loadWeather, weatherText, pick, context, usualText, snapshot, alerts, seeAlert, sync, line };
})();

// ===== アルバム（いいことがあった日に、その子の絵が残る） =====
const Album = {
  list:() => DB.get('album', []),
  async add(k, text) {
    const a = await Album.list(), t = D.today();
    if (a.some(x => x.day === t && x.k === k && x.text === text)) return;
    a.push({ k, text, day:t, img:OSHI[k].art || OSHI[k].title[1] });
    await DB.set('album', a);
    toast(`アルバムに${OSHI[k].name}との思い出が増えました`);
  },
};
