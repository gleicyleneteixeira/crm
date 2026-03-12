class AddManagerFieldsToCampaigns < ActiveRecord::Migration[7.0]
  def change
    add_column :campaigns, :total_leads, :integer
    add_column :campaigns, :processed_leads, :integer, default: 0
    add_column :campaigns, :current_index, :integer, default: 0
    add_column :campaigns, :start_date, :datetime
    add_column :campaigns, :end_date, :datetime
    add_column :campaigns, :prompt_a_id, :bigint
    add_column :campaigns, :prompt_b_id, :bigint
  end
end
