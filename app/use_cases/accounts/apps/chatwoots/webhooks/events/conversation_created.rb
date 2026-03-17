class Accounts::Apps::Chatwoots::Webhooks::Events::ConversationCreated
  def self.call(chatwoot, webhook)
    return { ok: 'Automatic deal creation is disabled' } unless chatwoot.chatwoot_push_deals_automatic
    
    conversation = webhook
    contact_id = conversation['contact_inbox']['contact_id']
    
    # Filtro de Segurança 1: Status da conversa
    return { ok: 'Conversation status is ignored' } if %w[pending snoozed].include?(conversation['status'])

    contact = Accounts::Apps::Chatwoots::Webhooks::ImportContact.get_or_import_contact(chatwoot, contact_id)
    return { error: 'Contact not found' } if contact.blank?

    # Filtro de Segurança 2: Já possui negócio aberto na pipeline
    return { ok: 'Contact already has an open deal in this pipeline' } if contact_has_open_deal?(contact, chatwoot.chatwoot_push_deals_pipeline_id)

    create_deal(chatwoot, contact, conversation)
  end

  def self.contact_has_open_deal?(contact, pipeline_id)
    contact.deals.where(pipeline_id: pipeline_id, status: 'open').exists?
  end

  def self.create_deal(chatwoot, contact, conversation)
    deal_params = {
      pipeline_id: chatwoot.chatwoot_push_deals_pipeline_id,
      stage_id: chatwoot.chatwoot_push_deals_stage_id,
      account_id: chatwoot.account_id,
      contact_id: contact.id,
      name: "Atendimento: #{contact.full_name}",
      chatwoot_conversation_url: build_conversation_url(chatwoot, conversation['id']),
      status: 'open'
    }

    deal = Deal.create!(deal_params)
    { ok: deal }
  end

  def self.build_conversation_url(chatwoot, conversation_id)
    # Ex: https://atendimento.woofedcrm.com/app/accounts/1/conversations/123
    "#{chatwoot.chatwoot_endpoint_url}/app/accounts/#{chatwoot.chatwoot_account_id}/conversations/#{conversation_id}"
  end
end
