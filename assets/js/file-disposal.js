// ==============================================================
// UI STATE MANAGEMENT (Disposal Data Subfolders & CSV Setting)
// OPTIMIZED FOR MEMORY LEAK PREVENTION (HUAWEI MATEPAD)
// ==============================================================

window.disposalStates = {};
window.activeDisposalId = null;
window.lastActiveDisposalId = null;
window._lastSelectedDisposalFolderName = null; 
window.hasUnsavedDisposalColorChanges = false; 
window.hasUnsavedDisposalConfigChanges = false; 
window.dispColorModes = JSON.parse(localStorage.getItem('rizpec_disp_color_modes')) || {};

// Fungsi helper membatalkan perubahan parameter CSV jika pindah tab tanpa di build
window.discardUnsavedDisposalConfigChanges = async function() {
    if (window.hasUnsavedDisposalConfigChanges && window.activeDisposalId) {
        window.hasUnsavedDisposalConfigChanges = false;
        await restoreDisposalUIState(window.activeDisposalId);
    }
};

// Fungsi helper mendisable input/dropdown saat file referensi belum ada
window.applyDisposalSafetyDisable = function() {
    if (!window.activeDisposalId) return;
    const state = window.disposalStates[window.activeDisposalId];
    if (!state) return;

    const mrReady = (state.mrFile && state.mrFile.size !== undefined) || !!state.mrFileName;
    const refReady = (state.refFile && state.refFile.size !== undefined) || !!state.refFileName;

    // RULE 1: Subset, Loose, dan Bank
    const mrIds = [
        'disp-col-blockname', 'disp-col-bench', 'disp-col-subset', 'disp-col-waste', 'disp-col-bank',
        'disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'
    ];
    
    mrIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !mrReady;
            if (!mrReady) {
                el.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    });

    // RULE 2: Tinggal Recon Loose Capacity
    const refIds = ['disp-col-recon-waste'];
    refIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !refReady;
            if (!refReady) {
                el.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    });
};

// ==============================================================
// [PERBAIKAN MEMORY LEAK]: GLOBAL EVENT DELEGATION UNTUK DISPOSAL
// Mengganti listener di dalam loop (innerHTML) menjadi terpusat 
// ==============================================================
document.addEventListener('change', async (e) => {
    // 1. Checkbox Disposal Geometry
    if (e.target && e.target.classList.contains('disp-checkbox')) {
        const disp = e.target.getAttribute('data-disp');
        const containerDiv = e.target.closest('.group');
        const textSpan = containerDiv.querySelector('span.font-bold');
        const customCb = containerDiv.querySelector('.checkbox-box');
        const checkIcon = customCb.querySelector('i');

        if(e.target.checked) {
            customCb.className = "checkbox-box w-5 h-5 rounded-sm border bg-blue-500 border-blue-500 flex items-center justify-center transition-colors shrink-0";
            checkIcon.className = "fa-solid fa-check text-white text-[10px] opacity-100 transition-opacity";
            textSpan.className = "text-blue-400 transition-colors font-bold text-[11px] truncate";
            containerDiv.className = "flex items-center gap-2.5 bg-slate-900/80 border border-blue-500/50 shadow-sm p-2 rounded-md transition-all hover:bg-slate-800 group";
            
            window.loadedDisposals.add(disp);
            
            const geoTab = document.getElementById('panel-geometry');
            const isGeoTabActive = geoTab && !geoTab.classList.contains('hidden');
            
            if (isGeoTabActive) {
                if (typeof window.renderPendingPits === 'function') await window.renderPendingPits();
            } else {
                const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
                if (tabBtn) {
                    tabBtn.classList.add('bg-blue-600/30', 'text-blue-300', 'animate-pulse');
                    setTimeout(() => tabBtn.classList.remove('bg-blue-600/30', 'text-blue-300', 'animate-pulse'), 2000);
                }
            }
        } else {
            customCb.className = "checkbox-box w-5 h-5 rounded-sm border bg-slate-800 border-slate-600 group-hover:border-blue-400 flex items-center justify-center transition-colors shrink-0";
            checkIcon.className = "fa-solid fa-check text-white text-[10px] opacity-0 transition-opacity";
            textSpan.className = "text-slate-300 transition-colors font-bold text-[11px] truncate";
            containerDiv.className = "flex items-center gap-2.5 bg-slate-900/80 border border-slate-700/80 p-2 rounded-md transition-all hover:bg-slate-800 group";
            
            window.loadedDisposals.delete(disp);
            window.renderedDisposals.delete(disp);
            if (typeof window.unloadDisposalGeometry === 'function') window.unloadDisposalGeometry(disp);
        }
    }

    // 2. Select Color Mode (Burden/Subset)
    if (e.target && e.target.classList.contains('disp-color-mode-select')) {
        const disp = e.target.getAttribute('data-disp');
        const newMode = e.target.value;
        if (window.dispColorModes[disp] !== newMode) {
            window.dispColorModes[disp] = newMode;
            localStorage.setItem('rizpec_disp_color_modes', JSON.stringify(window.dispColorModes));
            
            if (window.loadedDisposals.has(disp)) {
                if (typeof window.unloadDisposalGeometry === 'function') window.unloadDisposalGeometry(disp);
                if (window.renderedDisposals) window.renderedDisposals.delete(disp);
                
                const geoTab = document.getElementById('panel-geometry');
                const isGeoTabActive = geoTab && !geoTab.classList.contains('hidden');
                
                if (isGeoTabActive) {
                    if (typeof window.renderPendingPits === 'function') window.renderPendingPits();
                } else {
                    const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
                    if (tabBtn) {
                        tabBtn.classList.add('bg-blue-600/30', 'text-blue-300', 'animate-pulse');
                        setTimeout(() => tabBtn.classList.remove('bg-blue-600/30', 'text-blue-300', 'animate-pulse'), 2000);
                    }
                }
            }
        }
    }

    // 3. Palette Color Input (Burden)
    if (e.target && e.target.classList.contains('disp-color-input-burden')) {
        const index = parseInt(e.target.getAttribute('data-index'));
        const oldColor = window.dispBurdenPalette[index].color;
        if (oldColor !== e.target.value) {
            window.dispBurdenPalette[index].color = e.target.value;
            window.hasUnsavedDisposalColorChanges = true;
            if (typeof window.updateDisposalApplyColorButton === 'function') window.updateDisposalApplyColorButton();
        }
    }

    // 4. Palette Color Input (Subset)
    if (e.target && e.target.classList.contains('disp-color-input-subset')) {
        const index = parseInt(e.target.getAttribute('data-index'));
        const oldColor = window.dispSubsetPalette[index].color;
        if (oldColor !== e.target.value) {
            window.dispSubsetPalette[index].color = e.target.value;
            window.hasUnsavedDisposalColorChanges = true;
            if (typeof window.updateDisposalApplyColorButton === 'function') window.updateDisposalApplyColorButton();
        }
    }
});

document.addEventListener('click', (e) => {
    // Tombol Naikkan Subset
    const btnUp = e.target.closest('.disp-btn-up-subset');
    if (btnUp) {
        const index = parseInt(btnUp.getAttribute('data-index'));
        if (index > 0) {
            const temp = window.dispSubsetPalette[index];
            window.dispSubsetPalette[index] = window.dispSubsetPalette[index - 1];
            window.dispSubsetPalette[index - 1] = temp;
            window.hasUnsavedDisposalColorChanges = true;
            if (typeof window.updateDisposalApplyColorButton === 'function') window.updateDisposalApplyColorButton();
            if (typeof window.renderDisposalPaletteUI === 'function') window.renderDisposalPaletteUI();
        }
    }

    // Tombol Turunkan Subset
    const btnDown = e.target.closest('.disp-btn-down-subset');
    if (btnDown) {
        const index = parseInt(btnDown.getAttribute('data-index'));
        if (index < window.dispSubsetPalette.length - 1) {
            const temp = window.dispSubsetPalette[index];
            window.dispSubsetPalette[index] = window.dispSubsetPalette[index + 1];
            window.dispSubsetPalette[index + 1] = temp;
            window.hasUnsavedDisposalColorChanges = true;
            if (typeof window.updateDisposalApplyColorButton === 'function') window.updateDisposalApplyColorButton();
            if (typeof window.renderDisposalPaletteUI === 'function') window.renderDisposalPaletteUI();
        }
    }
});
// ==============================================================

// Ekstensi/Hook ke Framework Folder Global (file.js) spesifik untuk Disposal
window.getDisposalFolderBadgeHTML = function(name, rootName) {
    if (rootName === 'Disposal Data') {
        const safeId = name.replace(/\s+/g, '_');
        if (typeof RizpecDB !== 'undefined') {
            RizpecDB.get(`rizpec_disp_entity_${safeId}_meta`).then(meta => {
                if (meta && meta.buildMethod) {
                    window.updateDisposalFolderBadge(name, meta.buildMethod);
                }
            }).catch(() => {});
        }
        return ''; 
    }
    return '';
};

window.updateDisposalFolderBadge = function(dispId, method) {
    const container = document.getElementById('subfolders-folder-disp');
    if (!container) return;
    const folders = container.querySelectorAll('.folder-name-text');
    for (let span of folders) {
        if (span.textContent === dispId) {
            const subEl = span.closest('.group');
            if (subEl) {
                const badgeContainer = subEl.querySelector('.geometry-badge-container');
                if (badgeContainer) {
                    if (method === 'CEN') {
                        badgeContainer.innerHTML = '<span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">CEN</span>';
                    } else if (method === 'NON_CEN') {
                        badgeContainer.innerHTML = '<span class="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">NON_CEN</span>';
                    } else {
                        badgeContainer.innerHTML = '';
                    }
                }
            }
            break;
        }
    }
};

window.resetDisposalStates = function() {
    window.disposalStates = {};
    window.activeDisposalId = null;
    window.lastActiveDisposalId = null;
    window._lastSelectedDisposalFolderName = null;
}

window.saveDisposalMetaToDB = async function(dispId) {
    if (!dispId || !window.disposalStates[dispId]) return;
    const state = window.disposalStates[dispId];
    const safeId = dispId.replace(/\s+/g, '_');
    const meta = {
        buildMethod: state.buildMethod || 'NON_CEN',
        mrFileName: state.mrFileName || null,
        refFileName: state.refFileName || null,
        mrStats: state.mrStats,
        refStats: state.refStats,
        neStats: state.neStats,
        summaryObj: state.summaryObj,
        originalSummaryObj: state.originalSummaryObj,
        cols: state.cols,
        substrings: state.substrings,
        mrHeaders: state.mrHeaders,
        refHeaders: state.refHeaders,
        refFileApplied: state.refFileApplied
    };
    try {
        if (typeof RizpecDB !== 'undefined') await RizpecDB.set(`rizpec_disp_entity_${safeId}_meta`, meta);
    } catch(e) { console.error("Gagal menyimpan meta ke DB", e); }
};

window.saveDisposalStatsToStorage = async function(dispId) {
    await window.saveDisposalMetaToDB(dispId);
};

window.updateDisposalBuildGeometryButtonState = function() {
    if (!window.activeDisposalId) return;
    const state = window.disposalStates[window.activeDisposalId];
    const btn = document.getElementById('disp-btn-build-geometry');
    const neFilenameEl = document.getElementById('disp-ne-filename');
    if (!btn) return;

    const isMrReal = state.mrFile && state.mrFile.size !== undefined;
    const hasMRPlaceholder = !!state.mrFileName;
    
    const isRefReal = state.refFile && state.refFile.size !== undefined;
    const hasRefPlaceholder = !!state.refFileName;

    const isBuilt = state.generatedCsv !== null || (neFilenameEl && neFilenameEl.textContent !== "Build Geometry terlebih dahulu");

    const mrClearBtn = document.getElementById('disp-clear-mr');
    if (mrClearBtn) {
        if (isBuilt) mrClearBtn.disabled = true;
        else mrClearBtn.disabled = !(isMrReal || hasMRPlaceholder);
    }

    const buildMethod = state.buildMethod || 'NON_CEN';

    const delimBlock = state.substrings['disp-delim-block'];
    const delimStrip = state.substrings['disp-delim-strip'];
    const delimBench = state.substrings['disp-delim-bench'];
    
    const isValidFormat = (val) => /^\d+,\d+$/.test(val ? val.trim() : "");
    const areSubstringsFilled = isValidFormat(delimBlock) && isValidFormat(delimStrip) && isValidFormat(delimBench);

    const isFilled = (val) => val && val.trim() !== "";
    const areColsFilled = isFilled(state.cols['disp-col-blockname']) && isFilled(state.cols['disp-col-bench']);
    
    const isRefValid = true;

    const isAllMandatoryFilled = areSubstringsFilled && areColsFilled;

    if ((isMrReal || (hasMRPlaceholder && !isBuilt)) && !isAllMandatoryFilled) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Build Geometry';
        btn.disabled = true;
        btn.className = "mt-1 w-full bg-slate-700 text-slate-400 py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
        btn.title = !areColsFilled ? "Pilih kolom wajib (*) terlebih dahulu." : "Format Substring wajib Lengkap (Angka,Angka). Contoh: 1,4";
    } else if (isBuilt && isRefReal && !state.refFileApplied) {
        if (!isRefValid) {
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Apply Accumulate';
            btn.disabled = true;
            btn.className = "mt-1 w-full bg-slate-700 text-slate-400 py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
            btn.title = "Pilih kolom wajib (*) Accumulate terlebih dahulu.";
        } else {
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Apply Accumulate';
            btn.disabled = false;
            btn.className = "mt-1 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
            btn.title = "Terapkan Accumulate ke Geometri di Background.";
        }
    } else if (isBuilt && !hasRefPlaceholder && buildMethod === 'CEN') {
        btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset Geometry';
        btn.disabled = false;
        btn.className = "mt-1 w-full bg-rose-600 hover:bg-rose-500 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
        btn.title = "Kembalikan ke state awal (Mining Reserve) di Background.";
    } else if (isBuilt && ((!hasRefPlaceholder && buildMethod === 'NON_CEN') || (hasRefPlaceholder && buildMethod === 'CEN'))) {
        btn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Geometry Ready';
        btn.disabled = true;
        btn.className = "mt-1 w-full bg-emerald-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-default";
        btn.title = "Geometri sudah terbentuk dan up-to-date.";
    } else if (isMrReal && !isBuilt) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Build Geometry';
        btn.disabled = false;
        btn.className = "mt-1 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
        btn.title = "Bentuk geometri dari awal.";
    } else if (hasMRPlaceholder && !isBuilt) {
        btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Re-Upload CSV';
        btn.disabled = true;
        btn.className = "mt-1 w-full bg-orange-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
        btn.title = "Data CSV dasar hilang. Silakan upload ulang CSV asli.";
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Build Geometry';
        btn.disabled = true;
        btn.className = "mt-1 w-full bg-slate-700 text-slate-400 py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
        btn.title = "";
    }
    
    if (typeof window.applyDisposalSafetyDisable === 'function') window.applyDisposalSafetyDisable();
};

window.saveCurrentDisposalUIState = async function() {
    if (!window.activeDisposalId || !window.disposalStates[window.activeDisposalId]) return;
    const state = window.disposalStates[window.activeDisposalId];
    
    const colIds = ['disp-col-blockname', 'disp-col-bench', 'disp-col-subset', 'disp-col-waste', 'disp-col-bank', 'disp-col-recon-waste'];
    colIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) state.cols[id] = el.value;
    });

    const subIds = ['disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'];
    subIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) state.substrings[id] = el.value;
    });
};

function initDisposalState(dispId) {
    if (window.disposalStates[dispId]) return;

    window.disposalStates[dispId] = {
        mrFile: null,
        mrFileName: null,
        refFile: null,
        refFileName: null,
        refFileApplied: false, 
        generatedCsv: null, 
        summaryObj: null,
        originalSummaryObj: null, 
        mrStats: { text: '0.00 MB (0 Row)', rows: 0, cols: 0, size: 0 },
        refStats: { text: '0.00 MB (0 Row)', rows: 0, cols: 0, size: 0 },
        neStats: { text: '0.00 MB (0 Block Computed)', rows: 0, cols: 0, size: 0 }, 
        cols: {}, 
        substrings: {},
        mrHeaders: [],
        refHeaders: [],
        buildMethod: 'NON_CEN'
    };
}

async function restoreDisposalUIState(dispId) {
    const state = window.disposalStates[dispId];
    if (!state) return;

    const safeId = dispId.replace(/\s+/g, '_');
    
    try {
        if (typeof RizpecDB !== 'undefined') {
            const meta = await RizpecDB.get(`rizpec_disp_entity_${safeId}_meta`);
            if (meta) {
                state.buildMethod = meta.buildMethod || 'NON_CEN';
                localStorage.setItem(`rizpec_disp_build_type_${safeId}`, state.buildMethod);
                
                state.mrFileName = meta.mrFileName || null;
                state.refFileName = meta.refFileName || null;
                if (meta.mrStats) state.mrStats = meta.mrStats;
                if (meta.refStats) state.refStats = meta.refStats;
                if (meta.neStats) state.neStats = meta.neStats;
                if (meta.summaryObj) state.summaryObj = meta.summaryObj;
                if (meta.originalSummaryObj) state.originalSummaryObj = meta.originalSummaryObj;
                if (meta.cols) state.cols = meta.cols;
                if (meta.substrings) state.substrings = meta.substrings;
                if (meta.mrHeaders) state.mrHeaders = state.mrHeaders;
                if (meta.refHeaders) state.refHeaders = meta.refHeaders;
                if (meta.refFileApplied !== undefined) state.refFileApplied = meta.refFileApplied;
            }
        }
    } catch(e) {}

    if (!state.generatedCsv) {
        try {
            const savedCsv = await RizpecDB.get(`rizpec_disp_entity_${safeId}`);
            if (savedCsv) state.generatedCsv = savedCsv;
        } catch(e) {}
    }

    const mrFileEl = document.getElementById('disp-mr-filename');
    const mrClearBtn = document.getElementById('disp-clear-mr');
    if (state.mrFile || state.mrFileName) {
        if(mrFileEl) {
            mrFileEl.textContent = state.mrFile ? state.mrFile.name : state.mrFileName;
            mrFileEl.classList.replace('text-slate-500', 'text-blue-400');
            mrFileEl.classList.remove('italic');
        }
    } else {
        if(mrFileEl) {
            mrFileEl.textContent = 'Tidak ada file...';
            mrFileEl.classList.replace('text-blue-400', 'text-slate-500');
            mrFileEl.classList.add('italic');
        }
        if (mrClearBtn) mrClearBtn.disabled = true;
    }

    const refFileEl = document.getElementById('disp-ref-filename');
    const refClearBtn = document.getElementById('disp-clear-ref');
    if (state.refFile || state.refFileName) {
        if(refFileEl) {
            refFileEl.textContent = state.refFile ? state.refFile.name : state.refFileName;
            refFileEl.classList.replace('text-slate-500', 'text-blue-400');
            refFileEl.classList.remove('italic');
        }
        if (refClearBtn) refClearBtn.disabled = false;
    } else {
        if(refFileEl) {
            refFileEl.textContent = 'Tidak ada file...';
            refFileEl.classList.replace('text-blue-400', 'text-slate-500');
            refFileEl.classList.add('italic');
        }
        if (refClearBtn) refClearBtn.disabled = true;
    }

    const mrStatUI = document.getElementById('disp-stat-mr');
    const refStatUI = document.getElementById('disp-stat-ref');
    const neStatUI = document.getElementById('disp-stat-ne');
    
    if(mrStatUI) mrStatUI.textContent = state.mrStats.text;
    if(refStatUI) refStatUI.textContent = state.refStats.text;
    if(neStatUI) neStatUI.textContent = state.neStats.text;

    const subIds = ['disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'];
    subIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.substrings[id] || '';
    });

    window.populateDisposalColumnDropdowns(state.mrHeaders || [], 'mr');
    window.populateDisposalColumnDropdowns(state.refHeaders || [], 'ref');
    
    const bankEl = document.getElementById('disp-col-bank');
    if (bankEl) {
        if (state.cols['disp-col-bank'] !== undefined && state.cols['disp-col-bank'] !== '') {
            bankEl.value = state.cols['disp-col-bank'];
        } else {
            bankEl.value = "1.0";
            state.cols['disp-col-bank'] = "1.0";
        }
    }

    const newEntityNameEl = document.getElementById('disp-ne-filename');
    if (newEntityNameEl) {
        if (state.neStats && !state.neStats.text.includes('(0 Block')) {
            newEntityNameEl.textContent = dispId + "_Geometry";
            newEntityNameEl.classList.replace('text-slate-500', 'text-blue-400');
            newEntityNameEl.classList.remove('italic');
        } else {
            newEntityNameEl.textContent = "Build Geometry terlebih dahulu";
            newEntityNameEl.classList.replace('text-blue-400', 'text-slate-500');
            newEntityNameEl.classList.add('italic');
        }
    }
    
    const mrInput = document.getElementById('disp-mr-file');
    const refInput = document.getElementById('disp-ref-file');
    if (mrInput) mrInput.value = '';
    if (refInput) refInput.value = '';

    window.updateDisposalBuildGeometryButtonState();

    if (typeof window.renderDisposalGeometryPreview === 'function') {
        window.renderDisposalGeometryPreview(state.generatedCsv, state.summaryObj, state.buildMethod);
    }
}

// >>> FUNGSI AGREGASI KESELURUHAN (GLOBAL SUMMARY) <<<
window.aggregateAllDisposalData = async function() {
    const dispContainer = document.getElementById('subfolders-folder-disp');
    if (!dispContainer) return;
    const dispElements = dispContainer.querySelectorAll('.folder-name-text');
    const dispNames = Array.from(dispElements).map(el => el.textContent);
    
    if (dispNames.length === 0) {
         const mrStatUI = document.getElementById('disp-stat-mr');
         if (mrStatUI) mrStatUI.textContent = `0.00 MB (0 Row)`;
         const refStatUI = document.getElementById('disp-stat-ref');
         if (refStatUI) refStatUI.textContent = `0.00 MB (0 Row)`;
         const neStatUI = document.getElementById('disp-stat-ne');
         if (neStatUI) neStatUI.textContent = `0.00 MB (0 Block Computed)`;
         if (typeof window.renderDisposalGeometryPreview === 'function') {
             window.renderDisposalGeometryPreview(null, null, '', false, true);
         }
         return;
    }
    
    let totalMrSize = 0, totalMrRows = 0;
    let totalRefSize = 0, totalRefRows = 0;
    let totalVram = 0, totalBlocks = 0;
    
    let sumWaste = 0; // Dirender sebagai Total Loose
    let sumBank = 0; // Dirender sebagai Total Bank
    
    let allHulls = [];
    let globalBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    let hasBounds = false;

    for (let disp of dispNames) {
        const safeId = disp.replace(/\s+/g, '_');
        try {
            if (typeof RizpecDB !== 'undefined') {
                const meta = await RizpecDB.get(`rizpec_disp_entity_${safeId}_meta`);
                if (meta) {
                    const stMR = meta.mrStats || {};
                    const stRef = meta.refStats || {};
                    const stNE = meta.neStats || {};

                    totalMrSize += (stMR.size || 0);
                    totalMrRows += (stMR.rows || 0);
                    totalRefSize += (stRef.size || 0);
                    totalRefRows += (stRef.rows || 0);
                    
                    if (stNE.text) {
                        const match = stNE.text.match(/([\d.]+)\s*MB\s*\(([\d]+)\s*Block/);
                        if (match) {
                            totalVram += parseFloat(match[1]) || 0;
                            totalBlocks += parseInt(match[2]) || 0;
                        }
                    }

                    const summary = meta.summaryObj;
                    if (summary) {
                        sumWaste += (summary.totalWaste || 0);
                        sumBank += (summary.totalBank || 0);
                        
                        if (summary.previewHulls) {
                            allHulls.push(...summary.previewHulls);
                        }
                        if (summary.previewBounds) {
                            hasBounds = true;
                            globalBounds.minX = Math.min(globalBounds.minX, summary.previewBounds.minX);
                            globalBounds.maxX = Math.max(globalBounds.maxX, summary.previewBounds.maxX);
                            globalBounds.minY = Math.min(globalBounds.minY, summary.previewBounds.minY);
                            globalBounds.maxY = Math.max(globalBounds.maxY, summary.previewBounds.maxY);
                        }
                    }
                }
            }
        } catch(e) {}
    }
    
    const mrStatUI = document.getElementById('disp-stat-mr');
    if (mrStatUI) mrStatUI.textContent = `${(totalMrSize/(1024*1024)).toFixed(2)} MB (${totalMrRows} Row)`;
    
    const refStatUI = document.getElementById('disp-stat-ref');
    if (refStatUI) refStatUI.textContent = `${(totalRefSize/(1024*1024)).toFixed(2)} MB (${totalRefRows} Row)`;
    
    const neStatUI = document.getElementById('disp-stat-ne');
    if (neStatUI) neStatUI.textContent = `${totalVram.toFixed(2)} MB (${totalBlocks} Computed)`;
    
    const combinedSummary = {
        totalWaste: sumWaste,
        totalBank: sumBank,
        previewHulls: allHulls.length > 0 ? allHulls : null,
        previewBounds: hasBounds ? globalBounds : null
    };
    
    if (typeof window.renderDisposalGeometryPreview === 'function') {
        window.renderDisposalGeometryPreview(null, combinedSummary, 'Agregasi', false, true);
    }
};

// >>> ROUTER UTAMA DISPOSAL DATA <<<
window.onDisposalFolderSelected = async function(name, type, rootName) {
    if (rootName !== 'Disposal Data') {
        window.activeDisposalId = null;
        window._lastSelectedDisposalFolderName = null; 
        return; 
    }
    
    const pitWrap = document.getElementById('pit-summary-wrapper');
    const dispWrap = document.getElementById('disp-summary-wrapper');
    const dxfWrap = document.getElementById('dxf-summary-wrapper');
    if (pitWrap) { pitWrap.classList.add('hidden'); pitWrap.classList.remove('flex'); } 
    if (dispWrap) { dispWrap.classList.remove('hidden'); dispWrap.classList.add('flex'); } 
    if (dxfWrap) { dxfWrap.classList.add('hidden'); dxfWrap.classList.remove('flex'); }

    const container = document.getElementById('geometry-disp-manager');
    if (container) {
        if (type === 'Root Folder') {
            container.classList.remove('hidden');
            container.classList.add('flex');
            
            if (typeof window.updateGeometryDisposalListUI === 'function') {
                window.updateGeometryDisposalListUI();
            }
        } else {
            container.classList.add('hidden');
            container.classList.remove('flex');
        }
    }

    if (window._lastSelectedDisposalFolderName === name) return; 
    
    if (typeof window.resetUnsavedColorChanges === 'function') {
        window.resetUnsavedColorChanges();
    }

    window._lastSelectedDisposalFolderName = name;

    if (window.activeDisposalId && window.activeDisposalId !== name) {
        if (window.hasUnsavedDisposalConfigChanges && typeof window.discardUnsavedDisposalConfigChanges === 'function') {
            await window.discardUnsavedDisposalConfigChanges();
        } else {
            await window.saveCurrentDisposalUIState();
        }

        if (window.disposalStates[window.activeDisposalId]) {
            window.lastActiveDisposalId = window.activeDisposalId;
        }
    }

    if (type !== 'Root Folder') {
        window.activeDisposalId = name;
        initDisposalState(name);
        await restoreDisposalUIState(name);
    } else {
        window.activeDisposalId = null;
        if (typeof window.aggregateAllDisposalData === 'function') {
            await window.aggregateAllDisposalData();
        }
    }
};

window.onDisposalFolderRenamed = async function(oldName, newName, rootName) {
    if (rootName === 'Disposal Data') {
        if (window._lastSelectedDisposalFolderName === oldName) window._lastSelectedDisposalFolderName = newName;

        if (window.disposalStates[oldName]) {
            window.disposalStates[newName] = window.disposalStates[oldName];
            delete window.disposalStates[oldName];
        }
        
        const oldKey = `rizpec_disp_entity_${oldName.replace(/\s+/g, '_')}`;
        const newKey = `rizpec_disp_entity_${newName.replace(/\s+/g, '_')}`;
        const oldMetaKey = `${oldKey}_meta`;
        const newMetaKey = `${newKey}_meta`;
        
        const oldSafe = oldName.replace(/\s+/g, '_');
        const newSafe = newName.replace(/\s+/g, '_');
        const oldTypeKey = `rizpec_disp_build_type_${oldSafe}`;
        const newTypeKey = `rizpec_disp_build_type_${newSafe}`;
        const savedType = localStorage.getItem(oldTypeKey);
        if (savedType) {
            localStorage.setItem(newTypeKey, savedType);
            localStorage.removeItem(oldTypeKey);
        }

        try {
            if (typeof RizpecDB !== 'undefined') {
                const dbData = await RizpecDB.get(oldKey);
                if (dbData) {
                    await RizpecDB.set(newKey, dbData);
                    await RizpecDB.remove(oldKey);
                }
                const metaData = await RizpecDB.get(oldMetaKey);
                if (metaData) {
                    await RizpecDB.set(newMetaKey, metaData);
                    await RizpecDB.remove(oldMetaKey);
                }
            }
        } catch(e) {}

        if (window.activeDisposalId === oldName) {
            window.activeDisposalId = newName;
            const newEntityNameEl = document.getElementById('disp-ne-filename');
            if (newEntityNameEl && newEntityNameEl.textContent !== "Build Geometry terlebih dahulu") {
                newEntityNameEl.textContent = newName + "_Geometry";
            }
        }
        if (window.lastActiveDisposalId === oldName) window.lastActiveDisposalId = newName;
        
        const oldNormalized = oldSafe.replace(/_/g, ' ');

        if (window.loadedDisposals && (window.loadedDisposals.has(oldName) || window.loadedDisposals.has(oldNormalized))) {
            window.loadedDisposals.delete(oldName);
            window.loadedDisposals.delete(oldNormalized);
            
            window.loadedDisposals.add(newName);
            
            if (window.renderedDisposals) {
                window.renderedDisposals.delete(oldName);
                window.renderedDisposals.delete(oldNormalized);
            }
            if (typeof window.unloadDisposalGeometry === 'function') {
                window.unloadDisposalGeometry(oldName);
                if (oldName !== oldNormalized) window.unloadDisposalGeometry(oldNormalized);
            }
        }

        if (typeof window.updateGeometryDisposalListUI === 'function') window.updateGeometryDisposalListUI();
    }
};

window.onDisposalFolderDeleted = async function(name, rootName) {
    if (rootName === 'Disposal Data') {
        if (window._lastSelectedDisposalFolderName === name) window._lastSelectedDisposalFolderName = null;

        delete window.disposalStates[name];
        
        const safeName = name.replace(/\s+/g, '_');
        const normalizedDispName = safeName.replace(/_/g, ' '); 
        
        localStorage.removeItem(`rizpec_disp_build_type_${safeName}`);

        try {
            if (typeof RizpecDB !== 'undefined') {
                await RizpecDB.remove(`rizpec_disp_entity_${safeName}`);
                await RizpecDB.remove(`rizpec_disp_entity_${safeName}_meta`);
            }
        } catch(e) {}
        
        if (window.loadedDisposals) {
            window.loadedDisposals.delete(name);
            window.loadedDisposals.delete(normalizedDispName);
        }
        if (window.renderedDisposals) {
            window.renderedDisposals.delete(name);
            window.renderedDisposals.delete(normalizedDispName);
        }
        
        if (typeof window.unloadDisposalGeometry === 'function') {
            window.unloadDisposalGeometry(name);
            if (name !== normalizedDispName) window.unloadDisposalGeometry(normalizedDispName);
        }
        
        if (typeof window.updateGeometryDisposalListUI === 'function') window.updateGeometryDisposalListUI();

        if (window.activeDisposalId === name) window.activeDisposalId = null;
        if (window.lastActiveDisposalId === name) window.lastActiveDisposalId = null;
        
        const summaryName = document.getElementById('summary-name');
        if (summaryName && summaryName.textContent === 'Disposal Data') {
            if (typeof window.aggregateAllDisposalData === 'function') await window.aggregateAllDisposalData();
        }

        const geoTab = document.getElementById('panel-geometry');
        if (geoTab && !geoTab.classList.contains('hidden')) {
            if (typeof window.renderPendingPits === 'function') window.renderPendingPits();
        }
    }
};

// ==============================================================
// SUB-FILE UPLOAD & CALCULATION LOGIC
// ==============================================================

function extractDisposalHeaders(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const lines = e.target.result.split(/\r?\n/).filter(l => l.trim() !== '');
            const headers = lines[0] ? lines[0].split(',').map(h => h.trim().replace(/['"]/g, '').toUpperCase()) : [];
            let firstRow = [];
            if (lines.length > 1) {
                firstRow = lines[1].split(',').map(v => v.trim().replace(/['"]/g, ''));
            }
            resolve({ headers, firstRow });
        };
        reader.readAsText(file.slice(0, 8192)); 
    });
}

function inheritDisposalHistoryIfEmpty(state) {
    const isColEmpty = !state.cols['disp-col-blockname'];
    if (isColEmpty && window.lastActiveDisposalId && window.disposalStates[window.lastActiveDisposalId]) {
        const lastState = window.disposalStates[window.lastActiveDisposalId];
        Object.assign(state.cols, lastState.cols);
        Object.assign(state.substrings, lastState.substrings);
    }
}

async function recalculateDisposalHeaders() {
    const state = window.disposalStates[window.activeDisposalId];
    if (!state) return;
    
    let promises = [];

    if (state.mrFile && state.mrFile.size !== undefined) {
        promises.push(extractDisposalHeaders(state.mrFile).then(data => { 
            state.mrHeaders = data.headers;
            inheritDisposalHistoryIfEmpty(state);
            window.populateDisposalColumnDropdowns(data.headers, 'mr', data.firstRow); 
            
            const subIds = ['disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'];
            subIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = state.substrings[id] || '';
            });
        }));
    } else if (!state.mrFile) {
        state.mrHeaders = [];
        window.populateDisposalColumnDropdowns([], 'mr', []);
    }

    if (state.refFile && state.refFile.size !== undefined) {
        promises.push(extractDisposalHeaders(state.refFile).then(data => { 
            state.refHeaders = data.headers; 
            window.populateDisposalColumnDropdowns(data.headers, 'ref', data.firstRow); 
        }));
    } else if (!state.refFile) {
        state.refHeaders = [];
        window.populateDisposalColumnDropdowns([], 'ref', []);
    }

    await Promise.all(promises);
    await window.saveDisposalMetaToDB(window.activeDisposalId);
}

// Menyesuaikan populate agar tidak memproses elemen disp-col-bank sebagai dropdown
window.populateDisposalColumnDropdowns = (headers, type = 'mr', firstRow = []) => {
    let selectIds = [];
    let autoFillMap = {};

    if (type === 'mr') {
        selectIds = [
            'disp-col-blockname', 'disp-col-bench', 'disp-col-subset', 'disp-col-waste'
        ];
        
        autoFillMap = {
            'disp-col-blockname': 'BLOCKNAME', 'disp-col-bench': 'BENCH', 'disp-col-subset': 'SUBSET',
            'disp-col-waste': 'TOTALVOLUME' // Digunakan sebagai Loose Capacity
        };
        
    } else if (type === 'ref') {
        selectIds = ['disp-col-recon-waste'];
    }

    const selects = selectIds.map(id => document.getElementById(id));
    
    selects.forEach(selectEl => {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="">None</option>';
        headers.forEach(header => {
            if (header) {
                const option = document.createElement('option');
                option.value = header;
                option.textContent = header;
                selectEl.appendChild(option);
            }
        });
        
        let valueToSet = "";
        let savedVal = null;
        
        if (window.activeDisposalId && window.disposalStates[window.activeDisposalId]) {
            savedVal = window.disposalStates[window.activeDisposalId].cols[selectEl.id];
        }
        
        if (savedVal && (headers.length === 0 || headers.includes(savedVal))) valueToSet = savedVal;
        else if (firstRow && firstRow.length > 0 && autoFillMap[selectEl.id] && headers.includes(autoFillMap[selectEl.id])) {
            valueToSet = autoFillMap[selectEl.id];
        }
        
        if (valueToSet) {
            if (headers.length === 0) {
                const opt = document.createElement('option');
                opt.value = valueToSet;
                opt.textContent = valueToSet;
                selectEl.appendChild(opt);
            }
            selectEl.value = valueToSet;
        }
    });
};

async function updateDisposalFileStats(file, type) {
    const state = window.disposalStates[window.activeDisposalId];
    const statEl = document.getElementById(type === 'mr' ? 'disp-stat-mr' : 'disp-stat-ref');
    
    if (type === 'mr') {
        state.neStats = { text: '0.00 MB (0 Block Computed)' };
        state.generatedCsv = null; 
        const neStatEl = document.getElementById('disp-stat-ne');
        if (neStatEl) neStatEl.textContent = state.neStats.text;
        
        const neFilenameEl = document.getElementById('disp-ne-filename');
        if (neFilenameEl) {
            neFilenameEl.textContent = "Build Geometry terlebih dahulu";
            neFilenameEl.classList.replace('text-blue-400', 'text-slate-500');
            neFilenameEl.classList.add('italic');
        }
    }

    if (!file) {
        const emptyStats = { text: '0.00 MB (0 Row)', rows: 0, cols: 0, size: 0 };
        if (type === 'mr') state.mrStats = emptyStats;
        if (type === 'ref') state.refStats = emptyStats;
        if (statEl) statEl.textContent = emptyStats.text;
        
        await window.saveDisposalMetaToDB(window.activeDisposalId);
        await recalculateDisposalHeaders();
        window.updateDisposalBuildGeometryButtonState();
        return;
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (statEl) statEl.textContent = `${sizeMB} MB (Calculating...)`;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim() !== '');
        const rowCount = Math.max(0, lines.length - 1);
        const colCount = lines[0] ? lines[0].split(',').length : 0;
        const statText = `${sizeMB} MB (${rowCount} Row)`;
        
        if (statEl) statEl.textContent = statText;
        const statsObj = { text: statText, rows: rowCount, cols: colCount, size: file.size };
        
        if (type === 'mr') state.mrStats = statsObj;
        if (type === 'ref') state.refStats = statsObj;
        
        await window.saveDisposalMetaToDB(window.activeDisposalId);
        await recalculateDisposalHeaders();
        window.updateDisposalBuildGeometryButtonState();
    };
    reader.readAsText(file);
}

// ==============================================================
// EVENT LISTENERS (Dibungkus dalam IIFE agar terhindar dari bentrok global)
// ==============================================================
(() => {
    const miningReserveInput = document.getElementById('disp-mr-file');
    if (miningReserveInput) {
        miningReserveInput.addEventListener('change', async (e) => {
            if (!window.activeDisposalId) return; // GUARD
            const file = e.target.files[0];
            const state = window.disposalStates[window.activeDisposalId];
            state.mrFile = file || null;
            state.mrFileName = file ? file.name : null;
            
            const filenameEl = document.getElementById('disp-mr-filename');
            const clearBtn = document.getElementById('disp-clear-mr');
            
            if (file) {
                if (filenameEl) {
                    filenameEl.textContent = file.name;
                    filenameEl.classList.replace('text-slate-500', 'text-blue-400');
                    filenameEl.classList.remove('italic');
                }
                if (clearBtn) clearBtn.disabled = false;
                await updateDisposalFileStats(file, 'mr');
            }
        });
    }

    const reformatFileInput = document.getElementById('disp-ref-file');
    if (reformatFileInput) {
        reformatFileInput.addEventListener('change', async (e) => {
            if (!window.activeDisposalId) return; // GUARD
            const file = e.target.files[0];
            const state = window.disposalStates[window.activeDisposalId];
            state.refFile = file || null;
            state.refFileName = file ? file.name : null;
            if (file) state.refFileApplied = false;
            
            const filenameEl = document.getElementById('disp-ref-filename');
            const clearBtn = document.getElementById('disp-clear-ref');
            
            if (file) {
                if (filenameEl) {
                    filenameEl.textContent = file.name;
                    filenameEl.classList.replace('text-slate-500', 'text-blue-400');
                    filenameEl.classList.remove('italic');
                }
                if (clearBtn) clearBtn.disabled = false;
                await updateDisposalFileStats(file, 'ref');
            }
        });
    }

    const clearMiningBtn = document.getElementById('disp-clear-mr');
    if (clearMiningBtn) {
        clearMiningBtn.addEventListener('click', async () => {
            if (!window.activeDisposalId) return; // GUARD
            const state = window.disposalStates[window.activeDisposalId];
            
            window.hasUnsavedDisposalConfigChanges = false;
            state.mrFile = null;
            state.mrFileName = null;
            const filenameEl = document.getElementById('disp-mr-filename');
            
            if (filenameEl) {
                filenameEl.textContent = 'Tidak ada file...';
                filenameEl.classList.replace('text-blue-400', 'text-slate-500');
                filenameEl.classList.add('italic');
            }
            clearMiningBtn.disabled = true;
            
            state.generatedCsv = null;
            state.summaryObj = null;
            state.originalSummaryObj = null;
            state.buildMethod = 'NON_CEN';
            state.neStats = { text: '0.00 MB (0 Block Computed)', rows: 0, cols: 0, size: 0 };
            
            // Mengembalikan Bank condition ke 1.0 saat di reset
            state.cols['disp-col-bank'] = '1.0';
            const bankEl = document.getElementById('disp-col-bank');
            if (bankEl) bankEl.value = '1.0';
            
            const neFilenameEl = document.getElementById('disp-ne-filename');
            if (neFilenameEl) {
                neFilenameEl.textContent = "Build Geometry terlebih dahulu";
                neFilenameEl.classList.replace('text-blue-400', 'text-slate-500');
                neFilenameEl.classList.add('italic');
            }

            const safeDispId = window.activeDisposalId.replace(/\s+/g, '_');
            const normalizedDispName = safeDispId.replace(/_/g, ' ');
            
            localStorage.removeItem(`rizpec_disp_build_type_${safeDispId}`);

            await updateDisposalFileStats(null, 'mr'); 
            
            if (typeof RizpecDB !== 'undefined') {
                await RizpecDB.remove(`rizpec_disp_entity_${safeDispId}`).catch(()=>{});
                await window.saveDisposalMetaToDB(window.activeDisposalId);
            }
            
            const mrInput = document.getElementById('disp-mr-file');
            if (mrInput) mrInput.value = '';

            if (typeof window.renderDisposalGeometryPreview === 'function') window.renderDisposalGeometryPreview(null, null);
            
            if (typeof window.unloadDisposalGeometry === 'function') {
                window.unloadDisposalGeometry(window.activeDisposalId);
                if (window.activeDisposalId !== normalizedDispName) window.unloadDisposalGeometry(normalizedDispName);
            }
            
            if (typeof window.updateGeometryDisposalListUI === 'function') window.updateGeometryDisposalListUI();
            if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
        });
    }

    const clearReformatBtn = document.getElementById('disp-clear-ref');
    if (clearReformatBtn) {
        clearReformatBtn.addEventListener('click', async () => {
            if (!window.activeDisposalId) return; // GUARD
            const state = window.disposalStates[window.activeDisposalId];
            
            window.hasUnsavedDisposalConfigChanges = false;
            state.refFile = null;
            state.refFileName = null; 
            state.refFileApplied = false; 
            const filenameEl = document.getElementById('disp-ref-filename');
            
            if (filenameEl) {
                filenameEl.textContent = 'Tidak ada file...';
                filenameEl.classList.replace('text-blue-400', 'text-slate-500');
                filenameEl.classList.add('italic');
            }
            clearReformatBtn.disabled = true;
            
            state.cols['disp-col-recon-waste'] = '';
            const ddWaste = document.getElementById('disp-col-recon-waste');
            if (ddWaste) ddWaste.value = '';
            
            await updateDisposalFileStats(null, 'ref'); 
            await window.saveDisposalMetaToDB(window.activeDisposalId);
            
            const refInput = document.getElementById('disp-ref-file');
            if (refInput) refInput.value = '';
        });
    }

    // ==============================================================
    // BUILD GEOMETRY PROCESSING LOGIC (Global Pro-Rata Agregasi)
    // ==============================================================
    const btnBuildGeometry = document.getElementById('disp-btn-build-geometry');
    const statNewEntity = document.getElementById('disp-stat-ne');

    if (btnBuildGeometry) {
        btnBuildGeometry.addEventListener('click', async () => {
            if (!window.activeDisposalId) return; // GUARD
            
            if (typeof window.saveCurrentDisposalUIState === 'function') await window.saveCurrentDisposalUIState();

            const state = window.disposalStates[window.activeDisposalId];
            if (!state) return;

            const mrFile = state.mrFile;
            const refFile = state.refFile;

            btnBuildGeometry.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing in Background...';
            btnBuildGeometry.disabled = true;
            btnBuildGeometry.className = "mt-1 w-full bg-blue-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-wait";
            
            if (statNewEntity) statNewEntity.textContent = 'Processing Data...';

            if (typeof showFullscreenLoading === 'function') {
                showFullscreenLoading("Memproses Data di Background...");
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            try {
                const isMrReal = state.mrFile && state.mrFile.size !== undefined;
                const isRefReal = state.refFile && state.refFile.size !== undefined;
                const hasRefPlaceholder = !!state.refFileName;
                const isBuilt = state.generatedCsv !== null;
                const safeDispId = window.activeDisposalId.replace(/\s+/g, '_');
                const savedBuildMethod = state.buildMethod || 'NON_CEN';

                let action = 'BUILD';
                if (isBuilt) {
                    if (isRefReal && !state.refFileApplied) action = 'APPLY_PRORATA';
                    else if (!hasRefPlaceholder && savedBuildMethod === 'CEN') action = 'RESET';
                }

                const readAsText = (file) => new Promise((resolve, reject) => {
                    if(!file) return resolve("");
                    if(file.size === undefined) return reject(new Error("File fisik hilang. Harap upload ulang CSV untuk memproses geometri baru."));
                    
                    const r = new FileReader();
                    r.onload = e => resolve(e.target.result);
                    r.onerror = () => reject(new Error("Gagal membaca file CSV"));
                    r.readAsText(file);
                });

                let mrText = "";
                let refText = "";
                if (action === 'BUILD') {
                    mrText = await readAsText(mrFile);
                    refText = await readAsText(refFile);
                } else if (action === 'APPLY_PRORATA') {
                    refText = await readAsText(refFile);
                }

                const workerCode = `
                    self.onmessage = function(e) {
                        try {
                            const { action, dispId, mrText, refText, generatedCsv, originalSummaryObj, summaryObj, cols, substrings, savedBuildMethod, refFileName } = e.data;

                            const cleanNum = (val) => parseFloat((val || '').toString().replace(/['",]/g, '')) || 0;
                            const getIdx = (headers, mapped, fallback) => {
                                let idx = mapped ? headers.indexOf(mapped.toUpperCase()) : -1;
                                if (idx === -1 && fallback) idx = headers.indexOf(fallback.toUpperCase());
                                return idx;
                            };
                            const getSubstr = (val, delim) => {
                                if (!delim || !val) return val || '';
                                const parts = delim.split(',');
                                if (parts.length !== 2) return val;
                                const start = parseInt(parts[0]) - 1; 
                                const len = parseInt(parts[1]);
                                if (isNaN(start) || isNaN(len)) return val;
                                return val.substr(Math.max(0, start), len).trim();
                            };
                            const toProperCase = (str) => {
                                if (!str) return '';
                                let result = '';
                                let capitalizeNext = true;
                                for (let i = 0; i < str.length; i++) {
                                    const char = str[i];
                                    if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
                                        result += capitalizeNext ? char.toUpperCase() : char.toLowerCase();
                                        capitalizeNext = false;
                                    } else {
                                        result += char;
                                        capitalizeNext = true;
                                    }
                                }
                                return result;
                            };

                            let result = {};

                            if (action === 'APPLY_PRORATA' || action === 'RESET') {
                                let globalRefWaste = 0;
                                let factorWaste = 1;
                                
                                let newOriginalSummaryObj = originalSummaryObj;
                                if (!newOriginalSummaryObj) {
                                    newOriginalSummaryObj = JSON.parse(JSON.stringify(summaryObj));
                                }

                                if (action === 'APPLY_PRORATA') {
                                    const refLinesArr = refText.split(/\\r?\\n/).filter(l => l.trim() !== '');
                                    const refHeadersArr = refLinesArr[0] ? refLinesArr[0].split(',').map(h => h.trim().toUpperCase()) : [];
                                    const mappedReconWaste = cols['disp-col-recon-waste'];
                                    
                                    const refIdxWaste = getIdx(refHeadersArr, mappedReconWaste, 'WASTE');

                                    for (let i = 1; i < refLinesArr.length; i++) {
                                        const rowCols = refLinesArr[i].split(',');
                                        if (rowCols.length < 2) continue;
                                        if (refIdxWaste !== -1) globalRefWaste += cleanNum(rowCols[refIdxWaste]);
                                    }

                                    const baseTotalW = newOriginalSummaryObj.totalWaste || 0;
                                    factorWaste = baseTotalW > 0 ? (globalRefWaste / baseTotalW) : 0;
                                }
                                
                                const mappedBank = cols['disp-col-bank']; 
                                const bankCondition = parseFloat(mappedBank);
                                const actualBankCondition = isNaN(bankCondition) ? 1.0 : Math.min(1.0, Math.max(0.0, bankCondition));

                                const csvLines = generatedCsv.split(/\\r?\\n/);
                                const newCsvLines = [csvLines[0]];

                                const oldTotalW = summaryObj.totalWaste || 0;
                                const baseTotalW = newOriginalSummaryObj.totalWaste || 0;
                                const oldFactorWaste = baseTotalW > 0 ? (oldTotalW / baseTotalW) : 1;

                                for (let i = 1; i < csvLines.length; i++) {
                                    const line = csvLines[i];
                                    if (!line.trim()) continue;
                                    const rowCols = line.split(',');

                                    const idxBank = rowCols.length - 1;
                                    const idxLoose = rowCols.length - 2;

                                    const currentLoose = parseFloat(rowCols[idxLoose]) || 0;

                                    let baseLoose = currentLoose;

                                    if (savedBuildMethod === 'CEN') {
                                        baseLoose = oldFactorWaste > 0 ? (currentLoose / oldFactorWaste) : 0;
                                    }

                                    const newLoose = baseLoose * factorWaste;
                                    const newBank = newLoose * actualBankCondition; // Total Bank = Total Loose * Bank

                                    rowCols[idxLoose] = newLoose.toFixed(4);
                                    rowCols[idxBank] = newBank.toFixed(4);

                                    newCsvLines.push(rowCols.join(','));
                                }

                                const combinedCsv = newCsvLines.join('\\n');

                                const newSummaryObj = JSON.parse(JSON.stringify(newOriginalSummaryObj));
                                if (summaryObj.previewHulls) newSummaryObj.previewHulls = summaryObj.previewHulls;
                                if (summaryObj.previewBounds) newSummaryObj.previewBounds = summaryObj.previewBounds;
                                if (summaryObj.subsets) newSummaryObj.subsets = summaryObj.subsets;

                                newSummaryObj.totalWaste = newOriginalSummaryObj.totalWaste * factorWaste;
                                newSummaryObj.totalBank = newSummaryObj.totalWaste * actualBankCondition; // Total Bank (Loose * Bank)

                                const newBuildMethod = action === 'APPLY_PRORATA' ? 'CEN' : 'NON_CEN';

                                result = { combinedCsv, newSummaryObj, newBuildMethod, newOriginalSummaryObj };

                            } else if (action === 'BUILD') {
                                const mrLines = mrText.split(/\\r?\\n/).filter(l => l.trim() !== '');
                                const refLines = refText ? refText.split(/\\r?\\n/).filter(l => l.trim() !== '') : [];

                                const mrHeaders = mrLines[0] ? mrLines[0].split(',').map(h => h.trim().toUpperCase()) : [];
                                const refHeaders = refLines[0] ? refLines[0].split(',').map(h => h.trim().toUpperCase()) : [];

                                const mappedBlock = cols['disp-col-blockname'];
                                const mappedBench = cols['disp-col-bench'];
                                const mappedSubset = cols['disp-col-subset'];
                                const mappedWaste = cols['disp-col-waste']; // Untuk Loose
                                const mappedBank = cols['disp-col-bank'];   // Untuk Bank
                                const mappedReconWaste = cols['disp-col-recon-waste']; 

                                const delimBlock = substrings['disp-delim-block'];
                                const delimStrip = substrings['disp-delim-strip'];
                                const delimBench = substrings['disp-delim-bench'];

                                const mrIdxBlock = getIdx(mrHeaders, 'BLOCKNAME', mappedBlock);
                                const mrIdxBench = getIdx(mrHeaders, 'BENCH', mappedBench);
                                const mrIdxSubset = getIdx(mrHeaders, 'SUBSET', mappedSubset);
                                const mrIdxWaste = getIdx(mrHeaders, mappedWaste, null);
                                const bankCondition = parseFloat(mappedBank); // Baca nilai dari input
                                const actualBankCondition = isNaN(bankCondition) ? 1.0 : Math.min(1.0, Math.max(0.0, bankCondition));
                                
                                const mrKeepIndices = [];
                                mrHeaders.forEach((h, i) => {
                                    mrKeepIndices.push(i);
                                });

                                const refIdxWaste = getIdx(refHeaders, mappedReconWaste, 'WASTE');

                                let globalRefWaste = 0;
                                if (refText) {
                                    for (let i = 1; i < refLines.length; i++) {
                                        const rowCols = refLines[i].split(',');
                                        if (rowCols.length < 2) continue;
                                        if (refIdxWaste !== -1) globalRefWaste += cleanNum(rowCols[refIdxWaste]);
                                    }
                                }

                                let globalMRWaste = 0;
                                const blocksMap = new Map();
                                let validRowsCount = 0;
                                const subsetsSet = new Set();
                                
                                for (let i = 1; i < mrLines.length; i++) {
                                    if (i === 1 || i === 2) continue; 
                                    const mrCols = mrLines[i].split(',');
                                    if (mrCols.length < 2) continue;
                                    
                                    validRowsCount++;

                                    const rawBlock = mrIdxBlock !== -1 ? (mrCols[mrIdxBlock] || '').trim() : '';
                                    const rawBench = mrIdxBench !== -1 ? (mrCols[mrIdxBench] || '').trim() : '';
                                    
                                    let rawSubset = mrIdxSubset !== -1 ? (mrCols[mrIdxSubset] || '').trim() : '';
                                    let resolvedSubset = rawSubset ? toProperCase(rawSubset) : '';

                                    // Hanya tambahkan ke palet subset JIKA subset beneran didefinisikan
                                    if (resolvedSubset) subsetsSet.add(resolvedSubset);

                                    const idDisp = dispId || '';
                                    const idBlock = delimBlock ? getSubstr(rawBlock, delimBlock) : rawBlock;
                                    const idStrip = delimStrip ? getSubstr(rawBlock, delimStrip) : rawBlock;
                                    const idBench = delimBench ? getSubstr(rawBench, delimBench) : rawBench;
                                    
                                    const burdenType = 'WASTE';
                                    
                                    // Komposit ID Format (Disposal/Block/Strip/Bench/[Subset|Burden])
                                    const compositeId = idDisp + '/' + idBlock + '/' + idStrip + '/' + idBench + (mrIdxSubset !== -1 ? (resolvedSubset ? '/' + resolvedSubset : '') : '/' + burdenType);

                                    if (!blocksMap.has(compositeId)) {
                                        blocksMap.set(compositeId, { sumWasteWeight: 0, count: 0 });
                                    }

                                    const b = blocksMap.get(compositeId);
                                    
                                    // Akumulasi langsung Loose
                                    let wVal = mrIdxWaste !== -1 ? cleanNum(mrCols[mrIdxWaste]) : 0;
                                    
                                    globalMRWaste += wVal;

                                    b.sumWasteWeight += wVal;
                                    b.count++;
                                }

                                // Total Bank menggunakan Rumus (Total Loose * Bank Condition)
                                let globalMRBank = globalMRWaste * actualBankCondition;

                                const factorWaste = refText ? (globalMRWaste > 0 ? (globalRefWaste / globalMRWaste) : 0) : 1;

                                const newSummaryObj = {
                                    totalWaste: globalMRWaste * factorWaste,
                                    totalBank: (globalMRWaste * factorWaste) * actualBankCondition,
                                    previewHulls: null, previewBounds: null,
                                    subsets: Array.from(subsetsSet) // Kosong jika subset None
                                };
                                
                                const newOriginalSummaryObj = {
                                    totalWaste: globalMRWaste,
                                    totalBank: globalMRBank,
                                    qualities: {}
                                };
                                
                                const newHeaders = [];
                                mrKeepIndices.forEach(i => newHeaders.push(mrHeaders[i]));
                                newHeaders.push("ID D-Composite", "ID D-Name", "ID D-Block", "ID D-Strip", "ID D-Bench", "ID D-Subset");
                                newHeaders.push("LOOSE_VOLUME", "BANK_VOLUME");
                                
                                let combinedLines = [newHeaders.join(',')];

                                for (let i = 1; i < mrLines.length; i++) {
                                    if (i === 1 || i === 2) continue; 
                                    const mrCols = mrLines[i].split(',');
                                    if (mrCols.length < 2) continue;

                                    const rawBlock = mrIdxBlock !== -1 ? (mrCols[mrIdxBlock] || '').trim() : '';
                                    const rawBench = mrIdxBench !== -1 ? (mrCols[mrIdxBench] || '').trim() : '';
                                    
                                    let rawSubset = mrIdxSubset !== -1 ? (mrCols[mrIdxSubset] || '').trim() : '';
                                    let resolvedSubset = rawSubset ? toProperCase(rawSubset) : '';

                                    const idDisp = dispId || '';
                                    const idBlock = delimBlock ? getSubstr(rawBlock, delimBlock) : rawBlock;
                                    const idStrip = delimStrip ? getSubstr(rawBlock, delimStrip) : rawBlock;
                                    const idBench = delimBench ? getSubstr(rawBench, delimBench) : rawBench;
                                    
                                    const burdenType = 'WASTE';
                                    
                                    // Komposit ID Format (Disposal/Block/Strip/Bench/[Subset|Burden])
                                    const compositeId = idDisp + '/' + idBlock + '/' + idStrip + '/' + idBench + (mrIdxSubset !== -1 ? (resolvedSubset ? '/' + resolvedSubset : '') : '/' + burdenType);
                                    
                                    const row = [];

                                    mrKeepIndices.forEach(idx => row.push(mrCols[idx] !== undefined ? mrCols[idx] : ''));

                                    // push ke baris CSV
                                    row.push(compositeId, idDisp, idBlock, idStrip, idBench, resolvedSubset);

                                    let wVal = mrIdxWaste !== -1 ? cleanNum(mrCols[mrIdxWaste]) : 0;
                                    let finalRowLoose = wVal * factorWaste;
                                    let finalRowBank = finalRowLoose * actualBankCondition; // Total Bank (Loose * Bank)

                                    row.push(finalRowLoose.toFixed(4), finalRowBank.toFixed(4));
                                    combinedLines.push(row.join(','));
                                }

                                const combinedCsv = combinedLines.join('\\n');
                                const newRows = blocksMap.size;
                                
                                const memoryEstimateMB = (validRowsCount * 2560 / (1024 * 1024)).toFixed(2);
                                const newBuildMethod = refFileName ? 'CEN' : 'NON_CEN';

                                result = { combinedCsv, newSummaryObj, newBuildMethod, newOriginalSummaryObj, newRows, memoryEstimateMB };
                            }

                            self.postMessage({ success: true, result });
                        } catch (err) {
                            self.postMessage({ error: err.message });
                        }
                    };
                `;

                const blob = new Blob([workerCode], { type: 'application/javascript' });
                const workerUrl = URL.createObjectURL(blob);
                const worker = new Worker(workerUrl);

                worker.onmessage = async (e) => {
                    URL.revokeObjectURL(workerUrl);
                    // [FIX] HARUS SEGERA DIBUNUH AGAR THREAD & RAM BENAR-BENAR BERSIH 
                    worker.terminate();

                    if (e.data.error) {
                        throwError(e.data.error);
                        return;
                    }

                    window.hasUnsavedDisposalConfigChanges = false;

                    const result = e.data.result;

                    state.generatedCsv = result.combinedCsv;
                    state.summaryObj = result.newSummaryObj;
                    if (result.newOriginalSummaryObj) state.originalSummaryObj = result.newOriginalSummaryObj;
                    state.buildMethod = result.newBuildMethod;

                    localStorage.setItem(`rizpec_disp_build_type_${safeDispId}`, result.newBuildMethod);

                    if (action === 'APPLY_PRORATA') {
                        state.refFile = null; 
                        state.refFileApplied = true;
                    } else if (action === 'RESET') {
                        state.refFileApplied = false;
                        state.cols['disp-col-recon-waste'] = '';
                        const ddWaste = document.getElementById('disp-col-recon-waste');
                        if (ddWaste) ddWaste.value = '';
                    } else if (action === 'BUILD') {
                        if (state.refFileName) {
                            state.refFile = null;
                            state.refFileApplied = true;
                        }
                    }

                    if (typeof window.renderDisposalGeometryPreview === 'function') {
                        window.renderDisposalGeometryPreview(result.combinedCsv, state.summaryObj, result.newBuildMethod);
                    }

                    try {
                        if (typeof RizpecDB !== 'undefined') await RizpecDB.set(`rizpec_disp_entity_${safeDispId}`, result.combinedCsv);
                        await window.saveDisposalMetaToDB(window.activeDisposalId);
                    } catch(e) {}

                    if (typeof window.updateDisposalFolderBadge === 'function') window.updateDisposalFolderBadge(window.activeDisposalId, result.newBuildMethod);
                    if (typeof window.updateGeometryDisposalListUI === 'function') window.updateGeometryDisposalListUI();

                    if (statNewEntity) {
                        if (action === 'BUILD') {
                            const statResultText = `${result.memoryEstimateMB} MB (${result.newRows} Block Computed)`;
                            statNewEntity.textContent = statResultText;
                            state.neStats = { text: statResultText };
                        } else {
                            statNewEntity.textContent = state.neStats.text;
                        }
                        await window.saveDisposalMetaToDB(window.activeDisposalId);
                    }

                    if (window.loadedDisposals && window.loadedDisposals.has(window.activeDisposalId)) {
                        if (window.renderedDisposals) window.renderedDisposals.delete(window.activeDisposalId);
                        if (typeof window.unloadDisposalGeometry === 'function') window.unloadDisposalGeometry(window.activeDisposalId);
                        window.loadedDisposals.add(window.activeDisposalId); 
                        
                        const geoTab = document.getElementById('panel-geometry');
                        const isGeoTabActive = geoTab && !geoTab.classList.contains('hidden');
                        
                        if (isGeoTabActive) {
                            if (typeof window.renderPendingPits === 'function') window.renderPendingPits();
                        } else {
                            const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
                            if (tabBtn) {
                                tabBtn.classList.add('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse');
                                setTimeout(() => tabBtn.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse'), 2000);
                            }
                        }
                    }
                    
                    const neFilenameEl = document.getElementById('disp-ne-filename');
                    if (neFilenameEl) {
                        neFilenameEl.textContent = `${window.activeDisposalId}_Geometry`;
                        neFilenameEl.classList.replace('text-slate-500', 'text-blue-400');
                        neFilenameEl.classList.remove('italic');
                    }

                    window.updateDisposalBuildGeometryButtonState();

                    if (statNewEntity) {
                        statNewEntity.classList.add('text-emerald-400');
                        setTimeout(() => statNewEntity.classList.remove('text-emerald-400'), 1500);
                    }

                    if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
                };

                worker.onerror = (err) => {
                    URL.revokeObjectURL(workerUrl);
                    // [FIX] HARUS DIBUNUH KETIKA ERROR
                    worker.terminate();
                    throwError(err.message);
                };

                const throwError = (msg) => {
                    btnBuildGeometry.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal! Cek Log/Upload Ulang';
                    btnBuildGeometry.className = "mt-1 w-full bg-rose-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-default";
                    if (msg && msg.includes("File fisik")) alert(msg);
                    setTimeout(() => window.updateDisposalBuildGeometryButtonState(), 2000);
                    if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
                };

                worker.postMessage({
                    action,
                    dispId: window.activeDisposalId,
                    mrText,
                    refText,
                    generatedCsv: state.generatedCsv,
                    originalSummaryObj: state.originalSummaryObj,
                    summaryObj: state.summaryObj,
                    cols: state.cols,
                    substrings: state.substrings,
                    savedBuildMethod,
                    refFileName: state.refFileName
                });

            } catch(err) {
                btnBuildGeometry.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal! Cek Log/Upload Ulang';
                btnBuildGeometry.className = "mt-1 w-full bg-rose-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-default";
                if (err.message.includes("File fisik")) alert(err.message);
                setTimeout(() => window.updateDisposalBuildGeometryButtonState(), 2000);
                if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
            }
        });
    }
})();

// ==============================================================
// GEOMETRY 2D PREVIEW & SUMMARY TABLE LOGIC (PURE HTML5 CANVAS)
// ==============================================================
window.renderDisposalGeometryPreview = function(csvData, summaryObj, buildMethod = 'NON_CEN', updateSummaryOnly = false, isAggregated = false) {
    const placeholder = document.getElementById('disp-preview-placeholder');
    const summaryTable = document.getElementById('disp-preview-summary-table');
    const summaryContent = document.getElementById('disp-preview-summary-content');
    const canvasContainer = document.getElementById('disp-preview-3d-canvas');

    if (!summaryObj) {
        placeholder?.classList.remove('hidden');
        summaryTable?.classList.add('hidden');
        if (canvasContainer && !updateSummaryOnly) canvasContainer.innerHTML = '';
        return;
    }

    const titleLabel = isAggregated ? 'Summary (Agregasi Disposal)' : (buildMethod === 'CEN' ? 'Summary (Centeroid)' : 'Summary (Non-Centeroid)');
    if (summaryTable) {
        const titleEl = summaryTable.querySelector('h3');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fa-solid fa-chart-simple mr-1.5 text-blue-400"></i> ${titleLabel}`;
        }
    }

    // RULE 3 & 4: Output Total Loose dan Total Bank
    let html = `
        <div class="text-blue-400 font-semibold mb-1 border-b border-slate-600 pb-0.5">Capacity</div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Total Loose</span>
            <span class="font-bold text-slate-200">${(summaryObj.totalWaste || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Total Bank</span>
            <span class="font-bold text-slate-200">${(summaryObj.totalBank || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
    `;
    
    if (summaryContent) summaryContent.innerHTML = html;
    placeholder?.classList.add('hidden');
    summaryTable?.classList.remove('hidden');

    if (updateSummaryOnly) return;

    if (!canvasContainer) return;
    
    let hulls = [];
    let globalMinX = Infinity, globalMaxX = -Infinity;
    let globalMinY = Infinity, globalMaxY = -Infinity;

    if (summaryObj.previewHulls && summaryObj.previewBounds) {
        hulls = summaryObj.previewHulls;
        globalMinX = summaryObj.previewBounds.minX;
        globalMaxX = summaryObj.previewBounds.maxX;
        globalMinY = summaryObj.previewBounds.minY;
        globalMaxY = summaryObj.previewBounds.maxY;
    } else if (csvData) {
        const lines = csvData.split(/\r?\n/);
        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        const idIdx = headers.indexOf('ID D-COMPOSITE'); 
        
        const e1 = headers.indexOf('EASTING_1'), n1 = headers.indexOf('NORTHING_1');
        const e2 = headers.indexOf('EASTING_2'), n2 = headers.indexOf('NORTHING_2');
        const e3 = headers.indexOf('EASTING_3'), n3 = headers.indexOf('NORTHING_3');
        
        const blockMap = new Map();

        if (e1 !== -1 && n1 !== -1) {
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 5) continue;
                
                const pt1 = [parseFloat(cols[e1]) || 0, -(parseFloat(cols[n1]) || 0)];
                const pt2 = [parseFloat(cols[e2]) || 0, -(parseFloat(cols[n2]) || 0)];
                const pt3 = [parseFloat(cols[e3]) || 0, -(parseFloat(cols[n3]) || 0)];
                
                if (pt1[0] === 0 && pt1[1] === 0) continue; 

                [pt1, pt2, pt3].forEach(pt => {
                    if (pt[0] < globalMinX) globalMinX = pt[0];
                    if (pt[0] > globalMaxX) globalMaxX = pt[0];
                    if (pt[1] < globalMinY) globalMinY = pt[1];
                    if (pt[1] > globalMaxY) globalMaxY = pt[1];
                });

                const compositeId = idIdx !== -1 ? cols[idIdx] : '';
                let baseBlock = 'BLK', baseStrip = 'STP';
                if (compositeId) {
                    const parts = compositeId.split('/');
                    if (parts.length >= 3) {
                        baseBlock = parts[1];
                        baseStrip = parts[2];
                    } else {
                        baseBlock = compositeId;
                    }
                }
                
                const groupKey = `${baseBlock}_${baseStrip}`;
                if (!blockMap.has(groupKey)) blockMap.set(groupKey, []);
                
                blockMap.get(groupKey).push(pt1, pt2, pt3);
            }
        }

        const convexHull = (points) => {
            const uniqueMap = new Map();
            for (let p of points) {
                const key = p[0].toFixed(3) + '_' + p[1].toFixed(3);
                if (!uniqueMap.has(key)) uniqueMap.set(key, p);
            }
            const unique = Array.from(uniqueMap.values());
            
            if (unique.length <= 2) return unique;

            unique.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            
            const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

            const lower = [];
            for (let i = 0; i < unique.length; i++) {
                while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], unique[i]) <= 1e-9) lower.pop();
                lower.push(unique[i]);
            }

            const upper = [];
            for (let i = unique.length - 1; i >= 0; i--) {
                while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], unique[i]) <= 1e-9) upper.pop();
                upper.push(unique[i]);
            }

            lower.pop();
            upper.pop();
            
            const hull = lower.concat(upper);
            return hull.length >= 3 ? hull : unique;
        };

        blockMap.forEach(pts => hulls.push(convexHull(pts)));

        summaryObj.previewHulls = hulls;
        summaryObj.previewBounds = { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY };
        
        if (window.activeDisposalId && window.disposalStates[window.activeDisposalId]) {
            window.disposalStates[window.activeDisposalId].summaryObj = summaryObj;
            window.saveDisposalMetaToDB(window.activeDisposalId);
        }

    } else {
        canvasContainer.innerHTML = '';
        return;
    }

    canvasContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvasContainer.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const draw = () => {
        const rect = canvasContainer.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const pad = 20;
        const availW = canvas.width - pad * 2;
        const availH = canvas.height - pad * 2;

        const dataW = globalMaxX - globalMinX;
        const dataH = globalMaxY - globalMinY;

        if (dataW <= 0 || dataH <= 0 || globalMinX === Infinity) return;

        const scale = Math.min(availW / dataW, availH / dataH);
        const cx = (globalMinX + globalMaxX) / 2;
        const cy = (globalMinY + globalMaxY) / 2;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        ctx.strokeStyle = '#60a5fa'; 
        ctx.lineWidth = 1.5 / scale; 
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        for (let hull of hulls) {
            if (hull.length < 3) continue;
            ctx.moveTo(hull[0][0], hull[0][1]);
            for (let i = 1; i < hull.length; i++) {
                ctx.lineTo(hull[i][0], hull[i][1]);
            }
            ctx.closePath();
        }
        ctx.stroke();
        ctx.restore();
    };

    if (canvasContainer._resizeObserver) canvasContainer._resizeObserver.disconnect();
    if (canvasContainer._visibilityObserver) canvasContainer._visibilityObserver.disconnect();

    let isVisible = false;

    const visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isVisible = entry.isIntersecting;
            if (isVisible) requestAnimationFrame(() => draw());
        });
    }, { root: null, threshold: 0.01 });

    visibilityObserver.observe(canvasContainer);
    canvasContainer._visibilityObserver = visibilityObserver;

    const resizeObserver = new ResizeObserver(() => {
        if (isVisible && canvasContainer.clientWidth > 0 && canvasContainer.clientHeight > 0) {
            requestAnimationFrame(() => draw());
        }
    });
    
    resizeObserver.observe(canvasContainer);
    canvasContainer._resizeObserver = resizeObserver;
};

// ==============================================================
// GLOBAL PALETTE COLORS APPLIER
// ==============================================================
window.applyDisposalPaletteColors = function() {};

window.markDisposalsForRebuildOnColorChange = function(type, changedName) {};

window.updateDisposalApplyColorButton = function() {
    const btn = document.getElementById('disp-btn-apply-colors');
    if (!btn) return;
    
    if (window.hasUnsavedDisposalColorChanges) {
        btn.disabled = false;
        btn.className = "w-full bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
    } else {
        btn.disabled = true;
        btn.className = "w-full bg-slate-700 text-slate-400 py-1.5 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
    }
};

window.resetUnsavedDisposalColorChanges = function() {
    if (window.hasUnsavedDisposalColorChanges) {
        window.hasUnsavedDisposalColorChanges = false;
        
        const savedBurden = localStorage.getItem('rizpec_disp_burden_palette');
        if (savedBurden) window.dispBurdenPalette = JSON.parse(savedBurden);
        
        const savedSubset = localStorage.getItem('rizpec_disp_subset_palette');
        if (savedSubset) window.dispSubsetPalette = JSON.parse(savedSubset);
        
        if (typeof window.renderDisposalPaletteUI === 'function') window.renderDisposalPaletteUI();
        if (typeof window.updateDisposalApplyColorButton === 'function') window.updateDisposalApplyColorButton();
    }
};

// ==============================================================
// INIT GEOMETRY DISPOSAL LIST & PALETTE UI
// ==============================================================

window.loadedDisposals = window.loadedDisposals || new Set();
window.renderedDisposals = window.renderedDisposals || new Set();

window.initGeometryDisposalListUI = function() {
    const leftPanel = document.querySelector('#file-summary-content > div:first-child');
    if (!leftPanel) return;
    
    let container = document.getElementById('geometry-disp-manager');
    if (!container) {
        container = document.createElement('div');
        container.id = 'geometry-disp-manager';
        
        const summaryNameEl = document.getElementById('summary-name');
        const isRootFolder = summaryNameEl && summaryNameEl.textContent === 'Disposal Data' && !window.activeDisposalId;
        
        if (isRootFolder) {
            container.className = 'flex flex-col gap-3 pt-3 h-full px-3 overflow-hidden';
        } else {
            container.className = 'hidden flex-col gap-3 pt-3 h-full px-3 overflow-hidden';
        }

        container.innerHTML = `
            <!-- List Section -->
            <div class="flex flex-col gap-1.5 border-b border-slate-700/50 pb-1.5 shrink-0 mt-1">
                <h4 class="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 tracking-wide uppercase">
                    <i class="fa-solid fa-list-ul"></i> List
                </h4>
            </div>
            <div id="geometry-disp-list" class="flex flex-col gap-1.5 overflow-y-auto max-h-[150px] shrink-0 custom-scrollbar"></div>

            <!-- Burden Section -->
            <div class="flex flex-col gap-1.5 border-b border-slate-700/50 pb-1.5 mt-2 shrink-0">
                <h4 class="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 tracking-wide uppercase">
                    <i class="fa-solid fa-layer-group"></i> Burden
                </h4>
            </div>
            <div id="geometry-disp-burden-list" class="flex flex-col gap-1.5 shrink-0"></div>

            <!-- Subset Section -->
            <div class="flex flex-col gap-1.5 border-b border-slate-700/50 pb-1.5 mt-2 shrink-0">
                <h4 class="text-[11px] font-bold text-blue-400 flex items-center gap-1.5 tracking-wide uppercase">
                    <i class="fa-solid fa-palette"></i> Subset
                </h4>
            </div>
            <div id="geometry-disp-subset-list" class="flex flex-col gap-1.5 overflow-y-auto max-h-[150px] custom-scrollbar shrink-0"></div>
            
            <!-- Apply Color Button -->
            <div class="mt-2 shrink-0 pb-3">
                <button id="disp-btn-apply-colors" class="w-full bg-slate-700 text-slate-400 py-1.5 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed" disabled>
                    <i class="fa-solid fa-check-double"></i> Apply Color
                </button>
            </div>
        `;
        leftPanel.appendChild(container);
        
        document.getElementById('disp-btn-apply-colors').addEventListener('click', function() {
            if (!window.hasUnsavedDisposalColorChanges) return;

            localStorage.setItem('rizpec_disp_burden_palette', JSON.stringify(window.dispBurdenPalette));
            localStorage.setItem('rizpec_disp_subset_palette', JSON.stringify(window.dispSubsetPalette));
            
            window.hasUnsavedDisposalColorChanges = false;
            window.updateDisposalApplyColorButton();

            if (window.loadedDisposals && window.loadedDisposals.size > 0) {
                window.loadedDisposals.forEach(disp => {
                    if (typeof window.unloadDisposalGeometry === 'function') window.unloadDisposalGeometry(disp);
                    if (window.renderedDisposals) window.renderedDisposals.delete(disp);
                });
                
                const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
                if (tabBtn) {
                    tabBtn.classList.add('bg-blue-600/30', 'text-blue-300', 'animate-pulse');
                    setTimeout(() => tabBtn.classList.remove('bg-blue-600/30', 'text-blue-300', 'animate-pulse'), 2000);
                }
            }
        });
    }
    
    window.hasUnsavedDisposalColorChanges = false; 
    window.updateGeometryDisposalListUI();
};

window.updateGeometryDisposalListUI = async function() {
    window.dispColorModes = JSON.parse(localStorage.getItem('rizpec_disp_color_modes')) || {};

    const listEl = document.getElementById('geometry-disp-list');
    if(!listEl) return;
    
    const disposals = [];
    let allSubsets = new Set(); 
    
    const dispContainer = document.getElementById('subfolders-folder-disp');
    if (dispContainer) {
        const dispElements = dispContainer.querySelectorAll('.folder-name-text');
        
        for (let el of Array.from(dispElements)) {
            const exactDispName = el.textContent.trim();
            const safeId = exactDispName.replace(/\s+/g, '_');
            
            try {
                if (typeof RizpecDB !== 'undefined') {
                    const meta = await RizpecDB.get(`rizpec_disp_entity_${safeId}_meta`);
                    
                    const isGeometryReady = meta && meta.neStats && meta.neStats.text && !meta.neStats.text.includes('(0 Block');

                    if (isGeometryReady) {
                        let hasSubset = (meta.cols && meta.cols['disp-col-subset'] && meta.cols['disp-col-subset'] !== "");
                        if (!disposals.find(p => p.name === exactDispName)) disposals.push({ name: exactDispName, hasSubset: hasSubset });
                        
                        if (meta.summaryObj && meta.summaryObj.subsets) {
                            meta.summaryObj.subsets.forEach(s => allSubsets.add(s));
                        }
                    }
                }
            } catch(e) {
                console.error("Gagal meload disposal meta:", e);
            }
        }
    }

    listEl.innerHTML = '';
    
    const isEmpty = disposals.length === 0;

    if (isEmpty) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-16 text-center opacity-60">
                <div class="text-[10px] text-slate-400 italic">Belum ada Data.</div>
            </div>
        `;
    } else {
        disposals.forEach(dispObj => {
            const disp = dispObj.name;
            const isLoaded = window.loadedDisposals.has(disp);
            
            let currentMode = window.dispColorModes[disp];

            if (!currentMode || !['Burden', 'Subset'].includes(currentMode)) {
                currentMode = dispObj.hasSubset ? 'Subset' : 'Burden';
                window.dispColorModes[disp] = currentMode;
                localStorage.setItem('rizpec_disp_color_modes', JSON.stringify(window.dispColorModes));
            }
            
            if (!dispObj.hasSubset && currentMode === 'Subset') {
                currentMode = 'Burden';
                window.dispColorModes[disp] = currentMode;
                localStorage.setItem('rizpec_disp_color_modes', JSON.stringify(window.dispColorModes));
            }

            let optionsHtml = `<option value="Burden" ${currentMode === 'Burden' ? 'selected' : ''}>Burden</option>`;
            if (dispObj.hasSubset) {
                optionsHtml += `<option value="Subset" ${currentMode === 'Subset' ? 'selected' : ''}>Subset</option>`;
            }

            const div = document.createElement('div');
            
            div.className = `flex items-center gap-2.5 bg-slate-900/80 border ${isLoaded ? 'border-blue-500/50 shadow-sm' : 'border-slate-700/80'} p-2 rounded-md transition-all hover:bg-slate-800 group`;
            
            // [PERBAIKAN]: Menghapus event listener spesifik, digantikan oleh atribut 'data-*'
            div.innerHTML = `
                <label class="relative flex items-center justify-center w-5 h-5 cursor-pointer m-0 shrink-0" title="Check/Uncheck untuk menampilkan Geometri">
                    <input type="checkbox" class="disp-checkbox peer absolute opacity-0 w-full h-full cursor-pointer" data-disp="${disp}" ${isLoaded ? 'checked' : ''}>
                    <div class="checkbox-box w-5 h-5 rounded-sm border ${isLoaded ? 'bg-blue-500 border-blue-500' : 'bg-slate-800 border-slate-600 group-hover:border-blue-400'} flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-check text-white text-[10px] ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                    </div>
                </label>
                <div class="flex flex-col truncate flex-1 pr-1">
                    <span class="${isLoaded ? 'text-blue-400' : 'text-slate-300'} transition-colors font-bold text-[11px] truncate">${disp}</span>
                </div>
                <select class="disp-color-mode-select bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-600 rounded px-1.5 py-0.5 outline-none cursor-pointer shrink-0 hover:border-slate-400 transition-colors" data-disp="${disp}" title="Pilih Mode Visualisasi">
                    ${optionsHtml}
                </select>
            `;
            
            listEl.appendChild(div);
        });
    }

    let dispBurdenPalette = JSON.parse(localStorage.getItem('rizpec_disp_burden_palette')) || 
                        JSON.parse(localStorage.getItem('rizpec_basic_palette')) || [
        { name: 'Waste', desc: '', color: '#808000' } 
    ];
    
    if (dispBurdenPalette.length > 0 && dispBurdenPalette[0].name === 'Loose') {
        dispBurdenPalette[0].name = 'Waste';
        dispBurdenPalette[0].color = '#808000';
        localStorage.setItem('rizpec_disp_burden_palette', JSON.stringify(dispBurdenPalette));
    }
    
    if (!localStorage.getItem('rizpec_disp_burden_palette')) {
        localStorage.setItem('rizpec_disp_burden_palette', JSON.stringify(dispBurdenPalette));
    }
    window.dispBurdenPalette = dispBurdenPalette;

    let currentPalette = JSON.parse(localStorage.getItem('rizpec_disp_subset_palette')) || [];
    let existingNames = currentPalette.map(p => p.name);
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    let sortedSubsets = Array.from(allSubsets);

    const getSubsetWeight = (name) => {
        const upperName = name.toUpperCase();
        if (upperName === 'WASTE') return 0;
        if (upperName.startsWith('R')) return 1;
        if (upperName.startsWith('S')) return 2;
        if (upperName.startsWith('T')) return 3;
        if (upperName.startsWith('O')) return 4;
        return 500; 
    };

    const getSubsetColor = (name, defIndex) => {
        const upperName = name.toUpperCase();
        if (upperName === 'WASTE') return '#808000'; 
        if (upperName.startsWith('RE')) return '#eab308'; 
        if (upperName.startsWith('T')) return '#ea580c';  
        if (upperName.startsWith('O')) return '#808080';  
        if (upperName.startsWith('S')) return '#0e7490';  
        return defaultColors[defIndex % defaultColors.length];
    };

    sortedSubsets.sort((a, b) => getSubsetWeight(a) - getSubsetWeight(b));

    if (currentPalette.length === 0) {
        sortedSubsets.forEach((s, index) => {
            currentPalette.push({ name: s, desc: '', color: getSubsetColor(s, index) });
        });
        localStorage.setItem('rizpec_disp_subset_palette', JSON.stringify(currentPalette));
    } else {
        currentPalette = currentPalette.filter(p => allSubsets.has(p.name));
        let needSaveDefault = false;
        
        sortedSubsets.forEach((s, index) => {
            if (!existingNames.includes(s)) {
                needSaveDefault = true;
                const newItem = { name: s, desc: '', color: getSubsetColor(s, index) };
                currentPalette.push(newItem);
            }
        });

        if (needSaveDefault) {
             localStorage.setItem('rizpec_disp_subset_palette', JSON.stringify(currentPalette));
        }
    }

    currentPalette.forEach(p => { if (typeof p.desc === 'undefined') p.desc = ''; });
    
    window.dispSubsetPalette = currentPalette;
    
    if (typeof window.renderDisposalPaletteUI === 'function') {
        window.renderDisposalPaletteUI(isEmpty);
    }
    
    window.updateDisposalApplyColorButton();
};

window.renderDisposalPaletteUI = function(isEmpty = false) {
    const burdenListEl = document.getElementById('geometry-disp-burden-list');
    const subsetListEl = document.getElementById('geometry-disp-subset-list');
    
    const emptyHTML = `
        <div class="flex flex-col items-center justify-center h-16 text-center opacity-60">
            <div class="text-[10px] text-slate-400 italic">Belum ada Data.</div>
        </div>
    `;

    if (isEmpty) {
        if (burdenListEl) burdenListEl.innerHTML = emptyHTML;
        if (subsetListEl) subsetListEl.innerHTML = emptyHTML;
        return;
    }

    // [PERBAIKAN]: Menambahkan penanda Class ('disp-color-input-burden') untuk diolah Global Event Delegation
    if (burdenListEl && window.dispBurdenPalette) {
        burdenListEl.innerHTML = '';
        window.dispBurdenPalette.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "grid grid-cols-[24px_1fr] gap-2 items-center bg-slate-900/80 border border-slate-700/80 p-2 rounded-md hover:bg-slate-800 transition-colors";
            
            div.innerHTML = `
                <div class="flex items-center justify-center w-[24px]">
                    <div class="relative w-5 h-5 rounded overflow-hidden border border-slate-600 hover:border-slate-400 transition-colors shadow-sm cursor-pointer shrink-0">
                        <input type="color" class="absolute top-[-10px] left-[-10px] w-10 h-10 cursor-pointer outline-none p-0 border-0 color-input disp-color-input-burden" data-index="${index}" value="${item.color}">
                    </div>
                </div>
                <div class="truncate text-slate-300 text-[10px] font-bold" title="${item.name}">${item.name}</div>
            `;

            burdenListEl.appendChild(div);
        });
    }

    if (subsetListEl) {
        subsetListEl.innerHTML = '';
        let palette = window.dispSubsetPalette || [];
        
        if (palette.length === 0) {
            subsetListEl.innerHTML = emptyHTML;
            return;
        }

        // [PERBAIKAN]: Menambahkan penanda Class ('disp-color-input-subset', 'disp-btn-up-subset', dll) untuk global delegate
        palette.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "grid grid-cols-[24px_1fr_16px] gap-2 items-center bg-slate-900/80 border border-slate-700/80 p-2 rounded-md hover:bg-slate-800 transition-colors group";
            
            div.innerHTML = `
                <div class="flex items-center justify-center w-[24px]">
                    <div class="relative w-5 h-5 rounded overflow-hidden border border-slate-600 group-hover:border-slate-400 transition-colors shadow-sm cursor-pointer shrink-0">
                        <input type="color" class="absolute top-[-10px] left-[-10px] w-10 h-10 cursor-pointer outline-none p-0 border-0 color-input disp-color-input-subset" data-index="${index}" value="${item.color}">
                    </div>
                </div>
                <div class="truncate text-slate-300 text-[10px] font-bold" title="${item.name}">${item.name}</div>
                <div class="flex flex-col gap-0 items-center justify-center shrink-0 w-[16px]">
                    <button class="text-slate-600 hover:text-blue-400 transition-colors btn-up disp-btn-up-subset h-3 flex items-center" data-index="${index}" title="Naikkan"><i class="fa-solid fa-caret-up text-[10px]"></i></button>
                    <button class="text-slate-600 hover:text-blue-400 transition-colors btn-down disp-btn-down-subset h-3 flex items-center" data-index="${index}" title="Turunkan"><i class="fa-solid fa-caret-down text-[10px]"></i></button>
                </div>
            `;

            subsetListEl.appendChild(div);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const mandatoryIds = ['disp-col-blockname', 'disp-col-bench', 'disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'];
        mandatoryIds.forEach(id => {
            const el = document.getElementById(id);
            if (el && el.previousElementSibling && !el.previousElementSibling.innerHTML.includes('text-red-500')) {
                el.previousElementSibling.innerHTML += ' <span class="text-red-500">*</span>';
            }
        });

        const allSettingIds = [
            'disp-col-blockname', 'disp-col-bench', 'disp-col-subset', 'disp-col-waste', 'disp-col-bank',
            'disp-col-recon-waste', 'disp-delim-block', 'disp-delim-strip', 'disp-delim-bench'
        ];
        
        allSettingIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', async () => { 
                    if (!window.activeDisposalId) return;
                    window.hasUnsavedDisposalConfigChanges = true;
                    await window.saveCurrentDisposalUIState(); 
                    window.updateDisposalBuildGeometryButtonState(); 
                });
                if (el.tagName === 'INPUT') el.addEventListener('input', async () => { 
                    if (!window.activeDisposalId) return;
                    window.hasUnsavedDisposalConfigChanges = true;
                    await window.saveCurrentDisposalUIState(); 
                    window.updateDisposalBuildGeometryButtonState(); 
                });
            }
        });

        if (typeof window.initGeometryDisposalListUI === 'function') {
            window.initGeometryDisposalListUI();
        }

        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const target = tab.getAttribute('data-target');
                
                if (typeof window.resetUnsavedDisposalColorChanges === 'function') {
                    window.resetUnsavedDisposalColorChanges();
                }

                if (typeof window.discardUnsavedDisposalConfigChanges === 'function') {
                    await window.discardUnsavedDisposalConfigChanges();
                }

                if (target === 'panel-geometry') {
                    setTimeout(() => {
                        if (typeof window.renderPendingPits === 'function') {
                            window.renderPendingPits();
                        }
                    }, 100);
                }
            });
        });

    }, 1000);
});