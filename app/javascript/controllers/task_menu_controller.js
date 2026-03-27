import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["display", "editForm", "input", "icon"];
  static values = {
    updateUrl: String,
    deleteUrl: String,
    eventId: String
  };

  connect() {
    this.closeMenuHandler = this.closeMenu.bind(this);
    this.menuId = `task-menu-dropdown-${this.eventIdValue}`;
  }

  disconnect() {
    this.closeMenu();
  }

  get menuElement() {
    return document.getElementById(this.menuId);
  }

  toggleMenu(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const menu = this.menuElement;
    if (!menu) return;

    if (menu.classList.contains("hidden")) {
      this.openMenu(menu);
    } else {
      this.closeMenu();
    }
  }

  openMenu(menu) {
    if (!menu) menu = this.menuElement;
    if (!menu) return;

    // 1. Calculate relative to the element (icon)
    const icon = this.hasIconTarget ? this.iconTarget : this.element;
    const rect = icon.getBoundingClientRect();

    // 2. Portal: Always move to body to escape parent scoping
    document.body.appendChild(menu);

    // 3. Absolute Position relative to body (viewport + scroll)
    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.visibility = "visible";
    menu.style.opacity = "1";
    menu.style.position = "absolute";
    menu.style.zIndex = "2147483647";

    this.applyPosition(menu, rect);

    // 4. Global listeners
    setTimeout(() => {
        document.addEventListener("click", this.closeMenuHandler);
        window.addEventListener("resize", this.closeMenuHandler);
    }, 50);
  }

  applyPosition(menu, rect) {
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    
    const menuWidth = 160;
    const menuHeight = 180; // Approximate height
    
    // DROPUP: Force opening upwards since the clock is at the base
    let top = rect.top + scrollY - menuHeight - 12;
    let left = rect.right + scrollX - menuWidth;
    
    // Safety check: if hitting the very top of the screen, fallback to dropdown
    if (top < scrollY + 10) {
        top = rect.bottom + scrollY + 8;
    }
    
    // Horizontal adjustment
    if (left < 10) left = 10;
    if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }

  closeMenu(event) {
    const menu = this.menuElement;
    if (!menu) return;

    // If click is inside menu (and not a menuitem), don't close
    if (event && event.type === "click" && menu.contains(event.target)) {
        const item = event.target.closest('[role="menuitem"]');
        if (!item) return;
    }

    menu.classList.add("hidden");
    
    // Return to original container if possible
    if (this.element && !this.element.contains(menu)) {
        this.element.appendChild(menu);
    }

    document.removeEventListener("click", this.closeMenuHandler);
    window.removeEventListener("resize", this.closeMenuHandler);
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
      this.iconTarget.innerHTML = '<i data-lucide="clock-4" class="w-4 h-4"></i>';
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
