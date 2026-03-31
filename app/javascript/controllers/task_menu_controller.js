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
    this.cleanupOrphanedForm();
    window.removeEventListener("task-menu:opened", this.externalOpenHandler);
  }

  cleanupOrphanedForm() {
    const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
    if (portalForm) {
      portalForm.remove();
    }
    this.teleportedForm = null;
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

       const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
       const isInsideOverlay = (this.hasMenuTarget && this.menuTarget.contains(event.target)) || 
                               (this.hasEditFormTarget && this.editFormTarget.contains(event.target)) ||
                               (portalForm && portalForm.contains(event.target)) ||
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

  // --- Adaptive Portal: Kanban Stage vs Frame Card ---

  showEdit(event) {
    if (event) event.preventDefault();
    this.closeMenu();

    const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
    const activeForm = this.hasEditFormTarget ? this.editFormTarget : portalForm;
    if (!activeForm) return;

    // Detect Contexts
    const stageRoot = this.element.closest('ul[id^="deals_stage_"]');
    const kanbanCard = this.element.closest('li[id^="deal_"]');
    const frameCard = this.element.closest('.rounded-lg'); // History/Event card root
    
    if (stageRoot && kanbanCard) {
      // --- KANBAN MODE ---
      if (activeForm.parentElement !== stageRoot) {
        this.cleanupOrphanedForm();
        activeForm.id = `edit-form-portal-${this.eventIdValue}`;
        this.teleportedForm = activeForm; 
        stageRoot.appendChild(activeForm);
        this.rebindTeleportedActions(activeForm);
      }

      activeForm.classList.remove("hidden");
      activeForm.style.display = "block";
      activeForm.style.position = "absolute";
      activeForm.style.top = (kanbanCard.offsetTop + 40) + "px";
      activeForm.style.left = "10px"; 
      activeForm.style.width = "240px"; 
      activeForm.style.zIndex = "999999";
    } else if (frameCard) {
      // --- FRAME/HISTORY MODE ---
      // Teleport to Frame Card for clean relative anchoring
      if (activeForm.parentElement !== frameCard) {
        this.cleanupOrphanedForm();
        activeForm.id = `edit-form-portal-${this.eventIdValue}`;
        this.teleportedForm = activeForm; 
        frameCard.appendChild(activeForm);
        this.rebindTeleportedActions(activeForm);
      }

      activeForm.classList.remove("hidden");
      activeForm.style.display = "block";
      activeForm.style.position = "absolute";
      activeForm.style.top = "40px"; // Float below the header
      activeForm.style.left = "10px"; // Align near the icon
      activeForm.style.width = "240px";
      activeForm.style.zIndex = "999999";
    } else {
      // --- FALLBACK ---
      activeForm.classList.remove("hidden");
      activeForm.style.display = "block";
      activeForm.style.position = "absolute";
      activeForm.style.top = "100%";
      activeForm.style.left = "0";
      activeForm.style.width = "240px";
      activeForm.style.zIndex = "999999";
    }

    if (this.hasDisplayTarget) this.displayTarget.style.visibility = "hidden";
    const input = activeForm.querySelector('input[type="text"]');
    if (input) input.focus();
    document.addEventListener("click", this.closeMenuHandler);
  }

  rebindTeleportedActions(formElement) {
    const cancelBtn = formElement.querySelector('button[type="button"]');
    if (cancelBtn) {
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
    const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
    const form = this.teleportedForm || portalForm || (this.hasEditFormTarget ? this.editFormTarget : null);
    
    if (form) {
      form.classList.add("hidden");
      form.style.setProperty("display", "none", "important"); 
      
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
    const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
    const formContext = this.teleportedForm || portalForm || (this.hasEditFormTarget ? this.editFormTarget : null);
    const formElement = formContext?.querySelector('form');
    if (!formElement) return;

    const formData = new FormData(formElement);
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
    this.fallbackCancel();
  }

  // --- Helpers ---

  cleanupCardState() {
    this.element.style.zIndex = "";
  }

  isEditing() {
    const portalForm = document.getElementById(`edit-form-portal-${this.eventIdValue}`);
    const form = this.teleportedForm || portalForm || (this.hasEditFormTarget ? this.editFormTarget : null);
    return form && form.style.display === "block";
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
