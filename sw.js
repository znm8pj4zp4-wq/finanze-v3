'use strict';

const cacheName = 'finanze-v3-shell-2';
const root = new URL('./', self.registration.scope);
const files = ['index.html', 'dashboard.js', 'movements.js', 'vendor/supabase.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const shell = new Set(files.map(path => new URL(path, root).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...shell].map(url => new Request(url, {cache:'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('finanze-v3-shell-') && n !== cacheName)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== root.origin) return;
  const page = request.mode === 'navigate' &&
    (url.pathname === root.pathname || url.pathname === root.pathname + 'index.html');
  if (!page && !shell.has(url.href)) return;
  const fallback = page ? new URL('index.html',root).href : url.href;
  event.respondWith((async () => {
    try { return await fetch(request); }
    catch (error) {
      const cached = await (await caches.open(cacheName)).match(fallback);
      if (cached) return cached;
      throw error;
    }
  })());
});
