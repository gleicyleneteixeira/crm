class Accounts::CampaignWorker
  include Sidekiq::Worker

  def perform(campaign_id)
    campaign = Campaign.find(campaign_id)
    return unless campaign.running?

    account = campaign.account
    spreadsheet_data = campaign.spreadsheet_data
    mapping = campaign.mapping
    inbox_ids = campaign.inbox_ids
    pipeline_id = campaign.pipeline_id
    stage_id = campaign.stage_id

    deals_to_insert = []
    success_count = 0

    total_to_process = spreadsheet_data.size - 1
    campaign.update(total_leads: [total_to_process, 0].max) if campaign.total_leads.nil?

    spreadsheet_data.each_with_index do |row, index|
      begin
        next if index < campaign.current_index
        
        if campaign.reload.paused?
          log = campaign.campaign_logs.create!(status: 'paused', message: "Processamento pausado. #{success_count} concluídos nesta rodada.", metadata: { index: index })
          broadcast_log(campaign, log)
          break
        end

        contact_params = map_row_to_contact_params(row, mapping)
        
        if contact_params[:email].present?
          contact_params[:email] = DataCleansingService.clean_email(contact_params[:email])
        end
        contact_params[:custom_attributes] ||= {}
        if contact_params[:full_name].present? && contact_params[:custom_attributes]['gender'].blank?
          contact_params[:custom_attributes]['gender'] = DataCleansingService.detect_gender(contact_params[:full_name])
        end

        contact = find_or_initialize_contact(account, contact_params)
        
        if contact.blacklist?
          log = campaign.campaign_logs.create!(status: 'failed', message: "Contato ignorado (Blacklist).", metadata: { row: row })
          campaign.update(processed_leads: campaign.processed_leads + 1, current_index: index + 1)
          broadcast_log(campaign, log)
          
          Turbo::StreamsChannel.broadcast_replace_to(
            [campaign.account, campaign, :progress],
            target: "campaign_progress_#{campaign.id}",
            partial: 'accounts/campaigns/progress',
            locals: { campaign: campaign }
          )
          next
        end
        
        if contact.new_record? || campaign.duplicate_action == 'update'
          contact.assign_attributes(contact_params)
          contact.save!
        end

        if pipeline_id.present? && stage_id.present?
          deal_params = map_row_to_deal_params(row, mapping, campaign.campaign_category&.name)
          name = deal_params[:name] || "Oportunidade #{contact.full_name}" 
          
          # A/B Prompt Distribution
          prompt_to_use = nil
          if campaign.prompt_a_id.present? && campaign.prompt_b_id.present?
            prompt_to_use = campaign.processed_leads.to_i.even? ? campaign.prompt_a_id : campaign.prompt_b_id
          else
            prompt_to_use = campaign.prompt_a_id || campaign.prompt_b_id
          end

          custom_attrs = deal_params[:custom_attributes] || {}
          custom_attrs['ai_prompt_id'] = prompt_to_use if prompt_to_use.present?
          
          deals_to_insert << {
            account_id: account.id,
            contact_id: contact.id,
            pipeline_id: pipeline_id,
            stage_id: stage_id,
            campaign_id: campaign.id,
            status: 'open',
            name: name,
            custom_attributes: custom_attrs,
            manual_amount_in_cents: (deal_params[:manual_amount_in_cents].presence || 0).to_i,
            total_deal_products_amount_in_cents: (deal_params[:total_amount_in_cents].presence || 0).to_i,
            created_at: Time.current,
            updated_at: Time.current
          }
        end
        
        success_count += 1
        campaign.update(processed_leads: campaign.processed_leads + 1, current_index: index + 1)
        
        Turbo::StreamsChannel.broadcast_replace_to(
          [campaign.account, campaign, :progress],
          target: "campaign_progress_#{campaign.id}",
          partial: 'accounts/campaigns/progress',
          locals: { campaign: campaign }
        )
      rescue => e
        log = campaign.campaign_logs.create!(
          status: 'failed',
          message: "Erro no processamento da linha #{index + 1}: #{e.message}",
          metadata: { row: row, index: index }
        )
        campaign.update(processed_leads: campaign.processed_leads + 1, current_index: index + 1)
        broadcast_log(campaign, log)
        
        Turbo::StreamsChannel.broadcast_replace_to(
          [campaign.account, campaign, :progress],
          target: "campaign_progress_#{campaign.id}",
          partial: 'accounts/campaigns/progress',
          locals: { campaign: campaign }
        )
      end
    end

    if deals_to_insert.any?
      Deal.insert_all(deals_to_insert)
      log = campaign.campaign_logs.create!(
        status: 'success',
        message: "#{deals_to_insert.length} Negócios criados ou atualizados."
      )
      broadcast_log(campaign, log)
    end

    if campaign.reload.running? && campaign.current_index >= total_to_process
      campaign.update(status: 'completed', end_date: Time.current)
      
      Turbo::StreamsChannel.broadcast_replace_to(
        [campaign.account, campaign, :progress],
        target: "campaign_progress_#{campaign.id}",
        partial: 'accounts/campaigns/progress',
        locals: { campaign: campaign }
      )
    end
  rescue => e
    campaign.failed!
    log = campaign.campaign_logs.create!(status: 'failed', message: "Erro fatal na campanha: #{e.message}")
    broadcast_log(campaign, log)
  end

  private

  def broadcast_log(campaign, log)
    Turbo::StreamsChannel.broadcast_prepend_to(
      [campaign.account, campaign, :logs],
      target: "campaign_logs_#{campaign.id}",
      partial: 'accounts/campaigns/log',
      locals: { log: log }
    )
    # Remove the empty state message if it is the first log
    Turbo::StreamsChannel.broadcast_remove_to(
      [campaign.account, campaign, :logs],
      target: "empty_logs_msg"
    )
  end

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

  def map_row_to_deal_params(row, mapping, campaign_category_name = nil)
    params = { custom_attributes: {} }
    mapping.each do |field, col|
      next if col.blank?
      next unless field.start_with?('deal.')
      
      key = field.gsub('deal.', '')
      
      value = if col == '__campaign_category_target__'
                campaign_category_name
              elsif col == '__campaign_name_target__'
                # Fallback purely in case the old mapping was still there somehow
                nil
              else
                row[col.to_i]
              end

      if ['name', 'manual_amount_in_cents', 'total_amount_in_cents', 'chatwoot_conversation_url'].include?(key)
        params[key.to_sym] = value
      else
        params[:custom_attributes][key] = value
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
