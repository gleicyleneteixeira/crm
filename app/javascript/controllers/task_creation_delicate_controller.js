import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["form", "input", "trigger"];
  static values = {
    url: String
  };

  connect() {
    this.formOpen = false;
  }

  toggle(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.formOpen ? this.close() : this.open();
  }

  open() {
    if (this.formOpen) return;
    this.formOpen = true;

    const form = this.formTarget;
    const trigger = this.triggerTarget;

    // Portal to body for zero-clipping and zero-layout-shift
    if (form.parentElement !== document.body) {
      document.body.appendChild(form);
    }

    const rect = trigger.getBoundingClientRect();
    Object.assign(form.style, {
      display: "block",
      position: "fixed",
      top: `${rect.bottom + 5}px`, // Just below the trigger
      left: `${rect.left}px`,
      width: "240px",
      zIndex: "2147483647",
      pointerEvents: "auto"
    });

    form.classList.remove("hidden");
    
    const input = form.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 50);

    // Click outside handler
    this.clickOutsideHandler = (e) => {
      if (form && !form.contains(e.target) && !this.element.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);

    // Esc handler
    this.escHandler = (e) => {
      if (e.key === "Escape") this.close();
    };
    document.addEventListener("keydown", this.escHandler);
  }

  close() {
    if (!this.formOpen) return;
    this.formOpen = false;

    const form = this.formTarget;
    form.classList.add("hidden");
    form.style.display = "none";

    // Return to trigger parent to preserve connection
    if (form.parentElement !== this.element) {
      this.element.appendChild(form);
    }

    document.removeEventListener("click", this.clickOutsideHandler);
    document.removeEventListener("keydown", this.escHandler);
  }

  async submit(event) {
    if (event) event.preventDefault();
    const formElement = this.formTarget.querySelector('form');
    if (!formElement) return;

    const formData = new FormData(formElement);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

    try {
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken, "Accept": "text/vnd.turbo-stream.html" },
        body: formData
      });

      if (response.ok) {
        const stream = await response.text();
        Turbo.renderStreamMessage(stream);
        
        // Clear and close
        formElement.reset();
        this.close();
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  }
}
