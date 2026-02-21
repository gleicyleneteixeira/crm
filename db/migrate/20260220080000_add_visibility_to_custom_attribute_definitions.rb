class AddVisibilityToCustomAttributeDefinitions < ActiveRecord::Migration[6.1]
  def change
    add_column :custom_attribute_definitions, :show_in_deal, :boolean, default: true, null: false
    add_column :custom_attribute_definitions, :show_in_card, :boolean, default: false, null: false
  end
end

