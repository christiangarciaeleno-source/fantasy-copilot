# Estado del proyecto – Fantasy Copilot Pro

Última actualización: 2026-11-02

## 1. Árbol de archivos (líneas exactas)

```
.
├── index.html                      290   UI Argon (sin lógica)
├── app.js                          140   Entrada: tabs, ajustes, análisis, PWA
├── sw.js                            37   Service Worker (precache + stale-while-revalidate)
├── manifest.json                    13   standalone, portrait, #5e72e4
├── styles.css                       70
├── tailwind.config.js                     20   Tema Tailwind (para build-css.sh)
├── icon.svg                          1
├── js/
│   ├── ai.js                       127   Motor Gemini (búsqueda + análisis) + esquema JSON
│   ├── render.js                   114   Pizarra, saldo, mercado, ventas
│   ├── image.js                     59   Captura: drag&drop, input, portapapeles
│   ├── state.js                     37   STATE + persistencia localStorage
│   ├── export.js                    31   Resumen con emojis para WhatsApp/Telegram
│   ├── demo.js                      23   Datos demo
│   └── util.js                      21   $, esc, money, haptic, toast
├── test.mjs                         18   Tests (node test.mjs)
├── .gitignore                        9
└── ESTADO_PROYECTO.md                –   Este archivo
```

Regla: ningún archivo supera 300 líneas (máximo actual: `index.html`, 291).

## 2. Despliegue

- Repositorio: https://github.com/christiangarciaeleno-source/fantasy-copilot (público, rama `main`, )
- GitHub Pages: activo, fuente `main` / `/`, último build `built`
- URL pública: **https://christiangarciaeleno-source.github.io/fantasy-copilot/**
- Despliegue: automático en cada `git push` a `main`.
- Al cambiar cualquier asset, subir `CACHE` en `sw.js` (nombre actual en `sw.js`) para invalidar la caché.

## 3. Pendiente / no verificado

- Gemini responde desde el Pixel; falta una llamada completa con éxito (la clave probada dio "prepayment credits depleted", problema de facturación de Google).
- Service Worker sin verificar en Chrome real (el navegador integrado no lo registró).
- Búsqueda en medios (interruptor en Ajustes, activa por defecto): llamada previa con googleSearch que genera un informe que se añade al prompt del análisis estructurado. Sin probar con claves reales.
- Grounding eliminado: gastaba más cuota y no permitía forzar el esquema JSON.

- Seguridad: las claves viven en `localStorage` del origen `*.github.io`; no alojar otras páginas de la cuenta que no sean de confianza.

## 4. Próximas mejoras recomendadas

1. **Probar en el Pixel**: instalación PWA, ambos motores y el resumen al portapapeles.
2. **Iconos PNG** 192/512 (+ maskable) para garantizar instalabilidad.
3. **Datos objetivos**: integrar SofaScore u otra fuente para `xp` y `titularidad_pct`, en lugar de estimarlos con la IA. Revisar términos de uso y CORS (puede requerir proxy).
4. **Cronistas MARCA / analistas**: recuperar la pestaña de noticias con una fuente real (scraping vía proxy o grounding), con su propio esquema.
5. **Modo offline estricto**: autohospedar Tailwind (build estático) y fuentes, para no depender de CDN con el Service Worker.
6. **Historial multi-jornada**: guardar varios análisis (no solo el último) y compararlos.
7. **Reintento automático** si `validate` rechaza el once (ya valida 11 jugadores y posiciones; sin capitán, es premium).
8. **Seguridad de claves**: valorar un proxy ligero si la app se comparte con más gente.

- Decisión: solo Gemini (capa gratuita); se eliminó el motor Claude por ser de pago.
- CSS: `app.css` se genera con `./build-css.sh` (Tailwind CLI 3.4.17 + `styles.css`); regenerarlo si se añaden clases nuevas en `index.html` o `js/`. Ya no se compila Tailwind en el móvil.
- Modo manual (sin API): botón "Copiar prompt" + pegar el JSON de Gemini/Claude chat y "Importar respuesta". La búsqueda en medios pasa a desactivada por defecto (clave `fc_search`) y con tope de 30 s.
