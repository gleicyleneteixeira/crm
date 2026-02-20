import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["input"];
  static values = {
    updateUrl: String,
    modelKey: String,
  };

  connect() {
    this.submitting = false;
  }

  async submit() {
    if (!this.hasInputTarget) return;
    if (this.submitting) return;

    const value = this.inputTarget.value;

    const formData = new FormData();
    formData.append(`${this.modelKeyValue}[stage_id]`, value);

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

      Turbo.renderStreamMessage(responseText);
    } catch (error) {
      this.inputTarget.focus();
    } finally {
      this.submitting = false;
      this.inputTarget.classList.remove("opacity-60");
      this.inputTarget.disabled = false;
    }
  }
}
