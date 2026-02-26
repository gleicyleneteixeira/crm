class AddTrigramIndexesToContacts < ActiveRecord::Migration[7.1]
  def change
    enable_extension 'pg_trgm' unless extension_enabled?('pg_trgm')
    
    # Adicionando índices GIN para buscas rápidas com ILIKE
    # Foco no campo phone, mas full_name também ajuda na performance geral
    add_index :contacts, :phone, name: 'index_contacts_on_phone_trigram', using: :gin, opclass: :gin_trgm_ops
    add_index :contacts, :full_name, name: 'index_contacts_on_full_name_trigram', using: :gin, opclass: :gin_trgm_ops
  end
end
