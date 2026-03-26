// ==========================================
// DXF IMPORTER CORE LOGIC
// ==========================================
function processDXF(dxfText, fileName) {
    const parser = new window.DxfParser();
    let dxfData = null;
    try { dxfData = parser.parseSync(dxfText); } catch(err) { alert("Error membaca format DXF: " + err.message); return; }

    if (!worldOrigin.isSet) {
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
            worldOrigin = { x: (minX+maxX)/2, y: (minY+maxY)/2, z: (minZ+maxZ)/2, isSet: true };
        }
    }

    let hasLine = false;
    dxfData.entities.forEach(ent => {
        if ((ent.type === 'LINE' || ent.type === 'LWPOLYLINE') && !ent.shape && !ent.polygonMesh) hasLine = true;
    });

    const group = new THREE.Group();
    group.name = fileName;
    
    const colorLineGroups = {};
    const colorFaceGroups = {};

    let uiColorHex = "#ffffff";
    let firstColorCaptured = false;

    dxfData.entities.forEach(ent => {
        let cid = ent.colorIndex; 
        if (cid === 256 || cid === undefined) {
            const layer = dxfData.tables && dxfData.tables.layer && dxfData.tables.layer.layers[ent.layer];
            if (layer) cid = Math.abs(layer.colorNumber);
        }
        if (cid === undefined || cid < 1 || cid > 255) cid = 7;
        
        let hexValue = AUTO_CAD_COLOR_INDEX[cid] !== undefined ? AUTO_CAD_COLOR_INDEX[cid] : 0xffffff;
        if (hexValue === 0x000000 || cid === 7) hexValue = 0xffffff;

        if (!firstColorCaptured) {
            uiColorHex = '#' + hexValue.toString(16).padStart(6, '0');
            firstColorCaptured = true;
        }

        if (!hasLine && (ent.type === '3DFACE' || ent.type === 'SOLID')) {
            let v = ent.vertices;
            if (v && v.length >= 3) {
                if (!colorFaceGroups[hexValue]) colorFaceGroups[hexValue] = [];
                
                let z0 = v[0].z !== undefined ? v[0].z : (ent.elevation || 0);
                let z1 = v[1].z !== undefined ? v[1].z : (ent.elevation || 0);
                let z2 = v[2].z !== undefined ? v[2].z : (ent.elevation || 0);

                let p0 = new THREE.Vector3(v[0].x - worldOrigin.x, z0 - worldOrigin.y, -v[0].y - worldOrigin.z);
                let p1 = new THREE.Vector3(v[1].x - worldOrigin.x, z1 - worldOrigin.y, -v[1].y - worldOrigin.z);
                let p2 = new THREE.Vector3(v[2].x - worldOrigin.x, z2 - worldOrigin.y, -v[2].y - worldOrigin.z);

                colorFaceGroups[hexValue].push(p0, p1, p2);

                if (v.length >= 4 && (v[2].x !== v[3].x || v[2].y !== v[3].y || v[2].z !== v[3].z)) {
                    let z3 = v[3].z !== undefined ? v[3].z : (ent.elevation || 0);
                    let p3 = new THREE.Vector3(v[3].x - worldOrigin.x, z3 - worldOrigin.y, -v[3].y - worldOrigin.z);
                    colorFaceGroups[hexValue].push(p0, p2, p3);
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
                        colorLineGroups[hexValue].push(
                            new THREE.Vector3(v1.x - worldOrigin.x, z1 - worldOrigin.y, -v1.y - worldOrigin.z),
                            new THREE.Vector3(v2.x - worldOrigin.x, z2 - worldOrigin.y, -v2.y - worldOrigin.z)
                        );
                    }
                }
            }
        }
    });

    let hasFaces = Object.keys(colorFaceGroups).length > 0;
    
    // Default Color Logic khusus untuk Polymesh berdasarkan nama file
    let filenameColorOverride = null;
    if (hasFaces) {
        const lowerName = fileName.toLowerCase();
        if (lowerName.includes('topo') || lowerName.includes('sit') || lowerName.includes('eom') || lowerName.includes('week') || lowerName.includes('gr')) {
            filenameColorOverride = 0x228B22; // Forest Green
        } else if (lowerName.includes('pit') || lowerName.includes('monthly') || lowerName.includes('yearly') || lowerName.includes('lom')) {
            filenameColorOverride = 0x808080; // Grey
        } else if (lowerName.includes('opd') || lowerName.includes('ipd') || lowerName.includes('dump') || lowerName.includes('wd') || lowerName.includes('disp')) {
            filenameColorOverride = 0xD2B48C; // Tan
        }

        // Update UI color indicator jika override diterapkan
        if (filenameColorOverride !== null) {
            uiColorHex = '#' + filenameColorOverride.toString(16).padStart(6, '0');
        }
    }

    Object.keys(colorFaceGroups).forEach(hexKey => {
        const points = colorFaceGroups[hexKey];
        if (points.length > 0) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            geo.computeVertexNormals(); 

            // Terapkan override warna jika ada, jika tidak gunakan warna asli dari DXF
            const finalColor = filenameColorOverride !== null ? filenameColorOverride : parseInt(hexKey);

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
            group.add(mesh);
        }
    });

    Object.keys(colorLineGroups).forEach(hexKey => {
        const points = colorLineGroups[hexKey];
        if (points.length > 0) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: parseInt(hexKey) });
            const lines = new THREE.LineSegments(geo, mat);
            lines.userData.originalColor = parseInt(hexKey);
            group.add(lines);
        }
    });

    if (typeof scene !== 'undefined') scene.add(group);
    const layerId = 'layer_' + Date.now();

    // Mengambil metadata jika tersimpan melalui interceptor input file
    let fileMeta = window.pendingDxfMeta || { size: dxfText.length, lastModified: new Date().toLocaleDateString('id-ID') };
    window.pendingDxfMeta = null;

    if (typeof appLayers !== 'undefined') {
        appLayers.push({ 
            id: layerId, 
            name: fileName, 
            visible: true, 
            threeObject: group, 
            colorHex: uiColorHex,
            defaultColorHex: uiColorHex,
            type: 'dxf',
            hasFaces: hasFaces,
            clippingEnabled: false,
            clipFootprints: 'Pit Data',
            colorMode: 'Default',
            visualColor: uiColorHex,
            fileSize: fileMeta.size,
            lastModified: fileMeta.lastModified,
            textureMeta: null
        });
    }

    // --- BUAT SUBFOLDER DI SIDEBAR ---
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
    // ---------------------------------
    
    if (typeof updateLayerUI === 'function') updateLayerUI();
    setTimeout(() => {
        if(typeof window.zoomToLayer === 'function') window.zoomToLayer(layerId);
        if(typeof updateFileMenuState === 'function') updateFileMenuState();
        
        // Otomatis pilih subfolder yang baru saja dibuat agar ringkasannya muncul
        if (typeof window.selectFolder === 'function') {
            window.selectFolder(fileName, 'Subfolder', rootName);
        }
        
        // Update summary dan list jika DXF Tab sedang terbuka
        const summaryName = document.getElementById('summary-name');
        if (summaryName && (summaryName.textContent === 'DXF Data' || summaryName.textContent === fileName)) {
            if (typeof window.updateDxfListUI === 'function') window.updateDxfListUI();
            if (summaryName.textContent === 'DXF Data') {
                if (typeof aggregateAllDxfData === 'function') aggregateAllDxfData();
            } else {
                if (typeof updateDxfSummaryUI === 'function') updateDxfSummaryUI(fileName);
            }
        }
    }, 100);
}


// ==========================================
// DXF UI STATE MANAGEMENT & 2D PREVIEW
// ==========================================

window.dxfStates = {};
window.activeDxfId = null;
window._lastSelectedDxfFolderName = null; 
window.dxfTempState = null;

// Mengaktifkan render 2D (Top View) menggunakan Mini WebGL Renderer
window.render2DDxfPreview = function(layers) {
    const container = document.getElementById('dxf-preview-3d-canvas');
    if (!container) return;
    
    // Clear container (Hapus placeholder / renderer lama)
    container.innerHTML = '';

    if (!layers || layers.length === 0) {
        container.innerHTML = `
            <div id="dxf-preview-placeholder" class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-70 pointer-events-none">
                <i class="fa-solid fa-map text-4xl lg:text-3xl mb-3 lg:mb-2"></i>
                <span class="text-[12px] lg:text-[11px] italic">2D Top View Preview Area</span>
            </div>`;
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Set minimal renderer jika container tidak terlihat
    if (width === 0 || height === 0) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x0f172a, 1); // Background slate-900
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const previewGroup = new THREE.Group();

    layers.forEach(l => {
        if(l.threeObject) {
            const clone = l.threeObject.clone();
            clone.visible = true; // Paksa selalu terlihat di preview
            previewGroup.add(clone);
        }
    });

    scene.add(previewGroup);

    const box = new THREE.Box3().setFromObject(previewGroup);
    if(box.isEmpty()) return;

    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const aspect = width / height;
    const maxDim = Math.max(size.x, size.z);
    
    // Menghitung frustum Orthographic agar fit to bound dengan padding 15%
    const frustumHeight = size.z > size.x / aspect ? size.z * 1.15 : (size.x / aspect) * 1.15;
    const frustumWidth = frustumHeight * aspect;

    const camera = new THREE.OrthographicCamera(
        -frustumWidth / 2, frustumWidth / 2,
        frustumHeight / 2, -frustumHeight / 2,
        -maxDim * 5, maxDim * 5
    );

    // Posisi top-down (Tampak Atas)
    camera.position.set(center.x, box.max.y + maxDim, center.z);
    camera.lookAt(center.x, center.y, center.z);
    camera.up.set(0, 0, -1); 

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(center.x, box.max.y + maxDim, center.z);
    scene.add(dirLight);

    renderer.render(scene, camera);
    
    // Optional Resize Observer untuk menyesuaikan kamera saat panel berubah ukuran
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
            <!-- List Section -->
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
            
            const cb = div.querySelector('.dxf-visibility-cb');
            cb.addEventListener('change', (e) => {
                layer.visible = e.target.checked;
                if (layer.threeObject) layer.threeObject.visible = layer.visible;
                window.updateDxfListUI();
                if (typeof updateLayerUI === 'function') updateLayerUI();
            });
            
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

window.onDxfFolderDeleted = async function(name, rootName) {
    if (rootName === 'DXF Data') {
        if (window._lastSelectedDxfFolderName === name) window._lastSelectedDxfFolderName = null;

        if (typeof appLayers !== 'undefined') {
            const index = appLayers.findIndex(l => l.name === name && l.type === 'dxf');
            if (index !== -1) {
                const layer = appLayers[index];
                if (layer.threeObject && typeof scene !== 'undefined') {
                    scene.remove(layer.threeObject);
                }
                appLayers.splice(index, 1);
                if (typeof updateLayerUI === 'function') updateLayerUI();
            }
        }
        
        if (window.activeDxfId === name) {
            window.activeDxfId = null;
            window.dxfTempState = null;
        }
        
        const summaryName = document.getElementById('summary-name');
        if (summaryName && summaryName.textContent === 'DXF Data') {
            window.updateDxfListUI();
            aggregateAllDxfData();
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

    // UI Inputs
    const colorSelect = document.getElementById('dxf-col-color');
    const recolorRow = document.getElementById('dxf-recolor-row');
    const recolorInput = document.getElementById('dxf-recolor-input');
    
    const clipSelect = document.getElementById('dxf-col-clipping');
    const footprintsRow = document.getElementById('dxf-footprints-row');
    const footprintsSelect = document.getElementById('dxf-col-footprints');

    const texInput = document.getElementById('dxf-texture-file');
    const texLabel = document.getElementById('dxf-btn-texture-label');
    const texClear = document.getElementById('dxf-clear-texture');
    const texName = document.getElementById('dxf-texture-filename');

    const applyBtn = document.getElementById('dxf-btn-apply');

    if (layer) {
        // Reset Temporary State untuk file ini
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

        // Mapping Panel Setting (Metadata)
        if (nameEl) nameEl.textContent = layer.name;
        if (modEl) modEl.textContent = layer.lastModified || '-';
        if (typeEl) typeEl.textContent = layer.hasFaces ? 'Polymesh (3D Face)' : 'Polyline (Line/Wire)';
        
        // Populate Visual State
        if (colorSelect) {
            colorSelect.value = window.dxfTempState.colorMode;
            if (recolorRow) recolorRow.style.display = window.dxfTempState.colorMode === 'Pallete' ? 'flex' : 'none';
        }
        if (recolorInput) recolorInput.value = window.dxfTempState.visualColor;

        // Populate Masking & Texture State (Tergantung Geometri)
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

        // Disable Apply Button initially
        if (applyBtn) applyBtn.disabled = true;

        // Mapping Panel Summary
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

// Fungsi untuk mengecek apakah ada perubahan yang belum disimpan (Dirty State)
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
        window.render2DDxfPreview([]); // Clear canvas
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
    
    // Trigger the actual 3D to 2D Top View Rendering
    window.render2DDxfPreview(layersToRender);
}

// Ensure init is called after DOM loads
document.addEventListener('DOMContentLoaded', () => {

    // --- INTERCEPTOR UKURAN & TANGGAL FILE ---
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

    // --- SETUP DXF SETTINGS LISTENERS ---
    const colorSelect = document.getElementById('dxf-col-color');
    const recolorRow = document.getElementById('dxf-recolor-row');
    const recolorInput = document.getElementById('dxf-recolor-input');
    
    const clipSelect = document.getElementById('dxf-col-clipping');
    const footprintsRow = document.getElementById('dxf-footprints-row');
    const footprintsSelect = document.getElementById('dxf-col-footprints');

    const texInput = document.getElementById('dxf-texture-file');
    const texClear = document.getElementById('dxf-clear-texture');
    const texName = document.getElementById('dxf-texture-filename');

    const applyBtn = document.getElementById('dxf-btn-apply');

    if (colorSelect) {
        colorSelect.addEventListener('change', (e) => {
            if (recolorRow) recolorRow.style.display = e.target.value === "Pallete" ? 'flex' : 'none';
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

    // --- INTERCEPTOR TEXTURE UPLOAD (TEMPORARY STATE) ---
    if (texInput) {
        texInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0 && window.activeDxfId && window.dxfTempState) {
                const file = e.target.files[0];
                const img = new Image();
                img.onload = () => {
                    window.dxfTempState.pendingTextureMeta = {
                        name: file.name,
                        size: file.size,
                        width: img.width,
                        height: img.height,
                        file: file 
                    };
                    window.dxfTempState.textureChanged = true;
                    if(texName) texName.textContent = file.name;
                    if(texClear) texClear.disabled = false;
                    checkDxfChanges();
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
                checkDxfChanges();
            }
        });
    }

    // --- APPLY BUTTON LOGIC ---
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (!window.activeDxfId || !window.dxfTempState) return;
            const layer = appLayers.find(l => l.type === 'dxf' && l.name === window.activeDxfId);
            
            if (layer) {
                // Save properties
                layer.colorMode = window.dxfTempState.colorMode;
                layer.visualColor = window.dxfTempState.visualColor;
                layer.clippingEnabled = window.dxfTempState.clippingEnabled;
                layer.clipFootprints = window.dxfTempState.clipFootprints;
                
                if (window.dxfTempState.textureChanged) {
                    layer.textureMeta = window.dxfTempState.pendingTextureMeta;
                    window.dxfTempState.textureChanged = false;
                }
                
                // Terapan perubahan secara visual di Kanvas 3D
                if (layer.threeObject) {
                    if (layer.colorMode === 'Default') {
                        // Kembali ke warna awal saat import DXF
                        layer.threeObject.traverse((child) => {
                            if (child.material) {
                                child.material.vertexColors = false;
                                child.material.needsUpdate = true;
                                if (child.userData.originalColor !== undefined) {
                                    child.material.color.setHex(child.userData.originalColor);
                                }
                            }
                        });
                    } else if (layer.colorMode === 'Pallete') {
                        // Gunakan warna pallete seragam (menimpa warna asli)
                        const colorHex = parseInt(layer.visualColor.replace('#', '0x'), 16);
                        layer.threeObject.traverse((child) => {
                            if ((child.isMesh || child.isLineSegments) && child.material) {
                                child.material.vertexColors = false;
                                child.material.needsUpdate = true;
                                child.material.color.setHex(colorHex);
                            }
                        });
                    } else if (layer.colorMode === 'Rainbow') {
                        // Kalkulasi gradasi warna elevasi (Merah=Tertinggi -> Ungu=Terendah)
                        const box = new THREE.Box3().setFromObject(layer.threeObject);
                        const minY = box.min.y;
                        const maxY = box.max.y;
                        const rangeY = maxY - minY || 1; // Mencegah pembagian 0 jika flat
                        
                        const tempColor = new THREE.Color();
                        
                        layer.threeObject.traverse((child) => {
                            if ((child.isMesh || child.isLineSegments) && child.geometry && child.geometry.attributes.position) {
                                const posAttr = child.geometry.attributes.position;
                                const count = posAttr.count;
                                
                                // Inisialisasi attribute vertex color jika belum ada
                                if (!child.geometry.attributes.color) {
                                    child.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
                                }
                                const colAttr = child.geometry.attributes.color;
                                
                                // Update vertex colors berdasarkan ketinggian vertex (Y Axis)
                                for (let i = 0; i < count; i++) {
                                    const y = posAttr.getY(i);
                                    // Normalisasi ketinggian (0 hingga 1)
                                    const t = Math.max(0, Math.min(1, (y - minY) / rangeY));
                                    
                                    // Rentang HSL: 0.75 (Ungu di paling bawah) turun ke 0.0 (Merah di atas)
                                    const hue = 0.75 * (1 - t);
                                    tempColor.setHSL(hue, 1.0, 0.5);
                                    
                                    colAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
                                }
                                colAttr.needsUpdate = true;
                                
                                // Reset material properties agar mewarisi warna dari vertex
                                if (child.material) {
                                    child.material.vertexColors = true;
                                    child.material.color.setHex(0xffffff); // Reset layer ke putih agar murni menampilkan vertexColor
                                    child.material.needsUpdate = true;
                                }
                            }
                        });
                    }
                }

                // Update UI Summary dan disable kembali tombol Apply
                applyBtn.disabled = true;
                updateDxfSummaryUI(window.activeDxfId); 
            }
        });
    }

    setTimeout(() => {
        if (typeof window.initDxfManagerUI === 'function') {
            window.initDxfManagerUI();
        }
    }, 1500);
});