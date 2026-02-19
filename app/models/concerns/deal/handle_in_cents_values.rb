module Deal::HandleInCentsValues
  extend ActiveSupport::Concern
  included do
    def manual_amount_in_cents=(amount)
      amount = sanitize_amount(amount)
      super(amount)
    end
  end
end
