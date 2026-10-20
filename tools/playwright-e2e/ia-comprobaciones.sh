#!/bin/bash
# QA-141 (retro del 2026-10-20): funciones de `arrancar-juego.sh` para el modo con IA real (`IA_PERFIL`).
# Aparte del script para poder probarlas con un log falso (tools/qa/tests/test_ia_comprobaciones.py).

# Ruta absoluta de IA_REGISTRO: el servidor corre en `backend/`, y una ruta relativa escribe en otro sitio.
# Uso: ia_registro_absoluto <raiz-del-repo> <ruta>
ia_registro_absoluto() {
  case "$2" in
    /*) printf '%s\n' "$2" ;;
    *) printf '%s/%s\n' "${1%/}" "${2#./}" ;;
  esac
}

# Tamaño actual del log (0 si no existe): se guarda al empezar para mirar luego solo lo escrito en esta sesión.
ia_tamano_log() {
  stat -c %s "$1" 2>/dev/null || echo 0
}

# Devuelve 1 con mensaje si en lo escrito en el log DESPUÉS del offset $2 Ollama descartó la GPU integrada.
# El log es append: lo anterior al offset no cuenta. Sin log (o truncado, más corto que el offset), no hay nada
# que comprobar o se mira entero. Uso: ia_comprobar_log_gpu <log-ollama> <offset>
ia_comprobar_log_gpu() {
  [ -f "$1" ] || return 0
  local offset="${2:-0}"
  [ "$(ia_tamano_log "$1")" -ge "$offset" ] || offset=0
  if tail -c +"$((offset + 1))" "$1" | grep -q "dropping integrated GPU"; then
    echo "Ollama va solo por CPU («dropping integrated GPU» en $1): arráncalo con 'flatpak-spawn --host bash -lic \"ollama serve\"' (QA-141)" >&2
    return 1
  fi
}

# Mira el JSON de `GET <OLLAMA_BASE_URL>/api/ps` ($1). Devuelve 0 si algún modelo cargado usa VRAM (size_vram > 0),
# 1 si hay modelos cargados y ninguno en GPU, 2 si no hay ninguno cargado (aviso, no es un fallo).
ia_comprobar_gpu_api() {
  local r
  r="$(printf '%s' "$1" | python3 -c '
import json, sys
try:
    modelos = json.load(sys.stdin).get("models") or []
except Exception:
    modelos = []
print("vacio" if not modelos else ("gpu" if any((m.get("size_vram") or 0) > 0 for m in modelos) else "cpu"))
')"
  case "$r" in
    gpu) return 0 ;;
    cpu) echo "Ollama tiene modelos cargados solo en CPU (size_vram = 0 en /api/ps): revisa que use la GPU (QA-141)" >&2; return 1 ;;
    *) echo "Aviso: /api/ps no muestra ningún modelo cargado, no se puede comprobar la GPU (QA-141)" >&2; return 2 ;;
  esac
}
