class AddChatwootConversationUrlToDeals < ActiveRecord::Migration[7.1]
  def change
    add_column :deals, :chatwoot_conversation_url, :string
  end
end

