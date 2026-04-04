// ==========================================
// PROJECT SAVE / OPEN LOGIC (.riz)
// ==========================================

// Helper untuk konversi File (Tekstur) ke Base64 agar bisa disave di JSON
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Helper untuk konversi Base64 kembali ke File object
const base64ToFile = (dataurl, filename) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
};

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
        
        // FITUR BARU: Format otomatis UPPERCASE dan spasi menjadi underscore (_)
        landingInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/\s+/g, '_');
        });

        landingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Value sudah diformat oleh event 'input' di atas
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
    // [FIX 3] Merekam Block Key yang sudah terekam (Hide/Show state) menggunakan blockKey yang akurat
    const recKeys = [];
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (m.userData && m.userData.isRecorded) {
                recKeys.push(m.userData.blockKey);
            }
        });
    }

    let currentFileName = null;
    const filenameUI = document.getElementById('upload-filename');
    if (filenameUI) {
        const text = filenameUI.textContent.trim();
        if (text !== 'Upload CSV' && !text.includes('Merakit Geometri')) currentFileName = text;
    }

    const getVal = (id, def) => document.getElementById(id) ? document.getElementById(id).value : def;
    const getCheck = (id) => document.getElementById(id) ? document.getElementById(id).checked : false;

    // Rekam Konfigurasi Seluruh Tab File (Pit States)
    const cleanPitStates = {};
    if (typeof window.pitStates !== 'undefined') {
        for (const [pitId, state] of Object.entries(window.pitStates)) {
            cleanPitStates[pitId] = {
                mrFileName: state.mrFileName || (state.mrFile ? state.mrFile.name : null),
                refFileName: state.refFileName || (state.refFile ? state.refFile.name : null),
                buildMethod: state.buildMethod || 'NON_CEN',
                refFileApplied: state.refFileApplied || false,
                mrFilePlaceholder: state.mrFile ? { name: state.mrFile.name } : null,
                refFilePlaceholder: state.refFile ? { name: state.refFile.name } : null,
                summaryObj: state.summaryObj,
                originalSummaryObj: state.originalSummaryObj,
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
    
    // Rekam Konfigurasi Seluruh Tab File (Disposal States)
    const cleanDisposalStates = {};
    if (typeof window.disposalStates !== 'undefined') {
        for (const [dispId, state] of Object.entries(window.disposalStates)) {
            cleanDisposalStates[dispId] = {
                mrFileName: state.mrFileName || (state.mrFile ? state.mrFile.name : null),
                refFileName: state.refFileName || (state.refFile ? state.refFile.name : null),
                buildMethod: state.buildMethod || 'NON_CEN',
                refFileApplied: state.refFileApplied || false,
                mrFilePlaceholder: state.mrFile ? { name: state.mrFile.name } : null,
                refFilePlaceholder: state.refFile ? { name: state.refFile.name } : null,
                summaryObj: state.summaryObj,
                originalSummaryObj: state.originalSummaryObj,
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
        version: "1.9", // Versi update untuk Record State terpisah
        csvFileName: currentFileName,
        csvHeaders: typeof csvHeaders !== 'undefined' ? csvHeaders : [], 
        pitStates: cleanPitStates,
        disposalStates: cleanDisposalStates,
        activePitId: typeof window.activePitId !== 'undefined' ? window.activePitId : null,
        activeDisposalId: typeof window.activeDisposalId !== 'undefined' ? window.activeDisposalId : null,
        
        // Simpan status check/uncheck
        loadedPits: Array.from(window.loadedPits || []),
        loadedDisposals: Array.from(window.loadedDisposals || []),
        
        worldOrigin: window.worldOrigin || { x: 0, y: 0, z: 0, isSet: false },
        
        // Rekam Konfigurasi Kamera & Visualisasi
        cameraState: {
            position: typeof camera !== 'undefined' ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : {x:0, y:500, z:0},
            target: typeof controls !== 'undefined' ? { x: controls.target.x, y: controls.target.y, z: controls.target.z } : {x:0, y:0, z:0},
            quaternion: typeof camera !== 'undefined' ? { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w } : {x:0, y:0, z:0, w:1}
        },
        visualization: {
            isStupaMode: typeof isStupaMode !== 'undefined' ? isStupaMode : false,
            currentExtrusion: typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5,
            isLabelLayerVisible: typeof window.isLabelLayerVisible !== 'undefined' ? window.isLabelLayerVisible : false,
            labelOpacity: typeof window.labelOpacity !== 'undefined' ? window.labelOpacity : 1.0
        },
        
        // Rekam Konfigurasi Tab Geometry (Processing)
        pitProcessing: {
            mode: getVal('pit-processing-select', 'basic'),
            basicColorWaste: getVal('color-waste', '#aaaaaa'),
            basicColorResource: getVal('color-resource', '#000000'),
            srLimit: getVal('sr-limit', '5'),
            resDirection: getVal('resgraphic-direction', 'strip_asc'),
            resSequence: getVal('resgraphic-sequence', ''),
            qualityTarget: getVal('quality-target', ''),
            qualityFormula: getVal('quality-formula', 'weighted_average'),
            qualityWeight: getVal('quality-weight', 'resource'),
            qualityType: getVal('quality-type', 'maximize')
        },
        
        // [FIX 3] MEREKAM SEQUENCE SECARA SPESIFIK PIT DAN DISPOSAL (TIDAK LAGI BERCAMPUR)
        pitSequences: {
            records: window.pitSequenceRecords || [],
            totalWaste: window.pitTotalWaste || 0,
            totalResource: window.pitTotalResource || 0,
            counter: window.pitSequenceCounter || 1
        },
        dispSequences: {
            records: window.dispSequenceRecords || [],
            totalWaste: window.dispTotalWaste || 0,
            counter: window.dispSequenceCounter || 1
        },
        recordedKeys: recKeys,

        layout: {
            vis: getCheck('cb-layout-vis'),
            geo: getCheck('cb-layout-geo'),
            layer: getCheck('cb-layout-layer'),
            info: getCheck('cb-layout-info'),
            helper: getCheck('cb-layout-helper')
        },
        // Rekam konfigurasi Palette dan UI Mode pada Pit & Disposal
        pitColorModes: JSON.parse(localStorage.getItem('rizpec_pit_color_modes')) || {},
        burdenPalette: JSON.parse(localStorage.getItem('rizpec_burden_palette')) || null,
        subsetPalette: JSON.parse(localStorage.getItem('rizpec_subset_palette')) || null,
        
        // [UPDATE PRO FEATURES] - Menambahkan penyimpanan parameter Res. Incremental, Cumulative & Zone
        pitProConfigs: JSON.parse(localStorage.getItem('rizpec_pit_pro_configs')) || {},

        dispColorModes: JSON.parse(localStorage.getItem('rizpec_disp_color_modes')) || {},
        dispBurdenPalette: JSON.parse(localStorage.getItem('rizpec_disp_burden_palette')) || null,
        dispSubsetPalette: JSON.parse(localStorage.getItem('rizpec_disp_subset_palette')) || null
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

async function extractSingleDxfLayer(layer) {
    let metaDB = { dxfType: layer.dxfType || (layer.hasFaces ? 'Polymesh' : 'Polyline') };
    if (typeof RizpecDB !== 'undefined') {
        try {
            const dbData = await RizpecDB.get(`rizpec_dxf_entity_${layer.name.replace(/\s+/g, '_')}_meta`);
            if (dbData) metaDB = dbData;
        } catch(e) {}
    }

    const dxfData = {
        id: layer.id, name: layer.name, visible: layer.visible,
        colorHex: layer.colorHex, defaultColorHex: layer.defaultColorHex,
        hasFaces: layer.hasFaces, opacity: layer.opacity !== undefined ? layer.opacity : 1,
        
        // Simpan Konfigurasi Lengkap DXF & Badges
        clippingEnabled: layer.clippingEnabled || false,
        colorMode: layer.colorMode || 'Default',
        visualColor: layer.visualColor || layer.colorHex,
        clipFootprints: layer.clipFootprints || 'Pit Data',
        dxfType: metaDB.dxfType,
        metaDB: metaDB,
        fileSize: layer.fileSize,
        lastModified: layer.lastModified,
        
        textureMeta: layer.textureMeta ? {
            name: layer.textureMeta.name,
            size: layer.textureMeta.size,
            width: layer.textureMeta.width,
            height: layer.textureMeta.height,
            gcpPoints: layer.textureMeta.gcpPoints || null,  
            transform: layer.textureMeta.transform || null   
        } : null,
        
        meshes: [], lines: [], textureBase64: null
    };

    layer.threeObject.traverse(c => {
        if (c.isMesh) {
            dxfData.meshes.push({
                positions: c.geometry.attributes.position ? Array.from(c.geometry.attributes.position.array) : [],
                uvs: c.geometry.attributes.uv ? Array.from(c.geometry.attributes.uv.array) : null, // Ekstrak UV
                indices: c.geometry.index ? Array.from(c.geometry.index.array) : null,
                color: c.material.color ? c.material.color.getHex() : 0xffffff,
                originalColor: c.userData.originalColor
            });
            // Jika ada map texture aktif, convert dan simpan Base64
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
                color: c.material.color ? c.material.color.getHex() : 0xffffff, 
                originalColor: c.userData.originalColor 
            });
        }
    });

    // Fallback ekstraksi gambar base64 jika canvas gagal dirender atau hanya tersimpan di textureMeta.file
    if (layer.textureMeta && layer.textureMeta.file && !dxfData.textureBase64) {
        try {
            dxfData.textureBase64 = await fileToBase64(layer.textureMeta.file);
        } catch(e) {}
    }

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
                        suggestedName: defaultName + ".riz",
                        types: [{ 
                            description: 'RIZPEC Project File', 
                            accept: {
                                'application/octet-stream': ['.riz'],
                                'application/x-rizpec': ['.riz']
                            } 
                        }],
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
                                csvStr = await RizpecDB.get(`rizpec_pit_entity_${safeId}`);
                                if (!csvStr) csvStr = await RizpecDB.get(`rizpec_entity_${safeId}`); // Fallback legacy
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
                    
                    // Tulis Disp CSV
                    controller.enqueue(new TextEncoder().encode('},"dispDataCSVs":{'));
                    let isFirstDispCsv = true;
                    if (typeof window.disposalStates !== 'undefined') {
                        const dispKeys = Object.keys(window.disposalStates);
                        for (let i = 0; i < dispKeys.length; i++) {
                            const dId = dispKeys[i];
                            const safeId = dId.replace(/\s+/g, '_');
                            let csvStr = null;
                            try {
                                csvStr = await RizpecDB.get(`rizpec_disp_entity_${safeId}`);
                            } catch(e) {}
                            
                            if (csvStr) {
                                if (loadingTextEl) loadingTextEl.textContent = `Menyimpan sumber Geometri Disposal (${dId})...`;
                                const prefix = isFirstDispCsv ? '' : ',';
                                controller.enqueue(new TextEncoder().encode(`${prefix}${JSON.stringify(dId)}:${JSON.stringify(csvStr)}`));
                                isFirstDispCsv = false;
                                await new Promise(resolve => setTimeout(resolve, 5));
                            }
                        }
                    }

                    // 2. Tulis Geometri Pit & Disposal Reserve secara Bertahap (Chunking) untuk yang sedang aktif di-render
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
                        // Ambil DXF lengkap dengan metadata via async
                        const dxfData = await extractSingleDxfLayer(dxfLayers[i]);
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
            const finalBlob = new Blob(fallbackChunks, { type: "application/octet-stream" });
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
    
    // [FIX LABEL LEAK]: Hapus DOM element label secara menyeluruh
    if (window.activeLabels) {
        window.activeLabels.forEach(lbl => {
            if (lbl.element && lbl.element.parentNode) {
                lbl.element.parentNode.removeChild(lbl.element);
            }
        });
        window.activeLabels = [];
    }
    
    // 3. Reset Posisi Kamera ke Default
    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
        camera.position.set(0, 500, 0.001); 
        camera.up.set(0, 1, 0);
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        controls.update();
    }

    // 4. Reset Variabel State Sequences (TERMASUK FIX 1 & 3: Reset Set Loaded & Pisahkan State Sequence)
    window.worldOrigin = { x: 0, y: 0, z: 0, isSet: false }; 
    window.currentCsvFileName = null;
    
    // [FIX 1] Kosongkan SET Cache Pit & Disposal agar tidak terjadi GHOST MESH / Double render
    if (window.loadedPits) window.loadedPits.clear();
    if (window.renderedPits) window.renderedPits.clear();
    if (window.loadedDisposals) window.loadedDisposals.clear();
    if (window.renderedDisposals) window.renderedDisposals.clear();
    
    // [FIX 3] Pisahkan reset state Pit dan Disposal
    window.pitSequenceRecords = [];
    window.pitTotalWaste = 0;
    window.pitTotalResource = 0;
    window.pitSequenceCounter = 1;
    
    window.dispSequenceRecords = [];
    window.dispTotalWaste = 0;
    window.dispSequenceCounter = 1;

    window.undoStack = [];
    window.redoStack = [];

    // [UPDATE PRO FEATURES] - Reset konfigurasi memori
    window.pitProConfigs = {};
    localStorage.removeItem('rizpec_pit_pro_configs');

    // [FIX KEBOCORAN LOCAL STORAGE] - Pastikan warna & palet dari project sebelumnya dihapus total
    window.pitColorModes = {};
    window.burdenPalette = null;
    window.subsetPalette = null;
    window.dispColorModes = {};
    window.dispBurdenPalette = null;
    window.dispSubsetPalette = null;
    
    const lsKeysToRemove = [
        'rizpec_pit_color_modes', 'rizpec_burden_palette', 'rizpec_subset_palette',
        'rizpec_disp_color_modes', 'rizpec_disp_burden_palette', 'rizpec_disp_subset_palette'
    ];
    lsKeysToRemove.forEach(k => localStorage.removeItem(k));

    if (typeof window.updateSequenceUI === 'function') window.updateSequenceUI();
    
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('sequence-waste-total', "0"); setTxt('sequence-resource-total', "0"); setTxt('sequence-sr-total', "0.00");
    setTxt('disp-sequence-waste-total', "0");
    
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
        // Menggunakan showOpenFilePicker jika didukung browser Desktop
        if (window.showOpenFilePicker) {
            e.preventDefault();
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    id: 'rk-project-dir', 
                    startIn: 'documents',
                    excludeAcceptAllOption: false,
                    types: [
                        { 
                            description: 'RIZPEC Project File (.riz)', 
                            accept: {
                                'application/octet-stream': ['.riz'],
                                'application/json': ['.riz'],
                                '*/*': ['.riz']
                            } 
                        }
                    ]
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
        
        if (!file.name.toLowerCase().endsWith('.riz')) {
            const proceed = confirm("PERINGATAN!\n\nFile yang Anda pilih (" + file.name + ") tidak memiliki akhiran (.riz).\n\nApakah Anda yakin ini adalah file Project RIZPEC yang valid?");
            if (!proceed) {
                e.target.value = ''; 
                return;
            }
        }
        
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

    // PEMBERSIHAN TOTAL AGAR TIDAK ADA KETERGANTUNGAN
    if (typeof window.resetFileTabForNewProject === 'function') {
        await window.resetFileTabForNewProject();
    }
    resetFullProject();

    if (data.worldOrigin) {
        window.worldOrigin = data.worldOrigin;
    } else {
        window.worldOrigin = { x: 0, y: 0, z: 0, isSet: false };
    }

    if (data.loadedPits) {
        window.loadedPits = new Set(data.loadedPits);
    } else {
        window.loadedPits = new Set(Object.keys(data.pitStates || {}));
    }
    window.renderedPits = new Set(window.loadedPits);
    
    if (data.loadedDisposals) {
        window.loadedDisposals = new Set(data.loadedDisposals);
    } else {
        window.loadedDisposals = new Set(Object.keys(data.disposalStates || {}));
    }
    window.renderedDisposals = new Set(window.loadedDisposals);

    // Memulihkan Konfigurasi Warna Palette Pit
    if (data.pitColorModes) {
        localStorage.setItem('rizpec_pit_color_modes', JSON.stringify(data.pitColorModes));
        window.pitColorModes = data.pitColorModes;
    } else {
        window.pitColorModes = {};
        localStorage.removeItem('rizpec_pit_color_modes');
    }
    
    if (data.burdenPalette) {
        localStorage.setItem('rizpec_burden_palette', JSON.stringify(data.burdenPalette));
        window.burdenPalette = data.burdenPalette;
    } else {
        window.burdenPalette = null;
        localStorage.removeItem('rizpec_burden_palette');
    }
    
    if (data.subsetPalette) {
        localStorage.setItem('rizpec_subset_palette', JSON.stringify(data.subsetPalette));
        window.subsetPalette = data.subsetPalette;
    } else {
        window.subsetPalette = null;
        localStorage.removeItem('rizpec_subset_palette');
    }
    
    // [UPDATE PRO FEATURES] - Memulihkan paramater Res. Incremental, Cumulative & Zone
    if (data.pitProConfigs) {
        localStorage.setItem('rizpec_pit_pro_configs', JSON.stringify(data.pitProConfigs));
        window.pitProConfigs = data.pitProConfigs;
    } else {
        // Fallback jika file .riz versi lama yang belum punya fitur ini
        window.pitProConfigs = {};
        localStorage.removeItem('rizpec_pit_pro_configs');
    }

    // Memulihkan Konfigurasi Warna Palette Disposal
    if (data.dispColorModes) {
        localStorage.setItem('rizpec_disp_color_modes', JSON.stringify(data.dispColorModes));
        window.dispColorModes = data.dispColorModes;
    } else {
        window.dispColorModes = {};
        localStorage.removeItem('rizpec_disp_color_modes');
    }
    
    if (data.dispBurdenPalette) {
        localStorage.setItem('rizpec_disp_burden_palette', JSON.stringify(data.dispBurdenPalette));
        window.dispBurdenPalette = data.dispBurdenPalette;
    } else {
        window.dispBurdenPalette = null;
        localStorage.removeItem('rizpec_disp_burden_palette');
    }
    
    if (data.dispSubsetPalette) {
        localStorage.setItem('rizpec_disp_subset_palette', JSON.stringify(data.dispSubsetPalette));
        window.dispSubsetPalette = data.dispSubsetPalette;
    } else {
        window.dispSubsetPalette = null;
        localStorage.removeItem('rizpec_disp_subset_palette');
    }

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
        
        // Restore konfigurasi Label
        window.isLabelLayerVisible = data.visualization.isLabelLayerVisible || false;
        window.labelOpacity = data.visualization.labelOpacity !== undefined ? data.visualization.labelOpacity : 1.0;

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
            const cWaste = document.getElementById('color-waste');
            if (cWaste) cWaste.value = data.pitProcessing.basicColorWaste;
            const cRes = document.getElementById('color-resource');
            if (cRes) cRes.value = data.pitProcessing.basicColorResource;
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

    // Memulihkan Konfigurasi Pit State
    if (data.pitStates) {
        window.pitStates = {};
        const container = document.getElementById('subfolders-folder-pit');
        const rootName = 'Pit Data';

        for (const [pitId, savedState] of Object.entries(data.pitStates)) {
            window.pitStates[pitId] = {
                mrFileName: savedState.mrFileName || (savedState.mrFilePlaceholder ? savedState.mrFilePlaceholder.name : null),
                refFileName: savedState.refFileName || (savedState.refFilePlaceholder ? savedState.refFilePlaceholder.name : null),
                buildMethod: savedState.buildMethod || (savedState.refFilePlaceholder ? 'CEN' : 'NON_CEN'),
                refFileApplied: savedState.refFileApplied || false,
                mrFile: null,  
                refFile: null, 
                generatedCsv: null, 
                summaryObj: savedState.summaryObj,
                originalSummaryObj: savedState.originalSummaryObj, 
                mrStats: savedState.mrStats || { text: '0.00 MB (0 Row, 0 Column)' },
                refStats: savedState.refStats || { text: '0.00 MB (0 Row, 0 Column)' },
                neStats: savedState.neStats || { text: '0 Block' },
                cols: savedState.cols || {},
                substrings: savedState.substrings || {},
                mrHeaders: savedState.mrHeaders || [],
                refHeaders: savedState.refHeaders || []
            };

            const safeId = pitId.replace(/\s+/g, '_');
            const buildMethod = window.pitStates[pitId].buildMethod;
            localStorage.setItem(`rizpec_build_type_${safeId}`, buildMethod);
            
            if (savedState.summaryObj) {
                localStorage.setItem(`rizpec_entity_${safeId}_summary`, JSON.stringify(savedState.summaryObj));
            }

            if (typeof RizpecDB !== 'undefined') {
                const metaToSave = {
                    buildMethod: window.pitStates[pitId].buildMethod,
                    mrFileName: window.pitStates[pitId].mrFileName,
                    refFileName: window.pitStates[pitId].refFileName,
                    mrStats: window.pitStates[pitId].mrStats,
                    refStats: window.pitStates[pitId].refStats,
                    neStats: window.pitStates[pitId].neStats,
                    summaryObj: window.pitStates[pitId].summaryObj,
                    originalSummaryObj: window.pitStates[pitId].originalSummaryObj, 
                    cols: window.pitStates[pitId].cols,
                    substrings: window.pitStates[pitId].substrings,
                    mrHeaders: window.pitStates[pitId].mrHeaders,
                    refHeaders: window.pitStates[pitId].refHeaders,
                    refFileApplied: window.pitStates[pitId].refFileApplied
                };
                RizpecDB.set(`rizpec_pit_entity_${safeId}_meta`, metaToSave).catch(e => console.warn(e));
            }

            if (typeof folderState !== 'undefined') folderState[rootName]++;
            if (container && typeof window.makeSubfolderInteractive === 'function') {
                const subEl = document.createElement('div');
                container.appendChild(subEl);
                window.makeSubfolderInteractive(subEl, pitId, rootName);
            }
        }
        
        // [PERBAIKAN MEMORY LEAK 1]: Hapus assignment re-inject ke Global State
        // Data cukup masuk ke IndexedDB saja.
        if (data.pitDataCSVs) {
            for (const [pId, csvStr] of Object.entries(data.pitDataCSVs)) {
                const safeId = pId.replace(/\s+/g, '_');
                try {
                    await RizpecDB.set(`rizpec_pit_entity_${safeId}`, csvStr);
                    // Dihapus: if (window.pitStates[pId]) { window.pitStates[pId].generatedCsv = csvStr; }
                } catch(e) {
                    console.warn("Gagal memulihkan CSV untuk Pit: " + pId);
                }
            }
        }
        
        if (data.activePitId && window.pitStates[data.activePitId]) {
            window.activePitId = data.activePitId;
            window.lastActivePitId = data.activePitId;
        }
    }
    
    // Memulihkan Konfigurasi Disposal State
    if (data.disposalStates) {
        window.disposalStates = {};
        const container = document.getElementById('subfolders-folder-disp');
        const rootName = 'Disposal Data';

        for (const [dispId, savedState] of Object.entries(data.disposalStates)) {
            window.disposalStates[dispId] = {
                mrFileName: savedState.mrFileName || (savedState.mrFilePlaceholder ? savedState.mrFilePlaceholder.name : null),
                refFileName: savedState.refFileName || (savedState.refFilePlaceholder ? savedState.refFilePlaceholder.name : null),
                buildMethod: savedState.buildMethod || (savedState.refFilePlaceholder ? 'CEN' : 'NON_CEN'),
                refFileApplied: savedState.refFileApplied || false,
                mrFile: null, 
                refFile: null, 
                generatedCsv: null, 
                summaryObj: savedState.summaryObj,
                originalSummaryObj: savedState.originalSummaryObj,
                mrStats: savedState.mrStats || { text: '0.00 MB (0 Row, 0 Column)' },
                refStats: savedState.refStats || { text: '0.00 MB (0 Row, 0 Column)' },
                neStats: savedState.neStats || { text: '0 Block' },
                cols: savedState.cols || {},
                substrings: savedState.substrings || {},
                mrHeaders: savedState.mrHeaders || [],
                refHeaders: savedState.refHeaders || []
            };

            const safeId = dispId.replace(/\s+/g, '_');
            const buildMethod = window.disposalStates[dispId].buildMethod;
            localStorage.setItem(`rizpec_disp_build_type_${safeId}`, buildMethod);
            if (savedState.summaryObj) {
                localStorage.setItem(`rizpec_disp_entity_${safeId}_summary`, JSON.stringify(savedState.summaryObj));
            }

            if (typeof RizpecDB !== 'undefined') {
                const metaToSave = {
                    buildMethod: window.disposalStates[dispId].buildMethod,
                    mrFileName: window.disposalStates[dispId].mrFileName,
                    refFileName: window.disposalStates[dispId].refFileName,
                    mrStats: window.disposalStates[dispId].mrStats,
                    refStats: window.disposalStates[dispId].refStats,
                    neStats: window.disposalStates[dispId].neStats,
                    summaryObj: window.disposalStates[dispId].summaryObj,
                    originalSummaryObj: window.disposalStates[dispId].originalSummaryObj,
                    cols: window.disposalStates[dispId].cols,
                    substrings: window.disposalStates[dispId].substrings,
                    mrHeaders: window.disposalStates[dispId].mrHeaders,
                    refHeaders: window.disposalStates[dispId].refHeaders,
                    refFileApplied: window.disposalStates[dispId].refFileApplied
                };
                RizpecDB.set(`rizpec_disp_entity_${safeId}_meta`, metaToSave).catch(e => console.warn(e));
            }

            if (typeof folderState !== 'undefined') folderState[rootName]++;
            if (container && typeof window.makeSubfolderInteractive === 'function') {
                const subEl = document.createElement('div');
                container.appendChild(subEl);
                window.makeSubfolderInteractive(subEl, dispId, rootName);
            }
        }
        
        // [PERBAIKAN MEMORY LEAK 2]: Hapus assignment re-inject ke Global State
        // Data cukup masuk ke IndexedDB saja.
        if (data.dispDataCSVs) {
            for (const [dId, csvStr] of Object.entries(data.dispDataCSVs)) {
                const safeId = dId.replace(/\s+/g, '_');
                try {
                    await RizpecDB.set(`rizpec_disp_entity_${safeId}`, csvStr);
                    // Dihapus: if (window.disposalStates[dId]) { window.disposalStates[dId].generatedCsv = csvStr; }
                } catch(e) {
                    console.warn("Gagal memulihkan CSV untuk Disposal: " + dId);
                }
            }
        }
        
        if (data.activeDisposalId && window.disposalStates[data.activeDisposalId]) {
            window.activeDisposalId = data.activeDisposalId;
            window.lastActiveDisposalId = data.activeDisposalId;
        }
    }

    const imagePromises = [];

    // =========================================================
    // DXF RESTORE LOGIC - DENGAN KONFIGURASI BADGES & TEKSTUR
    // =========================================================
    if (data.dxfLayers && data.dxfLayers.length > 0 && typeof scene !== 'undefined') {
        const rootName = 'DXF Data';
        
        for (const lData of data.dxfLayers) {
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
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.needsUpdate = true;
            }

            lData.meshes.forEach(m => {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3));
                if (m.indices) geo.setIndex(new THREE.Uint32BufferAttribute(m.indices, 1));
                if(m.uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(m.uvs, 2));
                geo.computeVertexNormals();

                const baseMat = new THREE.MeshStandardMaterial({
                    color: m.color, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.1,
                    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
                    transparent: lData.opacity < 1, opacity: lData.opacity
                });
                
                const mesh = new THREE.Mesh(geo, baseMat);
                mesh.userData.originalColor = m.originalColor;
                mesh.userData.originalMaterial = baseMat.clone();
                
                if (texture) {
                    const texMat = baseMat.clone();
                    texMat.map = texture;
                    texMat.color.setHex(0xffffff);
                    mesh.userData.originalMaterialTex = texMat;
                    mesh.userData.hasFootprintMask = true; // Legacy marker
                    
                    if (lData.colorMode === 'Texture') {
                        mesh.material = texMat;
                    }
                }
                
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

            if (lData.colorMode === 'Rainbow') {
                const box = new THREE.Box3().setFromObject(group);
                const minY = box.min.y;
                const maxY = box.max.y;
                const rangeY = maxY - minY || 1; 
                
                const tempColor = new THREE.Color();
                
                group.traverse((child) => {
                    if ((child.isMesh || child.isLineSegments) && child.geometry && child.geometry.attributes.position) {
                        const posAttr = child.geometry.attributes.position;
                        const count = posAttr.count;
                        
                        if (!child.geometry.attributes.color) {
                            child.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
                        }
                        const colAttr = child.geometry.attributes.color;
                        
                        for (let i = 0; i < count; i++) {
                            const y = posAttr.getY(i);
                            const t = Math.max(0, Math.min(1, (y - minY) / rangeY));
                            
                            const hue = 0.75 * (1 - t);
                            tempColor.setHSL(hue, 1.0, 0.5);
                            
                            colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
                        }
                        colAttr.needsUpdate = true;
                        
                        if (child.material) {
                            child.material.vertexColors = true;
                            child.material.color.setHex(0xffffff); 
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }

            scene.add(group);
            
            let restoredTextureMeta = null;
            if (lData.textureMeta && lData.textureBase64) {
                const restoredFile = base64ToFile(lData.textureBase64, lData.textureMeta.name);
                restoredTextureMeta = {
                    name: lData.textureMeta.name,
                    size: lData.textureMeta.size,
                    width: lData.textureMeta.width,
                    height: lData.textureMeta.height,
                    file: restoredFile,
                    gcpPoints: lData.textureMeta.gcpPoints || null,
                    transform: lData.textureMeta.transform || null
                };
            }
            
            if (typeof appLayers !== 'undefined') {
                appLayers.push({
                    id: lData.id, name: lData.name, visible: lData.visible,
                    threeObject: group, colorHex: lData.colorHex, defaultColorHex: lData.defaultColorHex,
                    type: 'dxf', hasFaces: lData.hasFaces, opacity: lData.opacity,
                    
                    clippingEnabled: lData.clippingEnabled || false,
                    colorMode: lData.colorMode || 'Default',
                    visualColor: lData.visualColor || lData.colorHex,
                    clipFootprints: lData.clipFootprints || 'Pit Data',
                    dxfType: lData.dxfType || (lData.hasFaces ? 'Polymesh' : 'Polyline'),
                    fileSize: lData.fileSize || 0,
                    lastModified: lData.lastModified || '-',
                    textureMeta: restoredTextureMeta
                });
            }

            if (typeof RizpecDB !== 'undefined') {
                const safeName = lData.name.replace(/\s+/g, '_');
                const metaDB = lData.metaDB || { dxfType: lData.dxfType || (lData.hasFaces ? 'Polymesh' : 'Polyline') };
                await RizpecDB.set(`rizpec_dxf_entity_${safeName}_meta`, metaDB).catch(()=>{});
            }

            if (typeof window.restoreDxfFolderUI === 'function') {
                window.restoreDxfFolderUI(lData.name);
            }
        }
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

            const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
            const mat = new THREE.MeshStandardMaterial({
                color: m.color, side: THREE.DoubleSide, flatShading: true,
                roughness: isResource ? 0.4 : 0.8, metalness: 0.1,
                polygonOffset: true, polygonOffsetFactor: isResource ? -2 : 1, polygonOffsetUnits: isResource ? -2 : 1,
                transparent: true, opacity: isResource ? (typeof resourceOpacity !== 'undefined' ? resourceOpacity : 1) : (typeof wasteOpacity !== 'undefined' ? wasteOpacity : 1)
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = m.userData;
            
            // [FIX 2] PENTING: Original material tidak boleh hilang dari object mesh, agar tidak error ketika mouse Hover
            mesh.userData.originalMaterial = mat;

            mesh.matrixAutoUpdate = false;
            mesh.updateMatrix();

            if (m.userData.blockKey) {
                const parts = m.userData.blockKey.split('/');
                const entityName = parts[0];
                const entityIdFromUserData = m.userData.entityId || m.userData.pitId || entityName;
                const type = m.userData.type || 'pit';
                
                if (type === 'disp') {
                    mesh.visible = window.loadedDisposals.has(entityIdFromUserData);
                } else {
                    mesh.visible = window.loadedPits.has(entityIdFromUserData);
                }
            }

            // [FIX 3] Mencek status mesh yang ter-record
            if (m.userData.isRecorded) {
                mesh.visible = false; // Langsung di-hide saat di-load 
            }

            const edges = new THREE.EdgesGeometry(geo, isStupa ? 10 : 60);
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                polygonOffset: true, polygonOffsetFactor: isResource ? -3 : 0, polygonOffsetUnits: isResource ? -3 : 0
            });
            const line = new THREE.LineSegments(edges, lineMat);
            line.matrixAutoUpdate = false;
            line.updateMatrix();
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

        // --- [FIX] REBUILD LABELS UNTUK PRO MODES ---
        const proModes = ['Res. Incremental', 'Res. Cumulative', 'Res. Zone'];
        const labelsContainer = document.getElementById('labels-container');
        
        if (labelsContainer) {
            if(getComputedStyle(labelsContainer).position === 'static') {
                labelsContainer.style.position = 'absolute';
                labelsContainer.style.top = '0';
                labelsContainer.style.left = '0';
                labelsContainer.style.width = '100%';
                labelsContainer.style.height = '100%';
                labelsContainer.style.pointerEvents = 'none'; 
                labelsContainer.style.overflow = 'hidden';
            }
            labelsContainer.style.zIndex = '1';

            window.activeLabels = window.activeLabels || [];

            window.loadedPits.forEach(pitId => {
                const mode = window.pitColorModes[pitId];
                if (proModes.includes(mode)) {
                    const blockBoxes = {};
                    const groupStats = {};

                    // 1. Hitung ulang Bounding Box dan Total Volume per GroupKey dari mesh yang di-load
                    Object.values(meshes).forEach(mesh => {
                        if (mesh.userData.entityId === pitId && mesh.userData.groupKey) {
                            const gKey = mesh.userData.groupKey;
                            
                            if (!blockBoxes[gKey]) blockBoxes[gKey] = new THREE.Box3();
                            blockBoxes[gKey].expandByObject(mesh);

                            if (!groupStats[gKey]) groupStats[gKey] = { waste: 0, res: 0 };
                            
                            // Ambil data wasteVol dan resVol yang melekat pada mesh
                            groupStats[gKey].waste += (mesh.userData.wasteVol || 0);
                            groupStats[gKey].res += (mesh.userData.resVol || 0);
                        }
                    });

                    // 2. Buat kembali elemen HTML Labelnya
                    Object.keys(blockBoxes).forEach(gKey => {
                        const box = blockBoxes[gKey];
                        const center = box.getCenter(new THREE.Vector3());
                        center.y = box.max.y + 5; 
                        
                        const g = groupStats[gKey];
                        if (!g) return;

                        const div = document.createElement('div');
                        div.className = 'absolute top-0 left-0 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md shadow-lg border border-slate-500/80 pointer-events-none select-none flex items-center justify-center text-center transition-opacity duration-75 z-10 backdrop-blur-sm';
                        
                        let srText = g.res > 0 ? (g.waste / g.res).toFixed(2) : '-';
                        
                        div.innerHTML = `<span class="${srText !== '-' ? 'text-amber-400' : 'text-slate-200'} drop-shadow-md tracking-widest">SR: ${srText}</span>`;
                        div.style.backgroundColor = 'rgba(15, 23, 42, 0.75)'; 
                        div.style.willChange = 'transform, opacity'; 
                        
                        // Set visibilitas dan opacity sesuai state yang tersimpan
                        div.style.display = window.isLabelLayerVisible ? 'flex' : 'none';
                        div.style.opacity = window.labelOpacity !== undefined ? window.labelOpacity : 1;
                        
                        labelsContainer.appendChild(div);

                        window.activeLabels.push({
                            entityId: pitId,
                            element: div,
                            position: center,
                            vec: new THREE.Vector3()
                        });
                    });
                }
            });
            
            // Re-hook label events jika belum
            if (typeof controls !== 'undefined' && !window.isLabelHooked) {
                controls.addEventListener('change', window.updateLabels);
                window.addEventListener('resize', window.updateLabels);
                window.isLabelHooked = true;
            }
            if (typeof window.updateLabels === 'function') window.updateLabels();
        }
        // --------------------------------------------
    }

    // [FIX 3] Restorasi Sequence secara Spesifik
    if (data.pitSequences) {
        window.pitSequenceRecords = data.pitSequences.records || [];
        window.pitTotalWaste = data.pitSequences.totalWaste || 0;
        window.pitTotalResource = data.pitSequences.totalResource || 0;
        window.pitSequenceCounter = data.pitSequences.counter || 1;
    } else if (data.sequences) {
        // Fallback untuk file .riz versi lama yang menyatukan log pit/disp
        window.pitSequenceRecords = data.sequences.records || [];
        window.pitTotalWaste = data.sequences.totalWaste || 0;
        window.pitTotalResource = data.sequences.totalResource || 0;
        window.pitSequenceCounter = data.sequences.counter || 1;
    }

    if (data.dispSequences) {
        window.dispSequenceRecords = data.dispSequences.records || [];
        window.dispTotalWaste = data.dispSequences.totalWaste || 0;
        window.dispSequenceCounter = data.dispSequences.counter || 1;
    }

    // Mengaplikasikan hide/show pada block mesh yang sempat tersave dengan posisi record
    const recordedKeysToHide = data.recordedKeys || (data.sequences ? data.sequences.recordedKeys : []) || [];
    if (recordedKeysToHide.length > 0 && typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (recordedKeysToHide.includes(m.userData.blockKey)) {
                m.userData.isRecorded = true;
                if (!m.userData.recordType) {
                    m.userData.recordType = (m.userData.type === 'disp' || m.userData.type === 'disposal') ? 'disp' : 'pit';
                }
                m.visible = false;
            }
        });
    }

    if (typeof window.updateSequenceUI === 'function') window.updateSequenceUI();
    if (typeof window.updateRecordedVisibility === 'function') window.updateRecordedVisibility();
    if (typeof window.clearSelection === 'function') window.clearSelection();

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
    
    // ==========================================================
    // [PERBAIKAN MEMORY LEAK 3]: AGGRESSIVE MANUAL GC
    // Menghapus objek data raksasa setelah selesai dikonsumsi.
    // ==========================================================
    if (data) {
        delete data.pitDataCSVs;
        delete data.dispDataCSVs;
        delete data.pitReserve;
        delete data.dxfLayers;
        data = null; 
    }
    // ==========================================================

    setTimeout(() => {
        hideFullscreenLoading();

        const fileTabBtn = document.querySelector('.nav-tab[data-target="panel-file"]');
        if (fileTabBtn) fileTabBtn.click();

        if (window.activePitId && typeof window.selectFolder === 'function') {
            window.selectFolder(window.activePitId, 'Subfolder', 'Pit Data');
        } else if (window.activeDisposalId && typeof window.selectFolder === 'function') {
            window.selectFolder(window.activeDisposalId, 'Subfolder', 'Disposal Data');
        }

        if(typeof updateFileMenuState === 'function') updateFileMenuState();

        if (data && data.pitStates) { // Perlindungan jika 'data' null dari GC
            Object.keys(data.pitStates).forEach(pit => {
                if (!window.loadedPits.has(pit)) {
                    if (typeof window.unloadPitGeometry === 'function') {
                        window.unloadPitGeometry(pit);
                    }
                }
            });
        }
        
        if (data && data.disposalStates) {
            Object.keys(data.disposalStates).forEach(disp => {
                if (!window.loadedDisposals.has(disp)) {
                    if (typeof window.unloadDisposalGeometry === 'function') {
                        window.unloadDisposalGeometry(disp);
                    }
                }
            });
        }
        
        if (typeof window.executeDxfFootprintClipping === 'function' && typeof appLayers !== 'undefined') {
            appLayers.forEach(layer => {
                if (layer.type === 'dxf' && layer.clippingEnabled && layer.hasFaces) {
                    window.executeDxfFootprintClipping(layer);
                }
            });
        }

        if (typeof window.updateDxfListUI === 'function') window.updateDxfListUI();
        if (typeof window.updateGeometryDxfListUI === 'function') window.updateGeometryDxfListUI();
        if (typeof aggregateAllDxfData === 'function') aggregateAllDxfData();
        
    }, 350);
}