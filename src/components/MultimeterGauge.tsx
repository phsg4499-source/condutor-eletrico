import { useMemo } from 'react';
import { Zap } from 'lucide-react';
import { formatMoney } from '../lib/format';
import CountUp from './CountUp';

// Medidor central do painel geral, com visual de multímetro/painel elétrico: mostrador
// semicircular, ponteiro, faixas de carga e leitura digital. Puramente visual — os números
// (recebido, meta, percentual) continuam vindo de src/pages/Dashboard.tsx, calculados a partir
// dos dados reais (Supabase em modo real, ou dados locais em modo demonstração).

interface MultimeterGaugeProps {
  recebido: number;
  meta: number;
  percentual: number; // pode passar de 100 (sobrecarga positiva)
  aReceber?: number; // pagamentos pendentes/parciais já lançados, para a dica de como chegar ao topo
}

const CX = 170;
const CY = 172;
const R = 128;
const STROKE = 20;

function pointAt(pct: number) {
  const clamped = Math.max(0, Math.min(100, pct));
  const theta = (180 - 1.8 * clamped) * (Math.PI / 180);
  return { x: CX + R * Math.cos(theta), y: CY - R * Math.sin(theta) };
}

function bandInfo(pct: number): { label: string; frase: string; color: string } {
  if (pct >= 100) {
    return pct > 100
      ? { label: 'Sobrecarga positiva', frase: `Sobrecarga positiva: meta superada em ${Math.round(pct - 100)}%.`, color: '#ffd93d' }
      : { label: 'Meta energizada', frase: 'Meta energizada com sucesso.', color: '#ffd93d' };
  }
  if (pct >= 76) return { label: 'Alta carga', frase: 'Falta pouco para atingir a carga máxima.', color: '#f5c518' };
  if (pct >= 51) return { label: 'Boa tração', frase: 'Boa evolução no faturamento.', color: '#e0b429' };
  if (pct >= 26) return { label: 'Energizando', frase: 'A corrente está subindo.', color: '#7fa5c9' };
  return { label: 'Energia baixa', frase: 'Vamos energizar esse mês.', color: '#4d7396' };
}

// Dica prática de como chegar ao topo do medidor (100% da meta), usando só dados reais já
// disponíveis: quanto falta e quanto já está lançado como "a receber" (pendente/parcial).
function comoChegarAoTopo(falta: number, aReceber: number): string | null {
  if (falta <= 0) return null;
  if (aReceber <= 0) {
    return `Faltam ${formatMoney(falta)} para o ponteiro chegar ao topo. Aprove novos orçamentos ou registre recebimentos para energizar a meta.`;
  }
  if (aReceber >= falta) {
    return `Você já tem ${formatMoney(aReceber)} a receber em aberto — cobrar esses pagamentos é suficiente para levar o ponteiro ao topo (faltam ${formatMoney(falta)}).`;
  }
  return `Faltam ${formatMoney(falta)} para o topo. Você já tem ${formatMoney(aReceber)} a receber; feche mais ${formatMoney(falta - aReceber)} em orçamentos aprovados para completar a carga.`;
}

export default function MultimeterGauge({ recebido, meta, percentual, aReceber = 0 }: MultimeterGaugeProps) {
  const band = useMemo(() => bandInfo(percentual), [percentual]);
  const start = pointAt(0);
  const progressEnd = pointAt(percentual);
  const trackEnd = pointAt(100);
  const falta = Math.max(0, meta - recebido);
  const dica = useMemo(() => comoChegarAoTopo(falta, aReceber), [falta, aReceber]);

  const ticks = [0, 25, 50, 75, 100].map(t => {
    const inner = { x: CX + (R - STROKE / 2 - 2) * Math.cos((180 - 1.8 * t) * (Math.PI / 180)), y: CY - (R - STROKE / 2 - 2) * Math.sin((180 - 1.8 * t) * (Math.PI / 180)) };
    const outer = { x: CX + (R + STROKE / 2 + 8) * Math.cos((180 - 1.8 * t) * (Math.PI / 180)), y: CY - (R + STROKE / 2 + 8) * Math.sin((180 - 1.8 * t) * (Math.PI / 180)) };
    const labelPos = { x: CX + (R + STROKE / 2 + 15) * Math.cos((180 - 1.8 * t) * (Math.PI / 180)), y: CY - (R + STROKE / 2 + 15) * Math.sin((180 - 1.8 * t) * (Math.PI / 180)) };
    return { t, inner, outer, labelPos };
  });

  const needleAngle = pointAt(Math.min(percentual, 100));

  return (
    <div className="ce-neon-pulse relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a1d24] to-[#121419] border-2 border-[#f5c518]/40 p-6 sm:p-8">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#3a5570] via-[#c98f1e] to-[#ffd93d]" />
      <div className="absolute inset-0 ce-grid-bg opacity-[0.08] pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row items-center lg:items-stretch gap-6">
        <div className="relative shrink-0 mx-auto lg:mx-0">
          <svg viewBox="0 0 340 210" className="w-full max-w-[400px]" role="img" aria-label={`Medidor de faturamento: ${Math.round(percentual)}% da meta`}>
            <defs>
              <linearGradient id="ce-gauge-gradient" x1={start.x} y1={start.y} x2={trackEnd.x} y2={trackEnd.y} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3a5570" />
                <stop offset="45%" stopColor="#c98f1e" />
                <stop offset="100%" stopColor="#ffd93d" />
              </linearGradient>
            </defs>

            <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${trackEnd.x} ${trackEnd.y}`} fill="none" stroke="#0c0d10" strokeWidth={STROKE} strokeLinecap="round" />

            {ticks.map(({ t, inner, outer, labelPos }) => (
              <g key={t}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="#3a3f4b" strokeWidth={2} />
                <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#6b7280">{t}%</text>
              </g>
            ))}

            <path
              d={`M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${progressEnd.x} ${progressEnd.y}`}
              fill="none" stroke="url(#ce-gauge-gradient)" strokeWidth={STROKE} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 ${8 + (Math.min(percentual, 100) / 100) * 14}px ${band.color}aa)` }}
            />

            <g className="ce-needle-wobble" style={{ transformOrigin: `${CX}px ${CY}px` }}>
              <line x1={CX} y1={CY} x2={needleAngle.x + (needleAngle.x - CX) * -0.12} y2={needleAngle.y + (needleAngle.y - CY) * -0.12} stroke="#e5e7eb" strokeWidth={1.5} opacity={0.5} />
              <line
                x1={CX} y1={CY} x2={needleAngle.x} y2={needleAngle.y}
                stroke="#fff8e1" strokeWidth={4} strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(255,217,61,0.95)) drop-shadow(0 0 14px rgba(245,197,24,0.7))' }}
              />
            </g>
            <circle cx={CX} cy={CY} r={11} fill="#16181d" stroke={band.color} strokeWidth={3} style={{ filter: `drop-shadow(0 0 6px ${band.color}aa)` }} />
          </svg>
          <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-1">
            <Zap size={18} className="text-[#f5c518] ce-glow-pulse" />
            <div className="text-3xl sm:text-4xl font-semibold text-white font-mono tabular-nums">
              <CountUp value={recebido} formatter={formatMoney} />
            </div>
            <div className="text-xs text-gray-500">de {formatMoney(meta)} na meta do mês</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3 min-w-0 lg:pl-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `${band.color}22`, color: band.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: band.color }} />
              {band.label}
            </span>
            <span className="text-3xl font-semibold text-white tabular-nums">{Math.round(percentual)}%</span>
          </div>
          <p className="text-sm text-gray-300">{band.frase}</p>
          {dica && (
            <div className="bg-[#f5c518]/[0.08] border border-[#f5c518]/25 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <Zap size={14} className="text-[#f5c518] mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200/90 leading-relaxed">{dica}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/5">
              <div className="text-[11px] text-gray-500">Recebido no mês</div>
              <div className="text-sm font-semibold text-white mt-0.5">{formatMoney(recebido)}</div>
            </div>
            <div className="bg-black/20 rounded-lg px-3 py-2 border border-white/5">
              <div className="text-[11px] text-gray-500">{percentual >= 100 ? 'Excedente sobre a meta' : 'Falta para a meta'}</div>
              <div className="text-sm font-semibold text-white mt-0.5">{formatMoney(Math.abs(meta - recebido))}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
