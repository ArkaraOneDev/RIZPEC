// ==========================================
// UI & LAYOUT LOGIC
// ==========================================
const LAYOUT_KEYS = {
    geo: 'rk_layout_geo', layer: 'rk_layout_layer', info: 'rk_layout_info', control: 'rk_layout_control', orbit: 'rk_layout_orbit'
};

const toggleGeo = document.getElementById('cb-layout-geo');
const toggleLayerList = document.getElementById('cb-layout-layer');
const toggleInfo = document.getElementById('cb-layout-info');
const toggleControl = document.getElementById('cb-layout-helper');
const toggleOrbit = document.getElementById('cb-layout-orbit');

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

    const geoState = getLayoutState(LAYOUT_KEYS.geo, true);
    const layerState = getLayoutState(LAYOUT_KEYS.layer, true);
    const infoState = getLayoutState(LAYOUT_KEYS.info, true);
    const controlState = getLayoutState(LAYOUT_KEYS.control, true);
    const orbitState = getLayoutState(LAYOUT_KEYS.orbit, true);

    if (toggleGeo) toggleGeo.checked = geoState;
    if (toggleLayerList) toggleLayerList.checked = layerState;
    if (toggleInfo) toggleInfo.checked = infoState;
    if (toggleControl) toggleControl.checked = controlState;
    if (toggleOrbit) toggleOrbit.checked = orbitState;

    if (containerGeo) {
        geoState ? containerGeo.classList.remove('hidden') : containerGeo.classList.add('hidden');
        geoState ? containerGeo.classList.add('flex') : containerGeo.classList.remove('flex');
        
        // Inline style dihilangkan agar mengikuti class Flexbox bawaan dari index.html
        containerGeo.style.maxHeight = '';
        containerGeo.style.height = '';
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

// State Expand/Collapse per group
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
        // Sinkronisasi seluruh slider opacity label (di Pit dan Disp)
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
    
    // Hapus inline style agar sistem scrollbar dan Flexbox Tailwind dari index.html bekerja
    gl.style.maxHeight = '';
    gl.style.overflow = '';
    gl.style.height = '';
    
    gl.innerHTML = '';
    let hasGeometryData = false;
    
    if (typeof appLayers !== 'undefined') {
        appLayers.forEach(layer => {
            if (layer.type === 'csv') {
                hasGeometryData = true;
                
                const pitWasteEye = window.isPitWasteVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
                const pitResourceEye = window.isPitResourceVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
                const dispWasteEye = window.isDispWasteVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
                const labelEye = window.isLabelLayerVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';

                const pitChevron = window.isPitExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
                const dispChevron = window.isDispExpanded ? 'fa-chevron-down' : 'fa-chevron-right';

                // --- 1. DROPDOWN PIT DATA ---
                const pitHeader = document.createElement('div');
                pitHeader.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors`;
                pitHeader.innerHTML = `
                   <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${layer.id}')" title="Zoom to Pit Data">
                      <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center">
                          <div class="w-2.5 h-2.5 rounded-full color-dot bg-blue-500"></div>
                      </div>
                      <span class="text-[10px] text-blue-400 font-bold truncate mt-[1px] tracking-wider uppercase">Pit Data</span>
                   </div>
                   <div class="flex items-center shrink-0">
                       <button onclick="window.togglePitExpand()" class="text-slate-400 hover:text-white flex items-center justify-center w-5 h-5 shrink-0">
                           <i class="fa-solid ${pitChevron} text-[10px]"></i>
                       </button>
                   </div>
                `;

                const pitContent = document.createElement('div');
                pitContent.className = "flex flex-col gap-0.5 mb-2 transition-all duration-300";
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

                // --- 2. DROPDOWN DISPOSAL DATA (EMERALD) ---
                const dispHeader = document.createElement('div');
                dispHeader.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors`;
                dispHeader.innerHTML = `
                   <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${layer.id}')" title="Zoom to Disposal Data">
                      <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center">
                          <div class="w-2.5 h-2.5 rounded-full color-dot bg-emerald-500"></div>
                      </div>
                      <span class="text-[10px] text-emerald-400 font-bold truncate mt-[1px] tracking-wider uppercase">Disposal Data</span>
                   </div>
                   <div class="flex items-center shrink-0">
                       <button onclick="window.toggleDispExpand()" class="text-slate-400 hover:text-white flex items-center justify-center w-5 h-5 shrink-0">
                           <i class="fa-solid ${dispChevron} text-[10px]"></i>
                       </button>
                   </div>
                `;

                const dispContent = document.createElement('div');
                dispContent.className = "flex flex-col gap-0.5 mb-2 transition-all duration-300";
                if (!window.isDispExpanded) dispContent.classList.add('hidden');
                dispContent.innerHTML = `
                    <div class="flex items-center justify-between pl-6 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600">
                        <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-mountain text-slate-500 text-[9px] w-3 text-center"></i> Waste</span>
                        <div class="flex items-center shrink-0">
                            <input type="range" min="0" max="1" step="0.1" value="${window.dispWasteOpacity}" oninput="window.changeSublayerOpacity('DispWaste', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Disposal Waste">
                            <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-6">
                                <button onclick="window.toggleSublayer('DispWaste')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${dispWasteEye} text-[10px]"></i></button>
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

                gl.appendChild(pitHeader);
                gl.appendChild(pitContent);
                gl.appendChild(dispHeader);
                gl.appendChild(dispContent);
            }
        });
    }

    if (!hasGeometryData) {
        gl.innerHTML = '<div class="text-[9px] text-slate-500 italic text-center py-1 flex-1">Belum ada Geometri</div>';
    }
};

window.zoomToLayer = function(layerId) {
    if (typeof appLayers === 'undefined') return;
    const layer = appLayers.find(l => l.id === layerId);
    if (!layer || !layer.threeObject) return;
    
    const box = new THREE.Box3().setFromObject(layer.threeObject);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (typeof camera !== 'undefined' && typeof controls !== 'undefined') {
        const fov = camera.fov * (Math.PI / 180);
        let cameraDistance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

        const elevation = Math.PI / 4; 
        const azimuth = Math.PI / 4;   

        camera.position.x = center.x + cameraDistance * Math.cos(elevation) * Math.sin(azimuth);
        camera.position.y = center.y + cameraDistance * Math.sin(elevation);
        camera.position.z = center.z + cameraDistance * Math.cos(elevation) * Math.cos(azimuth);
        
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    }
};