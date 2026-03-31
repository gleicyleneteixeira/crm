import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["editForm", "input", "menu"];
  static values = {
    eventId: String
  };

  connect() {
    this.closeMenuHandler = (e) => {
      if (this.hasMenuTarget && !this.menuTarget.contains(e.target) && !this.element.contains(e.target)) {
        this.closeMenu();
      }
    };
  }

  disconnect() {
    this.closeAllMenus();
    document.removeEventListener("click", this.closeMenuHandler);
  }

  // --- Visual Toggle Only ---
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
        this.openMenu(event);
      }
    }
  }

  openMenu(event) {
    if (!this.hasMenuTarget) return;
    const menu = this.menuTarget;
    const trigger = event.currentTarget;
    const rect = trigger.getBoundingClientRect();
    
    this.element.style.zIndex = "2147483647"; 
    
    Object.assign(menu.style, {
      display: "block",
      position: "fixed",
      top: `${rect.bottom + 5}px`,
      left: `${rect.left}px`,
      width: "180px",
      zIndex: "2147483647",
      pointerEvents: "auto"
    });

    menu.classList.remove("hidden");
    document.addEventListener("click", this.closeMenuHandler);
  }

  closeMenu() {
    if (!this.hasMenuTarget) return;
    this.menuTarget.classList.add("hidden");
    this.menuTarget.style.display = "none";
    this.element.style.zIndex = "";
    document.removeEventListener("click", this.closeMenuHandler);
  }

  closeAllMenus() {
    this.closeMenu();
    this.cancelEdit();
  }

  // --- Inline Edit Toggle ---
  showEdit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.closeMenu();
    
    const form = this.editFormTarget;
    const rect = this.element.getBoundingClientRect();
    
    Object.assign(form.style, {
      display: "block",
      position: "fixed",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: "auto",
      zIndex: "2147483647",
      pointerEvents: "auto"
    });

    form.classList.remove("hidden");
    const input = form.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 50);
  }

  cancelEdit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.hasEditFormTarget) {
      this.editFormTarget.classList.add("hidden");
      this.editFormTarget.style.display = "none";
    }
    this.element.style.zIndex = "";
  }

  submitEdit(event) {
    // Standard Turbo submit: Just visual cleanup
    this.cancelEdit();
  }
}
