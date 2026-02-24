class ApplicationController < ActionController::Base
  include Localized
  include Pagy::Backend

  if ENV['HIGHLIGHT_PROJECT_ID'].present?
    require 'highlight'
    include Highlight::Integrations::Rails
    around_action :with_highlight_context
  end
  before_action :set_account
  before_action :setup_installation if Installation.installation_flow?
  helper_method :super_admin?

  private

  def setup_installation
    if Installation.installation_flow? && !request.path.include?('/installation')
      redirect_to installation_new_path and return
    end
  end

  def set_account
    @account = Current.account
  end

  def super_admin?
    return false unless respond_to?(:current_user) && current_user
    Installation.first&.user_id == current_user.id
  end
end
