class Campaign < ApplicationRecord
  belongs_to :account
  belongs_to :pipeline, optional: true
  belongs_to :stage, optional: true
  belongs_to :campaign_category, optional: true
  has_many :campaign_logs, dependent: :destroy
  has_many :deals

  belongs_to :prompt_a, class_name: 'AiPrompt', optional: true
  belongs_to :prompt_b, class_name: 'AiPrompt', optional: true

  enum status: {
    draft: 'draft',
    scheduled: 'scheduled',
    running: 'running',
    paused: 'paused',
    completed: 'completed',
    failed: 'failed',
    processing: 'processing'
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
