import { STATE } from './state.js';

const CLAUDE_MODEL = 'claude-sonnet-5-5';

const S = { type: 'STRING' };
const N = { type: 'NUMBER' };
const obj = (properties) => ({ type: 'OBJECT', properties, required: Object.keys(properties) });
const list = (items, extra = {}) => ({ type: 'ARRAY', items, ...extra });

// Tipos en MAYÚSCULAS (formato Gemini); toClaudeSchema los pasa a minúsculas.
export const SCHEMA = obj({
  saldo: { type: 'NUMBER', description: 'Saldo actual en euros; negativo si hay deuda' },
  once: list(obj({
    dorsal: { type: 'INTEGER' }, nombre: S,
    posicion: { type: 'STRING', enum: ['POR', 'DEF', 'MED', 'DEL'] },
    equipo: S, titularidad_pct: N, xp: N, es_capitan: { type: 'BOOLEAN' }
  }), { minItems: 11, maxItems: 11, description: 'Exactamente 11 jugadores, un único capitán' }),
  ventas_recomendadas: list(obj({ nombre: S, vm: N, motivo: S })),
  compras_mercado: list(obj({
    nombre: S, vm: N, puja_sugerida: N,
    tipo: { type: 'STRING', enum: ['especulacion', 'chollo', 'burbuja'] }
  }))
});

const toClaudeSchema = (s) => JSON.parse(JSON.stringify(s).replace(/"type":"([A-Z]+)"/g, (_, t) => `"type":"${t.toLowerCase()}"`));

const prompt = () => `Eres el analista de élite de Movistar Fantasy MARCA (LaLiga española).
La imagen es una captura de la plantilla, del saldo o del mercado del usuario. Sistema de puntuación: ${STATE.scoring}.
Reglas: todos los importes (saldo, vm, puja_sugerida) en euros como número entero (1,85 M€ = 1850000).
"once" debe tener 11 jugadores con formación válida y un solo es_capitan=true.
"ventas_recomendadas": obligatorias si saldo < 0 (el saldo debe ser >= 0 el viernes); si no, solo ventas claramente rentables.
"compras_mercado": fichajes del mercado visible con puja sugerida; vacío si no se ve el mercado.
Si un dato no aparece en la captura, estímalo con criterio y mantén listas vacías en lugar de inventar jugadores.`;

// Gemini no admite responseSchema junto a googleSearch: con grounding se confía en el prompt + extractJson.
async function callGemini(img) {
  const body = {
    contents: [{ parts: [{ text: prompt() }, { inlineData: { mimeType: img.mime, data: img.b64 } }] }],
    generationConfig: { temperature: 0.15 }
  };
  if (STATE.grounding) body.tools = [{ googleSearch: {} }];
  else Object.assign(body.generationConfig, { responseMimeType: 'application/json', responseSchema: SCHEMA });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${STATE.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': STATE.geminiKey },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error en la API de Gemini');
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new Error('La respuesta de Gemini llegó vacía');
  return extractJson(text);
}

// tool_choice forzado = Claude solo puede responder rellenando el esquema.
async function callClaude(img) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': STATE.claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      temperature: 0.15,
      tools: [{ name: 'registrar_analisis', description: 'Registra el análisis estructurado de Fantasy', input_schema: toClaudeSchema(SCHEMA) }],
      tool_choice: { type: 'tool', name: 'registrar_analisis' },
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } },
        { type: 'text', text: prompt() }
      ] }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Error en la API de Claude');
  const call = data.content?.find((b) => b.type === 'tool_use');
  if (!call) throw new Error('Claude no devolvió datos estructurados');
  return call.input;
}

function extractJson(text) {
  const m = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No se pudo extraer el JSON de análisis');
  return JSON.parse(m[0]);
}

function validate(r) {
  if (typeof r?.saldo !== 'number' || !Array.isArray(r.once) || !r.once.length) {
    throw new Error('Respuesta sin saldo o sin once: prueba con otra captura');
  }
  return { ...r, ventas_recomendadas: r.ventas_recomendadas ?? [], compras_mercado: r.compras_mercado ?? [] };
}

export async function analyze() {
  const claude = STATE.engine === 'claude';
  if (!(claude ? STATE.claudeKey : STATE.geminiKey)) throw Object.assign(new Error('Falta la API Key'), { code: 'NOKEY' });
  return validate(await (claude ? callClaude : callGemini)(STATE.image));
}
