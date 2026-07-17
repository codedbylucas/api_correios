import { ReactNode, useState } from 'react';
import { BookOpen, Check, Copy, PackageSearch, Webhook } from 'lucide-react';
import { panelCard } from '../components/panel/ui';

type Tab = 'rastreio' | 'webhooks';

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/80 overflow-x-auto whitespace-pre">
        {lang && <span className="block text-[10px] uppercase tracking-wider text-white/30 mb-2">{lang}</span>}
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copiar"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white/90">{title}</h3>
      {children}
    </div>
  );
}

function ErrorTable() {
  const rows = [
    ['unauthenticated', '401', 'Authorization ausente, inválido ou chave revogada'],
    ['invalid_argument', '400', 'Código malformado, mais de 100/200 códigos, campos ausentes'],
    ['not_found', '404', 'Endpoint, perfil ou inscrição inexistente'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="text-white/40 uppercase tracking-wider text-[10px]">
            <th className="py-2 pr-4">Código</th>
            <th className="py-2 pr-4">HTTP</th>
            <th className="py-2">Quando</th>
          </tr>
        </thead>
        <tbody className="text-white/70">
          {rows.map(([code, http, when]) => (
            <tr key={code} className="border-t border-white/10">
              <td className="py-2 pr-4 font-mono">{code}</td>
              <td className="py-2 pr-4 font-mono">{http}</td>
              <td className="py-2">{when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const [tab, setTab] = useState<Tab>('rastreio');

  return (
    <div className="px-6 py-10 lg:px-10 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#E7B24A]" /> Documentação da API
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Como integrar com a API de rastreio e com o serviço de webhooks. Use uma chave criada em{' '}
          <span className="text-[#E7B24A]">Chaves de API</span> para autenticar.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('rastreio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            tab === 'rastreio' ? 'bg-[#E7B24A] text-[#1A1207]' : 'border border-white/10 text-white/60 hover:bg-white/5'
          }`}
        >
          <PackageSearch className="w-4 h-4" /> API de Rastreio
        </button>
        <button
          onClick={() => setTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            tab === 'webhooks' ? 'bg-[#E7B24A] text-[#1A1207]' : 'border border-white/10 text-white/60 hover:bg-white/5'
          }`}
        >
          <Webhook className="w-4 h-4" /> API de Webhooks
        </button>
      </div>

      {tab === 'rastreio' && (
        <div className={`${panelCard} p-6 space-y-6`}>
          <p className="text-sm text-white/50">
            Consulta em lote sob demanda. Cada chamada aceita até {'{MAX_CODES}'} códigos (200 por padrão) e retorna o
            status atual de cada um. Lotes com 2+ códigos são resolvidos com um único captcha compartilhado (até 20
            por captcha) quando o provedor configurado suporta — ver README para detalhes de provedores. Pra testar
            sem escrever código, use a tela <span className="text-[#E7B24A]">Rastreios</span> no painel.
          </p>

          <Section title="Método">
            <CodeBlock code="POST /api/track/batch" />
          </Section>

          <Section title="Headers">
            <CodeBlock
              code={`Content-Type: application/json\nAuthorization: Apikey SUA_CHAVE_AQUI`}
            />
          </Section>

          <Section title="Body">
            <CodeBlock
              lang="json"
              code={`{\n  "codes": ["YB754713088BR", "AA123456789BR"]\n}`}
            />
          </Section>

          <Section title="Resposta — um único código">
            <CodeBlock
              lang="json"
              code={`{\n  "code": "YB754713088BR",\n  "carrier": "CARRIER_CORREIOS",\n  "lastUpdate": "2026-07-15T15:30:00Z",\n  "events": [\n    { "date": "2026-07-15T15:30:00Z", "location": "São Paulo, SP", "description": "Objeto entregue" }\n  ]\n}`}
            />
          </Section>

          <Section title="Resposta — múltiplos códigos">
            <CodeBlock
              lang="json"
              code={`[\n  { "code": "YB754713088BR", "carrier": "CARRIER_CORREIOS", "lastUpdate": "...", "events": [...] },\n  { "code": "AA123456789BR", "ok": false, "error": "invalid tracking code", "status": 400 }\n]`}
            />
          </Section>

          <Section title="Exemplo — cURL">
            <CodeBlock
              lang="bash"
              code={`curl -X POST https://seu-dominio.com/api/track/batch \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Apikey SUA_CHAVE_AQUI" \\\n  -d '{"codes": ["YB754713088BR"]}'`}
            />
          </Section>

          <Section title="Erros">
            <ErrorTable />
          </Section>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className={`${panelCard} p-6 space-y-6`}>
          <p className="text-sm text-white/50">
            Serviço de monitoramento contínuo: você inscreve códigos, verificamos periodicamente e entregamos um POST
            assinado ao seu endpoint sempre que os dados mudarem.
          </p>

          <Section title="Autenticação">
            <p className="text-xs text-white/50 mb-2">
              Todas as rotas abaixo aceitam a sessão do painel (uso pelo navegador) ou uma chave de API no header:
            </p>
            <CodeBlock code="Authorization: Apikey SUA_CHAVE_AQUI" />
          </Section>

          <Section title="1. Criar um endpoint">
            <CodeBlock code="POST /api/webhooks/endpoints" />
            <CodeBlock
              lang="json"
              code={`{ "url": "https://seu-servidor.com/webhooks/correios", "description": "produção" }`}
            />
            <p className="text-xs text-white/40">
              O <code className="text-white/60">signingSecret</code> retornado só aparece uma vez — guarde-o para
              verificar a assinatura dos eventos recebidos.
            </p>
          </Section>

          <Section title="2. Criar um perfil de monitoramento">
            <CodeBlock code="POST /api/webhooks/profiles" />
            <CodeBlock
              lang="json"
              code={`{ "name": "padrao", "frequencyHours": 4, "windowHours": 168, "stopOnDelivered": true }`}
            />
          </Section>

          <Section title="3. Inscrever códigos">
            <CodeBlock code="POST /api/tracking-subscriptions" />
            <CodeBlock
              lang="json"
              code={`{\n  "endpointId": "...",\n  "profileId": "...",\n  "codes": ["AA361812099BR", "NB552687923BR"]\n}`}
            />
            <p className="text-xs text-white/40">Até 100 códigos por requisição, formato AA123456789BR.</p>
          </Section>

          <Section title="4. Receber eventos">
            <p className="text-xs text-white/50 mb-2">POST assinado no seu endpoint quando os dados mudarem:</p>
            <CodeBlock
              lang="json"
              code={`{\n  "event_id": "...",\n  "type": "tracking.updated",\n  "code": "AA361812099BR",\n  "carrier": "CARRIER_CORREIOS",\n  "checked_at": "2026-07-15T15:30:00Z",\n  "payload": { "code": "AA361812099BR", "carrier": "CARRIER_CORREIOS", "lastUpdate": "...", "events": [] }\n}`}
            />
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-white/40 uppercase tracking-wider text-[10px]">
                    <th className="py-2 pr-4">Header</th>
                    <th className="py-2">Descrição</th>
                  </tr>
                </thead>
                <tbody className="text-white/70">
                  <tr className="border-t border-white/10"><td className="py-2 pr-4 font-mono">X-Webhook-Timestamp</td><td className="py-2">Timestamp Unix (segundos) usado na assinatura</td></tr>
                  <tr className="border-t border-white/10"><td className="py-2 pr-4 font-mono">X-Webhook-Algorithm</td><td className="py-2">Sempre hmac-sha256</td></tr>
                  <tr className="border-t border-white/10"><td className="py-2 pr-4 font-mono">X-Webhook-Signature</td><td className="py-2">HMAC-SHA256 hex de "{'{timestamp}'}.{'{body}'}"</td></tr>
                  <tr className="border-t border-white/10"><td className="py-2 pr-4 font-mono">X-Webhook-Event-Id</td><td className="py-2">ID do evento</td></tr>
                  <tr className="border-t border-white/10"><td className="py-2 pr-4 font-mono">X-Webhook-Delivery-Id</td><td className="py-2">ID desta tentativa de entrega</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-white/40 mt-2">
              Responda com status 2xx em até 10s. Falhas de rede, 429 e 5xx são reentregues até 5 vezes com backoff
              (30s, 2min, 10min, 30min, 1h). Após 10 falhas consecutivas o endpoint é pausado automaticamente.
            </p>
          </Section>

          <Section title="5. Verificar a assinatura">
            <CodeBlock
              lang="javascript"
              code={`const crypto = require('node:crypto');\n\nfunction isValidSignature(rawBody, timestamp, signature, signingSecret) {\n  const expected = crypto\n    .createHmac('sha256', signingSecret)\n    .update(\`\${timestamp}.\${rawBody}\`)\n    .digest('hex');\n  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));\n}`}
            />
            <p className="text-xs text-white/40">
              Assine sempre os bytes brutos do corpo recebido — não faça JSON.parse e serialize de novo antes de
              verificar.
            </p>
          </Section>

          <Section title="Erros">
            <ErrorTable />
          </Section>
        </div>
      )}
    </div>
  );
}
