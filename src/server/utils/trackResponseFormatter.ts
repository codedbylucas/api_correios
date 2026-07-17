/**
 * Formata a resposta bruta do provedor de rastreio (Correios) para o padrão limpo da API.
 * @param {any} envelope Objeto retornado pelo TrackingClient ({carrier, json})
 * @returns {any} JSON formatado ou null se inválido
 */
export function formatTrackResponse(envelope) {
  if (!envelope || !envelope.json) return null;

  let raw;
  try {
    // Regra: Faça JSON.parse(envelope.json) para obter raw
    raw = typeof envelope.json === 'string' ? JSON.parse(envelope.json) : envelope.json;
  } catch (e) {
    return null;
  }

  if (!raw) return null;

  const rawEvents = raw.eventos || [];

  const events = rawEvents.map(event => {
    // Extração de campos com fallback para null
    const date = event.dtHrCriado?.date || null;
    const description = event.descricao || null;
    const unitType = event.unidade?.tipo || null;
    const city = event.unidade?.endereco?.cidade || null;
    const uf = event.unidade?.endereco?.uf || null;

    // Regra: montar fromText
    let fromText: string | null = null;
    if (unitType) {
      if (city && uf) {
        // se tiver unitType, city, uf: "${unitType}, ${city} - ${uf}"
        fromText = `${unitType}, ${city} - ${uf}`;
      } else {
        // se city for vazio: usar só unitType
        fromText = unitType;
      }
    }

    return {
      date,
      description,
      unitType,
      city,
      uf,
      fromText
    };
  });

  // Regra: ordenar events do mais recente para o mais antigo (descendente por dtHrCriado.date)
  events.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  // Regra: lastUpdate = events[0].date após ordenar
  const lastUpdate = events.length > 0 ? events[0].date : null;

  // Formato final da resposta
  return {
    code: raw.codObjeto || null,
    carrier: envelope.carrier || null,
    lastUpdate,
    events
  };
}
