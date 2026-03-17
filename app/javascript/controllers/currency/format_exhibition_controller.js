import { Controller } from "@hotwired/stimulus";
import { getAccountCurrency } from "../../utils/locale";

export default class extends Controller {
  static values = {
    amountInCents: Number,
  };

  connect() {
    this.element.textContent = this.formatCurrency(
      this.amountInCentsValue,
      getAccountCurrency()
    );

    // Adiciona estilização de badge APENAS após carregar o conteúdo, evitando o "risquinho verde" (Option A)
    const badgeContainer = this.element.closest('[data-as-badge="true"]');
    if (badgeContainer) {
      badgeContainer.classList.add('bg-emerald-500/15', 'text-emerald-600', 'border', 'border-emerald-500/40');
      badgeContainer.classList.remove('opacity-0'); // Garante que fique invisível se começarmos com opacity-0
    }
  }

  formatCurrency(amountInCents, currencyCode) {
    const value = amountInCents / 100.0;

    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
