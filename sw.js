// Finanze v3 - test login. Non eliminiamo o usiamo le cache della v2.
'use strict';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Durante il test di accesso lasciamo tutte le richieste alla rete.
// In particolare, non serviamo copie obsolete della pagina di login dalla cache.
