class AddCampaignCategoryToCampaigns < ActiveRecord::Migration[7.1]
  def change
    add_reference :campaigns, :campaign_category, null: true, foreign_key: true
  end
end
