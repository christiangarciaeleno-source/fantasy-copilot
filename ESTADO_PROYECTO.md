# Estado del proyecto – Fantasy Copilot Pro

Última actualización: 2026-11-02

## 1. Árbol de archivos (líneas exactas)

```
.
├── index.html                      291   UI Argon (sin lógica)
├── app.js                          137   Entrada: tabs, ajustes, análisis, PWA
├── sw.js                            35   Service Worker (precache + stale-while-revalidate)
├── manifest.json                    13   standalone, portrait, #5e72e4
├── styles.css                       70
├── tw-config.js                     20   Tema Tailwind (CDN)
├── icon.svg                          1
├── js/
│   ├── ai.js                       102   Motor dual Gemini/Claude + esquema JSON
│   ├── render.js                   118   Pizarra, saldo, mercado, ventas
│   ├── image.js                     49   Captura: drag&drop, input, portapapeles
│   ├── state.js                     37   STATE + persistencia localStorage
│   ├── export.js                    33   Resumen con emojis para WhatsApp/Telegram
│   ├── demo.js                      23   Datos demo
│   └── util.js                      21   $, esc, money, haptic, toast
├── gemini-code-1793642262891.md      5   Directrices de desarrollo
├── .gitignore                        9
└── ESTADO_PROYECTO.md                –   Este archivo
```

Regla: ningún archivo supera 300 líneas (máximo actual: `index.html`, 291).

## 2. Despliegue

- Repositorio: https://github.com/christiangarciaeleno-source/fantasy-copilot (público, rama `main`, 1 commit inicial)
- GitHub Pages: activo, fuente `main` / `/`, último build `built`
- URL pública: **https://christiangarciaeleno-source.github.io/fantasy-copilot/**
- Despliegue: automático en cada `git push` a `main`.
- Al cambiar cualquier asset, subir `CACHE` en `sw.js` (`fantasy-pro-v1`) para invalidar la caché.

## 3. Pendiente / no verificado

- Llamadas reales a Gemini y Claude sin probar (faltan claves en el entorno de desarrollo).
- Service Worker sin verificar en Chrome real (el navegador integrado no lo registró).
- Icono solo SVG: si Chrome Android no ofrece instalar, añadir PNG 192/512.
- Grounding de Gemini desactivado por defecto: con grounding no se puede forzar el esquema JSON.

## 4. Próximas mejoras recomendadas

1. **Probar en el Pixel**: instalación PWA, ambos motores y el resumen al portapapeles.
2. **Iconos PNG** 192/512 (+ maskable) para garantizar instalabilidad.
3. **Datos objetivos**: integrar SofaScore u otra fuente para `xp` y `titularidad_pct`, en lugar de estimarlos con la IA. Revisar términos de uso y CORS (puede requerir proxy).
4. **Cronistas MARCA / analistas**: recuperar la pestaña de noticias con una fuente real (scraping vía proxy o grounding), con su propio esquema.
5. **Modo offline estricto**: autohospedar Tailwind (build estático) y fuentes, para no depender de CDN con el Service Worker.
6. **Historial multi-jornada**: guardar varios análisis (no solo el último) y compararlos.
7. **Validación de formación**: comprobar en cliente que `once` tiene 11 jugadores, un capitán y una formación válida; reintentar si no.
8. **Seguridad de claves**: valorar un proxy ligero si la app se comparte con más gente.
