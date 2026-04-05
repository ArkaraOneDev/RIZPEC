// ==========================================
// PEMBOLEH UBAH INTERAKSI & URUTAN
// ==========================================
window.currentProjectName = "Untitled";
window.selectedMeshes = new Set();
window.hoveredGroupKey = null;
window.hoveredMeshes = []; 
window.currentHoveredName = null; 
window.currentHoveredData = null; 

window.isDraggingRect = false;
window.dragStartPos = { x: 0, y: 0 };
window.isDrawingPolygon = false;
window.polygonPoints = []; 

// STATE KEYBOARD
window.isShiftDown = false; // Murni untuk Append Seleksi

// STATE AUTO RECORD
window.isAutoRecordActive = false; // Default: Toggle tidak aktif

// STATE REKAPAN PIT
window.pitSequenceRecords = [];
window.pitTotalWaste = 0;
window.pitTotalResource = 0;
window.pitSequenceCounter = 1;

// STATE REKAPAN DISPOSAL
window.dispSequenceRecords = [];
window.dispTotalWaste = 0;
window.dispSequenceCounter = 1;

window.undoStack = [];
window.redoStack = []; 
window.MAX_UNDO_STEPS = 10;
window.currentMousePos = { x: 0, y: 0, nx: 0, ny: 0 };

// OPTIMASI: Variabel pengendali untuk Tablet & Throttle
window.lastRaycastTime = 0;
window.isCameraMoving = false; 
window.isPointerDown = false; 
window.rawPointerDownPos = { x: 0, y: 0 }; 
window._ignoreNextClick = false; 

// STATE VIRTUAL SCROLL
window.ROW_HEIGHT = 30; // Tinggi tetap setiap baris tabel (px)

// ==========================================
// OPTIMASI MEMORI 1: Bantuan Global & Single-Instance Raycaster
// ==========================================
const _tempVector3 = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _tempScreenPos = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _tempBox3 = typeof THREE !== 'undefined' ? new THREE.Box3() : null;
const _sharedRaycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
const _sharedMouseVec = typeof THREE !== 'undefined' ? new THREE.Vector2() : null;

const _verticalRaycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
const _verticalRayOrigin = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _verticalRayDir = typeof THREE !== 'undefined' ? new THREE.Vector3(0, -1, 0) : null;

// ==========================================
// HELPER: GET 3D POINT DARI MOUSE POS
// ==========================================
window._get3DPointFromMouse = function(pos) {
    if (typeof window.getRaycastPoint === 'function') {
        let pt = window.getRaycastPoint(pos);
        if (pt) return pt.clone();
    }
    if (!_sharedRaycaster || typeof camera === 'undefined') return null;
    
    _sharedRaycaster.setFromCamera({x: pos.nx, y: pos.ny}, camera);
    
    let intersectableObjects = [];
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup.visible) {
        pitReserveGroup.children.forEach(c => {
            if (c.isMesh && c.visible) intersectableObjects.push(c);
        });
    }
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(l => {
            if (l.type === 'dxf' && l.visible && l.threeObject) {
                l.threeObject.traverse(c => {
                    if ((c.isMesh || c.isLineSegments) && c.visible) intersectableObjects.push(c);
                });
            }
        });
    }

    const hits = _sharedRaycaster.intersectObjects(intersectableObjects, false);
    const validHit = window.getFirstValidIntersection(hits);
    
    if (validHit) {
        return validHit.point.clone();
    }
    
    // Fallback: Area kosong (Tembak ke bidang tanah imajiner Y=0)
    const plane = typeof THREE !== 'undefined' ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : null;
    const target = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
    if (plane && target && _sharedRaycaster) {
        _sharedRaycaster.ray.intersectPlane(plane, target);
        return target;
    }
    return null;
};

// ==========================================
// BIND CAMERA UPDATE UNTUK POLYGON SINKRONISASI
// ==========================================
window.bindCameraChange = function() {
    if (window._cameraBound) return;
    if (typeof controls !== 'undefined') {
        controls.addEventListener('change', () => {
            if (window.isDrawingPolygon) {
                window.updatePolygonSVG(window.currentMousePos);
            }
        });
        window._cameraBound = true;
    }
};

// ==========================================
// HELPER: VIRTUAL SCROLLER (HANYA RENDER YANG TERLIHAT)
// ==========================================
window.renderVirtualList = function(containerId, tbodyId, data, renderRowFn) {
    const container = document.getElementById(containerId);
    const tbody = document.getElementById(tbodyId);
    if (!container || !tbody) return;

    if (data.length === 0) {
        tbody.style.paddingTop = '0px';
        tbody.style.paddingBottom = '0px';
        tbody.innerHTML = '';
        return;
    }

    const clientHeight = container.clientHeight || 200; 
    const visibleCount = Math.ceil(clientHeight / window.ROW_HEIGHT) + 4; // Buffer atas dan bawah

    const update = () => {
        const scrollTop = container.scrollTop;
        let startIndex = Math.floor(scrollTop / window.ROW_HEIGHT);
        startIndex = Math.max(0, Math.min(startIndex, data.length - visibleCount));
        let endIndex = Math.min(startIndex + visibleCount, data.length);

        const paddingTop = startIndex * window.ROW_HEIGHT;
        const paddingBottom = (data.length - endIndex) * window.ROW_HEIGHT;

        tbody.style.paddingTop = `${paddingTop}px`;
        tbody.style.paddingBottom = `${paddingBottom}px`;

        tbody.innerHTML = '';
        for (let i = startIndex; i < endIndex; i++) {
            tbody.appendChild(renderRowFn(data[i], i));
        }
    };

    if (!container._vsHandler) {
        container._vsHandler = () => requestAnimationFrame(update);
        container.addEventListener('scroll', container._vsHandler, { passive: true });
    }

    update(); 
};

// ==========================================
// OPTIMASI MEMORI 2: Zombie Cleanser
// ==========================================
window.cleanseZombieMesh = function(mesh) {
    if (!mesh) return;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }
    }
    if (mesh.userData) mesh.userData = {};
};

// ==========================================
// OPTIMASI MEMORI 3: Material State Pooling
// ==========================================
window.applyMaterialState = function(mesh, stateType) {
    if (!mesh.material) return;
    
    if (!mesh.userData.originalMaterial) {
        mesh.userData.originalMaterial = mesh.material;
    }
    
    const baseMat = mesh.userData.originalMaterial;
    
    if (stateType === 'default' || stateType === 'hover') {
        mesh.material = baseMat;
        return;
    }
    
    let hex = 0x000000;
    if (stateType === 'selected') hex = typeof COLOR_SELECTED !== 'undefined' ? COLOR_SELECTED : 0xffaa00;
    else if (stateType === 'recorded_pit') hex = 0x1d4ed8;
    else if (stateType === 'recorded_disp') hex = 0x059669;
    
    if (!window.sharedStateMaterials) window.sharedStateMaterials = {};
    const key = baseMat.uuid + '_' + stateType;
    
    if (!window.sharedStateMaterials[key]) {
        const clone = baseMat.clone();
        if (clone.emissive) clone.emissive.setHex(hex);
        
        if (stateType === 'recorded_pit' || stateType === 'recorded_disp') {
            clone.transparent = false;
            clone.opacity = 1.0; 
        }
        
        window.sharedStateMaterials[key] = clone;
    }
    
    mesh.material = window.sharedStateMaterials[key];
};

// ==========================================
// PARSER ID P-COMPOSITE
// ==========================================
window.parseCompositeId = function(userData) {
    if (!userData) return { isUnknown: true, full: "UNKNOWN", base: "UNKNOWN", record: "UNKNOWN" };
    
    let rawId = userData.compositeId || userData.blockName || "UNKNOWN";
    if (!rawId || rawId === "Unknown_Block" || rawId === "UNKNOWN") {
        return { isUnknown: true, full: "UNKNOWN", base: "UNKNOWN", record: "UNKNOWN" };
    }

    const parts = rawId.split('/');
    const name = parts[0] ? parts[0].trim() : "-";
    const block = parts[1] ? parts[1].trim() : "-";
    const strip = parts[2] ? parts[2].trim() : "-";
    const bench = parts[3] ? parts[3].trim() : (userData.bench || "-");
    const seam = parts[4] ? parts[4].trim() : (userData.seam || "-");
    const subset = parts[5] ? parts[5].trim() : (userData.subset || "-");

    const baseBlock = `${name}/${block}/${strip}`;
    const recordBlock = `${name}/${block}/${strip}/${bench}`;

    return {
        isUnknown: false,
        full: rawId,
        base: baseBlock,
        record: recordBlock,
        name, block, strip, bench, seam, subset
    };
};

// ==========================================
// PENYIAPAN DOM (INFO PANEL & ACARA)
// ==========================================
const container = document.getElementById('canvas-container');
const selectionRect = document.getElementById('selection-rect');
const polygonShape = document.getElementById('polygon-shape');
const polygonLine = document.getElementById('polygon-line');

const infoTitle = document.querySelector('#container-info h3');
if (infoTitle) infoTitle.innerHTML = '<i class="fa-solid fa-circle-info text-yellow-400"></i> Information';

const hoverBar = document.getElementById('hover-empty')?.parentElement;
if (hoverBar) hoverBar.classList.add('hidden'); 

// ==========================================
// PENGENDALI ACARA UMUM & LOD
// ==========================================
if (container) {
    container.addEventListener('mouseleave', () => {
        if (window.hoveredGroupKey) {
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false));
            window.hoveredMeshes.length = 0; 
            window.hoveredGroupKey = null; 
            window.currentHoveredData = null;
            window.renderInfoPanel();
        }
    });

    container.addEventListener('pointerdown', (e) => {
        if (e.target && e.target.tagName !== 'CANVAS') return;
        
        // HANYA MATIKAN KONTROL PADA KLIK KIRI SAJA
        // Ini memungkinkan Pengguna menggunakan klik tengah / kanan untuk pan dan rotasi kamera
        if (e.button !== 0) return; 

        const mode = window.activeInteractionMode;
        const isBox = mode === 'box_select';
        const isPoly = mode === 'poly_select';
        if ((isBox || isPoly || mode === 'draw_line' || mode === 'draw_area' || mode === 'draw_marker') && typeof controls !== 'undefined') {
            controls.enabled = false;
        }
    }, true); 
}

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Shift') window.isShiftDown = true;

    if (e.key === 'r' || e.key === 'R') {
        if (typeof window.toggleAutoRecord === 'function') {
            window.toggleAutoRecord();
        }
    }

    if (e.key === 'Enter') {
        if (window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') {
            if(window.finishDrawing) window.finishDrawing();
        } else if (window.isDrawingPolygon) {
            window.finishPolygonSelection();
        }
    }
    
    if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') {
            if(window.cancelActiveDrawing) window.cancelActiveDrawing();
        } else if (window.isDrawingPolygon) {
            window.cancelPolygon();
        } else {
            window.clearSelection();
        }

        const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
        if (defaultBtn) defaultBtn.click();
        if(container) container.style.cursor = 'default';
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && typeof selectedDrawing !== 'undefined' && selectedDrawing) {
        if (selectedDrawing.lineMesh) {
            if (typeof drawGroup !== 'undefined') drawGroup.remove(selectedDrawing.lineMesh);
            window.cleanseZombieMesh(selectedDrawing.lineMesh);
        }
        if (selectedDrawing.areaMesh) {
            if (typeof drawGroup !== 'undefined') drawGroup.remove(selectedDrawing.areaMesh);
            window.cleanseZombieMesh(selectedDrawing.areaMesh);
        }
        if (typeof finishedDrawings !== 'undefined') finishedDrawings = finishedDrawings.filter(d => d !== selectedDrawing);
        selectedDrawing = null;
    }
}, true);

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') window.isShiftDown = false;
});

if (container) {
    container.addEventListener('contextmenu', (e) => { 
        if (e.target && e.target.tagName !== 'CANVAS') return;
        if(window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') { 
            e.preventDefault(); 
            if(window.finishDrawing) window.finishDrawing(); 
        } 
    });
}

window.toggleEdgesLOD = function(show) {
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup) return;
    pitReserveGroup.children.forEach(m => {
        if (m.isMesh && m.children.length > 0) m.children[0].visible = show;
    });
};

let wheelTimeout;
if (container) {
    container.addEventListener('wheel', (e) => {
        if (e.target && e.target.tagName !== 'CANVAS') return;
        window.isCameraMoving = true; window.toggleEdgesLOD(false);
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => { window.isCameraMoving = false; window.toggleEdgesLOD(true); }, 300);
    }, { passive: true });
}

window.addEventListener('pointerup', () => {
    window.isPointerDown = false;
    if (window.isCameraMoving) { window.isCameraMoving = false; window.toggleEdgesLOD(true); }
});

// ==========================================
// LOGIK PEMILIHAN ASAS (POINTER)
// ==========================================
window.getMousePos = function(event) {
    if (!container) return { x: 0, y: 0, nx: 0, ny: 0 };
    const rect = container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, nx: ((event.clientX - rect.left) / rect.width) * 2 - 1, ny: -((event.clientY - rect.top) / rect.height) * 2 + 1 };
}

window.clearSelection = function() { 
    window.selectedMeshes.forEach(mesh => { 
        if (mesh.userData.isRecorded) {
            const isDisp = mesh.userData.recordType === 'disp' || mesh.userData.type === 'disp' || mesh.userData.type === 'disposal';
            window.applyMaterialState(mesh, isDisp ? 'recorded_disp' : 'recorded_pit');
        } else {
            window.applyMaterialState(mesh, 'default');
        }
    }); 
    window.selectedMeshes.clear(); 
    window.displaySelectionInfo(); 
}

window.highlightMesh = function(mesh, isHover) { 
    if (!mesh || !mesh.visible) return; 
    
    const isSelected = window.selectedMeshes.has(mesh);

    if (isSelected) {
        window.applyMaterialState(mesh, 'selected');
    } else if (mesh.userData.isRecorded) {
        const isDisp = mesh.userData.recordType === 'disp' || mesh.userData.type === 'disp' || mesh.userData.type === 'disposal';
        window.applyMaterialState(mesh, isDisp ? 'recorded_disp' : 'recorded_pit');
    } else if (isHover) {
        window.applyMaterialState(mesh, 'hover');
    } else {
        window.applyMaterialState(mesh, 'default');
    }
}

window.updateSelectionVisuals = function() { 
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup) return;
    pitReserveGroup.children.forEach(mesh => { 
        if (!mesh.isMesh) return;
        
        if (window.selectedMeshes.has(mesh)) {
            window.applyMaterialState(mesh, 'selected');
        } else {
            if (mesh.userData.isRecorded) {
                const isDisp = mesh.userData.recordType === 'disp' || mesh.userData.type === 'disp' || mesh.userData.type === 'disposal';
                window.applyMaterialState(mesh, isDisp ? 'recorded_disp' : 'recorded_pit');
            } else {
                window.applyMaterialState(mesh, 'default');
            }
        }
    }); 
}

// ==========================================
// VISIBILITAS BLOCK TER-RECORD (CHECKBOX)
// ==========================================
window.updateRecordedVisibility = function() {
    const showPit = document.getElementById('cb-show-pit-record')?.checked || false;
    const showDisp = document.getElementById('cb-show-disp-record')?.checked || false;

    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup) return;

    pitReserveGroup.children.forEach(m => {
        if (!m.isMesh) return;
        
        if (m.userData.isRecorded) {
            const isDisp = m.userData.recordType === 'disp' || m.userData.type === 'disp' || m.userData.type === 'disposal';
            
            if (isDisp) {
                m.visible = showDisp;
                if (showDisp) window.applyMaterialState(m, 'recorded_disp');
            } else {
                m.visible = showPit;
                if (showPit) window.applyMaterialState(m, 'recorded_pit');
            }
        } else {
            if (!window.selectedMeshes.has(m)) {
                window.applyMaterialState(m, 'default');
            }
        }
    });
}

// ==========================================
// HELPER: DETEKSI AREA MASKING (CLIPPING) DXF
// ==========================================
window.isPointMaskedByFootprint = function(point, clipFootprints) {
    if (!clipFootprints || typeof pitReserveGroup === 'undefined' || !_verticalRaycaster) return false;

    let targetMeshes = [];
    pitReserveGroup.children.forEach(c => {
        if (c.isMesh) {
            let type = c.userData.type || 'pit';
            if (type === 'disposal') type = 'disp';
            if (clipFootprints === 'All Data' || 
               (clipFootprints === 'Pit Data' && type === 'pit') || 
               (clipFootprints === 'Disposal Data' && type === 'disp')) {
                targetMeshes.push(c);
            }
        }
    });

    if (targetMeshes.length === 0) return false;

    _verticalRayOrigin.set(point.x, 10000, point.z);
    _verticalRaycaster.set(_verticalRayOrigin, _verticalRayDir);

    const hits = _verticalRaycaster.intersectObjects(targetMeshes, false);
    return hits.length > 0;
};

window.getFirstValidIntersection = function(intersects) {
    for (let i = 0; i < intersects.length; i++) {
        const hit = intersects[i];
        let isMasked = false;

        if (hit.object.userData.dxfLayerName) {
            if (typeof appLayers !== 'undefined') {
                const layer = appLayers.find(l => l.name === hit.object.userData.dxfLayerName && l.type === 'dxf');
                if (layer && layer.clippingEnabled && layer.hasFaces) {
                    isMasked = window.isPointMaskedByFootprint(hit.point, layer.clipFootprints);
                }
            }
        }
        
        if (!isMasked) {
            return hit;
        }
    }
    return null;
};

// ==========================================
// LOGIKA HOVER (BLOCK GEOMETRY & DXF)
// ==========================================
window.handleHover = function(intersects, param2 = null) {
    if (window.isDraggingRect || window.isDrawingPolygon || (typeof isProcessing !== 'undefined' && isProcessing)) return;
    
    let dxfIntersect = null;
    if (param2 !== null && typeof param2 === 'object') {
        dxfIntersect = param2;
    }

    const mode = window.activeInteractionMode;
    const isBlockMode = mode === 'select_block' || mode === 'record_block';
    
    const isToolMode = ['box_select', 'poly_select', 'center_pivot', 'draw_line', 'draw_area', 'draw_marker'].includes(mode);

    const updateCursor = (isHovering) => {
        if (!container) return;
        if (isToolMode) {
            container.style.cursor = 'crosshair';
        } else {
            container.style.cursor = isHovering ? 'pointer' : 'default';
        }
    };

    if (window.selectedMeshes.size > 0) {
        updateCursor(false);
        return;
    }

    if (intersects && intersects.length > 0) {
        updateCursor(true); 
        const object = intersects[0].object;
        const targetType = object.userData.type || 'pit';
        
        const targetParsed = window.parseCompositeId(object.userData);
        const currentHoverKey = isBlockMode ? `${targetType}_BLOCK_${targetParsed.base}` : `${targetType}_BENCH_${targetParsed.record}`;
        
        const pt = intersects[0].point;
        let ce = pt.x, cn = -pt.z, cz = pt.y;
        if (typeof window.worldOrigin !== 'undefined' && window.worldOrigin && window.worldOrigin.isSet) {
            ce += window.worldOrigin.x;
            cn = -(pt.z + window.worldOrigin.z); 
            cz += window.worldOrigin.y;
        }
        const coordStr = `${ce.toFixed(1)}, ${cn.toFixed(1)}, ${cz.toFixed(1)}`;

        if (window.hoveredGroupKey !== currentHoverKey) {
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes.length = 0; 
            window.hoveredGroupKey = currentHoverKey;
            
            let pitWaste = 0; let dispWaste = 0; let totalResource = 0;

            if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
                pitReserveGroup.children.forEach(m => {
                    if (!m.isMesh || !m.visible) return;
                    if ((m.userData.type || 'pit') !== targetType) return; 

                    const mParsed = window.parseCompositeId(m.userData);
                    let isMatch = false;
                    if (isBlockMode) { isMatch = (mParsed.base === targetParsed.base); } 
                    else { isMatch = (mParsed.record === targetParsed.record); }
                    
                    if (isMatch) {
                        window.highlightMesh(m, true); 
                        window.hoveredMeshes.push(m); 
                        if ((m.userData.type || 'pit') === 'disp' || m.userData.type === 'disposal') { dispWaste += m.userData.wasteVol || 0; } 
                        else { pitWaste += m.userData.wasteVol || 0; totalResource += m.userData.resVol || 0; }
                    }
                });
            }
            
            window.currentHoveredData = {
                type: targetType,
                isBlockSelection: isBlockMode,
                parsed: targetParsed,
                pitWaste: pitWaste,
                dispWaste: dispWaste,
                resource: totalResource,
                coordStr: coordStr
            };
            window.renderInfoPanel();
        } else {
            window.currentHoveredData.coordStr = coordStr;
            const coordEl = document.getElementById('info-coord-val');
            if (coordEl) coordEl.textContent = coordStr;
        }
    } else if (dxfIntersect) {
        updateCursor(true);
        
        const pt = dxfIntersect.point;
        let ce = pt.x, cn = -pt.z, cz = pt.y;
        if (typeof window.worldOrigin !== 'undefined' && window.worldOrigin && window.worldOrigin.isSet) {
            ce += window.worldOrigin.x;
            cn = -(pt.z + window.worldOrigin.z); 
            cz += window.worldOrigin.y;
        }
        const coordStr = `${ce.toFixed(1)}, ${cn.toFixed(1)}, ${cz.toFixed(1)}`;
        
        const dxfName = dxfIntersect.object.userData.dxfLayerName;
        const dxfType = dxfIntersect.object.userData.dxfType;
        const currentHoverKey = `DXF_${dxfName}`;
        
        if (window.hoveredGroupKey !== currentHoverKey) {
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes.length = 0; 
            window.hoveredGroupKey = currentHoverKey;
            
            window.currentHoveredData = {
                type: 'dxf',
                name: dxfName,
                dxfType: dxfType,
                coordStr: coordStr
            };
            window.renderInfoPanel();
        } else {
            window.currentHoveredData.coordStr = coordStr;
            const coordEl = document.getElementById('info-coord-val');
            if (coordEl) coordEl.textContent = coordStr;
        }
    } else {
        updateCursor(false);
        
        const coordEl = document.getElementById('info-coord-val');
        if (coordEl) coordEl.textContent = "-";

        if (window.hoveredGroupKey) { 
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes.length = 0; window.hoveredGroupKey = null; window.currentHoveredData = null;
            window.renderInfoPanel();
        } else if (window.selectedMeshes.size === 0) {
            window.renderInfoPanel();
        }
    }
}

// ==========================================
// POINTER EVENTS
// ==========================================
window.onPointerDown = function(event) {
    if (event.target && event.target.tagName !== 'CANVAS') return;
    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing)) return; 
    
    window.isPointerDown = true;
    window.rawPointerDownPos = { x: event.clientX, y: event.clientY };

    const pos = window.getMousePos(event);
    const mode = window.activeInteractionMode;
    
    if (mode === 'draw_marker') {
        if (event.button !== 0) return;
        if(typeof window.getRaycastPoint === 'function') {
            const pt = window.getRaycastPoint(pos);
            if (pt) { 
                if (typeof window.addDrawMarker === 'function') window.addDrawMarker(pt);
                // Langsung kembalikan ke mode seleksi agar interaksi blok tidak tumpang tindih
                const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
                if (defaultBtn) defaultBtn.click();
            }
        }
        window.dragStartPos = { x: pos.x, y: pos.y }; 
        window._ignoreNextClick = true; // Jangan jalankan executeClickAction saat pointerUp
        return;
    }

    if (mode === 'draw_line' || mode === 'draw_area') {
        if (event.button === 2) { if(window.finishDrawing) window.finishDrawing(); return; } 
        if (event.button !== 0) return; 
        if(typeof window.getRaycastPoint === 'function') {
            const pt = window.getRaycastPoint(pos);
            if (pt) { 
                if(typeof drawPoints3D !== 'undefined') drawPoints3D.push(pt); 
                if(window.updateDrawVisuals) window.updateDrawVisuals(pt); 
            }
        }
        window.dragStartPos = { x: pos.x, y: pos.y }; 
        return;
    }

    if (event.button === 1) {
        window.executeCenterPivot(pos);
        return; 
    }

    if (event.button !== 0) return; 
    
    const isBox = mode === 'box_select';
    const isPoly = mode === 'poly_select';
    const isCenter = mode === 'center_pivot';

    if (isCenter) { window.executeCenterPivot(pos); window._justCentered = true; return; }

    if (event.shiftKey || window.isShiftDown) {
        if (typeof controls !== 'undefined') controls.enabled = false;
    }

    if (isBox) {
        window.isDraggingRect = true; 
        window.dragStartPos = { x: pos.x, y: pos.y }; 
        if(typeof controls !== 'undefined') controls.enabled = false; 
        
        if (event.pointerId !== undefined && container && container.setPointerCapture) {
            container.setPointerCapture(event.pointerId);
        }

        if(selectionRect) {
            selectionRect.style.left = pos.x + 'px'; 
            selectionRect.style.top = pos.y + 'px'; 
            selectionRect.style.width = '0px'; 
            selectionRect.style.height = '0px'; 
            selectionRect.style.display = 'block';
        }
    } else if (isPoly) {
        window.isDrawingPolygon = true; 
        if(typeof controls !== 'undefined') controls.enabled = false; 
        
        // Panggil hook sinkronisasi kamera & temukan poin 3D
        if (typeof window.bindCameraChange === 'function') window.bindCameraChange();
        
        const pt3d = window._get3DPointFromMouse(pos);
        // Simpan titik 3D agar update Polygon SVG bisa re-project titik tersebut
        window.polygonPoints.push({ x: pos.x, y: pos.y, vec3: pt3d }); 
        window.updatePolygonSVG();
        
        if (window.polygonPoints.length > 2) {
            const p1 = window.polygonPoints[window.polygonPoints.length-1]; 
            const p2 = window.polygonPoints[window.polygonPoints.length-2]; 
            const pFirst = window.polygonPoints[0]; 
            
            const isDoubleClick = Math.hypot(p1.x - p2.x, p1.y - p2.y) < 5;
            const isClickStartPoint = Math.hypot(p1.x - pFirst.x, p1.y - pFirst.y) < 15; 
            
            if (isDoubleClick || isClickStartPoint) { 
                if (isDoubleClick) {
                    window.polygonPoints.pop(); 
                } else {
                    window.polygonPoints.pop(); 
                }
                window.finishPolygonSelection(); 
            }
        }
    } else { window.dragStartPos = { x: pos.x, y: pos.y }; }
}

var isDrawVisualUpdatePending = false;
var lastDrawPos = null;

window.onPointerMove = function(event) {
    if (event.target && event.target.tagName !== 'CANVAS') {
        if (!window.isDraggingRect && !window.isDrawingPolygon && window.hoveredGroupKey) {
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes.length = 0; window.hoveredGroupKey = null; window.currentHoveredData = null;
            window.renderInfoPanel();
        }
        if (!window.isDraggingRect && !window.isDrawingPolygon) return;
    }

    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing)) return; 
    const mode = window.activeInteractionMode;
    
    const isToolMode = ['box_select', 'poly_select', 'center_pivot', 'draw_line', 'draw_area', 'draw_marker'].includes(mode);

    if (isToolMode && container) {
        container.style.cursor = 'crosshair';
    }

    if (window.isPointerDown && !window.isDraggingRect && !window.isDrawingPolygon && mode !== 'draw_line' && mode !== 'draw_area' && mode !== 'draw_marker') {
        const dx = Math.abs(event.clientX - window.rawPointerDownPos.x); const dy = Math.abs(event.clientY - window.rawPointerDownPos.y);
        if ((dx > 3 || dy > 3) && !window.isCameraMoving) { window.isCameraMoving = true; window.toggleEdgesLOD(false); }
    }

    const pos = window.getMousePos(event); window.currentMousePos = pos;
    
    if (mode === 'draw_line' || mode === 'draw_area' || mode === 'draw_marker') {
        lastDrawPos = pos;
        if (!isDrawVisualUpdatePending) {
            isDrawVisualUpdatePending = true;
            requestAnimationFrame(() => {
                if (lastDrawPos) {
                    if(window.initDrawHotspot) window.initDrawHotspot(); 
                    if(typeof window.getRaycastPoint === 'function'){
                        const pt = window.getRaycastPoint(lastDrawPos);
                        if (pt && typeof drawHotspot !== 'undefined') {
                            drawHotspot.position.copy(pt); drawHotspot.visible = true;
                            if (mode !== 'draw_marker' && typeof drawPoints3D !== 'undefined' && drawPoints3D.length > 0 && window.updateDrawVisuals) {
                                window.updateDrawVisuals(pt);
                            }
                        } else { if (typeof drawHotspot !== 'undefined' && drawHotspot) drawHotspot.visible = false; }
                    }
                }
                isDrawVisualUpdatePending = false;
            });
        }
        return; 
    } else { if (typeof drawHotspot !== 'undefined' && drawHotspot) drawHotspot.visible = false; }

    if (window.isDraggingRect && selectionRect) {
        selectionRect.style.left = Math.min(pos.x, window.dragStartPos.x) + 'px'; 
        selectionRect.style.top = Math.min(pos.y, window.dragStartPos.y) + 'px';
        selectionRect.style.width = Math.abs(pos.x - window.dragStartPos.x) + 'px'; 
        selectionRect.style.height = Math.abs(pos.y - window.dragStartPos.y) + 'px'; 
        return;
    }
    
    if (window.isDrawingPolygon && window.polygonPoints.length > 0) { 
        window.updatePolygonSVG(pos); 
        return; 
    }
    
    if (mode === 'center_pivot') { return; }
    if (window.isCameraMoving) return;

    const currentTime = Date.now();
    if (currentTime - window.lastRaycastTime < 40) return;
    window.lastRaycastTime = currentTime;

    if (typeof mouse !== 'undefined' && typeof camera !== 'undefined') {
        mouse.x = pos.nx; mouse.y = pos.ny; 
        const rc = (typeof raycaster !== 'undefined' && raycaster) ? raycaster : _sharedRaycaster;
        if (rc) {
            rc.setFromCamera(mouse, camera);
            
            let intersectableObjects = [];

            if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup.visible) {
                pitReserveGroup.children.forEach(c => {
                    if (c.isMesh && c.visible) {
                        intersectableObjects.push(c);
                    }
                });
            }

            if (typeof appLayers !== 'undefined') {
                appLayers.forEach(l => {
                    if (l.type === 'dxf' && l.visible && l.threeObject) {
                        l.threeObject.traverse(c => {
                            if ((c.isMesh || c.isLineSegments) && c.visible) {
                                c.userData.dxfLayerName = l.name;
                                c.userData.dxfType = l.hasFaces ? 'Polymesh' : 'Polyline';
                                intersectableObjects.push(c);
                            }
                        });
                    }
                });
            }

            const intersects = rc.intersectObjects(intersectableObjects, false);

            let pitIntersects = [];
            let dxfIntersect = null;

            const validHit = window.getFirstValidIntersection(intersects);

            if (validHit) {
                if (validHit.object.userData.dxfLayerName) {
                    dxfIntersect = validHit;
                } else {
                    pitIntersects = [validHit];
                }
            }
            
            window.handleHover(pitIntersects, dxfIntersect);
        }
    }
}

window.onPointerUp = function(event) {
    if (event.target && event.target.tagName !== 'CANVAS' && !window.isDraggingRect && !window.isDrawingPolygon) return;

    if (window._justCentered) { window._justCentered = false; return; }
    if (window._ignoreNextClick) { window._ignoreNextClick = false; return; }
    
    if (typeof controls !== 'undefined' && !controls.enabled) {
        // PERBAIKAN: Melepaskan kendali bahkan saat 'isDrawingPolygon' bernilai true.
        // Dengan ini, user bisa pan / zoom di sela-sela klik pembuatan polygon.
        if (!window.isDraggingRect && (typeof isCustomOrbiting === 'undefined' || !isCustomOrbiting)) {
            controls.enabled = true;
        }
    }

    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing) || event.button !== 0) return; 
    const pos = window.getMousePos(event);
    const mode = window.activeInteractionMode;

    if (window.isDraggingRect) {
        window.isDraggingRect = false; 
        if(typeof controls !== 'undefined') controls.enabled = true; 
        if(selectionRect) selectionRect.style.display = 'none';
        
        if (event.pointerId !== undefined && container && container.releasePointerCapture) {
            try { container.releasePointerCapture(event.pointerId); } catch(e) {}
        }
        
        const w = Math.abs(pos.x - window.dragStartPos.x); 
        const h = Math.abs(pos.y - window.dragStartPos.y);
        if (w > 5 || h > 5) { 
            window.processAreaSelection({ minX: Math.min(pos.x, window.dragStartPos.x), maxX: Math.max(pos.x, window.dragStartPos.x), minY: Math.min(pos.y, window.dragStartPos.y), maxY: Math.max(pos.y, window.dragStartPos.y) }, null, event.shiftKey || window.isShiftDown); 
            return; 
        }
    }
    
    if (window.isDrawingPolygon) return;
    if (mode === 'draw_line' || mode === 'draw_area' || mode === 'draw_marker') return; 

    if (Math.hypot(pos.x - window.dragStartPos.x, pos.y - window.dragStartPos.y) < 5) window.executeClickAction(event, pos);
}

// ==========================================
// TINDAKAN KLIK (SELEKSI & APPEND)
// ==========================================
window.executeCenterPivot = function(pos) {
    if (typeof mouse === 'undefined' || typeof camera === 'undefined' || typeof controls === 'undefined') return;

    const rc = (typeof raycaster !== 'undefined' && raycaster) ? raycaster : _sharedRaycaster;
    if (!rc) return;

    mouse.x = pos.nx; mouse.y = pos.ny; rc.setFromCamera(mouse, camera);
    const intersectable = [];
    
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
        pitReserveGroup.traverse(c => { 
            // Izinkan center pivot pada objek terekam asalkan terlihat
            if (c.isMesh && c.visible) intersectable.push(c); 
        });
    }
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(l => { 
            if (l.type === 'dxf' && l.visible && l.threeObject) {
                l.threeObject.traverse(c => { 
                    if ((c.isMesh || c.isLineSegments) && c.visible) intersectable.push(c); 
                });
            }
        });
    }

    const intersects = rc.intersectObjects(intersectable, false);
    
    const validHit = window.getFirstValidIntersection(intersects);
    
    if (validHit) { 
        const newTarget = validHit.point;
        const offset = new THREE.Vector3().subVectors(newTarget, controls.target);
        camera.position.add(offset);
        controls.target.copy(newTarget); 
        
        controls.update(); 
    }

    if (window.activeInteractionMode === 'center_pivot') {
        const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
        if (defaultBtn) defaultBtn.click();
        if(container) container.style.cursor = 'default';
    }
}

window.executeClickAction = function(event, pos) {
    const mode = window.activeInteractionMode;
    if (typeof mouse === 'undefined' || typeof camera === 'undefined') return;

    const rc = (typeof raycaster !== 'undefined' && raycaster) ? raycaster : _sharedRaycaster;
    if (!rc) return;

    mouse.x = pos.nx; mouse.y = pos.ny; rc.setFromCamera(mouse, camera);
    
    const isAppend = event.shiftKey || window.isShiftDown;
    const isBlockMode = mode === 'select_block' || mode === 'record_block';
    const isRecordMode = mode === 'record_bench' || mode === 'record_block';

    let intersectableObjects = [];
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
        pitReserveGroup.children.forEach(c => {
            if (c.isMesh && c.visible && !c.userData.isRecorded) {
                intersectableObjects.push(c);
            }
        });
    }

    const intersects = rc.intersectObjects(intersectableObjects, false);

    if (intersects.length === 0) { 
        if (!isAppend) window.clearSelection(); 
        return; 
    }
    
    const target = intersects[0].object; 
    const targetType = target.userData.type || 'pit';
    const targetParsed = window.parseCompositeId(target.userData);
    
    if (!isAppend) window.clearSelection();

    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        pitReserveGroup.children.forEach(m => {
            if (!m.isMesh || !m.visible || m.userData.isRecorded) return;
            if ((m.userData.type || 'pit') !== targetType) return;
            const mParsed = window.parseCompositeId(m.userData);

            if (isBlockMode) { 
                if (mParsed.base === targetParsed.base) window.selectedMeshes.add(m); 
            } else {
                if (mParsed.record === targetParsed.record) window.selectedMeshes.add(m);
            }
        });
    }

    window.hoveredMeshes.length = 0;
    window.hoveredGroupKey = null;
    window.currentHoveredData = null;
    window.currentHoveredName = null;

    window.updateSelectionVisuals(); 
    window.displaySelectionInfo();

    if (isRecordMode || (window.isAutoRecordActive && window.selectedMeshes.size > 0)) {
        window.recordSelectedMeshes();
    }
}

// ==========================================
// PEMILIHAN KAWASAN & POLIGON
// ==========================================
window.updatePolygonSVG = function(currentPos = null) {
    if (window.polygonPoints.length === 0 || !polygonShape || !polygonLine) return;
    
    // PEMBARUAN: Kalkulasi ulang posisi 2D SVG berbasis koordinat 3D mengikuti posisi kamera terbaru
    if (typeof camera !== 'undefined' && container) {
        window.polygonPoints.forEach(p => {
            if (p.vec3 && _tempScreenPos) {
                _tempScreenPos.copy(p.vec3).project(camera);
                p.x = (_tempScreenPos.x * 0.5 + 0.5) * container.clientWidth;
                p.y = (_tempScreenPos.y * -0.5 + 0.5) * container.clientHeight;
            }
        });
    }

    let pointsForShape = [...window.polygonPoints];
    if (currentPos) {
        pointsForShape.push({ x: currentPos.x, y: currentPos.y });
    }
    
    polygonShape.setAttribute('points', pointsForShape.map(p => `${p.x},${p.y}`).join(' '));
    
    if (currentPos) {
        const lastP = window.polygonPoints[window.polygonPoints.length-1];
        polygonLine.setAttribute('points', `${lastP.x},${lastP.y} ${currentPos.x},${currentPos.y}`);
    } else {
        polygonLine.setAttribute('points', '');
    }
}

window.finishPolygonSelection = function() {
    window.isDrawingPolygon = false; 
    if(typeof controls !== 'undefined') controls.enabled = true; 
    window.updatePolygonSVG(); // Sinkronisasi titik terakhir
    if(polygonLine) polygonLine.setAttribute('points', '');
    if (window.polygonPoints.length > 2) window.processAreaSelection(null, window.polygonPoints, window.isShiftDown);
    setTimeout(() => { if(polygonShape) polygonShape.setAttribute('points', ''); window.polygonPoints = []; }, 300);
}

window.cancelPolygon = function() { 
    window.isDrawingPolygon = false; 
    if(typeof controls !== 'undefined') controls.enabled = true; 
    window.polygonPoints = []; 
    if(polygonShape) polygonShape.setAttribute('points', ''); 
    if(polygonLine) polygonLine.setAttribute('points', ''); 
}

window.processAreaSelection = function(rectBounds, polyPoints, isAppend = false) {
    if (!isAppend) window.clearSelection(); 
    if (typeof scene !== 'undefined') scene.updateMatrixWorld(true);
    
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup || !pitReserveGroup.visible) return;

    let targetBases = new Set();
    let targetTypes = new Set();
    let checkedRays = new Set();
    
    if(!_sharedRaycaster) return;

    pitReserveGroup.children.forEach(mesh => {
        if (!mesh.visible || !mesh.isMesh || mesh.userData.isRecorded) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        
        if(_tempVector3 && _tempScreenPos) {
            mesh.geometry.boundingBox.getCenter(_tempVector3);
            mesh.updateMatrixWorld(true);
            _tempVector3.applyMatrix4(mesh.matrixWorld); 
            
            const worldCenter = _tempVector3.clone(); 
            
            _tempScreenPos.copy(_tempVector3).project(camera);
            
            if (_tempScreenPos.z > 1) return; 
            
            const nx = _tempScreenPos.x;
            const ny = _tempScreenPos.y;
            const sx = (nx * 0.5 + 0.5) * container.clientWidth; 
            const sy = (ny * -0.5 + 0.5) * container.clientHeight;
            
            let isInside = false;
            
            if (rectBounds) { 
                if (sx >= rectBounds.minX && sx <= rectBounds.maxX && sy >= rectBounds.minY && sy <= rectBounds.maxY) isInside = true; 
            } else if (polyPoints) { 
                isInside = window.pointInPolygon({x: sx, y: sy}, polyPoints); 
            }
            
            if (isInside) {
                const rayKey = `${nx.toFixed(4)},${ny.toFixed(4)}`; 
                
                if (!checkedRays.has(rayKey)) {
                    checkedRays.add(rayKey);
                    
                    if(_sharedMouseVec) {
                        _sharedMouseVec.set(nx, ny);
                        _sharedRaycaster.setFromCamera(_sharedMouseVec, camera);
                    } else {
                        _sharedRaycaster.setFromCamera({x: nx, y: ny}, camera);
                    }
                    
                    const intersectables = pitReserveGroup.children.filter(c => c.isMesh && c.visible && !c.userData.isRecorded);
                    const validHits = _sharedRaycaster.intersectObjects(intersectables, false);
                    
                    if (validHits.length > 0) {
                        const topHit = validHits[0].object;
                        const parsed = window.parseCompositeId(topHit.userData);
                        targetBases.add(parsed.base);
                        targetTypes.add(topHit.userData.type || 'pit');

                        const distToMeshCenter = camera.position.distanceTo(worldCenter);
                        const distToHit = validHits[0].distance;
                        
                        if (distToMeshCenter <= distToHit + 2.5) { 
                            const parsedMesh = window.parseCompositeId(mesh.userData);
                            targetBases.add(parsedMesh.base);
                            targetTypes.add(mesh.userData.type || 'pit');
                        }
                    } else {
                        const parsedMesh = window.parseCompositeId(mesh.userData);
                        targetBases.add(parsedMesh.base);
                        targetTypes.add(mesh.userData.type || 'pit');
                    }
                } else {
                    const parsedMesh = window.parseCompositeId(mesh.userData);
                    targetBases.add(parsedMesh.base);
                    targetTypes.add(mesh.userData.type || 'pit');
                }
            }
        }
    });

    if (targetBases.size > 0) {
        pitReserveGroup.children.forEach(mesh => {
            if (!mesh.visible || !mesh.isMesh || mesh.userData.isRecorded) return;
            const parsed = window.parseCompositeId(mesh.userData);
            const type = mesh.userData.type || 'pit';

            if (targetBases.has(parsed.base) && targetTypes.has(type)) {
                window.selectedMeshes.add(mesh);
            }
        });
    }

    window.hoveredMeshes.length = 0;
    window.hoveredGroupKey = null;
    window.currentHoveredData = null;
    window.currentHoveredName = null;

    window.updateSelectionVisuals(); 
    window.displaySelectionInfo();

    if (window.isAutoRecordActive && window.selectedMeshes.size > 0) {
        window.recordSelectedMeshes();
    }
}

window.pointInPolygon = function(point, vs) {
    let x = point.x, y = point.y; let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y; let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    } 
    return inside;
}

// ==========================================
// RENDER PANEL INFORMASI
// ==========================================
window.renderInfoPanel = function() {
    const infoPanel = document.getElementById('info-panel');
    const infoEmpty = document.getElementById('info-empty');
    if (!infoPanel) return;

    if (infoEmpty) infoEmpty.classList.add('hidden');
    infoPanel.classList.remove('hidden'); 
    infoPanel.classList.add('flex');

    let html = '<div class="flex flex-col gap-1.5 text-[10px] w-full px-1 pb-1 pt-1">';
    const createRow = (label, value, valueClass = "text-emerald-400", valueId = "") => `
        <div class="flex items-start w-full"><span class="text-slate-400 font-medium w-[65px] shrink-0">${label}</span><span class="text-slate-500 mx-1 shrink-0">:</span><span ${valueId ? `id="${valueId}"` : ''} class="font-semibold ${valueClass} flex-1 text-right break-words" title="${value}">${value}</span></div>
    `;

    let dataValue = "-"; 
    let detailData = "-";
    let pitWasteData = "-"; 
    let dispWasteData = "-"; 
    let resourceData = "-"; 
    let srData = "-";
    let coordData = "-";

    if (window.currentHoveredData) {
        if (window.currentHoveredData.type === 'dxf') {
            dataValue = window.currentHoveredData.name || "-";
            detailData = window.currentHoveredData.dxfType || "-";
            coordData = window.currentHoveredData.coordStr || "-";
        } else {
            dataValue = window.currentHoveredData.parsed.name || "-";
            pitWasteData = Number(window.currentHoveredData.pitWaste.toFixed(2)).toLocaleString();
            dispWasteData = Number(window.currentHoveredData.dispWaste.toFixed(2)).toLocaleString();
            resourceData = Number(window.currentHoveredData.resource.toFixed(2)).toLocaleString();
            coordData = window.currentHoveredData.coordStr || "-";
            
            const p = window.currentHoveredData.parsed;
            if (window.currentHoveredData.isBlockSelection) {
                detailData = `${p.block}/${p.strip}/ALL/ALL/ALL`;
            } else {
                detailData = `${p.block}/${p.strip}/${p.bench}/${p.seam}/${p.subset}`;
            }
            srData = window.currentHoveredData.resource > 0 ? (window.currentHoveredData.pitWaste / window.currentHoveredData.resource).toFixed(2) : '-';
        }
    } 
    else if (window.selectedMeshes.size > 0) {
        let uniqueNames = new Set(); let uniqueBases = new Set(); let uniqueFulls = new Set();
        let rawPitWaste = 0; let rawDispWaste = 0; let rawResource = 0;
        
        let selBox = typeof THREE !== 'undefined' ? new THREE.Box3() : null; 

        window.selectedMeshes.forEach(m => {
            const parsed = window.parseCompositeId(m.userData);
            if(parsed.name && parsed.name !== "-") uniqueNames.add(parsed.name);
            uniqueBases.add(parsed.base);
            uniqueFulls.add(parsed.full);
            
            if ((m.userData.type || 'pit') === 'disp' || m.userData.type === 'disposal') {
                rawDispWaste += m.userData.wasteVol || 0;
            } else {
                rawPitWaste += m.userData.wasteVol || 0; 
                rawResource += m.userData.resVol || 0;
            }

            if (m.geometry && selBox && _tempBox3) {
                if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
                m.updateMatrixWorld(true);
                _tempBox3.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);
                selBox.union(_tempBox3);
            }
        });

        dataValue = Array.from(uniqueNames).join(', ');
        if (!dataValue) dataValue = "-";
        if (dataValue.length > 20) dataValue = "MULTIPLE NAMES";

        const baseArr = Array.from(uniqueBases);
        const fullArr = Array.from(uniqueFulls);
        
        if (baseArr.length === 1 && fullArr.length > 1) {
            const p = window.parseCompositeId({compositeId: fullArr[0]});
            detailData = `${p.block}/${p.strip}/MULTIPLE`;
        } else if (fullArr.length === 1) {
            const p = window.parseCompositeId({compositeId: fullArr[0]});
            detailData = `${p.block}/${p.strip}/${p.bench}/${p.seam}/${p.subset}`;
        } else {
            detailData = `MULTIPLE BLOCKS`;
        }

        pitWasteData = Number(rawPitWaste.toFixed(2)).toLocaleString();
        dispWasteData = Number(rawDispWaste.toFixed(2)).toLocaleString();
        resourceData = Number(rawResource.toFixed(2)).toLocaleString();
        srData = rawResource > 0 ? (rawPitWaste / rawResource).toFixed(2) : '-';

        if(selBox && _tempVector3) {
            selBox.getCenter(_tempVector3);
            let ce = _tempVector3.x, cn = -_tempVector3.z, cz = _tempVector3.y;
            if (typeof window.worldOrigin !== 'undefined' && window.worldOrigin && window.worldOrigin.isSet) {
                ce += window.worldOrigin.x;
                cn = -(_tempVector3.z + window.worldOrigin.z);
                cz += window.worldOrigin.y;
            }
            coordData = `${ce.toFixed(1)}, ${cn.toFixed(1)}, ${cz.toFixed(1)}`;
        }
    }

    html += createRow('Coordinate', coordData, 'text-cyan-300', 'info-coord-val'); 
    html += '<div class="w-full h-px bg-slate-700/50 my-1"></div>'; 
    
    html += createRow('Data', dataValue, 'text-yellow-400'); 
    html += createRow('Detail', detailData, 'text-yellow-400'); 
    
    html += '<div class="w-full h-px bg-slate-700/50 my-1"></div>'; 
    
    html += createRow('Waste (bcm)', pitWasteData, 'text-blue-400');
    html += createRow('Resource (t)', resourceData, 'text-orange-400');
    html += createRow('Strip Ratio', srData, 'text-green-400');
    
    html += '<div class="w-full h-px bg-slate-700/50 my-1"></div>'; 
    html += createRow('Waste (bcm)', dispWasteData, 'text-blue-400'); 

    html += '</div>';
    
    infoPanel.innerHTML = html;
}

window.displaySelectionInfo = function() { window.renderInfoPanel(); }

// ==========================================
// PENGATURAN TOGGLE AUTO-RECORD 
// ==========================================
window.toggleAutoRecord = function() {
    window.isAutoRecordActive = !window.isAutoRecordActive;
    const btn = document.getElementById('btn-toggle-record');
    
    if (btn) {
        if (window.isAutoRecordActive) {
            btn.classList.add('is-active');
            btn.title = "Auto-Record: ON";
            
            if (window.selectedMeshes && window.selectedMeshes.size > 0) {
                window.recordSelectedMeshes();
            }
        } else {
            btn.classList.remove('is-active');
            btn.title = "Auto-Record: OFF";
        }
    }
}

// ==========================================
// URUTAN & RAKAMAN REKOD (LOGIK BARU TERPISAH PIT/DISP & NAMING BARU)
// ==========================================
window.recordSelectedMeshes = function() {
    if (window.selectedMeshes.size === 0) return;
    
    window.redoStack = []; 
    
    let pitSelected = new Set();
    let dispSelected = new Set();
    
    window.selectedMeshes.forEach(target => {
        const type = target.userData.type || 'pit';
        if (type === 'disp' || type === 'disposal') {
            dispSelected.add(target);
        } else {
            pitSelected.add(target);
        }
    });

    const processGroup = (groupMeshes, isDispAction) => {
        if (groupMeshes.size === 0) return;
        
        let expandedMeshes = new Set();
        
        if (!isDispAction) {
            groupMeshes.forEach(target => {
                const targetType = target.userData.type || 'pit';
                const targetParsed = window.parseCompositeId(target.userData);
                
                if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
                
                let targetCenterY = 0;
                if(_tempVector3) {
                    target.updateMatrixWorld(true);
                    targetCenterY = target.geometry.boundingBox.getCenter(_tempVector3).applyMatrix4(target.matrixWorld).y;
                }

                if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
                    pitReserveGroup.children.forEach(m => {
                        if (!m.isMesh || !m.visible || m.userData.isRecorded) return;
                        if ((m.userData.type || 'pit') !== targetType) return;
                        
                        const mParsed = window.parseCompositeId(m.userData);
                        if (mParsed.base !== targetParsed.base) return; 

                        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
                        
                        let mCenterY = 0;
                        if(_tempVector3) {
                            m.updateMatrixWorld(true);
                            mCenterY = m.geometry.boundingBox.getCenter(_tempVector3).applyMatrix4(m.matrixWorld).y;
                        }
                        
                        if (mCenterY >= targetCenterY - 0.5 || mParsed.bench === targetParsed.bench) {
                            expandedMeshes.add(m);
                        }
                    });
                }
            });
            groupMeshes.forEach(m => expandedMeshes.add(m));
        } else {
            groupMeshes.forEach(m => expandedMeshes.add(m));
        }

        let combinedWaste = 0, combinedResource = 0; 
        let uniqueRecordNames = new Set(), recordedMeshesInStep = [];
        
        expandedMeshes.forEach(m => {
            combinedWaste += m.userData.wasteVol || 0; 
            combinedResource += m.userData.resVol || 0; 
            
            const parsed = window.parseCompositeId(m.userData);
            uniqueRecordNames.add(parsed.record); 
            
            m.userData.isRecorded = true;
            m.userData.recordType = isDispAction ? 'disp' : 'pit'; 
            
            m.visible = false; 
            window.applyMaterialState(m, 'default');
            
            recordedMeshesInStep.push(m);
        });
        
        const recArr = Array.from(uniqueRecordNames); 
        let seqName = "";

        if (recArr.length === 1) {
            seqName = `N - ${recArr[0]}`;
        } else {
            const baseGroups = new Set();
            recArr.forEach(r => { const p = r.split('/'); baseGroups.add(`${p[0]}/${p[1]}/${p[2]}`); });
            
            if (baseGroups.size === 1) {
                seqName = `M - ${Array.from(baseGroups)[0]}`;
            } else {
                let counter = isDispAction ? window.dispSequenceCounter++ : window.pitSequenceCounter++;
                seqName = `S${counter} - ${recArr.length} Blocks`;
            }
        }
        
        if (isDispAction) {
            window.dispSequenceRecords.push({ name: seqName, waste: combinedWaste });
            window.dispTotalWaste += combinedWaste;
        } else {
            window.pitSequenceRecords.push({ name: seqName, waste: combinedWaste, resource: combinedResource });
            window.pitTotalWaste += combinedWaste; 
            window.pitTotalResource += combinedResource; 
        }
        
        window.undoStack.push({ type: isDispAction ? 'disp' : 'pit', name: seqName, meshes: recordedMeshesInStep, waste: combinedWaste, resource: combinedResource });
        if (window.undoStack.length > window.MAX_UNDO_STEPS) window.undoStack.shift();
    };

    processGroup(dispSelected, true);
    processGroup(pitSelected, false);
    
    window.updateSequenceUI(); 
    window.updateRecordedVisibility(); 
    
    window.selectedMeshes.clear(); window.hoveredGroupKey = null; 
    window.hoveredMeshes.length = 0; window.currentHoveredName = null; window.currentHoveredData = null;

    window.displaySelectionInfo();
}

window.undoLastRecord = function() {
    if (window.undoStack.length === 0) return;
    const lastAction = window.undoStack.pop(); window.redoStack.push(lastAction);
    if (window.redoStack.length > window.MAX_UNDO_STEPS) window.redoStack.shift();
    
    const isSelectionFormat = /^S\d+ -/.test(lastAction.name);
    
    if (lastAction.type === 'disp') {
        window.dispSequenceRecords.pop(); 
        window.dispTotalWaste -= lastAction.waste;
        if (isSelectionFormat) window.dispSequenceCounter = Math.max(1, window.dispSequenceCounter - 1);
    } else {
        window.pitSequenceRecords.pop(); 
        window.pitTotalWaste -= lastAction.waste; 
        window.pitTotalResource -= lastAction.resource;
        if (isSelectionFormat) window.pitSequenceCounter = Math.max(1, window.pitSequenceCounter - 1);
    }
    
    lastAction.meshes.forEach(m => {
        m.userData.isRecorded = false; delete m.userData.recordType;
        window.applyMaterialState(m, 'default');
        
        const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
        const isPit = m.userData.type === 'pit' || !m.userData.type;
        const isDisp = m.userData.type === 'disp' || m.userData.type === 'disposal';

        if (isPit && !isResource) {
            m.visible = typeof window.isPitWasteVisible !== 'undefined' ? window.isPitWasteVisible : true;
        } else if (isPit && isResource) {
            m.visible = typeof window.isPitResourceVisible !== 'undefined' ? window.isPitResourceVisible : true;
        } else if (isDisp) {
            m.visible = typeof window.isDispWasteVisible !== 'undefined' ? window.isDispWasteVisible : true;
        } else {
            m.visible = true;
        }
    });
    
    window.updateSequenceUI();
    window.updateRecordedVisibility();
}

window.redoLastUndo = function() {
    if (window.redoStack.length === 0) return;
    const actionToRedo = window.redoStack.pop(); window.undoStack.push(actionToRedo);
    
    actionToRedo.meshes.forEach(m => { 
        m.userData.isRecorded = true; m.userData.recordType = actionToRedo.type;
        m.visible = false; 
        window.applyMaterialState(m, 'default');
    });
    
    const isSelectionFormat = /^S\d+ -/.test(actionToRedo.name);

    if (actionToRedo.type === 'disp') {
        if (isSelectionFormat) window.dispSequenceCounter++;
        window.dispSequenceRecords.push({ name: actionToRedo.name, waste: actionToRedo.waste });
        window.dispTotalWaste += actionToRedo.waste;
    } else {
        if (isSelectionFormat) window.dispSequenceCounter++;
        window.pitSequenceRecords.push({ name: actionToRedo.name, waste: actionToRedo.waste, resource: actionToRedo.resource });
        window.pitTotalWaste += actionToRedo.waste; 
        window.pitTotalResource += actionToRedo.resource;
    }
    
    window.updateSequenceUI();
    window.updateRecordedVisibility();
}

// ==========================================
// PEMBERSIHAN VIEW DAN RESET STATE GLOBAL
// ==========================================
window.resetSequenceAndView = function() {
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        pitReserveGroup.children.forEach(mesh => {
            if(!mesh.isMesh) return;
            mesh.userData.isRecorded = false; delete mesh.userData.recordType;
            
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            const isPit = mesh.userData.type === 'pit' || !mesh.userData.type;
            const isDisp = mesh.userData.type === 'disp' || mesh.userData.type === 'disposal';

            if (isPit && !isResource) {
                mesh.visible = typeof window.isPitWasteVisible !== 'undefined' ? window.isPitWasteVisible : true;
            } else if (isPit && isResource) {
                mesh.visible = typeof window.isPitResourceVisible !== 'undefined' ? window.isPitResourceVisible : true;
            } else if (isDisp) {
                mesh.visible = typeof window.isDispWasteVisible !== 'undefined' ? window.isDispWasteVisible : true;
            } else {
                mesh.visible = true;
            }
            
            window.applyMaterialState(mesh, 'default');
        });
    }
    
    if (window.sharedStateMaterials) {
        Object.values(window.sharedStateMaterials).forEach(mat => mat.dispose());
        window.sharedStateMaterials = {};
    }
    
    const cbPit = document.getElementById('cb-show-pit-record'); if(cbPit) cbPit.checked = false;
    const cbDisp = document.getElementById('cb-show-disp-record'); if(cbDisp) cbDisp.checked = false;
    
    window.pitSequenceRecords = []; window.pitTotalWaste = 0; window.pitTotalResource = 0; window.pitSequenceCounter = 1; 
    
    window.dispSequenceRecords = []; window.dispTotalWaste = 0; window.dispSequenceCounter = 1; 

    window.selectedMeshes.clear(); window.undoStack = []; window.redoStack = []; 
    window.hoveredGroupKey = null; window.hoveredMeshes.length = 0; window.currentHoveredName = null; window.currentHoveredData = null;

    window.displaySelectionInfo(); window.updateSequenceUI();

    const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
    if (defaultBtn) {
        defaultBtn.click();
    }
    if(container) container.style.cursor = 'default';
}

// ==========================================
// RENDER UI SEQUENCES (VIRTUAL SCROLL ENABLED)
// ==========================================
window.updateSequenceUI = function() {
    const renderPitRow = (record) => {
        let sr = record.resource > 0 ? (record.waste / record.resource).toFixed(2) : '-';
        const row = document.createElement('div');
        row.className = "grid grid-cols-[minmax(0,1fr)_55px_55px_35px] lg:grid-cols-[minmax(0,1fr)_65px_65px_35px] gap-2 px-2 text-[10px] lg:text-[9px] hover:bg-slate-800/50 transition-colors h-[30px] items-center border-b border-slate-800/50 box-border";
        row.innerHTML = `
            <div class="text-slate-300 truncate" title="${record.name}">${record.name}</div>
            <div class="text-right text-blue-400 font-mono truncate">${Number(record.waste.toFixed(2)).toLocaleString()}</div>
            <div class="text-right text-orange-400 font-mono truncate">${Number(record.resource.toFixed(2)).toLocaleString()}</div>
            <div class="text-right text-green-400 font-mono truncate">${sr}</div>
        `;
        return row;
    };

    const renderDispRow = (record) => {
        const row = document.createElement('div');
        row.className = "grid grid-cols-[minmax(0,1fr)_55px_55px_35px] lg:grid-cols-[minmax(0,1fr)_65px_65px_35px] gap-2 px-2 text-[10px] lg:text-[9px] hover:bg-slate-800/50 transition-colors h-[30px] items-center border-b border-slate-800/50 box-border";
        row.innerHTML = `
            <div class="text-slate-300 truncate" title="${record.name}">${record.name}</div>
            <div class="text-right text-emerald-400 font-mono truncate">${Number(record.waste.toFixed(2)).toLocaleString()}</div>
            <div class="text-right text-slate-600 font-mono truncate">-</div>
            <div class="text-right text-slate-600 font-mono truncate">-</div>
        `;
        return row;
    };

    const pitPlaceholder = document.getElementById('sequence-placeholder');
    if (pitPlaceholder) {
        pitPlaceholder.style.display = window.pitSequenceRecords.length === 0 ? 'flex' : 'none';
    }
    window.renderVirtualList('sequence-scroll-container', 'sequence-tbody', window.pitSequenceRecords, renderPitRow);
    
    const pitElWaste = document.getElementById('sequence-waste-total');
    if (pitElWaste) pitElWaste.textContent = `${Number(window.pitTotalWaste.toFixed(2)).toLocaleString()}`;
    const pitElResource = document.getElementById('sequence-resource-total');
    if (pitElResource) pitElResource.textContent = `${Number(window.pitTotalResource.toFixed(2)).toLocaleString()}`;
    const pitElSr = document.getElementById('sequence-sr-total');
    if (pitElSr) pitElSr.textContent = window.pitTotalResource > 0 ? (window.pitTotalWaste / window.pitTotalResource).toFixed(2) : '-';
    
    const pitScrollContainer = document.getElementById('sequence-scroll-container');
    if (pitScrollContainer && window.pitSequenceRecords.length > 0) { 
        setTimeout(() => { pitScrollContainer.scrollTop = pitScrollContainer.scrollHeight; }, 10); 
    }

    const dispPlaceholder = document.getElementById('disp-sequence-placeholder');
    if (dispPlaceholder) {
        dispPlaceholder.style.display = window.dispSequenceRecords.length === 0 ? 'flex' : 'none';
    }
    window.renderVirtualList('disp-sequence-scroll-container', 'disp-sequence-tbody', window.dispSequenceRecords, renderDispRow);
    
    const dispElWaste = document.getElementById('disp-sequence-waste-total');
    if (dispElWaste) dispElWaste.textContent = `${Number(window.dispTotalWaste.toFixed(2)).toLocaleString()}`;
    const dispElResource = document.getElementById('disp-sequence-resource-total');
    if (dispElResource) dispElResource.textContent = `-`;
    const dispElSr = document.getElementById('disp-sequence-sr-total');
    if (dispElSr) dispElSr.textContent = `-`;
    
    const dispScrollContainer = document.getElementById('disp-sequence-scroll-container');
    if (dispScrollContainer && window.dispSequenceRecords.length > 0) { 
        setTimeout(() => { dispScrollContainer.scrollTop = dispScrollContainer.scrollHeight; }, 10); 
    }

    const btnClearPit = document.getElementById('btn-clear-pit-record');
    if (btnClearPit) btnClearPit.disabled = window.pitSequenceRecords.length === 0;

    const btnClearDisp = document.getElementById('btn-clear-disp-record');
    if (btnClearDisp) btnClearDisp.disabled = window.dispSequenceRecords.length === 0;
}

window.clearPitRecord = function() {
    if (window.pitSequenceRecords.length === 0) return;
    
    window.pitSequenceRecords = [];
    window.pitTotalWaste = 0;
    window.pitTotalResource = 0;
    window.pitSequenceCounter = 1;

    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        pitReserveGroup.children.forEach(mesh => {
            if (!mesh.isMesh) return;
            if ((mesh.userData.type === 'pit' || !mesh.userData.type) && mesh.userData.isRecorded) {
                mesh.userData.isRecorded = false; delete mesh.userData.recordType;

                const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';

                if (!isResource) {
                    mesh.visible = typeof window.isPitWasteVisible !== 'undefined' ? window.isPitWasteVisible : true;
                } else {
                    mesh.visible = typeof window.isPitResourceVisible !== 'undefined' ? window.isPitResourceVisible : true;
                }

                if (!window.selectedMeshes.has(mesh)) {
                    window.applyMaterialState(mesh, 'default');
                }
            }
        });
    }
    
    window.undoStack = window.undoStack.filter(action => action.type !== 'pit');
    window.redoStack = window.redoStack.filter(action => action.type !== 'pit');
    
    window.updateSequenceUI();
};

window.clearDispRecord = function() {
    if (window.dispSequenceRecords.length === 0) return;
    
    window.dispSequenceRecords = [];
    window.dispTotalWaste = 0;
    window.dispSequenceCounter = 1;

    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        pitReserveGroup.children.forEach(mesh => {
            if (!mesh.isMesh) return;
            if ((mesh.userData.type === 'disp' || mesh.userData.type === 'disposal') && mesh.userData.isRecorded) {
                mesh.userData.isRecorded = false; delete mesh.userData.recordType;

                mesh.visible = typeof window.isDispWasteVisible !== 'undefined' ? window.isDispWasteVisible : true;

                if (!window.selectedMeshes.has(mesh)) {
                    window.applyMaterialState(mesh, 'default');
                }
            }
        });
    }

    window.undoStack = window.undoStack.filter(action => action.type !== 'disp');
    window.redoStack = window.redoStack.filter(action => action.type !== 'disp');
    
    window.updateSequenceUI();
};

window.onload = () => {
    if (typeof initLayout === 'function') initLayout();
    if (typeof init3D === 'function') init3D();
    
    window.renderInfoPanel();

    const cbPitRecord = document.getElementById('cb-show-pit-record');
    if (cbPitRecord) cbPitRecord.addEventListener('change', window.updateRecordedVisibility);
    
    const cbDispRecord = document.getElementById('cb-show-disp-record');
    if (cbDispRecord) cbDispRecord.addEventListener('change', window.updateRecordedVisibility);

    const btnClearPit = document.getElementById('btn-clear-pit-record');
    if (btnClearPit) btnClearPit.addEventListener('click', window.clearPitRecord);

    const btnClearDisp = document.getElementById('btn-clear-disp-record');
    if (btnClearDisp) btnClearDisp.addEventListener('click', window.clearDispRecord);
};