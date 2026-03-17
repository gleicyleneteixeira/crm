class AddAutomationFieldsToAppsChatwoots < ActiveRecord::Migration[7.0]
  def change
    add_column :apps_chatwoots, :chatwoot_push_deals_automatic, :boolean, default: false
    add_column :apps_chatwoots, :chatwoot_push_deals_pipeline_id, :bigint
    add_column :apps_chatwoots, :chatwoot_push_deals_stage_id, :bigint
  end
end
