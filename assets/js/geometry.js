// ==========================================
// GEOMETRY BUILDER & MANAGER (Pit Reserve)
// DENGAN WEB WORKER UNTUK MENCEGAH OOM
// ==========================================

// Track state Pit mana saja yang saat ini sedang diload dan dirender
window.loadedPits = window.loadedPits || new Set();
window.renderedPits = window.renderedPits || new Set();

// 1. Fungsi Garbage Collection (Menghapus Geometri Pit Spesifik dari GPU Memory)
window.unloadPitGeometry = function(pitId) {
    if (typeof meshes !== 'undefined' && typeof pitReserveGroup !== 'undefined') {
        const keysToDelete = [];
        
        Object.keys(meshes).forEach(key => {
            if (meshes[key].userData && meshes[key].userData.pitId === pitId) {
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
        });
        
        keysToDelete.forEach(k => delete meshes[k]);
    }
    
    window.recalculateGlobalSums();
    if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
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
    
    const elSumOb = document.getElementById('sum-ob');
    if (elSumOb) elSumOb.textContent = Number(totalOB.toFixed(2)).toLocaleString();
    
    const elSumCoal = document.getElementById('sum-coal');
    if (elSumCoal) elSumCoal.textContent = Number(totalCoal.toFixed(2)).toLocaleString();
    
    const elSumSr = document.getElementById('sum-sr');
    if (elSumSr) elSumSr.textContent = totalCoal > 0 ? (totalOB / totalCoal).toFixed(2) : "0.00";
};

// 3. Poller untuk Mengeksekusi Mesh Loading (Dipanggil saat masuk Tab Geometry)
window.renderPendingPits = async function() {
    const pending = [...window.loadedPits].filter(p => !window.renderedPits.has(p));
    if (pending.length === 0) return;
    
    if (typeof showFullscreenLoading === 'function') showFullscreenLoading("Membangun 3D Geometry di Background...");
    
    // Beri jeda UI render untuk memastikan overlay muncul
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        for (let pit of pending) {
            await window.buildPitMesh(pit);
            window.renderedPits.add(pit);
        }
    } catch(err) {
        console.error("Gagal merender pit:", err);
    } finally {
        if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
        
        const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
        if (tabBtn) tabBtn.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse');
    }
};

// Listener global: Jika user klik tab Geometry, langsung periksa dan bangun grafik yang tertunda (pending)
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
            const key = `rizpec_entity_${pitId.replace(/\s+/g, '_')}`;
            const csvData = await RizpecDB.get(key); 
            if (!csvData) throw new Error("Data CSV tidak ditemukan di database cache.");

            if (typeof isProcessing !== 'undefined') isProcessing = true;

            // Parameter Konfigurasi Visual
            const stupaMode = typeof isStupaMode !== 'undefined' ? isStupaMode : false;
            const extrusionHeight = typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5;
            
            // Kode Web Worker (Diisolasi dari Main Thread)
            const workerCode = `
                self.onmessage = function(e) {
                    try {
                        const { csvData, pitId, stupaMode, extrusionHeight } = e.data;
                        const lines = csvData.split(/\\r?\\n/).filter(l => l.trim() !== '');
                        if (lines.length < 2) {
                            self.postMessage({ error: "Data CSV kosong." });
                            return;
                        }

                        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());

                        const getIdx = (name, aliases) => {
                            let idx = headers.indexOf(name);
                            if (idx === -1 && aliases) {
                                for(let a of aliases) {
                                    idx = headers.indexOf(a);
                                    if(idx !== -1) break;
                                }
                            }
                            return idx;
                        };

                        const idxE1 = getIdx('EASTING_1'); const idxN1 = getIdx('NORTHING_1'); const idxT1 = getIdx('TOPELEVATION_1'); const idxB1 = getIdx('BOTELEVATION_1');
                        const idxE2 = getIdx('EASTING_2'); const idxN2 = getIdx('NORTHING_2'); const idxT2 = getIdx('TOPELEVATION_2'); const idxB2 = getIdx('BOTELEVATION_2');
                        const idxE3 = getIdx('EASTING_3'); const idxN3 = getIdx('NORTHING_3'); const idxT3 = getIdx('TOPELEVATION_3'); const idxB3 = getIdx('BOTELEVATION_3');

                        const idxBlock = getIdx('BLOCKNAME', ['ID BLOCK']);
                        const idxBench = getIdx('BENCH', ['ID BENCH']);
                        const idxSeam = getIdx('SEAM', ['ID SEAM']);
                        const idxBurden = getIdx('BURDEN');
                        const idxRes = getIdx('PRO_RATA_RESOURCE');
                        const idxWaste = getIdx('PRO_RATA_WASTE');

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

                        // Ekstraksi dan pengelompokan baris ke block
                        for (let i = 1; i < lines.length; i++) {
                            const row = lines[i].split(',');
                            const e1 = parseFloat(row[idxE1]);
                            if (isNaN(e1)) continue;

                            // Kalkulasi Bounding Box Global
                            [   [row[idxE1], row[idxT1], row[idxN1]],
                                [row[idxE2], row[idxT2], row[idxN2]],
                                [row[idxE3], row[idxT3], row[idxN3]],
                                [row[idxE1], row[idxB1], row[idxN1]]
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
                            const resVal = parseFloat(row[idxRes]) || 0;
                            const wasteVal = parseFloat(row[idxWaste]) || 0;

                            if (burden === 'RESOURCE' || burden === 'COAL') burden = 'RESOURCE';
                            else if (burden !== '') burden = 'WASTE';
                            else burden = resVal > 0 ? 'RESOURCE' : 'WASTE';

                            const blockKey = pitId + '_' + blockName + '_' + bench + '_' + burden;

                            if (!blocks[blockKey]) {
                                blocks[blockKey] = {
                                    info: { pitId: pitId, blockKey: blockKey, blockName: blockName, burden: burden, seam: seam, bench: bench, obVolume: 0, coalMass: 0 },
                                    triangles: []
                                };
                            }

                            if (burden === 'RESOURCE') blocks[blockKey].info.coalMass += resVal;
                            else blocks[blockKey].info.obVolume += wasteVal;

                            let p;
                            if (stupaMode) {
                                let topElev = parseBenchElevation(bench);
                                if (topElev === null) {
                                    let avgTop = (parseFloat(row[idxT1]) + parseFloat(row[idxT2]) + parseFloat(row[idxT3])) / 3;
                                    topElev = isNaN(avgTop) ? 0 : avgTop;
                                }

                                let topY = topElev;
                                let botY = topElev - extrusionHeight;

                                if (burden !== 'RESOURCE') {
                                    topY -= 0.05;
                                    botY += 0.05;
                                }

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
                        const cX = (minX + maxX) / 2;
                        const cY = (minY + maxY) / 2;
                        const cZ = (minZ + maxZ) / 2;

                        const processedBlocks = [];
                        const transferables = [];

                        // Optimasi titik dan pembuatan Array 1D yang efisien memori
                        Object.keys(blocks).forEach(blockKey => {
                            const blockData = blocks[blockKey];
                            const positions = []; 
                            const edgesCount = {}; 
                            const edgeVertices = {};

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

                            // Konversi ke Float32Array agar dapat di transfer menggunakan 0-copy ArrayBuffer
                            const positionsArray = new Float32Array(positions);
                            transferables.push(positionsArray.buffer);

                            processedBlocks.push({
                                blockKey: blockKey,
                                info: blockData.info,
                                positions: positionsArray
                            });
                        });

                        self.postMessage({ success: true, blocks: processedBlocks, bounds: bounds }, transferables);

                    } catch (err) {
                        self.postMessage({ error: err.message });
                    }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            // Listener saat Worker selesai bekerja
            worker.onmessage = (e) => {
                URL.revokeObjectURL(workerUrl); // Bebaskan memori URL
                
                if (e.data.error) {
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    reject(new Error(e.data.error));
                    return;
                }

                const { blocks, bounds } = e.data;

                // 5. Menyusun Mesh di Main Thread menggunakan Buffer Data
                if (typeof worldOrigin !== 'undefined' && !worldOrigin.isSet && bounds.minX !== Infinity) {
                    worldOrigin = { x: (bounds.minX+bounds.maxX)/2, y: (bounds.minY+bounds.maxY)/2, z: (bounds.minZ+bounds.maxZ)/2, isSet: true };
                }

                window.unloadPitGeometry(pitId);
                if (typeof clearLabels === 'function') clearLabels();

                const colorCoal = typeof basicColorCoal !== 'undefined' ? basicColorCoal : 0x000000;
                const colorOB = typeof basicColorOB !== 'undefined' ? basicColorOB : 0xaaaaaa;
                const opacCoal = typeof coalOpacity !== 'undefined' ? coalOpacity : 1;
                const opacOB = typeof obOpacity !== 'undefined' ? obOpacity : 1;

                blocks.forEach(b => {
                    let geometry = new THREE.BufferGeometry();
                    // Import langsung Float32Array hasil kalkulasi di worker
                    geometry.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
                    
                    // Lakukan mergeVertices (Deduplikasi) di Main thread karena butuh fungsi Three.js
                    if (THREE.BufferGeometryUtils) geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, stupaMode ? 0.01 : 0.5); 
                    geometry.computeVertexNormals(); 
                    geometry.computeBoundingBox();

                    const isCoal = b.info.burden.toUpperCase() === 'RESOURCE';
                    const blockColor = isCoal ? colorCoal : colorOB; 
                    
                    const material = new THREE.MeshStandardMaterial({ 
                        color: blockColor, side: THREE.DoubleSide, flatShading: true,
                        roughness: isCoal ? 0.4 : 0.8, metalness: 0.1, 
                        polygonOffset: true, polygonOffsetFactor: isCoal ? -2 : 1, polygonOffsetUnits: isCoal ? -2 : 1,
                        transparent: true, opacity: isCoal ? opacCoal : opacOB 
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.userData = { ...b.info, isRecorded: false };
                    
                    const edges = new THREE.EdgesGeometry(geometry, stupaMode ? 10 : 60); 
                    const lineMaterial = new THREE.LineBasicMaterial({ 
                        color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                        polygonOffset: true, polygonOffsetFactor: isCoal ? -3 : 0, polygonOffsetUnits: isCoal ? -3 : 0
                    });
                    const line = new THREE.LineSegments(edges, lineMaterial);
                    mesh.add(line);

                    if (typeof pitReserveGroup !== 'undefined' && typeof meshes !== 'undefined') {
                        pitReserveGroup.add(mesh); 
                        meshes[b.blockKey] = mesh;
                    }
                });

                // Update UI Settings dan Posisi Kamera
                window.recalculateGlobalSums();

                const optInc = document.querySelector('#pit-processing-select option[value="resgraphic_incremental"]');
                if (optInc) optInc.disabled = false;
                const optCum = document.querySelector('#pit-processing-select option[value="resgraphic_cumulative"]');
                if (optCum) optCum.disabled = false;
                const optQual = document.querySelector('#pit-processing-select option[value="quality"]');
                if (optQual) optQual.disabled = false;

                if (typeof appLayers !== 'undefined') {
                    const existingLayer = appLayers.find(l => l.id === 'layer_pit_reserve');
                    if (!existingLayer && typeof pitReserveGroup !== 'undefined') {
                        appLayers.unshift({ id: 'layer_pit_reserve', name: 'Pit Reserve', visible: true, threeObject: pitReserveGroup, colorHex: '#3b82f6', defaultColorHex: '#3b82f6', type: 'csv', hasFaces: false });
                    }
                    if (typeof updateLayerUI === 'function') updateLayerUI();
                }

                if (typeof meshes !== 'undefined') {
                    const box = new THREE.Box3();
                    Object.values(meshes).forEach(mesh => box.expandByObject(mesh));

                    // Memposisikan kamera otomatis agar pas di tengah data yang baru dimuat
                    if (!box.isEmpty() && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
                        const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        const fov = camera.fov * (Math.PI / 180); let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
                        
                        const elevation = 45 * (Math.PI / 180); 
                        const azimuth = 315 * (Math.PI / 180);

                        camera.position.x = center.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth);
                        camera.position.y = center.y + cameraDistance * Math.sin(elevation);
                        camera.position.z = center.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth);
                        camera.lookAt(center); controls.target.copy(center); controls.update();
                    }
                }

                // Eksekusi fungsi pit processing spesifik jika ada yang aktif
                const pitProcSelect = document.getElementById('pit-processing-select');
                const srLimitInput = document.getElementById('sr-limit');
                if (pitProcSelect) {
                    if (pitProcSelect.value === 'basic' && typeof resetToBasicColors === 'function') resetToBasicColors();
                    else if (pitProcSelect.value === 'resgraphic_incremental' && typeof generateResgraphicIncremental === 'function') generateResgraphicIncremental(parseFloat(srLimitInput?.value) || 5);
                    else if (pitProcSelect.value === 'resgraphic_cumulative' && typeof generateResgraphicCumulative === 'function') generateResgraphicCumulative(parseFloat(srLimitInput?.value) || 5);
                    else if (pitProcSelect.value === 'quality' && typeof generateQuality === 'function') generateQuality();
                }

                if (typeof isProcessing !== 'undefined') isProcessing = false;
                resolve();
            };

            // Handling Error Darurat Worker
            worker.onerror = (err) => {
                URL.revokeObjectURL(workerUrl);
                if (typeof isProcessing !== 'undefined') isProcessing = false;
                console.error("Fatal Web Worker Error:", err);
                reject(new Error("Memori Perangkat Penuh saat mengekstrak titik koordinat."));
            };

            // MULAI PROSES: Kirim data string mentah ke Worker
            worker.postMessage({ csvData, pitId, stupaMode, extrusionHeight });

        } catch (err) {
            // Fallback aman, matikan centang di antarmuka jika awal proses gagal
            const cb = document.querySelector(`.pit-checkbox[data-pit="${pitId}"]`);
            if(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
            window.loadedPits.delete(pitId);
            reject(err);
        }
    });
};