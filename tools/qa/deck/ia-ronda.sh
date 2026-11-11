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
# para el juego (los tests la cambian por `true`).
. "$(dirname "$0")/_raiz.sh"
PIDS="$RAIZ/logs/ia-ronda.pid"
OLLAMA="${OLLAMA_BIN:-$(command -v ollama || echo "$HOME/ollama-bin/bin/ollama")}"
PARAR_JUEGO="${PARAR_JUEGO:-bash $DECK/juego.sh --parar}"

vivo() { local e; e="$(ps -o stat= -p "$1" 2>/dev/null)"; [ -n "$e" ] && [ "${e:0:1}" != Z ]; }  # un zombi ya paró
escucha() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

estado() {
  local algo=0 p
  for p in 11434 3001 5173 9333; do
    if escucha "$p"; then echo "En pie: :$p"; algo=1; fi
  done
  if [ -f "$PIDS" ] && vivo "$(cat "$PIDS")"; then echo "En pie: Ollama de la ronda (PID $(cat "$PIDS"))"; algo=1; fi
  if command -v systemd-inhibit > /dev/null && systemd-inhibit --list 2>/dev/null | grep -q wmf-ronda; then
    echo "En pie: inhibidor de suspensión «wmf-ronda»"; algo=1
  fi
  [ "$algo" = 0 ] && echo "Nada en pie (Ollama, juego, driver ni inhibidor)."
  return 0
}

case "${1:-}" in
  arrancar)
    if escucha 11434; then echo "Ollama ya escucha en :11434; no se lanza otro."; exit 0; fi
    mkdir -p "$RAIZ/logs"
    pre=()
    [ "${INHIBIR:-1}" = 1 ] && pre=(systemd-inhibit --what=sleep:idle --mode=block --who=wmf-ronda --why="ronda local")
    OLLAMA_IGPU_ENABLE=1 OLLAMA_FLASH_ATTENTION=1 OLLAMA_KV_CACHE_TYPE=q8_0 \
      setsid nohup "${pre[@]}" "$OLLAMA" serve > "$RAIZ/logs/ollama.log" 2>&1 < /dev/null &
    echo $! > "$PIDS"
    for _ in $(seq 1 30); do escucha 11434 && break; sleep 1; done
    escucha 11434 || { echo "Ollama no responde en 30 s: mira logs/ollama.log"; exit 1; }
    grep -q "library=cpu" "$RAIZ/logs/ollama.log" && echo "Aviso: Ollama va por CPU (logs/ollama.log)."
    echo "Ollama en :11434 (PID $(cat "$PIDS")). Al acabar la ronda: ia-ronda.sh parar"
    ;;
  parar)
    $PARAR_JUEGO || echo "Aviso: no se pudo parar el juego ($PARAR_JUEGO)."
    if [ -f "$PIDS" ]; then
      pid="$(cat "$PIDS")"
      hijos="$(pgrep -P "$pid" 2>/dev/null | tr '\n' ' ')"
      # shellcheck disable=SC2086
      kill $hijos "$pid" 2>/dev/null
      for _ in $(seq 1 10); do vivo "$pid" || break; sleep 1; done
      rm -f "$PIDS"
    fi
    estado
    ;;
  estado) estado ;;
  *) echo "uso: ia-ronda.sh arrancar|parar|estado"; exit 2 ;;
esac
