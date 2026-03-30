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
    
    // --- TAMBAHAN VARIABEL THROTTLING ---
    lastCalcX: null,
    lastCalcZ: null,
    lastCalcElev: null,
    throttleDistance: 5.0, // Batas jarak (meter) diturunkan menjadi 5 meter
    // ------------------------------------
    
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
        return null; // DIUBAH: Return null jika meleset (miss), bukan 0
    },

    // 5. Menampilkan Pop-up Warning Kustom UI
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

                <div class="text-center font-medium text-slate-300 text-sm mb-4">
                    Geolocation dibatalkan
                </div>

                <button id="btn-geo-understand" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-4 rounded transition-colors flex justify-center items-center gap-2">
                    <i class="fa-solid fa-check"></i> Mengerti
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Hapus modal jika tombol ditekan
        document.getElementById('btn-geo-understand').addEventListener('click', () => {
            modal.remove();
        });
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
            
            // --- RESET MEMORI THROTTLING ---
            this.lastCalcX = null;
            this.lastCalcZ = null;
            this.lastCalcElev = null;
            // -------------------------------
            
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

        // Hitung Titik Tengah (Centroid) dari Area Proyek 
        const center3D = new THREE.Vector3();
        bounds.getCenter(center3D);

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

                // Hitung seberapa jauh user dari CENTROID (Titik Tengah) tambang
                const dxCenter = localCoords.x - center3D.x;
                const dzCenter = localCoords.y - center3D.z; // localCoords.y adalah sumbu Z ThreeJS
                const distanceToCentroid = Math.sqrt(dxCenter * dxCenter + dzCenter * dzCenter);

                // Cek Out of bounds bounding box geometri
                let isOutOfBounds = false;
                if (localCoords.x < bounds.min.x || localCoords.x > bounds.max.x ||
                    localCoords.y < bounds.min.z || localCoords.y > bounds.max.z) {
                    isOutOfBounds = true;
                }

                // ==========================================
                // LOGIKA THROTTLING ELEVASI (Batas: 5 Meter)
                // ==========================================
                let elevY = null;
                let shouldRecalculate = true;

                // Hitung jarak dari posisi terakhir kalkulasi
                if (this.lastCalcX !== null && this.lastCalcZ !== null) {
                    const dx = localCoords.x - this.lastCalcX;
                    const dz = localCoords.y - this.lastCalcZ; 
                    const distMoved = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distMoved < this.throttleDistance) {
                        shouldRecalculate = false; // Belum bergeser sejauh throttle distance, skip raycast!
                        elevY = this.lastCalcElev; // Gunakan elevasi lama
                    }
                }

                if (shouldRecalculate) {
                    // Panggil fungsi raycaster yang berat HANYA jika diperlukan
                    elevY = this.getSurfaceElevation(localCoords.x, localCoords.y);
                    
                    // Simpan posisi dan elevasi terbaru untuk pengecekan berikutnya
                    this.lastCalcX = localCoords.x;
                    this.lastCalcZ = localCoords.y;
                    this.lastCalcElev = elevY;
                }
                // ==========================================
                
                const isMiss = (elevY === null);

                // --- POP-UP WARNING CUSTOM UI & AUTO SWITCH OFF ---
                // Jika lokasi lebih dari 50 KM dari centroid data, dan tidak menempel di polymesh manapun
                if (distanceToCentroid > 50000 && isMiss) {
                    
                    // Re-kalkulasi kembali ke Easting/Northing UTM untuk ditampilkan di Pop-up
                    const projectEasting = center3D.x + window.worldOrigin.x;
                    const projectNorthing = -center3D.z - window.worldOrigin.z;
                    
                    const userEasting = localCoords.x + window.worldOrigin.x;
                    const userNorthing = -localCoords.y - window.worldOrigin.z;

                    // Panggil pop up UI
                    this.showWarningModal(distanceToCentroid, projectEasting, projectNorthing, userEasting, userNorthing);
                    
                    // Matikan toggle switch di UI
                    const geoToggleSwitchNode = document.getElementById('geo-location-toggle');
                    if (geoToggleSwitchNode) geoToggleSwitchNode.checked = false;
                    
                    // Matikan Tracking di Background
                    this.toggleTracking();
                    return; // Hentikan eksekusi pergerakan marker saat ini
                }

                // Jika posisi diluar bounds dan raycaster meleset (karena tidak ada mesh di bawah kaki user),
                // Kita gantung markernya di udara pada posisi elevasi tertinggi polymesh.
                let finalElevY = elevY;
                if (isMiss && isOutOfBounds) {
                    finalElevY = bounds.max.y !== -Infinity ? bounds.max.y + 100 : 100;
                } else if (isMiss) {
                    finalElevY = 0; // fallback jika meleset tapi masih ada di dalam bounds area
                }
                
                // Animasi pergerakan marker (Offset +6 meter dari ground agar dasar bola tidak tenggelam)
                this.markerGroup.position.set(localCoords.x, finalElevY + 6, localCoords.y);

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