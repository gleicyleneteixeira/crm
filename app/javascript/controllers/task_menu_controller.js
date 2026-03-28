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
        this.fallbackCancel(); 
      }
    };
    window.addEventListener("task-menu:opened", this.externalOpenHandler);
  }

  disconnect() {
    this.closeMenu();
    this.fallbackCancel();
    window.removeEventListener("task-menu:opened", this.externalOpenHandler);
  }

  // --- Core Lifecycle ---

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
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

    window.dispatchEvent(new CustomEvent("task-menu:opened", { detail: { eventId: this.eventIdValue } }));

    const menu = this.menuTarget;
    this.element.style.zIndex = "99999"; 
    
    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.position = "absolute";
    menu.style.zIndex = "99999";
    menu.style.top = "100%";
    menu.style.right = "0";

    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 1);
  }

  closeMenu(event) {
    if (event && event.type === "click") {
       if (this.hasDisplayTarget && this.displayTarget.contains(event.target)) return;

       // Smart Click-Outside (Calendar Aware)
       const isInsideOverlay = (this.hasMenuTarget && this.menuTarget.contains(event.target)) || 
                               (this.hasEditFormTarget && this.editFormTarget.contains(event.target)) ||
                               (event.target.closest('.flatpickr-calendar') || event.target.closest('input[type="datetime-local"]'));
       
       if (isInsideOverlay && !event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
      this.menuTarget.style.display = "none";
    }

    if (!this.isEditing()) {
      this.cleanupCardState();
    }

    document.removeEventListener("click", this.closeMenuHandler);
  }

  // --- Supreme Standard: Stage Portal ---

  showEdit(event) {
    if (event) event.preventDefault();
    this.closeMenu();

    // Use find because targets break after teleportation
    const form = this.hasEditFormTarget ? this.editFormTarget : this.teleportedForm;
    if (!form) return;

    // SUPREME PORTAL: Find the Stage Root (the card list 'ul')
    const stageRoot = this.element.closest('ul[id^="deals_stage_"]');
    const card = this.element.closest('li[id^="deal_"]');
    
    if (stageRoot && card) {
      if (form.parentElement !== stageRoot) {
        this.teleportedForm = form; // Save persistent reference
        stageRoot.appendChild(form);
        this.rebindTeleportedActions(form);
      }

      form.classList.remove("hidden");
      form.style.display = "block";
      form.style.position = "absolute";
      
      form.style.top = (card.offsetTop + 40) + "px";
      form.style.left = "10px"; // Fixed within the column width
      form.style.width = "240px"; // Compact Supreme width
      form.style.zIndex = "999999";
      
      if (this.hasDisplayTarget) this.displayTarget.style.visibility = "hidden";
      
      const input = form.querySelector('input[type="text"]');
      if (input) input.focus();

      document.addEventListener("click", this.closeMenuHandler);
    }
  }

  rebindTeleportedActions(formElement) {
    // Manual binding because teleporting breaks standard Stimulus action tree
    const cancelBtn = formElement.querySelector('button[type="button"]');
    if (cancelBtn) {
      // Use arrow function AND check for nulls
      cancelBtn.onclick = (e) => { 
        if (e) {
          e.preventDefault(); 
          e.stopPropagation();
        }
        this.fallbackCancel(); 
      };
    }

    const form = formElement.querySelector('form');
    if (form) {
      form.onsubmit = (e) => { 
        if (e) e.preventDefault(); 
        this.submitEdit(e); 
      };
    }
  }

  fallbackCancel() {
    // Check teleported ref FIRST, then targets as fallback
    const form = this.teleportedForm || (this.hasEditFormTarget ? this.editFormTarget : null);
    if (form) {
      form.classList.add("hidden");
      form.style.setProperty("display", "none", "important"); // Force hide
      
      if (this.hasDisplayTarget) {
        this.displayTarget.style.visibility = "visible";
        this.displayTarget.style.display = ""; 
      }
      this.cleanupCardState();
    }
    document.removeEventListener("click", this.closeMenuHandler);
    this.element.style.zIndex = ""; 
  }

  async completeTask(event) {
    if (event) event.preventDefault();
    this.closeMenu();
    
    const formData = new FormData();
    formData.append("event[done]", "true");
    
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  async reopenTask(event) {
    if (event) event.preventDefault();
    this.closeMenu();
    
    const formData = new FormData();
    formData.append("event[done]", "false");
    
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
  }

  async deleteTask(event) {
    if (event) {
      event.preventDefault();
      if (!confirm("Tem certeza que deseja excluir este agendamento?")) return;
    }
    
    this.closeMenu();
    await this.performRequest(this.deleteUrlValue, "DELETE");
  }

  async submitEdit(event) {
    if (event) event.preventDefault();
    const form = this.teleportedForm || (this.hasEditFormTarget ? this.editFormTarget : null);
    const formElement = form?.querySelector('form');
    if (!formElement) return;

    const formData = new FormData(formElement);
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
    this.fallbackCancel();
  }

  // --- Helpers ---

  cleanupCardState() {
    // No specific card state cleanup needed since work is Stage-anchored
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
