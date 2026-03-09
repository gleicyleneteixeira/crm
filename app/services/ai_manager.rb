require 'openai'

class AiManager
  def self.call(account, context:, content:)
    new(account, context, content).call
  end

  def initialize(account, context, content)
    @account = account
    @context = context
    @content = content
  end

  def call
    prompt = @account.ai_prompts.find_by(context: @context)
    system_instruction = prompt&.instruction || "Você é um assistente útil."
    
    # Try available providers in rotation
    providers = @account.ai_providers.available.to_a.shuffle
    
    if providers.empty?
      Rails.logger.warn("AiManager: Nenhum provedor de IA disponível para a conta #{@account.id}")
      return @content
    end

    providers.each do |provider|
      begin
        response = execute_request(provider, system_instruction)
        provider.increment!(:usage_count)
        return response
      rescue => e
        handle_error(provider, e)
        next # Try next provider
      end
    end

    # If all failed, return original content
    @content
  end

  private

  def execute_request(provider, system_instruction)
    case provider.provider_type
    when 'openai'
      client = OpenAI::Client.new(access_token: provider.api_key)
      response = client.chat(
        parameters: {
          model: provider.model_name,
          messages: [
            { role: "system", content: system_instruction },
            { role: "user", content: @content }
          ],
          temperature: 0.7
        }
      )
      raise response['error']['message'] if response['error'].present?
      response.dig("choices", 0, "message", "content")
    when 'groq'
      # Assuming a Faraday/HTTP setup for Groq as there might not be a standard gem
      # Using a simplified OpenAI compatibility if supported, otherwise direct HTTP
      call_groq_api(provider, system_instruction)
    else
      raise "Provedor #{provider.provider_type} não suportado"
    end
  end

  def call_groq_api(provider, system_instruction)
    conn = Faraday.new(url: 'https://api.groq.com/openai/v1') do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end

    response = conn.post('chat/completions') do |req|
      req.headers['Authorization'] = "Bearer #{provider.api_key}"
      req.body = {
        model: provider.model_name,
        messages: [
          { role: "system", content: system_instruction },
          { role: "user", content: @content }
        ]
      }
    end

    if response.status == 200
      response.body.dig("choices", 0, "message", "content")
    elsif response.status == 429
      raise "Rate Limit Exceeded"
    else
      raise "Groq Error: #{response.body['error']['message']}"
    end
  end

  def handle_error(provider, error)
    Rails.logger.error("AiManager Error (Provider #{provider.id}): #{error.message}")
    if error.message.include?("Rate Limit") || error.message.include?("429")
      provider.cooldown!(error.message)
    else
      provider.update(last_error: error.message)
    end
  end
end
