class AiPrompt < ApplicationRecord
  belongs_to :account

  validates :context, :instruction, presence: true
  validates :context, uniqueness: { scope: :account_id }

  enum context: {
    campaign: 'campaign',
    pipeline: 'pipeline',
    contact: 'contact',
    task: 'task'
  }
end
