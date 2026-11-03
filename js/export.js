import { STATE, latestData } from './state.js';
import { money, toast, haptic } from './util.js';
import { formation, totalXp } from './render.js';

export function buildSummary(d) {
  const lines = [
    '⚽ *FANTASY MARCA - PLAN DE JORNADA* ⚽', '',
    `📊 *Esquema:* 1-${formation(d.once)}`,
    `💰 *Saldo:* ${money(d.saldo)} ${d.saldo < 0 ? '🔴' : '🟢'}`,
    ...(d.resumen ? [`🧠 ${d.resumen}`] : []), '',
    '👕 *ONCE:*',
    ...d.once.map((p) => `• ${p.posicion} ${p.nombre} (${p.equipo}) ${p.xp ?? 0} xP`)
  ];
  if (d.ventas_recomendadas.length) {
    lines.push('', '🚨 *VENTAS:*', ...d.ventas_recomendadas.map((v) => `• Vender ${v.nombre} (+${money(v.vm)}) – ${v.motivo}`));
  }
  if (d.compras_mercado.length) {
    lines.push('', '📈 *MERCADO:*', ...d.compras_mercado.map((m) => `• ${m.nombre} [${m.tipo}] VM ${money(m.vm)} → pujar ${money(m.puja_sugerida)}`));
  }
  return lines.join('\n');
}

export async function exportSummary() {
  haptic(20);
  if (!STATE.data) return toast('Analiza o carga la demo antes de exportar', '⚠️');
  try {
    await navigator.clipboard.writeText(buildSummary(STATE.data));
    toast('Resumen copiado al portapapeles', '📋');
  } catch {
    toast('No se pudo acceder al portapapeles', '🔒');
  }
}

// JSON para pasárselo a Claude o Gemini: el análisis actual + un resumen del historial para el seguimiento.
export const buildJson = (d, history) => JSON.stringify({
  version: 2,
  ...d,
  historial: history.slice(-14).map((h) => ({ fecha: h.fecha, saldo: h.data.saldo, xp: +totalXp(h.data.once).toFixed(1), consejos: h.data.consejos?.length ?? 0 }))
});

export async function exportJson() {
  haptic(20);
  if (!latestData()) return toast('Analiza o importa un análisis antes de exportar', '⚠️');
  try {
    await navigator.clipboard.writeText(buildJson(latestData(), STATE.history));
    toast('JSON copiado: pégalo en Claude o Gemini', '📤');
  } catch {
    toast('No se pudo acceder al portapapeles', '🔒');
  }
}

// Evento diario a las 22:00 (hora local del calendario): el móvil lo avisa aunque la app esté cerrada.
export const buildIcs = (now = new Date()) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fantasy Copilot//ES', 'BEGIN:VEVENT', 'UID:revision-fantasy@fantasy-copilot',
  `DTSTAMP:${now.toISOString().replace(/[-:]|\.\d+/g, '')}`,
  `DTSTART:${now.toLocaleDateString('sv-SE').replaceAll('-', '')}T220000`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
  'SUMMARY:Revisar Fantasy', 'DESCRIPTION:Copia los datos del Fantasy y analízalos con Fantasy Copilot',
  'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Revisar Fantasy', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
].join('\r\n');

export function downloadReminder() {
  haptic(15);
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([buildIcs()], { type: 'text/calendar' })), download: 'revision-fantasy.ics' });
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Abre el archivo con tu calendario para activar el aviso de las 22:00', '⏰');
}
