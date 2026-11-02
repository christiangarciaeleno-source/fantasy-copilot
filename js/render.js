import { $, esc, money } from './util.js';

const POS = ['POR', 'DEF', 'MED', 'DEL'];
const EMPTY = { saldo: 0, once: [], ventas_recomendadas: [], compras_mercado: [] };

export const formation = (once) => POS.slice(1).map((p) => once.filter((j) => j.posicion === p).length).join('-');

// Alineación vacía para el estado inicial (1-4-3-3).
export const placeholderPitch = () => [
  ...[['POR', 1], ['DEF', 4], ['MED', 3], ['DEL', 3]].flatMap(([posicion, n]) =>
    Array.from({ length: n }, (_, i) => ({ nombre: `${posicion} ${i + 1}`, posicion, equipo: '-', xp: 0, titularidad_pct: 100 })))
];

export function renderAll(data = EMPTY) {
  renderBalance(data.saldo, data.ventas_recomendadas);
  renderPitch(data.once);
  renderMarket(data.compras_mercado);
  renderSales(data.ventas_recomendadas);
}

function renderBalance(saldo, ventas) {
  const neg = saldo < 0;
  $('kpiBalance').textContent = money(saldo);
  $('kpiBalance').className = `text-base md:text-lg font-extrabold ${neg ? 'text-argon-danger' : 'text-argon-success'} mt-0.5`;
  const tone = neg ? 'bg-rose-50 text-argon-danger' : 'bg-emerald-50 text-argon-success';
  $('kpiBalanceBadge').textContent = neg ? 'NEGATIVO (-4 PTS)' : 'POSITIVO (OK)';
  $('kpiBalanceBadge').className = `inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tone} mt-1`;
  $('badgeSaleStatus').textContent = neg ? 'Venta Obligatoria' : 'Saldo OK';
  $('badgeSaleStatus').className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`;

  $('kpiAlertCount').textContent = ventas.length;
  $('kpiAlertSub').textContent = ventas.length ? 'Revisar cartera' : 'Sin ventas pendientes';

  $('salesContent').innerHTML = neg
    ? `<p class="text-xs font-semibold text-argon-danger">Debes vender antes del viernes para puntuar:</p>${saleCards(ventas) || '<p class="text-xs text-argon-muted">La IA no propuso ventas: revisa tu plantilla.</p>'}`
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

function pin(p) {
  const border = p.titularidad_pct < 70 ? 'border-argon-warning' : 'border-white';
  return `
    <div class="flex flex-col items-center w-14">
      <div class="relative w-10 h-10 rounded-full bg-white shadow-md border-2 ${border} flex items-center justify-center font-extrabold text-argon-dark text-xs">
        ${esc(String(p.nombre ?? '?').slice(0, 2).toUpperCase())}
      </div>
      <div class="mt-1 bg-black/65 backdrop-blur-sm px-1.5 py-0.5 rounded text-white text-[9px] font-bold text-center w-full truncate shadow-sm">${esc(p.nombre)}</div>
      <span class="text-[8px] font-bold text-white/90 drop-shadow">${p.xp ? esc(p.xp) + ' xP' : ''}${p.titularidad_pct < 100 ? ' · ' + esc(p.titularidad_pct) + '%' : ''}</span>
    </div>`;
}

function renderPitch(once) {
  const players = once.length ? once : placeholderPitch();
  const xp = players.reduce((s, p) => s + (Number(p.xp) || 0), 0);
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
    const [color, label] = BADGES[m.tipo] ?? ['bg-gray-100 text-gray-600', '⚪ ' + esc(m.tipo)];
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
