module Workflows
  class BaseActionJob < ApplicationJob
    queue_as :default

    def perform(model_name, model_id, config_data)
      @record = model_name.constantize.find_by(id: model_id)
      @config = config_data

      return unless @record

      execute
    end

    def execute
      raise NotImplementedError, "Subclasses must implement the execute method"
    end
  end
end
