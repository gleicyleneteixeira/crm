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
    if (this.scrollHandler) window.removeEventListener("scroll", this.scrollHandler, true);
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

  // --- Gold Standard: Smart Teleport ---

  showEdit(event) {
    if (event) event.preventDefault();
    this.closeMenu();

    if (this.hasEditFormTarget) {
      const form = this.editFormTarget;
      const cardRoot = this.element.closest('.rounded-xl');
      
      if (cardRoot && form.parentElement !== cardRoot) {
        // TELEPORT: Move form to card root to protect layout
        cardRoot.appendChild(form);
        cardRoot.style.position = "relative";
        cardRoot.style.overflow = "visible";
        this.rebindTeleportedActions(form);
      }

      form.classList.remove("hidden");
      form.style.display = "block";
      form.style.position = "absolute";
      form.style.top = "40px"; // Gold Standard offset
      form.style.left = "20px";
      form.style.zIndex = "999999";
      
      if (cardRoot) cardRoot.style.zIndex = "999999";
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
      cancelBtn.onclick = (e) => { e.preventDefault(); this.fallbackCancel(); };
    }

    const form = formElement.querySelector('form');
    if (form) {
      form.onsubmit = (e) => { e.preventDefault(); this.submitEdit(e); };
    }
  }

  fallbackCancel() {
    if (this.hasEditFormTarget) {
      const form = this.editFormTarget;
      form.classList.add("hidden");
      form.style.display = "none";
      if (this.hasDisplayTarget) this.displayTarget.style.visibility = "";
      this.cleanupCardState();
    }
    document.removeEventListener("click", this.closeMenuHandler);
  }

  async submitEdit(event) {
    if (event) event.preventDefault();
    const formElement = this.editFormTarget.querySelector('form');
    if (!formElement) return;

    const formData = new FormData(formElement);
    await this.performRequest(this.updateUrlValue, "PATCH", formData);
    this.fallbackCancel();
  }

  // --- Helpers ---

  cleanupCardState() {
    const card = this.element.closest('.rounded-xl');
    if (card) {
      card.style.zIndex = "";
    }
    this.element.style.zIndex = "";
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
