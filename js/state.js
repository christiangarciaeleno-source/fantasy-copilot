// Modo privado / almacenamiento bloqueado: getItem puede lanzar; se usa el valor por defecto.
const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

export const STATE = {
  geminiKey: get('fc_gemini_key'),
  model: /flash/.test(get('fc_model')) ? get('fc_model') : 'gemini-2.5-flash', // Pro (o un valor viejo) es lento y casi sin cuota gratis
  scoring: get('fc_scoring', 'mixta'),
  inputs: [], // capturas { mime, b64, url } (url = miniatura) o textos copiados { text }
  deferredPrompt: null,
  data: null // último análisis: { saldo, once, ventas_recomendadas, compras_mercado }
};

export function saveSettings() {
  localStorage.setItem('fc_gemini_key', STATE.geminiKey);
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
