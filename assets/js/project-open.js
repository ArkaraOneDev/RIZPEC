// ==========================================================
// RIZPEC RECENT PROJECT DATABASE & UI HANDLER
// Menyimpan FileSystemFileHandle agar file terakhir dapat 
// dibuka langsung tanpa perlu mencari direktorinya lagi.
// ==========================================================

const RizpecRecentDB = {
    dbName: 'RizpecRecentDB',
    dbVersion: 1,
    storeName: 'recentProjects',
    
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Gunakan filename sebagai ID unik pengganti file path string
                    db.createObjectStore(this.storeName, { keyPath: 'name' }); 
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Menyimpan akses (Handle) directory ke local browser DB
    async saveHandle(handle, fileName) {
        try {
            const db = await this.init();
            const tx = db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.put({
                name: fileName,
                handle: handle,
                timestamp: Date.now() // Gunakan timestamp untuk sorting 'Last Saved/Opened'
            });

            // === FIX: LUPAKAN (HAPUS) ID TERLAMA JIKA LEBIH DARI 4 CARD ===
            tx.oncomplete = () => {
                const checkTx = db.transaction(this.storeName, 'readwrite');
                const checkStore = checkTx.objectStore(this.storeName);
                const request = checkStore.getAll();
                request.onsuccess = () => {
                    const allRecords = request.result;
                    if (allRecords.length > 4) {
                        // Urutkan dari yang terbaru ke terlama
                        allRecords.sort((a, b) => b.timestamp - a.timestamp);
                        // Ambil record ke-5 dan seterusnya untuk dihapus dari database
                        const toDelete = allRecords.slice(4);
                        toDelete.forEach(record => checkStore.delete(record.name));
                    }
                };
            };
            // ==============================================================
        } catch (e) {
            console.warn("Rizpec: Gagal menyimpan FileSystem Handle. History tidak akan tersimpan.", e);
        }
    },

    // Mengambil riwayat 4 file terakhir yang pernah disimpan/dibuka
    async getRecent() {
        try {
            const db = await this.init();
            return new Promise((resolve) => {
                const tx = db.transaction(this.storeName, 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => {
                    // Sorting berdasarkan waktu ter-update paling baru (descending)
                    // Dibatasi slice(0, 4) karena slot history maksimal hanya 4 card (Card 2 - 5)
                    const sorted = request.result.sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
                    resolve(sorted);
                };
                request.onerror = () => resolve([]);
            });
        } catch (e) {
            console.warn("Rizpec: Gagal mengambil riwayat Handle.", e);
            return [];
        }
    }
};

// ==========================================================
// UI INTERACTION HANDLER 
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnSidebarOpen = document.getElementById('btn-sidebar-open');
    const btnSidebarNew = document.getElementById('btn-sidebar-new');
    const viewLanding = document.getElementById('view-landing');
    const btnBrowseLocal = document.getElementById('btn-browse-local');
    const recentWrapper = document.getElementById('recent-cards-wrapper');
    const fileInputRiz = document.getElementById('file-input-riz');

    // 1. Aksi ketika tombol "Open Project" di sidebar diklik
    if (btnSidebarOpen) {
        btnSidebarOpen.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Pindah ke tab Landing Page (Project)
            const projectTab = document.querySelector('.nav-tab[data-target="panel-project"]');
            if (projectTab) projectTab.click();

            // Aktifkan Transisi CSS untuk Open Project Mode (Menggeser elemen ke atas)
            viewLanding.classList.add('open-mode-active');
            
            // Tarik dan Susun Card History
            await renderRecentCards();
        });
    }

    // Batalkan mode Open Project jika user menekan tombol "New Project"
    if (btnSidebarNew) {
        btnSidebarNew.addEventListener('click', () => {
            if (viewLanding.classList.contains('open-mode-active')) {
                viewLanding.classList.remove('open-mode-active');
            }
        });
    }
    
    // Batalkan mode jika user menekan area luar (Background Grid) pada landing page
    viewLanding.addEventListener('click', (e) => {
        if (e.target === viewLanding || e.target.classList.contains('bg-grid-pattern')) {
            viewLanding.classList.remove('open-mode-active');
        }
    });

    // 2. Aksi Card Pertama (Browse File Manual dari Local Directory)
    if (btnBrowseLocal) {
        btnBrowseLocal.addEventListener('click', async () => {
            try {
                // Gunakan File System Access API jika browser mendukung
                if (window.showOpenFilePicker) {
                    const [fileHandle] = await window.showOpenFilePicker({
                        id: 'rk-project-dir', 
                        startIn: 'documents',
                        excludeAcceptAllOption: false,
                        types: [{ 
                            description: 'RIZPEC Project File (.riz)', 
                            accept: { '*/*': ['.riz'] } 
                        }]
                    });
                    
                    const file = await fileHandle.getFile();
                    // Daftarkan/update handle ke riwayat history database browser
                    await RizpecRecentDB.saveHandle(fileHandle, file.name);
                    
                    // Teruskan aliran data ke loader utama sistem Rizpec (dari project.js)
                    if (typeof window.handleRizFileWithWorker === 'function') {
                        window.handleRizFileWithWorker(file);
                    }
                    viewLanding.classList.remove('open-mode-active');

                } else {
                    // Fallback untuk Firefox / Safari Mobile: Gunakan Native Input File HTML
                    if (fileInputRiz) fileInputRiz.click();
                    viewLanding.classList.remove('open-mode-active');
                }
            } catch (err) {
                if (err.name !== 'AbortError') console.warn("Open error:", err);
            }
        });
    }

    // 3. Render Dinamis 4 Card "Last Saved/Opened" History (Card 2 - 5)
    async function renderRecentCards() {
        if (!recentWrapper) return;
        
        const recents = await RizpecRecentDB.getRecent();
        const MAX_RECENT_CARDS = 4; // Maksimal 4 Slot untuk Card 2 hingga 5
        
        recentWrapper.innerHTML = ''; // Bersihkan Kontainer HTML bawaan (Static)
        
        // Loop pasti berjalan 4 kali untuk memastikan slot tetap ada
        for (let i = 0; i < MAX_RECENT_CARDS; i++) {
            if (recents[i]) {
                // Jika history tersedia di slot ini, buat tombol klik
                const item = recents[i];
                const d = new Date(item.timestamp);
                const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' });

                const btn = document.createElement('button');
                btn.className = "shrink-0 w-[160px] bg-slate-800/60 border border-slate-700 hover:border-blue-400 rounded-xl p-4 flex flex-col items-center gap-2 transition-all hover:bg-slate-700 shadow text-left group snap-start relative overflow-hidden";
                btn.innerHTML = `
                    <div class="w-full mb-1 flex justify-between items-center text-slate-500">
                        <i class="fa-solid fa-file-code text-lg group-hover:text-blue-400 transition-colors"></i>
                        <span class="text-[9px] font-mono bg-slate-900/50 px-1.5 rounded border border-slate-700">.RIZ</span>
                    </div>
                    <p class="text-slate-200 text-[12px] font-bold w-full truncate leading-tight mt-1" title="${item.name}">${item.name}</p>
                    <div class="mt-auto w-full border-t border-slate-700 pt-2 flex items-center justify-between">
                        <span class="text-slate-500 text-[9px]">${dateStr}</span>
                        <span class="text-slate-500 text-[9px]">${timeStr}</span>
                    </div>
                `;

                // Saat Card history di-klik -> Minta Permission Buka File Handle
                btn.addEventListener('click', async () => {
                    try {
                        const opts = { mode: 'read' };
                        // Meminta otorisasi browser ulang jika sesi sudah mati, demi memuat ulang file
                        if ((await item.handle.queryPermission(opts)) !== 'granted') {
                            if ((await item.handle.requestPermission(opts)) !== 'granted') {
                                throw new Error('Permission denied');
                            }
                        }
                        const file = await item.handle.getFile();
                        
                        // Update timestamp menjadi terbaru karena baru saja dibuka
                        await RizpecRecentDB.saveHandle(item.handle, item.name);
                        
                        if (typeof window.handleRizFileWithWorker === 'function') {
                            window.handleRizFileWithWorker(file);
                        }
                        viewLanding.classList.remove('open-mode-active');
                    } catch (e) {
                        alert("Akses ditolak atau file sudah dihapus/dipindahkan dari lokasi aslinya.");
                        console.warn(e);
                    }
                });

                recentWrapper.appendChild(btn);
            } else {
                // PENYESUAIAN: Identik 100% dengan class yang ada di `index.html`
                const emptyDiv = document.createElement('div');
                emptyDiv.className = "recent-placeholder shrink-0 w-[160px] bg-slate-800/30 border border-dashed border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center snap-start opacity-60 transition-all hover:bg-slate-800/50 hover:border-slate-500 cursor-default";
                emptyDiv.innerHTML = `
                    <div class="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600 mb-1 transition-colors">
                        <i class="fa-solid fa-file-circle-plus text-lg"></i>
                    </div>
                    <p class="text-slate-500 text-[11px] font-semibold italic">Empty</p>
                `;
                recentWrapper.appendChild(emptyDiv);
            }
        }
    }
});