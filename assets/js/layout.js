// ==========================================
// UI & LAYOUT LOGIC
// ==========================================
const LAYOUT_KEYS = {
    geolocation: 'rk_layout_geolocation', 
    geo: 'rk_layout_geo', 
    layer: 'rk_layout_layer', 
    info: 'rk_layout_info', 
    control: 'rk_layout_control', 
    orbit: 'rk_layout_orbit'
};

const toggleGeolocation = document.getElementById('cb-layout-geolocation');
const toggleGeo = document.getElementById('cb-layout-geo');
const toggleLayerList = document.getElementById('cb-layout-layer');
const toggleInfo = document.getElementById('cb-layout-info');
const toggleControl = document.getElementById('cb-layout-helper');
const toggleOrbit = document.getElementById('cb-layout-orbit');

const containerGeolocation = document.getElementById('container-geolocation');
const containerGeo = document.getElementById('container-geometry');
const containerLayerList = document.getElementById('container-layerlist');
const containerInfo = document.getElementById('container-info');
const containerControl = document.getElementById('container-control');
const containerOrbit = document.getElementById('container-orbit');

function initLayout() {
    const getLayoutState = (key, defaultVal) => {
        const val = localStorage.getItem(key);
        return val !== null ? val === 'true' : defaultVal;
    };

    // [PERBAIKAN]: Default container dikembalikan ke true agar panelnya tidak hilang
    const geolocationState = getLayoutState(LAYOUT_KEYS.geolocation, true);
    const geoState = getLayoutState(LAYOUT_KEYS.geo, true);
    const layerState = getLayoutState(LAYOUT_KEYS.layer, true);
    const infoState = getLayoutState(LAYOUT_KEYS.info, true);
    const controlState = getLayoutState(LAYOUT_KEYS.control, true);
    const orbitState = getLayoutState(LAYOUT_KEYS.orbit, true);

    if (toggleGeolocation) toggleGeolocation.checked = geolocationState;
    if (toggleGeo) toggleGeo.checked = geoState;
    if (toggleLayerList) toggleLayerList.checked = layerState;
    if (toggleInfo) toggleInfo.checked = infoState;
    if (toggleControl) toggleControl.checked = controlState;
    if (toggleOrbit) toggleOrbit.checked = orbitState;

    if (containerGeolocation) {
        geolocationState ? containerGeolocation.classList.remove('hidden') : containerGeolocation.classList.add('hidden');
        geolocationState ? containerGeolocation.classList.add('flex') : containerGeolocation.classList.remove('flex');
    }

    if (containerGeo) {
        geoState ? containerGeo.classList.remove('hidden') : containerGeo.classList.add('hidden');
        geoState ? containerGeo.classList.add('flex') : containerGeo.classList.remove('flex');
        
        // Memastikan tinggi panel geometry visible & menyesuaikan isinya
        containerGeo.classList.remove('flex-1', 'min-h-0');
        containerGeo.style.maxHeight = 'none';
        containerGeo.style.height = 'auto';
    }
    
    if (containerLayerList) {
        layerState ? containerLayerList.classList.remove('hidden') : containerLayerList.classList.add('hidden');
        layerState ? containerLayerList.classList.add('flex') : containerLayerList.classList.remove('flex');
    }
    
    if (containerInfo) {
        infoState ? containerInfo.classList.remove('hidden') : containerInfo.classList.add('hidden');
        infoState ? containerInfo.classList.add('flex') : containerInfo.classList.remove('flex');
    }
    
    if (containerControl) {
        controlState ? containerControl.classList.remove('hidden') : containerControl.classList.add('hidden');
        controlState ? containerControl.classList.add('flex') : containerControl.classList.remove('flex');
    }
    
    if (containerOrbit) {
        orbitState ? containerOrbit.classList.remove('hidden') : containerOrbit.classList.add('hidden');
        orbitState ? containerOrbit.classList.add('flex') : containerOrbit.classList.remove('flex');
    }

    // Jalankan cek ketersediaan data saat pertama kali muat
    setTimeout(() => {
        if (typeof window.updateGeolocationState === 'function') window.updateGeolocationState();
    }, 500);
}

document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown-content').forEach(dc => {
            if (dc !== btn.nextElementSibling) dc.classList.add('hidden');
        });
        btn.nextElementSibling.classList.toggle('hidden');
    });
});

document.addEventListener('click', (e) => {
    document.querySelectorAll('.dropdown-content').forEach(dc => dc.classList.add('hidden'));
});

document.querySelectorAll('.dropdown-content').forEach(dc => {
    dc.addEventListener('click', e => e.stopPropagation()); 
});

// [PERBAIKAN]: Menghilangkan disabled logic pada layout toggle (cb-layout-geolocation)
if (toggleGeolocation) {
    toggleGeolocation.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerGeolocation.classList.remove('hidden') : containerGeolocation.classList.add('hidden');
        state ? containerGeolocation.classList.add('flex') : containerGeolocation.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.geolocation, state);
    });
}
if (toggleGeo) {
    toggleGeo.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerGeo.classList.remove('hidden') : containerGeo.classList.add('hidden');
        state ? containerGeo.classList.add('flex') : containerGeo.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.geo, state);
    });
}
if (toggleLayerList) {
    toggleLayerList.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerLayerList.classList.remove('hidden') : containerLayerList.classList.add('hidden');
        state ? containerLayerList.classList.add('flex') : containerLayerList.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.layer, state);
    });
}
if (toggleInfo) {
    toggleInfo.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerInfo.classList.remove('hidden') : containerInfo.classList.add('hidden');
        state ? containerInfo.classList.add('flex') : containerInfo.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.info, state);
    });
}
if (toggleControl) {
    toggleControl.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerControl.classList.remove('hidden') : containerControl.classList.add('hidden');
        state ? containerControl.classList.add('flex') : containerControl.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.control, state);
    });
}
if (toggleOrbit) {
    toggleOrbit.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerOrbit.classList.remove('hidden') : containerOrbit.classList.add('hidden');
        state ? containerOrbit.classList.add('flex') : containerOrbit.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.orbit, state);
    });
}

// ==========================================
// GEOLOCATION UI LOGIC & VALIDATION
// ==========================================

window.updateGeolocationState = function() {
    let hasData = false;

    if (typeof window.AppGeolocation !== 'undefined' && typeof window.AppGeolocation.checkActiveBounds === 'function') {
        hasData = window.AppGeolocation.checkActiveBounds().hasData;
    } else if (typeof appLayers !== 'undefined') {
        hasData = appLayers.some(l => (l.type === 'csv' || l.type === 'dxf') && l.visible && l.threeObject);
    }

    const geoToggleSwitch = document.getElementById('geo-location-toggle');
    if (geoToggleSwitch) {
        geoToggleSwitch.disabled = !hasData;
        const wrapper = geoToggleSwitch.closest('.bg-slate-900\\/50') || geoToggleSwitch.parentElement.parentElement;
        
        if (!hasData) {
            if (wrapper) wrapper.classList.add('opacity-50', 'pointer-events-none');
            geoToggleSwitch.classList.add('cursor-not-allowed');
            
            if (geoToggleSwitch.checked) {
                geoToggleSwitch.checked = false;
                if (typeof window.AppGeolocation !== 'undefined' && window.AppGeolocation.isTracking) {
                    window.AppGeolocation.toggleTracking();
                }
            }
        } else {
            if (wrapper) wrapper.classList.remove('opacity-50', 'pointer-events-none');
            geoToggleSwitch.classList.remove('cursor-not-allowed');
        }
    }

    const btnTrack = document.getElementById('btn-start-tracking');
    if (btnTrack) {
        btnTrack.disabled = !hasData;
        if (!hasData) {
            btnTrack.classList.add('opacity-50', 'cursor-not-allowed');
            if (typeof window.AppGeolocation !== 'undefined' && window.AppGeolocation.isTracking) {
                window.AppGeolocation.toggleTracking();
                btnTrack.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Tracking';
                btnTrack.classList.remove('bg-rose-600', 'hover:bg-rose-500');
                btnTrack.classList.add('bg-blue-600', 'hover:bg-blue-500');
            }
        } else {
            btnTrack.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
};

const geoToggleSwitchNode = document.getElementById('geo-location-toggle');
if (geoToggleSwitchNode) {
    geoToggleSwitchNode.addEventListener('change', (e) => {
        if (geoToggleSwitchNode.disabled) {
            e.preventDefault();
            e.target.checked = false;
            return;
        }

        if (typeof window.AppGeolocation === 'undefined') {
            alert("Modul Geolocation belum dimuat dengan sempurna.");
            e.target.checked = false;
            return;
        }

        const isActive = window.AppGeolocation.toggleTracking();
        e.target.checked = isActive;
    });
}

const btnTrackNode = document.getElementById('btn-start-tracking');
if (btnTrackNode) {
    btnTrackNode.addEventListener('click', () => {
        if (btnTrackNode.disabled) return; 

        if (typeof window.AppGeolocation === 'undefined') {
            alert("Modul Geolocation belum dimuat dengan sempurna.");
            return;
        }

        const isActive = window.AppGeolocation.toggleTracking();
        
        if (isActive) {
            btnTrackNode.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Tracking';
            btnTrackNode.classList.remove('bg-blue-600', 'hover:bg-blue-500');
            btnTrackNode.classList.add('bg-rose-600', 'hover:bg-rose-500');
        } else {
            btnTrackNode.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Tracking';
            btnTrackNode.classList.remove('bg-rose-600', 'hover:bg-rose-500');
            btnTrackNode.classList.add('bg-blue-600', 'hover:bg-blue-500');
        }
    });
}

// ==========================================
// GEOMETRY LIST & VISIBILITY UI
// ==========================================

window.isPitWasteVisible = true;
window.isPitResourceVisible = true;
window.isDispWasteVisible = true;
window.isLabelLayerVisible = true;

window.pitWasteOpacity = 1.0;
window.pitResourceOpacity = 1.0;
window.dispWasteOpacity = 1.0;
window.labelOpacity = 1.0;

window.isPitExpanded = typeof window.isPitExpanded !== 'undefined' ? window.isPitExpanded : true;
window.isDispExpanded = typeof window.isDispExpanded !== 'undefined' ? window.isDispExpanded : true;

window.togglePitExpand = function() { window.isPitExpanded = !window.isPitExpanded; window.updateLayerUI(); };
window.toggleDispExpand = function() { window.isDispExpanded = !window.isDispExpanded; window.updateLayerUI(); };

window.toggleSublayer = function(type) {
    if (type === 'PitWaste') window.isPitWasteVisible = !window.isPitWasteVisible;
    if (type === 'PitResource') window.isPitResourceVisible = !window.isPitResourceVisible;
    if (type === 'DispWaste') window.isDispWasteVisible = !window.isDispWasteVisible;
    if (type === 'Label') window.isLabelLayerVisible = !window.isLabelLayerVisible;
    
    if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(mesh => {
            if (mesh.userData.isRecorded) return; 
            
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            const isPit = mesh.userData.type === 'pit';
            const isDisp = mesh.userData.type === 'disp';

            if (isPit && !isResource) mesh.visible = window.isPitWasteVisible;
            if (isPit && isResource) mesh.visible = window.isPitResourceVisible;
            if (isDisp) mesh.visible = window.isDispWasteVisible; 
        });
    }

    window.updateLayerUI();
    if(typeof updateLabels === 'function') updateLabels(); 
};

window.changeSublayerOpacity = function(type, value) {
    const opacity = parseFloat(value);
    
    if (type === 'PitWaste') window.pitWasteOpacity = opacity;
    if (type === 'PitResource') window.pitResourceOpacity = opacity;
    if (type === 'DispWaste') window.dispWasteOpacity = opacity;
    if (type === 'Label') {
        window.labelOpacity = opacity;
        document.querySelectorAll('.label-opacity-slider').forEach(el => el.value = opacity);
    }

    if (type !== 'Label' && typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(mesh => {
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            const isPit = mesh.userData.type === 'pit';
            const isDisp = mesh.userData.type === 'disp';

            if (isPit && !isResource && type === 'PitWaste') {
                mesh.material.transparent = true;
                mesh.material.opacity = window.pitWasteOpacity;
                mesh.material.needsUpdate = true;
            } else if (isPit && isResource && type === 'PitResource') {
                mesh.material.transparent = true;
                mesh.material.opacity = window.pitResourceOpacity;
                mesh.material.needsUpdate = true;
            } else if (isDisp && type === 'DispWaste') {
                mesh.material.transparent = true;
                mesh.material.opacity = window.dispWasteOpacity;
                mesh.material.needsUpdate = true;
            }
        });
    } else {
        if (typeof activeLabels !== 'undefined') {
            activeLabels.forEach(lbl => { lbl.element.style.opacity = window.labelOpacity; });
        }
    }
    
    if (window.is3DRenderingActive && typeof renderer !== 'undefined') {
        renderer.render(scene, camera);
    }
};

window.updateLayerUI = function() {
    const gl = document.getElementById('geometry-list');
    if (!gl) return;
    
    gl.style.maxHeight = 'none';
    gl.style.overflow = 'visible';
    gl.style.height = 'auto';
    
    gl.innerHTML = '';
    
    let hasPit = false;
    let hasDisp = false;
    let pitLayerId = 'layer_pit_reserve';
    let dispLayerId = 'layer_disp_reserve';
    
    // [PERBAIKAN] Deteksi HasPit & HasDisp menggunakan Set dari geometry.js (Sangat Akurat)
    if (typeof window.renderedPits !== 'undefined' && typeof window.renderedDisposals !== 'undefined') {
        hasPit = window.renderedPits.size > 0;
        hasDisp = window.renderedDisposals.size > 0;
    } 
    // Fallback deteksi via meshes (Jika Set gagal dibaca)
    else if (typeof meshes !== 'undefined') {
        Object.values(meshes).forEach(mesh => {
            if (mesh.userData && mesh.userData.type === 'pit') hasPit = true;
            if (mesh.userData && mesh.userData.type === 'disp') hasDisp = true;
        });
    }

    // Mengambil Layer ID untuk fungsi Zooming dari appLayers (Hanya mencari ID, tidak mengubah status hasPit/hasDisp)
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(layer => {
            if (layer.type === 'csv') {
                if (layer.id && layer.id.toLowerCase().includes('disp')) dispLayerId = layer.id;
                else if (layer.id && layer.id.toLowerCase().includes('pit')) pitLayerId = layer.id;
            }
        });
    }

    const pitWasteEye = window.isPitWasteVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
    const pitResourceEye = window.isPitResourceVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
    const dispWasteEye = window.isDispWasteVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
    const labelEye = window.isLabelLayerVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';

    const pitChevron = window.isPitExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
    const dispChevron = window.isDispExpanded ? 'fa-chevron-down' : 'fa-chevron-right';

    // Kelas khusus saat data kosong: transparan (redup) dan unclickable
    const pitEmptyClass = !hasPit ? 'opacity-40 grayscale pointer-events-none' : '';
    const dispEmptyClass = !hasDisp ? 'opacity-40 grayscale pointer-events-none' : '';

    // ==========================================
    // 1. DROPDOWN PIT DATA
    // ==========================================
    const pitHeader = document.createElement('div');
    pitHeader.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors ${pitEmptyClass}`;
    pitHeader.innerHTML = `
       <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${pitLayerId}')" title="Zoom to Pit Data">
          <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center">
              <div class="w-2.5 h-2.5 rounded-full color-dot bg-blue-500"></div>
          </div>
          <span class="text-[10px] text-blue-400 font-bold truncate mt-[1px] tracking-wider uppercase">Pit Data</span>
       </div>
       <div class="flex items-center shrink-0 pointer-events-auto">
           <button onclick="window.togglePitExpand()" class="text-slate-400 hover:text-white flex items-center justify-center w-5 h-5 shrink-0" title="Toggle Pit Detail">
               <i class="fa-solid ${pitChevron} text-[10px]"></i>
           </button>
       </div>
    `;

    const pitContent = document.createElement('div');
    pitContent.className = `flex flex-col gap-0.5 mb-2 transition-all duration-300 ${pitEmptyClass}`;
    if (!window.isPitExpanded) pitContent.classList.add('hidden');
    pitContent.innerHTML = `
        <div class="flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600">
            <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-truck-moving text-slate-500 text-[9px] w-3 text-center"></i> Waste</span>
            <div class="flex items-center shrink-0">
                <input type="range" min="0" max="1" step="0.1" value="${window.pitWasteOpacity}" oninput="window.changeSublayerOpacity('PitWaste', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Pit Waste">
                <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                    <button onclick="window.toggleSublayer('PitWaste')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${pitWasteEye} text-[10px]"></i></button>
                </div>
            </div>
        </div>
        <div class="flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600">
            <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-gem text-slate-500 text-[9px] w-3 text-center"></i> Resource</span>
            <div class="flex items-center shrink-0">
                <input type="range" min="0" max="1" step="0.1" value="${window.pitResourceOpacity}" oninput="window.changeSublayerOpacity('PitResource', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Pit Resource">
                <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                    <button onclick="window.toggleSublayer('PitResource')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${pitResourceEye} text-[10px]"></i></button>
                </div>
            </div>
        </div>
        <div class="flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 rounded-br">
            <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-tag text-slate-500 text-[9px] w-3 text-center"></i> Labels</span>
            <div class="flex items-center shrink-0">
                <input type="range" min="0" max="1" step="0.1" value="${window.labelOpacity}" oninput="window.changeSublayerOpacity('Label', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider label-opacity-slider" title="Opacity Labels">
                <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                    <button onclick="window.toggleSublayer('Label')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${labelEye} text-[10px]"></i></button>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 2. DROPDOWN DISPOSAL DATA
    // ==========================================
    const dispHeader = document.createElement('div');
    dispHeader.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors ${dispEmptyClass}`;
    dispHeader.innerHTML = `
       <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${dispLayerId}')" title="Zoom to Disposal Data">
          <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center">
              <div class="w-2.5 h-2.5 rounded-full color-dot bg-emerald-500"></div>
          </div>
          <span class="text-[10px] text-emerald-400 font-bold truncate mt-[1px] tracking-wider uppercase">Disposal Data</span>
       </div>
       <div class="flex items-center shrink-0 pointer-events-auto">
           <button onclick="window.toggleDispExpand()" class="text-slate-400 hover:text-white flex items-center justify-center w-5 h-5 shrink-0" title="Toggle Disposal Detail">
               <i class="fa-solid ${dispChevron} text-[10px]"></i>
           </button>
       </div>
    `;

    const dispContent = document.createElement('div');
    dispContent.className = `flex flex-col gap-0.5 mb-2 transition-all duration-300 ${dispEmptyClass}`;
    if (!window.isDispExpanded) dispContent.classList.add('hidden');
    
    dispContent.innerHTML = `
        <div class="flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 rounded-br">
            <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-mountain text-slate-500 text-[9px] w-3 text-center"></i> Waste</span>
            <div class="flex items-center shrink-0">
                <input type="range" min="0" max="1" step="0.1" value="${window.dispWasteOpacity}" oninput="window.changeSublayerOpacity('DispWaste', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Disposal Waste">
                <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                    <button onclick="window.toggleSublayer('DispWaste')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${dispWasteEye} text-[10px]"></i></button>
                </div>
            </div>
        </div>
    `;

    gl.appendChild(pitHeader);
    gl.appendChild(pitContent);
    gl.appendChild(dispHeader);
    gl.appendChild(dispContent);

    if (typeof window.updateGeolocationState === 'function') {
        window.updateGeolocationState();
    }
};

window.zoomToLayer = function(layerId) {
    if (typeof appLayers === 'undefined') return;
    const layer = appLayers.find(l => l.id === layerId);
    if (!layer || !layer.threeObject) return;
    
    const box = new THREE.Box3().setFromObject(layer.threeObject);
    if (box.isEmpty()) return;

    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        
        // Jarak optimal dengan Aspect Ratio
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        if (camera.aspect < 1) { 
            cameraDistance /= camera.aspect;
        }
        cameraDistance *= 1.3; // Padding

        // Perbarui batas jarak pandang
        if (camera.far < cameraDistance * 3) {
            camera.far = cameraDistance * 3;
            camera.updateProjectionMatrix();
        }

        // Menentukan sudut kamera (Elevation 45, Bearing 315)
        const elevation = 45 * (Math.PI / 180); 
        const azimuth = 315 * (Math.PI / 180);   

        // Posisi Matematika Dasar (Tengah Layar Keseluruhan)
        camera.position.x = center.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth);
        camera.position.y = center.y + cameraDistance * Math.sin(elevation);
        camera.position.z = center.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth);
        
        camera.lookAt(center);
        controls.target.copy(center);

        // --- KOMPENSASI VISUAL UI (PAN OFFSET) ---
        // Kanvas tertutup UI di Kanan dan Bawah, jadi kita geser target secara virtual
        camera.updateMatrix();
        const vh = 2 * Math.tan(fov / 2) * cameraDistance;
        const vw = vh * camera.aspect;
        
        // Menggeser objek ke Kiri (~8%) dan ke Atas (~12%) untuk kompensasi UI
        const panRight = vw * 0.08; 
        const panDown = vh * 0.12;  

        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const upVec = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        
        const offset = new THREE.Vector3();
        offset.addScaledVector(rightVec, panRight); // Kamera gerak kanan -> Objek seolah ke kiri
        offset.addScaledVector(upVec, -panDown);    // Kamera gerak bawah -> Objek seolah ke atas
        
        camera.position.add(offset);
        controls.target.add(offset);

        controls.update();
    }
};