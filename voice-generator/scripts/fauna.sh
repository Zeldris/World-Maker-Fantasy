#!/bin/bash
# VOZ-5 (doc 02, «Fauna y criaturas»): sonidos de una especie a partir de sonidos base CC0 o grabaciones propias,
# con su cadena de efectos (siempre la misma, para que la especie suene reconocible) y unas variantes al azar.
# Uso: fauna.sh <especie> [variantes=3]
# Datos en git: fauna/<especie>/cadena.json (mismo formato que efectos.json) y fauna/<especie>/licencias.tsv
# (archivo, acción: ataque|herida|muerte|ambiente, fuente, licencia, autor). Los sonidos base, fuera de git, en
# sonidos/fauna/<especie>/<archivo>. Un sonido sin fila en licencias.tsv, o con licencia que no sea CC0 ni propia,
# no se usa. Deja generated/fauna/<especie>/<acción>-<base>-v<n>.wav (tono ±1 semitono y tempo ±5 %, semilla n).
# Todo en desarrollo: nada de esto corre en la máquina del jugador.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
[ $# -ge 1 ] || { sed -n 4p "$0"; exit 2; }
E=$1; NV=${2:-3}
[[ $E =~ ^[a-z0-9-]+$ ]] || { echo "ABORTO: «$E» no es un slug de especie"; exit 2; }
[[ $NV =~ ^[0-9]+$ ]] || { echo "ABORTO: variantes no numérico: $NV"; exit 2; }
command -v sox > /dev/null || { echo "ABORTO: falta sox"; exit 3; }
F=$G/fauna/$E; S=$G/sonidos/fauna/$E; D=$G/generated/fauna/$E
for f in "$F/cadena.json" "$F/licencias.tsv"; do [ -f "$f" ] || { echo "ABORTO: falta $f (copia fauna/_plantilla/)"; exit 3; }; done
# Con <(…) el fallo de voces.py se perdería: primero la salida y luego el array.
SOX=$(python3 "$G/scripts/voces.py" sox "$F/cadena.json") || exit 3; ARGS=(); [ -n "$SOX" ] && mapfile -t ARGS <<< "$SOX"
mkdir -p "$D"; n=0
while IFS=$'\t' read -r archivo accion fuente licencia autor; do
  [ "$archivo" = archivo ] || [ -z "$archivo" ] && continue
  case $accion in ataque|herida|muerte|ambiente) ;; *) echo "se salta $archivo: acción «$accion»"; continue ;; esac
  case ${licencia,,} in cc0|propia) ;; *) echo "se salta $archivo: licencia «$licencia» (solo CC0 o propia)"; continue ;; esac
  [ -s "$S/$archivo" ] || { echo "se salta $archivo: no está en $S/"; continue; }
  for v in $(seq "$NV"); do
    # Variación reproducible: la semilla es el número de variante.
    read -r cent tempo <<< "$(awk -v s="$v" 'BEGIN { srand(s); printf "%d %.3f", int(rand() * 200 - 100), 0.95 + rand() * 0.1 }')"
    OUT=$D/$accion-${archivo%.*}-v$v.wav
    sox "$S/$archivo" -c 1 "$OUT" "${ARGS[@]}" pitch "$cent" tempo "$tempo" && n=$((n + 1)) || echo "sox falló con $archivo"
  done
done < "$F/licencias.tsv"
echo "$n sonidos en $D/"
