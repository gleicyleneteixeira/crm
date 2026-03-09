class CreateAiPrompts < ActiveRecord::Migration[7.1]
  def change
    create_table :ai_prompts do |t|
      t.string :context, null: false
      t.text :instruction, null: false
      t.references :account, null: false, foreign_key: true

      t.timestamps
    end
    add_index :ai_prompts, [:account_id, :context], unique: true
  end
end
