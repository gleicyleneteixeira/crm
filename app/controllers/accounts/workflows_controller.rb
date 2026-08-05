class Accounts::WorkflowsController < InternalController
  before_action :set_workflow, only: %i[edit update destroy]

  def index
    @workflows = Workflow.where(account_id: current_user.account.id).order(created_at: :desc)
  end

  def new
    @workflow = Workflow.new
  end

  def edit; end

  def create
    @workflow = current_user.account.workflows.new(workflow_params)

    if @workflow.save
      redirect_to account_workflows_path(current_user.account), notice: "Workflow criado com sucesso."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @workflow.update(workflow_params)
      redirect_to account_workflows_path(current_user.account), notice: "Workflow atualizado com sucesso."
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @workflow.destroy
    redirect_to account_workflows_path(current_user.account), notice: "Workflow excluído com sucesso."
  end

  private

  def set_workflow
    @workflow = current_user.account.workflows.find(params[:id])
  end

  def workflow_params
    params.require(:workflow).permit(:title, :trigger_type, :action_type, :active, data: {})
  end
end
