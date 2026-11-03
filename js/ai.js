import { STATE } from './state.js';
import { apiError } from './util.js';
import { openrouterText, openrouterPing } from './openrouter.js';

export { apiError };

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const TIMEOUT = 60000; // por intento: con mala cobertura el fetch no debe dejar el spinner colgado
const DEADLINE = 100000; // tope total de un análisis, reintentos incluidos
const FALLBACK = 'gemini-2.5-flash-lite'; // cuota propia y más holgada en la capa gratuita
const RETRY = [429, 500, 502, 503, 504];
export const pace = { wait: 2500 }; // pausa entre intentos (los tests la ponen a 0)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let notify = () => {};

const S = { type: 'STRING' };
const N = { type: 'NUMBER' };
const obj = (properties) => ({ type: 'OBJECT', properties, required: Object.keys(properties) });
const list = (items, extra = {}) => ({ type: 'ARRAY', items, ...extra });

export const SCHEMA = obj({
  saldo: { type: 'NUMBER', description: 'Saldo actual en euros; negativo si hay deuda' },
  resumen: { type: 'STRING', description: 'Valoración de la alineación actual y cambios propuestos' },
  consejos: list(obj({ prioridad: { type: 'STRING', enum: ['alta', 'media', 'baja'] }, texto: S }), { description: 'Máx. 6 acciones concretas, de más a menos prioritaria' }),
  once: list(obj({
    dorsal: { type: 'INTEGER' }, nombre: S,
    posicion: { type: 'STRING', enum: ['POR', 'DEF', 'MED', 'DEL'] },
    equipo: S,
    titularidad_pct: { type: 'NUMBER', description: 'Probabilidad de ser titular, de 0 a 100' },
    xp: { type: 'NUMBER', description: 'Puntos esperados (xP) en la jornada' }
  }), { minItems: 11, maxItems: 11, description: 'Exactamente 11 jugadores' }),
  ventas_recomendadas: list(obj({ nombre: S, vm: N, motivo: S })),
  compras_mercado: list(obj({
    nombre: S, vm: N, puja_sugerida: N,
    tipo: { type: 'STRING', enum: ['especulacion', 'chollo', 'burbuja'] }
  }))
});

const prompt = (hint = '') => `Eres el analista de élite de Movistar Fantasy MARCA (LaLiga española).
Recibes de 1 a 4 entradas del usuario (capturas y/o texto copiado de la web del Fantasy), en cualquier orden: su plantilla completa, su alineación actual, el mercado y/o su saldo. Identifica qué es cada una y cruza la información.
Sistema de puntuación: ${STATE.scoring}.
Reglas: todos los importes (saldo, vm, puja_sugerida) en euros como número entero (1,85 M€ = 1850000).
"once": el mejor once posible con los jugadores de la PLANTILLA (si se ve la alineación actual, mejórala), 11 jugadores con formación válida (sin capitán).
"resumen": 2-3 frases en español valorando la alineación actual y qué cambios haces y por qué (vacío si no se ve la alineación).
"consejos": hasta 6 acciones concretas ordenadas por prioridad (alta, media, baja).
"ventas_recomendadas": jugadores de la plantilla; obligatorias si saldo < 0 (el saldo debe ser >= 0 el viernes); si no, solo ventas claramente rentables.
"compras_mercado": fichajes del mercado visible con puja sugerida que mejoren la plantilla; vacío si no se ve el mercado.
titularidad_pct va de 0 a 100 y xp son los puntos esperados de la jornada.
Si un dato no aparece en las entradas, estímalo con criterio y mantén listas vacías en lugar de inventar jugadores.${hint && `
ATENCIÓN: ${hint}`}`;

async function latestModel(family) {
  const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': STATE.geminiKey } });
  if (!res.ok) return null;
  const ver = (n) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const ok = new RegExp(`^gemini-[\\d.]+-${family}$`); // excluye lite, preview, exp, tts, image...
  return (await res.json()).models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', ''))
    .filter((n) => ok.test(n))
    .sort((a, b) => ver(b) - ver(a))[0] ?? null;
}

// Sin "thinking" en 2.5 Flash: para extraer datos de una captura sólo añade segundos de espera y tokens.
async function once(model, body, timeout) {
  const fast = /^gemini-2\.5-flash/.test(model);
  const payload = fast ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
  const res = await fetch(`${GEMINI}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': STATE.geminiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeout)
  }).catch((err) => { throw Object.assign(err, { retry: true }); }); // sin red o timeout: se reintenta
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(apiError(res.status, data.error?.message, 'Gemini'), { status: res.status, retry: RETRY.includes(res.status) });
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw Object.assign(new Error('La respuesta de Gemini llegó vacía'), { retry: true });
  return text;
}

// Un timeout se explica con lo que pasó en cada intento, para saber si falla la red, el modelo o el tamaño.
const giveUp = (err, tries) => {
  if (err?.name === 'TimeoutError') return Object.assign(new Error(`Gemini no respondió a tiempo (${tries.join('; ')})`), { name: 'TimeoutError' });
  if (err instanceof TypeError) return new Error('Sin conexión con Google: revisa tu red o usa el modo manual'); // fetch sin red
  return err;
};

// Hasta 2 intentos con el modelo elegido y 2 con el de reserva, dentro de un tiempo máximo.
// Tras un timeout no se repite con el mismo modelo: si no respondió en un minuto, repetir no lo arregla.
async function gemini(body, deadline = DEADLINE) {
  const end = Date.now() + deadline;
  const tries = [];
  let first, last;
  for (const [i, model] of [...new Set([STATE.model, FALLBACK])].entries()) {
    for (let t = 0; t < 2; t++) {
      if (i || t) { notify(i ? 'Probando otro modelo…' : 'Reintentando…'); await sleep(pace.wait); }
      const left = end - Date.now();
      if (left < 8000) throw giveUp(last, tries);
      const t0 = Date.now();
      try {
        return await once(model, body, Math.min(TIMEOUT, left));
      } catch (err) {
        tries.push(`${model.replace('gemini-', '')}: ${err.name === 'TimeoutError' ? `sin respuesta en ${Math.round((Date.now() - t0) / 1000)} s` : err.message}`);
        // Modelo retirado/no disponible: se busca el más reciente de la misma familia con la clave del usuario.
        if (err.status === 404 && !i && !t) {
          const latest = await latestModel('flash');
          if (latest && latest !== model) {
            STATE.model = latest; localStorage.setItem('fc_model', latest);
            return await gemini(body, end - Date.now()); // con el modelo nuevo, y con reintentos y reserva
          }
        }
        if (!err.retry) throw i ? first : err;
        first ??= err; last = err;
        if (err.name === 'TimeoutError' || err instanceof TypeError) break; // repetir con el mismo modelo no lo arregla
      }
    }
  }
  throw giveUp(last, tries);
}

export async function ping() {
  const t0 = Date.now();
  if (STATE.engine === 'openrouter') return { model: await openrouterPing(), ms: Date.now() - t0 };
  await once(STATE.model, { contents: [{ parts: [{ text: 'Responde solo: OK' }] }] }, 20000).catch((e) => { throw giveUp(e, []); });
  return { model: STATE.model, ms: Date.now() - t0 };
}

// Cada entrada es una captura (inlineData) o texto copiado de la web del Fantasy.
const geminiParts = (inputs, text) => [{ text }, ...inputs.map((i) => (i.text
  ? { text: `TEXTO COPIADO DE LA WEB DEL FANTASY DEL USUARIO:\n${i.text}` }
  : { inlineData: { mimeType: i.mime, data: i.b64 } }))];

const callGemini = async (inputs, hint) => extractJson(await gemini({
  contents: [{ parts: geminiParts(inputs, prompt(hint)) }],
  generationConfig: { temperature: 0.15, responseMimeType: 'application/json', responseSchema: SCHEMA }
}));

// Modo manual: el usuario pega el prompt (con sus capturas) en un chat gratuito (Gemini, Claude...) y trae el JSON de vuelta.
const SHAPE = '{"saldo":-1850000,"resumen":"","consejos":[{"prioridad":"alta","texto":""}],"once":[{"dorsal":1,"nombre":"","posicion":"POR","equipo":"","titularidad_pct":90,"xp":5.5}],"ventas_recomendadas":[{"nombre":"","vm":0,"motivo":""}],"compras_mercado":[{"nombre":"","vm":0,"puja_sugerida":0,"tipo":"especulacion"}]}';

// Para quien no tiene esquema forzado (chat manual, OpenRouter): se pide el JSON en el propio prompt.
const jsonPrompt = (hint, extra = '') => `${prompt(hint)}${extra}
Responde SOLO con un JSON válido, sin texto extra ni explicaciones, con esta forma (once = 11 jugadores; posicion: POR, DEF, MED o DEL; tipo: especulacion, chollo o burbuja):
${SHAPE}`;

// Con la skill (js carga skills/fantasy-analista/SKILL.md) el chat recibe el método, las reglas y el formato; sin ella, el prompt básico.
const stripFrontmatter = (md) => md.replace(/^---[\s\S]*?---\s*/, '');

export const manualPrompt = (skill = '', previous = null) => (skill
  ? `${stripFrontmatter(skill)}\n\n---\nTAREA: analiza lo que adjunto (capturas y/o texto copiado de mi Fantasy) con estas instrucciones y responde con tu comentario y el bloque JSON del formato indicado.${previous ? `\nMi último análisis, para el seguimiento (JSON):\n${JSON.stringify(previous)}` : ''}`
  : jsonPrompt('', '\nAntes de responder, busca en la web (Sofascore, Marca, AS, Transfermarkt) lesiones, sancionados, alineaciones probables y forma reciente de los jugadores de la captura, y úsalo.'));

// El historial del JSON exportado es solo contexto para la IA: el de la app es local.
export const importManual = (text) => { const { historial, ...d } = extractJson(text); return validate(d); };

export function extractJson(text) {
  const m = text.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No se pudo extraer el JSON de análisis');
  try { return JSON.parse(m[0]); } catch { throw new Error('No se pudo extraer el JSON de análisis'); } // JSON cortado o mal formado
}

const POS = { GK: 'POR', PORTERO: 'POR', DF: 'DEF', DEFENSA: 'DEF', MC: 'MED', MEDIO: 'MED', CENTROCAMPISTA: 'MED', FW: 'DEL', DELANTERO: 'DEL' };
const num = (v, d) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : d; };
// La IA a veces escribe "Delantero", "85%" o "5,5": se normaliza en vez de fallar.
const player = (p) => {
  const pos = String(p?.posicion ?? '').trim().toUpperCase();
  const pct = num(p?.titularidad_pct, 100);
  // 0,9 en vez de 90: sin esto todos los jugadores saldrían como "en duda".
  return { ...p, posicion: POS[pos] ?? pos, titularidad_pct: pct > 0 && pct <= 1 ? pct * 100 : pct, xp: num(p?.xp, 0) };
};

export function validate(r) {
  if (typeof r?.saldo !== 'number' || !Array.isArray(r.once)) {
    throw new Error('Respuesta sin saldo o sin once: prueba con otra captura');
  }
  const once = r.once.map(player);
  if (once.length !== 11 || once.some((p) => !['POR', 'DEF', 'MED', 'DEL'].includes(p.posicion))) {
    throw new Error('La IA no devolvió 11 jugadores válidos: reintenta o usa otra captura');
  }
  const fecha = /^\d{4}-\d{2}-\d{2}/.test(r.fecha) ? r.fecha.slice(0, 10) : new Date().toLocaleDateString('sv-SE'); // sv-SE = AAAA-MM-DD local
  return { ...r, fecha, consejos: Array.isArray(r.consejos) ? r.consejos : [], once, resumen: r.resumen ?? '', ventas_recomendadas: r.ventas_recomendadas ?? [], compras_mercado: r.compras_mercado ?? [] };
}

const HINT = 'tu respuesta anterior no era válida. Devuelve SOLO el JSON, con EXACTAMENTE 11 jugadores en "once" y posicion POR, DEF, MED o DEL.';

const call = async (inputs, hint) => (STATE.engine === 'openrouter'
  ? extractJson(await openrouterText(inputs, jsonPrompt(hint), notify))
  : callGemini(inputs, hint));

export async function analyze(status = () => {}) {
  if (!(STATE.engine === 'openrouter' ? STATE.orKey : STATE.geminiKey)) throw Object.assign(new Error('Falta la API Key'), { code: 'NOKEY' });
  notify = status;
  status('Analizando…');
  try {
    return validate(await call(STATE.inputs));
  } catch (err) {
    if (!/jugadores válidos|extraer el JSON/.test(err.message)) throw err;
    status('Reintentando…');
    return validate(await call(STATE.inputs, HINT)); // la IA a veces falla el formato: un reintento con pista
  }
}
