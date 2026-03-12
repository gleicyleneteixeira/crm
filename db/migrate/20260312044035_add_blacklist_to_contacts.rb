class AddBlacklistToContacts < ActiveRecord::Migration[7.0]
  def change
    add_column :contacts, :blacklist, :boolean, default: false
  end
end
