import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["display", "input"];
  static values = {
    updateUrl: String,
    modelKey: String,
    attributeName: String,
  };

  activate(event) {
    event.preventDefault();
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    this.displayTarget.classList.add("hidden");
    this.inputTarget.classList.remove("hidden");
    this.inputTarget.focus();
    this.inputTarget.select();
  }

  handleKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.cancel();
    }
  }

  cancel() {
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    this.inputTarget.classList.add("hidden");
    this.displayTarget.classList.remove("hidden");
  }

  async submit() {
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    const value = this.inputTarget.value;

    const formData = new FormData();
    formData.append(`${this.modelKeyValue}[${this.attributeNameValue}]`, value);

    const csrfTokenElement = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfTokenElement ? csrfTokenElement.getAttribute("content") : null;

    try {
      await fetch(this.updateUrlValue, {
        method: "PATCH",
        headers: csrfToken
          ? {
              "X-CSRF-Token": csrfToken,
            }
          : {},
        body: formData,
      });

      this.displayTarget.textContent = value;
    } catch (error) {
    }

    this.inputTarget.classList.add("hidden");
    this.displayTarget.classList.remove("hidden");
  }
}

