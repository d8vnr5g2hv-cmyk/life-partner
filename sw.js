// Life Partner — オフラインでも開けるように（中身を直したら CACHE の番号を上げる）
const CACHE = 'life-partner-v1';
const CORE = ['./', 'index.html', 'base.css', 'title.css', 'core.js', 'oshi.js', 'data.js', 'input.js', 'home.js', 'desk.js', 'rooms.js', 'talk.js', 'settings.js', 'lock.js', 'title.js', 'app.js', 'manifest.json', 'icon-180.png', 'icon.png', 'art_mika.jpg', 'art_hoshino.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('life-partner-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;   // GASや天気はそのまま
  if (/\.(mp4|mov)$/i.test(u.pathname)) return;                            // 動画は範囲読み込みなのでキャッシュしない
  e.respondWith(caches.match(e.request, { ignoreSearch:true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && /\.(jpe?g|png|webp|mp3)$/i.test(u.pathname)) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return res;
  })));
});
