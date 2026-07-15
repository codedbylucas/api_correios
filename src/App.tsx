import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PanelLayout from './pages/PanelLayout';
import WebhooksPage from './pages/WebhooksPage';
import ApiKeysPage from './pages/ApiKeysPage';
import ComingSoon from './pages/ComingSoon';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0A0A0B] text-white grid place-items-center text-sm text-white/40">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <PanelLayout />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/panel" element={<ProtectedRoute />}>
        <Route index element={<ComingSoon title="Início" />} />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route path="api-keys" element={<ApiKeysPage />} />
        <Route path="rastreios" element={<ComingSoon title="Rastreios" />} />
        <Route path="alertas" element={<ComingSoon title="Alertas" />} />
        <Route path="relatorios" element={<ComingSoon title="Relatórios" />} />
        <Route path="integracoes" element={<ComingSoon title="Integrações" />} />
        <Route path="configuracoes" element={<ComingSoon title="Configurações" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
