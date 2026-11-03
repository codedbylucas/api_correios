// Pagina LOCAL de diagnostico: cole a resposta do site dos Correios (JSON da aba Rede ou texto copiado da pagina)
// e veja os eventos normalizados ANTES de importar. Nada sai desta maquina, nada e gravado, nada e logado.
// Uso:  npx tsx docs/investigacao-correios-2026/experimentos/colar-resposta.ts   ->   http://127.0.0.1:3777
import http from 'node:http';
import { importarRespostaDoSite, RespostaInvalidaError } from '../../../src/server/utils/importarRespostaSite.js';

const PORT = parseInt(process.env.PORT || '3777', 10);
const MAX = 2_000_000;

const PAGINA = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnóstico da colagem</title>
<style>body{font:15px system-ui;margin:16px;max-width:980px;color:#1b1f23}textarea{width:100%;height:210px;font:13px monospace;box-sizing:border-box}
button{padding:8px 14px;font-size:15px;margin:8px 0}table{border-collapse:collapse;width:100%;margin:6px 0 16px}td,th{border:1px solid #c9ced3;padding:4px 8px;text-align:left;font-size:13px}
.ok{color:#116329}.err{color:#a40e26}.nota{background:#fff8e1;padding:8px 10px;border-radius:6px}</style>
<h1>Diagnóstico da colagem</h1>
<p class="nota">Cole abaixo o <b>JSON</b> da chamada <code>resultado.php</code>/<code>rastroMulti.php</code> (F12 → Rede → Resposta) <b>ou</b> o texto da página (Ctrl+A, Ctrl+C).
Fica só nesta máquina: nada é enviado aos Correios, gravado ou registrado em log.</p>
<textarea id="t" placeholder="Cole aqui…" spellcheck="false"></textarea><br>
<button id="b">Normalizar</button> <span id="s"></span>
<div id="r"></div>
<script>
const $=id=>document.getElementById(id);
$('b').onclick=async()=>{
  const r=$('r');r.textContent='';$('s').textContent='…';
  const res=await fetch('/normalizar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:$('t').value})});
  const d=await res.json();$('s').textContent='';
  const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e};
  if(!res.ok){r.append(el('p','✗ '+d.error,'err'));return}
  r.append(el('p','Modo: '+d.modo+(d.modo==='texto'?' (aproximado: sem segundos nem tipo de unidade na maioria dos eventos)':' (exato)')+' — '+d.itens.length+' objeto(s)'));
  for(const i of d.itens){
    r.append(el('h3',i.code,i.ok===false?'err':'ok'));
    if(i.ok===false){r.append(el('p','✗ '+i.error+' (status '+i.status+')','err'));continue}
    r.append(el('p','Último evento: '+(i.lastUpdate||'sem data válida')));
    const t=el('table');const h=el('tr');['Data','Descrição','Local'].forEach(x=>h.append(el('th',x)));t.append(h);
    for(const e of i.events){const tr=el('tr');[e.date||'—',e.description||'—',e.fromText||[e.city,e.uf].filter(Boolean).join(' - ')||'—'].forEach(x=>tr.append(el('td',x)));t.append(tr)}
    r.append(t);
  }
};
</script></html>`;

http
  .createServer((req, res) => {
    // so aceita chamadas do proprio navegador local (protege contra outra pagina/host falando com esta porta)
    const hostOk = /^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '');
    const originOk = !req.headers.origin || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin);
    if (!hostOk || !originOk) return void res.writeHead(403).end();

    if (req.method === 'GET' && req.url === '/') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGINA);

    if (req.method === 'POST' && req.url === '/normalizar') {
      const partes: Buffer[] = [];
      let total = 0;
      req.on('data', (c: Buffer) => {
        total += c.length;
        if (total > MAX + 200) return void req.destroy();
        partes.push(c);
      });
      req.on('end', () => {
        const json = (status: number, corpo: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(corpo));
        try {
          const text = JSON.parse(Buffer.concat(partes).toString('utf8')).text;
          if (typeof text !== 'string' || text.length > MAX) return json(400, { error: 'Texto ausente ou grande demais.' });
          json(200, { modo: /^\s*[[{]/.test(text) ? 'json' : 'texto', itens: importarRespostaDoSite(text) });
        } catch (e) {
          json(400, { error: e instanceof RespostaInvalidaError ? e.message : 'Requisicao invalida.' });
        }
      });
      return;
    }
    res.writeHead(404).end();
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Diagnóstico da colagem em http://127.0.0.1:${PORT}  (Ctrl+C para sair)`));
