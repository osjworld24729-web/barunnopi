// 바른높이: 자세 인식 모델과 라이브러리를 기기에 저장해 인터넷 없이도 실행되게 한다.
// 버전이 고정된 외부 파일(라이브러리, 모델)은 저장본을 먼저 쓰고,
// 앱 페이지는 인터넷이 되면 새로 받고 안 되면 저장본을 쓴다.
const CACHE = 'barunnopi-v1';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function storable(res) {
  return res && (res.ok || res.type === 'opaque');
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (storable(res)) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (storable(res)) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (e) {
    const hit = (await cache.match(req)) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  const external = CDN_HOSTS.includes(url.hostname);
  const own = url.origin === self.location.origin;
  if (!external && !own) return;
  // 어떤 이유로든 저장 처리가 실패하면 평소처럼 인터넷에서 받는다
  event.respondWith((external ? cacheFirst(req) : networkFirst(req)).catch(() => fetch(req)));
});
