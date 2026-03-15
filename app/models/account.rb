# == Schema Information
#
# Table name: accounts
#
#  id                  :bigint           not null, primary key
#  ai_usage            :jsonb            not null
#  currency_code       :string           default("BRL"), not null
#  name                :string           default(""), not null
#  number_of_employees :string           default("1-10"), not null
#  segment             :string           default("other"), not null
#  settings            :jsonb            not null
#  site_url            :string           default(""), not null
#  woofbot_auto_reply  :boolean          default(FALSE), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
class Account < ApplicationRecord
  include Account::Settings

  validates :name, presence: true
  validates :name, length: { maximum: 255 }
  validates :currency_code, presence: true, inclusion: { in: Money::Currency.table.keys.map(&:to_s).map(&:upcase) }

  enum segment: {
    technology: 'technology',
    health: 'health',
    finance: 'finance',
    education: 'education',
    retail: 'retail',
    services: 'services',
    manufacturing: 'manufacturing',
    telecommunications: 'telecommunications',
    transportation_logistics: 'transportation_logistics',
    real_estate: 'real_estate',
    energy: 'energy',
    agriculture: 'agriculture',
    tourism_hospitality: 'tourism_hospitality',
    entertainment_media: 'entertainment_media',
    construction: 'construction',
    public_sector: 'public_sector',
    consulting: 'consulting',
    startup: 'startup',
    ecommerce: 'ecommerce',
    security: 'security',
    automotive: 'automotive',
    other: 'other'
  }
  enum number_of_employees: {
    '1-10' => '1-10',
    '11-50' => '11-50',
    '51-200' => '51-200',
    '201-500' => '201-500',
    '501+' => '501+'
  }

  def events
    Event.all
  end

  def apps
    App.all
  end

  has_many :users, dependent: :destroy
  has_many :contacts, dependent: :destroy
  has_many :deals, dependent: :destroy
  has_many :pipelines, dependent: :destroy
  has_many :stages, through: :pipelines
  has_many :campaigns, dependent: :destroy
  has_many :products, dependent: :destroy
  has_many :custom_attribute_definitions, dependent: :destroy
  has_many :webhooks, dependent: :destroy

  # Mantendo compatibilidade com métodos auxiliares se necessário
  def custom_attributes_definitions
    custom_attribute_definitions
  end

  def site_url=(url)
    super(normalize_url(url))
  end

  def normalize_url(url)
    url = "https://#{url}" unless url.match?(%r{\Ahttp(s)?://})

    url
  end
end
