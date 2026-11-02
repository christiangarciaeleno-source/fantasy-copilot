# Estado del proyecto – Fantasy Copilot Pro

Última actualización: 2026-11-02

## 1. Árbol de archivos (líneas exactas)

```
.
├── index.html              298   UI Argon (sin lógica)
├── app.js                  180   Entrada: tabs, ajustes, análisis, modo manual, PWA
├── sw.js                     37   Service Worker (precache + stale-while-revalidate)
├── manifest.json            15   standalone, portrait, #5e72e4
├── styles.css               70   CSS propio (fuente de app.css)
├── app.css                   1   CSS generado (Tailwind CLI + styles.css); no editar
├── tailwind.config.js       21   Tema Tailwind para build-css.sh
├── build-css.sh              5   Regenera app.css
├── icon.svg                  1   Icono vectorial
├── js/ai.js                192   Gemini: transporte con reintentos/reserva, prompt, esquema, validación, modo manual
├── js/render.js            115   Pizarra, saldo, mercado, ventas, resumen
├── js/openrouter.js        67   Motor OpenRouter (modelos gratuitos con visión, con reserva)
├── js/image.js              99   Entradas: capturas (máx. 4) y texto pegado
├── js/bookmarklet.js        19   Favorito que copia el texto de la web del Fantasy
├── js/state.js               36   STATE + persistencia localStorage
├── js/export.js             32   Resumen con emojis para WhatsApp/Telegram
├── js/demo.js               24   Datos demo
├── js/util.js                31   $, esc, money, haptic, toast
├── test.mjs                107   Tests (node test.mjs)
├── icon-192.png / icon-512.png   Iconos PWA
├── .gitignore
└── ESTADO_PROYECTO.md            Este archivo
```

Regla: ningún archivo (salvo `app.css`, generado) supera 300 líneas (máximo actual: `index.html`, 286).

## 2. Despliegue

- Repositorio: https://github.com/christiangarciaeleno-source/fantasy-copilot (público, rama `main`)
- GitHub Pages: fuente `main` / `/`, despliegue automático en cada `git push`.
- URL pública: **https://christiangarciaeleno-source.github.io/fantasy-copilot/**
- Al cambiar cualquier asset, subir `CACHE` en `sw.js` (`fantasy-pro-vN`) para invalidar la caché; en el móvil hay que cerrar y abrir la PWA dos veces.
- CSS: regenerar `app.css` con `./build-css.sh` si se añaden clases en `index.html` o `js/`.

## 3. Cómo funciona

- Entradas (máx. 4, mezclables): capturas (reducidas a 1600 px JPEG) o texto pegado (emails sustituidos por `[email]`, máx. 20.000 caracteres).
- Análisis: una llamada a Gemini con esquema JSON forzado (`saldo`, `resumen`, `once` de 11, `ventas_recomendadas`, `compras_mercado`).
  Transporte: 2 intentos por modelo (`gemini-2.5-flash` → reserva `gemini-2.5-flash-lite`), un timeout no se repite con el mismo modelo, tope total 100 s, sin "thinking" en 2.5 Flash, 404 → busca el Flash más nuevo y lo guarda (`fc_model`).
  Respuesta normalizada (posición, "85%", "5,5", 0,9 → 90) y un reintento con pista si el once no es válido.
- Motores (Ajustes): Google Gemini o OpenRouter (modelos `:free` con visión: se pide la lista en cada análisis y se prueban los 3 mejores; sin clave pegada de pago; ~50 peticiones/día sin créditos; hay que activar los endpoints gratuitos en openrouter.ai/settings/privacy). CORS de OpenRouter comprobado desde el navegador; el flujo completo con clave real sin probar.
- Modo manual (sin API): "Copiar prompt" + pegar el JSON de un chat de Gemini/Claude + "Importar respuesta".
- Favorito (`js/bookmarklet.js`): copia el texto visible de la web del Fantasy en Chrome del móvil; se pega con "Pegar texto del Fantasy".
- Persistencia: último análisis y ajustes en `localStorage`; el restaurado se valida al arrancar. La demo no pisa el análisis guardado.

## 4. Pendiente / no verificado

- Ningún análisis completo con éxito con clave real todavía (primero cuota/facturación de Google, después timeouts). Usar "Probar conexión" en Ajustes para aislar el fallo.
- El favorito no se ha probado contra la web real de MARCA (no se sabe si los datos salen como texto en el DOM).
- Service Worker e instalación PWA sin verificar en el Pixel.
- Seguridad: la clave vive en `localStorage` del origen `*.github.io`; no alojar otras páginas no fiables en la cuenta. Revocar cualquier clave pegada en chats.

## 5. Decisiones

- Solo motores gratuitos (Gemini y OpenRouter): se eliminó el motor Claude (de pago), el grounding y la búsqueda en medios (sin probar, gastaba cuota y tiempo).
- Sin capitán (es premium).
- Tailwind compilado a `app.css` (20 KB) en lugar del script del CDN (400 KB).

## 6. Ideas

1. Historial multi-jornada (hoy solo se guarda el último análisis).
2. Datos objetivos de SofaScore u otra fuente para `xp` y `titularidad_pct` (términos de uso y CORS).
3. Botón "Cancelar" durante el análisis.
