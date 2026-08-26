import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, ClipboardList } from 'lucide-react';
import { useStore } from '../lib/store';
import SimpleBudgetForm from './budgetWizard/SimpleBudgetForm';
import TechnicalProposalWizard from './budgetWizard/TechnicalProposalWizard';

// Roteador fino entre os dois modos de orçamento:
// - "Orçamento simples" (SimpleBudgetForm) — o fluxo original, com itens de catálogo e cálculo
//   automático de custo/margem. Continua exatamente como sempre foi.
// - "Proposta técnica completa" (TechnicalProposalWizard) — formulário de 11 etapas para
//   propostas no nível de um laudo técnico (ambientes, escopo, valores globais, sem preço por item).
// Editando um orçamento existente, o modo é decidido pelo próprio dado: a presença de
// "proposta_detalhada" é o que diferencia um formato do outro — nunca um campo separado que
// possa ficar dessincronizado.
export default function BudgetWizard() {
  const { db } = useStore();
  const { id } = useParams();
  const existingBudget = id ? db.budgets.find(b => b.id === id) : undefined;
  const [modoEscolhido, setModoEscolhido] = useState<'simples' | 'completa' | null>(null);

  if (id) {
    if (!existingBudget) {
      return (
        <div className="text-slate-500">
          Orçamento não encontrado. <Link to="/app/orcamentos" className="text-[#00B4E5] hover:underline">Voltar</Link>
        </div>
      );
    }
    return existingBudget.proposta_detalhada ? <TechnicalProposalWizard /> : <SimpleBudgetForm />;
  }

  if (modoEscolhido === 'simples') return <SimpleBudgetForm />;
  if (modoEscolhido === 'completa') return <TechnicalProposalWizard />;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/app/orcamentos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#0b2338]">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <div className="ce-fade-up">
        <h1 className="text-2xl font-semibold text-[#0b2338]">Novo orçamento</h1>
        <p className="text-sm text-slate-500 mt-1">Escolha o tipo de orçamento que você quer criar.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <button type="button" onClick={() => setModoEscolhido('simples')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-[#00B4E5] hover:shadow-sm transition">
          <FileText size={22} className="text-[#00B4E5] mb-3" />
          <h2 className="text-[#0b2338] font-semibold text-sm">Orçamento simples</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Rápido: itens de serviço/material do catálogo com custo e valor unitário, cálculo automático de margem. Ideal
            para visitas técnicas e serviços pontuais.
          </p>
        </button>
        <button type="button" onClick={() => setModoEscolhido('completa')}
          className="text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-[#00B4E5] hover:shadow-sm transition">
          <ClipboardList size={22} className="text-[#00B4E5] mb-3" />
          <h2 className="text-[#0b2338] font-semibold text-sm">Proposta técnica completa</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Laudo técnico, ambientes e atividades, escopo detalhado, valores e condições em texto rico — para propostas
            elaboradas, com um valor final único (sem preço por item).
          </p>
        </button>
      </div>
    </div>
  );
}
