module Workflows
  class Manager
    def self.call(trigger_type, record)
      # Find active workflows for this trigger
      workflows = Workflow.where(trigger_type: trigger_type, active: true)

      workflows.each do |workflow|
        execute_workflow(workflow, record)
      end
    end

    def self.execute_workflow(workflow, record)
      action_class = workflow.action_type.safe_constantize
      if action_class
        # Using ActiveJob for compatibility with GoodJob/Sidekiq
        action_class.perform_later(record.class.name, record.id, workflow.data)
      else
        Rails.logger.error "Workflow Action Class not found: #{workflow.action_type}"
      end
    end
  end
end
