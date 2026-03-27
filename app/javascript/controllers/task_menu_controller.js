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
    this.menuId = `task-menu-dropdown-${this.eventIdValue}`;
    this.isMenuOpen = false;
    
    // ZOMBIE CLEANUP: Remove any orphaned menus from previous renders
    const existing = document.body.querySelector(`#${this.menuId}`);
    if (existing && existing.parentNode === document.body) {
      document.body.removeChild(existing);
    }
  }

  disconnect() {
    if (this.isMenuOpen) this.closeMenu();
  }

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.isMenuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (!this.hasMenuTarget) return;

    const menu = this.menuTarget;
    const icon = this.hasIconTarget ? this.iconTarget : this.element;
    const rect = icon.getBoundingClientRect();

    // 1. Portal Move
    this.originalParent = menu.parentNode;
    document.body.appendChild(menu);
    this.isMenuOpen = true;

    // 2. Fixed Positioning & High Z-Index
    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.position = "fixed";
    menu.style.zIndex = "999999";
    menu.style.opacity = "1";
    menu.style.visibility = "visible";

    this.applyPosition(menu, rect);

    // 3. Listeners
    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 50);
  }

  applyPosition(menu, rect) {
    const menuWidth = 160;
    const menuHeight = 160; // Approximate
    const gap = 6;

    // Default: Below, right-aligned with the icon/button
    let top = rect.bottom + gap;
    let left = rect.right - menuWidth;

    // Boundary Check: If hitting the bottom of viewport, open UP
    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - gap;
    }

    // Boundary Check: Ensure it doesn't bleed off the left
    if (left < 10) left = 10;
    // Ensure it doesn't bleed off the right
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  closeMenu(event) {
    // If clicking INSIDE the menu (not on a menuitem), don't close
    if (event && event.type === "click" && this.hasMenuTarget && this.menuTarget.contains(event.target)) {
      if (!event.target.closest('[role="menuitem"]')) return;
    }

    if (this.hasMenuTarget && this.isMenuOpen) {
      const menu = this.menuTarget;
      menu.classList.add("hidden");
      
      // Return to original parent
      if (this.originalParent && menu.parentNode === document.body) {
        this.originalParent.appendChild(menu);
      }
      this.isMenuOpen = false;
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
