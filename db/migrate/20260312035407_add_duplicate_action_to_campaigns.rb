class AddDuplicateActionToCampaigns < ActiveRecord::Migration[7.0]
  def change
    add_column :campaigns, :duplicate_action, :string, default: 'update'
  end
end
