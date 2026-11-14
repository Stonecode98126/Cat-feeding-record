// 花花餵食記錄 - Service Worker
// 第一次載入時把靜態資源存到本地，之後離線也能開啟頁面。
// ※ 每次更新 index.html 或這個檔案後，請把 CACHE_NAME 的版號 +1，舊快取才會被清掉。
const CACHE_NAME = 'huahua-v2';

// 必要資源：缺任何一個就視為安裝失敗
const CORE_ASSETS = [
  './',
  './index.html'
];

// 選用資源：抓不到（離線、檔案不存在）也不影響安裝
const OPTIONAL_ASSETS = [
  './v3.jpeg',
  'https://unpkg.com/three@0.160.0/build/three.min.js',
  'https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&display=swap'
];

// 這些網域的請求完全不經過 Service Worker（Apps Script 的讀寫一律走網路）
const BYPASS_HOSTS = ['script.google.com', 'script.googleusercontent.com'];

// 這些跨網域的靜態資源會在第一次使用時順便存起來（字型檔由 CSS 動態決定，無法事先列出）
const RUNTIME_CACHE_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const isCacheable = (res) => res && (res.ok || res.type === 'opaque');

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (BYPASS_HOSTS.includes(url.hostname)) return;

  const sameOrigin = url.origin === self.location.origin;

  // 頁面本身：網路優先（改版後馬上看得到），離線才用快取
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 靜態資源：快取優先，並在背景更新快取
  if (sameOrigin || RUNTIME_CACHE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
  // 其他請求不攔截，交給瀏覽器照常處理
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetch(request);
    if (isCacheable(res)) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const cached = (await cache.match(request)) || (await cache.match('./index.html'));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const refresh = fetch(request).then((res) => {
    if (isCacheable(res)) cache.put(request, res.clone());
    return res;
  });

  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}
