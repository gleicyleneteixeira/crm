class DealsChannel < ApplicationCable::Channel
  def subscribed
    return reject if params[:account_id].blank?
    stream_from "deals_channel_#{params[:account_id]}"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
