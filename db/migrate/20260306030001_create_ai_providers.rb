class CreateAiProviders < ActiveRecord::Migration[7.1]
  def change
    create_table :ai_providers do |t|
      t.string :name, null: false
      t.string :provider_type, null: false
      t.string :api_key, null: false
      t.string :model_name, null: false
      t.boolean :active, default: true, null: false
      t.integer :usage_count, default: 0, null: false
      t.datetime :cooldown_until
      t.text :last_error
      t.references :account, null: false, foreign_key: true

      t.timestamps
    end
  end
end
