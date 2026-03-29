import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";
import { computePosition, flip, shift, offset, autoUpdate } from "@floating-ui/dom";

export default class extends Controller {
  static targets = ["display", "editForm", "input", "icon", "menu"];
  static values = {
    updateUrl: String,
    deleteUrl: String,
    eventId: String
  };

  connect() {
    this.menuOpen = false;
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
    this.cleanupTeleportedElements();
    if (this.cleanupAutoUpdate) this.cleanupAutoUpdate();
    window.removeEventListener("task-menu:opened", this.externalOpenHandler);
  }

  cleanupTeleportedElements() {
    const portalMenu = document.getElementById(`task-menu-portal-${this.eventIdValue}`);
    if (portalMenu) {
      if (this.hasMenuTarget) {
         this.element.appendChild(portalMenu);
      } else {
         portalMenu.remove();
      }
    }

    this.teleportedMenu = null;
  }

  // --- Core Lifecycle ---

  toggleMenu(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (!this.hasMenuTarget || this.menuOpen) return;
    this.menuOpen = true;

    window.dispatchEvent(new CustomEvent("task-menu:opened", { detail: { eventId: this.eventIdValue } }));

    const menu = this.menuTarget;
    const trigger = this.hasDisplayTarget ? this.displayTarget : this.element;

    // --- PORTAL LOGIC: MOVE TO BODY ---
    if (menu.parentElement !== document.body) {
      menu.id = `task-menu-portal-${this.eventIdValue}`;
      this.teleportedMenu = menu;
      document.body.appendChild(menu);
      this.rebindMenuActions(menu);
    }

    menu.classList.remove("hidden");
    menu.style.display = "block";
    menu.style.position = "fixed";
    menu.style.zIndex = "9999999"; // Ultra high
    menu.style.width = "160px";

    // --- FLOATING UI INTELLIGENCE ---
    this.cleanupAutoUpdate = autoUpdate(trigger, menu, () => {
      computePosition(trigger, menu, {
        placement: "bottom-end",
        strategy: "fixed",
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 10 })
        ]
      }).then(({ x, y }) => {
        Object.assign(menu.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      });
    }, { animationFrame: true });

    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
      this.escapeHandler = (e) => { if (e.key === "Escape") this.closeMenu(); };
      document.addEventListener("keydown", this.escapeHandler);
    }, 1);
  }

  closeMenu(event) {
    if (event && event.type === "click") {
       if (this.hasDisplayTarget && this.displayTarget.contains(event.target)) return;
       const menu = this.teleportedMenu || (this.hasMenuTarget ? this.menuTarget : null);
       if (menu && menu.contains(event.target) && !event.target.closest('[role="menuitem"]')) return;
    }

    const menu = this.teleportedMenu || (this.hasMenuTarget ? this.menuTarget : null);
    if (menu) {
      menu.classList.add("hidden");
      menu.style.display = "none";
      
      // Portal Return: Instead of .remove(), return to parent
      if (menu.parentElement === document.body) {
        this.element.appendChild(menu);
      }
    }

    if (this.cleanupAutoUpdate) {
      this.cleanupAutoUpdate();
      this.cleanupAutoUpdate = null;
    }

    this.menuOpen = false;
    this.cleanupCardState();

    document.removeEventListener("click", this.closeMenuHandler);
    if (this.escapeHandler) {
      document.removeEventListener("keydown", this.escapeHandler);
      this.escapeHandler = null;
    }
  }

  rebindMenuActions(menuElement) {
    const actionMap = {
      "task-menu#reopenTask": this.reopenTask.bind(this),
      "task-menu#completeTask": this.completeTask.bind(this),
      "task-menu#showEdit": this.showEdit.bind(this),
      "task-menu#deleteTask": this.deleteTask.bind(this)
    };

    const allItems = menuElement.querySelectorAll("[data-action]");

    allItems.forEach((item) => {
      if (item.dataset.bound === "true") return;

      const actions = item.getAttribute("data-action");
      if (!actions) return;

      Object.entries(actionMap).forEach(([actionName, handler]) => {
        if (actions.includes(actionName)) {
          item.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            handler(e);
          });
        }
      });

      item.dataset.bound = "true";
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Adaptive Portal: Kanban Stage vs Frame Card ---

  showEdit(event) {
    if (event) event.preventDefault();
    this.closeMenu();
    
    // The Edit form targets the global :modal frame, 
    // which is now handled by task_centered_controller.js
    if (this.hasDisplayTarget) this.displayTarget.style.visibility = "hidden";
    
    // Listen for the overlay closing to restore visual state
    window.addEventListener("task-overlay:closed", () => {
      if (this.hasDisplayTarget) this.displayTarget.style.visibility = "visible";
    }, { once: true });
  }

  rebindTeleportedActions(formElement) {
    // Redundant - removed in favor of global centered overlay
  }
  
  fallbackCancel() {
    this.closeMenu();
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
    // Redundant - handled by Turbo and task_centered_controller
  }

  // --- Helpers ---

  cleanupCardState() {
    this.element.style.zIndex = "";
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
