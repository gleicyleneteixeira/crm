import { Controller } from "@hotwired/stimulus";
import Sortable from "sortablejs";
import Rails from "@rails/ujs";
import * as Turbo from "@hotwired/turbo";

export default class extends Controller {
  connect() {
    this.sort();
  }

  sort() {
    this.sortable = Sortable.create(this.element, {
      animation: 150,
      sort: true,
      group: "pipeline",
      handle: ".drag-handle",
      onStart: () => {
        document.body.classList.add("is-dragging");
      },
      onEnd: this.end.bind(this),
      forceFallback: true,
      fallbackOnBody: true,
    });
  }

  async end(event) {
    const dealId = event.item.dataset.id;
    const accountId = event.item.dataset.accountId;

    const handled = this.handleDropZone(event, { dealId, accountId });
    document.body.classList.remove("is-dragging");

    if (handled) {
      const fromList = document.querySelector(`ul[data-id="${event.from.dataset.id}"]`);
      if (fromList && event.item) {
        fromList.insertBefore(event.item, fromList.firstChild);
      }
      return;
    }

    const toStageId = event.to.dataset.id;
    const newPosition = new Position(event).getNewPosition();
    const fromStageId = event.from.dataset.id;
    let data = new FormData();
    data.append("deal[position]", newPosition);
    data.append("deal[stage_id]", toStageId);
    Rails.ajax({
      url: this.data
        .get("url")
        .replace(":deal_id", dealId)
        .replace(":account_id", accountId),
      type: "PATCH",
      data: data,
      beforeSend: (xhr) => {
        xhr.setRequestHeader("Accept", "text/vnd.turbo-stream.html");
        return true;
      },
      success: (response) => {
        Turbo.renderStreamMessage(response);
      },
      error: (response) => {
        Turbo.renderStreamMessage(response);
        const fromList = document.querySelector(`ul[data-id="${fromStageId}"]`);
        if (fromList && event.item) {
          fromList.insertBefore(event.item, fromList.firstChild);
        }
      },
    });
  }

  handleDropZone(event, { dealId, accountId }) {
    const originalEvent = event.originalEvent || event.event;

    if (!originalEvent || typeof originalEvent.clientX !== "number" || typeof originalEvent.clientY !== "number") {
      return false;
    }

    let zone = null;

    if (document.elementsFromPoint) {
      const elements = document.elementsFromPoint(originalEvent.clientX, originalEvent.clientY);

      for (const element of elements) {
        const candidate = element.closest("[data-drop-zone]");

        if (candidate) {
          zone = candidate;
          break;
        }
      }
    } else {
      const element = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY);

      if (element) {
        zone = element.closest("[data-drop-zone]");
      }
    }

    if (!zone) {
      return false;
    }

    const type = zone.dataset.dropZone;

    if (type === "won") {
      this.openModal(`/accounts/${accountId}/deals/${dealId}/mark_as_won`);
      return true;
    }

    if (type === "lost") {
      this.openModal(`/accounts/${accountId}/deals/${dealId}/mark_as_lost`);
      return true;
    }

    if (type === "delete") {
      const confirmed = window.confirm("Tem certeza que deseja excluir este negócio?");

      if (!confirmed) {
        return true;
      }

      Rails.ajax({
        url: `/accounts/${accountId}/deals/${dealId}`,
        type: "DELETE",
        beforeSend: (xhr) => {
          xhr.setRequestHeader("Accept", "text/vnd.turbo-stream.html");
          return true;
        },
        success: (response) => {
          Turbo.renderStreamMessage(response);
        },
        error: (response) => {
          Turbo.renderStreamMessage(response);
        },
      });

      return true;
    }

    return false;
  }

  openModal(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.dataset.turboFrame = "modal";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  disableDrag() {
    this.sortable.option("disabled", true);
  }

  enableDrag() {
    this.sortable.option("disabled", false);
  }
}

class Position {
  constructor(event) {
    this.event = event;
    this.previousElement = event.item.previousElementSibling || null;
    this.nextElement = event.item.nextElementSibling || null;
  }
  getNewPosition() {
    if (this.isMovedBetweenStages) {
      return this.positionForNewStage();
    } else {
      return this.positionInCurrentStage();
    }
  }
  get isMovedBetweenStages() {
    return this.event.from !== this.event.to;
  }
  get movementDirection() {
    const { oldIndex: startIndex, newIndex: endIndex } = this.event;
    return endIndex > startIndex ? "down" : "up";
  }
  get previousElementPosition() {
    return parseInt(this.previousElement.dataset.position, 10);
  }
  get nextElementPosition() {
    return parseInt(this.nextElement.dataset.position, 10);
  }
  get quantityElementsPassed() {
    return Math.abs(this.event.oldIndex - this.event.newIndex);
  }
  get elementCurrentPosition() {
    return parseInt(this.event.item.dataset.position, 10);
  }

  positionForNewStage() {
    // When moving to a new stage, calculate position based on neighbors
    if (this.nextElement) {
      // If there's a next element, position before it
      return this.nextElementPosition - 1;
    }
    if (this.previousElement) {
      // If there's a previous element but no next, position after it
      return this.previousElementPosition + 1;
    }

    // If moving to empty stage, position at 1
    return 1;
  }
  positionInCurrentStage() {
    if (this.quantityElementsPassed === 0) return this.elementCurrentPosition;
    return this.movementDirection === "up"
      ? this.nextElementPosition
      : this.previousElementPosition;
  }
}
