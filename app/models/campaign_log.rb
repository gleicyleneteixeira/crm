class CampaignLog < ApplicationRecord
  belongs_to :campaign
  belongs_to :contact, optional: true
  belongs_to :deal, optional: true

  validates :status, presence: true
end
