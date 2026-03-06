import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["jsonOutput", "pasteArea", "submitButton"]

    connect() {
        this.updateSubmitButton()
    }

    handleFile(event) {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            const content = e.target.result
            this.processRawData(content)
        }
        reader.readAsText(file)
    }

    handlePaste() {
        const rawData = this.pasteAreaTarget.value
        this.processRawData(rawData)
    }

    processRawData(raw) {
        const rows = raw.trim().split(/\r?\n/)
        if (rows.length === 0) return

        // Detect separator (tab for pasted from Excel/Sheets, comma for CSV)
        const firstRow = rows[0]
        const separator = firstRow.includes('\t') ? '\t' : (firstRow.includes(';') ? ';' : ',')

        const data = rows.map(row => {
            return row.split(separator).map(cell => cell.trim().replace(/^"|"$/g, ''))
        })

        this.jsonOutputTarget.value = JSON.stringify(data)
        this.updateSubmitButton()
    }

    updateSubmitButton() {
        const hasData = this.jsonOutputTarget.value && JSON.parse(this.jsonOutputTarget.value).length > 0
        this.submitButtonTarget.disabled = !hasData
        if (hasData) {
            this.submitButtonTarget.classList.remove('opacity-50', 'cursor-not-allowed')
        } else {
            this.submitButtonTarget.classList.add('opacity-50', 'cursor-not-allowed')
        }
    }
}
