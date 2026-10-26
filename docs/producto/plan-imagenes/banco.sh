#!/bin/bash
# IMG-15: banco de calidad por rondas. Cada ronda es un TSV en banco/ con una prueba por fila:
#   nombre <TAB> pasos <TAB> prompt (archivo, relativo a banco/) <TAB> variables (K=V,K=V o -) <TAB> args de sd-cli (o -)
# Las variables van a generar.sh (MODELO, LLM, VAE, CFG, TOPE); W y H, a probar.sh. Las líneas con # se saltan.
# Uso: bash docs/producto/plan-imagenes/banco.sh <ronda> [semilla=3]
# Cada imagen queda en image-generator/generated/banco/<ronda>-<nombre>/intentos/ (probar.sh); el resumen, en la salida.
# Una prueba que ya tiene imagen con esa semilla se salta (relanzar la ronda hace solo lo que falta). Antes de cada una, espera hasta
# ESPERA s (1800) a tener LIBRE MB (7200): generar.sh aborta por debajo de 7000 y en la Deck hay más sesiones abiertas.
# Con LIBERAR_OLLAMA=0 espera también a que Ollama esté vacío, en vez de descargar el modelo de otra sesión.
set -euo pipefail  # sin pipefail, «probar.sh … | tail -2 || echo FALLO» nunca diría FALLO
R=$(cd "$(dirname "$0")/../../.." && pwd); B=$R/docs/producto/plan-imagenes/banco
RONDA=$1; SEED=${2:-3}; TSV=$B/$RONDA.tsv
[ -s "$TSV" ] || { echo "ABORTO: no existe $TSV"; exit 2; }
export LIBERAR_OLLAMA=${LIBERAR_OLLAMA:-1}
libre() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
lista() {  # memoria suficiente y, si no se libera Ollama, Ollama vacío
  [ "$(libre)" -ge "${LIBRE:-7200}" ] || return 1
  [ "$LIBERAR_OLLAMA" = 1 ] || ! curl -s --max-time 5 localhost:11434/api/ps | grep -q '"size": *[1-9]'
}
while IFS=$'\t' read -r nombre pasos prompt vars extra; do
  [[ -z $nombre || $nombre == \#* ]] && continue
  [ -s "$B/$prompt" ] || { echo "ABORTO: $nombre: no existe $B/$prompt"; exit 2; }
  env_=(); [ "$vars" != - ] && IFS=, read -r -a env_ <<< "$vars"
  args=(); [ "$extra" != - ] && read -r -a args <<< "${extra//\$G/$R/image-generator}"
  if compgen -G "$R/image-generator/generated/banco/$RONDA-$nombre/intentos/*-s$SEED-p$pasos-*.png" > /dev/null; then
    echo "== $RONDA-$nombre: ya tiene imagen, se salta"; continue
  fi
  fin=$(( $(date +%s) + ${ESPERA:-1800} )); vueltas=0
  until lista || [ "$(date +%s)" -gt $fin ]; do  # cada 5 min, una línea: la ronda 7 se quedó parada sin decir nada (QA-255)
    (( ++vueltas % 15 )) || echo "   esperando memoria: $(libre) MB libres, pide ${LIBRE:-7200} (se baja con LIBRE=, y MIN_INICIO_MB= para generar.sh)"
    sleep 20
  done
  echo "== $RONDA-$nombre ($pasos pasos) ${vars} ${extra}"
  env "${env_[@]}" PROMPT_ARCHIVO="$B/$prompt" bash "$R/image-generator/scripts/probar.sh" banco "$RONDA-$nombre" banner \
    "$SEED" "$pasos" "${args[@]}" < /dev/null | tail -2 || echo "FALLO: $nombre"
done < "$TSV"
echo "Hecho: $RONDA"
