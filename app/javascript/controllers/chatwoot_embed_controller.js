import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.handlePageShow = this.handlePageShow.bind(this)
    window.addEventListener("pageshow", this.handlePageShow)
  }

  disconnect() {
    window.removeEventListener("pageshow", this.handlePageShow)
  }

  handlePageShow(event) {
    // Se a página foi carregada do cache do navegador (back button)
    if (event.persisted) {
      window.location.reload()
    }
  }
}
