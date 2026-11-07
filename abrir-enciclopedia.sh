#!/bin/bash
# IMG-50 (usuaria, 2026-11-07): abre solo la enciclopedia de juego, lo más ligero posible, para verla y pedir
# prompts de imagen al modelo local de OpenCode. Postgres, el backend con TARKOR_SOLO_ENCICLOPEDIA=1 (sin el
# worker de ticks ni el precalentamiento del narrador) y el frontend en /admin/enciclopedia.
# Ollama queda como servicio en reposo, sin ningún modelo en memoria: cada prompt de la cola carga el modelo y lo
# descarga al acabar (keepAlive 0). Sin seeds ni migraciones: para eso, iniciar-tarkor.sh.
# Cada proceso, en su propia ventana y en primer plano: en la Deck, `nohup` en segundo plano muere sola
# (ver la cabecera de iniciar-tarkor.sh). Para pararlo, detener-tarkor.sh.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$DIR/logs"
mkdir -p "$LOGS"
export PATH="$HOME/.local/ollama/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/ollama/lib/ollama:$LD_LIBRARY_PATH"
NVM_INIT='NODE_BIN="$(ls -d "$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node"/v22*/bin 2>/dev/null | sort -V | tail -1)"; [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH";'
eval "$NVM_INIT"

echo "Abriendo la enciclopedia de Tarkor (modo ligero)..."

if command -v podman >/dev/null 2>&1 && podman container exists tarkor-postgres 2>/dev/null; then
  podman ps --format '{{.Names}}' | grep -qx tarkor-postgres || podman start tarkor-postgres >/dev/null
  for _ in $(seq 1 20); do
    podman exec tarkor-postgres pg_isready -q >/dev/null 2>&1 && break
    sleep 1
  done
else
  echo "AVISO: no existe el contenedor 'tarkor-postgres' (docs/arquitectura/15-instalacion.md § 3bis)."
fi

TERMINAL=""
for candidate in konsole xterm gnome-terminal xfce4-terminal; do
  command -v "$candidate" >/dev/null 2>&1 && { TERMINAL="$candidate"; break; }
done

run_in_new_window() {
  local title="$1" cmd="$2"
  case "$TERMINAL" in
    konsole) nohup konsole -p tabtitle="$title" -e bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    xterm) nohup xterm -T "$title" -e bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    gnome-terminal) nohup gnome-terminal --title="$title" -- bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    xfce4-terminal) nohup xfce4-terminal --title="$title" -e "bash -c '$cmd; exec bash'" >/dev/null 2>&1 & disown ;;
    *) bash -c "$cmd" > "$LOGS/$(echo "$title" | tr ' ' '-').log" 2>&1 & disown ;;
  esac
}

if ! curl -s -o /dev/null http://localhost:11434; then
  echo "Ollama, en reposo (sin modelo cargado)..."
  run_in_new_window "Tarkor - Ollama" "OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve"
fi
run_in_new_window "Tarkor - Backend (enciclopedia)" "$NVM_INIT cd '$DIR/backend' && TARKOR_SOLO_ENCICLOPEDIA=1 npm run dev:nowatch"
run_in_new_window "Tarkor - Frontend" "$NVM_INIT cd '$DIR/frontend' && npm run dev"

URL="http://localhost:5173/admin/enciclopedia"
for _ in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:3001/health && curl -s -o /dev/null http://localhost:5173 && break
  sleep 1
done
command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 || true
echo
echo "Enciclopedia: $URL"
echo "Para pararlo, detener-tarkor.sh"
read -r -p "Pulsa Enter para cerrar esta ventana... "
