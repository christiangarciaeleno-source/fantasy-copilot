import { STATE } from './state.js';
import { $, toast, haptic } from './util.js';

const MAX = 4; // plantilla, alineación, mercado y una extra (saldo)
const MAX_TEXT = 20000; // caracteres por texto: una página del Fantasy cabe de sobra

export function setupDragAndDrop() {
  const zone = $('dropzoneBox');
  const add = (files) => {
    const room = MAX - STATE.inputs.length;
    if (files.length > room) toast(`Solo caben ${MAX} entradas: se añaden las ${Math.max(room, 0)} primeras`, '⚠️');
    [...files].slice(0, Math.max(room, 0)).forEach(handleFile);
  };
  $('fileInput').addEventListener('change', (e) => { add(e.target.files); e.target.value = ''; });
  const hl = ['border-argon-primary', 'bg-argon-primary/5'];
  ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add(...hl); }));
  ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.remove(...hl); }));
  zone.addEventListener('drop', (e) => add(e.dataTransfer.files));
}

// Máx. 1600px y JPEG: la subida móvil es más rápida y el análisis, más ligero.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

function renderImages() {
  const list = $('imageList');
  list.classList.toggle('hidden', !STATE.inputs.length);
  list.classList.toggle('flex', STATE.inputs.length > 0);
  list.innerHTML = STATE.inputs.map((im, i) => `
    <div class="relative">
      ${im.text
    ? `<div class="h-14 w-14 rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col items-center justify-center text-[9px] font-bold text-argon-dark"><span class="text-base">📝</span>${(im.text.length / 1000).toFixed(1)}k</div>`
    : `<img src="${im.url}" class="h-14 w-14 object-cover rounded-lg border border-gray-200 shadow-sm" alt="Captura ${i + 1}">`}
      <button onclick="removeImage(${i}, event)" aria-label="Quitar entrada ${i + 1}" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-argon-danger text-white text-[10px] font-bold leading-none shadow">✕</button>
    </div>`).join('') + `<p class="w-full text-[10px] font-bold text-argon-success">✓ ${STATE.inputs.length}/${MAX} entradas listas</p>`;
}

export function handleFile(file) {
  if (!file?.type.startsWith('image/')) return toast('Selecciona un archivo de imagen válido', '⚠️');
  if (STATE.inputs.length >= MAX) return toast(`Máximo ${MAX} entradas: borra alguna para añadir otra`, '⚠️');
  const reader = new FileReader();
  reader.onload = async (e) => {
    const url = await shrink(file).catch(() => e.target.result); // si falla, la original
    if (STATE.inputs.length >= MAX) return; // varias a la vez: puede haberse llenado entre medias
    STATE.inputs.push({ mime: url.slice(5, url.indexOf(';')), b64: url.split(',')[1], url });
    renderImages();
    haptic(20);
    toast('Captura añadida. Puedes subir más o analizar.', '📸');
  };
  reader.readAsDataURL(file);
}

// Se quitan los emails: la página del Fantasy suele mostrar los de la cuenta y el texto va a Google.
export const cleanText = (text) => text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').trim().slice(0, MAX_TEXT);

export function addText(text) {
  const clean = cleanText(text);
  if (clean.length < 30) return toast('No hay texto en el portapapeles: cópialo primero', '⚠️');
  if (STATE.inputs.length >= MAX) return toast(`Máximo ${MAX} entradas: borra alguna para añadir otra`, '⚠️');
  STATE.inputs.push({ text: clean });
  renderImages();
  haptic(20);
  toast('Texto añadido. Puedes añadir más o analizar.', '📝');
}

export async function pasteText() {
  haptic(15);
  try {
    addText(await navigator.clipboard.readText());
  } catch {
    toast('Permiso de portapapeles denegado', '🔒');
  }
}

export function removeImage(i, e) {
  e?.stopPropagation();
  STATE.inputs.splice(i, 1);
  renderImages();
  haptic(10);
}

export async function pasteFromClipboard() {
  haptic(15);
  if (!navigator.clipboard?.read) return toast('Portapapeles no soportado', '⚠️');
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return handleFile(await item.getType(type));
    }
    toast('No se encontró ninguna imagen en el portapapeles', '⚠️');
  } catch {
    toast('Permiso de portapapeles denegado', '🔒');
  }
}
