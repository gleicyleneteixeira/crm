class AddAccountIdAndPositionToCustomAttributeDefinitions < ActiveRecord::Migration[7.1]
  def up
    unless column_exists?(:custom_attribute_definitions, :account_id)
      add_reference :custom_attribute_definitions, :account, null: true, foreign_key: true
    else
      change_column_null :custom_attribute_definitions, :account_id, true
      begin
        add_foreign_key :custom_attribute_definitions, :accounts unless foreign_key_exists?(:custom_attribute_definitions, :accounts)
      rescue StandardError
      end
    end

    unless column_exists?(:custom_attribute_definitions, :position)
      add_column :custom_attribute_definitions, :position, :integer
    end

    account = Account.unscoped.first
    if account
      execute <<~SQL
        UPDATE custom_attribute_definitions
        SET account_id = #{account.id}
        WHERE account_id IS NULL
      SQL
    end

    change_column_null :custom_attribute_definitions, :account_id, false
  end

  def down
    if column_exists?(:custom_attribute_definitions, :position)
      remove_column :custom_attribute_definitions, :position
    end
    if column_exists?(:custom_attribute_definitions, :account_id)
      change_column_null :custom_attribute_definitions, :account_id, true
      begin
        remove_foreign_key :custom_attribute_definitions, :accounts
      rescue StandardError
      end
    end
  end
end
