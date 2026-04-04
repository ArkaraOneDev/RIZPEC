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

// ==========================================
// [PERBAIKAN GC THRESHING]: PRE-ALLOCATED MATH OBJECTS
// Objek-objek ini didaur ulang dalam loop untuk mencegah Tablet membuat ratusan objek baru per detik (Jank/Stutter Free)
// ==========================================
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _v5 = new THREE.Vector3();
const _v6 = new THREE.Vector3();
const _v2D = new THREE.Vector2();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);

// [TAMBAHAN OPTIMASI]: Pre-allocated array untuk raycasting agar tidak membuat array baru tiap klik/ketikan
const _raycastTargets = [];
const _checkArray = [];

// [OPTIMASI BARU]: CACHE DOM DIMENSIONS (Mencegah Layout Thrashing)
// Menyimpan ukuran kanvas agar tidak dibaca dari DOM 60x per detik di dalam loop animasi
let cachedContainerW = 0;
let cachedContainerH = 0;
let cachedTrackpadW = 0;
let cachedTrackpadH = 0;
// ==========================================

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

// Fungsi ini memaksa rendering 1 frame (berguna saat 3D sedang pause tapi ada action Real-time)
window.forceSingleRender = function() {
    if (window.is3DRenderingActive) return; // Abaikan jika loop sudah berjalan normal
    if (!renderer || !scene || !camera) return;

    controls.update();
    renderer.setViewport(0, 0, cachedContainerW, cachedContainerH);
    renderer.clear();
    renderer.render(scene, camera);

    if (compassScene && compassCamera) {
        renderer.clearDepth(); 
        const compassSize = 100;
        renderer.setViewport(16, cachedContainerH - compassSize - 16, compassSize, compassSize);
        compassCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(5);
        compassCamera.quaternion.copy(camera.quaternion);
        renderer.render(compassScene, compassCamera);
    }

    if (padScene && padCamera && padRenderer && cachedTrackpadW > 0) {
        _v1.copy(camera.position).sub(controls.target).normalize().multiplyScalar(2.5);
        padCamera.position.copy(_v1);
        padCamera.quaternion.copy(camera.quaternion);
        padRenderer.render(padScene, padCamera);
    }

    if(typeof updateLabels === 'function') updateLabels();
};

const AUTO_CAD_COLOR_INDEX = [
    0xffffff, 0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff, 0xffffff, 0x414141, 0x808080, 
    0x333333, 0x505050, 0x696969, 0x828282, 0x9c9c9c, 0xb5b5b5
];

var isProcessing = false;
const COLOR_HOVER = 0x444444;
const COLOR_SELECTED = 0x2b5b84; 

// ==========================================
// 3D & INTERACTION INITIALIZATION
// ==========================================
function init3D() {
    if (window._is3DInitialized) return;
    window._is3DInitialized = true;

    const container = document.getElementById('canvas-container');
    
    // Inisialisasi Cache Dimensi DOM pertama kali
    cachedContainerW = container.clientWidth;
    cachedContainerH = container.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e293b');

    camera = new THREE.PerspectiveCamera(60, cachedContainerW / cachedContainerH, 0.1, 100000);
    camera.position.set(0, 500, 500);

    const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobileOrTablet, 
        logarithmicDepthBuffer: true, 
        powerPreference: "high-performance"
    });
    
    // --- EVENT LISTENER CONTEXT LOST ---
    renderer.domElement.addEventListener('webglcontextlost', function(e) {
        e.preventDefault();
        console.error("WEBGL CONTEXT LOST DETECTED");
        alert("Peringatan: Memori Grafis (GPU) Anda Penuh!\n\nHal ini disebabkan karena terlalu banyak data DXF/Texture yang diload. Tampilan 3D akan berhenti.\n\nHarap Refresh halaman (F5) untuk melanjutkan.");
        window.pause3D();
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', function(e) {
        console.log("WEBGL CONTEXT RESTORED");
    }, false);
    
    renderer.setSize(cachedContainerW, cachedContainerH);
    const maxPixelRatio = isMobileOrTablet ? 1.25 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.autoClear = false; 
    
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.zoomSpeed = 3.5; 
    controls.panSpeed = 1.5;
    controls.enableDamping = false; 

    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: null, RIGHT: null };

    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (e.ctrlKey && typeof controls !== 'undefined') {
            controls.enabled = false;
        }
    }, true);

    // ==========================================
    // CUSTOM FLY-THROUGH ZOOM (Fitur "Pokoknya Nembus")
    // ==========================================
    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation(); 

        if (!window.is3DRenderingActive) return;

        let dist = camera.position.distanceTo(controls.target);
        let step = dist * 0.08;
        if (step < 10) step = 10; 

        const isZoomingIn = e.deltaY < 0;
        const moveAmount = isZoomingIn ? step : -step;

        camera.getWorldDirection(_v1);

        if (isZoomingIn) {
            if (dist - moveAmount <= 1.0) {
                _v1.multiplyScalar(moveAmount);
                camera.position.add(_v1);
                controls.target.add(_v1);
            } else {
                _v1.multiplyScalar(moveAmount);
                camera.position.add(_v1);
            }
        } else {
            _v1.multiplyScalar(moveAmount);
            camera.position.add(_v1);
        }

        controls.update();
    }, { passive: false, capture: true });

    // ==========================================
    // SMOOTH VERTICAL ZOOM SLIDER LOGIC
    // ==========================================
    const zoomSlider = document.getElementById('zoom-slider');
    if (zoomSlider) {
        const MIN_DIST = 10;
        const MAX_DIST = 20000;
        const minLog = Math.log(MIN_DIST);
        const maxLog = Math.log(MAX_DIST);

        let isSliderDragging = false;
        zoomSlider.addEventListener('pointerdown', () => isSliderDragging = true);
        zoomSlider.addEventListener('pointerup', () => isSliderDragging = false);

        const updateZoomSlider = () => {
            if (isSliderDragging) return;
            const dist = camera.position.distanceTo(controls.target);
            const clampedDist = Math.max(MIN_DIST, Math.min(MAX_DIST, dist));
            zoomSlider.value = 100 - ((Math.log(clampedDist) - minLog) / (maxLog - minLog)) * 100;
        };

        controls.addEventListener('change', updateZoomSlider);

        zoomSlider.addEventListener('input', (e) => {
            const logDist = minLog + ((100 - parseFloat(e.target.value)) / 100) * (maxLog - minLog);
            _v1.copy(camera.position).sub(controls.target).normalize();
            if (_v1.lengthSq() === 0) _v1.set(0, 1, 0); 
            _v1.multiplyScalar(Math.exp(logDist));
            camera.position.copy(controls.target).add(_v1);
            controls.update(); 
        });

        zoomSlider.addEventListener('wheel', (e) => {
            e.preventDefault(); e.stopPropagation(); 
            let currentVal = parseFloat(zoomSlider.value) + (e.deltaY < 0 ? 0.2 : -0.2);
            zoomSlider.value = Math.max(0, Math.min(100, currentVal));
            zoomSlider.dispatchEvent(new Event('input')); 
        }, { passive: false });
        
        updateZoomSlider();
    }

    // PENGATURAN CAHAYA & GROUP
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
    compassScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const compLight = new THREE.DirectionalLight(0xffffff, 1.5);
    compLight.position.set(1, 1, 1);
    compassScene.add(compLight);

    compassCamera = new THREE.OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 10);
    const compassGroup = new THREE.Group();
    compassScene.add(compassGroup);

    compassGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshPhongMaterial({ color: 0x888888 })));

    const northGeo = new THREE.ConeGeometry(0.15, 1, 16);
    northGeo.translate(0, 0.5, 0);
    const northMesh = new THREE.Mesh(northGeo, new THREE.MeshPhongMaterial({ color: 0xff3333 }));
    northMesh.rotation.x = -Math.PI / 2; 
    compassGroup.add(northMesh);

    const southMesh = new THREE.Mesh(northGeo, new THREE.MeshPhongMaterial({ color: 0xdddddd }));
    southMesh.rotation.x = Math.PI / 2; 
    compassGroup.add(southMesh);

    const ewMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), new THREE.MeshPhongMaterial({ color: 0xaaaaaa }));
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
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }));
        sprite.scale.set(0.4, 0.4, 1);
        sprite.renderOrder = 999;
        return sprite;
    }

    const labels = [
        { t: 'N', c: '#ff3333', p: [0, 0.1, -1.2] }, { t: 'S', c: '#ffffff', p: [0, 0.1, 1.2] },
        { t: 'E', c: '#aaaaaa', p: [1.1, 0.1, 0] }, { t: 'W', c: '#aaaaaa', p: [-1.1, 0.1, 0] }
    ];
    labels.forEach(l => {
        let lbl = createCompassLabel(l.t, l.c);
        lbl.position.set(...l.p);
        compassGroup.add(lbl);
    });

    const compassHitbox = document.createElement('div');
    compassHitbox.id = 'compass-hitbox';
    compassHitbox.className = 'absolute top-4 left-4 z-10 cursor-pointer rounded-full';
    compassHitbox.style.width = '100px'; compassHitbox.style.height = '100px';
    compassHitbox.title = 'Klik untuk reset ke Utara (Plan View)';
    container.parentElement.appendChild(compassHitbox);

    ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'contextmenu'].forEach(evt => compassHitbox.addEventListener(evt, e => e.stopPropagation()));

    compassHitbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const box = new THREE.Box3();
        let hasObj = false;

        appLayers.forEach(l => { if (l.visible && l.threeObject) { box.expandByObject(l.threeObject); hasObj = true; } });
        if (pitReserveGroup && pitReserveGroup.visible && pitReserveGroup.children.length > 0) {
            box.expandByObject(pitReserveGroup); hasObj = true;
        }

        if (!hasObj || box.isEmpty()) return;

        const center = box.getCenter(_v1);
        const maxDim = Math.max(box.getSize(_v2).x, box.getSize(_v2).z) || 100;
        let cameraDistance = Math.max(100, Math.abs(maxDim / 2 / Math.tan((camera.fov * Math.PI / 180) / 2)) * 1.5);
        
        controls.target.copy(center);
        camera.position.set(center.x, center.y + cameraDistance, center.z + 0.001);
        camera.up.set(0, 1, 0);
        camera.lookAt(center);
        controls.update();
        window.forceSingleRender(); // Pastikan render langsung
    });

    // ==========================================
    // RESIZE EVENT OPTIMIZATION
    // ==========================================
    window.addEventListener('resize', () => {
        cachedContainerW = container.clientWidth;
        cachedContainerH = container.clientHeight;

        camera.aspect = cachedContainerW / cachedContainerH;
        camera.updateProjectionMatrix();
        renderer.setSize(cachedContainerW, cachedContainerH);
        
        const gcpModal = document.getElementById('gcp-modal');
        if(gcpModal && !gcpModal.classList.contains('hidden')) {
            if(typeof resizeLeftCanvas === 'function') resizeLeftCanvas();
            if(typeof resizeRightCanvas === 'function') resizeRightCanvas();
        }

        const trackpad = document.getElementById('orbit-trackpad');
        if (trackpad && padCamera && padRenderer) {
            cachedTrackpadW = trackpad.clientWidth;
            cachedTrackpadH = trackpad.clientHeight;
            padCamera.aspect = cachedTrackpadW / cachedTrackpadH;
            padCamera.updateProjectionMatrix();
            padRenderer.setSize(cachedTrackpadW, cachedTrackpadH);
        }

        // [TAMBAHAN BARU]: Paksa render ulang 1 frame saat layar di-resize (seperti saat buka console)
        // Mencegah WebGL menampilkan layar hitam kosong saat sedang di-pause
        window.forceSingleRender();
    });
    
    container.addEventListener('contextmenu', (e) => { e.preventDefault(); });

    container.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && typeof window.onPointerDown === 'function') window.onPointerDown(e);
    });
    if (typeof window.onPointerMove === 'function') container.addEventListener('pointermove', window.onPointerMove);
    if (typeof window.onPointerUp === 'function') container.addEventListener('pointerup', window.onPointerUp);

    // ==========================================
    // RAYCASTING MIDDLE MOUSE OPTIMIZATION
    // ==========================================
    container.addEventListener('pointerdown', (e) => {
        if (e.button === 1) { 
            e.preventDefault(); 
            if (!window.is3DRenderingActive) return; 
            
            const rect = container.getBoundingClientRect();
            _v2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            _v2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(_v2D, camera);

            _raycastTargets.length = 0;
            if (pitReserveGroup && pitReserveGroup.visible) _raycastTargets.push(pitReserveGroup);
            appLayers.forEach(l => { if (l.visible && l.threeObject) _raycastTargets.push(l.threeObject); });

            const intersects = raycaster.intersectObjects(_raycastTargets, true); 
            
            if (intersects.length > 0) {
                orbitPivot.copy(intersects[0].point);
            } else {
                orbitPivot.copy(controls.target);
            }

            isCustomOrbiting = true;
            lastMousePos.x = e.clientX;
            lastMousePos.y = e.clientY;
            controls.enabled = false; 
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (isCustomOrbiting && window.is3DRenderingActive) {
            const rotationSpeed = 0.005; 
            const angleX = -(e.clientX - lastMousePos.x) * rotationSpeed;
            const angleY = -(e.clientY - lastMousePos.y) * rotationSpeed;
            lastMousePos.x = e.clientX; lastMousePos.y = e.clientY;

            _q1.setFromAxisAngle(_axisY, angleX); 
            camera.getWorldDirection(_v1); 
            _v2.crossVectors(camera.up, _v1.negate()).normalize(); 
            
            _q2.identity(); 
            if (_v2.lengthSq() > 0.001) _q2.setFromAxisAngle(_v2, angleY);
            _q3.multiplyQuaternions(_q1, _q2); 

            _v3.copy(camera.position).sub(orbitPivot).applyQuaternion(_q3);
            _v4.copy(orbitPivot).add(_v3); 

            _v5.copy(controls.target).sub(orbitPivot).applyQuaternion(_q3);
            _v6.copy(orbitPivot).add(_v5); 

            _v1.copy(_v6).sub(_v4).normalize(); 
            if (Math.abs(_v1.y) < 0.99) {
                camera.position.copy(_v4); controls.target.copy(_v6);
            } else {
                _v3.copy(camera.position).sub(orbitPivot).applyQuaternion(_q1);
                camera.position.copy(orbitPivot).add(_v3);
                _v5.copy(controls.target).sub(orbitPivot).applyQuaternion(_q1);
                controls.target.copy(orbitPivot).add(_v5);
            }
            camera.lookAt(controls.target);
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (e.button === 1 && isCustomOrbiting) { 
            isCustomOrbiting = false; controls.enabled = true; 
        }
    });

    // ==========================================
    // ORBIT PAD 3D CUBE SETUP
    // ==========================================
    const trackpad = document.getElementById('orbit-trackpad');
    if (trackpad) {
        padScene = new THREE.Scene();
        cachedTrackpadW = trackpad.clientWidth || 240; 
        cachedTrackpadH = trackpad.clientHeight || 160; 
        
        padCamera = new THREE.PerspectiveCamera(50, cachedTrackpadW / cachedTrackpadH, 0.1, 100);
        padCamera.position.z = 3;

        padRenderer = new THREE.WebGLRenderer({ antialias: !isMobileOrTablet, alpha: true });
        padRenderer.setSize(cachedTrackpadW, cachedTrackpadH);
        padRenderer.setPixelRatio(window.devicePixelRatio);
        trackpad.appendChild(padRenderer.domElement);

        function createFaceMaterial(text, bgColor) {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = bgColor; ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 124, 124);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);
            return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });
        }

        const cubeMaterials = [
            createFaceMaterial('RIGHT', '#0284c7'), createFaceMaterial('LEFT', '#0ea5e9'),   
            createFaceMaterial('TOP', '#16a34a'), createFaceMaterial('BOTTOM', '#22c55e'), 
            createFaceMaterial('FRONT', '#dc2626'), createFaceMaterial('BACK', '#ef4444')    
        ];
        
        padCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMaterials);
        padScene.add(padCube);

        let isPadOrbiting = false;
        let padLastX = 0, padLastY = 0;

        trackpad.addEventListener('pointerdown', (e) => {
            if (!window.is3DRenderingActive) return;
            isPadOrbiting = true; padLastX = e.clientX; padLastY = e.clientY;
            trackpad.setPointerCapture(e.pointerId); controls.enabled = false; 
        });

        trackpad.addEventListener('pointermove', (e) => {
            if (!isPadOrbiting || !window.is3DRenderingActive) return;
            const angleX = -(e.clientX - padLastX) * 0.01;
            const angleY = (e.clientY - padLastY) * 0.01; 
            padLastX = e.clientX; padLastY = e.clientY;

            _v1.copy(camera.position).sub(controls.target); 
            _v1.applyQuaternion(_q1.setFromAxisAngle(_axisY, angleX));
            _v2.copy(_v1).negate().normalize(); 
            _v3.crossVectors(camera.up, _v2).normalize(); 
            
            if (_v3.lengthSq() > 0.001) {
                _q2.setFromAxisAngle(_v3, angleY);
                _v4.copy(_v1).applyQuaternion(_q2); 
                if (Math.abs(_v4.normalize().y) < 0.99) _v1.copy(_v4.multiplyScalar(_v1.length()));
            }

            camera.position.copy(controls.target).add(_v1);
            camera.lookAt(controls.target);
            controls.update();
        });

        trackpad.addEventListener('pointerup', (e) => {
            isPadOrbiting = false; trackpad.releasePointerCapture(e.pointerId); controls.enabled = true;
        });
    }

    // ==========================================
    // KEYBOARD EVENT OPTIMIZATION (TERMASUK FORCE RENDER)
    // ==========================================
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { 
            e.preventDefault(); 
            window.undoLastRecord(); 
            window.forceSingleRender(); 
            return; 
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { 
            e.preventDefault(); 
            window.redoLastUndo(); 
            window.forceSingleRender(); 
            return; 
        }
        if (e.key === 'Escape' || e.key === 'Esc' || e.key.toLowerCase() === 'x') { 
            (typeof isDrawingPolygon !== 'undefined' && isDrawingPolygon) ? window.cancelPolygon() : window.resetSequenceAndView(); 
            window.forceSingleRender();
        }
        if (e.key.toLowerCase() === 'c' && typeof window.executeCenterPivot === 'function' && window.currentMousePos) {
            window.executeCenterPivot(window.currentMousePos);
            window.forceSingleRender();
        }
        if (e.key === 'Enter' && typeof isDrawingPolygon !== 'undefined' && isDrawingPolygon) {
            window.finishPolygonSelection();
            window.forceSingleRender();
        }
        
        if (e.key === 'Shift') {
            const mode = window.activeInteractionMode || 'select_bench';
            if (mode === 'select_bench') {
                raycaster.setFromCamera(mouse, camera);
                _checkArray.length = 0;
                for (let key in meshes) {
                    if (meshes[key].visible && pitReserveGroup.visible) _checkArray.push(meshes[key]);
                }
                window.handleHover(raycaster.intersectObjects(_checkArray, false), true);
                window.forceSingleRender();
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            const mode = window.activeInteractionMode || 'select_bench';
            if (mode === 'select_bench') {
                raycaster.setFromCamera(mouse, camera);
                _checkArray.length = 0;
                for (let key in meshes) {
                    if (meshes[key].visible && pitReserveGroup.visible) _checkArray.push(meshes[key]);
                }
                window.handleHover(raycaster.intersectObjects(_checkArray, false), false);
                window.forceSingleRender();
            }
        }
    });

    // Menjamin click pada UI / Checkbox yang berada di area panel yang di "pause" 
    // juga memicu paksa render agar tampilannya langsung termutakhir.
    window.addEventListener('click', () => {
        if (!window.is3DRenderingActive) {
            setTimeout(() => { window.forceSingleRender(); }, 10);
        }
    });

    // ==========================================
    // LOGIKA PAUSE / RESUME BERDASARKAN HOVER PANEL
    // ==========================================
    const panelsToPause = [
        'sequence-panel',         // Panel rekaman Pit
        'disp-sequence-panel',    // Panel rekaman Disposal
        'container-geometry',     // Panel floating Geometry di kanan
        'container-layerlist',    // Panel floating Drawings/Layerlist di kanan
        'container-control',      // Panel floating Control (Tools) di kanan
        'panel-geometry'          // Fallback sidebar Geometry
    ];

    panelsToPause.forEach(id => {
        const panel = document.getElementById(id);
        if (panel) {
            panel.addEventListener('mouseenter', window.pause3D);
            panel.addEventListener('mouseleave', window.resume3D);
        }
    });

    const canvasContainerDOM = document.getElementById('canvas-container');
    if (canvasContainerDOM) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => { entry.isIntersecting ? window.resume3D() : window.pause3D(); });
        }, { root: null, threshold: 0.01 }); 
        observer.observe(canvasContainerDOM);
    } else {
        window.resume3D(); 
    }
}

// ==========================================
// RENDER LOOP (ANIMATE) - ZERO LAYOUT THRASHING
// ==========================================
function animate() {
    if (!window.is3DRenderingActive) return;
    
    window.animationFrameId = requestAnimationFrame(animate);
    controls.update();

    renderer.setViewport(0, 0, cachedContainerW, cachedContainerH);
    renderer.clear();
    renderer.render(scene, camera);

    if (compassScene && compassCamera) {
        renderer.clearDepth(); 
        const compassSize = 100;
        renderer.setViewport(16, cachedContainerH - compassSize - 16, compassSize, compassSize);
        
        compassCamera.position.copy(camera.position).sub(controls.target).normalize().multiplyScalar(5);
        compassCamera.quaternion.copy(camera.quaternion);
        renderer.render(compassScene, compassCamera);
    }

    if (padScene && padCamera && padRenderer) {
        if (cachedTrackpadW > 0) {
            _v1.copy(camera.position).sub(controls.target).normalize().multiplyScalar(2.5);
            padCamera.position.copy(_v1);
            padCamera.quaternion.copy(camera.quaternion);
            padRenderer.render(padScene, padCamera);
        }
    }

    if(typeof updateLabels === 'function') updateLabels();
}