import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["contactSelect", "contactId"];

  connect() {
    this.initSelect2();
  }

  disconnect() {
    if (this.select2Instance) {
      this.select2Instance.destroy();
    }
  }

  initSelect2() {
    if (typeof $ === "undefined" || !$.fn.select2) {
      setTimeout(() => this.initSelect2(), 100);
      return;
    }

    const element = $(this.contactSelectTarget);
    this.select2Instance = element.select2({
      ajax: {
        url: this.element.dataset.newDealSearchUrl || "/accounts/" + this.getAccountId() + "/contacts/search",
        dataType: "json",
        delay: 250,
        data: (params) => ({
          q: params.term,
        }),
        processResults: (data) => ({
          results: data,
        }),
      },
      minimumInputLength: 1,
      placeholder: "Buscar contato...",
      allowClear: true,
    });

    this.select2Instance.on("select2:select", (e) => {
      this.contactIdTarget.value = e.params.data.id;
    });
  }

  getAccountId() {
    const meta = document.querySelector('meta[name="account-id"]');
    return meta ? meta.content : null;
  }
}
