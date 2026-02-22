class Accounts::StagesController < InternalController
  before_action :set_stage, only: %i[show]

  def show
    @filter_status_deal = if params[:filter_status_deal].present?
                            params[:filter_status_deal]
                          else
                            'open'
                          end
    deals_scope = @stage.deals.includes(:contact, :events, :users, :creator).order(position: :desc)
    deals_scope = deals_scope.where(status: @filter_status_deal) unless @filter_status_deal == 'all'
    @pagy, @deals = pagy(deals_scope, items: 8)
  end

  private

  def set_stage
    @stage = Stage.find(params[:id])
  end
end
