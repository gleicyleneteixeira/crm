import { Controller } from "@hotwired/stimulus";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  static targets = ["form", "input", "trigger"];
  static values = {
    url: String
  };

  connect() {
    this.formOpen = false;
    this.boundSubmit = this.submit.bind(this);
    this.activeFormElement = null;
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

    // Capture the element REFERENCE before stimulus targets stop working after portal
    this.activeFormElement = this.formTarget;
    const trigger = this.triggerTarget;

    // Portal to body for zero-clipping and zero-layout-shift
    if (this.activeFormElement.parentElement !== document.body) {
      document.body.appendChild(this.activeFormElement);
    }

    // MANUALLY BIND SUBMIT: Because the portal move breaks standard Stimulus actions
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) formElement.addEventListener('submit', this.boundSubmit);

    const rect = trigger.getBoundingClientRect();
    Object.assign(this.activeFormElement.style, {
      display: "block",
      position: "fixed",
      top: `${rect.bottom + 5}px`, // Just below the trigger
      left: `${rect.left}px`,
      width: "240px",
      zIndex: "2147483647",
      pointerEvents: "auto"
    });

    this.activeFormElement.classList.remove("hidden");
    
    const input = this.activeFormElement.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 50);

    // Click outside handler
    this.clickOutsideHandler = (e) => {
      if (this.activeFormElement && !this.activeFormElement.contains(e.target) && !this.element.contains(e.target)) {
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
    if (!this.formOpen || !this.activeFormElement) return;
    this.formOpen = false;

    // CLEANUP SUBMIT BINDING
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) formElement.removeEventListener('submit', this.boundSubmit);

    this.activeFormElement.classList.add("hidden");
    this.activeFormElement.style.display = "none";

    // Return to trigger parent to preserve connection
    if (this.activeFormElement.parentElement !== this.element) {
      this.element.appendChild(this.activeFormElement);
    }

    document.removeEventListener("click", this.clickOutsideHandler);
    document.removeEventListener("keydown", this.escHandler);
    this.activeFormElement = null;
  }

  async submit(event) {
    if (event) event.preventDefault();
    if (!this.activeFormElement) return;
    
    const formElement = this.activeFormElement.querySelector('form');
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
