#!/bin/bash
# CFG-43: abre la interfaz del generador de imágenes (interfaz/servidor.py) en http://127.0.0.1:7861/.
# Uso, desde la Konsole de la Deck: image-generator/abrir.sh   (Ctrl+C la para; IMG_PUERTO=… cambia el puerto)
# Necesita tarkor-postgres arrancado para traer prompts de la enciclopedia; generar no necesita el juego.
set -euo pipefail
G=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
PUERTO=${IMG_PUERTO:-7861}
# Una interfaz anterior que quedara abierta se cierra; si el puerto es de otra cosa, o hay un sd-cli generando
# (pararlo dejaría la imagen a medias y otra a la vez bloquea la Deck), no se toca nada.
if pgrep -x sd-cli > /dev/null; then echo "ABORTO: hay un sd-cli generando; espera a que acabe (o pkill -x sd-cli)."; exit 1; fi
for pid in $(fuser "$PUERTO/tcp" 2>/dev/null); do
  grep -qa 'interfaz/servidor.py' "/proc/$pid/cmdline" 2>/dev/null \
    || { echo "ABORTO: el puerto $PUERTO lo usa otro programa (pid $pid); elige otro con IMG_PUERTO=<puerto>."; exit 1; }
  kill "$pid" || true   # puede haber acabado entre fuser y kill
done
podman start tarkor-postgres > /dev/null 2>&1 || echo "AVISO: no arranca tarkor-postgres; podrás pegar prompts, pero no traerlos de la enciclopedia."
# Las imágenes del juego, de referencia: copia las que falten y las que el juego tenga más nuevas.
mkdir -p "$G/referencias/images"
cp -ru "$G/../backend/uploads/images/." "$G/referencias/images/" 2>/dev/null || true   # sin imágenes del juego aún, no pasa nada
find "$G/referencias/images" -name .gitkeep -delete
( sleep 1; xdg-open "http://127.0.0.1:$PUERTO/" > /dev/null 2>&1 ) &
IMG_PUERTO=$PUERTO exec python3 "$G/interfaz/servidor.py"
