import { Controller } from "@hotwired/stimulus";
import moment from "moment-timezone";
import "moment/min/locales";
import "moment/dist/locale/es";
import "moment/dist/locale/pt-br";
import {
  getBrowserLocale,
  getBrowserTimeZone,
  getUserLocale,
} from "../../utils/locale";

export default class extends Controller {
  static values = {
    date: String,
    type: String,
  };

  connect() {
    this.refresh();
    this.timer = setInterval(() => {
      this.refresh();
    }, 10000); // 10 seconds
  }

  disconnect() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  refresh() {
    const date = this.dateInTimezone;
    this.setMomentJsLocale();
    this.element.textContent = this.formattedDate(date);
    this.updateClasses(date);
  }

  updateClasses(date) {
    if (this.typeValue !== "distance") return;

    const isOverdue = date.isBefore(moment());

    // Support for the specific classes used in the Kanban deal card
    const container = this.element.closest('.rounded-full.border');
    if (container) {
      if (isOverdue) {
        container.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/40');
        container.classList.remove('bg-amber-500/10', 'text-amber-300', 'border-amber-500/40', 'bg-sky-500/10', 'text-sky-300', 'border-sky-500/40');
      } else if (date.isSame(moment(), 'day')) {
        container.classList.add('bg-amber-500/10', 'text-amber-300', 'border-amber-500/40');
        container.classList.remove('bg-red-500/10', 'text-red-400', 'border-red-500/40', 'bg-sky-500/10', 'text-sky-300', 'border-sky-500/40');
      }
    }

    // Support for the classes in _deal_event partial
    const innerContainer = this.element.closest('.inline-flex.gap-1.items-center');
    if (innerContainer) {
      if (isOverdue) {
        innerContainer.classList.add('color-fg-feedback-danger');
        innerContainer.classList.remove('color-fg-feedback-success');
      } else {
        innerContainer.classList.add('color-fg-feedback-success');
        innerContainer.classList.remove('color-fg-feedback-danger');
      }
    }
  }

  get dateInTimezone() {

    return moment(this.dateValue).tz(getBrowserTimeZone());
  }

  formattedDate(date) {
    switch (this.typeValue) {
      case "short":
        return date.format("DD/MM/YY HH:mm");
      case "distance":
        return date.fromNow(true);
      case "compact":
        return date.format("DD MMM HH:mm");
      default:
        return date.format("LLL");
    }
  }

  get locale() {
    return (
      getUserLocale().trim() !== "" ? getUserLocale() : getBrowserLocale()
    )
      .toLowerCase()
      .replace("_", "-");
  }

  setMomentJsLocale() {
    const supportedLocales = ["pt-br", "es", "en"];
    moment.locale(supportedLocales.includes(this.locale) ? this.locale : "en");
  }
}
