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

    Object.keys(colorFaceGroups).forEach(hexKey => {
        const points = colorFaceGroups[hexKey];
        if (points.length > 0) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            geo.computeVertexNormals(); 

            const mat = new THREE.MeshStandardMaterial({
                color: parseInt(hexKey),
                side: THREE.DoubleSide,
                roughness: 0.6,
                metalness: 0.1,
                polygonOffset: true, 
                polygonOffsetFactor: 1, 
                polygonOffsetUnits: 1
            });
            
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData.originalColor = parseInt(hexKey);
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
            clippingEnabled: false
        });
    }
    
    if (typeof updateLayerUI === 'function') updateLayerUI();
    setTimeout(() => {
        if(typeof window.zoomToLayer === 'function') window.zoomToLayer(layerId);
        updateFileMenuState();
    }, 100);
}