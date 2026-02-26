class Deals::BroadcastJob
  include Sidekiq::Worker
  sidekiq_options queue: 'default', retry: 3

  def perform(deal_id, action)
    deal = Deal.find_by(id: deal_id)
    return unless deal

    # Transmite o evento JSON para o canal de negócios
    # Isso permite que qualquer frontend (Woofeed ou Chatwoot) escute e reaja
    ActionCable.server.broadcast("deals_channel", {
      action: action,
      deal: deal.as_json(include: [:contact, :stage, :pipeline])
    })
  rescue StandardError => e
    Rails.logger.error("Error in Deals::BroadcastJob: #{e.message}")
  end
end
