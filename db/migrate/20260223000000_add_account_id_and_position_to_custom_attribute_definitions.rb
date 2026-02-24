class AddAccountIdAndPositionToCustomAttributeDefinitions < ActiveRecord::Migration[7.1]
  def change
    add_reference :custom_attribute_definitions, :account, null: false, foreign_key: true
    add_column :custom_attribute_definitions, :position, :integer
  end
end