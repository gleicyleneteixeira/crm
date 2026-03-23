import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["previewText", "blocksContainer", "messagesList", "blockTemplate", "aiButton", "audioButton", "aiVariationsContainer", "aiVariationsList", "audioPreviewContainer", "audioPlayer"]
    static values = {
        headers: Array,
        sampleRow: Array,
        initialSequence: Array
    }

    connect() {
        // Initialize from existing data if possible, or start empty
        this.messageBlocks = this.initialSequenceValue || []
        this.currentMessageType = 'text'
        this.updateUI()
        
        this.setupEditor()
        if (window.lucide) window.lucide.createIcons()
    }

    setupEditor() {
        const editor = document.getElementById('message-editor')
        if (editor) {
            editor.addEventListener('input', (e) => {
                const text = e.target.value
                this.previewTextTarget.innerText = this.processVariables(text)
            })
        }
    }

    processVariables(text) {
        let processedText = text
        if (!this.headersValue || !this.sampleRowValue) return processedText

        const nameIndex = this.headersValue.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase() === 'name')

        // Process first_name dynamic tag
        if (processedText.toLowerCase().includes('{{first_name}}')) {
            let firstName = ""
            if (nameIndex !== -1 && this.sampleRowValue[nameIndex]) {
                const full_name = this.sampleRowValue[nameIndex].toString()
                const rawFirst = full_name.split(' ')[0]
                firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()
            }
            const regex = new RegExp('{{first_name}}', 'gi')
            processedText = processedText.replace(regex, firstName || '[Nome]')
        }

        // Process other spreadsheet variables
        this.headersValue.forEach((header, index) => {
            const variable = `{{${header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_")}}}`
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
        const editor = document.getElementById('message-editor')
        const message = editor.value
        if (!message) return

        this.aiButtonTarget.innerHTML = '<i class="w-3 h-3 animate-spin"></i> Gerando...'
        this.aiButtonTarget.disabled = true

        try {
            const response = await fetch(`/accounts/${this.getAccountId()}/campaigns/${this.getId()}/generate_variations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
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
                document.getElementById('message-editor').value = v
                document.getElementById('message-editor').dispatchEvent(new Event('input'))
            }
            this.aiVariationsListTarget.appendChild(card)
        })
    }

    async generateAudioPreview() {
        const editor = document.getElementById('message-editor')
        const text = editor.value
        if (!text) return

        this.audioButtonTarget.innerHTML = '<i class="w-3 h-3 animate-spin"></i> Gravando...'
        this.audioButtonTarget.disabled = true

        try {
            const response = await fetch(`/accounts/${this.getAccountId()}/campaigns/${this.getId()}/generate_audio`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
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
        const editor = document.getElementById('message-editor')
        const message = editor.value.trim()
        if (!message) return

        const block = {
            content: message,
            type: this.currentMessageType || 'text'
        }

        this.messageBlocks.push(block)
        this.updateUI()
        editor.value = ''
        this.previewTextTarget.innerText = 'Sua prévia aparecerá aqui conforme você digita...'
        if (this.hasAudioPreviewContainerTarget) this.audioPreviewContainerTarget.classList.add('hidden')
    }

    removeBlock(e) {
        const index = parseInt(e.currentTarget.closest('.message-item').dataset.index) - 1
        this.messageBlocks.splice(index, 1)
        this.updateUI()
    }

    updateUI() {
        const list = this.messagesListTarget
        list.querySelectorAll('.message-item').forEach(el => el.remove())

        const placeholder = list.querySelector('.no-messages-placeholder')
        if (this.messageBlocks.length > 0 && placeholder) placeholder.remove()

        if (this.messageBlocks.length === 0) {
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
            const typesMeta = {
                text: { label: 'TEXTO', icon: 'text' },
                image: { label: 'IMAGEM', icon: 'image' },
                audio: { label: 'ÁUDIO', icon: 'mic' },
                video: { label: 'VÍDEO', icon: 'video' },
                document: { label: 'DOC', icon: 'file-text' }
            }

            this.messageBlocks.forEach((block, idx) => {
                const tpl = this.blockTemplateTarget.content.cloneNode(true)
                const item = tpl.querySelector('.message-item')
                const meta = typesMeta[block.type] || typesMeta.text

                item.dataset.index = idx + 1
                item.querySelector('.index-tag').innerText = idx + 1
                item.querySelector('.message-preview-line').innerText = block.content
                item.querySelector('.type-tag').innerText = meta.label
                
                const iconContainer = item.querySelector('.index-tag')
                iconContainer.innerHTML = `<i data-lucide="${meta.icon}" class="w-3 h-3"></i>`

                list.appendChild(item)
            })
        }

        this.persist()
        if (window.lucide) window.lucide.createIcons()
        const countEl = document.getElementById('count')
        if (countEl) countEl.innerText = this.messageBlocks.length
    }

    persist() {
        this.blocksContainerTarget.innerHTML = ''
        this.messageBlocks.forEach((block, idx) => {
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

    getAccountId() {
        return window.location.pathname.split('/')[2]
    }

    getId() {
        return window.location.pathname.split('/')[4]
    }
}
