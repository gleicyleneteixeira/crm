import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"
import { patch } from "@rails/request.js"

export default class extends Controller {
  static values = { updateUrl: String }

  connect() {
    this.sortable = Sortable.create(this.element, {
      onEnd: this.onEnd.bind(this)
    })
  }

  onEnd(event) {
    const item = event.item
    const newIndex = event.newIndex
    const oldIndex = event.oldIndex

    if (newIndex === oldIndex) {
      return
    }

    const sortedIds = this.sortable.toArray()

    patch(this.updateUrlValue, {
      body: JSON.stringify({ sorted_ids: sortedIds }),
      responseKind: "turbo-stream"
    })
      .then(response => {
        if (response.ok) {
          this.dispatch("success", { detail: { message: "Ordem atualizada com sucesso!" } });
        } else {
          this.dispatch("error", { detail: { message: "Erro ao atualizar a ordem." } });
        }
      })
      .catch(() => {
        this.dispatch("error", { detail: { message: "Erro de rede ao atualizar a ordem." } });
      });
  }
}