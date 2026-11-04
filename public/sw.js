// Only the public shell is cached. Authenticated data never enters Cache Storage.
const CACHE='vv-shell-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/style.css','/app.js','/lib/habits.mjs','/icon.svg'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vv-shell-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!['/style.css','/app.js','/lib/habits.mjs','/icon.svg'].includes(u.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
