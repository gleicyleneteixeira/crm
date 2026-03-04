class Workflow < ApplicationRecord
  include Applicable

  validates :title, :trigger_type, :action_type, presence: true

  # Virtual attribute if not in db schema yet, but we added it in migration anyway
  # If Applicable is included, it defines its own account/account_id virtual methods
  # But since we added a real column, it will map to it.

  def self.ransackable_attributes(_auth_object = nil)
    %w[title trigger_type action_type active]
  end

  def self.available_triggers
    [
      ['Negócio Criado', 'Workflows::Triggers::DealCreated'],
      ['Negócio Atualizado', 'Workflows::Triggers::DealUpdated']
    ]
  end

  def self.available_actions
    [
      ['Enviar Webhook', 'Workflows::SendWebhookJob'],
      ['Enviar WhatsApp', 'Workflows::SendWhatsAppJob']
    ]
  end
end
