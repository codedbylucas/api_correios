import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { BrandMark, BRAND_NAME } from '../components/Brand';
import { panelButton, panelCard, panelInput } from '../components/panel/ui';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/panel" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/panel', { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandMark size={56} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Painel {BRAND_NAME}</h1>
          <p className="text-sm text-white/40 mt-1">Acesse com o usuário criado no bootstrap.</p>
        </div>
        <form onSubmit={submit} className={`${panelCard} p-8 space-y-4`}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" className={panelInput} required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" className={panelInput} required />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className={`${panelButton} w-full`}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Entrar
          </button>
          <Link to="/forgot-password" className="block text-center text-xs text-[#E7B24A] hover:underline">Esqueci minha senha</Link>
        </form>
      </div>
    </div>
  );
}
