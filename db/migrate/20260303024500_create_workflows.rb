class CreateWorkflows < ActiveRecord::Migration[7.1]
  def change
    create_table :workflows do |t|
      t.string :title, null: false
      t.string :trigger_type, null: false
      t.string :action_type, null: false
      t.jsonb :data, default: {}, null: false
      t.boolean :active, default: true, null: false
      t.bigint :account_id # Keeping for multi-tenancy as requested

      t.timestamps
    end

    add_index :workflows, :trigger_type
    add_index :workflows, :active
    add_index :workflows, :account_id
  end
end
