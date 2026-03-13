import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["blocksContainer", "blockTemplate", "list"]

    connect() {
        this.renderIcons()
        this.setupEditor()
    }

    setupEditor() {
        const editor = document.getElementById('message-editor')
        const preview = document.getElementById('preview-text')

        if (editor && preview) {
            editor.addEventListener('input', () => {
                preview.textContent = editor.value || "Sua prévia aparecerá aqui conforme você digita..."
                preview.classList.toggle('opacity-50', !editor.value)
                preview.classList.toggle('italic', !editor.value)
            })
        }
    }

    addBlock(event) {
        if (event) event.preventDefault()

        const editor = document.getElementById('message-editor')
        if (!editor || !editor.value.trim()) return

        const content = editor.value
        const index = this.listTarget.querySelectorAll('.message-item').length

        // Add to the visual list
        const listTemplate = this.blockTemplateTarget.innerHTML
            .replace(/INDEX_LABEL/g, index + 1)
            .replace(/message-preview-line/g, `message-preview-line">${this.escapeHtml(content)}`)

        const div = document.createElement("div")
        div.innerHTML = listTemplate

        // Remove empty state if present
        const emptyState = this.listTarget.querySelector('.bg-slate-900\\/20')
        if (emptyState) emptyState.remove()

        this.listTarget.appendChild(div.firstElementChild)

        // Add hidden input to the form
        this.addHiddenInput(index, content)

        // Reset editor
        editor.value = ""
        const preview = document.getElementById('preview-text')
        if (preview) {
            preview.textContent = "Sua prévia aparecerá aqui conforme você digita..."
            preview.classList.add('opacity-50', 'italic')
        }

        this.updateCount()
        this.renderIcons()
    }

    addHiddenInput(index, content) {
        const container = this.blocksContainerTarget

        const typeInput = document.createElement('input')
        typeInput.type = 'hidden'
        typeInput.name = `campaign[message_sequence][${index}][type]`
        typeInput.value = 'text' // Default for now

        const contentInput = document.createElement('input')
        contentInput.type = 'hidden'
        contentInput.name = `campaign[message_sequence][${index}][content]`
        contentInput.value = content

        container.appendChild(typeInput)
        container.appendChild(contentInput)
    }

    removeBlock(event) {
        event.preventDefault()
        const block = event.target.closest(".message-item")
        if (!block) return

        block.classList.add('animate-out', 'fade-out', 'zoom-out-95')
        setTimeout(() => {
            block.remove()
            this.reindexBlocks()
            this.updateCount()
        }, 150)
    }

    reindexBlocks() {
        // Re-index visual list
        this.listTarget.querySelectorAll(".message-item").forEach((block, index) => {
            const indexTag = block.querySelector('.index-tag')
            if (indexTag) indexTag.textContent = index + 1
        })

        // Re-generate hidden inputs
        this.blocksContainerTarget.innerHTML = ""
        this.listTarget.querySelectorAll(".message-item").forEach((block, index) => {
            const content = block.querySelector('.message-preview-line').textContent
            this.addHiddenInput(index, content)
        })
    }

    updateCount() {
        const count = this.listTarget.querySelectorAll('.message-item').length
        const countEl = document.getElementById('count')
        if (countEl) countEl.textContent = count
    }

    renderIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div')
        div.textContent = text
        return div.innerHTML
    }
}
