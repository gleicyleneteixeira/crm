import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["form", "scheduleType", "scheduleConfig"];

  connect() {
    this.initScheduleToggle();
  }

  initScheduleToggle() {
    if (this.hasScheduleTypeTarget) {
      this.scheduleTypeTarget.addEventListener("change", () => {
        this.toggleScheduleConfig();
      });
      this.toggleScheduleConfig();
    }
  }

  toggleScheduleConfig() {
    if (!this.hasScheduleConfigTarget) return;
    
    const selectedType = this.scheduleTypeTarget.value;
    const configElements = this.scheduleConfigTarget.querySelectorAll("[data-schedule-config]");
    
    configElements.forEach((el) => {
      if (el.dataset.scheduleConfig === selectedType) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
  }
}
