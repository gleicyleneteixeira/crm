module Workflows
  module Triggers
    class Base
      attr_reader :record

      def initialize(record)
        @record = record
      end

      # Define context for the action if needed
      def context
        {
          id: record.id,
          model: record.class.name,
          # Add more common fields if needed
        }
      end
    end
  end
end
