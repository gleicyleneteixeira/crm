class AiProvider < ApplicationRecord
  belongs_to :account

  validates :name, :provider_type, :api_key, :model_name, presence: true
  
  scope :active, -> { where(active: true) }
  scope :available, -> { active.where('cooldown_until IS NULL OR cooldown_until < ?', Time.current) }

  enum provider_type: {
    openai: 'openai',
    groq: 'groq',
    openrouter: 'openrouter'
  }

  def cooldown!(error_message = nil)
    update(cooldown_until: 5.minutes.from_now, last_error: error_message)
  end
end
