
File.open('c:/Users/DELL/OneDrive/Área de Trabalho/git/woofed-crm/debug_output.txt', 'w') do |f|
  # Find deal or contact
  search_term = 'Eduardo Abdala'
  deal = Deal.find_by('name ILIKE ?', "%#{search_term}%")
  contact = Contact.find_by('full_name ILIKE ?', "%#{search_term}%")

  target_deal = deal || contact&.deals&.first

  if target_deal
    f.puts "DEAL FOUND: #{target_deal.name} (ID: #{target_deal.id})"
    f.puts "Next Event Planned Method: #{target_deal.next_event_planned&.id.inspect}"
    
    target_deal.events.each do |e|
      f.puts "EVENT ID: #{e.id}"
      f.puts "  Kind: #{e.kind}"
      f.puts "  Scheduled At: #{e.scheduled_at.inspect}"
      f.puts "  Done At: #{e.done_at.inspect}"
      f.puts "  Auto Done: #{e.auto_done}"
      f.puts "  Planned Scope Check: #{Event.planned.where(id: e.id).exists?}"
    end
  else
    f.puts "NO DEAL OR CONTACT FOUND FOR #{search_term}"
    f.puts "Recent deals:"
    Deal.order(created_at: :desc).limit(20).each do |d|
      f.puts "  #{d.name} (Contact: #{d.contact&.full_name}, ID: #{d.id})"
    end
  end
end
