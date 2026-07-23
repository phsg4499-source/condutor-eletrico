import { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
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
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <LogoSymbol theme="dark" className="w-14 h-14" animated />
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
    <div className="relative min-h-screen bg-[#0b0d11] flex overflow-hidden">
      <ElectricBackground />

      <div className="relative z-10 flex flex-col lg:flex-row w-full min-h-screen">
        {/* Lado institucional — presença e impacto */}
        <div className="hidden lg:flex flex-1 flex-col justify-center px-16 xl:px-24">
          <div className="ce-fade-up">
            <Logo variant="horizontal" theme="dark" animated />
          </div>
          <h1 className="ce-fade-up ce-fade-up-1 mt-10 text-4xl xl:text-5xl font-extrabold text-white leading-[1.1] max-w-xl">
            O Condutor Elétrico agora <span className="ce-gradient-text">trabalha por você.</span>
          </h1>
          <p className="ce-fade-up ce-fade-up-2 mt-6 text-gray-400 text-lg max-w-md">
            Orçamentos rápidos, decisões seguras e uma operação mais leve — tudo em um sistema feito
            para vender mais e complicar menos.
          </p>
          <div className="ce-fade-up ce-fade-up-3 mt-10 space-y-4">
            {highlights.map(h => (
              <div key={h.text} className="flex items-center gap-3 text-gray-300">
                <div className="w-9 h-9 rounded-lg bg-[#f5c518]/10 border border-[#f5c518]/20 flex items-center justify-center shrink-0">
                  <h.icon size={16} className="text-[#f5c518]" />
                </div>
                <span className="text-sm">{h.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card de acesso */}
        <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center px-4 py-12 relative">
          <div className="w-full max-w-sm">
            <div className="flex lg:hidden justify-center mb-8 ce-fade-up">
              <Logo variant="vertical" theme="dark" animated />
            </div>

            <form onSubmit={handleSubmit} className="ce-glass-card ce-glass-card-glow ce-pop-in rounded-2xl p-7 space-y-5">
              <div>
                <h2 className="text-white font-bold text-xl">Acessar o sistema</h2>
                <p className="text-xs text-gray-500 mt-1">Entre com suas credenciais para continuar.</p>
              </div>
              <div>
                <label className="text-xs text-gray-400">E-mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" required autoFocus
                  className="ce-input-glow mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Senha</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password" required
                  className="ce-input-glow mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
              </div>
              {error && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <button disabled={loading} type="submit"
                className="ce-btn-glow w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-3 text-sm hover:bg-[#e0b60f] transition-colors disabled:opacity-60">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              {isDemoMode && (
                <p className="text-xs text-gray-500 text-center">
                  Demonstração: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
                </p>
              )}
            </form>
            <p className="text-center mt-6">
              <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">← Voltar ao site</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
