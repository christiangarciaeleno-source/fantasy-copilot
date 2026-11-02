import { STATE, saveSettings, saveLast, loadLast } from './js/state.js';
import { $, toast, haptic } from './js/util.js';
import { analyze, validate, manualPrompt, importManual, ping } from './js/ai.js';
import { renderAll } from './js/render.js';
import { DEMO } from './js/demo.js';
import { exportSummary } from './js/export.js';
import { setupDragAndDrop, removeImage, pasteFromClipboard, pasteText } from './js/image.js';
import { copyBookmarklet } from './js/bookmarklet.js';

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
function toggleSettingsModal() {
  haptic(10);
  $('settingsModal').classList.toggle('hidden');
  $('settingsModal').classList.toggle('flex');
}

function loadSettingsForm() {
  $('inputGeminiKey').value = STATE.geminiKey;
  const sel = $('selectModel');
  // El fallback puede haber guardado un modelo que no está en la lista: se añade para no guardar ''.
  if (![...sel.options].some((o) => o.value === STATE.model)) sel.add(new Option(STATE.model, STATE.model));
  sel.value = STATE.model;
  $('selectScoring').value = STATE.scoring;
}

function saveAppSettings() {
  Object.assign(STATE, {
    geminiKey: $('inputGeminiKey').value.trim(),
    model: $('selectModel').value,
    scoring: $('selectScoring').value
  });
  saveSettings();
  toggleSettingsModal();
  toast('Ajustes guardados correctamente', '✓');
}

async function testConnection() {
  haptic(15);
  STATE.geminiKey = $('inputGeminiKey').value.trim(); // se guarda al pulsar Guardar Ajustes
  if (!STATE.geminiKey) return toast('Pega primero tu API Key de Gemini', '🔑');
  toast('Probando conexión…', '📡');
  try {
    const r = await ping();
    toast(`Conexión OK: ${r.model} respondió en ${(r.ms / 1000).toFixed(1)} s`, '✅');
  } catch (err) {
    toast(err.name === 'TimeoutError' ? 'Google no respondió en 20 s: revisa tu conexión' : `Fallo: ${err.message}`, '❌');
  }
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
  if (!STATE.inputs.length) return toast('Sube una captura o pega texto del Fantasy antes de analizar', '📸');
  setLoading(true);
  try {
    const data = await analyze((msg) => { $('analyzeLabel').textContent = msg; });
    show(data);
    haptic(40);
    toast('¡Análisis táctico completado!', '⚽');
  } catch (err) {
    if (err.code === 'NOKEY') {
      toggleSettingsModal();
      return toast('Introduce tu API Key de Gemini en Ajustes', '🔑');
    }
    console.error('Fantasy AI Error:', err);
    toast(err.name === 'TimeoutError'
      ? `${err.message}. Prueba con una sola entrada, wifi o el modo manual`
      : `Fallo: ${err.message}`, '❌');
  } finally {
    setLoading(false);
  }
}

// --- Modo manual (sin API) ---
async function copyManualPrompt() {
  haptic(15);
  try {
    await navigator.clipboard.writeText(manualPrompt());
    toast('Prompt copiado: pégalo en Gemini o Claude junto a tus capturas', '📋');
  } catch {
    toast('No se pudo acceder al portapapeles', '🔒');
  }
}

function importManualJson() {
  haptic(25);
  try {
    show(importManual($('manualJson').value));
    $('manualJson').value = '';
    toast('Respuesta importada', '⚽');
  } catch (err) {
    toast(`No se pudo importar: ${err.message}`, '❌');
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
  testConnection, switchTab, toggleSettingsModal, saveAppSettings, runAnalysis,
  loadCompleteDemo, copyManualPrompt, importManualJson, installPWA, dismissPWA, exportSummary, removeImage, pasteFromClipboard, pasteText, copyBookmarklet
});

// --- Arranque ---
loadSettingsForm();
setupDragAndDrop();
setupPWA();
const last = loadLast();
try { if (STATE.data) validate(STATE.data); } catch { STATE.data = null; } // dato guardado corrupto: se ignora
renderAll(STATE.data ?? undefined);
if (last?.data) toast(`Último análisis restaurado (${new Date(last.ts).toLocaleString('es-ES')})`, '🕘');
