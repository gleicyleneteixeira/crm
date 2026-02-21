module DealConcern
  def permitted_deal_params
    [
      :name,
      :status,
      :stage_id,
      :manual_amount_in_cents,
      :pipeline_id,
      :contact_id,
      :position,
      :priority_level,
      :lost_reason,
      :lost_at,
      :won_at,
      { contact_attributes: %i[id full_name phone email] },
      { custom_attributes: {} }
    ]
  end
end
