# Condutor Elétrico — Sistema de Orçamentos e Gestão de Serviços Elétricos

Sistema web para a empresa **Condutor Elétrico** (Felipe Ribeiro, +10 anos de atuação em serviços
elétricos residenciais, comerciais, prediais e industriais). Permite cadastrar clientes, materiais e
serviços, montar orçamentos com cálculo automático de custo/margem/lucro, gerar propostas em PDF,
enviar pelo WhatsApp, registrar aprovação, converter em ordem de serviço e acompanhar indicadores.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS 4 + React Router + React Hook Form + Zod + jsPDF /
jspdf-autotable + lucide-react + Supabase (Auth, Postgres, RLS). PWA-ready (manifest incluso).

## Login e sincronização (modo Supabase)

Quando `.env` está preenchido, o login usa o Supabase Auth de verdade. Depois de entrar, o sistema
busca o perfil do usuário (tabela `profiles`) para descobrir a organização, e carrega clientes,
materiais, serviços, orçamentos e ordens de serviço direto do seu banco. Cada cadastro feito na
tela aparece na hora (atualização otimista) e é gravado no Supabase em segundo plano — se a
gravação falhar (ex: RLS mal configurado), o erro aparece no console do navegador (F12).

A página institucional pública (`/`) e o formulário de solicitação de orçamento continuam usando
os dados de marca padrão da Condutor Elétrico independentemente do modo — isso evita expor a
tabela `organizations` publicamente sem autenticação.

## Modo demonstração vs. modo Supabase

O sistema detecta automaticamente se as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
estão definidas (arquivo `.env`):

- **Sem elas configuradas (padrão):** roda em **modo demonstração**, com dados de exemplo
  persistidos em `localStorage` no navegador. É assim que você pode abrir a demo agora mesmo, sem
  configurar nada, e testar todo o fluxo (cadastrar cliente, criar orçamento, gerar PDF etc.).
- **Com elas configuradas:** o app está pronto para consumir dados reais via Supabase. A camada de
  dados (`src/lib/store.tsx`) foi escrita para que a troca do backend em memória por chamadas reais
  ao `supabase-js` seja direta — os tipos e o contrato de funções (`addClient`, `addBudget` etc.) já
  espelham as tabelas do SQL. Essa integração fica marcada como pendente na seção "O que falta"
  abaixo, já que exige um projeto Supabase real para ser testada de ponta a ponta.

## Como rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:5173`. Na tela de login, use as credenciais de demonstração exibidas na
própria tela (`admin@condutoreletrico.com.br` / `condutor123`).

## Configurando o Supabase (opcional, para persistência real)

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor** e execute o conteúdo de `supabase_condutor_eletrico.sql` (ou os arquivos em
   `supabase/migrations`, na ordem numérica)
3. Em **Project Settings > API**, copie a "Project URL" e a "anon public key"
4. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
5. Crie o primeiro usuário administrador pelo painel do Supabase (**Authentication > Users > Add
   user**) ou pela tela de cadastro do próprio app (a implementar), e depois rode:
   ```sql
   update profiles set organization_id = '00000000-0000-0000-0000-000000000001', cargo = 'administrador'
   where email = 'SEU-EMAIL@exemplo.com';
   ```
6. Nunca coloque a **service role key** no frontend — apenas a **anon public key** é usada pelo app.

Alterações futuras no banco devem ser feitas como novas migrations incrementais dentro de
`supabase/migrations`, nunca reescrevendo o schema inteiro.

## Deploy na Vercel (passo a passo)

O projeto já inclui `vercel.json` com o build configurado e o redirecionamento necessário para
rotas do React Router (SPA rewrite) — ou seja, está pronto para importar sem ajustes manuais.

1. Crie uma conta em vercel.com (login com GitHub é o mais simples, sem necessidade de cartão)
2. Suba esta pasta para um repositório no GitHub (ou GitLab/Bitbucket)
3. No painel da Vercel, clique em **Add New > Project** e selecione o repositório
4. A Vercel detecta automaticamente o framework (Vite) e usa `npm run build` / pasta `dist`
   — não precisa mudar nada
5. Se for usar Supabase real, adicione as variáveis de ambiente antes do deploy em
   **Settings > Environment Variables**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (sem elas, o site sobe já funcionando em modo demonstração)
6. Clique em **Deploy** — em cerca de 1 minuto o site está no ar com uma URL `.vercel.app`

Build verificado localmente com `npm run build` (sem erros) antes da entrega.

## Identidade visual

Arquivos da logo em `/brand` (SVG editável e PNG com fundo transparente): símbolo isolado, versão
horizontal e vertical, fundo claro e escuro. Favicon em `/public/favicon.svg` e `/public/favicon.png`.
O símbolo combina um "C" formado por um traço de circuito com um pulso de energia — grafite/preto,
branco e amarelo elétrico como destaque, sem uso de raios ou tomadas clichês.

## Experiência e interatividade

- Animações e "brilho" elétrico: logo com pulso de energia animado, blobs de fundo com
  movimento suave, transições de entrada nas seções, glow nos botões principais e no item de
  menu ativo, contadores animados nos indicadores do dashboard
- Notificações (toasts) confirmando ações como cadastro de cliente, orçamento salvo, PDF gerado,
  envio pelo WhatsApp e mudança de status
- Tour guiado de primeiro acesso (6 passos) explicando cada área do sistema, reaberto a qualquer
  momento pelo ícone de ajuda no topo
- Dicas contextuais dentro dos formulários (clientes, materiais, serviços, orçamento) com
  exemplos de preenchimento
- Configuração de precificação (Configurações > Precificação): modo de cálculo de margem,
  margem mínima aceitável e impostos estimados — a margem mínima alimenta os alertas mostrados
  na revisão do orçamento

## Funcionalidades entregues nesta primeira versão

- Página institucional pública com hero, serviços, diferenciais, formulário de solicitação de
  orçamento e rodapé com WhatsApp/Instagram
- Login (modo demonstração) e dashboard com indicadores vindos dos dados reais da aplicação
- Cadastro de clientes (pessoa física/jurídica, endereço de serviço)
- Cadastro de materiais (30+ itens demonstrativos, categorias, custo/venda/estoque)
- Cadastro de serviços (25+ itens demonstrativos, custo de mão de obra, valor padrão)
- Criação de orçamento por etapas: cliente, itens (serviço/material catalogado ou personalizado),
  custos adicionais, condições comerciais, revisão com alertas
- Cálculo automático de subtotal de materiais/serviços, custos, desconto, lucro bruto e margem
  (dados internos, nunca exibidos ao cliente)
- Visualização do orçamento com histórico de status, alteração de status e geração de PDF
  profissional (sem custo/margem/lucro)
- Envio por WhatsApp com mensagem pronta
- Conversão de orçamento aprovado em ordem de serviço, com checklist técnico
- Relatórios simples (receita, custo, lucro, taxa de conversão, serviços/materiais mais usados)
- Configurações da empresa (dados usados no site, PDF e mensagens)
- SQL completo do banco (`supabase_condutor_eletrico.sql`) com tabelas, índices, triggers, RLS e
  dados demonstrativos

## O que ainda está pendente (próximas fases, conforme ordem de execução do prompt)

- Integração real com Supabase Auth (hoje o login é simulado em modo demonstração; a estrutura de
  dados já está pronta para a troca)
- Página pública de aprovação do orçamento por link com aceite eletrônico (fluxo de negociação,
  recusa e assinatura simples do cliente)
- Upload de fotos/vídeos/documentos (vistoria, ordem de serviço, solicitação pública)
- Agenda/calendário de atendimentos
- Fornecedores vinculados a materiais com histórico de compras (tabela já existe no SQL)
- Contas a pagar detalhadas e fluxo de caixa por mês com gráficos
- Permissões por tipo de acesso (administrador, orçamentista, eletricista, financeiro, visualização)
  — hoje todo usuário logado tem acesso total
- Múltiplas opções de orçamento (econômica/recomendada/premium) e orçamentos com etapas
- PWA instalável (manifest incluso; falta service worker de cache offline)
- Exportação de relatórios para CSV/Excel/PDF

## Resultado do build

```
npx tsc --noEmit -p tsconfig.app.json   →  sem erros
npm run build                            →  build concluído com sucesso (vite build)
```

## Estrutura de pastas

```
src/
  components/   Layout, Logo, StatusBadge
  pages/         Dashboard, Clients, Materials, Services, Budgets, BudgetWizard, BudgetView,
                 ServiceOrders, Reports, Settings, Login, pages/public/Landing
  lib/           store.tsx (camada de dados), calculations.ts, pdf.ts, whatsapp.ts, format.ts,
                 supabaseClient.ts
  data/          demoData.ts (dados demonstrativos)
  types/         tipos TypeScript espelhando o schema SQL
brand/           logo em SVG e PNG (variações)
supabase/migrations/   migrations incrementais (0001_initial_schema.sql = schema inicial)
supabase_condutor_eletrico.sql   cópia do schema inicial completo, pronta para copiar/colar
```
