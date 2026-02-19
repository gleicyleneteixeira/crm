class AddManualAmountInCentsToDeals < ActiveRecord::Migration[7.1]
  def change
    add_column :deals, :manual_amount_in_cents, :bigint, null: false, default: 0
  end
end
