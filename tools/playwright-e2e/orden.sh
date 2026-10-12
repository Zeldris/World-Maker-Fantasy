#!/bin/bash
# QA-41: manda una orden (JS) a driver.mjs. Sin argumento, la lee de la entrada estándar.
PUERTO="${DRIVER_PORT:-9333}"
# QA-57: `orden.sh --ayuda <archivo> '<tk en JSON>'` lanza una ayuda de mcp/ (las mismas que con el MCP),
# con sus parámetros en window.tk. P. ej.: orden.sh --ayuda combate '{"ataque":"Estocada Veloz","rondas":3}'
if [ "$1" = "--ayuda" ]; then
  AYUDA="$(cd "$(dirname "$0")" && pwd)/mcp/${2%.js}.js"
  [ -f "$AYUDA" ] || { echo "No existe $AYUDA"; exit 1; }
  # La ruta y los parámetros entran en el JS como literales de JSON (una comilla en la ruta no rompe la
  # orden) y los parámetros tienen que ser JSON válido: nada de código suelto.
  ORDEN="$(node -e '
    const [ruta, tk] = process.argv.slice(1);
    let datos;
    try { datos = JSON.parse(tk); } catch (e) { console.error("orden.sh: los parámetros no son JSON: " + e.message); process.exit(1); }
    console.log(`await page.evaluate((tk) => { window.tk = tk }, ${JSON.stringify(datos)}); const fs = await import("node:fs"); const ayuda = eval(fs.readFileSync(${JSON.stringify(ruta)}, "utf8")); return await ayuda(page);`);
  ' "$AYUDA" "${3:-{\}}")" || exit 1
  set -- "$ORDEN"
fi
CLAVE="$(cat "$(dirname "$0")/driver.token" 2>/dev/null)"
if [ -n "$1" ]; then
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary "$1" "localhost:$PUERTO/"
else
  curl -s -X POST -H "X-Driver-Token: $CLAVE" --data-binary @- "localhost:$PUERTO/"
fi
echo
