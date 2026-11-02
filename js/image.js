import { STATE } from './state.js';
import { $, toast, haptic } from './util.js';

export function setupDragAndDrop() {
  const zone = $('dropzoneBox');
  $('fileInput').addEventListener('change', (e) => e.target.files.length && handleFile(e.target.files[0]));
  const hl = ['border-argon-primary', 'bg-argon-primary/5'];
  ['dragenter', 'dragover'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.add(...hl); }));
  ['dragleave', 'drop'].forEach((n) => zone.addEventListener(n, (e) => { e.preventDefault(); zone.classList.remove(...hl); }));
  zone.addEventListener('drop', (e) => e.dataTransfer.files.length && handleFile(e.dataTransfer.files[0]));
}

// Máx. 1600px y JPEG: Claude rechaza >5 MB y la subida móvil es más rápida.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

export function handleFile(file) {
  if (!file?.type.startsWith('image/')) return toast('Selecciona un archivo de imagen válido', '⚠️');
  const reader = new FileReader();
  reader.onload = async (e) => {
    const url = await shrink(file).catch(() => e.target.result); // si falla, la original
    STATE.image = { mime: url.slice(5, url.indexOf(';')), b64: url.split(',')[1] };
    $('imageThumbnail').src = url;
    $('imageFilename').textContent = file.name || 'Captura_Fantasy.jpg';
    $('dropEmpty').classList.add('hidden');
    $('dropPreview').classList.replace('hidden', 'flex');
    haptic(20);
    toast('Captura cargada. Lista para analizar.', '📸');
  };
  reader.readAsDataURL(file);
}

export function removeImage(e) {
  e?.stopPropagation();
  STATE.image = null;
  $('fileInput').value = '';
  $('dropEmpty').classList.remove('hidden');
  $('dropPreview').classList.replace('flex', 'hidden');
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
