class Accounts::Apps::Chatwoots::Create
  def self.call(account, chatwoot_params)
    chatwoot = Apps::Chatwoot.new(chatwoot_params)
    chatwoot.account = account
    if chatwoot.save
      Accounts::Apps::Chatwoots::SyncChatwootWorker.perform_async(account.id, chatwoot.id)
      { ok: chatwoot }
    else
      { error: chatwoot }
    end
  end
end
