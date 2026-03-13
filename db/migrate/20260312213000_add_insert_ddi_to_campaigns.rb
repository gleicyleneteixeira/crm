class AddInsertDdiToCampaigns < ActiveRecord::Migration[7.0]
  def change
    add_column :campaigns, :insert_ddi, :boolean, default: false
  end
end
