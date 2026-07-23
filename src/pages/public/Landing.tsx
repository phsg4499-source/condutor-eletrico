import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ShieldCheck, Clock, Wrench, Camera, MessageCircle, CheckCircle2 } from 'lucide-react';
import Logo, { LogoSymbol } from '../../components/Logo';
import AmbientBackground from '../../components/AmbientBackground';
import { useStore } from '../../lib/store';
import { whatsappLink } from '../../lib/whatsapp';

const servicos = [
  'Instalações elétricas residenciais', 'Instalações comerciais', 'Instalações prediais', 'Manutenção elétrica',
  'Troca de fiação', 'Instalação e troca de quadro elétrico', 'Instalação de disjuntores', 'Instalação de DR e DPS',
  'Adequação de instalações', 'Instalação de iluminação', 'Instalação de tomadas e interruptores',
  'Instalação de chuveiros e ventiladores', 'Parte elétrica de ar-condicionado', 'Padrão de entrada',
  'Correção de curto-circuito', 'Aterramento', 'Projetos elétricos', 'Infraestrutura para energia solar',
  'Infraestrutura para carregadores veiculares', 'Automação e iluminação inteligente', 'Reformas elétricas',
  'Serviços emergenciais',
];

const diferenciais = [
  { icon: ShieldCheck, title: 'Segurança em primeiro lugar', desc: 'Procedimentos técnicos seguindo normas e boas práticas do setor elétrico.' },
  { icon: Clock, title: 'Mais de 10 anos de atuação', desc: 'Experiência real em obras residenciais, comerciais, prediais e industriais.' },
  { icon: Wrench, title: 'Organização e transparência', desc: 'Orçamento detalhado, prazos claros e acompanhamento de cada etapa.' },
];

const tiposCliente = ['Pessoa física', 'Empresa', 'Condomínio', 'Construtora', 'Imobiliária', 'Outro'];
const tiposImovel = ['Casa', 'Apartamento', 'Loja', 'Escritório', 'Galpão', 'Condomínio', 'Prédio', 'Indústria', 'Obra', 'Outro'];

function emptyLead() {
  return { nome: '', documento: '', telefone: '', email: '', tipo_cliente: 'Pessoa física', endereco_servico: '', cidade: '', tipo_imovel: 'Casa', servico_desejado: '', descricao: '', urgencia: 'media' as const };
}

export default function Landing() {
  const { db, addQuoteRequest } = useStore();
  const org = db.organization;
  const [lead, setLead] = useState(emptyLead());
  const [sent, setSent] = useState(false);

  function submitLead(e: React.FormEvent) {
    e.preventDefault();
    addQuoteRequest(lead);
    setSent(true);
    setLead(emptyLead());
  }

  const waLink = whatsappLink(org.whatsapp, 'Olá! Gostaria de solicitar um orçamento de serviço elétrico.');

  return (
    <div className="bg-[#0f1115] text-gray-100">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 bg-[#0f1115]/90 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo variant="horizontal" theme="dark" />
          <div className="flex items-center gap-3">
            <a href={waLink} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white">
              <MessageCircle size={16} /> WhatsApp
            </a>
            <Link to="/login" className="text-sm bg-[#f5c518] text-[#16181d] font-semibold px-4 py-2 rounded-lg hover:bg-[#e0b60f]">Acessar sistema</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <AmbientBackground />
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #f5c518 0, #f5c518 1px, transparent 1px, transparent 40px)',
        }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 relative">
          <div className="flex justify-center mb-8 ce-fade-up"><LogoSymbol theme="dark" className="w-20 h-20" animated /></div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-center max-w-3xl mx-auto leading-tight text-white ce-fade-up ce-fade-up-1">
            Energia <span className="ce-gradient-text">segura</span> para projetos que precisam funcionar de verdade.
          </h1>
          <p className="text-center text-gray-400 max-w-2xl mx-auto mt-5 text-base sm:text-lg ce-fade-up ce-fade-up-2">
            A {org.nome_fantasia} atua há mais de 10 anos com instalações, manutenção e projetos elétricos residenciais,
            comerciais e empresariais, sempre com foco em segurança, organização e qualidade técnica.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8 ce-fade-up ce-fade-up-3">
            <a href="#solicitar" className="ce-btn-glow bg-[#f5c518] text-[#16181d] font-semibold px-6 py-3 rounded-lg hover:bg-[#e0b60f]">Solicitar orçamento</a>
            <Link to="/login" className="ce-btn-glow border border-white/15 text-gray-200 px-6 py-3 rounded-lg hover:bg-white/5">Acessar sistema</Link>
            <a href={waLink} target="_blank" rel="noreferrer" className="ce-btn-glow flex items-center gap-2 border border-white/15 text-gray-200 px-6 py-3 rounded-lg hover:bg-white/5">
              <MessageCircle size={18} /> Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid sm:grid-cols-3 gap-6">
        {diferenciais.map(d => (
          <div key={d.title} className="ce-card-hover bg-[#16181d] border border-white/5 rounded-2xl p-6">
            <d.icon className="text-[#f5c518] mb-3" size={28} />
            <h3 className="text-white font-semibold">{d.title}</h3>
            <p className="text-sm text-gray-400 mt-2">{d.desc}</p>
          </div>
        ))}
      </section>

      {/* Serviços */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-2xl font-bold text-white text-center">Principais serviços</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
          {servicos.map(s => (
            <div key={s} className="ce-card-hover flex items-center gap-2 bg-[#16181d] border border-white/5 rounded-lg px-4 py-3 text-sm text-gray-300">
              <Zap size={14} className="text-[#f5c518] shrink-0" /> {s}
            </div>
          ))}
        </div>
      </section>

      {/* Processo */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Como funciona o atendimento</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          {['Solicitação e diagnóstico', 'Vistoria (quando necessário)', 'Orçamento detalhado e aprovação', 'Execução com acompanhamento'].map((step, i) => (
            <div key={step} className="ce-card-hover bg-[#16181d] border border-white/5 rounded-xl p-5">
              <div className="text-[#f5c518] font-bold text-xl mb-2">{String(i + 1).padStart(2, '0')}</div>
              <p className="text-sm text-gray-300">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formulário de solicitação */}
      <section id="solicitar" className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="text-2xl font-bold text-white text-center">Solicitar orçamento</h2>
        <p className="text-sm text-gray-400 text-center mt-2">Preencha os dados abaixo. Entraremos em contato o quanto antes.</p>

        {sent ? (
          <div className="mt-8 bg-emerald-600/10 border border-emerald-600/30 rounded-xl p-6 text-center">
            <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={32} />
            <p className="text-emerald-300 font-medium">Solicitação enviada com sucesso!</p>
            <p className="text-sm text-gray-400 mt-1">Nossa equipe entrará em contato em breve.</p>
          </div>
        ) : (
          <form onSubmit={submitLead} className="mt-8 bg-[#16181d] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nome *" value={lead.nome} onChange={v => setLead(l => ({ ...l, nome: v }))} required />
              <Field label="Telefone / WhatsApp *" value={lead.telefone} onChange={v => setLead(l => ({ ...l, telefone: v }))} required />
              <Field label="E-mail" value={lead.email} onChange={v => setLead(l => ({ ...l, email: v }))} type="email" />
              <Field label="CPF ou CNPJ" value={lead.documento} onChange={v => setLead(l => ({ ...l, documento: v }))} />
              <Select label="Tipo de cliente" value={lead.tipo_cliente} options={tiposCliente} onChange={v => setLead(l => ({ ...l, tipo_cliente: v }))} />
              <Select label="Tipo de imóvel" value={lead.tipo_imovel} options={tiposImovel} onChange={v => setLead(l => ({ ...l, tipo_imovel: v }))} />
              <Field label="Endereço do serviço" value={lead.endereco_servico} onChange={v => setLead(l => ({ ...l, endereco_servico: v }))} />
              <Field label="Cidade" value={lead.cidade} onChange={v => setLead(l => ({ ...l, cidade: v }))} />
            </div>
            <Field label="Serviço desejado" value={lead.servico_desejado} onChange={v => setLead(l => ({ ...l, servico_desejado: v }))} />
            <div>
              <label className="text-xs text-gray-400">Descrição do problema ou projeto</label>
              <textarea value={lead.descricao} onChange={e => setLead(l => ({ ...l, descricao: e.target.value }))} rows={3}
                className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
            </div>
            <Select label="Urgência" value={lead.urgencia} options={['baixa', 'media', 'alta', 'emergencia']} onChange={v => setLead(l => ({ ...l, urgencia: v as any }))} />
            <button type="submit" className="ce-btn-glow w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-3 text-sm hover:bg-[#e0b60f]">Enviar solicitação</button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-6">
          <div>
            <Logo variant="horizontal" theme="dark" />
            <p className="text-sm text-gray-500 mt-3">{org.experiencia}</p>
          </div>
          <div className="text-sm text-gray-400 space-y-1">
            <p>{org.telefone}</p>
            <p>{org.email}</p>
            <p>{org.cidade} - {org.estado}</p>
          </div>
          <div className="flex sm:justify-end items-start gap-4">
            <a href={`https://instagram.com/${org.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
              <Camera size={16} /> {org.instagram}
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600 pb-6">© {new Date().getFullYear()} {org.nome_fantasia}. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

function Field({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} type={type}
        className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
