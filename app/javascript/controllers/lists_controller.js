import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["lists"];

  connect() {
    // Kanban lists container - drag functionality is handled by drag_controller
  }
}
