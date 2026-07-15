import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { panelButton, panelCard, panelInput } from '../components/panel/ui';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState(new URLSearchParams(window.location.search).get('token') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className={`${panelCard} p-8 space-y-4 w-full max-w-md`}>
        <h1 className="text-xl font-bold">Redefinir senha</h1>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token" className={`${panelInput} font-mono text-xs`} required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nova senha" className={panelInput} required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className={`${panelButton} w-full`}><KeyRound className="w-4 h-4" /> Redefinir</button>
        <Link to="/login" className="block text-xs text-[#E7B24A] hover:underline">Voltar para login</Link>
      </form>
    </div>
  );
}
