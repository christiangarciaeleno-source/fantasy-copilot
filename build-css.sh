#!/bin/sh
# Regenera app.css (Tailwind + styles.css). Ejecutar tras cambiar clases en index.html o js/.
cd "$(dirname "$0")" || exit 1
{ printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'; cat styles.css; } > /tmp/fc-input.css
npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i /tmp/fc-input.css -o app.css --minify
