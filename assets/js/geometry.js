// ==========================================
// GEOMETRY BUILDER & MANAGER (Pit Reserve)
// DENGAN WEB WORKER, DYNAMIC TIME-CHUNK & MATERIAL CACHING
// ==========================================

// Track state Pit mana saja yang saat ini sedang diload dan dirender
window.loadedPits = window.loadedPits || new Set();
window.renderedPits = window.renderedPits || new Set();

// Inisialisasi Eksplisit Pusat Koordinat Dunia (World Origin)
window.worldOrigin = window.worldOrigin || { x: 0, y: 0, z: 0, isSet: false };

// Lock antrean untuk mencegah Race Condition saat render banyak pit sekaligus
window.isRenderingPits = window.isRenderingPits || false; 

// 1. Fungsi Garbage Collection (Menghapus Geometri Pit Spesifik dari GPU Memory)
window.unloadPitGeometry = function(pitId) {
    if (typeof meshes !== 'undefined' && typeof pitReserveGroup !== 'undefined') {
        const keysToDelete = [];
        
        // FIX NAMA NORMALISASI: Cocokkan string menggunakan underscore & spasi 
        // agar tidak gagal menemukan nama folder yang memiliki spasi ganda ("Pit  1" vs "Pit 1")
        const targetNormalized = pitId.replace(/\s+/g, '_').replace(/_/g, ' ');

        Object.keys(meshes).forEach(key => {
            const meshUserData = meshes[key].userData;
            if (meshUserData && meshUserData.pitId) {
                const currentNormalized = meshUserData.pitId.replace(/\s+/g, '_').replace(/_/g, ' ');
                
                if (currentNormalized === targetNormalized || meshUserData.pitId === pitId) {
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

        // RESET World Origin jika semua pit sudah dihapus / tidak ada lagi yang dimuat
        if (Object.keys(meshes).length === 0) {
            window.worldOrigin = { x: 0, y: 0, z: 0, isSet: false };
        }
    }
    
    window.recalculateGlobalSums();
    if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
    
    // FIX RENDER PAKSA: Jika aplikasi tidak menggunakan animasi loop (requestAnimationFrame terus menerus),
    // Menghapus objek dari scene tidak akan membersihkan layar sampai kamera diputar.
    // Kode ini memaksa renderer untuk segera merefresh tampilan.
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        requestAnimationFrame(() => renderer.render(scene, camera));
    }
};

// 2. Menghitung Ulang Summary UI Setelah Pemuatan/Pengahapusan
window.recalculateGlobalSums = function() {
    let totalOB = 0, totalCoal = 0;
    let uniqueBlocks = new Set();
    
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
            if (isResource) totalCoal += (m.userData.coalMass || 0);
            else totalOB += (m.userData.obVolume || 0);
            uniqueBlocks.add(`${m.userData.blockName}_${m.userData.bench}`);
        });
    }
    
    const elSumBlocks = document.getElementById('sum-blocks');
    if (elSumBlocks) elSumBlocks.textContent = uniqueBlocks.size.toLocaleString();
    
    const elSumOb = document.getElementById('sequence-ob-total');
    if (elSumOb) elSumOb.textContent = Number(totalOB.toFixed(2)).toLocaleString();
    
    const elSumCoal = document.getElementById('sequence-coal-total');
    if (elSumCoal) elSumCoal.textContent = Number(totalCoal.toFixed(2)).toLocaleString();
    
    const elSumSr = document.getElementById('sequence-sr-total');
    if (elSumSr) elSumSr.textContent = totalCoal > 0 ? (totalOB / totalCoal).toFixed(2) : "0.00";
};

// 3. Poller untuk Mengeksekusi Mesh Loading (DENGAN SISTEM ANTREAN / LOCK)
window.renderPendingPits = async function() {
    // Jika sedang merender pit lain, abaikan panggilan ini agar tidak tumpang tindih (Race Condition)
    if (window.isRenderingPits) return; 
    window.isRenderingPits = true;
    
    try {
        let pending = [...window.loadedPits].filter(p => !window.renderedPits.has(p));
        if (pending.length === 0) return;

        if (typeof showFullscreenLoading === 'function') showFullscreenLoading("Membangun 3D Geometry di Background...");
        await new Promise(resolve => setTimeout(resolve, 100));

        // Proses satu persatu agar World Origin di-set dengan benar oleh Pit pertama
        while (pending.length > 0) {
            for (let pit of pending) {
                window.renderedPits.add(pit); // Tandai segera agar tidak diproses ganda
                try {
                    await window.buildPitMesh(pit);
                } catch(err) {
                    window.renderedPits.delete(pit); // Rollback jika gagal
                    console.error("Gagal merender pit:", err);
                }
            }
            // Cek lagi apakah ada pit baru yang dicentang selama loop sebelumnya berjalan
            pending = [...window.loadedPits].filter(p => !window.renderedPits.has(p));
        }

    } finally {
        window.isRenderingPits = false; // Buka kembali kunci antrean
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

// 4. Mengekstrak dan membangun Mesh menggunakan WEB WORKER (Pencegah OOM)
window.buildPitMesh = function(pitId) {
    return new Promise(async (resolve, reject) => {
        try {
            // FIX: PULIHKAN WORLD ORIGIN DARI CACHE MESH JIKA PROJECT BARU SAJA DI-LOAD
            // Ini mencegah Pit baru menumpuk di 0,0,0 karena kehilangan acuan koordinat asli
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

            const key = `rizpec_entity_${pitId.replace(/\s+/g, '_')}`;
            const csvData = await RizpecDB.get(key); 
            if (!csvData) throw new Error("Data CSV tidak ditemukan di database cache.");

            if (typeof isProcessing !== 'undefined') isProcessing = true;

            const stupaMode = typeof isStupaMode !== 'undefined' ? isStupaMode : false;
            const extrusionHeight = typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5;
            
            const workerCode = `
                self.onmessage = function(e) {
                    try {
                        const { csvData, pitId, stupaMode, extrusionHeight, globalCenter } = e.data;
                        
                        let firstLineEnd = csvData.indexOf('\\n');
                        if (firstLineEnd === -1) firstLineEnd = csvData.length;
                        const headersLine = csvData.substring(0, firstLineEnd).trim();
                        const headers = headersLine.split(',').map(h => h.trim().toUpperCase());

                        const getIdx = (name, aliases) => {
                            let idx = headers.indexOf(name);
                            if (idx === -1 && aliases) {
                                for(let a of aliases) { idx = headers.indexOf(a); if(idx !== -1) break; }
                            }
                            return idx;
                        };

                        const idxE1 = getIdx('EASTING_1'); const idxN1 = getIdx('NORTHING_1'); const idxT1 = getIdx('TOPELEVATION_1'); const idxB1 = getIdx('BOTELEVATION_1');
                        const idxE2 = getIdx('EASTING_2'); const idxN2 = getIdx('NORTHING_2'); const idxT2 = getIdx('TOPELEVATION_2'); const idxB2 = getIdx('BOTELEVATION_2');
                        const idxE3 = getIdx('EASTING_3'); const idxN3 = getIdx('NORTHING_3'); const idxT3 = getIdx('TOPELEVATION_3'); const idxB3 = getIdx('BOTELEVATION_3');

                        // FIX: Prioritaskan 'ID BLOCK' (Kolom bentukan sistem) alih-alih 'BLOCKNAME' bawaan user
                        const idxBlock = getIdx('ID BLOCK', ['BLOCKNAME']); 
                        const idxBench = getIdx('ID BENCH', ['BENCH']);
                        const idxSeam = getIdx('ID SEAM', ['SEAM']); 
                        const idxBurden = getIdx('BURDEN');
                        const idxSubset = getIdx('ID SUBSET', ['SUBSET']);
                        
                        const idxRes = getIdx('PRO_RATA_RESOURCE'); const idxWaste = getIdx('PRO_RATA_WASTE');

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                        const blocks = {};

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

                        // HIGH-PERFORMANCE CSV PARSING: Tidak menggunakan split('\\n') menghindari memory overhead
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

                            const blockName = row[idxBlock] ? row[idxBlock].trim() : '';
                            if (!blockName) continue;

                            const bench = row[idxBench] ? row[idxBench].trim() : 'Unknown';
                            let burden = row[idxBurden] ? row[idxBurden].trim().toUpperCase() : '';
                            const seam = row[idxSeam] ? row[idxSeam].trim() : '-';
                            const subset = row[idxSubset] ? row[idxSubset].trim() : '';
                            const resVal = parseFloat(row[idxRes]) || 0;
                            const wasteVal = parseFloat(row[idxWaste]) || 0;

                            if (burden === 'RESOURCE' || burden === 'COAL') burden = 'RESOURCE';
                            else if (burden !== '') burden = 'WASTE';
                            else burden = resVal > 0 ? 'RESOURCE' : 'WASTE';

                            // Gunakan blockName sebagai key yang kuat (Kini formatnya PIT/BLOCK/STRIP/BENCH/SEAM/SUBSET)
                            const blockKey = pitId + '_' + blockName + '_' + burden;

                            if (!blocks[blockKey]) {
                                blocks[blockKey] = {
                                    info: { pitId: pitId, blockKey: blockKey, blockName: blockName, burden: burden, seam: seam, subset: subset, bench: bench, obVolume: 0, coalMass: 0, rawRows: [] },
                                    triangles: []
                                };
                            }

                            if (burden === 'RESOURCE') blocks[blockKey].info.coalMass += resVal;
                            else blocks[blockKey].info.obVolume += wasteVal;
                            
                            // Simpan row untuk kalkulasi Quality jika diperlukan ke depannya
                            blocks[blockKey].info.rawRows.push(row.reduce((acc, val, i) => { acc[headers[i]] = val; return acc; }, {}));

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

                        const bounds = { minX, maxX, minY, maxY, minZ, maxZ };
                        
                        // FIX: Gunakan Global Center jika ada, jika belum hitung tengah dari pit pertama
                        const cX = globalCenter ? globalCenter.x : (minX + maxX) / 2; 
                        const cY = globalCenter ? globalCenter.y : (minY + maxY) / 2; 
                        const cZ = globalCenter ? globalCenter.z : (minZ + maxZ) / 2;

                        const processedBlocks = [];
                        const transferables = [];

                        Object.keys(blocks).forEach(blockKey => {
                            const blockData = blocks[blockKey];
                            const positions = []; const edgesCount = {}; const edgeVertices = {};

                            const addEdge = (pA, pB) => {
                                const round = (val) => Math.round(val * 1000) / 1000;
                                const keyA = round(pA.t[0]) + '_' + round(pA.t[2]); const keyB = round(pB.t[0]) + '_' + round(pB.t[2]);
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
                        });

                        // Kirim balik center yang digunakan agar main thread bisa menyimpannya
                        self.postMessage({ success: true, blocks: processedBlocks, bounds: bounds, centerUsed: {x: cX, y: cY, z: cZ} }, transferables);

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

                // FIX WEB WORKER RACE CONDITION
                const safeIdCheck = pitId.replace(/\s+/g, '_');
                const isStillValid = localStorage.getItem(`rizpec_build_type_${safeIdCheck}`) !== null;
                if (!isStillValid) {
                    console.warn(`Pit "${pitId}" telah dihapus selama worker berjalan. Membatalkan render scene agar tidak menjadi ghost mesh.`);
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    window.loadedPits.delete(pitId);
                    window.renderedPits.delete(pitId);
                    resolve();
                    return;
                }

                const { blocks, bounds, centerUsed } = e.data;

                // Terapkan worldOrigin dari Pit pertama yang berhasil di-load secara mutlak
                if (!window.worldOrigin.isSet && centerUsed) {
                    window.worldOrigin = { x: centerUsed.x, y: centerUsed.y, z: centerUsed.z, isSet: true };
                }

                window.unloadPitGeometry(pitId);
                if (typeof clearLabels === 'function') clearLabels();

                const opacCoal = typeof coalOpacity !== 'undefined' ? coalOpacity : 1;
                const opacOB = typeof obOpacity !== 'undefined' ? obOpacity : 1;

                // Ambil Data Color Palette dari LocalStorage
                const pitColorModes = JSON.parse(localStorage.getItem('rizpec_pit_color_modes')) || {};
                const burdenPalette = JSON.parse(localStorage.getItem('rizpec_burden_palette')) || [];
                const subsetPalette = JSON.parse(localStorage.getItem('rizpec_subset_palette')) || [];

                // --- OPTIMASI 1: MATERIAL CACHING (HEMAT RAM & MENCEGAH GPU OVERLOAD) ---
                // Menggunakan kembali material yang sama untuk kategori yang sama.
                const sharedMaterials = {};
                const sharedLineMaterials = {};

                // --- OPTIMASI 2: TIME-BASED CHUNKING (DYNAMIC PERFORMANCE) ---
                let currentIndex = 0;
                const TIME_BUDGET_MS = 30; // Batas maksimal eksekusi 30 milidetik per frame (Memaksimalkan PC kencang)
                
                const statEl = document.getElementById('stat-new-entity');
                const originalStatText = statEl ? statEl.textContent : '';

                const processChunk = () => {
                    const isStillValidChunk = localStorage.getItem(`rizpec_build_type_${safeIdCheck}`) !== null;
                    if (!isStillValidChunk) {
                        if (typeof isProcessing !== 'undefined') isProcessing = false;
                        window.loadedPits.delete(pitId);
                        window.renderedPits.delete(pitId);
                        resolve();
                        return;
                    }

                    const frameStartTime = performance.now();

                    // Loop sebanyak mungkin SELAMA tidak melebihi alokasi waktu (30ms) agar UI tidak freeze
                    while (currentIndex < blocks.length && (performance.now() - frameStartTime < TIME_BUDGET_MS)) {
                        const b = blocks[currentIndex];
                        let geometry = new THREE.BufferGeometry();
                        geometry.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
                        
                        // FUNGSI BERAT: mergeVertices
                        if (THREE.BufferGeometryUtils) geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, stupaMode ? 0.01 : 0.5); 
                        geometry.computeVertexNormals(); 
                        geometry.computeBoundingBox();

                        const blockPitId = b.info.pitId;
                        const burden = (b.info.burden || '').toUpperCase();
                        const subset = b.info.subset || '';
                        const mode = pitColorModes[blockPitId] || (subset ? 'Subset' : 'Burden'); 

                        let hexColor = '#aaaaaa';
                        if (mode === 'Subset' && subset) {
                            const subsetItem = subsetPalette.find(p => p.name === subset);
                            if (subsetItem) hexColor = subsetItem.color;
                        } else {
                            const isCoal = burden === 'RESOURCE';
                            const burdenItem = burdenPalette.find(p => p.name === (isCoal ? 'Resource' : 'Waste'));
                            if (burdenItem) hexColor = burdenItem.color;
                        }

                        const isCoal = burden === 'RESOURCE';
                        
                        // --- GUNAKAN CACHE MATERIAL ---
                        const matKey = `${blockPitId}_${burden}_${subset}`;
                        let material = sharedMaterials[matKey];
                        
                        if (!material) {
                            material = new THREE.MeshStandardMaterial({ 
                                color: hexColor, side: THREE.DoubleSide, flatShading: true,
                                roughness: isCoal ? 0.4 : 0.8, metalness: 0.1, 
                                polygonOffset: true, polygonOffsetFactor: isCoal ? -2 : 1, polygonOffsetUnits: isCoal ? -2 : 1,
                                transparent: true, opacity: isCoal ? opacCoal : opacOB 
                            });
                            sharedMaterials[matKey] = material;
                        }

                        const mesh = new THREE.Mesh(geometry, material);
                        
                        mesh.userData = { ...b.info, isRecorded: false, centerOffset: centerUsed };
                        
                        mesh.matrixAutoUpdate = false;
                        mesh.updateMatrix();

                        // --- GUNAKAN CACHE LINE MATERIAL ---
                        const lineMatKey = isCoal ? 'coal' : 'ob';
                        let lineMaterial = sharedLineMaterials[lineMatKey];
                        
                        if (!lineMaterial) {
                            lineMaterial = new THREE.LineBasicMaterial({ 
                                color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                                polygonOffset: true, polygonOffsetFactor: isCoal ? -3 : 0, polygonOffsetUnits: isCoal ? -3 : 0
                            });
                            sharedLineMaterials[lineMatKey] = lineMaterial;
                        }

                        const edges = new THREE.EdgesGeometry(geometry, stupaMode ? 10 : 60); 
                        const line = new THREE.LineSegments(edges, lineMaterial);
                        
                        line.matrixAutoUpdate = false;
                        line.updateMatrix();
                        mesh.add(line);

                        if (typeof pitReserveGroup !== 'undefined' && typeof meshes !== 'undefined') {
                            pitReserveGroup.add(mesh); 
                            meshes[b.blockKey] = mesh;
                        }
                        
                        currentIndex++;
                    }

                    // Update UI Progress Loading 3D & Stat Panel
                    const currentCount = Math.min(currentIndex, blocks.length);
                    const percent = Math.round((currentCount / blocks.length) * 100);

                    if (statEl && statEl.textContent !== 'Processing Data...') {
                        statEl.textContent = `Merender 3D... ${percent}% (${currentCount} / ${blocks.length} Mesh)`;
                    }

                    if (typeof updateLoadingProgress === 'function') {
                        updateLoadingProgress(`(${currentCount} / ${blocks.length} Mesh)`);
                    }

                    if (currentIndex < blocks.length) {
                        // Teruskan ke frame render berikutnya agar layar tidak freeze
                        requestAnimationFrame(processChunk);
                    } else {
                        // --- PROSES SELESAI ---
                        if (statEl && statEl.textContent.includes('Merender 3D')) {
                            statEl.textContent = originalStatText; 
                        }

                        window.recalculateGlobalSums();

                        if (typeof appLayers !== 'undefined') {
                            const existingLayer = appLayers.find(l => l.id === 'layer_pit_reserve');
                            if (!existingLayer && typeof pitReserveGroup !== 'undefined') {
                                appLayers.unshift({ id: 'layer_pit_reserve', name: 'Pit Reserve', visible: true, threeObject: pitReserveGroup, colorHex: '#3b82f6', defaultColorHex: '#3b82f6', type: 'csv', hasFaces: false });
                            }
                            if (typeof updateLayerUI === 'function') updateLayerUI();
                        }

                        // Fokus kamera ke SEMUA pit yang sedang dimuat
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
                
                // Mulai siklus asinkron chunking render dengan optimasi waktu
                processChunk();
            };

            worker.onerror = (err) => {
                URL.revokeObjectURL(workerUrl);
                if (typeof isProcessing !== 'undefined') isProcessing = false;
                console.error("Fatal Web Worker Error:", err);
                reject(new Error("Memori Perangkat Penuh saat mengekstrak titik koordinat."));
            };

            // Beritahu Worker apa global center dunia 3D saat ini dari variabel yang valid
            const globalCenter = window.worldOrigin.isSet
                ? { x: window.worldOrigin.x, y: window.worldOrigin.y, z: window.worldOrigin.z }
                : null;

            worker.postMessage({ csvData, pitId, stupaMode, extrusionHeight, globalCenter });

        } catch (err) {
            const cb = document.querySelector(`.pit-checkbox[data-pit="${pitId}"]`);
            if(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
            window.loadedPits.delete(pitId);
            reject(err);
        }
    });
};