// Diagnostico SOMENTE LEITURA, sem credenciais e sem passar por nenhum desafio anti-bot.
// Uso:  node diagnostico.mjs [--terceiro=https://host/api/v2/track/]   (so usa o codigo FALSO AA123456785BR)
// Cada checagem imprime OK/FALHA + a evidencia; nada e gravado, nenhum codigo real e enviado.
const FALSO = 'AA123456785BR';
const terceiro = process.argv.find((a) => a.startsWith('--terceiro='))?.split('=')[1];
const resultados = [];

async function checar(nome, fn) {
  try {
    const [ok, evidencia] = await fn();
    resultados.push(ok);
    console.log(`${ok ? 'OK   ' : 'FALHA'}  ${nome}\n       ${evidencia}`);
  } catch (e) {
    resultados.push(false);
    console.log(`FALHA  ${nome}\n       erro de rede: ${e.message}`);
  }
}
const get = (url, init) => fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'diagnostico-leitura/1.0' }, ...init });

await checar('Site: pagina inicial publica responde', async () => {
  const r = await get('https://rastreamento.correios.com.br/app/index.php');
  return [r.status === 200, `HTTP ${r.status}`];
});
await checar('Site: formulario exige Turnstile + CSRF + campo-isca (explica por que o raspador parou)', async () => {
  const html = await (await get('https://rastreamento.correios.com.br/app/index.php')).text();
  const t = /class="cf-turnstile"/.test(html), c = /name="csrf_token"/.test(html), h = /name="website"/.test(html);
  const lim = (html.match(/at[ée] (\d+) c[oó]digos/i) || [])[1];
  return [t && c, `turnstile=${t} csrf=${c} honeypot=${h} limite_por_busca=${lim ?? '?'}`];
});
await checar('Site: consulta por GET nao e aceita (so POST com token do navegador)', async () => {
  const r = await get(`https://rastreamento.correios.com.br/app/resultado.php?objeto=${FALSO}`);
  return [r.status === 405, `HTTP ${r.status}`];
});
await checar('API oficial: prefixo correto /srorastro existe (403 Token invalido = rota existe)', async () => {
  const r = await get(`https://api.correios.com.br/srorastro/v1/objetos/${FALSO}`);
  return [r.status === 403, `HTTP ${r.status} ${(await r.text()).slice(0, 80)}`];
});
await checar('API oficial: prefixo /rastro NAO existe (GTW-003 = servico inexistente)', async () => {
  const r = await get(`https://api.correios.com.br/rastro/v1/objetos/${FALSO}`);
  return [r.status === 503, `HTTP ${r.status} ${(await r.text()).slice(0, 80)}`];
});
await checar('API oficial: rota de token existe (exige Basic = credencial do CWS)', async () => {
  const r = await get('https://api.correios.com.br/token/v1/autentica', { method: 'POST' });
  return [r.status === 403 || r.status === 401, `HTTP ${r.status}`];
});
if (terceiro) {
  await checar(`Terceiro (${terceiro}): disponibilidade com codigo falso`, async () => {
    const r = await get(terceiro.replace(/\/$/, '') + '/' + FALSO);
    return [r.status < 500, `HTTP ${r.status} ${(await r.text()).slice(0, 60)}`];
  });
}
console.log(`\n${resultados.filter(Boolean).length}/${resultados.length} checagens OK`);
