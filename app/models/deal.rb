# == Schema Information
#
# Table name: deals
#
#  id                                  :bigint           not null, primary key
#  custom_attributes                   :jsonb
#  lost_at                             :datetime
#  lost_reason                         :string           default(""), not null
#  name                                :string           default(""), not null
#  position                            :integer          default(1), not null
#  priority_level                      :integer          default(0), not null
#  status                              :string           default("open"), not null
#  total_deal_products_amount_in_cents :bigint           default(0), not null
#  won_at                              :datetime
#  created_at                          :datetime         not null
#  updated_at                          :datetime         not null
#  contact_id                          :bigint           not null
#  created_by_id                       :integer
#  pipeline_id                         :bigint
#  stage_id                            :bigint           not null
#
# Indexes
#
#  index_deals_on_contact_id     (contact_id)
#  index_deals_on_created_by_id  (created_by_id)
#  index_deals_on_pipeline_id    (pipeline_id)
#  index_deals_on_stage_id       (stage_id)
#
# Foreign Keys
#
#  fk_rails_...  (contact_id => contacts.id)
#  fk_rails_...  (created_by_id => users.id) ON DELETE => nullify
#  fk_rails_...  (stage_id => stages.id)
#
class Deal < ApplicationRecord
  include ActionView::RecordIdentifier
  include CustomAttributes
  include Deal::EventCreator
  include Deal::HandleInCentsValues

  belongs_to :contact
  belongs_to :stage
  belongs_to :pipeline
  belongs_to :creator, class_name: 'User', foreign_key: 'created_by_id', optional: true
  acts_as_list scope: :stage
  has_many :events, dependent: :destroy
  has_many :activities
  has_many :contact_events, through: :primary_contact, source: :events
  has_many :deal_products, dependent: :destroy
  has_many :deal_assignees, dependent: :destroy
  has_many :users, through: :deal_assignees

  accepts_nested_attributes_for :contact

  enum status: { 'open': 'open', 'won': 'won', 'lost': 'lost' }
  enum priority_level: { none: 0, low: 1, medium: 2, high: 3 }, _prefix: true

  FORM_FIELDS = %i[name manual_amount_in_cents chatwoot_conversation_url creator total_amount_in_cents]

  SHOW_FIELDS = { deal_page_overview_details: [:name,
                                               { relations: { stage: :name, creator: :full_name } },
                                               :total_amount_in_cents] }.freeze
  before_validation do
    self.account = @current_account if account.blank? && @current_account.present?

    self.pipeline = stage.pipeline if pipeline.blank? && stage.present?

    self.stage = pipeline.stages.first if stage.blank? && pipeline.present?
  end
  after_destroy_commit { broadcast_remove_to :stages, target: self }

  after_commit :broadcast_kanban_card, on: :update, if: :broadcast_kanban_card?
  after_create_commit :broadcast_kanban_card_on_create
  after_create_commit { Deals::BroadcastJob.perform_async(id, 'create') }
  after_update_commit :sync_deal_async, if: :should_sync_deal?
  after_destroy_commit { Deals::BroadcastJob.perform_async(id, 'destroy') }

  def should_sync_deal?
    saved_change_to_stage_id? || 
    saved_change_to_manual_amount_in_cents? || 
    saved_change_to_status? || 
    saved_change_to_name?
  end

  def sync_deal_async
    Deals::BroadcastJob.perform_async(id, 'update')
  end
  # after_update_commit lambda {
  #                       broadcast_updates
  #                     }
  # after_create_commit lambda {
  #                       Stages::BroadcastUpdatesWorker.perform_async(stage.id, status)
  #                     }

  # def broadcast_updates
  #   broadcast_replace_later_to self, partial: 'accounts/pipelines/deal', locals: { pipeline: }

  #   if previous_changes.except('updated_at').keys == ['position'] || previous_changes.empty?
  #     Stages::BroadcastUpdatesWorker.perform_async(stage.id,
  #                                                  status)
  #   end

  #   if previous_changes.except('updated_at').keys == ['status']
  #     previous_changes['status'].each do |status|
  #       Stages::BroadcastUpdatesWorker.perform_async(stage.id, status)
  #     end
  #   end

  #   return unless previous_changes.key?('stage_id')

  #   previous_changes['stage_id'].each do |stage_id|
  #     Stages::BroadcastUpdatesWorker.perform_async(stage_id, status)
  #   end
  # end

  def self.ransackable_attributes(_auth_object = nil)
    %w[]
  end

  def self.ransackable_associations(_auth_object = nil)
    %w[users]
  end

  def total_amount_in_cents
    return manual_amount_in_cents if respond_to?(:manual_amount_in_cents) && manual_amount_in_cents.positive?

    total_deal_products_amount_in_cents
  end

  def next_event_planned?
    next_event_planned
  rescue StandardError
    false
  end

  def next_event_planned
    if events.loaded?
      planned_events = events.select do |event|
        !event.done? && event.auto_done == false && event.scheduled_at.present?
      end
      planned_events.min_by(&:scheduled_at)
    else
      events.planned.first
    end
  rescue StandardError
    nil
  end

  def self.csv_header(account_id)
    custom_fields = CustomAttributeDefinition.where(attribute_model: 'deal_attribute').map do |i|
      "custom_attributes.#{i.attribute_key}"
    end
    column_names.excluding('account_id', 'created_at', 'updated_at', 'id', 'custom_attributes') + custom_fields
  end

  ## Events

  include Wisper::Publisher
  after_commit :publish_created, on: :create
  after_commit :publish_updated, on: :update

  private

  def publish_created
    broadcast(:deal_created, self)
  end

  def publish_updated
    broadcast(:deal_updated, self)
  end

  def broadcast_kanban_card?
    saved_change_to_manual_amount_in_cents? ||
      saved_change_to_stage_id? ||
      saved_change_to_custom_attributes? ||
      saved_change_to_priority_level? ||
      saved_change_to_status? ||
      saved_change_to_name? ||
      saved_change_to_contact_id?
  end

  def broadcast_kanban_card
    broadcast_replace_later_to self,
                               partial: 'accounts/pipelines/deal',
                               locals: { deal: self }

    if saved_change_to_stage_id?
      old_stage_id = stage_id_before_last_save
      new_stage_id = stage_id

      broadcast_remove_to :stages, target: self

      broadcast_append_to :stages,
                          target: dom_id(Stage.find(new_stage_id), :deals),
                          partial: 'accounts/pipelines/deal',
                          locals: { deal: self }

      ['all', status].each do |filter|
        broadcast_replace_later_to :stages,
                             target: "stage-#{old_stage_id}-#{filter}-kaban-details",
                             partial: 'accounts/stages/kanban_details',
                             locals: { stage: Stage.find(old_stage_id), filter_status_deal: filter }

        broadcast_replace_later_to :stages,
                             target: "stage-#{new_stage_id}-#{filter}-kaban-details",
                             partial: 'accounts/stages/kanban_details',
                             locals: { stage: Stage.find(new_stage_id), filter_status_deal: filter }
      end
    elsif saved_change_to_status?
      # Remove o card do estágio atual quando o status muda (ex.: open -> won/lost)
      broadcast_remove_to :stages, target: self

      # Atualiza os detalhes do estágio para filtros relevantes
      filters = ['all', status, status_before_last_save].compact.uniq
      filters.each do |filter|
        broadcast_replace_later_to :stages,
                             target: "stage-#{stage_id}-#{filter}-kaban-details",
                             partial: 'accounts/stages/kanban_details',
                             locals: { stage: Stage.find(stage_id), filter_status_deal: filter }
      end
    elsif saved_change_to_manual_amount_in_cents?
      ['all', status].each do |filter|
        broadcast_replace_later_to :stages,
                             target: "stage-#{stage_id}-#{filter}-kaban-details",
                             partial: 'accounts/stages/kanban_details',
                             locals: { stage: Stage.find(stage_id), filter_status_deal: filter }
      end
    end
  end

  def broadcast_kanban_card_on_create
    # Adiciona o card imediatamente no topo da coluna do estágio atual
    broadcast_prepend_later_to :stages,
                               target: dom_id(Stage.find(stage_id), :deals),
                               partial: 'accounts/pipelines/deal',
                               locals: { deal: self }

    # Atualiza os detalhes do estágio (valores e quantidade) para filtros relevantes
    ['all', status].each do |filter|
      broadcast_replace_to :stages,
                           target: "stage-#{stage_id}-#{filter}-kaban-details",
                           partial: 'accounts/stages/kanban_details',
                           locals: { stage: Stage.find(stage_id), filter_status_deal: filter }
    end
  end
end
