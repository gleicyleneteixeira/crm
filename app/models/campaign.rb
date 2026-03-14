class Campaign < ApplicationRecord
  belongs_to :account
  validates :name, presence: true
  belongs_to :pipeline, optional: true
  belongs_to :stage, optional: true
  belongs_to :campaign_category, optional: true
  has_many :campaign_logs, dependent: :destroy
  has_many :deals

  enum status: {
    draft: 'draft',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed'
  }

  def ai_randomization?
    ai_randomization
  end

  def inbox_ids
    chatwoot_inbox_ids || []
  end

  def sequence
    message_sequence || []
  end
end
