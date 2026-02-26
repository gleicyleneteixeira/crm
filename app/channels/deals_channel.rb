class DealsChannel < ApplicationCable::Channel
  def subscribed
    stream_from "deals_channel"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
