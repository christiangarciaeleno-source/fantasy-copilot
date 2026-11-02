import { STATE } from './state.js';
import { money, toast, haptic } from './util.js';

export function buildSummary(d) {
  const cap = d.once.find((p) => p.es_capitan);
  const fm = ['DEF', 'MED', 'DEL'].map((pos) => d.once.filter((p) => p.posicion === pos).length).join('-');
  const lines = [
    '⚽ *FANTASY MARCA - PLAN DE JORNADA* ⚽', '',
    `📊 *Esquema:* 1-${fm}`,
    `⭐ *Capitán:* ${cap?.nombre ?? '-'} (x2)`,
    `💰 *Saldo:* ${money(d.saldo)} ${d.saldo < 0 ? '🔴' : '🟢'}`, '',
    '👕 *ONCE:*',
    ...d.once.map((p) => `• ${p.posicion} ${p.nombre} (${p.equipo}) ${p.xp} xP${p.es_capitan ? ' ©' : ''}`)
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
