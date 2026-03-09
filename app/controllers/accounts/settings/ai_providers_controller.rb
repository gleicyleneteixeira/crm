class Accounts::Settings::AiProvidersController < InternalController
  before_action :set_ai_provider, only: %i[edit update destroy]

  def new
    @ai_provider = current_user.account.ai_providers.new
  end

  def edit; end

  def create
    @ai_provider = current_user.account.ai_providers.new(ai_provider_params)
    if @ai_provider.save
      redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Provedor de IA criado com sucesso.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @ai_provider.update(ai_provider_params)
      redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Provedor de IA atualizado com sucesso.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @ai_provider.destroy
    redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Provedor de IA removido com sucesso.'
  end

  private

  def set_ai_provider
    @ai_provider = current_user.account.ai_providers.find(params[:id])
  end

  def ai_provider_params
    params.require(:ai_provider).permit(:name, :provider_type, :api_key, :model_name, :active)
  end
end
