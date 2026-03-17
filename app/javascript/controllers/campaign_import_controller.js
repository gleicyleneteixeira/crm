import { Controller } from "@hotwired/stimulus"
import * as XLSX from "xlsx"

export default class extends Controller {
    static targets = [
        "jsonOutput",
        "pasteArea",
        "submitButton",
        "gridContainer",
        "gridWrapper",
        "headerToggle",
        "emptyStateContainer",
        "countTotal",
        "countValid",
        "countInvalid",
        "categorySelect",
        "pipelineSelect",
        "stageSelect",
        "ddiToggle"
    ]

    static values = {
        pipelines: Array,
        crmFields: Object,
        initialMapping: Object,
        initialStageId: String
    }

    connect() {
        console.log("Campaign Import Controller Connected");
        this.rawData = []
        this.ignoredRows = new Set()
        
        const initial = (this.hasInitialMappingValue && this.initialMappingValue) ? this.initialMappingValue : {};
        this.currentMapping = typeof initial === 'object' ? { ...initial } : {};
        
        // Normalize mapping values to strings safely for consistent comparison
        Object.keys(this.currentMapping).forEach(key => {
            const val = this.currentMapping[key];
            if (val !== null && val !== undefined) {
                this.currentMapping[key] = val.toString();
            }
        });

        if (Object.keys(this.currentMapping).length === 0) {
            this.loadCurrentMapping();
        }

        // Initialize grid container scroll
        if (this.hasGridContainerTarget) {
            this.gridContainerTarget.addEventListener('scroll', this.handleScroll.bind(this));
        }
        
        this.rehydrateData();

        // Populate stages if pipeline is pre-selected
        if (this.hasPipelineSelectTarget && this.pipelineSelectTarget.value) {
            const initialStageId = this.hasInitialStageIdValue ? this.initialStageIdValue : "";
            this.handlePipelineChange(initialStageId);
        }

        this.validateMapping();

        // Initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    handleFormSubmit(event) {
        console.log("Submit triggered. Syncing JSON...");
        this.updateJsonOutput();
        this.generateHiddenMappingInputs();
        
        // Final sanity check before submission
        const exportData = this.rawData ? this.rawData.filter((_, index) => !this.ignoredRows.has(index)) : []
        if (exportData.length === 0) {
            console.error("Submission blocked: No data to submit.");
            // We don't preventDefault here to allow the browser validation to work if needed, 
            // but the button should already be disabled.
        }
    }

    loadCurrentMapping() {
        this.currentMapping = {};
        this.savedHeaderMappings = JSON.parse(localStorage.getItem('campaignInverseMappingsByName') || '{}');
    }

    saveCurrentMapping() {
        const headers = this.rawData && this.rawData.length > 0 ? this.rawData[0] : [];
        this.savedHeaderMappings = {};

        for (const [crmKey, colIndex] of Object.entries(this.currentMapping)) {
            if (headers[colIndex]) {
                this.savedHeaderMappings[crmKey] = headers[colIndex];
            }
        }
        localStorage.setItem('campaignInverseMappingsByName', JSON.stringify(this.savedHeaderMappings));

        this.validateMapping();
    }

    autoMatchHeaders(force = false) {
        if (!this.rawData || this.rawData.length === 0) return;
        
        // Se já temos mapeamento e não é forçado (ex: reidratação de rascunho), 
        // mantemos o que existe para não apagar o trabalho do usuário.
        if (Object.keys(this.currentMapping).length > 0 && !force) {
            console.log("Mapeamento existente preservado. Ignorando auto-match.");
            return;
        }

        const headers = this.rawData[0];

        this.currentMapping = {};

        headers.forEach((header, index) => {
            if (header === undefined || header === null) return;
            const colIndexStr = index.toString();

            let matchedCrmKey = null;

            for (const [crmKey, savedHeader] of Object.entries(this.savedHeaderMappings)) {
                if (savedHeader === header && !Object.values(this.currentMapping).includes(colIndexStr)) {
                    matchedCrmKey = crmKey;
                    break;
                }
            }

            if (!matchedCrmKey) {
                for (const groupName in this.crmFieldsValue) {
                    const attributesList = this.crmFieldsValue[groupName];
                    for (const [label, key] of attributesList) {
                        if (this.stringMatch(label, header) && !this.currentMapping[key] && !Object.values(this.currentMapping).includes(colIndexStr)) {
                            matchedCrmKey = key;
                            break;
                        }
                    }
                    if (matchedCrmKey) break;
                }
            }

            if (matchedCrmKey) {
                this.currentMapping[matchedCrmKey] = colIndexStr;
            }
        });

        this.saveCurrentMapping();
    }

    handleFile(event) {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result)
            const workbook = XLSX.read(data, { type: 'array', cellDates: true })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]

            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
            const processedJson = json.map(row =>
                row.map(cell => {
                    if (cell instanceof Date) {
                        return cell.toLocaleDateString("pt-BR", { timeZone: 'UTC' }) // "DD/MM/YYYY" format
                    }
                    return cell
                })
            )

            this.ignoredRows.clear()
            this.rawData = this.normalizeMatrix(processedJson)
            console.log('Dados carregados:', this.rawData);
            this.autoMatchHeaders(true) // Forçamos o match em upload de novo arquivo
            this.renderizarGrid()

            event.target.value = ''
        }
        reader.readAsArrayBuffer(file)
    }

    rehydrateData() {
        if (!this.hasJsonOutputTarget || !this.jsonOutputTarget.value) {
            console.log("No data for rehydration.");
            return;
        }

        console.log("Attempting to rehydrate data...");
        try {
            let data = this.jsonOutputTarget.value;
            // Handle potentially double-serialized JSON
            if (typeof data === 'string' && data.startsWith('"')) {
                data = JSON.parse(data);
            }
            const finalData = typeof data === 'string' ? JSON.parse(data) : data;

            if (Array.isArray(finalData) && finalData.length > 0) {
                this.ignoredRows.clear();
                this.rawData = this.normalizeMatrix(finalData);
                console.log(`Rehydrated: ${this.rawData.length} rows.`);
                this.autoMatchHeaders(false); 
                this.renderizarGrid();
                this.validateMapping();
            } else {
                console.log("Rehydrated data is empty or invalid format.");
                this.rawData = [];
                this.ignoredRows.clear();
                this.validateMapping();
            }
        } catch (e) {
            console.error('Failed to rehydrate data:', e);
        }
    }

    updateJsonOutput() {
        if (!this.hasJsonOutputTarget) return;

        // Se rawData estiver vazio, mas tínhamos dados antes, pode ser um erro de inicialização.
        // Bloqueamos a limpeza total se houver suspeita de falha.
        if (this.rawData.length === 0 && this.jsonOutputTarget.value && this.jsonOutputTarget.value !== '[]') {
            console.warn("Safety trigger: Sync abortado para evitar perda de dados.");
            return;
        }

        // Filtramos as linhas ignoradas para o envio final
        const finalData = this.rawData.filter((_, index) => !this.ignoredRows.has(index)).map(row => {
            return row.map((cell, colIndex) => {
                const colIndexStr = colIndex.toString();
                const mappedCrmKey = Object.keys(this.currentMapping).find(k => this.currentMapping[k]?.toString() === colIndexStr);
                
                // Limpeza básica de telefone se for uma coluna de telefone mapeada
                if (mappedCrmKey && mappedCrmKey.includes('contact.phone')) {
                    return this.formatPhone(cell);
                }
                return cell;
            });
        });

        const newVal = JSON.stringify(finalData);
        if (this.jsonOutputTarget.value !== newVal) {
            this.jsonOutputTarget.value = newVal;
            console.log(`JSON synced: ${finalData.length} rows.`);
            this.generateHiddenMappingInputs();
        }
    }

    exportInvalidRows() {
        console.log("Exportando linhas inválidas...");
        if (!this.rawData || this.rawData.length === 0) {
            console.log("Nenhum dado para exportar.");
            return;
        }

        const isHeader = this.hasHeaderToggleTarget ? this.headerToggleTarget.checked : true;
        const phoneIndex = isHeader ? this.rawData[0].findIndex(col =>
            col && col.toString().toLowerCase().match(/telefone|whatsapp|celular|phone|fone/i)
        ) : -1;

        const invalidRows = this.rawData.filter((row, rowIndex) => {
            if (isHeader && rowIndex === 0) return false;
            const isValid = this.validarLinha(row, phoneIndex);
            console.log(`Linha ${rowIndex}: ${isValid ? 'válida' : 'inválida'}`);
            return !isValid;
        });

        if (invalidRows.length === 0) {
            alert('Nenhuma linha inválida encontrada.');
            console.log("Nenhuma linha inválida encontrada.");
            return;
        }

        const exportData = isHeader ? [this.rawData[0], ...invalidRows] : invalidRows;
        console.log(`Exportando ${invalidRows.length} linhas inválidas.`);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Invalid Rows");
        XLSX.writeFile(wb, "linhas_invalidas.csv");
        console.log("Arquivo 'linhas_invalidas.csv' gerado.");
    }

    handlePaste() {
        if (!this.hasPasteAreaTarget) return
        const raw = this.pasteAreaTarget.value
        this.processRawData(raw)
    }

    handleGridPaste(event) {
        const clipboardData = event.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');
        if (pastedData) {
            event.preventDefault()
            this.processRawData(pastedData)
        }
    }

    processRawData(raw) {
        if (!raw || !raw.trim()) return

        const rows = raw.trim().split(/\r?\n/)
        if (rows.length === 0) return

        const firstRow = rows[0]
        const separator = firstRow.includes('\t') ? '\t' : (firstRow.includes(';') ? ';' : ',')

        const data = rows.map(row => {
            return row.split(separator).map(cell => cell.trim().replace(/^"|"$/g, ''))
        })

        this.ignoredRows.clear()
        this.rawData = this.normalizeMatrix(data)
        console.log('Dados processados colados:', this.rawData);
        this.autoMatchHeaders()
        this.renderizarGrid()
    }

    normalizeMatrix(matrix) {
        if (!matrix || matrix.length === 0) return []
        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });
        return matrix.map(row => {
            const newRow = [...row];
            while (newRow.length < maxCols) {
                newRow.push("");
            }
            return newRow;
        }).filter(row => row.some(cell => cell !== "" && cell !== undefined && cell !== null));
    }

    clearData(event) {
        if (event) event.preventDefault()
        this.rawData = []
        this.ignoredRows.clear()

        if (this.hasPasteAreaTarget) this.pasteAreaTarget.value = ""
        if (this.hasJsonOutputTarget) this.jsonOutputTarget.value = ""
        if (this.hasGridContainerTarget) this.gridContainerTarget.innerHTML = ""

        if (this.hasGridWrapperTarget) this.gridWrapperTarget.classList.add('hidden')
        if (this.hasPasteAreaTarget) this.pasteAreaTarget.classList.remove('hidden')
        if (this.hasEmptyStateContainerTarget) this.emptyStateContainerTarget.classList.remove('hidden')

        this.updateCounters(0, 0, 0)
        this.validateMapping()
    }

    handleDdiToggle() {
        this.renderizarGrid();
        this.updateJsonOutput();
    }

    handleHeaderToggle() {
        this.renderizarGrid();
        this.updateJsonOutput();
    }

    formatPhone(val) {
        if (!val) return ""
        
        // Strictly remove all non-numeric characters first
        let digits = val.toString().replace(/\D/g, "")

        // Remove leading 0 if present (common in Br Brazilian formats)
        // Some users might paste 065... instead of 65...
        if (digits.length > 10 && digits.startsWith("0")) {
            digits = digits.substring(1)
        }

        // Add DDI 55 if toggle is on and it doesn't already have it
        if (this.hasDdiToggleTarget && this.ddiToggleTarget.checked) {
            // If it doesn't start with 55 and seems to be a local number (10 or 11 digits)
            if (digits.length > 0 && !digits.startsWith("55")) {
                digits = "55" + digits
            }
        }
        return digits
    }

    renderizarGrid() {
        if (!this.rawData || this.rawData.length === 0) {
            this.clearData()
            return
        }

        console.log('Iniciando renderizarGrid com rawData length:', this.rawData.length);

        try {
            const isHeader = this.hasHeaderToggleTarget ? this.headerToggleTarget.checked : true

            let html = '<table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">'

            let phoneIndex = -1;
            if (isHeader && this.rawData.length > 0) {
                phoneIndex = this.rawData[0].findIndex(col =>
                    col && col.toString().toLowerCase().match(/telefone|whatsapp|celular|phone|fone/i)
                );
            }

            let totalRecords = 0;
            let validRecords = 0;
            let invalidRecords = 0;

            this.rawData.forEach((row, rowIndex) => {
                let rowHtml = ""
                let isValid = true;

                const isIgnored = this.ignoredRows.has(rowIndex);
                const isHeaderRow = isHeader && rowIndex === 0;

                if (phoneIndex !== -1 && !isHeaderRow) {
                    isValid = this.validarLinha(row, phoneIndex)
                } else if (phoneIndex === -1 && !isHeaderRow) {
                    isValid = this.validarLinha(row, -1)
                }

                if (!isHeaderRow && !isIgnored) {
                    totalRecords++;
                    if (isValid) validRecords++;
                    else invalidRecords++;
                }

                let trClass = "";
                if (isIgnored) {
                    trClass = "opacity-40 bg-slate-100 dark:bg-slate-800 line-through";
                } else if (!isValid && !isHeaderRow) {
                    trClass = "bg-red-50 dark:bg-red-900/10 linha-erro";
                }

                if (isHeaderRow) {
                    rowHtml += '<thead class="bg-slate-100 dark:bg-slate-800">'
                    rowHtml += `<tr class="${trClass}">`
                    row.forEach((cell, colIndex) => {
                        const colIndexStr = colIndex.toString();
                        const mappedCrmKey = Object.keys(this.currentMapping).find(k => this.currentMapping[k] === colIndexStr);

                        let bgWarningClass = "bg-white dark:bg-slate-900";
                        let borderColor = "border-t-transparent";
                        let iconHtml = "";

                        if (mappedCrmKey) {
                            if (mappedCrmKey.startsWith('extra_')) {
                                bgWarningClass = "bg-purple-50 dark:bg-purple-900/10 shadow-inner";
                                borderColor = "!border-t-purple-500";
                                iconHtml = `<i data-lucide="sparkles" class="w-3 h-3 text-purple-500 inline-block mr-1"></i>`;
                            } else {
                                bgWarningClass = "bg-blue-50 dark:bg-blue-900/10 shadow-inner";
                                borderColor = "!border-t-blue-500";
                                iconHtml = `<i data-lucide="database" class="w-3 h-3 text-blue-500 inline-block mr-1"></i>`;
                            }
                        }

                        rowHtml += `<th class="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-left align-top transition-colors border-t-2 ${borderColor} ${bgWarningClass}">`
                        rowHtml += this.generateHeaderMappingSelect(colIndex, cell);
                        rowHtml += `<div class="flex items-center text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate" title="${this.escapeHtml(cell)}">${iconHtml}<span>${this.escapeHtml(cell)}</span></div>`
                        rowHtml += `</th>`
                    })
                    rowHtml += `<th class="px-4 py-3 text-right bg-slate-100 dark:bg-slate-800 sticky right-0 z-10 w-10">
                        <div class="relative group inline-block text-left">
                            <button type="button" class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                <i data-lucide="more-vertical" class="w-4 h-4 text-slate-600 dark:text-slate-400"></i>
                            </button>
                            <div class="hidden absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-20 overflow-hidden">
                                <div class="py-1">
                                    <button type="button" data-action="click->campaign-import#removeInvalidRows" class="flex items-center w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                                        <i data-lucide="filter-x" class="w-3 h-3 mr-2"></i> Remover Inválidas
                                    </button>
                                    <button type="button" data-action="click->campaign-import#removeDuplicates" class="flex items-center w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                                        <i data-lucide="copy-minus" class="w-3 h-3 mr-2"></i> Remover Duplicados
                                    </button>
                                    <div class="border-t border-slate-200 dark:border-slate-700"></div>
                                    <button type="button" data-action="click->campaign-import#exportInvalidRows" class="flex items-center w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                                        <i data-lucide="download" class="w-3 h-3 mr-2"></i> Exportar Inválidas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </th>`
                    rowHtml += '</tr></thead>'
                    rowHtml += '<tbody>'
                } else {
                    rowHtml += `<tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${trClass}">`
                    row.forEach((cell, colIndex) => {
                        const colIndexStr = colIndex.toString();
                        const mappedCrmKey = Object.keys(this.currentMapping).find(k => this.currentMapping[k] === colIndexStr);
                        let displayValue = cell;

                        const isPhoneCol = (mappedCrmKey && mappedCrmKey.includes('contact.phone')) ||
                            (phoneIndex === colIndex);

                        if (isPhoneCol) {
                            displayValue = this.formatPhone(cell);
                        }

                        rowHtml += `<td class="px-4 py-3 whitespace-nowrap editable-cell cursor-text transition-colors text-sm text-slate-900 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700" data-row="${rowIndex}" data-col="${colIndex}" data-action="click->campaign-import#editCell">${this.escapeHtml(displayValue)}</td>`
                    })

                    rowHtml += `<td class="px-4 py-3 text-right sticky right-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50">
                        <div class="relative inline-block text-left">
                            <button type="button" class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                <i data-lucide="more-horizontal" class="w-4 h-4 text-slate-500"></i>
                            </button>
                            <div class="hidden absolute right-0 mt-1 w-32 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-20 overflow-hidden">
                                <div class="py-1">
                                    ${isIgnored ?
                            `<button type="button" data-action="click->campaign-import#restoreRow" data-row="${rowIndex}" class="flex items-center w-full px-4 py-2 text-xs text-brand-palette-03 hover:bg-slate-100 dark:hover:bg-slate-700">Restaurar</button>` :
                            `<button type="button" data-action="click->campaign-import#editRow" data-row="${rowIndex}" class="flex items-center w-full px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Editar</button>
                                         <button type="button" data-action="click->campaign-import#ignoreRow" data-row="${rowIndex}" class="flex items-center w-full px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Ignorar</button>`
                        }
                                    <button type="button" data-action="click->campaign-import#deleteRow" data-row="${rowIndex}" class="flex items-center w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Excluir</button>
                                </div>
                            </div>
                        </div>
                        ${!isHeaderRow && !isIgnored && !isValid ? `<i data-lucide="alert-circle" class="w-3 h-3 text-red-500 ml-1 inline-block" title="Dados inválidos"></i>` : ''}
                    </td>`
                    rowHtml += '</tr>'
                }
                html += rowHtml
            })

            if (isHeader || this.rawData.length > 0) {
                html += '</tbody>'
            }
            html += '</table>'

            if (this.hasGridContainerTarget) this.gridContainerTarget.innerHTML = html
            if (this.hasGridWrapperTarget) this.gridWrapperTarget.classList.remove('hidden')
            if (this.hasPasteAreaTarget) this.pasteAreaTarget.classList.add('hidden')
            if (this.hasEmptyStateContainerTarget) this.emptyStateContainerTarget.classList.add('hidden')

            // Retrigger lucide icons for new elements
            if (window.lucide) window.lucide.createIcons();

            this.updateCounters(totalRecords, validRecords, invalidRecords)
            this.validateMapping()
        } catch (error) {
            console.error('Erro ao renderizar a grid (DOM Builder):', error);
        }
    }

    updateCounters(total, valid, invalid) {
        if (this.hasCountTotalTarget) this.countTotalTarget.textContent = total
        if (this.hasCountValidTarget) this.countValidTarget.textContent = valid
        if (this.hasCountInvalidTarget) this.countInvalidTarget.textContent = invalid
    }

    validarLinha(row, phoneIndex) {
        if (phoneIndex !== -1) {
            const val = row[phoneIndex]
            if (!val) return false
            const digits = val.toString().replace(/\D/g, '')
            return digits.length >= 10 && digits.length <= 11
        }

        let hasValidPhone = false;
        let hasInvalidPhoneTry = false;

        row.forEach(cell => {
            const digits = cell ? cell.toString().replace(/\D/g, '') : '';
            if (digits.length >= 10 && digits.length <= 11) {
                hasValidPhone = true;
            } else if (digits.length >= 8 && digits.length <= 15) {
                hasInvalidPhoneTry = true;
            }
        });

        if (hasInvalidPhoneTry && !hasValidPhone) return false;
        return true;
    }

    editCell(event) {
        const td = event.currentTarget
        if (td.querySelector('input')) return

        const rowIdx = parseInt(td.dataset.row, 10)
        if (this.ignoredRows.has(rowIdx)) return

        const row = td.dataset.row
        const col = td.dataset.col
        const value = this.rawData[row][col]

        const input = document.createElement('input')
        input.type = 'text'
        input.value = value !== undefined && value !== null ? value : ''
        input.className = 'w-full px-2 py-1 text-sm border rounded focus:ring-brand-palette-03 focus:border-brand-palette-03 dark:bg-slate-800 dark:border-slate-600 dark:text-white text-slate-900 min-w-[100px]'

        input.addEventListener('click', e => e.stopPropagation())

        td.innerHTML = ''
        td.appendChild(input)
        input.focus()

        const saveValue = () => {
            if (this.rawData[row]) {
                this.rawData[row][col] = input.value
            }
            this.renderizarGrid()
        }

        let isSaved = false;
        input.addEventListener('blur', () => {
            if (!isSaved) { isSaved = true; saveValue(); }
        })
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                input.blur()
            } else if (e.key === 'Escape') {
                e.preventDefault()
                if (!isSaved) { isSaved = true; this.renderizarGrid(); }
            }
        })
    }

    editRow(event) {
        const tr = event.currentTarget.closest('tr')
        if (tr) {
            const tds = tr.querySelectorAll('.editable-cell')
            tds.forEach(td => {
                if (!td.querySelector('input')) {
                    this.editCell({ currentTarget: td })
                }
            })
            const firstInput = tr.querySelector('input')
            if (firstInput) firstInput.focus()
        }
    }

    deleteRow(event) {
        const rowIdxStr = event.currentTarget.dataset.row
        if (!rowIdxStr) return

        const rowIdx = parseInt(rowIdxStr, 10)

        this.rawData.splice(rowIdx, 1)

        const updatedIgnored = new Set()
        for (const idx of this.ignoredRows) {
            if (idx === rowIdx) continue;
            if (idx > rowIdx) updatedIgnored.add(idx - 1);
            else updatedIgnored.add(idx);
        }
        this.ignoredRows = updatedIgnored;

        this.renderizarGrid()
    }

    ignoreRow(event) {
        const rowIdx = parseInt(event.currentTarget.dataset.row, 10)
        this.ignoredRows.add(rowIdx)
        this.renderizarGrid()
    }

    restoreRow(event) {
        const rowIdx = parseInt(event.currentTarget.dataset.row, 10)
        this.ignoredRows.delete(rowIdx)
        this.renderizarGrid()
    }

    escapeHtml(unsafe) {
        if (unsafe === undefined || unsafe === null) return ''
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Metodo duplicado removido para evitar conflitos

    generateHeaderMappingSelect(colIndex, headerName) {
        if (!this.hasCrmFieldsValue) return '';

        const colIndexStr = colIndex.toString();
        let mappedCrmKey = Object.keys(this.currentMapping).find(k => this.currentMapping[k]?.toString() === colIndexStr);
        let headerSlug = headerName ? headerName.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_") : `col_${colIndex}`;

        let selectHtml = `<select class="w-full text-xs py-1 px-1 rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 focus:border-brand-palette-03 focus:ring-brand-palette-03 mb-2 font-normal" data-action="change->campaign-import#handleHeaderMappingChange" data-col="${colIndex}">`;
        selectHtml += `<option value="">Não Carregar</option>`;

        for (const [groupName, attributesList] of Object.entries(this.crmFieldsValue)) {
            selectHtml += `<optgroup label="${this.escapeHtml(groupName)}">`;
            for (const [label, key] of attributesList) {
                let optionVal = key;
                let optionLabel = label;
                if (key === 'extra_variable') {
                    optionVal = `extra_${headerSlug}`;
                    if (headerName) {
                        optionLabel = headerName;
                    }
                }
                const isSelected = (mappedCrmKey === optionVal) ? 'selected' : '';
                const isRequired = (key === 'contact.full_name' || key.includes('contact.phone')) ? ' *' : '';
                selectHtml += `<option value="${optionVal}" ${isSelected}>${this.escapeHtml(optionLabel)}${isRequired}</option>`;
            }
            selectHtml += `</optgroup>`;
        }
        selectHtml += `</select>`;
        return selectHtml;
    }

    handleHeaderMappingChange(event) {
        const select = event.target;
        const colIndexStr = select.dataset.col.toString();
        const selectedCrmKey = select.value;

        for (const key in this.currentMapping) {
            if (this.currentMapping[key] === colIndexStr) {
                delete this.currentMapping[key];
            }
        }

        if (selectedCrmKey) {
            this.currentMapping[selectedCrmKey] = colIndexStr;
        }

        this.saveCurrentMapping();
        this.renderizarGrid();
        this.updateJsonOutput();
    }

    stringMatch(crm, col) {
        if (!crm || !col) return false
        const normalizedCrm = crm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")
        const normalizedCol = col.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "")
        return normalizedCrm.includes(normalizedCol) || normalizedCol.includes(normalizedCrm)
    }

    toggleNameMapping(event) {
        const checkbox = event.currentTarget;
        const container = checkbox.closest('div').querySelector('[data-name-mapping-select-container]');
        if (container) {
            if (checkbox.checked) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
                const select = container.querySelector('select');
                if (select) select.value = '';
            }
        }
    }

    handleCategoryChange() {
        this.validateMapping()
    }

    handlePipelineChange(initialStageId = "") {
        if (!this.hasPipelineSelectTarget || !this.hasStageSelectTarget) return

        const pipelineIdStr = this.pipelineSelectTarget.value
        const pipelineId = pipelineIdStr ? parseInt(pipelineIdStr, 10) : null
        
        // Use provided initialStageId, or current target value, or empty
        const currentSelectedStage = initialStageId || this.stageSelectTarget.value

        this.stageSelectTarget.innerHTML = '<option value="">Selecione a etapa inicial...</option>'

        if (pipelineId && this.hasPipelinesValue) {
            const pipeline = this.pipelinesValue.find(p => p.id === pipelineId)
            if (pipeline && pipeline.stages) {
                pipeline.stages.forEach(stage => {
                    const opt = document.createElement('option')
                    opt.value = stage.id
                    opt.textContent = stage.name
                    if (stage.id.toString() === currentSelectedStage.toString()) {
                        opt.selected = true
                    }
                    this.stageSelectTarget.appendChild(opt)
                })
            }
        }

        this.validateMapping()
    }

    validateMapping(event = null) {
        const exportData = this.rawData ? this.rawData.filter((_, index) => !this.ignoredRows.has(index)) : []
        const hasData = exportData && exportData.length > 0;

        let mappingsValid = true
        let mappingError = ""
        
        if (hasData) {
            const hasFullName = (this.currentMapping['contact.full_name'] !== undefined && this.currentMapping['contact.full_name'] !== "");
            const hasCampaignNameTarget = (this.currentMapping['__campaign_name_target__'] !== undefined && this.currentMapping['__campaign_name_target__'] !== "");
            
            const hasPhone1 = (this.currentMapping['contact.phone'] !== undefined && this.currentMapping['contact.phone'] !== "");
            const hasPhone2 = (this.currentMapping['contact.phone_2'] !== undefined && this.currentMapping['contact.phone_2'] !== "");
            const hasPhone3 = (this.currentMapping['contact.phone_3'] !== undefined && this.currentMapping['contact.phone_3'] !== "");

            const hasName = hasFullName || hasCampaignNameTarget;
            const hasPhone = hasPhone1 || hasPhone2 || hasPhone3;

            console.log("Mapping Detail:", { 
                hasFullName, hasCampaignNameTarget, hasName,
                hasPhone1, hasPhone2, hasPhone3, hasPhone,
                currentMapping: this.currentMapping 
            });

            if (!hasName) mappingError = "Mapeamento de Nome faltando.";
            if (!hasPhone) mappingError += " Mapeamento de Telefone faltando.";
            
            if (!hasName || !hasPhone) {
                mappingsValid = false;
            }
        } else {
            mappingError = "Sem dados na planilha.";
        }

        const categoryVal = this.hasCategorySelectTarget ? this.categorySelectTarget.value : null;
        const pipelineVal = this.hasPipelineSelectTarget ? this.pipelineSelectTarget.value : null;
        const stageVal = this.hasStageSelectTarget ? this.stageSelectTarget.value : null;

        const isValid = hasData && mappingsValid && categoryVal && pipelineVal && stageVal

        console.log("Validation Check:", { 
            isValid,
            hasData, 
            mappingsValid, 
            mappingError,
            category: !!categoryVal, 
            pipeline: !!pipelineVal, 
            stage: !!stageVal
        });

        if (this.hasSubmitButtonTarget) {
            this.submitButtonTarget.disabled = !isValid
            if (isValid) {
                this.submitButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
                this.submitButtonTarget.title = "Avançar para a próxima etapa"
            } else {
                this.submitButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
                this.submitButtonTarget.title = `Bloqueado: ${mappingError || "Preencha todos os campos obrigatórios"}`
            }
        }

        this.generateHiddenMappingInputs();
        this.updateJsonOutput(); 
    }

    removeDuplicates() {
        if (!this.rawData || this.rawData.length <= 1) return

        const isHeader = this.hasHeaderToggleTarget ? this.headerToggleTarget.checked : true
        const startIndex = isHeader ? 1 : 0
        const seen = new Set()
        const newRawData = isHeader ? [this.rawData[0]] : []

        for (let i = startIndex; i < this.rawData.length; i++) {
            const rowStr = JSON.stringify(this.rawData[i])
            if (!seen.has(rowStr)) {
                seen.add(rowStr)
                newRawData.push(this.rawData[i])
            }
        }

        this.rawData = newRawData
        this.ignoredRows.clear()
        this.renderizarGrid()
    }

    removeInvalidRows() {
        if (!this.rawData || this.rawData.length === 0) return

        const isHeader = this.hasHeaderToggleTarget ? this.headerToggleTarget.checked : true
        const phoneIndex = isHeader ? this.rawData[0].findIndex(col =>
            col && col.toString().toLowerCase().match(/telefone|whatsapp|celular|phone|fone/i)
        ) : -1

        const newRawData = this.rawData.filter((row, rowIndex) => {
            if (isHeader && rowIndex === 0) return true
            return this.validarLinha(row, phoneIndex)
        })

        this.rawData = newRawData
        this.ignoredRows.clear()
        this.renderizarGrid()
    }

    exportInvalidRows() {
        if (!this.rawData || this.rawData.length === 0) return

        const isHeader = this.hasHeaderToggleTarget ? this.headerToggleTarget.checked : true
        const phoneIndex = isHeader ? this.rawData[0].findIndex(col =>
            col && col.toString().toLowerCase().match(/telefone|whatsapp|celular|phone|fone/i)
        ) : -1

        const invalidRows = this.rawData.filter((row, rowIndex) => {
            if (isHeader && rowIndex === 0) return false
            return !this.validarLinha(row, phoneIndex)
        })

        if (invalidRows.length === 0) {
            alert('Nenhuma linha inválida encontrada.')
            return
        }

        const exportData = isHeader ? [this.rawData[0], ...invalidRows] : invalidRows
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.aoa_to_sheet(exportData)
        XLSX.utils.book_append_sheet(wb, ws, "Invalid Rows")
        XLSX.writeFile(wb, "linhas_invalidas.csv")
    }

    generateHiddenMappingInputs() {
        let container = this.element.querySelector('#hidden-mappings-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hidden-mappings-container';
            this.element.appendChild(container);
        }
        container.innerHTML = '';

        for (const [crmKey, colIndex] of Object.entries(this.currentMapping)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `campaign[mapping][${crmKey}]`;
            input.value = colIndex;
            container.appendChild(input);
        }
    }
    
    normalizeMatrix(matrix) {
        if (!matrix || matrix.length === 0) return []
        
        // Remove completamente linhas vazias
        const cleanMatrix = matrix.filter(row => {
            if (!Array.isArray(row)) return false;
            return row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '');
        });

        if (cleanMatrix.length === 0) return []

        // Calcula o número máximo de colunas
        const maxCols = Math.max(...cleanMatrix.map(row => row.length))

        // Normaliza o tamanho de todas as linhas
        return cleanMatrix.map(row => {
            const newRow = [...row]
            while (newRow.length < maxCols) newRow.push('')
            return newRow.map(cell => (cell === null || cell === undefined) ? '' : cell.toString().trim())
        })
    }
}
