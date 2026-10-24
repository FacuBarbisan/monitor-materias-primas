// Traducción y resumen OPCIONAL con la API de Anthropic (Claude).
// Solo se activa si existe la variable ANTHROPIC_API_KEY. Sin ella, la app sigue
// funcionando con los títulos y extractos originales.
// Se traduce únicamente el título y el extracto que publica el propio feed (no el artículo).

const API = 'https://api.anthropic.com/v1/messages';

export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function traducirLote(items) {
  const modelo = process.env.AI_MODEL || 'claude-haiku-4-5';
  const entrada = items.map((i) => ({ id: i.id, titulo: i.titulo, extracto: (i.extracto || '').slice(0, 500) }));
  const prompt = `Traducí al español neutro (registro periodístico) estas noticias. Para cada una devolvé:
- "titulo_es": traducción fiel del título, sin agregar información.
- "resumen_es": 1 o 2 oraciones en español que resuman SOLO lo que dice el extracto. Si el extracto está vacío o no aporta datos, devolvé "".
No agregues opiniones, causas ni datos que no estén en el texto.
Respondé solo con un arreglo JSON: [{"id": "...", "titulo_es": "...", "resumen_es": "..."}].

${JSON.stringify(entrada)}`;

  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: modelo, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) throw new Error(`API de IA respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const datos = await r.json();
  const texto = (datos.content || []).map((c) => c.text || '').join('');
  const json = texto.slice(texto.indexOf('['), texto.lastIndexOf(']') + 1);
  const lista = JSON.parse(json);
  return { modelo, resultados: lista, uso: datos.usage || null };
}
