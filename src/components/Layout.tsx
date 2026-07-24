import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, ClipboardList, Boxes, Wrench, BarChart3, Settings, Menu, X, LogOut, HelpCircle, UserCog, CalendarDays, Wallet,
} from 'lucide-react';
import OnboardingTour from './OnboardingTour';
import Logo from './Logo';
import ElectricBackground from './ElectricBackground';
import { TrialBadge, TrialModal } from './TrialNotice';
import { useStore } from '../lib/store';

const navItems = [
  { to: '/app', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/app/ordens-servico', label: 'Ordens de Serviço', icon: ClipboardList },
  { to: '/app/pagamentos', label: 'Pagamentos', icon: Wallet },
  { to: '/app/materiais', label: 'Materiais', icon: Boxes },
  { to: '/app/servicos', label: 'Serviços', icon: Wrench },
  { to: '/app/orcamentistas', label: 'Orçamentistas', icon: UserCog },
  { to: '/app/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/app/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Layout() {
  const { db, user, logout, isDemoMode, authLoading } = useStore();
  const [open, setOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const wasLoggedIn = useRef(false);

  // O guia de introdução (tour) não abre mais sozinho — fica disponível a qualquer momento pelo
  // ícone de ajuda (?) no cabeçalho. O aviso de período de teste continua aparecendo em toda nova
  // entrada no sistema (login ou sessão restaurada).
  useEffect(() => {
    if (user && !wasLoggedIn.current) {
      setShowTrialModal(true);
    }
    wasLoggedIn.current = Boolean(user);
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center gap-4">
        <Logo variant="symbol" theme="dark" animated className="w-12 h-12" />
        <p className="text-xs text-gray-500">Carregando seus dados...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="relative min-h-screen bg-[#0f1115] text-gray-100 flex overflow-hidden">
      <div className="fixed inset-0 z-0">
        <ElectricBackground subtle />
      </div>
      <aside className={`fixed z-30 inset-y-0 left-0 w-64 bg-gradient-to-b from-[#1a1d24] to-[#16181d] border-r border-white/5 transform transition-transform lg:translate-x-0 lg:static ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <Logo variant="horizontal" theme="dark" />
        </div>
        <nav className="p-3 space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'ce-nav-active bg-gradient-to-r from-[#f5c518] to-[#e0b60f] text-[#16181d]'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/[0.05]'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="tracking-tight">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/5 space-y-1 bg-black/10">
          <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white px-3 py-2 w-full rounded-lg hover:bg-white/5 transition-colors">
            <LogOut size={16} /> Sair
          </button>
          <p className="text-[10px] text-gray-600 px-3">Desenvolvido por Simplifica Seguros</p>
        </div>
      </aside>

      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-[#0f1115]/85 backdrop-blur-md sticky top-0 z-20 shadow-[0_1px_0_rgba(245,197,24,0.06)]">
          <button className="lg:hidden text-gray-300" onClick={() => setOpen(o => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex-1" />
          <TrialBadge organizationCreatedAt={db.organization.created_at} />
          {isDemoMode && (
            <span className="hidden sm:inline text-xs px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 mr-3">
              Modo demonstração — dados locais
            </span>
          )}
          <button onClick={() => setShowOnboarding(true)} title="Rever guia de introdução" className="text-gray-400 hover:text-[#f5c518] mr-3">
            <HelpCircle size={18} />
          </button>
          <div className="text-sm text-gray-300">{user.nome}</div>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
      {showOnboarding && <OnboardingTour onClose={() => setShowOnboarding(false)} />}
      {showTrialModal && <TrialModal organizationCreatedAt={db.organization.created_at} onClose={() => setShowTrialModal(false)} />}
    </div>
  );
}
