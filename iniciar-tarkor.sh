#!/bin/bash
# Equivalente a iniciar-tarkor.bat, para SteamOS/Linux.
#
# Por qué ventanas de terminal y no segundo plano (2026-07-24, bug real): la primera versión
# lanzaba backend/frontend con `nohup ... & disown` en segundo plano, dentro de este mismo
# script — se comprobó en vivo que eso NO sobrevive de forma fiable en este escritorio (moría
# a los pocos segundos, con o sin este script de por medio, tanto lanzado desde una sesión de
# Claude Code como desde una terminal normal del usuario; no es systemd-oomd, journalctl no
# mostraba ningún kill). En cambio, un `npm run dev` en PRIMER PLANO en su propia terminal sí
# se mantuvo vivo sin problema. Así que ahora cada proceso vive en su propia ventana de
# terminal, en primer plano — el mismo principio que el .bat de Windows (`start cmd /k`), solo
# que aquí hay que detectar qué emulador de terminal existe.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS="$DIR/logs"
mkdir -p "$LOGS"

export PATH="$HOME/.local/ollama/bin:$PATH"
export LD_LIBRARY_PATH="$HOME/.local/ollama/lib/ollama:$LD_LIBRARY_PATH"

echo "Arrancando Tarkor..."
echo

# Postgres local (migración local-first 2026-07-30, ver docs/arquitectura/15-instalacion.md § 3bis) — contenedor
# podman ya creado una vez, aquí solo se arranca si estaba parado. Silencioso si ya estaba arriba.
if command -v podman >/dev/null 2>&1 && podman container exists tarkor-postgres 2>/dev/null; then
  if podman ps --format '{{.Names}}' | grep -qx tarkor-postgres; then
    echo "Postgres (tarkor-postgres) ya estaba corriendo."
  else
    echo "Arrancando Postgres (tarkor-postgres)..."
    podman start tarkor-postgres >/dev/null
  fi
else
  echo "AVISO: no existe el contenedor 'tarkor-postgres' — ver docs/arquitectura/15-instalacion.md § 3bis para crearlo."
fi

# Carga nvm/node en ESTE shell — para el check de Ollama de abajo y para el seed-catalog que
# sigue (cada ventana nueva de backend/frontend se monta la suya propia, ver NVM_INIT).
# Sin cargar nvm.sh (2026-09-29, bug real: con `prefix=` en ~/.npmrc, `. nvm.sh` devuelve error y
# `set -e` cortaba el script en seco tras el aviso de nvm). Se pone en el PATH el node 22 más
# reciente que nvm tenga instalado; no hace falta nada más de nvm.
NVM_INIT='NODE_BIN="$(ls -d "$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node"/v22*/bin 2>/dev/null | sort -V | tail -1)"; [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH";'
eval "$NVM_INIT"

# Seed del catálogo (2026-08-05, bug real: se cambió worldCatalog.ts en varias sesiones de lore y
# nadie corrió `npm run seed-catalog` a mano — las zonas nuevas no aparecían en el mapa pese a
# estar bien en el código). Idempotente vía upsert por @@unique (ver cabecera de worldCatalog.ts),
# así que correrlo en cada arranque es seguro y rápido (solo upserts a Postgres, sin LLM de por
# medio) — mejor pagar ese segundo de más siempre que arriesgarse a jugar con el catálogo
# desincronizado otra vez. No aborta el arranque si falla (por si Postgres tarda en estar listo);
# solo avisa.
# Migraciones pendientes (2026-09-29): tras un pull con migraciones nuevas, el backend arrancaba con
# la BD desfasada. `migrate deploy` solo aplica las que falten; nunca reescribe las aplicadas.
echo "Aplicando migraciones pendientes (prisma migrate deploy)..."
(cd "$DIR/backend" && npx prisma migrate deploy) || echo "AVISO: prisma migrate deploy falló — revisa que Postgres esté arriba."
echo

echo "Sincronizando catálogo del mundo (seed-catalog)..."
(cd "$DIR/backend" && npm run seed-catalog) || echo "AVISO: seed-catalog falló — el mapa/catálogo puede no estar al día. Revisa que Postgres esté arriba y corre 'npm run seed-catalog' a mano en backend/."
echo

TERMINAL=""
for candidate in konsole xterm gnome-terminal xfce4-terminal; do
  if command -v "$candidate" >/dev/null 2>&1; then
    TERMINAL="$candidate"
    break
  fi
done

# Abre "$2" en una ventana de terminal nueva, con "exec bash" al final para que la ventana se
# quede abierta (viendo el error) si el comando termina o falla, en vez de cerrarse sola.
run_in_new_window() {
  local title="$1" cmd="$2"
  case "$TERMINAL" in
    konsole) nohup konsole -p tabtitle="$title" -e bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    xterm) nohup xterm -T "$title" -e bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    gnome-terminal) nohup gnome-terminal --title="$title" -- bash -c "$cmd; exec bash" >/dev/null 2>&1 & disown ;;
    xfce4-terminal) nohup xfce4-terminal --title="$title" -e "bash -c '$cmd; exec bash'" >/dev/null 2>&1 & disown ;;
  esac
}

if curl -s -o /dev/null http://localhost:11434; then
  echo "Ollama ya estaba corriendo."
elif [ -n "$TERMINAL" ]; then
  echo "Abriendo Ollama en una ventana nueva ($TERMINAL)..."
  run_in_new_window "Tarkor - Ollama" "OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve"
  sleep 3
else
  echo "Arrancando Ollama en segundo plano (no se encontró terminal gráfica)..."
  OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 nohup ollama serve > "$LOGS/ollama.log" 2>&1 &
  disown
  sleep 3
fi

if [ -n "$TERMINAL" ]; then
  echo "Abriendo backend y frontend en ventanas nuevas ($TERMINAL)..."
  run_in_new_window "Tarkor - Backend" "$NVM_INIT cd '$DIR/backend' && npm run dev:nowatch"
  sleep 1
  run_in_new_window "Tarkor - Frontend" "$NVM_INIT cd '$DIR/frontend' && npm run dev"
else
  echo "No se encontró konsole/xterm/gnome-terminal/xfce4-terminal — arrancando en segundo"
  echo "plano en su lugar (menos fiable: puede morir sola, ver logs/ si localhost no responde)."
  cd "$DIR/backend"
  nohup npm run dev:nowatch > "$LOGS/backend.log" 2>&1 &
  disown
  cd "$DIR/frontend"
  nohup npm run dev > "$LOGS/frontend.log" 2>&1 &
  disown
fi

sleep 2
echo
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo
echo "Deja las ventanas nuevas abiertas mientras juegas — cerrarlas para la partida."
echo "Para pararlo todo, usa detener-tarkor.sh"

# Sin esta pausa, si el script se lanza con doble clic (o cualquier lanzador que cierre la
# ventana en cuanto el comando termina), esta ventana desaparece antes de poder leer si Postgres
# y Ollama arrancaron bien — a diferencia de backend/frontend, que sí se quedan abiertos porque
# corren en SUS PROPIAS ventanas con `exec bash` al final. Bug real (2026-08-13): parecía que el
# script "solo levantaba backend y frontend" cuando en realidad Postgres/Ollama sí arrancaban,
# solo que la confirmación desaparecía con la ventana.
read -r -p "Pulsa Enter para cerrar esta ventana... "
