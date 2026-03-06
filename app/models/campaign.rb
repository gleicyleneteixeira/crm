class Campaign < ApplicationRecord
  belongs_to :account
  belongs_to :pipeline, optional: true
  belongs_to :stage, optional: true
  has_many :campaign_logs, dependent: :destroy

  enum status: {
    draft: 'draft',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed'
  }

  def inbox_ids
    chatwoot_inbox_ids || []
  end

  def sequence
    message_sequence || []
  end
end
