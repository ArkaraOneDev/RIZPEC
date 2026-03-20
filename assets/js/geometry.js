// ==========================================
// GEOMETRY BUILDER & MANAGER (Pit Reserve)
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
    
    if (typeof showFullscreenLoading === 'function') showFullscreenLoading("Membangun 3D Geometry...");
    
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

// 4. Mengekstrak dan membangun Mesh dengan Basis Async Promise
window.buildPitMesh = function(pitId) {
    return new Promise(async (resolve, reject) => {
        try {
            const key = `rizpec_entity_${pitId.replace(/\s+/g, '_')}`;
            const csvData = await RizpecDB.get(key); 
            if (!csvData) throw new Error("Data CSV tidak ditemukan di database cache.");

            const lines = csvData.split(/\r?\n/).filter(l => l.trim() !== '');
            const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
            const parsedData = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const row = {};
                headers.forEach((h, idx) => row[h] = values[idx] ? values[idx].trim() : '');

                row.BLOCKNAME = row['ID BLOCK'] || row['BLOCKNAME'];
                row.BENCH = row['ID BENCH'] || row['BENCH'];
                row.SEAM = row['ID SEAM'] || row['SEAM'];

                let resVal = parseFloat(row['PRO_RATA_RESOURCE']) || 0;
                let wasteVal = parseFloat(row['PRO_RATA_WASTE']) || 0;
                let originalBurden = row['BURDEN'] ? row['BURDEN'].toUpperCase() : '';
                
                if (originalBurden === 'RESOURCE' || originalBurden === 'COAL') row.BURDEN = 'RESOURCE';
                else if (originalBurden !== '') row.BURDEN = 'WASTE';
                else row.BURDEN = resVal > 0 ? 'RESOURCE' : 'WASTE';

                row.RAWRECMASS = resVal;
                row.TOTALVOLUME = wasteVal;
                
                parsedData.push(row);
            }

            await processDataPromise(parsedData, pitId, false);
            resolve();
        } catch (err) {
            reject(err);
            // Fallback aman, matikan centang di antarmuka jika memori grafis gagal
            const cb = document.querySelector(`.pit-checkbox[data-pit="${pitId}"]`);
            if(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
            window.loadedPits.delete(pitId);
        }
    });
};

function parseBenchElevation(benchStr) {
    if (!benchStr) return null;
    const str = benchStr.trim().toUpperCase();
    if (str.startsWith('M') || str.startsWith('P')) {
        const numMatch = str.match(/\d+(?:\.\d+)?/);
        if (numMatch) return str.startsWith('M') ? -parseFloat(numMatch[0]) : parseFloat(numMatch[0]);
    }
    const numMatch = str.match(/-?\d+(?:\.\d+)?/);
    if (numMatch) return parseFloat(numMatch[0]);
    return null;
}

// 5. Fungsi Core Rendering (Dikonversi Menjadi Promise Non-Blocking)
function processDataPromise(data, pitId, skipCameraReset = false) {
    return new Promise((resolve) => {
        if (typeof isProcessing !== 'undefined') isProcessing = true; 
        
        setTimeout(() => {
            try {
                const stupaMode = typeof isStupaMode !== 'undefined' ? isStupaMode : false;
                const extrusionHeight = typeof currentExtrusion !== 'undefined' ? currentExtrusion : 5;
                const colorCoal = typeof basicColorCoal !== 'undefined' ? basicColorCoal : 0x000000;
                const colorOB = typeof basicColorOB !== 'undefined' ? basicColorOB : 0xaaaaaa;
                const opacCoal = typeof coalOpacity !== 'undefined' ? coalOpacity : 1;
                const opacOB = typeof obOpacity !== 'undefined' ? obOpacity : 1;

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                
                // Mencari Bounding Box Ekstrem dari koordinat Pit
                data.forEach(row => {
                    const e1 = parseFloat(row.EASTING_1);
                    if (isNaN(e1)) return; 
                    [   [row.EASTING_1, row.TOPELEVATION_1, row.NORTHING_1],
                        [row.EASTING_2, row.TOPELEVATION_2, row.NORTHING_2],
                        [row.EASTING_3, row.TOPELEVATION_3, row.NORTHING_3],
                        [row.EASTING_1, row.BOTELEVATION_1, row.NORTHING_1] 
                    ].forEach(c => {
                        let x = parseFloat(c[0]), y = parseFloat(c[1]), z = -parseFloat(c[2]); 
                        if(x < minX) minX = x; if(x > maxX) maxX = x;
                        if(y < minY) minY = y; if(y > maxY) maxY = y;
                        if(z < minZ) minZ = z; if(z > maxZ) maxZ = z;
                    });
                });

                // Menentukan poros tengah dunia (origin) jika belum di-set
                if (typeof worldOrigin !== 'undefined' && !worldOrigin.isSet && minX !== Infinity) {
                    worldOrigin = { x: (minX+maxX)/2, y: (minY+maxY)/2, z: (minZ+maxZ)/2, isSet: true };
                }
                const cX = typeof worldOrigin !== 'undefined' ? worldOrigin.x : 0;
                const cY = typeof worldOrigin !== 'undefined' ? worldOrigin.y : 0;
                const cZ = typeof worldOrigin !== 'undefined' ? worldOrigin.z : 0;

                const blocks = {};
                
                if (typeof isOBVisible !== 'undefined') isOBVisible = true; 
                if (typeof isCoalVisible !== 'undefined') isCoalVisible = true; 
                if (typeof isLabelLayerVisible !== 'undefined') isLabelLayerVisible = true;

                data.forEach(row => {
                    if (isNaN(parseFloat(row.EASTING_1))) return; 
                    const blockName = row.BLOCKNAME;
                    if (!blockName) return;

                    const bench = row.BENCH || 'Unknown';
                    const burden = row.BURDEN || 'Unknown';
                    
                    const blockKey = `${pitId}_${blockName}_${bench}_${burden}`;

                    if (!blocks[blockKey]) {
                        blocks[blockKey] = {
                            info: { pitId: pitId, blockKey: blockKey, blockName: blockName, burden: burden, seam: row.SEAM || '-', bench: bench, obVolume: 0, coalMass: 0 },
                            triangles: [], rawRows: [] 
                        };
                    }
                    blocks[blockKey].rawRows.push(row);

                    const isResource = (row.BURDEN || '').toUpperCase() === 'RESOURCE';
                    if (isResource) blocks[blockKey].info.coalMass += parseFloat(row.RAWRECMASS) || 0;
                    else blocks[blockKey].info.obVolume += parseFloat(row.TOTALVOLUME) || 0;

                    let p;
                    if (stupaMode) {
                        let topElev = parseBenchElevation(bench);
                        if (topElev === null) {
                            let avgTop = (parseFloat(row.TOPELEVATION_1) + parseFloat(row.TOPELEVATION_2) + parseFloat(row.TOPELEVATION_3)) / 3;
                            topElev = isNaN(avgTop) ? 0 : avgTop;
                        }
                        
                        let topY = topElev;
                        let botY = topElev - extrusionHeight;

                        if (!isResource) {
                            topY -= 0.05;
                            botY += 0.05;
                        }

                        p = {
                            t1: [parseFloat(row.EASTING_1), topY, -parseFloat(row.NORTHING_1)], t2: [parseFloat(row.EASTING_2), topY, -parseFloat(row.NORTHING_2)], t3: [parseFloat(row.EASTING_3), topY, -parseFloat(row.NORTHING_3)],
                            b1: [parseFloat(row.EASTING_1), botY, -parseFloat(row.NORTHING_1)], b2: [parseFloat(row.EASTING_2), botY, -parseFloat(row.NORTHING_2)], b3: [parseFloat(row.EASTING_3), botY, -parseFloat(row.NORTHING_3)]
                        };
                    } else {
                        p = {
                            t1: [parseFloat(row.EASTING_1), parseFloat(row.TOPELEVATION_1), -parseFloat(row.NORTHING_1)], t2: [parseFloat(row.EASTING_2), parseFloat(row.TOPELEVATION_2), -parseFloat(row.NORTHING_2)], t3: [parseFloat(row.EASTING_3), parseFloat(row.TOPELEVATION_3), -parseFloat(row.NORTHING_3)],
                            b1: [parseFloat(row.EASTING_1), parseFloat(row.BOTELEVATION_1), -parseFloat(row.NORTHING_1)], b2: [parseFloat(row.EASTING_2), parseFloat(row.BOTELEVATION_2), -parseFloat(row.NORTHING_2)], b3: [parseFloat(row.EASTING_3), parseFloat(row.BOTELEVATION_3), -parseFloat(row.NORTHING_3)]
                        };
                    }
                    blocks[blockKey].triangles.push(p);
                });

                // Pastikan geometri yang lama dihapus dulu sebelum merakit ulang (menghindari duplikasi render)
                window.unloadPitGeometry(pitId);
                if (typeof clearLabels === 'function') clearLabels(); 

                Object.keys(blocks).forEach(blockKey => {
                    const blockData = blocks[blockKey];
                    const positions = []; const edgesCount = {}; const edgeVertices = {};

                    const addEdge = (pA, pB) => {
                        const round = (val) => Math.round(val * 1000) / 1000; 
                        const keyA = `${round(pA.t[0])}_${round(pA.t[2])}`; const keyB = `${round(pB.t[0])}_${round(pB.t[2])}`;
                        const edgeKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
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

                    let geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    
                    if (THREE.BufferGeometryUtils) geometry = THREE.BufferGeometryUtils.mergeVertices(geometry, stupaMode ? 0.01 : 0.5); 
                    geometry.computeVertexNormals(); geometry.computeBoundingBox();

                    const isCoal = blockData.info.burden.toUpperCase() === 'RESOURCE';
                    const blockColor = isCoal ? colorCoal : colorOB; 
                    
                    const material = new THREE.MeshStandardMaterial({ 
                        color: blockColor, side: THREE.DoubleSide, flatShading: true,
                        roughness: isCoal ? 0.4 : 0.8, metalness: 0.1, 
                        polygonOffset: true, polygonOffsetFactor: isCoal ? -2 : 1, polygonOffsetUnits: isCoal ? -2 : 1,
                        transparent: true, opacity: isCoal ? opacCoal : opacOB 
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.userData = { ...blockData.info, isRecorded: false, rawRows: blockData.rawRows };
                    
                    const edges = new THREE.EdgesGeometry(geometry, stupaMode ? 10 : 60); 
                    const lineMaterial = new THREE.LineBasicMaterial({ 
                        color: 0x111111, opacity: 0.9, transparent: true, linewidth: 1,
                        polygonOffset: true, polygonOffsetFactor: isCoal ? -3 : 0, polygonOffsetUnits: isCoal ? -3 : 0
                    });
                    const line = new THREE.LineSegments(edges, lineMaterial);
                    mesh.add(line);

                    if (typeof pitReserveGroup !== 'undefined' && typeof meshes !== 'undefined') {
                        pitReserveGroup.add(mesh); 
                        meshes[blockKey] = mesh;
                    }
                });
                
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

                    if (!box.isEmpty() && !skipCameraReset && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
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
                
                const pitProcSelect = document.getElementById('pit-processing-select');
                const srLimitInput = document.getElementById('sr-limit');
                
                if (pitProcSelect) {
                    if (pitProcSelect.value === 'basic' && typeof resetToBasicColors === 'function') resetToBasicColors();
                    else if (pitProcSelect.value === 'resgraphic_incremental' && typeof generateResgraphicIncremental === 'function') generateResgraphicIncremental(parseFloat(srLimitInput?.value) || 5);
                    else if (pitProcSelect.value === 'resgraphic_cumulative' && typeof generateResgraphicCumulative === 'function') generateResgraphicCumulative(parseFloat(srLimitInput?.value) || 5);
                    else if (pitProcSelect.value === 'quality' && typeof generateQuality === 'function') generateQuality();
                }

                resolve();
            } catch (err) { 
                console.error("Error merakit geometri pit:", err); 
                alert("Terjadi kesalahan saat merakit geometri."); 
                resolve();
            } finally { 
                if (typeof isProcessing !== 'undefined') isProcessing = false; 
            }
        }, 50); // Delay kecil agar thread UI bisa bernapas sebelum block rendering
    });
}