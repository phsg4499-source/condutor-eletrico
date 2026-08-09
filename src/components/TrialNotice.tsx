import { Clock } from 'lucide-react';
import { getTrialInfo, TRIAL_DAYS, LICENSE_PRICE_LABEL } from '../lib/license';

// Selo compacto exibido no cabeçalho, sempre visível, mostrando quantos dias faltam do teste.
export function TrialBadge({ organizationCreatedAt }: { organizationCreatedAt: string }) {
  const { daysRemaining, expired } = getTrialInfo(organizationCreatedAt);
  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border mr-3 ${
      expired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'
    }`}>
      <Clock size={12} />
      {expired ? 'Teste expirado' : `Teste: ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`}
    </span>
  );
}

// Modal exibido logo após o login, avisando sobre o período de teste e a cobrança da licença.
export function TrialModal({ organizationCreatedAt, onClose }: { organizationCreatedAt: string; onClose: () => void }) {
  const { daysRemaining, expired } = getTrialInfo(organizationCreatedAt);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="ce-pop-in bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="w-11 h-11 rounded-xl bg-[#00B4E5]/15 border border-[#00B4E5]/25 flex items-center justify-center">
          <Clock size={20} className="text-[#00B4E5]" />
        </div>
        <div>
          <h2 className="text-[#0b2338] font-semibold text-lg">
            {expired ? 'Seu período de teste terminou' : 'Período de teste em andamento'}
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            {expired ? (
              <>
                O período gratuito de {TRIAL_DAYS} dias do sistema já terminou. Para continuar usando, é necessário
                contratar a licença anual no valor de <span className="text-[#0b2338] font-medium">{LICENSE_PRICE_LABEL}</span>.
              </>
            ) : (
              <>
                Você está no período de teste gratuito, com <span className="text-[#0b2338] font-medium">{daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}</span>.
                Após os {TRIAL_DAYS} dias de teste, será cobrada a licença anual no valor de{' '}
                <span className="text-[#0b2338] font-medium">{LICENSE_PRICE_LABEL}</span> para continuar usando o sistema.
              </>
            )}
          </p>
        </div>
        <button onClick={onClose} className="ce-btn-glow w-full bg-[#00B4E5] text-[#0b2338] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#0069A8]">
          Entendi
        </button>
      </div>
    </div>
  );
}
