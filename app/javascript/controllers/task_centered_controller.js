import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["overlay", "backdrop", "frame"];

  connect() {
    this.closeHandler = this.closeIfOutside.bind(this);
    this.keyHandler = (e) => { if (e.key === "Escape") this.close(); };
  }

  disconnect() {
    this.cleanup();
  }

  // --- ACTIONS ---

  // Triggered via turbo:frame-load on the modal frame
  show(event) {
    if (this.hasFrameTarget && this.frameTarget.src === "") {
      this.close();
      return;
    }

    this.overlayTarget.classList.add("active");
    this.overlayTarget.style.display = "flex";
    this.backdropTarget.classList.add("active");
    this.backdropTarget.style.display = "block";

    // Global Listeners - immediate execution for faster response
    document.addEventListener("click", this.closeHandler);
    document.addEventListener("keydown", this.keyHandler);
    if (window.lucide) window.lucide.createIcons();

    this.prepareForm();
  }

  prepareForm() {
    const frame = this.frameTarget;
    
    // Autofocus - use requestAnimationFrame for smoother focus
    const input = frame.querySelector('input[type="text"], textarea');
    if (input) {
      requestAnimationFrame(() => input.focus());
    }

    // Submission Handling
    const form = frame.querySelector('form');
    if (form) {
      form.addEventListener("turbo:submit-end", (e) => {
        if (e.detail.success) this.close();
      });
    }

    // Cancel Buttons
    frame.querySelectorAll('.btn-secondary, [data-action*="close"]').forEach(btn => {
      if (btn.textContent.trim().toLowerCase() === 'cancelar' || btn.textContent.trim().toLowerCase() === 'cancel') {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.close();
        });
      }
    });
  }

  closeIfOutside(event) {
    // If clicking on the backdrop
    if (event.target === this.backdropTarget) {
      this.close();
    }
  }

  close() {
    if (this.hasOverlayTarget) {
      this.overlayTarget.classList.remove("active");
      this.overlayTarget.style.display = "none";
    }
    if (this.hasBackdropTarget) {
      this.backdropTarget.classList.remove("active");
      this.backdropTarget.style.display = "none";
    }
    
    this.cleanup();
    
    // Reset frame to avoid showing old data - use more efficient cleanup
    if (this.hasFrameTarget) {
      // Only clear innerHTML if frame will not be reused immediately
      // This prevents full DOM teardown when reopening quickly
      if (!this.frameTarget.src || this.frameTarget.src === "") {
        this.frameTarget.innerHTML = "";
      }
    }

    // Senior Sync: notify other controllers that we are closed 
    // (e.g. to restore clock icon visibility)
    window.dispatchEvent(new CustomEvent("task-overlay:closed"));
  }

  cleanup() {
    document.removeEventListener("click", this.closeHandler);
    document.removeEventListener("keydown", this.keyHandler);
  }
}
