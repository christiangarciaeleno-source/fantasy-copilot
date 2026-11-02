export const $ = (id) => document.getElementById(id);

// La salida del LLM va a innerHTML: se escapa siempre.
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const money = (n) => `${n < 0 ? '-' : ''}${(Math.abs(Number(n) || 0) / 1e6).toFixed(2)} M€`;

export function haptic(ms = 15) {
  try { navigator.vibrate?.(ms); } catch { /* sin soporte */ }
}

let toastTimer;
export function toast(msg, icon = 'ℹ️') {
  const el = $('toastNotification');
  $('toastIcon').textContent = icon;
  $('toastMessage').textContent = msg;
  el.classList.replace('opacity-0', 'opacity-100');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.replace('opacity-100', 'opacity-0'), 3200);
}
