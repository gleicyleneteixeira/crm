class AddSchedulingToCampaigns < ActiveRecord::Migration[7.1]
  def change
    add_column :campaigns, :allowed_days, :jsonb, default: []
    add_column :campaigns, :start_hour, :string, default: "00:00"
    add_column :campaigns, :end_hour, :string, default: "23:59"
  end
end
