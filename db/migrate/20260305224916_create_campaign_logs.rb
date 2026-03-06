class CreateCampaignLogs < ActiveRecord::Migration[7.0]
  def change
    create_table :campaign_logs do |t|
      t.references :campaign, null: false, foreign_key: true
      t.references :contact, foreign_key: true
      t.references :deal, foreign_key: true
      t.string :status, null: false
      t.text :message
      t.jsonb :metadata, default: {}

      t.timestamps
    end
  end
end
