import { FormEvent, useState } from 'react';
import { AlertCircle, Loader2, PackageSearch, Search } from 'lucide-react';
import { api } from '../lib/api';
import { panelButton, panelCard, panelInput } from '../components/panel/ui';

const MAX_UI_CODES = 40;

type TrackEvent = {
  date: string | null;
  description: string | null;
  fromText: string | null;
  city: string | null;
  uf: string | null;
};

type TrackSuccess = {
  code: string;
  carrier?: string | null;
  lastUpdate?: string | null;
  events: TrackEvent[];
};

type TrackFailure = {
  code?: string;
  error: string;
  status?: number;
};

type TrackResultRow = TrackSuccess | TrackFailure;

function isSuccess(row: TrackResultRow): row is TrackSuccess {
  return Array.isArray((row as TrackSuccess).events);
}

function parseCodes(raw: string): string[] {
  const codes = raw
    .split(/[\s,]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(codes));
}

function fmtDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function ResultCard({ row }: { row: TrackResultRow }) {
  if (!isSuccess(row)) {
    return (
      <div className={`${panelCard} p-5 border-red-500/20`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm font-mono font-medium">{row.code || 'Código'}</p>
        </div>
        <p className="text-sm text-red-400 mt-2">{row.error}</p>
      </div>
    );
  }

  return (
    <div className={`${panelCard} p-5`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm font-mono font-medium">{row.code}</p>
        <div className="flex items-center gap-2">
          {row.carrier && (
            <span className="text-[10px] px-2 py-1 rounded-full uppercase font-semibold bg-white/5 text-white/50">
              {row.carrier}
            </span>
          )}
          <span className="text-[10px] px-2 py-1 rounded-full uppercase font-semibold bg-emerald-500/10 text-emerald-400">
            última atualização {fmtDate(row.lastUpdate) || 'sem eventos'}
          </span>
        </div>
      </div>

      {row.events.length === 0 && <p className="text-sm text-white/35 mt-3">Nenhum evento encontrado.</p>}

      {row.events.length > 0 && (
        <ol className="mt-4 space-y-3 border-l border-white/10 pl-4">
          {row.events.map((event, idx) => (
            <li key={idx} className="relative">
              <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#E7B24A]" />
              <p className="text-sm text-white/90">{event.description || 'Evento sem descrição'}</p>
              <p className="text-[11px] text-white/35 mt-0.5">
                {fmtDate(event.date)}
                {event.fromText ? ` · ${event.fromText}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function RastreiosPage() {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<TrackResultRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codes = parseCodes(input);
  const tooMany = codes.length > MAX_UI_CODES;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (codes.length === 0 || tooMany) return;

    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const data = await api<any>('/api/track/batch', {
        method: 'POST',
        body: JSON.stringify({ codes }),
      });
      const rows: TrackResultRow[] = Array.isArray(data) ? data : [data];
      setResults(rows);
    } catch (err: any) {
      setError(err.message || 'Erro ao rastrear.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-6 py-10 lg:px-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <PackageSearch className="w-6 h-6 text-[#E7B24A]" /> Rastreios
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Teste a API de rastreio direto pelo painel — cole um ou mais códigos (um por linha, ou separados por
          vírgula/espaço).
        </p>
      </div>

      <form onSubmit={submit} className={`${panelCard} p-6 space-y-3`}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'AA000000000BR\nAA000000001BR'}
          rows={4}
          className={`${panelInput} font-mono resize-y`}
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className={`text-xs ${tooMany ? 'text-red-400' : 'text-white/35'}`}>
            {codes.length} código{codes.length === 1 ? '' : 's'} detectado{codes.length === 1 ? '' : 's'}
            {tooMany ? ` — máximo de ${MAX_UI_CODES} por consulta` : ''}
          </p>
          <button disabled={busy || codes.length === 0 || tooMany} className={panelButton}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Rastrear
          </button>
        </div>
        {busy && (
          <p className="text-xs text-white/35">
            Isso pode levar alguns segundos — cada consulta resolve um captcha em tempo real.
          </p>
        )}
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {results && (
        <div className="space-y-3">
          {results.map((row, idx) => (
            <div key={row.code ?? idx}>
              <ResultCard row={row} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
