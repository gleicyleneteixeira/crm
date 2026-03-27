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
      // No stopPropagation here - let the flow be natural or managed by logic
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
    menu.style.marginTop = "8px";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";

    // Add listener on next tick to avoid catching the same click
    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 1);
  }

  closeMenu(event) {
    // SENSOR: Check if clicking inside the elements of THIS instance
    if (event && event.type === "click" && this.element.contains(event.target)) {
       // If it's a menu action link, proceed with closing, otherwise stay open
       if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
    }

    // Only cleanup card state if NOT in cloud-edit mode
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
    this.closeMenu(); 

    if (this.hasEditFormTarget) {
      const form = this.editFormTarget;
      const rect = this.displayTarget.getBoundingClientRect();
      
      // PORTAL: Move form to body for "Cloud" behavior (No deformation)
      document.body.appendChild(form);
      
      form.classList.remove("hidden");
      form.style.display = "block";
      form.style.position = "fixed";
      form.style.zIndex = "999999";
      form.style.top = `${rect.top}px`;
      form.style.left = `${rect.left - 10}px`; // Adjust slightly to center or match cloud feel
      
      // Preserve card space with visibility (though form is gone, keeps card static)
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
      
      // Move back to original element for Turbo consistency
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
    // Check if form is in body or locally visible
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
