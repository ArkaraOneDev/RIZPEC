// Ini adalah Service Worker dasar. 
// Kehadiran file ini beserta event 'fetch' adalah syarat mutlak 
// agar browser mau memunculkan tombol/prompt Install PWA.

const CACHE_NAME = 'rizpec-cache-v1';

// Event Install: Terjadi pertama kali service worker diregistrasi
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Ter-install');
    // Jika nanti kamu ingin cache file offline, bisa diletakkan disini
    self.skipWaiting();
});

// Event Activate: Terjadi saat service worker mulai aktif
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Aktif');
    return self.clients.claim();
});

// Event Fetch: Syarat wajib PWA
self.addEventListener('fetch', (event) => {
    // Saat ini hanya meneruskan request secara normal tanpa cache-first.
    // Nanti bisa dimodifikasi agar web bisa jalan 100% offline.
    event.respondWith(fetch(event.request));
});