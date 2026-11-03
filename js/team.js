import { STATE, saveTeam } from './state.js';
import { $, esc, money, toast, haptic } from './util.js';

const POS = ['POR', 'DEF', 'MED', 'DEL'];
const ESTADOS = ['ok', 'duda', 'lesionado', 'sancionado'];
const FOTO = new Map(); // nombre normalizado -> archivo de Wikimedia Commons
let DATA; // data/laliga.json (equipos y plantillas de Primera; lo genera scripts/build-laliga.mjs)

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const loadData = () => DATA ??= fetch('data/laliga.json').then((r) => r.json()).then((d) => {
  d.equipos.forEach((e) => e.jugadores.forEach((j) => j.f && FOTO.set(norm(j.n), j.f)));
  return d;
}).catch(() => ({ equipos: [] }));

// Importes en millones con coma ("5,2"); si pegan euros enteros (> 1000) se respetan.
export const toEuros = (s) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? Math.round(n > 1000 ? n : n * 1e6) : undefined; };
export const toSigned = (s) => { const v = toEuros(String(s).replace('-', '')); return v === undefined ? 0 : /^\s*-/.test(s) ? -v : v; };
export const fromEuros = (e) => (e == null ? '' : String(+(e / 1e6).toFixed(2)).replace('.', ','));

// Rellena el equipo desde un JSON importado (p. ej. el que la IA saca de unas capturas): luego se corrige a mano.
export function adoptTeam(d) {
  const clean = (a) => a.filter((p) => p?.nombre).map((p) => ({
    nombre: String(p.nombre), posicion: POS.includes(p.posicion) ? p.posicion : 'MED', equipo: String(p.equipo ?? ''),
    ...Object.fromEntries(['vm', 'clausula', 'puja'].filter((k) => Number.isFinite(p[k])).map((k) => [k, p[k]])),
    ...(ESTADOS.includes(p.estado) && { estado: p.estado })
  }));
  if (typeof d.saldo === 'number') STATE.team.saldo = d.saldo;
  if (d.plantilla?.length) STATE.team.plantilla = clean(d.plantilla);
  if (d.mercado?.length) STATE.team.mercado = clean(d.mercado);
  saveTeam();
}

const INP = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-argon-dark focus:outline-none focus:border-argon-primary';
const CHIP = 'text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500';

function avatar(nombre) {
  const f = FOTO.get(norm(nombre));
  const ini = esc(nombre.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase());
  return `<div class="relative w-11 h-11 rounded-full bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center text-xs font-extrabold text-argon-dark">${ini}${f
    ? `<img src="https://commons.wikimedia.org/wiki/Special:FilePath/${esc(encodeURIComponent(f))}?width=96" loading="lazy" alt="" class="absolute inset-0 w-full h-full object-cover" onerror="this.remove()">` : ''}</div>`;
}

const fields = (list) => (list === 'plantilla' ? [['vm', 'Valor M€'], ['clausula', 'Cláusula M€']] : [['vm', 'Valor M€'], ['puja', 'Mi puja M€']]);

function row(list, p, i) {
  const at = (k) => `data-l="${list}" data-i="${i}" data-k="${k}"`;
  return `
    <div class="bg-gray-50 rounded-xl p-2.5 flex gap-2.5 items-center">
      ${avatar(p.nombre)}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5"><span class="text-xs font-extrabold text-argon-dark truncate">${esc(p.nombre)}</span><span class="${CHIP}">${esc(p.posicion)}</span><span class="text-[9px] text-argon-muted">${esc(p.equipo)}</span></div>
        <div class="${list === 'plantilla' ? 'grid-cols-3' : 'grid-cols-2'} grid gap-1.5 mt-1.5">
          ${fields(list).map(([k, label]) => `<input ${at(k)} inputmode="decimal" placeholder="${label}" value="${fromEuros(p[k])}" class="${INP}">`).join('')}
          ${list === 'plantilla' ? `<select ${at('estado')} class="${INP}">${ESTADOS.map((e) => `<option${e === (p.estado ?? 'ok') ? ' selected' : ''}>${e}</option>`).join('')}</select>` : ''}
        </div>
      </div>
      <button data-act="del" data-l="${list}" data-i="${i}" aria-label="Quitar ${esc(p.nombre)}" class="text-argon-danger text-sm px-1">✕</button>
    </div>`;
}

const section = (list, title, hint) => {
  const items = STATE.team[list];
  const total = items.reduce((s, p) => s + (p.vm || 0), 0);
  return `
    <details open class="bg-white rounded-2xl shadow-argon border border-gray-100 p-4">
      <summary class="text-sm font-extrabold text-argon-dark cursor-pointer">${title} <span class="text-[11px] font-bold text-argon-muted">· ${items.length} jugadores${total ? ` · ${money(total)}` : ''}</span></summary>
      <p class="text-[10px] text-argon-muted mt-1">${hint}</p>
      <div class="space-y-2 mt-3">${items.map((p, i) => row(list, p, i)).join('')}</div>
      <button data-act="add" data-l="${list}" class="w-full mt-3 bg-argon-primary hover:bg-[#e63d37] active:scale-95 text-white font-bold py-2.5 rounded-xl text-xs transition">+ Añadir jugador por equipo</button>
    </details>`;
};

export async function renderTeam() {
  const data = await loadData();
  $('view-equipo').innerHTML = `
    <div class="space-y-4">
      <div class="bg-white rounded-2xl shadow-argon border border-gray-100 p-4">
        <label class="block text-[11px] font-extrabold text-argon-muted uppercase tracking-wider mb-1.5">💰 Saldo actual (M€, negativo si hay deuda)</label>
        <input data-act="saldo" inputmode="decimal" placeholder="Ej. 3,5 o -1,2" value="${STATE.team.saldo ? fromEuros(STATE.team.saldo) : ''}" class="${INP}">
      </div>
      ${section('plantilla', '🧑‍🤝‍🧑 Mi plantilla', 'Valor y cláusula son opcionales: si no los pones, el analista los busca en fuentes públicas.')}
      ${section('mercado', '📈 Mercado de mi liga', 'Jugadores que salen en tu mercado, con su valor y lo que pujarías.')}
      <p class="text-[10px] text-gray-400 text-center">Plantillas: ESPN · Fotos: Wikimedia Commons (licencias libres, solo donde existen). Lista actualizada el ${esc(data.actualizado ?? '?')}.</p>
    </div>`;
}

// --- Selector: desplegable de equipo + lista de jugadores con foto ---
let pick; // { l: 'plantilla' | 'mercado', t: índice de equipo, q: búsqueda }

async function openPicker(l) {
  const data = await loadData();
  pick = { l, t: 0, q: '' };
  const el = Object.assign(document.createElement('div'), { id: 'picker', className: 'fixed inset-0 z-50 bg-[#0d0d14] overflow-y-auto p-4 pb-24' });
  el.innerHTML = `
    <div class="max-w-md mx-auto space-y-3">
      <div class="flex justify-between items-center"><h3 class="text-lg font-extrabold">Añadir a ${l === 'plantilla' ? 'mi plantilla' : 'el mercado'}</h3><button data-act="pclose" class="text-lg px-2">✕</button></div>
      <select data-act="pteam" class="${INP}">${data.equipos.map((e, i) => `<option value="${i}">${esc(e.nombre)}</option>`).join('')}</select>
      <input data-act="pq" placeholder="🔍 Buscar jugador en toda la liga" class="${INP}">
      <div id="pickList" class="space-y-1.5"></div>
      <div class="bg-white rounded-xl p-3 border border-gray-100 space-y-2">
        <p class="text-[11px] font-bold text-argon-muted">¿No está? Añádelo a mano (fichajes recientes)</p>
        <div class="flex gap-2"><input id="pManual" placeholder="Nombre" class="${INP}"><select id="pPos" class="${INP} !w-20">${POS.map((p) => `<option>${p}</option>`).join('')}</select><button data-act="pmanual" class="bg-argon-primary text-white font-bold px-3 rounded-lg text-xs">+</button></div>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', pickerEvent);
  el.addEventListener('input', pickerEvent);
  el.addEventListener('change', pickerEvent);
  renderPickList();
}

async function renderPickList() {
  const { equipos } = await loadData();
  const q = norm(pick.q);
  const all = equipos.flatMap((e, t) => e.jugadores.map((j, jx) => ({ e, t, j, jx })));
  const shown = (q ? all.filter(({ j }) => norm(j.n).includes(q)) : all.filter(({ t }) => t === pick.t)).slice(0, 60);
  const have = new Set(STATE.team[pick.l].map((p) => norm(p.nombre)));
  $('pickList').innerHTML = shown.map(({ e, t, j, jx }) => `
    <button data-act="padd" data-t="${t}" data-j="${jx}" class="w-full flex items-center gap-3 bg-white hover:bg-gray-100 border border-gray-100 rounded-xl p-2 text-left">
      ${avatar(j.n)}
      <span class="flex-1 min-w-0"><span class="block text-xs font-extrabold text-argon-dark truncate">${esc(j.n)}</span><span class="text-[10px] text-argon-muted">${esc(e.abrev)} · ${j.p}${j.d ? ` · #${j.d}` : ''}</span></span>
      <span class="text-xs font-bold ${have.has(norm(j.n)) ? 'text-argon-success' : 'text-argon-primary'}">${have.has(norm(j.n)) ? '✓' : '+'}</span>
    </button>`).join('') || '<p class="text-xs text-argon-muted text-center py-4">Sin resultados: añádelo a mano abajo.</p>';
}

async function pickerEvent(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'pclose' && e.type === 'click') return $('picker').remove();
  if (act === 'pteam') { pick.t = +el.value; pick.q = ''; renderPickList(); }
  else if (act === 'pq') { pick.q = el.value; renderPickList(); }
  else if (e.type === 'click' && act === 'padd') {
    const eq = (await loadData()).equipos[+el.dataset.t];
    addPlayer({ nombre: eq.jugadores[+el.dataset.j].n, posicion: eq.jugadores[+el.dataset.j].p, equipo: eq.abrev });
  } else if (e.type === 'click' && act === 'pmanual') {
    const nombre = $('pManual').value.trim();
    if (nombre) { addPlayer({ nombre, posicion: $('pPos').value, equipo: '' }); $('pManual').value = ''; }
  }
}

function addPlayer(p) {
  const list = STATE.team[pick.l];
  if (list.some((x) => norm(x.nombre) === norm(p.nombre))) return toast('Ya lo tienes en la lista', 'ℹ️');
  list.push(p);
  saveTeam();
  haptic(15);
  toast(`${p.nombre} añadido`, '✅');
  renderPickList();
  renderTeam();
}

// Edición en la propia pestaña: un solo listener para todos los campos.
export function initTeam() {
  const view = $('view-equipo');
  view.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el?.dataset.act === 'add') openPicker(el.dataset.l);
    if (el?.dataset.act === 'del') { STATE.team[el.dataset.l].splice(+el.dataset.i, 1); saveTeam(); renderTeam(); }
  });
  const edit = (e) => {
    const el = e.target;
    if (el.dataset.act === 'saldo') STATE.team.saldo = toSigned(el.value);
    else if (el.dataset.k) {
      const p = STATE.team[el.dataset.l][+el.dataset.i];
      if (el.dataset.k === 'estado') p.estado = el.value;
      else if (toEuros(el.value) === undefined) delete p[el.dataset.k];
      else p[el.dataset.k] = toEuros(el.value);
    } else return;
    saveTeam();
  };
  view.addEventListener('input', edit);
  view.addEventListener('change', edit);
}
