class RemoveNullConstraintFromAiRandomizationInCampaigns < ActiveRecord::Migration[7.1]
  def change
    change_column_null :campaigns, :ai_randomization, true
  end
end
