import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      if (typeof initFlowbite === 'function') initFlowbite();
    }, 50);
  }

  disconnect() {
    if (this._debounce) clearTimeout(this._debounce);
  }
}
