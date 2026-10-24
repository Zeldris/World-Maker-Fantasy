#!/bin/bash
# CFG-43: abre la interfaz del generador de imágenes (interfaz/servidor.py) en http://127.0.0.1:7861/.
# Uso, desde la Konsole de la Deck: image-generator/abrir.sh   (Ctrl+C la para; IMG_PUERTO=… cambia el puerto)
# Necesita tarkor-postgres arrancado para traer prompts de la enciclopedia; generar no necesita el juego.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")" && pwd)
PUERTO=${IMG_PUERTO:-7861}
fuser -k "$PUERTO/tcp" > /dev/null 2>&1 || true   # una interfaz anterior que quedara abierta
podman start tarkor-postgres > /dev/null 2>&1 || echo "AVISO: no arranca tarkor-postgres; podrás pegar prompts, pero no traerlos de la enciclopedia."
( sleep 1; xdg-open "http://127.0.0.1:$PUERTO/" > /dev/null 2>&1 ) &
IMG_PUERTO=$PUERTO exec python3 "$G/interfaz/servidor.py"
