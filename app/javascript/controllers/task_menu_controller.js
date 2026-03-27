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
  }

  disconnect() {
    this.closeMenu();
  }

  // --- Core Lifecycle/Display ---

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation(); // Essential: prevent the document click listener from firing for this click
    }

    if (this.hasMenuTarget) {
      // Truth Source: The 'hidden' class on the menu target
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

    const menu = this.menuTarget;
    
    // 1. Boost parent card z-index (Overlap Safety)
    const card = this.element.closest('.rounded-xl, .rounded-lg, li[id^="deal_"], div[id^="event_"]');
    if (card) {
        card.style.zIndex = "99999"; 
        card.style.position = "relative";
        card.style.overflow = "visible"; 
    }
    
    // 2. Local Anchored Positioning (No movement)
    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.position = "absolute";
    menu.style.zIndex = "99999";
    menu.style.top = "100%";
    menu.style.right = "0";
    menu.style.marginTop = "8px";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";

    // 3. Sensor: Click Outside listener
    // Use capture to catch events before they bubble if needed, but simple listener usually works
    document.addEventListener("click", this.closeMenuHandler);
  }

  closeMenu(event) {
    // SENSOR: Don't close if clicking INSIDE the menu (unless it's a specific menuitem link)
    if (event && event.type === "click" && this.hasMenuTarget && this.menuTarget.contains(event.target)) {
      if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
    }

    // 4. Reset Parent Card (Cleanup)
    const card = this.element.closest('.rounded-xl, .rounded-lg, li[id^="deal_"], div[id^="event_"]');
    if (card) {
        card.style.zIndex = "";
        card.style.overflow = "";
    }

    document.removeEventListener("click", this.closeMenuHandler);
  }

  // --- Task Operations (Keep Logic Intact) ---

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
      this.displayTarget.classList.add("hidden");
      this.editFormTarget.classList.remove("hidden");
      if (this.hasInputTarget) this.inputTarget.focus();
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
