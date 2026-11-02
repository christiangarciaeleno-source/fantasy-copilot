import { STATE } from './state.js';
import { apiError } from './util.js';

const API = 'https://openrouter.ai/api/v1';
const TIMEOUT = 60000; // por modelo
const DEADLINE = 100000; // tope total, modelos de reserva incluidos
const PREFER = [/gemma/, /nemotron-3\.5-super-vl/, /inkling/]; // los que mejor leen capturas, por orden
const BACKUP = ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free'];

// Los modelos gratuitos cambian a menudo: se pide la lista (no lleva clave) y se prueban los 3 mejores con visión.
async function freeModels() {
  try {
    const res = await fetch(`${API}/models`, { signal: AbortSignal.timeout(10000) });
    const rank = (id) => { const i = PREFER.findIndex((r) => r.test(id)); return i < 0 ? PREFER.length : i; };
    const ids = (await res.json()).data
      .filter((m) => m.id.endsWith(':free') && m.architecture?.input_modalities?.includes('image') && !/safety|guard/.test(m.id))
      .map((m) => m.id)
      .sort((a, b) => rank(a) - rank(b));
    return ids.length ? ids.slice(0, 3) : BACKUP;
  } catch {
    return BACKUP;
  }
}

const part = (i) => (i.text
  ? { type: 'text', text: `TEXTO COPIADO DE LA WEB DEL FANTASY DEL USUARIO:\n${i.text}` }
  : { type: 'image_url', image_url: { url: i.url } });

const explain = (err) => {
  if (err.name === 'TimeoutError') return Object.assign(new Error('OpenRouter no respondió a tiempo: prueba con menos entradas o usa el modo manual'), { name: 'TimeoutError' });
  if (err instanceof TypeError) return new Error('Sin conexión con OpenRouter: revisa tu red o usa el modo manual');
  if (/data policy/i.test(err.message)) return new Error('OpenRouter bloquea los modelos gratuitos: activa los endpoints gratuitos en openrouter.ai/settings/privacy');
  return err;
};

// Devuelve el texto de la respuesta; si un modelo falla (cuota, caído, lento) pasa al siguiente.
export async function openrouterText(inputs, text, notify = () => {}) {
  const end = Date.now() + DEADLINE;
  let first;
  for (const [i, model] of (await freeModels()).entries()) {
    const left = end - Date.now();
    if (left < 8000) break;
    if (i) notify('Probando otro modelo…');
    try {
      const res = await fetch(`${API}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${STATE.orKey}` },
        body: JSON.stringify({ model, temperature: 0.15, messages: [{ role: 'user', content: [{ type: 'text', text }, ...inputs.map(part)] }] }),
        signal: AbortSignal.timeout(Math.min(TIMEOUT, left))
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(apiError(res.status, data.error?.message, 'OpenRouter'), { status: res.status });
      const out = data.choices?.[0]?.message?.content;
      if (!out) throw new Error('La respuesta de OpenRouter llegó vacía');
      return out;
    } catch (err) {
      if ([401, 403].includes(err.status)) throw err; // la clave no cambia con otro modelo
      first ??= err;
    }
  }
  throw explain(first ?? new Error('No hay modelos gratuitos disponibles en OpenRouter'));
}

export async function openrouterPing() {
  await openrouterText([], 'Responde solo: OK');
  return 'OpenRouter (gratis)';
}
