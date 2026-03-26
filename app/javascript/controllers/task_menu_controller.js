import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["menu", "display", "editForm", "input", "icon"];
  static values = {
    updateUrl: String,
    deleteUrl: String,
    eventId: String
  };

  connect() {
    this.closeMenuHandler = this.closeMenu.bind(this);
    this.windowHandler = () => this.hideAll();
  }

  hideAll() {
    if (!this.menuTarget.classList.contains("hidden")) {
      this.menuTarget.classList.add("hidden");
    }
    if (!this.editFormTarget.classList.contains("hidden")) {
      this.editFormTarget.classList.add("hidden");
      this.displayTarget.classList.remove("hidden");
    }
    document.removeEventListener("click", this.closeMenuHandler);
    window.removeEventListener("scroll", this.windowHandler, true);
    window.removeEventListener("resize", this.windowHandler);
  }

  toggleMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.menuTarget.classList.contains("hidden")) {
      this.hideAll();
      this.reposition(this.menuTarget);
      this.menuTarget.classList.remove("hidden");
      document.addEventListener("click", this.closeMenuHandler);
      window.addEventListener("scroll", this.windowHandler, true);
      window.addEventListener("resize", this.windowHandler);
    } else {
      this.hideAll();
    }
  }

  closeMenu(event) {
    if (!this.element.contains(event.target) && !this.menuTarget.contains(event.target) && !this.editFormTarget.contains(event.target)) {
      this.hideAll();
    }
  }

  showEdit(event) {
    event.preventDefault();
    this.menuTarget.classList.add("hidden");
    this.displayTarget.classList.add("hidden");
    this.reposition(this.editFormTarget);
    this.editFormTarget.classList.remove("hidden");
    if (this.hasInputTarget) {
      this.inputTarget.focus();
    }
  }

  reposition(target) {
    // Ensure target is visible to get dimensions
    target.classList.remove("hidden");
    const trigger = this.iconTarget.getBoundingClientRect();
    const height = target.offsetHeight;
    const width = target.offsetWidth;
    target.classList.add("hidden");

    let top = trigger.bottom + 5;
    let left = trigger.left; // Align left of menu with left of icon

    // Flip vertical if no space below
    if (top + height > window.innerHeight - 10) {
      top = trigger.top - height - 5;
    }

    // Adjust horizontal if going off-screen right
    if (left + width > window.innerWidth - 10) {
      left = window.innerWidth - width - 10;
    }

    // Adjust horizontal if going off-screen left
    if (left < 10) {
      left = 10;
    }

    target.style.position = 'fixed';
    target.style.top = `${top}px`;
    target.style.left = `${left}px`;
    target.style.margin = '0';
    target.style.zIndex = '9999';
  }


  cancelEdit(event) {
    if (event) event.preventDefault();
    this.hideAll();
  }

  async completeTask(event) {
    event.preventDefault();
    this.hideAll();
    
    // Instant visual feedback
    if (this.hasIconTarget) {
      this.iconTarget.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-500"></i>';
      if (window.lucide) {
        window.lucide.createIcons({
          nameAttr: 'data-lucide'
        });
      }
    }

    const formData = new FormData();
    formData.append("event[done]", "true");
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  async submitEdit(event) {
    event.preventDefault();
    const form = this.editFormTarget.querySelector('form');
    const formData = new FormData(form);
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
    this.hideAll();
  }

  async deleteTask(event) {
    event.preventDefault();
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    this.hideAll();
    await this.performRequest(this.deleteUrlValue, "DELETE");
  }

  async performRequest(url, method, body = null) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          "X-CSRF-Token": csrfToken,
          "Accept": "text/vnd.turbo-stream.html"
        },
        body: body
      });

      if (response.ok) {
        const stream = await response.text();
        Turbo.renderStreamMessage(stream);
      }
    } catch (error) {
      console.error("Error performing task action:", error);
    }
  }

}
