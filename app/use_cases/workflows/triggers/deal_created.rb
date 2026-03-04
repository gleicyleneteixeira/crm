module Workflows
  module Triggers
    class DealCreated < Workflows::Triggers::Base
      # Trigger-specific context
      def context
        super.merge({
          deal_name: record.name,
          contact_name: record.contact&.full_name,
          status: record.status
        })
      end
    end
  end
end
