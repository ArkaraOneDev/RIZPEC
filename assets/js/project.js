// ==========================================
// PROJECT SAVE / OPEN LOGIC (.riz)
// ==========================================

// 1. Logika New Project pada Sidebar
const btnSidebarNew = document.getElementById('btn-sidebar-new');
if (btnSidebarNew) {
    btnSidebarNew.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Cek hanya berdasarkan nama Project aktif (sesuai permintaan)
        const isProjectActive = window.currentProjectName && window.currentProjectName.trim() !== "" && window.currentProjectName !== "Untitled";
        
        const executeNewProject = async () => {
            if (typeof window.resetFileTabForNewProject === 'function') {
                await window.resetFileTabForNewProject();
            }
            resetFullProject(); // Membersihkan semua cache memori / 3D
            
            // Pindahkan view ke Landing Page
            const projectTab = document.querySelector('.nav-tab[data-target="panel-project"]');
            if (projectTab) projectTab.click();
            
            const landingFormContainer = document.getElementById('landing-new-project-container');
            const landingInput = document.getElementById('landing-project-name');
            
            if (landingFormContainer && landingInput) {
                landingFormContainer.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
                landingFormContainer.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
                setTimeout(() => {
                    landingInput.value = ''; // Pastikan input kosong tanpa default value
                    landingInput.focus();
                }, 150);
            }
        };

        if (isProjectActive) {
            if (typeof showCustomConfirm === 'function') {
                showCustomConfirm("Apakah Anda yakin ingin memulai project baru? Data yang belum di-save akan hilang.", executeNewProject);
            } else {
                if (confirm("Apakah Anda yakin ingin memulai project baru? Data yang belum di-save akan hilang.")) {
                    executeNewProject();
                }
            }
        } else {
            executeNewProject();
        }
    });
}

// Listener untuk eksekusi Form Landing Page (Pembuatan Project Inline)
document.addEventListener('DOMContentLoaded', () => {
    const landingForm = document.getElementById('landing-new-project-form');
    const landingInput = document.getElementById('landing-project-name');
    const landingContainer = document.getElementById('landing-new-project-container');

    if (landingForm && landingInput) {
        landingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const val = landingInput.value.trim();
            if (val) {
                if (typeof window.resetFileTabForNewProject === 'function') {
                    await window.resetFileTabForNewProject();
                }
                resetFullProject(); // Pastikan memory bersih
                
                window.currentProjectName = val;
                const projNameEl = document.getElementById('project-name-display');
                const sep = document.getElementById('project-name-container');
                if (projNameEl) projNameEl.textContent = window.currentProjectName;
                if (sep) {
                    sep.classList.remove('hidden');
                    sep.title = "Project : " + val;
                }
                
                if (typeof window.updateTabLockState === 'function') window.updateTabLockState();
                if (typeof updateFileMenuState === 'function') updateFileMenuState();
                
                const fileTab = document.querySelector('.nav-tab[data-target="panel-file"]');
                if (fileTab) fileTab.click();
                
                landingInput.value = ''; 
                if (landingContainer) {
                    landingContainer.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
                    landingContainer.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
                }
            }
        });
    }
});

// 2. Ekstrak Hanya Data Konfigurasi (Tanpa Geometri yang Berat)
function getBaseProjectData() {
    const recKeys = [];
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (m.userData && m.userData.isRecorded) {
                recKeys.push(`${m.userData.blockName}_${m.userData.bench}`);
            }
        });
    }

    let currentFileName = null;
    const filenameUI = document.getElementById('upload-filename');
    if (filenameUI) {
        const text = filenameUI.textContent.trim();
        if (text !== 'Upload CSV' && !text.includes('Merakit Geometri')) currentFileName = text;
    }

    const safeRecords = (window.sequenceRecords || []).map(r => {
        const clean = {};
        for (const k in r) {
            const v = r[k];
            if (v !== null && typeof v === 'object') {
                if (v.isObject3D || v instanceof HTMLElement || v.isMaterial || v.isBufferGeometry) continue;
            }
            clean[k] = v;
        }
        return clean;
    });

    const getVal = (id, def) => document.getElementById(id) ? document.getElementById(id).value : def;
    const getCheck = (id) => document.getElementById(id) ? document.getElementById(id).checked : false;

    // Rekam Konfigurasi Seluruh Tab File & Pit States
    const cleanPitStates = {};
    if (typeof window.pitStates !== 'undefined') {
        for (const [pitId, state] of Object.entries(window.pitStates)) {
            cleanPitStates[pitId] = {
                mrFilePlaceholder: state.mrFile ? { name: state.mrFile.name } : null,
                refFilePlaceholder: state.refFile ? { name: state.refFile.name } : null,
                summaryObj: state.summaryObj,
                mrStats: state.mrStats,
                refStats: state.refStats,
                neStats: state.neStats,
                cols: state.cols,
                substrings: state.substrings,
                mrHeaders: state.mrHeaders,
                refHeaders: state.refHeaders
            };
        }
    }

    return {
        version: "1.4", // Diperbarui untuk fitur save state Pit List
        csvFileName: currentFileName,
        csvHeaders: typeof csvHeaders !== 'undefined' ? csvHeaders : [], 
        pitStates: cleanPitStates,
        activePitId: typeof window.activePitId !== 'undefined' ? window.activePitId : null,
        
        // Simpan status check/uncheck dari array window.loadedPits
        loadedPits: Array.from(window.loadedPits || []),
        
        // Rekam Konfigurasi Kamera & Visualisasi
        cameraState: {
            position: typeof camera !== 'undefined' ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : {x:0, y:500, z:0},
            target: typeof controls !== 'undefined' ? { x: controls.target.x, y: controls.target.y, z: controls.target.z } : {x:0, y:0, z:0},
            quaternion: typeof camera !== 'undefined' ? { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w } : {x:0, y:0, z:0, w:1}
        },
        visualization: {
            isStupaMode: typeof isStupaMode !== 'undefined' ? isStupaMode : false,
            currentExtrusion: typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5
        },
        
        // Rekam Konfigurasi Tab Geometry (Processing)
        // Tidak lagi memanggil localStorage untuk mencegah fallback kotor
        pitProcessing: {
            mode: getVal('pit-processing-select', 'basic'),
            basicColorOB: getVal('color-ob', '#aaaaaa'),
            basicColorCoal: getVal('color-coal', '#000000'),
            srLimit: getVal('sr-limit', '5'),
            resDirection: getVal('resgraphic-direction', 'strip_asc'),
            resSequence: getVal('resgraphic-sequence', ''),
            qualityTarget: getVal('quality-target', ''),
            qualityFormula: getVal('quality-formula', 'weighted_average'),
            qualityWeight: getVal('quality-weight', 'coal'),
            qualityType: getVal('quality-type', 'maximize')
        },
        sequences: {
            records: safeRecords,
            totalOB: window.sequenceTotalOB || 0,
            totalCoal: window.sequenceTotalCoal || 0,
            counter: window.sequenceCounter || 1,
            recordedKeys: recKeys 
        },
        layout: {
            vis: getCheck('cb-layout-vis'),
            geo: getCheck('cb-layout-geo'),
            layer: getCheck('cb-layout-layer'),
            info: getCheck('cb-layout-info'),
            helper: getCheck('cb-layout-helper')
        }
        // pitReserve, pitDataCSVs dan dxfLayers akan ditambahkan melalui Stream
    };
}

// 3. Ekstraksi Data Tunggal untuk Streaming
function extractSingleMesh(m) {
    const cleanUserData = { ...m.userData };
    delete cleanUserData.rawRows; 
    return {
        color: m.material.color.getHex(),
        userData: cleanUserData,
        positions: m.geometry.attributes.position ? Array.from(m.geometry.attributes.position.array) : [],
        indices: m.geometry.index ? Array.from(m.geometry.index.array) : null
    };
}

function extractSingleDxfLayer(layer) {
    const dxfData = {
        id: layer.id, name: layer.name, visible: layer.visible,
        colorHex: layer.colorHex, defaultColorHex: layer.defaultColorHex,
        hasFaces: layer.hasFaces, opacity: layer.opacity !== undefined ? layer.opacity : 1,
        clippingEnabled: layer.clippingEnabled || false,
        meshes: [], lines: [], textureBase64: null
    };

    layer.threeObject.traverse(c => {
        if (c.isMesh) {
            dxfData.meshes.push({
                positions: c.geometry.attributes.position ? Array.from(c.geometry.attributes.position.array) : [],
                uvs: c.geometry.attributes.uv ? Array.from(c.geometry.attributes.uv.array) : null,
                indices: c.geometry.index ? Array.from(c.geometry.index.array) : null,
                color: c.material.color.getHex(),
                originalColor: c.userData.originalColor
            });
            if (c.material.map && c.material.map.image && !dxfData.textureBase64) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = c.material.map.image.width; canvas.height = c.material.map.image.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(c.material.map.image, 0, 0);
                    dxfData.textureBase64 = canvas.toDataURL('image/png');
                } catch(err) { console.warn("Could not serialize texture", err); }
            }
        } else if (c.isLine || c.isLineSegments) {
            dxfData.lines.push({ 
                positions: c.geometry.attributes.position ? Array.from(c.geometry.attributes.position.array) : [], 
                color: c.material.color.getHex(), 
                originalColor: c.userData.originalColor 
            });
        }
    });
    return dxfData;
}

// 4. Tombol Save Listener
const btnSaveProj = document.getElementById('btn-sidebar-save');
if (btnSaveProj) {
    btnSaveProj.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (btnSaveProj.style.pointerEvents === 'none') return; // Cegah save jika tombol disable

        let defaultName = window.currentProjectName || "";
        if (!defaultName || defaultName === "Untitled") {
            const date = new Date();
            const yy = String(date.getFullYear()).slice(-2);
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            defaultName = `Scheduling_${yy}${mm}${dd}`;
        }
        
        try {
            // Munculkan Dialog Save SEBELUM proses berat dimulai
            let fileHandle = null;
            let fileName = defaultName + ".riz";

            if (window.showSaveFilePicker) {
                try {
                    fileHandle = await window.showSaveFilePicker({
                        id: 'rk-project-dir', 
                        startIn: 'documents',
                        suggestedName: defaultName,
                        types: [{ description: 'RK Mine Sched Project', accept: {'application/json': ['.riz']} }],
                    });
                } catch (err) {
                    if (err.name === 'AbortError') return; // User membatalkan dialog
                    console.warn("File System API fallback", err);
                }
            }

            if (!fileHandle && !window.showSaveFilePicker) {
                fileName = prompt("Simpan project sebagai:", defaultName + ".riz");
                if (!fileName) return; // User membatalkan prompt
                if (!fileName.endsWith('.riz')) fileName += '.riz';
            }

            // Jalankan Progressive Streaming Save (Cegah OOM)
            await executeProgressiveStreamSave(fileHandle, fileName);

        } catch(e) {
            console.error("Gagal memulai proses save", e);
            alert("Sistem gagal menginisialisasi penyimpanan.");
        }
    });
}

// =========================================================
// PROGRESSIVE STREAMING SAVE (Mencegah Out of Memory)
// Menulis data secara bertahap langsung ke file (Chunking)
// =========================================================
async function executeProgressiveStreamSave(fileHandle, fileName) {
    showFullscreenLoading("Menyiapkan struktur project...");

    try {
        const baseData = getBaseProjectData(); 
        
        const gzipStream = new CompressionStream("gzip");
        let fileStream;
        let fallbackChunks = [];

        // Inisialisasi Tujuan Tulis
        if (fileHandle) {
            fileStream = await fileHandle.createWritable();
        } else {
            // Fallback untuk browser lama (Firefox/Safari)
            fileStream = new WritableStream({
                write(chunk) { fallbackChunks.push(chunk); }
            });
        }

        const loadingTextEl = document.getElementById('loading-text');

        // Generator Pembaca Stream (Mengekstrak geometri satu persatu)
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    // 1. Tulis Header Konfigurasi
                    let baseJson = JSON.stringify(baseData);
                    baseJson = baseJson.slice(0, -1); // Potong kurung tutup }
                    
                    // 1.5 Tulis seluruh CSV (Geometry Data) agar tidak mengandalkan Cache Browser (IndexedDB)
                    controller.enqueue(new TextEncoder().encode(baseJson + ',"pitDataCSVs":{'));
                    
                    let isFirstCsv = true;
                    if (typeof window.pitStates !== 'undefined') {
                        const pitKeys = Object.keys(window.pitStates);
                        for (let i = 0; i < pitKeys.length; i++) {
                            const pId = pitKeys[i];
                            const safeId = pId.replace(/\s+/g, '_');
                            let csvStr = null;
                            try {
                                csvStr = await RizpecDB.get(`rizpec_entity_${safeId}`);
                            } catch(e) {}
                            
                            if (csvStr) {
                                if (loadingTextEl) loadingTextEl.textContent = `Menyimpan sumber Geometri ke file (${pId})...`;
                                const prefix = isFirstCsv ? '' : ',';
                                controller.enqueue(new TextEncoder().encode(`${prefix}${JSON.stringify(pId)}:${JSON.stringify(csvStr)}`));
                                isFirstCsv = false;
                                await new Promise(resolve => setTimeout(resolve, 5)); // Jeda agar tidak freeze
                            }
                        }
                    }

                    // 2. Tulis Geometri Pit Reserve secara Bertahap (Chunking) untuk yang sedang aktif di-render
                    controller.enqueue(new TextEncoder().encode('},"pitReserve":['));
                    
                    const meshKeys = typeof meshes !== 'undefined' ? Object.keys(meshes) : [];
                    const totalMeshes = meshKeys.length;
                    
                    for(let i = 0; i < totalMeshes; i++) {
                        const m = meshes[meshKeys[i]];
                        if (m && m.isMesh && m.geometry && m.geometry.attributes.position) {
                            const meshData = extractSingleMesh(m);
                            const separator = (i === 0) ? '' : ',';
                            controller.enqueue(new TextEncoder().encode(separator + JSON.stringify(meshData)));
                        }
                        
                        if (i % 50 === 0) {
                            if (loadingTextEl) loadingTextEl.textContent = `Menulis cache 3D ke disk (${i}/${totalMeshes})...`;
                            await new Promise(resolve => setTimeout(resolve, 0)); 
                        }
                    }

                    // 3. Pindah array ke DXF Layers
                    controller.enqueue(new TextEncoder().encode('],"dxfLayers":['));

                    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
                    for (let i = 0; i < dxfLayers.length; i++) {
                        if (loadingTextEl) loadingTextEl.textContent = `Menulis data DXF (${i+1}/${dxfLayers.length})...`;
                        const dxfData = extractSingleDxfLayer(dxfLayers[i]);
                        const separator = (i === 0) ? '' : ',';
                        controller.enqueue(new TextEncoder().encode(separator + JSON.stringify(dxfData)));
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }

                    // 4. Tutup Struktur JSON
                    controller.enqueue(new TextEncoder().encode(']}'));
                    controller.close();
                } catch (e) {
                    controller.error(e);
                }
            }
        });

        if (loadingTextEl) loadingTextEl.textContent = "Mengkompresi dan memfinalisasi file...";

        // Proses aliran data (Pipe)
        await readable.pipeThrough(gzipStream).pipeTo(fileStream);

        // Download otomatis untuk fallback browser
        if (!fileHandle) {
            const finalBlob = new Blob(fallbackChunks, { type: "application/gzip" });
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Update UI Nama Project
        window.currentProjectName = (fileHandle ? fileHandle.name : fileName).replace('.riz', '');
        const projNameEl = document.getElementById('project-name-display');
        const sep = document.getElementById('project-name-container');
        if (projNameEl) projNameEl.textContent = window.currentProjectName;
        if (sep) sep.classList.remove('hidden');

        if (typeof updateFileMenuState === 'function') updateFileMenuState();
        if (typeof window.updateTabLockState === 'function') window.updateTabLockState();

    } catch (err) {
        console.error("Worker Save Error:", err);
        alert("Gagal menyimpan project: " + err.message);
    } finally {
        hideFullscreenLoading();
    }
}

// --------------------------------------------------------
// PEMBERSIHAN TOTAL GEOMETRI & RAM (RESET/NEW PROJECT)
// --------------------------------------------------------
function resetFullProject() {
    // 1. Bersihkan DXF Layers
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(layer => {
            if (layer.type === 'dxf' && typeof scene !== 'undefined') {
                scene.remove(layer.threeObject);
                layer.threeObject.traverse(c => {
                    if (c.isMesh || c.isLineSegments || c.isLine) {
                        if(c.geometry) c.geometry.dispose();
                        if(c.material) {
                            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                            else c.material.dispose();
                        }
                    }
                });
            }
        });
        appLayers = []; 
    }
    
    // 2. Bersihkan Geometri Pit (Mesh), Cache CSV, & Label
    if (typeof globalParsedData !== 'undefined') globalParsedData = null;
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && typeof scene !== 'undefined') {
        while(pitReserveGroup.children.length > 0) {
            const child = pitReserveGroup.children[0];
            pitReserveGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
            if (child.children) {
                child.children.forEach(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
            }
        }
    }
    if (typeof meshes !== 'undefined') meshes = {};
    if (typeof clearLabels === 'function') clearLabels();
    
    // 3. Reset Posisi Kamera ke Default
    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
        camera.position.set(0, 500, 0.001); 
        camera.up.set(0, 1, 0);
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        controls.update();
    }

    // 4. Reset Variabel State Sequences
    if (typeof worldOrigin !== 'undefined') worldOrigin = { x: 0, y: 0, z: 0, isSet: false };
    window.currentCsvFileName = null;
    
    window.sequenceRecords = [];
    window.sequenceTotalOB = 0;
    window.sequenceTotalCoal = 0;
    window.sequenceCounter = 1;
    window.undoStack = [];
    window.redoStack = [];
    if (typeof window.updateSequenceUI === 'function') window.updateSequenceUI();
    
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('sum-blocks', "0"); setTxt('sum-ob', "0"); setTxt('sum-coal', "0"); setTxt('sum-sr', "0.00");
    
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    
    const filenameUI = document.getElementById('upload-filename');
    if (filenameUI) {
        filenameUI.textContent = 'Upload CSV';
        filenameUI.classList.remove('text-slate-200');
        filenameUI.classList.add('text-slate-400');
    }

    const selectEl = document.getElementById('pit-processing-select');
    if (selectEl) {
        selectEl.value = 'basic';
        selectEl.dispatchEvent(new Event('change'));
    }

    window.currentProjectName = "";
    const nameDisplay = document.getElementById('project-name-display');
    const sep = document.getElementById('project-name-container'); 
    if (nameDisplay) nameDisplay.textContent = window.currentProjectName;
    if (sep) sep.classList.add('hidden');
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
    
    if (typeof window.updateTabLockState === 'function') window.updateTabLockState();
    if(typeof updateFileMenuState === 'function') updateFileMenuState();
    if (typeof window.updateLayerUI === 'function') window.updateLayerUI();
    if (typeof window.clearAllFoldersUI === 'function') window.clearAllFoldersUI();
}

// Sinkronisasi Nama Project Saja
document.addEventListener('DOMContentLoaded', () => {
    const projectNameDisplay = document.getElementById('project-name-display');
    const infoProjectName = document.getElementById('info-project-name');
    if (projectNameDisplay && infoProjectName) {
        const observer = new MutationObserver(() => {
            infoProjectName.textContent = projectNameDisplay.textContent;
        });
        observer.observe(projectNameDisplay, { childList: true, characterData: true, subtree: true });
    }
});

// --------------------------------------------------------
// LOAD LOGIC (.riz) WITH WEB WORKER
// --------------------------------------------------------
const fileInputRiz = document.getElementById('file-input-riz');
if (fileInputRiz) {
    fileInputRiz.addEventListener('click', async (e) => {
        if (window.showOpenFilePicker) {
            e.preventDefault();
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    id: 'rk-project-dir', 
                    startIn: 'documents',
                    types: [{ description: 'RK Mine Sched Project', accept: {'application/json': ['.riz']} }]
                });
                const file = await fileHandle.getFile();
                handleRizFileWithWorker(file);
            } catch (err) {
                if (err.name !== 'AbortError') console.warn(err);
            }
        }
    });

    fileInputRiz.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        handleRizFileWithWorker(file);
        e.target.value = '';
    });
}

async function handleRizFileWithWorker(file) {
    showFullscreenLoading("Membaca dan Mengekstrak file project di background...");

    try {
        const buffer = await file.arrayBuffer();
        const view = new Uint8Array(buffer);
        const isGzip = view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;

        const workerCode = `
            self.onmessage = async function(e) {
                try {
                    const { buffer, isGzip } = e.data;
                    let jsonString;
                    
                    if (isGzip) {
                        const ds = new DecompressionStream('gzip');
                        const stream = new Blob([buffer]).stream().pipeThrough(ds);
                        const response = new Response(stream);
                        jsonString = await response.text();
                    } else {
                        const decoder = new TextDecoder('utf-8');
                        jsonString = decoder.decode(buffer);
                    }
                    
                    const data = JSON.parse(jsonString);
                    self.postMessage({ success: true, data: data });
                } catch(err) {
                    self.postMessage({ success: false, error: err.message });
                }
            };
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        worker.onmessage = async (e) => {
            URL.revokeObjectURL(workerUrl);
            if (e.data.success) {
                await processLoadedData(e.data.data, file.name);
            } else {
                console.error("Worker Load Error:", e.data.error);
                alert("File rusak atau gagal diekstrak: " + e.data.error);
                hideFullscreenLoading();
            }
        };

        worker.onerror = (err) => {
            URL.revokeObjectURL(workerUrl);
            console.error("Worker Fatal Error:", err);
            alert("Web Worker memori penuh saat memuat file.");
            hideFullscreenLoading();
        };

        worker.postMessage({ buffer, isGzip }, [buffer]);

    } catch (err) {
        console.error("Error Reading RIZ File Buffer:", err);
        alert("Gagal membaca file fisik .riz.");
        hideFullscreenLoading();
    }
}

// --------------------------------------------------------
// PEMBANGUNAN ULANG UI DAN GEOMETRY DARI DATA LOAD
// --------------------------------------------------------
async function processLoadedData(data, fileName) {
    showFullscreenLoading("Merakit ulang proyek...");

    if(!data.version) {
        alert("Versi file tidak didukung.");
        hideFullscreenLoading();
        return;
    }

    resetFullProject();

    // Memulihkan Status Pit List (Check/Uncheck) dari .riz file (Bukan dari localStorage)
    if (data.loadedPits) {
        window.loadedPits = new Set(data.loadedPits);
    } else {
        // Fallback untuk file .riz versi sebelumnya (asumsi semua terbuka)
        window.loadedPits = new Set(Object.keys(data.pitStates || {}));
    }
    // Rendered Pits disamakan dengan state loadedPits
    window.renderedPits = new Set(window.loadedPits);

    if (data.cameraState && typeof controls !== 'undefined' && typeof camera !== 'undefined') {
        camera.position.set(data.cameraState.position.x, data.cameraState.position.y, data.cameraState.position.z);
        if (data.cameraState.quaternion) {
            camera.quaternion.set(data.cameraState.quaternion.x, data.cameraState.quaternion.y, data.cameraState.quaternion.z, data.cameraState.quaternion.w);
        }
        controls.target.set(data.cameraState.target.x, data.cameraState.target.y, data.cameraState.target.z);
        controls.update();
    }

    window.currentProjectName = fileName.replace('.riz', '');
    const projNameEl = document.getElementById('project-name-display');
    const sep = document.getElementById('project-name-container');
    if (projNameEl) projNameEl.textContent = window.currentProjectName;
    if (sep) sep.classList.remove('hidden');

    if (typeof window.updateTabLockState === 'function') window.updateTabLockState();

    const setCheckbox = (id, checked) => {
        const cb = document.getElementById(id);
        if(cb && cb.checked !== checked) {
            cb.checked = checked;
            cb.dispatchEvent(new Event('change'));
        }
    };
    if (data.layout) {
        setCheckbox('cb-layout-vis', data.layout.vis);
        setCheckbox('cb-layout-geo', data.layout.geo);
        setCheckbox('cb-layout-layer', data.layout.layer);
        setCheckbox('cb-layout-info', data.layout.info);
        setCheckbox('cb-layout-helper', data.layout.helper);
    }

    let isStupa = false;
    if (data.visualization) {
        if (typeof isStupaMode !== 'undefined') isStupaMode = data.visualization.isStupaMode;
        if (typeof currentExtrusion !== 'undefined') currentExtrusion = data.visualization.currentExtrusion;
        
        isStupa = data.visualization.isStupaMode;

        const modeToggle = document.getElementById('mode-toggle');
        if (modeToggle) modeToggle.checked = data.visualization.isStupaMode;
        const modeText = document.getElementById('mode-label-text');
        if (modeText) modeText.textContent = data.visualization.isStupaMode ? "Solid Generation" : "Triangulation";
        
        const extSet = document.getElementById('extrusion-settings');
        if (extSet) data.visualization.isStupaMode ? extSet.classList.replace('hidden', 'flex') : extSet.classList.replace('flex', 'hidden');
        const extInp = document.getElementById('extrusion-input');
        if (extInp) extInp.value = data.visualization.currentExtrusion;
    }

    if (data.pitProcessing) {
        const pitSelect = document.getElementById('pit-processing-select');
        if (pitSelect) {
            pitSelect.value = data.pitProcessing.mode;
            const cOb = document.getElementById('color-ob');
            if (cOb) cOb.value = data.pitProcessing.basicColorOB;
            const cCoal = document.getElementById('color-coal');
            if (cCoal) cCoal.value = data.pitProcessing.basicColorCoal;
            const srLim = document.getElementById('sr-limit');
            if (srLim) srLim.value = data.pitProcessing.srLimit;
            
            const dirSelect = document.getElementById('resgraphic-direction');
            if (dirSelect) {
                dirSelect.value = data.pitProcessing.resDirection;
                dirSelect.dispatchEvent(new Event('change')); 
            }
            
            const resSeq = document.getElementById('resgraphic-sequence');
            if (resSeq) resSeq.value = data.pitProcessing.resSequence;
            
            localStorage.setItem('qualityTarget', data.pitProcessing.qualityTarget);
            localStorage.setItem('qualityFormula', data.pitProcessing.qualityFormula);
            localStorage.setItem('qualityWeight', data.pitProcessing.qualityWeight);
            localStorage.setItem('qualityType', data.pitProcessing.qualityType);

            pitSelect.dispatchEvent(new Event('change'));
        }
    }

    if (data.pitStates) {
        window.pitStates = {};
        const container = document.getElementById('subfolders-folder-pit');
        const rootName = 'Pit Data';

        for (const [pitId, savedState] of Object.entries(data.pitStates)) {
            window.pitStates[pitId] = {
                mrFile: savedState.mrFilePlaceholder, 
                refFile: savedState.refFilePlaceholder, 
                generatedCsv: null, 
                summaryObj: savedState.summaryObj,
                mrStats: savedState.mrStats || { text: '0.00 MB (0 Row, 0 Column)' },
                refStats: savedState.refStats || { text: '0.00 MB (0 Row, 0 Column)' },
                neStats: savedState.neStats || { text: '0 Block' },
                cols: savedState.cols || {},
                substrings: savedState.substrings || {},
                mrHeaders: savedState.mrHeaders || [],
                refHeaders: savedState.refHeaders || []
            };

            const safeId = pitId.replace(/\s+/g, '_');
            const buildMethod = savedState.refFilePlaceholder ? 'CEN' : 'NON_CEN';
            localStorage.setItem(`rizpec_build_type_${safeId}`, buildMethod);
            if (savedState.summaryObj) {
                localStorage.setItem(`rizpec_entity_${safeId}_summary`, JSON.stringify(savedState.summaryObj));
            }

            if (typeof folderState !== 'undefined') folderState[rootName]++;
            if (container && typeof window.makeSubfolderInteractive === 'function') {
                const subEl = document.createElement('div');
                container.appendChild(subEl);
                window.makeSubfolderInteractive(subEl, pitId, rootName);
            }
        }
        
        // Pulihkan Data CSV dari file .riz ke IndexedDB Browser baru
        // Ini memastikan project 100% mandiri dan tidak terikat Local Storage / Cache asal!
        if (data.pitDataCSVs) {
            for (const [pId, csvStr] of Object.entries(data.pitDataCSVs)) {
                const safeId = pId.replace(/\s+/g, '_');
                try {
                    await RizpecDB.set(`rizpec_entity_${safeId}`, csvStr);
                    if (window.pitStates[pId]) {
                        window.pitStates[pId].generatedCsv = csvStr;
                    }
                } catch(e) {
                    console.warn("Gagal memulihkan CSV untuk: " + pId);
                }
            }
        }
        
        if (data.activePitId && window.pitStates[data.activePitId]) {
            window.activePitId = data.activePitId;
            window.lastActivePitId = data.activePitId;
        }
    }

    const imagePromises = [];

    if (data.dxfLayers && data.dxfLayers.length > 0 && typeof scene !== 'undefined') {
        data.dxfLayers.forEach(lData => {
            const group = new THREE.Group();
            group.name = lData.name;
            let texture = null;
            if (lData.textureBase64) {
                const img = new Image();
                const imgPromise = new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
                imagePromises.push(imgPromise);

                img.src = lData.textureBase64;
                texture = new THREE.Texture(img);
                texture.needsUpdate = true;
            }

            lData.meshes.forEach(m => {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3));
                if (m.indices) geo.setIndex(new THREE.Uint32BufferAttribute(m.indices, 1));
                if(m.uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uvs, 2));
                geo.computeVertexNormals();

                const mat = new THREE.MeshStandardMaterial({
                    color: m.color, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1,
                    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
                    transparent: lData.opacity < 1, opacity: lData.opacity
                });
                if (texture) {
                    mat.map = texture;
                    mat.color.setHex(0xffffff);
                }
                const mesh = new THREE.Mesh(geo, mat);
                mesh.userData.originalColor = m.originalColor;
                if (texture) mesh.userData.hasFootprintMask = true;
                group.add(mesh);
            });

            lData.lines.forEach(l => {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(l.positions, 3));
                const mat = new THREE.LineBasicMaterial({ color: l.color, transparent: true, opacity: lData.opacity });
                const line = new THREE.LineSegments(geo, mat);
                line.userData.originalColor = l.originalColor;
                group.add(line);
            });

            group.visible = lData.visible;
            scene.add(group);
            
            if (typeof appLayers !== 'undefined') {
                appLayers.push({
                    id: lData.id, name: lData.name, visible: lData.visible,
                    threeObject: group, colorHex: lData.colorHex, defaultColorHex: lData.defaultColorHex,
                    type: 'dxf', hasFaces: lData.hasFaces, opacity: lData.opacity,
                    clippingEnabled: lData.clippingEnabled || false
                });
            }

            if (typeof window.restoreDxfFolderUI === 'function') {
                window.restoreDxfFolderUI(lData.name);
            }
        });
    }

    if (imagePromises.length > 0) {
        await Promise.all(imagePromises);
    }

    if (data.csvData && data.csvData.length > 0) { 
        globalParsedData = data.csvData; 
        if (typeof processData === 'function') processData(globalParsedData, true);
    } 
    else if (data.pitReserve && data.pitReserve.length > 0 && typeof scene !== 'undefined') {
        if (typeof pitReserveGroup === 'undefined') {
            window.pitReserveGroup = new THREE.Group();
            scene.add(pitReserveGroup);
        }
        if (typeof meshes === 'undefined') window.meshes = {};

        data.pitReserve.forEach(m => {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3));
            if (m.indices) geo.setIndex(new THREE.Uint32BufferAttribute(m.indices, 1));
            
            geo.computeVertexNormals();
            geo.computeBoundingBox();

            const isCoal = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
            const mat = new THREE.MeshStandardMaterial({
                color: m.color, side: THREE.DoubleSide, flatShading: true,
                roughness: isCoal ? 0.4 : 0.8, metalness: 0.1,
                polygonOffset: true, polygonOffsetFactor: isCoal ? -2 : 1, polygonOffsetUnits: isCoal ? -2 : 1,
                transparent: true, opacity: isCoal ? (typeof coalOpacity !== 'undefined' ? coalOpacity : 1) : (typeof obOpacity !== 'undefined' ? obOpacity : 1)
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = m.userData;

            // Menyembunyikan Geometri berdasarkan status loadedPits
            if (m.userData.blockKey) {
                const pitName = m.userData.blockKey.split('/')[0];
                if (pitName && data.pitStates && data.pitStates[pitName]) {
                    mesh.visible = window.loadedPits.has(pitName);
                }
            }

            const edges = new THREE.EdgesGeometry(geo, isStupa ? 10 : 60);
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                polygonOffset: true, polygonOffsetFactor: isCoal ? -3 : 0, polygonOffsetUnits: isCoal ? -3 : 0
            });
            const line = new THREE.LineSegments(edges, lineMat);
            mesh.add(line);

            pitReserveGroup.add(mesh);
            meshes[m.userData.blockKey] = mesh;
        });

        if (typeof appLayers !== 'undefined') {
            const existingLayer = appLayers.find(l => l.id === 'layer_pit_reserve');
            if (!existingLayer) {
                appLayers.unshift({ id: 'layer_pit_reserve', name: 'Pit Reserve', visible: true, threeObject: pitReserveGroup, colorHex: '#3b82f6', defaultColorHex: '#3b82f6', type: 'csv', hasFaces: false });
            }
        }
    }

    let loadedSequences = data.sequences || null;

    if (loadedSequences) {
        window.sequenceRecords = loadedSequences.records || [];
        window.sequenceTotalOB = loadedSequences.totalOB || 0;
        window.sequenceTotalCoal = loadedSequences.totalCoal || 0;
        window.sequenceCounter = loadedSequences.counter || 1;
        
        const recordedKeysToHide = loadedSequences.recordedKeys || [];
        if (recordedKeysToHide.length > 0 && typeof meshes !== 'undefined') {
            Object.values(meshes).forEach(m => {
                const key = `${m.userData.blockName}_${m.userData.bench}`;
                if (recordedKeysToHide.includes(key)) {
                    m.userData.isRecorded = true;
                    m.visible = false;
                    if (m.material) m.material.emissive.setHex(0x000000);
                }
            });
        }
        
        if (typeof window.updateSequenceUI === 'function') window.updateSequenceUI();
        if (typeof window.clearSelection === 'function') window.clearSelection();
    }

    if (data.csvHeaders && data.csvHeaders.length > 0) {
        csvHeaders = data.csvHeaders;
        if (typeof populateQualityDropdown === 'function') populateQualityDropdown();
    }

    window.currentCsvFileName = data.csvFileName ? data.csvFileName : 'Project_Data.csv (Loaded)';
    const filenameUI = document.getElementById('upload-filename');
    if (filenameUI) {
        filenameUI.textContent = window.currentCsvFileName;
        filenameUI.classList.remove('text-slate-400');
        filenameUI.classList.add('text-slate-200');
    }

    if (typeof window.updateAllTextureMasks === 'function') {
        try { await window.updateAllTextureMasks(); } catch (err) {}
    }

    if (typeof window.updateLayerUI === 'function') window.updateLayerUI();
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
    
    // Safety Fallback agar Pit yang tidak di-load benar-benar hilang dari Render dan Workspace
    setTimeout(() => {
        hideFullscreenLoading();

        const fileTabBtn = document.querySelector('.nav-tab[data-target="panel-file"]');
        if (fileTabBtn) fileTabBtn.click();

        if (window.activePitId && typeof window.selectFolder === 'function') {
            window.selectFolder(window.activePitId, 'Subfolder', 'Pit Data');
        }

        if(typeof updateFileMenuState === 'function') updateFileMenuState();

        // Eksekusi pelepasan geometri (Unload) untuk Pit yang Unchecked dari .riz
        if (data.pitStates) {
            Object.keys(data.pitStates).forEach(pit => {
                if (!window.loadedPits.has(pit)) {
                    if (typeof window.unloadPitGeometry === 'function') {
                        window.unloadPitGeometry(pit);
                    }
                }
            });
        }
    }, 350);
}