class Accounts::CampaignsController < InternalController
  before_action :set_campaign, only: %i[show edit update destroy composition update_composition process_campaign]

  def index
    @campaigns = current_user.account.campaigns.where.not(status: :draft).order(created_at: :desc)
    @draft_campaigns = current_user.account.campaigns.where(status: :draft).order(updated_at: :desc)
  end

  def show; end

  def new
    @campaign = current_user.account.campaigns.new(current_step: 1)
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
  end

  def edit
    @campaign_categories = CampaignCategory.all
    @pipelines = current_user.account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
    
    # Ao editar um rascunho, garantimos que ele volte para o Passo 1
    if @campaign.draft?
      @campaign.update(current_step: 1)
    end
  end

  def create
    @campaign = current_user.account.campaigns.new(campaign_params.merge(status: :draft, current_step: 2))
    
    if @campaign.save
      Accounts::Campaigns::InitializeContactsService.call(@campaign) if @campaign.spreadsheet_data.present? && @campaign.mapping.present?
      redirect_to composition_account_campaign_path(current_user.account, @campaign), notice: 'Rascunho salvo! Agora configure suas mensagens.'
    else
      @campaign_categories = CampaignCategory.all
      @pipelines = current_user.account.pipelines.includes(:stages)
      @crm_fields = fetch_crm_fields
      render :new, status: :unprocessable_entity
    end
  end

  def update
    # Se avançar da Tela 1 (Edit), vai para a Tela 2 (Composition)
    next_step = @campaign.draft? ? 2 : @campaign.current_step
    
    if @campaign.update(campaign_params.merge(current_step: next_step))
      if @campaign.draft?
        # Re-inicializa contatos se os dados/mapeamento foram revisados
        Accounts::Campaigns::InitializeContactsService.call(@campaign) if @campaign.spreadsheet_data.present? && @campaign.mapping.present?
        redirect_to composition_account_campaign_path(current_user.account, @campaign), notice: 'Contatos revisados com sucesso!'
      else
        redirect_to account_campaign_path(current_user.account, @campaign), notice: 'Campanha atualizada.'
      end
    else
      @campaign_categories = CampaignCategory.all
      @pipelines = current_user.account.pipelines.includes(:stages)
      @crm_fields = fetch_crm_fields
      render :edit, status: :unprocessable_entity
    end
  end

  def generate_variations
    message = params[:message]
    provider = current_user.account.ai_providers.groq.active.first
    
    if provider.nil?
      return render json: { error: 'Provedor Groq não configurado ou inativo.' }, status: :unpackable_entity
    end

    prompt = "Você é um especialista em marketing. Gere 3 variações curtas e naturais da seguinte mensagem para evitar detecção de spam. 
              IMPORTANTE: Nunca altere ou traduza as tags entre chaves duplas como {{nome}}, {{valor}}, etc. Retorne-as exatamente como estão.
              Retorne apenas as 3 variações em um formato de lista JSON: [\"var1\", \"var2\", \"var3\"].
              Mensagem base: #{message}"

    begin
      client = OpenAI::Client.new(access_token: provider.api_key, uri_base: "https://api.groq.com/openai/v1")
      response = client.chat(
        parameters: {
          model: provider.model_name || "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        }
      )
      
      variations = JSON.parse(response.dig("choices", 0, "message", "content").match(/\[.*\]/m)[0])
      render json: { variations: variations }
    rescue => e
      render json: { error: "Erro na IA: #{e.message}" }, status: :internal_server_error
    end
  end

  def generate_audio
    text = params[:text]
    api_key = ENV['ELEVENLABS_API_KEY']
    voice_id = current_user.account.settings['elevenlabs_voice_id'] || '21m00Tcm4TlvDq8ikWAM' # Default Bella

    if api_key.blank?
      return render json: { error: 'Chave ElevenLabs não configurada.' }, status: :unprocessable_entity
    end

    begin
      response = HTTParty.post(
        "https://api.elevenlabs.io/v1/text-to-speech/#{voice_id}",
        headers: { "xi-api-key" => api_key, "Content-Type" => "application/json" },
        body: { text: text, model_id: "eleven_multilingual_v2" }.to_json
      )

      if response.success?
        # Salva temporariamente ou retorna como base64/blob
        # Para simplificar no MVP, vamos retornar o áudio binário ou salvar no ActiveStorage
        # Aqui vamos retornar como base64 para o preview imediato
        audio_base64 = Base64.strict_encode64(response.body)
        render json: { audio: "data:audio/mpeg;base64,#{audio_base64}" }
      else
        render json: { error: "Erro ElevenLabs: #{response.code}" }, status: :unprocessable_entity
      end
    rescue => e
      render json: { error: "Falha técnica no áudio: #{e.message}" }, status: :internal_server_error
    end
  end

  def destroy
    @campaign.destroy
    redirect_to account_campaigns_path(current_user.account), notice: 'Campanha removida com sucesso.'
  end


  def composition
    @inboxes = current_user.account.apps_chatwoots.active.first&.inboxes || []
    @pipelines = current_user.account.pipelines
  end

  def update_composition
    # Atualiza para o próximo passo se for rascunho
    step_params = @campaign.draft? ? { current_step: 3 } : {}
    
    if @campaign.update(composition_params.merge(step_params))
      redirect_to logistics_account_campaign_path(current_user.account, @campaign), notice: 'Mensagens salvas com sucesso! Agora configure a logística.'
    else
      render :composition, status: :unprocessable_entity
    end
  end

  def logistics
    @inboxes = current_user.account.apps_chatwoots.first&.inboxes || []
  end

  def update_logistics
    # Atualiza para o próximo passo se for rascunho
    step_params = @campaign.draft? ? { current_step: 4 } : {}

    if @campaign.update(campaign_params.merge(step_params))
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
      :ai_text_enabled, :ai_audio_enabled,
      message_sequence: [:type, :content]
    )
  end
end
