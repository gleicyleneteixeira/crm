class DataCleansingService
  def self.clean_email(email)
    return nil if email.blank?
    email.to_s.downcase.strip.gsub(/\s+/, '')
  end

  def self.detect_gender(name)
    return nil if name.blank?

    first_name = name.to_s.split(' ').first.downcase

    # Exceções muito comuns no Brasil
    masculine_exceptions = %w[yuri cauã kauã luca noah andrea gui davi]
    feminine_exceptions = %w[ariel ruth esther raquel miriam]

    return 'Masculino' if masculine_exceptions.include?(first_name)
    return 'Feminino' if feminine_exceptions.include?(first_name)

    # Regra geral por terminação
    if first_name.end_with?('a', 'e', 'y', 'i') && !first_name.end_with?('ne', 'le', 're')
      # Muitas vezes termina com vogal suave indica feminino
      # Mas para simplificar a heurística solicitada pelo usuário:
      if first_name.end_with?('a')
        return 'Feminino'
      end
    end

    if first_name.end_with?('o', 'r', 'l', 'n', 's')
      return 'Masculino'
    end

    # Fallback
    first_name.end_with?('a') ? 'Feminino' : 'Masculino'
  end
end
