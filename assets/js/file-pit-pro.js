// ==============================================================
// ADVANCED PIT PROCESSING LOGIC (PRO FEATURES)
// Menangani logic untuk Res. Incremental, Res. Cumulative, dan Res. Zone
// ==============================================================

// Inisialisasi state penyimpanan konfigurasi PRO untuk setiap Pit
window.pitProConfigs = JSON.parse(localStorage.getItem('rizpec_pit_pro_configs')) || {};

document.addEventListener('click', (e) => {
    // Tangkap event click pada tombol Apply di Processing Modal
    if (e.target && e.target.id === 'btn-apply-processing') {
        const modal = document.getElementById('processing-modal');
        if (!modal) return;

        // Ambil identifier Pit dan Mode yang sedang aktif di Modal
        const pitId = modal.getAttribute('data-pit');
        const mode = modal.getAttribute('data-mode');

        if (!pitId || !mode) return;

        // Pastikan object config untuk pit ini tersedia
        if (!window.pitProConfigs[pitId]) {
            window.pitProConfigs[pitId] = {};
        }

        // 1. Ekstrak Data Input berdasarkan Mode
        let config = {};
        if (mode === 'Res. Incremental') {
            const srLimit = document.getElementById('pro-sr-limit')?.value || '';
            config = { srLimit };
            
        } else if (mode === 'Res. Cumulative') {
            const direction = document.getElementById('pro-direction')?.value || 'Top-Down';
            const sequence = document.getElementById('pro-sequence')?.value || 'By Bench';
            const srLimit = document.getElementById('pro-sr-limit')?.value || '';
            config = { direction, sequence, srLimit };
            
        } else if (mode === 'Res. Zone') {
            const wasteThick = document.getElementById('pro-waste-thick')?.value || '';
            const resourceThick = document.getElementById('pro-resource-thick')?.value || '';
            const qualityFrom = document.getElementById('pro-quality-from')?.value || '';
            const qualityTo = document.getElementById('pro-quality-to')?.value || '';
            config = { wasteThick, resourceThick, qualityFrom, qualityTo };
        }

        // 2. Simpan Konfigurasi Parameter ke State & LocalStorage
        // (Parameter aman disimpan di sini karena ini hanya data konfigurasi pembantunya)
        window.pitProConfigs[pitId][mode] = config;
        localStorage.setItem('rizpec_pit_pro_configs', JSON.stringify(window.pitProConfigs));

        // 3. Update Dropdown secara Visual ke mode yang baru dipilih
        const selectElement = document.querySelector(`.pit-color-mode-select[data-pit="${pitId}"]`);
        if (selectElement) {
            selectElement.value = mode;
        }

        // 4. Sembunyikan Modal
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // 5. Evaluasi Status Warna (Memicu Tombol "Apply Color" Utama untuk Aktif)
        // Render geometry tidak akan berjalan di sini, melainkan menunggu user konfirmasi lewat tombol Apply Color.
        if (typeof window.evaluateUnsavedColorChanges === 'function') {
            window.evaluateUnsavedColorChanges();
        }
    }
});

// Helper function untuk mengambil setting PRO milik suatu Pit
// (Bisa digunakan di file geometry.js saat me-render warna blok 3D nanti)
window.getPitProConfig = function(pitId, mode) {
    if (!window.pitProConfigs[pitId]) return null;
    return window.pitProConfigs[pitId][mode] || null;
};