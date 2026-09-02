import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"

export default class extends Controller {
    static targets = ["previewText", "blocksContainer", "messagesList", "blockTemplate", "aiButton", "audioButton", "aiVariationsContainer", "aiVariationsList", "audioPreviewContainer", "audioPlayer", "addButton", "emojiPicker", "fileInput", "editor", "count", "simulatorHistory", "simulatorBody", "status"]
    static values = {
        headers: Array,
        sampleRow: Array,
        initialSequence: Array
    }

    connect() {
        console.log("Campaign Composition Controller connected")
        
        // Robust Initialization: Always ensure messageSequence is an array
        const initial = this.initialSequenceValue
        this.messageSequence = Array.isArray(initial) ? [...initial] : []
        
        console.log("Initial message sequence:", this.messageSequence)
        this.currentMessageType = 'text'
        
        this.updateUI()
        
        if (window.lucide) window.lucide.createIcons()

        // Debug global
        window.campaignCtrl = this

        this.initSortable()
    }

    initSortable() {
        if (!this.hasMessagesListTarget) return
        
        this.sortable = Sortable.create(this.messagesListTarget, {
            animation: 150,
            handle: ".drag-handle",
            draggable: ".message-item",
            ghostClass: "sortable-ghost",
            chosenClass: "sortable-chosen",
            dragClass: "sortable-drag",
            onEnd: (evt) => {
                const oldIndex = evt.oldIndex
                const newIndex = evt.newIndex
                
                if (oldIndex === newIndex) return
                
                // Reorder the messageSequence array
                const movedItem = this.messageSequence.splice(oldIndex, 1)[0]
                this.messageSequence.splice(newIndex, 0, movedItem)
                
                // Update UI (Refresh indices, simulator, and trigger autosave)
                this.updateUI()
            }
        })
    }

    updateAddButtonState() {
        if (!this.hasEditorTarget || !this.hasAddButtonTarget) return
        
        const hasContent = this.editorTarget.value.trim().length > 0
        if (hasContent) {
            this.addButtonTarget.classList.add('bg-emerald-500', 'text-[#0D1117]', 'border-emerald-600')
            this.addButtonTarget.classList.remove('bg-slate-900', 'text-slate-400', 'border-slate-800/60')
        } else {
            this.addButtonTarget.classList.remove('bg-emerald-500', 'text-[#0D1117]', 'border-emerald-600')
            this.addButtonTarget.classList.add('bg-slate-900', 'text-slate-400', 'border-slate-800/60')
        }
        
        // Live typing preview
        if (this.hasPreviewTextTarget) {
            const rawText = this.editorTarget.value.trim()
            if (rawText.length > 0) {
                this.previewTextTarget.innerText = this.processVariables(rawText)
                this.previewTextTarget.closest('div').classList.remove('opacity-40')
            } else {
                this.previewTextTarget.innerText = 'Sua prévia aparecerá aqui conforme você digita...'
                this.previewTextTarget.closest('div').classList.add('opacity-40')
            }
            this.scrollToBottom()
        }
    }

    insertVariable(e) {
        if (!this.hasEditorTarget) return
        const variable = `{{${e.currentTarget.dataset.variable}}}`
        
        const start = this.editorTarget.selectionStart
        const end = this.editorTarget.selectionEnd
        const text = this.editorTarget.value
        this.editorTarget.value = text.substring(0, start) + variable + text.substring(end)
        
        this.editorTarget.focus()
        this.editorTarget.selectionStart = this.editorTarget.selectionEnd = start + variable.length
        this.editorTarget.dispatchEvent(new Event('input'))
    }

    insertEmoji(e) {
        if (!this.hasEditorTarget) return
        const emoji = e.currentTarget.innerText
        
        const start = this.editorTarget.selectionStart
        const end = this.editorTarget.selectionEnd
        const text = this.editorTarget.value
        this.editorTarget.value = text.substring(0, start) + emoji + text.substring(end)
        
        this.editorTarget.focus()
        this.editorTarget.selectionStart = this.editorTarget.selectionEnd = start + emoji.length
        this.editorTarget.dispatchEvent(new Event('input'))
        if (this.hasEmojiPickerTarget) this.emojiPickerTarget.classList.add('hidden')
    }

    processVariables(text) {
        let processedText = text
        if (!this.headersValue || !this.sampleRowValue) return processedText

        const nameIndex = this.headersValue.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase() === 'name')

        // Process first_name dynamic tag
        if (processedText.toLowerCase().includes('{{first_name}}')) {
            let firstName = "Edenir" // Rule: Use 'Edenir' as requested
            if (nameIndex !== -1 && this.sampleRowValue && this.sampleRowValue[nameIndex]) {
                const full_name = this.sampleRowValue[nameIndex].toString()
                const rawFirst = full_name.split(' ')[0]
                firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()
            }
            const regex = new RegExp('{{first_name}}', 'gi')
            processedText = processedText.replace(regex, firstName)
        }

        // Process other spreadsheet variables
        this.headersValue.forEach((header, index) => {
            const var_name = header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_")
            const variable = `{{${var_name}}}`
            const value = this.sampleRowValue[index] || `[${header}]`
            const regex = new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            processedText = processedText.replace(regex, value)
        })
        return processedText
    }

    toggleAI(e) {
        const active = e.target.checked
        this.aiButtonTarget.classList.toggle('hidden', !active)
        if (!active) this.aiVariationsContainerTarget.classList.add('hidden')
    }

    toggleAudio(e) {
        const active = e.target.checked
        this.audioButtonTarget.classList.toggle('hidden', !active)
        if (!active) this.audioPreviewContainerTarget.classList.add('hidden')
    }

    async generateAIVariations() {
        const message = this.editorTarget.value
        if (!message) return

        this.aiButtonTarget.innerHTML = '<i class="w-3 h-3 animate-spin"></i> Gerando...'
        this.aiButtonTarget.disabled = true

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            const response = await fetch(`/accounts/${this.getAccountId()}/campaigns/${this.getId()}/generate_variations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ message })
            })

            const data = await response.json()
            if (data.variations) {
                this.renderVariations(data.variations)
            } else {
                alert(data.error || 'Erro ao gerar variações')
            }
        } catch (e) {
            alert('Falha na conexão com Groq')
        } finally {
            this.aiButtonTarget.innerHTML = '<i class="w-3 h-3" data-lucide="sparkles"></i> Variações Anti-Ban'
            this.aiButtonTarget.disabled = false
            if (window.lucide) window.lucide.createIcons()
        }
    }

    renderVariations(variations) {
        this.aiVariationsContainerTarget.classList.remove('hidden')
        this.aiVariationsListTarget.innerHTML = ''

        variations.forEach(v => {
            const card = document.createElement('div')
            card.className = "bg-[#0D1117] border border-slate-800 p-3 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-all text-xs text-slate-300 mb-2"
            card.innerText = v
            card.onclick = () => {
                this.editorTarget.value = v
                this.editorTarget.dispatchEvent(new Event('input'))
            }
            this.aiVariationsListTarget.appendChild(card)
        })
    }

    async generateAudioPreview() {
        const text = this.editorTarget.value
        if (!text) return

        this.audioButtonTarget.innerHTML = '<i class="w-3 h-3 animate-spin"></i> Gravando...'
        this.audioButtonTarget.disabled = true

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
            const response = await fetch(`/accounts/${this.getAccountId()}/campaigns/${this.getId()}/generate_audio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify({ text })
            })

            const data = await response.json()
            if (data.audio) {
                this.audioPreviewContainerTarget.classList.remove('hidden')
                this.audioPlayerTarget.src = data.audio
                this.audioPlayerTarget.play()
            } else {
                alert(data.error || 'Erro no áudio. A campanha seguirá apenas com texto.')
            }
        } catch (e) {
            alert('Falha ao conectar com ElevenLabs. Prosseguindo em modo texto.')
        } finally {
            this.audioButtonTarget.innerHTML = '<i class="w-3 h-3" data-lucide="mic"></i> Gerar Áudio'
            this.audioButtonTarget.disabled = false
            if (window.lucide) window.lucide.createIcons()
        }
    }

    setMessageType(e) {
        const type = e.currentTarget.dataset.type
        this.currentMessageType = type
        
        // Update UI states for tabs
        this.element.querySelectorAll('[data-action*="setMessageType"]').forEach(btn => {
            if (btn.dataset.type === type) {
                btn.classList.add('bg-emerald-500/20', 'text-emerald-500', 'border-emerald-500/30')
                btn.classList.remove('bg-slate-900', 'text-slate-500', 'border-slate-800')
            } else {
                btn.classList.remove('bg-emerald-500/20', 'text-emerald-500', 'border-emerald-500/30')
                btn.classList.add('bg-slate-900', 'text-slate-500', 'border-slate-800')
            }
        })
    }

    addBlock() {
        console.log("Tentando adicionar mensagem...")
        
        // Safety check: Avoid 'undefined' push error
        if (!this.messageSequence) {
            console.warn("messageSequence estava undefined, reinicializando...")
            this.messageSequence = []
        }
        if (!this.hasEditorTarget) {
            console.error("Alvo 'editor' não encontrado")
            return
        }
        
        const message = this.editorTarget.value.trim()
        if (!message) {
            console.warn("Mensagem vazia ignorada")
            return
        }

        try {
            // Rule: Add message to global array messageSequence
            const block = {
                content: message,
                type: this.currentMessageType || 'text'
            }

            this.messageSequence.push(block)
            console.log("Mensagem adicionada ao array:", this.messageSequence.length)
            
            // Rule: Clear editor immediately after successful push
            this.editorTarget.value = ''
            
            if (this.hasPreviewTextTarget) {
                this.previewTextTarget.innerText = 'Sua prévia aparecerá aqui conforme você digita...'
                const parentDiv = this.previewTextTarget.closest('div')
                if (parentDiv) parentDiv.classList.add('opacity-40')
            }
            if (this.hasAudioPreviewContainerTarget) this.audioPreviewContainerTarget.classList.add('hidden')
            
            // Trigger UI update
            this.updateUI()
            this.updateAddButtonState()
            this.scrollToBottom()
            
            console.log("Sequência de adição concluída com sucesso.")
        } catch (error) {
            console.error("Erro ao adicionar mensagem:", error)
            // Fallback clear to ensure the UI doesn't look stuck
            this.editorTarget.value = ''
        }
    }

    removeBlock(e) {
        const item = e.currentTarget.closest('.message-item')
        if (!item) return
        const index = parseInt(item.dataset.index) - 1
        this.messageSequence.splice(index, 1)
        this.updateUI()
    }

    updateUI() {
        try {
            // Safety check for UI update
            if (!this.messageSequence) this.messageSequence = []
            
            if (!this.hasMessagesListTarget) {
                console.warn("Alvo 'messagesList' não encontrado na view.")
                return
            }
            
            const list = this.messagesListTarget
            // Clean previous items but maintain placeholder logic
            list.querySelectorAll('.message-item').forEach(el => el.remove())

            const placeholder = list.querySelector('.no-messages-placeholder')
            
            if (this.messageSequence.length === 0) {
                if (!placeholder) {
                    list.innerHTML = `
                        <div class="no-messages-placeholder flex items-center justify-center p-12 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[2rem]">
                            <div class="text-center text-slate-600">
                                <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-4 opacity-20"></i>
                                <p class="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem adicionada</p>
                            </div>
                        </div>
                    `
                }
            } else {
                if (placeholder) placeholder.remove()

                const typesMeta = {
                    text: { label: 'TEXTO', icon: 'text' },
                    image: { label: 'IMAGEM', icon: 'image' },
                    audio: { label: 'ÁUDIO', icon: 'mic' },
                    video: { label: 'VÍDEO', icon: 'video' },
                    document: { label: 'DOC', icon: 'file-text' }
                }

                this.messageSequence.forEach((block, idx) => {
                    if (!this.hasBlockTemplateTarget) return
                    
                    const tpl = this.blockTemplateTarget.content.cloneNode(true)
                    const item = tpl.querySelector('.message-item')
                    if (!item) return

                    const meta = typesMeta[block.type] || typesMeta.text

                    item.dataset.index = idx + 1
                    const indexTag = item.querySelector('.index-tag')
                    if (indexTag) indexTag.innerText = idx + 1
                    
                    const previewText = item.querySelector('.message-preview-line')
                    if (previewText) previewText.innerText = block.content
                    
                    const typeTag = item.querySelector('.type-tag')
                    if (typeTag) typeTag.innerText = meta.label
                    
                    const iconWrapper = item.querySelector('.index-wrapper')
                    if (iconWrapper) {
                        const icon = document.createElement('i')
                        icon.dataset.lucide = meta.icon
                        icon.className = "w-3 h-3 ml-1"
                        iconWrapper.appendChild(icon)
                    }

                    list.appendChild(item)
                })
            }

            this.persist()
            this.updateSimulator()
            
            if (window.lucide) window.lucide.createIcons()
            if (this.hasCountTarget) this.countTarget.innerText = this.messageSequence.length
            this.scrollToBottom()
            
            // Trigger Autosave after UI update
            this.autosave()
        } catch (error) {
            console.error("Erro crítico no updateUI:", error)
        }
    }

    autosave() {
        if (this.autosaveTimeout) clearTimeout(this.autosaveTimeout)
        
        this.autosaveTimeout = setTimeout(async () => {
            if (!this.hasStatusTarget) return
            
            const originalStatus = this.statusTarget.innerHTML
            this.statusTarget.innerHTML = `<i class="w-3 h-3 animate-spin inline-block mr-1" data-lucide="refresh-cw"></i> Salvando...`
            if (window.lucide) window.lucide.createIcons()

            try {
                const form = document.getElementById('campaign-form');
                if (!form) return;
                const formData = new FormData(form)
                const url = `/accounts/${this.getAccountId()}/campaigns/${this.getId()}/update_composition`
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Accept': 'application/json',
                        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content
                    },
                    body: formData
                })

                const data = await response.json()
                if (data.status === 'success') {
                    this.statusTarget.innerHTML = `<i class="w-3 h-3 inline-block mr-1 text-emerald-500" data-lucide="check"></i> Rascunho Salvo às ${data.saved_at}`
                    this.statusTarget.classList.add('text-emerald-500')
                    this.statusTarget.classList.remove('text-amber-500', 'text-red-500')
                } else {
                    throw new Error(data.errors?.join(', ') || 'Erro ao salvar')
                }
            } catch (error) {
                console.error("Autosave failed:", error)
                this.statusTarget.innerHTML = `<i class="w-3 h-3 inline-block mr-1 text-red-500" data-lucide="alert-circle"></i> Erro ao Salvar`
                this.statusTarget.classList.add('text-red-500')
            } finally {
                if (window.lucide) window.lucide.createIcons()
            }
        }, 1500) // 1.5s debounce
    }

    updateSimulator() {
        if (!this.hasSimulatorHistoryTarget) return
        this.simulatorHistoryTarget.innerHTML = ''
        
        this.messageSequence.forEach(block => {
            const bubble = document.createElement('div')
            bubble.className = "bg-[#0D1117] border border-slate-800 p-4 rounded-2xl rounded-tl-none shadow-xl max-w-[85%] self-start animate-in fade-in slide-in-from-left-2"
            
            // Apply variable processing to saved messages too
            const processedContent = this.processVariables(block.content)
            
            bubble.innerHTML = `
                <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">${block.type}</div>
                <p class="text-xs text-slate-300 leading-relaxed">${processedContent}</p>
            `
            this.simulatorHistoryTarget.appendChild(bubble)
        })
    }

    scrollToBottom() {
        if (!this.hasSimulatorBodyTarget) return
        setTimeout(() => {
            this.simulatorBodyTarget.scrollTo({
                top: this.simulatorBodyTarget.scrollHeight,
                behavior: 'smooth'
            })
        }, 50)
    }

    persist() {
        if (!this.hasBlocksContainerTarget) return
        
        this.blocksContainerTarget.innerHTML = ''
        this.messageSequence.forEach((block, idx) => {
            this.addHiddenInput(`campaign[message_sequence][${idx}][content]`, block.content)
            this.addHiddenInput(`campaign[message_sequence][${idx}][type]`, block.type)
        })
    }

    addHiddenInput(name, value) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        this.blocksContainerTarget.appendChild(input)
    }

    toggleEmojiPicker() {
        if (this.hasEmojiPickerTarget) {
            this.emojiPickerTarget.classList.toggle('hidden')
        }
    }

    openFileSelector() {
        if (this.hasFileInputTarget) {
            this.fileInputTarget.click()
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0]
        if (!file) return
        alert(`Arquivo selecionado: ${file.name}. (Funcionalidade de upload em desenvolvimento)`)
    }

    getAccountId() {
        return window.location.pathname.split('/')[2]
    }

    getId() {
        return window.location.pathname.split('/')[4]
    }
}
