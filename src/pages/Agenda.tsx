import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, MapPin, Clock, Wrench, CalendarRange } from 'lucide-react';
import { useStore } from '../lib/store';
import { useToast } from '../lib/toast';
import { resolveClienteInfo } from '../lib/clientInfo';
import { CompromissoStatusBadge, compromissoStatusOptions } from '../components/StatusBadge';
import type { Compromisso, CompromissoTipo } from '../types';

const tipoLabels: Record<CompromissoTipo, string> = {
  visita_orcamento: 'Visita para orçamento',
  execucao_servico: 'Execução de serviço',
  reuniao: 'Reunião',
  outro: 'Outro',
};

const tipoColors: Record<CompromissoTipo, string> = {
  visita_orcamento: 'bg-blue-600/30 text-blue-300',
  execucao_servico: 'bg-purple-600/30 text-purple-300',
  reuniao: 'bg-teal-600/30 text-teal-300',
  outro: 'bg-gray-600/30 text-gray-300',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function toISO(year: number, month: number, day: number) { return `${year}-${pad(month + 1)}-${pad(day)}`; }
function todayISODate() { const d = new Date(); return toISO(d.getFullYear(), d.getMonth(), d.getDate()); }

function getWeekRange(baseDate: Date) {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    startISO: toISO(start.getFullYear(), start.getMonth(), start.getDate()),
    endISO: toISO(end.getFullYear(), end.getMonth(), end.getDate()),
  };
}

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export default function Agenda() {
  const { db, addCompromisso, updateCompromisso, deleteCompromisso } = useStore();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISODate());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [verServicosSemana, setVerServicosSemana] = useState(false);
  const [prefillDraft, setPrefillDraft] = useState<Partial<Compromisso> | null>(null);

  // Ao vir de um orçamento recém-aprovado (BudgetView), abre direto o formulário de novo
  // compromisso já com título, tipo, cliente e local preenchidos.
  useEffect(() => {
    const state = location.state as { prefillCompromisso?: Partial<Compromisso> } | null;
    if (state?.prefillCompromisso) {
      setPrefillDraft(state.prefillCompromisso);
      setEditingId(null);
      setShowForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orcamentistasAtivos = db.orcamentistas.filter(o => o.status === 'ativo');
  const { startISO: semanaInicio, endISO: semanaFim } = useMemo(() => getWeekRange(new Date()), []);

  const compromissosByDate = useMemo(() => {
    const map = new Map<string, Compromisso[]>();
    for (const c of db.compromissos) {
      const list = map.get(c.data) ?? [];
      list.push(c);
      map.set(c.data, list);
    }
    return map;
  }, [db.compromissos]);

  const ordensServicoByDate = useMemo(() => {
    const map = new Map<string, typeof db.serviceOrders>();
    for (const o of db.serviceOrders) {
      if (!o.data_prevista) continue;
      const list = map.get(o.data_prevista) ?? [];
      list.push(o);
      map.set(o.data_prevista, list);
    }
    return map;
  }, [db.serviceOrders]);

  function goToMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m); setViewYear(y);
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedCompromissos = (compromissosByDate.get(selectedDate) ?? []).slice().sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''));
  const selectedOrdens = ordensServicoByDate.get(selectedDate) ?? [];

  const servicosCompromissosSemana = db.compromissos
    .filter(c => c.tipo === 'execucao_servico' && c.data >= semanaInicio && c.data <= semanaFim)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? '').localeCompare(b.hora ?? ''));
  const servicosOrdensSemana = db.serviceOrders
    .filter(o => o.data_prevista && o.data_prevista >= semanaInicio && o.data_prevista <= semanaFim)
    .sort((a, b) => (a.data_prevista ?? '').localeCompare(b.data_prevista ?? ''));

  function openNewForm() {
    setEditingId(null);
    setPrefillDraft(null);
    setShowForm(true);
  }

  function openEditForm(id: string) {
    setEditingId(id);
    setShowForm(true);
  }

  function handleDelete(id: string, titulo: string) {
    if (!window.confirm(`Excluir o compromisso "${titulo}"?`)) return;
    deleteCompromisso(id);
    toast.show('Compromisso excluído.', 'info');
  }

  function handleToggleConcluido(c: Compromisso) {
    updateCompromisso(c.id, { status: c.status === 'concluido' ? 'agendado' : 'concluido' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ce-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-white">Agenda</h1>
          <p className="text-sm text-gray-400 mt-1">Visitas, orçamentos presenciais, execuções de serviço e reuniões.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setVerServicosSemana(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition ${
              verServicosSemana ? 'bg-[#f5c518] text-[#16181d] border-[#f5c518] font-semibold' : 'border-white/10 text-gray-300 hover:border-white/30'
            }`}>
            <CalendarRange size={16} /> Serviços da semana
          </button>
          <button onClick={openNewForm} className="ce-btn-glow ce-cta-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg text-sm hover:bg-[#e0b60f]">
            <Plus size={16} /> Novo compromisso
          </button>
        </div>
      </div>

      {verServicosSemana && (
        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4 ce-fade-up space-y-3">
          <h2 className="text-white font-medium text-sm flex items-center gap-2">
            <Wrench size={15} className="text-purple-300" /> Serviços desta semana
          </h2>
          {servicosCompromissosSemana.length === 0 && servicosOrdensSemana.length === 0 && (
            <p className="text-xs text-gray-500">Nenhum serviço agendado para esta semana.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {servicosOrdensSemana.map(o => (
              <Link key={o.id} to={`/app/ordens-servico/${o.id}`}
                className="block bg-[#0f1115] border border-white/5 rounded-lg p-3 hover:border-[#f5c518]/30">
                <div className="flex items-center gap-2 text-[10px] uppercase text-teal-300"><Wrench size={11} /> Ordem de serviço</div>
                <p className="text-sm text-white mt-1">{o.numero}</p>
                <p className="text-xs text-gray-400">{resolveClienteInfo(o, db.clients).nome}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(o.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}</p>
              </Link>
            ))}
            {servicosCompromissosSemana.map(c => {
              const cliente = resolveClienteInfo(c, db.clients);
              return (
                <div key={c.id} className="bg-[#0f1115] border border-white/5 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300">{tipoLabels.execucao_servico}</span>
                    <CompromissoStatusBadge status={c.status} />
                  </div>
                  <p className="text-sm text-white font-medium">{c.titulo}</p>
                  {(c.client_id || c.cliente_nome_avulso) && <p className="text-xs text-gray-400">Cliente: {cliente.nome}</p>}
                  <p className="text-xs text-gray-500">
                    {new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    {c.hora ? ` às ${c.hora}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4 ce-fade-up ce-fade-up-1">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => goToMonth(-1)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"><ChevronLeft size={18} /></button>
            <h2 className="text-white font-medium text-sm">{monthNames[viewMonth]} de {viewYear}</h2>
            <button onClick={() => goToMonth(1)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-gray-500 mb-1">
            {weekDays.map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toISO(viewYear, viewMonth, day);
              const isToday = iso === todayISODate();
              const isSelected = iso === selectedDate;
              const itemCount = (compromissosByDate.get(iso)?.length ?? 0) + (ordensServicoByDate.get(iso)?.length ?? 0);
              return (
                <button key={i} onClick={() => setSelectedDate(iso)}
                  className={`relative aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 transition-colors
                    ${isSelected ? 'bg-[#f5c518] text-[#16181d] font-semibold' : isToday ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}>
                  {day}
                  {itemCount > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#16181d]' : 'bg-[#f5c518]'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-4 ce-fade-up ce-fade-up-2 space-y-3">
          <h2 className="text-white font-medium text-sm">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h2>

          {selectedOrdens.map(o => (
            <Link key={o.id} to={`/app/ordens-servico/${o.id}`}
              className="block bg-[#0f1115] border border-white/5 rounded-lg p-3 hover:border-[#f5c518]/30">
              <div className="flex items-center gap-2 text-[10px] uppercase text-teal-300"><Wrench size={11} /> Ordem de serviço</div>
              <p className="text-sm text-white mt-1">{o.numero}</p>
              <p className="text-xs text-gray-400">{resolveClienteInfo(o, db.clients).nome}</p>
            </Link>
          ))}

          {selectedCompromissos.length === 0 && selectedOrdens.length === 0 && (
            <p className="text-xs text-gray-500">Nada agendado para este dia.</p>
          )}

          {selectedCompromissos.map(c => {
            const cliente = resolveClienteInfo(c, db.clients);
            const orcamentista = db.orcamentistas.find(o => o.id === c.orcamentista_id);
            return (
              <div key={c.id} className="bg-[#0f1115] border border-white/5 rounded-lg p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${tipoColors[c.tipo]}`}>{tipoLabels[c.tipo]}</span>
                  <CompromissoStatusBadge status={c.status} />
                </div>
                <p className="text-sm text-white font-medium">{c.titulo}</p>
                {(c.hora || c.local) && (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    {c.hora && <span className="flex items-center gap-1"><Clock size={12} /> {c.hora}</span>}
                    {c.local && <span className="flex items-center gap-1"><MapPin size={12} /> {c.local}</span>}
                  </div>
                )}
                {(c.client_id || c.cliente_nome_avulso) && <p className="text-xs text-gray-400">Cliente: {cliente.nome}</p>}
                {orcamentista && <p className="text-xs text-gray-500">Responsável: {orcamentista.nome}</p>}
                {c.observacoes && <p className="text-xs text-gray-500">{c.observacoes}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => handleToggleConcluido(c)} className="text-xs text-emerald-400 hover:underline">
                    {c.status === 'concluido' ? 'Reabrir' : 'Marcar concluído'}
                  </button>
                  <button onClick={() => openEditForm(c.id)} className="text-xs text-[#f5c518] hover:underline">Editar</button>
                  <button onClick={() => handleDelete(c.id, c.titulo)} className="text-xs text-red-400 hover:underline ml-auto flex items-center gap-1">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showForm && (
        <CompromissoForm
          compromisso={editingId ? db.compromissos.find(c => c.id === editingId) ?? null : null}
          prefill={editingId ? undefined : prefillDraft ?? undefined}
          defaultDate={selectedDate}
          orcamentistasAtivos={orcamentistasAtivos}
          clients={db.clients}
          compromissos={db.compromissos}
          onClose={() => { setShowForm(false); setPrefillDraft(null); }}
          onSave={(data) => {
            if (editingId) {
              updateCompromisso(editingId, data);
              toast.show('Compromisso atualizado.');
            } else {
              addCompromisso(data as Omit<Compromisso, 'id' | 'organization_id' | 'created_at' | 'updated_at'>);
              toast.show('Compromisso adicionado à agenda.');
            }
            setShowForm(false);
            setPrefillDraft(null);
          }}
        />
      )}
    </div>
  );
}

function CompromissoForm({ compromisso, prefill, defaultDate, orcamentistasAtivos, clients, compromissos, onClose, onSave }: {
  compromisso: Compromisso | null;
  prefill?: Partial<Compromisso>;
  defaultDate: string;
  orcamentistasAtivos: { id: string; nome: string; cargo: string }[];
  clients: { id: string; nome: string }[];
  compromissos: Compromisso[];
  onClose: () => void;
  onSave: (data: Partial<Compromisso>) => void;
}) {
  const [conflito, setConflito] = useState('');
  const base = compromisso ?? prefill;
  const [clienteMode, setClienteMode] = useState<'nenhum' | 'existing' | 'avulso'>(
    base?.client_id ? 'existing' : base?.cliente_nome_avulso ? 'avulso' : 'nenhum',
  );
  const [titulo, setTitulo] = useState(base?.titulo ?? '');
  const [tipo, setTipo] = useState<CompromissoTipo>(base?.tipo ?? 'visita_orcamento');
  const [data, setData] = useState(base?.data ?? defaultDate);
  const [hora, setHora] = useState(base?.hora ?? '');
  const [clientId, setClientId] = useState(base?.client_id ?? '');
  const [clienteNome, setClienteNome] = useState(base?.cliente_nome_avulso ?? '');
  const [clienteTelefone, setClienteTelefone] = useState(base?.cliente_telefone_avulso ?? '');
  const [orcamentistaId, setOrcamentistaId] = useState(base?.orcamentista_id ?? orcamentistasAtivos[0]?.id ?? '');
  const [local, setLocal] = useState(base?.local ?? '');
  const [observacoes, setObservacoes] = useState(base?.observacoes ?? '');
  const [status, setStatus] = useState(base?.status ?? 'agendado');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setConflito('');
    if (!titulo.trim() || !data) return;

    if (orcamentistaId && status !== 'cancelado') {
      const conflitante = compromissos.find(c =>
        c.id !== compromisso?.id
        && c.orcamentista_id === orcamentistaId
        && c.data === data
        && c.status !== 'cancelado'
        && (c.hora || '') === (hora || ''),
      );
      if (conflitante) {
        const nomeOrcamentista = orcamentistasAtivos.find(o => o.id === orcamentistaId)?.nome ?? 'Este profissional';
        setConflito(`${nomeOrcamentista} já possui um compromisso neste horário ("${conflitante.titulo}"). Escolha outro horário ou outro responsável.`);
        return;
      }
    }

    const clientFields: Partial<Compromisso> = clienteMode === 'existing'
      ? { client_id: clientId || null, cliente_nome_avulso: null, cliente_telefone_avulso: null }
      : clienteMode === 'avulso'
        ? { client_id: null, cliente_nome_avulso: clienteNome.trim() || null, cliente_telefone_avulso: clienteTelefone.trim() || null }
        : { client_id: null, cliente_nome_avulso: null, cliente_telefone_avulso: null };

    onSave({
      titulo: titulo.trim(), tipo, data, hora: hora || undefined, local: local || undefined,
      observacoes: observacoes || undefined, orcamentista_id: orcamentistaId || undefined, status,
      budget_id: base?.budget_id ?? undefined,
      ...clientFields,
    });
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="ce-pop-in bg-[#16181d] border border-white/10 rounded-xl p-5 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="text-white font-medium">{compromisso ? 'Editar compromisso' : 'Novo compromisso'}</h2>

        <div>
          <label className="text-xs text-gray-400">Título *</label>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Visita técnica para orçamento"
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Data *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as CompromissoTipo)}
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
            <option value="visita_orcamento">Visita para orçamento</option>
            <option value="execucao_servico">Execução de serviço</option>
            <option value="reuniao">Reunião</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1.5">Cliente (opcional)</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setClienteMode('nenhum')}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${clienteMode === 'nenhum' ? 'bg-[#f5c518] text-[#16181d] border-[#f5c518]' : 'border-white/10 text-gray-300'}`}>Sem cliente</button>
            <button type="button" onClick={() => setClienteMode('existing')}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${clienteMode === 'existing' ? 'bg-[#f5c518] text-[#16181d] border-[#f5c518]' : 'border-white/10 text-gray-300'}`}>Cadastrado</button>
            <button type="button" onClick={() => setClienteMode('avulso')}
              className={`flex-1 py-1.5 rounded-lg text-xs border ${clienteMode === 'avulso' ? 'bg-[#f5c518] text-[#16181d] border-[#f5c518]' : 'border-white/10 text-gray-300'}`}>Sem cadastro</button>
          </div>
          {clienteMode === 'existing' && (
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="">Selecione...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {clienteMode === 'avulso' && (
            <div className="grid grid-cols-2 gap-3">
              <input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome"
                className="rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
              <input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} placeholder="Telefone"
                className="rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Responsável</label>
            <select value={orcamentistaId} onChange={e => setOrcamentistaId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              <option value="">—</option>
              {orcamentistasAtivos.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400">Local</label>
            <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Endereço ou referência"
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
          </div>
        </div>

        {compromisso && (
          <div>
            <label className="text-xs text-gray-400">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Compromisso['status'])}
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
              {compromissoStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400">Observações</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
            className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white" />
        </div>

        {conflito && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-xs text-red-300">
            ⚠ {conflito}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-gray-300 text-sm hover:bg-white/5">Cancelar</button>
          <button type="submit" className="ce-btn-glow flex-1 py-2.5 rounded-lg bg-[#f5c518] text-[#16181d] font-semibold text-sm hover:bg-[#e0b60f]">Salvar</button>
        </div>
      </form>
    </div>
  );
}
