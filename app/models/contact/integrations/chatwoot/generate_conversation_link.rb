class Contact::Integrations::Chatwoot::GenerateConversationLink
  def initialize(contact)
    @contact = contact
  end

  def call
    chatwoot = fetch_chatwoot_for_account
    chatwoot_contact_id = @contact.additional_attributes['chatwoot_id']

    return { error: 'no_chatwoot_or_id' } unless chatwoot && chatwoot_contact_id

    conversation_id = fetch_conversation_id(chatwoot, chatwoot_contact_id)
    return { error: 'no_conversation' } unless conversation_id

    { ok: build_conversation_url(chatwoot, conversation_id) }
  end

  private

  def fetch_chatwoot_for_account
    if @contact.respond_to?(:account) && @contact.account.present?
      @contact.account.apps_chatwoots.first
    elsif defined?(Current) && Current.respond_to?(:account) && Current.account.present?
      Current.account.apps_chatwoots.first
    else
      Apps::Chatwoot.first
    end
  end

  def fetch_conversation_id(chatwoot, chatwoot_contact_id)
    conversations = Accounts::Apps::Chatwoots::GetConversations.call(chatwoot, chatwoot_contact_id)
    conversations.dig(:ok, 0, 'id')
  end

  def build_conversation_url(chatwoot, conversation_id)
    conversation_path = "/app/accounts/#{chatwoot.chatwoot_account_id}/conversations/#{conversation_id}"
    chatwoot.chatwoot_endpoint_url + conversation_path
  end
end
