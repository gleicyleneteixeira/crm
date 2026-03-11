class Accounts::CampaignCategoriesController < InternalController
  before_action :set_campaign_category, only: %i[edit update destroy]

  def index
    @campaign_categories = CampaignCategory.all
  end

  def new
    @campaign_category = CampaignCategory.new
  end

  def edit; end

  def create
    @campaign_category = CampaignCategory.new(campaign_category_params)

    if @campaign_category.save
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to account_campaign_categories_path(current_user.account), notice: 'Categoria de campanha criada com sucesso.' }
      end
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @campaign_category.update(campaign_category_params)
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to account_campaign_categories_path(current_user.account), notice: 'Categoria de campanha atualizada com sucesso.' }
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @campaign_category.destroy
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to account_campaign_categories_path(current_user.account), notice: 'Categoria de campanha removida.' }
    end
  end

  private

  def set_campaign_category
    @campaign_category = CampaignCategory.find(params[:id])
  end

  def campaign_category_params
    params.require(:campaign_category).permit(:name, :value_proposition, :advantages, :restrictions)
  end
end
