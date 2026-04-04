// ==========================================
// GEOLOCATION & TRACKING SYSTEM
// Membutuhkan library eksternal: proj4.js (untuk konversi LatLon ke UTM)
// OPTIMIZED FOR MOBILE/TABLET (ZERO GC ALLOCATION & MEMORY LEAK SAFE)
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
    manualZoneStr: null, // Override UTM Zone hasil pilihan dari Pop Up
    
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

    // [FIX GPU MEMORY LEAK]: Fungsi untuk membersihkan memori GPU saat scene direset
    dispose: function() {
        if (this.markerGroup) {
            // Hapus dari scene jika ada parent
            if (this.markerGroup.parent) {
                this.markerGroup.parent.remove(this.markerGroup);
            }
            
            // Traverse untuk membuang Geometri dan Material dari GPU secara total
            this.markerGroup.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            
            this.markerGroup = null;
            this.headingCone = null;
            this.cachedRaycastTargets = null;
        }
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

        let dynamicEpsgUtm = this.manualZoneStr;
        if (!dynamicEpsgUtm) {
            const zone = Math.floor((lon + 180) / 6) + 1;
            const hemisphere = lat < 0 ? "+south " : "";
            dynamicEpsgUtm = `+proj=utm +zone=${zone} ${hemisphere}+datum=WGS84 +units=m +no_defs`;
        }

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

    fetchLocationName: function(lat, lon, elementId) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
        fetch(url, { headers: { 'Accept-Language': 'id' } })
            .then(res => res.json())
            .then(data => {
                const elLocName = document.getElementById(elementId);
                if (elLocName) {
                    const locName = data.display_name || 'Lokasi tidak diketahui';
                    elLocName.innerText = locName;
                    elLocName.title = locName;
                }
            })
            .catch(err => {
                const elLocName = document.getElementById(elementId);
                if (elLocName) elLocName.innerText = 'Gagal memuat lokasi';
            });
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

    // 1. Membuka Pop Up Konfirmasi Sync
    openSyncModal: function() {
        const check = this.checkActiveBounds();
        if (!check.hasData) {
            alert("Harap muat dan tampilkan Pit Data, Disposal Data, atau Polymesh DXF terlebih dahulu.");
            return;
        }
        if (_geoCenter3D) check.bounds.getCenter(_geoCenter3D);

        const modal = document.getElementById('geo-sync-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
            // [OPTIMASI PERFORMA] Hentikan render 3D saat user mengetik angka atau memilih zona
            if (typeof window.pause3D === 'function') window.pause3D(); 
        }

        // Reset UI Modal Text
        const elProjZ = document.getElementById('sync-project-zone');
        const elProjE = document.getElementById('sync-project-e');
        const elProjN = document.getElementById('sync-project-n');
        const elProjLatLon = document.getElementById('sync-project-latlon');
        const elProjLocName = document.getElementById('sync-project-locname');
        const elUserZ = document.getElementById('sync-user-zone');
        const elUserE = document.getElementById('sync-user-e');
        const elUserN = document.getElementById('sync-user-n');
        const elUserLatLon = document.getElementById('sync-user-latlon');
        const elUserLocName = document.getElementById('sync-user-locname');
        const elDistance = document.getElementById('sync-distance');
        const statusContainer = document.getElementById('sync-status-container');
        
        if (elProjZ) elProjZ.innerText = '-';
        if (elProjE) elProjE.innerText = '-';
        if (elProjN) elProjN.innerText = '-';
        if (elProjLatLon) elProjLatLon.innerText = '-';
        if (elProjLocName) elProjLocName.innerText = '-';
        if (elUserZ) elUserZ.innerText = '-';
        if (elUserE) elUserE.innerText = '-';
        if (elUserN) elUserN.innerText = '-';
        if (elUserLatLon) elUserLatLon.innerText = '-';
        if (elUserLocName) elUserLocName.innerText = '-';
        if (elDistance) elDistance.innerText = '-';
        if (statusContainer) statusContainer.classList.add('hidden');
        
        const btnSync = document.getElementById('btn-start-sync');
        if (btnSync) btnSync.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Sync`;
        
        // Event listener untuk tombol penutup Modal
        const hideModal = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            
            // Lanjutkan render 3D saat pop up tertutup
            if (typeof window.resume3D === 'function') window.resume3D(); 
        };

        const btnClose = document.getElementById('close-geo-sync');
        const btnSuccess = document.getElementById('geo-status-success');
        const btnFail = document.getElementById('geo-status-fail');

        if (btnClose) btnClose.onclick = hideModal;
        if (btnSuccess) btnSuccess.onclick = hideModal;
        if (btnFail) btnFail.onclick = hideModal;

        if (btnSync) {
            btnSync.onclick = () => {
                const zoneNum = document.getElementById('geo-utm-zone-num').value;
                const hemisphere = document.getElementById('geo-utm-hemisphere').value;
                if (!zoneNum) return;
                const zoneVal = zoneNum + hemisphere;
                this.startTracking(zoneVal, modal);
            };
        }
    },

    // 2. Memberhentikan Tracking
    stopTracking: function() {
        if (!this.isTracking) return;
        
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        window.removeEventListener('deviceorientation', this.handleOrientation);
        
        if (this.markerGroup) this.markerGroup.visible = false;
        
        this.isTracking = false;
        this.hasWarnedDistance = false; 
        
        this.cachedRaycastTargets = null;
        this.lastCalcX = null;
        this.lastCalcZ = null;
        this.lastCalcElev = null;

        // Force UI to Update OFF
        const geoToggleSwitchNode = document.getElementById('geo-location-toggle');
        if (geoToggleSwitchNode) geoToggleSwitchNode.checked = false;
        if (typeof syncGeoUI === 'function') syncGeoUI();
    },

    // 3. Memulai Meminta Izin Lokasi dan Menjalankan Tracking berdasarkan Pilihan Modal
    startTracking: function(zoneVal, modalElement) {
        if (!navigator.geolocation) {
            alert("Browser Anda tidak mendukung Geolocation.");
            return;
        }

        const btnSync = document.getElementById('btn-start-sync');
        if (btnSync) btnSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Syncing...`;

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

        // Setup zona UTM Manual (Aturan dari Modal)
        if (zoneVal) {
            const zNum = parseInt(zoneVal);
            const isSouth = zoneVal.toUpperCase().includes('S');
            const hemisphere = isSouth ? "+south " : "";
            this.manualZoneStr = `+proj=utm +zone=${zNum} ${hemisphere}+datum=WGS84 +units=m +no_defs`;
        } else {
            this.manualZoneStr = null;
        }

        // Cek lokasi awal agar bisa merender di UI modal
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const success = this.processPosition(position, true, modalElement);
                
                if (success) {
                    // Menyiapkan perulangan Geolocation Watch
                    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
                    this.watchId = navigator.geolocation.watchPosition(
                        (pos) => this.processPosition(pos, false, null),
                        (error) => console.error("Geolocation Error:", error.message),
                        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                    );

                    this.isTracking = true;
                    if (this.markerGroup) {
                        this.markerGroup.visible = true;
                        this.markerGroup.rotation.y = 0;
                    }

                    // Update UI Toggle Toolbar (Force to ON)
                    const geoToggleSwitchNode = document.getElementById('geo-location-toggle');
                    if (geoToggleSwitchNode) geoToggleSwitchNode.checked = true;
                    if (typeof syncGeoUI === 'function') syncGeoUI();
                    
                    if (btnSync) btnSync.innerHTML = `<i class="fa-solid fa-check"></i> Synced`;
                    
                    // Modal otomatis ditutup sedikit delay agar User dapat melihat result koordinatnya
                    setTimeout(() => {
                        if (modalElement) {
                            modalElement.classList.add('hidden');
                            modalElement.classList.remove('flex');
                            
                            // Lanjutkan render 3D saat pop up tertutup secara otomatis
                            if (typeof window.resume3D === 'function') window.resume3D();
                        }
                    }, 1500);
                } else {
                    if (btnSync) btnSync.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Try Again`;
                }
            },
            (error) => {
                console.error("Geolocation Error:", error.message);
                if (error.code === 1) alert("Harap izinkan akses lokasi di browser Anda untuk menggunakan fitur ini.");
                if (btnSync) btnSync.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> Start Sync`;
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    },

    // 4. Update Koordinat dan Hitung Jarak Terhadap Mesh yang Ter-render
    processPosition: function(position, isInitialSync, modalElement) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        if (!window.worldOrigin || !window.worldOrigin.isSet || typeof proj4 === 'undefined' || !_geoV2) return false;

        // --- UTM ZONE PROJECT ---
        let dynamicEpsgUtm = this.manualZoneStr;
        if (!dynamicEpsgUtm) {
            const zone = Math.floor((lon + 180) / 6) + 1;
            const hemisphere = lat < 0 ? "+south " : "";
            dynamicEpsgUtm = `+proj=utm +zone=${zone} ${hemisphere}+datum=WGS84 +units=m +no_defs`;
        }

        // --- UTM ZONE USER REAL ---
        const userZoneNum = Math.floor((lon + 180) / 6) + 1;
        const userIsSouth = lat < 0;
        const userHemispherePrefix = userIsSouth ? "+south " : "";
        const userEpsgUtm = `+proj=utm +zone=${userZoneNum} ${userHemispherePrefix}+datum=WGS84 +units=m +no_defs`;

        // 1. Proyeksi Lokasi User ke Zone Project (Untuk dirender ke Canvas 3D)
        const utmCoordsInProjectZone = proj4(this.epsgWgs84, dynamicEpsgUtm, [lon, lat]);
        
        // 2. Proyeksi Lokasi User ke Zone Aktual (Untuk UI Lokasi Anda & Perhitungan Jarak Sama Zona)
        const utmCoordsInUserZone = proj4(this.epsgWgs84, userEpsgUtm, [lon, lat]);
        const displayUserEasting = utmCoordsInUserZone[0];
        const displayUserNorthing = utmCoordsInUserZone[1];

        // 3D Rendering Calculations
        _geoV2.x = utmCoordsInProjectZone[0] - window.worldOrigin.x;
        _geoV2.y = -utmCoordsInProjectZone[1] - window.worldOrigin.z;

        const localCoords = _geoV2;
        if (!_geoCenter3D || !_geoBox) return false;

        const dxCenter = localCoords.x - _geoCenter3D.x;
        const dzCenter = localCoords.y - _geoCenter3D.z; 
        const distanceToCentroid = Math.sqrt(dxCenter * dxCenter + dzCenter * dzCenter);

        const projectEasting = _geoCenter3D.x + window.worldOrigin.x;
        const projectNorthing = -_geoCenter3D.z - window.worldOrigin.z;
        
        // Reverse projection untuk mendapat Project Lat/Lon
        const projLatLon = proj4(dynamicEpsgUtm, this.epsgWgs84, [projectEasting, projectNorthing]);
        const pLon = projLatLon[0];
        const pLat = projLatLon[1];

        // Format Teks Zone Project
        const zoneMatch = dynamicEpsgUtm.match(/\+zone=(\d+)/);
        const projectIsSouth = dynamicEpsgUtm.includes('+south');
        const projectZoneNumStr = zoneMatch ? zoneMatch[1] : '-';
        const projectDisplayZone = zoneMatch ? `${projectZoneNumStr} ${projectIsSouth ? 'South' : 'North'}` : '-';

        // Format Teks Zone User
        const userDisplayZone = `${userZoneNum} ${userIsSouth ? 'South' : 'North'}`;

        // --- KOREKSI PERHITUNGAN JARAK ---
        let distanceToCentroidEuclid = 0;
        const isSameZone = (parseInt(projectZoneNumStr) === userZoneNum) && (projectIsSouth === userIsSouth);

        if (isSameZone) {
            // Jika zona sama, gunakan jarak Euclidean (Pythagoras) UTM
            const dx = displayUserEasting - projectEasting;
            const dy = displayUserNorthing - projectNorthing;
            distanceToCentroidEuclid = Math.sqrt(dx * dx + dy * dy);
        } else {
            // Jika zona berbeda, gunakan Haversine Formula dari titik Lat/Lon
            const R = 6371e3; // Radius bumi dalam meter
            const f1 = pLat * Math.PI/180;
            const f2 = lat * Math.PI/180;
            const df = (lat - pLat) * Math.PI/180;
            const dl = (lon - pLon) * Math.PI/180;
            const a = Math.sin(df/2) * Math.sin(df/2) + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2) * Math.sin(dl/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distanceToCentroidEuclid = R * c;
        }

        // Cek jika jarak di luar toleransi (50km)
        const isFar = distanceToCentroidEuclid > 50000;

        // Render UI di Pop Up jika ini Initial Sync atau modal terbuka
        if (modalElement || isInitialSync) {
            const elProjZ = document.getElementById('sync-project-zone');
            const elProjE = document.getElementById('sync-project-e');
            const elProjN = document.getElementById('sync-project-n');
            const elProjLatLon = document.getElementById('sync-project-latlon');
            const elProjLocName = document.getElementById('sync-project-locname');
            const elUserZ = document.getElementById('sync-user-zone');
            const elUserE = document.getElementById('sync-user-e');
            const elUserN = document.getElementById('sync-user-n');
            const elUserLatLon = document.getElementById('sync-user-latlon');
            const elUserLocName = document.getElementById('sync-user-locname');
            const elDistance = document.getElementById('sync-distance');
            const statusContainer = document.getElementById('sync-status-container');
            const elSuccess = document.getElementById('geo-status-success');
            const elFail = document.getElementById('geo-status-fail');

            // Format UI Jarak
            let formattedDistance = '-';
            if (distanceToCentroidEuclid >= 1000) {
                formattedDistance = (distanceToCentroidEuclid / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
            } else {
                formattedDistance = distanceToCentroidEuclid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
            }

            if (elProjZ) elProjZ.innerText = projectDisplayZone;
            if (elProjE) elProjE.innerText = projectEasting.toFixed(2);
            if (elProjN) elProjN.innerText = projectNorthing.toFixed(2);
            if (elProjLatLon) elProjLatLon.innerText = `${pLat.toFixed(6)}, ${pLon.toFixed(6)}`;
            
            if (elUserZ) elUserZ.innerText = userDisplayZone;
            if (elUserE) elUserE.innerText = displayUserEasting.toFixed(2); // Menggunakan User Real Zone
            if (elUserN) elUserN.innerText = displayUserNorthing.toFixed(2); // Menggunakan User Real Zone
            if (elUserLatLon) elUserLatLon.innerText = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            
            if (elDistance) elDistance.innerText = formattedDistance;
            
            if (isInitialSync) {
                if (elProjLocName) elProjLocName.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
                if (elUserLocName) elUserLocName.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
                this.fetchLocationName(pLat, pLon, 'sync-project-locname');
                this.fetchLocationName(lat, lon, 'sync-user-locname');
            }

            if (statusContainer) {
                statusContainer.classList.remove('hidden');
                if (isFar) {
                    if (elSuccess) elSuccess.classList.add('hidden');
                    if (elFail) elFail.classList.remove('hidden');
                } else {
                    if (elSuccess) elSuccess.classList.remove('hidden');
                    if (elFail) elFail.classList.add('hidden');
                }
            }
        }

        // Return false/berhenti jika jaraknya terlalu jauh
        if (isFar) {
            if (!isInitialSync) this.stopTracking();
            return false;
        }

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

        let finalElevY = elevY;
        if (isMiss && isOutOfBounds) finalElevY = _geoBox.max.y !== -Infinity ? _geoBox.max.y + 100 : 100;
        else if (isMiss) finalElevY = 0; 
        
        if (this.markerGroup) {
            this.markerGroup.position.set(localCoords.x, finalElevY + 6, localCoords.y);
        }

        return true;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(typeof THREE !== 'undefined') window.AppGeolocation.init(); }, 2000);
});