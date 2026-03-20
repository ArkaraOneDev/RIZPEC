// ==========================================
// RIZPEC DB (IndexedDB untuk Cache File Besar)
// ==========================================
const RizpecDB = {
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("RizpecDatabase", 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('pitData')) {
                    db.createObjectStore('pitData');
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    async set(key, value) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pitData', 'readwrite');
            tx.objectStore('pitData').put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    },
    async get(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pitData', 'readonly');
            const req = tx.objectStore('pitData').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },
    async remove(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('pitData', 'readwrite');
            tx.objectStore('pitData').delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }
};

// ==========================================
// FILE MENU STATE & UI UPDATES
// ==========================================
function updateFileMenuState() {
    // Kita cek seluruh kemungkinan data: CSV, DXF, Mesh, ATAU NAMA PROJECT aktif
    const hasCSV = typeof globalParsedData !== 'undefined' && globalParsedData !== null;
    const hasMeshes = typeof meshes !== 'undefined' && Object.keys(meshes).length > 0;
    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
    const hasDXF = dxfLayers.length > 0;
    
    // Pastikan jika project sudah di New/Load, tombol Save AKAN AKTIF
    const hasProjectName = typeof window.currentProjectName === 'string' && window.currentProjectName.trim() !== '' && window.currentProjectName !== 'Untitled';
    
    const isEmpty = !(hasCSV || hasDXF || hasMeshes || hasProjectName);
    
    const btnSave = document.getElementById('btn-sidebar-save');
    const btnExport = Array.from(document.querySelectorAll('.dropdown-content a')).find(el => el.textContent && el.textContent.trim() === 'Export');
    
    const toggleElement = (el, disable) => {
        if (!el) return;
        if (disable) {
            el.style.opacity = '0.4';
            el.style.pointerEvents = 'none';
        } else {
            el.style.opacity = ''; 
            el.style.pointerEvents = 'auto';
        }
    };
    
    if(btnSave) {
        if (isEmpty) {
            btnSave.style.opacity = '0.4';
            btnSave.style.pointerEvents = 'none';
            btnSave.classList.remove('hover:bg-blue-500', 'cursor-pointer');
        } else {
            btnSave.style.opacity = '1';
            btnSave.style.pointerEvents = 'auto';
            btnSave.classList.add('hover:bg-blue-500', 'cursor-pointer');
        }
    }
    
    // Untuk ekspor, pastikan harus ada mesh/data real untuk diekspor
    const canExport = hasCSV || hasDXF || hasMeshes;
    toggleElement(btnExport, !canExport);
}

// ==============================================================
// PEMBERSIHAN STATE TOTAL (NEW PROJECT YA DIKLIK)
// ==============================================================
window.resetFileTabForNewProject = async function() {
    window.currentProjectName = ""; 
    window.pitStates = {};
    window.activePitId = null;
    window.lastActivePitId = null;
    window.clearAllFoldersUI();

    const inputs = ['mining-reserve-file', 'reformat-file-input', 'file-input-dxf'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    if (typeof resetFullProject === 'function') resetFullProject(); 
    if (typeof window.renderGeometryPreview === 'function') window.renderGeometryPreview(null, null);

    try {
        const db = await RizpecDB.init();
        const tx = db.transaction('pitData', 'readwrite');
        tx.objectStore('pitData').clear();
    } catch(e) {}

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('rizpec_') || key.startsWith('rk_'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    if (typeof window.updateTabLockState === 'function') window.updateTabLockState();
    if (typeof updateFileMenuState === 'function') updateFileMenuState();
    if (typeof window.initGeometryPitListUI === 'function') window.initGeometryPitListUI();
};

// ==========================================
// DXF IMPORTER LOGIC
// ==========================================
const fileInputDxf = document.getElementById('file-input-dxf');

if (fileInputDxf) {
    fileInputDxf.addEventListener('click', async (e) => {
        if (window.showOpenFilePicker) {
            e.preventDefault(); 
            document.querySelectorAll('.dropdown-content').forEach(dc => dc.classList.add('hidden'));
            
            const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
            if (dxfLayers.length >= 5) {
                alert("Maksimal 5 layer DXF telah tercapai. Hapus layer yang ada terlebih dahulu.");
                return;
            }

            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    id: 'rk-dxf-dir', 
                    startIn: 'documents',
                    types: [{ description: 'AutoCAD DXF File', accept: {'image/vnd.dxf': ['.dxf'], 'application/dxf': ['.dxf'], 'text/plain': ['.dxf']} }]
                });
                const file = await fileHandle.getFile();
                const reader = new FileReader();
                reader.onload = (event) => { processDXF(event.target.result, file.name); };
                reader.readAsText(file);
            } catch (err) {
                if (err.name !== 'AbortError') console.warn(err);
            }
        }
    });

    fileInputDxf.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
        if (dxfLayers.length >= 5) {
            alert("Maksimal 5 layer DXF telah tercapai. Hapus layer yang ada terlebih dahulu.");
            return;
        }
        if (!window.DxfParser) { alert("Library DXF Parser belum dimuat dengan sempurna."); return; }

        const reader = new FileReader();
        reader.onload = (event) => {
            processDXF(event.target.result, file.name);
            fileInputDxf.value = ''; 
        };
        reader.onerror = () => alert("Gagal membaca file DXF.");
        reader.readAsText(file);
    });
}

setTimeout(updateFileMenuState, 200);

// ==========================================
// FILE & FOLDER EXPLORER LOGIC (Tab File)
// ==========================================

const folderState = {
    'Pit Data': 0, 'Disposal Data': 0, 'Haulage Data': 0, 'Production Data': 0, 'DXF Data': 0
};

window.selectFolder = function(name, type = 'Root Folder', rootName = name) {
    const emptyView = document.getElementById('file-summary-empty');
    const contentView = document.getElementById('file-summary-content');
    
    if (emptyView && contentView) {
        emptyView.classList.add('hidden');
        contentView.classList.remove('hidden');
        contentView.classList.add('flex');
        
        document.getElementById('summary-name').textContent = name;
        document.getElementById('summary-type').textContent = type;
        document.getElementById('summary-path').textContent = type === 'Root Folder' ? `Root / ${name}` : `Root / ${rootName} / ${name}`;
        
        const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('summary-date').textContent = date;
        
        if (type === 'Root Folder') {
            document.getElementById('summary-count-label').innerHTML = '<i class="fa-solid fa-folder mr-1"></i> Subfolders';
            document.getElementById('summary-count').textContent = folderState[rootName] + ' Folders';
        } else {
            document.getElementById('summary-count-label').innerHTML = '<i class="fa-solid fa-file-lines mr-1"></i> Baris / Objek';
            document.getElementById('summary-count').textContent = Math.floor(Math.random() * 5000) + 100;
        }

        const panelEmpty = document.getElementById('settings-empty');
        const panelCsv = document.getElementById('settings-csv');
        const panelDxf = document.getElementById('settings-dxf');

        if (panelEmpty) { panelEmpty.classList.add('hidden'); panelEmpty.classList.remove('flex'); }
        if (panelCsv) { panelCsv.classList.add('hidden'); panelCsv.classList.remove('flex'); }
        if (panelDxf) { panelDxf.classList.add('hidden'); panelDxf.classList.remove('flex'); }

        if (type === 'Root Folder') {
            if (panelEmpty) {
                panelEmpty.classList.remove('hidden');
                panelEmpty.classList.add('flex');
            }
        } else {
            if (rootName === 'DXF Data') {
                if (panelDxf) {
                    panelDxf.classList.remove('hidden');
                    panelDxf.classList.add('flex');
                    document.getElementById('dxf-info-name').textContent = name;
                    document.getElementById('dxf-info-size').textContent = (Math.random() * 5 + 1).toFixed(2) + ' MB';
                    document.getElementById('dxf-info-type').textContent = Math.random() > 0.3 ? 'Polymesh 3D' : 'Lines/Polylines';
                    document.getElementById('dxf-info-texture').textContent = 'None';
                }
            } else {
                if (panelCsv) {
                    panelCsv.classList.remove('hidden');
                    panelCsv.classList.add('flex');
                }
            }
        }
        
        if (typeof window.onFolderSelected === 'function') {
            window.onFolderSelected(name, type, rootName);
        }
    }
};

window.addSubfolder = function(parentId, rootName) {
    if (folderState[rootName] >= 5) {
        alert(`Batas maksimal 5 subfolder untuk ${rootName} telah tercapai.`);
        return;
    }
    
    const container = document.getElementById(`subfolders-${parentId}`);
    if (!container) return;
    
    const subEl = document.createElement('div');
    subEl.className = "flex items-center justify-between p-2 bg-slate-800/40 border-l-2 border-blue-500/30 rounded-r text-slate-300 text-[11px] shadow-sm";
    
    const leftWrapper = document.createElement('div');
    leftWrapper.className = "flex items-center gap-2.5 overflow-hidden w-full";
    leftWrapper.innerHTML = `<i class="fa-regular fa-folder-open text-slate-400 shrink-0"></i>`;
    
    const input = document.createElement('input');
    input.type = "text";
    input.value = "New Folder";
    input.className = "bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white text-[11px] outline-none focus:border-blue-500 w-[120px] flex-1";
    
    leftWrapper.appendChild(input);
    subEl.appendChild(leftWrapper);
    container.appendChild(subEl);
    
    input.focus();
    input.select();
    
    let isSaved = false;
    
    const saveEdit = () => {
        if (isSaved) return;
        isSaved = true;
        const finalName = input.value.trim();
        
        if (!finalName || finalName === "New Folder") {
            subEl.remove();
            return;
        }
        
        folderState[rootName]++;
        window.makeSubfolderInteractive(subEl, finalName, rootName);
        
        if (rootName === 'Pit Data') {
            setTimeout(() => subEl.click(), 10);
        }
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') { input.value = ''; saveEdit(); }
    });
};

window.makeSubfolderInteractive = function(subEl, name, rootName) {
    subEl.className = "flex items-center justify-between p-2 bg-slate-800/40 hover:bg-slate-700/80 border-l-2 border-blue-500/30 hover:border-blue-500 rounded-r cursor-pointer text-slate-300 hover:text-white text-[11px] transition-all shadow-sm group";
    
    let badgeHTML = '';
    if (rootName === 'Pit Data') {
        const savedMethod = localStorage.getItem(`rizpec_build_type_${name.replace(/\s+/g, '_')}`);
        if (savedMethod === 'CEN') {
            badgeHTML = '<span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">CEN</span>';
        } else if (savedMethod === 'NON_CEN') {
            badgeHTML = '<span class="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">NON_CEN</span>';
        }
    }

    subEl.innerHTML = `
        <div class="flex items-center gap-2.5 overflow-hidden w-full">
            <i class="fa-regular fa-folder-open text-slate-400 shrink-0"></i>
            <span class="truncate font-medium folder-name-text">${name}</span>
        </div>
        <div class="flex items-center shrink-0 gap-1.5">
            <div class="geometry-badge-container flex items-center">
                ${badgeHTML}
            </div>
            <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button class="rename-btn text-slate-500 hover:text-blue-400 px-1" title="Rename">
                    <i class="fa-solid fa-pen text-[10px]"></i>
                </button>
                <button class="delete-btn text-slate-500 hover:text-red-400 px-1" title="Delete">
                    <i class="fa-solid fa-trash text-[10px]"></i>
                </button>
            </div>
        </div>
    `;
    
    subEl.onclick = (e) => {
        e.stopPropagation();
        window.selectFolder(name, 'Subfolder', rootName);
    };
    
    const renameBtn = subEl.querySelector('.rename-btn');
    renameBtn.onclick = (e) => {
        e.stopPropagation();
        subEl.className = "flex items-center justify-between p-2 bg-slate-800/40 border-l-2 border-blue-500/30 rounded-r text-slate-300 text-[11px] shadow-sm";
        subEl.onclick = null;
        
        subEl.innerHTML = `
            <div class="flex items-center gap-2.5 overflow-hidden w-full">
                <i class="fa-regular fa-folder-open text-slate-400 shrink-0"></i>
                <input type="text" class="rename-input bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-white text-[11px] outline-none focus:border-blue-500 flex-1 min-w-0" value="${name}">
            </div>
        `;
        
        const input = subEl.querySelector('.rename-input');
        input.focus();
        input.select();
        
        let isSaved = false;
        const saveRename = () => {
            if (isSaved) return;
            isSaved = true;
            const finalName = input.value.trim() || name;
            if (typeof window.onFolderRenamed === 'function' && name !== finalName) window.onFolderRenamed(name, finalName, rootName);
            window.makeSubfolderInteractive(subEl, finalName, rootName);
            
            const summaryName = document.getElementById('summary-name');
            if (summaryName && summaryName.textContent === name) window.selectFolder(finalName, 'Subfolder', rootName);
        };
        
        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') saveRename(); 
        });
    };

    const deleteBtn = subEl.querySelector('.delete-btn');
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Apakah Anda yakin ingin menghapus subfolder "${name}"?`)) {
            if (typeof window.onFolderDeleted === 'function') window.onFolderDeleted(name, rootName);
            subEl.remove();
            folderState[rootName]--;
            
            const summaryName = document.getElementById('summary-name');
            if (summaryName && summaryName.textContent === name) {
                const emptyView = document.getElementById('file-summary-empty');
                const contentView = document.getElementById('file-summary-content');
                if (emptyView && contentView) {
                    emptyView.classList.remove('hidden');
                    contentView.classList.add('hidden');
                    contentView.classList.remove('flex');
                }
            }
        }
    };
}

window.updateFolderBadge = function(pitId, method) {
    const container = document.getElementById('subfolders-folder-pit');
    if (!container) return;
    const folders = container.querySelectorAll('.folder-name-text');
    for (let span of folders) {
        if (span.textContent === pitId) {
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

window.clearAllFoldersUI = function() {
    for (let key in folderState) folderState[key] = 0;
    const containers = ['folder-pit', 'folder-disp', 'folder-haul', 'folder-prod', 'folder-dxf'];
    containers.forEach(id => {
        const el = document.getElementById(`subfolders-${id}`);
        if (el) el.innerHTML = '';
    });
    
    const emptyView = document.getElementById('file-summary-empty');
    const contentView = document.getElementById('file-summary-content');
    if (emptyView && contentView) {
        emptyView.classList.remove('hidden');
        contentView.classList.add('hidden');
        contentView.classList.remove('flex');
    }
};

window.restoreDxfFolderUI = function(fileName) {
    const rootName = 'DXF Data';
    const parentId = 'folder-dxf';
    
    if (folderState[rootName] !== undefined && folderState[rootName] < 5) {
        const container = document.getElementById(`subfolders-${parentId}`);
        if (container) {
            const existingNames = Array.from(container.querySelectorAll('.folder-name-text')).map(el => el.textContent);
            if (existingNames.includes(fileName)) return; 
            
            folderState[rootName]++;
            const subEl = document.createElement('div');
            container.appendChild(subEl);
            window.makeSubfolderInteractive(subEl, fileName, rootName);
        }
    }
};

const originalProcessDXF = typeof processDXF === 'function' ? processDXF : null;
window.processDXF = function(dxfText, fileName) {
    if(originalProcessDXF) originalProcessDXF(dxfText, fileName);
    
    const rootName = 'DXF Data';
    const parentId = 'folder-dxf';
    
    if (typeof folderState !== 'undefined' && folderState[rootName] !== undefined && folderState[rootName] < 5) {
        folderState[rootName]++;
        const container = document.getElementById(`subfolders-${parentId}`);
        if (container && typeof window.makeSubfolderInteractive === 'function') {
            const subEl = document.createElement('div');
            container.appendChild(subEl);
            window.makeSubfolderInteractive(subEl, fileName, rootName);
            if (typeof window.selectFolder === 'function') {
                window.selectFolder(fileName, `${rootName} Subfolder`, rootName);
            }
        }
    }
};

// ==============================================================
// UI STATE MANAGEMENT (Pit Data Subfolders & CSV Setting)
// ==============================================================

window.pitStates = {};
window.activePitId = null;
window.lastActivePitId = null;

window.savePitStatsToStorage = function(pitId) {
    if (!pitId || !window.pitStates[pitId]) return;
    const st = window.pitStates[pitId];
    const stats = {
        mrSize: st.mrStats.size || 0,
        mrRows: st.mrStats.rows || 0,
        refSize: st.refStats.size || 0,
        refRows: st.refStats.rows || 0,
        neText: st.neStats.text || '0.00 MB (0 Block Computed)'
    };
    localStorage.setItem(`rizpec_entity_${pitId.replace(/\s+/g, '_')}_stats`, JSON.stringify(stats));
};

window.updateBuildGeometryButtonState = function() {
    if (!window.activePitId) return;
    const state = window.pitStates[window.activePitId];
    const btn = document.getElementById('btn-build-geometry');
    const neFilenameEl = document.getElementById('new-entity-filename');
    if (!btn) return;

    const isMrReal = state.mrFile && state.mrFile.size !== undefined;
    const isRefReal = state.refFile && state.refFile.size !== undefined;
    const hasMRPlaceholder = state.mrFile && !isMrReal;
    const isBuilt = state.generatedCsv !== null || (neFilenameEl && neFilenameEl.textContent !== "Build Geometry terlebih dahulu");

    const typeKey = `rizpec_build_type_${window.activePitId.replace(/\s+/g, '_')}`;
    const buildMethod = localStorage.getItem(typeKey) || 'NON_CEN';

    const delimBlock = state.substrings['delim-block'];
    const delimStrip = state.substrings['delim-strip'];
    const delimBench = state.substrings['delim-bench'];
    
    const isValidFormat = (val) => /^\d+,\d+$/.test(val ? val.trim() : "");
    const areSubstringsFilled = isValidFormat(delimBlock) && isValidFormat(delimStrip) && isValidFormat(delimBench);

    const isFilled = (val) => val && val.trim() !== "";
    const areColsFilled = isFilled(state.cols['col-blockname']) && isFilled(state.cols['col-bench']);

    const isAllMandatoryFilled = areSubstringsFilled && areColsFilled;

    if ((isMrReal || (hasMRPlaceholder && !isBuilt)) && !isAllMandatoryFilled) {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Build Geometry';
        btn.disabled = true;
        btn.className = "mt-1 w-full bg-slate-700 text-slate-400 py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-not-allowed";
        btn.title = !areColsFilled ? "Pilih kolom wajib (*) terlebih dahulu." : "Format Substring wajib Lengkap (Angka,Angka). Contoh: 1,4";
    } else if (isBuilt && isRefReal && !state.refFileApplied) {
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Apply Pro-Rata';
        btn.disabled = false;
        btn.className = "mt-1 w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
        btn.title = "Terapkan Reformat Interval ke Geometri di Background.";
    } else if (isBuilt && !isRefReal && buildMethod === 'CEN') {
        btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reset Geometry';
        btn.disabled = false;
        btn.className = "mt-1 w-full bg-rose-600 hover:bg-rose-500 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer";
        btn.title = "Kembalikan ke state awal (Mining Reserve) di Background.";
    } else if (isBuilt && ((!isRefReal && buildMethod === 'NON_CEN') || (isRefReal && state.refFileApplied && buildMethod === 'CEN'))) {
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
};

window.saveCurrentUIState = function() {
    if (!window.activePitId || !window.pitStates[window.activePitId]) return;
    const state = window.pitStates[window.activePitId];
    
    const colIds = ['col-blockname', 'col-bench', 'col-subset', 'col-seam', 'col-waste', 'col-resource', 'col-waste-thickness', 'col-resource-thickness', 'col-quality-from', 'col-quality-to', 'col-recon-waste', 'col-recon-resource'];
    colIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) state.cols[id] = el.value;
    });

    const subIds = ['delim-block', 'delim-strip', 'delim-bench'];
    subIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) state.substrings[id] = el.value;
    });
};

function initPitState(pitId) {
    if (window.pitStates[pitId]) return;

    let inheritedCols = {};
    let inheritedSubs = {};
    if (window.lastActivePitId && window.pitStates[window.lastActivePitId]) {
        inheritedCols = { ...window.pitStates[window.lastActivePitId].cols };
        inheritedSubs = { ...window.pitStates[window.lastActivePitId].substrings };
    }

    window.pitStates[pitId] = {
        mrFile: null,
        refFile: null,
        refFileApplied: false, 
        generatedCsv: null, 
        summaryObj: null,
        originalSummaryObj: null, 
        mrStats: { text: '0.00 MB (0 Row)', rows: 0, cols: 0, size: 0 },
        refStats: { text: '0.00 MB (0 Row)', rows: 0, cols: 0, size: 0 },
        neStats: { text: '0.00 MB (0 Block Computed)', rows: 0, cols: 0, size: 0 }, 
        cols: inheritedCols,
        substrings: inheritedSubs,
        mrHeaders: [],
        refHeaders: []
    };
}

async function restoreUIState(pitId) {
    const state = window.pitStates[pitId];
    if (!state) return;

    const safeId = pitId.replace(/\s+/g, '_');
    const statsStr = localStorage.getItem(`rizpec_entity_${safeId}_stats`);
    if (statsStr) {
        try {
            const st = JSON.parse(statsStr);
            state.mrStats = { text: `${(st.mrSize/(1024*1024)).toFixed(2)} MB (${st.mrRows} Row)`, size: st.mrSize, rows: st.mrRows, cols: 0 };
            state.refStats = { text: `${(st.refSize/(1024*1024)).toFixed(2)} MB (${st.refRows} Row)`, size: st.refSize, rows: st.refRows, cols: 0 };
            state.neStats = { text: st.neText || '0.00 MB (0 Block Computed)' };
        } catch(e) {}
    }

    const localStorageKey = `rizpec_entity_${safeId}`;
    const typeKey = `rizpec_build_type_${safeId}`;
    const buildMethod = localStorage.getItem(typeKey) || 'NON_CEN';

    if (!state.generatedCsv) {
        try {
            const savedCsv = await RizpecDB.get(localStorageKey);
            if (savedCsv) state.generatedCsv = savedCsv;
        } catch(e) {}
    }
    if (!state.summaryObj) {
        const summaryStr = localStorage.getItem(localStorageKey + '_summary');
        if (summaryStr) {
            try { state.summaryObj = JSON.parse(summaryStr); } catch(e){}
        }
    }

    const mrFileEl = document.getElementById('mining-reserve-filename');
    const mrClearBtn = document.getElementById('clear-mining-reserve');
    if (state.mrFile) {
        mrFileEl.textContent = state.mrFile.name;
        mrFileEl.classList.replace('text-slate-500', 'text-blue-400');
        mrFileEl.classList.remove('italic');
        mrClearBtn.disabled = false;
    } else {
        mrFileEl.textContent = 'Tidak ada file...';
        mrFileEl.classList.replace('text-blue-400', 'text-slate-500');
        mrFileEl.classList.add('italic');
        mrClearBtn.disabled = true;
    }

    const refFileEl = document.getElementById('reformat-filename');
    const refClearBtn = document.getElementById('clear-reformat-file');
    if (state.refFile) {
        refFileEl.textContent = state.refFile.name;
        refFileEl.classList.replace('text-slate-500', 'text-blue-400');
        refFileEl.classList.remove('italic');
        refClearBtn.disabled = false;
    } else {
        refFileEl.textContent = 'Tidak ada file...';
        refFileEl.classList.replace('text-blue-400', 'text-slate-500');
        refFileEl.classList.add('italic');
        refClearBtn.disabled = true;
    }
    
    if (state.refFile && buildMethod === 'CEN') state.refFileApplied = true;
    else state.refFileApplied = false;

    const mrStatUI = document.getElementById('stat-mining-reserve');
    const refStatUI = document.getElementById('stat-reformat-interval');
    const neStatUI = document.getElementById('stat-new-entity');
    
    if(mrStatUI) mrStatUI.textContent = state.mrStats.text;
    if(refStatUI) refStatUI.textContent = state.refStats.text;
    if(neStatUI) neStatUI.textContent = state.neStats.text;

    const subIds = ['delim-block', 'delim-strip', 'delim-bench'];
    subIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.substrings[id] || '';
    });

    window.populateColumnDropdowns(state.mrHeaders || [], 'mr');
    window.populateColumnDropdowns(state.refHeaders || [], 'ref');
    
    const newEntityNameEl = document.getElementById('new-entity-filename');
    if (newEntityNameEl) {
        if (state.neStats && state.neStats.text !== '0.00 MB (0 Block Computed)' && !state.neStats.text.includes('0 Block')) {
            newEntityNameEl.textContent = pitId + "_Geometry";
            newEntityNameEl.classList.replace('text-slate-500', 'text-blue-400');
            newEntityNameEl.classList.remove('italic');
        } else {
            newEntityNameEl.textContent = "Build Geometry terlebih dahulu";
            newEntityNameEl.classList.replace('text-blue-400', 'text-slate-500');
            newEntityNameEl.classList.add('italic');
        }
    }
    
    const mrInput = document.getElementById('mining-reserve-file');
    const refInput = document.getElementById('reformat-file-input');
    if (mrInput) mrInput.value = '';
    if (refInput) refInput.value = '';

    window.updateBuildGeometryButtonState();

    if (typeof window.renderGeometryPreview === 'function') {
        window.renderGeometryPreview(state.generatedCsv, state.summaryObj, buildMethod);
    }
}

// >>> FUNGSI AGREGASI KESELURUHAN (GLOBAL SUMMARY) <<<
window.aggregateAllPitData = function() {
    const pitContainer = document.getElementById('subfolders-folder-pit');
    if (!pitContainer) return;
    const pitElements = pitContainer.querySelectorAll('.folder-name-text');
    const pitNames = Array.from(pitElements).map(el => el.textContent);
    
    if (pitNames.length === 0) {
         const mrStatUI = document.getElementById('stat-mining-reserve');
         if (mrStatUI) mrStatUI.textContent = `0.00 MB (0 Row)`;
         const refStatUI = document.getElementById('stat-reformat-interval');
         if (refStatUI) refStatUI.textContent = `0.00 MB (0 Row)`;
         const neStatUI = document.getElementById('stat-new-entity');
         if (neStatUI) neStatUI.textContent = `0.00 MB (0 Block Computed)`;
         if (typeof window.renderGeometryPreview === 'function') {
             window.renderGeometryPreview(null, null, '', false, true);
         }
         return;
    }
    
    let totalMrSize = 0, totalMrRows = 0;
    let totalRefSize = 0, totalRefRows = 0;
    let totalVram = 0, totalBlocks = 0;
    
    let sumWaste = 0;
    let sumResource = 0;
    
    let allHulls = [];
    let globalBounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    let hasBounds = false;

    for (let pit of pitNames) {
        const safeId = pit.replace(/\s+/g, '_');
        
        // 1. Ambil Stats Info
        const statsStr = localStorage.getItem(`rizpec_entity_${safeId}_stats`);
        if (statsStr) {
            try {
                const st = JSON.parse(statsStr);
                totalMrSize += (st.mrSize || 0);
                totalMrRows += (st.mrRows || 0);
                totalRefSize += (st.refSize || 0);
                totalRefRows += (st.refRows || 0);
                
                if (st.neText) {
                    const match = st.neText.match(/([\d.]+)\s*MB\s*\(([\d]+)\s*Block/);
                    if (match) {
                        totalVram += parseFloat(match[1]) || 0;
                        totalBlocks += parseInt(match[2]) || 0;
                    }
                }
            } catch(e) {}
        }
        
        // 2. Ambil Geometri Bounds dan Total Volume
        const summaryStr = localStorage.getItem(`rizpec_entity_${safeId}_summary`);
        if (summaryStr) {
            try {
                const summary = JSON.parse(summaryStr);
                sumWaste += (summary.totalWaste || 0);
                sumResource += (summary.totalResource || 0);
                
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
            } catch(e) {}
        }
    }
    
    // Push ke UI
    const mrStatUI = document.getElementById('stat-mining-reserve');
    if (mrStatUI) mrStatUI.textContent = `${(totalMrSize/(1024*1024)).toFixed(2)} MB (${totalMrRows} Row)`;
    
    const refStatUI = document.getElementById('stat-reformat-interval');
    if (refStatUI) refStatUI.textContent = `${(totalRefSize/(1024*1024)).toFixed(2)} MB (${totalRefRows} Row)`;
    
    const neStatUI = document.getElementById('stat-new-entity');
    if (neStatUI) neStatUI.textContent = `${totalVram.toFixed(2)} MB (${totalBlocks} Block Computed)`;
    
    const combinedSummary = {
        totalWaste: sumWaste,
        totalResource: sumResource,
        previewHulls: allHulls.length > 0 ? allHulls : null,
        previewBounds: hasBounds ? globalBounds : null
    };
    
    if (typeof window.renderGeometryPreview === 'function') {
        window.renderGeometryPreview(null, combinedSummary, 'Agregasi', false, true);
    }
};

window.onFolderSelected = async function(name, type, rootName) {
    if (window.activePitId && window.activePitId !== name) {
        window.saveCurrentUIState();
        if (window.pitStates[window.activePitId]) {
            window.lastActivePitId = window.activePitId;
        }
    }

    if (rootName === 'Pit Data' && type !== 'Root Folder') {
        window.activePitId = name;
        initPitState(name);
        await restoreUIState(name);
    } else if (rootName === 'Pit Data' && type === 'Root Folder') {
        window.activePitId = null;
        if (typeof window.aggregateAllPitData === 'function') {
            window.aggregateAllPitData();
        }
    } else {
        window.activePitId = null;
    }

    // UI Toggling untuk Pit List Manager di Panel Kiri
    const container = document.getElementById('geometry-pit-manager');
    const settingsEmpty = document.getElementById('settings-empty');
    
    if (container) {
        if (rootName === 'Pit Data' && type === 'Root Folder') {
            container.classList.remove('hidden');
            container.classList.add('flex');
            
            if (settingsEmpty) {
                settingsEmpty.classList.add('hidden');
                settingsEmpty.classList.remove('flex');
            }
            
            if (typeof window.updateGeometryPitListUI === 'function') {
                window.updateGeometryPitListUI();
            }
        } else {
            container.classList.add('hidden');
            container.classList.remove('flex');
            
            if (type === 'Root Folder' && settingsEmpty) {
                settingsEmpty.classList.remove('hidden');
                settingsEmpty.classList.add('flex');
            }
        }
    }
};

window.onFolderRenamed = async function(oldName, newName, rootName) {
    if (rootName === 'Pit Data' && window.pitStates[oldName]) {
        window.pitStates[newName] = window.pitStates[oldName];
        delete window.pitStates[oldName];
        
        const oldKey = `rizpec_entity_${oldName.replace(/\s+/g, '_')}`;
        const newKey = `rizpec_entity_${newName.replace(/\s+/g, '_')}`;
        
        try {
            const dbData = await RizpecDB.get(oldKey);
            if (dbData) {
                await RizpecDB.set(newKey, dbData);
                await RizpecDB.remove(oldKey);
            }
        } catch(e) {}

        const oldSumKey = `rizpec_entity_${oldName.replace(/\s+/g, '_')}_summary`;
        const newSumKey = `rizpec_entity_${newName.replace(/\s+/g, '_')}_summary`;
        const sumData = localStorage.getItem(oldSumKey);
        if (sumData) {
            localStorage.setItem(newSumKey, sumData);
            localStorage.removeItem(oldSumKey);
        }
        
        const oldStatsKey = `rizpec_entity_${oldName.replace(/\s+/g, '_')}_stats`;
        const newStatsKey = `rizpec_entity_${newName.replace(/\s+/g, '_')}_stats`;
        const statsData = localStorage.getItem(oldStatsKey);
        if (statsData) {
            localStorage.setItem(newStatsKey, statsData);
            localStorage.removeItem(oldStatsKey);
        }
        
        const oldTypeKey = `rizpec_build_type_${oldName.replace(/\s+/g, '_')}`;
        const newTypeKey = `rizpec_build_type_${newName.replace(/\s+/g, '_')}`;
        const savedType = localStorage.getItem(oldTypeKey);
        if (savedType) {
            localStorage.setItem(newTypeKey, savedType);
            localStorage.removeItem(oldTypeKey);
        }

        if (window.activePitId === oldName) {
            window.activePitId = newName;
            const newEntityNameEl = document.getElementById('new-entity-filename');
            if (newEntityNameEl && newEntityNameEl.textContent !== "Build Geometry terlebih dahulu") {
                newEntityNameEl.textContent = newName + "_Geometry";
            }
        }
        if (window.lastActivePitId === oldName) window.lastActivePitId = newName;
        if (typeof window.updateGeometryPitListUI === 'function') window.updateGeometryPitListUI();
    }
};

window.onFolderDeleted = function(name, rootName) {
    if (rootName === 'Pit Data') {
        delete window.pitStates[name];
        
        RizpecDB.remove(`rizpec_entity_${name.replace(/\s+/g, '_')}`).catch(()=>{});
        
        localStorage.removeItem(`rizpec_entity_${name.replace(/\s+/g, '_')}_summary`);
        localStorage.removeItem(`rizpec_entity_${name.replace(/\s+/g, '_')}_stats`);
        localStorage.removeItem(`rizpec_build_type_${name.replace(/\s+/g, '_')}`);
        
        if (typeof window.unloadPitGeometry === 'function') window.unloadPitGeometry(name);
        if (typeof window.updateGeometryPitListUI === 'function') window.updateGeometryPitListUI();

        if (window.activePitId === name) window.activePitId = null;
        if (window.lastActivePitId === name) window.lastActivePitId = null;
        
        const summaryName = document.getElementById('summary-name');
        if (summaryName && summaryName.textContent === 'Pit Data') {
            if (typeof window.aggregateAllPitData === 'function') window.aggregateAllPitData();
        }
    }
};

setTimeout(() => {
    const seamEl = document.getElementById('col-seam');
    const subsetEl = document.getElementById('col-subset');
    if (seamEl && subsetEl) {
        const seamContainer = seamEl.parentElement;
        const subsetContainer = subsetEl.parentElement;
        subsetContainer.parentElement.insertBefore(seamContainer, subsetContainer);
    }

    const wasteEl = document.getElementById('col-waste');
    if (wasteEl) {
        const wasteContainer = wasteEl.parentElement;
        const spacer = document.querySelector('.border-t.border-slate-700\\/50.my-1');
        if (spacer && wasteContainer) {
            wasteContainer.parentElement.insertBefore(spacer, wasteContainer);
        }
    }

    const mandatoryIds = ['col-blockname', 'col-bench', 'delim-block', 'delim-strip', 'delim-bench'];
    mandatoryIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.previousElementSibling && !el.previousElementSibling.innerHTML.includes('text-red-500')) {
            el.previousElementSibling.innerHTML += ' <span class="text-red-500">*</span>';
        }
    });

    const allSettingIds = [
        'col-blockname', 'col-bench', 'col-subset', 'col-seam', 'col-waste', 'col-resource', 
        'col-waste-thickness', 'col-resource-thickness', 'col-quality-from', 'col-quality-to',
        'col-recon-waste', 'col-recon-resource', 'delim-block', 'delim-strip', 'delim-bench'
    ];
    
    allSettingIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => { window.saveCurrentUIState(); window.updateBuildGeometryButtonState(); });
            if (el.tagName === 'INPUT') el.addEventListener('input', () => { window.saveCurrentUIState(); window.updateBuildGeometryButtonState(); });
        }
    });
}, 800);

// ==============================================================
// SUB-FILE UPLOAD & CALCULATION LOGIC
// ==============================================================

function extractHeaders(file) {
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

function recalculateHeaders() {
    const state = window.pitStates[window.activePitId];
    if (!state) return;
    
    if (state.mrFile && state.mrFile.size !== undefined) {
        extractHeaders(state.mrFile).then(data => { 
            state.mrHeaders = data.headers; 
            window.populateColumnDropdowns(data.headers, 'mr', data.firstRow); 
        });
    } else if (!state.mrFile) {
        state.mrHeaders = [];
        window.populateColumnDropdowns([], 'mr', []);
    }

    if (state.refFile && state.refFile.size !== undefined) {
        extractHeaders(state.refFile).then(data => { 
            state.refHeaders = data.headers; 
            window.populateColumnDropdowns(data.headers, 'ref', data.firstRow); 
        });
    } else if (!state.refFile) {
        state.refHeaders = [];
        window.populateColumnDropdowns([], 'ref', []);
    }
}

window.populateColumnDropdowns = (headers, type = 'mr', firstRow = []) => {
    let selectIds = [];
    let autoFillMap = {};

    if (type === 'mr') {
        selectIds = [
            'col-blockname', 'col-bench', 'col-subset', 'col-seam', 'col-waste', 'col-resource',
            'col-waste-thickness', 'col-resource-thickness', 'col-quality-from', 'col-quality-to'
        ];
        
        autoFillMap = {
            'col-blockname': 'BLOCKNAME', 'col-bench': 'BENCH', 'col-subset': 'SUBSET', 'col-seam': 'SEAM',
            'col-waste': 'TOTALVOLUME', 'col-resource': 'RAWRECMASS', 'col-waste-thickness': 'TRUEVERTTHK', 'col-resource-thickness': 'TRUETHK'
        };
        
        if (headers.includes('BOTSURFACE')) {
            const idx = headers.indexOf('BOTSURFACE');
            if (idx + 1 < headers.length) autoFillMap['col-quality-from'] = headers[idx + 1];
        }
        if (headers.includes('LOSSVOL')) {
            const idx = headers.indexOf('LOSSVOL');
            if (idx - 1 >= 0) autoFillMap['col-quality-to'] = headers[idx - 1];
        }
    } else if (type === 'ref') {
        selectIds = ['col-recon-waste', 'col-recon-resource'];
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
        
        if (window.activePitId && window.pitStates[window.activePitId]) {
            savedVal = window.pitStates[window.activePitId].cols[selectEl.id];
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
    
    if (typeof window.saveCurrentUIState === 'function') window.saveCurrentUIState();
};

async function updateFileStats(file, type) {
    const state = window.pitStates[window.activePitId];
    const statEl = document.getElementById(type === 'mr' ? 'stat-mining-reserve' : 'stat-reformat-interval');
    
    if (type === 'mr') {
        state.neStats = { text: '0.00 MB (0 Block Computed)' };
        state.generatedCsv = null; 
        const neStatEl = document.getElementById('stat-new-entity');
        if (neStatEl) neStatEl.textContent = state.neStats.text;
        
        const neFilenameEl = document.getElementById('new-entity-filename');
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
        
        window.savePitStatsToStorage(window.activePitId);
        recalculateHeaders();
        window.updateBuildGeometryButtonState();
        return;
    }

    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    if (statEl) statEl.textContent = `${sizeMB} MB (Calculating...)`;

    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split(/\r?\n/).filter(l => l.trim() !== '');
        const rowCount = Math.max(0, lines.length - 1);
        const colCount = lines[0] ? lines[0].split(',').length : 0;
        const statText = `${sizeMB} MB (${rowCount} Row)`;
        
        if (statEl) statEl.textContent = statText;
        const statsObj = { text: statText, rows: rowCount, cols: colCount, size: file.size };
        
        if (type === 'mr') state.mrStats = statsObj;
        if (type === 'ref') state.refStats = statsObj;
        
        window.savePitStatsToStorage(window.activePitId);
        recalculateHeaders();
        window.updateBuildGeometryButtonState();
    };
    reader.readAsText(file);
}

const miningReserveInput = document.getElementById('mining-reserve-file');
if (miningReserveInput) {
    miningReserveInput.addEventListener('change', async (e) => {
        if (!window.activePitId) return;
        const file = e.target.files[0];
        window.pitStates[window.activePitId].mrFile = file || null;
        
        const filenameEl = document.getElementById('mining-reserve-filename');
        const clearBtn = document.getElementById('clear-mining-reserve');
        
        if (file) {
            if (filenameEl) {
                filenameEl.textContent = file.name;
                filenameEl.classList.replace('text-slate-500', 'text-blue-400');
                filenameEl.classList.remove('italic');
            }
            if (clearBtn) clearBtn.disabled = false;
            await updateFileStats(file, 'mr');
        }
    });
}

const reformatFileInput = document.getElementById('reformat-file-input');
if (reformatFileInput) {
    reformatFileInput.addEventListener('change', async (e) => {
        if (!window.activePitId) return;
        const file = e.target.files[0];
        window.pitStates[window.activePitId].refFile = file || null;
        if (file) window.pitStates[window.activePitId].refFileApplied = false;
        
        const filenameEl = document.getElementById('reformat-filename');
        const clearBtn = document.getElementById('clear-reformat-file');
        
        if (file) {
            if (filenameEl) {
                filenameEl.textContent = file.name;
                filenameEl.classList.replace('text-slate-500', 'text-blue-400');
                filenameEl.classList.remove('italic');
            }
            if (clearBtn) clearBtn.disabled = false;
            await updateFileStats(file, 'ref');
        }
    });
}

const clearMiningBtn = document.getElementById('clear-mining-reserve');
if (clearMiningBtn) {
    clearMiningBtn.addEventListener('click', () => {
        if (!window.activePitId) return;
        const state = window.pitStates[window.activePitId];
        
        state.mrFile = null;
        const filenameEl = document.getElementById('mining-reserve-filename');
        
        if (filenameEl) {
            filenameEl.textContent = 'Tidak ada file...';
            filenameEl.classList.replace('text-blue-400', 'text-slate-500');
            filenameEl.classList.add('italic');
        }
        clearMiningBtn.disabled = true;
        
        state.generatedCsv = null;
        state.summaryObj = null;
        state.originalSummaryObj = null;
        state.neStats = { text: '0.00 MB (0 Block Computed)', rows: 0, cols: 0, size: 0 };
        
        const neFilenameEl = document.getElementById('new-entity-filename');
        if (neFilenameEl) {
            neFilenameEl.textContent = "Build Geometry terlebih dahulu";
            neFilenameEl.classList.replace('text-blue-400', 'text-slate-500');
            neFilenameEl.classList.add('italic');
        }

        const safePitId = window.activePitId.replace(/\s+/g, '_');
        RizpecDB.remove(`rizpec_entity_${safePitId}`).catch(()=>{});
        localStorage.removeItem(`rizpec_entity_${safePitId}_summary`);
        localStorage.removeItem(`rizpec_build_type_${safePitId}`);

        updateFileStats(null, 'mr'); 
        window.savePitStatsToStorage(window.activePitId);
        
        const mrInput = document.getElementById('mining-reserve-file');
        if (mrInput) mrInput.value = '';

        if (typeof window.renderGeometryPreview === 'function') window.renderGeometryPreview(null, null);
        if (typeof window.unloadPitGeometry === 'function') window.unloadPitGeometry(window.activePitId);
        if (typeof window.updateGeometryPitListUI === 'function') window.updateGeometryPitListUI();
        if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
    });
}

const clearReformatBtn = document.getElementById('clear-reformat-file');
if (clearReformatBtn) {
    clearReformatBtn.addEventListener('click', () => {
        if (!window.activePitId) return;
        const state = window.pitStates[window.activePitId];
        state.refFile = null;
        state.refFileApplied = false; 
        const filenameEl = document.getElementById('reformat-filename');
        
        if (filenameEl) {
            filenameEl.textContent = 'Tidak ada file...';
            filenameEl.classList.replace('text-blue-400', 'text-slate-500');
            filenameEl.classList.add('italic');
        }
        clearReformatBtn.disabled = true;
        
        state.cols['col-recon-waste'] = '';
        state.cols['col-recon-resource'] = '';
        const ddWaste = document.getElementById('col-recon-waste');
        const ddRes = document.getElementById('col-recon-resource');
        if (ddWaste) ddWaste.value = '';
        if (ddRes) ddRes.value = '';
        
        if (typeof window.saveCurrentUIState === 'function') window.saveCurrentUIState();
        
        updateFileStats(null, 'ref'); 
        window.savePitStatsToStorage(window.activePitId);
        
        const refInput = document.getElementById('reformat-file-input');
        if (refInput) refInput.value = '';
    });
}

// ==============================================================
// BUILD GEOMETRY PROCESSING LOGIC (Global Pro-Rata Agregasi)
// ==============================================================
const btnBuildGeometry = document.getElementById('btn-build-geometry');
const statNewEntity = document.getElementById('stat-new-entity');

if (btnBuildGeometry) {
    btnBuildGeometry.addEventListener('click', async () => {
        if (typeof window.saveCurrentUIState === 'function') window.saveCurrentUIState();

        const state = window.pitStates[window.activePitId];
        if (!state) return;

        const mrFile = state.mrFile;
        const refFile = state.refFile;

        btnBuildGeometry.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        btnBuildGeometry.disabled = true;
        btnBuildGeometry.className = "mt-1 w-full bg-blue-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-wait";
        
        if (statNewEntity) statNewEntity.textContent = 'Processing Data...';

        // Tampilkan Overlay Loading sebelum mulai processing berat
        if (typeof showFullscreenLoading === 'function') {
            showFullscreenLoading("Membangun 3D Geometry...");
            // Lepas sementara UI ke Browser agar animasi Loading memutar dan sinkron
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        try {
            // Membaca Raw Data
            const readAsText = (file) => new Promise((resolve, reject) => {
                if(!file) return resolve("");
                if(file.size === undefined) return reject(new Error("File fisik hilang. Harap upload ulang CSV untuk memproses geometri baru."));
                
                const r = new FileReader();
                r.onload = e => resolve(e.target.result);
                r.onerror = () => reject(new Error("Gagal membaca file CSV"));
                r.readAsText(file);
            });

            const mrText = await readAsText(mrFile);
            const refText = await readAsText(refFile);

            const mrLines = mrText.split(/\r?\n/).filter(l => l.trim() !== '');
            const refLines = refText.split(/\r?\n/).filter(l => l.trim() !== '');

            const mrHeaders = mrLines[0] ? mrLines[0].split(',').map(h => h.trim().toUpperCase()) : [];
            const refHeaders = refLines[0] ? refLines[0].split(',').map(h => h.trim().toUpperCase()) : [];

            // Mapping Kolom
            const mappedBlock = state.cols['col-blockname'];
            const mappedBench = state.cols['col-bench'];
            const mappedSeam = state.cols['col-seam']; 
            const mappedSubset = state.cols['col-subset'];
            const mappedWaste = state.cols['col-waste']; 
            const mappedResource = state.cols['col-resource']; 
            const mappedWasteThick = state.cols['col-waste-thickness'];
            const mappedResThick = state.cols['col-resource-thickness'];
            const mappedQualFrom = state.cols['col-quality-from'];
            const mappedQualTo = state.cols['col-quality-to'];
            const mappedReconWaste = state.cols['col-recon-waste']; 
            const mappedReconResource = state.cols['col-recon-resource']; 

            const delimBlock = state.substrings['delim-block'];
            const delimStrip = state.substrings['delim-strip'];
            const delimBench = state.substrings['delim-bench'];

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

            const mrIdxBlock = getIdx(mrHeaders, 'BLOCKNAME', mappedBlock);
            const mrIdxBench = getIdx(mrHeaders, 'BENCH', mappedBench);
            let mrIdxSeam = getIdx(mrHeaders, 'SEAM', 'INTERVAL');
            if (mrIdxSeam === -1) mrIdxSeam = getIdx(mrHeaders, mappedSeam, null); 
            const mrIdxSubset = getIdx(mrHeaders, 'SUBSET', mappedSubset);
            const mrIdxWaste = getIdx(mrHeaders, mappedWaste, null);
            const mrIdxResource = getIdx(mrHeaders, mappedResource, null);
            const mrIdxWasteThick = getIdx(mrHeaders, mappedWasteThick, null);
            const mrIdxResThick = getIdx(mrHeaders, mappedResThick, null);
            const mrIdxBurden = getIdx(mrHeaders, 'BURDEN', null);
            
            const qualityIndices = new Set();
            if (mappedQualFrom && mappedQualTo) {
                const idxFrom = mrHeaders.indexOf(mappedQualFrom.toUpperCase());
                const idxTo = mrHeaders.indexOf(mappedQualTo.toUpperCase());
                if (idxFrom !== -1 && idxTo !== -1) {
                    const start = Math.min(idxFrom, idxTo);
                    const end = Math.max(idxFrom, idxTo);
                    for (let i = start; i <= end; i++) qualityIndices.add(i);
                }
            }

            const mrKeepIndices = [];
            mrHeaders.forEach((h, i) => {
                if (qualityIndices.has(i) || i === mrIdxWasteThick || i === mrIdxResThick) return; 
                mrKeepIndices.push(i);
            });

            const refIdxWaste = getIdx(refHeaders, mappedReconWaste, 'WASTE');
            const refIdxResource = getIdx(refHeaders, mappedReconResource, 'RESOURCE');

            const cleanNum = (val) => parseFloat((val || '').toString().replace(/['",]/g, '')) || 0;

            // Kalkulasi Agregasi
            let globalRefWaste = 0, globalRefResource = 0;
            if (refFile) {
                for (let i = 1; i < refLines.length; i++) {
                    const cols = refLines[i].split(',');
                    if (cols.length < 2) continue;
                    if (refIdxWaste !== -1) globalRefWaste += cleanNum(cols[refIdxWaste]);
                    if (refIdxResource !== -1) globalRefResource += cleanNum(cols[refIdxResource]);
                }
            }

            let globalMRWaste = 0, globalMRResource = 0;
            const blocksMap = new Map();
            let validRowsCount = 0;
            
            for (let i = 1; i < mrLines.length; i++) {
                if (i === 1 || i === 2) continue; 
                const mrCols = mrLines[i].split(',');
                if (mrCols.length < 2) continue;
                
                validRowsCount++;

                const rawBlock = mrIdxBlock !== -1 ? (mrCols[mrIdxBlock] || '').trim() : '';
                const rawBench = mrIdxBench !== -1 ? (mrCols[mrIdxBench] || '').trim() : '';
                const rawSeam = mrIdxSeam !== -1 ? (mrCols[mrIdxSeam] || '').trim() : '';
                const rawSubset = mrIdxSubset !== -1 ? (mrCols[mrIdxSubset] || '').trim() : '';
                const rawBurden = mrIdxBurden !== -1 ? (mrCols[mrIdxBurden] || '').trim().toUpperCase() : '';
                
                const idPit = window.activePitId || '';
                const idBlock = delimBlock ? getSubstr(rawBlock, delimBlock) : rawBlock;
                const idStrip = delimStrip ? getSubstr(rawBlock, delimStrip) : rawBlock;
                const idBench = delimBench ? getSubstr(rawBench, delimBench) : rawBench;
                const compositeId = `${idPit}/${idBlock}/${idStrip}/${idBench}/${rawSeam}/${rawSubset}`;

                if (!blocksMap.has(compositeId)) {
                    blocksMap.set(compositeId, { wasteThickWt: 0, resThickWt: 0, sumWasteWeight: 0, sumResWeight: 0, qualities: {}, count: 0 });
                }

                const b = blocksMap.get(compositeId);
                let isResourceTriangle = false;
                
                if (rawBurden !== '') isResourceTriangle = (rawBurden === 'RESOURCE' || rawBurden === 'COAL');
                else if (mrIdxResource !== -1) isResourceTriangle = (cleanNum(mrCols[mrIdxResource]) > 0);

                let wVal = 0, rVal = 0;
                
                if (!isResourceTriangle) {
                    wVal = mrIdxWaste !== -1 ? cleanNum(mrCols[mrIdxWaste]) : 0;
                    globalMRWaste += wVal;
                    b.sumWasteWeight += (mrIdxWaste !== -1 ? wVal : 1);
                } else {
                    rVal = mrIdxResource !== -1 ? cleanNum(mrCols[mrIdxResource]) : 0;
                    globalMRResource += rVal;
                    b.sumResWeight += (mrIdxResource !== -1 ? rVal : 1);
                }

                const wtVal = mrIdxWasteThick !== -1 ? cleanNum(mrCols[mrIdxWasteThick]) : 0;
                const rtVal = mrIdxResThick !== -1 ? cleanNum(mrCols[mrIdxResThick]) : 0;

                if (!isResourceTriangle) b.wasteThickWt += (wtVal * (mrIdxWaste !== -1 ? wVal : 1));
                if (isResourceTriangle) b.resThickWt += (rtVal * (mrIdxResource !== -1 ? rVal : 1));

                if (isResourceTriangle) {
                    qualityIndices.forEach(qIdx => {
                        const qVal = cleanNum(mrCols[qIdx]);
                        if (!b.qualities[qIdx]) b.qualities[qIdx] = 0;
                        b.qualities[qIdx] += (qVal * (mrIdxResource !== -1 ? rVal : 1));
                    });
                }
                b.count++;
            }

            // Faktor Pro Rata (1 jika Reset/Awal, Faktor dari Ref jika Apply)
            const factorWaste = refFile ? (globalMRWaste > 0 ? (globalRefWaste / globalMRWaste) : 0) : 1;
            const factorResource = refFile ? (globalMRResource > 0 ? (globalRefResource / globalMRResource) : 0) : 1;

            const summaryObj = {
                totalWaste: globalMRWaste * factorWaste,
                totalResource: globalMRResource * factorResource,
                avgWasteThick: 0, minWasteThick: Infinity, maxWasteThick: -Infinity,
                avgResThick: 0, minResThick: Infinity, maxResThick: -Infinity,
                qualities: {}, previewHulls: null, previewBounds: null
            };
            
            state.originalSummaryObj = {
                totalWaste: globalMRWaste,
                totalResource: globalMRResource,
                avgWasteThick: 0, minWasteThick: Infinity, maxWasteThick: -Infinity,
                avgResThick: 0, minResThick: Infinity, maxResThick: -Infinity,
                qualities: {}
            };
            
            let gSumWThickWt = 0, gSumRThickWt = 0, gSumWWt = 0, gSumRWt = 0;
            let gQualWt = {}, qMinMax = {};
            qualityIndices.forEach(qIdx => qMinMax[qIdx] = { min: Infinity, max: -Infinity });

            blocksMap.forEach(b => {
                gSumWThickWt += b.wasteThickWt; gSumRThickWt += b.resThickWt;
                gSumWWt += b.sumWasteWeight; gSumRWt += b.sumResWeight;
                
                const bWtAvg = b.sumWasteWeight > 0 ? (b.wasteThickWt / b.sumWasteWeight) : 0;
                const bRtAvg = b.sumResWeight > 0 ? (b.resThickWt / b.sumResWeight) : 0;
                
                if (b.sumWasteWeight > 0 && bWtAvg > 0) {
                    if (bWtAvg < summaryObj.minWasteThick) summaryObj.minWasteThick = bWtAvg;
                    if (bWtAvg > summaryObj.maxWasteThick) summaryObj.maxWasteThick = bWtAvg;
                }
                if (b.sumResWeight > 0 && bRtAvg > 0) {
                    if (bRtAvg < summaryObj.minResThick) summaryObj.minResThick = bRtAvg;
                    if (bRtAvg > summaryObj.maxResThick) summaryObj.maxResThick = bRtAvg;
                }

                qualityIndices.forEach(qIdx => {
                    if (!gQualWt[qIdx]) gQualWt[qIdx] = 0;
                    gQualWt[qIdx] += b.qualities[qIdx] || 0;
                    const bQAvg = b.sumResWeight > 0 ? ((b.qualities[qIdx] || 0) / b.sumResWeight) : 0;
                    if (b.sumResWeight > 0 && bQAvg > 0) {
                        if (bQAvg < qMinMax[qIdx].min) qMinMax[qIdx].min = bQAvg;
                        if (bQAvg > qMinMax[qIdx].max) qMinMax[qIdx].max = bQAvg;
                    }
                });
            });

            summaryObj.avgWasteThick = gSumWWt > 0 ? (gSumWThickWt / gSumWWt) : 0;
            summaryObj.avgResThick = gSumRWt > 0 ? (gSumRThickWt / gSumRWt) : 0;
            
            if (summaryObj.minWasteThick === Infinity) summaryObj.minWasteThick = 0;
            if (summaryObj.maxWasteThick === -Infinity) summaryObj.maxWasteThick = 0;
            if (summaryObj.minResThick === Infinity) summaryObj.minResThick = 0;
            if (summaryObj.maxResThick === -Infinity) summaryObj.maxResThick = 0;
            
            qualityIndices.forEach(qIdx => {
                summaryObj.qualities[mrHeaders[qIdx]] = {
                    avg: gSumRWt > 0 ? (gQualWt[qIdx] / gSumRWt) : 0,
                    min: qMinMax[qIdx].min === Infinity ? 0 : qMinMax[qIdx].min,
                    max: qMinMax[qIdx].max === -Infinity ? 0 : qMinMax[qIdx].max
                };
            });

            state.summaryObj = summaryObj;
            state.originalSummaryObj.avgWasteThick = summaryObj.avgWasteThick;
            state.originalSummaryObj.avgResThick = summaryObj.avgResThick;
            state.originalSummaryObj.minWasteThick = summaryObj.minWasteThick;
            state.originalSummaryObj.maxWasteThick = summaryObj.maxWasteThick;
            state.originalSummaryObj.minResThick = summaryObj.minResThick;
            state.originalSummaryObj.maxResThick = summaryObj.maxResThick;
            state.originalSummaryObj.qualities = summaryObj.qualities;

            const newHeaders = [];
            mrKeepIndices.forEach(i => newHeaders.push(mrHeaders[i]));
            newHeaders.push("ID Pit", "ID Block", "ID Strip", "ID Bench", "ID Seam", "ID Subset");
            newHeaders.push("Waste Thickness", "Resource Thickness");
            qualityIndices.forEach(qIdx => newHeaders.push(mrHeaders[qIdx]));
            newHeaders.push("PRO_RATA_WASTE", "PRO_RATA_RESOURCE");
            
            let combinedLines = [newHeaders.join(',')];

            for (let i = 1; i < mrLines.length; i++) {
                if (i === 1 || i === 2) continue; 
                const mrCols = mrLines[i].split(',');
                if (mrCols.length < 2) continue;

                const rawBlock = mrIdxBlock !== -1 ? (mrCols[mrIdxBlock] || '').trim() : '';
                const rawBench = mrIdxBench !== -1 ? (mrCols[mrIdxBench] || '').trim() : '';
                const rawSeam = mrIdxSeam !== -1 ? (mrCols[mrIdxSeam] || '').trim() : '';
                const rawSubset = mrIdxSubset !== -1 ? (mrCols[mrIdxSubset] || '').trim() : '';
                const rawBurden = mrIdxBurden !== -1 ? (mrCols[mrIdxBurden] || '').trim().toUpperCase() : '';
                
                const idPit = window.activePitId || '';
                const idBlock = delimBlock ? getSubstr(rawBlock, delimBlock) : rawBlock;
                const idStrip = delimStrip ? getSubstr(rawBlock, delimStrip) : rawBlock;
                const idBench = delimBench ? getSubstr(rawBench, delimBench) : rawBench;
                const compositeId = `${idPit}/${idBlock}/${idStrip}/${idBench}/${rawSeam}/${rawSubset}`;
                const b = blocksMap.get(compositeId);
                const row = [];
                
                let isResourceTriangle = false;
                if (rawBurden !== '') isResourceTriangle = (rawBurden === 'RESOURCE' || rawBurden === 'COAL');
                else if (mrIdxResource !== -1) isResourceTriangle = (cleanNum(mrCols[mrIdxResource]) > 0);

                mrKeepIndices.forEach(idx => row.push(mrCols[idx] !== undefined ? mrCols[idx] : ''));

                const originalSeam = mrIdxSeam !== -1 && mrCols[mrIdxSeam] !== undefined ? mrCols[mrIdxSeam] : '';
                const originalSubset = mrIdxSubset !== -1 && mrCols[mrIdxSubset] !== undefined ? mrCols[mrIdxSubset] : '';
                row.push(idPit, compositeId, idStrip, idBench, originalSeam, originalSubset);

                if (b) {
                    const wtAvg = b.sumWasteWeight > 0 ? (b.wasteThickWt / b.sumWasteWeight) : 0;
                    row.push(wtAvg.toFixed(2));
                    const rtAvg = b.sumResWeight > 0 ? (b.resThickWt / b.sumResWeight) : 0;
                    row.push(rtAvg.toFixed(2));

                    qualityIndices.forEach(qIdx => {
                        const qAvg = b.sumResWeight > 0 ? (b.qualities[qIdx] / b.sumResWeight) : 0;
                        row.push(qAvg.toFixed(2));
                    });
                } else {
                    row.push("0", "0");
                    qualityIndices.forEach(() => row.push("0"));
                }

                let wVal = mrIdxWaste !== -1 ? cleanNum(mrCols[mrIdxWaste]) : 0;
                let rVal = mrIdxResource !== -1 ? cleanNum(mrCols[mrIdxResource]) : 0;
                let finalRowWaste = !isResourceTriangle ? wVal * factorWaste : 0;
                let finalRowResource = isResourceTriangle ? rVal * factorResource : 0;

                row.push(finalRowWaste.toFixed(4), finalRowResource.toFixed(4));
                combinedLines.push(row.join(','));
            }

            const combinedCsv = combinedLines.join('\n');
            const newRows = blocksMap.size;
            
            const memoryEstimateMB = (validRowsCount * 2560 / (1024 * 1024)).toFixed(2);
            const statResultText = `${memoryEstimateMB} MB (${newRows} Block Computed)`;
            
            state.generatedCsv = combinedCsv;
            const buildMethod = refFile ? 'CEN' : 'NON_CEN';
            const localStorageKey = `rizpec_entity_${window.activePitId.replace(/\s+/g, '_')}`;
            const typeKey = `rizpec_build_type_${window.activePitId.replace(/\s+/g, '_')}`;

            if (typeof window.renderGeometryPreview === 'function') {
                window.renderGeometryPreview(combinedCsv, state.summaryObj, buildMethod);
            }

            try {
                await RizpecDB.set(localStorageKey, combinedCsv);
                localStorage.setItem(localStorageKey + '_summary', JSON.stringify(state.summaryObj));
                localStorage.setItem(typeKey, buildMethod);
            } catch(e) {}

            if (statNewEntity) {
                statNewEntity.textContent = statResultText;
                state.neStats = { text: statResultText };
                window.savePitStatsToStorage(window.activePitId);
                statNewEntity.classList.add('text-emerald-400');
                setTimeout(() => statNewEntity.classList.remove('text-emerald-400'), 1500);
            }

            const neFilenameEl = document.getElementById('new-entity-filename');
            if (neFilenameEl) {
                neFilenameEl.textContent = `${window.activePitId}_Geometry`;
                neFilenameEl.classList.replace('text-slate-500', 'text-blue-400');
                neFilenameEl.classList.remove('italic');
            }

            if (typeof window.updateFolderBadge === 'function') window.updateFolderBadge(window.activePitId, buildMethod);
            
            if (typeof window.updateGeometryPitListUI === 'function') {
                window.updateGeometryPitListUI();
            }
            
            if (window.loadedPits && window.loadedPits.has(window.activePitId)) {
                if (window.renderedPits) window.renderedPits.delete(window.activePitId);
                if (typeof window.unloadPitGeometry === 'function') window.unloadPitGeometry(window.activePitId);
                window.loadedPits.add(window.activePitId); 
            }
            
            if (refFile) state.refFileApplied = true;
            window.updateBuildGeometryButtonState();

        } catch(err) {
            btnBuildGeometry.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Gagal! Cek Log/Upload Ulang';
            btnBuildGeometry.className = "mt-1 w-full bg-rose-600 text-white py-2 rounded text-[11px] font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-default";
            if (err.message.includes("File fisik")) alert(err.message);
            setTimeout(() => window.updateBuildGeometryButtonState(), 2000);
        } finally {
            // Sembunyikan Overlay Loading setelah kalkulasi/render Summary dan Preview selesai sinkron
            if (typeof hideFullscreenLoading === 'function') {
                hideFullscreenLoading();
            }
        }
    });
}

// ==============================================================
// GEOMETRY 2D PREVIEW & SUMMARY TABLE LOGIC (PURE HTML5 CANVAS)
// ==============================================================
window.renderGeometryPreview = function(csvData, summaryObj, buildMethod = 'NON_CEN', updateSummaryOnly = false, isAggregated = false) {
    const placeholder = document.getElementById('preview-placeholder');
    const summaryTable = document.getElementById('preview-summary-table');
    const summaryContent = document.getElementById('preview-summary-content');
    const canvasContainer = document.getElementById('preview-3d-canvas');

    if (!summaryObj) {
        placeholder?.classList.remove('hidden');
        summaryTable?.classList.add('hidden');
        if (canvasContainer && !updateSummaryOnly) canvasContainer.innerHTML = '';
        return;
    }

    const titleLabel = isAggregated ? 'Summary (Agregasi Pit)' : (buildMethod === 'CEN' ? 'Summary (Centeroid)' : 'Summary (Mining Reserve)');
    if (summaryTable) {
        const titleEl = summaryTable.querySelector('h3');
        if (titleEl) {
            titleEl.innerHTML = `<i class="fa-solid fa-chart-simple mr-1.5 text-blue-400"></i> ${titleLabel}`;
        }
    }

    let html = `
        <div class="text-blue-400 font-semibold mb-1 border-b border-slate-600 pb-0.5">Reserve</div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Total Waste</span>
            <span class="font-bold text-slate-200">${(summaryObj.totalWaste || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Total Resource</span>
            <span class="font-bold text-slate-200">${(summaryObj.totalResource || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
        </div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Stripping Ratio</span>
            <span class="font-bold text-slate-200">${summaryObj.totalResource > 0 ? (summaryObj.totalWaste / summaryObj.totalResource).toFixed(2) : '0.00'}</span>
        </div>
    `;

    if (!isAggregated) {
        html += `
            <div class="text-blue-400 font-semibold mt-2 mb-1 border-b border-slate-600 pb-0.5">Thickness</div>
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
                <span class="text-slate-400">Waste Thick</span>
                <span class="text-right shrink-0">
                    <span class="font-bold text-slate-200">${(summaryObj.avgWasteThick || 0).toFixed(2)}</span>
                    <span class="text-slate-400 italic font-normal text-[9px] whitespace-nowrap"> (${(summaryObj.minWasteThick || 0).toFixed(2)} - ${(summaryObj.maxWasteThick || 0).toFixed(2)})</span>
                </span>
            </div>
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
                <span class="text-slate-400">Resource Thick</span>
                <span class="text-right shrink-0">
                    <span class="font-bold text-slate-200">${(summaryObj.avgResThick || 0).toFixed(2)}</span>
                    <span class="text-slate-400 italic font-normal text-[9px] whitespace-nowrap"> (${(summaryObj.minResThick || 0).toFixed(2)} - ${(summaryObj.maxResThick || 0).toFixed(2)})</span>
                </span>
            </div>
        `;

        if (summaryObj.qualities && Object.keys(summaryObj.qualities).length > 0) {
            html += `<div class="text-blue-400 font-semibold mt-2 mb-1 border-b border-slate-600 pb-0.5">Qualities</div>`;
            for (let [qName, qData] of Object.entries(summaryObj.qualities)) {
                const qAvg = typeof qData === 'number' ? qData : (qData.avg || 0);
                const qMin = typeof qData === 'number' ? 0 : (qData.min || 0);
                const qMax = typeof qData === 'number' ? 0 : (qData.max || 0);

                html += `
                <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
                    <span class="text-slate-400 truncate pr-2" title="${qName}">${qName}</span>
                    <span class="text-right shrink-0">
                        <span class="font-bold text-slate-200">${qAvg.toFixed(2)}</span>
                        <span class="text-slate-400 italic font-normal text-[9px] whitespace-nowrap"> (${qMin.toFixed(2)} - ${qMax.toFixed(2)})</span>
                    </span>
                </div>
                `;
            }
        }
    } else {
        html += `<div class="text-slate-500 italic text-[10px] mt-3 text-center border-t border-slate-700/50 pt-2 leading-relaxed">Thickness & Qualities tidak diakumulasikan dalam mode Agregasi.</div>`;
    }
    
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
        const idIdx = headers.indexOf('ID BLOCK'); 
        
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
                    if (parts.length > 2) {
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
            const unique = [];
            const seen = new Set();
            for (let p of points) {
                const key = p[0].toFixed(2) + '_' + p[1].toFixed(2);
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(p);
                }
            }
            if (unique.length <= 3) return unique;

            unique.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
            const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

            const lower = [];
            for (let i = 0; i < unique.length; i++) {
                while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], unique[i]) <= 0) lower.pop();
                lower.push(unique[i]);
            }

            const upper = [];
            for (let i = unique.length - 1; i >= 0; i--) {
                while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], unique[i]) <= 0) upper.pop();
                upper.push(unique[i]);
            }

            upper.pop();
            lower.pop();
            return lower.concat(upper);
        };

        blockMap.forEach(pts => hulls.push(convexHull(pts)));

        summaryObj.previewHulls = hulls;
        summaryObj.previewBounds = { minX: globalMinX, maxX: globalMaxX, minY: globalMinY, maxY: globalMaxY };
        
        if (window.activePitId) {
            const localStorageKey = `rizpec_entity_${window.activePitId.replace(/\s+/g, '_')}_summary`;
            localStorage.setItem(localStorageKey, JSON.stringify(summaryObj));
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
// INIT GEOMETRY PIT LIST UI
// ==============================================================

window.loadedPits = window.loadedPits || new Set();
window.renderedPits = window.renderedPits || new Set();

window.initGeometryPitListUI = function() {
    const leftPanel = document.querySelector('#file-summary-content > div:first-child');
    if (!leftPanel) return;
    
    let container = document.getElementById('geometry-pit-manager');
    if (!container) {
        container = document.createElement('div');
        container.id = 'geometry-pit-manager';
        container.className = 'hidden flex-col gap-4 pt-4 h-full pl-3 pr-3';
        container.innerHTML = `
            <div class="flex flex-col gap-2 border-b border-slate-700/50 pb-2">
                <h4 class="text-[13px] font-bold text-blue-400 flex items-center gap-2 tracking-wide uppercase">
                    <i class="fa-solid fa-layer-group"></i> Pit List
                </h4>
            </div>
            <div id="geometry-pit-list" class="flex flex-col gap-2 overflow-y-auto pb-10 flex-1"></div>
        `;
        leftPanel.appendChild(container);
    }
    
    window.updateGeometryPitListUI();
};

window.updateGeometryPitListUI = function() {
    const listEl = document.getElementById('geometry-pit-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    
    const pits = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('rizpec_build_type_')) {
            const pitName = key.replace('rizpec_build_type_', '').replace(/_/g, ' ');
            pits.push({ name: pitName });
        }
    }

    pits.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    
    if (pits.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-center opacity-60">
                <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 mb-2 shadow-inner">
                    <i class="fa-solid fa-cube text-xl text-slate-500"></i>
                </div>
                <div class="text-[11px] text-slate-400 italic">Belum ada Pit yang berstatus Geometry Ready.</div>
            </div>
        `;
        return;
    }
    
    pits.forEach(pitObj => {
        const pit = pitObj.name;
        const isLoaded = window.loadedPits.has(pit);
        const div = document.createElement('div');
        div.className = `flex items-center justify-between bg-slate-900/80 border ${isLoaded ? 'border-emerald-500/50 shadow-[0_0_10px_-2px_rgba(16,185,129,0.2)]' : 'border-slate-700/80'} p-3 rounded-lg transition-all hover:bg-slate-800 group`;
        
        div.innerHTML = `
            <div class="flex flex-col truncate flex-1 pr-2">
                <span class="${isLoaded ? 'text-emerald-400' : 'text-slate-300'} transition-colors font-bold text-[12px] truncate">${pit}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0" title="Check/Uncheck untuk menampilkan atau menyembunyikan Geometri dari 3D Workspace">
                <span class="text-[9px] ${isLoaded ? 'text-emerald-500/70' : 'text-slate-500'} font-normal text-right whitespace-nowrap">Geometry Ready</span>
                <label class="relative flex items-center justify-center w-5 h-5 cursor-pointer m-0">
                    <input type="checkbox" class="pit-checkbox peer absolute opacity-0 w-full h-full cursor-pointer" data-pit="${pit}" ${isLoaded ? 'checked' : ''}>
                    <div class="w-4 h-4 rounded border ${isLoaded ? 'bg-emerald-500 border-emerald-500' : 'bg-slate-800 border-slate-600 group-hover:border-blue-400'} flex items-center justify-center transition-colors">
                        <i class="fa-solid fa-check text-white text-[9px] ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                    </div>
                </label>
            </div>
        `;
        
        const cb = div.querySelector('.pit-checkbox');
        cb.addEventListener('change', async (e) => {
            const containerDiv = e.target.closest('.group');
            const textSpan = containerDiv.querySelector('span.font-bold');
            const subTextSpan = containerDiv.querySelectorAll('span')[1];
            const customCb = containerDiv.querySelector('.w-4');
            const checkIcon = customCb.querySelector('i');

            if(e.target.checked) {
                // Berperan Memanggil Geometri sebagai Visible
                customCb.className = "w-4 h-4 rounded border bg-emerald-500 border-emerald-500 flex items-center justify-center transition-colors shrink-0";
                checkIcon.className = "fa-solid fa-check text-white text-[9px] opacity-100 transition-opacity";
                textSpan.className = "text-emerald-400 transition-colors font-bold text-[12px] truncate";
                subTextSpan.className = "text-[9px] text-emerald-500/70 font-normal text-right whitespace-nowrap";
                containerDiv.className = "flex items-center justify-between bg-slate-900/80 border border-emerald-500/50 shadow-[0_0_10px_-2px_rgba(16,185,129,0.2)] p-3 rounded-lg transition-all hover:bg-slate-800 group";
                
                window.loadedPits.add(pit);
                
                const geoTab = document.getElementById('panel-geometry');
                const isGeoTabActive = geoTab && !geoTab.classList.contains('hidden');
                
                if (isGeoTabActive) {
                    if (typeof window.renderPendingPits === 'function') await window.renderPendingPits();
                } else {
                    const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
                    if (tabBtn) {
                        tabBtn.classList.add('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse');
                        setTimeout(() => tabBtn.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse'), 2000);
                    }
                }
            } else {
                // Berperan Menyembunyikan/Melepas Geometri dari Memori (Invisible)
                customCb.className = "w-4 h-4 rounded border bg-slate-800 border-slate-600 group-hover:border-blue-400 flex items-center justify-center transition-colors shrink-0";
                checkIcon.className = "fa-solid fa-check text-white text-[9px] opacity-0 transition-opacity";
                textSpan.className = "text-slate-300 transition-colors font-bold text-[12px] truncate";
                subTextSpan.className = "text-[9px] text-slate-500 font-normal text-right whitespace-nowrap";
                containerDiv.className = "flex items-center justify-between bg-slate-900/80 border border-slate-700/80 p-3 rounded-lg transition-all hover:bg-slate-800 group";
                
                window.loadedPits.delete(pit);
                window.renderedPits.delete(pit);
                if (typeof window.unloadPitGeometry === 'function') window.unloadPitGeometry(pit);
            }
        });
        
        listEl.appendChild(div);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof window.initGeometryPitListUI === 'function') {
            window.initGeometryPitListUI();
        }
    }, 1000);
});