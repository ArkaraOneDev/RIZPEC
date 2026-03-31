// ==========================================
// GEOLOCATION & TRACKING SYSTEM
// Membutuhkan library eksternal: proj4.js (untuk konversi LatLon ke UTM)
// OPTIMIZED FOR MOBILE/TABLET (ZERO GC ALLOCATION)
// ==========================================

// [OPTIMASI MEMORI]: Variabel Global Daur Ulang agar tidak membebani RAM (GC Thrashing)
const _geoV2 = typeof THREE !== 'undefined' ? new THREE.Vector2() : null;
const _geoRayOrigin = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _geoRayDir = typeof THREE !== 'undefined' ? new THREE.Vector3(0, -1, 0) : null;
const _geoRaycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
const _geoCenter3D = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
const _geoBox = typeof THREE !== 'undefined' ? new THREE.Box3() : null;

window.AppGeolocation = {
    isTracking: false,
    watchId: null,
    markerGroup: null,
    headingCone: null,
    compassPermissionGranted: false, 
    hasWarnedDistance: false, 
    
    // --- VARIABEL THROTTLING ---
    lastCalcX: null,
    lastCalcZ: null,
    lastCalcElev: null,
    throttleDistance: 5.0, 
    // ------------------------------------
    
    epsgWgs84: "+proj=longlat +datum=WGS84 +no_defs",
    cachedRaycastTargets: null, // Cache target agar tidak traverse scene berulang kali

    init: function() {
        this.createMarker();
    },

    createMarker: function() {
        if (this.markerGroup) return;

        this.markerGroup = new THREE.Group();
        this.markerGroup.visible = false; 

        const sphereGeo = new THREE.SphereGeometry(6, 32, 32);
        const sphereMat = new THREE.MeshBasicMaterial({ 
            color: 0x2563EB, 
            depthTest: false, depthWrite: false, transparent: true, opacity: 1.0
        });
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        
        const glowGeo = new THREE.SphereGeometry(9, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0x60A5FA, 
            transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, 
            depthTest: false, depthWrite: false 
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);

        const coneGeo = new THREE.ConeGeometry(5, 16, 32);
        const coneMat = new THREE.MeshBasicMaterial({ 
            color: 0x3B82F6, 
            transparent: true, opacity: 0.9, depthTest: false, depthWrite: false 
        });
        this.headingCone = new THREE.Mesh(coneGeo, coneMat);
        this.headingCone.rotation.x = Math.PI / 2; 
        this.headingCone.position.set(0, 0, -12);

        this.markerGroup.add(sphereMesh);
        this.markerGroup.add(glowMesh);
        this.markerGroup.add(this.headingCone);
        
        this.markerGroup.traverse((child) => { child.frustumCulled = false; });
        
        sphereMesh.renderOrder = 1000;
        glowMesh.renderOrder = 999;
        this.headingCone.renderOrder = 1001;

        if (typeof scene !== 'undefined') scene.add(this.markerGroup);
    },

    checkActiveBounds: function() {
        if (!_geoBox) return { hasData: false, bounds: null };
        _geoBox.makeEmpty();
        let hasData = false;

        // Caching Target Raycaster saat tracking dimulai (Hemat Performa CPU)
        this.cachedRaycastTargets = [];

        if (typeof meshes !== 'undefined') {
            Object.values(meshes).forEach(m => {
                if (m.visible) {
                    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
                    // Gunakan fungsi applyMatrix4 ke box yang sudah di clone secara lokal (tidak terhindarkan, tapi dieksekusi 1x saat start tracking)
                    const box = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
                    _geoBox.union(box);
                    hasData = true;
                    this.cachedRaycastTargets.push(m);
                }
            });
        }

        if (typeof appLayers !== 'undefined') {
            appLayers.forEach(layer => {
                if (layer.type === 'dxf' && layer.visible && layer.threeObject) {
                    const box = new THREE.Box3().setFromObject(layer.threeObject);
                    if (!box.isEmpty()) {
                        _geoBox.union(box);
                        hasData = true;
                    }
                    if (layer.hasFaces) {
                        layer.threeObject.traverse(child => { if (child.isMesh) this.cachedRaycastTargets.push(child); });
                    }
                }
            });
        }

        return { hasData, bounds: _geoBox };
    },

    convertToThreeJS: function(lat, lon) {
        if (!window.worldOrigin || !window.worldOrigin.isSet || typeof proj4 === 'undefined' || !_geoV2) return null;

        const zone = Math.floor((lon + 180) / 6) + 1;
        const hemisphere = lat < 0 ? "+south " : "";
        const dynamicEpsgUtm = `+proj=utm +zone=${zone} ${hemisphere}+datum=WGS84 +units=m +no_defs`;

        const utmCoords = proj4(this.epsgWgs84, dynamicEpsgUtm, [lon, lat]);
        
        // [OPTIMASI MEMORI]: Gunakan objek Vektor daur ulang
        _geoV2.x = utmCoords[0] - window.worldOrigin.x;
        _geoV2.y = -utmCoords[1] - window.worldOrigin.z;

        return _geoV2;
    },

    getSurfaceElevation: function(x, z) {
        if (!_geoRaycaster || !_geoRayOrigin || !_geoRayDir || !this.cachedRaycastTargets || this.cachedRaycastTargets.length === 0) return null;

        // [OPTIMASI MEMORI]: Update nilai Raycaster yang sudah ada di RAM (Zero Allocation)
        _geoRayOrigin.set(x, 5000, z);
        _geoRaycaster.set(_geoRayOrigin, _geoRayDir);

        const intersects = _geoRaycaster.intersectObjects(this.cachedRaycastTargets, false);

        if (intersects.length > 0) return intersects[0].point.y; 
        return null; 
    },

    showWarningModal: function(dist, pEast, pNorth, uEast, uNorth) {
        const existing = document.getElementById('geo-warning-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'geo-warning-modal';
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4';
        
        modal.innerHTML = `
            <div class="bg-slate-800 border border-slate-600 rounded-lg p-5 max-w-sm w-full shadow-2xl scale-100 transition-transform">
                <div class="flex items-center gap-3 mb-4 text-rose-500">
                    <i class="fa-solid fa-triangle-exclamation text-2xl"></i>
                    <h3 class="text-base font-bold text-white leading-tight">Lokasi anda saat ini terlalu jauh</h3>
                </div>
                
                <div class="space-y-3 text-sm text-slate-300 bg-slate-900/50 p-4 rounded border border-slate-700 mb-4">
                    <div>
                        <span class="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Lokasi Project (Centroid)</span>
                        <span class="font-mono text-emerald-400">E: ${pEast.toFixed(2)}</span><br>
                        <span class="font-mono text-emerald-400">N: ${pNorth.toFixed(2)}</span>
                    </div>
                    <div>
                        <span class="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Lokasi Anda (GPS)</span>
                        <span class="font-mono text-blue-400">E: ${uEast.toFixed(2)}</span><br>
                        <span class="font-mono text-blue-400">N: ${uNorth.toFixed(2)}</span>
                    </div>
                    <div class="pt-2 border-t border-slate-700 mt-2">
                        <span class="block text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Jarak</span>
                        <span class="font-bold text-rose-400 text-lg">${(dist / 1000).toFixed(2)} KM</span>
                    </div>
                </div>

                <div class="text-center font-medium text-slate-300 text-sm mb-4">Geolocation dibatalkan</div>

                <button id="btn-geo-understand" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-4 rounded transition-colors flex justify-center items-center gap-2">
                    <i class="fa-solid fa-check"></i> Mengerti
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // [OPTIMASI MEMORI]: Gunakan named function untuk membersihkan event listener dengan rapi
        const btn = document.getElementById('btn-geo-understand');
        const cleanupAndClose = () => {
            btn.removeEventListener('click', cleanupAndClose);
            modal.remove();
        };
        btn.addEventListener('click', cleanupAndClose);
    },

    handleOrientation: function(event) {
        if (!window.AppGeolocation.isTracking || !window.AppGeolocation.headingCone) return;
        
        let heading = null;
        if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
            heading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
            heading = Math.abs(event.alpha - 360);
        }

        if (heading !== null) {
            let screenOrientation = 0;
            if (screen.orientation && screen.orientation.angle !== undefined) {
                screenOrientation = screen.orientation.angle;
            } else if (window.orientation !== undefined) {
                screenOrientation = window.orientation; 
            }
            
            heading += screenOrientation;
            window.AppGeolocation.markerGroup.rotation.y = -THREE.MathUtils.degToRad(heading);
        }
    },

    toggleTracking: function() {
        if (!this.isTracking) {
            const check = this.checkActiveBounds(); // Memanggil Caching Mesh Targets
            if (!check.hasData) {
                alert("Harap muat dan tampilkan Pit Data, Disposal Data, atau Polymesh DXF terlebih dahulu.");
                return false;
            }
            if (_geoCenter3D) check.bounds.getCenter(_geoCenter3D);
        }

        if (this.isTracking) {
            // STOP TRACKING
            navigator.geolocation.clearWatch(this.watchId);
            window.removeEventListener('deviceorientation', this.handleOrientation);
            this.markerGroup.visible = false;
            this.isTracking = false;
            this.hasWarnedDistance = false; 
            
            // Hapus cache array objek
            this.cachedRaycastTargets = null;
            
            this.lastCalcX = null;
            this.lastCalcZ = null;
            this.lastCalcElev = null;
            return false;
        }

        if (!navigator.geolocation) {
            alert("Browser Anda tidak mendukung Geolocation.");
            return false;
        }

        // START TRACKING
        this.isTracking = true;
        this.markerGroup.visible = true;
        this.markerGroup.rotation.y = 0;

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            if (!this.compassPermissionGranted) {
                DeviceOrientationEvent.requestPermission().then(permissionState => {
                    if (permissionState === 'granted') {
                        this.compassPermissionGranted = true;
                        window.addEventListener('deviceorientation', this.handleOrientation);
                    }
                }).catch(console.error);
            } else {
                window.addEventListener('deviceorientation', this.handleOrientation);
            }
        } else {
            window.addEventListener('deviceorientation', this.handleOrientation);
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const localCoords = this.convertToThreeJS(position.coords.latitude, position.coords.longitude);
                if (!localCoords || !_geoCenter3D || !_geoBox) return;

                const dxCenter = localCoords.x - _geoCenter3D.x;
                const dzCenter = localCoords.y - _geoCenter3D.z; 
                const distanceToCentroid = Math.sqrt(dxCenter * dxCenter + dzCenter * dzCenter);

                const isOutOfBounds = (localCoords.x < _geoBox.min.x || localCoords.x > _geoBox.max.x || localCoords.y < _geoBox.min.z || localCoords.y > _geoBox.max.z);

                let elevY = null;
                let shouldRecalculate = true;

                if (this.lastCalcX !== null && this.lastCalcZ !== null) {
                    const dx = localCoords.x - this.lastCalcX;
                    const dz = localCoords.y - this.lastCalcZ; 
                    if (Math.sqrt(dx * dx + dz * dz) < this.throttleDistance) {
                        shouldRecalculate = false; 
                        elevY = this.lastCalcElev; 
                    }
                }

                if (shouldRecalculate) {
                    elevY = this.getSurfaceElevation(localCoords.x, localCoords.y);
                    this.lastCalcX = localCoords.x;
                    this.lastCalcZ = localCoords.y;
                    this.lastCalcElev = elevY;
                }
                
                const isMiss = (elevY === null);

                if (distanceToCentroid > 50000 && isMiss) {
                    const projectEasting = _geoCenter3D.x + window.worldOrigin.x;
                    const projectNorthing = -_geoCenter3D.z - window.worldOrigin.z;
                    const userEasting = localCoords.x + window.worldOrigin.x;
                    const userNorthing = -localCoords.y - window.worldOrigin.z;

                    this.showWarningModal(distanceToCentroid, projectEasting, projectNorthing, userEasting, userNorthing);
                    
                    const geoToggleSwitchNode = document.getElementById('geo-location-toggle');
                    if (geoToggleSwitchNode) geoToggleSwitchNode.checked = false;
                    
                    this.toggleTracking();
                    return; 
                }

                let finalElevY = elevY;
                if (isMiss && isOutOfBounds) finalElevY = _geoBox.max.y !== -Infinity ? _geoBox.max.y + 100 : 100;
                else if (isMiss) finalElevY = 0; 
                
                this.markerGroup.position.set(localCoords.x, finalElevY + 6, localCoords.y);
            },
            (error) => {
                console.error("Geolocation Error:", error.message);
                if (error.code === 1) alert("Harap izinkan akses lokasi di browser Anda.");
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );

        return true;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(typeof THREE !== 'undefined') window.AppGeolocation.init(); }, 2000);
});