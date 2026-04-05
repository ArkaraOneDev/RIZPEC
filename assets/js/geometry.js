// ==========================================
// GEOMETRY BUILDER & MANAGER (ULTIMATE EDITION)
// UI/UX DARI NEW_3 + MEMORY MANAGEMENT DARI NEW_1
// OPTIMIZED FOR MOBILE/TABLET (ULTRA OOM PREVENTION & DOM CULLING)
// + LABEL SYNC FIX FOR ARM TABLETS
// ==========================================

// Track state Pit & Disposal mana saja yang saat ini sedang diload dan dirender
window.loadedPits = window.loadedPits || new Set();
window.renderedPits = window.renderedPits || new Set();

window.loadedDisposals = window.loadedDisposals || new Set();
window.renderedDisposals = window.renderedDisposals || new Set();

// Inisialisasi World Origin Persistent (Bisa bertahan walau di-refresh)
const savedOrigin = localStorage.getItem('rizpec_world_origin');
window.worldOrigin = savedOrigin ? JSON.parse(savedOrigin) : { x: 0, y: 0, z: 0, isSet: false };

// Lock antrean untuk mencegah Race Condition saat render banyak entitas sekaligus
window.isRenderingPits = window.isRenderingPits || false; 

// =========================================================================
// FITUR: 3D TO 2D SCREEN-SPACE LABELING MANAGER (OPTIMIZED + DOM CULLING)
// =========================================================================
window.activeLabels = window.activeLabels || [];
window.isLabelHooked = window.isLabelHooked || false;
window.isUpdatingLabels = window.isUpdatingLabels || false; // Lock sinkronisasi frame

// Konfigurasi jarak (Distance) untuk Fade dan Hide Label
const LABEL_CONFIG = {
    FADE_START: 1500,  // Jarak kamera dimana label mulai memudar
    FADE_END: 3000,    // Jarak kamera dimana label hilang 100%
    MAX_VISIBLE: 200   // [OPTIMASI DOM]: Batas maksimal DOM label yg dirender per frame agar tidak lag
};

window.clearLabels = function(entityId) {
    window.activeLabels = window.activeLabels.filter(lbl => {
        // [FIX LEAK]: Pastikan hanya menghapus label milik entity yang diminta dari DOM & Array
        if (lbl.entityId === entityId) { 
            if (lbl.element && lbl.element.parentNode) {
                lbl.element.parentNode.removeChild(lbl.element);
            }
            return false; 
        }
        return true; 
    });
};

window.updateLabels = function() {
    // [FIX DESYNC]: Jangan proses jika frame ini sedang merender label
    if (window.isUpdatingLabels) return;
    window.isUpdatingLabels = true;

    // [FIX DESYNC]: Paksa jalan bersamaan dengan GPU Render Pipeline (requestAnimationFrame)
    requestAnimationFrame(() => {
        const labelsContainer = document.getElementById('labels-container');
        
        if (!labelsContainer) {
            window.isUpdatingLabels = false;
            return;
        }

        // [FIX STACKING CONTEXT]: Cegah z-index bocor menimpa Compass (z-10)
        labelsContainer.style.zIndex = '1';

        if (!window.isLabelLayerVisible) {
            labelsContainer.style.display = 'none';
            window.isUpdatingLabels = false;
            return;
        } else {
            labelsContainer.style.display = 'block';
        }

        if (typeof camera === 'undefined' || typeof renderer === 'undefined') {
            window.isUpdatingLabels = false;
            return;
        }

        const widthHalf = renderer.domElement.clientWidth / 2;
        const heightHalf = renderer.domElement.clientHeight / 2;
        const camPos = camera.position;
        
        let visibleCount = 0;

        window.activeLabels.forEach(lbl => {
            lbl.vec.copy(lbl.position);
            const distance = camPos.distanceTo(lbl.position);

            // [OPTIMASI DOM CULLING]: Hilangkan dari kalkulasi UI jika melebihi batas render / jumlah maks
            if (distance > LABEL_CONFIG.FADE_END || visibleCount > LABEL_CONFIG.MAX_VISIBLE) {
                if (lbl.element.style.display !== 'none') lbl.element.style.display = 'none';
                return;
            }

            lbl.vec.project(camera);

            // Cek apakah koordinat berada di belakang kamera
            if (lbl.vec.z > 1) {
                if (lbl.element.style.display !== 'none') lbl.element.style.display = 'none';
            } else {
                lbl.element.style.display = 'flex';
                visibleCount++;
                
                // [BEST PRACTICE UI/UX]: Dynamic Z-Index (Yang dekat menimpa yang jauh)
                lbl.element.style.zIndex = Math.round(10000 - distance);

                // Kalkulasi Opacity (Fading)
                let currentOpacity = window.labelOpacity !== undefined ? window.labelOpacity : 1;
                if (distance > LABEL_CONFIG.FADE_START) {
                    const fadeRange = LABEL_CONFIG.FADE_END - LABEL_CONFIG.FADE_START;
                    const fadeProgress = (distance - LABEL_CONFIG.FADE_START) / fadeRange;
                    currentOpacity = currentOpacity * Math.max(0, (1 - fadeProgress));
                }
                
                if (currentOpacity < 0.05) {
                    lbl.element.style.display = 'none';
                    return;
                }

                lbl.element.style.opacity = currentOpacity;
                
                // Posisi Layar + Hardware Acceleration (translate3d)
                const x = (lbl.vec.x * widthHalf) + widthHalf;
                const y = -(lbl.vec.y * heightHalf) + heightHalf;
                
                let scale = 0.75; 
                if (distance < LABEL_CONFIG.FADE_START / 2) {
                    scale = 0.75 + (0.15 * (1 - (distance / (LABEL_CONFIG.FADE_START / 2))));
                }
                
                lbl.element.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0) scale(${scale})`;
            }
        });

        // Bebaskan lock setelah selesai diproses di frame ini
        window.isUpdatingLabels = false;
    });
};

// [OPTIMASI RAM EKSTREM]: Fungsi kunci Origin TANPA `split(/\r?\n/)`
window.establishWorldOrigin = function(csvText) {
    if (window.worldOrigin && window.worldOrigin.isSet) return; 
    if (!csvText) return;

    let lines = [];
    let lastIdx = 0;
    let count = 0;
    const limit = 500;
    
    while (count < limit && lastIdx < csvText.length) {
        let nextIdx = csvText.indexOf('\n', lastIdx);
        if (nextIdx === -1) nextIdx = csvText.length;
        let line = csvText.substring(lastIdx, nextIdx).trim();
        if (line) lines.push(line);
        lastIdx = nextIdx + 1;
        count++;
    }

    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.replace(/['"]/g, '').trim().toUpperCase());
    const idxE1 = headers.lastIndexOf('EASTING_1');
    const idxN1 = headers.lastIndexOf('NORTHING_1');
    const idxT1 = headers.lastIndexOf('TOPELEVATION_1');

    if (idxE1 === -1 || idxN1 === -1 || idxT1 === -1) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (let i = 1; i < lines.length; i++) {
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
        window.worldOrigin = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2, isSet: true };
        localStorage.setItem('rizpec_world_origin', JSON.stringify(window.worldOrigin));
    }
};

// 1. Fungsi Garbage Collection Utama GPU & RAM
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
                    
                    if(mesh.geometry) mesh.geometry.dispose();
                    if(mesh.material) {
                        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
                        else mesh.material.dispose();
                    }
                    mesh.children.forEach(child => { 
                        if(child.geometry) child.geometry.dispose(); 
                        if(child.material) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                            else child.material.dispose();
                        }
                        child.userData = {}; 
                    });
                    
                    mesh.userData = {}; 
                    keysToDelete.push(key);
                }
            }
        });
        
        keysToDelete.forEach(k => delete meshes[k]);

        window.clearLabels(entityId);

        // Hapus dari state jika di-unload murni (Bukan Re-build)
        if (type === 'pit' && !window.loadedPits.has(entityId)) {
            window.renderedPits.delete(entityId);
        } else if (type === 'disp' && !window.loadedDisposals.has(entityId)) {
            window.renderedDisposals.delete(entityId);
        }

        if (typeof window.refreshAllDxfClipping === 'function') window.refreshAllDxfClipping();
    }
    
    window.recalculateGlobalSums();
    if (typeof window.resetSequenceAndView === 'function') window.resetSequenceAndView();
    if (typeof window.updateLayerUI === 'function') window.updateLayerUI();
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        requestAnimationFrame(() => renderer.render(scene, camera));
    }

    // [OPTIMASI RAM & BATERAI]: Auto-Kill Geolocation jika layar 3D sudah kosong
    if (typeof window.AppGeolocation !== 'undefined' && window.AppGeolocation.isTracking) {
        const geoCheck = window.AppGeolocation.checkActiveBounds();
        if (!geoCheck.hasData) {
            console.warn("Semua data 3D dihapus. Mematikan fitur Geolocation otomatis.");
            window.AppGeolocation.toggleTracking(); 
            const btnTrack = document.getElementById('btn-start-tracking');
            if (btnTrack) {
                btnTrack.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Tracking';
                btnTrack.classList.remove('bg-rose-600', 'hover:bg-rose-500');
                btnTrack.classList.add('bg-blue-600', 'hover:bg-blue-500');
            }
        }
    }
};

window.unloadPitGeometry = function(id) { window.unloadGeometry(id, 'pit'); };
window.unloadDisposalGeometry = function(id) { window.unloadGeometry(id, 'disp'); };

window.recalculateGlobalSums = function() {
    let totalWaste = 0, totalResource = 0, totalDisp = 0;
    let uniqueBlocks = new Set();
    
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (m.userData.type === 'disp') {
                totalDisp += (m.userData.wasteVol || 0);
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
    
    const elSumWaste = document.getElementById('sequence-waste-total') || document.getElementById('sequence-ob-total');
    if (elSumWaste) elSumWaste.textContent = Number(totalWaste.toFixed(2)).toLocaleString();
    
    const elSumResource = document.getElementById('sequence-resource-total') || document.getElementById('sequence-coal-total');
    if (elSumResource) elSumResource.textContent = Number(totalResource.toFixed(2)).toLocaleString();
    
    const elSumSr = document.getElementById('sequence-sr-total');
    if (elSumSr) elSumSr.textContent = totalResource > 0 ? (totalWaste / totalResource).toFixed(2) : "0.00";

    const elSumDispWaste = document.getElementById('disp-sequence-waste-total');
    if (elSumDispWaste) elSumDispWaste.textContent = Number(totalDisp.toFixed(2)).toLocaleString();
};

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
                    // [OPTIMASI MEMORY]: Beri Napas V8 Engine (GC) 500ms
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch(err) {
                    window.renderedPits.delete(pit); 
                    console.error("Gagal merender pit:", err);
                }
            }

            for (let disp of pendingDisposals) {
                window.renderedDisposals.add(disp); 
                try {
                    await window.buildGeometryMesh(disp, 'disp');
                    // [OPTIMASI MEMORY]: Beri Napas V8 Engine (GC) 500ms
                    await new Promise(resolve => setTimeout(resolve, 500));
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
        
        // Membersihkan state tombol (Dari optimasi File 1)
        const tabBtn = document.querySelector('.nav-tab[data-target="panel-geometry"]');
        if (tabBtn) tabBtn.classList.remove('bg-emerald-600/30', 'text-emerald-300', 'animate-pulse');
    }
};

// [OPTIMASI RAM]: Fix Event Stacking Leak
window.handleGeometryTabClick = function(e) {
    const tab = e.target.closest('.nav-tab');
    if (tab && tab.dataset.target === 'panel-geometry') {
        setTimeout(() => {
            if (typeof window.renderPendingPits === 'function') window.renderPendingPits();
        }, 50);
    }
};
document.removeEventListener('click', window.handleGeometryTabClick); 
document.addEventListener('click', window.handleGeometryTabClick);    

// 4. Mengekstrak dan membangun Mesh menggunakan WEB WORKER
window.buildGeometryMesh = function(entityId, type = 'pit') {
    return new Promise(async (resolve, reject) => {
        try {
            if (!window.worldOrigin.isSet && typeof meshes !== 'undefined') {
                const existingKeys = Object.keys(meshes);
                for (let i = 0; i < existingKeys.length; i++) {
                    const m = meshes[existingKeys[i]];
                    if (m && m.userData && m.userData.centerOffset) {
                        window.worldOrigin = { 
                            x: m.userData.centerOffset.x, y: m.userData.centerOffset.y, z: m.userData.centerOffset.z, isSet: true 
                        }; break;
                    }
                }
            }

            const dbPrefix = type === 'pit' ? 'rizpec_pit_entity_' : 'rizpec_disp_entity_';
            const key = `${dbPrefix}${entityId.replace(/\s+/g, '_')}`;
            
            let csvDataDB = await RizpecDB.get(key); 
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
                        const headers = headersLine.split(',').map(h => h.replace(/['"]/g, '').trim().toUpperCase());

                        const idxE1 = headers.lastIndexOf('EASTING_1'); const idxN1 = headers.lastIndexOf('NORTHING_1'); const idxT1 = headers.lastIndexOf('TOPELEVATION_1'); const idxB1 = headers.lastIndexOf('BOTELEVATION_1');
                        const idxE2 = headers.lastIndexOf('EASTING_2'); const idxN2 = headers.lastIndexOf('NORTHING_2'); const idxT2 = headers.lastIndexOf('TOPELEVATION_2'); const idxB2 = headers.lastIndexOf('BOTELEVATION_2');
                        const idxE3 = headers.lastIndexOf('EASTING_3'); const idxN3 = headers.lastIndexOf('NORTHING_3'); const idxT3 = headers.lastIndexOf('TOPELEVATION_3'); const idxB3 = headers.lastIndexOf('BOTELEVATION_3');
                        const idxComposite = type === 'pit' ? headers.lastIndexOf('ID P-COMPOSITE') : headers.lastIndexOf('ID D-COMPOSITE');
                        const idxBench = type === 'pit' ? headers.lastIndexOf('ID P-BENCH') : headers.lastIndexOf('ID D-BENCH');
                        const idxSubset = type === 'pit' ? headers.lastIndexOf('ID P-SUBSET') : headers.lastIndexOf('ID D-SUBSET');
                        const idxName = headers.lastIndexOf('ID P-NAME');
                        const idxBlock = headers.lastIndexOf('ID P-BLOCK');
                        const idxStrip = headers.lastIndexOf('ID P-STRIP');
                        const idxBurden = headers.lastIndexOf('BURDEN');

                        let idxWaste = -1; let idxRes = -1;
                        if (type === 'pit') {
                            idxWaste = headers.lastIndexOf('PRO_RATA_WASTE');
                            idxRes = headers.lastIndexOf('PRO_RATA_RESOURCE');
                        } else {
                            idxWaste = headers.lastIndexOf('LOOSE_VOLUME');
                            if (idxWaste === -1) idxWaste = headers.lastIndexOf('BANK_VOLUME');
                        }

                        const idxWThick = headers.lastIndexOf('WASTE THICKNESS');
                        const idxRThick = headers.lastIndexOf('RESOURCE THICKNESS');
                        const qualityIndices = [];
                        if (type === 'pit' && idxRThick !== -1 && idxWaste !== -1) {
                            for (let i = idxRThick + 1; i < idxWaste; i++) {
                                qualityIndices.push(i);
                            }
                        }

                        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                        let blocks = {}; let groupStats = {};

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

                            let compositeId = '';
                            if (idxComposite !== -1 && row[idxComposite]) compositeId = row[idxComposite].replace(/['"]/g, '').trim();
                            else compositeId = 'Row_' + lastIndex;
                            if (!compositeId) compositeId = 'Unknown_Block';

                            const nameVal = idxName !== -1 && row[idxName] ? row[idxName].replace(/['"]/g, '').trim() : '';
                            const blockVal = idxBlock !== -1 && row[idxBlock] ? row[idxBlock].replace(/['"]/g, '').trim() : '';
                            const stripVal = idxStrip !== -1 && row[idxStrip] ? row[idxStrip].replace(/['"]/g, '').trim() : '';
                            const groupKey = nameVal + '_' + blockVal + '_' + stripVal;

                            // [FIX BUG A]: Jangan simpan menggunakan string gabungan untuk di-split nanti. 
                            // Simpan langsung nilai asli name, block, dan strip ke dalam object groupStats.
                            if (!groupStats[groupKey]) {
                                groupStats[groupKey] = { waste: 0, res: 0, name: nameVal, block: blockVal, strip: stripVal, metrics: {} };
                            }

                            const addMetric = (colName, val, weight) => {
                                if (!groupStats[groupKey].metrics[colName]) {
                                    groupStats[groupKey].metrics[colName] = { sum: 0, min: Infinity, max: -Infinity, wtSum: 0, weightTotal: 0, count: 0 };
                                }
                                const m = groupStats[groupKey].metrics[colName];
                                m.sum += val;
                                if (val < m.min) m.min = val;
                                if (val > m.max) m.max = val;
                                m.wtSum += val * weight;
                                m.weightTotal += weight;
                                m.count += 1;
                            };

                            [   [row[idxE1], row[idxT1], row[idxN1]], [row[idxE2], row[idxT2], row[idxN2]],
                                [row[idxE3], row[idxT3], row[idxN3]], [row[idxE1], row[idxB1], row[idxN1]]
                            ].forEach(c => {
                                let x = parseFloat(c[0]), y = parseFloat(c[1]), z = -parseFloat(c[2]);
                                if(x < minX) minX = x; if(x > maxX) maxX = x;
                                if(y < minY) minY = y; if(y > maxY) maxY = y;
                                if(z < minZ) minZ = z; if(z > maxZ) maxZ = z;
                            });

                            const bench = idxBench !== -1 && row[idxBench] ? row[idxBench].replace(/['"]/g, '').trim() : 'Unknown';
                            const subset = idxSubset !== -1 && row[idxSubset] ? row[idxSubset].replace(/['"]/g, '').trim() : '';
                            let burden = idxBurden !== -1 && row[idxBurden] ? row[idxBurden].replace(/['"]/g, '').trim().toUpperCase() : '';
                            
                            const resVal = idxRes !== -1 ? (parseFloat(row[idxRes]) || 0) : 0;
                            const wasteVal = idxWaste !== -1 ? (parseFloat(row[idxWaste]) || 0) : 0;

                            if (type === 'pit') {
                                if (burden === 'RESOURCE' || burden === 'COAL') burden = 'RESOURCE'; 
                                else if (burden !== '') burden = 'WASTE';
                                else burden = resVal > 0 ? 'RESOURCE' : 'WASTE';
                                groupStats[groupKey].waste += wasteVal;
                                groupStats[groupKey].res += resVal;

                                const wThickVal = idxWThick !== -1 ? (parseFloat(row[idxWThick]) || 0) : 0;
                                const rThickVal = idxRThick !== -1 ? (parseFloat(row[idxRThick]) || 0) : 0;
                                
                                addMetric('WASTE THICKNESS', wThickVal, wasteVal > 0 ? wasteVal : 1);
                                addMetric('RESOURCE THICKNESS', rThickVal, resVal > 0 ? resVal : 1);
                                
                                qualityIndices.forEach(qIdx => {
                                    const qVal = parseFloat(row[qIdx]) || 0;
                                    addMetric(headers[qIdx], qVal, resVal > 0 ? resVal : 1);
                                });
                            } else {
                                burden = 'WASTE';
                            }

                            const blockKey = entityId + '_' + compositeId;
                            if (!blocks[blockKey]) {
                                blocks[blockKey] = {
                                    info: { entityId, type, blockKey, compositeId, burden, subset, bench, groupKey, wasteVol: 0, resVol: 0 },
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

                        // [OPTIMASI MEMORY WORKER] Kosongkan string raksasa
                        csvData = null; if (e.data) e.data.csvData = null; 
                        
                        const cX = globalCenter ? globalCenter.x : (minX + maxX) / 2; 
                        const cY = globalCenter ? globalCenter.y : (minY + maxY) / 2; 
                        const cZ = globalCenter ? globalCenter.z : (minZ + maxZ) / 2;

                        let minSR = Infinity;
                        if (type === 'pit') {
                            Object.keys(groupStats).forEach(k => {
                                const g = groupStats[k];
                                g.sr = g.res > 0 ? g.waste / g.res : Infinity;
                                if (g.res > 0 && g.sr < minSR) minSR = g.sr;
                            });
                            if (minSR === Infinity) minSR = 0;
                        }

                        const bounds = { minX, maxX, minY, maxY, minZ, maxZ };
                        let processedBlocks = []; let transferables = [];

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
                            
                            // [OPTIMASI RAM WORKER]: Prevent Memory Spike
                            delete blocks[blockKey];
                        });

                        blocks = null; 
                        self.postMessage({ success: true, blocks: processedBlocks, bounds: bounds, centerUsed: {x: cX, y: cY, z: cZ}, groupStats, minSR }, transferables);
                        processedBlocks = null; transferables = null;

                    } catch (err) { self.postMessage({ error: err.message }); }
                };
            `;

            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            const worker = new Worker(workerUrl);

            const globalCenter = window.worldOrigin.isSet ? { x: window.worldOrigin.x, y: window.worldOrigin.y, z: window.worldOrigin.z } : null;

            worker.postMessage({ csvData: csvDataDB, entityId, type, stupaMode, extrusionHeight, globalCenter });
            
            // [OPTIMASI RAM EKSTREM]: Bebaskan RAM string ratusan MB di Main Thread seketika setelah masuk Worker!
            csvDataDB = null; 

            worker.onmessage = (e) => {
                URL.revokeObjectURL(workerUrl); 
                // [OPTIMASI ZOMBIE WORKER]: Langsung matikan worker untuk bebaskan RAM background
                worker.terminate();
                
                if (e.data.error) {
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    reject(new Error(e.data.error)); return;
                }

                const safeIdCheck = entityId.replace(/\s+/g, '_');
                const lsPrefix = type === 'pit' ? 'rizpec_build_type_' : 'rizpec_disp_build_type_';
                const isStillValid = localStorage.getItem(`${lsPrefix}${safeIdCheck}`) !== null;
                
                if (!isStillValid) {
                    if (typeof isProcessing !== 'undefined') isProcessing = false;
                    if (type === 'pit') { window.loadedPits.delete(entityId); window.renderedPits.delete(entityId); } 
                    else { window.loadedDisposals.delete(entityId); window.renderedDisposals.delete(entityId); }
                    resolve(); return;
                }

                let { blocks, bounds, centerUsed, groupStats, minSR } = e.data;
                if (!window.worldOrigin.isSet && centerUsed) { window.worldOrigin = { x: centerUsed.x, y: centerUsed.y, z: centerUsed.z, isSet: true }; }

                window.unloadGeometry(entityId, type);
                
                if (typeof window.clearLabels === 'function') window.clearLabels(entityId);

                // --- 1. SETUP KAMERA ---
                if (bounds && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
                    const box = new THREE.Box3();
                    if (typeof meshes !== 'undefined') Object.values(meshes).forEach(mesh => box.expandByObject(mesh));
                    const boxMin = new THREE.Vector3(bounds.minX - centerUsed.x, bounds.minY - centerUsed.y, bounds.minZ - centerUsed.z);
                    const boxMax = new THREE.Vector3(bounds.maxX - centerUsed.x, bounds.maxY - centerUsed.y, bounds.maxZ - centerUsed.z);
                    box.expandByPoint(boxMin); box.expandByPoint(boxMax);
                    
                    if (!box.isEmpty()) {
                        const center = box.getCenter(new THREE.Vector3()); 
                        const sphere = box.getBoundingSphere(new THREE.Sphere());
                        const radius = sphere.radius;
                        const fov = camera.fov * (Math.PI / 180); 
                        let cameraDistance = Math.abs(radius / Math.sin(fov / 2));
                        if (camera.aspect < 1) cameraDistance /= camera.aspect;
                        cameraDistance *= 1.3; 
                        if (camera.far < cameraDistance * 3) { camera.far = cameraDistance * 3; camera.updateProjectionMatrix(); }
                        const elevation = 45 * (Math.PI / 180); const azimuth = 315 * (Math.PI / 180);
                        camera.up.set(0, 1, 0);
                        camera.position.x = center.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth);
                        camera.position.y = center.y + cameraDistance * Math.sin(elevation);
                        camera.position.z = center.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth);
                        camera.lookAt(center); controls.target.copy(center); 
                        camera.updateMatrix();
                        
                        const vh = 2 * Math.tan(fov / 2) * cameraDistance; const vw = vh * camera.aspect;
                        const panRight = vw * 0.08; const panDown = vh * 0.12;  
                        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
                        const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
                        const offset = new THREE.Vector3();
                        offset.addScaledVector(rightVec, panRight); offset.addScaledVector(upVec, -panDown);
                        camera.position.add(offset); controls.target.add(offset);
                        controls.update();
                        
                        if (typeof renderer !== 'undefined' && typeof scene !== 'undefined') renderer.render(scene, camera);
                    }
                }

                // --- 2. PREPARE PRO CONFIG & STATS ---
                const proConfigs = JSON.parse(localStorage.getItem('rizpec_pit_pro_configs')) || {};
                const pitColorModes = JSON.parse(localStorage.getItem('rizpec_pit_color_modes')) || {};
                const colorMode = pitColorModes[entityId] || 'Burden';

                // Logika Kalkulasi Res. Cumulative
                if (groupStats && type === 'pit') {
                    if (colorMode === 'Res. Cumulative' && proConfigs[entityId] && proConfigs[entityId]['Res. Cumulative']) {
                        const cumConfig = proConfigs[entityId]['Res. Cumulative'];
                        
                        const uiTransition = cumConfig.sequence || 'Block Ascending';
                        const uiSequence = cumConfig.transition || 'Strip Ascending';
                        
                        const isTransitionBlock = uiTransition.startsWith('Block');
                        const transitionAsc = uiTransition.endsWith('Ascending');
                        
                        const isSequenceBlock = uiSequence.startsWith('Block');
                        const sequenceAsc = uiSequence.endsWith('Ascending');

                        let sortedKeys = Object.keys(groupStats);
                        sortedKeys.sort((a, b) => {
                            const gA = groupStats[a];
                            const gB = groupStats[b];
                            
                            let valOuterA = isTransitionBlock ? gA.block : gA.strip;
                            let valOuterB = isTransitionBlock ? gB.block : gB.strip;
                            
                            let valInnerA = isSequenceBlock ? gA.block : gA.strip;
                            let valInnerB = isSequenceBlock ? gB.block : gB.strip;

                            if (valOuterA !== valOuterB) {
                                const cmp = String(valOuterA).localeCompare(String(valOuterB), undefined, { numeric: true, sensitivity: 'base' });
                                return transitionAsc ? cmp : -cmp;
                            }

                            if (valInnerA !== valInnerB) {
                                const cmp = String(valInnerA).localeCompare(String(valInnerB), undefined, { numeric: true, sensitivity: 'base' });
                                return sequenceAsc ? cmp : -cmp;
                            }

                            return 0;
                        });

                        let cumWaste = 0;
                        let cumRes = 0;
                        let order = 1;
                        let minCumSR = Infinity;

                        sortedKeys.forEach(k => {
                            const g = groupStats[k];
                            cumWaste += g.waste;
                            cumRes += g.res;
                            g.cumWaste = cumWaste;
                            g.cumRes = cumRes;
                            g.cumSR = cumRes > 0 ? cumWaste / cumRes : Infinity;
                            g.order = order++;
                            if (g.cumRes > 0 && g.cumSR < minCumSR) minCumSR = g.cumSR;
                        });
                        
                        groupStats.minCumSR = minCumSR === Infinity ? 0 : minCumSR;
                    }
                }

                let zoneGlobalMin = Infinity;
                let zoneGlobalMax = -Infinity;
                let zoneCategoryKey = '';
                let zoneAggregation = '';
                let zoneInterpretation = '';
                let zConfig = null;

                if (groupStats && type === 'pit' && colorMode === 'Res. Zone' && proConfigs[entityId] && proConfigs[entityId]['Res. Zone']) {
                    zConfig = proConfigs[entityId]['Res. Zone'];
                    zoneAggregation = zConfig.aggregation || 'W. Avg';
                    zoneInterpretation = zConfig.interpretation || 'Higher is Better';
                    
                    if (zConfig.category === 'Waste Thick') zoneCategoryKey = 'WASTE THICKNESS';
                    else if (zConfig.category === 'Resource Thick') zoneCategoryKey = 'RESOURCE THICKNESS';
                    else zoneCategoryKey = (zConfig.category || '').toUpperCase();

                    Object.values(groupStats).forEach(g => {
                        let val = 0;
                        const m = g.metrics ? g.metrics[zoneCategoryKey] : null;
                        if (m) {
                            if (zoneAggregation === 'Sum') val = m.sum;
                            else if (zoneAggregation === 'Min') val = m.min !== Infinity ? m.min : 0;
                            else if (zoneAggregation === 'Max') val = m.max !== -Infinity ? m.max : 0;
                            else if (zoneAggregation === 'W. Avg') val = m.weightTotal > 0 ? m.wtSum / m.weightTotal : (m.count > 0 ? m.sum/m.count : 0);
                        }
                        g.zoneValue = val;
                        
                        if (val !== 0) {
                            if (val < zoneGlobalMin) zoneGlobalMin = val;
                            if (val > zoneGlobalMax) zoneGlobalMax = val;
                        }
                    });
                    
                    if (zoneGlobalMin === Infinity) zoneGlobalMin = 0;
                    if (zoneGlobalMax === -Infinity) zoneGlobalMax = 0;
                }

                // --- 3. RENDER 3D MESH ---
                const opacResource = typeof resourceOpacity !== 'undefined' ? resourceOpacity : 1;
                const opacWaste = typeof wasteOpacity !== 'undefined' ? wasteOpacity : 1;
                const burdenPalette = JSON.parse(localStorage.getItem(type === 'pit' ? 'rizpec_burden_palette' : 'rizpec_disp_burden_palette')) || [];
                const subsetPalette = JSON.parse(localStorage.getItem(type === 'pit' ? 'rizpec_subset_palette' : 'rizpec_disp_subset_palette')) || [];
                
                let sharedMaterials = {}; 
                let sharedLineMaterials = {};
                
                let currentIndex = 0; const TIME_BUDGET_MS = 15; 
                const statEl = document.getElementById('stat-new-entity');
                const originalStatText = statEl ? statEl.textContent : '';

                const discretePalette = ['#000080', '#0000FF', '#0080FF', '#00FFFF', '#00FF80', '#00FF00', '#80FF00', '#FFFF00', '#FF8000', '#8B0000'];
                const zonePalette = ['#8B0000', '#E53935', '#FFC107', '#43A047', '#00C853'];

                const processChunk = () => {
                    const isStillValidChunk = localStorage.getItem(`${lsPrefix}${safeIdCheck}`) !== null;
                    if (!isStillValidChunk) {
                        if (typeof isProcessing !== 'undefined') isProcessing = false;
                        if (type === 'pit') { window.loadedPits.delete(entityId); window.renderedPits.delete(entityId); } 
                        else { window.loadedDisposals.delete(entityId); window.renderedDisposals.delete(entityId); }
                        blocks = null; resolve(); return;
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
                            } catch (mergeErr) { }
                        } else if (vertexCount > SAFE_VERTEX_LIMIT) {
                            console.warn(`Bypass Merge Blok ${b.info.blockKey}: Terlalu berat (${vertexCount} vertex)`);
                        }
                        
                        geometry.computeBoundingBox();

                        const blockEntityId = b.info.entityId; const burden = (b.info.burden || '').toUpperCase();
                        const subset = b.info.subset || ''; const isResource = burden === 'RESOURCE';
                        const mode = pitColorModes[blockEntityId] || (subset ? 'Subset' : 'Burden'); 
                        const proConfig = (proConfigs[blockEntityId] && proConfigs[blockEntityId][mode]) ? proConfigs[blockEntityId][mode] : null;

                        let hexColor = '#aaaaaa';
                        if (mode === 'Res. Incremental' && proConfig) {
                            const srLimit = parseFloat(proConfig.srLimit) || 0;
                            const gStats = groupStats ? groupStats[b.info.groupKey] : null;
                            const sr = gStats ? gStats.sr : Infinity;
                            if (!gStats || gStats.res === 0) { hexColor = '#ffffff'; } 
                            else if (sr > srLimit) { hexColor = '#8B0000'; } 
                            else {
                                const range = srLimit - minSR; let t = range > 0 ? (sr - minSR) / range : 0;
                                t = Math.max(0, Math.min(1, t)); 
                                let classIndex = Math.floor(t * discretePalette.length);
                                if (classIndex >= discretePalette.length) classIndex = discretePalette.length - 1; 
                                hexColor = discretePalette[classIndex];
                            }
                        } else if (mode === 'Res. Cumulative' && proConfig) {
                            const srLimit = parseFloat(proConfig.srLimit) || 0;
                            const gStats = groupStats ? groupStats[b.info.groupKey] : null;
                            const sr = gStats ? gStats.cumSR : Infinity;
                            const baseMinSR = groupStats ? (groupStats.minCumSR || 0) : 0;
                            
                            if (!gStats || gStats.cumRes === 0) { hexColor = '#ffffff'; } 
                            else if (sr > srLimit) { hexColor = '#8B0000'; } 
                            else {
                                const range = srLimit - baseMinSR; let t = range > 0 ? (sr - baseMinSR) / range : 0;
                                t = Math.max(0, Math.min(1, t)); 
                                let classIndex = Math.floor(t * discretePalette.length);
                                if (classIndex >= discretePalette.length) classIndex = discretePalette.length - 1; 
                                hexColor = discretePalette[classIndex];
                            }
                        } else if (mode === 'Res. Zone' && proConfig) {
                            const gStats = groupStats ? groupStats[b.info.groupKey] : null;
                            
                            if (!gStats || gStats.zoneValue === undefined || gStats.zoneValue === 0) {
                                hexColor = '#ffffff';
                            } else {
                                const val = gStats.zoneValue;
                                const range = zoneGlobalMax - zoneGlobalMin;
                                let t = range > 0 ? (val - zoneGlobalMin) / range : 0;
                                t = Math.max(0, Math.min(1, t)); 
                                
                                if (zoneInterpretation === 'Lower is Better') {
                                    t = 1 - t; 
                                }
                                
                                let classIndex = Math.floor(t * zonePalette.length);
                                if (classIndex >= zonePalette.length) classIndex = zonePalette.length - 1; 
                                hexColor = zonePalette[classIndex];
                            }
                        } else if (mode === 'Subset' && subset) {
                            const subsetItem = subsetPalette.find(p => p.name === subset);
                            if (subsetItem) hexColor = subsetItem.color;
                        } else {
                            const searchName = type === 'pit' ? (isResource ? 'Resource' : 'Waste') : 'Waste';
                            const burdenItem = burdenPalette.find(p => p.name === searchName);
                            if (burdenItem) hexColor = burdenItem.color;
                        }

                        const currentOpacity = isResource ? opacResource : opacWaste;
                        const isTransparent = currentOpacity < 1.0; 
                        const matKey = `${blockEntityId}_${burden}_${subset}_${currentOpacity}_${mode}_${hexColor}`;
                        let material = sharedMaterials[matKey];
                        
                        if (!material) {
                            material = new THREE.MeshStandardMaterial({ 
                                color: hexColor, side: THREE.DoubleSide, flatShading: true,
                                roughness: isResource ? 0.4 : 0.8, metalness: 0.1, polygonOffset: true, 
                                polygonOffsetFactor: isResource ? -2 : 1, polygonOffsetUnits: isResource ? -2 : 1,
                                transparent: isTransparent, opacity: currentOpacity 
                            });
                            sharedMaterials[matKey] = material;
                        }

                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.userData = { ...b.info, isRecorded: false, centerOffset: centerUsed };
                        mesh.matrixAutoUpdate = false; mesh.updateMatrix();

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
                            line.matrixAutoUpdate = false; line.updateMatrix(); mesh.add(line);
                        }

                        if (typeof pitReserveGroup !== 'undefined' && typeof meshes !== 'undefined') {
                            pitReserveGroup.add(mesh); meshes[b.blockKey] = mesh;
                        }
                        
                        b.positions = null; 
                        blocks[currentIndex] = null; 
                        currentIndex++;
                    }

                    const currentCount = Math.min(currentIndex, blocks.length);
                    if (statEl && statEl.textContent !== 'Processing Data...') statEl.textContent = `Merender 3D... ${Math.round((currentCount / blocks.length) * 100)}%`;
                    if (typeof updateLoadingProgress === 'function') updateLoadingProgress(`(${currentCount} / ${blocks.length} Mesh)`);

                    if (currentIndex < blocks.length) {
                        requestAnimationFrame(processChunk);
                    } else {
                        blocks = null;
                        sharedMaterials = null; 
                        sharedLineMaterials = null;
                        
                        if (statEl && statEl.textContent.includes('Merender 3D')) statEl.textContent = originalStatText; 

                        // --- 4. GENERATE SCREEN-SPACE LABELS ---
                        if (type === 'pit' && ['Res. Incremental', 'Res. Cumulative', 'Res. Zone'].includes(colorMode)) {
                            const labelsContainer = document.getElementById('labels-container');
                            
                            if(labelsContainer && getComputedStyle(labelsContainer).position === 'static') {
                                labelsContainer.style.position = 'absolute';
                                labelsContainer.style.top = '0';
                                labelsContainer.style.left = '0';
                                labelsContainer.style.width = '100%';
                                labelsContainer.style.height = '100%';
                                labelsContainer.style.pointerEvents = 'none'; 
                                labelsContainer.style.overflow = 'hidden';
                            }

                            if (labelsContainer) labelsContainer.style.zIndex = '1';

                            if (labelsContainer && groupStats) {
                                const blockBoxes = {};
                                Object.values(meshes).forEach(mesh => {
                                    if (mesh.userData.entityId === entityId && mesh.userData.groupKey) {
                                        const gKey = mesh.userData.groupKey;
                                        if (!blockBoxes[gKey]) blockBoxes[gKey] = new THREE.Box3();
                                        blockBoxes[gKey].expandByObject(mesh);
                                    }
                                });

                                Object.keys(blockBoxes).forEach(gKey => {
                                    const box = blockBoxes[gKey];
                                    const center = box.getCenter(new THREE.Vector3());
                                    center.y = box.max.y + 5; 
                                    
                                    const g = groupStats[gKey];
                                    if (!g) return;

                                    const div = document.createElement('div');
                                    // [FIX UI ARM TABLET]: Dihapus `transition-opacity duration-75` agar pergerakan murni dikontrol rAF tiap frame
                                    div.className = 'absolute top-0 left-0 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-md shadow-lg border border-slate-500/80 pointer-events-none select-none flex items-center justify-center text-center z-10 backdrop-blur-sm';
                                    
                                    let htmlContent = '';
                                    if (colorMode === 'Res. Cumulative') {
                                        const srText = g.cumRes > 0 ? g.cumSR.toFixed(2) : '-';
                                        const orderText = g.order || '-';
                                        htmlContent = `<span class="${srText !== '-' ? 'text-amber-400' : 'text-slate-200'} drop-shadow-md tracking-widest">${orderText} | SR: ${srText}</span>`;
                                    } else if (colorMode === 'Res. Zone') {
                                        let alias = zConfig ? zConfig.category : 'Zone';
                                        if (alias === 'Waste Thick') alias = 'W.Thk';
                                        else if (alias === 'Resource Thick') alias = 'R.Thk';
                                        
                                        const valText = g.zoneValue !== undefined ? g.zoneValue.toFixed(2) : '-';
                                        htmlContent = `<span class="text-amber-400 drop-shadow-md tracking-widest">${alias}: ${valText}</span>`;
                                    } else {
                                        const srText = g.res > 0 ? (g.waste / g.res).toFixed(2) : '-';
                                        htmlContent = `<span class="${srText !== '-' ? 'text-amber-400' : 'text-slate-200'} drop-shadow-md tracking-widest">SR: ${srText}</span>`;
                                    }
                                    
                                    div.innerHTML = htmlContent;
                                    div.style.backgroundColor = 'rgba(15, 23, 42, 0.75)'; 
                                    div.style.willChange = 'transform, opacity'; 
                                    
                                    div.style.display = window.isLabelLayerVisible ? 'flex' : 'none';
                                    labelsContainer.appendChild(div);

                                    window.activeLabels.push({
                                        entityId: entityId,
                                        element: div,
                                        position: center,
                                        vec: new THREE.Vector3()
                                    });
                                });
                                
                                window.updateLabels();
                            }
                        }

                        if (typeof controls !== 'undefined' && !window.isLabelHooked) {
                            // [FIX DESYNC]: Kita biarkan di-hook di sini karena sudah disematkan rAF throttling di window.updateLabels.
                            // Catatan: Jika ada masalah lain, event ini bisa dicabut dan letakkan window.updateLabels() di dalam gameLoop()/animate().
                            controls.addEventListener('change', window.updateLabels);
                            window.addEventListener('resize', window.updateLabels);
                            window.isLabelHooked = true;
                        }

                        window.recalculateGlobalSums();
                        if (typeof window.refreshAllDxfClipping === 'function') window.refreshAllDxfClipping();

                        if (typeof appLayers !== 'undefined') {
                            const existingLayer = appLayers.find(l => l.id === 'layer_pit_reserve');
                            if (!existingLayer && typeof pitReserveGroup !== 'undefined') {
                                appLayers.unshift({ id: 'layer_pit_reserve', name: 'Pit Data', visible: true, threeObject: pitReserveGroup, colorHex: '#3b82f6', defaultColorHex: '#3b82f6', type: 'csv', hasFaces: false });
                            }
                            if (typeof updateLayerUI === 'function') updateLayerUI();
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
                worker.terminate();
                if (typeof isProcessing !== 'undefined') isProcessing = false;
                console.error("Fatal Web Worker Error:", err);
                reject(new Error("Memori Perangkat Penuh saat mengekstrak titik koordinat. (Data terlalu besar untuk RAM)"));
            };

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