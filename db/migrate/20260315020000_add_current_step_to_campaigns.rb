class AddCurrentStepToCampaigns < ActiveRecord::Migration[7.1]
  def change
    add_column :campaigns, :current_step, :integer, default: 1
    add_column :campaigns, :ai_text_enabled, :boolean, default: false
    add_column :campaigns, :ai_audio_enabled, :boolean, default: false
  end
end
