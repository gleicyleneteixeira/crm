module Actions
  class SendWebhookJob < Workflows::BaseActionJob
    def execute
      url = @config['url']
      return unless url.present?

      # Simple webhook dispatch using Faraday
      Faraday.post(url) do |req|
        req.headers['Content-Type'] = 'application/json'
        req.body = {
          event: "deal_created",
          data: @record.as_json(include: :contact)
        }.to_json
      end
    rescue => e
      Rails.logger.error "Workflow Action Error (SendWebhook): #{e.message}"
    end
  end
end
