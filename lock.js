// Life Partner — Face IDのロック（この端末のパスキーで本人確認するだけ。データの暗号化はしない）
'use strict';
const Lock = (() => {
  const RELOCK = 10 * 60 * 1000;   // 裏に回して10分たったら、戻ったときにもう一度
  let hiddenAt = 0, shown = false;
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const can = () => !!(window.PublicKeyCredential && navigator.credentials);

  // はじめて：この端末にパスキーを作る（Face IDが出る）
  async function setup() {
    if (!can()) { toast('この端末ではFace IDのロックを使えません'); return false; }
    try {
      const c = await navigator.credentials.create({ publicKey:{
        challenge:rnd(32), rp:{ name:'Life Partner' }, user:{ id:rnd(16), name:'yohei', displayName:'ようへい' },
        pubKeyCredParams:[{ type:'public-key', alg:-7 }, { type:'public-key', alg:-257 }],
        authenticatorSelection:{ authenticatorAttachment:'platform', userVerification:'required', residentKey:'preferred' }, timeout:60000 } });
      await DB.set('lockCred', b64(c.rawId));
      return true;
    } catch (e) { toast('Face IDの登録をやめました'); return false; }
  }
  // 本人確認。成功で true
  async function check() {
    const id = await DB.get('lockCred');
    if (!id || !can()) return true;   // 登録がないときは、そのまま開く
    try {
      await navigator.credentials.get({ publicKey:{ challenge:rnd(32), allowCredentials:[{ type:'public-key', id:unb64(id) }], userVerification:'required', timeout:60000 } });
      return true;
    } catch (e) { return false; }
  }
  // 戻ってきたときの画面
  function cover() {
    if (shown || !CFG.lock) return; shown = true;
    const el = h(`<div id="lockCover"><div class="lk-in"><b>LIFE PARTNER</b><button class="btn" id="lkGo"><span>Face IDで開く</span></button></div></div>`);
    document.body.appendChild(el);
    $('lkGo').onclick = async () => { if (await check()) { el.remove(); shown = false; } };
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (CFG.lock && hiddenAt && Date.now() - hiddenAt > RELOCK && App.started()) cover();
  });
  return { setup, check, enabled:() => !!CFG.lock };
})();
