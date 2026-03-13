class AddAutomationFieldsToCampaigns < ActiveRecord::Migration[7.0]
  def change
    add_column :campaigns, :human_intervention_lock, :boolean, default: false
    add_column :campaigns, :stop_words, :text
    add_column :campaigns, :failover_inbox_id, :integer
    add_column :campaigns, :warmup_enabled, :boolean, default: false
    add_column :campaigns, :warmup_initial_volume, :integer, default: 50
    add_column :campaigns, :warmup_daily_increment, :integer, default: 100
    add_column :campaigns, :roi_conversion_value, :decimal, precision: 10, scale: 2, default: 0.0
  end
end
