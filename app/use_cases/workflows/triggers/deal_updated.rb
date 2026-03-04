module Workflows
  module Triggers
    class DealUpdated < Workflows::Triggers::Base
      def context
        super.merge({
          deal_name: record.name,
          contact_name: record.contact&.full_name,
          status: record.status,
          changes: record.previous_changes
        })
      end
    end
  end
end
