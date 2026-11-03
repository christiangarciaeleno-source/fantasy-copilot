import { $, esc, money } from './util.js';
import { STATE } from './state.js';

const POS = ['POR', 'DEF', 'MED', 'DEL'];
const EMPTY = { saldo: 0, once: [], ventas_recomendadas: [], compras_mercado: [], consejos: [] };

export const totalXp = (once) => once.reduce((s, p) => s + (Number(p.xp) || 0), 0);

export const formation = (once) => POS.slice(1).map((p) => once.filter((j) => j.posicion === p).length).join('-');

// Alineación vacía para el estado inicial (1-4-3-3).
export const placeholderPitch = () => [
  ...[['POR', 1], ['DEF', 4], ['MED', 3], ['DEL', 3]].flatMap(([posicion, n]) =>
    Array.from({ length: n }, (_, i) => ({ nombre: `${posicion} ${i + 1}`, posicion, equipo: '-', xp: 0, titularidad_pct: 100 })))
];

export function renderAll(data = EMPTY) {
  renderBalance(data.saldo, data.ventas_recomendadas);
  $('aiSummary').textContent = data.resumen ?? '';
  renderPitch(data.once);
  renderMarket(data.compras_mercado);
  renderSales(data.ventas_recomendadas);
  renderTrack(data.consejos ?? []);
}

function renderBalance(saldo, ventas) {
  const neg = saldo < 0;
  $('kpiBalance').textContent = money(saldo);
  $('kpiBalance').className = `text-base md:text-lg font-extrabold ${neg ? 'text-argon-danger' : 'text-argon-success'} mt-0.5`;
  const tone = neg ? 'bg-rose-50 text-argon-danger' : 'bg-emerald-50 text-argon-success';
  $('kpiBalanceBadge').textContent = neg ? 'SALDO NEGATIVO' : 'POSITIVO (OK)';
  $('kpiBalanceBadge').className = `inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tone} mt-1`;
  $('badgeSaleStatus').textContent = neg ? 'Saldo negativo' : 'Saldo OK';
  $('badgeSaleStatus').className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`;

  $('kpiAlertCount').textContent = ventas.length;
  $('kpiAlertSub').textContent = ventas.length ? 'Revisar cartera' : 'Sin ventas pendientes';

  $('salesContent').innerHTML = neg
    ? `<p class="text-xs font-semibold text-argon-danger">Saldo negativo: resuélvelo antes del cierre de la jornada:</p>${saleCards(ventas) || '<p class="text-xs text-argon-muted">La IA no propuso ventas: revisa tu plantilla.</p>'}`
    : `<div class="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
         <p class="text-xs font-bold text-argon-success">✓ Cuentas en orden para la jornada</p>
         <p class="text-[10px] text-argon-muted mt-1">No necesitas realizar ventas de urgencia.</p>
       </div>`;
}

const saleCards = (ventas) => ventas.map((v) => `
  <div class="p-3 bg-rose-50/60 border border-rose-100 rounded-xl flex items-center justify-between gap-2">
    <div>
      <p class="text-xs font-bold text-argon-dark">${esc(v.nombre)}</p>
      <p class="text-[10px] text-argon-muted mt-0.5">${esc(v.motivo)}</p>
    </div>
    <span class="text-xs font-extrabold text-argon-success shrink-0">+${money(v.vm)}</span>
  </div>`).join('');

// Carta clara con la nota (xP) en una esquina, verde si es titular seguro y ámbar si es duda.
function pin(p) {
  const doubt = p.titularidad_pct < 70;
  return `
    <div class="flex flex-col items-center w-[62px]">
      <div class="relative w-full rounded-lg bg-[#f3f3f6] border-2 ${doubt ? 'border-argon-warning' : 'border-[#f3f3f6]'} shadow-md pt-3 pb-1 text-center">
        <span class="absolute -top-2 -left-1.5 min-w-[24px] px-1 rounded text-[10px] font-extrabold text-white ${doubt ? 'bg-argon-warning' : 'bg-argon-success'}">${p.xp ? esc(p.xp) : '–'}</span>
        <p class="text-[10px] font-extrabold text-[#14141d] truncate px-0.5">${esc(p.nombre)}</p>
        <p class="text-[8px] font-bold text-[#6b6b80] truncate px-0.5">${esc(p.equipo)}${p.titularidad_pct < 100 ? ' · ' + esc(p.titularidad_pct) + '%' : ''}</p>
      </div>
    </div>`;
}

function renderPitch(once) {
  const players = once.length ? once : placeholderPitch();
  const xp = totalXp(players);
  const fm = formation(players);
  $('kpiXP').textContent = `${xp.toFixed(1)} pts`;
  $('kpiFormation').textContent = `Esquema: 1-${fm}`;
  $('pitchSubLabel').textContent = `1-${fm} • Maximización de puntos esperados`;
  $('kpiDoubt').textContent = players.filter((p) => p.titularidad_pct < 70).length;
  POS.forEach((pos) => {
    $(`pitchLine${pos}`).innerHTML = players.filter((p) => p.posicion === pos).map(pin).join('');
  });
}

const BADGES = {
  especulacion: ['bg-emerald-50 text-argon-success', '🚀 Subida VM'],
  chollo: ['bg-cyan-50 text-argon-info', '💎 Chollo Titular'],
  burbuja: ['bg-rose-50 text-argon-danger', '⚠️ Burbuja / Evitar']
};

const emptyBox = (icon, msg) => `<div class="col-span-full bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm text-argon-muted"><p class="text-3xl mb-2">${icon}</p><p class="text-xs font-bold">${msg}</p></div>`;

function renderMarket(compras) {
  $('marketCardsGrid').innerHTML = compras.length ? compras.map((m) => {
    const [color, label] = (Object.hasOwn(BADGES, m.tipo) && BADGES[m.tipo]) || ['bg-gray-100 text-gray-600', '⚪ ' + esc(m.tipo)];
    return `
      <div class="bg-white rounded-2xl shadow-argon-sm p-4 border border-gray-100 hover:shadow-argon transition">
        <div class="flex justify-between items-start">
          <h3 class="font-extrabold text-sm text-argon-dark">${esc(m.nombre)}</h3>
          <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${color}">${label}</span>
        </div>
        <div class="mt-3 flex items-baseline justify-between pt-2 border-t border-gray-50">
          <span class="text-[11px] text-argon-muted font-semibold">Valor Mercado:</span>
          <span class="text-sm font-black text-argon-dark">${money(m.vm)}</span>
        </div>
        <div class="flex items-baseline justify-between">
          <span class="text-[11px] text-argon-muted font-semibold">Puja sugerida:</span>
          <span class="text-xs font-black text-argon-primary">${money(m.puja_sugerida)}</span>
        </div>
      </div>`;
  }).join('') : emptyBox('📈', 'No hay futbolistas analizados en el mercado. Sube una captura o pulsa "Cargar Demo".');
}

function renderSales(ventas) {
  $('stopLossContainer').innerHTML = ventas.length ? ventas.map((v) => `
    <div class="bg-white rounded-2xl shadow-argon-sm p-4 border border-rose-100 flex items-center justify-between gap-3">
      <div>
        <h3 class="font-extrabold text-sm text-argon-dark">${esc(v.nombre)}</h3>
        <p class="text-[11px] text-argon-muted mt-1">${esc(v.motivo)}</p>
      </div>
      <span class="text-[10px] font-extrabold bg-rose-50 text-argon-danger px-2 py-1 rounded-full shrink-0">${money(v.vm)}</span>
    </div>`).join('') : emptyBox('🛡️', 'Sin ventas recomendadas.');
}

const PRIO = { alta: 'bg-rose-50 text-argon-danger', media: 'bg-amber-50 text-argon-warning', baja: 'bg-gray-100 text-gray-500' };
const card = (title, body) => `<div class="bg-white rounded-2xl shadow-argon p-4 md:p-5 border border-gray-100"><h3 class="text-sm font-extrabold text-argon-dark">${title}</h3><div class="mt-3 space-y-2">${body}</div></div>`;

// Consejos del analista + historial (un análisis por día) para el seguimiento.
function renderTrack(consejos) {
  const advice = consejos.length ? consejos.map((c) => `
    <div class="flex gap-2 items-start text-xs text-argon-dark">
      <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${PRIO[c.prioridad] ?? PRIO.baja}">${esc(c.prioridad ?? 'baja')}</span>
      <span>${esc(c.texto)}${c.fecha_limite ? ` <b class="text-argon-muted">· hasta ${esc(c.fecha_limite)}</b>` : ''}</span>
    </div>`).join('') : '<p class="text-xs text-argon-muted">Sin consejos todavía: importa un análisis.</p>';
  const rows = STATE.history.slice(-10).reverse().map((h) => {
    const i = STATE.history.indexOf(h), prev = STATE.history[i - 1]?.data;
    const delta = prev ? h.data.saldo - prev.saldo : 0;
    return `
    <button onclick="loadSnapshot(${i})" class="w-full flex justify-between gap-2 text-left text-[11px] bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2">
      <span class="font-bold text-argon-dark">${esc(h.fecha)}${h.data.jornada ? ` · J${esc(h.data.jornada)}` : ''}</span>
      <span class="text-argon-muted">${money(h.data.saldo)}${delta ? ` (${delta > 0 ? '+' : ''}${money(delta)})` : ''} · ${totalXp(h.data.once).toFixed(1)} xP · ${h.data.consejos?.length ?? 0} consejos</span>
    </button>`;
  }).join('') || '<p class="text-xs text-argon-muted">Aún no hay análisis guardados.</p>';
  $('trackPanel').innerHTML = card('🧭 Consejos del analista', advice) + card('📈 Seguimiento', rows);
}
