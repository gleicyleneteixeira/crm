import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    // 1. Generate Lucide icons first
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // 2. Reveal elements (Icons and Badges) after a small delay to ensure icons are rendered
    setTimeout(() => {
      this.element.querySelectorAll('[data-as-icon="true"], [data-as-badge="true"]').forEach(el => {
        el.classList.remove('opacity-0');
        el.style.opacity = "1";
      });
    }, 50);
  }
}
