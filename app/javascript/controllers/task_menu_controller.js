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
        this.cancelEdit(); 
      }
    };
    window.addEventListener("task-menu:opened", this.externalOpenHandler);
  }

  disconnect() {
    this.closeMenu();
    this.cancelEdit();
    window.removeEventListener("task-menu:opened", this.externalOpenHandler);
  }

  // --- Core Lifecycle ---

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
    }

    if (this.hasMenuTarget) {
      const isCurrentlyOpen = this.menuTarget.style.display === "block" || !this.menuTarget.classList.contains("hidden");
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
    
    // Boost parent container z-index (Local boost for the menu)
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
    menu.style.marginTop = "4px";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";

    // Add listener on next tick
    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 1);
  }

  closeMenu(event) {
    // SENSOR: Check if clicking inside this instance
    if (event && event.type === "click" && this.element.contains(event.target)) {
       if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
      this.menuTarget.style.display = "none"; // Force hidden via style to override any block
    }

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
    
    // CASCADE: Hide the menu forcefully before showing edit
    this.closeMenu(); 

    if (this.hasEditFormTarget) {
      const form = this.editFormTarget;
      const rect = this.displayTarget.getBoundingClientRect();
      
      // FIXED PORTAL: Completely move to body and use fixed coordinates
      // This is the ONLY way to be 100% sure it doesn't affect column width
      document.body.appendChild(form);
      
      form.classList.remove("hidden");
      Object.assign(form.style, {
        display: "block",
        position: "fixed",
        zIndex: "999999",
        top: `${rect.top}px`,
        left: `${rect.left - 10}px`,
        width: "auto",
        maxWidth: "280px"
      });
      
      // Keep card space reserved but hide icon
      this.displayTarget.style.visibility = "hidden";
      
      if (this.hasInputTarget) this.inputTarget.focus();
    }
  }

  cancelEdit(event) {
    if (event) event.preventDefault();
    if (this.hasEditFormTarget) {
      const form = this.editFormTarget;
      form.classList.add("hidden");
      form.style.display = "none";
      form.style.position = "";
      
      // Restore for Turbo parity
      this.element.appendChild(form);
      this.displayTarget.style.visibility = "";
    }
    this.cleanupCardState();
  }

  async submitEdit(event) {
    event.preventDefault();
    const formElement = this.editFormTarget.querySelector('form');
    const formData = new FormData(formElement);
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
    return this.hasEditFormTarget && this.editFormTarget.style.display === "block";
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
