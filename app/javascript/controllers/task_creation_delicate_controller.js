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
    this.boundPositionUpdate = this.updatePosition.bind(this);
    this.activeFormElement = null;
  }

  disconnect() {
    this.close();
  }

  toggle(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.formOpen ? this.close() : this.open();
  }

  isMobile() {
    return window.innerWidth <= 768;
  }

  open() {
    if (this.formOpen) return;
    this.formOpen = true;

    // Capture references
    this.activeFormElement = this.formTarget;
    const trigger = this.triggerTarget;
    const portal = document.getElementById('portal-root') || document.body;

    // 1. Portal Move
    if (this.activeFormElement.parentElement !== portal) {
      portal.appendChild(this.activeFormElement);
    }

    // 2. Event Binding (Manual)
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) {
      formElement.addEventListener('submit', this.boundSubmit);
      // Ensure all internal clicks don't propagate to triggers
      this.activeFormElement.addEventListener('click', (e) => e.stopPropagation());
    }

    // 3. Initial Position & Display
    this.activeFormElement.classList.remove("hidden");
    this.activeFormElement.style.display = "block";
    this.updatePosition();

    // 4. Input Focus
    const input = this.activeFormElement.querySelector('input[type="text"]');
    if (input) setTimeout(() => input.focus(), 50);

    // 5. Global Listeners
    this.clickOutsideHandler = (e) => {
      if (this.activeFormElement && !this.activeFormElement.contains(e.target) && !this.element.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener("click", this.clickOutsideHandler);
    
    this.escHandler = (e) => {
      if (e.key === "Escape") this.close();
    };
    document.addEventListener("keydown", this.escHandler);

    // 6. Scroll tracking for Desktop
    if (!this.isMobile()) {
      window.addEventListener("scroll", this.boundPositionUpdate, true); // capture phase
      window.addEventListener("resize", this.boundPositionUpdate);
    }
  }

  updatePosition() {
    if (!this.activeFormElement || !this.formOpen) return;

    if (this.isMobile()) {
      // BOTTOM SHEET MODE
      Object.assign(this.activeFormElement.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        width: "100%",
        top: "auto",
        transform: "none",
        zIndex: "2147483647",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.5)"
      });
    } else {
      // ANCHORED POPOVER MODE
      const trigger = this.triggerTarget;
      const rect = trigger.getBoundingClientRect();
      const formWidth = 240;
      
      // Calculate best fit (default below, if too low then above)
      let top = rect.bottom + 8;
      if (top + 200 > window.innerHeight) {
        top = rect.top - 200 - 8;
      }

      Object.assign(this.activeFormElement.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${rect.left}px`,
        width: `${formWidth}px`,
        bottom: "auto",
        zIndex: "2147483647",
        borderRadius: "12px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
      });
    }
  }

  close() {
    if (!this.formOpen || !this.activeFormElement) return;
    this.formOpen = false;

    // Cleanup Events
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) formElement.removeEventListener('submit', this.boundSubmit);

    this.activeFormElement.classList.add("hidden");
    this.activeFormElement.style.display = "none";

    // Return to original parent to preserve stimulus connection
    if (this.activeFormElement.parentElement !== this.element) {
      this.element.appendChild(this.activeFormElement);
    }

    document.removeEventListener("click", this.clickOutsideHandler);
    document.removeEventListener("keydown", this.escHandler);
    window.removeEventListener("scroll", this.boundPositionUpdate, true);
    window.removeEventListener("resize", this.boundPositionUpdate);
    
    this.activeFormElement = null;
  }

  async submit(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!this.activeFormElement) return;
    
    const formElement = this.activeFormElement.querySelector('form');
    if (!formElement) return;

    // Mark loading state
    const submitBtn = formElement.querySelector('input[type="submit"], button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.originalText = submitBtn.value || submitBtn.textContent;
      if (submitBtn.tagName === 'INPUT') submitBtn.value = "Salvando...";
      else submitBtn.textContent = "Salvando...";
    }

    const formData = new FormData(formElement);
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

    try {
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers: { 
          "X-CSRF-Token": csrfToken, 
          "Accept": "text/vnd.turbo-stream.html" 
        },
        body: formData
      });

      if (response.ok) {
        const stream = await response.text();
        Turbo.renderStreamMessage(stream);
        
        formElement.reset();
        this.close();
      } else {
        console.error("Submission failed");
        // Re-enable button on error
        if (submitBtn) {
          submitBtn.disabled = false;
          if (submitBtn.tagName === 'INPUT') submitBtn.value = submitBtn.originalText;
          else submitBtn.textContent = submitBtn.originalText;
        }
      }
    } catch (error) {
      console.error("Error creating task:", error);
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtn.tagName === 'INPUT') submitBtn.value = submitBtn.originalText;
        else submitBtn.textContent = submitBtn.originalText;
      }
    }
  }
}
