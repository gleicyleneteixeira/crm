class AddPriorityLevelToDeals < ActiveRecord::Migration[7.1]
  def change
    add_column :deals, :priority_level, :integer, null: false, default: 0
  end
end

