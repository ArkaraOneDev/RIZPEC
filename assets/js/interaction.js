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

// OPTIMASI: Variabel pengendali untuk Tablet
window.lastRaycastTime = 0;
window.isCameraMoving = false; 
window.isPointerDown = false; 
window.rawPointerDownPos = { x: 0, y: 0 }; 

// [PERBAIKAN] OPTIMASI MEMORI: Variabel Bantuan Global untuk Loop
const _tempVector3 = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _tempScreenPos = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _tempBox3 = typeof THREE !== 'undefined' ? new THREE.Box3() : null;

// ==========================================
// OPTIMASI VRAM: MATERIAL STATE POOLING
// ==========================================
window.applyMaterialState = function(mesh, stateType) {
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
        clone.emissive.setHex(hex);
        
        if (stateType === 'recorded_pit' || stateType === 'recorded_disp') {
            clone.transparent = false;
            clone.opacity = 1.0; 
        }
        
        window.sharedStateMaterials[key] = clone;
    }
    
    mesh.material = window.sharedStateMaterials[key];
};

// ==========================================
// PENTING: PARSER ID P-COMPOSITE BARU
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
// PENYIAPAN DOM (INFO PANEL)
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
    container.addEventListener('pointerdown', (e) => {
        if (e.target && e.target.tagName !== 'CANVAS') return;

        const mode = window.activeInteractionMode;
        const isBox = mode === 'box_select';
        const isPoly = mode === 'poly_select';
        if ((isBox || isPoly || mode === 'draw_line' || mode === 'draw_area') && typeof controls !== 'undefined') {
            controls.enabled = false;
        }
    }, true); 
}

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Shift') window.isShiftDown = true;

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
            if(selectedDrawing.lineMesh.geometry) selectedDrawing.lineMesh.geometry.dispose();
            if(selectedDrawing.lineMesh.material) selectedDrawing.lineMesh.material.dispose(); 
        }
        if (selectedDrawing.areaMesh) {
            if (typeof drawGroup !== 'undefined') drawGroup.remove(selectedDrawing.areaMesh);
            if(selectedDrawing.areaMesh.geometry) selectedDrawing.areaMesh.geometry.dispose();
            if(selectedDrawing.areaMesh.material) selectedDrawing.areaMesh.material.dispose(); 
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
    } else if (isHover) {
        window.applyMaterialState(mesh, 'hover');
    } else {
        if (mesh.userData.isRecorded) {
            const isDisp = mesh.userData.recordType === 'disp' || mesh.userData.type === 'disp' || mesh.userData.type === 'disposal';
            window.applyMaterialState(mesh, isDisp ? 'recorded_disp' : 'recorded_pit');
        } else {
            window.applyMaterialState(mesh, 'default');
        }
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
    
    const isToolMode = ['box_select', 'poly_select', 'center_pivot', 'draw_line', 'draw_area'].includes(mode);

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

    if (intersects.length > 0) {
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
        window.polygonPoints.push({ x: pos.x, y: pos.y }); 
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
    
    const isToolMode = ['box_select', 'poly_select', 'center_pivot', 'draw_line', 'draw_area'].includes(mode);

    if (isToolMode && container) {
        container.style.cursor = 'crosshair';
    }

    if (window.isPointerDown && !window.isDraggingRect && !window.isDrawingPolygon && mode !== 'draw_line' && mode !== 'draw_area') {
        const dx = Math.abs(event.clientX - window.rawPointerDownPos.x); const dy = Math.abs(event.clientY - window.rawPointerDownPos.y);
        if ((dx > 3 || dy > 3) && !window.isCameraMoving) { window.isCameraMoving = true; window.toggleEdgesLOD(false); }
    }

    const pos = window.getMousePos(event); window.currentMousePos = pos;
    
    if (mode === 'draw_line' || mode === 'draw_area') {
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
                            if (typeof drawPoints3D !== 'undefined' && drawPoints3D.length > 0 && window.updateDrawVisuals) window.updateDrawVisuals(pt);
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

    if (typeof mouse !== 'undefined' && typeof raycaster !== 'undefined' && typeof camera !== 'undefined') {
        mouse.x = pos.nx; mouse.y = pos.ny; raycaster.setFromCamera(mouse, camera);
        
        let validIntersects = [];
        if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup.visible) {
            const rawIntersects = raycaster.intersectObjects(pitReserveGroup.children, false);
            validIntersects = rawIntersects.filter(i => i.object.visible && i.object.isMesh);
        }
        
        let dxfIntersect = null;
        if (validIntersects.length === 0 && typeof appLayers !== 'undefined') {
            const dxfObjects = [];
            appLayers.forEach(l => {
                if (l.type === 'dxf' && l.visible && l.threeObject) {
                    l.threeObject.traverse(c => {
                        if ((c.isMesh || c.isLineSegments) && c.visible) {
                            c.userData.dxfLayerName = l.name;
                            c.userData.dxfType = l.hasFaces ? 'Polymesh' : 'Polyline';
                            dxfObjects.push(c);
                        }
                    });
                }
            });
            const rawDxfIntersects = raycaster.intersectObjects(dxfObjects, false).filter(i => i.object.visible);
            if (rawDxfIntersects.length > 0) {
                dxfIntersect = rawDxfIntersects[0]; 
            }
        }
        
        window.handleHover(validIntersects, dxfIntersect);
    }
}

window.onPointerUp = function(event) {
    if (event.target && event.target.tagName !== 'CANVAS' && !window.isDraggingRect && !window.isDrawingPolygon) return;

    if (window._justCentered) { window._justCentered = false; return; }
    
    if (typeof controls !== 'undefined' && !controls.enabled) {
        if (!window.isDraggingRect && !window.isDrawingPolygon && (typeof isCustomOrbiting === 'undefined' || !isCustomOrbiting)) {
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
    if (mode === 'draw_line' || mode === 'draw_area') return; 

    if (Math.hypot(pos.x - window.dragStartPos.x, pos.y - window.dragStartPos.y) < 5) window.executeClickAction(event, pos);
}

// ==========================================
// TINDAKAN KLIK (SELEKSI & APPEND)
// ==========================================
window.executeCenterPivot = function(pos) {
    if (typeof mouse === 'undefined' || typeof raycaster === 'undefined' || typeof camera === 'undefined' || typeof controls === 'undefined') return;

    mouse.x = pos.nx; mouse.y = pos.ny; raycaster.setFromCamera(mouse, camera);
    const intersectable = [];
    
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
        pitReserveGroup.traverse(c => { 
            if (c.isMesh && c.visible) intersectable.push(c); 
        });
    }
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(l => { 
            if (l.visible && l.threeObject) {
                l.threeObject.traverse(c => { 
                    if (c.isMesh && c.visible) intersectable.push(c); 
                });
            }
        });
    }

    const intersects = raycaster.intersectObjects(intersectable, false).filter(i => i.object.visible);
    
    if (intersects.length > 0) { 
        const newTarget = intersects[0].point;
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
    if (typeof mouse === 'undefined' || typeof raycaster === 'undefined' || typeof camera === 'undefined') return;

    mouse.x = pos.nx; mouse.y = pos.ny; raycaster.setFromCamera(mouse, camera);
    
    const isAppend = event.shiftKey || window.isShiftDown;
    const isBlockMode = mode === 'select_block' || mode === 'record_block';
    const isRecordMode = mode === 'record_bench' || mode === 'record_block';

    let intersects = [];
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
        intersects = raycaster.intersectObjects(pitReserveGroup.children, false).filter(i => i.object.visible && i.object.isMesh);
    }

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
            if (!m.isMesh || !m.visible) return;
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
// PEMILIHAN KAWASAN & POLIGON (MEMPERTIMBANGKAN OCCLUSION/TERLIHAT MATA)
// ==========================================
window.updatePolygonSVG = function(currentPos = null) {
    if (window.polygonPoints.length === 0 || !polygonShape || !polygonLine) return;
    
    let pointsForShape = [...window.polygonPoints];
    if (currentPos) {
        pointsForShape.push({ x: currentPos.x, y: currentPos.y });
    }
    
    polygonShape.setAttribute('points', pointsForShape.map(p => `${p.x},${p.y}`).join(' '));
    
    if (currentPos) {
        polygonLine.setAttribute('points', `${window.polygonPoints[window.polygonPoints.length-1].x},${window.polygonPoints[window.polygonPoints.length-1].y} ${currentPos.x},${currentPos.y}`);
    } else {
        polygonLine.setAttribute('points', '');
    }
}

window.finishPolygonSelection = function() {
    window.isDrawingPolygon = false; 
    if(typeof controls !== 'undefined') controls.enabled = true; 
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
    
    const localRaycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
    if(!localRaycaster) return;

    pitReserveGroup.children.forEach(mesh => {
        if (!mesh.visible || !mesh.isMesh) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        
        if(_tempVector3 && _tempScreenPos) {
            mesh.geometry.boundingBox.getCenter(_tempVector3);
            mesh.updateMatrixWorld(true);
            _tempVector3.applyMatrix4(mesh.matrixWorld); // Pastikan pusat bounding box ada di world space
            
            const worldCenter = _tempVector3.clone(); // Simpan untuk kalkulasi jarak 3D
            
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
                // [PERBAIKAN] Presisi raykey dinaikkan agar tidak mengabaikan block kecil yang berdekatan
                const rayKey = `${nx.toFixed(4)},${ny.toFixed(4)}`; 
                
                if (!checkedRays.has(rayKey)) {
                    checkedRays.add(rayKey);
                    
                    localRaycaster.setFromCamera({x: nx, y: ny}, camera);
                    const intersects = localRaycaster.intersectObjects(pitReserveGroup.children, false);
                    const validHits = intersects.filter(i => i.object.visible && i.object.isMesh);
                    
                    if (validHits.length > 0) {
                        const topHit = validHits[0].object;
                        const parsed = window.parseCompositeId(topHit.userData);
                        targetBases.add(parsed.base);
                        targetTypes.add(topHit.userData.type || 'pit');

                        // [PERBAIKAN] Cek jarak Z-Depth. Jika bounding box meleset saat diraycast, 
                        // tapi mesh ini sebenarnya ada di depan/sekitar area yang sama, tetap tambahkan!
                        const distToMeshCenter = camera.position.distanceTo(worldCenter);
                        const distToHit = validHits[0].distance;
                        
                        // Margin toleransi 2.5 unit jika ray tembus melewati block kecil (misal stupa)
                        if (distToMeshCenter <= distToHit + 2.5) { 
                            const parsedMesh = window.parseCompositeId(mesh.userData);
                            targetBases.add(parsedMesh.base);
                            targetTypes.add(mesh.userData.type || 'pit');
                        }
                    } else {
                        // Jika meleset total (kosong), berarti celah terbuka dan tetap terlihat
                        const parsedMesh = window.parseCompositeId(mesh.userData);
                        targetBases.add(parsedMesh.base);
                        targetTypes.add(mesh.userData.type || 'pit');
                    }
                } else {
                    // [PERBAIKAN] RayKey ini pernah ditelusuri.
                    // Block kecil menumpuk di pixel layar yang sama. Langsung tambahkan ke seleksi.
                    const parsedMesh = window.parseCompositeId(mesh.userData);
                    targetBases.add(parsedMesh.base);
                    targetTypes.add(mesh.userData.type || 'pit');
                }
            }
        }
    });

    if (targetBases.size > 0) {
        pitReserveGroup.children.forEach(mesh => {
            if (!mesh.visible || !mesh.isMesh) return;
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
// RENDER PANEL INFORMASI (STATIS & RAPI)
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
// PENGATURAN TOGGLE AUTO-RECORD BARU
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
// URUTAN & RAKAMAN REKOD (BENCH AND ABOVE LOGIC)
// ==========================================
window.recordSelectedMeshes = function() {
    if (window.selectedMeshes.size === 0) return;
    
    window.redoStack = []; 
    let expandedMeshes = new Set();
    
    let isDispAction = false;
    window.selectedMeshes.forEach(target => {
        if(target.userData.type === 'disp' || target.userData.type === 'disposal') isDispAction = true;
    });

    window.selectedMeshes.forEach(target => {
        const targetType = target.userData.type || 'pit';
        const targetParsed = window.parseCompositeId(target.userData);
        
        // [PERBAIKAN] Disposal Data mengabaikan 'Bench Dependency'
        // Hanya Pit Data yang akan mengekspansi seleksi ke bench di atasnya
        if (!isDispAction) {
            if (!target.geometry.boundingBox) target.geometry.computeBoundingBox();
            
            let targetCenterY = 0;
            if(_tempVector3) {
                target.updateMatrixWorld(true);
                targetCenterY = target.geometry.boundingBox.getCenter(_tempVector3).applyMatrix4(target.matrixWorld).y;
            }

            if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
                pitReserveGroup.children.forEach(m => {
                    if (!m.isMesh || !m.visible) return;
                    if ((m.userData.type || 'pit') !== targetType) return;
                    
                    const mParsed = window.parseCompositeId(m.userData);
                    if (mParsed.base !== targetParsed.base) return; 

                    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
                    
                    let mCenterY = 0;
                    if(_tempVector3) {
                        m.updateMatrixWorld(true);
                        mCenterY = m.geometry.boundingBox.getCenter(_tempVector3).applyMatrix4(m.matrixWorld).y;
                    }
                    
                    // Pit Data: Elevasi Atas (Unburden) harus terekam jika elevasi Bawah dipilih
                    if (mCenterY >= targetCenterY - 0.5 || mParsed.bench === targetParsed.bench) {
                        expandedMeshes.add(m);
                    }
                });
            }
        }
    });

    window.selectedMeshes.forEach(m => expandedMeshes.add(m));

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
        seqName = recArr[0];
    } else {
        const baseGroups = new Set();
        recArr.forEach(r => { const p = r.split('/'); baseGroups.add(`${p[0]}/${p[1]}/${p[2]}`); });
        if (baseGroups.size === 1) seqName = `${Array.from(baseGroups)[0]} (Multi-Bench)`;
        else {
            let counter = isDispAction ? window.dispSequenceCounter++ : window.pitSequenceCounter++;
            seqName = `Selection #${counter} (${recArr.length} Target)`;
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
    
    if (lastAction.type === 'disp') {
        window.dispSequenceRecords.pop(); 
        window.dispTotalWaste -= lastAction.waste;
        if (lastAction.name.startsWith('Selection #')) window.dispSequenceCounter = Math.max(1, window.dispSequenceCounter - 1);
    } else {
        window.pitSequenceRecords.pop(); 
        window.pitTotalWaste -= lastAction.waste; 
        window.pitTotalResource -= lastAction.resource;
        if (lastAction.name.startsWith('Selection #')) window.pitSequenceCounter = Math.max(1, window.pitSequenceCounter - 1);
    }
    
    lastAction.meshes.forEach(m => {
        m.userData.isRecorded = false; delete m.userData.recordType;
        window.applyMaterialState(m, 'default');
        
        const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
        const isPit = m.userData.type === 'pit' || !m.userData.type; // default pit
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
    
    if (actionToRedo.type === 'disp') {
        if (actionToRedo.name.startsWith('Selection #')) window.dispSequenceCounter++;
        window.dispSequenceRecords.push({ name: actionToRedo.name, waste: actionToRedo.waste });
        window.dispTotalWaste += actionToRedo.waste;
    } else {
        if (actionToRedo.name.startsWith('Selection #')) window.dispSequenceCounter++;
        window.pitSequenceRecords.push({ name: actionToRedo.name, waste: actionToRedo.waste, resource: actionToRedo.resource });
        window.pitTotalWaste += actionToRedo.waste; 
        window.pitTotalResource += actionToRedo.resource;
    }
    
    window.updateSequenceUI();
    window.updateRecordedVisibility();
}

window.resetSequenceAndView = function() {
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        pitReserveGroup.children.forEach(mesh => {
            if(!mesh.isMesh) return;
            mesh.userData.isRecorded = false; delete mesh.userData.recordType;
            
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            const isPit = mesh.userData.type === 'pit' || !mesh.userData.type; // default pit
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
    
    if (typeof drawGroup !== 'undefined' && drawGroup) {
        drawGroup.children.forEach(c => { 
            if (c.geometry) c.geometry.dispose(); 
            if (c.material) {
                if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
                else c.material.dispose();
            }
        }); 
        drawGroup.clear();
    }
    if (typeof finishedDrawings !== 'undefined') finishedDrawings = [];
    if (typeof selectedDrawing !== 'undefined') selectedDrawing = null;

    const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
    if (defaultBtn) {
        defaultBtn.click();
    }
    if(container) container.style.cursor = 'default';
}

window.updateSequenceUI = function() {
    const pitTbody = document.getElementById('sequence-tbody'); 
    const pitPlaceholder = document.getElementById('sequence-placeholder');
    if (pitTbody && pitPlaceholder) {
        pitTbody.innerHTML = '';
        if (window.pitSequenceRecords.length === 0) { pitPlaceholder.style.display = 'flex'; } 
        else {
            pitPlaceholder.style.display = 'none';
            window.pitSequenceRecords.forEach(record => {
                let sr = record.resource > 0 ? (record.waste / record.resource).toFixed(2) : '-';
                const row = document.createElement('div');
                row.className = "grid grid-cols-[minmax(0,1fr)_55px_55px_35px] lg:grid-cols-[minmax(0,1fr)_65px_65px_35px] gap-2 py-1.5 px-2 text-[10px] lg:text-[9px] hover:bg-slate-800/50 transition-colors";
                row.innerHTML = `
                    <div class="text-slate-300 truncate" title="${record.name}">${record.name}</div>
                    <div class="text-right text-blue-400 font-mono truncate">${Number(record.waste.toFixed(2)).toLocaleString()}</div>
                    <div class="text-right text-orange-400 font-mono truncate">${Number(record.resource.toFixed(2)).toLocaleString()}</div>
                    <div class="text-right text-green-400 font-mono truncate">${sr}</div>
                `;
                pitTbody.appendChild(row);
            });
        }
        
        const pitElWaste = document.getElementById('sequence-waste-total');
        if (pitElWaste) pitElWaste.textContent = `${Number(window.pitTotalWaste.toFixed(2)).toLocaleString()}`;
        const pitElResource = document.getElementById('sequence-resource-total');
        if (pitElResource) pitElResource.textContent = `${Number(window.pitTotalResource.toFixed(2)).toLocaleString()}`;
        const pitElSr = document.getElementById('sequence-sr-total');
        if (pitElSr) pitElSr.textContent = window.pitTotalResource > 0 ? (window.pitTotalWaste / window.pitTotalResource).toFixed(2) : '-';
        
        const pitScrollContainer = document.getElementById('sequence-scroll-container');
        if (pitScrollContainer && window.pitSequenceRecords.length > 0) { setTimeout(() => { pitScrollContainer.scrollTop = pitScrollContainer.scrollHeight; }, 10); }
    }

    const dispTbody = document.getElementById('disp-sequence-tbody'); 
    const dispPlaceholder = document.getElementById('disp-sequence-placeholder');
    if (dispTbody && dispPlaceholder) {
        dispTbody.innerHTML = '';
        if (window.dispSequenceRecords.length === 0) { dispPlaceholder.style.display = 'flex'; } 
        else {
            dispPlaceholder.style.display = 'none';
            window.dispSequenceRecords.forEach(record => {
                const row = document.createElement('div');
                row.className = "grid grid-cols-[minmax(0,1fr)_55px_55px_35px] lg:grid-cols-[minmax(0,1fr)_65px_65px_35px] gap-2 py-1.5 px-2 text-[10px] lg:text-[9px] hover:bg-slate-800/50 transition-colors";
                row.innerHTML = `
                    <div class="text-slate-300 truncate" title="${record.name}">${record.name}</div>
                    <div class="text-right text-emerald-400 font-mono truncate">${Number(record.waste.toFixed(2)).toLocaleString()}</div>
                    <div class="text-right text-slate-600 font-mono truncate">-</div>
                    <div class="text-right text-slate-600 font-mono truncate">-</div>
                `;
                dispTbody.appendChild(row);
            });
        }
        
        const dispElWaste = document.getElementById('disp-sequence-waste-total');
        if (dispElWaste) dispElWaste.textContent = `${Number(window.dispTotalWaste.toFixed(2)).toLocaleString()}`;
        const dispElResource = document.getElementById('disp-sequence-resource-total');
        if (dispElResource) dispElResource.textContent = `-`;
        const dispElSr = document.getElementById('disp-sequence-sr-total');
        if (dispElSr) dispElSr.textContent = `-`;
        
        const dispScrollContainer = document.getElementById('disp-sequence-scroll-container');
        if (dispScrollContainer && window.dispSequenceRecords.length > 0) { setTimeout(() => { dispScrollContainer.scrollTop = dispScrollContainer.scrollHeight; }, 10); }
    }

    // Update state ketersediaan tombol Bin (Hapus)
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

                // Kembalikan warna asli hanya jika sedang tidak dalam mode diseleksi
                if (!window.selectedMeshes.has(mesh)) {
                    window.applyMaterialState(mesh, 'default');
                }
            }
        });
    }
    
    // Bersihkan history undo/redo yang berkaitan dengan pit
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

                // Kembalikan warna asli hanya jika sedang tidak dalam mode diseleksi
                if (!window.selectedMeshes.has(mesh)) {
                    window.applyMaterialState(mesh, 'default');
                }
            }
        });
    }

    // Bersihkan history undo/redo yang berkaitan dengan disp
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