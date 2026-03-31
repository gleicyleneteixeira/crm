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
    const portal = document.getElementById('portal-root') || document.body;

    // 1. POSITIONING STRATEGY
    if (this.isMobile()) {
      // MOBILE: Portal to Root (BottomSheet)
      if (this.activeFormElement.parentElement !== portal) {
        portal.appendChild(this.activeFormElement);
      }
    } else {
      // DESKTOP: Physical Attachment (No Portal to avoid jitter)
      // Boost Z-index of the CARD itself
      this.element.style.zIndex = "2147483647";
      // Ensure form is inside card for absolute sync
      if (this.activeFormElement.parentElement !== this.element) {
        this.element.appendChild(this.activeFormElement);
      }
    }

    // 2. Event Binding (Manual)
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) {
      formElement.addEventListener('submit', this.boundSubmit);
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
  }

  updatePosition() {
    if (!this.activeFormElement || !this.formOpen) return;

    if (this.isMobile()) {
      // BOTTOM SHEET MODE (Fixed to Viewport)
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
      // ATTACHED POPOVER MODE (Absolute to Card)
      const trigger = this.triggerTarget;
      const triggerRect = trigger.getBoundingClientRect();
      const cardRect = this.element.getBoundingClientRect();
      
      // Calculate relative position to card
      const top = triggerRect.bottom - cardRect.top + 8;
      const left = triggerRect.left - cardRect.left;

      Object.assign(this.activeFormElement.style, {
        position: "absolute",
        top: `${top}px`,
        left: `${left}px`,
        width: "240px",
        bottom: "auto",
        zIndex: "2147483647",
        borderRadius: "12px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.8)"
      });
    }
  }

  close() {
    if (!this.formOpen || !this.activeFormElement) return;
    this.formOpen = false;

    // Reset Card Z-index
    this.element.style.zIndex = "";

    // Cleanup Events
    const formElement = this.activeFormElement.querySelector('form');
    if (formElement) formElement.removeEventListener('submit', this.boundSubmit);

    this.activeFormElement.classList.add("hidden");
    this.activeFormElement.style.display = "none";

    // Return to original container to preserve sequence
    if (this.activeFormElement.parentElement !== this.element) {
      this.element.appendChild(this.activeFormElement);
    }

    document.removeEventListener("click", this.clickOutsideHandler);
    document.removeEventListener("keydown", this.escHandler);
    
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
