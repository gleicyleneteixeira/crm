class CampaignCategory < ApplicationRecord
  has_many :campaigns
  belongs_to :default_pipeline, class_name: 'Pipeline', optional: true
  belongs_to :default_stage, class_name: 'Stage', optional: true

  validates :name, presence: true
end
