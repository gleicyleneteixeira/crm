class Deals::BusinessUpdateWorker
  include Sidekiq::Worker

  def perform(deal_id, params)
    deal = Deal.find(deal_id)
    # Convertendo chaves para string caso venham como símbolos do Sidekiq
    params = params.deep_stringify_keys
    
    Deal::CreateOrUpdate.new(deal, params).call
  rescue ActiveRecord::RecordNotFound
    # Deal foi deletado antes do worker rodar, ignoramos silenciosamente
    Rails.logger.info("Deal #{deal_id} not found in BusinessUpdateWorker. Skipping.")
  end
end
