import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["display", "input"];
  static values = {
    updateUrl: String,
    modelKey: String,
    attributeName: String,
    nestedKey: String,
  };

  connect() {
    this.submitting = false;
    this.originalValue = null;
  }

  activate(event) {
    event.preventDefault();
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    this.originalValue = this.inputTarget.value;
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
    if (this.originalValue !== null) {
      this.inputTarget.value = this.originalValue;
    }
    this.inputTarget.classList.add("hidden");
    this.displayTarget.classList.remove("hidden");
  }

  async submit() {
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    if (this.submitting) return;

    const value = this.inputTarget.value;

    const formData = new FormData();
    const paramName = this.buildParamName();
    formData.append(paramName, value);

    const csrfTokenElement = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfTokenElement ? csrfTokenElement.getAttribute("content") : null;

    this.submitting = true;
    this.inputTarget.classList.add("opacity-60");
    this.inputTarget.disabled = true;

    try {
      const response = await fetch(this.updateUrlValue, {
        method: "PATCH",
        headers: csrfToken
          ? {
              "X-CSRF-Token": csrfToken,
              Accept: "text/vnd.turbo-stream.html, text/html, application/json",
            }
          : {
              Accept: "text/vnd.turbo-stream.html, text/html, application/json",
            },
        body: formData,
      });

      const responseText = await response.text();
      if (response.ok) {
        Turbo.renderStreamMessage(responseText);
      } else {
        Turbo.renderStreamMessage(responseText);
        this.inputTarget.focus();
        this.inputTarget.select();
      }
    } catch (error) {
      this.inputTarget.focus();
      this.inputTarget.select();
    } finally {
      this.submitting = false;
      this.inputTarget.classList.remove("opacity-60");
      this.inputTarget.disabled = false;
    }
  }

  buildParamName() {
    const modelKey = this.modelKeyValue;
    const attribute = this.attributeNameValue;

    if (this.hasNestedKeyValue) {
      return `${modelKey}[${attribute}][${this.nestedKeyValue}]`;
    }

    return `${modelKey}[${attribute}]`;
  }
}
