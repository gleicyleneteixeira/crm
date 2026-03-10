class Accounts::CampaignWorker
  include Sidekiq::Worker

  def perform(campaign_id)
    campaign = Campaign.find(campaign_id)
    return unless campaign.processing?

    account = campaign.account
    spreadsheet_data = campaign.spreadsheet_data
    mapping = campaign.mapping
    inbox_ids = campaign.inbox_ids
    chatwoot_app = account.apps_chatwoots.active.first
    pipeline_id = campaign.campaign_category&.default_pipeline_id
    stage_id = campaign.campaign_category&.default_stage_id

    spreadsheet_data.each_with_index do |row, index|
      begin
        # 1. Map and Create/Update Contact
        contact_params = map_row_to_contact_params(row, mapping)
        contact = find_or_initialize_contact(account, contact_params)
        contact.assign_attributes(contact_params)
        contact.save!

        # 2. Export to Chatwoot (if applicable)
        if chatwoot_app.present?
          Accounts::Apps::Chatwoots::ExportContact.call(chatwoot_app, contact)
          contact.reload

          # 3. Send Messages Sequentially (If Sequence is mapped later)
          if campaign.sequence.present? && inbox_ids.present?
            inbox_id = inbox_ids[index % inbox_ids.size]
            campaign.sequence.each do |message_block|
              send_campaign_message(chatwoot_app, contact, inbox_id, message_block, campaign)
            end
          end
        end

        # 4. Create Deal linked to Category and Campaign
        deal = nil
        if pipeline_id.present? && stage_id.present?
          deal_params = map_row_to_deal_params(row, mapping)
          deal_params[:name] ||= "Oportunidade #{contact.full_name}" 
          
          deal = account.deals.create!(
            deal_params.merge(
              contact: contact,
              pipeline_id: pipeline_id,
              stage_id: stage_id,
              campaign_id: campaign.id,
              status: 'open'
            )
          )
        end

        # 5. Log Success
        campaign.campaign_logs.create!(
          contact: contact,
          deal: deal,
          status: 'success',
          message: "Contato #{contact.full_name} e Negócio criado com sucesso."
        )
      rescue => e
        campaign.campaign_logs.create!(
          status: 'failed',
          message: "Erro no processamento da linha #{index + 1}: #{e.message}",
          metadata: { row: row, index: index }
        )
      end

      # 7. Respect Delay
      sleep(campaign.batch_delay) if campaign.batch_delay.to_i > 0
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
