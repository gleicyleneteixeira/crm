class Accounts::Contacts::ChatwootEmbedController < InternalController
  layout 'embed'
  before_action :set_contact, only: %i[show]

  def search
    contact = contact_search

    url = chatwoot_conversation_url

    if contact.present?
      redirect_to account_chatwoot_embed_path(current_user.account, contact, chatwoot_conversation_url: url)
    else
      chatwoot_contact = parsed_chatwoot_contact
      @contact = current_user.account.contacts.new({
                                                     full_name: chatwoot_contact['name'],
                                                     email: chatwoot_contact['email'],
                                                     phone: chatwoot_contact['phone_number'],
                                                     additional_attributes: { 'chatwoot_id': chatwoot_contact['id'] }
                                                   })
      @chatwoot_conversation_url = url
      render :new
    end
  end

  def show
    @chatwoot_conversation_url = params[:chatwoot_conversation_url]
  end

  def new
    chatwoot_contact = parsed_chatwoot_contact
    @contact = current_user.account.contacts.new({
                                                   full_name: chatwoot_contact['name'],
                                                   email: chatwoot_contact['email'],
                                                   phone: chatwoot_contact['phone_number'],
                                                   additional_attributes: { 'chatwoot_id': chatwoot_contact['id'] }
                                                 })
    @chatwoot_conversation_url = chatwoot_conversation_url
  end

  def create
    @contact = current_user.account.contacts.new(contact_params)

    if @contact.save
      redirect_to account_chatwoot_embed_path(current_user.account, @contact,
                                              chatwoot_conversation_url: chatwoot_conversation_url),
                  notice: t('flash_messages.created', model: Contact.model_name.human)
    else
      render :new, status: :unprocessable_entity
    end
  end

  private

  def set_contact
    @contact = Contact.find(params[:id])
  end

  def contact_params
    params.require(:contact).permit(:full_name, :phone, :email, additional_attributes: {})
  end

  def chatwoot_contact
    @chatwoot_contact ||= parsed_chatwoot_contact
  end

  def contact_search
    result = current_user.account.contacts.by_chatwoot_id(chatwoot_contact['id']).first
    return result if result.present?

    Accounts::Contacts::GetByParams.call(current_user.account,
                                         { email: chatwoot_contact['email'],
                                           phone: chatwoot_contact['phone_number'] })[:ok]
  end

  def parsed_chatwoot_contact
    JSON.parse(params['chatwoot_contact'])
  rescue JSON::ParserError, TypeError
    {}
  end

  def chatwoot_conversation
    return @chatwoot_conversation if defined?(@chatwoot_conversation)

    raw = params['chatwoot_conversation']
    @chatwoot_conversation = raw.present? ? JSON.parse(raw) : nil
  rescue JSON::ParserError
    @chatwoot_conversation = nil
  end

  def chatwoot_conversation_url
    return @chatwoot_conversation_url if defined?(@chatwoot_conversation_url) && @chatwoot_conversation_url.present?

    conversation = chatwoot_conversation
    return nil if conversation.blank?

    chatwoot = current_user.account.apps_chatwoots.first
    return nil unless chatwoot

    conversation_id = conversation['id'] || conversation['conversation_id'] || conversation['conversationId']
    return nil unless conversation_id

    @chatwoot_conversation_url =
      "#{chatwoot.chatwoot_endpoint_url}/app/accounts/#{chatwoot.chatwoot_account_id}/conversations/#{conversation_id}"
  end
end
