import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["menu", "display", "editForm", "input", "icon"];
  static values = {
    updateUrl: String,
    deleteUrl: String,
    eventId: String
  };

  connect() {
    this.closeMenuHandler = this.closeMenu.bind(this);
    this.isMenuInBody = false;
  }

  disconnect() {
    this.closeMenu();
    // Ensure cleanup if controller is removed
    if (this.hasMenuTarget && this.isMenuInBody) {
        document.body.removeChild(this.menuTarget);
    }
  }

  toggleMenu(event) {
    if (event) {
        event.preventDefault();
        // Remove stopPropagation to allow document listeners (from other instances) to catch the click
        // event.stopPropagation();
    }
    
    if (this.menuTarget.classList.contains("hidden")) {
      this.openMenu();
    } else {
      this.closeMenu();
    }
  }

  openMenu() {
    if (!this.hasMenuTarget) return;

    // 1. Position calculation BEFORE moving (or we lose relative context)
    const icon = this.hasIconTarget ? this.iconTarget : this.element;
    const rect = icon.getBoundingClientRect();

    // 2. Portal: Move to body to escape any parent stacking contexts/overflows
    document.body.appendChild(this.menuTarget);
    this.isMenuInBody = true;

    // 3. Show and Position
    this.menuTarget.classList.remove("hidden");
    this.menuTarget.style.display = "block";
    this.menuTarget.style.visibility = "visible";
    this.menuTarget.style.opacity = "1";
    this.menuTarget.style.position = "fixed";
    this.menuTarget.style.zIndex = "2147483647"; // Absolute maximum z-index

    this.applyPosition(rect);

    // 4. Global listeners for closing
    setTimeout(() => {
        document.addEventListener("click", this.closeMenuHandler);
        window.addEventListener("resize", this.closeMenuHandler);
        // We only close on scroll if it's a significant move to avoid accidental closures
        window.addEventListener("scroll", this.closeMenuHandler, true);
    }, 50);
  }

  applyPosition(rect) {
    const menuWidth = 160; 
    const menuHeight = 200; // Estimated max height
    
    let top = rect.bottom + 8;
    let left = rect.right - menuWidth;
    
    // Fit to screens
    if (top + menuHeight > window.innerHeight) {
      top = rect.top - menuHeight - 8;
    }
    if (left < 10) {
      left = 10;
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    this.menuTarget.style.top = `${top}px`;
    this.menuTarget.style.left = `${left}px`;
  }

  closeMenu(event) {
    // If it's a click, check if we should ignore it
    if (event && event.type === "click") {
        // 1. Ignore clicks INSIDE the menu (unless it's a menu item)
        if (this.menuTarget.contains(event.target)) {
            if (!event.target.closest('[role="menuitem"]')) return;
        }
        
        // 2. Ignore clicks on the ICON button itself (toggleMenu handles this)
        const icon = this.hasIconTarget ? this.iconTarget : this.element;
        if (icon.contains(event.target)) return;
    }

    if (this.hasMenuTarget) {
      this.menuTarget.classList.add("hidden");
      
      // Return to original parent to keep Stimulus/Turbo integrity
      if (this.isMenuInBody) {
        this.element.appendChild(this.menuTarget);
        this.isMenuInBody = false;
      }
    }

    document.removeEventListener("click", this.closeMenuHandler);
    window.removeEventListener("scroll", this.closeMenuHandler, true);
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

