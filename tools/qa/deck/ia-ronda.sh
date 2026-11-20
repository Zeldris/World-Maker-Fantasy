#!/bin/bash
# QA-313 (retro del 2026-11-11): Ollama real de una ronda local, que se arranca y se para con la ronda.
# La ronda del narrador dejó `ollama serve` (lanzado a mano) 1 h 47 min con el modelo cargado y bajo un
# `systemd-inhibit` que no dejaba suspender la Deck. Por host.sh:
#
#   bash tools/qa/host.sh bash tools/qa/deck/ia-ronda.sh arrancar   # ollama serve con la iGPU, bajo systemd-inhibit
#   bash tools/qa/host.sh bash tools/qa/deck/ia-ronda.sh parar      # el juego (juego.sh --parar) y ese Ollama
#   bash tools/qa/host.sh bash tools/qa/deck/ia-ronda.sh estado     # qué sigue en pie
#
# OLLAMA_IGPU_ENABLE va a mano: `flatpak-spawn --host bash -lc` no lee ~/.bashrc y sin ella Ollama va por CPU.
# Los PID quedan en logs/ia-ronda.pid. INHIBIR=0 lanza sin systemd-inhibit; PARAR_JUEGO cambia la orden que
# para el juego, y COMM_RONDA el nombre de proceso que se acepta como el de la ronda (los tests).
. "$(dirname "$0")/_raiz.sh"
# QA-353: Ollama va en su propio scope de systemd (`systemd-run --user --scope`), para que un OOM del kernel mate
# solo ese scope y no todo `flatpak-session-helper` (juego y Postgres incluidos); sin systemd-run, como antes.
# SCOPE=0 lo desactiva. Con la ronda arranca el vigilante de memoria (`vigilante-memoria.sh`, PID en
# logs/vigilante-memoria.pid), que para la tanda si la memoria disponible se queda baja; `parar` lo para.
PIDS="$RAIZ/logs/ia-ronda.pid"
PIDS_VIGILANTE="$RAIZ/logs/vigilante-memoria.pid"
OLLAMA="${OLLAMA_BIN:-$(command -v ollama || echo "$HOME/ollama-bin/bin/ollama")}"
PARAR_JUEGO="${PARAR_JUEGO:-bash $DECK/juego.sh --parar}"

vivo() { local e; e="$(ps -o stat= -p "$1" 2>/dev/null)"; [ -n "$e" ] && [ "${e:0:1}" != Z ]; }  # un zombi ya paró
# El PID guardado solo vale si sigue siendo el que se lanzó (systemd-inhibit u ollama): tras un reinicio, otro
# proceso puede tener ese número.
nuestro() { vivo "$1" && case "$(ps -o comm= -p "$1" 2>/dev/null)" in systemd-inhibit|ollama|"${COMM_RONDA:-ollama}") return 0 ;; esac; return 1; }
# Prefijo de la orden de Ollama: scope (si hay systemd-run) y systemd-inhibit (salvo INHIBIR=0), uno por línea.
lanzador() {
  if [ "${SCOPE:-1}" = 1 ] && command -v systemd-run > /dev/null; then
    # Sin bus de usuario (flatpak-spawn --host sin DBUS/XDG_RUNTIME_DIR) el scope falla: se prueba antes.
    if systemd-run --user --scope --quiet true > /dev/null 2>&1; then
      printf '%s\n' systemd-run --user --scope --quiet --unit="wmf-ollama-ronda-$$"
    else
      echo "Aviso: systemd-run --user no funciona (¿sin bus de usuario?); Ollama se lanza sin scope." >&2
    fi
  fi
  if [ "${INHIBIR:-1}" = 1 ]; then
    printf '%s\n' systemd-inhibit --what=sleep:idle --mode=block --who=wmf-ronda --why="ronda local"
  fi
}
vigilante_vivo() { [ -f "$PIDS_VIGILANTE" ] && vivo "$(cat "$PIDS_VIGILANTE")"; }
arrancar_vigilante() {
  [ "${VIGILANTE:-1}" = 1 ] || return 0
  vigilante_vivo && return 0
  mkdir -p "$RAIZ/logs"
  nohup bash "$DECK/vigilante-memoria.sh" >> "$RAIZ/logs/vigilante-memoria.log" 2>&1 < /dev/null &
  echo $! > "$PIDS_VIGILANTE"
}
PUERTO_OLLAMA="${PUERTO_OLLAMA:-11434}"
escucha() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

estado() {
  local algo=0 p
  for p in "$PUERTO_OLLAMA" 3001 5173 9333; do
    if escucha "$p"; then echo "En pie: :$p"; algo=1; fi
  done
  if [ -f "$PIDS" ] && nuestro "$(cat "$PIDS")"; then echo "En pie: Ollama de la ronda (PID $(cat "$PIDS"))"; algo=1; fi
  if vigilante_vivo; then echo "En pie: vigilante de memoria (PID $(cat "$PIDS_VIGILANTE"))"; algo=1
  elif [ "${VIGILANTE:-1}" = 1 ] && escucha "$PUERTO_OLLAMA"; then echo "FALTA el vigilante de memoria con Ollama en pie: ia-ronda.sh arrancar lo vuelve a armar."; fi
  if command -v systemd-inhibit > /dev/null && systemd-inhibit --list 2>/dev/null | grep -q wmf-ronda; then
    echo "En pie: inhibidor de suspensión «wmf-ronda»"; algo=1
  fi
  [ "$algo" = 0 ] && echo "Nada en pie (Ollama, juego, driver ni inhibidor)."
  return 0
}

case "${1:-}" in
  arrancar)
    if escucha "$PUERTO_OLLAMA"; then
      # El Ollama simulado (`mock-ollama.mjs` de una tanda sin IA) también escucha ahí: la ronda iría contra él.
      if pgrep -u "$(id -u)" -x ollama > /dev/null; then arrancar_vigilante; echo "Ollama ya escucha en :$PUERTO_OLLAMA; no se lanza otro."; exit 0; fi
      echo ":11434 está ocupado y no es Ollama (¿el simulado?): bash tools/qa/deck/juego.sh --parar y repite."; exit 1
    fi
    mkdir -p "$RAIZ/logs"
    # QA-502: el registro de la ronda anterior (con el «cached n_tokens» de cada llamada) se perdía al relanzar: se
    # guarda con la hora en que se apartó, y el nuevo empieza limpio (la comprobación de la iGPU mira solo este).
    [ -s "$RAIZ/logs/ollama.log" ] && mv "$RAIZ/logs/ollama.log" "$RAIZ/logs/ollama-$(date +%Y%m%d-%H%M%S).log"
    mapfile -t pre < <(lanzador)
    OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 \
      nohup "${pre[@]}" "$OLLAMA" serve > "$RAIZ/logs/ollama.log" 2>&1 < /dev/null &
    echo $! > "$PIDS"
    for _ in $(seq 1 30); do escucha "$PUERTO_OLLAMA" && break; sleep 1; done
    escucha "$PUERTO_OLLAMA" || { echo "Ollama no responde en 30 s: mira logs/ollama.log"; exit 1; }
    . "$RAIZ/tools/playwright-e2e/ia-comprobaciones.sh"
    sleep 2  # «dropping integrated GPU» sale al detectar la GPU, justo tras abrir el puerto
    ia_comprobar_log_gpu "$RAIZ/logs/ollama.log" || exit 1
    arrancar_vigilante
    echo "Ollama en :11434 (PID $(cat "$PIDS")). Al acabar la ronda: ia-ronda.sh parar"
    ;;
  parar)
    # El vigilante primero: si no, vería caer la memoria al parar y volvería a parar la tanda. Un PID muerto no estorba.
    if [ -f "$PIDS_VIGILANTE" ]; then
      vig="$(cat "$PIDS_VIGILANTE")"
      # Si lo llama el propio vigilante (DESDE_VIGILANTE), no se mata a sí mismo: acaba solo tras parar.
      if [ -z "${DESDE_VIGILANTE:-}" ] && vivo "$vig" && [ "$(ps -o args= -p "$vig" 2>/dev/null | grep -c vigilante-memoria)" = 1 ]; then
        kill "$vig" 2>/dev/null
      fi
      rm -f "$PIDS_VIGILANTE"
    fi
    $PARAR_JUEGO || echo "Aviso: no se pudo parar el juego ($PARAR_JUEGO)."
    if [ -f "$PIDS" ]; then
      pid="$(cat "$PIDS")"
      if nuestro "$pid"; then
        hijos="$(pgrep -P "$pid" 2>/dev/null | tr '\n' ' ')"
        # shellcheck disable=SC2086
        kill $hijos "$pid" 2>/dev/null
        for _ in $(seq 1 "${ESPERA_PARAR:-15}"); do vivo "$pid" || break; sleep 1; done
        # shellcheck disable=SC2086
        vivo "$pid" && kill -9 $hijos "$pid" 2>/dev/null && sleep 1
        if vivo "$pid"; then estado; echo "El Ollama de la ronda (PID $pid) no se para; se deja $PIDS."; exit 1; fi
      else
        echo "logs/ia-ronda.pid apunta a $pid, que ya no es el Ollama de la ronda; no se toca."
      fi
      rm -f "$PIDS"
    fi
    estado
    ;;
  estado) estado ;;
  lanzador) lanzador ;;
  *) echo "uso: ia-ronda.sh arrancar|parar|estado"; exit 2 ;;
esac
