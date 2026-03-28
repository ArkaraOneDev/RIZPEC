// ==========================================
// CUSTOM UI UTILITIES (OVERLAYS & MODALS)
// ==========================================
function showFullscreenLoading(message) {
    let overlay = document.getElementById('rk-fullscreen-loading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rk-fullscreen-loading';
        overlay.className = 'fixed inset-0 bg-slate-900/90 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm hidden';
        overlay.innerHTML = `
            <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            <h2 id="rk-loading-text" class="text-white font-bold text-[13px] tracking-wider animate-pulse text-center">Loading...</h2>
            <div id="rk-loading-progress" class="text-blue-400 font-bold text-[12px] tracking-wide mt-2 text-center empty:hidden"></div>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('rk-loading-text').textContent = message;
    document.getElementById('rk-loading-progress').textContent = ''; // Kosongkan progress bawaan saat muncul pertama kali
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
}

function hideFullscreenLoading() {
    const overlay = document.getElementById('rk-fullscreen-loading');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

// Fungsi baru khusus untuk mengupdate angka progress di loading screen
function updateLoadingProgress(text) {
    const progressEl = document.getElementById('rk-loading-progress');
    if (progressEl) progressEl.textContent = text;
}
window.updateLoadingProgress = updateLoadingProgress;

function showCustomConfirm(message, onConfirm) {
    let modal = document.getElementById('rk-custom-confirm');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rk-custom-confirm';
        modal.className = 'fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center backdrop-blur-sm hidden transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-600 p-5 rounded shadow-2xl w-80 flex flex-col gap-4 transform transition-transform scale-100">
                <h3 class="text-white text-[14px] font-bold text-center border-b border-slate-700 pb-2 flex items-center justify-center gap-2">
                    <i class="fa-solid fa-triangle-exclamation text-yellow-400"></i> Konfirmasi
                </h3>
                <p id="rk-confirm-text" class="text-slate-300 text-[11px] text-center mb-2 leading-relaxed"></p>
                <div class="flex justify-between gap-3 mt-1">
                    <button id="rk-btn-cancel" class="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-[11px] font-bold py-2 rounded transition-colors shadow-lg">Batal</button>
                    <button id="rk-btn-confirm" class="flex-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold py-2 rounded transition-colors shadow-lg">Ya</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('rk-confirm-text').textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const btnCancel = document.getElementById('rk-btn-cancel');
    const btnConfirm = document.getElementById('rk-btn-confirm');
    
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
    
    const cleanup = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    
    newBtnCancel.addEventListener('click', () => { cleanup(); });
    newBtnConfirm.addEventListener('click', () => { cleanup(); onConfirm(); });
}

function showCustomAlert(message, onConfirm = null) {
    let modal = document.getElementById('rk-custom-alert');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rk-custom-alert';
        modal.className = 'fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center backdrop-blur-sm hidden transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-600 p-5 rounded shadow-2xl w-80 flex flex-col gap-4 transform transition-transform scale-100">
                <h3 class="text-white text-[14px] font-bold text-center border-b border-slate-700 pb-2 flex items-center justify-center gap-2">
                    <i class="fa-solid fa-circle-exclamation text-yellow-500"></i> Peringatan
                </h3>
                <p id="rk-alert-text" class="text-slate-300 text-[11px] text-center mb-2 leading-relaxed"></p>
                <div class="flex justify-center mt-1">
                    <button id="rk-btn-alert-ok" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-2 rounded transition-colors shadow-lg">Mengerti</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('rk-alert-text').textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    const btnOk = document.getElementById('rk-btn-alert-ok');
    const newBtnOk = btnOk.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    
    const cleanup = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    
    newBtnOk.addEventListener('click', () => { 
        cleanup();
        if (onConfirm) onConfirm();
    });
}

function showCustomPrompt(message, defaultValue, onConfirm) {
    let modal = document.getElementById('rk-custom-prompt');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rk-custom-prompt';
        modal.className = 'fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center backdrop-blur-sm hidden transition-opacity duration-300';
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-600 p-5 rounded shadow-2xl w-80 flex flex-col gap-4 transform transition-transform scale-100">
                <h3 class="text-white text-[14px] font-bold text-center border-b border-slate-700 pb-2 flex items-center justify-center gap-2">
                    <i class="fa-solid fa-floppy-disk text-blue-400"></i> Simpan Project
                </h3>
                <p id="rk-prompt-text" class="text-slate-300 text-[11px] text-center mb-1 leading-relaxed"></p>
                <input type="text" id="rk-prompt-input" class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-[12px] outline-none focus:border-blue-500" autocomplete="off" />
                <div class="flex justify-between gap-3 mt-1">
                    <button id="rk-prompt-cancel" class="flex-1 bg-slate-600 hover:bg-slate-500 text-white text-[11px] font-bold py-2 rounded transition-colors shadow-lg">Batal</button>
                    <button id="rk-prompt-confirm" class="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-2 rounded transition-colors shadow-lg">Simpan</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('rk-prompt-text').textContent = message;
    const input = document.getElementById('rk-prompt-input');
    input.value = defaultValue;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 100);
    
    const btnCancel = document.getElementById('rk-prompt-cancel');
    const btnConfirm = document.getElementById('rk-prompt-confirm');
    
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnConfirm = btnConfirm.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
    
    const cleanup = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };
    
    newBtnCancel.addEventListener('click', cleanup);
    newBtnConfirm.addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) return;
        cleanup();
        onConfirm(val);
    });
    
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            const val = input.value.trim();
            if (!val) return;
            cleanup();
            onConfirm(val);
        }
        if (e.key === 'Escape') cleanup();
    };
}