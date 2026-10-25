#!/bin/bash
# Demo de FLUX.2 klein 4B en la Deck con prompts reales del juego (tabla ImagePrompt).
# Obsoleto (2026-10-24): repite el cierre que ya trae el prompt y no lee el prompt usado; usar ../probar.sh.
# Uso: demo.sh <tipo> <slug> <perfil> <ancho> <alto>
# Saca el prompt de la base y llama a generar.sh (que lleva las protecciones de memoria); salida en pruebas/demo/.
# sin pipefail: obsoleto (sustituido por ../probar.sh); se guarda como estaba
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # image-generator/
T=$1; S=$2; P=$3; W=$4; H=$5; N="demo-$T-$S-$P-${W}x$H"
SQL="select prompt from \"ImagePrompt\" where \"entityType\"='$T' and \"entitySlug\"='$S' and \"sizeProfile\"='$P';"
PROMPT=$(podman exec -i tarkor-postgres psql -U tarkor -d tarkor -At -c "$SQL")
[ -n "$PROMPT" ] || { echo "ABORTO: sin prompt para $T/$S/$P"; exit 3; }
PF=$(mktemp); trap 'rm -f "$PF"' EXIT
echo "$PROMPT No text, no signature, no watermark." > "$PF"
"$G/scripts/generar.sh" demo "$N" "$PF" "$W" "$H"
