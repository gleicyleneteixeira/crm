module Accounts
  module Campaigns
    class InitializeContactsService
      def self.call(campaign)
        new(campaign).call
      end

      def initialize(campaign)
        @campaign = campaign
        @account = campaign.account
        @data = campaign.spreadsheet_data
        @mapping = campaign.mapping
      end

      def call
        return if @data.blank? || @mapping.blank?

        contacts_to_upsert = []
        now = Time.current

        # Skip header
        rows = @data.drop(1)

        rows.each do |row|
          contact_params = prepare_contact_params(row)
          next if contact_params[:phone].blank?

          # Ensure required timestamps for upsert_all
          contact_params[:created_at] = now
          contact_params[:updated_at] = now

          contacts_to_upsert << contact_params
        end

        if contacts_to_upsert.any?
          # Upsert contacts based on phone number (unique constraint)
          @account.contacts.upsert_all(
            contacts_to_upsert,
            unique_by: :phone,
            update_only: [:full_name, :email, :custom_attributes, :updated_at]
          )
        end
      end

      private

      def prepare_contact_params(row)
        params = { custom_attributes: {} }
        
        @mapping.each do |header, field|
          val = row[@data.first.index(header)]
          next if val.blank?

          if field.start_with?('contact.')
            attr = field.split('.').last
            if attr == 'full_name' || attr == 'email' || attr == 'phone'
              params[attr.to_sym] = val
            else
              params[:custom_attributes][attr] = val
            end
          elsif field == 'extra_variable'
            params[:custom_attributes][header.parameterize.underscore] = val
          end
        end

        # Basic phone cleaning if not already handled by controller logic
        params[:phone] = format_phone(params[:phone]) if params[:phone].present?
        
        params
      end

      def format_phone(phone)
        return nil if phone.blank?

        # Remove all non-digits
        digits = phone.to_s.gsub(/\D/, '')
        
        return nil if digits.blank?

        # Fallback DDI logic if not already handled or if data is raw
        if @campaign.insert_ddi && !digits.start_with?('55')
          digits = "55#{digits}"
        end

        # Ensure it starts with '+' as expected by the Contact model / Chatwoot integration
        "+#{digits}"
      end
    end
  end
end
