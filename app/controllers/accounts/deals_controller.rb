class Accounts::DealsController < InternalController
  include DealProductConcern
  include DealConcern

  before_action :set_deal,
                only: %i[show edit update destroy events_to_do events_done deal_products deal_assignees mark_as_lost mark_as_won]
  before_action :set_deal_product, only: %i[edit_deal_product
                                            update_deal_product]

  # GET /deals or /deals.json
  def index
    @first_pipeline = Pipeline.first
    @deals = if params[:query].present?
              Deal.left_joins(:contact)
                  .where(
                    'deals.name ILIKE :search OR ' +
                    'contacts.full_name ILIKE :search OR ' +
                    'deals.id = :id',
                    search: "%#{params[:query]}%",
                    id: params[:query].to_i
                  )
                  .order(updated_at: :desc)
              else
                Deal.all.order(created_at: :desc)
              end

    @pagy, @deals = pagy(@deals)
  end

  # GET /deals/1 or /deals/1.json
  def show; end

  # GET /deals/new
  def new
    @deal = Deal.new
    @stages = Stage.ordered_by_pipeline_and_position
    @deal.contact_id = params.dig(:deal, :contact_id)
    @deal.chatwoot_conversation_url = params.dig(:deal, :chatwoot_conversation_url)

    if @deal.contact_id.blank?
      @deal.errors.add(:contact, :blank)
      render :new_select_contact, status: :unprocessable_entity
      return
    end
  end

  def new_select_contact
    @deal = Deal.new
  end

  def add_contact
    @deal = Deal.find(params[:deal_id])
  end

  def commit_add_contact
    @deal = Deal.find(params[:deal_id])
    @new_contact = Contact.find(params['deal']['contact_id'])
    @deal.contacts.push(@new_contact)

    if Deal::CreateOrUpdate.new(@deal, deal_params).call
      redirect_to account_deal_path(current_user.account, @deal)
    else
      render :add_contact, status: :unprocessable_entity
    end
  rescue StandardError
    render :add_contact, status: :unprocessable_entity
  end

  def remove_contact
    @deal = Deal.find(params[:deal_id])
    @contacts_deal = @deal.contacts_deals.find_by_contact_id(params['contact_id'])

    if @contacts_deal.destroy
      redirect_to account_deal_path(current_user.account, @deal)
    else
      render :show, status: :unprocessable_entity
    end
  rescue StandardError
    render :show, status: :unprocessable_entity
  end

  # GET /deals/1/edit
  def edit
    @stages = Stage.ordered_by_pipeline_and_position
  end

  def edit_custom_attributes
    @deal = current_user.account.deals.find(params[:deal_id])
    @custom_attribute_definitions = current_user.account.custom_attribute_definitions.deal_attribute
  end

  # POST /deals or /deals.json
  def create
    @stages = Stage.ordered_by_pipeline_and_position
    @deal = DealBuilder.new(current_user, deal_params).perform

    if Deal::CreateOrUpdate.new(@deal, deal_params).call
      redirect_to account_deal_path(current_user.account, @deal)
    else
      render :new, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /deals/1 or /deals/1.json
  def update
    @stages = Stage.ordered_by_pipeline_and_position
    if params[:deal][:att_key].present?
      @deal.custom_attributes[params[:deal][:att_key]] = params[:deal][:att_value]
    end

    attributes = deal_params.to_h

    if attributes['custom_attributes'].present?
      existing_custom_attributes = @deal.custom_attributes || {}
      attributes['custom_attributes'] = existing_custom_attributes.deep_merge(attributes['custom_attributes'])
    end

    @deal.assign_attributes(attributes)

    if Deal::CreateOrUpdate.new(@deal, attributes).call
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: [
            turbo_stream.replace(helpers.dom_id(@deal), partial: 'accounts/pipelines/deal', locals: { deal: @deal, loading: true }),
            turbo_stream.replace(helpers.dom_id(@deal, :deal_show_page_overview), partial: 'accounts/deals/details/show', locals: { model: @deal, update_path: account_deal_path(current_user.account, @deal) })
          ]
        end
        format.html { redirect_to account_deal_path(current_user.account, @deal) }
      end
    else
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /deals/1 or /deals/1.json
  def destroy
    @deal.destroy
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to root_path, notice: t('flash_messages.deleted', model: Deal.model_name.human) }
      format.json { head :no_content }
    end
  end

  def events_to_do
    @pagy, @events = pagy(@deal.contact.events.to_do, items: 5)
    respond_to do |format|
      format.turbo_stream
      format.html
    end
  end

  def events_done
    @pagy, @events = pagy(@deal.contact.events.done, items: 5)
    respond_to do |format|
      format.turbo_stream
      format.html
    end
  end

  def deal_products
    @deal_products = @deal.deal_products
  end

  def deal_assignees
    @deal_assignees = @deal.deal_assignees
  end

  def edit_deal_product
  end

  def update_deal_product
    if DealProduct::CreateOrUpdate.new(@deal_product, deal_product_params).call
      respond_to do |format|
        format.html do
          redirect_to deal_products_account_deal_path(current_user.account, @deal_product.deal)
        end
        format.turbo_stream
      end
    else
      render :edit_deal_product, status: :unprocessable_entity
    end
  end

  def mark_as_lost
    @stages = Stage.ordered_by_pipeline_and_position
    @lost_reasons = DealLostReason.order(:name).pluck(:name).uniq
    @exists_deal_lost_reasons = DealLostReason.exists?
    @allow_edit_lost_at = Current.account.deal_allow_edit_lost_at_won_at
  end

  def mark_as_won
    @stages = Stage.ordered_by_pipeline_and_position
    @allow_edit_won_at = Current.account.deal_allow_edit_lost_at_won_at
  end

  def update_custom_attributes_order
    sorted_ids = params[:sorted_ids]
    deal = current_user.account.deals.find(params[:id])

    begin
      ActiveRecord::Base.transaction do
        sorted_ids.each_with_index do |id, index|
          custom_attribute_definition = current_user.account.custom_attribute_definitions.find(id)
          custom_attribute_definition.update!(position: index + 1)
        end
      end
      @message = "Ordem dos atributos atualizada com sucesso!"
      render turbo_stream: turbo_stream.update(:flash_message, partial: "components/flash_message", locals: { message: @message, type: :success })
    rescue ActiveRecord::RecordInvalid => e
      @message = "Erro ao atualizar a ordem dos atributos: #{e.message}"
      render turbo_stream: turbo_stream.update(:flash_message, partial: "components/flash_message", locals: { message: @message, type: :error }), status: :unprocessable_entity
    rescue StandardError => e
      @message = "Ocorreu um erro inesperado: #{e.message}"
      render turbo_stream: turbo_stream.update(:flash_message, partial: "components/flash_message", locals: { message: @message, type: :error }), status: :internal_server_error
    end
  end

  private

  def set_deal
    @deal = current_user.account.deals.find(params[:id])
  end

  def set_deal_product
    @deal_product = current_user.account.deal_products.find(params[:deal_product_id])
  end

  def deal_product_params
    params.require(:deal_product).permit(*permitted_deal_product_params)
  end

  # Only allow a list of trusted parameters through.
  def deal_params
    params.require(:deal).permit(*permitted_deal_params)
  end
end
