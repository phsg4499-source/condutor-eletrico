import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Zap, ShieldCheck, Gauge } from 'lucide-react';
import { useStore, DEMO_CREDENTIALS } from '../lib/store';
import Logo, { LogoSymbol } from '../components/Logo';
import ElectricBackground from '../components/ElectricBackground';

const highlights = [
  { icon: Zap, text: 'Orçamentos calculados na hora, sem planilha' },
  { icon: ShieldCheck, text: 'Custo e margem sempre sob controle' },
  { icon: Gauge, text: 'Do orçamento à ordem de serviço em um clique' },
];

export default function Login() {
  const { login, user, authLoading, isDemoMode } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState(isDemoMode ? DEMO_CREDENTIALS.email : '');
  const [password, setPassword] = useState(isDemoMode ? DEMO_CREDENTIALS.password : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f4f7fa] flex items-center justify-center">
        <LogoSymbol theme="light" className="w-14 h-14" animated />
      </div>
    );
  }

  if (user) return <Navigate to="/app" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate('/app');
    else setError(res.error ?? 'Não foi possível entrar.');
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#f4f7fa] to-[#e8f3f8] flex overflow-hidden">
      <ElectricBackground />

      <div className="relative z-10 flex flex-col lg:flex-row w-full min-h-screen">
        {/* Lado institucional — presença e impacto */}
        <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24 relative">
          <div className="ce-fade-up">
            <Logo variant="horizontal" theme="light" animated />
          </div>
          <h1 className="ce-fade-up ce-fade-up-1 mt-10 text-4xl xl:text-5xl font-extrabold text-[#0b2338] leading-[1.1] max-w-xl">
            Sansão, <span className="ce-gradient-text">seu trabalho move</span> a vida de muita gente.
          </h1>
          <p className="ce-fade-up ce-fade-up-2 mt-6 text-slate-500 text-lg max-w-md">
            Cada orçamento fechado é resultado do seu esforço. Continue — o sistema cuida da parte
            chata, você cuida do que faz de melhor.
          </p>
          <div className="ce-fade-up ce-fade-up-3 mt-10 space-y-4">
            {highlights.map(h => (
              <div key={h.text} className="flex items-center gap-3 text-slate-600">
                <div className="w-9 h-9 rounded-lg bg-[#00B4E5]/10 border border-[#00B4E5]/25 flex items-center justify-center shrink-0">
                  <h.icon size={16} className="text-[#0069A8]" />
                </div>
                <span className="text-sm">{h.text}</span>
              </div>
            ))}
          </div>

          <p className="absolute bottom-8 left-16 xl:left-24 text-[11px] text-slate-400">
            Desenvolvido por <span className="text-slate-500 font-medium">Simplifica Seguros</span> · © {new Date().getFullYear()} Todos os direitos reservados.
          </p>
        </div>

        {/* Card de acesso */}
        <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center px-4 py-12 relative">
          <div className="w-full max-w-sm">
            <div className="flex lg:hidden justify-center mb-8 ce-fade-up">
              <Logo variant="vertical" theme="light" animated />
            </div>

            <form onSubmit={handleSubmit} className="ce-glass-card ce-glass-card-glow ce-pop-in rounded-2xl p-7 space-y-5">
              <div>
                <h2 className="text-[#0b2338] font-bold text-xl">Acessar o sistema</h2>
                <p className="text-xs text-slate-500 mt-1">Entre com suas credenciais para continuar.</p>
              </div>
              <div>
                <label className="text-xs text-slate-500">E-mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoFocus
                  className="ce-input-glow mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Senha</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" required
                  className="ce-input-glow mt-1 w-full rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-[#0b2338] focus:outline-none focus:border-[#00B4E5]" />
              </div>
              {error && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <button disabled={loading} type="submit"
                className="ce-btn-glow w-full bg-gradient-to-r from-[#00B4E5] to-[#0069A8] text-white font-semibold rounded-lg py-3 text-sm hover:brightness-105 transition-all disabled:opacity-60">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              {isDemoMode && (
                <p className="text-xs text-slate-500 text-center">
                  Demonstração: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
                </p>
              )}
            </form>

            <p className="text-center text-[11px] text-slate-400 mt-6">
              Desenvolvido por <span className="text-slate-500 font-medium">Simplifica Seguros</span>
              <br />
              © {new Date().getFullYear()} Simplifica Seguros. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
