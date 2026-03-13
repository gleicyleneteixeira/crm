import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
    static targets = ["fixedDelay", "randomDelay", "minInput", "maxInput", "instanceCard", "instanceInput"]

    connect() {
        this.renderIcons()
    }

    toggleDelayType(event) {
        const type = event.currentTarget.dataset.type
        const isRandom = type === 'random'

        // Update UI buttons
        this.fixedDelayTarget.classList.toggle('border-emerald-500', !isRandom)
        this.fixedDelayTarget.classList.toggle('bg-emerald-500/10', !isRandom)
        this.fixedDelayTarget.classList.toggle('text-emerald-500', !isRandom)

        this.randomDelayTarget.classList.toggle('border-emerald-500', isRandom)
        this.randomDelayTarget.classList.toggle('bg-emerald-500/10', isRandom)
        this.randomDelayTarget.classList.toggle('text-emerald-500', isRandom)

        // Show/Hide inputs (or just change labels)
        if (isRandom) {
            this.minInputTarget.closest('div').querySelector('label').textContent = 'Mínimo (segundos)'
            this.maxInputTarget.closest('div').classList.remove('hidden')
        } else {
            this.minInputTarget.closest('div').querySelector('label').textContent = 'Tempo Fixo (segundos)'
            this.maxInputTarget.closest('div').classList.add('hidden')
        }
    }

    selectInstance(event) {
        const card = event.currentTarget
        const checkbox = card.querySelector('input[type="checkbox"]')

        checkbox.checked = !checkbox.checked
        card.classList.toggle('border-emerald-500', checkbox.checked)
        card.classList.toggle('bg-emerald-500/5', checkbox.checked)

        const checkIcon = card.querySelector('.check-icon')
        if (checkIcon) checkIcon.classList.toggle('hidden', !checkbox.checked)

        this.updateSelectedCount()
    }

    updateSelectedCount() {
        const count = Array.from(this.instanceInputTargets).filter(i => i.checked).length
        const countEl = document.getElementById('selected-count')
        if (countEl) countEl.textContent = count
    }

    renderIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}
