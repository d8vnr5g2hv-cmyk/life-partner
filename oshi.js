// Life Partner — 推しの設定（1人1項目。追加するときは、ここに1項目と素材を足すだけ）
'use strict';
const vlist = (pre, n) => Array.from({ length:n }, (_, i) => `fav:${pre}_v${p2(i + 1)}.mp3`);
const OSHI = {
  mika:{
    name:'ミカ', call:'ようへい先生', call2:'先生', color:'#f59ad0', skill:'お金', dow:null,
    title:['fav:title_mika_1.jpg', 'fav:title_mika_2.jpg'],
    lobby:{ video:'fav:mika_tall_h264.mp4', poster:'fav:mika_tall_poster.jpg', img:['fav:title_mika_1.jpg', 'fav:title_mika_2.jpg'] },
    art:'art_mika.jpg', nap:null,
    bgm:{ src:'fav:c2_bgm.mp3', len:67.54 }, voices:vlist('c2', 10),
    face:[.6, .43, .2, .12], motes:['#fff6fb', '#efe4ff'],
    hello:{ am:'おはよ、ようへい先生☆', pm:'ようへい先生、おつかれ！', night:'おかえり、ようへい先生☆' },
    tap:['えへへ、どうしたの先生？', 'ようへい先生、今日もがんばってるね☆', '先生……ちゃんと休んでる？'],
  },
  hoshino:{
    name:'ホシノ', call:'先生〜', call2:'ようへい先生', color:'#ffb3c7', skill:'無理しすぎ', dow:null,
    title:['fav:title_hoshino_1.jpg', 'fav:title_hoshino_2.jpg'],
    lobby:{ video:'fav:lobby_tall_h264.mp4', poster:'fav:lobby_tall_poster.jpg', img:['fav:title_hoshino_1.jpg', 'fav:title_hoshino_2.jpg'] },
    art:'art_hoshino.jpg', nap:'nap_hoshino.jpg',
    bgm:{ src:'fav:bgm.mp3', len:117.25 }, voices:vlist('c1', 12),
    face:[.66, .51, .21, .13], motes:['#fff1e0', '#ffd9c2'],
    hello:{ am:'うへ〜、先生おはよ〜', pm:'先生〜、おつかれさま〜', night:'先生、おかえり〜。今日もがんばったね〜' },
    tap:['うへ〜、なになに〜？', '先生〜、ちょっと休も？', 'おじさんはここにいるよ〜'],
  },
  ellen:{
    name:'エレン', call:'よーへー', call2:'よーへー', color:'#8f9cff', skill:'期限', dow:null,
    title:['title_ellen_1.jpg', 'title_ellen_2.jpg'],
    lobby:{ img:['lobby_ellen_1.jpg', 'lobby_ellen_2.jpg'] },
    art:'desk_ellen.jpg', nap:null, bgm:null, voices:[],
    face:[.5, .4, .2, .12], motes:['#eef0ff', '#dfe4ff'],
    hello:{ am:'……おはよ、よーへー', pm:'よーへー、おつかれ', night:'おかえり、よーへー。……おつかれ' },
    tap:['……なに？', 'めんどいけど、今日の分は見とくから', '甘いもの、ある？'],
  },
  azurite:{
    name:'アズライト', call:'陛下', call2:'陛下', color:'#5cc8d0', skill:'体調', dow:null,
    title:['title_azurite_1.jpg', 'title_azurite_2.jpg'],
    lobby:{ img:['lobby_azurite_1.jpg', 'lobby_azurite_2.jpg'] },
    art:'desk_azurite.jpg', clinic:'clinic_azurite.jpg', nap:null, bgm:null, voices:[],
    face:[.5, .4, .2, .12], motes:['#ecfbfb', '#d6f3f5'],
    hello:{ am:'おはようございます、陛下', pm:'お疲れさまです、陛下', night:'おかえりなさいませ、陛下' },
    tap:['陛下、何かご用でしょうか', '顔色は……悪くありませんね', '本日も陛下のお側に'],
  },
};
const ORDER = Object.keys(OSHI);
const SKILL_OF = { money:'mika', health:'azurite', due:'ellen', rest:'hoshino' };

// ===== 当番 =====
// 曜日固定（OSHI[k].dow に 0〜6 を入れる）が全員そろっていれば曜日で、そうでなければ日付で順番に回す
function dutyOf(dayKey) {
  const byDow = ORDER.filter(k => OSHI[k].dow != null);
  if (byDow.length === 7) { const w = D.parse(dayKey).getDay(); return byDow.find(k => OSHI[k].dow === w) || ORDER[0]; }
  const n = Math.floor(D.parse(dayKey).getTime() / 864e5);
  return ORDER[((n % ORDER.length) + ORDER.length) % ORDER.length];
}
let DUTY = ORDER[0];
async function loadDuty() {
  const o = await DB.get('dutyOverride', null);
  DUTY = o && o.day === D.today() && OSHI[o.k] ? o.k : dutyOf(D.today());
  return DUTY;
}
async function setDuty(k) { await DB.set('dutyOverride', { day:D.today(), k }); DUTY = k; }

// ===== 絵（届いていない絵は、その子の色の仮の絵にする） =====
const Pic = {
  ok:new Map(),
  check(url) {
    if (!url) return Promise.resolve(false);
    if (Pic.ok.has(url)) return Pic.ok.get(url);
    const p = new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = url; });
    Pic.ok.set(url, p); return p;
  },
  // el の背景に絵を置く。なければ仮の絵（色と名前）
  async bg(el, path, k, note = '') {
    const url = A(path);
    el.classList.remove('ph'); el.style.backgroundImage = '';
    if (await Pic.check(url)) { el.style.backgroundImage = `url("${url}")`; return true; }
    el.classList.add('ph'); el.style.setProperty('--phc', OSHI[k] ? OSHI[k].color : '#9ec9ff');
    el.dataset.ph = (OSHI[k] ? OSHI[k].name : '') + (note ? `\n${note}` : '');
    return false;
  },
  // 最初に見つかった絵
  async first(paths) { for (const p of paths.filter(Boolean)) if (await Pic.check(A(p))) return A(p); return null; },
};

// ===== 表情アイコン（face_<k>_<表情>.png）。ないときは丸い色と頭文字 =====
const FACES = { normal:'ふだん', smile:'笑顔', shy:'照れ', worry:'心配', sleepy:'眠い' };
const Face = {
  img(k, f = 'normal', size = '') {
    const o = OSHI[k] || OSHI[ORDER[0]], fx = FACES[f] ? f : 'normal';
    return `<span class="face ${size}" style="--fc:${o.color}"><i>${esc(o.name[0])}</i><img src="face_${k}_${fx}.png" alt="" onerror="if(!this.dataset.f&&'${fx}'!=='normal'){this.dataset.f=1;this.src='face_${k}_normal.png'}else this.remove()"></span>`;
  },
};
