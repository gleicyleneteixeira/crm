class Accounts::Settings::AiPromptsController < InternalController
  before_action :set_ai_prompt, only: %i[edit update destroy]

  def new
    @ai_prompt = current_user.account.ai_prompts.new
  end

  def edit; end

  def create
    @ai_prompt = current_user.account.ai_prompts.new(ai_prompt_params)
    if @ai_prompt.save
      redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Prompt de IA criado com sucesso.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @ai_prompt.update(ai_prompt_params)
      redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Prompt de IA atualizado com sucesso.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @ai_prompt.destroy
    redirect_to account_settings_ai_settings_path(current_user.account), notice: 'Prompt de IA removido com sucesso.'
  end

  private

  def set_ai_prompt
    @ai_prompt = current_user.account.ai_prompts.find(params[:id])
  end

  def ai_prompt_params
    params.require(:ai_prompt).permit(:context, :instruction)
  end
end
