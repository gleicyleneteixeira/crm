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
            unique_by: :index_contacts_on_phone,
            update_only: [:full_name, :email, :custom_attributes, :updated_at]
          )
        end
      end

      private

      def prepare_contact_params(row)
        params = { custom_attributes: {} }
        
        @mapping.each do |key, value|
          # Detect if mapping is new format (field -> col_index) or old (header -> field)
          # New format: key is CRM field, value is index
          # Old format: key is Spreadsheet Header, value is CRM field
          
          if value.to_s.match?(/^\d+$/)
            # New format (field -> col_index)
            field = key
            col_index = value.to_i
          else
            # Old format (header -> field)
            field = value
            header_name = key
            col_index = @data.first.index(header_name)
          end

          next if col_index.nil? || row[col_index].blank?
          val = row[col_index]

          if field.start_with?('contact.')
            attr = field.split('.').last
            if attr == 'full_name' || attr == 'email' || attr == 'phone'
              params[attr.to_sym] = attr == 'full_name' ? val.to_s.split(' ').map(&:capitalize).join(' ') : val
            else
              params[:custom_attributes][attr] = val
            end
          elsif field == 'extra_variable' || field.start_with?('extra_')
            # Handle both old generic and new slug-based extra variables
            attr = field.start_with?('extra_') ? field.sub('extra_', '') : key.parameterize.underscore
            params[:custom_attributes][attr] = val
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
