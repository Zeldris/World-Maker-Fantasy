#!/bin/bash
# QA-93 (retro del 2026-10-17): la cuadrícula del mapa de zona (16×12 casillas de 50 px) sobre su ilustración,
# con la etiqueta «x,y» de cada casilla, y en rojo los muros que ya tiene en murosZona.ts. Para sacar los muros
# de una zona nueva y comprobarlos (docs/runbooks/nuevo-elemento-catalogo.md § «Muros de una zona»).
#   bash tools/zona/rejilla.sh <slug de la Location> [carpeta de salida]
set -euo pipefail
slug="${1:?uso: bash tools/zona/rejilla.sh <slug> [carpeta]}"
salida="${2:-.}"
raiz="$(git rev-parse --show-toplevel)"
mapa="$raiz/backend/uploads/images/zona/$slug-mapa.png"
[ -f "$mapa" ] || { echo "No hay ilustración: $mapa" >&2; exit 1; }

lineas=() textos=() rojos=()
for i in $(seq 1 15); do lineas+=(-draw "line $((i * 50)),0 $((i * 50)),600"); done
for j in $(seq 1 11); do lineas+=(-draw "line 0,$((j * 50)) 800,$((j * 50))"); done
for i in $(seq 0 15); do for j in $(seq 0 11); do textos+=(-draw "text $((i * 50 + 3)),$((j * 50 + 12)) '$i,$j'"); done; done
# Las casillas de la entrada '<slug>': [ ... ] de MUROS_POR_LOCATION.
celdas="$(sed -n "/^  '$slug': \[/,/^  \],/p" "$raiz/backend/src/services/murosZona.ts" | grep -o '\[[0-9]*, [0-9]*\]' | tr -d '[],' || true)"
while read -r x y; do
  [ -n "$x" ] && rojos+=(-draw "rectangle $((x * 50)),$((y * 50)) $((x * 50 + 49)),$((y * 50 + 49))")
done <<<"$celdas"

convert "$mapa" -resize '800x600!' \
  -fill 'rgba(255,0,0,0.45)' -stroke none "${rojos[@]}" \
  -stroke yellow -fill none "${lineas[@]}" \
  -stroke none -fill yellow -pointsize 10 "${textos[@]}" \
  "$salida/$slug-rejilla.png"
echo "$salida/$slug-rejilla.png ($(( ${#rojos[@]} / 2 )) casillas de muro)"
