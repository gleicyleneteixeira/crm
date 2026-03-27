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
  }

  toggleMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.menuTarget.classList.contains("hidden")) {
      this.openMenu();
    } else {
      this.closeMenu(event);
    }
  }

  openMenu() {
    this.menuTarget.classList.remove("hidden");
    
    // Ensure visibility and stacking
    this.menuTarget.style.display = "block";
    this.menuTarget.style.visibility = "visible";
    this.menuTarget.style.opacity = "1";
    
    this.positionMenu();
    document.addEventListener("click", this.closeMenuHandler);
    window.addEventListener("scroll", this.closeMenuHandler, true);
    window.addEventListener("resize", this.closeMenuHandler);
  }

  positionMenu() {
    const icon = this.hasIconTarget ? this.iconTarget : this.element;
    const rect = icon.getBoundingClientRect();
    const menuWidth = 160; 
    
    // Safety check for browser boundaries
    let top = rect.bottom + 8;
    let left = rect.right - menuWidth;
    
    // If it would go off the bottom, open upwards
    if (top + 200 > window.innerHeight) {
      top = rect.top - 180; // approx height
    }
    
    // If it would go off the left, align to left of icon
    if (left < 0) {
      left = rect.left;
    }

    this.menuTarget.style.position = "fixed";
    this.menuTarget.style.top = `${top}px`;
    this.menuTarget.style.left = `${left}px`;
    this.menuTarget.style.zIndex = "99999";
  }

  closeMenu(event) {
    if (event && event.type === "click" && this.element.contains(event.target)) return;

    this.menuTarget.classList.add("hidden");
    document.removeEventListener("click", this.closeMenuHandler);
    window.removeEventListener("scroll", this.closeMenuHandler, true);
    window.removeEventListener("resize", this.closeMenuHandler);
  }

  async completeTask(event) {
    event.preventDefault();
    this.menuTarget.classList.add("hidden");
    
    // Instant visual feedback
    if (this.hasIconTarget) {
      this.iconTarget.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-emerald-500"></i>';
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

  async reopenTask(event) {
    event.preventDefault();
    this.menuTarget.classList.add("hidden");

    // Instant visual feedback - return to clock
    if (this.hasIconTarget) {
      this.iconTarget.innerHTML = '<i data-lucide="clock-4" class="w-4 h-4"></i>';
      if (window.lucide) {
        window.lucide.createIcons({
          nameAttr: 'data-lucide'
        });
      }
    }

    const formData = new FormData();
    formData.append("event[done]", "false");

    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  showEdit(event) {
    if (this.hasEditFormTarget) {
      event.preventDefault();
      this.menuTarget.classList.add("hidden");
      this.displayTarget.classList.add("hidden");
      this.editFormTarget.classList.remove("hidden");
      if (this.hasInputTarget) {
        this.inputTarget.focus();
      }
    }
  }

  cancelEdit(event) {
    if (event) event.preventDefault();
    if (this.hasEditFormTarget) {
      this.editFormTarget.classList.add("hidden");
      this.displayTarget.classList.remove("hidden");
    }
  }

  async submitEdit(event) {
    if (this.hasEditFormTarget) {
      event.preventDefault();
      const formData = new FormData(this.editFormTarget.querySelector('form'));
      await this.performRequest(this.updateUrlValue, "PATCH", formData);
      this.cancelEdit();
    }
  }

  async deleteTask(event) {
    event.preventDefault();
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    
    this.menuTarget.classList.add("hidden");
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
      } else {
        console.error("Task action failed");
      }
    } catch (error) {
      console.error("Error performing task action:", error);
    }
  }
}

