require 'rails_helper'

RSpec.describe "Accounts::CampaignsFlow", type: :request do
  let(:account) { create(:account) }
  let(:user) { create(:user, account: account) }
  let(:campaign_category) { create(:campaign_category, account: account) }

  before do
    sign_in user
  end

  describe "Campaign Creation and Mapping" do
    it "creates a campaign and cleans phone numbers during mapping" do
      post account_campaigns_path(account), params: {
        campaign: {
          name: "Test Campaign",
          campaign_category_id: campaign_category.id,
          spreadsheet_data: [
            ["Nome", "Telefone"],
            ["John Doe", "(65) 99617-0176"],
            ["Jane Smith", "65988887777"]
          ].to_json,
          mapping: { "0" => "contact.full_name", "1" => "contact.phone" }
        }
      }
      expect(response).to redirect_to(composition_account_campaign_path(account, Campaign.last))
      campaign = Campaign.last
      
      # 4. Verify Contacts were created with cleaned phones
      # InitializeContactsService is called in update_mapping
      contact1 = account.contacts.find_by(full_name: "John Doe")
      expect(contact1).not_to be_nil
      # (65) 99617-0176 -> +65996170176 (assuming insert_ddi is false in this test)
      expect(contact1.phone).to eq("+65996170176")
      
      contact2 = account.contacts.find_by(full_name: "Jane Smith")
      expect(contact2.phone).to eq("+65988887777")
    end
    
    it "handles insert_ddi correctly" do
      campaign = create(:campaign, account: account, insert_ddi: true, spreadsheet_data: [["Nome", "Telefone"], ["Test", "65996170176"]])
      
      mapping = { "Nome" => "contact.full_name", "Telefone" => "contact.phone" }
      
      patch update_mapping_account_campaign_path(account, campaign), params: {
        campaign: { mapping: mapping }
      }
      
      contact = account.contacts.find_by(full_name: "Test")
      # Should prepend 55
      expect(contact.phone).to eq("+5565996170176")
    end
  end
end
