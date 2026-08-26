import { ChevronDown, ChevronUp, Check } from 'lucide-react';

// Cabeçalho colapsável de cada etapa da "Proposta técnica completa" — mesmo cartão visual
// (bg-white, border-slate-200, rounded-xl) do formulário simples, com um indicador de "preenchida"
// para o orçamentista acompanhar o progresso sem precisar abrir todas as seções.
interface StepShellProps {
  numero: number;
  titulo: string;
  descricao?: string;
  preenchida?: boolean;
  aberta: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function StepShell({ numero, titulo, descricao, preenchida, aberta, onToggle, children }: StepShellProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${preenchida ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {preenchida ? <Check size={13} /> : numero}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[#0b2338] font-medium text-sm">{titulo}</h2>
          {descricao && <p className="text-[11px] text-slate-400 mt-0.5">{descricao}</p>}
        </div>
        {aberta ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>
      {aberta && <div className="px-5 pb-5 pt-1 space-y-4">{children}</div>}
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function NumField({ label, value, onChange, hint }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, value, onChange, hint, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; hint?: string; rows?: number }) {
  return (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
        className="mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#00B4E5] focus:ring-[#00B4E5]" />
      <span>
        <span className="text-sm text-[#0b2338]">{label}</span>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </span>
    </label>
  );
}
