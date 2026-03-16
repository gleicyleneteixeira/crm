class Accounts::CampaignWorker
  include Sidekiq::Worker
  sidekiq_options queue: :campaigns, retry: 3

  def perform(campaign_id)
    @campaign = Campaign.find(campaign_id)
    return unless @campaign.processing?

    @account = @campaign.account
    @chatwoot_app = @account.apps_chatwoots.first
    return if @chatwoot_app.nil?

    @contacts = find_or_initialize_contacts
    
    @campaign.update(total_leads: @contacts.size, processed_leads: 0)

    @contacts.each_with_index do |contact, index|
      process_contact(contact, index)
      
      # Rate limiting: use batch_delay or random interval if configured
      delay = @campaign.batch_delay.to_i
      sleep(delay) if delay > 0
      
      break if @campaign.reload.paused? || @campaign.failed?
    end

    @campaign.completed! unless @campaign.paused?
  rescue => e
    @campaign.failed!
    @campaign.campaign_logs.create!(status: 'failed', message: "Erro fatal: #{e.message}")
  end

  private

  def find_or_initialize_contacts
    return [] if @campaign.spreadsheet_data.blank? || @campaign.mapping.blank?

    # Extract phones from spreadsheet (drop header)
    phone_field = @campaign.mapping.find { |_, v| v == 'contact.phone' }&.first
    return [] if phone_field.nil?

    phone_idx = @campaign.spreadsheet_data.first.index(phone_field)
    phones = @campaign.spreadsheet_data.drop(1).map { |row| format_phone(row[phone_idx]) }.compact.uniq

    # Fetch contacts already upserted by InitializeContactsService
    @account.contacts.where(phone: phones)
  end

  def format_phone(phone)
    return nil if phone.blank?
    phone = phone.to_s.gsub(/\D/, '')
    phone = "55#{phone}" if @campaign.insert_ddi && !phone.start_with?('55')
    "+#{phone}"
  end

  def process_contact(contact, index)
    # 1. MILLISECOND BLACKLIST CHECK
    return if contact.reload.respond_to?(:blacklist?) && contact.blacklist?

    # 2. JUST-IN-TIME CHATWOOT SYNC
    if contact.additional_attributes['chatwoot_id'].blank?
      Accounts::Apps::Chatwoots::ExportContact.call(@chatwoot_app, contact)
      contact.reload
    end

    # 3. HUMAN INTERVENTION LOCK
    if @campaign.respond_to?(:human_intervention_lock) && @campaign.human_intervention_lock?
      return if recent_manual_message?(contact)
    end

    # 4. STOP WORDS CHECK
    if @campaign.respond_to?(:stop_words) && @campaign.stop_words.present?
      return if stop_words_detected?(contact)
    end

    # 5. SEND SEQUENCE
    @campaign.sequence.each do |block|
      send_message(contact, block)
    end

    @campaign.increment!(:processed_leads)
    
    # Broadcast progress
    broadcast_progress
  rescue => e
    @campaign.campaign_logs.create!(
      status: 'failed',
      message: "Erro no contato #{contact.full_name}: #{e.message}",
      contact_id: contact.id
    )
  end

  def recent_manual_message?(contact)
    # Check if there's any message from a human agent in the last X hours
    contact.events.where(from_me: true).where.not(kind: 'chatwoot_message').exists?
  end

  def stop_words_detected?(contact)
    last_incoming = contact.events.where(from_me: false).order(created_at: :desc).first
    return false if last_incoming.nil?

    words = @campaign.stop_words.split(',').map(&:strip).map(&:downcase)
    content = last_incoming.content.to_s.downcase
    
    words.any? { |word| content.include?(word) }
  end

  def send_message(contact, block)
    content = render_content(contact, block['content'])
    inbox_id = select_inbox
    
    case block['type']
    when 'text'
      if @campaign.ai_randomization?
        content = AiManager.call(@account, context: :campaign, content: content)
      end
    when 'audio'
      # ElevenLabs Integration with Caching
      audio_url = Accounts::Campaigns::ElevenLabsService.call(@account, content)
      content = audio_url if audio_url.present?
    end

    event = contact.events.new(
      account: @account,
      kind: 'chatwoot_message',
      content: content,
      app: @chatwoot_app,
      from_me: true,
      done_at: Time.current,
      additional_attributes: { campaign_id: @campaign.id, block_type: block['type'] }
    )

    # We need the conversation to update or create the Deal link
    conversation_response = Accounts::Apps::Chatwoots::FindOrCreateConversation.call(
      @chatwoot_app, 
      contact.additional_attributes['chatwoot_id'], 
      inbox_id
    )
    
    conversation = conversation_response[:ok]
    
    if conversation.present?
      Accounts::Apps::Chatwoots::SendMessage.call(@chatwoot_app, conversation['id'], event)
      find_or_create_deal_with_conversation(contact, conversation)
    end
    
    # Small delay between blocks in sequence
    sleep(2)
  end

  def render_content(contact, content)
    return "" if content.blank?
    
    processed = content.dup
    
    # Process {{first_name}}
    if processed.downcase.include?('{{first_name}}')
      first_name = contact.full_name.to_s.split(' ').first.to_s.capitalize
      processed.gsub!(/\{\{first_name\}\}/i, first_name.presence || "[Nome]")
    end

    # Process other variables if needed (mapped from contact attributes/custom_attributes)
    # For now, focus on the smart variable requested
    
    processed
  end

  def find_or_create_deal_with_conversation(contact, conversation)
    # 1. Look for existing deal for this campaign/contact
    deal = @campaign.deals.find_or_initialize_by(contact_id: contact.id)
    
    # 2. Setup attributes if new record
    if deal.new_record?
      stage = @campaign.stage || 
              @campaign.campaign_category&.pipeline&.stages&.first || 
              @account.pipelines.first&.stages&.first ||
              Stage.first
              
      deal.assign_attributes(
        name: "Campanha: #{@campaign.name} - #{contact.full_name}",
        status: 'open',
        stage_id: stage&.id,
        pipeline_id: stage&.pipeline_id || @campaign.pipeline_id,
        account_id: @account.id
      )
    end

    # 3. Update Conversation URL
    url = "#{@chatwoot_app.chatwoot_endpoint_url}/app/accounts/#{@chatwoot_app.chatwoot_account_id}/conversations/#{conversation['id']}"
    
    if deal.respond_to?(:chatwoot_conversation_url=)
      deal.chatwoot_conversation_url = url
    else
      deal.custom_attributes['chatwoot_conversation_url'] = url
    end

    deal.save
  end

  def select_inbox
    # Handle rotation logic
    ids = @campaign.inbox_ids
    return ids.first if ids.size <= 1

    # Simple rotation based on current_index
    idx = @campaign.current_index % ids.size
    @campaign.increment!(:current_index)
    ids[idx]
  end

  def broadcast_progress
    Turbo::StreamsChannel.broadcast_replace_to(
      "campaign_#{@campaign.id}_progress",
      target: "campaign_progress_bar",
      partial: "accounts/campaigns/progress_bar",
      locals: { campaign: @campaign }
    )
  end
end
