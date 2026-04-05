// ==========================================
// PEMBOLEH UBAH ALAT & LUKISAN (DRAWING TOOLS)
// ==========================================
window.drawPoints3D = window.drawPoints3D || []; // Dibuat eksplisit global agar selaras dengan file interaksi
var activeDrawMesh = null;
var activeDrawLine = null;
var drawGroup = null;
var cachedDrawIntersectables = []; // Ditinggalkan untuk backward compatibility saja
var isDrawCachingValid = false;
var drawHotspot = null; // Sphere penunjuk kursor raycast
var finishedDrawings = []; // Menyimpan semua gambar yang sudah selesai
var selectedDrawing = null; // Rujukan kepada gambar yang sedang dipilih
window.drawMarkers = []; // Menyimpan semua entitas marker

// Penghitung urutan untuk nama layer otomatis
window.markerCount = 0;
window.lineCount = 0;
window.areaCount = 0;

// Bahan Global untuk meringankan memori saat melukis secara masa nyata
var drawLineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2, depthTest: false, transparent: true });
var drawAreaLineMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false, transparent: true });
var drawAreaMeshMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthTest: false });

// Bahan untuk keadaan Dipilih (Selected)
var drawLineSelectedMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 3, depthTest: false, transparent: true });
var drawAreaLineSelectedMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 3, depthTest: false, transparent: true });
var drawAreaMeshSelectedMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false });

window.activeInteractionMode = 'select_bench';
window._justCentered = false;

// Elemen DOM untuk Ukuran
const measureTooltip = document.getElementById('measure-tooltip');
const measureText = document.getElementById('measure-text');
const canvasContainer = document.getElementById('canvas-container');

// Pembantu untuk mengembalikan navigasi biasa
window.restoreNormalNavigation = function() {
    if(typeof controls !== 'undefined' && controls) {
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN; 
    }
};

// ==========================================
// PENGIKATAN BUTANG MOD ALAT
// ==========================================
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = btn.getAttribute('data-mode');
        if (!mode) return; // Mencegah tetapan semula mod jika menekan butang tindakan
        
        // Jika pengguna mempunyai pilihan dan terus menekan butang Rekod
        if ((mode === 'record_bench' || mode === 'record_block') && window.selectedMeshes && window.selectedMeshes.size > 0) {
            window.recordSelectedMeshes();
            document.querySelector('.tool-btn[data-mode="select_bench"]').click();
            return;
        }

        document.querySelectorAll('.tool-btn').forEach(b => {
            if (b.hasAttribute('data-mode')) b.classList.remove('active-tool');
        });
        btn.classList.add('active-tool');
        window.activeInteractionMode = mode;

        if (mode !== 'poly_select') {
            if(typeof window.cancelPolygon === 'function') window.cancelPolygon();
        }

        if (mode !== 'draw_line' && mode !== 'draw_area' && mode !== 'draw_marker') {
            window.cancelActiveDrawing();
            window.restoreNormalNavigation();
        } else {
            // Kosongkan pilihan biasa apabila memasuki mod lukisan
            if(typeof window.clearSelection === 'function') window.clearSelection();
            window.clearDrawingSelection();
            // Lumpuhkan orbit/pan pada klik kiri semasa melukis
            if(typeof controls !== 'undefined' && controls) controls.mouseButtons.LEFT = null;
        }
    });
});

// ==========================================
// PENGURUSAN ANTARA MUKA LAYER (UI LAYERS)
// ==========================================
window.updateLayersUI = function() {
    const listEl = document.getElementById('drawing-list');
    if (!listEl) return;

    if (finishedDrawings.length === 0) {
        listEl.innerHTML = '<div class="text-[10px] lg:text-[9px] text-slate-500 italic text-center py-2 lg:py-1">Belum ada Layer</div>';
        return;
    }

    listEl.innerHTML = '';
    finishedDrawings.forEach(drawing => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 transition-colors hover:bg-slate-700/40';
        
        itemDiv.innerHTML = `
            <span onclick="window.zoomToLayer('${drawing.id}')" class="text-[9px] text-slate-300 font-medium flex items-center gap-2 mt-[1px] cursor-pointer hover:text-white transition-colors flex-1" title="Klik untuk Zoom">
                <div class="w-2.5 h-2.5 rounded ${drawing.colorClass} border shrink-0 flex items-center justify-center"></div>
                ${drawing.name}
            </span>
            <div class="flex items-center shrink-0">
                <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                    <button onclick="window.deleteLayer('${drawing.id}')" class="text-slate-500 hover:text-rose-400 flex items-center justify-center w-4 h-4 shrink-0 outline-none" title="Hapus Layer">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(itemDiv);
    });
};

window.deleteLayer = function(id) {
    const index = finishedDrawings.findIndex(d => d.id === id);
    if (index !== -1) {
        const drawing = finishedDrawings[index];
        
        // Buang objek 3D dari Scene
        if (drawing.lineMesh) {
            if (drawing.lineMesh.geometry) drawing.lineMesh.geometry.dispose();
            if (drawGroup) drawGroup.remove(drawing.lineMesh);
        }
        if (drawing.areaMesh) {
            if (drawing.areaMesh.geometry) drawing.areaMesh.geometry.dispose();
            if (drawGroup) drawGroup.remove(drawing.areaMesh);
        }
        if (drawing.type === 'draw_marker') {
            if (drawing.markerMesh) {
                if (drawing.markerMesh.geometry) drawing.markerMesh.geometry.dispose();
                if (drawing.markerMesh.material) drawing.markerMesh.material.dispose();
                if (drawGroup) drawGroup.remove(drawing.markerMesh);
            }
            const mIndex = window.drawMarkers.findIndex(m => m.id === id);
            if (mIndex !== -1) window.drawMarkers.splice(mIndex, 1);
        }
        
        if (drawing.element && drawing.element.parentNode) {
            drawing.element.parentNode.removeChild(drawing.element);
        }

        finishedDrawings.splice(index, 1);
        window.updateLayersUI();
        if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
    }
};

window.zoomToLayer = function(id) {
    if (typeof camera === 'undefined' || typeof controls === 'undefined') return;
    
    const drawing = finishedDrawings.find(d => d.id === id);
    if (!drawing) return;

    const box = new THREE.Box3();

    if (drawing.type === 'draw_marker') {
        box.expandByPoint(drawing.point);
        box.expandByScalar(30); 
    } else if (drawing.points && drawing.points.length > 0) {
        drawing.points.forEach(p => box.expandByPoint(p));
        const size = new THREE.Vector3();
        box.getSize(size);
        if (size.lengthSq() < 10) box.expandByScalar(15);
    } else {
        return;
    }

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 100;
    
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
    cameraDistance = Math.max(80, cameraDistance);

    controls.target.copy(center);
    camera.position.set(center.x, center.y + (cameraDistance * 0.8), center.z + (cameraDistance * 0.6));
    camera.lookAt(center);
    controls.update();

    if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
};


// ==========================================
// LOGIK LUKISAN & UKURAN
// ==========================================

window.initDrawHotspot = function() {
    if (!drawHotspot && typeof scene !== 'undefined') {
        const hsGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const hsMat = new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false, transparent: true, opacity: 0.8 });
        drawHotspot = new THREE.Mesh(hsGeo, hsMat);
        drawHotspot.renderOrder = 1000;
        drawHotspot.visible = false;
        scene.add(drawHotspot);
    }
}

window.cancelActiveDrawing = function() {
    window.drawPoints3D = [];
    if (activeDrawMesh) { if(activeDrawMesh.geometry) activeDrawMesh.geometry.dispose(); if(drawGroup) drawGroup.remove(activeDrawMesh); activeDrawMesh = null; }
    if (activeDrawLine) { if(activeDrawLine.geometry) activeDrawLine.geometry.dispose(); if(drawGroup) drawGroup.remove(activeDrawLine); activeDrawLine = null; }
    if (measureTooltip) measureTooltip.classList.add('hidden');
    if (drawHotspot) drawHotspot.visible = false;
}

window.finishDrawing = function() {
    if (window.drawPoints3D.length < 2) {
        window.cancelActiveDrawing();
        return;
    }

    const id = 'draw_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    let name = '';
    let colorClass = '';

    if (window.activeInteractionMode === 'draw_line') {
        window.lineCount++;
        name = 'Line ' + window.lineCount;
        colorClass = 'bg-blue-400/20 border-blue-400';
    } else if (window.activeInteractionMode === 'draw_area') {
        window.areaCount++;
        name = 'Area ' + window.areaCount;
        colorClass = 'bg-emerald-400/20 border-emerald-400';
    }

    const finishedData = {
        id: id,
        type: window.activeInteractionMode,
        name: name,
        colorClass: colorClass,
        lineMesh: activeDrawLine,
        areaMesh: activeDrawMesh,
        points: [...window.drawPoints3D]
    };

    if (activeDrawLine) activeDrawLine.userData.drawRef = finishedData;
    if (activeDrawMesh) activeDrawMesh.userData.drawRef = finishedData;

    finishedDrawings.push(finishedData);
    
    window.updateLayersUI();

    window.drawPoints3D = [];
    activeDrawMesh = null; 
    activeDrawLine = null;
    if (measureTooltip) measureTooltip.classList.add('hidden');
    if (drawHotspot) drawHotspot.visible = false;

    // Automatik kembali ke mod pilihan biasa
    const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
    if (defaultBtn) defaultBtn.click();
}

window.clearDrawingSelection = function() {
    if (selectedDrawing) {
        if (selectedDrawing.type === 'draw_line' && selectedDrawing.lineMesh) {
            selectedDrawing.lineMesh.material = drawLineMat;
        } else if (selectedDrawing.type === 'draw_area') {
            if (selectedDrawing.lineMesh) selectedDrawing.lineMesh.material = drawAreaLineMat;
            if (selectedDrawing.areaMesh) selectedDrawing.areaMesh.material = drawAreaMeshMat;
        }
        selectedDrawing = null;
    }
}

window.updateDrawCache = function() {
    // Deprecated: Fungsi ini dikosongkan karena getRaycastPoint kini mengecek .visible pada object 
    // secara real-time seperti halnya operasi hover normal.
    isDrawCachingValid = true;
}

window.getRaycastPoint = function(pos) {
    if (typeof mouse === 'undefined' || typeof raycaster === 'undefined' || typeof camera === 'undefined') return null;
    
    mouse.x = pos.nx; mouse.y = pos.ny; 
    raycaster.setFromCamera(mouse, camera);
    
    let intersectableObjects = [];

    // Kumpulkan objek pit block yang TERLIHAT (visible)
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible) {
        pitReserveGroup.children.forEach(c => {
            if (c.isMesh && c.visible) {
                intersectableObjects.push(c);
            }
        });
    }

    // Kumpulkan object layer DXF yang TERLIHAT (visible)
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(l => {
            if (l.type === 'dxf' && l.visible && l.threeObject) {
                l.threeObject.traverse(c => {
                    if ((c.isMesh || c.isLineSegments) && c.visible) {
                        // Tambahkan metadata sementara untuk mendukung kalkulasi masking (clipping)
                        c.userData.dxfLayerName = l.name;
                        c.userData.dxfType = l.hasFaces ? 'Polymesh' : 'Polyline';
                        intersectableObjects.push(c);
                    }
                });
            }
        });
    }

    const intersects = raycaster.intersectObjects(intersectableObjects, false);
    
    // Gunakan filter bawaan dari interaction.js yang memperhitungkan masking/clipping
    if (typeof window.getFirstValidIntersection === 'function') {
        const validHit = window.getFirstValidIntersection(intersects);
        if (validHit) return validHit.point;
    } else if (intersects.length > 0) {
        return intersects[0].point;
    }
    
    // Fallback: Tembak ke bidang tanah imajiner Y=0
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if(raycaster.ray.intersectPlane(plane, target)) return target;
    return null;
}

window.positionTooltip = function(el, worldPos) {
    if (!el || !canvasContainer) return;
    el.classList.remove('hidden');
    
    const dot = el.querySelector('.animate-pulse');
    if (dot) dot.style.display = 'none';

    const screenPos = worldPos.clone().project(camera);
    const sx = (screenPos.x * 0.5 + 0.5) * canvasContainer.clientWidth;
    const sy = (screenPos.y * -0.5 + 0.5) * canvasContainer.clientHeight;
    el.style.left = (sx + 15) + 'px';
    el.style.top = (sy - 15) + 'px';
}

window.updateDrawVisuals = function(tempPt) {
    if (!drawGroup && typeof scene !== 'undefined') { drawGroup = new THREE.Group(); scene.add(drawGroup); }
    
    const pts = [...window.drawPoints3D];
    if (tempPt) pts.push(tempPt);
    
    if (pts.length < 2) {
        if (activeDrawLine) activeDrawLine.visible = false;
        if (activeDrawMesh) activeDrawMesh.visible = false;
        if (measureTooltip) measureTooltip.classList.add('hidden');
        if (measureText) measureText.innerHTML = ''; 
        return;
    }

    const mode = window.activeInteractionMode;

    if (mode === 'draw_line') {
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        
        if (!activeDrawLine) {
            activeDrawLine = new THREE.Line(geo, drawLineMat);
            activeDrawLine.renderOrder = 999;
            drawGroup.add(activeDrawLine);
        } else {
            activeDrawLine.geometry.dispose();
            activeDrawLine.geometry = geo;
            activeDrawLine.material = drawLineMat;
            activeDrawLine.visible = true;
        }
        if (activeDrawMesh) activeDrawMesh.visible = false;

        let dist = 0;
        for(let i=1; i<pts.length; i++) dist += pts[i].distanceTo(pts[i-1]);
        
        if (measureText) measureText.innerHTML = `<b>${dist.toFixed(2)} m</b>`;
        window.positionTooltip(measureTooltip, tempPt || pts[pts.length-1]);
    } 
    else if (mode === 'draw_area') {
        const linePts = [...pts];
        if (pts.length >= 3) linePts.push(pts[0]); 
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
        
        if (!activeDrawLine) {
            activeDrawLine = new THREE.Line(lineGeo, drawAreaLineMat);
            activeDrawLine.renderOrder = 999;
            drawGroup.add(activeDrawLine);
        } else {
            activeDrawLine.geometry.dispose();
            activeDrawLine.geometry = lineGeo;
            activeDrawLine.material = drawAreaLineMat;
            activeDrawLine.visible = true;
        }

        let area = 0;
        let centroid = new THREE.Vector3();
        
        if (pts.length >= 3) {
            let sumArea = 0;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                sumArea += (pts[j].x + pts[i].x) * (pts[j].z - pts[i].z);
            }
            area = Math.abs(sumArea / 2);
            
            pts.forEach(p => centroid.add(p));
            centroid.divideScalar(pts.length);
            
            const shape = new THREE.Shape();
            shape.moveTo(pts[0].x, pts[0].z);
            for(let i=1; i<pts.length; i++) shape.lineTo(pts[i].x, pts[i].z);
            
            const shapeGeo = new THREE.ShapeGeometry(shape);
            const posAttr = shapeGeo.attributes.position;
            for(let i=0; i<posAttr.count; i++) {
                const x = posAttr.getX(i); const y = posAttr.getY(i);
                posAttr.setXYZ(i, x, 0, y); 
            }
            shapeGeo.computeVertexNormals();

            if (!activeDrawMesh) {
                activeDrawMesh = new THREE.Mesh(shapeGeo, drawAreaMeshMat);
                activeDrawMesh.renderOrder = 998;
                drawGroup.add(activeDrawMesh);
            } else {
                activeDrawMesh.geometry.dispose();
                activeDrawMesh.geometry = shapeGeo;
            }
            activeDrawMesh.position.y = centroid.y;
            activeDrawMesh.visible = true;

            if (measureText) {
                if (area < 10000) {
                    measureText.innerHTML = `<b>${area.toFixed(2)} m&sup2;</b>`;
                } else {
                    measureText.innerHTML = `<b>${(area / 10000).toFixed(2)} Ha</b>`;
                }
            }
            window.positionTooltip(measureTooltip, centroid);
        } else {
            if (activeDrawMesh) activeDrawMesh.visible = false;
            if (measureText) measureText.innerHTML = `<b>0.00 m&sup2;</b>`;
            window.positionTooltip(measureTooltip, tempPt || pts[pts.length-1]);
        }
    }
}

// ==========================================
// LOGIK DRAW MARKER
// ==========================================
window.addDrawMarker = function(pt) {
    if (!drawGroup && typeof scene !== 'undefined') { 
        drawGroup = new THREE.Group(); 
        scene.add(drawGroup); 
    }

    const id = 'draw_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    window.markerCount++;

    const radius = 7.5; // <-- DIUBAH MENJADI 5 KALI LIPAT (DARI 1.5)
    const markerGeo = new THREE.SphereGeometry(radius, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }); 
    const markerMesh = new THREE.Mesh(markerGeo, markerMat);
    
    markerMesh.position.copy(pt);
    markerMesh.renderOrder = 999;
    drawGroup.add(markerMesh);
    
    const markerData = {
        id: id,
        type: 'draw_marker',
        name: 'Marker ' + window.markerCount,
        colorClass: 'bg-red-400/20 border-red-400',
        point: pt.clone(),
        markerMesh: markerMesh 
    };
    
    window.drawMarkers.push(markerData);
    finishedDrawings.push(markerData);
    
    window.updateLayersUI();
    
    if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
}

// ==========================================
// LOGIK UNDO & RESET KHUSUS LUKISAN (TOOLS.JS)
// ==========================================

// Fungsi khusus untuk Undo gambar/layer di container-layers (Gunakan ini di tombol Undo Drawing)
window.undoLastDrawing = function() {
    const isDrawMode = window.activeInteractionMode && window.activeInteractionMode.startsWith('draw_');

    if (isDrawMode) {
        // Hanya menghapus titik terakhir saat proses menggambar masih berlangsung.
        // TIDAK akan menghapus layer/objek yang sudah selesai (commit).
        if (window.drawPoints3D && window.drawPoints3D.length > 0) {
            window.drawPoints3D.pop(); // Hapus 1 vertex

            let tempPt = null;
            if (drawHotspot && drawHotspot.visible) {
                tempPt = drawHotspot.position.clone();
            }

            window.updateDrawVisuals(tempPt);

            // Bersihkan UI jika titik habis di-Undo
            if (window.drawPoints3D.length === 0) {
                if (measureTooltip) measureTooltip.classList.add('hidden');
                if (measureText) measureText.innerHTML = '';
                if (activeDrawLine) activeDrawLine.visible = false;
                if (activeDrawMesh) activeDrawMesh.visible = false;
            }

            if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
        } 
    } 
};

// Fungsi khusus untuk mereset aksi lukisan (Gunakan ini jika ada tombol Reset di container-layers)
// HANYA membatalkan lukisan yang sedang berlangsung, BUKAN menghapus layer yang sudah ter-commit
window.clearAllDrawings = window.resetCurrentDrawing = function() {
    // 1. Batalkan aksi menggambar yang sedang berlangsung
    window.cancelActiveDrawing();
    
    // 2. Automatik kembali ke mode pilihan biasa (Pointer)
    const defaultBtn = document.querySelector('.tool-btn[data-mode="select_bench"]');
    if (defaultBtn) defaultBtn.click();
    
    if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
};

// ==========================================
// SHORTCUT KEYBOARD TAMBAHAN
// ==========================================
window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Backspace') {
        e.preventDefault(); 
        
        const isDrawMode = window.activeInteractionMode && window.activeInteractionMode.startsWith('draw_');
        
        // Jika sedang mode menggambar, panggil undoLastDrawing (hanya menghapus vertex)
        if (isDrawMode) {
            window.undoLastDrawing();
        } else if (typeof window.undoLastRecord === 'function') {
            // Jika bukan sedang melukis, maka fall-back ke undo interaction.js
            window.undoLastRecord();
        }
    }
});