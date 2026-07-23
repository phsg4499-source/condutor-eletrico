// Dados de demonstração — CLARAMENTE FICTÍCIOS.
// Não representam preços oficiais de mercado nem documentos reais de pessoas.
import type { Organization, Client, Material, ServiceItem, Budget, ServiceOrder, Payment } from '../types';
import { todayISO, addDays } from '../lib/format';

export const ORG_ID = 'org-condutor-eletrico';

export const demoOrganization: Organization = {
  id: ORG_ID,
  razao_social: 'Condutor Elétrico Serviços Elétricos Ltda (dado demonstrativo)',
  nome_fantasia: 'Condutor Elétrico',
  documento: '00.000.000/0001-00 (demonstrativo)',
  telefone: '(11) 90000-0000',
  whatsapp: '5511900000000',
  email: 'contato@condutoreletrico.com.br',
  endereco: 'Rua das Instalações, 123',
  cidade: 'São Paulo',
  estado: 'SP',
  cep: '01000-000',
  cor_principal: '#16181d',
  cor_secundaria: '#f5c518',
  instagram: '@condutoreletricobrasil',
  chave_pix: 'contato@condutoreletrico.com.br (demonstrativo)',
  condicoes_padrao: 'Pagamento conforme condições combinadas na proposta. Início dos trabalhos após aprovação e confirmação do pagamento de entrada, quando aplicável.',
  prazo_validade_padrao_dias: 10,
  garantia_padrao: 'Garantia de 90 dias para serviços executados e conforme fabricante para materiais fornecidos.',
  observacoes_padrao: 'Valores sujeitos a alteração após vistoria técnica presencial.',
  modo_calculo_margem: 'markup_sobre_custo',
  margem_minima_percentual: 15,
  impostos_estimados_percentual: 6,
  responsavel: 'Felipe Ribeiro',
  experiencia: 'Mais de 10 anos de atuação em instalações elétricas residenciais, comerciais, prediais e industriais.',
  created_at: todayISO(),
  updated_at: todayISO(),
};

export const demoClients: Client[] = [
  {
    id: 'cli-1', organization_id: ORG_ID, tipo_pessoa: 'fisica', nome: 'Marcos Andrade (fictício)',
    documento: '000.000.000-00', telefone: '(11) 90000-1111', whatsapp: '5511900001111',
    email: 'marcos.demo@example.com', origem: 'indicacao', status: 'ativo', tags: ['residencial'],
    enderecos: [{ id: 'end-1', rotulo: 'Residência', cep: '04500-000', logradouro: 'Rua das Palmeiras', numero: '45', bairro: 'Jardim Sul', cidade: 'São Paulo', estado: 'SP' }],
    created_at: todayISO(), updated_at: todayISO(),
  },
  {
    id: 'cli-2', organization_id: ORG_ID, tipo_pessoa: 'juridica', nome: 'Comercial Bela Vista Ltda (fictício)',
    nome_fantasia: 'Loja Bela Vista', documento: '00.000.000/0001-11', telefone: '(11) 90000-2222',
    whatsapp: '5511900002222', email: 'contato.demo@example.com', origem: 'site', status: 'ativo', tags: ['comercial'],
    enderecos: [{ id: 'end-2', rotulo: 'Loja', cep: '01300-000', logradouro: 'Av. Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP' }],
    created_at: todayISO(), updated_at: todayISO(),
  },
  {
    id: 'cli-3', organization_id: ORG_ID, tipo_pessoa: 'fisica', nome: 'Renata Souza (fictício)',
    documento: '111.111.111-11', telefone: '(11) 90000-3333', whatsapp: '5511900003333',
    origem: 'instagram', status: 'ativo', tags: ['residencial', 'reforma'],
    enderecos: [{ id: 'end-3', rotulo: 'Apartamento', cep: '05400-000', logradouro: 'Rua Harmonia', numero: '200', complemento: 'Apto 61', bairro: 'Vila Madalena', cidade: 'São Paulo', estado: 'SP' }],
    created_at: todayISO(), updated_at: todayISO(),
  },
  {
    id: 'cli-4', organization_id: ORG_ID, tipo_pessoa: 'juridica', nome: 'Construtora Horizonte (fictício)',
    nome_fantasia: 'Horizonte Construtora', documento: '00.000.000/0001-22', telefone: '(11) 90000-4444',
    whatsapp: '5511900004444', origem: 'indicacao', status: 'ativo', tags: ['obra', 'grande projeto'],
    enderecos: [{ id: 'end-4', rotulo: 'Obra', cep: '02900-000', logradouro: 'Rua Nova Construção', numero: '10', bairro: 'Casa Verde', cidade: 'São Paulo', estado: 'SP' }],
    created_at: todayISO(), updated_at: todayISO(),
  },
  {
    id: 'cli-5', organization_id: ORG_ID, tipo_pessoa: 'fisica', nome: 'João Pedro Lima (fictício)',
    documento: '222.222.222-22', telefone: '(11) 90000-5555', whatsapp: '5511900005555',
    origem: 'google', status: 'ativo', tags: ['residencial', 'emergencial'],
    enderecos: [{ id: 'end-5', rotulo: 'Residência', cep: '03300-000', logradouro: 'Rua dos Ipês', numero: '78', bairro: 'Tatuapé', cidade: 'São Paulo', estado: 'SP' }],
    created_at: todayISO(), updated_at: todayISO(),
  },
];

// Preços abaixo são EXEMPLOS EDITÁVEIS, não tabela oficial de mercado.
function mat(id: string, codigo: string, nome: string, categoria: string, unidade: Material['unidade'], custo: number, venda: number, estoque = 50, min = 10): Material {
  return {
    id, organization_id: ORG_ID, codigo, nome, categoria, unidade,
    preco_custo: custo, preco_venda: venda, margem_padrao: Number((((venda - custo) / venda) * 100).toFixed(1)),
    estoque_atual: estoque, estoque_minimo: min, fornecedor: 'Fornecedor demonstrativo', ativo: true,
    created_at: todayISO(), updated_at: todayISO(),
  };
}

export const demoMaterials: Material[] = [
  mat('mat-1', 'FIO-1.5', 'Cabo flexível 1,5 mm²', 'Fios e cabos', 'metro', 1.2, 2.1),
  mat('mat-2', 'FIO-2.5', 'Cabo flexível 2,5 mm²', 'Fios e cabos', 'metro', 1.8, 3.0),
  mat('mat-3', 'FIO-4', 'Cabo flexível 4 mm²', 'Fios e cabos', 'metro', 2.6, 4.2),
  mat('mat-4', 'FIO-6', 'Cabo flexível 6 mm²', 'Fios e cabos', 'metro', 3.9, 6.3),
  mat('mat-5', 'FIO-10', 'Cabo flexível 10 mm²', 'Fios e cabos', 'metro', 6.5, 10.4),
  mat('mat-6', 'FIO-CHUV', 'Cabo para chuveiro', 'Fios e cabos', 'metro', 4.1, 6.8),
  mat('mat-7', 'ELDT-COR20', 'Eletroduto corrugado 20mm', 'Eletrodutos e conduítes', 'metro', 1.5, 2.6),
  mat('mat-8', 'ELDT-PVC25', 'Eletroduto rígido PVC 25mm', 'Eletrodutos e conduítes', 'metro', 3.2, 5.4),
  mat('mat-9', 'CURVA-25', 'Curva 90° para eletroduto 25mm', 'Eletrodutos e conduítes', 'unidade', 2.0, 3.8),
  mat('mat-10', 'ABR-NYLON', 'Abraçadeira de nylon', 'Eletrodutos e conduítes', 'pacote', 8.0, 14.0),
  mat('mat-11', 'DISJ-MONO', 'Disjuntor monopolar 10-32A', 'Proteção elétrica', 'unidade', 9.5, 18.0),
  mat('mat-12', 'DISJ-BI', 'Disjuntor bipolar 10-63A', 'Proteção elétrica', 'unidade', 22.0, 39.0),
  mat('mat-13', 'DISJ-TRI', 'Disjuntor tripolar 10-100A', 'Proteção elétrica', 'unidade', 45.0, 78.0),
  mat('mat-14', 'DR-25', 'Dispositivo DR 25A', 'Proteção elétrica', 'unidade', 85.0, 145.0),
  mat('mat-15', 'DPS-40', 'DPS classe II 40kA', 'Proteção elétrica', 'unidade', 65.0, 112.0),
  mat('mat-16', 'QD-12', 'Quadro de distribuição 12 disjuntores', 'Quadros elétricos', 'unidade', 60.0, 105.0),
  mat('mat-17', 'QD-24', 'Quadro de distribuição 24 disjuntores', 'Quadros elétricos', 'unidade', 110.0, 189.0),
  mat('mat-18', 'TRILHO-DIN', 'Trilho DIN 35mm (barra 1m)', 'Quadros elétricos', 'unidade', 6.0, 11.0),
  mat('mat-19', 'TOM-10A', 'Tomada 10A com placa', 'Tomadas e interruptores', 'unidade', 6.5, 12.0),
  mat('mat-20', 'TOM-20A', 'Tomada 20A com placa', 'Tomadas e interruptores', 'unidade', 8.0, 15.0),
  mat('mat-21', 'INT-SIMPLES', 'Interruptor simples com placa', 'Tomadas e interruptores', 'unidade', 5.5, 10.5),
  mat('mat-22', 'INT-PARALELO', 'Interruptor paralelo com placa', 'Tomadas e interruptores', 'unidade', 7.5, 14.0),
  mat('mat-23', 'LAMP-LED9', 'Lâmpada LED 9W bivolt', 'Iluminação', 'unidade', 5.0, 9.9),
  mat('mat-24', 'PAINEL-LED', 'Painel LED de embutir 24W', 'Iluminação', 'unidade', 28.0, 49.0),
  mat('mat-25', 'FITA-LED', 'Fita LED 5m com fonte', 'Iluminação', 'unidade', 45.0, 79.0),
  mat('mat-26', 'SENSOR-PRES', 'Sensor de presença de teto', 'Iluminação', 'unidade', 22.0, 39.0),
  mat('mat-27', 'HASTE-ATERR', 'Haste de aterramento 2,4m com conector', 'Aterramento', 'unidade', 32.0, 55.0),
  mat('mat-28', 'CABO-NU16', 'Cabo de cobre nu 16mm²', 'Aterramento', 'metro', 5.5, 9.0),
  mat('mat-29', 'WAGO-3', 'Conector Wago 3 vias', 'Fixação e acabamento', 'unidade', 2.2, 4.5),
  mat('mat-30', 'FITA-ISOL', 'Fita isolante 20m', 'Fixação e acabamento', 'unidade', 4.0, 7.5),
  mat('mat-31', 'CX-MEDICAO', 'Caixa de medição padrão concessionária', 'Padrão de entrada e medição', 'unidade', 120.0, 210.0),
  mat('mat-32', 'MOD-INTELIG', 'Módulo interruptor inteligente Wi-Fi', 'Automação e controle', 'unidade', 55.0, 98.0),
];

function svc(id: string, codigo: string, nome: string, categoria: string, unidade: ServiceItem['unidade'], valor: number, custo: number, horas?: number): ServiceItem {
  return {
    id, organization_id: ORG_ID, codigo, nome, categoria, unidade, valor_padrao: valor, custo_mao_obra: custo,
    tempo_estimado_horas: horas, margem_padrao: Number((((valor - custo) / valor) * 100).toFixed(1)),
    garantia_padrao: '90 dias', ativo: true, created_at: todayISO(), updated_at: todayISO(),
  };
}

export const demoServices: ServiceItem[] = [
  svc('srv-1', 'VIS-TEC', 'Visita técnica', 'Diagnóstico', 'servico', 90, 60, 1),
  svc('srv-2', 'DIAG-ELET', 'Diagnóstico elétrico completo', 'Diagnóstico', 'servico', 180, 110, 2),
  svc('srv-3', 'INST-TOM', 'Instalação de tomada', 'Instalações', 'unidade', 60, 35, 1),
  svc('srv-4', 'SUB-TOM', 'Substituição de tomada', 'Instalações', 'unidade', 45, 25, 0.5),
  svc('srv-5', 'INST-INT', 'Instalação de interruptor', 'Instalações', 'unidade', 60, 35, 1),
  svc('srv-6', 'INST-LUM', 'Instalação de luminária', 'Iluminação', 'unidade', 70, 40, 1),
  svc('srv-7', 'INST-PAINEL', 'Instalação de painel LED', 'Iluminação', 'unidade', 80, 45, 1),
  svc('srv-8', 'INST-FITA', 'Instalação de fita LED', 'Iluminação', 'servico', 150, 90, 2),
  svc('srv-9', 'INST-SENSOR', 'Instalação de sensor de presença', 'Iluminação', 'unidade', 90, 50, 1),
  svc('srv-10', 'TROCA-LAMP', 'Troca de lâmpada', 'Iluminação', 'unidade', 30, 15, 0.5),
  svc('srv-11', 'INST-VENT', 'Instalação de ventilador de teto', 'Instalações', 'unidade', 150, 90, 2),
  svc('srv-12', 'INST-CHUV', 'Instalação de chuveiro elétrico', 'Instalações', 'unidade', 130, 80, 1.5),
  svc('srv-13', 'CIRC-EXCL', 'Instalação de circuito exclusivo', 'Circuitos', 'servico', 280, 170, 3),
  svc('srv-14', 'CIRC-AR', 'Instalação de circuito para ar-condicionado', 'Circuitos', 'servico', 320, 190, 3.5),
  svc('srv-15', 'CIRC-FORNO', 'Instalação de circuito para forno elétrico', 'Circuitos', 'servico', 260, 160, 3),
  svc('srv-16', 'INST-DISJ', 'Instalação de disjuntor', 'Proteção', 'unidade', 60, 35, 1),
  svc('srv-17', 'INST-DR', 'Instalação de DR', 'Proteção', 'unidade', 140, 85, 1.5),
  svc('srv-18', 'INST-DPS', 'Instalação de DPS', 'Proteção', 'unidade', 130, 78, 1.5),
  svc('srv-19', 'MONT-QUADRO', 'Montagem de quadro elétrico', 'Quadros', 'servico', 450, 280, 5),
  svc('srv-20', 'REFORMA-QUADRO', 'Reforma de quadro elétrico', 'Quadros', 'servico', 380, 230, 4),
  svc('srv-21', 'INST-ATERR', 'Instalação de aterramento', 'Aterramento', 'servico', 350, 210, 4),
  svc('srv-22', 'CORR-FUGA', 'Correção de fuga de corrente', 'Manutenção', 'servico', 220, 130, 2.5),
  svc('srv-23', 'LOC-CURTO', 'Localização de curto-circuito', 'Manutenção', 'servico', 200, 120, 2.5),
  svc('srv-24', 'TROCA-FIACAO', 'Troca de fiação (por ambiente)', 'Manutenção', 'servico', 480, 300, 6),
  svc('srv-25', 'MANUT-PREV', 'Manutenção preventiva', 'Manutenção', 'servico', 160, 95, 2),
  svc('srv-26', 'ADEQ-ELET', 'Adequação elétrica', 'Manutenção', 'servico', 300, 180, 3.5),
  svc('srv-27', 'HORA-TEC', 'Hora técnica avulsa', 'Diversos', 'hora', 70, 40, 1),
  svc('srv-28', 'ATEND-EMERG', 'Atendimento emergencial', 'Diversos', 'servico', 250, 140, 2),
];

function emptyTotalsBudget(over: Partial<Budget>): Budget {
  return {
    id: '', organization_id: ORG_ID, numero: '', client_id: '', titulo: '', tipo_servico: 'Instalação',
    local_servico: '', data_emissao: todayISO(), validade_dias: 10, responsavel: 'Felipe Ribeiro',
    status: 'rascunho', itens: [], custos_extras: [], desconto_percentual: 0, desconto_valor: 0,
    forma_pagamento: 'pix', entrada: 0, parcelas: 1, garantia: '90 dias', historico_status: [],
    created_at: todayISO(), updated_at: todayISO(), ...over,
  };
}

export const demoBudgets: Budget[] = [
  emptyTotalsBudget({
    id: 'orc-1', numero: '2026-0001', client_id: 'cli-1', titulo: 'Instalação de circuito para ar-condicionado',
    local_servico: 'Rua das Palmeiras, 45 - Jardim Sul', prazo_estimado: '1 dia', status: 'aprovado',
    itens: [
      { id: 'it-1', tipo: 'servico', referencia_id: 'srv-14', nome: 'Instalação de circuito para ar-condicionado', quantidade: 1, unidade: 'servico', custo_unitario: 190, valor_unitario: 320, desconto: 0 },
      { id: 'it-2', tipo: 'material', referencia_id: 'mat-4', nome: 'Cabo flexível 6 mm²', quantidade: 15, unidade: 'metro', custo_unitario: 3.9, valor_unitario: 6.3, desconto: 0 },
      { id: 'it-3', tipo: 'material', referencia_id: 'mat-12', nome: 'Disjuntor bipolar 10-63A', quantidade: 1, unidade: 'unidade', custo_unitario: 22, valor_unitario: 39, desconto: 0 },
    ],
    custos_extras: [{ id: 'ex-1', descricao: 'Deslocamento', valor: 30 }],
    forma_pagamento: 'pix', entrada: 0, parcelas: 1,
    historico_status: [{ status: 'enviado', data: addDays(todayISO(), -6) }, { status: 'aprovado', data: addDays(todayISO(), -4) }],
  }),
  emptyTotalsBudget({
    id: 'orc-2', numero: '2026-0002', client_id: 'cli-2', titulo: 'Reforma elétrica de loja comercial',
    local_servico: 'Av. Paulista, 1000 - Bela Vista', prazo_estimado: '5 dias', status: 'enviado',
    itens: [
      { id: 'it-4', tipo: 'servico', referencia_id: 'srv-20', nome: 'Reforma de quadro elétrico', quantidade: 1, unidade: 'servico', custo_unitario: 230, valor_unitario: 380, desconto: 0 },
      { id: 'it-5', tipo: 'servico', referencia_id: 'srv-3', nome: 'Instalação de tomada', quantidade: 10, unidade: 'unidade', custo_unitario: 35, valor_unitario: 60, desconto: 0 },
      { id: 'it-6', tipo: 'material', referencia_id: 'mat-16', nome: 'Quadro de distribuição 12 disjuntores', quantidade: 1, unidade: 'unidade', custo_unitario: 60, valor_unitario: 105, desconto: 0 },
    ],
    custos_extras: [], forma_pagamento: 'entrada_parcelas', entrada: 300, parcelas: 3,
    historico_status: [{ status: 'enviado', data: addDays(todayISO(), -1) }],
  }),
  emptyTotalsBudget({
    id: 'orc-3', numero: '2026-0003', client_id: 'cli-3', titulo: 'Instalação de iluminação de apartamento',
    local_servico: 'Rua Harmonia, 200 apto 61 - Vila Madalena', prazo_estimado: '2 dias', status: 'em_negociacao',
    itens: [
      { id: 'it-7', tipo: 'servico', referencia_id: 'srv-7', nome: 'Instalação de painel LED', quantidade: 6, unidade: 'unidade', custo_unitario: 45, valor_unitario: 80, desconto: 0 },
      { id: 'it-8', tipo: 'material', referencia_id: 'mat-24', nome: 'Painel LED de embutir 24W', quantidade: 6, unidade: 'unidade', custo_unitario: 28, valor_unitario: 49, desconto: 20 },
    ],
    custos_extras: [], forma_pagamento: 'pix', entrada: 0, parcelas: 1,
    historico_status: [{ status: 'enviado', data: addDays(todayISO(), -3) }, { status: 'em_negociacao', data: addDays(todayISO(), -1) }],
  }),
  emptyTotalsBudget({
    id: 'orc-4', numero: '2026-0004', client_id: 'cli-4', titulo: 'Infraestrutura elétrica para obra - etapa 1',
    local_servico: 'Rua Nova Construção, 10 - Casa Verde', prazo_estimado: '15 dias', status: 'rascunho',
    itens: [
      { id: 'it-9', tipo: 'servico', referencia_id: 'srv-19', nome: 'Montagem de quadro elétrico', quantidade: 2, unidade: 'servico', custo_unitario: 280, valor_unitario: 450, desconto: 0 },
    ],
    custos_extras: [{ id: 'ex-2', descricao: 'ART/documento técnico', valor: 250 }],
    forma_pagamento: 'a_combinar', entrada: 0, parcelas: 1, historico_status: [],
  }),
  emptyTotalsBudget({
    id: 'orc-5', numero: '2026-0005', client_id: 'cli-5', titulo: 'Correção de fuga de corrente - emergencial',
    local_servico: 'Rua dos Ipês, 78 - Tatuapé', prazo_estimado: 'Mesmo dia', status: 'recusado',
    itens: [
      { id: 'it-10', tipo: 'servico', referencia_id: 'srv-22', nome: 'Correção de fuga de corrente', quantidade: 1, unidade: 'servico', custo_unitario: 130, valor_unitario: 220, desconto: 0 },
      { id: 'it-11', tipo: 'servico', referencia_id: 'srv-28', nome: 'Atendimento emergencial', quantidade: 1, unidade: 'servico', custo_unitario: 140, valor_unitario: 250, desconto: 0 },
    ],
    custos_extras: [], forma_pagamento: 'pix', entrada: 0, parcelas: 1,
    historico_status: [{ status: 'enviado', data: addDays(todayISO(), -8) }, { status: 'recusado', data: addDays(todayISO(), -7) }],
  }),
];

export const demoServiceOrders: ServiceOrder[] = [
  {
    id: 'os-1', organization_id: ORG_ID, numero: 'OS-2026-0001', budget_id: 'orc-1', client_id: 'cli-1',
    data_prevista: addDays(todayISO(), 2), responsavel_tecnico: 'Felipe Ribeiro', status: 'agendada',
    checklist: [
      { item: 'Energia desligada antes da intervenção', concluido: false },
      { item: 'Circuito identificado', concluido: false },
      { item: 'Disjuntor dimensionado', concluido: false },
      { item: 'Testes realizados', concluido: false },
    ],
    created_at: todayISO(), updated_at: todayISO(),
  },
  {
    id: 'os-2', organization_id: ORG_ID, numero: 'OS-2026-0002', budget_id: 'orc-5', client_id: 'cli-5',
    data_inicio: addDays(todayISO(), -6), data_conclusao: addDays(todayISO(), -6),
    responsavel_tecnico: 'Felipe Ribeiro', status: 'finalizada',
    checklist: [
      { item: 'Energia desligada antes da intervenção', concluido: true },
      { item: 'Aterramento verificado', concluido: true },
      { item: 'Testes realizados', concluido: true },
    ],
    created_at: addDays(todayISO(), -7), updated_at: addDays(todayISO(), -6),
  },
];

export const demoPayments: Payment[] = [
  { id: 'pag-1', organization_id: ORG_ID, client_id: 'cli-1', budget_id: 'orc-1', descricao: 'Orçamento 2026-0001', valor: 495.7, vencimento: addDays(todayISO(), 1), forma_pagamento: 'pix', status: 'pendente' },
  { id: 'pag-2', organization_id: ORG_ID, client_id: 'cli-5', budget_id: 'orc-5', descricao: 'Atendimento emergencial', valor: 470, vencimento: addDays(todayISO(), -7), data_recebimento: addDays(todayISO(), -6), forma_pagamento: 'pix', status: 'pago' },
];
