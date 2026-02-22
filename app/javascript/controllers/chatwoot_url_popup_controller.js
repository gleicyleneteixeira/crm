import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["input"];

  connect() {
    this.toggleHandler = this.toggleHandler || this.handleToggle.bind(this);
    this.element.addEventListener("toggle", this.toggleHandler);
  }

  disconnect() {
    if (this.toggleHandler) {
      this.element.removeEventListener("toggle", this.toggleHandler);
    }
  }

  handleToggle() {
    if (!this.element.open || !this.hasInputTarget) return;

    requestAnimationFrame(() => {
      this.inputTarget.focus();
      this.inputTarget.select();
    });
  }
}

