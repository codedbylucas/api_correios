import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Webhook, Clock, ListChecks, Send, RefreshCw, Pause, Play,
  Copy, Check, Plus, XCircle, ShieldCheck, Trash2,
  LayoutGrid, Activity, Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface EndpointRow {
  id: string;
  url: string;
  description?: string | null;
  active: boolean;
  consecutiveFailures: number;
  pausedAt?: string | null;
  createdAt: string;
  signingSecret?: string;
}

interface ProfileRow {
  id: string;
  name: string;
  frequencyHours: number;
  windowHours?: number | null;
  stopOnDelivered: boolean;
  createdAt: string;
}

interface SubscriptionRow {
  id: string;
  endpointId: string;
  profileId: string;
  code: string;
  carrier: string;
  active: boolean;
  requestsCount: number;
  lastCheckedAt?: string | null;
  nextCheckAt: string;
  endedAt?: string | null;
  createdAt: string;
}

interface DeliveryRow {
  id: string;
  endpointId: string;
  endpointUrl: string;
  code: string;
  attempt: number;
  status: string;
  responseStatus?: number | null;
  error?: string | null;
  nextAttemptAt: string;
  deliveredAt?: string | null;
  createdAt: string;
}

interface KeyRow {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

type Tab = 'overview' | 'endpoints' | 'profiles' | 'subscriptions' | 'deliveries' | 'keys';

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function useApi(onUnauthorized: () => void) {
  return useCallback(
    async (path: string, options: RequestInit = {}) => {
      const res = await fetch(path, {
        credentials: 'include',
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (res.status === 401) {
        onUnauthorized();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || `Erro ${res.status}`);
      }
      return body;
    },
    [onUnauthorized]
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1.5 h-1.5 rounded-full bg-[#E7B24A]" />
      <h2 className="text-[11px] uppercase tracking-[0.2em] font-bold text-white/40">{children}</h2>
    </div>
  );
}

function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return ok ? (
    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full uppercase font-semibold whitespace-nowrap">
      {okLabel}
    </span>
  ) : (
    <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded-full uppercase font-semibold whitespace-nowrap">
      {badLabel}
    </span>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="bg-[#131316] rounded-2xl border border-white/8 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider font-bold text-white/40">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-[#E7B24A]/10 text-[#E7B24A] flex items-center justify-center shrink-0">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-[11px] text-white/30">{hint}</p>
    </div>
  );
}

function SecretBanner({ label, value, onDismiss }: { label: string; value: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 bg-[#E7B24A]/10 border border-[#E7B24A]/30 rounded-2xl space-y-2"
    >
      <div className="flex items-center gap-2 text-[#E7B24A]">
        <ShieldCheck className="w-4 h-4" />
        <p className="text-xs font-bold uppercase tracking-wider">{label} — exibido uma única vez, guarde agora</p>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono bg-black/30 text-white/90 p-3 rounded-xl break-all">{value}</code>
        <button onClick={copy} className="p-3 rounded-xl bg-black/30 hover:bg-black/50 transition-colors" title="Copiar">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#E7B24A]" />}
        </button>
      </div>
      <button onClick={onDismiss} className="text-[10px] uppercase tracking-wider font-bold text-[#E7B24A]/80 underline underline-offset-4">
        Já guardei, ocultar
      </button>
    </motion.div>
  );
}

const inputCls =
  'w-full p-3 bg-[#141416] text-white placeholder-white/30 rounded-xl border border-white/10 focus:ring-2 focus:ring-[#E7B24A]/25 focus:border-[#E7B24A]/60 outline-none transition-all text-sm';

const primaryBtnCls =
  'h-11 px-6 bg-[#E7B24A] text-[#1A1207] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed';

const ghostBtnCls =
  'px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/5 transition-colors text-xs font-medium flex items-center gap-1.5 text-white/70 whitespace-nowrap';

const cardCls = 'bg-[#131316] rounded-3xl border border-white/8 shadow-lg shadow-black/20';
const rowCls = 'bg-[#131316] rounded-2xl border border-white/8';

const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Visão Geral', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'endpoints', label: 'Endpoints', icon: <Webhook className="w-4 h-4" /> },
  { id: 'profiles', label: 'Perfis', icon: <Clock className="w-4 h-4" /> },
  { id: 'subscriptions', label: 'Inscrições', icon: <ListChecks className="w-4 h-4" /> },
  { id: 'deliveries', label: 'Entregas', icon: <Send className="w-4 h-4" /> },
  { id: 'keys', label: 'Chaves de API', icon: <KeyRound className="w-4 h-4" /> },
];

const tabDescriptions: Record<Tab, string> = {
  overview: 'Resumo do monitoramento de rastreios e das integrações de webhook.',
  endpoints: 'URLs que recebem as notificações assinadas quando um rastreio muda.',
  profiles: 'Frequências e regras de encerramento do monitoramento automático.',
  subscriptions: 'Códigos de rastreio inscritos para verificação periódica.',
  deliveries: 'Histórico de entregas de eventos aos seus endpoints, com reenvio de falhas.',
  keys: 'Chaves de API usadas para autenticar no Painel e na API de webhooks.',
};

export default function WebhooksPage() {
  const { logout: authLogout } = useAuth();
  const navigate = useNavigate();

  const handleUnauthorized = useCallback(() => {
    authLogout();
    navigate('/login', { replace: true });
  }, [authLogout, navigate]);

  const api = useApi(handleUnauthorized);

  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null);

  const [endpoints, setEndpoints] = useState<EndpointRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [deliveryFilter, setDeliveryFilter] = useState('');

  const [endpointForm, setEndpointForm] = useState({ url: '', description: '' });
  const [profileForm, setProfileForm] = useState({ name: '', frequencyHours: 4, windowHours: '', stopOnDelivered: true });
  const [subscriptionForm, setSubscriptionForm] = useState({ endpointId: '', profileId: '', codes: '' });
  const [keyForm, setKeyForm] = useState({ name: '' });

  const refresh = useCallback(
    async (which: Tab) => {
      setError(null);
      try {
        if (which === 'overview') {
          const [eps, profs, subs, dels] = await Promise.all([
            api('/api/webhooks/endpoints'),
            api('/api/webhooks/profiles'),
            api('/api/tracking-subscriptions'),
            api('/api/webhooks/deliveries'),
          ]);
          setEndpoints(eps.endpoints);
          setProfiles(profs.profiles);
          setSubscriptions(subs.subscriptions);
          setDeliveries(dels.deliveries);
        }
        if (which === 'endpoints') setEndpoints((await api('/api/webhooks/endpoints')).endpoints);
        if (which === 'profiles') setProfiles((await api('/api/webhooks/profiles')).profiles);
        if (which === 'subscriptions') {
          const [subs, eps, profs] = await Promise.all([
            api('/api/tracking-subscriptions'),
            api('/api/webhooks/endpoints'),
            api('/api/webhooks/profiles'),
          ]);
          setSubscriptions(subs.subscriptions);
          setEndpoints(eps.endpoints);
          setProfiles(profs.profiles);
        }
        if (which === 'deliveries') {
          const qs = deliveryFilter ? `?endpointId=${deliveryFilter}` : '';
          const [dels, eps] = await Promise.all([api(`/api/webhooks/deliveries${qs}`), api('/api/webhooks/endpoints')]);
          setDeliveries(dels.deliveries);
          setEndpoints(eps.endpoints);
        }
        if (which === 'keys') setKeys((await api('/api/webhooks/keys')).keys);
      } catch (err: any) {
        setError(err.message);
      }
    },
    [api, deliveryFilter]
  );

  useEffect(() => {
    refresh(tab);
  }, [tab, refresh]);

  const stats = useMemo(() => {
    const activeEndpoints = endpoints.filter((e) => e.active).length;
    const activeSubs = subscriptions.filter((s) => s.active).length;
    const successDeliveries = deliveries.filter((d) => d.status === 'success').length;
    const failedDeliveries = deliveries.filter((d) => d.status === 'failed').length;
    return {
      activeEndpoints,
      totalEndpoints: endpoints.length,
      totalProfiles: profiles.length,
      activeSubs,
      totalSubs: subscriptions.length,
      successDeliveries,
      failedDeliveries,
    };
  }, [endpoints, profiles, subscriptions, deliveries]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const activeItem = navItems.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-[calc(100vh-5rem)]">
      {/* Sub-navegação de Webhooks */}
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 lg:sticky lg:top-0 lg:h-screen flex lg:flex-col bg-[#0A0A0B]">
        <nav className="flex lg:flex-col gap-1 px-3 py-3 lg:py-6 overflow-x-auto lg:overflow-visible flex-1">
          {navItems.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 lg:shrink ${
                tab === t.id ? 'bg-[#E7B24A]/10 text-[#E7B24A]' : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
        <div className="hidden lg:flex flex-col gap-2 px-3 py-4 border-t border-white/10">
          <button onClick={() => refresh(tab)} className={ghostBtnCls}>
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 px-6 py-8 lg:px-10 lg:py-10 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3 lg:hidden">
          <button onClick={() => refresh(tab)} className={ghostBtnCls}>
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="text-[#E7B24A]">{activeItem.icon}</span>
            {activeItem.label}
          </h1>
          <p className="text-sm text-white/40 mt-1 max-w-xl">{tabDescriptions[tab]}</p>
        </div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.p>
        )}

        <AnimatePresence>{secret && <SecretBanner label={secret.label} value={secret.value} onDismiss={() => setSecret(null)} />}</AnimatePresence>

        {tab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                icon={<Webhook className="w-4 h-4" />}
                label="Endpoints ativos"
                value={`${stats.activeEndpoints}/${stats.totalEndpoints}`}
                hint="recebendo entregas de webhook"
              />
              <StatCard
                icon={<Clock className="w-4 h-4" />}
                label="Perfis de monitoramento"
                value={stats.totalProfiles}
                hint="frequências configuradas"
              />
              <StatCard
                icon={<ListChecks className="w-4 h-4" />}
                label="Inscrições ativas"
                value={`${stats.activeSubs}/${stats.totalSubs}`}
                hint="códigos sendo monitorados"
              />
              <StatCard
                icon={<Activity className="w-4 h-4" />}
                label="Entregas (sucesso / falha)"
                value={`${stats.successDeliveries} / ${stats.failedDeliveries}`}
                hint="janela mais recente"
              />
            </div>

            <div>
              <SectionLabel>Endpoints Recentes</SectionLabel>
              <div className="space-y-3">
                {endpoints.length === 0 && <p className="text-sm text-white/30 p-4">Nenhum endpoint cadastrado ainda.</p>}
                {endpoints.slice(0, 5).map((ep) => (
                  <div key={ep.id} className={`${rowCls} p-5 flex items-center justify-between gap-4`}>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-white/90 truncate">{ep.url}</p>
                      <p className="text-[11px] text-white/30 mt-1">
                        {ep.description || 'Sem descrição'} · criado {fmtDate(ep.createdAt)}
                      </p>
                    </div>
                    <StatusPill ok={ep.active} okLabel="Ativo" badLabel="Pausado" />
                  </div>
                ))}
                {endpoints.length > 5 && (
                  <button
                    onClick={() => setTab('endpoints')}
                    className="text-[11px] uppercase tracking-wider font-bold text-[#E7B24A]/80 hover:text-[#E7B24A] underline underline-offset-4"
                  >
                    Ver todos os endpoints
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'endpoints' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5">
              <SectionLabel>Novo Endpoint</SectionLabel>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const created = await api('/api/webhooks/endpoints', {
                      method: 'POST',
                      body: JSON.stringify({ url: endpointForm.url, description: endpointForm.description || undefined }),
                    });
                    setSecret({ label: 'Signing secret do endpoint', value: created.signingSecret });
                    setEndpointForm({ url: '', description: '' });
                    await refresh('endpoints');
                  });
                }}
                className={`${cardCls} p-6 space-y-3`}
              >
                <input
                  value={endpointForm.url}
                  onChange={(e) => setEndpointForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://seu-servidor.com/webhooks/correios"
                  className={`${inputCls} font-mono text-xs`}
                  required
                />
                <input
                  value={endpointForm.description}
                  onChange={(e) => setEndpointForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição (opcional)"
                  className={inputCls}
                />
                <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
                  <Plus className="w-4 h-4" /> Criar Endpoint
                </button>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  O signing secret usado para assinar as entregas (HMAC-SHA256) é exibido uma única vez após a criação.
                </p>
              </form>
            </div>
            <div className="lg:col-span-7">
              <SectionLabel>Endpoints Cadastrados ({endpoints.length})</SectionLabel>
              <div className="space-y-3">
                {endpoints.length === 0 && <p className="text-sm text-white/30 p-4">Nenhum endpoint cadastrado ainda.</p>}
                {endpoints.map((ep) => (
                  <div key={ep.id} className={`${rowCls} p-5 flex items-center justify-between gap-4`}>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-medium text-white/90 truncate">{ep.url}</p>
                      <p className="text-[11px] text-white/30 mt-1">
                        {ep.description || 'Sem descrição'} · criado {fmtDate(ep.createdAt)}
                        {ep.consecutiveFailures > 0 && (
                          <span className="text-amber-400"> · {ep.consecutiveFailures} falha(s) consecutiva(s)</span>
                        )}
                      </p>
                      <p className="text-[10px] font-mono text-white/20 mt-1">{ep.id}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusPill ok={ep.active} okLabel="Ativo" badLabel="Pausado" />
                      <button
                        onClick={() => {
                          const url = window.prompt('URL do endpoint', ep.url);
                          if (!url) return;
                          const description = window.prompt('Descrição do endpoint', ep.description || '') ?? '';
                          run(async () => {
                            await api(`/api/webhooks/endpoints/${ep.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ url, description }),
                            });
                            await refresh('endpoints');
                          });
                        }}
                        className={ghostBtnCls}
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button
                        onClick={() =>
                          run(async () => {
                            const result = await api<{ ok: boolean; status?: number; error?: string }>(`/api/webhooks/endpoints/${ep.id}/test`, { method: 'POST' });
                            window.alert(result.ok ? `Teste enviado: HTTP ${result.status}` : `Falha no teste: ${result.error || result.status || 'sem resposta'}`);
                          })
                        }
                        className={ghostBtnCls}
                      >
                        <Send className="w-3.5 h-3.5" /> Testar
                      </button>
                      <button
                        onClick={() =>
                          run(async () => {
                            await api(`/api/webhooks/endpoints/${ep.id}/active`, {
                              method: 'PATCH',
                              body: JSON.stringify({ active: !ep.active }),
                            });
                            await refresh('endpoints');
                          })
                        }
                        className={ghostBtnCls}
                      >
                        {ep.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {ep.active ? 'Pausar' : 'Reativar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'profiles' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5">
              <SectionLabel>Novo Perfil de Monitoramento</SectionLabel>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api('/api/webhooks/profiles', {
                      method: 'POST',
                      body: JSON.stringify({
                        name: profileForm.name,
                        frequencyHours: Number(profileForm.frequencyHours),
                        windowHours: profileForm.windowHours ? Number(profileForm.windowHours) : undefined,
                        stopOnDelivered: profileForm.stopOnDelivered,
                      }),
                    });
                    setProfileForm({ name: '', frequencyHours: 4, windowHours: '', stopOnDelivered: true });
                    await refresh('profiles');
                  });
                }}
                className={`${cardCls} p-6 space-y-3`}
              >
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do perfil (ex: padrão)"
                  className={inputCls}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Frequência (horas)</span>
                    <select
                      value={profileForm.frequencyHours}
                      onChange={(e) => setProfileForm((f) => ({ ...f, frequencyHours: Number(e.target.value) }))}
                      className={inputCls}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                        <option key={h} value={h}>a cada {h}h</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/30">Janela (horas)</span>
                    <input
                      type="number"
                      min={1}
                      value={profileForm.windowHours}
                      onChange={(e) => setProfileForm((f) => ({ ...f, windowHours: e.target.value }))}
                      placeholder="Sem limite"
                      className={inputCls}
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm py-1 cursor-pointer text-white/80">
                  <input
                    type="checkbox"
                    checked={profileForm.stopOnDelivered}
                    onChange={(e) => setProfileForm((f) => ({ ...f, stopOnDelivered: e.target.checked }))}
                    className="accent-[#E7B24A] w-4 h-4"
                  />
                  Encerrar monitoramento quando o objeto for entregue
                </label>
                <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
                  <Plus className="w-4 h-4" /> Criar Perfil
                </button>
              </form>
            </div>
            <div className="lg:col-span-7">
              <SectionLabel>Perfis Criados ({profiles.length})</SectionLabel>
              <div className="space-y-3">
                {profiles.length === 0 && <p className="text-sm text-white/30 p-4">Nenhum perfil criado ainda.</p>}
                {profiles.map((p) => (
                  <div key={p.id} className={`${rowCls} p-5 flex items-center justify-between gap-4`}>
                    <div>
                      <p className="text-sm font-medium text-white/90">{p.name}</p>
                      <p className="text-[11px] text-white/30 mt-1">
                        verifica a cada {p.frequencyHours}h · {p.windowHours ? `janela de ${p.windowHours}h` : 'sem janela'} ·{' '}
                        {p.stopOnDelivered ? 'para na entrega' : 'não para na entrega'}
                      </p>
                      <p className="text-[10px] font-mono text-white/20 mt-1">{p.id}</p>
                    </div>
                    <span className="text-[10px] bg-white/5 text-white/50 px-2 py-1 rounded-full uppercase font-semibold">
                      {Math.floor(24 / p.frequencyHours)} checks/dia
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'subscriptions' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5">
              <SectionLabel>Inscrever Códigos</SectionLabel>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const codes = subscriptionForm.codes
                      .split('\n')
                      .map((c) => c.trim().toUpperCase())
                      .filter(Boolean);
                    await api('/api/tracking-subscriptions', {
                      method: 'POST',
                      body: JSON.stringify({ endpointId: subscriptionForm.endpointId, profileId: subscriptionForm.profileId, codes }),
                    });
                    setSubscriptionForm((f) => ({ ...f, codes: '' }));
                    await refresh('subscriptions');
                  });
                }}
                className={`${cardCls} p-6 space-y-3`}
              >
                <select
                  value={subscriptionForm.endpointId}
                  onChange={(e) => setSubscriptionForm((f) => ({ ...f, endpointId: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Selecione o endpoint…</option>
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.url}</option>
                  ))}
                </select>
                <select
                  value={subscriptionForm.profileId}
                  onChange={(e) => setSubscriptionForm((f) => ({ ...f, profileId: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Selecione o perfil…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (a cada {p.frequencyHours}h)</option>
                  ))}
                </select>
                <textarea
                  value={subscriptionForm.codes}
                  onChange={(e) => setSubscriptionForm((f) => ({ ...f, codes: e.target.value }))}
                  placeholder="Um código por linha (ex: AA361812099BR)&#10;Até 100 por lote"
                  className={`${inputCls} h-36 font-mono text-xs resize-none`}
                  required
                />
                <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
                  <Plus className="w-4 h-4" /> Inscrever Códigos
                </button>
                <p className="text-[11px] text-white/30 leading-relaxed">
                  Formato AA123456789BR. Um código inválido rejeita o lote inteiro.
                </p>
              </form>
            </div>
            <div className="lg:col-span-7">
              <SectionLabel>Inscrições ({subscriptions.length})</SectionLabel>
              <div className="space-y-2">
                {subscriptions.length === 0 && <p className="text-sm text-white/30 p-4">Nenhuma inscrição ainda.</p>}
                {subscriptions.map((s) => (
                  <div key={s.id} className={`${rowCls} px-5 py-3 flex items-center justify-between gap-4`}>
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-white/90">{s.code}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {s.requestsCount} verificação(ões) · última {fmtDate(s.lastCheckedAt)} ·{' '}
                        {s.active ? `próxima ${fmtDate(s.nextCheckAt)}` : `encerrada ${fmtDate(s.endedAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusPill ok={s.active} okLabel="Ativa" badLabel="Encerrada" />
                      {s.active && (
                        <button
                          onClick={() =>
                            run(async () => {
                              await api('/api/tracking-subscriptions', { method: 'DELETE', body: JSON.stringify({ ids: [s.id] }) });
                              await refresh('subscriptions');
                            })
                          }
                          className={`${ghostBtnCls} text-red-400 border-red-500/20 hover:bg-red-500/10`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Encerrar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'deliveries' && (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <SectionLabel>Histórico de Entregas ({deliveries.length})</SectionLabel>
              <select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)} className={`${inputCls} max-w-xs`}>
                <option value="">Todos os endpoints</option>
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.url}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {deliveries.length === 0 && (
                <p className="text-sm text-white/30 p-4">
                  Nenhuma entrega registrada. Entregas aparecem aqui quando os dados de rastreio de um código inscrito mudam.
                </p>
              )}
              {deliveries.map((d) => (
                <div key={d.id} className={`${rowCls} px-5 py-3 flex items-center justify-between gap-4`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-medium text-white/90">{d.code}</p>
                      <span className="text-[10px] text-white/20">→</span>
                      <p className="font-mono text-[11px] text-white/30 truncate">{d.endpointUrl}</p>
                    </div>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      tentativa {d.attempt}/5 · {fmtDate(d.createdAt)}
                      {d.responseStatus ? ` · HTTP ${d.responseStatus}` : ''}
                      {d.error ? ` · ${d.error}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {d.status === 'success' && <StatusPill ok okLabel="Entregue" badLabel="" />}
                    {d.status === 'pending' && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full uppercase font-semibold">
                        Pendente
                      </span>
                    )}
                    {d.status === 'failed' && <StatusPill ok={false} okLabel="" badLabel="Falhou" />}
                    {d.status === 'failed' && (
                      <button
                        onClick={() =>
                          run(async () => {
                            await api(`/api/webhooks/deliveries/${d.id}/redeliver`, { method: 'POST' });
                            await refresh('deliveries');
                          })
                        }
                        className={ghostBtnCls}
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Reenviar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'keys' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5">
              <SectionLabel>Nova Chave de API</SectionLabel>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const created = await api('/api/webhooks/keys', { method: 'POST', body: JSON.stringify({ name: keyForm.name }) });
                    setSecret({ label: `Chave de API "${created.name}"`, value: created.apiKey });
                    setKeyForm({ name: '' });
                    await refresh('keys');
                  });
                }}
                className={`${cardCls} p-6 space-y-3`}
              >
                <input
                  value={keyForm.name}
                  onChange={(e) => setKeyForm({ name: e.target.value })}
                  placeholder="Nome da chave (ex: produção)"
                  className={inputCls}
                  required
                />
                <button type="submit" disabled={busy} className={`${primaryBtnCls} w-full`}>
                  <Plus className="w-4 h-4" /> Criar Chave
                </button>
                <p className="text-[11px] text-white/30 leading-relaxed">A chave em texto puro é exibida uma única vez. Apenas o hash é armazenado.</p>
              </form>
            </div>
            <div className="lg:col-span-7">
              <SectionLabel>Chaves Existentes ({keys.length})</SectionLabel>
              <div className="space-y-2">
                {keys.map((k) => (
                  <div key={k.id} className={`${rowCls} px-5 py-3 flex items-center justify-between gap-4`}>
                    <div>
                      <p className="text-sm font-medium text-white/90">{k.name}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">
                        criada {fmtDate(k.createdAt)} · último uso {fmtDate(k.lastUsedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusPill ok={!k.revokedAt} okLabel="Ativa" badLabel="Revogada" />
                      {!k.revokedAt && (
                        <button
                          onClick={() =>
                            run(async () => {
                              await api(`/api/webhooks/keys/${k.id}`, { method: 'DELETE' });
                              await refresh('keys');
                            })
                          }
                          className={`${ghostBtnCls} text-red-400 border-red-500/20 hover:bg-red-500/10`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Revogar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
