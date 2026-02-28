class Deals::BroadcastJob
  include Sidekiq::Worker
  sidekiq_options queue: 'default', retry: 3

  def perform(deal_id, action, data = {})
    deal = Deal.find_by(id: deal_id)
    
    if action == 'destroy'
      account_id = data['account_id']
      contact_id = data['contact_id']
      return unless account_id && contact_id

      # Remove from Contact Sidebar & Chatwoot Embed
      Turbo::StreamsChannel.broadcast_remove_to(
        [account_id, contact_id, :deals],
        target: "deal_#{deal_id}"
      )
      
      # Also remove from Kanban (legacy or additional safety)
      Turbo::StreamsChannel.broadcast_remove_to(
        :stages,
        target: "deal_#{deal_id}"
      )

      # Legacy JSON
      ActionCable.server.broadcast("deals_channel_#{account_id}", {
        action: 'destroy',
        deal: { id: deal_id }
      })
      return
    end

    return unless deal
    account_id = deal.contact&.account_id || deal.account_id
    contact_id = deal.contact_id

    # 1. Kanban Broadcasts (Stages)
    if action == 'create'
      # Adiciona o card no topo do estágio
      Turbo::StreamsChannel.broadcast_prepend_to(
        :stages,
        target: ActionView::RecordIdentifier.dom_id(deal.stage, :deals),
        partial: 'accounts/pipelines/deal',
        locals: { deal: deal }
      )
      # Atualiza totais do estágio
      ['all', deal.status].each do |filter|
        Turbo::StreamsChannel.broadcast_replace_to(
          :stages,
          target: "stage-#{deal.stage_id}-#{filter}-kaban-details",
          partial: 'accounts/stages/kanban_details',
          locals: { stage: deal.stage, filter_status_deal: filter }
        )
      end
    elsif action == 'update'
      # Atualiza o card em si (onde quer que esteja)
      Turbo::StreamsChannel.broadcast_replace_to(
        deal,
        partial: 'accounts/pipelines/deal',
        locals: { deal: deal }
      )

      # Se mudou de estágio, move o card e atualiza ambos os estágios
      if data['previous_stage_id'] && data['previous_stage_id'] != deal.stage_id
        old_stage = Stage.find_by(id: data['previous_stage_id'])
        
        # Remove do antigo e adiciona no novo
        Turbo::StreamsChannel.broadcast_remove_to(:stages, target: ActionView::RecordIdentifier.dom_id(deal))
        Turbo::StreamsChannel.broadcast_append_to(
          :stages,
          target: ActionView::RecordIdentifier.dom_id(deal.stage, :deals),
          partial: 'accounts/pipelines/deal',
          locals: { deal: deal }
        )

        # Atualiza totais de ambos
        [old_stage, deal.stage].compact.each do |stg|
          ['all', deal.status].each do |filter|
            Turbo::StreamsChannel.broadcast_replace_to(
              :stages,
              target: "stage-#{stg.id}-#{filter}-kaban-details",
              partial: 'accounts/stages/kanban_details',
              locals: { stage: stg, filter_status_deal: filter }
            )
          end
        end
      elsif data['status_changed']
        # Se mudou o status, talvez precise remover do filtro atual no Kanban
        Turbo::StreamsChannel.broadcast_remove_to(:stages, target: ActionView::RecordIdentifier.dom_id(deal))
        
        # E atualizar totais
        ['all', deal.status, data['previous_status']].compact.uniq.each do |filter|
          Turbo::StreamsChannel.broadcast_replace_to(
            :stages,
            target: "stage-#{deal.stage_id}-#{filter}-kaban-details",
            partial: 'accounts/stages/kanban_details',
            locals: { stage: deal.stage, filter_status_deal: filter }
          )
        end
      end
    end

    # 2. Contact Sidebar & Chatwoot Embed Broadcasts
    if contact_id
      target_sidebar = ActionView::RecordIdentifier.dom_id(deal.contact, :deals)
      target_embed = ActionView::RecordIdentifier.dom_id(deal.contact, :chatwoot_embed_deals)
      
      if action == 'create'
        # Sidebar
        Turbo::StreamsChannel.broadcast_prepend_to(
          [account_id, contact_id, :deals],
          target: target_sidebar,
          partial: 'accounts/deals/deal_row',
          locals: { deal: deal }
        )
        # Embed (using its specific partial)
        Turbo::StreamsChannel.broadcast_prepend_to(
          [account_id, contact_id, :deals],
          target: target_embed,
          partial: 'accounts/contacts/chatwoot_embed/deal',
          locals: { deal: deal }
        )
      elsif action == 'update'
        # Sidebar Update
        Turbo::StreamsChannel.broadcast_replace_to(
          [account_id, contact_id, :deals],
          target: ActionView::RecordIdentifier.dom_id(deal),
          partial: 'accounts/deals/deal_row',
          locals: { deal: deal }
        )
        # Embed Update
        Turbo::StreamsChannel.broadcast_replace_to(
          [account_id, contact_id, :deals],
          target: ActionView::RecordIdentifier.dom_id(deal, :chatwoot_embed),
          partial: 'accounts/contacts/chatwoot_embed/deal',
          locals: { deal: deal }
        )
      end
    end

    # 3. Deal Details Page Broadcast
    Turbo::StreamsChannel.broadcast_replace_to(
      [account_id, :deal],
      target: ActionView::RecordIdentifier.dom_id(deal, :deal_show_page_overview),
      partial: 'accounts/deals/details/show',
      locals: { model: deal, update_path: Rails.application.routes.url_helpers.account_deal_path(account_id, deal) }
    )

    # 4. JSON Legacy Broadcast (keeping it for compatibility)
    ActionCable.server.broadcast("deals_channel_#{account_id}", {
      action: action,
      deal: deal.as_json(include: [:contact, :stage, :pipeline])
    })
  rescue StandardError => e
    Rails.logger.error("Error in Deals::BroadcastJob: #{e.message}")
  end
end
