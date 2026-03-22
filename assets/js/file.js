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
    const hasCSV = typeof globalParsedData !== 'undefined' && globalParsedData !== null;
    const hasMeshes = typeof meshes !== 'undefined' && Object.keys(meshes).length > 0;
    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
    const hasDXF = dxfLayers.length > 0;
    
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
    
    const canExport = hasCSV || hasDXF || hasMeshes;
    toggleElement(btnExport, !canExport);
}

// ==============================================================
// PEMBERSIHAN STATE TOTAL (NEW PROJECT YA DIKLIK)
// ==============================================================
window.resetFileTabForNewProject = async function() {
    window.currentProjectName = ""; 
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
    
    // Reset state khusus Pit jika modulnya diload
    if (typeof window.resetPitStates === 'function') window.resetPitStates();

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

// HAULAGE DATA dihapus dari state sesuai permintaan
const folderState = {
    'Pit Data': 0, 'Disposal Data': 0, 'Production Data': 0, 'DXF Data': 0
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
                // Semua folder selain DXF (Pit, Disposal, Prod) menggunakan panel CSV secara default
                if (panelCsv) {
                    panelCsv.classList.remove('hidden');
                    panelCsv.classList.add('flex');
                }
            }
        }
        
        // Memanggil hook modul spesifik (seperti file-pit.js) jika ada
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
        let finalName = input.value.trim();
        
        if (!finalName || finalName === "New Folder") {
            subEl.remove();
            return;
        }

        // Format nama folder (Uppercase & Underscore) untuk entitas fisik
        if (rootName === 'Pit Data' || rootName === 'Disposal Data') {
            finalName = finalName.toUpperCase().replace(/\s+/g, '_');
        }
        
        folderState[rootName]++;
        window.makeSubfolderInteractive(subEl, finalName, rootName);
        
        // Otomatis select folder baru khusus untuk data CSV base
        if (rootName !== 'DXF Data') {
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
    
    // Abstracting badge logic to specific modules
    let badgeHTML = '';
    if (typeof window.getFolderBadgeHTML === 'function') {
        badgeHTML = window.getFolderBadgeHTML(name, rootName);
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

    const deleteBtn = subEl.querySelector('.delete-btn');
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Apakah Anda yakin ingin menghapus subfolder "${name}"?`)) {
            // Memanggil hook modul spesifik sebelum dihapus
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

window.clearAllFoldersUI = function() {
    for (let key in folderState) folderState[key] = 0;
    // folder-haul telah dihapus dari array ini
    const containers = ['folder-pit', 'folder-disp', 'folder-prod', 'folder-dxf'];
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