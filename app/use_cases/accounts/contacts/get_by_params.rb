class Accounts::Contacts::GetByParams
  def self.call(account, params)
    params.stringify_keys!
    return { error: 'Not found' } if params.blank?

    params.reject! { |_key, value| value.blank? }
    
    # 1. Tenta busca exata por identificador (chatwoot_id) primeiro - Mais rápido (B-Tree index)
    if params['identifier'].present?
      contact = account.contacts.where("additional_attributes ->> 'chatwoot_id' = ?", params['identifier'].to_s).first
      return { ok: contact } if contact.present?
    end

    # 2. Tenta busca exata por telefone (B-Tree index)
    if params['phone'].present?
      s_phone = sanitized_phone(params['phone'])
      contact = account.contacts.where(phone: [s_phone, phone_with_9_digit(s_phone), phone_number_without_9_digit(s_phone)]).first
      return { ok: contact } if contact.present?
    end

    # 3. Tenta busca exata por email se presente
    if params['email'].present?
      contact = account.contacts.where('lower(email) = ?', params['email'].downcase).first
      return { ok: contact } if contact.present?
    end

    # 4. Caso não encontre exato, busca parcial como fallback (Usando índices GIN/Trigram após migration)
    query_params = []
    if params['phone'].present?
      s_phone = sanitized_phone(params['phone'])
      query_params << "phone ILIKE '%#{s_phone}%'"
    end
    
    if params['email'].present?
      query_params << "email ILIKE '%#{params['email']}%'"
    end

    contact = account.contacts.where(query_params.join(' OR ')).first if query_params.present?
    { ok: contact }
  end

  def self.build_query_conditions(params)
    params.map do |field, value|
      case field
      when 'identifier'
        "additional_attributes ->> 'chatwoot_identifier' = '#{value}'"
      else
        "#{field} ILIKE '%#{value}%'"
      end
    end
  end

  def self.phone_number_without_9_digit(phone)
    sanitized_phone = sanitized_phone(phone)

    if sanitized_phone.size == 13
      sanitized_phone
    else
      "#{sanitized_phone[0..4]}#{sanitized_phone[6..-1]}"

    end
  end

  def self.phone_with_9_digit(phone)
    sanitized_phone = sanitized_phone(phone)
    if sanitized_phone.size >= 14
      sanitized_phone
    else
      "#{sanitized_phone[0..4]}9#{sanitized_phone[5..-1]}"

    end
  end

  def self.sanitized_phone(phone_number)
    raise TypeError, 'phone_number must be a String' unless phone_number.is_a?(String)

    cleaned_phone_number = phone_number.gsub(/\D/, '')
    cleaned_phone_number.prepend('+')
    cleaned_phone_number
  end
end
