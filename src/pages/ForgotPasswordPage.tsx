import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { api } from '../lib/api';
import { panelButton, panelCard, panelInput } from '../components/panel/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const data = await api<{ ok: boolean; resetToken?: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    setMessage('Se o usuário existir, um token de redefinição foi gerado.');
    setResetToken(data.resetToken || null);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className={`${panelCard} p-8 space-y-4 w-full max-w-md`}>
        <h1 className="text-xl font-bold">Recuperar senha</h1>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@empresa.com" className={panelInput} required />
        <button className={`${panelButton} w-full`}><Mail className="w-4 h-4" /> Gerar token</button>
        {message && <p className="text-sm text-white/50">{message}</p>}
        {resetToken && <code className="block text-xs bg-black/30 p-3 rounded-xl break-all">{resetToken}</code>}
        <Link to="/login" className="block text-xs text-[#E7B24A] hover:underline">Voltar para login</Link>
      </form>
    </div>
  );
}
