import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["sidebar", "content"];
  connect() {
    if (this.hasSidebarTarget && localStorage.getItem("sidebar_expanded")) {
      this.setAriaExpanded(localStorage.getItem("sidebar_expanded"));
    }
  }
  toggle() {
    const element = this.hasContentTarget ? this.contentTarget : this.element;
    const expanded = element.getAttribute("aria-expanded") === "true";
    const newState = !expanded;
    
    element.setAttribute("aria-expanded", newState);

    if (this.hasSidebarTarget) {
      this.setLocalStorageSidebarExpanded(newState);
    }
  }
  setLocalStorageSidebarExpanded(value) {
    localStorage.setItem("sidebar_expanded", value);
    this.setAriaExpanded(value);
  }
  setAriaExpanded(value) {
    this.element.setAttribute("aria-expanded", value);
  }
}
