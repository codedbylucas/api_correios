import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, Bell, BookOpen, Home, KeyRound, LayoutGrid, LogOut, PackageSearch, Settings, Webhook } from 'lucide-react';
import { BrandMark, BRAND_NAME } from '../components/Brand';
import { useAuth } from '../hooks/useAuth';

const items = [
  { to: '/panel', label: 'Início', icon: Home },
  { to: '/panel/webhooks', label: 'Webhooks', icon: Webhook },
  { to: '/panel/api-keys', label: 'Chaves API', icon: KeyRound },
  { to: '/panel/docs', label: 'Documentação', icon: BookOpen },
  { to: '/panel/rastreios', label: 'Rastreios', icon: PackageSearch },
  { to: '/panel/alertas', label: 'Alertas', icon: Bell },
  { to: '/panel/relatorios', label: 'Relatórios', icon: Activity },
  { to: '/panel/integracoes', label: 'Integrações', icon: LayoutGrid },
  { to: '/panel/configuracoes', label: 'Configurações', icon: Settings },
];

export default function PanelLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col lg:flex-row">
      <aside className="lg:w-68 lg:min-h-screen border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0A0A0B]">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <BrandMark size={36} />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{BRAND_NAME}</p>
            <p className="text-[11px] text-white/35 truncate">{user?.email}</p>
          </div>
        </div>
        <nav className="flex lg:flex-col gap-1 p-3 overflow-x-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/panel'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? 'bg-[#E7B24A]/10 text-[#E7B24A]' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 hidden lg:block">
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
