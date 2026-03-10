class CreateCampaignCategories < ActiveRecord::Migration[7.1]
  def change
    create_table :campaign_categories do |t|
      t.string :name, null: false
      t.text :value_proposition
      t.text :advantages
      t.text :restrictions

      t.timestamps
    end
  end
end
