class Accounts::CampaignsController < InternalController
  before_action :set_campaign, only: %i[show edit update destroy composition update_composition process_campaign]

  def index
    @campaigns = @account.campaigns.where.not(status: :draft).order(created_at: :desc)
    @draft_campaigns = @account.campaigns.where(status: :draft).order(updated_at: :desc)
  end

  def show; end

  def new
    @campaign = Campaign.new(account: @account, current_step: 1)
    @campaign_categories = CampaignCategory.all
    @pipelines = @account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
  end

  def edit
    @campaign_categories = CampaignCategory.all
    @pipelines = @account.pipelines.includes(:stages)
    @crm_fields = fetch_crm_fields
    
    # Ao editar um rascunho, garantimos que ele volte para o Passo 1
    if @campaign.draft?
      @campaign.update(current_step: 1)
    end
  end

  def create
    begin
      puts "CAMPAIGN PARAMS RECEIVED: #{campaign_params.keys}"
      puts "SPREADSHEET DATA PRESENT: #{campaign_params[:spreadsheet_data].present?}"
      puts "SPREADSHEET DATA SIZE: #{campaign_params[:spreadsheet_data].to_s.length}" if campaign_params[:spreadsheet_data].present?

      @campaign = Campaign.new(campaign_params.merge(account: @account, status: :draft, current_step: 3))
      
      puts "PRE-SAVE CAMPAIGN JSON: #{@campaign.to_json}"

      if @campaign.save
        puts "CAMPAIGN SAVED SUCCESSFULLY: #{@campaign.id}"
        puts "SAVED SPREADSHEET DATA COUNT: #{@campaign.spreadsheet_data&.size}"
        begin
          Accounts::Campaigns::InitializeContactsService.call(@campaign) if @campaign.spreadsheet_data.present? && @campaign.mapping.present?
          puts "CONTACTS INITIALIZED"
        rescue => e
          puts "ERROR IN InitializeContactsService: #{e.message}"
          puts e.backtrace.join("\n")
          # Não trava o fluxo, mas loga o erro
        end
        
        url = composition_account_campaign_path(@account, @campaign)
        puts "REDIRECTING TO: #{url}"
        redirect_to url, notice: 'Rascunho salvo! Agora configure suas mensagens.'
      else
        puts "CAMPAIGN SAVE FAILED: #{@campaign.errors.full_messages}"
        @campaign_categories = CampaignCategory.all
        @pipelines = @account.pipelines.includes(:stages)
        @crm_fields = fetch_crm_fields
        render :new, status: :unprocessable_entity
      end
    rescue => e
      puts "CRITICAL ERROR IN CREATE: #{e.class} - #{e.message}"
      puts e.backtrace.first(10).join("\n")
      flash.now[:alert] = "Erro crítico ao salvar: #{e.message}"
      @campaign_categories = CampaignCategory.all
      @pipelines = @account.pipelines.includes(:stages)
      @crm_fields = fetch_crm_fields
      render :new, status: :internal_server_error
    end
  end

  def update
    begin
      # Se editado na Tela 1, avançamos para a Tela 3 (Composition)
      puts "UPDATE PARAMS RECEIVED: #{campaign_params.keys}"
      puts "UPDATE SPREADSHEET DATA PRESENT: #{campaign_params[:spreadsheet_data].present?}"
      
      updated_params = campaign_params.merge(current_step: 3)
      @campaign.assign_attributes(updated_params)
      
      puts "PRE-UPDATE CAMPAIGN JSON: #{@campaign.to_json}"

      if @campaign.save
        puts "CAMPAIGN UPDATED SUCCESSFULLY"
        puts "UPDATED SPREADSHEET DATA COUNT: #{@campaign.spreadsheet_data&.size}"
        # Re-inicializa contatos se os dados/mapeamento foram revisados
        Accounts::Campaigns::InitializeContactsService.call(@campaign) if @campaign.spreadsheet_data.present? && @campaign.mapping.present?
        redirect_to composition_account_campaign_path(@account, @campaign), notice: 'Configurações atualizadas!'
      else
        @campaign_categories = CampaignCategory.all
        @pipelines = @account.pipelines.includes(:stages)
        @crm_fields = fetch_crm_fields
        render :edit, status: :unprocessable_entity
      end
    rescue => e
      puts "CRITICAL ERROR IN UPDATE: #{e.message}"
      flash.now[:alert] = "Erro crítico ao atualizar: #{e.message}"
      @campaign_categories = CampaignCategory.all
      @pipelines = @account.pipelines.includes(:stages)
      @crm_fields = fetch_crm_fields
      render :edit, status: :internal_server_error
    end
  end

  def generate_variations
    message = params[:message]
    provider = @account.ai_providers.groq.active.first
    
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
    voice_id = @account.settings['elevenlabs_voice_id'] || '21m00Tcm4TlvDq8ikWAM' # Default Bella

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
    redirect_to account_campaigns_path(@account), notice: 'Campanha removida com sucesso.'
  end


  def composition
    @campaign = @account.campaigns.find(params[:id])
    @inboxes = @account.apps_chatwoots.active.first&.inboxes || []
    @pipelines = @account.pipelines
  end

  def update_composition
    # Atualiza para o próximo passo se for rascunho
    step_params = @campaign.draft? ? { current_step: 3 } : {}
    
    if @campaign.update(composition_params.merge(step_params))
      redirect_to logistics_account_campaign_path(@account, @campaign), notice: 'Mensagens salvas com sucesso! Agora configure a logística.'
    else
      # Re-fetch variables needed for the view
      @inboxes = @account.apps_chatwoots.active.first&.inboxes || []
      @pipelines = @account.pipelines
      render :composition, status: :unprocessable_entity
    end
  end

  def logistics
    @inboxes = @account.apps_chatwoots.first&.inboxes || []
  end

  def update_logistics
    # Atualiza para o próximo passo se for rascunho
    step_params = @campaign.draft? ? { current_step: 4 } : {}

    if @campaign.update(campaign_params.merge(step_params))
      redirect_to automation_account_campaign_path(@account, @campaign)
    else
      render :logistics, status: :unprocessable_entity
    end
  end

  def automation
    @inboxes = @account.apps_chatwoots.first&.inboxes || []
  end

  def update_automation
    if @campaign.update(campaign_params)
      if @campaign.status == 'running'
        Accounts::CampaignWorker.perform_async(@campaign.id) 
      end
      redirect_to account_campaigns_path(@account), notice: 'Campanha finalizada com sucesso!'
    else
      render :automation, status: :unprocessable_entity
    end
  end

  def process_campaign
    if @campaign.draft? || @campaign.failed?
      @campaign.processing!
      Accounts::CampaignWorker.perform_async(@campaign.id)
      redirect_to account_campaign_path(@account, @campaign), notice: 'Processamento da campanha iniciado.'
    else
      redirect_to account_campaign_path(@account, @campaign), alert: 'Esta campanha já está em processamento ou concluída.'
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
    @account.custom_attribute_definitions.each do |definition|
      prefix = definition.contact_attribute? ? 'contact.' : 'deal.'
      fields['Negócio'] << [definition.attribute_display_name, "#{prefix}#{definition.attribute_key}"]
    end

    fields['Variável Extra'] = [
      ['Usar Nome da Coluna', 'extra_variable']
    ]

    fields
  end

  def set_campaign
    @campaign = @account.campaigns.find(params[:id])
  end

  def campaign_params
    # Captura os parâmetros base
    cp = params.require(:campaign)
    
    # Se spreadsheet_data vier como String (JSON), fazemos o parse manual
    # Se vier como Array (multipart/form-data ou JSON), o Rails/Rack já pode ter parseado
    s_data = cp[:spreadsheet_data]
    if s_data.is_a?(String) && s_data.present?
      begin
        s_data = JSON.parse(s_data)
      rescue => e
        puts "ERR PARSING SPREADSHEET_DATA: #{e.message}"
      end
    end

    mapping_data = cp[:mapping]
    if mapping_data.is_a?(String) && mapping_data.present?
      begin
        mapping_data = JSON.parse(mapping_data)
      rescue => e
        puts "ERR PARSING MAPPING: #{e.message}"
      end
    end

    # Construímos o hash final permitido
    {
      name: cp[:name],
      campaign_category_id: cp[:campaign_category_id],
      pipeline_id: cp[:pipeline_id],
      stage_id: cp[:stage_id],
      insert_ddi: cp[:insert_ddi].to_s == '1' || cp[:insert_ddi].to_s == 'true',
      ai_randomization: cp[:ai_randomization].to_s == 'true' || cp[:ai_randomization].to_s == '1',
      current_step: cp[:current_step] || 1,
      chatwoot_inbox_ids: cp[:chatwoot_inbox_ids] || [],
      spreadsheet_data: s_data,
      mapping: mapping_data
    }
  end

  def composition_params
    permitted = params.require(:campaign).permit(
      :ai_text_enabled, :ai_audio_enabled
    )
    
    # If message_sequence is a hash (sent with indices like "0", "1"), convert values to an array
    if params[:campaign][:message_sequence].present?
      if params[:campaign][:message_sequence].respond_to?(:values)
        permitted[:message_sequence] = params[:campaign][:message_sequence].values.map { |v| v.permit(:type, :content).to_h }
      else
        permitted[:message_sequence] = params[:campaign][:message_sequence]
      end
    end
    
    permitted
  end
end
