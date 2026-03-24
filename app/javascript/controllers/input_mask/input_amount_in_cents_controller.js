import { Controller } from "@hotwired/stimulus";
import IMask from "imask";

export default class extends Controller {
  connect() {
    this.formatExhibitionNumberField();
    this.configMaskField();
    this.prepareSubmit();
  }

  configMaskField() {
    this.mask = IMask(this.element, {
      mask: Number,
      scale: 2,
      signed: false,
      thousandsSeparator: ".",
      padFractionalZeros: true,
      normalizeZeros: true,
      radix: ",",
      mapToRadix: ["."],
    });
  }

  formatExhibitionNumberField() {
    const value = this.element.value;
    if (value && !isNaN(value)) {
      this.element.value = this.formatToCurrencyNumber(value);
    }
  }

  formatToCurrencyNumber(amount) {
    const numericValue = parseFloat(amount) / 100;
    if (isNaN(numericValue)) return "0,00";

    return numericValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  prepareSubmit() {
    // IMask updates the value in real-time. 
    // The backend sanitize_amount will handle stripping characters.
  }
}
