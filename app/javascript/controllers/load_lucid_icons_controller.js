import { Controller } from "@hotwired/stimulus";
import lucide from "lucide/dist/umd/lucide"

export default class extends Controller {
  connect() {
    lucide.createIcons();
    
    // Suporte para revelação tipo "Valor do Negócio"
    this.element.querySelectorAll('[data-as-icon="true"]').forEach(el => {
      el.classList.remove('opacity-0');
    });
  }
}
