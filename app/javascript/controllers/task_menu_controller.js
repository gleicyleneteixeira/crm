import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["display", "editForm", "input", "icon", "menu"];
  static values = {
    updateUrl: String,
    deleteUrl: String,
    eventId: String
  };

  connect() {
    this.closeMenuHandler = this.closeMenu.bind(this);
    
    // Global uniqueness: Listen for other menus opening
    this.externalOpenHandler = (e) => {
      if (e.detail && e.detail.eventId !== this.eventIdValue) {
        this.closeMenu();
        this.cancelEdit(); // Also close edit forms if another task's menu is opened
      }
    };
    window.addEventListener("task-menu:opened", this.externalOpenHandler);
  }

  disconnect() {
    this.closeMenu();
    window.removeEventListener("task-menu:opened", this.externalOpenHandler);
  }

  // --- Core Lifecycle ---

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.hasMenuTarget) {
      const isCurrentlyOpen = !this.menuTarget.classList.contains("hidden");
      if (isCurrentlyOpen) {
        this.closeMenu();
      } else {
        this.openMenu();
      }
    }
  }

  openMenu() {
    if (!this.hasMenuTarget) return;

    // Dispatch global event to close other menus/forms
    window.dispatchEvent(new CustomEvent("task-menu:opened", { detail: { eventId: this.eventIdValue } }));

    const menu = this.menuTarget;
    
    // Boost parent container z-index
    const card = this.getCardContainer();
    if (card) {
        card.style.zIndex = "99999"; 
        card.style.position = "relative";
        card.style.overflow = "visible"; 
    }
    
    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.position = "absolute";
    menu.style.zIndex = "99999";
    menu.style.top = "100%";
    menu.style.right = "0";
    menu.style.marginTop = "8px";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";

    document.addEventListener("click", this.closeMenuHandler);
  }

  closeMenu(event) {
    if (event && event.type === "click" && this.hasMenuTarget && this.menuTarget.contains(event.target)) {
      if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
    }

    // Only cleanup card state if NOT in edit mode
    if (!this.isEditing()) {
      this.cleanupCardState();
    }

    document.removeEventListener("click", this.closeMenuHandler);
  }

  // --- Task Actions ---

  async completeTask(event) {
    event.preventDefault();
    this.closeMenu();
    
    if (this.hasIconTarget) {
      this.iconTarget.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-emerald-500"></i>';
      if (window.lucide) window.lucide.createIcons();
    }

    const formData = new FormData();
    formData.append("event[done]", "true");
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  async reopenTask(event) {
    event.preventDefault();
    this.closeMenu();

    if (this.hasIconTarget) {
      this.iconTarget.innerHTML = '<i data-lucide="clock-4" class="w-4 h-4 text-sky-500"></i>';
      if (window.lucide) window.lucide.createIcons();
    }

    const formData = new FormData();
    formData.append("event[done]", "false");
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  showEdit(event) {
    event.preventDefault();
    
    // Cascade Close: Hide the menu before showing the edit form
    this.closeMenu(); 

    if (this.hasEditFormTarget) {
      this.displayTarget.classList.add("hidden");
      this.editFormTarget.classList.remove("hidden");
      this.editFormTarget.style.display = "block";
      this.editFormTarget.style.zIndex = "99999";
      
      // Ensure the card stays on top for the edit form
      const card = this.getCardContainer();
      if (card) {
          card.style.zIndex = "99999";
          card.style.position = "relative";
          card.style.overflow = "visible";
      }
      
      if (this.hasInputTarget) this.inputTarget.focus();
    }
  }

  cancelEdit(event) {
    if (event) event.preventDefault();
    if (this.hasEditFormTarget) {
      this.editFormTarget.classList.add("hidden");
      this.displayTarget.classList.remove("hidden");
    }
    this.cleanupCardState();
  }

  async submitEdit(event) {
    event.preventDefault();
    const formData = new FormData(this.editFormTarget.querySelector('form'));
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
    this.cancelEdit();
  }

  async deleteTask(event) {
    event.preventDefault();
    if (!confirm("Tem certeza que deseja excluir esta tarefa?")) return;
    this.closeMenu();
    await this.performRequest(this.deleteUrlValue, "DELETE");
  }

  // --- Helpers ---

  getCardContainer() {
    return this.element.closest('.rounded-xl, .rounded-lg, li[id^="deal_"], div[id^="event_"]');
  }

  cleanupCardState() {
    const card = this.getCardContainer();
    if (card) {
        card.style.zIndex = "";
        card.style.overflow = "";
    }
  }

  isEditing() {
    return this.hasEditFormTarget && !this.editFormTarget.classList.contains("hidden");
  }

  async performRequest(url, method, body = null) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    try {
      const response = await fetch(url, {
        method: method,
        headers: { "X-CSRF-Token": csrfToken, "Accept": "text/vnd.turbo-stream.html" },
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
