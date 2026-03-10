class AddDefaultPipelineToCampaignCategories < ActiveRecord::Migration[7.1]
  def change
    add_reference :campaign_categories, :default_pipeline, foreign_key: { to_table: :pipelines }, null: true
    add_reference :campaign_categories, :default_stage, foreign_key: { to_table: :stages }, null: true
  end
end
