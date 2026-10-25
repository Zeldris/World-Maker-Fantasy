#!/bin/bash
# IMG-15: banco de calidad por rondas. Cada ronda es un TSV en banco/ con una prueba por fila:
#   nombre <TAB> pasos <TAB> prompt (archivo, relativo a banco/) <TAB> variables (K=V,K=V o -) <TAB> args de sd-cli (o -)
# Las variables van a generar.sh (MODELO, LLM, VAE, CFG, TOPE); W y H, a probar.sh. Las líneas con # se saltan.
# Uso: bash docs/producto/plan-imagenes/banco.sh <ronda> [semilla=3]
# Cada imagen queda en image-generator/generated/banco/<ronda>-<nombre>/intentos/ (probar.sh); el resumen, en la salida.
set -eu
R=$(cd "$(dirname "$0")/../../.." && pwd); B=$R/docs/producto/plan-imagenes/banco
RONDA=$1; SEED=${2:-3}; TSV=$B/$RONDA.tsv
[ -s "$TSV" ] || { echo "ABORTO: no existe $TSV"; exit 2; }
export LIBERAR_OLLAMA=1
while IFS=$'\t' read -r nombre pasos prompt vars extra; do
  [[ -z $nombre || $nombre == \#* ]] && continue
  [ -s "$B/$prompt" ] || { echo "ABORTO: $nombre: no existe $B/$prompt"; exit 2; }
  env_=(); [ "$vars" != - ] && IFS=, read -r -a env_ <<< "$vars"
  args=(); [ "$extra" != - ] && read -r -a args <<< "${extra//\$G/$R/image-generator}"
  echo "== $RONDA-$nombre ($pasos pasos) ${vars} ${extra}"
  env "${env_[@]}" PROMPT_ARCHIVO="$B/$prompt" bash "$R/image-generator/scripts/probar.sh" banco "$RONDA-$nombre" banner \
    "$SEED" "$pasos" "${args[@]}" < /dev/null | tail -2 || echo "FALLO: $nombre"
done < "$TSV"
echo "Hecho: $RONDA"
