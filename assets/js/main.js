// ==========================================
// GLOBAL VARIABLES
// ==========================================
let scene, camera, renderer, controls;
let raycaster, mouse;
let meshes = {};
let pitReserveGroup = null; 

// Variabel Kompas 3D
let compassScene, compassCamera;

// Variabel Orbit Pad 3D Cube
let padScene, padCamera, padRenderer, padCube;

// Variabel Custom Orbit Off-Center
let isCustomOrbiting = false;
let orbitPivot = new THREE.Vector3();
let lastMousePos = { x: 0, y: 0 };

var globalParsedData = null;
var csvHeaders = []; 

var worldOrigin = { x: 0, y: 0, z: 0, isSet: false };
var appLayers = []; 

var isWasteVisible = true;
var isResourceVisible = true;
var isLabelLayerVisible = true;
var isGeometryExpanded = false; 

var wasteOpacity = 1;
var resourceOpacity = 1;
var labelOpacity = 1;

var basicColorWaste = localStorage.getItem('basicColorWaste') || '#a0a0a0';
var basicColorResource = localStorage.getItem('basicColorResource') || '#333333';

var activeLabels = [];

// Status Render 3D (Untuk Pause/Resume)
window.is3DRenderingActive = false;
window.animationFrameId = null;

window.pause3D = function() {
    if (!window.is3DRenderingActive) return;
    window.is3DRenderingActive = false;
    if (window.animationFrameId) {
        cancelAnimationFrame(window.animationFrameId);
        window.animationFrameId = null;
    }
};

window.resume3D = function() {
    if (window.is3DRenderingActive) return;
    window.is3DRenderingActive = true;
    animate();
};

const AUTO_CAD_COLOR_INDEX = [
    0xffffff, 0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff, 0x414141, 0x808080, 
    0xff0000, 0xffaaaa, 0xbd0000, 0xbd7e7e, 0x810000, 0x815656, 0x680000, 0x684545, 0x4f0000, 0x4f3535, 
    0xff3f00, 0xffbfaa, 0xbd2e00, 0xbd8d7e, 0x811f00, 0x816056, 0x681900, 0x684d45, 0x4f1300, 0x4f3b35, 
    0xff7f00, 0xffd4aa, 0xbd5e00, 0xbd9d7e, 0x814000, 0x816b56, 0x683400, 0x685645, 0x4f2700, 0x4f4235, 
    0xffbf00, 0xffeaaa, 0xbd8d00, 0xbdad7e, 0x816000, 0x817656, 0x684d00, 0x685f45, 0x4f3b00, 0x4f4935, 
    0xffff00, 0xffffaa, 0xbdbd00, 0xbdbd7e, 0x818100, 0x818156, 0x686800, 0x686845, 0x4f4f00, 0x4f4f35, 
    0xbfff00, 0xeaffaa, 0x8dbd00, 0xadbd7e, 0x608100, 0x768156, 0x4d6800, 0x5f6845, 0x3b4f00, 0x494f35, 
    0x7fff00, 0xd4ffaa, 0x5ebd00, 0x9dbd7e, 0x408100, 0x6b8156, 0x346800, 0x566845, 0x274f00, 0x424f35, 
    0x3fff00, 0xbfffaa, 0x2ebd00, 0x8dbd7e, 0x1f8100, 0x608156, 0x196800, 0x4d6845, 0x134f00, 0x3b4f35, 
    0x00ff00, 0xaaffaa, 0x00bd00, 0x7ebd7e, 0x008100, 0x568156, 0x006800, 0x456845, 0x004f00, 0x354f35, 
    0x00ff3f, 0xaaffbf, 0x00bd2e, 0x7ebd8d, 0x00811f, 0x568160, 0x006819, 0x45684d, 0x004f13, 0x354f3b, 
    0x00ff7f, 0xaaffd4, 0x00bd5e, 0x7ebd9d, 0x008140, 0x56816b, 0x006834, 0x456856, 0x004f27, 0x354f42, 
    0x00ffbf, 0xaaffea, 0x00bd8d, 0x7ebdad, 0x008160, 0x568176, 0x00684d, 0x45685f, 0x004f3b, 0x354f49, 
    0x00ffff, 0xaaffff, 0x00bdbd, 0x7ebdbd, 0x008181, 0x568181, 0x006868, 0x456868, 0x004f4f, 0x354f4f, 
    0x00bfff, 0xaaeaff, 0x008dbd, 0x7eadbd, 0x006081, 0x567681, 0x004d68, 0x455f68, 0x003b4f, 0x35494f, 
    0x007fff, 0xaad4ff, 0x005ebd, 0x7e9dbd, 0x004081, 0x566b81, 0x003468, 0x455668, 0x00274f, 0x35424f, 
    0x003fff, 0xaabfff, 0x002ebd, 0x7e8dbd, 0x001f81, 0x566081, 0x001968, 0x454d68, 0x00134f, 0x353b4f, 
    0x0000ff, 0xaaaaff, 0x0000bd, 0x7e7ebd, 0x000081, 0x565681, 0x000068, 0x454568, 0x00004f, 0x35354f, 
    0x3f00ff, 0xbfaaff, 0x2e00bd, 0x8d7ebd, 0x1f0081, 0x605681, 0x190068, 0x4d4568, 0x13004f, 0x3b354f, 
    0x7f00ff, 0xd4aaff, 0x5e00bd, 0x9d7ebd, 0x400081, 0x6b5681, 0x340068, 0x564568, 0x27004f, 0x42354f, 
    0xbf00ff, 0xeaaaff, 0x8d00bd, 0xad7ebd, 0x600081, 0x765681, 0x4d0068, 0x5f4568, 0x3b004f, 0x49354f, 
    0xff00ff, 0xffaaff, 0xbd00bd, 0xbd7ebd, 0x810081, 0x815681, 0x680068, 0x684568, 0x4f004f, 0x4f354f, 
    0xff00bf, 0xffaaea, 0xbd008d, 0xbd7ead, 0x810060, 0x815676, 0x68004d, 0x68455f, 0x4f003b, 0x4f3549, 
    0xff007f, 0xffaad4, 0xbd005e, 0xbd7e9d, 0x810040, 0x81566b, 0x680034, 0x684556, 0x4f0027, 0x4f3542, 
    0xff003f, 0xffaabf, 0xbd002e, 0xbd7e8d, 0x81001f, 0x815660, 0x680019, 0x68454d, 0x4f0013, 0x4f353b, 
    0x333333, 0x505050, 0x696969, 0x828282, 0x9c9c9c, 0xb5b5b5
];

var isProcessing = false;
const COLOR_HOVER = 0x444444;
const COLOR_SELECTED = 0x2b5b84; 

// ==========================================
// 3D & INTERACTION INITIALIZATION
// ==========================================
function init3D() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e293b');

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100000);
    camera.position.set(0, 500, 500);

    const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobileOrTablet, 
        logarithmicDepthBuffer: true, 
        powerPreference: "high-performance"
    });
    
    // --- EVENT LISTENER CONTEXT LOST (PENTING!) ---
    renderer.domElement.addEventListener('webglcontextlost', function(e) {
        e.preventDefault();
        console.error("WEBGL CONTEXT LOST DETECTED");
        alert("Peringatan: Memori Grafis (GPU) Anda Penuh!\n\nHal ini disebabkan karena terlalu banyak data DXF/Texture yang diload, atau batasan dari browser. Tampilan 3D akan berhenti.\n\nHarap Refresh halaman (F5) untuk melanjutkan.");
        window.pause3D();
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', function(e) {
        console.log("WEBGL CONTEXT RESTORED");
        // Kita tidak bisa auto-resume dengan mudah karena data scene harus dikompilasi ulang oleh GPU, 
        // lebih aman meminta user refresh halaman setelah context lost.
    }, false);
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    const maxPixelRatio = isMobileOrTablet ? 1.25 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    
    renderer.autoClear = false; 
    
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    controls.zoomSpeed = 3.5;
    controls.panSpeed = 1.5;

    controls.enableDamping = false;
    
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: null, 
        RIGHT: null   
    };

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(1000, 2000, 1000);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-1000, 1000, -1000);
    scene.add(dirLight2);
    
    pitReserveGroup = new THREE.Group();
    pitReserveGroup.name = "Pit Reserve";
    scene.add(pitReserveGroup);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // ==========================================
    // OVERLAY COMPASS 3D SETUP
    // ==========================================
    compassScene = new THREE.Scene();
    const compLight = new THREE.DirectionalLight(0xffffff, 1.5);
    compLight.position.set(1, 1, 1);
    compassScene.add(compLight);
    compassScene.add(new THREE.AmbientLight(0xffffff, 0.8));

    compassCamera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 10);
    
    const compassGroup = new THREE.Group();
    compassScene.add(compassGroup);

    const centerGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const centerMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    compassGroup.add(new THREE.Mesh(centerGeo, centerMat));

    const northGeo = new THREE.ConeGeometry(0.15, 1, 16);
    northGeo.translate(0, 0.5, 0);
    const northMat = new THREE.MeshPhongMaterial({ color: 0xff3333 });
    const northMesh = new THREE.Mesh(northGeo, northMat);
    northMesh.rotation.x = -Math.PI / 2; 
    compassGroup.add(northMesh);

    const southMat = new THREE.MeshPhongMaterial({ color: 0xdddddd });
    const southMesh = new THREE.Mesh(northGeo, southMat);
    southMesh.rotation.x = Math.PI / 2; 
    compassGroup.add(southMesh);

    const ewGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8);
    const ewMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    const ewMesh = new THREE.Mesh(ewGeo, ewMat);
    ewMesh.rotation.z = Math.PI / 2;
    compassGroup.add(ewMesh);

    function createCompassLabel(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.4, 0.4, 1);
        sprite.renderOrder = 999;
        return sprite;
    }

    const nLabel = createCompassLabel('N', '#ff3333');
    nLabel.position.set(0, 0.1, -1.2);
    compassGroup.add(nLabel);

    const sLabel = createCompassLabel('S', '#ffffff');
    sLabel.position.set(0, 0.1, 1.2);
    compassGroup.add(sLabel);

    const eLabel = createCompassLabel('E', '#aaaaaa');
    eLabel.position.set(1.1, 0.1, 0);
    compassGroup.add(eLabel);

    const wLabel = createCompassLabel('W', '#aaaaaa');
    wLabel.position.set(-1.1, 0.1, 0);
    compassGroup.add(wLabel);

    const compassHitbox = document.createElement('div');
    compassHitbox.id = 'compass-hitbox';
    compassHitbox.className = 'absolute top-4 left-4 z-10 cursor-pointer rounded-full';
    compassHitbox.style.width = '100px';
    compassHitbox.style.height = '100px';
    compassHitbox.title = 'Klik untuk reset ke Utara (Plan View)';
    container.parentElement.appendChild(compassHitbox);

    ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'contextmenu'].forEach(evt => {
        compassHitbox.addEventListener(evt, (e) => e.stopPropagation());
    });

    compassHitbox.addEventListener('click', (e) => {
        e.stopPropagation();

        const box = new THREE.Box3();
        let hasObj = false;

        appLayers.forEach(l => {
            if (l.visible && l.threeObject) {
                box.expandByObject(l.threeObject);
                hasObj = true;
            }
        });

        if (pitReserveGroup && pitReserveGroup.visible && pitReserveGroup.children.length > 0) {
            box.expandByObject(pitReserveGroup);
            hasObj = true;
        }

        if (!hasObj || box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z) || 100;
        
        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
        if (cameraDistance < 10) cameraDistance = 100;
        
        controls.target.copy(center);
        
        camera.position.set(center.x, center.y + cameraDistance, center.z + 0.001);
        camera.up.set(0, 1, 0);
        camera.lookAt(center);
        
        controls.update();
    });
    // ==========================================

    window.addEventListener('resize', () => {
        if (!window.is3DRenderingActive) return; 
        
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        if(!document.getElementById('gcp-modal').classList.contains('hidden')) {
            if(typeof resizeLeftCanvas === 'function') resizeLeftCanvas();
            if(typeof resizeRightCanvas === 'function') resizeRightCanvas();
        }

        const trackpad = document.getElementById('orbit-trackpad');
        if (trackpad && padCamera && padRenderer) {
            padCamera.aspect = trackpad.clientWidth / trackpad.clientHeight;
            padCamera.updateProjectionMatrix();
            padRenderer.setSize(trackpad.clientWidth, trackpad.clientHeight);
        }
    });
    
    container.addEventListener('contextmenu', (e) => { e.preventDefault(); });

    container.addEventListener('pointerdown', (e) => {
        if (e.button === 0) window.onPointerDown(e);
    });
    container.addEventListener('pointermove', window.onPointerMove);
    container.addEventListener('pointerup', window.onPointerUp);

    container.addEventListener('pointerdown', (e) => {
        if (e.button === 1) { 
            e.preventDefault(); 
            if (!window.is3DRenderingActive) return; 
            
            const rect = container.getBoundingClientRect();
            const nMouse = new THREE.Vector2();
            nMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            nMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(nMouse, camera);

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
                orbitPivot.copy(intersects[0].point);
            } else {
                orbitPivot.copy(controls.target);
            }

            isCustomOrbiting = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            controls.enabled = false; 
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (isCustomOrbiting && window.is3DRenderingActive) {
            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;
            lastMousePos = { x: e.clientX, y: e.clientY };

            const rotationSpeed = 0.005; 
            const angleX = -deltaX * rotationSpeed;
            const angleY = -deltaY * rotationSpeed;

            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleX);

            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            const right = new THREE.Vector3().crossVectors(camera.up, camDir.negate()).normalize();
            
            let qX = new THREE.Quaternion();
            if (right.lengthSq() > 0.001) {
                qX.setFromAxisAngle(right, angleY);
            }

            const q = new THREE.Quaternion().multiplyQuaternions(qY, qX);

            const camOffset = camera.position.clone().sub(orbitPivot);
            camOffset.applyQuaternion(q);
            const newCamPos = orbitPivot.clone().add(camOffset);

            const targetOffset = controls.target.clone().sub(orbitPivot);
            targetOffset.applyQuaternion(q);
            const newTarget = orbitPivot.clone().add(targetOffset);

            const newDir = newTarget.clone().sub(newCamPos).normalize();
            if (Math.abs(newDir.y) < 0.99) {
                camera.position.copy(newCamPos);
                controls.target.copy(newTarget);
            } else {
                camOffset.copy(camera.position).sub(orbitPivot).applyQuaternion(qY);
                camera.position.copy(orbitPivot).add(camOffset);

                targetOffset.copy(controls.target).sub(orbitPivot).applyQuaternion(qY);
                controls.target.copy(orbitPivot).add(targetOffset);
            }

            camera.lookAt(controls.target);
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (e.button === 1 && isCustomOrbiting) { 
            isCustomOrbiting = false;
            controls.enabled = true; 
        }
    });

    // ==========================================
    // Logika 3D View Cube untuk Orbit Pad
    // ==========================================
    const trackpad = document.getElementById('orbit-trackpad');
    if (trackpad) {
        padScene = new THREE.Scene();
        
        const padW = trackpad.clientWidth || 240; 
        const padH = trackpad.clientHeight || 160; 
        padCamera = new THREE.PerspectiveCamera(50, padW / padH, 0.1, 100);
        padCamera.position.z = 3;

        padRenderer = new THREE.WebGLRenderer({ 
            antialias: !isMobileOrTablet, 
            alpha: true
        });
        padRenderer.setSize(padW, padH);
        padRenderer.setPixelRatio(window.devicePixelRatio);
        trackpad.appendChild(padRenderer.domElement);

        function createFaceMaterial(text, bgColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, 128, 128);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 124, 124);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            return new THREE.MeshBasicMaterial({ map: texture });
        }

        const cubeMaterials = [
            createFaceMaterial('RIGHT', '#0284c7'),  
            createFaceMaterial('LEFT', '#0ea5e9'),   
            createFaceMaterial('TOP', '#16a34a'),    
            createFaceMaterial('BOTTOM', '#22c55e'), 
            createFaceMaterial('FRONT', '#dc2626'),  
            createFaceMaterial('BACK', '#ef4444')    
        ];
        
        const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
        padCube = new THREE.Mesh(cubeGeo, cubeMaterials);
        padScene.add(padCube);

        let isPadOrbiting = false;
        let padLastX = 0, padLastY = 0;

        trackpad.addEventListener('pointerdown', (e) => {
            if (!window.is3DRenderingActive) return;
            isPadOrbiting = true;
            padLastX = e.clientX;
            padLastY = e.clientY;
            trackpad.setPointerCapture(e.pointerId);
            controls.enabled = false; 
        });

        trackpad.addEventListener('pointermove', (e) => {
            if (!isPadOrbiting || !window.is3DRenderingActive) return;
            const deltaX = e.clientX - padLastX;
            const deltaY = e.clientY - padLastY;
            padLastX = e.clientX;
            padLastY = e.clientY;

            const rotationSpeed = 0.01;
            const angleX = -deltaX * rotationSpeed;
            const angleY = deltaY * rotationSpeed; 

            const offset = camera.position.clone().sub(controls.target);
            
            const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleX);
            offset.applyQuaternion(qY);

            const camDir = new THREE.Vector3().copy(offset).negate().normalize();
            const right = new THREE.Vector3().crossVectors(camera.up, camDir).normalize();
            
            if (right.lengthSq() > 0.001) {
                const qX = new THREE.Quaternion().setFromAxisAngle(right, angleY);
                const testOffset = offset.clone().applyQuaternion(qX);
                
                if (Math.abs(testOffset.clone().normalize().y) < 0.99) {
                    offset.copy(testOffset);
                }
            }

            camera.position.copy(controls.target).add(offset);
            camera.lookAt(controls.target);
            controls.update();
        });

        trackpad.addEventListener('pointerup', (e) => {
            isPadOrbiting = false;
            trackpad.releasePointerCapture(e.pointerId);
            controls.enabled = true;
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); window.undoLastRecord(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); window.redoLastUndo(); return; }
        
        if (e.key === 'Escape' || e.key === 'Esc' || e.key.toLowerCase() === 'x') { 
            if (typeof isDrawingPolygon !== 'undefined' && isDrawingPolygon) window.cancelPolygon(); 
            else window.resetSequenceAndView(); 
        }

        if (e.key.toLowerCase() === 'c') {
            if (typeof window.executeCenterPivot === 'function' && window.currentMousePos) {
                window.executeCenterPivot(window.currentMousePos);
            }
        }

        if (e.key === 'Enter' && typeof isDrawingPolygon !== 'undefined' && isDrawingPolygon) window.finishPolygonSelection();
        
        if (e.key === 'Shift') {
            const mode = window.activeInteractionMode || 'select_bench';
            if (mode === 'select_bench' && window.is3DRenderingActive) {
                raycaster.setFromCamera(mouse, camera);
                const meshArray = Object.values(meshes).filter(m => m.visible && pitReserveGroup.visible);
                window.handleHover(raycaster.intersectObjects(meshArray), true);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            const mode = window.activeInteractionMode || 'select_bench';
            if (mode === 'select_bench' && window.is3DRenderingActive) {
                raycaster.setFromCamera(mouse, camera);
                const meshArray = Object.values(meshes).filter(m => m.visible && pitReserveGroup.visible);
                window.handleHover(raycaster.intersectObjects(meshArray), false);
            }
        }
    });

    const canvasContainerDOM = document.getElementById('canvas-container');
    if (canvasContainerDOM) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    window.resume3D();
                } else {
                    window.pause3D();
                }
            });
        }, { root: null, threshold: 0.01 }); 
        
        observer.observe(canvasContainerDOM);
    } else {
        window.resume3D(); 
    }
}

function animate() {
    if (!window.is3DRenderingActive) return;
    
    window.animationFrameId = requestAnimationFrame(animate);
    controls.update();

    const container = document.getElementById('canvas-container');

    renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
    renderer.clear();
    renderer.render(scene, camera);

    if (compassScene && compassCamera) {
        renderer.clearDepth(); 
        
        const compassSize = 100;
        renderer.setViewport(16, container.clientHeight - compassSize - 16, compassSize, compassSize);
        
        compassCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(5);
        compassCamera.quaternion.copy(camera.quaternion);
        
        renderer.render(compassScene, compassCamera);
    }

    if (padScene && padCamera && padRenderer) {
        const trackpad = document.getElementById('orbit-trackpad');
        if (trackpad && trackpad.clientWidth > 0 && trackpad.clientWidth !== padRenderer.domElement.width / window.devicePixelRatio) {
            padCamera.aspect = trackpad.clientWidth / trackpad.clientHeight;
            padCamera.updateProjectionMatrix();
            padRenderer.setSize(trackpad.clientWidth, trackpad.clientHeight);
        }

        if (trackpad && trackpad.clientWidth > 0) {
            const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(2.5);
            padCamera.position.copy(offset);
            padCamera.quaternion.copy(camera.quaternion);
            
            padRenderer.render(padScene, padCamera);
        }
    }

    if(typeof updateLabels === 'function') updateLabels();
}