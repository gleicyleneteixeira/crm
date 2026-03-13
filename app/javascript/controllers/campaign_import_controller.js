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
        "stageSelect"
    ]

    static values = {
        pipelines: Array,
        crmFields: Object
    }

    connect() {
        this.rawData = []
        this.ignoredRows = new Set()
        this.loadCurrentMapping()
        this.validateMapping()
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

    autoMatchHeaders() {
        if (!this.rawData || this.rawData.length === 0) return;
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
            this.autoMatchHeaders()
            this.renderizarGrid()

            event.target.value = ''
        }
        reader.readAsArrayBuffer(file)
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

    handleHeaderToggle() {
        this.renderizarGrid()
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
                    rowHtml += `<th class="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[210px] bg-slate-100 dark:bg-slate-800">Status</th>`
                    rowHtml += '</tr></thead>'
                    rowHtml += '<tbody>'
                } else {
                    rowHtml += `<tr class="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${trClass}">`
                    row.forEach((cell, colIndex) => {
                        rowHtml += `<td class="px-4 py-3 whitespace-nowrap editable-cell cursor-text transition-colors text-sm text-slate-900 dark:text-slate-200 border-r border-slate-200 dark:border-slate-700" data-row="${rowIndex}" data-col="${colIndex}" data-action="click->campaign-import#editCell">${this.escapeHtml(cell)}</td>`
                    })

                    if (isIgnored) {
                        rowHtml += `<td class="px-4 py-3 text-right text-slate-500 text-xs font-medium">
                        Ignorado
                        <button type="button" class="ml-2 text-brand-palette-03 hover:underline text-xs" data-action="click->campaign-import#restoreRow" data-row="${rowIndex}">Restaurar</button>
                    </td>`
                    } else if (isValid) {
                        rowHtml += `<td class="px-4 py-3 text-right">
                        <span class="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold text-xs tracking-tight bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full mr-2"><i data-lucide="check-circle" class="w-3 h-3"></i> Válido</span>
                        <div class="inline-flex gap-2">
                           <button type="button" class="text-slate-500 hover:text-red-500 hover:underline text-xs" data-action="click->campaign-import#deleteRow" data-row="${rowIndex}">Excluir</button>
                        </div>
                    </td>`
                    } else {
                        rowHtml += `<td class="px-4 py-3 text-right">
                        <span class="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold text-xs tracking-tight bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full block sm:inline-block mb-1 sm:mb-0 mr-2"><i data-lucide="alert-circle" class="w-3 h-3"></i> Erro</span>
                        <div class="inline-flex gap-2">
                           <button type="button" class="text-brand-palette-03 font-medium hover:underline text-xs" data-action="click->campaign-import#editRow" data-row="${rowIndex}">Editar</button>
                           <button type="button" class="text-slate-500 hover:underline text-xs" data-action="click->campaign-import#ignoreRow" data-row="${rowIndex}">Ignorar</button>
                           <button type="button" class="text-red-600 hover:underline text-xs font-medium" data-action="click->campaign-import#deleteRow" data-row="${rowIndex}">Excluir</button>
                        </div>
                    </td>`
                    }
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
            this.updateJsonOutput()
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

    updateJsonOutput() {
        if (this.hasJsonOutputTarget) {
            const finalData = this.rawData.filter((_, index) => !this.ignoredRows.has(index))
            this.jsonOutputTarget.value = JSON.stringify(finalData)
        }
    }

    generateHeaderMappingSelect(colIndex, headerName) {
        if (!this.hasCrmFieldsValue) return '';

        const colIndexStr = colIndex.toString();
        let mappedCrmKey = Object.keys(this.currentMapping).find(k => this.currentMapping[k] === colIndexStr);
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
                        optionLabel = `Variável: {{${headerSlug}}}`;
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

    handlePipelineChange() {
        if (!this.hasPipelineSelectTarget || !this.hasStageSelectTarget) return

        const pipelineIdStr = this.pipelineSelectTarget.value
        const pipelineId = pipelineIdStr ? parseInt(pipelineIdStr, 10) : null

        this.stageSelectTarget.innerHTML = '<option value="">Selecione a etapa inicial...</option>'

        if (pipelineId && this.hasPipelinesValue) {
            const pipeline = this.pipelinesValue.find(p => p.id === pipelineId)
            if (pipeline && pipeline.stages) {
                pipeline.stages.forEach(stage => {
                    const opt = document.createElement('option')
                    opt.value = stage.id
                    opt.textContent = stage.name
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
        if (hasData) {
            const hasName = this.currentMapping['contact.full_name'] !== undefined;
            const hasPhone = this.currentMapping['contact.phone'] !== undefined ||
                this.currentMapping['contact.phone_2'] !== undefined ||
                this.currentMapping['contact.phone_3'] !== undefined;

            if (!hasName || !hasPhone) {
                mappingsValid = false;
            }
        }

        let categoryParams = true;
        if (this.hasCategorySelectTarget && !this.categorySelectTarget.value) {
            categoryParams = false;
        }

        const isValid = hasData && mappingsValid && categoryParams

        if (this.hasSubmitButtonTarget) {
            this.submitButtonTarget.disabled = !isValid
            if (isValid) {
                this.submitButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
            } else {
                this.submitButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
            }
        }

        this.generateHiddenMappingInputs();
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
}
