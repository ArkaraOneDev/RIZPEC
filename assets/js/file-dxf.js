// ==========================================
// DXF IMPORTER CORE LOGIC
// 100% OPTIMIZED: WEB WORKER + TRANSFERABLE OBJECTS + AGGRESSIVE GC
// ==========================================

// Fungsi bantuan untuk mencari URL script dxf-parser secara otomatis di HTML
function getDxfParserScriptUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let s of scripts) {
        if (s.src && s.src.toLowerCase().includes('dxf')) {
            return s.src;
        }
    }
    // Fallback CDN jika tidak ditemukan secara lokal
    return 'https://cdn.jsdelivr.net/npm/dxf-parser@1.1.2/dist/dxf-parser.min.js';
}

function processDXF(dxfText, fileName) {
    if (typeof showFullscreenLoading === 'function') {
        showFullscreenLoading("Memproses DXF di Background...");
    }

    // [PERBAIKAN METADATA KOSONG]: Tangkap meta file sebelum worker berjalan & dxfText dikosongkan
    const fallbackFileSize = dxfText ? dxfText.length : 0;
    const capturedFileMeta = window.pendingDxfMeta || { 
        size: fallbackFileSize, 
        lastModified: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' }) 
    };
    window.pendingDxfMeta = null; // Reset setelah ditangkap agar tidak bocor ke file lain

    // 1. Buat kode Web Worker dalam bentuk Blob String
    const workerCode = `
        self.onmessage = function(e) {
            const { dxfText, parserUrl, worldOriginSet, existingOrigin } = e.data;
            
            // Import DxfParser ke dalam Worker
            try {
                importScripts(parserUrl);
            } catch (err) {
                self.postMessage({ error: "Gagal memuat DxfParser di Worker: " + err.message });
                return;
            }

            const parser = new self.DxfParser();
            let dxfData = null;
            
            try {
                dxfData = parser.parseSync(dxfText);
            } catch(err) {
                self.postMessage({ error: "Error membaca format DXF: " + err.message });
                return;
            }

            let origin = existingOrigin;
            let isOriginSet = worldOriginSet;

            // Hitung bounding box & set World Origin jika belum diset
            if (!isOriginSet) {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
                dxfData.entities.forEach(ent => {
                    let verts = ent.vertices ? [...ent.vertices] : [];
                    if (ent.type === 'LINE' && verts.length === 0 && ent.startPoint && ent.endPoint) {
                        verts = [ent.startPoint, ent.endPoint];
                    }
                    verts.forEach(v => {
                        if(!v) return;
                        let actualZ = v.z !== undefined ? v.z : (ent.elevation || 0);
                        let x = v.x; let y = actualZ; let z = -v.y;
                        if(x < minX) minX = x; if(x > maxX) maxX = x;
                        if(y < minY) minY = y; if(y > maxY) maxY = y;
                        if(z < minZ) minZ = z; if(z > maxZ) maxZ = z;
                    });
                });
                if (minX !== Infinity) {
                    origin = { x: (minX+maxX)/2, y: (minY+maxY)/2, z: (minZ+maxZ)/2, isSet: true };
                    isOriginSet = true;
                }
            }

            let hasLine = false;
            dxfData.entities.forEach(ent => {
                if ((ent.type === 'LINE' || ent.type === 'LWPOLYLINE') && !ent.shape && !ent.polygonMesh) hasLine = true;
            });

            // Ekstraksi Warna dan Titik
            const colorFaceGroups = {};
            const colorLineGroups = {};
            const AUTO_CAD_COLOR_INDEX = [ /* ... sisipkan tabel warna autocad jika diperlukan di worker ... */ ];
            // Fallback sederhana jika array color index tidak didefinisikan secara utuh di worker
            const getColorHex = (cid) => {
                if(cid === 1) return 0xFF0000; if(cid === 2) return 0xFFFF00; if(cid === 3) return 0x00FF00;
                if(cid === 4) return 0x00FFFF; if(cid === 5) return 0x0000FF; if(cid === 6) return 0xFF00FF;
                if(cid === 7) return 0xFFFFFF; if(cid === 8) return 0x414141; if(cid === 9) return 0x808080;
                return 0xFFFFFF; // Default Putih
            };

            dxfData.entities.forEach(ent => {
                let cid = ent.colorIndex; 
                if (cid === 256 || cid === undefined) {
                    const layer = dxfData.tables && dxfData.tables.layer && dxfData.tables.layer.layers[ent.layer];
                    if (layer) cid = Math.abs(layer.colorNumber);
                }
                if (cid === undefined || cid < 1 || cid > 255) cid = 7;
                
                let hexValue = getColorHex(cid);

                if (!hasLine && (ent.type === '3DFACE' || ent.type === 'SOLID')) {
                    let v = ent.vertices;
                    if (v && v.length >= 3) {
                        if (!colorFaceGroups[hexValue]) colorFaceGroups[hexValue] = [];
                        
                        let z0 = v[0].z !== undefined ? v[0].z : (ent.elevation || 0);
                        let z1 = v[1].z !== undefined ? v[1].z : (ent.elevation || 0);
                        let z2 = v[2].z !== undefined ? v[2].z : (ent.elevation || 0);

                        let vx0 = v[0].x - origin.x, vy0 = z0 - origin.y, vz0 = -v[0].y - origin.z;
                        let vx1 = v[1].x - origin.x, vy1 = z1 - origin.y, vz1 = -v[1].y - origin.z;
                        let vx2 = v[2].x - origin.x, vy2 = z2 - origin.y, vz2 = -v[2].y - origin.z;

                        colorFaceGroups[hexValue].push(vx0, vy0, vz0, vx1, vy1, vz1, vx2, vy2, vz2);

                        if (v.length >= 4 && (v[2].x !== v[3].x || v[2].y !== v[3].y)) {
                            let z3 = v[3].z !== undefined ? v[3].z : (ent.elevation || 0);
                            let vx3 = v[3].x - origin.x, vy3 = z3 - origin.y, vz3 = -v[3].y - origin.z;
                            colorFaceGroups[hexValue].push(vx0, vy0, vz0, vx2, vy2, vz2, vx3, vy3, vz3);
                        }
                    }
                } 
                else {
                    let verts = [];
                    if (ent.type === 'LINE') {
                        verts = ent.vertices ? [...ent.vertices] : [];
                        if (verts.length === 0 && ent.startPoint && ent.endPoint) verts = [ent.startPoint, ent.endPoint];
                    } else if (ent.type === 'POLYLINE' || ent.type === 'LWPOLYLINE') {
                        verts = ent.vertices ? [...ent.vertices] : [];
                        if (ent.shape || ent.closed) { if (verts.length > 0) verts.push(verts[0]); }
                    } else if (hasLine && (ent.type === '3DFACE' || ent.type === 'SOLID')) {
                        verts = ent.vertices ? [...ent.vertices] : [];
                        if (verts.length > 0) verts.push(verts[0]);
                    }

                    if (verts.length > 1) {
                        if (!colorLineGroups[hexValue]) colorLineGroups[hexValue] = [];
                        for (let i = 0; i < verts.length - 1; i++) {
                            let v1 = verts[i], v2 = verts[i+1];
                            if(v1 && v2) {
                                let z1 = v1.z !== undefined ? v1.z : (ent.elevation || 0);
                                let z2 = v2.z !== undefined ? v2.z : (ent.elevation || 0);
                                
                                let vx1 = v1.x - origin.x, vy1 = z1 - origin.y, vz1 = -v1.y - origin.z;
                                let vx2 = v2.x - origin.x, vy2 = z2 - origin.y, vz2 = -v2.y - origin.z;
                                
                                colorLineGroups[hexValue].push(vx1, vy1, vz1, vx2, vy2, vz2);
                            }
                        }
                    }
                }
            });

            // Bebaskan memori parse tree secepatnya
            dxfData = null; 

            // Convert ke Typed Arrays (Float32Array) dan siapkan Transferable Objects
            const buffers = [];
            const processedFaces = [];
            const processedLines = [];

            Object.keys(colorFaceGroups).forEach(hexKey => {
                const arr = colorFaceGroups[hexKey];
                if (arr.length > 0) {
                    const typedArray = new Float32Array(arr);
                    processedFaces.push({ hex: parseInt(hexKey), buffer: typedArray.buffer });
                    buffers.push(typedArray.buffer); // Tambahkan ke daftar transferable
                }
            });

            Object.keys(colorLineGroups).forEach(hexKey => {
                const arr = colorLineGroups[hexKey];
                if (arr.length > 0) {
                    const typedArray = new Float32Array(arr);
                    processedLines.push({ hex: parseInt(hexKey), buffer: typedArray.buffer });
                    buffers.push(typedArray.buffer); // Tambahkan ke daftar transferable
                }
            });

            // Kirim kembali ke main thread TANPA mengkopi data (Zero-Copy)
            self.postMessage({
                success: true,
                origin: origin,
                faces: processedFaces,
                lines: processedLines
            }, buffers);
        };
    `;

    // 2. Inisialisasi Web Worker dari Blob
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    // Persiapkan origin
    if (typeof worldOrigin === 'undefined') window.worldOrigin = { isSet: false, x:0, y:0, z:0 };

    // Terima balasan dari worker
    worker.onmessage = function(e) {
        if (e.data.error) {
            alert(e.data.error);
            if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
            return;
        }

        // Sinkronisasi Origin
        if (!worldOrigin.isSet && e.data.origin && e.data.origin.isSet) {
            worldOrigin = e.data.origin;
        }

        const group = new THREE.Group();
        group.name = fileName;
        group.visible = false; 

        let hasFaces = e.data.faces.length > 0;
        let dxfType = hasFaces ? 'Polymesh' : 'Polyline';
        
        let filenameColorOverride = null;
        let uiColorHex = "#ffffff";
        let firstColorCaptured = false;

        // Auto Color Override Logic
        if (hasFaces) {
            const lowerName = fileName.toLowerCase();
            if (lowerName.includes('topo') || lowerName.includes('sit') || lowerName.includes('eom') || lowerName.includes('week') || lowerName.includes('gr')) {
                filenameColorOverride = 0x228B22; // Forest Green
            } else if (lowerName.includes('pit') || lowerName.includes('monthly') || lowerName.includes('yearly') || lowerName.includes('lom')) {
                filenameColorOverride = 0xC38636; // Brown
            } else if (lowerName.includes('opd') || lowerName.includes('ipd') || lowerName.includes('dump') || lowerName.includes('wd') || lowerName.includes('disp')) {
                filenameColorOverride = 0xD2B48C; // Tan
            }
            if (filenameColorOverride !== null) {
                uiColorHex = '#' + filenameColorOverride.toString(16).padStart(6, '0');
                firstColorCaptured = true;
            }
        }

        // 3. Bangun Geometri Three.js langsung dari ArrayBuffer yang dikirim
        e.data.faces.forEach(item => {
            const finalColor = filenameColorOverride !== null ? filenameColorOverride : item.hex;
            if (!firstColorCaptured) {
                uiColorHex = '#' + finalColor.toString(16).padStart(6, '0');
                firstColorCaptured = true;
            }

            const geo = new THREE.BufferGeometry();
            // Langsung pakai buffer untuk menghemat RAM
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(item.buffer), 3));
            geo.computeVertexNormals(); 

            const mat = new THREE.MeshStandardMaterial({
                color: finalColor,
                side: THREE.DoubleSide,
                roughness: 0.6,
                metalness: 0.1,
                polygonOffset: true, 
                polygonOffsetFactor: 1, 
                polygonOffsetUnits: 1
            });
            
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData.originalColor = finalColor;
            mesh.userData.originalMaterial = mat; 
            group.add(mesh);
        });

        e.data.lines.forEach(item => {
            if (!firstColorCaptured) {
                uiColorHex = '#' + item.hex.toString(16).padStart(6, '0');
                firstColorCaptured = true;
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(item.buffer), 3));
            const mat = new THREE.LineBasicMaterial({ color: item.hex });
            const lines = new THREE.LineSegments(geo, mat);
            lines.userData.originalColor = item.hex;
            group.add(lines);
        });

        // 4. Cleanup & Garbage Collection Agresif
        worker.terminate();
        URL.revokeObjectURL(workerUrl);

        if (typeof scene !== 'undefined') scene.add(group);
        const layerId = 'layer_' + Date.now();

        if (typeof appLayers !== 'undefined') {
            appLayers.push({ 
                id: layerId, 
                name: fileName, 
                visible: false, 
                threeObject: group, 
                colorHex: uiColorHex,
                defaultColorHex: uiColorHex,
                type: 'dxf',
                hasFaces: hasFaces,
                dxfType: dxfType,
                clippingEnabled: false,
                clipFootprints: 'Pit Data',
                colorMode: 'Default',
                visualColor: uiColorHex,
                fileSize: capturedFileMeta.size,             // Menggunakan metadata yang sudah ditangkap
                lastModified: capturedFileMeta.lastModified, // Menggunakan metadata yang sudah ditangkap
                textureMeta: null
            });
        }

        if (typeof RizpecDB !== 'undefined') {
            RizpecDB.set(`rizpec_dxf_entity_${fileName.replace(/\s+/g, '_')}_meta`, { dxfType: dxfType }).catch(() => {});
        }

        const rootName = 'DXF Data';
        const parentId = 'folder-dxf';
        const container = document.getElementById(`subfolders-${parentId}`);
        if (container && typeof window.makeSubfolderInteractive === 'function') {
            const existingNames = Array.from(container.querySelectorAll('.folder-name-text')).map(el => el.textContent);
            if (!existingNames.includes(fileName)) {
                if (typeof folderState !== 'undefined' && folderState[rootName] !== undefined) {
                    folderState[rootName]++;
                }
                const subEl = document.createElement('div');
                container.appendChild(subEl);
                window.makeSubfolderInteractive(subEl, fileName, rootName);
            }
        }
        
        if (typeof updateLayerUI === 'function') updateLayerUI();
        if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();

        setTimeout(() => {
            if(typeof window.zoomToLayer === 'function') window.zoomToLayer(layerId);
            if(typeof updateFileMenuState === 'function') updateFileMenuState();
            
            if (typeof window.selectFolder === 'function') {
                window.selectFolder(fileName, 'Subfolder', rootName);
            }
            
            const summaryName = document.getElementById('summary-name');
            if (summaryName && (summaryName.textContent === 'DXF Data' || summaryName.textContent === fileName)) {
                if (typeof window.updateDxfListUI === 'function') window.updateDxfListUI();
                if (summaryName.textContent === 'DXF Data') {
                    if (typeof aggregateAllDxfData === 'function') aggregateAllDxfData();
                } else {
                    if (typeof updateDxfSummaryUI === 'function') updateDxfSummaryUI(fileName);
                }
            }

            if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
                requestAnimationFrame(() => renderer.render(scene, camera));
            }
        }, 100);
    };

    // Eksekusi Worker
    worker.postMessage({
        dxfText: dxfText,
        parserUrl: getDxfParserScriptUrl(), // Cari url library dinamis
        worldOriginSet: worldOrigin.isSet,
        existingOrigin: worldOrigin
    });

    // 5. Kosongkan Text asli secepatnya dari Main Thread agar tidak double memory
    dxfText = null; 
}


// ==========================================
// DXF UI STATE MANAGEMENT & 2D PREVIEW
// ==========================================

window.dxfStates = {};
window.activeDxfId = null;
window._lastSelectedDxfFolderName = null; 
window.dxfTempState = null;

// GLOBAL CACHE UNTUK RENDERER 2D PREVIEW (Mencegah Context Lost & Memory Leak)
window._dxfPreviewSystem = null;

// --- GLOBAL EVENT DELEGATION UNTUK CHECKBOX DXF ---
document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('dxf-visibility-cb')) {
        const layerId = e.target.getAttribute('data-id');
        const layer = typeof appLayers !== 'undefined' ? appLayers.find(l => l.id === layerId) : null;
        
        if (layer) {
            layer.visible = e.target.checked;
            
            if (layer.threeObject) {
                layer.threeObject.visible = layer.visible;

                if (layer.visible && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
                    const box = new THREE.Box3().setFromObject(layer.threeObject);
                    if (!box.isEmpty()) {
                        const center = box.getCenter(new THREE.Vector3());
                        const sphere = box.getBoundingSphere(new THREE.Sphere());
                        const radius = sphere.radius;
                        const fov = camera.fov * (Math.PI / 180);

                        let cameraDistance = Math.abs(radius / Math.sin(fov / 2));
                        if (camera.aspect < 1) { 
                            cameraDistance /= camera.aspect;
                        }
                        cameraDistance *= 1.1; 

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
            }
            
            window.updateDxfListUI();
            if (typeof updateLayerUI === 'function') updateLayerUI();

            if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
                requestAnimationFrame(() => renderer.render(scene, camera));
            }

            if (!layer.visible && typeof window.AppGeolocation !== 'undefined' && window.AppGeolocation.isTracking) {
                const geoCheck = window.AppGeolocation.checkActiveBounds();
                if (!geoCheck.hasData) {
                    console.warn("Semua data 3D telah dihapus/disembunyikan. Mematikan fitur Geolocation otomatis.");
                    window.AppGeolocation.toggleTracking(); 
                    const btnTrack = document.getElementById('btn-start-tracking');
                    if (btnTrack) {
                        btnTrack.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Tracking';
                        btnTrack.classList.remove('bg-rose-600', 'hover:bg-rose-500');
                        btnTrack.classList.add('bg-blue-600', 'hover:bg-blue-500');
                    }
                }
            }
        }
    }
});
// ---------------------------------------------------------------------------

window.getDxfFolderBadgeHTML = function(name, rootName) {
    if (rootName === 'DXF Data') {
        const safeId = name.replace(/\s+/g, '_');
        
        if (typeof RizpecDB !== 'undefined') {
            RizpecDB.get(`rizpec_dxf_entity_${safeId}_meta`).then(meta => {
                if (meta && meta.dxfType) {
                    window.updateDxfFolderBadge(name, meta.dxfType);
                }
            }).catch(() => {});
        } 
        
        if (typeof appLayers !== 'undefined') {
            const layer = appLayers.find(l => l.name === name && l.type === 'dxf');
            if (layer && layer.dxfType) {
                setTimeout(() => window.updateDxfFolderBadge(name, layer.dxfType), 50);
            }
        }
        
        return '';
    }
    return '';
};

window.updateDxfFolderBadge = function(dxfId, type) {
    const container = document.getElementById('subfolders-folder-dxf');
    if (!container) return;
    
    const folders = container.querySelectorAll('.folder-name-text');
    for (let span of folders) {
        if (span.textContent === dxfId) {
            const subEl = span.closest('.group');
            if (subEl) {
                const badgeContainer = subEl.querySelector('.geometry-badge-container');
                if (badgeContainer) {
                    if (type === 'Polyline') {
                        badgeContainer.innerHTML = '<span class="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">POLYLINE</span>';
                    } else if (type === 'Polymesh') {
                        badgeContainer.innerHTML = '<span class="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">POLYMESH</span>';
                    } else if (type === 'Textured') {
                        badgeContainer.innerHTML = '<span class="bg-amber-600/20 text-amber-400 border border-amber-500/30 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm shadow-amber-500/20">TEXTURED</span>';
                    } else {
                        badgeContainer.innerHTML = '';
                    }
                }
            }
            break;
        }
    }
};

window.render2DDxfPreview = function(layers) {
    const container = document.getElementById('dxf-preview-3d-canvas');
    if (!container) return;
    
    if (!layers || layers.length === 0) {
        if (window._dxfPreviewSystem && window._dxfPreviewSystem.renderer.domElement.parentNode) {
            container.removeChild(window._dxfPreviewSystem.renderer.domElement);
        }
        container.innerHTML = `
            <div id="dxf-preview-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-70 pointer-events-none">
                <i class="fa-solid fa-map text-4xl lg:text-3xl mb-3 lg:mb-2"></i>
                <span class="text-[12px] lg:text-[11px] italic">2D Top View Preview Area</span>
            </div>`;
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    if (!window._dxfPreviewSystem) {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x0f172a, 1);
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        
        const scene = new THREE.Scene();
        const previewGroup = new THREE.Group();
        scene.add(previewGroup);
        
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        camera.up.set(0, 0, -1); 
        
        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
        scene.add(dirLight);
        
        window._dxfPreviewSystem = { renderer, scene, camera, previewGroup, dirLight };
    }

    const { renderer, scene, camera, previewGroup, dirLight } = window._dxfPreviewSystem;

    container.innerHTML = '';
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // [FIX 1: MEMORY LEAK] Membersihkan Clone Mesh dan membantu Garbage Collection
    while(previewGroup.children.length > 0) {
        const child = previewGroup.children[0];
        previewGroup.remove(child);
        child.userData = {}; // Netralkan referensi user data agar V8 gampang menyapu memori
    }

    layers.forEach(l => {
        if(l.threeObject) {
            const clone = l.threeObject.clone();
            clone.visible = true;
            previewGroup.add(clone);
        }
    });

    const box = new THREE.Box3().setFromObject(previewGroup);
    if(box.isEmpty()) return;

    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    const aspect = width / height;
    const maxDim = Math.max(size.x, size.z);
    
    const frustumHeight = size.z > size.x / aspect ? size.z * 1.15 : (size.x / aspect) * 1.15;
    const frustumWidth = frustumHeight * aspect;

    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.near = -maxDim * 5;
    camera.far = maxDim * 5;

    camera.position.set(center.x, box.max.y + maxDim, center.z);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();

    dirLight.position.set(center.x, box.max.y + maxDim, center.z);

    renderer.render(scene, camera);
    
    if (window._dxfResizeObserver) window._dxfResizeObserver.disconnect();
    window._dxfResizeObserver = new ResizeObserver(() => {
        const newW = container.clientWidth;
        const newH = container.clientHeight;
        if(newW === 0 || newH === 0) return;
        renderer.setSize(newW, newH);
        
        const newAspect = newW / newH;
        const newFrustumHeight = size.z > size.x / newAspect ? size.z * 1.15 : (size.x / newAspect) * 1.15;
        const newFrustumWidth = newFrustumHeight * newAspect;
        
        camera.left = -newFrustumWidth / 2;
        camera.right = newFrustumWidth / 2;
        camera.top = newFrustumHeight / 2;
        camera.bottom = -newFrustumHeight / 2;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    });
    window._dxfResizeObserver.observe(container);
};


window.initDxfManagerUI = function() {
    const leftPanel = document.querySelector('#file-summary-content > div:first-child');
    if (!leftPanel) return;
    
    let container = document.getElementById('dxf-manager');
    if (!container) {
        container = document.createElement('div');
        container.id = 'dxf-manager';
        
        const summaryNameEl = document.getElementById('summary-name');
        const isRootFolder = summaryNameEl && summaryNameEl.textContent === 'DXF Data' && !window.activeDxfId;
        
        if (isRootFolder) {
            container.className = 'flex flex-col gap-3 pt-3 h-full px-3 overflow-hidden';
        } else {
            container.className = 'hidden flex-col gap-3 pt-3 h-full px-3 overflow-hidden';
        }

        container.innerHTML = `
            <div class="flex flex-col gap-1.5 border-b border-slate-700/50 pb-1.5 shrink-0 mt-1">
                <h4 class="text-[11px] font-bold text-rose-400 flex items-center gap-1.5 tracking-wide uppercase">
                    <i class="fa-solid fa-list-ul"></i> Layer List
                </h4>
            </div>
            <div id="dxf-manager-list" class="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] shrink-0 custom-scrollbar"></div>
        `;
        leftPanel.appendChild(container);
    }
    
    window.updateDxfListUI();
};

window.updateDxfListUI = function() {
    const listEl = document.getElementById('dxf-manager-list');
    if(!listEl) return;
    
    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
    
    listEl.innerHTML = '';
    
    if (dxfLayers.length === 0) {
        listEl.innerHTML = `
            <div class="flex flex-col items-center justify-center h-16 text-center opacity-60">
                <div class="text-[10px] text-slate-400 italic">Belum ada DXF yang dimuat.</div>
            </div>
        `;
    } else {
        dxfLayers.forEach(layer => {
            const div = document.createElement('div');
            div.className = `flex items-center justify-between gap-2.5 bg-slate-900/80 border ${layer.visible ? 'border-rose-500/50 shadow-sm' : 'border-slate-700/80'} p-2 rounded-md transition-all hover:bg-slate-800 group`;
            
            div.innerHTML = `
                <div class="flex items-center gap-2.5 overflow-hidden">
                    <label class="relative flex items-center justify-center w-5 h-5 cursor-pointer m-0 shrink-0">
                        <input type="checkbox" class="dxf-visibility-cb peer absolute opacity-0 w-full h-full cursor-pointer" data-id="${layer.id}" ${layer.visible ? 'checked' : ''}>
                        <div class="checkbox-box w-5 h-5 rounded-sm border ${layer.visible ? 'bg-rose-500 border-rose-500' : 'bg-slate-800 border-slate-600 group-hover:border-rose-400'} flex items-center justify-center transition-colors">
                            <i class="fa-solid fa-check text-white text-[10px] ${layer.visible ? 'opacity-100' : 'opacity-0'} transition-opacity"></i>
                        </div>
                    </label>
                    <span class="${layer.visible ? 'text-rose-400' : 'text-slate-300'} transition-colors font-bold text-[11px] truncate">${layer.name}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <div class="w-3 h-3 rounded-full shadow-inner border border-slate-600" style="background-color: ${layer.colorHex}"></div>
                </div>
            `;
            
            listEl.appendChild(div);
        });
    }
};

window.onDxfFolderSelected = async function(name, type, rootName) {
    const pitWrap = document.getElementById('pit-summary-wrapper');
    const dispWrap = document.getElementById('disp-summary-wrapper');
    const dxfWrap = document.getElementById('dxf-summary-wrapper');
    const container = document.getElementById('dxf-manager');

    if (rootName === 'DXF Data') {
        if (pitWrap) { pitWrap.classList.add('hidden'); pitWrap.classList.remove('flex'); }
        if (dispWrap) { dispWrap.classList.add('hidden'); dispWrap.classList.remove('flex'); }
        if (dxfWrap) { dxfWrap.classList.remove('hidden'); dxfWrap.classList.add('flex'); }

        if (type === 'Root Folder') {
            if (container) { container.classList.remove('hidden'); container.classList.add('flex'); }
        } else {
            if (container) { container.classList.add('hidden'); container.classList.remove('flex'); }
        }
    } else {
        if (container) { container.classList.add('hidden'); container.classList.remove('flex'); }
        if (dxfWrap) { dxfWrap.classList.add('hidden'); dxfWrap.classList.remove('flex'); }
    }

    if (rootName !== 'DXF Data') {
        window.activeDxfId = null;
        window.dxfTempState = null;
        window._lastSelectedDxfFolderName = null; 
        return;
    }

    if (window._lastSelectedDxfFolderName === name) return;
    window._lastSelectedDxfFolderName = name;

    if (type === 'Root Folder') {
        window.updateDxfListUI();
        window.activeDxfId = null;
        window.dxfTempState = null;
        aggregateAllDxfData();
    } else {
        window.activeDxfId = name;
        updateDxfSummaryUI(name);
    }
};

window.onDxfFolderRenamed = async function(oldName, newName, rootName) {
    if (rootName === 'DXF Data') {
        if (window._lastSelectedDxfFolderName === oldName) window._lastSelectedDxfFolderName = newName;

        if (window.dxfStates[oldName]) {
            window.dxfStates[newName] = window.dxfStates[oldName];
            window.dxfStates[newName].name = newName;
            delete window.dxfStates[oldName];
        }
        
        const oldKey = `rizpec_dxf_entity_${oldName.replace(/\s+/g, '_')}_meta`;
        const newKey = `rizpec_dxf_entity_${newName.replace(/\s+/g, '_')}_meta`;

        try {
            if (typeof RizpecDB !== 'undefined') {
                const metaData = await RizpecDB.get(oldKey);
                if (metaData) {
                    await RizpecDB.set(newKey, metaData);
                    await RizpecDB.remove(oldKey);
                }
            }
        } catch(e) {}

        if (window.activeDxfId === oldName) {
            window.activeDxfId = newName;
            updateDxfSummaryUI(newName);
        }

        if (typeof appLayers !== 'undefined') {
            const layer = appLayers.find(l => l.name === oldName && l.type === 'dxf');
            if (layer) layer.name = newName;
        }
        
        if (typeof window.renameDxfGeometry === 'function') {
            window.renameDxfGeometry(oldName, newName);
        }

        if (typeof window.updateDxfListUI === 'function') window.updateDxfListUI();
    }
};

window.onDxfFolderDeleted = async function(name, rootName) {
    if (rootName === 'DXF Data') {
        if (window._lastSelectedDxfFolderName === name) window._lastSelectedDxfFolderName = null;

        if (typeof appLayers !== 'undefined') {
            const index = appLayers.findIndex(l => l.name === name && l.type === 'dxf');
            if (index !== -1) {
                const layer = appLayers[index];
                
                if (layer.maskRenderTarget) layer.maskRenderTarget.dispose();
                if (layer.maskMat) layer.maskMat.dispose(); 
                if (layer.clipInterval) clearInterval(layer.clipInterval);
                
                if (layer.threeObject) {
                    layer.threeObject.traverse((child) => {
                        if (child.isMesh || child.isLineSegments) {
                            if (child.geometry) child.geometry.dispose();
                            
                            if (child.material) {
                                if (Array.isArray(child.material)) {
                                    child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                                } else {
                                    if (child.material.map) child.material.map.dispose();
                                    child.material.dispose();
                                }
                            }
                            
                            if (child.userData.originalMaterial) {
                                if (child.userData.originalMaterial.map) child.userData.originalMaterial.map.dispose();
                                child.userData.originalMaterial.dispose();
                            }
                            if (child.userData.originalMaterialTex) {
                                if (child.userData.originalMaterialTex.map) child.userData.originalMaterialTex.map.dispose();
                                child.userData.originalMaterialTex.dispose();
                            }
                        }
                    });
                    if (typeof scene !== 'undefined') scene.remove(layer.threeObject);
                }
                
                appLayers.splice(index, 1);
                if (typeof updateLayerUI === 'function') updateLayerUI();

                if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
                    requestAnimationFrame(() => renderer.render(scene, camera));
                }
            }
        }
        
        if (window.activeDxfId === name) {
            window.activeDxfId = null;
            window.dxfTempState = null;
        }

        const safeName = name.replace(/\s+/g, '_');
        try {
            if (typeof RizpecDB !== 'undefined') {
                await RizpecDB.remove(`rizpec_dxf_entity_${safeName}_meta`);
            }
        } catch(e) {}
        
        const summaryName = document.getElementById('summary-name');
        if (summaryName && summaryName.textContent === 'DXF Data') {
            window.updateDxfListUI();
            aggregateAllDxfData();
        }

        if (typeof window.AppGeolocation !== 'undefined' && window.AppGeolocation.isTracking) {
            const geoCheck = window.AppGeolocation.checkActiveBounds();
            if (!geoCheck.hasData) {
                console.warn("Semua data 3D telah dihapus/disembunyikan. Mematikan fitur Geolocation otomatis.");
                window.AppGeolocation.toggleTracking(); 
                const btnTrack = document.getElementById('btn-start-tracking');
                if (btnTrack) {
                    btnTrack.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Tracking';
                    btnTrack.classList.remove('bg-rose-600', 'hover:bg-rose-500');
                    btnTrack.classList.add('bg-blue-600', 'hover:bg-blue-500');
                }
            }
        }
    }
};

function updateDxfSummaryUI(name) {
    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf' && l.name === name) : [];
    const layer = dxfLayers.length > 0 ? dxfLayers[0] : null;
    
    const nameEl = document.getElementById('dxf-info-name');
    const modEl = document.getElementById('dxf-info-modified');
    const typeEl = document.getElementById('dxf-info-type');
    
    const metaEl = document.getElementById('dxf-stat-meta');
    const texEl = document.getElementById('dxf-stat-texture');
    const totEl = document.getElementById('dxf-stat-total');

    const colorSelect = document.getElementById('dxf-col-color');
    const recolorRow = document.getElementById('dxf-recolor-row');
    const recolorInput = document.getElementById('dxf-recolor-input');
    const optTexture = document.getElementById('dxf-opt-texture');
    const texRow = document.getElementById('dxf-texture-row');
    
    const clipSelect = document.getElementById('dxf-col-clipping');
    const footprintsRow = document.getElementById('dxf-footprints-row');
    const footprintsSelect = document.getElementById('dxf-col-footprints');

    const texInput = document.getElementById('dxf-texture-file');
    const texLabel = document.getElementById('dxf-btn-texture-label');
    const texClear = document.getElementById('dxf-clear-texture');
    const texName = document.getElementById('dxf-texture-filename');

    const applyBtn = document.getElementById('dxf-btn-apply');

    if (layer) {
        window.dxfTempState = {
            colorMode: layer.colorMode || 'Default',
            visualColor: layer.visualColor || layer.colorHex,
            clippingEnabled: layer.clippingEnabled || false,
            clipFootprints: layer.clipFootprints || 'Pit Data',
            pendingTextureMeta: layer.textureMeta,
            textureChanged: false
        };

        let elements = 0;
        layer.threeObject.children.forEach(c => {
            if (c.isMesh && c.geometry.attributes.position) elements += (c.geometry.attributes.position.count / 3);
            if (c.isLineSegments && c.geometry.attributes.position) elements += (c.geometry.attributes.position.count / 2);
        });

        if (nameEl) nameEl.textContent = layer.name;
        if (modEl) modEl.textContent = layer.lastModified || '-';
        if (typeEl) typeEl.textContent = layer.hasFaces ? 'Polymesh (3D Face)' : 'Polyline (Line/Wire)';
        
        if (optTexture) {
            if (layer.hasFaces) {
                optTexture.disabled = false;
                optTexture.hidden = false;
            } else {
                optTexture.disabled = true;
                optTexture.hidden = true;
                if (window.dxfTempState.colorMode === 'Texture') {
                    window.dxfTempState.colorMode = 'Default';
                }
            }
        }
        
        if (colorSelect) {
            colorSelect.value = window.dxfTempState.colorMode;
            if (recolorRow) recolorRow.style.display = window.dxfTempState.colorMode === 'Pallete' ? 'flex' : 'none';
            if (texRow) texRow.style.display = window.dxfTempState.colorMode === 'Texture' ? 'flex' : 'none';
        }
        if (recolorInput) recolorInput.value = window.dxfTempState.visualColor;

        if (layer.hasFaces) {
            if (clipSelect) {
                clipSelect.disabled = false;
                clipSelect.value = window.dxfTempState.clippingEnabled ? "Yes" : "No";
                if (footprintsRow) footprintsRow.style.display = window.dxfTempState.clippingEnabled ? 'flex' : 'none';
            }
            if (footprintsSelect) footprintsSelect.value = window.dxfTempState.clipFootprints;

            if (texInput) texInput.disabled = false;
            if (texLabel) texLabel.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            if (clipSelect) {
                clipSelect.disabled = true;
                clipSelect.value = "No";
                if (footprintsRow) footprintsRow.style.display = 'none';
            }
            
            if (texInput) texInput.disabled = true;
            if (texLabel) texLabel.classList.add('opacity-50', 'cursor-not-allowed');
        }

        if (applyBtn) applyBtn.disabled = true;

        const sizeMB = (layer.fileSize / (1024 * 1024)).toFixed(2);
        if (metaEl) metaEl.textContent = `${sizeMB} MB (${Math.floor(elements)} Elements)`;
        
        let texSizeMB = "0.00";
        let texRes = "0 x 0";
        if (layer.textureMeta) {
            texSizeMB = (layer.textureMeta.size / (1024*1024)).toFixed(2);
            texRes = `${layer.textureMeta.width} x ${layer.textureMeta.height} px`;
            if (texName) texName.textContent = layer.textureMeta.name;
            if (texClear) texClear.disabled = false;
        } else {
            if (texName) texName.textContent = 'Tidak ada file...';
            if (texClear) texClear.disabled = true;
        }
        if (texEl) texEl.textContent = `${texSizeMB} MB (${texRes})`;
        
        const totalMB = (parseFloat(sizeMB) + parseFloat(texSizeMB)).toFixed(2);
        if (totEl) totEl.textContent = `${totalMB} MB`;

        renderDxfPreview(layer);
    } else {
        if (nameEl) nameEl.textContent = '-';
        if (modEl) modEl.textContent = '-';
        if (typeEl) typeEl.textContent = '-';
        
        if (metaEl) metaEl.textContent = '0.00 MB (0 Elements)';
        if (texEl) texEl.textContent = '0.00 MB (0 x 0)';
        if (totEl) totEl.textContent = '0.00 MB';

        if (colorSelect) colorSelect.value = "Default";
        if (recolorRow) recolorRow.style.display = 'none';
        if (texRow) texRow.style.display = 'none';
        
        if (clipSelect) { clipSelect.disabled = true; clipSelect.value = "No"; }
        if (footprintsRow) footprintsRow.style.display = 'none';

        if (texInput) texInput.disabled = true;
        if (texLabel) texLabel.classList.add('opacity-50', 'cursor-not-allowed');
        if (texClear) texClear.disabled = true;
        if (texName) texName.textContent = 'Tidak ada file...';

        if (applyBtn) applyBtn.disabled = true;

        renderDxfPreview(null);
    }
}

function checkDxfChanges() {
    if (!window.activeDxfId || !window.dxfTempState) return false;
    const layer = appLayers.find(l => l.type === 'dxf' && l.name === window.activeDxfId);
    if (!layer) return false;

    let hasChanges = false;
    if ((layer.colorMode || 'Default') !== window.dxfTempState.colorMode) hasChanges = true;
    if ((layer.visualColor || layer.colorHex) !== window.dxfTempState.visualColor) hasChanges = true;
    if ((layer.clippingEnabled || false) !== window.dxfTempState.clippingEnabled) hasChanges = true;
    if ((layer.clipFootprints || 'Pit Data') !== window.dxfTempState.clipFootprints) hasChanges = true;
    if (window.dxfTempState.textureChanged) hasChanges = true;
    
    const applyBtn = document.getElementById('dxf-btn-apply');
    if (applyBtn) applyBtn.disabled = !hasChanges;
    
    return hasChanges;
}

function aggregateAllDxfData() {
    const dxfLayers = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf') : [];
    
    const metaEl = document.getElementById('dxf-stat-meta');
    const texEl = document.getElementById('dxf-stat-texture');
    const totEl = document.getElementById('dxf-stat-total');
    
    let totalElements = 0, totalFileSize = 0, totalTexSize = 0;
    
    dxfLayers.forEach(layer => {
        layer.threeObject.children.forEach(c => {
            if (c.isMesh && c.geometry.attributes.position) totalElements += (c.geometry.attributes.position.count / 3);
            if (c.isLineSegments && c.geometry.attributes.position) totalElements += (c.geometry.attributes.position.count / 2);
        });
        totalFileSize += (layer.fileSize || 0);
        if (layer.textureMeta) totalTexSize += (layer.textureMeta.size || 0);
    });
    
    const sizeMB = (totalFileSize / (1024 * 1024)).toFixed(2);
    const texSizeMB = (totalTexSize / (1024 * 1024)).toFixed(2);
    const totalMB = (parseFloat(sizeMB) + parseFloat(texSizeMB)).toFixed(2);

    if (metaEl) metaEl.textContent = `${sizeMB} MB (${Math.floor(totalElements)} Elements)`;
    if (texEl) texEl.textContent = `${texSizeMB} MB`;
    if (totEl) totEl.textContent = `${totalMB} MB`;
    
    renderDxfPreview(null, dxfLayers);
}

function renderDxfPreview(singleLayer, allLayers = []) {
    const placeholder = document.getElementById('dxf-preview-placeholder');
    const summaryTable = document.getElementById('dxf-preview-summary-table');
    const summaryContent = document.getElementById('dxf-preview-summary-content');
    
    const layersToRender = singleLayer ? [singleLayer] : allLayers;
    
    if (layersToRender.length === 0) {
        if (placeholder) placeholder.classList.remove('hidden');
        if (summaryTable) summaryTable.classList.add('hidden');
        window.render2DDxfPreview([]); 
        return;
    }
    
    if (placeholder) placeholder.classList.add('hidden');
    if (summaryTable) summaryTable.classList.remove('hidden');
    
    let html = `
        <div class="text-rose-400 font-semibold mb-1 border-b border-slate-600 pb-0.5">Ringkasan DXF</div>
        <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center">
            <span class="text-slate-400">Total Layer</span>
            <span class="font-bold text-slate-200">${layersToRender.length}</span>
        </div>
    `;
    
    if (singleLayer) {
        let texStatus = singleLayer.textureMeta ? 'Applied' : 'None';
        html += `
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center mt-1">
                <span class="text-slate-400">Tipe Geometri</span>
                <span class="font-bold text-slate-200 text-right text-[10px]">${singleLayer.hasFaces ? 'Polymesh' : 'Polyline'}</span>
            </div>
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center mt-1">
                <span class="text-slate-400">Warna Dasar</span>
                <div class="flex items-center gap-1.5">
                    <div class="w-3 h-3 rounded-full border border-slate-500" style="background-color: ${singleLayer.colorHex}"></div>
                    <span class="font-mono text-slate-200">${singleLayer.colorHex}</span>
                </div>
            </div>
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center mt-1">
                <span class="text-slate-400">Texture</span>
                <span class="font-bold text-slate-200 text-right">${texStatus}</span>
            </div>
        `;
    } else {
        let hasSolid = layersToRender.some(l => l.hasFaces);
        let hasLine = layersToRender.some(l => !l.hasFaces);
        let typeStr = hasSolid && hasLine ? 'Campuran' : (hasSolid ? 'Hanya Polymesh' : 'Hanya Polyline');
        
        html += `
            <div class="flex justify-between border-b border-slate-700/50 pb-1 items-center mt-1">
                <span class="text-slate-400">Dominasi Tipe</span>
                <span class="font-bold text-slate-200 text-right text-[10px]">${typeStr}</span>
            </div>
        `;
    }
    
    if (summaryContent) summaryContent.innerHTML = html;
    
    window.render2DDxfPreview(layersToRender);
}

// ==========================================
// DXF FOOTPRINT CLIPPING LOGIC (SHADER TEXTURE MASKING)
// ==========================================
window.executeDxfFootprintClipping = function(layer) {
    if (!layer.threeObject) return;

    if (layer.clipInterval) {
        clearInterval(layer.clipInterval);
        layer.clipInterval = null;
    }

    layer.threeObject.traverse((child) => {
        if (!child.isMesh) return;

        if (child.userData.originalPositions) {
            child.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(child.userData.originalPositions), 3));
            child.geometry.clearGroups();
            child.geometry.computeVertexNormals();
            delete child.userData.originalPositions; 
        }

        if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
        }
    });

    if (!layer.clippingEnabled) return;

    let allTargetMeshes = [];
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(m => {
            if (layer.clipFootprints === 'All Data' ||
               (layer.clipFootprints === 'Pit Data' && m.userData.type === 'pit') ||
               (layer.clipFootprints === 'Disposal Data' && m.userData.type === 'disp')) {
                allTargetMeshes.push(m);
            }
        });
    }

    if (allTargetMeshes.length === 0) return;

    if (typeof renderer === 'undefined') {
        console.warn("Renderer 3D tidak ditemukan, membatalkan Texture Masking.");
        return;
    }

    const targetBox2D = new THREE.Box3();
    allTargetMeshes.forEach(m => {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        let b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
        targetBox2D.expandByPoint(new THREE.Vector3(b.min.x, 0, b.min.z));
        targetBox2D.expandByPoint(new THREE.Vector3(b.max.x, 0, b.max.z));
    });

    const pad = 10; 
    const minX = targetBox2D.min.x - pad;
    const maxX = targetBox2D.max.x + pad;
    const minZ = targetBox2D.min.z - pad;
    const maxZ = targetBox2D.max.z + pad;

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const w = maxX - minX;
    const h = maxZ - minZ;

    const cam = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, -10000, 10000);
    cam.position.set(cx, 1000, cz);
    cam.up.set(0, 0, -1);
    cam.lookAt(cx, 0, cz);
    cam.updateProjectionMatrix();

    const maskScene = new THREE.Scene();
    maskScene.background = new THREE.Color(0x000000); 
    
    if (layer.maskMat) layer.maskMat.dispose();
    layer.maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }); 

    if (layer.maskRenderTarget) {
        layer.maskRenderTarget.dispose(); 
    }

    const rtRes = 1024;
    const rt = new THREE.WebGLRenderTarget(rtRes, rtRes, {
        format: THREE.RedFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false
    });
    layer.maskRenderTarget = rt;

    layer.threeObject.traverse((child) => {
        if (!child.isMesh) return;

        if (child.material && child.material.customProgramCacheKey) {
            child.material.dispose();
        }

        const baseMat = (layer.colorMode === 'Texture' && layer.textureMeta && child.userData.originalMaterialTex) 
                        ? child.userData.originalMaterialTex 
                        : child.userData.originalMaterial;

        const newMat = baseMat.clone();

        newMat.customProgramCacheKey = function() {
            return 'dxf_mask_' + layer.id;
        };

        newMat.onBeforeCompile = (shader) => {
            shader.uniforms.maskTexture = { value: rt.texture };
            shader.uniforms.maskBounds = { value: new THREE.Vector4(minX, w, maxZ, -h) };

            shader.vertexShader = `
                varying vec3 vMaskWorldPos;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                `#include <worldpos_vertex>`,
                `#include <worldpos_vertex>
                 vMaskWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );

            shader.fragmentShader = `
                uniform sampler2D maskTexture;
                uniform vec4 maskBounds;
                varying vec3 vMaskWorldPos;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <dithering_fragment>`,
                `#include <dithering_fragment>

                float u = (vMaskWorldPos.x - maskBounds.x) / maskBounds.y;
                float v = (vMaskWorldPos.z - maskBounds.z) / maskBounds.w;

                if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
                    float maskVal = texture2D(maskTexture, vec2(u, v)).r;
                    if (maskVal > 0.05) {
                        discard;
                    }
                }
                `
            );
        };

        child.material = newMat;
    });

    layer.lastMaskHash = "";

    layer.updateClippingMask = function() {
        let hash = "";
        let currentVisibleMeshes = [];

        allTargetMeshes.forEach(m => {
            let isParentVisible = true;
            let obj = m.parent; 
            
            while(obj) {
                if (obj.visible === false) {
                    isParentVisible = false;
                    break;
                }
                obj = obj.parent;
            }

            if (isParentVisible) {
                currentVisibleMeshes.push(m);
                hash += m.uuid + ",";
            }
        });

        if (hash === layer.lastMaskHash) return;
        layer.lastMaskHash = hash;

        while(maskScene.children.length > 0){ 
            maskScene.remove(maskScene.children[0]); 
        }

        currentVisibleMeshes.forEach(m => {
            const clone = m.clone();
            clone.material = layer.maskMat;
            clone.matrixAutoUpdate = false;
            clone.matrix.copy(m.matrixWorld); 
            clone.visible = true; 
            maskScene.add(clone);
        });

        const oldRT = renderer.getRenderTarget();
        const oldClearColor = renderer.getClearColor(new THREE.Color());
        const oldClearAlpha = renderer.getClearAlpha();

        renderer.setRenderTarget(rt);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(maskScene, cam);

        renderer.setRenderTarget(oldRT);
        renderer.setClearColor(oldClearColor, oldClearAlpha);
    };

    layer.updateClippingMask();

    layer.clipInterval = setInterval(() => {
        if (layer && layer.threeObject && layer.clippingEnabled) {
            layer.updateClippingMask();
        } else {
            clearInterval(layer.clipInterval);
        }
    }, 300); 
};

window.refreshAllDxfClipping = function() {
    if (typeof appLayers === 'undefined') return;
    
    const activeClippingLayers = appLayers.filter(l => l.type === 'dxf' && l.hasFaces && l.clippingEnabled);
    
    activeClippingLayers.forEach(layer => {
        if (layer.threeObject) {
            layer.threeObject.traverse((child) => {
                if (child.isMesh && child.userData) {
                    const baseMat = (layer.colorMode === 'Texture' && layer.textureMeta && child.userData.originalMaterialTex) 
                                    ? child.userData.originalMaterialTex 
                                    : child.userData.originalMaterial;
                    if (baseMat) {
                        if (child.material && child.material !== baseMat && child.material.customProgramCacheKey) {
                            child.material.dispose();
                        }
                        child.material = baseMat;
                    }
                }
            });
        }
        window.executeDxfFootprintClipping(layer);
    });
};

document.addEventListener('DOMContentLoaded', () => {

    const dxfInput = document.getElementById('file-input-dxf');
    if (dxfInput) {
        dxfInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const dateOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' };
                window.pendingDxfMeta = {
                    size: file.size,
                    lastModified: new Date(file.lastModified).toLocaleDateString('id-ID', dateOptions)
                };
            }
        });
    }

    const colorSelect = document.getElementById('dxf-col-color');
    const recolorRow = document.getElementById('dxf-recolor-row');
    const recolorInput = document.getElementById('dxf-recolor-input');
    const texRow = document.getElementById('dxf-texture-row');
    
    const clipSelect = document.getElementById('dxf-col-clipping');
    const footprintsRow = document.getElementById('dxf-footprints-row');
    const footprintsSelect = document.getElementById('dxf-col-footprints');

    const texInput = document.getElementById('dxf-texture-file');
    const texLabel = document.getElementById('dxf-btn-texture-label');
    const texClear = document.getElementById('dxf-clear-texture');
    const texName = document.getElementById('dxf-texture-filename');

    const applyBtn = document.getElementById('dxf-btn-apply');

    if (colorSelect) {
        colorSelect.addEventListener('change', (e) => {
            if (recolorRow) recolorRow.style.display = e.target.value === "Pallete" ? 'flex' : 'none';
            if (texRow) texRow.style.display = e.target.value === "Texture" ? 'flex' : 'none';
            if (window.dxfTempState) window.dxfTempState.colorMode = e.target.value;
            checkDxfChanges();
        });
    }

    if (recolorInput) {
        recolorInput.addEventListener('input', (e) => {
            if (window.dxfTempState) window.dxfTempState.visualColor = e.target.value;
            checkDxfChanges();
        });
    }

    if (clipSelect) {
        clipSelect.addEventListener('change', (e) => {
            if (footprintsRow) footprintsRow.style.display = e.target.value === "Yes" ? 'flex' : 'none';
            if (window.dxfTempState) window.dxfTempState.clippingEnabled = e.target.value === "Yes";
            checkDxfChanges();
        });
    }

    if (footprintsSelect) {
        footprintsSelect.addEventListener('change', (e) => {
            if (window.dxfTempState) window.dxfTempState.clipFootprints = e.target.value;
            checkDxfChanges();
        });
    }

    if (texInput) {
        texInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0 && window.activeDxfId && window.dxfTempState) {
                const file = e.target.files[0];
                const layer = appLayers.find(l => l.type === 'dxf' && l.name === window.activeDxfId);
                
                if (!layer || !layer.hasFaces) {
                    alert("Geometri ini bukan Polymesh. Texture hanya bisa diaplikasikan ke Geometri 3DFace / Polymesh.");
                    texInput.value = '';
                    return;
                }
                
                const img = new Image();
                img.onload = () => {
                    window.initGcpModal(img, file, layer);
                };
                img.src = URL.createObjectURL(file);
            }
        });
    }

    if (texClear) {
        texClear.addEventListener('click', () => {
            if (window.activeDxfId && window.dxfTempState) {
                window.dxfTempState.pendingTextureMeta = null;
                window.dxfTempState.textureChanged = true;
                if(texInput) texInput.value = '';
                if(texName) texName.textContent = 'Tidak ada file...';
                if(texClear) texClear.disabled = true;
                
                const layer = appLayers.find(l => l.type === 'dxf' && l.name === window.activeDxfId);
                if (layer && layer.threeObject) {
                    layer.threeObject.traverse((child) => {
                        if (child.isMesh && child.userData.originalMaterial) {
                            if (child.material && child.material !== child.userData.originalMaterial && child.material.customProgramCacheKey) {
                                child.material.dispose();
                            }
                            child.material = child.userData.originalMaterial;
                            
                            if (child.userData.originalMaterialTex) {
                                if (child.userData.originalMaterialTex.map) child.userData.originalMaterialTex.map.dispose();
                                child.userData.originalMaterialTex.dispose();
                            }
                            child.userData.originalMaterialTex = null;
                        }
                    });
                }
                
                checkDxfChanges();
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (!window.activeDxfId || !window.dxfTempState) return;
            const layer = appLayers.find(l => l.type === 'dxf' && l.name === window.activeDxfId);
            
            if (layer) {
                layer.colorMode = window.dxfTempState.colorMode;
                layer.visualColor = window.dxfTempState.visualColor;
                layer.clippingEnabled = window.dxfTempState.clippingEnabled;
                layer.clipFootprints = window.dxfTempState.clipFootprints;
                
                if (window.dxfTempState.textureChanged) {
                    layer.textureMeta = window.dxfTempState.pendingTextureMeta;
                    
                    if (layer.colorMode === 'Texture' && layer.textureMeta) {
                        layer.dxfType = 'Textured';
                        if (typeof RizpecDB !== 'undefined') {
                            RizpecDB.set(`rizpec_dxf_entity_${window.activeDxfId.replace(/\s+/g, '_')}_meta`, { dxfType: 'Textured' }).catch(()=>{});
                        }
                        if (typeof window.updateDxfFolderBadge === 'function') {
                            window.updateDxfFolderBadge(window.activeDxfId, 'Textured');
                        }
                    } else if (layer.hasFaces) {
                        layer.dxfType = 'Polymesh';
                        if (typeof RizpecDB !== 'undefined') {
                            RizpecDB.set(`rizpec_dxf_entity_${window.activeDxfId.replace(/\s+/g, '_')}_meta`, { dxfType: 'Polymesh' }).catch(()=>{});
                        }
                        if (typeof window.updateDxfFolderBadge === 'function') {
                            window.updateDxfFolderBadge(window.activeDxfId, 'Polymesh');
                        }
                    } else {
                        layer.dxfType = 'Polyline';
                        if (typeof RizpecDB !== 'undefined') {
                            RizpecDB.set(`rizpec_dxf_entity_${window.activeDxfId.replace(/\s+/g, '_')}_meta`, { dxfType: 'Polyline' }).catch(()=>{});
                        }
                        if (typeof window.updateDxfFolderBadge === 'function') {
                            window.updateDxfFolderBadge(window.activeDxfId, 'Polyline');
                        }
                    }
                    window.dxfTempState.textureChanged = false;
                }

                const processChanges = () => {
                    const setMatColors = (mesh, state, defaultHex) => {
                        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                        mats.forEach(m => {
                            if (m) {
                                m.vertexColors = state;
                                m.needsUpdate = true;
                                if (defaultHex !== undefined && (!m.transparent || state === true)) { 
                                    m.color.setHex(defaultHex); 
                                }
                            }
                        });
                    };

                    if (layer.threeObject) {
                        if (layer.colorMode === 'Default') {
                            layer.threeObject.traverse((child) => {
                                if (child.material) {
                                    if(child.isMesh) {
                                        if (child.material && child.material !== child.userData.originalMaterial && child.material.customProgramCacheKey) child.material.dispose();
                                        child.material = child.userData.originalMaterial; 
                                    }
                                    setMatColors(child, false, child.userData.originalColor);
                                }
                            });
                        } else if (layer.colorMode === 'Pallete') {
                            const colorHex = parseInt(layer.visualColor.replace('#', '0x'), 16);
                            layer.threeObject.traverse((child) => {
                                if ((child.isMesh || child.isLineSegments) && child.material) {
                                    if(child.isMesh) {
                                        if (child.material && child.material !== child.userData.originalMaterial && child.material.customProgramCacheKey) child.material.dispose();
                                        child.material = child.userData.originalMaterial; 
                                    }
                                    setMatColors(child, false, colorHex);
                                }
                            });
                        } else if (layer.colorMode === 'Rainbow') {
                            const box = new THREE.Box3().setFromObject(layer.threeObject);
                            const minY = box.min.y;
                            const maxY = box.max.y;
                            const rangeY = maxY - minY || 1; 
                            
                            const tempColor = new THREE.Color();
                            
                            layer.threeObject.traverse((child) => {
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
                                    
                                    if(child.isMesh) {
                                        if (child.material && child.material !== child.userData.originalMaterial && child.material.customProgramCacheKey) child.material.dispose();
                                        child.material = child.userData.originalMaterial; 
                                    }
                                    setMatColors(child, true, 0xffffff); 
                                }
                            });
                        } else if (layer.colorMode === 'Texture') {
                            layer.threeObject.traverse((child) => {
                                if (child.material) {
                                    let matToUse = layer.textureMeta && child.userData.originalMaterialTex ? child.userData.originalMaterialTex : child.userData.originalMaterial;
                                    if(child.isMesh) {
                                        if (child.material && child.material !== matToUse && child.material.customProgramCacheKey) child.material.dispose();
                                        child.material = matToUse;
                                    }
                                    setMatColors(child, false, child.userData.originalColor);
                                    if(matToUse.map && child.isMesh) matToUse.color.setHex(0xffffff); 
                                }
                            });
                        }
                    }

                    if (layer.hasFaces) {
                        window.executeDxfFootprintClipping(layer);
                    }

                    applyBtn.disabled = true;
                    updateDxfSummaryUI(window.activeDxfId); 

                    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
                        requestAnimationFrame(() => renderer.render(scene, camera));
                    }

                    if (typeof hideFullscreenLoading === 'function') hideFullscreenLoading();
                };

                if (layer.hasFaces && typeof showFullscreenLoading === 'function') {
                    showFullscreenLoading("Menerapkan Shader Masking & Perubahan...");
                    setTimeout(processChanges, 100);
                } else {
                    processChanges();
                }
            }
        });
    }

    setTimeout(() => {
        if (typeof window.initDxfManagerUI === 'function') {
            window.initDxfManagerUI();
        }
    }, 1500);

    const addGcpBtn = document.getElementById('btn-add-gcp');
    const saveGcpBtn = document.getElementById('btn-save-gcp');
    const applyTexBtn = document.getElementById('btn-apply-texture');
    
    if (addGcpBtn) {
        addGcpBtn.addEventListener('click', () => {
            if(!window.gcpState) return;
            window.gcpState.mode = 'left';
            window.updateGcpUI();
        });
    }
    
    if (saveGcpBtn) {
        saveGcpBtn.addEventListener('click', () => {
            if(!window.gcpState || window.gcpState.mode !== 'save') return;
            
            window.gcpState.points.push({...window.gcpState.currentPair});
            window.gcpState.currentPair = {};
            window.gcpState.mode = 'idle';
            
            window.renderLeftCanvas();
            if(window.renderRightCanvasMarkers) window.renderRightCanvasMarkers();
            window.updateGcpUI();
        });
    }
    
    if (applyTexBtn) {
        applyTexBtn.addEventListener('click', () => {
            if (!window.gcpState || window.gcpState.points.length < 3) return;
            
            const pts = window.gcpState.points;
            let sxx=0, szz=0, sxz=0, sx=0, sz=0, su=0, sv=0, sxu=0, szu=0, sxv=0, szv=0;
            let N = pts.length;
            
            pts.forEach(p => {
                let x = p.worldX, z = p.worldZ, u = p.u, v = p.v;
                sx += x; sz += z; su += u; sv += v;
                sxx += x*x; szz += z*z; sxz += x*z;
                sxu += x*u; szu += z*u; sxv += x*v; szv += z*v;
            });
            
            const A = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, N]];
            const invA = window.invert3x3(A);
            
            if(!invA) {
                alert("Gagal menghitung matriks transformasi (titik yang anda pilih mungkin kolinear/sejajar). Harap atur ulang sebaran titik GCP Anda.");
                return;
            }
            
            const Bu = [sxu, szu, su], Bv = [sxv, szv, sv];
            const Pu = [
                invA[0][0]*Bu[0] + invA[0][1]*Bu[1] + invA[0][2]*Bu[2],
                invA[1][0]*Bu[0] + invA[1][1]*Bu[1] + invA[1][2]*Bu[2],
                invA[2][0]*Bu[0] + invA[2][1]*Bu[1] + invA[2][2]*Bu[2]
            ];
            const Pv = [
                invA[0][0]*Bv[0] + invA[0][1]*Bv[1] + invA[0][2]*Bv[2],
                invA[1][0]*Bv[0] + invA[1][1]*Bv[1] + invA[1][2]*Bv[2],
                invA[2][0]*Bv[0] + invA[2][1]*Bv[1] + invA[2][2]*Bv[2]
            ];
            
            const layer = window.gcpState.layer;
            
            layer.threeObject.traverse(child => {
                if(child.isMesh) {
                    const pos = child.geometry.attributes.position;
                    const uvs = new Float32Array(pos.count * 2);
                    const vertex = new THREE.Vector3();
                    for(let i=0; i<pos.count; i++) {
                        vertex.fromBufferAttribute(pos, i);
                        vertex.applyMatrix4(child.matrixWorld); 
                        uvs[i*2] = Pu[0]*vertex.x + Pu[1]*vertex.z + Pu[2];
                        uvs[i*2+1] = Pv[0]*vertex.x + Pv[1]*vertex.z + Pv[2];
                    }
                    child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                    child.geometry.uvsNeedUpdate = true;
                }
            });

            window.dxfTempState.pendingTextureMeta = {
                name: window.gcpState.file.name,
                size: window.gcpState.file.size,
                width: window.gcpState.img.width,
                height: window.gcpState.img.height,
                file: window.gcpState.file,
                gcpPoints: pts,
                transform: { Pu, Pv }
            };
            window.dxfTempState.textureChanged = true;

            const texLoader = new THREE.TextureLoader();
            texLoader.load(URL.createObjectURL(window.gcpState.file), (texture) => {
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.minFilter = THREE.LinearFilter;
                
                layer.threeObject.traverse(child => {
                    if(child.isMesh) {
                        if(!child.userData.originalMaterialTex) {
                            child.userData.originalMaterialTex = child.userData.originalMaterial.clone();
                        } else {
                            if (child.userData.originalMaterialTex.map) {
                                child.userData.originalMaterialTex.map.dispose();
                            }
                        }
                        child.userData.originalMaterialTex.map = texture;
                        child.userData.originalMaterialTex.color.setHex(0xffffff); 
                        child.userData.originalMaterialTex.needsUpdate = true;
                        
                        child.material = child.userData.originalMaterialTex;
                    }
                });

                const applySidebarBtn = document.getElementById('dxf-btn-apply');
                if (applySidebarBtn) {
                    applySidebarBtn.disabled = false;
                    applySidebarBtn.click();
                }
            });
            
            const texName = document.getElementById('dxf-texture-filename');
            const texClear = document.getElementById('dxf-clear-texture');
            if(texName) texName.textContent = window.gcpState.file.name;
            if(texClear) texClear.disabled = false;
            
            window.closeGcpModal();
        });
    }
});


// ==========================================
// GCP HELPER & LOGIC FUNCTIONS
// ==========================================

window.invert3x3 = function(m) {
    let det = m[0][0]*(m[1][1]*m[2][2] - m[2][1]*m[1][2]) -
              m[0][1]*(m[1][0]*m[2][2] - m[1][2]*m[2][0]) +
              m[0][2]*(m[1][0]*m[2][1] - m[1][1]*m[2][0]);
    if (Math.abs(det) < 1e-8) return null; 
    return [
        [(m[1][1]*m[2][2] - m[2][1]*m[1][2])/det, (m[0][2]*m[2][1] - m[0][1]*m[2][2])/det, (m[0][1]*m[1][2] - m[0][2]*m[1][1])/det],
        [(m[1][2]*m[2][0] - m[1][0]*m[2][2])/det, (m[0][0]*m[2][2] - m[0][2]*m[2][0])/det, (m[1][0]*m[0][2] - m[0][0]*m[1][2])/det],
        [(m[1][0]*m[2][1] - m[2][0]*m[1][1])/det, (m[2][0]*m[0][1] - m[0][0]*m[2][1])/det, (m[0][0]*m[1][1] - m[1][0]*m[0][1])/det]
    ];
};

// [PERBAIKAN KE-3]: Cross Hair panel kanan ditipiskan
window.renderRightCanvasMarkers = function() {
    if(!window.gcpState || !window.gcpState.markersGroup) return;
    
    while(window.gcpState.markersGroup.children.length > 0) {
        const child = window.gcpState.markersGroup.children[0];
        window.gcpState.markersGroup.remove(child);
        if(child.material.map) child.material.map.dispose();
        child.material.dispose();
    }

    const create3DMarker = (label, colorStr, x, z) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const cx = 64;
        const cy = 64;

        ctx.imageSmoothingEnabled = false;

        ctx.strokeStyle = colorStr;
        ctx.lineWidth = 2.5; 
        ctx.beginPath();
        ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
        ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif'; 
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 8;
        ctx.fillText('P' + label, cx + 8, cy - 12);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        
        sprite.scale.set(window.gcpState.maxDim * 0.05, window.gcpState.maxDim * 0.05, 1);
        sprite.position.set(x, window.gcpState.camera.position.y - 10, z); 
        sprite.renderOrder = 999;
        sprite.userData.isMarker = true;

        window.gcpState.markersGroup.add(sprite);
    };

    window.gcpState.points.forEach((pt, i) => {
        if(pt.worldX !== undefined && pt.worldZ !== undefined) {
            create3DMarker(i + 1, '#10b981', pt.worldX, pt.worldZ); 
        }
    });

    if (window.gcpState.currentPair.worldX !== undefined && window.gcpState.currentPair.worldZ !== undefined) {
        create3DMarker(window.gcpState.points.length + 1, '#ef4444', window.gcpState.currentPair.worldX, window.gcpState.currentPair.worldZ); 
    }
};

window.initGcpModal = function(img, file, layerTarget) {
    const modal = document.getElementById('gcp-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    window.gcpState = {
        img: img, file: file, layer: layerTarget,
        points: [], currentPair: {}, mode: 'idle',
        scale: 1, dx: 0, dy: 0,
        isDraggingLeft: false, dragMovedLeft: false, lastXLeft: 0, lastYLeft: 0,
        raycaster: new THREE.Raycaster(),
        mouse: new THREE.Vector2()
    };
    
    const leftCanvas = document.getElementById('gcp-left-canvas');
    const leftWrapper = document.getElementById('gcp-left-wrapper');
    leftCanvas.width = leftWrapper.clientWidth;
    leftCanvas.height = leftWrapper.clientHeight;
    
    window.gcpState.scale = Math.min(leftCanvas.width / img.width, leftCanvas.height / img.height) * 0.90;
    window.gcpState.dx = (leftCanvas.width - img.width * window.gcpState.scale) / 2;
    window.gcpState.dy = (leftCanvas.height - img.height * window.gcpState.scale) / 2;
    
    window.renderLeftCanvas();

    leftCanvas.onwheel = (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const rect = leftCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        window.gcpState.dx = mouseX - (mouseX - window.gcpState.dx) * zoomFactor;
        window.gcpState.dy = mouseY - (mouseY - window.gcpState.dy) * zoomFactor;
        window.gcpState.scale *= zoomFactor;
        window.renderLeftCanvas();
    };

    leftCanvas.onpointerdown = (e) => {
        window.gcpState.isDraggingLeft = true;
        window.gcpState.dragMovedLeft = false;
        window.gcpState.lastXLeft = e.clientX;
        window.gcpState.lastYLeft = e.clientY;
        leftCanvas.setPointerCapture(e.pointerId);
    };

    leftCanvas.onpointermove = (e) => {
        if (!window.gcpState.isDraggingLeft) return;
        const dx = e.clientX - window.gcpState.lastXLeft;
        const dy = e.clientY - window.gcpState.lastYLeft;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) window.gcpState.dragMovedLeft = true; 
        
        window.gcpState.dx += dx;
        window.gcpState.dy += dy;
        window.gcpState.lastXLeft = e.clientX;
        window.gcpState.lastYLeft = e.clientY;
        window.renderLeftCanvas();
    };

    leftCanvas.onpointerup = (e) => {
        window.gcpState.isDraggingLeft = false;
        leftCanvas.releasePointerCapture(e.pointerId);

        if (window.gcpState.dragMovedLeft) return; 

        if (window.gcpState.mode !== 'left') return;

        const cx = e.offsetX;
        const cy = e.offsetY;
        
        let imgX = (cx - window.gcpState.dx) / window.gcpState.scale;
        let imgY = (cy - window.gcpState.dy) / window.gcpState.scale;

        const snapThreshold = 30 / window.gcpState.scale; 
        
        if (imgX > -snapThreshold && imgX < snapThreshold) imgX = 0; 
        if (imgX > window.gcpState.img.width - snapThreshold && imgX < window.gcpState.img.width + snapThreshold) imgX = window.gcpState.img.width; 
        if (imgY > -snapThreshold && imgY < snapThreshold) imgY = 0; 
        if (imgY > window.gcpState.img.height - snapThreshold && imgY < window.gcpState.img.height + snapThreshold) imgY = window.gcpState.img.height; 

        if (imgX < 0 || imgX > window.gcpState.img.width || imgY < 0 || imgY > window.gcpState.img.height) return;
        
        const u = imgX / window.gcpState.img.width;
        const v = 1.0 - (imgY / window.gcpState.img.height); 
        
        window.gcpState.currentPair.u = u;
        window.gcpState.currentPair.v = v;
        window.gcpState.currentPair.imgOrigX = imgX;
        window.gcpState.currentPair.imgOrigY = imgY;
        
        window.gcpState.mode = 'right';
        window.renderLeftCanvas();
        window.updateGcpUI();
    };
    
    const rightContainer = document.getElementById('gcp-right-3d');
    rightContainer.innerHTML = '';
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setSize(rightContainer.clientWidth, rightContainer.clientHeight);
    renderer.setClearColor(0x0f172a, 1); 
    rightContainer.appendChild(renderer.domElement);
    window.gcpState.renderer = renderer;
    
    const scene = new THREE.Scene();
    window.gcpState.scene = scene;

    window.gcpState.markersGroup = new THREE.Group();
    scene.add(window.gcpState.markersGroup);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    scene.add(dirLight);
    
    const visibleDxfs = typeof appLayers !== 'undefined' ? appLayers.filter(l => l.type === 'dxf' && l.visible) : [];
    
    if (layerTarget && !visibleDxfs.includes(layerTarget)) {
        visibleDxfs.push(layerTarget);
    }

    const previewGroup = new THREE.Group();
    
    visibleDxfs.forEach(l => {
        if(l.threeObject) {
            const clone = l.threeObject.clone();
            clone.visible = true;
            previewGroup.add(clone);
        }
    });

    scene.add(previewGroup);
    
    const box = new THREE.Box3().setFromObject(previewGroup);
    if (box.isEmpty()) { 
        box.setFromCenterAndSize(new THREE.Vector3(0,0,0), new THREE.Vector3(100,100,100)); 
    }

    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);
    
    // [UPDATE]: Menyimpan elevasi dasar (Y) untuk keperluan fallback klik di luar bounding box
    window.gcpState.centerY = center.y;
    
    const aspect = rightContainer.clientWidth / rightContainer.clientHeight;
    window.gcpState.maxDim = Math.max(size.x, size.z);
    
    window.gcpState.raycaster.params.Line.threshold = window.gcpState.maxDim * 0.01; 

    const fH = window.gcpState.maxDim * 1.15;
    const fW = fH * aspect;
    
    const camera = new THREE.OrthographicCamera(-fW/2, fW/2, fH/2, -fH/2, -window.gcpState.maxDim*5, window.gcpState.maxDim*5);
    camera.position.set(center.x, box.max.y + window.gcpState.maxDim, center.z);
    camera.lookAt(center.x, center.y, center.z);
    camera.up.set(0, 0, -1);
    camera.updateProjectionMatrix();
    window.gcpState.camera = camera;

    dirLight.position.set(center.x, box.max.y + window.gcpState.maxDim, center.z);
    
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false; 
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.target.set(center.x, center.y, center.z);
    controls.update();
    
    let isDraggingRight = false;
    let lastMouseRight = { x: 0, y: 0 };

    renderer.domElement.addEventListener('pointerdown', (e) => {
        isDraggingRight = false;
        lastMouseRight.x = e.clientX;
        lastMouseRight.y = e.clientY;
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientX - lastMouseRight.x) > 3 || Math.abs(e.clientY - lastMouseRight.y) > 3) {
            isDraggingRight = true; 
        }
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
        if (isDraggingRight) return; 
        if (!window.gcpState || window.gcpState.mode !== 'right') return;

        window.gcpState.mouse.x = (e.offsetX / rightContainer.clientWidth) * 2 - 1;
        window.gcpState.mouse.y = -(e.offsetY / rightContainer.clientHeight) * 2 + 1;
        
        window.gcpState.raycaster.setFromCamera(window.gcpState.mouse, window.gcpState.camera);
        
        // ========================================================
        // [PERBAIKAN MAGNETIC SNAPPING]: "Distance to Ray" Method
        // ========================================================
        let nearestDistSq = Infinity;
        let bestVertex = new THREE.Vector3();
        let foundVertex = false;

        // Radius snap dibuat responsif: 5% dari viewport yang terlihat
        // Jadi kalau user zoom-in, magnetic-nya makin sempit (presisi). 
        // Kalau zoom-out, magnetic-nya makin lebar (mudah menangkap sudut).
        const effectiveFrustumWidth = (window.gcpState.camera.right - window.gcpState.camera.left) / window.gcpState.camera.zoom;
        const magneticRadius = effectiveFrustumWidth * 0.05; 
        const magneticRadiusSq = magneticRadius * magneticRadius; // Hitung kuadrat untuk optimasi performa

        // 1. Traverse seluruh point, cari yang terdekat dengan "Sinar/Ray" secara 2D.
        // Hal ini memungkinkan snapping sudut PALING LUAR meskipun user mengklik di ruang kosong di luar Polymesh.
        previewGroup.traverse((child) => {
            if ((child.isMesh || child.isLineSegments) && child.geometry && child.geometry.attributes.position) {
                const pos = child.geometry.attributes.position;
                const tempV = new THREE.Vector3();
                for (let i = 0; i < pos.count; i++) {
                    tempV.fromBufferAttribute(pos, i);
                    tempV.applyMatrix4(child.matrixWorld);
                    
                    // distanceSqToPoint ini akan mengukur jarak 2D pada Orthographic Top-Down
                    const distSq = window.gcpState.raycaster.ray.distanceSqToPoint(tempV);
                    
                    if (distSq < nearestDistSq && distSq < magneticRadiusSq) {
                        nearestDistSq = distSq;
                        bestVertex.copy(tempV);
                        foundVertex = true;
                    }
                }
            }
        });

        let targetX, targetZ;

        if (foundVertex) {
            // Berhasil Snap ke titik terdekat (sudut menempel sempurna)
            targetX = bestVertex.x;
            targetZ = bestVertex.z;
        } else {
            // 2. Fallback: Kalau tidak ada vertex terdekat, tapi raycaster tembus badan Mesh
            const intersects = window.gcpState.raycaster.intersectObject(previewGroup, true);
            if (intersects.length > 0) {
                targetX = intersects[0].point.x;
                targetZ = intersects[0].point.z;
            } else {
                // 3. Fallback Ekstrim: User klik murni di luar segalanya dan jauh dari titik apapun
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -window.gcpState.centerY); 
                const targetPoint = new THREE.Vector3();
                window.gcpState.raycaster.ray.intersectPlane(plane, targetPoint);
                if (targetPoint) {
                    targetX = targetPoint.x;
                    targetZ = targetPoint.z;
                } else {
                    return; // Gagal
                }
            }
        }

        window.gcpState.currentPair.worldX = targetX;
        window.gcpState.currentPair.worldZ = targetZ;
        
        window.renderRightCanvasMarkers();
        
        window.gcpState.mode = 'save';
        window.updateGcpUI();
    });

    const animate = () => {
        if(!window.gcpState) return;
        window.gcpState.reqId = requestAnimationFrame(animate);
        controls.update();
        
        if (window.gcpState.markersGroup && window.gcpState.camera && window.gcpState.renderer) {
            const frustumWidth = window.gcpState.camera.right - window.gcpState.camera.left;
            const scale = frustumWidth * (96 / rightContainer.clientWidth); 
            window.gcpState.markersGroup.children.forEach(child => {
                if (child.userData.isMarker) {
                    child.scale.set(scale, scale, 1);
                }
            });
        }
        
        renderer.render(scene, camera);
    };
    animate();
    
    window.updateGcpUI();
};

window.renderLeftCanvas = function() {
    if(!window.gcpState) return;
    const canvas = document.getElementById('gcp-left-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(window.gcpState.img, window.gcpState.dx, window.gcpState.dy, window.gcpState.img.width * window.gcpState.scale, window.gcpState.img.height * window.gcpState.scale);
    
    const drawCross = (x, y, color, label) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y);
        ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 5;
        ctx.fillText('P' + label, x + 8, y - 10);
        ctx.shadowBlur = 0;
    };

    window.gcpState.points.forEach((pt, i) => {
        let cx = window.gcpState.dx + pt.imgOrigX * window.gcpState.scale;
        let cy = window.gcpState.dy + pt.imgOrigY * window.gcpState.scale;
        drawCross(cx, cy, '#10b981', i+1); 
    });
    
    if (window.gcpState.currentPair.imgOrigX !== undefined) {
        let cx = window.gcpState.dx + window.gcpState.currentPair.imgOrigX * window.gcpState.scale;
        let cy = window.gcpState.dy + window.gcpState.currentPair.imgOrigY * window.gcpState.scale;
        drawCross(cx, cy, '#ef4444', window.gcpState.points.length + 1); 
    }
};

window.updateGcpUI = function() {
    if(!window.gcpState) return;
    const statusEl = document.getElementById('gcp-status-text');
    const addBtn = document.getElementById('btn-add-gcp');
    const saveBtn = document.getElementById('btn-save-gcp');
    const genBtn = document.getElementById('btn-apply-texture');
    const countBadge = document.getElementById('gcp-count-badge');
    const leftCanvas = document.getElementById('gcp-left-canvas');
    const rightContainer = document.getElementById('gcp-right-3d');
    
    countBadge.textContent = `Pasangan: ${window.gcpState.points.length}`;
    
    if (window.gcpState.mode === 'idle') {
        statusEl.textContent = "Klik 'Add GCP' untuk menambah pasangan titik.";
        addBtn.disabled = false; addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        saveBtn.disabled = true; saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        leftCanvas.style.cursor = 'grab';
        rightContainer.style.cursor = 'grab';
    } else if (window.gcpState.mode === 'left') {
        statusEl.textContent = "Klik pada Citra (Panel Kiri) untuk GCP. (Tahan & Geser untuk Pan)";
        addBtn.disabled = true; addBtn.classList.add('opacity-50', 'cursor-not-allowed');
        saveBtn.disabled = true; saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
        leftCanvas.style.cursor = 'crosshair';
        rightContainer.style.cursor = 'grab';
    } else if (window.gcpState.mode === 'right') {
        statusEl.textContent = "Klik pada 3D Model (Panel Kanan) untuk lokasi rujukan GCP. (Tahan & Geser untuk Pan)";
        leftCanvas.style.cursor = 'grab';
        rightContainer.style.cursor = 'crosshair';
    } else if (window.gcpState.mode === 'save') {
        statusEl.textContent = "Titik ditetapkan. Klik 'Save' untuk menyimpan pasangan GCP.";
        saveBtn.disabled = false; saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        leftCanvas.style.cursor = 'grab';
        rightContainer.style.cursor = 'grab';
    }
    
    if (window.gcpState.points.length >= 3 && window.gcpState.mode === 'idle') {
        genBtn.disabled = false; genBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        genBtn.disabled = true; genBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

window.closeGcpModal = function() {
    const modal = document.getElementById('gcp-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    
    if (window.gcpState) {
        if(window.gcpState.reqId) cancelAnimationFrame(window.gcpState.reqId);
        if(window.gcpState.renderer) window.gcpState.renderer.dispose();
    }
    
    if (window.dxfTempState && !window.dxfTempState.textureChanged && document.getElementById('dxf-texture-file')) {
         document.getElementById('dxf-texture-file').value = '';
    }
    window.gcpState = null;
};

// ==========================================
// GLOBAL EVENT LISTENERS (GCP & OTHERS)
// ==========================================

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (window.gcpState) {
            if (window.gcpState.mode !== 'idle') {
                e.preventDefault();
                window.gcpState.currentPair = {};
                window.gcpState.mode = 'idle';
                window.gcpState.isDraggingLeft = false; 
                
                if (typeof window.renderLeftCanvas === 'function') window.renderLeftCanvas();
                if (typeof window.renderRightCanvasMarkers === 'function') window.renderRightCanvasMarkers();
                if (typeof window.updateGcpUI === 'function') window.updateGcpUI();
            } else if (window.gcpState.points.length > 0) {
                e.preventDefault();
                window.gcpState.points.pop(); 
                
                if (typeof window.renderLeftCanvas === 'function') window.renderLeftCanvas();
                if (typeof window.renderRightCanvasMarkers === 'function') window.renderRightCanvasMarkers();
                if (typeof window.updateGcpUI === 'function') window.updateGcpUI();
            }
        }
    }
});