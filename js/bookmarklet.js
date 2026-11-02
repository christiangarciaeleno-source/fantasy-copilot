import { toast, haptic } from './util.js';

// Favorito que se pulsa en la web del Fantasy (con la sesión del usuario): copia el texto visible de la página
// al portapapeles. No hace ninguna petición de red; la PWA lo pega después con "Pegar texto".
// execCommand en vez de navigator.clipboard: en un favorito la página no tiene foco de usuario y writeText falla.
// Si el navegador aun así bloquea la copia, se muestra el texto seleccionado para copiarlo a mano.
const BODY = `const t=document.body.innerText;const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px';document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}a.remove();if(ok){alert('Copiado ('+t.length+' caracteres). Vuelve a Fantasy Copilot y pulsa Pegar texto.')}else{const o=document.createElement('textarea');o.value=t;o.readOnly=true;o.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;background:#fff;color:#000;font-size:14px';document.body.appendChild(o);o.focus();o.select();alert('El navegador bloqueó la copia automática: mantén pulsado el texto, elige Copiar y vuelve a Fantasy Copilot.')}`;

export const BOOKMARKLET = `javascript:(()=>{${BODY}})()`;

export async function copyBookmarklet() {
  haptic(15);
  try {
    await navigator.clipboard.writeText(BOOKMARKLET);
    toast('Código del favorito copiado', '📋');
  } catch {
    toast('No se pudo acceder al portapapeles', '🔒');
  }
}
