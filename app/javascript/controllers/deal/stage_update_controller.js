import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["spinner"]

  connect() {
    this.element.addEventListener("turbo:submit-start", this.showLoading.bind(this))
  }

  showLoading() {
    if (this.hasSpinnerTarget) {
      this.spinnerTarget.classList.remove("hidden")
      this.element.classList.add("opacity-50", "pointer-events-none")
    }
  }

  // O componente será substituído pelo Turbo Stream, 
  // então não precisamos esconder o loading manualmente na maioria dos casos.
}
