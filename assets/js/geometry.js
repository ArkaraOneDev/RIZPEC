// ==========================================
// GEOMETRY BUILDER & MANAGER
// DENGAN WEB WORKER, DYNAMIC TIME-CHUNK & MATERIAL CACHING
// OPTIMIZED FOR MOBILE/TABLET (ULTRA OOM PREVENTION)
// ==========================================

// Track state Pit & Disposal mana saja yang saat ini sedang diload dan dirender
window.loadedPits = window.loadedPits || new Set();
window.renderedPits = window.renderedPits || new Set();

window.loadedDisposals = window.loadedDisposals || new Set();
window.renderedDisposals = window.renderedDisposals || new Set();

// [UPDATE]: Inisialisasi World Origin Persistent (Bisa bertahan walau di-refresh)
const savedOrigin = localStorage.getItem('rizpec_world_origin');
window.worldOrigin = savedOrigin ? JSON.parse(savedOrigin) : { x: 0, y: 0, z: 0, isSet: false };

// Lock antrean untuk mencegah Race Condition saat render banyak entitas sekaligus
window.isRenderingPits = window.isRenderingPits || false; 

// [UPDATE]: Fungsi untuk mengunci Origin dari CSV TANPA perlu render/centang
window.establishWorldOrigin = function(csvText) {
    if (window.worldOrigin && window.worldOrigin.isSet) return; // Jika sudah ada, jangan ditimpa

    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.replace(/['"]/g, '').trim().toUpperCase());
    const idxE1 = headers.lastIndexOf('EASTING_1');
    const idxN1 = headers.lastIndexOf('NORTHING_1');
    const idxT1 = headers.lastIndexOf('TOPELEVATION_1');

    if (idxE1 === -1 || idxN1 === -1 || idxT1 === -1) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;

    // Scan 500 baris pertama sudah cukup untuk mendapatkan center relatif yang akurat
    const limit = Math.min(lines.length, 500);
    for (let i = 1; i < limit; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        const x = parseFloat(cols[idxE1]);
        const y = parseFloat(cols[idxT1]);
        const z = -parseFloat(cols[idxN1]);

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
    }

    if (minX !== Infinity) {
        window.worldOrigin = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2,
            isSet: true
        };
        localStorage.setItem('rizpec_world_origin', JSON.stringify(window.worldOrigin));
        console.log("World Origin Dikunci dari Background Build:", window.worldOrigin);
    }
};

// 1. Fungsi Garbage Collection Utama (Menghapus Geometri Spesifik dari GPU Memory)
window.unloadGeometry = function(entityId, type) {
    if (typeof meshes !== 'undefined' && typeof pitReserveGroup !== 'undefined') {
        const keysToDelete = [];
        const targetNormalized = entityId.replace(/\s+/g, '_').replace(/_/g, ' ');

        Object.keys(meshes).forEach(key => {
            const meshUserData = meshes[key].userData;
            if (meshUserData && meshUserData.entityId && meshUserData.type === type) {
                const currentNormalized = meshUserData.entityId.replace(/\s+/g, '_').replace(/_/g, ' ');
                
                if (currentNormalized === targetNormalized || meshUserData.entityId === entityId) {
                    const mesh = meshes[key];
                    pitReserveGroup.remove(mesh);
                    
                    // Murni buang dari Memory Kartu Grafis (GPU)
                    if(mesh.geometry) mesh.geometry.dispose();
                    if(mesh.material) mesh.material.dispose();
                    mesh.children.forEach(child => { 
                        if(child.geometry) child.geometry.dispose(); 
                        if(child.material) child.material.dispose(); 
                    });
                    
                    keysToDelete.push(key);
                }
            }
        });
        
        keysToDelete.forEach(k => delete meshes[k]);

        // --- [UPDATE]: TRIGGER AUTO-RELOAD DXF CLIPPING ---
        // Jika data pit/disposal dihapus dari memori layar, kalkulasi ulang pemotongan topografi
        if (typeof window.refreshAllDxfClipping === 'function') {
            window.refreshAllDxfClipping();
        }

        // [UPDATE]: PENTING! Hapus logika reset worldOrigin di sini. 
        // Origin tidak boleh direset saat di-uncheck. Hanya boleh reset saat "New Project".
    }
    
    window.recalculateGlobalSums();
    if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        requestAnimationFrame(() => renderer.render(scene, camera));
    }
};

// Expose fungsi secara spesifik agar kompatibel dengan file manager masing-masing
window.unloadPitGeometry = function(id) { window.unloadGeometry(id, 'pit'); };
window.unloadDisposalGeometry = function(id) { window.unloadGeometry(id, 'disp'); };

// 2. Menghitung Ulang Summary UI
window.recalculateGlobalSums = function() {
    let totalWaste = 0, totalResource = 0, totalDisp = 0;
    let uniqueBlocks = new Set();
    
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (m.userData.type === 'disp') {
                totalDisp += (m.userData.wasteVol || 0); // Disposal (Loose Capacity)
            } else {
                const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
                if (isResource) totalResource += (m.userData.resVol || 0);
                else totalWaste += (m.userData.wasteVol || 0);
            }
            uniqueBlocks.add(`${m.userData.type}_${m.userData.compositeId}`);
        });
    }
    
    const elSumBlocks = document.getElementById('sum-blocks');
    if (elSumBlocks) elSumBlocks.textContent = uniqueBlocks.size.toLocaleString();
    
    // Fallback ID ke format lama jika HTML belum diperbarui secara utuh
    const elSumWaste = document.getElementById('sequence-waste-total') || document.getElementById('sequence-ob-total');
    if (elSumWaste) elSumWaste.textContent = Number((totalWaste + totalDisp).toFixed(2)).toLocaleString();
    
    const elSumResource = document.getElementById('sequence-resource-total') || document.getElementById('sequence-coal-total');
    if (elSumResource) elSumResource.textContent = Number(totalResource.toFixed(2)).toLocaleString();
    
    const elSumSr = document.getElementById('sequence-sr-total');
    if (elSumSr) elSumSr.textContent = totalResource > 0 ? (totalWaste / totalResource).toFixed(2) : "0.00";
};

// 3. Poller untuk Mengeksekusi Mesh Loading (Menangani Pit & Disposal)
window.renderPendingPits = async function() {
    if (window.isRenderingPits) return; 
    window.isRenderingPits = true;
    
    try {
        let pendingPits = [...window.loadedPits].filter(p => !window.renderedPits.has(p));
        let pendingDisposals = [...window.loadedDisposals].filter(p => !window.renderedDisposals.has(p));

        if (pendingPits.length === 0 && pendingDisposals.length === 0) return;

        if (typeof showFullscreenLoading === 'function') showFullscreenLoading("Membangun 3D Geometry di Background...");
        await new Promise(resolve => setTimeout(resolve, 100));

        while (pendingPits.length > 0 || pendingDisposals.length > 0) {
            
            for (let pit of pendingPits) {
                window.renderedPits.add(pit); 
                try {
                    await window.buildGeometryMesh(pit, 'pit');
                } catch(err) {
                    window.renderedPits.delete(pit); 
                    console.error("Gagal merender pit:", err);
                }
            }

            for (let disp of pendingDisposals) {
                window.renderedDisposals.add(disp); 
                try {
                    await window.buildGeometryMesh(disp, 'disp');
                } catch(err) {
                    window.renderedDisposals.delete(disp); 
                    console.error("Gagal merender disposal:", err);
                }
            }

            pendingPits = [...window.loadedPits].filter(p => !window.renderedPits.has(p));
            pendingDisposals = [...window.loadedDisposals].filter(p => !window.renderedDisposals.has(p));
        }

    } finally {
        window.isRenderingPits = false;
        if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
        const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
        if (tabBtn) tabBtn.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse');
    }
};

document.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (tab && tab.dataset.target === 'panel-geometry') {
        setTimeout(() => {
            if (typeof window.renderPendingPits === 'function') window.renderPendingPits();
        }, 50);
    }
});

// 4. Mengekstrak dan membangun Mesh menggunakan WEB WORKER (Dinamis: Pit / Disposal)
window.buildGeometryMesh = function(entityId, type = 'pit') {
    return new Promise(async (resolve, reject) => {
        try {
            // Fallback (jika karena suatu alasan worldOrigin isSet masih false)
            if (!window.worldOrigin.isSet && typeof meshes !== 'undefined') {
                const existingKeys = Object.keys(meshes);
                for (let i = 0; i < existingKeys.length; i++) {
                    const m = meshes[existingKeys[i]];
                    if (m && m.userData && m.userData.centerOffset) {
                        window.worldOrigin = { 
                            x: m.userData.centerOffset.x, 
                            y: m.userData.centerOffset.y, 
                            z: m.userData.centerOffset.z, 
                            isSet: true 
                        };
                        break;
                    }
                }
            }

            const dbPrefix = type === 'pit' ? 'rizpec_pit_entity_' : 'rizpec_disp_entity_';
            const key = `${dbPrefix}${entityId.replace(/\s+/g, '_')}`;
            const csvDataDB = await RizpecDB.get(key); 
            
            if (!csvDataDB) throw new Error(`Data CSV (${type}) tidak ditemukan di database cache.`);

            if (typeof isProcessing !== 'undefined') isProcessing = true;

            const stupaMode = typeof isStupaMode !== 'undefined' ? isStupaMode : false;
            const extrusionHeight = typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5;
            
            const workerCode = `
                self.onmessage = function(e) {
                    try {
                        let { csvData, entityId, type, stupaMode, extrusionHeight, globalCenter } = e.data;
                        
                        let firstLineEnd = csvData.indexOf('\\n');
                        if (firstLineEnd === -1) firstLineEnd = csvData.length;
                        const headersLine = csvData.substring(0, firstLineEnd).trim();
                        
                        // Hapus quotes (") jika ada dari format CSV
                        const headers = headersLine.split(',').map(h => h.replace(/['"]/g, '').trim().toUpperCase());

                        // Pemetaan Kolom Murni Tanpa Alias (Menggunakan lastIndexOf untuk kolom re-format hasil Rizpec paling ujung)
                        const idxE1 = headers.lastIndexOf('EASTING_1'); const idxN1 = headers.lastIndexOf('NORTHING_1'); const idxT1 = headers.lastIndexOf('TOPELEVATION_1'); const idxB1 = headers.lastIndexOf('BOTELEVATION_1');
                        const idxE2 = headers.lastIndexOf('EASTING_2'); const idxN2 = headers.lastIndexOf('NORTHING_2'); const idxT2 = headers.lastIndexOf('TOPELEVATION_2'); const idxB2 = headers.lastIndexOf('BOTELEVATION_2');
                        const idxE3 = headers.lastIndexOf('EASTING_3'); const idxN3 = headers.lastIndexOf('NORTHING_3'); const idxT3 = headers.lastIndexOf('TOPELEVATION_3'); const idxB3 = headers.lastIndexOf('BOTELEVATION_3');

                        const idxComposite = type === 'pit' ? headers.lastIndexOf('ID P-COMPOSITE') : headers.lastIndexOf('ID D-COMPOSITE');
                        const idxBench = type === 'pit' ? headers.lastIndexOf('ID P-BENCH') : headers.lastIndexOf('ID D-BENCH');
                        const idxSubset = type === 'pit' ? headers.lastIndexOf('ID P-SUBSET') : headers.lastIndexOf('ID D-SUBSET');
                        const idxBurden = headers.lastIndexOf('BURDEN');

                        let idxWaste = -1;
                        let idxRes = -1;
                        
                        if (type === 'pit') {
                            idxWaste = headers.lastIndexOf('PRO_RATA_WASTE');
                            idxRes = headers.lastIndexOf('PRO_RATA_RESOURCE');
                        } else {
                            idxWaste = headers.lastIndexOf('LOOSE_VOLUME');
                            if (idxWaste === -1) idxWaste = headers.lastIndexOf('BANK_VOLUME');
                        }

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                        let blocks = {};

                        function parseBenchElevation(benchStr) {
                            if (!benchStr) return null;
                            const str = benchStr.trim().toUpperCase();
                            if (str.startsWith('M') || str.startsWith('P')) {
                                const numMatch = str.match(/\\d+(?:\\.\\d+)?/);
                                if (numMatch) return str.startsWith('M') ? -parseFloat(numMatch[0]) : parseFloat(numMatch[0]);
                            }
                            const numMatch = str.match(/-?\\d+(?:\\.\\d+)?/);
                            if (numMatch) return parseFloat(numMatch[0]);
                            return null;
                        }

                        let lastIndex = firstLineEnd + 1;
                        while (lastIndex < csvData.length) {
                            let nextIndex = csvData.indexOf('\\n', lastIndex);
                            if (nextIndex === -1) nextIndex = csvData.length;
                            
                            let line = csvData.substring(lastIndex, nextIndex).trim();
                            lastIndex = nextIndex + 1;
                            
                            if (!line) continue;
                            
                            const row = line.split(',');
                            const e1 = parseFloat(row[idxE1]);
                            if (isNaN(e1)) continue;

                            [   [row[idxE1], row[idxT1], row[idxN1]], [row[idxE2], row[idxT2], row[idxN2]],
                                [row[idxE3], row[idxT3], row[idxN3]], [row[idxE1], row[idxB1], row[idxN1]]
                            ].forEach(c => {
                                let x = parseFloat(c[0]), y = parseFloat(c[1]), z = -parseFloat(c[2]);
                                if(x < minX) minX = x; if(x > maxX) maxX = x;
                                if(y < minY) minY = y; if(y > maxY) maxY = y;
                                if(z < minZ) minZ = z; if(z > maxZ) maxZ = z;
                            });

                            // Resolve Unique ID dengan membersihkan Quotes tanpa fallback aneh-aneh
                            let compositeId = '';
                            if (idxComposite !== -1 && row[idxComposite]) compositeId = row[idxComposite].replace(/['"]/g, '').trim();
                            else compositeId = 'Row_' + lastIndex;

                            if (!compositeId) compositeId = 'Unknown_Block';

                            const bench = idxBench !== -1 && row[idxBench] ? row[idxBench].replace(/['"]/g, '').trim() : 'Unknown';
                            const subset = idxSubset !== -1 && row[idxSubset] ? row[idxSubset].replace(/['"]/g, '').trim() : '';
                            let burden = idxBurden !== -1 && row[idxBurden] ? row[idxBurden].replace(/['"]/g, '').trim().toUpperCase() : '';
                            
                            const resVal = idxRes !== -1 ? (parseFloat(row[idxRes]) || 0) : 0;
                            const wasteVal = idxWaste !== -1 ? (parseFloat(row[idxWaste]) || 0) : 0;

                            if (type === 'pit') {
                                if (burden === 'RESOURCE' || burden === 'COAL') burden = 'RESOURCE'; // Fallback manual raw CSV kalau masih ada Coal
                                else if (burden !== '') burden = 'WASTE';
                                else burden = resVal > 0 ? 'RESOURCE' : 'WASTE';
                            } else {
                                // Disposal selalu dikategorikan Waste dalam logika Burden 3D
                                burden = 'WASTE';
                            }

                            // Kita gunakan EntityID + Composite ID agar benar-benar unik antar pit/disposal
                            const blockKey = entityId + '_' + compositeId;

                            if (!blocks[blockKey]) {
                                blocks[blockKey] = {
                                    info: { 
                                        entityId: entityId, 
                                        type: type, 
                                        blockKey: blockKey, 
                                        compositeId: compositeId, 
                                        burden: burden, 
                                        subset: subset, 
                                        bench: bench, 
                                        wasteVol: 0, 
                                        resVol: 0 
                                    },
                                    triangles: []
                                };
                            }

                            if (burden === 'RESOURCE') blocks[blockKey].info.resVol += resVal;
                            else blocks[blockKey].info.wasteVol += wasteVal;
                            
                            let p;
                            if (stupaMode) {
                                let topElev = parseBenchElevation(bench);
                                if (topElev === null) {
                                    let avgTop = (parseFloat(row[idxT1]) + parseFloat(row[idxT2]) + parseFloat(row[idxT3])) / 3;
                                    topElev = isNaN(avgTop) ? 0 : avgTop;
                                }
                                let topY = topElev; let botY = topElev - extrusionHeight;
                                if (burden !== 'RESOURCE') { topY -= 0.05; botY += 0.05; }
                                p = {
                                    t1: [parseFloat(row[idxE1]), topY, -parseFloat(row[idxN1])], t2: [parseFloat(row[idxE2]), topY, -parseFloat(row[idxN2])], t3: [parseFloat(row[idxE3]), topY, -parseFloat(row[idxN3])],
                                    b1: [parseFloat(row[idxE1]), botY, -parseFloat(row[idxN1])], b2: [parseFloat(row[idxE2]), botY, -parseFloat(row[idxN2])], b3: [parseFloat(row[idxE3]), botY, -parseFloat(row[idxN3])]
                                };
                            } else {
                                p = {
                                    t1: [parseFloat(row[idxE1]), parseFloat(row[idxT1]), -parseFloat(row[idxN1])], t2: [parseFloat(row[idxE2]), parseFloat(row[idxT2]), -parseFloat(row[idxN2])], t3: [parseFloat(row[idxE3]), parseFloat(row[idxT3]), -parseFloat(row[idxN3])],
                                    b1: [parseFloat(row[idxE1]), parseFloat(row[idxB1]), -parseFloat(row[idxN1])], b2: [parseFloat(row[idxE2]), parseFloat(row[idxB2]), -parseFloat(row[idxN2])], b3: [parseFloat(row[idxE3]), parseFloat(row[idxB3]), -parseFloat(row[idxN3])]
                                };
                            }
                            blocks[blockKey].triangles.push(p);
                        }

                        // --- OPTIMASI EKSTREM 1: Bersihkan string mentah raksasa dari Memori/RAM seketika!
                        csvData = null; 

                        const bounds = { minX, maxX, minY, maxY, minZ, maxZ };
                        
                        const cX = globalCenter ? globalCenter.x : (minX + maxX) / 2; 
                        const cY = globalCenter ? globalCenter.y : (minY + maxY) / 2; 
                        const cZ = globalCenter ? globalCenter.z : (minZ + maxZ) / 2;

                        let processedBlocks = [];
                        let transferables = [];

                        Object.keys(blocks).forEach(blockKey => {
                            const blockData = blocks[blockKey];
                            const positions = []; const edgesCount = {}; const edgeVertices = {};

                            const addEdge = (pA, pB) => {
                                const keyA = Math.round(pA.t[0]*10) + '_' + Math.round(pA.t[2]*10); 
                                const keyB = Math.round(pB.t[0]*10) + '_' + Math.round(pB.t[2]*10);
                                const edgeKey = keyA < keyB ? keyA+'|'+keyB : keyB+'|'+keyA;
                                if (!edgesCount[edgeKey]) { edgesCount[edgeKey] = 0; edgeVertices[edgeKey] = [pA, pB]; }
                                edgesCount[edgeKey]++;
                            };

                            blockData.triangles.forEach(p => {
                                const t1 = [p.t1[0] - cX, p.t1[1] - cY, p.t1[2] - cZ]; const t2 = [p.t2[0] - cX, p.t2[1] - cY, p.t2[2] - cZ]; const t3 = [p.t3[0] - cX, p.t3[1] - cY, p.t3[2] - cZ];
                                const b1 = [p.b1[0] - cX, p.b1[1] - cY, p.b1[2] - cZ]; const b2 = [p.b2[0] - cX, p.b2[1] - cY, p.b2[2] - cZ]; const b3 = [p.b3[0] - cX, p.b3[1] - cY, p.b3[2] - cZ];
                                addEdge({t: t1, b: b1}, {t: t2, b: b2}); addEdge({t: t2, b: b2}, {t: t3, b: b3}); addEdge({t: t3, b: b3}, {t: t1, b: b1});
                                positions.push(...t1, ...t2, ...t3, ...b1, ...b3, ...b2);
                            });

                            Object.keys(edgesCount).forEach(key => {
                                if (edgesCount[key] === 1) {
                                    const [pA, pB] = edgeVertices[key]; positions.push(...pA.t, ...pA.b, ...pB.b, ...pA.t, ...pB.b, ...pB.t);
                                }
                            });

                            const positionsArray = new Float32Array(positions);
                            transferables.push(positionsArray.buffer);

                            processedBlocks.push({ blockKey: blockKey, info: blockData.info, positions: positionsArray });
                            
                            // --- OPTIMASI EKSTREM 2: Mencegah Memory Spike! ---
                            // Hapus referensi data Object mentah per-blok SATU PER SATU segera setelah berubah jadi Array Biner
                            delete blocks[blockKey];
                        });

                        // Sisa blok root
                        blocks = null; 

                        self.postMessage({ success: true, blocks: processedBlocks, bounds: bounds, centerUsed: {x: cX, y: cY, z: cZ} }, transferables);
                        
                        processedBlocks = null;
                        transferables = null;

                    } catch (err) { self.postMessage({ error: err.message }); }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            worker.onmessage = (e) => {
                URL.revokeObjectURL(workerUrl); 
                
                if (e.data.error) {
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    reject(new Error(e.data.error)); return;
                }

                const safeIdCheck = entityId.replace(/\s+/g, '_');
                const lsPrefix = type === 'pit' ? 'rizpec_build_type_' : 'rizpec_disp_build_type_';
                const isStillValid = localStorage.getItem(`${lsPrefix}${safeIdCheck}`) !== null;
                
                if (!isStillValid) {
                    console.warn(`Geometri "${entityId}" telah dihapus atau dire-build. Membatalkan render.`);
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    if (type === 'pit') {
                        window.loadedPits.delete(entityId);
                        window.renderedPits.delete(entityId);
                    } else {
                        window.loadedDisposals.delete(entityId);
                        window.renderedDisposals.delete(entityId);
                    }
                    resolve();
                    return;
                }

                let { blocks, bounds, centerUsed } = e.data;

                if (!window.worldOrigin.isSet && centerUsed) {
                    window.worldOrigin = { x: centerUsed.x, y: centerUsed.y, z: centerUsed.z, isSet: true };
                }

                // Bersihkan eksisting dari entity ini jika ada sebelumnya
                window.unloadGeometry(entityId, type);
                if (typeof clearLabels === 'function') clearLabels();

                const opacResource = typeof resourceOpacity !== 'undefined' ? resourceOpacity : 1;
                const opacWaste = typeof wasteOpacity !== 'undefined' ? wasteOpacity : 1;

                // Load proper palette based on entity type
                const pitColorModes = JSON.parse(localStorage.getItem(type === 'pit' ? 'rizpec_pit_color_modes' : 'rizpec_disp_color_modes')) || {};
                const burdenPalette = JSON.parse(localStorage.getItem(type === 'pit' ? 'rizpec_burden_palette' : 'rizpec_disp_burden_palette')) || [];
                const subsetPalette = JSON.parse(localStorage.getItem(type === 'pit' ? 'rizpec_subset_palette' : 'rizpec_disp_subset_palette')) || [];

                const sharedMaterials = {};
                const sharedLineMaterials = {};

                let currentIndex = 0;
                
                const TIME_BUDGET_MS = 15; 
                
                const statEl = document.getElementById('stat-new-entity');
                const originalStatText = statEl ? statEl.textContent : '';

                const processChunk = () => {
                    const isStillValidChunk = localStorage.getItem(`${lsPrefix}${safeIdCheck}`) !== null;
                    if (!isStillValidChunk) {
                        if (typeof isProcessing !== 'undefined') isProcessing = false;
                        if (type === 'pit') {
                            window.loadedPits.delete(entityId);
                            window.renderedPits.delete(entityId);
                        } else {
                            window.loadedDisposals.delete(entityId);
                            window.renderedDisposals.delete(entityId);
                        }
                        blocks = null;
                        resolve();
                        return;
                    }

                    const frameStartTime = performance.now();

                    while (currentIndex < blocks.length && (performance.now() - frameStartTime < TIME_BUDGET_MS)) {
                        const b = blocks[currentIndex];
                        let geometry = new THREE.BufferGeometry();
                        geometry.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
                        
                        const vertexCount = b.positions.length / 3;
                        const SAFE_VERTEX_LIMIT = 30000; 
                        
                        if (THREE.BufferGeometryUtils && vertexCount <= SAFE_VERTEX_LIMIT) {
                            try {
                                const mergedGeom = THREE.BufferGeometryUtils.mergeVertices(geometry, stupaMode ? 0.01 : 0.5);
                                geometry.dispose(); 
                                geometry = mergedGeom;
                            } catch (mergeErr) {
                                console.warn("Skip mergeVertices: Memori penuh", mergeErr);
                            }
                        } else if (vertexCount > SAFE_VERTEX_LIMIT) {
                            console.warn(`Blok ${b.info.blockKey} terlalu berat (${vertexCount} vertex). Skip mergeVertices untuk hindari OOM di Tablet.`);
                        }
                        
                        geometry.computeBoundingBox();

                        const blockEntityId = b.info.entityId;
                        const burden = (b.info.burden || '').toUpperCase();
                        const subset = b.info.subset || '';
                        const mode = pitColorModes[blockEntityId] || (subset ? 'Subset' : 'Burden'); 

                        const isResource = burden === 'RESOURCE';

                        let hexColor = '#aaaaaa';
                        if (mode === 'Subset' && subset) {
                            const subsetItem = subsetPalette.find(p => p.name === subset);
                            if (subsetItem) hexColor = subsetItem.color;
                        } else {
                            const searchName = type === 'pit' ? (isResource ? 'Resource' : 'Waste') : 'Waste';
                            const burdenItem = burdenPalette.find(p => p.name === searchName);
                            if (burdenItem) hexColor = burdenItem.color;
                        }

                        const matKey = `${blockEntityId}_${burden}_${subset}`;
                        let material = sharedMaterials[matKey];
                        
                        if (!material) {
                            material = new THREE.MeshStandardMaterial({ 
                                color: hexColor, side: THREE.DoubleSide, flatShading: true,
                                roughness: isResource ? 0.4 : 0.8, metalness: 0.1, 
                                polygonOffset: true, polygonOffsetFactor: isResource ? -2 : 1, polygonOffsetUnits: isResource ? -2 : 1,
                                transparent: true, opacity: isResource ? opacResource : opacWaste 
                            });
                            sharedMaterials[matKey] = material;
                        }

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.userData = { ...b.info, isRecorded: false, centerOffset: centerUsed };
                        mesh.matrixAutoUpdate = false;
                        mesh.updateMatrix();

                        if (vertexCount <= SAFE_VERTEX_LIMIT * 1.5) {
                            const lineMatKey = isResource ? 'resource' : 'waste';
                            let lineMaterial = sharedLineMaterials[lineMatKey];
                            
                            if (!lineMaterial) {
                                lineMaterial = new THREE.LineBasicMaterial({ 
                                    color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                                    polygonOffset: true, polygonOffsetFactor: isResource ? -3 : 0, polygonOffsetUnits: isResource ? -3 : 0
                                });
                                sharedLineMaterials[lineMatKey] = lineMaterial;
                            }

                            const edges = new THREE.EdgesGeometry(geometry, stupaMode ? 10 : 60); 
                            const line = new THREE.LineSegments(edges, lineMaterial);
                            line.matrixAutoUpdate = false;
                            line.updateMatrix();
                            mesh.add(line);
                        }

                        // PitReserveGroup kita gunakan sebagai container global 3D Data
                        if (typeof pitReserveGroup !== 'undefined' && typeof meshes !== 'undefined') {
                            pitReserveGroup.add(mesh); 
                            meshes[b.blockKey] = mesh;
                        }
                        
                        b.positions = null;
                        
                        currentIndex++;
                    }

                    const currentCount = Math.min(currentIndex, blocks.length);
                    const percent = Math.round((currentCount / blocks.length) * 100);

                    if (statEl && statEl.textContent !== 'Processing Data...') {
                        statEl.textContent = `Merender 3D... ${percent}% (${currentCount} / ${blocks.length} Mesh)`;
                    }

                    if (typeof updateLoadingProgress === 'function') {
                        updateLoadingProgress(`(${currentCount} / ${blocks.length} Mesh)`);
                    }

                    if (currentIndex < blocks.length) {
                        requestAnimationFrame(processChunk);
                    } else {
                        blocks = null;

                        if (statEl && statEl.textContent.includes('Merender 3D')) {
                            statEl.textContent = originalStatText; 
                        }

                        window.recalculateGlobalSums();

                        // --- [UPDATE]: TRIGGER AUTO-RELOAD DXF CLIPPING ---
                        // Memastikan jika DXF sedang di-masking, dia akan menghitung ulang ukurannya terhadap geometri Pit baru ini
                        if (typeof window.refreshAllDxfClipping === 'function') {
                            window.refreshAllDxfClipping();
                        }

                        if (typeof appLayers !== 'undefined') {
                            const existingLayer = appLayers.find(l => l.id === 'layer_pit_reserve');
                            if (!existingLayer && typeof pitReserveGroup !== 'undefined') {
                                appLayers.unshift({ id: 'layer_pit_reserve', name: 'Pit Data', visible: true, threeObject: pitReserveGroup, colorHex: '#3b82f6', defaultColorHex: '#3b82f6', type: 'csv', hasFaces: false });
                            }
                            if (typeof updateLayerUI === 'function') updateLayerUI();
                        }

                        if (typeof meshes !== 'undefined' && Object.keys(meshes).length > 0) {
                            const box = new THREE.Box3();
                            Object.values(meshes).forEach(mesh => box.expandByObject(mesh));

                            if (!box.isEmpty() && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
                                const center = box.getCenter(new THREE.Vector3()); 
                                const size = box.getSize(new THREE.Vector3());
                                const maxDim = Math.max(size.x, size.y, size.z);
                                const fov = camera.fov * (Math.PI / 180); 
                                let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
                                
                                if (camera.far < cameraDistance * 3) {
                                    camera.far = cameraDistance * 3;
                                    camera.updateProjectionMatrix();
                                }

                                const elevation = 45 * (Math.PI / 180); 
                                const azimuth = 315 * (Math.PI / 180);

                                camera.position.x = center.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth);
                                camera.position.y = center.y + cameraDistance * Math.sin(elevation);
                                camera.position.z = center.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth);
                                camera.lookAt(center); 
                                controls.target.copy(center); 
                                controls.update();
                            }
                        }

                        if (typeof isProcessing !== 'undefined') isProcessing = false;
                        
                        if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
                            requestAnimationFrame(() => renderer.render(scene, camera));
                        }
                        
                        resolve();
                    }
                };
                
                processChunk();
            };

            worker.onerror = (err) => {
                URL.revokeObjectURL(workerUrl);
                if (typeof isProcessing !== 'undefined') isProcessing = false;
                console.error("Fatal Web Worker Error:", err);
                reject(new Error("Memori Perangkat Penuh saat mengekstrak titik koordinat. (Data terlalu besar untuk RAM device)"));
            };

            const globalCenter = window.worldOrigin.isSet
                ? { x: window.worldOrigin.x, y: window.worldOrigin.y, z: window.worldOrigin.z }
                : null;

            worker.postMessage({ csvData: csvDataDB, entityId, type, stupaMode, extrusionHeight, globalCenter });

        } catch (err) {
            if (type === 'pit') {
                const cb = document.querySelector(`.pit-checkbox[data-pit="${entityId}"]`);
                if(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
                window.loadedPits.delete(entityId);
            } else {
                const cb = document.querySelector(`.disp-checkbox[data-disp="${entityId}"]`);
                if(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
                window.loadedDisposals.delete(entityId);
            }
            reject(err);
        }
    });
};