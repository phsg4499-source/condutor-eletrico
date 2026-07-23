import { useState } from 'react';
import { Users, FileText, Boxes, Wrench, ClipboardList, Sparkles, ArrowRight, UserCog, X } from 'lucide-react';
import Logo from './Logo';

const steps = [
  {
    icon: Sparkles,
    title: 'Bem-vindo ao seu sistema!',
    text: 'Vamos te mostrar rapidinho por onde começar. Leva menos de 1 minuto — e você pode pular quando quiser.',
  },
  {
    icon: Users,
    title: '1. Cadastre seus clientes',
    text: 'Em "Clientes", registre pessoa física ou jurídica. Preencha telefone e WhatsApp com DDI (ex: 5511999998888) — isso é usado para abrir a conversa direto do orçamento.',
  },
  {
    icon: Boxes,
    title: '2. Ajuste materiais e serviços',
    text: 'Já vêm dezenas de itens de exemplo cadastrados (fios, disjuntores, instalações...). Os preços são apenas sugestões — edite-os para refletir os valores que você realmente cobra.',
  },
  {
    icon: UserCog,
    title: '3. Cadastre os orçamentistas',
    text: 'Em "Orçamentistas", registre quem monta os orçamentos na sua empresa. Ao criar um orçamento, você escolhe o responsável — o nome dele aparece no PDF entregue ao cliente.',
  },
  {
    icon: FileText,
    title: '4. Monte um orçamento',
    text: 'Em "Orçamentos" → "Novo orçamento", escolha o cliente e o responsável, adicione serviços/materiais do catálogo (ou personalizados), custos extras e condições de pagamento. O sistema calcula custo, margem e valor final na hora.',
  },
  {
    icon: ClipboardList,
    title: '5. PDF, WhatsApp e ordens de serviço',
    text: 'Dentro do orçamento você gera um PDF premium pronto para impressionar o cliente, envia pelo WhatsApp com um clique, muda o status e — quando aprovado — converte direto em ordem de serviço.',
  },
  {
    icon: Wrench,
    title: 'Pronto para começar!',
    text: 'Este guia aparece toda vez que você entra no sistema. Você também pode reabri-lo a qualquer momento pelo ícone de ajuda no topo da tela.',
  },
];

export default function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-[200] ce-spotlight-in">
      <div key={step} className="ce-pop-in ce-glass-card rounded-2xl p-6 w-full max-w-md relative overflow-hidden">
        <div className="ce-blob absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#f5c518]/10 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-5 relative">
          <Logo variant="horizontal" theme="dark" />
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-[#f5c518]/15 flex items-center justify-center mb-4 ce-glow-pulse">
            <Icon className="text-[#f5c518]" size={24} />
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">{current.title}</h2>
          <p className="text-sm text-gray-400 leading-relaxed">{current.text}</p>
        </div>

        <div className="flex items-center gap-1.5 mt-6 mb-5">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[#f5c518]' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-300">Pular tour</button>
          <button
            onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
            className="ce-btn-glow flex items-center gap-2 bg-[#f5c518] text-[#16181d] font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-[#e0b60f]"
          >
            {isLast ? 'Começar a usar' : 'Próximo'} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
