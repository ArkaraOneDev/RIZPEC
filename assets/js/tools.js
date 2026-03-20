// ==========================================
// PEMBOLEH UBAH ALAT & LUKISAN (DRAWING TOOLS)
// ==========================================
var drawPoints3D = [];
var activeDrawMesh = null;
var activeDrawLine = null;
var drawGroup = null;
var cachedDrawIntersectables = [];
var isDrawCachingValid = false;
var drawHotspot = null; // Sphere penunjuk kursor raycast
var finishedDrawings = []; // Menyimpan semua gambar yang sudah selesai
var selectedDrawing = null; // Rujukan kepada gambar yang sedang dipilih

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
        
        // Jika pengguna mempunyai pilihan dan terus menekan butang Rekod (sangat membantu di Tablet)
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
        isDrawCachingValid = false; // Batalkan cache lukisan setiap kali alat bertukar
        
        if (mode !== 'poly_select') {
            window.cancelPolygon();
        }

        if (mode !== 'draw_line' && mode !== 'draw_area') {
            window.cancelActiveDrawing();
            window.restoreNormalNavigation();
        } else {
            // Kosongkan pilihan biasa apabila memasuki mod lukisan
            window.clearSelection();
            window.clearDrawingSelection();
            // Lumpuhkan orbit/pan pada klik kiri semasa melukis
            if(typeof controls !== 'undefined' && controls) controls.mouseButtons.LEFT = null;
        }
    });
});

// ==========================================
// LOGIK LUKISAN & UKURAN
// ==========================================

// Tetapan Hotspot 3D
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
    drawPoints3D = [];
    isDrawCachingValid = false;
    if (activeDrawMesh) { if(activeDrawMesh.geometry) activeDrawMesh.geometry.dispose(); if(drawGroup) drawGroup.remove(activeDrawMesh); activeDrawMesh = null; }
    if (activeDrawLine) { if(activeDrawLine.geometry) activeDrawLine.geometry.dispose(); if(drawGroup) drawGroup.remove(activeDrawLine); activeDrawLine = null; }
    if (measureTooltip) measureTooltip.classList.add('hidden');
    if (drawHotspot) drawHotspot.visible = false;
}

window.finishDrawing = function() {
    if (drawPoints3D.length < 2) {
        window.cancelActiveDrawing();
        return;
    }

    // Simpan gambar yang sudah selesai ke dalam tatasusunan dan beri userData
    const finishedData = {
        type: window.activeInteractionMode,
        lineMesh: activeDrawLine,
        areaMesh: activeDrawMesh,
        points: [...drawPoints3D]
    };

    if (activeDrawLine) activeDrawLine.userData.drawRef = finishedData;
    if (activeDrawMesh) activeDrawMesh.userData.drawRef = finishedData;

    finishedDrawings.push(finishedData);

    // Lepas rujukan agar gambar seterusnya tidak menimpa yang ini
    drawPoints3D = [];
    isDrawCachingValid = false;
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
    cachedDrawIntersectables = [];
    
    // 1. Pit Reserve (Menyertakan blok yang dirakam supaya tetap dikesan raycaster)
    if (typeof pitReserveGroup !== 'undefined' && pitReserveGroup) {
        Object.values(meshes).forEach(m => {
            if (m.geometry && !m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
            if (m.geometry && !m.geometry.boundingBox) m.geometry.computeBoundingBox();
            cachedDrawIntersectables.push(m);
        });
    }
    
    // 2. Lapisan DXF
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(l => {
            if (l.visible && l.threeObject) {
                l.threeObject.traverse(c => { 
                    if (c.isMesh || c.isLine || c.isLineSegments) {
                        if (c.geometry && !c.geometry.boundingSphere) c.geometry.computeBoundingSphere();
                        if (c.geometry && !c.geometry.boundingBox) c.geometry.computeBoundingBox();
                        cachedDrawIntersectables.push(c); 
                    }
                });
            }
        });
    }
    isDrawCachingValid = true;
}

window.getRaycastPoint = function(pos) {
    mouse.x = pos.nx; mouse.y = pos.ny; 
    raycaster.setFromCamera(mouse, camera);
    
    // Bina semula cache memori mesh jika tidak sah
    if (!isDrawCachingValid) window.updateDrawCache();

    if (cachedDrawIntersectables.length > 0) {
        // Helah sementara menjadikan objek yang "dirakam" menjadi kelihatan semasa raycast
        const hiddenObjs = [];
        for(let i=0; i<cachedDrawIntersectables.length; i++) {
            if(!cachedDrawIntersectables[i].visible) {
                cachedDrawIntersectables[i].visible = true;
                hiddenObjs.push(cachedDrawIntersectables[i]);
            }
        }

        const intersects = raycaster.intersectObjects(cachedDrawIntersectables, false);
        
        // Kembalikan keterlihatan objek ke palsu serta-merta
        for(let i=0; i<hiddenObjs.length; i++) {
            hiddenObjs[i].visible = false;
        }

        if (intersects.length > 0) return intersects[0].point;
    }
    
    // Fallback: Satah lantai Y=0 jika klik tersasar dari objek
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if(raycaster.ray.intersectPlane(plane, target)) return target;
    return null;
}

window.positionTooltip = function(el, worldPos) {
    el.classList.remove('hidden');
    const screenPos = worldPos.clone().project(camera);
    const sx = (screenPos.x * 0.5 + 0.5) * canvasContainer.clientWidth;
    const sy = (screenPos.y * -0.5 + 0.5) * canvasContainer.clientHeight;
    el.style.left = (sx + 15) + 'px';
    el.style.top = (sy - 15) + 'px';
}

window.updateDrawVisuals = function(tempPt) {
    if (!drawGroup) { drawGroup = new THREE.Group(); scene.add(drawGroup); }
    
    const pts = [...drawPoints3D];
    if (tempPt) pts.push(tempPt);
    
    if (pts.length < 2) {
        if (activeDrawLine) activeDrawLine.visible = false;
        if (activeDrawMesh) activeDrawMesh.visible = false;
        measureTooltip.classList.add('hidden');
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

        // Kira panjang terkumpul 3D
        let dist = 0;
        for(let i=1; i<pts.length; i++) dist += pts[i].distanceTo(pts[i-1]);
        
        // Tooltip nilai ukuran
        measureText.innerHTML = `<b>${dist.toFixed(2)} m</b>`;
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
            // Keluasan XZ dengan formula Shoelace
            let sumArea = 0;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                sumArea += (pts[j].x + pts[i].x) * (pts[j].z - pts[i].z);
            }
            area = Math.abs(sumArea / 2);
            
            // Purata Sentroid Ketinggian
            pts.forEach(p => centroid.add(p));
            centroid.divideScalar(pts.length);
            
            // Bentuk poligon Kawasan Visual lut sinar (Pemetaan koordinat x,z di ThreeJS)
            const shape = new THREE.Shape();
            shape.moveTo(pts[0].x, pts[0].z);
            for(let i=1; i<pts.length; i++) shape.lineTo(pts[i].x, pts[i].z);
            
            const shapeGeo = new THREE.ShapeGeometry(shape);
            const posAttr = shapeGeo.attributes.position;
            // Penukaran koordinat 2D ShapeGeometry ke 3D Plane XZ
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

            // Tooltip nilai ukuran
            measureText.innerHTML = `<b>${area.toFixed(2)} m&sup2;</b>`;
            window.positionTooltip(measureTooltip, centroid);
        } else {
            if (activeDrawMesh) activeDrawMesh.visible = false;
            // Fallback jarak jika titik kawasan belum melebihi 2
            measureText.innerHTML = `<b>0.00 m&sup2;</b>`;
            window.positionTooltip(measureTooltip, tempPt || pts[pts.length-1]);
        }
    }
}