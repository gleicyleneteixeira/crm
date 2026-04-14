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
    running: 'running',
    paused: 'paused',
    completed: 'completed',
    failed: 'failed',
    canceled: 'canceled',
    processing: 'processing'
  }

  def ai_randomization?
    ai_randomization
  end

  def allowed_time?
    now = Time.current
    
    # Check Allowed Days (0=Sunday, 1=Monday, ..., 6=Saturday)
    # If allowed_days is empty/blank, all days are allowed
    if allowed_days.present? && !allowed_days.include?(now.wday.to_s) && !allowed_days.include?(now.wday)
      return false
    end

    # Check Hour Window
    # If start_hour or end_hour is blank, ignore time restriction
    return true if start_hour.blank? || end_hour.blank?

    current_time_str = now.strftime("%H:%M")
    current_time_str >= start_hour && current_time_str <= end_hour
  end

  def inbox_ids
    chatwoot_inbox_ids || []
  end

  def sequence
    message_sequence || []
  end

  def total_leads
    return 0 if spreadsheet_data.blank?
    [spreadsheet_data.size - 1, 0].max
  end

  after_initialize :set_defaults

  private

  def set_defaults
    self.ai_randomization = false if ai_randomization.nil?
    self.ai_text_enabled = false if ai_text_enabled.nil?
    self.ai_audio_enabled = false if ai_audio_enabled.nil?
    self.allowed_days ||= []
    self.start_hour ||= "00:00"
    self.end_hour ||= "23:59"
  end
end
