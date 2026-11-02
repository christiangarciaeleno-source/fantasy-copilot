import { STATE, saveSettings, saveLast, loadLast } from './js/state.js';
import { $, toast, haptic } from './js/util.js';
import { analyze, validate } from './js/ai.js';
import { renderAll } from './js/render.js';
import { DEMO } from './js/demo.js';
import { exportSummary } from './js/export.js';
import { setupDragAndDrop, removeImage, pasteFromClipboard } from './js/image.js';

// --- Navegación ---
function switchTab(tab) {
  haptic(12);
  document.querySelectorAll('.tab-view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab}`));
  document.querySelectorAll('.tab-pill').forEach((b) => {
    const on = b.id === `tabBtn-${tab}`;
    b.classList.toggle('active', on);
    b.classList.toggle('bg-argon-primary/10', on);
    b.classList.toggle('text-argon-primary', on);
    b.classList.toggle('text-gray-500', !on);
  });
  document.querySelectorAll('.nav-button').forEach((b) => {
    const on = b.id === `navBtn-${tab}`;
    b.classList.toggle('text-argon-primary', on);
    b.classList.toggle('text-gray-400', !on);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Ajustes ---
function syncEngineFields() {
  const engine = $('selectEngine').value;
  document.querySelectorAll('[data-eng]').forEach((el) => el.classList.toggle('hidden', el.dataset.eng !== engine));
}

function toggleSettingsModal() {
  haptic(10);
  $('settingsModal').classList.toggle('hidden');
  $('settingsModal').classList.toggle('flex');
}

function loadSettingsForm() {
  $('selectEngine').value = STATE.engine;
  $('inputGeminiKey').value = STATE.geminiKey;
  $('inputClaudeKey').value = STATE.claudeKey;
  const sel = $('selectModel');
  // El fallback puede haber guardado un modelo que no está en la lista: se añade para no guardar ''.
  if (![...sel.options].some((o) => o.value === STATE.model)) sel.add(new Option(STATE.model, STATE.model));
  sel.value = STATE.model;
  $('selectScoring').value = STATE.scoring;
  $('toggleResearch').checked = STATE.research;
  syncEngineFields();
}

function saveAppSettings() {
  Object.assign(STATE, {
    engine: $('selectEngine').value,
    geminiKey: $('inputGeminiKey').value.trim(),
    claudeKey: $('inputClaudeKey').value.trim(),
    model: $('selectModel').value,
    scoring: $('selectScoring').value,
    research: $('toggleResearch').checked
  });
  saveSettings();
  toggleSettingsModal();
  toast('Ajustes guardados correctamente', '✓');
}

// --- Análisis ---
function setLoading(on) {
  $('btnAnalyze').disabled = on;
  $('btnAnalyze').classList.toggle('opacity-75', on);
  $('analyzeSpinner').classList.toggle('hidden', !on);
  $('analyzeIcon').classList.toggle('hidden', on);
  $('analyzeLabel').textContent = on ? 'Procesando...' : 'Analizar con IA';
}

function show(data) {
  saveLast(data);
  renderAll(data);
  switchTab('once');
}

async function runAnalysis() {
  haptic(25);
  if (!STATE.image) return toast('Sube o pega una captura antes de analizar', '📸');
  setLoading(true);
  try {
    const data = await analyze();
    show(data);
    haptic(40);
    data.sinInforme ? toast('Analizado solo con la captura: la búsqueda en medios falló', '⚠️') : toast('¡Análisis táctico completado!', '⚽');
  } catch (err) {
    if (err.code === 'NOKEY') {
      toggleSettingsModal();
      return toast('Introduce la API Key del motor elegido en Ajustes', '🔑');
    }
    console.error('Fantasy AI Error:', err);
    toast(`Fallo: ${err.message}`, '❌');
  } finally {
    setLoading(false);
  }
}

function loadCompleteDemo() {
  haptic(30);
  renderAll(DEMO); // sin saveLast: la demo no debe pisar el último análisis real
  switchTab('once');
  toast('Datos demo de LaLiga cargados', '⚡');
}

// --- PWA ---
function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    STATE.deferredPrompt = e;
    $('pwaInstallBanner').classList.remove('hidden');
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
}

async function installPWA() {
  if (!STATE.deferredPrompt) return;
  STATE.deferredPrompt.prompt();
  if ((await STATE.deferredPrompt.userChoice).outcome === 'accepted') toast('Instalando app...', '📲');
  STATE.deferredPrompt = null;
  dismissPWA();
}

const dismissPWA = () => $('pwaInstallBanner').classList.add('hidden');

// Los handlers inline (onclick) del HTML necesitan globals.
Object.assign(window, {
  switchTab, syncEngineFields, toggleSettingsModal, saveAppSettings, runAnalysis,
  loadCompleteDemo, installPWA, dismissPWA, exportSummary, removeImage, pasteFromClipboard
});

// --- Arranque ---
loadSettingsForm();
setupDragAndDrop();
setupPWA();
const last = loadLast();
try { if (STATE.data) validate(STATE.data); } catch { STATE.data = null; } // dato guardado corrupto: se ignora
renderAll(STATE.data ?? undefined);
if (last?.data) toast(`Último análisis restaurado (${new Date(last.ts).toLocaleString('es-ES')})`, '🕘');
