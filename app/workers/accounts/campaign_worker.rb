class Accounts::CampaignWorker
  include Sidekiq::Worker

  def perform(campaign_id)
    campaign = Campaign.find(campaign_id)
    return unless campaign.processing?

    account = campaign.account
    spreadsheet_data = campaign.spreadsheet_data
    mapping = campaign.mapping
    inbox_ids = campaign.inbox_ids
    pipeline_id = campaign.pipeline_id
    stage_id = campaign.stage_id

    deals_to_insert = []
    success_count = 0

    spreadsheet_data.each_with_index do |row, index|
      begin
        contact_params = map_row_to_contact_params(row, mapping)
        contact = find_or_initialize_contact(account, contact_params)
        contact.assign_attributes(contact_params)
        contact.save!

        if pipeline_id.present? && stage_id.present?
          deal_params = map_row_to_deal_params(row, mapping)
          name = deal_params[:name] || "Oportunidade #{contact.full_name}" 
          
          deals_to_insert << {
            account_id: account.id,
            contact_id: contact.id,
            pipeline_id: pipeline_id,
            stage_id: stage_id,
            campaign_id: campaign.id,
            status: 'open',
            name: name,
            custom_attributes: deal_params[:custom_attributes] || {},
            manual_amount_in_cents: (deal_params[:manual_amount_in_cents].presence || 0).to_i,
            total_deal_products_amount_in_cents: (deal_params[:total_amount_in_cents].presence || 0).to_i,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
        success_count += 1
      rescue => e
        campaign.campaign_logs.create!(
          status: 'failed',
          message: "Erro no processamento da linha #{index + 1}: #{e.message}",
          metadata: { row: row, index: index }
        )
      end
    end

    if deals_to_insert.any?
      Deal.insert_all(deals_to_insert)
      campaign.campaign_logs.create!(
        status: 'success',
        message: "#{deals_to_insert.length} Negócios (Deals) criados em lote (Bulk Insert) com sucesso."
      )
    end

    campaign.completed!
  rescue => e
    campaign.failed!
    campaign.campaign_logs.create!(status: 'failed', message: "Erro fatal na campanha: #{e.message}")
  end

  private

  def find_or_initialize_contact(account, params)
    contact = nil
    contact = account.contacts.find_by(email: params[:email]) if params[:email].present?
    contact ||= account.contacts.find_by(phone: params[:phone]) if params[:phone].present?
    contact || account.contacts.new
  end

  def map_row_to_contact_params(row, mapping)
    params = {}
    mapping.each do |field, col|
      next if col.blank?
      next unless field.start_with?('contact.')
      params[field.gsub('contact.', '').to_sym] = row[col.to_i]
    end
    params
  end

  def map_row_to_deal_params(row, mapping)
    params = { custom_attributes: {} }
    mapping.each do |field, col|
      next if col.blank?
      next unless field.start_with?('deal.')
      
      key = field.gsub('deal.', '')
      if ['name', 'manual_amount_in_cents', 'total_amount_in_cents', 'chatwoot_conversation_url'].include?(key)
        params[key.to_sym] = row[col.to_i]
      else
        params[:custom_attributes][key] = row[col.to_i]
      end
    end
    params
  end

  def send_campaign_message(chatwoot_app, contact, inbox_id, message_block, campaign)
    content = message_block['content']
    
    if campaign.ai_randomization? && message_block['type'] == 'text'
      content = AiManager.call(campaign.account, context: :campaign, content: content)
    end

    event = contact.events.new(
      account: chatwoot_app.account,
      kind: 'chatwoot_message',
      content: content,
      app: chatwoot_app,
      from_me: true,
      done_at: Time.current
    )
    
    # TODO: Handle image/audio attachments if message_block['type'] is image/audio
    
    Accounts::Apps::Chatwoots::GetConversationAndSendMessage.call(
      chatwoot_app, contact.additional_attributes['chatwoot_id'], inbox_id, event
    )
    
    # Small internal delay between messages of the same sequence
    sleep(1.5)
  end
end
