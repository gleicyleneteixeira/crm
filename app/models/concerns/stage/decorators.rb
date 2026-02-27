module Stage::Decorators
  include ActionView::Helpers::NumberHelper

  def total_quantity_deals_resume(filter_status_deal)
    total = total_quantity_deals(filter_status_deal)
    return total.to_s if total < 1000

    number_to_human(total, units: { thousand: 'K', million: 'M', billion: 'B' })
  end
end
