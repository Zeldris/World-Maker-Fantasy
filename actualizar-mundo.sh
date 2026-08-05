#!/bin/bash
# Refresco completo del contenido de mundo tras una sesión de lore/código: `seed-catalog`
# (ubicaciones/NPCs/items/aristas — rápido, solo Postgres) + `reindex-lore` (fragmentos RAG del
# Narrador — más lento, necesita Ollama arriba para calcular embeddings). Aparte de
# iniciar-tarkor.sh (que ya corre seed-catalog solo, por ser rápido) porque reindex-lore puede
# tardar más de un minuto con muchos fragmentos — no tiene sentido pagar ese coste en cada arranque
# normal, solo cuando de verdad ha cambiado loreChunks.ts o worldCatalog.ts.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DIR/logs"

export PATH="$HOME/.local/ollama/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/ollama/lib/ollama:$LD_LIBRARY_PATH"

echo "Actualizando el mundo de Tarkor (catálogo + lore RAG)..."
echo

# Postgres local (mismo bloque que iniciar-tarkor.sh)
if command -v podman >/dev/null 2>&1 && podman container exists tarkor-postgres 2>/dev/null; then
  if podman ps --format '{{.Names}}' | grep -qx tarkor-postgres; then
    echo "Postgres (tarkor-postgres) ya estaba corriendo."
  else
    echo "Arrancando Postgres (tarkor-postgres)..."
    podman start tarkor-postgres >/dev/null
    sleep 2
  fi
else
  echo "AVISO: no existe el contenedor 'tarkor-postgres' — ver docs/15-instalacion.md § 3bis para crearlo."
fi

export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null 2>&1

# reindex-lore necesita Ollama arriba (embeddings de nomic-embed-text) — igual que
# iniciar-tarkor.sh, se arranca en segundo plano si no estaba ya.
STARTED_OLLAMA=0
if curl -s -o /dev/null http://localhost:11434; then
  echo "Ollama ya estaba corriendo."
else
  echo "Arrancando Ollama en segundo plano para calcular los embeddings..."
  OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 nohup ollama serve > "$DIR/logs/ollama.log" 2>&1 &
  disown
  STARTED_OLLAMA=1
  sleep 3
fi

echo
echo "1/2 — seed-catalog (ubicaciones, NPCs, items, aristas)..."
(cd "$DIR/backend" && npm run seed-catalog)

echo
echo "2/2 — reindex-lore (fragmentos RAG del Narrador — puede tardar según cuántos hayan cambiado)..."
(cd "$DIR/backend" && npm run reindex-lore)

echo
echo "Mundo actualizado."
if [ "$STARTED_OLLAMA" = "1" ]; then
  echo "(Ollama se arrancó solo para esto y se ha dejado corriendo — detener-tarkor.sh también lo para si hace falta.)"
fi
