import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import { ToastProvider } from './lib/toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Materials from './pages/Materials';
import Services from './pages/Services';
import Orcamentistas from './pages/Orcamentistas';
import Agenda from './pages/Agenda';
import Budgets from './pages/Budgets';
import BudgetWizard from './pages/BudgetWizard';
import BudgetView from './pages/BudgetView';
import { ServiceOrdersList, ServiceOrderView } from './pages/ServiceOrders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Landing from './pages/public/Landing';
import InstallPrompt from './components/InstallPrompt';

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
      <BrowserRouter>
        <InstallPrompt />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/site" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="materiais" element={<Materials />} />
            <Route path="servicos" element={<Services />} />
            <Route path="orcamentistas" element={<Orcamentistas />} />
            <Route path="orcamentos" element={<Budgets />} />
            <Route path="orcamentos/novo" element={<BudgetWizard />} />
            <Route path="orcamentos/:id/editar" element={<BudgetWizard />} />
            <Route path="orcamentos/:id" element={<BudgetView />} />
            <Route path="ordens-servico" element={<ServiceOrdersList />} />
            <Route path="ordens-servico/:id" element={<ServiceOrderView />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="configuracoes" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
