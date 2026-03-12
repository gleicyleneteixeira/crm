class Accounts::CampaignsController < InternalController
  before_action :set_campaign, only: %i[show edit update destroy mapping update_mapping composition update_composition process_campaign pause resume duplicate]

  def index
    @campaigns = current_user.account.campaigns.order(created_at: :desc)
  end

  def show; end

  def new
    @campaign = current_user.account.campaigns.new
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
    @crm_phones = current_user.account.contacts.pluck(:phone, :phone_2, :phone_3).flatten.compact.reject(&:blank?).map { |p| p.gsub(/\D/, '') }.uniq
  end

  def edit
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
    @crm_phones = current_user.account.contacts.pluck(:phone, :phone_2, :phone_3).flatten.compact.reject(&:blank?).map { |p| p.gsub(/\D/, '') }.uniq
  end

  def create
    @campaign = current_user.account.campaigns.new(campaign_params)

    if @campaign.save
      redirect_to composition_account_campaign_path(current_user.account, @campaign), notice: 'Campanha importada e mapeada! Agora, configure o texto a ser enviado.'
    else
      @campaign_categories = CampaignCategory.all
      @crm_fields = fetch_crm_fields
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @campaign.update(campaign_params)
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Campanha atualizada com sucesso.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @campaign.destroy
    redirect_to account_campaigns_path(current_user.account), notice: 'Campanha removida com sucesso.'
  end

  def mapping
    @headers = @campaign.spreadsheet_data.first || []
    @crm_fields = fetch_crm_fields
  end

  def update_mapping
    if @campaign.update(mapping: params[:campaign][:mapping])
      redirect_to composition_account_campaign_path(current_user.account, @campaign), notice: 'Mapeamento salvo com sucesso.'
    else
      render :mapping, status: :unprocessable_entity
    end
  end

  def composition
    @inboxes = current_user.account.apps_chatwoots.active.first&.inboxes || []
    @pipelines = current_user.account.pipelines
  end

  def update_composition
    if @campaign.update(composition_params)
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Composição da campanha salva com sucesso.'
    else
      render :composition, status: :unprocessable_entity
    end
  end

  def process_campaign
    if @campaign.draft?
      @campaign.update(status: 'running', start_date: Time.current, current_index: 0, processed_leads: 0, total_leads: [(@campaign.spreadsheet_data&.size.to_i - 1), 0].max)
      Accounts::CampaignWorker.perform_async(@campaign.id)
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Processamento da campanha iniciado.'
    else
      redirect_to account_campaign_path(current_user.account, @campaign), alert: 'Esta campanha já está em processamento ou concluída.'
    end
  end

  def pause
    if @campaign.running? || @campaign.scheduled?
      @campaign.paused!
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Campanha pausada.'
    else
      redirect_to account_campaign_path(current_user.account, @campaign), alert: 'Campanha não pode ser pausada.'
    end
  end

  def resume
    if @campaign.paused?
      @campaign.running!
      Accounts::CampaignWorker.perform_async(@campaign.id)
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Campanha retomada.'
    else
      redirect_to account_campaign_path(current_user.account, @campaign), alert: 'Apenas campanhas pausadas podem ser retomadas.'
    end
  end

  def duplicate
    new_campaign = @campaign.dup
    new_campaign.name = "#{@campaign.name} (Cópia)"
    new_campaign.status = 'draft'
    new_campaign.spreadsheet_data = nil
    new_campaign.total_leads = nil
    new_campaign.processed_leads = 0
    new_campaign.current_index = 0
    new_campaign.start_date = nil
    new_campaign.end_date = nil

    if new_campaign.save
      redirect_to edit_account_campaign_path(current_user.account, new_campaign), notice: 'Campanha duplicada. Faça o upload da nova planilha.'
    else
      redirect_to account_campaign_path(current_user.account, @campaign), alert: 'Erro ao duplicar campanha.'
    end
  end

  private

  def fetch_crm_fields
    fields = {
      'Contato' => [
        ['Nome Completo', 'contact.full_name'],
        ['CPF', 'contact.cpf'],
        ['Telefone 1', 'contact.phone'],
        ['Telefone 2', 'contact.phone_2'],
        ['Telefone 3', 'contact.phone_3'],
        ['Email', 'contact.email']
      ],
      'Negócio' => [
        ['Nome do Negócio', 'deal.name']
      ]
    }

    # Custom Attributes (All lumped into Negócio per user request for CRM tributos)
    current_user.account.custom_attribute_definitions.each do |definition|
      prefix = definition.contact_attribute? ? 'contact.' : 'deal.'
      fields['Negócio'] << [definition.attribute_display_name, "#{prefix}#{definition.attribute_key}"]
    end

    fields['Variável Extra'] = [
      ['Usar Nome da Coluna', 'extra_variable']
    ]

    fields
  end

  def set_campaign
    @campaign = current_user.account.campaigns.find(params[:id])
  end

  def campaign_params
    permitted = params.require(:campaign).permit(:name, :spreadsheet_data, :campaign_category_id, :pipeline_id, :stage_id, :duplicate_action, :prompt_a_id, :prompt_b_id, :start_date, :end_date)
    permitted[:mapping] = params[:campaign][:mapping].permit! if params[:campaign][:mapping].present?
    permitted[:spreadsheet_data] = JSON.parse(permitted[:spreadsheet_data]) if permitted[:spreadsheet_data].is_a?(String)
    permitted
  end

  def composition_params
    params.require(:campaign).permit(
      :batch_delay,
      :pipeline_id,
      :stage_id,
      chatwoot_inbox_ids: [],
      message_sequence: [:type, :content]
    )
  end
end
