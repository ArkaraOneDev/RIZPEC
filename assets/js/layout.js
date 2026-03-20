// ==========================================
// UI & LAYOUT LOGIC
// ==========================================
const LAYOUT_KEYS = {
    vis: 'rk_layout_vis', geo: 'rk_layout_geo', layer: 'rk_layout_layer', info: 'rk_layout_info', control: 'rk_layout_control', orbit: 'rk_layout_orbit'
};

const toggleVis = document.getElementById('cb-layout-vis');
const toggleGeo = document.getElementById('cb-layout-geo');
const toggleLayerList = document.getElementById('cb-layout-layer');
const toggleInfo = document.getElementById('cb-layout-info');
const toggleControl = document.getElementById('cb-layout-helper');
const toggleOrbit = document.getElementById('cb-layout-orbit');

const containerVis = document.getElementById('container-visualization');
const containerGeo = document.getElementById('container-geometry');
const containerLayerList = document.getElementById('container-layerlist');
const containerInfo = document.getElementById('container-info');
const containerControl = document.getElementById('container-control');
const containerOrbit = document.getElementById('container-orbit');

let pendingDeleteLayerId = null;
let currentActiveColorLayerId = null;
let lastCsvCount = 0; // Untuk tracking perubahan layer CSV

// Global footprint cache agar memori WebGL tidak terkuras untuk generate tekstur mask berulang kali
let globalFootprintMask = null;
let globalFootprintBox = null;

function initLayout() {
    const getLayoutState = (key, defaultVal) => {
        const val = localStorage.getItem(key);
        return val !== null ? val === 'true' : defaultVal;
    };

    const visState = getLayoutState(LAYOUT_KEYS.vis, true);
    const geoState = getLayoutState(LAYOUT_KEYS.geo, true);
    const layerState = getLayoutState(LAYOUT_KEYS.layer, true);
    const infoState = getLayoutState(LAYOUT_KEYS.info, true);
    const controlState = getLayoutState(LAYOUT_KEYS.control, true);
    const orbitState = getLayoutState(LAYOUT_KEYS.orbit, true);

    toggleVis.checked = visState;
    toggleGeo.checked = geoState;
    toggleLayerList.checked = layerState;
    toggleInfo.checked = infoState;
    toggleControl.checked = controlState;
    if (toggleOrbit) toggleOrbit.checked = orbitState;

    visState ? containerVis.classList.remove('hidden') : containerVis.classList.add('hidden');
    visState ? containerVis.classList.add('flex') : containerVis.classList.remove('flex');
    geoState ? containerGeo.classList.remove('hidden') : containerGeo.classList.add('hidden');
    geoState ? containerGeo.classList.add('flex') : containerGeo.classList.remove('flex');
    layerState ? containerLayerList.classList.remove('hidden') : containerLayerList.classList.add('hidden');
    layerState ? containerLayerList.classList.add('flex') : containerLayerList.classList.remove('flex');
    infoState ? containerInfo.classList.remove('hidden') : containerInfo.classList.add('hidden');
    infoState ? containerInfo.classList.add('flex') : containerInfo.classList.remove('flex');
    
    controlState ? containerControl.classList.remove('hidden') : containerControl.classList.add('hidden');
    controlState ? containerControl.classList.add('flex') : containerControl.classList.remove('flex');
    
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
    const popup = document.getElementById('layer-color-popup');
    if (popup && !popup.classList.contains('hidden') && !popup.contains(e.target)) {
        if (!e.target.closest('.color-dot-trigger')) {
            popup.classList.add('hidden');
            popup.classList.remove('flex');
            currentActiveColorLayerId = null;
        }
    }
});

document.querySelectorAll('.dropdown-content').forEach(dc => {
    dc.addEventListener('click', e => e.stopPropagation()); 
});

toggleVis.addEventListener('change', (e) => {
    const state = e.target.checked;
    state ? containerVis.classList.remove('hidden') : containerVis.classList.add('hidden');
    state ? containerVis.classList.add('flex') : containerVis.classList.remove('flex');
    localStorage.setItem(LAYOUT_KEYS.vis, state);
});
toggleGeo.addEventListener('change', (e) => {
    const state = e.target.checked;
    state ? containerGeo.classList.remove('hidden') : containerGeo.classList.add('hidden');
    state ? containerGeo.classList.add('flex') : containerGeo.classList.remove('flex');
    localStorage.setItem(LAYOUT_KEYS.geo, state);
});
toggleLayerList.addEventListener('change', (e) => {
    const state = e.target.checked;
    state ? containerLayerList.classList.remove('hidden') : containerLayerList.classList.add('hidden');
    state ? containerLayerList.classList.add('flex') : containerLayerList.classList.remove('flex');
    localStorage.setItem(LAYOUT_KEYS.layer, state);
});
toggleInfo.addEventListener('change', (e) => {
    const state = e.target.checked;
    state ? containerInfo.classList.remove('hidden') : containerInfo.classList.add('hidden');
    state ? containerInfo.classList.add('flex') : containerInfo.classList.remove('flex');
    localStorage.setItem(LAYOUT_KEYS.info, state);
});
toggleControl.addEventListener('change', (e) => {
    const state = e.target.checked;
    state ? containerControl.classList.remove('hidden') : containerControl.classList.add('hidden');
    state ? containerControl.classList.add('flex') : containerControl.classList.remove('flex');
    localStorage.setItem(LAYOUT_KEYS.control, state);
});
if (toggleOrbit) {
    toggleOrbit.addEventListener('change', (e) => {
        const state = e.target.checked;
        state ? containerOrbit.classList.remove('hidden') : containerOrbit.classList.add('hidden');
        state ? containerOrbit.classList.add('flex') : containerOrbit.classList.remove('flex');
        localStorage.setItem(LAYOUT_KEYS.orbit, state);
    });
}

// LAYER COLOR PALETTE
window.openColorPalette = function(event, layerId) {
    currentActiveColorLayerId = layerId;
    const layer = appLayers.find(l => l.id === layerId);
    if (!layer) return;

    const popup = document.getElementById('layer-color-popup');
    const colorInput = document.getElementById('layer-color-input');
    const btnTex = document.getElementById('btn-import-texture');

    colorInput.value = layer.colorHex;

    // --- INJECT TOMBOL CLIPPING ---
    let clipBtn = document.getElementById('btn-toggle-clipping-popup');
    if (!clipBtn) {
        clipBtn = document.createElement('button');
        clipBtn.id = 'btn-toggle-clipping-popup';
        popup.insertBefore(clipBtn, btnTex);
    }

    if (layer.hasFaces) {
        btnTex.classList.remove('hidden');
        clipBtn.classList.remove('hidden');
        
        const updateClipBtnUI = () => {
            if (layer.clippingEnabled) {
                clipBtn.innerHTML = '<i class="fa-solid fa-scissors"></i> Disable Clipping';
                clipBtn.className = 'w-full bg-slate-700 hover:bg-slate-600 text-white text-[9px] py-1.5 rounded transition-colors border border-slate-600 shadow-sm font-semibold mt-1 flex items-center justify-center gap-1';
            } else {
                clipBtn.innerHTML = '<i class="fa-solid fa-scissors"></i> Enable Clipping';
                clipBtn.className = 'w-full bg-blue-600 hover:bg-blue-500 text-white text-[9px] py-1.5 rounded transition-colors border border-blue-500 shadow-sm font-semibold mt-1 flex items-center justify-center gap-1';
            }
        };
        
        updateClipBtnUI();
        
        clipBtn.onclick = () => {
            if (currentActiveColorLayerId) {
                window.toggleClipping(currentActiveColorLayerId);
                updateClipBtnUI();
            }
        };

    } else {
        btnTex.classList.add('hidden');
        clipBtn.classList.add('hidden');
    }

    popup.classList.remove('hidden');
    popup.classList.add('flex');

    const rect = event.target.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    if (left + 192 > window.innerWidth) left = window.innerWidth - 192 - 10;
    if (top + 100 > window.innerHeight) top = rect.top - 100 - 8;

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
};

document.getElementById('close-color-popup').addEventListener('click', () => {
    document.getElementById('layer-color-popup').classList.add('hidden');
    document.getElementById('layer-color-popup').classList.remove('flex');
    currentActiveColorLayerId = null;
});

document.getElementById('layer-color-input').addEventListener('input', (e) => {
    if (currentActiveColorLayerId) window.changeLayerColor(currentActiveColorLayerId, e.target.value);
});

document.getElementById('btn-reset-layer-color').addEventListener('click', () => {
    if (currentActiveColorLayerId) window.resetLayerColor(currentActiveColorLayerId);
});

window.changeLayerColor = function(layerId, newHexStr) {
    const layer = appLayers.find(l => l.id === layerId);
    if(!layer) return;
    
    layer.colorHex = newHexStr;
    const newHexNum = parseInt(newHexStr.replace('#', '0x'));

    if (layer.type === 'dxf') {
        layer.threeObject.traverse(c => {
            if (c.isMesh || c.isLine || c.isLineSegments) {
                if (c.material) {
                    if (!c.material.map) { 
                        c.material.color.setHex(newHexNum);
                    }
                }
            }
        });
    }
    if (window.is3DRenderingActive && renderer) renderer.render(scene, camera);

    const dot = document.getElementById('color-dot-' + layerId);
    if(dot) dot.style.backgroundColor = newHexStr;
};

window.resetLayerColor = function(layerId) {
    const layer = appLayers.find(l => l.id === layerId);
    if(!layer) return;
    
    layer.colorHex = layer.defaultColorHex;

    if (layer.type === 'dxf') {
        layer.threeObject.traverse((c) => {
            if ((c.isMesh || c.isLine || c.isLineSegments) && c.material && c.userData.originalColor !== undefined) {
                if (!c.material.map) { 
                    c.material.color.setHex(c.userData.originalColor);
                }
            }
        });
    }
    if (window.is3DRenderingActive && renderer) renderer.render(scene, camera);

    const dot = document.getElementById('color-dot-' + layerId);
    if(dot) dot.style.backgroundColor = layer.colorHex;

    const colorInput = document.getElementById('layer-color-input');
    if(colorInput) colorInput.value = layer.colorHex;
};


// LAYER & GEOMETRY LIST
window.toggleClipping = function(layerId) {
    const layer = appLayers.find(l => l.id === layerId);
    if (!layer || !layer.hasFaces) return;
    
    layer.clippingEnabled = !layer.clippingEnabled;
    
    // Pastikan mask layer universal diperbarui / di-generate terlebih dahulu
    if (layer.clippingEnabled) {
        window.updateGlobalFootprintMask();
    }
    
    if (layer.threeObject) {
        layer.threeObject.traverse(child => {
            if (child.isMesh) {
                if (layer.clippingEnabled) {
                    window.applyFootprintMask(child);
                } else {
                    window.removeFootprintMask(child);
                }
            }
        });
    }
    
    if (window.is3DRenderingActive && typeof renderer !== 'undefined') renderer.render(scene, camera);
};

window.toggleGeometryExpand = function() {
    isGeometryExpanded = !isGeometryExpanded;
    window.updateLayerUI();
};

window.toggleSublayer = function(type) {
    if (type === 'OB') isOBVisible = !isOBVisible;
    if (type === 'Coal') isCoalVisible = !isCoalVisible;
    if (type === 'Label') isLabelLayerVisible = !isLabelLayerVisible;
    
    if (type === 'OB' || type === 'Coal') {
        Object.values(meshes).forEach(mesh => {
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            if (isResource && type === 'Coal') {
                if (!mesh.userData.isRecorded) mesh.visible = isCoalVisible;
            } else if (!isResource && type === 'OB') {
                if (!mesh.userData.isRecorded) mesh.visible = isOBVisible;
            }
        });
    }
    window.updateLayerUI();
    if(typeof updateLabels === 'function') updateLabels(); 
};

window.changeSublayerOpacity = function(type, value) {
    const opacity = parseFloat(value);
    if (type === 'OB') obOpacity = opacity;
    if (type === 'Coal') coalOpacity = opacity;
    if (type === 'Label') labelOpacity = opacity;

    if (type === 'OB' || type === 'Coal') {
        Object.values(meshes).forEach(mesh => {
            const isResource = (mesh.userData.burden || '').toUpperCase() === 'RESOURCE';
            if (isResource && type === 'Coal') {
                mesh.material.transparent = true;
                mesh.material.opacity = coalOpacity;
                mesh.material.needsUpdate = true;
            } else if (!isResource && type === 'OB') {
                mesh.material.transparent = true;
                mesh.material.opacity = obOpacity;
                mesh.material.needsUpdate = true;
            }
        });
    } else if (type === 'Label') {
        activeLabels.forEach(lbl => { lbl.element.style.opacity = labelOpacity; });
    }
    if (window.is3DRenderingActive) renderer.render(scene, camera);
};

window.changeLayerOpacity = function(layerId, value) {
    const layer = appLayers.find(l => l.id === layerId);
    if (layer && layer.threeObject) {
        layer.opacity = parseFloat(value);
        layer.threeObject.traverse((child) => {
            if ((child.isMesh || child.isLine || child.isLineSegments) && child.material) {
                child.material.transparent = true;
                child.material.opacity = layer.opacity;
                child.material.needsUpdate = true;
            }
        });
        if (window.is3DRenderingActive) renderer.render(scene, camera);
    }
};

window.updateLayerUI = function() {
    appLayers.forEach(layer => {
        if (layer.type === 'dxf' && layer.hasFaces) {
            if (!layer.defaultColorHex || layer.defaultColorHex === '#ffffff') {
                layer.defaultColorHex = '#008b8b';
                
                if (!layer.colorHex || layer.colorHex === '#ffffff') {
                    layer.colorHex = '#008b8b';
                }
                
                if (layer.threeObject) {
                    layer.threeObject.traverse(c => {
                        if (c.isMesh && c.material && !c.material.map) {
                            if (c.userData.originalColor === 0xffffff || c.userData.originalColor === undefined) {
                                c.userData.originalColor = 0x008b8b;
                                c.material.color.setHex(0x008b8b);
                            }
                        }
                    });
                }
            }
        }
    });

    const lc = document.getElementById('layer-count');
    const ll = document.getElementById('layer-list');
    const gl = document.getElementById('geometry-list');
    
    ll.innerHTML = '';
    gl.innerHTML = '';
    
    let dxfCount = 0;
    let currentCsvCount = 0;
    
    appLayers.forEach(layer => {
        const iconEye = layer.visible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
        const opacity = layer.visible ? 'opacity-100' : 'opacity-50';
        
        if (layer.type === 'csv') {
            currentCsvCount++;
            const chevronIcon = isGeometryExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
            
            const mainRow = document.createElement('div');
            mainRow.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors ${opacity}`;
            mainRow.innerHTML = `
               <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${layer.id}')" title="${layer.name}">
                  <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center color-dot-trigger" onclick="event.stopPropagation(); window.openColorPalette(event, '${layer.id}')">
                      <div id="color-dot-${layer.id}" class="w-2.5 h-2.5 rounded-full color-dot" style="background-color: ${layer.colorHex};"></div>
                  </div>
                  <span class="text-[10px] text-slate-300 font-medium truncate mt-[1px]">${layer.name}</span>
               </div>
               <div class="flex items-center shrink-0">
                   <button onclick="window.toggleGeometryExpand()" class="text-slate-400 hover:text-white flex items-center justify-center w-5 h-5 mr-1.5 shrink-0">
                       <i class="fa-solid ${chevronIcon} text-[10px]"></i>
                   </button>
                   <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-[52px]">
                      <button onclick="window.toggleLayer('${layer.id}')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${iconEye} text-[10px]"></i></button>
                      <button onclick="window.deleteLayer('${layer.id}')" class="text-slate-400 hover:text-red-400 flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid fa-trash text-[10px]"></i></button>
                   </div>
               </div>
            `;

            const wrapper = document.createElement('div');
            wrapper.className = "flex flex-col gap-0.5";
            wrapper.appendChild(mainRow);
            
            const currentMode = document.getElementById('pit-processing-select').value;
            const hasLabels = currentMode !== 'basic';
            
            const obEye = isOBVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
            const coalEye = isCoalVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
            const labelEye = isLabelLayerVisible ? 'fa-eye' : 'fa-eye-slash text-slate-500';
            
            const subHTML = `
                <div class="flex items-center justify-between pl-8 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 rounded-br mt-0.5">
                    <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-truck-moving text-slate-500 text-[9px] w-3 text-center"></i> OB</span>
                    <div class="flex items-center shrink-0">
                        <input type="range" min="0" max="1" step="0.1" value="${obOpacity}" oninput="window.changeSublayerOpacity('OB', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity OB">
                        <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-[52px]">
                            <button onclick="window.toggleSublayer('OB')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${obEye} text-[10px]"></i></button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center justify-between pl-8 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 rounded-br">
                    <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-weight-hanging text-slate-500 text-[9px] w-3 text-center"></i> Coal</span>
                    <div class="flex items-center shrink-0">
                        <input type="range" min="0" max="1" step="0.1" value="${coalOpacity}" oninput="window.changeSublayerOpacity('Coal', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Coal">
                        <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-[52px]">
                            <button onclick="window.toggleSublayer('Coal')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${coalEye} text-[10px]"></i></button>
                        </div>
                    </div>
                </div>
                ${hasLabels ? `
                <div class="flex items-center justify-between pl-8 pr-2 py-1 bg-slate-800/30 border-l-2 border-slate-600 rounded-br">
                    <span class="text-[9px] text-slate-400 font-medium flex items-center gap-2 mt-[1px]"><i class="fa-solid fa-tag text-slate-500 text-[9px] w-3 text-center"></i> Label</span>
                    <div class="flex items-center shrink-0">
                        <input type="range" min="0" max="1" step="0.1" value="${labelOpacity}" oninput="window.changeSublayerOpacity('Label', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Label">
                        <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-[52px]">
                            <button onclick="window.toggleSublayer('Label')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${labelEye} text-[10px]"></i></button>
                        </div>
                    </div>
                </div>` : ''}
            `;
            
            const subContainer = document.createElement('div');
            subContainer.className = "flex flex-col gap-0.5 mb-1 transition-all duration-300";
            if (!layer.visible) subContainer.style.opacity = '0.5';
            if (!isGeometryExpanded) subContainer.classList.add('hidden');
            subContainer.innerHTML = subHTML;
            
            wrapper.appendChild(subContainer);
            gl.appendChild(wrapper);
        } else {
            const currentOpacityVal = layer.opacity !== undefined ? layer.opacity : 1;
            
            const mainRow = document.createElement('div');
            mainRow.className = `flex shrink-0 items-center justify-between bg-slate-800/80 border border-slate-700 py-1.5 px-2 rounded hover:border-slate-500 transition-colors ${opacity}`;
            mainRow.innerHTML = `
               <div class="flex-1 flex items-center gap-2 cursor-pointer overflow-hidden pr-2" onclick="window.zoomToLayer('${layer.id}')" title="${layer.name}">
                  <div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center color-dot-trigger" onclick="event.stopPropagation(); window.openColorPalette(event, '${layer.id}')">
                      <div id="color-dot-${layer.id}" class="w-2.5 h-2.5 rounded-full color-dot" style="background-color: ${layer.colorHex};"></div>
                  </div>
                  <span class="text-[10px] text-slate-300 font-medium truncate mt-[1px]">${layer.name}</span>
               </div>
               <div class="flex items-center shrink-0">
                  <input type="range" min="0" max="1" step="0.1" value="${currentOpacityVal}" oninput="window.changeLayerOpacity('${layer.id}', this.value)" class="w-12 h-1 bg-slate-600 appearance-none cursor-pointer mr-3 rounded opacity-slider" title="Opacity Layer">
                  <div class="flex items-center justify-start gap-2.5 border-l border-slate-600 pl-2.5 h-4 w-[52px]">
                      <button onclick="window.toggleLayer('${layer.id}')" class="text-slate-400 hover:text-white flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid ${iconEye} text-[10px]"></i></button>
                      <button onclick="window.deleteLayer('${layer.id}')" class="text-slate-400 hover:text-red-400 flex items-center justify-center w-4 h-4 shrink-0"><i class="fa-solid fa-trash text-[10px]"></i></button>
                  </div>
               </div>
            `;
            ll.appendChild(mainRow);
            dxfCount++;
        }
    });
    
    lc.textContent = dxfCount;
    if (gl.children.length === 0) gl.innerHTML = '<div class="text-[9px] text-slate-500 italic text-center py-1">Belum ada Geometri</div>';
    if (ll.children.length === 0) ll.innerHTML = '<div class="text-[9px] text-slate-500 italic text-center py-1">Belum ada DXF Layer</div>';

    // Deteksi jika terdapat perubahan pada eksistensi file CSV (misal CSV ditambahkan atau dihapus)
    if (currentCsvCount !== lastCsvCount) {
        lastCsvCount = currentCsvCount;
        // Berikan jeda waktu sedikit untuk memastikan pitReserveGroup sudah terkonstruksi di scene
        setTimeout(() => {
            if (typeof window.updateAllTextureMasks === 'function') {
                window.updateAllTextureMasks();
            }
        }, 150);
    }
};

window.zoomToLayer = function(layerId) {
    const layer = appLayers.find(l => l.id === layerId);
    if (!layer || !layer.threeObject) return;
    const box = new THREE.Box3().setFromObject(layer.threeObject);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
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
};

window.toggleLayer = function(layerId) {
    const layer = appLayers.find(l => l.id === layerId);
    if (layer) {
        layer.visible = !layer.visible;
        layer.threeObject.visible = layer.visible;
        window.updateLayerUI();
        if(typeof updateLabels === 'function') updateLabels();
    }
};

window.deleteLayer = function(layerId) {
    pendingDeleteLayerId = layerId;
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    pendingDeleteLayerId = null;
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (pendingDeleteLayerId) { executeDeleteLayer(pendingDeleteLayerId); pendingDeleteLayerId = null; }
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
});

function executeDeleteLayer(layerId) {
    const idx = appLayers.findIndex(l => l.id === layerId);
    if (idx > -1) {
        const layer = appLayers[idx];
        
        if (layer.type === 'csv') {
            globalParsedData = null;
            Object.values(meshes).forEach(mesh => {
                pitReserveGroup.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                mesh.children.forEach(child => {
                    if(child.geometry) child.geometry.dispose();
                    if(child.material) child.material.dispose();
                });
            });
            meshes = {};
            if(typeof clearLabels === 'function') clearLabels();
            window.resetSequenceAndView();

            document.getElementById('sum-blocks').textContent = "0";
            document.getElementById('sum-ob').textContent = "0";
            document.getElementById('sum-coal').textContent = "0";
            document.getElementById('sum-sr').textContent = "0.00";
            
            document.getElementById('file-input').value = '';
            const filenameUI = document.getElementById('upload-filename');
            if (filenameUI) {
                filenameUI.textContent = 'Upload CSV';
                filenameUI.classList.remove('text-slate-200');
                filenameUI.classList.add('text-slate-400');
            }

            const selectEl = document.getElementById('pit-processing-select');
            selectEl.value = 'basic';
            selectEl.dispatchEvent(new Event('change'));
            document.querySelector('#pit-processing-select option[value="resgraphic_incremental"]').disabled = true;
            document.querySelector('#pit-processing-select option[value="resgraphic_cumulative"]').disabled = true;
            document.querySelector('#pit-processing-select option[value="quality"]').disabled = true;
        } else {
            scene.remove(layer.threeObject);
            layer.threeObject.traverse((child) => {
                if (child.isMesh || child.isLineSegments || child.isLine) {
                    child.geometry.dispose();
                    if(child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
        appLayers.splice(idx, 1);
        window.updateLayerUI();
    }
}

// ==========================================
// GCP TEXTURE MAPPING LOGIC
// ==========================================
let gcpImage = null;
let gcpPairs = []; 
let currentImgPoint = null;
let currentWorldPoint = null;
let gcpState = 'IDLE'; 
let activeGcpLayerId = null;

let imgScale = 1;
let imgOffsetX = 0;
let imgOffsetY = 0;
let isDraggingImg = false;
let dragStart = { x: 0, y: 0 };

let isLeftClickDragImg = false;
let leftDragStartImg = { x: 0, y: 0 };

let isMiddleClickZoomImg = false;
let middleDragStartImgY = 0;
let startImgScale = 1;

let isLeftClickDrag3D = false;
let leftDragStart3D = { x: 0, y: 0 };

let gcpScene, gcpCamera, gcpRenderer, gcpControls, gcpAnimId;
let gcpSpheres = [];

document.getElementById('btn-import-texture').addEventListener('click', () => {
    document.getElementById('import-texture-input').click();
});

document.getElementById('import-texture-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            gcpImage = img;
            imgScale = 1;
            imgOffsetX = 0;
            imgOffsetY = 0;
            openGcpModal(currentActiveColorLayerId);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
});

window.openGcpModal = function(layerId) {
    activeGcpLayerId = layerId;
    gcpPairs = [];
    currentImgPoint = null;
    currentWorldPoint = null;
    gcpState = 'IDLE';
    updateGcpStatus();

    document.getElementById('layer-color-popup').classList.add('hidden');
    document.getElementById('layer-color-popup').classList.remove('flex');
    
    const modal = document.getElementById('gcp-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        resizeLeftCanvas();
        initGcpRightCanvas(layerId);
    }, 100);
}

window.closeGcpModal = function() {
    document.getElementById('gcp-modal').classList.add('hidden');
    document.getElementById('gcp-modal').classList.remove('flex');
    cancelAnimationFrame(gcpAnimId);
    
    if (gcpRenderer) {
        gcpRenderer.dispose();
        document.getElementById('gcp-right-3d').innerHTML = '';
    }
}

const leftCanvas = document.getElementById('gcp-left-canvas');
const leftCtx = leftCanvas.getContext('2d');

function resizeLeftCanvas() {
    const rect = leftCanvas.parentElement.getBoundingClientRect();
    leftCanvas.width = rect.width;
    leftCanvas.height = rect.height;
    if(gcpImage && imgScale === 1) {
        imgScale = Math.min(rect.width / gcpImage.width, rect.height / gcpImage.height) * 0.9;
        imgOffsetX = (rect.width - (gcpImage.width * imgScale)) / 2;
        imgOffsetY = (rect.height - (gcpImage.height * imgScale)) / 2;
    }
    drawLeftCanvas();
}

function drawLeftCanvas() {
    leftCtx.fillStyle = '#ffffff';
    leftCtx.fillRect(0, 0, leftCanvas.width, leftCanvas.height);
    
    if (!gcpImage) return;
    leftCtx.save();
    leftCtx.translate(imgOffsetX, imgOffsetY);
    leftCtx.scale(imgScale, imgScale);
    leftCtx.drawImage(gcpImage, 0, 0);
    
    gcpPairs.forEach((pair, idx) => { drawDot(leftCtx, pair.imgPx, pair.imgPy, idx + 1); }); 
    if (currentImgPoint) { drawDot(leftCtx, currentImgPoint.x, currentImgPoint.y, gcpPairs.length + 1); } 
    
    leftCtx.restore();
}

function drawDot(ctx, x, y, num) {
    const size = 15 / imgScale;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / imgScale;
    ctx.stroke();
    
    ctx.font = `bold ${14 / imgScale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3 / imgScale;
    ctx.strokeText(num, x, y + (22 / imgScale));
    
    ctx.fillStyle = '#ff0000';
    ctx.fillText(num, x, y + (22 / imgScale));
}

leftCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = leftCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const wheel = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = imgScale * wheel;
    
    imgOffsetX = mouseX - (mouseX - imgOffsetX) * (newScale / imgScale);
    imgOffsetY = mouseY - (mouseY - imgOffsetY) * (newScale / imgScale);
    imgScale = newScale;
    
    drawLeftCanvas();
});

function isAddingImgGcp() { return gcpState === 'ADDING_IMG'; }

leftCanvas.addEventListener('contextmenu', e => e.preventDefault());

leftCanvas.addEventListener('pointerdown', (e) => {
    const rect = leftCanvas.getBoundingClientRect();
    if (e.button === 2) {
        isDraggingImg = true;
        dragStart = { x: e.clientX - imgOffsetX, y: e.clientY - imgOffsetY };
        leftCanvas.setPointerCapture(e.pointerId);
    } else if (e.button === 1) { 
        isMiddleClickZoomImg = true;
        middleDragStartImgY = e.clientY;
        startImgScale = imgScale;
        leftCanvas.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
        isLeftClickDragImg = true;
        leftDragStartImg = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        const zoomRect = document.getElementById('gcp-left-zoom-rect');
        zoomRect.style.left = leftDragStartImg.x + 'px';
        zoomRect.style.top = leftDragStartImg.y + 'px';
        zoomRect.style.width = '0px';
        zoomRect.style.height = '0px';
        zoomRect.classList.remove('hidden');
        
        leftCanvas.setPointerCapture(e.pointerId);
    }
});

leftCanvas.addEventListener('pointermove', (e) => {
    const rect = leftCanvas.getBoundingClientRect();
    if (isDraggingImg) {
        imgOffsetX = e.clientX - dragStart.x;
        imgOffsetY = e.clientY - dragStart.y;
        drawLeftCanvas();
    } else if (isMiddleClickZoomImg) {
        const deltaY = middleDragStartImgY - e.clientY;
        const zoomFactor = Math.exp(deltaY * 0.01);
        const newScale = startImgScale * zoomFactor;
        
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        
        imgOffsetX = cx - (cx - imgOffsetX) * (newScale / imgScale);
        imgOffsetY = cy - (cy - imgOffsetY) * (newScale / imgScale);
        imgScale = newScale;
        drawLeftCanvas();
    } else if (isLeftClickDragImg) {
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const zoomRect = document.getElementById('gcp-left-zoom-rect');
        zoomRect.style.left = Math.min(curX, leftDragStartImg.x) + 'px';
        zoomRect.style.top = Math.min(curY, leftDragStartImg.y) + 'px';
        zoomRect.style.width = Math.abs(curX - leftDragStartImg.x) + 'px';
        zoomRect.style.height = Math.abs(curY - leftDragStartImg.y) + 'px';
    }
});

leftCanvas.addEventListener('pointerup', (e) => { 
    if (isDraggingImg && e.button === 2) {
        isDraggingImg = false;
        leftCanvas.releasePointerCapture(e.pointerId);
    }
    if (isMiddleClickZoomImg && e.button === 1) {
        isMiddleClickZoomImg = false;
        leftCanvas.releasePointerCapture(e.pointerId);
    }
    if (isLeftClickDragImg && e.button === 0) {
        isLeftClickDragImg = false;
        leftCanvas.releasePointerCapture(e.pointerId);
        const zoomRect = document.getElementById('gcp-left-zoom-rect');
        zoomRect.classList.add('hidden');
        
        const rect = leftCanvas.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const dist = Math.hypot(curX - leftDragStartImg.x, curY - leftDragStartImg.y);
        
        if (dist > 5) {
            const w = Math.abs(curX - leftDragStartImg.x);
            const h = Math.abs(curY - leftDragStartImg.y);
            const cx = (curX + leftDragStartImg.x) / 2;
            const cy = (curY + leftDragStartImg.y) / 2;
            
            const imgCx = (cx - imgOffsetX) / imgScale;
            const imgCy = (cy - imgOffsetY) / imgScale;
            
            const zf = Math.min(leftCanvas.width / w, leftCanvas.height / h);
            imgScale *= zf;
            imgOffsetX = (leftCanvas.width / 2) - (imgCx * imgScale);
            imgOffsetY = (leftCanvas.height / 2) - (imgCy * imgScale);
            drawLeftCanvas();
        } else {
            if (isAddingImgGcp()) {
                currentImgPoint = { x: (curX - imgOffsetX) / imgScale, y: (curY - imgOffsetY) / imgScale };
                gcpState = 'ADDING_WORLD';
                updateGcpStatus();
                drawLeftCanvas();
            }
        }
    }
});

function initGcpRightCanvas(layerId) {
    const container = document.getElementById('gcp-right-3d');
    container.innerHTML = '';
    
    gcpScene = new THREE.Scene();
    gcpScene.background = new THREE.Color('#ffffff'); 
    
    const rect = container.getBoundingClientRect();
    gcpCamera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 100000);
    
    gcpRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    gcpRenderer.setSize(rect.width, rect.height);
    container.appendChild(gcpRenderer.domElement);
    
    gcpScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dl = new THREE.DirectionalLight(0xffffff, 0.5);
    dl.position.set(0, 1000, 0);
    gcpScene.add(dl);
    
    const layer = appLayers.find(l => l.id === layerId);
    if (layer && layer.threeObject) {
        const cloned = layer.threeObject.clone();
        cloned.traverse((c) => {
            if (c.material) {
                c.material = c.material.clone();
                if (c.material.color && c.material.color.getHex() === 0xffffff && !c.material.map) {
                    c.material.color.setHex(0x222222);
                }
            }
        });
        gcpScene.add(cloned);
        
        const box = new THREE.Box3().setFromObject(cloned);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z);
        
        gcpCamera.position.set(center.x, center.y + maxDim * 1.5, center.z);
        gcpCamera.up.set(0, 0, -1); 
        gcpCamera.lookAt(center);
        
        gcpControls = new THREE.OrbitControls(gcpCamera, gcpRenderer.domElement);
        gcpControls.enableRotate = false; 
        gcpControls.mouseButtons = {
            LEFT: null, 
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN 
        };
        gcpControls.target.copy(center);
        gcpControls.update();
    }
    
    const gcpDom = gcpRenderer.domElement;
    gcpDom.addEventListener('contextmenu', e => e.preventDefault());

    gcpDom.addEventListener('pointerdown', (e) => {
        if (e.button === 0) {
            isLeftClickDrag3D = true;
            gcpControls.enabled = false;
            const crect = gcpDom.getBoundingClientRect();
            leftDragStart3D = { x: e.clientX - crect.left, y: e.clientY - crect.top };
            
            const zoomRect = document.getElementById('gcp-right-zoom-rect');
            zoomRect.style.left = leftDragStart3D.x + 'px';
            zoomRect.style.top = leftDragStart3D.y + 'px';
            zoomRect.style.width = '0px';
            zoomRect.style.height = '0px';
            zoomRect.classList.remove('hidden');
            
            gcpDom.setPointerCapture(e.pointerId);
        }
    });

    gcpDom.addEventListener('pointermove', (e) => {
        if (isLeftClickDrag3D) {
            const crect = gcpDom.getBoundingClientRect();
            const curX = e.clientX - crect.left;
            const curY = e.clientY - crect.top;
            
            const zoomRect = document.getElementById('gcp-right-zoom-rect');
            zoomRect.style.left = Math.min(curX, leftDragStart3D.x) + 'px';
            zoomRect.style.top = Math.min(curY, leftDragStart3D.y) + 'px';
            zoomRect.style.width = Math.abs(curX - leftDragStart3D.x) + 'px';
            zoomRect.style.height = Math.abs(curY - leftDragStart3D.y) + 'px';
        }
    });
    
    gcpDom.addEventListener('pointerup', (e) => {
        if (isLeftClickDrag3D) {
            isLeftClickDrag3D = false;
            gcpControls.enabled = true;
            gcpDom.releasePointerCapture(e.pointerId);
            
            const zoomRect = document.getElementById('gcp-right-zoom-rect');
            zoomRect.classList.add('hidden');
            
            const crect = gcpDom.getBoundingClientRect();
            const curX = e.clientX - crect.left;
            const curY = e.clientY - crect.top;
            const dist = Math.hypot(curX - leftDragStart3D.x, curY - leftDragStart3D.y);
            
            if (dist > 5) {
                const w = Math.abs(curX - leftDragStart3D.x);
                const h = Math.abs(curY - leftDragStart3D.y);
                const cx = (curX + leftDragStart3D.x) / 2;
                const cy = (curY + leftDragStart3D.y) / 2;
                
                const ndcX = (cx / crect.width) * 2 - 1;
                const ndcY = -(cy / crect.height) * 2 + 1;
                const ray = new THREE.Raycaster();
                ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), gcpCamera);
                
                const targetY = gcpControls.target.y;
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
                const intersectPt = new THREE.Vector3();
                
                if (ray.ray.intersectPlane(plane, intersectPt)) {
                    const zf = Math.max(w / crect.width, h / crect.height);
                    const currentHeight = gcpCamera.position.y - targetY;
                    const newHeight = Math.max(10, currentHeight * zf);
                    
                    gcpControls.target.copy(intersectPt);
                    gcpCamera.position.set(intersectPt.x, targetY + newHeight, intersectPt.z);
                    gcpCamera.lookAt(intersectPt);
                    gcpControls.update();
                }
            } else {
                if (gcpState === 'ADDING_WORLD') {
                    const ndcX = (curX / crect.width) * 2 - 1;
                    const ndcY = -(curY / crect.height) * 2 + 1;
                    const ray = new THREE.Raycaster();
                    ray.params.Line.threshold = 15; 
                    ray.params.Points.threshold = 15;
                    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), gcpCamera);
                    
                    const intersects = ray.intersectObjects(gcpScene.children, true);
                    const validIntersects = intersects.filter(ix => 
                        (ix.object.isMesh || ix.object.isLineSegments || ix.object.isLine) && ix.object.geometry
                    );
                    
                    if (validIntersects.length > 0) {
                        const hit = validIntersects[0];
                        const hitObj = hit.object;
                        let snappedPoint = hit.point.clone();
                        let minDistSq = Infinity;
                        
                        if (hitObj.geometry.attributes.position) {
                            const positions = hitObj.geometry.attributes.position.array;
                            const tempVec = new THREE.Vector3();
                            hitObj.updateMatrixWorld();
                            
                            for (let i = 0; i < positions.length; i += 3) {
                                tempVec.set(positions[i], positions[i+1], positions[i+2]);
                                tempVec.applyMatrix4(hitObj.matrixWorld);
                                const distSq = tempVec.distanceToSquared(hit.point);
                                if (distSq < minDistSq) {
                                    minDistSq = distSq;
                                    snappedPoint.copy(tempVec);
                                }
                            }
                        }

                        currentWorldPoint = {
                            x: snappedPoint.x,
                            y: snappedPoint.y,
                            z: snappedPoint.z
                        };
                        gcpState = 'READY_TO_SAVE';
                        updateGcpStatus();
                    }
                }
            }
        }
    });

    animateGcp();
}

function animateGcp() {
    // PAUSE ANIMASI MODAL GCP JIKA TERSEMBUNYI
    if (document.getElementById('gcp-modal').classList.contains('hidden')) return;
    gcpAnimId = requestAnimationFrame(animateGcp);
    updateGcpSpheres();
    if (gcpControls) gcpControls.update();
    if (gcpRenderer && gcpScene && gcpCamera) gcpRenderer.render(gcpScene, gcpCamera);
}

function updateGcpSpheres() {
    gcpSpheres.forEach(s => gcpScene.remove(s));
    gcpSpheres = [];
    
    const createCrosshair3D = (pos) => {
        const dist = gcpCamera.position.y - pos.y;
        const size = Math.max(5.0, dist * 0.04); 
        
        const mat = new THREE.LineBasicMaterial({ color: 0xff0000, depthTest: false, linewidth: 2 });
        const points = [];
        points.push(new THREE.Vector3(pos.x - size, pos.y, pos.z));
        points.push(new THREE.Vector3(pos.x + size, pos.y, pos.z));
        points.push(new THREE.Vector3(pos.x, pos.y, pos.z - size));
        points.push(new THREE.Vector3(pos.x, pos.y, pos.z + size));
        
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const crosshair = new THREE.LineSegments(geo, mat);
        crosshair.renderOrder = 999;
        
        gcpScene.add(crosshair);
        gcpSpheres.push(crosshair);
    };
    
    gcpPairs.forEach(p => { createCrosshair3D(new THREE.Vector3(p.worldX, p.worldY, p.worldZ)); });
    if (currentWorldPoint) { createCrosshair3D(new THREE.Vector3(currentWorldPoint.x, currentWorldPoint.y, currentWorldPoint.z)); }
}

function resizeRightCanvas() {
    const container = document.getElementById('gcp-right-3d');
    const rect = container.getBoundingClientRect();
    if (gcpCamera && gcpRenderer) {
        gcpCamera.aspect = rect.width / rect.height;
        gcpCamera.updateProjectionMatrix();
        gcpRenderer.setSize(rect.width, rect.height);
    }
}

document.getElementById('btn-add-gcp').addEventListener('click', () => {
    gcpState = 'ADDING_IMG';
    currentImgPoint = null;
    currentWorldPoint = null;
    updateGcpStatus();
    drawLeftCanvas();
});

document.getElementById('btn-save-gcp').addEventListener('click', () => {
    if (gcpState === 'READY_TO_SAVE' && currentImgPoint && currentWorldPoint) {
        gcpPairs.push({
            imgPx: currentImgPoint.x,
            imgPy: currentImgPoint.y,
            imgU: currentImgPoint.x / gcpImage.width,
            imgV: 1.0 - (currentImgPoint.y / gcpImage.height),
            worldX: currentWorldPoint.x,
            worldY: currentWorldPoint.y,
            worldZ: currentWorldPoint.z
        });
        currentImgPoint = null;
        currentWorldPoint = null;
        gcpState = 'IDLE';
        updateGcpStatus();
        drawLeftCanvas();
    }
});

function updateGcpStatus() {
    const txt = document.getElementById('gcp-status-text');
    const btnSave = document.getElementById('btn-save-gcp');
    const btnGen = document.getElementById('btn-generate-texture');
    const countBadge = document.getElementById('gcp-count-badge');
    
    countBadge.textContent = `Pasangan: ${gcpPairs.length}`;
    
    if (gcpState === 'IDLE') {
        txt.textContent = "Klik 'Add GCP' untuk mulai. (Geser Klik Kiri untuk Zoom Rect, Tahan Klik Tengah/Kanan untuk Pan/Zoom Kiri)";
        txt.className = "text-[10px] font-mono text-slate-400 ml-2";
        btnSave.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (gcpState === 'ADDING_IMG') {
        txt.textContent = "[1] Klik pada Citra Satelit (Kiri)";
        txt.className = "text-[11px] font-mono text-blue-400 ml-2 font-bold animate-pulse";
        btnSave.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (gcpState === 'ADDING_WORLD') {
        txt.textContent = "[2] Klik pada garis di Top View 3D (Kanan)";
        txt.className = "text-[11px] font-mono text-orange-400 ml-2 font-bold animate-pulse";
        btnSave.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (gcpState === 'READY_TO_SAVE') {
        txt.textContent = "[3] Klik 'Save' untuk menyimpan pasangan ini";
        txt.className = "text-[11px] font-mono text-green-400 ml-2 font-bold";
        btnSave.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    
    if (gcpPairs.length >= 2) btnGen.classList.remove('opacity-50', 'cursor-not-allowed');
    else btnGen.classList.add('opacity-50', 'cursor-not-allowed');
}

function solveLinearSystem3x3(M, U) {
    let det = M[0][0]*(M[1][1]*M[2][2] - M[1][2]*M[2][1])
            - M[0][1]*(M[1][0]*M[2][2] - M[1][2]*M[2][0])
            + M[0][2]*(M[1][0]*M[2][1] - M[1][1]*M[2][0]);
    if(Math.abs(det) < 1e-10) return null;
    
    let invM = [
        [(M[1][1]*M[2][2] - M[1][2]*M[2][1])/det, (M[0][2]*M[2][1] - M[0][1]*M[2][2])/det, (M[0][1]*M[1][2] - M[0][2]*M[1][1])/det],
        [(M[1][2]*M[2][0] - M[1][0]*M[2][2])/det, (M[0][0]*M[2][2] - M[0][2]*M[2][0])/det, (M[0][2]*M[1][0] - M[0][0]*M[1][2])/det],
        [(M[1][0]*M[2][1] - M[1][1]*M[2][0])/det, (M[0][1]*M[2][0] - M[0][0]*M[2][1])/det, (M[0][0]*M[1][1] - M[0][1]*M[1][0])/det]
    ];
    
    return [
        invM[0][0]*U[0] + invM[0][1]*U[1] + invM[0][2]*U[2],
        invM[1][0]*U[0] + invM[1][1]*U[1] + invM[1][2]*U[2],
        invM[2][0]*U[0] + invM[2][1]*U[1] + invM[2][2]*U[2]
    ];
}

function getAffineTransform(pairs) {
    if (pairs.length < 3) return null;
    let sx2 = 0, sxz = 0, sx = 0, sz2 = 0, sz = 0;
    let sux = 0, suz = 0, su = 0;
    let svx = 0, svz = 0, sv = 0;
    let N = pairs.length;
    pairs.forEach(p => {
        let x = p.worldX, z = p.worldZ, u = p.imgU, v = p.imgV;
        sx2 += x*x; sxz += x*z; sx += x;
        sz2 += z*z; sz += z;
        sux += u*x; suz += u*z; su += u;
        svx += v*x; svz += v*z; sv += v;
    });
    let M = [[sx2, sxz, sx], [sxz, sz2, sz], [sx, sz, N]];
    let U = [sux, suz, su];
    let V = [svx, svz, sv];
    let ABC = solveLinearSystem3x3(M, U);
    let DEF = solveLinearSystem3x3(M, V);
    if (ABC && DEF) return { A: ABC[0], B: ABC[1], C: ABC[2], D: DEF[0], E: DEF[1], F: DEF[2] };
    return null;
}

// [REQUIREMENT 2 & 3]: Generate Mask Texture secara global (menghindari memory WebGL Crash)
window.updateGlobalFootprintMask = function() {
    const hasFootprint = typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.children.length > 0;
    
    if (!hasFootprint) {
        if (globalFootprintMask) {
            globalFootprintMask.dispose();
            globalFootprintMask = null;
        }
        globalFootprintBox = null;
        return false;
    }

    if (!globalFootprintBox) globalFootprintBox = new THREE.Box3();
    globalFootprintBox.setFromObject(pitReserveGroup);
    
    const size = globalFootprintBox.getSize(new THREE.Vector3());
    const center = globalFootprintBox.getCenter(new THREE.Vector3());

    if (size.x === 0) size.x = 1;
    if (size.y === 0) size.y = 1;
    if (size.z === 0) size.z = 1;

    if (!globalFootprintMask) {
        const res = 2048;
        globalFootprintMask = new THREE.WebGLRenderTarget(res, res, {
            format: THREE.RGBAFormat,
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter
        });
    }

    const orthoCam = new THREE.OrthographicCamera(
        -size.x / 2, size.x / 2,
        size.z / 2, -size.z / 2,
        0.1, size.y + 1000
    );
    orthoCam.position.set(center.x, globalFootprintBox.max.y + 500, center.z);
    orthoCam.up.set(0, 0, -1);
    orthoCam.lookAt(center.x, center.y, center.z);

    const tempScene = new THREE.Scene();
    tempScene.background = new THREE.Color(0xffffff);

    const pitClone = pitReserveGroup.clone();
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    pitClone.traverse(c => {
        if (c.isMesh) c.material = blackMat;
        else if (c.isLine || c.isLineSegments) c.visible = false;
    });
    tempScene.add(pitClone);

    const oldTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(globalFootprintMask);
    renderer.clear();
    renderer.render(tempScene, orthoCam);
    renderer.setRenderTarget(oldTarget);

    return true;
};


window.removeFootprintMask = function(mesh) {
    if (!mesh || !mesh.material) return;
    mesh.material.onBeforeCompile = function () {};
    mesh.material.customProgramCacheKey = function() { return 'unmasked_' + mesh.material.uuid; };
    mesh.material.needsUpdate = true;
    mesh.userData.hasFootprintMask = false;
};


window.applyFootprintMask = function(mesh) {
    if (!mesh || !mesh.material) return;

    if (!globalFootprintMask || !globalFootprintBox) {
        if (mesh.userData.hasFootprintMask) window.removeFootprintMask(mesh);
        return;
    }

    const size = globalFootprintBox.getSize(new THREE.Vector3());

    // Injeksi logic masking ke material via onBeforeCompile agar mapping UV standar (satelit) tidak terganggu
    mesh.material.onBeforeCompile = function (shader) {
        shader.uniforms.footprintMask = { value: globalFootprintMask.texture };
        shader.uniforms.maskMin = { value: new THREE.Vector2(globalFootprintBox.min.x, globalFootprintBox.min.z) };
        shader.uniforms.maskSize = { value: new THREE.Vector2(size.x, size.z) };

        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            '#include <common>\n varying vec3 vWorldPosMask;'
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\n vWorldPosMask = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            '#include <common>\n varying vec3 vWorldPosMask;\n uniform sampler2D footprintMask;\n uniform vec2 maskMin;\n uniform vec2 maskSize;'
        );
        
        // Map fragment ini bekerja independen terlepas ada texture / map atau tidak
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `
            #include <map_fragment>
            vec2 maskUv = (vWorldPosMask.xz - maskMin) / maskSize;
            maskUv.y = 1.0 - maskUv.y;
            // Evaluasi bounds area sebelum sampling
            if(maskUv.x >= 0.0 && maskUv.x <= 1.0 && maskUv.y >= 0.0 && maskUv.y <= 1.0) {
                vec4 maskColor = texture2D(footprintMask, maskUv);
                // Hitam (< 0.5) artinya di dalam area footprint
                if (maskColor.r < 0.5) {
                    discard; // Buang pixel tsb agar menjadi lubang visual/transparan
                }
            }
            `
        );
    };
    
    // Penting untuk memastikan Shader Cache bekerja unik tiap Material, TIDAK LAGI memaksakan transparent: true.
    mesh.material.customProgramCacheKey = function() { return 'masked_' + mesh.material.uuid; };
    mesh.material.needsUpdate = true;
    mesh.userData.hasFootprintMask = true;
};

// Fungsi dinamis untuk mengiterasi seluruh layer ber-texture saat event penambahan/penghapusan CSV terjadi
window.updateAllTextureMasks = function() {
    window.updateGlobalFootprintMask();

    appLayers.forEach(layer => {
        if (layer.type === 'dxf' && layer.hasFaces && layer.threeObject) {
            layer.threeObject.traverse(child => {
                if (child.isMesh) {
                    // Update masks jika material map (tekstur) aktif ATAU layer di-clip
                    if (layer.clippingEnabled) {
                        window.applyFootprintMask(child);
                    } else {
                        window.removeFootprintMask(child);
                    }
                }
            });
        }
    });

    if (window.is3DRenderingActive && typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
};

document.getElementById('btn-generate-texture').addEventListener('click', () => {
    if (gcpPairs.length < 2) return;
    
    let affine = getAffineTransform(gcpPairs);
    
    let p1, p2, dx_w, dz_w, du, dv, theta_w, theta_u, dTheta, dist_w, dist_u, scale;
    if (!affine) {
        p1 = gcpPairs[0];
        p2 = gcpPairs[1];
        dx_w = p2.worldX - p1.worldX;
        dz_w = p2.worldZ - p1.worldZ;
        du = p2.imgU - p1.imgU;
        dv = p2.imgV - p1.imgV;
        theta_w = Math.atan2(dz_w, dx_w);
        theta_u = Math.atan2(dv, du);
        dTheta = theta_u - theta_w;
        dist_w = Math.hypot(dx_w, dz_w);
        dist_u = Math.hypot(du, dv);
        scale = dist_w === 0 ? 1 : dist_u / dist_w;
    }
    
    const layer = appLayers.find(l => l.id === activeGcpLayerId);
    if (!layer) return;
    
    const texture = new THREE.Texture(gcpImage);
    texture.needsUpdate = true;
    
    layer.threeObject.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const geo = child.geometry;
            const positions = geo.attributes.position;
            if (positions) {
                const uvs = new Float32Array(positions.count * 2);
                
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const z = positions.getZ(i);
                    
                    let finalU, finalV;
                    if (affine) {
                        finalU = affine.A * x + affine.B * z + affine.C;
                        finalV = affine.D * x + affine.E * z + affine.F;
                    } else {
                        const relX = x - p1.worldX;
                        const relZ = z - p1.worldZ;
                        const cosA = Math.cos(dTheta);
                        const sinA = Math.sin(dTheta);
                        const rotX = relX * cosA - relZ * sinA;
                        const rotZ = relX * sinA + relZ * cosA;
                        finalU = rotX * scale + p1.imgU;
                        finalV = rotZ * scale + p1.imgV;
                    }
                    
                    uvs[i * 2] = finalU;
                    uvs[i * 2 + 1] = finalV;
                }
                
                geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                child.material.map = texture;
                child.material.color.setHex(0xffffff); 
                child.material.needsUpdate = true;
                
                if (layer.clippingEnabled) {
                    window.updateGlobalFootprintMask();
                    window.applyFootprintMask(child);
                } else {
                    window.removeFootprintMask(child);
                }
            }
        }
    });
    
    if (window.is3DRenderingActive) renderer.render(scene, camera);
    window.closeGcpModal();
});