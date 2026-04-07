class AddLogisticsFieldsToCampaigns < ActiveRecord::Migration[7.0]
  def change
    add_column :campaigns, :inbox_rotation_rule, :string, default: 'random'
    add_column :campaigns, :max_delay, :integer, default: 60
  end
end
