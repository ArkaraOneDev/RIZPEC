/**
 * assets/js/processing.js
 * Logika untuk UI Drill-down (Slider Horizontal) pada Panel Processing
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Deklarasi Elemen DOM
    const viewport = document.getElementById('processing-viewport');
    
    // Header Elements
    const headerText = document.getElementById('processing-header-text');
    const headerIcon = document.getElementById('processing-header-icon');
    const backBtn = document.getElementById('btn-processing-back');
    
    // Menu & Content Elements
    const menuItems = document.querySelectorAll('.processing-menu-item');
    const detailContentContainer = document.getElementById('processing-detail-content');

    // Default State untuk Header Utama
    const defaultTitle = "Processing";
    const defaultIconClass = "fa-solid fa-gears text-blue-400"; // Sesuaikan dengan class awal di HTML

    /**
     * Event Listener untuk masing-masing Menu Utama
     * Ketika diklik: Masuk (Drill-down) ke detail sub-layer
     */
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Ambil data dari atribut HTML
            const id = this.getAttribute('data-id');
            const title = this.getAttribute('data-title');
            const icon = this.getAttribute('data-icon');
            const colorClass = this.getAttribute('data-color');

            // 1. Update Header
            headerText.textContent = title;
            headerIcon.className = `fa-solid ${icon} ${colorClass}`;
            
            // Tampilkan Tombol Back
            backBtn.classList.remove('hidden');

            // 2. Tampilkan Konten (Render berdasarkan ID)
            renderDetailContent(id);

            // 3. Mainkan Animasi Slider
            // Menggeser viewport -50% ke kiri agar panel kanan (detail) terlihat
            viewport.classList.remove('translate-x-0');
            viewport.classList.add('-translate-x-1/2');
        });
    });

    /**
     * Event Listener untuk Tombol Back
     * Ketika diklik: Kembali ke Menu Utama Processing
     */
    backBtn.addEventListener('click', () => {
        // 1. Kembalikan Header ke Kondisi Default
        headerText.textContent = defaultTitle;
        headerIcon.className = defaultIconClass;
        
        // Sembunyikan Tombol Back
        backBtn.classList.add('hidden');

        // 2. Mainkan Animasi Slider
        // Menggeser viewport kembali ke 0 (posisi awal)
        viewport.classList.remove('-translate-x-1/2');
        viewport.classList.add('translate-x-0');
        
        // Opsional: Bersihkan konten detail setelah animasi selesai untuk meringankan DOM
        setTimeout(() => {
            detailContentContainer.innerHTML = ''; 
        }, 300); // 300ms sesuai dengan duration-300 di class tailwind
    });

    /**
     * Fungsi untuk merender konten Sub-layer berdasarkan Menu yang dipilih
     * @param {string} categoryId - 'pit', 'disp', atau 'draw'
     */
    function renderDetailContent(categoryId) {
        let htmlContent = '';

        // DUMMY DATA: Di bawah ini Anda bisa menyambungkan data asli dari geometry/state aplikasi Anda
        if (categoryId === 'pit') {
            htmlContent = `
                <!-- Sub-layer Pit -->
                <div class="flex items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded shadow-sm hover:border-slate-500 transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-cube text-[10px] text-blue-400"></i>
                        <span class="text-[10px] text-slate-300 font-medium">Pit Block Model</span>
                    </div>
                    <input type="checkbox" checked class="w-3 h-3 rounded bg-slate-900 border-slate-600 cursor-pointer">
                </div>
                <div class="flex items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded shadow-sm hover:border-slate-500 transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-draw-polygon text-[10px] text-blue-400"></i>
                        <span class="text-[10px] text-slate-300 font-medium">Pit Boundary</span>
                    </div>
                    <input type="checkbox" checked class="w-3 h-3 rounded bg-slate-900 border-slate-600 cursor-pointer">
                </div>
            `;
        } else if (categoryId === 'disp') {
            htmlContent = `
                <!-- Sub-layer Disposal -->
                <div class="flex items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded shadow-sm hover:border-slate-500 transition-colors">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-cube text-[10px] text-emerald-400"></i>
                        <span class="text-[10px] text-slate-300 font-medium">Disposal Block Model</span>
                    </div>
                    <input type="checkbox" checked class="w-3 h-3 rounded bg-slate-900 border-slate-600 cursor-pointer">
                </div>
            `;
        } else if (categoryId === 'draw') {
            htmlContent = `
                 <!-- Sub-layer Drawing -->
                 <div class="text-[10px] text-slate-500 italic text-center py-4 bg-slate-900/30 rounded border border-slate-700/50">
                    Belum ada object drawing.
                 </div>
            `;
        } else {
            htmlContent = `
                <div class="text-[10px] text-rose-500 italic text-center py-2">Kategori tidak ditemukan.</div>
            `;
        }

        // Terapkan HTML ke kontainer detail
        detailContentContainer.innerHTML = htmlContent;
        
        // Catatan: Jika Anda butuh Event Listener untuk checkbox di dalam htmlContent ini, 
        // Anda harus melakukan querySelectorAll dan addEventListener di sini setelah innerHTML selesai.
    }
});