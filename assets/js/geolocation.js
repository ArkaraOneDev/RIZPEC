// ==========================================
// GEOLOCATION & TRACKING SYSTEM
// Membutuhkan library eksternal: proj4.js (untuk konversi LatLon ke UTM)
// ==========================================

window.AppGeolocation = {
    isTracking: false,
    watchId: null,
    markerGroup: null,
    headingCone: null,
    compassPermissionGranted: false, // Mencegah prompt kompas berulang
    hasWarnedDistance: false, // Mencegah alert out-of-bounds muncul terus-menerus
    
    // Proyeksi dasar GPS (WGS84 Lat/Lon)
    epsgWgs84: "+proj=longlat +datum=WGS84 +no_defs",

    init: function() {
        this.createMarker();
    },

    // 1. Membuat Marker 3D (Bola Biru Glow + Cone)
    createMarker: function() {
        if (this.markerGroup) return;

        this.markerGroup = new THREE.Group();
        this.markerGroup.visible = false; 

        // --- BOLA BIRU UTAMA ---
        const sphereGeo = new THREE.SphereGeometry(6, 32, 32);
        const sphereMat = new THREE.MeshBasicMaterial({ 
            color: 0x2563EB, // Biru pekat
            depthTest: false, 
            depthWrite: false, 
            transparent: true,
            opacity: 1.0
        });
        const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
        
        // --- EFEK GLOW (BOLA LEBIH BESAR DENGAN ADDITIVE BLENDING) ---
        const glowGeo = new THREE.SphereGeometry(9, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0x60A5FA, // Biru muda terang
            transparent: true, 
            opacity: 0.5, 
            blending: THREE.AdditiveBlending, // Membuat efek cahaya berpendar
            depthTest: false, 
            depthWrite: false 
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);

        // --- CONE PENUNJUK ARAH (DIPERBESAR & DIPERBAIKI) ---
        const coneGeo = new THREE.ConeGeometry(5, 16, 32);
        const coneMat = new THREE.MeshBasicMaterial({ 
            color: 0x3B82F6, 
            transparent: true, 
            opacity: 0.9, 
            depthTest: false, 
            depthWrite: false 
        });
        this.headingCone = new THREE.Mesh(coneGeo, coneMat);
        // Putar cone agar ujung lancipnya menunjuk lurus ke arah depan (sumbu -Z)
        this.headingCone.rotation.x = Math.PI / 2; 
        // Posisikan tepat menempel di depan bola
        this.headingCone.position.set(0, 0, -12);

        // Rangkai marker ke dalam grup utama (Y = 0 karena grup akan diangkat saat update posisi)
        this.markerGroup.add(sphereMesh);
        this.markerGroup.add(glowMesh);
        this.markerGroup.add(this.headingCone);
        
        // Matikan Culling agar objek glow tidak tiba-tiba menghilang di pinggir kamera
        this.markerGroup.traverse((child) => {
            child.frustumCulled = false;
        });
        
        // RenderOrder dipasang ke setiap Mesh agar fungsi tembus pandang (Overlay) bekerja maksimal
        sphereMesh.renderOrder = 1000;
        glowMesh.renderOrder = 999;
        this.headingCone.renderOrder = 1001;

        if (typeof scene !== 'undefined') {
            scene.add(this.markerGroup);
        }
    },

    // 2. Mengecek apakah ada Geometri yang aktif dan mengkalkulasi Bounds
    checkActiveBounds: function() {
        const globalBox = new THREE.Box3();
        let hasData = false;

        if (typeof meshes !== 'undefined') {
            Object.values(meshes).forEach(m => {
                if (m.visible) {
                    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
                    const box = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
                    globalBox.expandByPoint(box.min);
                    globalBox.expandByPoint(box.max);
                    hasData = true;
                }
            });
        }

        if (typeof appLayers !== 'undefined') {
            appLayers.filter(l => l.type === 'dxf' && l.visible && l.threeObject).forEach(layer => {
                const box = new THREE.Box3().setFromObject(layer.threeObject);
                if (!box.isEmpty()) {
                    globalBox.expandByPoint(box.min);
                    globalBox.expandByPoint(box.max);
                    hasData = true;
                }
            });
        }

        return { hasData, bounds: globalBox };
    },

    // 3. Konversi Dinamis Lat/Lon GPS ke Titik UTM -> Three.js
    convertToThreeJS: function(lat, lon) {
        if (!window.worldOrigin || !window.worldOrigin.isSet) {
            console.error("[Geolocation] World Origin belum diset. Geometry belum dimuat!");
            return null;
        }
        if (typeof proj4 === 'undefined') {
            console.error("[Geolocation] Library proj4.js belum dimuat!");
            return null;
        }

        // --- MENGHITUNG ZONA UTM SECARA DINAMIS ---
        // Rumus Zona UTM berdasarkan Longitude
        const zone = Math.floor((lon + 180) / 6) + 1;
        
        // Cek Hemisphere (Utara atau Selatan)
        const isSouth = lat < 0;
        const hemisphere = isSouth ? "+south " : "";

        // Merakit definisi EPSG UTM secara dinamis
        const dynamicEpsgUtm = `+proj=utm +zone=${zone} ${hemisphere}+datum=WGS84 +units=m +no_defs`;

        // Konversi LatLon ke Easting Northing UTM menggunakan definisi dinamis
        const utmCoords = proj4(this.epsgWgs84, dynamicEpsgUtm, [lon, lat]);
        const easting = utmCoords[0];
        const northing = utmCoords[1];

        // Sumbu Z di Three.js adalah -Northing
        const x = easting - window.worldOrigin.x;
        const z = -northing - window.worldOrigin.z;

        return new THREE.Vector2(x, z);
    },

    // 4. Raycaster untuk mencari Elevasi permukaan yang menempel
    getSurfaceElevation: function(x, z) {
        const rayOrigin = new THREE.Vector3(x, 5000, z);
        const rayDirection = new THREE.Vector3(0, -1, 0);
        const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);

        let targets = [];
        
        if (typeof meshes !== 'undefined') {
            Object.values(meshes).forEach(m => { if(m.visible) targets.push(m); });
        }
        if (typeof appLayers !== 'undefined') {
            appLayers.filter(l => l.type === 'dxf' && l.visible && l.threeObject && l.hasFaces).forEach(layer => {
                layer.threeObject.traverse(child => { if(child.isMesh) targets.push(child); });
            });
        }

        const intersects = raycaster.intersectObjects(targets, false);

        if (intersects.length > 0) {
            return intersects[0].point.y; 
        }
        return 0; // Miss
    },

    // Update Arah Kompas (Device Orientation)
    handleOrientation: function(event) {
        if (!window.AppGeolocation.isTracking || !window.AppGeolocation.headingCone) return;
        
        let heading = null;

        // Validasi ketat untuk menghindari nilai null yang membuat angle menjadi 360 (terkunci ke Utara)
        if (event.webkitCompassHeading !== undefined && event.webkitCompassHeading !== null) {
            heading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
            heading = Math.abs(event.alpha - 360);
        }

        if (heading !== null) {
            // --- PERBAIKAN: Kompensasi Orientasi Layar (Portrait/Landscape) ---
            let screenOrientation = 0;
            if (screen.orientation && screen.orientation.angle !== undefined) {
                screenOrientation = screen.orientation.angle;
            } else if (window.orientation !== undefined) {
                screenOrientation = window.orientation; // Fallback untuk iPad/iOS lawas
            }
            
            // Tambahkan sudut orientasi layar ke heading aktual perangkat
            heading += screenOrientation;

            const headingRad = THREE.MathUtils.degToRad(heading);
            window.AppGeolocation.markerGroup.rotation.y = -headingRad;
        }
    },

    // Fungsi Utama Toggle Tracking
    toggleTracking: function() {
        const { hasData, bounds } = this.checkActiveBounds();

        if (!hasData) {
            alert("Harap muat dan tampilkan Pit Data, Disposal Data, atau Polymesh DXF terlebih dahulu.");
            return false;
        }

        if (this.isTracking) {
            // STOP TRACKING
            navigator.geolocation.clearWatch(this.watchId);
            window.removeEventListener('deviceorientation', this.handleOrientation);
            this.markerGroup.visible = false;
            this.isTracking = false;
            this.hasWarnedDistance = false; // Reset warning saat dimatikan
            return false;
        }

        if (!navigator.geolocation) {
            alert("Browser Anda tidak mendukung Geolocation.");
            return false;
        }

        // START TRACKING
        this.isTracking = true;
        this.markerGroup.visible = true;
        // Default hadap lurus ke depan (layar atas) jika digunakan di desktop/tanpa sensor
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
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                const localCoords = this.convertToThreeJS(lat, lon);
                if (!localCoords) return;

                // Hitung seberapa jauh user dari area pusat tambang (0,0)
                const distanceToMine = Math.sqrt(localCoords.x * localCoords.x + localCoords.y * localCoords.y);
                
                // Jika user lebih dari 50 KM (50.000 unit), kamera 3D Three.js akan men-clip (menyembunyikan) marker.
                if (distanceToMine > 50000) {
                    if (!this.hasWarnedDistance) {
                        alert(`PERHATIAN!\nLokasi Anda saat ini berjarak ${(distanceToMine/1000).toFixed(1)} KM dari tambang.\nMarker tidak akan terlihat karena berada di luar jarak maksimal pandang kamera 3D.`);
                        this.hasWarnedDistance = true;
                    }
                }

                // Cek Out of bounds bounding box geometri
                let isOutOfBounds = false;
                if (localCoords.x < bounds.min.x || localCoords.x > bounds.max.x ||
                    localCoords.y < bounds.min.z || localCoords.y > bounds.max.z) {
                    isOutOfBounds = true;
                }

                let elevY = this.getSurfaceElevation(localCoords.x, localCoords.y);
                
                // Jika posisi diluar bounds dan raycaster meleset (karena tidak ada mesh di bawah kaki user),
                // Kita gantung markernya di udara pada posisi elevasi tertinggi polymesh.
                if (elevY === 0 && isOutOfBounds) {
                    elevY = bounds.max.y !== -Infinity ? bounds.max.y + 100 : 100;
                }
                
                // Animasi pergerakan marker (Offset +6 meter dari ground agar dasar bola tidak tenggelam)
                this.markerGroup.position.set(localCoords.x, elevY + 6, localCoords.y);

                // PERBAIKAN: Pemanggilan renderer.render() secara sinkron dari sini DIHAPUS 
                // untuk mencegah konflik memori GPU (WebGL Context Lost) ketika render DXF.
                // Main.js secara otomatis akan me-render pergerakan marker ini di frame berikutnya.
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

// Auto Init jika Three.js sudah siap
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if(typeof THREE !== 'undefined') window.AppGeolocation.init(); }, 2000);
});