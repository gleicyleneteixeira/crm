# == Schema Information
#
# Table name: custom_attribute_definitions
#
#  id                     :bigint           not null, primary key
#  attribute_description  :text
#  attribute_display_name :string
#  attribute_key          :string
#  attribute_model        :integer          default("contact_attribute")
#  show_in_deal           :boolean          default(TRUE), not null
#  show_in_card           :boolean          default(FALSE), not null
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#
class CustomAttributeDefinition < ApplicationRecord
  include CustomAttributeDefinition::Broadcastable
  scope :with_attribute_model, lambda { |attribute_model|
                                 attribute_model.presence && where(attribute_model: attribute_model)
                               }

  validates :attribute_display_name, presence: true
  validates :attribute_key,
            presence: true,
            uniqueness: { scope: %i[attribute_model] }
  validates :attribute_model, presence: true

  enum attribute_model: { contact_attribute: 0, deal_attribute: 1, product_attribute: 2 }

  validates :show_in_deal, inclusion: { in: [true, false] }
  validates :show_in_card, inclusion: { in: [true, false] }

  validate :card_visibility_requires_deal_visibility

  private

  def card_visibility_requires_deal_visibility
    return unless show_in_card && !show_in_deal

    errors.add(:show_in_card, :invalid)
  end
end
