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

  toggleMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (this.hasMenuTarget) {
      if (this.menuTarget.classList.contains("hidden")) {
        this.openMenu();
      } else {
        this.closeMenu();
      }
    }
  }

  openMenu() {
    if (!this.hasMenuTarget) return;

    // 1. Boost card/container z-index to fly over neighbors
    const card = this.element.closest('.rounded-xl, .rounded-lg, [id^="deal_"], [id^="event_"]');
    if (card) {
        card.style.zIndex = "9999";
        card.style.position = "relative";
        // Remove overflow:hidden to allow menu to exit the card boundaries
        card.classList.remove("overflow-hidden");
        card.style.overflow = "visible";
    }
    
    // Also boost the controller element itself
    this.element.style.zIndex = "9999";
    this.element.style.position = "relative";

    // 2. Show and position absolutely relative to the anchored icon/pill
    this.menuTarget.classList.remove("hidden");
    this.menuTarget.style.display = "block";
    this.menuTarget.style.visibility = "visible";
    this.menuTarget.style.opacity = "1";
    this.menuTarget.style.position = "absolute";
    this.menuTarget.style.zIndex = "9999";
    
    // Position Dropup (Above)
    this.menuTarget.style.bottom = "100%";
    this.menuTarget.style.right = "0";
    this.menuTarget.style.marginBottom = "8px";
    this.menuTarget.style.top = "auto"; // Ensure it doesn't try to open downwards

    // 3. Global listeners
    setTimeout(() => {
        document.addEventListener("click", this.closeMenuHandler);
    }, 50);
  }

  closeMenu(event) {
    if (event && event.type === "click" && this.hasMenuTarget && this.menuTarget.contains(event.target)) {
        if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
    }

    // 4. Restore original state of card
    const card = this.element.closest('.rounded-xl, .rounded-lg, [id^="deal_"], [id^="event_"]');
    if (card) {
        card.style.zIndex = "";
        card.style.overflow = "";
    }
    this.element.style.zIndex = "";

    document.removeEventListener("click", this.closeMenuHandler);
  }

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
