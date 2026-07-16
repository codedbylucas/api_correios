import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { panelButton, panelCard, panelInput } from '../components/panel/ui';

type KeyRow = { id: string; name: string; createdAt: string; lastUsedAt?: string | null; revokedAt?: string | null };

const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const data = await api<{ keys: KeyRow[] }>('/api/webhooks/keys');
    setKeys(data.keys);
  };

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api<KeyRow & { apiKey: string }>('/api/webhooks/keys', { method: 'POST', body: JSON.stringify({ name }) });
      setSecret(created.apiKey);
      setName('');
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/webhooks/keys/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-10 lg:px-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><KeyRound className="w-6 h-6 text-[#E7B24A]" /> Chaves de API</h1>
        <p className="text-sm text-white/40 mt-1">Crie e revogue chaves usadas nas integrações externas.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {secret && <div className={`${panelCard} p-5 border-[#E7B24A]/30`}><p className="text-xs text-[#E7B24A] font-bold uppercase mb-2">Chave exibida uma única vez</p><code className="block text-xs bg-black/30 p-3 rounded-xl break-all">{secret}</code></div>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={create} className={`${panelCard} p-6 space-y-3 lg:col-span-4`}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da chave" className={panelInput} required />
          <button disabled={busy} className={`${panelButton} w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar chave</button>
        </form>
        <div className="lg:col-span-8 space-y-2">
          {keys.map((key) => (
            <div key={key.id} className={`${panelCard} p-5 flex items-center justify-between gap-4`}>
              <div>
                <p className="text-sm font-medium">{key.name}</p>
                <p className="text-[11px] text-white/35 mt-1">criada {fmtDate(key.createdAt)} · último uso {fmtDate(key.lastUsedAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-semibold ${key.revokedAt ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{key.revokedAt ? 'Revogada' : 'Ativa'}</span>
                {!key.revokedAt && <button onClick={() => revoke(key.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg" title="Revogar"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
          {keys.length === 0 && <p className="text-sm text-white/35">Nenhuma chave criada ainda.</p>}
        </div>
      </div>
    </div>
  );
}
