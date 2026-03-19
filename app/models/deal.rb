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

  belongs_to :contact, touch: true
  belongs_to :stage
  belongs_to :pipeline
  belongs_to :creator, class_name: 'User', foreign_key: 'created_by_id', optional: true
  belongs_to :campaign, optional: true
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

  after_create_commit { Deals::BroadcastJob.perform_async(id, 'create') }
  after_update_commit :sync_deal_async, if: :should_sync_deal?
  after_destroy_commit { Deals::BroadcastJob.perform_async(id, 'destroy', { 'contact_id' => contact_id, 'account_id' => account_id }) }

  def should_sync_deal?
    saved_change_to_stage_id? || 
    saved_change_to_manual_amount_in_cents? || 
    saved_change_to_total_deal_products_amount_in_cents? ||
    saved_change_to_custom_attributes? ||
    saved_change_to_status? || 
    saved_change_to_name? ||
    saved_change_to_priority_level? ||
    saved_change_to_contact_id?
  end

  def sync_deal_async
    data = {}
    data['previous_stage_id'] = stage_id_before_last_save if saved_change_to_stage_id?
    data['status_changed'] = true if saved_change_to_status?
    data['previous_status'] = status_before_last_save if saved_change_to_status?
    
    Deals::BroadcastJob.perform_async(id, 'update', data)
    broadcast_deal_updates
  end

  def broadcast_deal_updates
    return unless saved_change_to_status? || saved_change_to_stage_id?

    # Surgical updates for real-time reactivity (ActionCable)
    broadcast_replace_to self, target: "status_badge_deal_#{id}", partial: 'accounts/deals/details/status_badge', locals: { model: self }
    broadcast_replace_to self, target: "stages_nav_deal_#{id}", partial: 'components/deals/stages_nav', locals: { deal: self }
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
  after_commit :trigger_workflows, on: :create
  after_commit :trigger_update_workflows, on: :update

  private

  def trigger_workflows
    Workflows::Manager.call('Workflows::Triggers::DealCreated', self)
  end

  def trigger_update_workflows
    Workflows::Manager.call('Workflows::Triggers::DealUpdated', self)
  end

  def publish_created
    broadcast(:deal_created, self)
  end

  def publish_updated
    broadcast(:deal_updated, self)
  end
end
