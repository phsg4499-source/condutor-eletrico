import type { Client } from '../types';

// Um orçamento (ou ordem de serviço) pode estar ligado a um cliente cadastrado (client_id)
// OU trazer os dados do cliente direto no próprio registro, sem exigir cadastro prévio
// ("cliente avulso"). Esta função resolve qual conjunto de dados usar para exibição,
// PDF e WhatsApp, sempre devolvendo algo exibível mesmo se nada estiver preenchido.
export interface ClienteEntity {
  client_id?: string | null;
  cliente_nome_avulso?: string | null;
  cliente_telefone_avulso?: string | null;
  cliente_whatsapp_avulso?: string | null;
}

export interface ResolvedClienteInfo {
  nome: string;
  telefone: string;
  whatsapp: string;
  cadastrado: boolean;
}

export function resolveClienteInfo(entity: ClienteEntity, clients: Client[]): ResolvedClienteInfo {
  if (entity.client_id) {
    const client = clients.find(c => c.id === entity.client_id);
    if (client) {
      return { nome: client.nome, telefone: client.telefone, whatsapp: client.whatsapp, cadastrado: true };
    }
  }
  return {
    nome: entity.cliente_nome_avulso || 'Cliente não identificado',
    telefone: entity.cliente_telefone_avulso || '',
    whatsapp: entity.cliente_whatsapp_avulso || entity.cliente_telefone_avulso || '',
    cadastrado: false,
  };
}
