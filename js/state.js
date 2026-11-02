// Modo privado / almacenamiento bloqueado: getItem puede lanzar; se usa el valor por defecto.
const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

export const STATE = {
  engine: get('fc_engine', 'gemini'),
  geminiKey: get('fc_gemini_key'),
  claudeKey: get('fc_claude_key'),
  model: get('fc_model', 'gemini-2.5-flash'),
  scoring: get('fc_scoring', 'mixta'),
  image: null, // { mime, b64 }
  deferredPrompt: null,
  data: null // último análisis: { saldo, once, ventas_recomendadas, compras_mercado }
};

export function saveSettings() {
  localStorage.setItem('fc_engine', STATE.engine);
  localStorage.setItem('fc_gemini_key', STATE.geminiKey);
  localStorage.setItem('fc_claude_key', STATE.claudeKey);
  localStorage.setItem('fc_model', STATE.model);
  localStorage.setItem('fc_scoring', STATE.scoring);
}

export function saveLast(data) {
  STATE.data = data;
  localStorage.setItem('fc_last', JSON.stringify({ ts: Date.now(), data }));
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
