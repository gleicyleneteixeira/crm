class AddAiRandomizationToCampaigns < ActiveRecord::Migration[7.1]
  def change
    add_column :campaigns, :ai_randomization, :boolean, default: false, null: false
  end
end
