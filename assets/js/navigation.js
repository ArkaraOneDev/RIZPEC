/**
 * assets/js/navigation.js
 * -------------------------------------------------------------
 * Menangani logika interaksi UI untuk navigasi utama:
 * 1. Mengunci tab selain Project jika belum ada project yang aktif.
 * 2. Pergantian status aktif tab di Top Toolbar.
 * 3. Tampil/Sembunyi Panel Sidebar Kiri.
 * 4. Tampil/Sembunyi Tampilan Utama (View Kanan/Canvas).
 * 5. Tampil/Sembunyi Layout Dropdown (Hanya di mode 3D).
 * 6. Tampil/Sembunyi Form Pembuatan Project Inline di Landing Page.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Tangkap elemen-elemen Top Toolbar & Sidebar
    const navTabs = document.querySelectorAll('.nav-tab');
    const sidebarPanels = document.querySelectorAll('.sidebar-panel');
    const layoutDropdown = document.getElementById('layout-dropdown');

    // Tangkap elemen View Utama (Kanan)
    const view3D = document.getElementById('view-3d');
    const viewLanding = document.getElementById('view-landing');
    const viewFile = document.getElementById('view-file');
    const viewScheduling = document.getElementById('view-scheduling');
    const viewReport = document.getElementById('view-report');

    // Mapping antara ID panel (sidebar) dengan elemen View Kanan
    const viewMapping = {
        'panel-project': viewLanding,
        'panel-file': viewFile,
        'panel-geometry': view3D,
        'panel-range': view3D,
        'panel-link': view3D,
        'panel-scheduling': viewScheduling,
        'panel-report': viewReport
    };

    // ==============================================================
    // 1. SISTEM PENGUNCIAN TAB MENU (LOCK/UNLOCK TOTAL)
    // ==============================================================
    
    // Fungsi untuk mengecek dan mengupdate status gembok tab
    window.updateTabLockState = function() {
        const hasProject = window.currentProjectName && window.currentProjectName.trim() !== "" && window.currentProjectName !== "Untitled";
        
        navTabs.forEach(tab => {
            const targetId = tab.getAttribute('data-target');
            if (targetId !== 'panel-project') {
                if (!hasProject) {
                    // Jika tidak ada project: MENGUNCI TOTAL (Tidak bisa diklik via pointer-events-none)
                    tab.classList.add('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    tab.classList.remove('hover:bg-slate-700', 'hover:text-slate-200');
                } else {
                    // Jika ada project: Kembalikan fungsi klik dan hover
                    tab.classList.remove('opacity-40', 'cursor-not-allowed', 'pointer-events-none');
                    if (!tab.classList.contains('bg-slate-700')) {
                        tab.classList.add('hover:bg-slate-700', 'hover:text-slate-200');
                    }
                }
            }
        });
    };

    // Jalankan penguncian tab saat pertama kali website diload
    window.updateTabLockState();


    // ==============================================================
    // 2. SISTEM PERGANTIAN TAB (TAB SWITCHER)
    // ==============================================================
    
    navTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetId = tab.getAttribute('data-target');
            const hasProject = window.currentProjectName && window.currentProjectName.trim() !== "" && window.currentProjectName !== "Untitled";

            // Pertahanan kedua: CEGAT AKSES JIKA PROJECT BELUM DIBUAT/DIBUKA
            if (!hasProject && targetId !== 'panel-project') {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            
            // 1. Reset semua gaya tab
            navTabs.forEach(t => {
                t.classList.remove('bg-slate-700', 'text-white', 'shadow-inner', 'font-bold');
                
                if (hasProject || t.getAttribute('data-target') === 'panel-project') {
                    t.classList.add('text-slate-400', 'hover:bg-slate-700', 'hover:text-slate-200');
                } else {
                    t.classList.add('text-slate-400');
                }
            });
            
            // 2. Aktifkan tab yang diklik
            tab.classList.remove('text-slate-400', 'hover:bg-slate-700', 'hover:text-slate-200');
            tab.classList.add('bg-slate-700', 'text-white', 'shadow-inner', 'font-bold');
            
            // 3. Sembunyikan seluruh panel kiri (sidebar)
            sidebarPanels.forEach(p => {
                p.classList.add('hidden');
                p.classList.remove('flex');
            });
            
            // 4. Tampilkan panel kiri yang sesuai dengan target tab
            if (targetId) {
                const targetPanel = document.getElementById(targetId);
                if (targetPanel) {
                    targetPanel.classList.remove('hidden');
                    targetPanel.classList.add('flex');
                }
            }

            // 5. --- KONTROL VISUALISASI CANVAS KANAN ---
            [view3D, viewLanding, viewFile, viewScheduling, viewReport].forEach(v => {
                if (v) {
                    v.classList.add('hidden');
                    v.classList.remove('flex', 'block');
                }
            });

            // 6. Tampilkan view kanan berdasarkan mapping tab yang aktif
            const activeView = viewMapping[targetId];
            if (activeView) {
                activeView.classList.remove('hidden');
                
                // Khusus 3D, trigger resize event agar ukuran memuat ulang dengan benar
                if (activeView === view3D) {
                    activeView.classList.add('block');
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                    }, 50);
                } else {
                    activeView.classList.add('flex');
                }
            }

            // 7. Kontrol visibilitas tombol Layout Dropdown
            if (layoutDropdown) {
                if (activeView === view3D) {
                    layoutDropdown.classList.remove('hidden');
                } else {
                    layoutDropdown.classList.add('hidden');
                }
            }
        });
    });

    if (layoutDropdown) {
        layoutDropdown.classList.add('hidden');
    }

    // ==============================================================
    // 3. PENDETEKSI KLIK DI LUAR FORM NEW PROJECT & OPEN PROJECT
    // ==============================================================
    
    const landingFormContainer = document.getElementById('landing-new-project-container');
    const landingForm = document.getElementById('landing-new-project-form');

    const hideLandingForm = () => {
        if(landingFormContainer) {
            landingFormContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
            landingFormContainer.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
        }
    };

    // Menyembunyikan form jika klik di luar form area (hanya UI interaction)
    document.addEventListener('click', (e) => {
        if (landingFormContainer && !landingFormContainer.classList.contains('opacity-0')) {
            if (landingForm && !landingForm.contains(e.target) && 
                !e.target.closest('#btn-sidebar-new') && 
                !e.target.closest('#rk-custom-confirm')) {
                hideLandingForm();
            }
        }
    });

    // Ketika user mengunggah file Project Lama (Open Project .riz)
    const fileInputRiz = document.getElementById('file-input-riz');
    if (fileInputRiz) {
        fileInputRiz.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                const fileName = e.target.files[0].name.replace(/\.[^/.]+$/, "");
                window.currentProjectName = fileName;
                
                const nameDisplay = document.getElementById('project-name-display');
                const nameContainer = document.getElementById('project-name-container');
                if (nameDisplay) nameDisplay.textContent = fileName;
                if (nameContainer) {
                    nameContainer.classList.remove('hidden');
                    nameContainer.title = "Project : " + fileName;
                }
                
                window.updateTabLockState();
                if (typeof updateFileMenuState === 'function') updateFileMenuState();
                
                const fileTab = document.querySelector('.nav-tab[data-target="panel-file"]');
                if (fileTab) fileTab.click();
                
                e.target.value = '';
            }
        });
    }
});