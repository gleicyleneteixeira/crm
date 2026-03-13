module Accounts
  module Campaigns
    class ElevenLabsService
      include HTTParty
      base_uri 'https://api.elevenlabs.io/v1'

      CACHE_DIR = Rails.root.join('storage', 'campaign_audios')

      def initialize(account)
        @account = account
        @api_key = ENV['ELEVEN_LABS_API_KEY'] # Should ideally come from account settings in production
        @voice_id = "21m00Tcm4TlvDq8ikWAM" # Default voice, can be parameterized later
      end

      def self.call(account, text)
        new(account).generate(text)
      end

      def generate(text)
        return nil if text.blank? || @api_key.blank?

        clean_text = text.strip
        cache_key = Digest::MD5.hexdigest(clean_text)
        file_path = CACHE_DIR.join("#{cache_key}.mp3")

        # Return cached file if exists
        return file_url(cache_key) if File.exist?(file_path)

        # Ensure cache directory exists
        FileUtils.mkdir_p(CACHE_DIR)

        response = self.class.post(
          "/text-to-speech/#{@voice_id}",
          headers: {
            "xi-api-key" => @api_key,
            "Content-Type" => "application/json",
            "Accept" => "audio/mpeg"
          },
          body: {
            text: clean_text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          }.to_json
        )

        if response.success?
          File.open(file_path, 'wb') { |f| f.write(response.body) }
          file_url(cache_key)
        else
          Rails.logger.error("ElevenLabs Error: #{response.code} - #{response.body}")
          nil
        end
      end

      private

      def file_url(cache_key)
        # In a real production app, this would be a public cloud storage URL (S3/GCS)
        # For this implementation, we return a path or URL accessible by the CRM/Worker
        # Assuming a structure that serves storage/publicly or mapping it to a route
        "/storage/campaign_audios/#{cache_key}.mp3"
      end
    end
  end
end
