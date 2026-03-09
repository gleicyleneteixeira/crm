class Accounts::Settings::AiSettingsController < InternalController
  def index
    @ai_providers = current_user.account.ai_providers.order(created_at: :desc)
    @ai_prompts = current_user.account.ai_prompts.order(:context)
  end
end
