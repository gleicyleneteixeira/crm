# == Schema Information
#
# Table name: stages
#
#  id          :bigint           not null, primary key
#  name        :string           default(""), not null
#  position    :integer          default(1), not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  pipeline_id :bigint           not null
#
# Indexes
#
#  index_stages_on_pipeline_id  (pipeline_id)
#
# Foreign Keys
#
#  fk_rails_...  (pipeline_id => pipelines.id)
#
class Stage < ApplicationRecord
  include Stage::Decorators
  belongs_to :pipeline
  acts_as_list scope: :pipeline
  has_many :deals, dependent: :destroy

  scope :ordered_by_pipeline_and_position, lambda {
                                             joins(:pipeline).order('pipelines.name ASC, stages.position ASC')
                                           }

  def total_amount_deals(filter_status_deal)
    query = deals
    query = query.where(status: filter_status_deal) unless filter_status_deal == 'all'
    
    # Faz o SUM direto no banco usando SQL para ser instantâneo
    # manual_amount_in_cents é a coluna prioritária no modelo Deal
    query.sum("COALESCE(NULLIF(manual_amount_in_cents, 0), total_deal_products_amount_in_cents)")
  end

  def total_quantity_deals(filter_status_deal)
    return deals.count if filter_status_deal == 'all'

    deals.where(status: filter_status_deal).count
  end
  # after_update_commit -> { Stages::BroadcastUpdatesWorker.perform_async(id) }
end
