#!/bin/bash
# QA-311 (2026-11-11): devuelve solo una sección `## …` de un Markdown, sin leer el archivo entero.
# La sesión que reparte una ronda leyó `rondas-de-pruebas.md` 7 veces (430k tokens arrastrados) aunque `QA-209`
# le pide solo «Qué se prueba».
#
#   seccion.sh <archivo.md> "<comienzo del título>"
#
# Saca desde el `## ` cuyo título empieza por ese texto hasta el siguiente `## ` (los `###` van dentro).
set -euo pipefail
archivo="${1:?falta el archivo}"; titulo="${2:?falta el título de la sección}"
[ -f "$archivo" ] || { echo "No existe $archivo" >&2; exit 1; }
salida=$(awk -v t="## $titulo" '
  /^[ \t]*```/ { codigo = !codigo }
  !codigo && /^## / { if (dentro) exit; if (index($0, t) == 1) dentro = 1 }
  dentro { print }
' "$archivo")
if [ -z "$salida" ]; then
  echo "Sin sección «$titulo» en $archivo. Las que hay:" >&2
  grep '^## ' "$archivo" >&2
  exit 1
fi
printf '%s\n' "$salida"
