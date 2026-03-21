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

window.sequenceRecords = [];
window.sequenceTotalOB = 0;
window.sequenceTotalCoal = 0;
window.sequenceCounter = 1;
window.undoStack = [];
window.redoStack = []; 
window.MAX_UNDO_STEPS = 10;
window.currentMousePos = { x: 0, y: 0, nx: 0, ny: 0 };

// OPTIMASI: Waktu terakhir raycaster dieksekusi (Throttle)
window.lastRaycastTime = 0;

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

const infoEmpty = document.getElementById('info-empty');
if (infoEmpty) infoEmpty.classList.add('hidden'); 

const infoPanel = document.getElementById('info-panel');

// ==========================================
// PENGENDALI ACARA UMUM (KEYBOARD & MOUSE)
// ==========================================

window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') {
            if(window.finishDrawing) window.finishDrawing();
        } else if (window.isDrawingPolygon) {
            window.finishPolygonSelection();
        }
    }
    if (e.key === 'Escape') {
        if (window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') {
            if(window.cancelActiveDrawing) window.cancelActiveDrawing();
        } else {
            window.cancelPolygon();
        }
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && typeof selectedDrawing !== 'undefined' && selectedDrawing) {
        if (selectedDrawing.lineMesh) {
            drawGroup.remove(selectedDrawing.lineMesh);
            if(selectedDrawing.lineMesh.geometry) selectedDrawing.lineMesh.geometry.dispose();
        }
        if (selectedDrawing.areaMesh) {
            drawGroup.remove(selectedDrawing.areaMesh);
            if(selectedDrawing.areaMesh.geometry) selectedDrawing.areaMesh.geometry.dispose();
        }
        finishedDrawings = finishedDrawings.filter(d => d !== selectedDrawing);
        selectedDrawing = null;
    }
});

container.addEventListener('contextmenu', (e) => { 
    if(window.activeInteractionMode === 'draw_line' || window.activeInteractionMode === 'draw_area') { 
        e.preventDefault(); 
        if(window.finishDrawing) window.finishDrawing(); 
    } 
});

// ==========================================
// LOGIK PEMILIHAN ASAS (POINTER)
// ==========================================

window.getMousePos = function(event) {
    const rect = container.getBoundingClientRect();
    return { 
        x: event.clientX - rect.left, 
        y: event.clientY - rect.top, 
        nx: ((event.clientX - rect.left) / rect.width) * 2 - 1, 
        ny: -((event.clientY - rect.top) / rect.height) * 2 + 1 
    };
}

window.clearSelection = function() { 
    window.selectedMeshes.forEach(mesh => { 
        if(mesh.material) mesh.material.emissive.setHex(0x000000); 
    }); 
    window.selectedMeshes.clear(); 
    window.displaySelectionInfo(); 
}

window.highlightMesh = function(mesh, isHover) { 
    if (!mesh || !mesh.visible) return; 
    
    if (window.selectedMeshes.has(mesh)) {
        mesh.material.emissive.setHex(typeof COLOR_SELECTED !== 'undefined' ? COLOR_SELECTED : 0xffaa00); 
    } else {
        mesh.material.emissive.setHex(0x000000); 
    }
}

window.updateSelectionVisuals = function() { 
    Object.values(meshes).forEach(mesh => { 
        if (window.selectedMeshes.has(mesh)) mesh.material.emissive.setHex(typeof COLOR_SELECTED !== 'undefined' ? COLOR_SELECTED : 0xffaa00); 
        else mesh.material.emissive.setHex(0x000000); 
    }); 
}

window.handleHover = function(intersects, isShiftKey) {
    if (window.isDraggingRect || window.isDrawingPolygon || (typeof isProcessing !== 'undefined' && isProcessing)) return;
    
    const mode = window.activeInteractionMode;
    const isShift = isShiftKey || mode === 'select_block' || mode === 'record_block';

    if (intersects.length > 0) {
        container.style.cursor = 'pointer'; 
        const object = intersects[0].object;
        const currentHoverKey = isShift ? `BLOCK_${object.userData.blockName}` : `BENCH_${object.userData.blockName}_${object.userData.bench}`;
        
        if (window.hoveredGroupKey !== currentHoverKey) {
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes = []; 
            window.hoveredGroupKey = currentHoverKey;
            
            let uniqueBenches = new Set();
            let uniqueGeoms = new Set();
            let totalOB = 0;
            let totalCoal = 0;
            let uniqueSeams = new Set();

            Object.values(meshes).forEach(m => {
                if (!m.visible || !pitReserveGroup.visible) return;
                
                let isMatch = false;
                if (isShift) { 
                    isMatch = m.userData.blockName === object.userData.blockName;
                } else { 
                    isMatch = m.userData.blockName === object.userData.blockName && m.userData.bench === object.userData.bench;
                }
                
                if (isMatch) {
                    window.highlightMesh(m, true); 
                    window.hoveredMeshes.push(m); 
                    uniqueBenches.add(m.userData.bench);
                    uniqueGeoms.add(m.userData.geometryType || 'Pit');
                    totalOB += m.userData.obVolume || 0;
                    totalCoal += m.userData.coalMass || 0;
                    if (m.userData.seam && m.userData.seam !== '-' && m.userData.seam.trim() !== '') uniqueSeams.add(m.userData.seam);
                }
            });
            
            const formatBench = (b) => b;
            const benchArr = Array.from(uniqueBenches).map(formatBench).sort();
            const benchStr = benchArr.length > 2 ? `${benchArr[0]} ... ${benchArr[benchArr.length-1]}` : benchArr.join(', ');
            const seamStr = Array.from(uniqueSeams).join(', ') || '-';
            
            window.currentHoveredData = {
                blockname: isShift ? object.userData.blockName : `${object.userData.blockName} (Bench: ${object.userData.bench})`,
                geom: Array.from(uniqueGeoms).join(', '),
                bench: benchStr,
                part: uniqueBenches.size.toString(), 
                seam: seamStr,
                ob: totalOB,
                coal: totalCoal
            };
            
            const tooltipText = document.getElementById('tooltip-text');
            const tooltip = document.getElementById('hover-tooltip');
            if (tooltipText) tooltipText.textContent = ''; 
            if (tooltip) tooltip.classList.add('hidden');
            
            window.renderInfoPanel();
        }
    } else {
        container.style.cursor = 'default';
        if (window.hoveredGroupKey) { 
            window.hoveredMeshes.forEach(m => window.highlightMesh(m, false)); 
            window.hoveredMeshes = []; 
            window.hoveredGroupKey = null; 
            
            window.currentHoveredData = null;
            const tooltip = document.getElementById('hover-tooltip');
            if (tooltip) tooltip.classList.add('hidden'); 
            
            window.renderInfoPanel();
        }
    }
}

window.onPointerDown = function(event) {
    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing)) return; 
    const pos = window.getMousePos(event);
    const mode = window.activeInteractionMode;
    
    if (mode === 'draw_line' || mode === 'draw_area') {
        if (event.button === 2) { window.finishDrawing(); return; } 
        if (event.button !== 0) return; 
        const pt = window.getRaycastPoint(pos);
        if (pt) {
            drawPoints3D.push(pt);
            window.updateDrawVisuals(pt);
        }
        window.dragStartPos = { x: pos.x, y: pos.y }; 
        return;
    }

    if (event.button !== 0) return; 
    
    const isBox = mode === 'box_select' || (event.shiftKey && !event.altKey && !event.ctrlKey);
    const isPoly = mode === 'poly_select' || (event.altKey && !event.shiftKey && !event.ctrlKey);
    const isCenter = mode === 'center_pivot';

    if (isCenter) {
        window.executeCenterPivot(pos);
        window._justCentered = true;
        return;
    }

    if (isBox) {
        window.isDraggingRect = true; 
        window.dragStartPos = { x: pos.x, y: pos.y }; 
        controls.enabled = false; 
        selectionRect.style.left = pos.x + 'px'; selectionRect.style.top = pos.y + 'px'; 
        selectionRect.style.width = '0px'; selectionRect.style.height = '0px'; 
        selectionRect.style.display = 'block';
    } else if (isPoly) {
        window.isDrawingPolygon = true; 
        controls.enabled = false; 
        window.polygonPoints.push({ x: pos.x, y: pos.y }); 
        window.updatePolygonSVG();
        if (window.polygonPoints.length > 2) {
            const p1 = window.polygonPoints[window.polygonPoints.length-1]; 
            const p2 = window.polygonPoints[window.polygonPoints.length-2];
            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 5) { 
                window.polygonPoints.pop(); 
                window.finishPolygonSelection(); 
            }
        }
    } else { 
        window.dragStartPos = { x: pos.x, y: pos.y }; 
    }
}

var isDrawVisualUpdatePending = false;
var lastDrawPos = null;

window.onPointerMove = function(event) {
    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing)) return; 
    const pos = window.getMousePos(event);
    window.currentMousePos = pos;
    
    const mode = window.activeInteractionMode;

    if (mode === 'draw_line' || mode === 'draw_area') {
        lastDrawPos = pos;
        if (!isDrawVisualUpdatePending) {
            isDrawVisualUpdatePending = true;
            requestAnimationFrame(() => {
                if (lastDrawPos) {
                    if(window.initDrawHotspot) window.initDrawHotspot(); 
                    const pt = window.getRaycastPoint(lastDrawPos);
                    if (pt) {
                        drawHotspot.position.copy(pt);
                        drawHotspot.visible = true;
                        if (drawPoints3D.length > 0) window.updateDrawVisuals(pt);
                    } else {
                        if (drawHotspot) drawHotspot.visible = false;
                    }
                }
                isDrawVisualUpdatePending = false;
            });
        }
        return; 
    } else {
        if (typeof drawHotspot !== 'undefined' && drawHotspot) drawHotspot.visible = false; 
    }

    if (window.isDraggingRect) {
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
    
    if (mode === 'center_pivot') {
        container.style.cursor = 'crosshair';
        return;
    }

    // OPTIMASI THROTTLING: Hanya jalankan raycast kompleks setiap 80ms untuk sentuhan Tablet
    const currentTime = Date.now();
    if (currentTime - window.lastRaycastTime < 80) return;
    window.lastRaycastTime = currentTime;

    mouse.x = pos.nx; mouse.y = pos.ny; raycaster.setFromCamera(mouse, camera);
    const meshArray = Object.values(meshes).filter(m => m.visible && pitReserveGroup.visible);
    
    const isShift = event.shiftKey || mode === 'select_block' || mode === 'record_block';
    window.handleHover(raycaster.intersectObjects(meshArray), isShift);
}

window.onPointerUp = function(event) {
    if (window._justCentered) {
        window._justCentered = false;
        return;
    }

    if (!window.is3DRenderingActive || (typeof isProcessing !== 'undefined' && isProcessing) || event.button !== 0) return; 
    const pos = window.getMousePos(event);
    const mode = window.activeInteractionMode;

    if (window.isDraggingRect) {
        window.isDraggingRect = false; 
        controls.enabled = true; 
        selectionRect.style.display = 'none';
        const w = Math.abs(pos.x - window.dragStartPos.x); 
        const h = Math.abs(pos.y - window.dragStartPos.y);
        if (w > 5 || h > 5) { 
            window.processAreaSelection({ 
                minX: Math.min(pos.x, window.dragStartPos.x), 
                maxX: Math.max(pos.x, window.dragStartPos.x), 
                minY: Math.min(pos.y, window.dragStartPos.y), 
                maxY: Math.max(pos.y, window.dragStartPos.y) 
            }, null); 
            return; 
        }
    }
    
    if (window.isDrawingPolygon) return;
    if (mode === 'draw_line' || mode === 'draw_area') return; 

    if (Math.hypot(pos.x - window.dragStartPos.x, pos.y - window.dragStartPos.y) < 5) {
        window.executeClickAction(event, pos);
    }
}

// ==========================================
// PUSAT PENGISAR & TINDAKAN KLIK
// ==========================================

window.executeCenterPivot = function(pos) {
    mouse.x = pos.nx; mouse.y = pos.ny; 
    raycaster.setFromCamera(mouse, camera);
    
    const intersectable = [];
    if (pitReserveGroup && pitReserveGroup.visible) {
        pitReserveGroup.traverse(c => { if (c.isMesh) intersectable.push(c); });
    }
    appLayers.forEach(l => {
        if (l.visible && l.threeObject) {
            l.threeObject.traverse(c => { if (c.isMesh) intersectable.push(c); });
        }
    });

    const intersects = raycaster.intersectObjects(intersectable, false);
    if (intersects.length > 0) {
        controls.target.copy(intersects[0].point);
        controls.update();
    }

    if (window.activeInteractionMode === 'center_pivot') {
        const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
        if (defaultBtn) defaultBtn.click();
        container.style.cursor = 'default';
    }
}

window.executeClickAction = function(event, pos) {
    const mode = window.activeInteractionMode;
    mouse.x = pos.nx; mouse.y = pos.ny; 
    raycaster.setFromCamera(mouse, camera);
    
    if (typeof drawGroup !== 'undefined' && drawGroup && (mode === 'select_bench' || mode === 'select_block')) {
        raycaster.params.Line.threshold = 2.0; 
        const drawIntersects = raycaster.intersectObjects(drawGroup.children, false);
        raycaster.params.Line.threshold = 1;

        if (drawIntersects.length > 0) {
            const hitObj = drawIntersects[0].object;
            if (hitObj.userData && hitObj.userData.drawRef) {
                if(window.clearDrawingSelection) window.clearDrawingSelection();
                selectedDrawing = hitObj.userData.drawRef;
                
                if (selectedDrawing.type === 'draw_line' && selectedDrawing.lineMesh) {
                    selectedDrawing.lineMesh.material = drawLineSelectedMat;
                } else if (selectedDrawing.type === 'draw_area') {
                    if (selectedDrawing.lineMesh) selectedDrawing.lineMesh.material = drawAreaLineSelectedMat;
                    if (selectedDrawing.areaMesh) selectedDrawing.areaMesh.material = drawAreaMeshSelectedMat;
                }
                return; 
            }
        } else {
            if(window.clearDrawingSelection) window.clearDrawingSelection(); 
        }
    }

    const isCtrl = event.ctrlKey || mode === 'record_bench' || mode === 'record_block';
    const isShift = event.shiftKey || mode === 'select_block' || mode === 'record_block';

    const meshArray = Object.values(meshes).filter(m => m.visible && pitReserveGroup.visible);
    const intersects = raycaster.intersectObjects(meshArray);

    if (isCtrl) {
        if (window.selectedMeshes.size > 0) window.recordSelectedMeshes();
        else if (intersects.length > 0) {
            const target = intersects[0].object; 
            let groupMeshes = [];
            if (isShift) groupMeshes = Object.values(meshes).filter(m => m.userData.blockName === target.userData.blockName && m.visible);
            else groupMeshes = Object.values(meshes).filter(m => m.userData.blockName === target.userData.blockName && m.userData.bench === target.userData.bench && m.visible);
            
            groupMeshes.forEach(m => window.selectedMeshes.add(m)); 
            window.recordSelectedMeshes();
        } 
        return;
    }

    if (intersects.length === 0) { window.clearSelection(); return; }
    
    const target = intersects[0].object; 
    const targetBlockName = target.userData.blockName; 
    const targetBench = target.userData.bench;
    window.clearSelection();

    if (isShift) {
        Object.values(meshes).forEach(m => { if (m.userData.blockName === targetBlockName && m.visible) window.selectedMeshes.add(m); });
    } else {
        Object.values(meshes).forEach(m => { if (m.userData.blockName === targetBlockName && m.userData.bench === targetBench && m.visible) window.selectedMeshes.add(m); });
    }

    window.updateSelectionVisuals(); 
    window.hoveredMeshes.forEach(m => window.highlightMesh(m, true)); 
    window.displaySelectionInfo();
}

// ==========================================
// PEMILIHAN KAWASAN & POLIGON
// ==========================================

window.updatePolygonSVG = function(currentPos = null) {
    if (window.polygonPoints.length === 0) return;
    polygonShape.setAttribute('points', window.polygonPoints.map(p => `${p.x},${p.y}`).join(' '));
    if (currentPos) polygonLine.setAttribute('points', `${window.polygonPoints[window.polygonPoints.length-1].x},${window.polygonPoints[window.polygonPoints.length-1].y} ${currentPos.x},${currentPos.y}`);
    else polygonLine.setAttribute('points', '');
}

window.finishPolygonSelection = function() {
    window.isDrawingPolygon = false; 
    controls.enabled = true; 
    polygonLine.setAttribute('points', '');
    if (window.polygonPoints.length > 2) window.processAreaSelection(null, window.polygonPoints);
    setTimeout(() => { polygonShape.setAttribute('points', ''); window.polygonPoints = []; }, 300);
}

window.cancelPolygon = function() { 
    window.isDrawingPolygon = false; 
    controls.enabled = true; 
    window.polygonPoints = []; 
    polygonShape.setAttribute('points', ''); 
    polygonLine.setAttribute('points', ''); 
}

window.processAreaSelection = function(rectBounds, polyPoints) {
    window.clearSelection(); 
    scene.updateMatrixWorld(true);
    
    Object.values(meshes).forEach(mesh => {
        if (!mesh.visible || !pitReserveGroup.visible) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        
        const center = new THREE.Vector3(); 
        mesh.geometry.boundingBox.getCenter(center);
        const screenPos = center.clone().project(camera);
        if (screenPos.z > 1) return;
        
        const sx = (screenPos.x * 0.5 + 0.5) * container.clientWidth; 
        const sy = (screenPos.y * -0.5 + 0.5) * container.clientHeight;
        let isInside = false;
        
        if (rectBounds) { 
            if (sx >= rectBounds.minX && sx <= rectBounds.maxX && sy >= rectBounds.minY && sy <= rectBounds.maxY) isInside = true; 
        } else if (polyPoints) { 
            isInside = window.pointInPolygon({x: sx, y: sy}, polyPoints); 
        }
        
        if (isInside) {
            const gKey = `${mesh.userData.blockName}_${mesh.userData.bench}`;
            Object.values(meshes).forEach(m => { 
                if (`${m.userData.blockName}_${m.userData.bench}` === gKey && m.visible) window.selectedMeshes.add(m); 
            });
        }
    });
    window.updateSelectionVisuals(); 
    window.displaySelectionInfo();
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
// RENDER PANEL INFORMASI (HOVER & SELECTION)
// ==========================================

window.renderInfoPanel = function() {
    const infoPanel = document.getElementById('info-panel');
    if (!infoPanel) return;

    infoPanel.classList.remove('hidden');
    infoPanel.classList.add('flex');

    let html = '<div class="flex flex-col gap-1.5 text-[10px] w-full px-1 pb-1 pt-1 overflow-y-auto">';

    const createRow = (label, value, valueClass = "text-emerald-400") => `
        <div class="flex items-start w-full">
            <span class="text-slate-400 font-medium w-[65px] shrink-0">${label}</span>
            <span class="text-slate-500 mx-1 shrink-0">:</span>
            <span class="font-semibold ${valueClass} flex-1 text-right truncate" title="${value}">${value}</span>
        </div>
    `;

    let geomData = ""; let blockNameData = ""; let benchData = "";
    let partData = ""; let seamData = "-"; let obData = 0;
    let coalData = 0; let srData = "-";

    const formatBench = (b) => b;

    if (window.currentHoveredData) {
        geomData = window.currentHoveredData.geom; blockNameData = window.currentHoveredData.blockname; benchData = window.currentHoveredData.bench;
        partData = window.currentHoveredData.part; seamData = window.currentHoveredData.seam; obData = window.currentHoveredData.ob;
        coalData = window.currentHoveredData.coal; srData = coalData > 0 ? (obData / coalData).toFixed(2) : '-';
    } 
    else if (window.selectedMeshes.size > 0) {
        let uniqueBenches = new Set(); let uniqueGeoms = new Set(); let uniqueBlocks = new Set(); let uniqueSeams = new Set();

        window.selectedMeshes.forEach(m => {
            uniqueBenches.add(m.userData.bench); uniqueGeoms.add(m.userData.geometryType || 'Pit'); uniqueBlocks.add(m.userData.blockName);
            obData += m.userData.obVolume || 0; coalData += m.userData.coalMass || 0;
            if (m.userData.seam && m.userData.seam !== '-' && m.userData.seam.trim() !== '') uniqueSeams.add(m.userData.seam);
        });

        const blockArr = Array.from(uniqueBlocks);
        blockNameData = blockArr.length === 1 ? blockArr[0] : `MULTIPLE (${blockArr.length})`;
        const benchArr = Array.from(uniqueBenches).map(formatBench).sort();
        benchData = benchArr.length > 2 ? `${benchArr[0]} ... ${benchArr[benchArr.length-1]}` : benchArr.join(', ');
        
        geomData = Array.from(uniqueGeoms).join(', '); partData = uniqueBenches.size.toString();
        seamData = Array.from(uniqueSeams).join(', ') || '-'; srData = coalData > 0 ? (obData / coalData).toFixed(2) : '-';
    }

    if (blockNameData) {
        html += createRow('Geometry', geomData); html += createRow('Blockname', blockNameData); html += createRow('Bench', benchData);
        html += createRow('Part', partData); html += createRow('Seam', seamData, 'text-white');
        html += createRow('OB (bcm)', Number(obData.toFixed(2)).toLocaleString(), 'text-blue-400 font-mono');
        html += createRow('Coal (t)', Number(coalData.toFixed(2)).toLocaleString(), 'text-orange-400 font-mono');
        html += createRow('Strip Ratio', srData, 'text-green-400 font-mono');
    }

    html += '</div>';

    if (!blockNameData && window.selectedMeshes.size === 0) infoPanel.innerHTML = '';
    else infoPanel.innerHTML = html;
}

window.displaySelectionInfo = function() { window.renderInfoPanel(); }

// ==========================================
// URUTAN & RAKAMAN REKOD (SEQUENCE LOGIC)
// ==========================================

window.recordSelectedMeshes = function() {
    if (window.selectedMeshes.size === 0) return;
    
    window.redoStack = []; 
    let combinedOB = 0, combinedCoal = 0; 
    let uniqueBlocks = new Set(), recordedMeshesInStep = [];
    
    window.selectedMeshes.forEach(m => {
        combinedOB += m.userData.obVolume || 0; combinedCoal += m.userData.coalMass || 0; 
        uniqueBlocks.add(m.userData.blockName);
        m.userData.isRecorded = true; m.visible = false; 
        m.material.emissive.setHex(0x000000); 
        recordedMeshesInStep.push(m);
    });
    
    const blockArr = Array.from(uniqueBlocks); let seqName = "";
    if (blockArr.length === 1) {
        let benches = new Set(); window.selectedMeshes.forEach(m => benches.add(m.userData.bench));
        const bArr = Array.from(benches); seqName = bArr.length > 1 ? `${blockArr[0]} (Multi-Bench)` : `${blockArr[0]}-${bArr[0]}`;
    } else seqName = `Selection #${window.sequenceCounter++} (${blockArr.length} Blk)`;
    
    window.sequenceRecords.push({ name: seqName, ob: combinedOB, coal: combinedCoal });
    window.sequenceTotalOB += combinedOB; window.sequenceTotalCoal += combinedCoal;
    
    window.undoStack.push({ name: seqName, meshes: recordedMeshesInStep, ob: combinedOB, coal: combinedCoal });
    if (window.undoStack.length > window.MAX_UNDO_STEPS) window.undoStack.shift();
    
    window.updateSequenceUI(); window.selectedMeshes.clear(); window.hoveredGroupKey = null; 
    window.hoveredMeshes = []; window.currentHoveredName = null; window.currentHoveredData = null;

    window.displaySelectionInfo();
}

window.undoLastRecord = function() {
    if (window.undoStack.length === 0) return;
    const lastAction = window.undoStack.pop(); window.redoStack.push(lastAction);
    if (window.redoStack.length > window.MAX_UNDO_STEPS) window.redoStack.shift();
    
    window.sequenceRecords.pop(); window.sequenceTotalOB -= lastAction.ob; window.sequenceTotalCoal -= lastAction.coal;
    
    if (lastAction.name.startsWith('Selection #')) window.sequenceCounter = Math.max(1, window.sequenceCounter - 1);
    
    lastAction.meshes.forEach(m => {
        m.userData.isRecorded = false; const isResource = (m.userData.burden || '').toUpperCase() === 'RESOURCE';
        m.visible = isResource ? isCoalVisible : isOBVisible;
    });
    window.updateSequenceUI();
}

window.redoLastUndo = function() {
    if (window.redoStack.length === 0) return;
    const actionToRedo = window.redoStack.pop(); window.undoStack.push(actionToRedo);
    
    actionToRedo.meshes.forEach(m => { m.userData.isRecorded = true; m.visible = false; m.material.emissive.setHex(0x000000); });
    
    if (actionToRedo.name.startsWith('Selection #')) window.sequenceCounter++;
    window.sequenceRecords.push({ name: actionToRedo.name, ob: actionToRedo.ob, coal: actionToRedo.coal });
    window.sequenceTotalOB += actionToRedo.ob; window.sequenceTotalCoal += actionToRedo.coal;
    
    window.updateSequenceUI();
}

window.resetSequenceAndView = function() {
    Object.values(meshes).forEach(mesh => {
        mesh.userData.isRecorded = false; const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
        mesh.visible = isResource ? isCoalVisible : isOBVisible; mesh.material.emissive.setHex(0x000000);
    });
    
    window.selectedMeshes.clear(); window.sequenceRecords = []; window.sequenceTotalOB = 0; 
    window.sequenceTotalCoal = 0; window.sequenceCounter = 1; window.undoStack = []; window.redoStack = []; 
    window.hoveredGroupKey = null; window.hoveredMeshes = []; window.currentHoveredName = null; window.currentHoveredData = null;

    window.displaySelectionInfo(); window.updateSequenceUI();
    
    if (typeof drawGroup !== 'undefined' && drawGroup) {
        drawGroup.children.forEach(c => { if (c.geometry) c.geometry.dispose(); }); drawGroup.clear();
    }
    if (typeof finishedDrawings !== 'undefined') finishedDrawings = [];
    if (typeof selectedDrawing !== 'undefined') selectedDrawing = null;

    if (Object.keys(meshes).length > 0) {
        const pitProcSelect = document.getElementById('pit-processing-select');
        if (pitProcSelect) {
            if (pitProcSelect.value === 'basic' && window.resetToBasicColors) window.resetToBasicColors();
            else if (pitProcSelect.value === 'resgraphic_incremental' && window.generateResgraphicIncremental) window.generateResgraphicIncremental(parseFloat(document.getElementById('sr-limit').value) || 5);
            else if (pitProcSelect.value === 'resgraphic_cumulative' && window.generateResgraphicCumulative) window.generateResgraphicCumulative(parseFloat(document.getElementById('sr-limit').value) || 5);
            else if (pitProcSelect.value === 'quality' && window.generateQuality) window.generateQuality();
        }
    }
}

window.updateSequenceUI = function() {
    const tbody = document.getElementById('sequence-tbody'); const placeholder = document.getElementById('sequence-placeholder');
    if (!tbody || !placeholder) return;

    tbody.innerHTML = '';
    if (window.sequenceRecords.length === 0) { placeholder.style.display = 'flex'; } 
    else {
        placeholder.style.display = 'none';
        window.sequenceRecords.forEach(record => {
            let sr = record.coal > 0 ? (record.ob / record.coal).toFixed(2) : '-';
            const row = document.createElement('div');
            row.className = "grid grid-cols-[minmax(0,1fr)_65px_65px_35px] gap-2 py-1.5 px-2 text-[9px] hover:bg-slate-800/50 transition-colors";
            row.innerHTML = `
                <div class="text-slate-300 truncate" title="${record.name}">${record.name}</div>
                <div class="text-right text-blue-400 font-mono truncate">${Number(record.ob.toFixed(2)).toLocaleString()}</div>
                <div class="text-right text-orange-400 font-mono truncate">${Number(record.coal.toFixed(2)).toLocaleString()}</div>
                <div class="text-right text-green-400 font-mono truncate">${sr}</div>
            `;
            tbody.appendChild(row);
        });
    }
    document.getElementById('sequence-ob-total').textContent = `${Number(window.sequenceTotalOB.toFixed(2)).toLocaleString()}`;
    document.getElementById('sequence-coal-total').textContent = `${Number(window.sequenceTotalCoal.toFixed(2)).toLocaleString()}`;
    document.getElementById('sequence-sr-total').textContent = window.sequenceTotalCoal > 0 ? (window.sequenceTotalOB / window.sequenceTotalCoal).toFixed(2) : '-';
    
    const scrollContainer = document.getElementById('sequence-scroll-container');
    if (scrollContainer && window.sequenceRecords.length > 0) { setTimeout(() => { scrollContainer.scrollTop = scrollContainer.scrollHeight; }, 10); }
}

// ==========================================
// PENGEBUT URUTAN UTAMA (BOOTSTRAP)
// ==========================================
window.onload = () => {
    if (typeof initLayout === 'function') initLayout();
    if (typeof init3D === 'function') init3D();
};