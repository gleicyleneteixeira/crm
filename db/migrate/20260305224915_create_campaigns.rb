class CreateCampaigns < ActiveRecord::Migration[7.0]
  def change
    create_table :campaigns do |t|
      t.references :account, null: false, foreign_key: true
      t.string :name, null: false
      t.string :status, default: 'draft', null: false
      t.jsonb :spreadsheet_data, default: []
      t.jsonb :mapping, default: {}
      t.jsonb :chatwoot_inbox_ids, default: []
      t.jsonb :message_sequence, default: []
      t.references :pipeline, foreign_key: true
      t.references :stage, foreign_key: true
      t.integer :batch_delay, default: 0

      t.timestamps
    end
  end
end
