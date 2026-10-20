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

# Devuelve 1 con mensaje si el log de Ollama ($1) dice que descartó la GPU integrada. Se mira el log ENTERO: Ollama
# escribe «dropping integrated GPU» una sola vez, al arrancar `ollama serve` (que este script no lanza), e
# `iniciar-tarkor.sh` trunca el log con `>` al lanzarlo, así que el archivo es la ejecución actual.
# Sin log, avisa (sin parar): solo cuenta /api/ps. Uso: ia_comprobar_log_gpu <log-ollama>
ia_comprobar_log_gpu() {
  if [ ! -f "$1" ]; then
    echo "Aviso: no hay registro de Ollama ($1); solo cuenta /api/ps. Arráncalo con 'flatpak-spawn --host bash -lic \"ollama serve > logs/ollama.log 2>&1\"' para tenerlo (QA-141)" >&2
    return 0
  fi
  if grep -q "dropping integrated GPU" "$1"; then
    echo "Ollama va solo por CPU («dropping integrated GPU» en $1): arráncalo con 'flatpak-spawn --host bash -lic \"ollama serve > logs/ollama.log 2>&1\"' (QA-141)" >&2
    return 1
  fi
}

# Veredicto de `npm run rag-eval`: $1 = código de salida, $2 = su salida (stdout+stderr). Devuelve 0 si pasa.
# rag-eval sale con 1 tanto si fallan casos obligatorios (imprime «fallan debe_pasar: N», N > 0) como por una
# excepción no capturada (BD, Ollama caído, modelo de embeddings ausente): solo lo primero pide reindexar.
ia_veredicto_rag_eval() {
  [ "$1" = 0 ] && return 0
  if [ "$1" = 1 ] && printf '%s\n' "$2" | grep -Eq 'fallan debe_pasar: [1-9]'; then
    echo "rag-eval: fallan casos obligatorios; reindexa el lore con 'npm run reindex-lore' en backend/ y arranca de nuevo (QA-141)" >&2
  else
    echo "rag-eval acabó con código $1 sin resumen de casos fallidos: error del entorno (BD, Ollama o modelo de embeddings), no de recall (QA-141). Últimas líneas:" >&2
    printf '%s\n' "$2" | tail -n 15 >&2
  fi
  return 1
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
