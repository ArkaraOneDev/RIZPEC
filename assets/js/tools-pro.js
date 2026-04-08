// ==========================================
// FITUR PRO UNTUK LAYER TOOLS (MODAL IMPORT/EXPORT)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Injeksi HTML Modal secara Dinamis (Desain Kompak & Font Diperkecil + Scrollable Content + Fixed Footer)
    const modalHTML = `
        <!-- Layer Pro Modal -->
        <div id="layer-pro-modal" class="fixed inset-0 bg-black/80 z-[300] hidden items-center justify-center backdrop-blur-sm p-4">
            <div class="bg-slate-800 border border-slate-600 rounded-xl w-full max-w-[280px] lg:max-w-[300px] shadow-2xl flex flex-col overflow-hidden relative">
                
                <!-- HEADER (FIXED) -->
                <div class="h-8 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-3 shrink-0 shadow z-10">
                    <h2 class="text-white font-bold text-[11px]"><i class="fa-solid fa-crown mr-1.5 text-cyan-400"></i> Pro Features</h2>
                    <button id="close-layer-pro" class="text-slate-400 hover:text-white transition-colors"><i class="fa-solid fa-xmark text-[11px]"></i></button>
                </div>
                
                <!-- BODY (SCROLLABLE AREA) -->
                <!-- max-h-[300px] akan memaksa form untuk scroll saat Lithology Data terbuka -->
                <div class="p-3 flex flex-col gap-1.5 overflow-y-auto max-h-[300px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-slate-800 [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                    
                    <!-- Process & Database -->
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Process</span>
                        <select id="pro-process" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-white outline-none w-36 focus:border-cyan-500 transition-colors">
                            <option value="import" selected>Import</option>
                            <option value="export">Export</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Database</span>
                        <select id="pro-database" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-white outline-none w-36 focus:border-cyan-500 transition-colors">
                            <option value="drill_hole">Drill Hole</option>
                            <option value="fleet" selected>Fleet</option>
                        </select>
                    </div>

                    <!-- Separator Amber -->
                    <div class="border-t border-amber-500/50 w-full my-0.5"></div>

                    <!-- Header Section 1 -->
                    <div id="header-fleet-collar" class="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-0.5 transition-all">Fleet Data</div>

                    <!-- File 1 (Collar/Fleet) -->
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">File</span>
                        <div class="flex flex-col items-end w-36">
                            <label class="w-full cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded text-[9px] font-semibold transition-all border border-slate-600 flex items-center justify-center gap-1 shadow-sm m-0">
                                <i class="fa-solid fa-upload text-blue-400"></i> Choose File
                                <input type="file" id="pro-file-input" accept=".csv,.txt" class="hidden">
                            </label>
                        </div>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">File Name</span>
                        <div id="pro-filename-display" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-cyan-400 truncate w-36">-</div>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Delimiter</span>
                        <select id="pro-delimiter" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-white outline-none w-36 focus:border-cyan-500 transition-colors">
                            <option value="column" selected>Column</option>
                            <option value="comma">Comma</option>
                            <option value="space">Space</option>
                            <option value="tab">Tab</option>
                        </select>
                    </div>

                    <!-- Columns Section 1 -->
                    <!-- Hole ID (Hidden in Fleet Mode) -->
                    <div id="wrapper-hole-id" class="hidden items-center justify-between mt-0.5">
                        <span class="text-[10px] font-semibold text-slate-300">Hole ID</span>
                        <select id="pro-col-hole-id" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between mt-0.5">
                        <span class="text-[10px] font-semibold text-slate-300">Easting</span>
                        <select id="pro-col-easting" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Northing</span>
                        <select id="pro-col-northing" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Elevation</span>
                        <select id="pro-col-elevation" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <!-- Code / Depth -->
                    <div class="flex items-center justify-between">
                        <span id="label-code-depth" class="text-[10px] font-semibold text-slate-300">Code</span>
                        <select id="pro-col-code" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <!-- Azimuth & Inclination (Khusus Drill Hole Mode) -->
                    <div id="wrapper-azimuth" class="hidden items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Azimuth</span>
                        <select id="pro-col-azimuth" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>
                    <div id="wrapper-inclination" class="hidden items-center justify-between">
                        <span class="text-[10px] font-semibold text-slate-300">Inclination</span>
                        <select id="pro-col-inclination" class="pro-col-select bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                            <option value="">-</option>
                        </select>
                    </div>

                    <!-- ============================================== -->
                    <!-- SECTION 2: LITHOLOGY DATA (Hidden in Fleet Mode) -->
                    <!-- ============================================== -->
                    <div id="section-lithology" class="hidden flex-col gap-1.5 mt-1 border-t border-slate-700 pt-1.5">
                        <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Lithology Data</div>
                        
                        <!-- File 2 (Lithology) -->
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">File</span>
                            <div class="flex flex-col items-end w-36">
                                <label class="w-full cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded text-[9px] font-semibold transition-all border border-slate-600 flex items-center justify-center gap-1 shadow-sm m-0">
                                    <i class="fa-solid fa-upload text-blue-400"></i> Choose File
                                    <input type="file" id="pro-file-input-litho" accept=".csv,.txt" class="hidden">
                                </label>
                            </div>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">File Name</span>
                            <div id="pro-filename-display-litho" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-cyan-400 truncate w-36">-</div>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">Delimiter</span>
                            <select id="pro-delimiter-litho" class="bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-white outline-none w-36 focus:border-cyan-500 transition-colors">
                                <option value="column" selected>Column</option>
                                <option value="comma">Comma</option>
                                <option value="space">Space</option>
                                <option value="tab">Tab</option>
                            </select>
                        </div>

                        <!-- Columns Section 2 -->
                        <div class="flex items-center justify-between mt-0.5">
                            <span class="text-[10px] font-semibold text-slate-300">Hole ID</span>
                            <select id="pro-col-hole-id-litho" class="pro-col-select-litho bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                                <option value="">-</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">Top Depth</span>
                            <select id="pro-col-top-depth" class="pro-col-select-litho bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                                <option value="">-</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">Base Depth</span>
                            <select id="pro-col-base-depth" class="pro-col-select-litho bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                                <option value="">-</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">Thickness</span>
                            <select id="pro-col-thickness" class="pro-col-select-litho bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                                <option value="">-</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[10px] font-semibold text-slate-300">Seam</span>
                            <select id="pro-col-seam" class="pro-col-select-litho bg-slate-900 border border-slate-600 rounded px-1.5 py-1 text-[10px] text-slate-500 outline-none w-36 focus:border-cyan-500 transition-colors" disabled>
                                <option value="">-</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- FOOTER (FIXED Generate Button) -->
                <div class="p-3 pt-2 bg-slate-800 border-t border-slate-700 shrink-0">
                    <button id="btn-pro-generate" class="w-full bg-slate-600 text-slate-400 font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-not-allowed" disabled>
                        Generate
                    </button>
                </div>

            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // ==========================================
    // DOM REFERENCES
    // ==========================================
    const btnLayerPro = document.getElementById('btn-layer-pro');
    const modalPro = document.getElementById('layer-pro-modal');
    const btnClosePro = document.getElementById('close-layer-pro');
    
    const dbSelect = document.getElementById('pro-database');

    // Section 1 (Fleet/Collar)
    const fileInput = document.getElementById('pro-file-input');
    const fileNameDisplay = document.getElementById('pro-filename-display');
    const delimiterSelect = document.getElementById('pro-delimiter');
    const colSelects = document.querySelectorAll('.pro-col-select');

    // Section 2 (Lithology)
    const fileInputLitho = document.getElementById('pro-file-input-litho');
    const fileNameDisplayLitho = document.getElementById('pro-filename-display-litho');
    const delimiterSelectLitho = document.getElementById('pro-delimiter-litho');
    const colSelectsLitho = document.querySelectorAll('.pro-col-select-litho');

    const btnGenerate = document.getElementById('btn-pro-generate');
    
    // Variables for File 1
    let currentColumnsCount = 0;
    let fileContentFirstLine = "";
    let fullFileContent = ""; 
    let isProDataSynced = false; 

    // Variables for File 2 (Lithology)
    let currentColumnsCountLitho = 0;
    let fileContentFirstLineLitho = "";
    let fullFileContentLitho = ""; 
    let isLithoDataSynced = false; 

    window.fleetCount = window.fleetCount || 0; 

    // ==========================================
    // OVERRIDE RESUME 3D UNTUK MODAL
    // ==========================================
    if (typeof window.resume3D === 'function') {
        const originalResume3D = window.resume3D;
        window.resume3D = function() {
            if (modalPro && !modalPro.classList.contains('hidden')) {
                return; 
            }
            originalResume3D();
        };
    }

    // ==========================================
    // TOGGLE UI BERDASARKAN DATABASE (FLEET vs DRILL HOLE)
    // ==========================================
    dbSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const headerText = document.getElementById('header-fleet-collar');
        const wrapperHoleId = document.getElementById('wrapper-hole-id');
        const wrapperAzimuth = document.getElementById('wrapper-azimuth');
        const wrapperInclination = document.getElementById('wrapper-inclination');
        const labelCodeDepth = document.getElementById('label-code-depth');
        const sectionLitho = document.getElementById('section-lithology');

        if (val === 'drill_hole') {
            headerText.textContent = 'Collar Data';
            wrapperHoleId.classList.remove('hidden'); wrapperHoleId.classList.add('flex');
            wrapperAzimuth.classList.remove('hidden'); wrapperAzimuth.classList.add('flex');
            wrapperInclination.classList.remove('hidden'); wrapperInclination.classList.add('flex');
            labelCodeDepth.textContent = 'Depth';
            
            sectionLitho.classList.remove('hidden');
            sectionLitho.classList.add('flex');
        } else {
            headerText.textContent = 'Fleet Data';
            wrapperHoleId.classList.add('hidden'); wrapperHoleId.classList.remove('flex');
            wrapperAzimuth.classList.add('hidden'); wrapperAzimuth.classList.remove('flex');
            wrapperInclination.classList.add('hidden'); wrapperInclination.classList.remove('flex');
            labelCodeDepth.textContent = 'Code';
            
            sectionLitho.classList.add('hidden');
            sectionLitho.classList.remove('flex');
        }
        
        updateColumns(); 
        resetGenerateButton();
    });

    // 1. Modal Triggers
    if (btnLayerPro) {
        btnLayerPro.addEventListener('click', (e) => {
            e.stopPropagation();
            modalPro.classList.remove('hidden');
            modalPro.classList.add('flex');
            
            if (typeof controls !== 'undefined' && controls) controls.enabled = false;
            if (typeof window.pause3D === 'function') window.pause3D();
        });
    }

    if (btnClosePro) {
        btnClosePro.addEventListener('click', () => {
            modalPro.classList.add('hidden'); 
            modalPro.classList.remove('flex');
            resetGenerateButton();
            
            if (typeof controls !== 'undefined' && controls) controls.enabled = true;
            if (typeof window.resume3D === 'function') window.resume3D();
        });
    }

    // ==========================================
    // FILE HANDLERS
    // ==========================================
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            const reader = new FileReader();
            reader.onload = function(event) {
                fullFileContent = event.target.result;
                const lines = fullFileContent.split('\n');
                if (lines.length > 0) {
                    fileContentFirstLine = lines[0].trim();
                    updateColumns(); 
                }
            };
            reader.readAsText(file);
        } else {
            fileNameDisplay.textContent = "-";
            fileContentFirstLine = "";
            fullFileContent = "";
            updateColumns();
        }
    });

    fileInputLitho.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplayLitho.textContent = file.name;
            const reader = new FileReader();
            reader.onload = function(event) {
                fullFileContentLitho = event.target.result;
                const lines = fullFileContentLitho.split('\n');
                if (lines.length > 0) {
                    fileContentFirstLineLitho = lines[0].trim();
                    updateColumnsLitho(); 
                }
            };
            reader.readAsText(file);
        } else {
            fileNameDisplayLitho.textContent = "-";
            fileContentFirstLineLitho = "";
            fullFileContentLitho = "";
            updateColumnsLitho();
        }
    });

    delimiterSelect.addEventListener('change', updateColumns);
    delimiterSelectLitho.addEventListener('change', updateColumnsLitho);

    // ==========================================
    // COLUMNS LOGIC - SECTION 1 (Collar/Fleet)
    // ==========================================
    function updateColumns() {
        if (!fileContentFirstLine) {
            currentColumnsCount = 0;
            populateDropdowns([]);
            return;
        }

        const delimValue = delimiterSelect.value;
        let activeDelim = delimValue;
        let columns = [];

        if (activeDelim === 'column') {
            if (fileContentFirstLine.includes(',')) activeDelim = 'comma';
            else if (fileContentFirstLine.includes('\t')) activeDelim = 'tab';
            else activeDelim = 'space';
        }

        if (activeDelim === 'comma') columns = fileContentFirstLine.split(',');
        else if (activeDelim === 'space') columns = fileContentFirstLine.split(/ +/);
        else if (activeDelim === 'tab') columns = fileContentFirstLine.split('\t');

        columns = columns.map(c => c.trim()).filter(c => c.length > 0);
        currentColumnsCount = columns.length;
        populateDropdowns(columns);
    }

    function populateDropdowns(columns) {
        const count = columns.length;
        const delimValue = delimiterSelect.value;
        const dbMode = dbSelect.value;
        
        const lowerCols = columns.map(c => c.toLowerCase());
        let idxH = lowerCols.findIndex(c => c.includes('hole') || c.includes('id'));
        let idxE = lowerCols.findIndex(c => c.includes('easting') || c === 'x');
        let idxN = lowerCols.findIndex(c => c.includes('northing') || c === 'y');
        let idxZ = lowerCols.findIndex(c => c.includes('elevation') || c.includes('elev') || c === 'z');
        let idxAzi = lowerCols.findIndex(c => c.includes('azimuth') || c === 'azi' || c === 'azm');
        let idxInc = lowerCols.findIndex(c => c.includes('inclination') || c === 'inc' || c === 'dip');
        let idxC = lowerCols.findIndex(c => c.includes('code') || c.includes('depth') || c === 'c');

        const hasHeadersFleet = idxE !== -1 && idxN !== -1 && idxZ !== -1 && idxC !== -1;
        const hasHeadersCollar = idxH !== -1 && idxE !== -1 && idxN !== -1 && idxZ !== -1 && idxC !== -1;
        
        if (dbMode === 'fleet') {
            isProDataSynced = count >= 3; 
            if (delimValue === 'column') isProDataSynced = hasHeadersFleet;
        } else {
            isProDataSynced = count >= 4; 
            if (delimValue === 'column') isProDataSynced = hasHeadersCollar;
        }
        
        colSelects.forEach(select => {
            select.innerHTML = '';
            if (!isProDataSynced) {
                const opt = document.createElement('option');
                opt.value = ""; opt.textContent = "-";
                select.appendChild(opt);
                select.disabled = true;
                select.classList.replace('text-white', 'text-slate-500');
            } else {
                select.disabled = false;
                select.classList.replace('text-slate-500', 'text-white');
                for (let i = 1; i <= count; i++) {
                    const opt = document.createElement('option');
                    opt.value = `COL_${i}`; opt.textContent = `COL_${i}`;
                    select.appendChild(opt);
                }
            }
        });

        resetGenerateButton();

        if (isProDataSynced) {
            const holeSelect = document.getElementById('pro-col-hole-id');
            const eastingSelect = document.getElementById('pro-col-easting');
            const northingSelect = document.getElementById('pro-col-northing');
            const elevationSelect = document.getElementById('pro-col-elevation');
            const aziSelect = document.getElementById('pro-col-azimuth');
            const incSelect = document.getElementById('pro-col-inclination');
            const codeSelect = document.getElementById('pro-col-code');

            if ((dbMode === 'fleet' && hasHeadersFleet) || (dbMode === 'drill_hole' && hasHeadersCollar)) {
                if (idxH !== -1) holeSelect.value = `COL_${idxH + 1}`;
                eastingSelect.value = `COL_${idxE + 1}`;
                northingSelect.value = `COL_${idxN + 1}`;
                elevationSelect.value = `COL_${idxZ + 1}`;
                if (idxAzi !== -1) aziSelect.value = `COL_${idxAzi + 1}`;
                if (idxInc !== -1) incSelect.value = `COL_${idxInc + 1}`;
                codeSelect.value = `COL_${idxC + 1}`;
            } else {
                let counter = 1;
                if (dbMode === 'drill_hole') holeSelect.value = `COL_${counter++}`;
                eastingSelect.value = `COL_${counter++}`;
                northingSelect.value = `COL_${counter++}`;
                elevationSelect.value = `COL_${counter++}`;
                if (count >= counter) codeSelect.value = `COL_${counter}`;
            }
        }
    }

    // ==========================================
    // COLUMNS LOGIC - SECTION 2 (Lithology)
    // ==========================================
    function updateColumnsLitho() {
        if (!fileContentFirstLineLitho) {
            currentColumnsCountLitho = 0;
            populateDropdownsLitho([]);
            return;
        }

        const delimValue = delimiterSelectLitho.value;
        let activeDelim = delimValue;
        let columns = [];

        if (activeDelim === 'column') {
            if (fileContentFirstLineLitho.includes(',')) activeDelim = 'comma';
            else if (fileContentFirstLineLitho.includes('\t')) activeDelim = 'tab';
            else activeDelim = 'space';
        }

        if (activeDelim === 'comma') columns = fileContentFirstLineLitho.split(',');
        else if (activeDelim === 'space') columns = fileContentFirstLineLitho.split(/ +/);
        else if (activeDelim === 'tab') columns = fileContentFirstLineLitho.split('\t');

        columns = columns.map(c => c.trim()).filter(c => c.length > 0);
        currentColumnsCountLitho = columns.length;
        populateDropdownsLitho(columns);
    }

    function populateDropdownsLitho(columns) {
        const count = columns.length;
        const delimValue = delimiterSelectLitho.value;
        
        const lowerCols = columns.map(c => c.toLowerCase());
        let idxH = lowerCols.findIndex(c => c.includes('hole') || c.includes('id'));
        let idxT = lowerCols.findIndex(c => c.includes('top') || c.includes('from'));
        let idxB = lowerCols.findIndex(c => c.includes('base') || c.includes('bottom') || c.includes('to'));
        let idxThk = lowerCols.findIndex(c => c.includes('thick'));
        let idxS = lowerCols.findIndex(c => c.includes('seam') || c.includes('litho'));

        const hasHeadersLitho = idxH !== -1 && idxT !== -1 && idxB !== -1 && idxS !== -1;
        
        isLithoDataSynced = count >= 4; 
        if (delimValue === 'column') {
            isLithoDataSynced = hasHeadersLitho; 
        }
        
        colSelectsLitho.forEach(select => {
            select.innerHTML = '';
            if (!isLithoDataSynced) {
                const opt = document.createElement('option');
                opt.value = ""; opt.textContent = "-";
                select.appendChild(opt);
                select.disabled = true;
                select.classList.replace('text-white', 'text-slate-500');
            } else {
                select.disabled = false;
                select.classList.replace('text-slate-500', 'text-white');

                // Tambahkan opsi "None" di paling atas KHUSUS untuk Thickness dan Seam
                if (select.id === 'pro-col-thickness' || select.id === 'pro-col-seam') {
                    const optNone = document.createElement('option');
                    optNone.value = "none"; optNone.textContent = "None";
                    select.appendChild(optNone);
                }

                for (let i = 1; i <= count; i++) {
                    const opt = document.createElement('option');
                    opt.value = `COL_${i}`; opt.textContent = `COL_${i}`;
                    select.appendChild(opt);
                }
            }
        });

        resetGenerateButton();

        if (isLithoDataSynced) {
            const holeSelectLitho = document.getElementById('pro-col-hole-id-litho');
            const topSelect = document.getElementById('pro-col-top-depth');
            const baseSelect = document.getElementById('pro-col-base-depth');
            const thickSelect = document.getElementById('pro-col-thickness');
            const seamSelect = document.getElementById('pro-col-seam');

            if (hasHeadersLitho) {
                holeSelectLitho.value = `COL_${idxH + 1}`;
                topSelect.value = `COL_${idxT + 1}`;
                baseSelect.value = `COL_${idxB + 1}`;
                if (idxThk !== -1) thickSelect.value = `COL_${idxThk + 1}`; else thickSelect.value = 'none';
                if (idxS !== -1) seamSelect.value = `COL_${idxS + 1}`; else seamSelect.value = 'none';
            } else {
                let counter = 1;
                holeSelectLitho.value = `COL_${counter++}`;
                topSelect.value = `COL_${counter++}`;
                baseSelect.value = `COL_${counter++}`;
                
                // Jangan override 'none' jika kita kehabisan kolom fallback
                if (count >= counter) thickSelect.value = `COL_${counter++}`; 
                if (count >= counter) seamSelect.value = `COL_${counter++}`;
            }
        }
    }

    // ==========================================
    // LOGIKA TOMBOL GENERATE & RENDERING 3D (DOTS, LINES, & SEAMS)
    // ==========================================
    function resetGenerateButton() {
        btnGenerate.innerHTML = "Generate";
        const isFleetValid = dbSelect.value === 'fleet' && isProDataSynced;
        const isDrillValid = dbSelect.value === 'drill_hole' && isProDataSynced && isLithoDataSynced;

        if (isFleetValid || isDrillValid) {
            btnGenerate.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5";
            btnGenerate.disabled = false;
        } else {
            btnGenerate.className = "w-full bg-slate-600 text-slate-400 font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-not-allowed";
            btnGenerate.disabled = true;
        }
    }

    btnGenerate.addEventListener('click', () => {
        const eVal = document.getElementById('pro-col-easting').value;
        const nVal = document.getElementById('pro-col-northing').value;
        const zVal = document.getElementById('pro-col-elevation').value;

        const isFleetValid = dbSelect.value === 'fleet' && isProDataSynced;
        const isDrillValid = dbSelect.value === 'drill_hole' && isProDataSynced && isLithoDataSynced;

        if ((!isFleetValid && !isDrillValid) || !eVal || !nVal || !zVal) {
            btnGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
            btnGenerate.className = "w-full bg-slate-600 text-slate-300 font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-wait";
            btnGenerate.disabled = true;

            setTimeout(() => { showGenerateRetry(); }, 800);
            return;
        }

        btnGenerate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
        btnGenerate.className = "w-full bg-slate-600 text-slate-300 font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-wait";
        btnGenerate.disabled = true;
        
        setTimeout(() => {
            showGenerateSuccess(eVal, nVal, zVal);
        }, 1200);
    });

    // Helper untuk Split Array
    function getCols(line, activeDelim) {
        if (activeDelim === 'comma') return line.split(',').map(c => c.trim()).filter(c => c.length > 0);
        if (activeDelim === 'space') return line.split(/ +/).map(c => c.trim()).filter(c => c.length > 0);
        if (activeDelim === 'tab') return line.split('\t').map(c => c.trim()).filter(c => c.length > 0);
        return [line.trim()];
    }

    function showGenerateSuccess(eVal, nVal, zVal) {
        btnGenerate.innerHTML = `<i class="fa-solid fa-check"></i> Success`;
        btnGenerate.className = "w-full bg-emerald-600 text-white font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5 cursor-default";
        
        const dbType = dbSelect.value;
        const delimValue = delimiterSelect.value;
        let activeDelim = delimValue;
        
        if (activeDelim === 'column') {
            if (fileContentFirstLine.includes(',')) activeDelim = 'comma';
            else if (fileContentFirstLine.includes('\t')) activeDelim = 'tab';
            else activeDelim = 'space';
        }

        const idxE = parseInt(eVal.replace('COL_', '')) - 1;
        const idxN = parseInt(nVal.replace('COL_', '')) - 1;
        const idxZ = parseInt(zVal.replace('COL_', '')) - 1;
        
        const lines = fullFileContent.split('\n');
        const startIndex = (delimValue === 'column') ? 1 : 0;
        
        const layerGroup = new THREE.Group();
        const parsedPoints = [];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        
        // ==========================================
        // PROSES: FLEET DATA
        // ==========================================
        if (dbType === 'fleet') {
            for (let i = startIndex; i < lines.length; i++) {
                let line = lines[i].trim();
                if (!line) continue;
                
                let cols = getCols(line, activeDelim);
                if (cols.length > Math.max(idxE, idxN, idxZ)) {
                    let rawX = parseFloat(cols[idxE]); 
                    let rawY = parseFloat(cols[idxZ]); 
                    let rawZ = -parseFloat(cols[idxN]); 
                    
                    if (!isNaN(rawX) && !isNaN(rawY) && !isNaN(rawZ)) {
                        if (rawX === 0 || rawZ === 0) continue;

                        if (rawX < minX) minX = rawX; if (rawX > maxX) maxX = rawX;
                        if (rawY < minY) minY = rawY; if (rawY > maxY) maxY = rawY;
                        if (rawZ < minZ) minZ = rawZ; if (rawZ > maxZ) maxZ = rawZ;

                        let finalX = rawX, finalY = rawY, finalZ = rawZ;
                        if (window.worldOrigin && window.worldOrigin.isSet) {
                            finalX -= window.worldOrigin.x;
                            finalY -= window.worldOrigin.y;
                            finalZ -= window.worldOrigin.z;
                        }
                        parsedPoints.push(new THREE.Vector3(finalX, finalY, finalZ));
                    }
                }
            }

            // Fallback Offset untuk file pertama yang di Load
            if (window.worldOrigin && !window.worldOrigin.isSet && minX !== Infinity) {
                window.worldOrigin = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2, isSet: true };
                parsedPoints.forEach(pt => {
                    pt.x -= window.worldOrigin.x; pt.y -= window.worldOrigin.y; pt.z -= window.worldOrigin.z;
                });
            }
        } 
        
        // ==========================================
        // PROSES: DRILL HOLE DATA
        // ==========================================
        else if (dbType === 'drill_hole') {
            
            // 1. Ekstrak Collar, Kedalaman, Azimuth, Inclination
            const hVal = document.getElementById('pro-col-hole-id').value;
            const aziVal = document.getElementById('pro-col-azimuth').value;
            const incVal = document.getElementById('pro-col-inclination').value;
            const cVal = document.getElementById('pro-col-code').value; // Depth

            const idxH = hVal ? parseInt(hVal.replace('COL_', '')) - 1 : -1;
            const idxAzi = aziVal ? parseInt(aziVal.replace('COL_', '')) - 1 : -1;
            const idxInc = incVal ? parseInt(incVal.replace('COL_', '')) - 1 : -1;
            const idxC = cVal ? parseInt(cVal.replace('COL_', '')) - 1 : -1;

            const collarMap = new Map();

            for (let i = startIndex; i < lines.length; i++) {
                let line = lines[i].trim();
                if (!line) continue;
                
                let cols = getCols(line, activeDelim);
                if (cols.length > Math.max(idxE, idxN, idxZ)) {
                    let rawX = parseFloat(cols[idxE]);
                    let rawY = parseFloat(cols[idxZ]);
                    let rawZ = -parseFloat(cols[idxN]);
                    
                    let holeId = idxH >= 0 ? cols[idxH] : `Hole_${i}`;
                    let depth = idxC >= 0 ? parseFloat(cols[idxC]) : 0;
                    
                    // Ekstrak arah pengeboran (Trajectory Spasial)
                    let azimuth = idxAzi >= 0 ? parseFloat(cols[idxAzi]) : 0;
                    let inclination = idxInc >= 0 ? parseFloat(cols[idxInc]) : 90; // Default Vertical (90 deg)
                    
                    if (isNaN(azimuth)) azimuth = 0;
                    if (isNaN(inclination)) inclination = 90;

                    // Mengkalkulasi Vektor Arah Bor (Direction Vector)
                    // Standar asumsi: Dip/Inc 90 atau -90 adalah menembus lurus ke bawah
                    let incRad = Math.abs(inclination) * (Math.PI / 180); 
                    let aziRad = azimuth * (Math.PI / 180);

                    // dx, dy, dz ini merepresentasikan kemiringan turun kedalaman per 1 unit jarak
                    let dx = Math.sin(aziRad) * Math.cos(incRad);
                    let dz = -Math.cos(aziRad) * Math.cos(incRad); // -z is North in ThreeJS
                    let dy = -Math.sin(incRad); // Minus karena masuk ke kedalaman (Y axis down)

                    if (!isNaN(rawX) && !isNaN(rawY) && !isNaN(rawZ) && holeId) {
                        if (rawX === 0 || rawZ === 0) continue;
                        
                        if (rawX < minX) minX = rawX; if (rawX > maxX) maxX = rawX;
                        if (rawY < minY) minY = rawY; if (rawY > maxY) maxY = rawY;
                        if (rawZ < minZ) minZ = rawZ; if (rawZ > maxZ) maxZ = rawZ;

                        collarMap.set(holeId, { 
                            x: rawX, y: rawY, z: rawZ, 
                            depth: isNaN(depth) ? 0 : depth,
                            dx: dx, dy: dy, dz: dz
                        });
                    }
                }
            }

            if (window.worldOrigin && !window.worldOrigin.isSet && minX !== Infinity) {
                window.worldOrigin = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2, isSet: true };
            }

            // 2. Ekstrak Lithology
            const lithoLines = fullFileContentLitho.split('\n');
            const delimLitho = delimiterSelectLitho.value;
            let activeDelimLitho = delimLitho;
            
            if (activeDelimLitho === 'column') {
                if (fileContentFirstLineLitho.includes(',')) activeDelimLitho = 'comma';
                else if (fileContentFirstLineLitho.includes('\t')) activeDelimLitho = 'tab';
                else activeDelimLitho = 'space';
            }
            const startIdxLitho = (delimLitho === 'column') ? 1 : 0;

            const hlVal = document.getElementById('pro-col-hole-id-litho').value;
            const tVal = document.getElementById('pro-col-top-depth').value;
            const bVal = document.getElementById('pro-col-base-depth').value;
            const sVal = document.getElementById('pro-col-seam').value;
            const thkVal = document.getElementById('pro-col-thickness').value;

            // Validasi apakah Thickness atau Seam diset ke "None"
            const disableLithoGraphic = (sVal === 'none' || thkVal === 'none');

            const idxHL = hlVal ? parseInt(hlVal.replace('COL_', '')) - 1 : -1;
            const idxT = tVal ? parseInt(tVal.replace('COL_', '')) - 1 : -1;
            const idxB = bVal ? parseInt(bVal.replace('COL_', '')) - 1 : -1;
            const idxS = sVal !== 'none' ? parseInt(sVal.replace('COL_', '')) - 1 : -1;

            const lithoMap = new Map();
            for (let i = startIdxLitho; i < lithoLines.length; i++) {
                let line = lithoLines[i].trim();
                if (!line) continue;
                
                let cols = getCols(line, activeDelimLitho);
                
                // Hanya fetch data Seam jika litho graphic TIDAK di-disable
                if (!disableLithoGraphic && cols.length > Math.max(idxHL, idxT, idxB, idxS)) {
                    let holeId = cols[idxHL];
                    let top = parseFloat(cols[idxT]);
                    let base = parseFloat(cols[idxB]);
                    let seam = cols[idxS];

                    if (holeId && !isNaN(top) && !isNaN(base) && seam) {
                        if (!lithoMap.has(holeId)) lithoMap.set(holeId, []);
                        lithoMap.get(holeId).push({ top, base, seam });
                    }
                }
            }

            // 3. Bangun Meshes untuk Dots, Lines Kedalaman, & Silinder Seam
            const seamPalette = new Map();
            let colorIndex = 0;
            const seamMaterialCache = new Map();
            
            // Geometri khusus ketebalan Seam (radius=1.2, height=1)
            // diturunkan ke bawah agar sumbu originnya ada di Top Depth
            const seamGeo = new THREE.CylinderGeometry(1.2, 1.2, 1, 8);
            seamGeo.translate(0, -0.5, 0); 
            
            const lineVertices = [];

            collarMap.forEach((data, holeId) => {
                let finalX = data.x - window.worldOrigin.x;
                let finalY = data.y - window.worldOrigin.y;
                let finalZ = data.z - window.worldOrigin.z;

                // A. Collar Point (Dot Atas)
                parsedPoints.push(new THREE.Vector3(finalX, finalY, finalZ));

                // B. Garis Kedalaman Total (Mengikuti Vector Azimuth & Inclination)
                if (data.depth > 0) {
                    lineVertices.push(finalX, finalY, finalZ);
                    lineVertices.push(
                        finalX + (data.dx * data.depth), 
                        finalY + (data.dy * data.depth), 
                        finalZ + (data.dz * data.depth)
                    );
                }

                // C. Seam Segments (Hanya dijalankan jika opsi None TIDAK dipilih)
                if (!disableLithoGraphic) {
                    const lithos = lithoMap.get(holeId);
                    if (lithos) {
                        lithos.forEach(litho => {
                            // Daftarkan Algoritma Warna Unik untuk Setiap Seam Baru
                            if (!seamPalette.has(litho.seam)) {
                                let hue = (colorIndex * 137.5) % 360; // Distribusi rasio emas warna HSL
                                let seamColor = new THREE.Color(`hsl(${hue}, 80%, 50%)`);
                                seamPalette.set(litho.seam, seamColor);
                                seamMaterialCache.set(litho.seam, new THREE.MeshBasicMaterial({ color: seamColor, depthTest: true }));
                                colorIndex++;
                            }
                            const mat = seamMaterialCache.get(litho.seam);

                            const seamMesh = new THREE.Mesh(seamGeo, mat);
                            
                            // Posisikan Start Top Depth mengikuti vektor kemiringan
                            let topX = finalX + (data.dx * litho.top);
                            let topY = finalY + (data.dy * litho.top);
                            let topZ = finalZ + (data.dz * litho.top);
                            seamMesh.position.set(topX, topY, topZ); 
                            
                            // Rotasikan mesh silinder searah dengan trajectory pengeboran
                            let upHoleDir = new THREE.Vector3(-data.dx, -data.dy, -data.dz).normalize();
                            let quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upHoleDir);
                            seamMesh.applyQuaternion(quaternion);

                            const thickness = Math.max(0.1, Math.abs(litho.base - litho.top)); 
                            seamMesh.scale.set(1, thickness, 1); 
                            seamMesh.renderOrder = 998;
                            layerGroup.add(seamMesh);
                        });
                    }
                }
            });

            // Merender semua Garis Kedalaman sekaligus dengan performa tinggi
            if (lineVertices.length > 0) {
                const lineGeo = new THREE.BufferGeometry();
                lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
                const lineMat = new THREE.LineBasicMaterial({ color: 0x64748b, depthTest: true, transparent: true, opacity: 0.8 }); // Slate-500 line
                const depthLines = new THREE.LineSegments(lineGeo, lineMat);
                depthLines.renderOrder = 997;
                layerGroup.add(depthLines);
            }
        }

        // ==========================================
        // PENYIMPANAN & MANAJEMEN LAYER TERPADU
        // ==========================================
        if (parsedPoints.length > 0 && typeof THREE !== 'undefined') {
            
            let layerName = "Imported Layer";
            let colorClass = "bg-slate-400/30 border-slate-400 text-white";
            let pointsColor = 0xffffff;
            
            if (dbType === 'fleet') {
                window.fleetCount++;
                layerName = `Fleet ${window.fleetCount}`;
                colorClass = "bg-white/20 border-white text-white"; 
                pointsColor = 0xffffff;
            } else if (dbType === 'drill_hole') {
                window.drillCount = (window.drillCount || 0) + 1;
                layerName = `Drill Hole ${window.drillCount}`;
                colorClass = "bg-cyan-400/20 border-cyan-400 text-white";
                pointsColor = 0x22d3ee;
            }
            
            // Render Points (Dot)
            const geometry = new THREE.BufferGeometry().setFromPoints(parsedPoints);
            const material = new THREE.PointsMaterial({ 
                color: pointsColor, size: 4, sizeAttenuation: false, depthTest: true 
            });
            const pointsMesh = new THREE.Points(geometry, material);
            pointsMesh.renderOrder = 999;
            layerGroup.add(pointsMesh);
            
            // Registrasikan Group Utama ke Scene
            if (typeof drawGroup === 'undefined' || !drawGroup) {
                if (typeof scene !== 'undefined') {
                    window.drawGroup = new THREE.Group();
                    scene.add(window.drawGroup);
                }
            }
            if (window.drawGroup) window.drawGroup.add(layerGroup);
            
            // Simpan Group sebagai Marker Utama (Berlaku bagi Fleet & Drill Hole)
            const layerId = 'pro_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const finishedData = {
                id: layerId, 
                type: 'draw_marker', 
                name: layerName, 
                colorClass: colorClass, 
                markerMesh: layerGroup, // Jika Layer di-Delete, keseluruhan Group (Dot, Line, Seam) akan terhapus
                points: parsedPoints
            };
            
            if (typeof finishedDrawings !== 'undefined') {
                finishedDrawings.push(finishedData);
                window.drawMarkers = window.drawMarkers || [];
                window.drawMarkers.push(finishedData);
                if (typeof window.updateLayersUI === 'function') window.updateLayersUI();
            }
            if (typeof window.forceSingleRender === 'function') window.forceSingleRender();
        }
        
        setTimeout(() => {
            if (!modalPro.classList.contains('hidden')) {
                modalPro.classList.add('hidden'); 
                modalPro.classList.remove('flex');
                resetGenerateButton();
                if (typeof controls !== 'undefined' && controls) controls.enabled = true;
                if (typeof window.resume3D === 'function') window.resume3D();
            }
        }, 2000);
    }

    function showGenerateRetry() {
        btnGenerate.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Retry`;
        btnGenerate.className = "w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 rounded text-[10px] shadow-lg transition-colors flex items-center justify-center gap-1.5";
        btnGenerate.disabled = false;
    }
});