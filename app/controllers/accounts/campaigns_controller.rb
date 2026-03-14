class Accounts::CampaignsController < InternalController
  before_action :set_campaign, only: %i[show edit update destroy mapping update_mapping composition update_composition process_campaign]

  def index
    @campaigns = current_user.account.campaigns.order(created_at: :desc)
  end

  def show; end

  def new
    @campaign = current_user.account.campaigns.new
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
  end

  def edit
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
  end

  def create
    puts "DEBUG: Recebendo parâmetros da campanha: #{campaign_params.inspect}"
    @campaign = current_user.account.campaigns.new(campaign_params)
    @campaign.account_id = current_user.account.id # Força explicitamente o ID da conta

    if @campaign.save
      puts "DEBUG: Campanha salva com sucesso: #{@campaign.id}"
      redirect_to mapping_account_campaign_path(current_user.account, @campaign), status: :see_other, notice: 'Campanha criada! Agora mapeie os campos.'
    else
      puts "DEBUG: Falha ao salvar campanha: #{@campaign.errors.full_messages}"
      @campaign_categories = current_user.account.campaign_categories
      @pipelines = current_user.account.pipelines
      @crm_fields = fetch_crm_fields # Changed from contact_custom_attributes to fetch_crm_fields to match existing method
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
      Accounts::Campaigns::InitializeContactsService.call(@campaign)
      
      redirect_to composition_account_campaign_path(current_user.account, @campaign), notice: 'Mapeamento e contatos salvos com sucesso!'
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
      redirect_to logistics_account_campaign_path(current_user.account, @campaign), notice: 'Mensagens salvas com sucesso! Agora configure a logística.'
    else
      render :composition, status: :unprocessable_entity
    end
  end

  def logistics
    @inboxes = current_user.account.apps_chatwoots.first&.inboxes || []
  end

  def update_logistics
    if @campaign.update(campaign_params.merge(status: 'draft'))
      redirect_to automation_account_campaign_path(current_user.account, @campaign)
    else
      render :logistics, status: :unprocessable_entity
    end
  end

  def automation
    @inboxes = current_user.account.apps_chatwoots.first&.inboxes || []
  end

  def update_automation
    if @campaign.update(campaign_params)
      if @campaign.status == 'running'
        Accounts::CampaignWorker.perform_async(@campaign.id) 
      end
      redirect_to account_campaigns_path(current_user.account), notice: 'Campanha finalizada com sucesso!'
    else
      render :automation, status: :unprocessable_entity
    end
  end

  def process_campaign
    if @campaign.draft? || @campaign.failed?
      @campaign.processing!
      Accounts::CampaignWorker.perform_async(@campaign.id)
      redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Processamento da campanha iniciado.'
    else
      redirect_to account_campaign_path(current_user.account, @campaign), alert: 'Esta campanha já está em processamento ou concluída.'
    end
  end

  private

  def fetch_crm_fields
    fields = {
      'Contato' => [
        ['Nome Completo', 'contact.full_name'],
        ['Telefone', 'contact.phone'],
        ['Email', 'contact.email']
      ],
      'Negócio' => [
        ['Nome do Negócio', 'deal.name']
      ]
    }

    # Custom Attributes
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
    permitted = params.require(:campaign).permit(
      :name, :campaign_category_id, :pipeline_id, :stage_id, :spreadsheet_data, :insert_ddi, :ai_randomization, chatwoot_inbox_ids: []
    )

    # Converte spreadsheet_data de String para JSON se necessário
    if permitted[:spreadsheet_data].is_a?(String)
      begin
        permitted[:spreadsheet_data] = JSON.parse(permitted[:spreadsheet_data])
      rescue JSON::ParserError => e
        puts "DEBUG: Erro ao parsear spreadsheet_data: #{e.message}"
      end
    end

    # Handle mapping more explicitly
    if params[:campaign][:mapping].present?
      permitted[:mapping] = params[:campaign][:mapping].permit!.to_h
    end

    permitted.to_h
  end

  def composition_params
    params.require(:campaign).permit(
      message_sequence: [:type, :content]
    )
  end
end
