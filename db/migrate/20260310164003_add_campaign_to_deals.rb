class AddCampaignToDeals < ActiveRecord::Migration[7.1]
  def change
    add_reference :deals, :campaign, null: true, foreign_key: true
  end
end
