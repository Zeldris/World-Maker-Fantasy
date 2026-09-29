#!/bin/bash
# Genera pares DPO sintéticos (nube vs. modelo local) para el fine-tuning de la v2 del narrador —
# ver docs/ia/fine-tuning-ia-local.md § "Generar pares adicionales sin jugar". Reutiliza el banco de
# ~80 escenarios de distillationScenarios.ts, pidiendo la misma narración a un proveedor cloud y al
# modelo local real (narrateAction), y guarda ambas en LiveTeacherCapture — mismo destino que la
# captura en vivo, así export-dpo-dataset las recoge sin distinción. Reanudable: si se corta a
# mitad (cuota de un proveedor agotada, etc.), volver a lanzarlo salta lo ya generado.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$DIR/logs"

export PATH="$HOME/.local/ollama/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/ollama/lib/ollama:$LD_LIBRARY_PATH"

echo "Generando dataset DPO sintético para Tarkor..."
echo

# Postgres local (mismo bloque que iniciar-tarkor.sh/actualizar-mundo.sh) — hace falta para
# escribir en LiveTeacherCapture.
if command -v podman >/dev/null 2>&1 && podman container exists tarkor-postgres 2>/dev/null; then
  if podman ps --format '{{.Names}}' | grep -qx tarkor-postgres; then
    echo "Postgres (tarkor-postgres) ya estaba corriendo."
  else
    echo "Arrancando Postgres (tarkor-postgres)..."
    podman start tarkor-postgres >/dev/null
    sleep 2
  fi
else
  echo "AVISO: no existe el contenedor 'tarkor-postgres' — ver docs/arquitectura/15-instalacion.md § 3bis para crearlo."
fi

# Sin cargar nvm.sh: con `prefix=` en ~/.npmrc devuelve error y `set -e` cortaría el script.
NODE_BIN="$(ls -d "$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node"/v22*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"

# Hace falta Ollama arriba — la mitad "local" de cada par sale de narrateAction, una llamada real
# al modelo narrador de producción (tarkor-narrador por defecto, OLLAMA_MODEL_NARRADOR en .env).
STARTED_OLLAMA=0
if curl -s -o /dev/null http://localhost:11434; then
  echo "Ollama ya estaba corriendo."
else
  echo "Arrancando Ollama en segundo plano (hace falta para narrar la mitad local de cada par)..."
  OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 nohup ollama serve > "$DIR/logs/ollama.log" 2>&1 &
  disown
  STARTED_OLLAMA=1
  sleep 3
fi

echo
echo "Generando pares (puede tardar bastante — un escenario por vez, con narración local real de por medio)..."
echo "Categoría/límite opcionales: ./generar-dataset-dpo.sh -- --category=combate --limit=20"
echo
(cd "$DIR/backend" && npm run generate-dpo-dataset -- "$@")

echo
echo "Listo. Para volcar TODO lo acumulado (esto + captura en vivo mientras juegas) a un .jsonl"
echo "consumible por el entrenamiento, dentro de backend/:"
echo "  npm run export-dpo-dataset"
if [ "$STARTED_OLLAMA" = "1" ]; then
  echo
  echo "(Ollama se arrancó solo para esto y se ha dejado corriendo — detener-tarkor.sh también lo para si hace falta.)"
fi
