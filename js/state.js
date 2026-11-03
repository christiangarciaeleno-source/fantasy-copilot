// Modo privado / almacenamiento bloqueado: getItem puede lanzar; se usa el valor por defecto.
const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

export const STATE = {
  engine: get('fc_engine') === 'openrouter' ? 'openrouter' : 'gemini',
  orKey: get('fc_or_key'),
  geminiKey: get('fc_gemini_key'),
  model: /flash/.test(get('fc_model')) ? get('fc_model') : 'gemini-2.5-flash', // Pro (o un valor viejo) es lento y casi sin cuota gratis
  scoring: get('fc_scoring', 'mixta'),
  inputs: [], // capturas { mime, b64, url } (url = miniatura) o textos copiados { text }
  deferredPrompt: null,
  data: null, // último análisis (formato v2: saldo, once, ventas, compras, consejos...)
  history: [] // un análisis por fecha, los últimos HISTORY_MAX: [{ fecha, data }]
};

const HISTORY_MAX = 30;

export function saveSettings() {
  localStorage.setItem('fc_engine', STATE.engine);
  localStorage.setItem('fc_or_key', STATE.orKey);
  localStorage.setItem('fc_gemini_key', STATE.geminiKey);
  localStorage.setItem('fc_model', STATE.model);
  localStorage.setItem('fc_scoring', STATE.scoring);
}

export function saveLast(data) {
  STATE.data = data;
  localStorage.setItem('fc_last', JSON.stringify({ ts: Date.now(), data }));
  // Un análisis por día: reimportar el mismo día sustituye al anterior en vez de apilar duplicados.
  STATE.history = [...STATE.history.filter((h) => h.fecha !== data.fecha), { fecha: data.fecha, data }]
    .sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(-HISTORY_MAX);
  localStorage.setItem('fc_hist', JSON.stringify(STATE.history));
}

// El análisis más reciente guardado (no el que se esté viendo): es el contexto del seguimiento.
export const latestData = () => STATE.history.at(-1)?.data ?? STATE.data;

export function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem('fc_hist'));
    if (Array.isArray(h)) STATE.history = h.filter((x) => x?.fecha && x?.data);
  } catch { /* historial corrupto: se parte de cero */ }
}

export function loadLast() {
  try {
    const last = JSON.parse(localStorage.getItem('fc_last'));
    if (last?.data) STATE.data = last.data;
    return last;
  } catch {
    return null; // JSON corrupto: se ignora y se parte de cero
  }
}
