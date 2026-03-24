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

    // Handle paste specifically to clean input
    this.element.addEventListener("paste", (e) => {
      e.preventDefault();
      let pasteData = (e.clipboardData || window.clipboardData).getData("text");
      
      // Clean: Remove any non-digits except comma and dot
      // If both dots and comma are present, treat dot as thousand separator
      if (pasteData.includes(".") && pasteData.includes(",")) {
        pasteData = pasteData.replace(/\./g, "");
      }
      
      // Map dots to commas if no comma is present (common in US format paste)
      if (pasteData.includes(".") && !pasteData.includes(",")) {
        // Simple heuristic: if only 2 digits after dot, it's likely decimal
        const parts = pasteData.split(".");
        if (parts[parts.length - 1].length === 2) {
          pasteData = pasteData.replace(".", ",");
        } else {
          pasteData = pasteData.replace(/\./g, "");
        }
      }

      // Convert to a format IMask Number mask understands (digits + dot as internal radix)
      const cleanValue = pasteData.replace(/[^\d,]/g, "").replace(",", ".");
      this.mask.typedValue = cleanValue;
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
