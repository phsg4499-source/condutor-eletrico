import React, { useState } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useStore, DEMO_CREDENTIALS } from '../lib/store';
import Logo from '../components/Logo';
import AmbientBackground from '../components/AmbientBackground';

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
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#f5c518] rounded-full animate-spin" />
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
    <div className="relative min-h-screen bg-[#0f1115] flex items-center justify-center px-4 overflow-hidden">
      <AmbientBackground />
      <div className="w-full max-w-sm relative ce-fade-up">
        <div className="flex justify-center mb-8">
          <Logo variant="vertical" theme="dark" animated />
        </div>
        <form onSubmit={handleSubmit} className="bg-[#16181d]/90 backdrop-blur border border-white/5 rounded-2xl p-6 space-y-4 ce-pop-in">
          <h1 className="text-white font-semibold text-lg text-center">Acessar o sistema</h1>
          <div>
            <label className="text-xs text-gray-400">E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
          </div>
          <div>
            <label className="text-xs text-gray-400">Senha</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required
              className="mt-1 w-full rounded-lg bg-[#0f1115] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#f5c518]" />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button disabled={loading} type="submit"
            className="ce-btn-glow w-full bg-[#f5c518] text-[#16181d] font-semibold rounded-lg py-2.5 text-sm hover:bg-[#e0b60f] transition-colors disabled:opacity-60">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {isDemoMode && (
            <p className="text-xs text-gray-500 text-center">
              Demonstração: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
            </p>
          )}
        </form>
        <p className="text-center mt-5">
          <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">← Voltar ao site</Link>
        </p>
      </div>
    </div>
  );
}
