// ==========================================
// PIT PROCESSING & LABELS
// ==========================================
const pitProcessingSelect = document.getElementById('pit-processing-select');
const basicPanel = document.getElementById('basic-panel');
const colorOBInput = document.getElementById('color-ob');
const colorCoalInput = document.getElementById('color-coal');

const resgraphicPanel = document.getElementById('resgraphic-panel');
const btnGenerateResgraphic = document.getElementById('btn-generate-resgraphic');
const cumulativeSettings = document.getElementById('cumulative-settings');
const resgraphicDirection = document.getElementById('resgraphic-direction');
const resgraphicSequence = document.getElementById('resgraphic-sequence');

const qualityPanel = document.getElementById('quality-panel');
const qualityTarget = document.getElementById('quality-target');
const qualityFormula = document.getElementById('quality-formula');
const qualityWeightRow = document.getElementById('quality-weight-row');
const qualityWeight = document.getElementById('quality-weight');
const qualityType = document.getElementById('quality-type');
const btnGenerateQuality = document.getElementById('btn-generate-quality');

colorOBInput.value = typeof basicColorOB !== 'undefined' ? basicColorOB : '#aaaaaa';
colorCoalInput.value = typeof basicColorCoal !== 'undefined' ? basicColorCoal : '#000000';

let savedDir = localStorage.getItem('resgraphicDirection');
if (savedDir) resgraphicDirection.value = savedDir;
let savedLimit = localStorage.getItem('srLimit');
if (savedLimit) document.getElementById('sr-limit').value = savedLimit;
let savedFormula = localStorage.getItem('qualityFormula');
if (savedFormula) qualityFormula.value = savedFormula;
let savedWeight = localStorage.getItem('qualityWeight');
if (savedWeight) qualityWeight.value = savedWeight;
let savedType = localStorage.getItem('qualityType');
if (savedType) qualityType.value = savedType;
if (savedFormula === 'weighted_average') {
    if (qualityWeightRow) qualityWeightRow.classList.replace('hidden', 'flex');
} else {
    if (qualityWeightRow) qualityWeightRow.classList.replace('flex', 'hidden');
}

function updateSequenceOptions() {
    if (!resgraphicDirection || !resgraphicSequence) return;
    const dir = resgraphicDirection.value;
    resgraphicSequence.innerHTML = '';
    if (dir.startsWith('strip')) {
        resgraphicSequence.innerHTML = `<option value="block_asc">Block Ascending</option><option value="block_desc">Block Descending</option>`;
    } else if (dir.startsWith('block')) {
        resgraphicSequence.innerHTML = `<option value="strip_asc">Strip Ascending</option><option value="strip_desc">Strip Descending</option>`;
    }
    let savedSeq = localStorage.getItem('resgraphicSequence');
    if (savedSeq && [...resgraphicSequence.options].some(o => o.value === savedSeq)) {
        resgraphicSequence.value = savedSeq;
    }
}
if (resgraphicDirection) resgraphicDirection.addEventListener('change', updateSequenceOptions);
updateSequenceOptions();

function populateQualityDropdown() {
    if (!qualityTarget || typeof csvHeaders === 'undefined') return;
    qualityTarget.innerHTML = '';
    if (csvHeaders.length === 0) return;
    csvHeaders.forEach(h => qualityTarget.add(new Option(h, h)));
    let savedTarget = localStorage.getItem('qualityTarget');
    if (savedTarget && csvHeaders.includes(savedTarget)) qualityTarget.value = savedTarget;
    else qualityTarget.selectedIndex = Math.max(0, csvHeaders.length - 1);
}

if (qualityFormula) {
    qualityFormula.addEventListener('change', (e) => {
        if (!qualityWeightRow) return;
        if (e.target.value === 'weighted_average') {
            qualityWeightRow.classList.remove('hidden'); qualityWeightRow.classList.add('flex');
        } else {
            qualityWeightRow.classList.add('hidden'); qualityWeightRow.classList.remove('flex');
        }
    });
}

if (pitProcessingSelect) {
    pitProcessingSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (resgraphicPanel) { resgraphicPanel.classList.add('hidden'); resgraphicPanel.classList.remove('flex'); }
        if (basicPanel) { basicPanel.classList.add('hidden'); basicPanel.classList.remove('flex'); }
        if (cumulativeSettings) { cumulativeSettings.classList.add('hidden'); cumulativeSettings.classList.remove('flex'); }
        if (qualityPanel) { qualityPanel.classList.add('hidden'); qualityPanel.classList.remove('flex'); }

        if (val === 'basic') { 
            if (basicPanel) { basicPanel.classList.remove('hidden'); basicPanel.classList.add('flex'); }
            resetToBasicColors(); 
        }
        else if (val === 'resgraphic_incremental') { 
            if (resgraphicPanel) { resgraphicPanel.classList.remove('hidden'); resgraphicPanel.classList.add('flex'); }
        } 
        else if (val === 'resgraphic_cumulative') { 
            if (resgraphicPanel) { resgraphicPanel.classList.remove('hidden'); resgraphicPanel.classList.add('flex'); }
            if (cumulativeSettings) { cumulativeSettings.classList.remove('hidden'); cumulativeSettings.classList.add('flex'); }
            updateSequenceOptions(); 
        }
        else if (val === 'quality') { 
            if (qualityPanel) { qualityPanel.classList.remove('hidden'); qualityPanel.classList.add('flex'); }
            if (typeof csvHeaders !== 'undefined' && csvHeaders.length > 0 && qualityTarget.options.length === 0) populateQualityDropdown(); 
        }
        if(typeof updateLayerUI === 'function') updateLayerUI();
    });
}

// Update Color Realtime (Input Listener)
if (colorOBInput) {
    colorOBInput.addEventListener('input', (e) => {
        basicColorOB = e.target.value;
        localStorage.setItem('basicColorOB', basicColorOB);
        resetToBasicColors();
    });
}

if (colorCoalInput) {
    colorCoalInput.addEventListener('input', (e) => {
        basicColorCoal = e.target.value;
        localStorage.setItem('basicColorCoal', basicColorCoal);
        resetToBasicColors();
    });
}

if (btnGenerateResgraphic) {
    btnGenerateResgraphic.addEventListener('click', () => {
        const mode = pitProcessingSelect.value;
        const srLimitStr = document.getElementById('sr-limit').value;
        const srLimit = parseFloat(srLimitStr) || 5;

        localStorage.setItem('srLimit', srLimitStr);
        if (mode === 'resgraphic_cumulative') {
            localStorage.setItem('resgraphicDirection', resgraphicDirection.value);
            localStorage.setItem('resgraphicSequence', resgraphicSequence.value);
        }
        if (mode === 'resgraphic_incremental') generateResgraphicIncremental(srLimit);
        else if (mode === 'resgraphic_cumulative') generateResgraphicCumulative(srLimit);
    });
}

if (btnGenerateQuality) {
    btnGenerateQuality.addEventListener('click', () => {
        localStorage.setItem('qualityTarget', qualityTarget.value);
        localStorage.setItem('qualityFormula', qualityFormula.value);
        localStorage.setItem('qualityWeight', qualityWeight.value);
        localStorage.setItem('qualityType', qualityType.value);
        generateQuality();
    });
}

function clearLabels() {
    const container = document.getElementById('labels-container');
    if (container) container.innerHTML = '';
    if (typeof activeLabels !== 'undefined') activeLabels = [];
}

function createLabel(text, position, refMesh) {
    const div = document.createElement('div');
    div.className = 'block-label';
    div.innerHTML = text;
    div.style.opacity = typeof labelOpacity !== 'undefined' ? labelOpacity : 1;
    const container = document.getElementById('labels-container');
    if (container) container.appendChild(div);
    if (typeof activeLabels !== 'undefined') activeLabels.push({ element: div, position: position, refMesh: refMesh });
}

window.updateLabels = function() {
    if (typeof activeLabels === 'undefined' || activeLabels.length === 0) return;
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    const wHalf = container.clientWidth / 2;
    const hHalf = container.clientHeight / 2;
    const isLayerVisible = typeof pitReserveGroup !== 'undefined' && pitReserveGroup && pitReserveGroup.visible;

    activeLabels.forEach(lbl => {
        if (!isLayerVisible || (typeof isLabelLayerVisible !== 'undefined' && !isLabelLayerVisible) || (lbl.refMesh && (!lbl.refMesh.visible || lbl.refMesh.userData.isRecorded))) {
            lbl.element.style.display = 'none';
            return;
        }
        const pos = lbl.position.clone();
        if (typeof camera !== 'undefined') pos.project(camera);
        if (pos.z > 1 || pos.z < -1) { lbl.element.style.display = 'none'; return; }

        const x = (pos.x * wHalf) + wHalf;
        const y = -(pos.y * hHalf) + hHalf;
        if (x < 0 || x > container.clientWidth || y < 0 || y > container.clientHeight) {
             lbl.element.style.display = 'none';
        } else {
            lbl.element.style.display = 'block';
            lbl.element.style.left = `${x}px`;
            lbl.element.style.top = `${y}px`;
        }
    });
}

// Processing Functions
window.generateQuality = function() {
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup || typeof meshes === 'undefined' || Object.keys(meshes).length === 0) {
        alert("Pit Reserve belum dimuat. Upload file CSV terlebih dahulu.");
        return;
    }

    const targetParam = qualityTarget.value;
    const type = qualityType.value; 
    const formula = qualityFormula.value; 
    const weightFactor = qualityWeight.value; 

    if (!targetParam) {
        alert("Pilih parameter quality terlebih dahulu.");
        return;
    }

    clearLabels();

    const blockStats = {};
    const blockBoxes = {};
    const firstMeshPerBlock = {};
    const reserveMeshes = Object.values(meshes);
    
    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        if (!blockStats[bName]) {
            blockStats[bName] = { sum: 0, weightSum: 0, count: 0, result: null };
            blockBoxes[bName] = new THREE.Box3();
            firstMeshPerBlock[bName] = mesh;
        }
        
        blockBoxes[bName].expandByObject(mesh);
        
        if (mesh.userData.rawRows) {
            mesh.userData.rawRows.forEach(row => {
                const qualVal = parseFloat(row[targetParam]);
                if (isNaN(qualVal)) return;

                let weight = 1;
                let isValidRow = false;

                if (formula === 'weighted_average') {
                    if (weightFactor === 'coal' && (row.BURDEN || '').toUpperCase() === 'RESOURCE') {
                        weight = parseFloat(row.RAWRECMASS) || 0;
                        isValidRow = true;
                    } else if (weightFactor === 'ob' && (row.BURDEN || '').toUpperCase() !== 'RESOURCE') {
                        weight = parseFloat(row.TOTALVOLUME) || 0;
                        isValidRow = true;
                    }
                } else {
                    isValidRow = true; 
                }

                if (isValidRow) {
                    if (formula === 'sum' || formula === 'average') {
                        blockStats[bName].sum += qualVal;
                        blockStats[bName].count += 1;
                    } else if (formula === 'weighted_average' && weight > 0) {
                        blockStats[bName].sum += (qualVal * weight);
                        blockStats[bName].weightSum += weight;
                    }
                }
            });
        }
    });

    let minQ = Infinity;
    let maxQ = -Infinity;

    Object.values(blockStats).forEach(stats => {
        if (formula === 'sum' && stats.count > 0) {
            stats.result = stats.sum;
        } else if (formula === 'average' && stats.count > 0) {
            stats.result = stats.sum / stats.count;
        } else if (formula === 'weighted_average' && stats.weightSum > 0) {
            stats.result = stats.sum / stats.weightSum;
        }

        if (stats.result !== null) {
            if (stats.result < minQ) minQ = stats.result;
            if (stats.result > maxQ) maxQ = stats.result;
        }
    });

    if (minQ === Infinity) minQ = 0;
    if (maxQ === -Infinity) maxQ = 0;
    
    const range = maxQ - minQ;

    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        const stats = blockStats[bName];
        
        if (stats.result === null) {
            const isCoal = mesh.userData.burden.toUpperCase() === 'RESOURCE';
            const cColor = typeof basicColorCoal !== 'undefined' ? basicColorCoal : '#000000';
            const oColor = typeof basicColorOB !== 'undefined' ? basicColorOB : '#aaaaaa';
            mesh.material.color.setHex(isCoal ? parseInt(cColor.replace('#', '0x')) : parseInt(oColor.replace('#', '0x')));
        } else {
            let ratio = 0;
            if (range > 0) {
                ratio = (stats.result - minQ) / range;
            } else {
                ratio = 1; 
            }

            let hue = 0;
            if (type === 'maximize') {
                hue = ratio * 0.66;
            } else {
                hue = (1 - ratio) * 0.66;
            }

            mesh.material.color.setHSL(hue, 1.0, 0.45);
        }
        mesh.material.needsUpdate = true;
    });

    Object.keys(blockStats).forEach(bName => {
        const stats = blockStats[bName];
        if (stats.result !== null) {
            let qText = formula === 'sum' 
                ? stats.result.toLocaleString('en-US', {maximumFractionDigits: 2}) 
                : stats.result.toFixed(2);
            
            const box = blockBoxes[bName];
            const center = box.getCenter(new THREE.Vector3());
            center.y = box.max.y + 5; 
            
            createLabel(`${targetParam}: <span class="text-yellow-300 font-bold">${qText}</span>`, center, firstMeshPerBlock[bName]);
        }
    });

    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
}

window.generateResgraphicIncremental = function(srLimit) {
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup || typeof meshes === 'undefined' || Object.keys(meshes).length === 0) {
        alert("Pit Reserve belum dimuat. Upload file CSV terlebih dahulu.");
        return;
    }

    clearLabels();

    const blockStats = {};
    const blockBoxes = {};
    const firstMeshPerBlock = {};
    const reserveMeshes = Object.values(meshes);
    
    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        if (!blockStats[bName]) {
            blockStats[bName] = { ob: 0, coal: 0 };
            blockBoxes[bName] = new THREE.Box3();
            firstMeshPerBlock[bName] = mesh;
        }
        blockStats[bName].ob += mesh.userData.obVolume || 0;
        blockStats[bName].coal += mesh.userData.coalMass || 0;
        blockBoxes[bName].expandByObject(mesh);
    });

    let minSR = Infinity;
    Object.values(blockStats).forEach(stats => {
        if (stats.coal > 0) {
            let sr = stats.ob / stats.coal;
            if (sr >= 0 && sr < minSR) minSR = sr;
        }
    });
    if (minSR === Infinity) minSR = 0;

    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        const stats = blockStats[bName];
        
        let sr = stats.coal > 0 ? (stats.ob / stats.coal) : Infinity;
        
        if (sr === Infinity || sr < 0) {
            mesh.material.color.setHex(0xffffff);
        } else {
            let range = srLimit - minSR;
            let ratio = 0;
            
            if (range <= 0) {
                ratio = sr >= srLimit ? 1 : 0;
            } else {
                ratio = (sr - minSR) / range;
            }
            
            if (ratio > 1) ratio = 1;
            if (ratio < 0) ratio = 0;
            
            let hue = 0.66 * (1 - ratio);
            mesh.material.color.setHSL(hue, 1.0, 0.45);
        }
        
        mesh.material.needsUpdate = true;
    });

    Object.keys(blockStats).forEach(bName => {
        const stats = blockStats[bName];
        let sr = stats.coal > 0 ? (stats.ob / stats.coal) : Infinity;
        let srText = sr === Infinity ? "-" : sr.toFixed(2);
        
        const box = blockBoxes[bName];
        const center = box.getCenter(new THREE.Vector3());
        center.y = box.max.y + 5; 
        
        createLabel(`SR: <span class="text-blue-300">${srText}</span>`, center, firstMeshPerBlock[bName]);
    });
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
}

window.generateResgraphicCumulative = function(srLimit) {
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup || typeof meshes === 'undefined' || Object.keys(meshes).length === 0) {
        alert("Pit Reserve belum dimuat. Upload file CSV terlebih dahulu.");
        return;
    }

    clearLabels();

    const dir = resgraphicDirection ? resgraphicDirection.value : 'strip_asc'; 
    const seq = resgraphicSequence ? resgraphicSequence.value : 'block_asc'; 

    const blockStats = {};
    const blockBoxes = {};
    const firstMeshPerBlock = {};
    const reserveMeshes = Object.values(meshes);
    
    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        if (!blockStats[bName]) {
            blockStats[bName] = { name: bName, ob: 0, coal: 0 };
            blockBoxes[bName] = new THREE.Box3();
            firstMeshPerBlock[bName] = mesh;
        }
        blockStats[bName].ob += mesh.userData.obVolume || 0;
        blockStats[bName].coal += mesh.userData.coalMass || 0;
        blockBoxes[bName].expandByObject(mesh);
    });

    const statsArray = Object.values(blockStats).map(stat => {
        const sMatch = stat.name.match(/(?:S|STRIP)[^\d]*(\d+)/i);
        const bMatch = stat.name.match(/(?:B|BLOCK)[^\d]*(\d+)/i);
        
        return {
            ...stat,
            sNum: sMatch ? parseInt(sMatch[1], 10) : 0,
            bNum: bMatch ? parseInt(bMatch[1], 10) : 0
        };
    });

    statsArray.sort((a, b) => {
        let primaryA, primaryB, secondaryA, secondaryB;
        let primaryAsc = true, secondaryAsc = true;

        if (dir.startsWith('strip')) {
            primaryA = a.sNum; primaryB = b.sNum;
            secondaryA = a.bNum; secondaryB = b.bNum;
            primaryAsc = dir === 'strip_asc';
            secondaryAsc = seq === 'block_asc';
        } else {
            primaryA = a.bNum; primaryB = b.bNum;
            secondaryA = a.sNum; secondaryB = b.sNum;
            primaryAsc = dir === 'block_asc';
            secondaryAsc = seq === 'strip_asc';
        }

        if (primaryA !== primaryB) return primaryAsc ? primaryA - primaryB : primaryB - primaryA;
        if (secondaryA !== secondaryB) return secondaryAsc ? secondaryA - secondaryB : secondaryB - secondaryA;
        return a.name.localeCompare(b.name);
    });

    let cumOB = 0;
    let cumCoal = 0;
    const cumulativeSRMap = {};

    statsArray.forEach(stat => {
        cumOB += stat.ob;
        cumCoal += stat.coal;
        let cumSR = cumCoal > 0 ? (cumOB / cumCoal) : Infinity;
        cumulativeSRMap[stat.name] = cumSR;
    });

    let minSR = Infinity;
    Object.values(cumulativeSRMap).forEach(sr => {
        if (sr >= 0 && sr < minSR && sr !== Infinity) minSR = sr;
    });
    if (minSR === Infinity) minSR = 0;

    reserveMeshes.forEach(mesh => {
        const bName = mesh.userData.blockName;
        const cumSR = cumulativeSRMap[bName];
        
        if (cumSR === Infinity || cumSR < 0) {
            mesh.material.color.setHex(0xffffff); 
        } else {
            let range = srLimit - minSR;
            let ratio = 0;
            if (range <= 0) ratio = cumSR >= srLimit ? 1 : 0;
            else ratio = (cumSR - minSR) / range;
            
            if (ratio > 1) ratio = 1;
            if (ratio < 0) ratio = 0;
            
            let hue = 0.66 * (1 - ratio);
            mesh.material.color.setHSL(hue, 1.0, 0.45);
        }
        mesh.material.needsUpdate = true;
    });

    let index = 1;
    statsArray.forEach(stat => {
        const bName = stat.name;
        const cumSR = cumulativeSRMap[bName];

        let srText = cumSR === Infinity ? "-" : cumSR.toFixed(2);
        let labelText = `<span class="text-green-400">#${index}</span> | SR: <span class="text-blue-300">${srText}</span>`;

        const box = blockBoxes[bName];
        if (box) {
            const center = box.getCenter(new THREE.Vector3());
            center.y = box.max.y + 5;
            createLabel(labelText, center, firstMeshPerBlock[bName]);
        }
        index++;
    });
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
}

window.resetToBasicColors = function() {
    clearLabels();
    if (typeof pitReserveGroup === 'undefined' || !pitReserveGroup || typeof meshes === 'undefined' || Object.keys(meshes).length === 0) return;
    
    Object.values(meshes).forEach(mesh => {
        const isCoal = mesh.userData.burden.toUpperCase() === 'RESOURCE';
        const cColor = typeof basicColorCoal !== 'undefined' ? basicColorCoal : '#000000';
        const oColor = typeof basicColorOB !== 'undefined' ? basicColorOB : '#aaaaaa';
        const blockColor = isCoal ? cColor : oColor; 
        mesh.material.color.set(blockColor);
        mesh.material.needsUpdate = true;
    });
    
    if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
        renderer.render(scene, camera);
    }
}