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

# Devuelve 1 con mensaje si el log de Ollama dice que descartó la GPU integrada, o si `ollama ps` (texto en $2)
# no muestra GPU. Uso: ia_comprobar_gpu <log-ollama> <salida-de-ollama-ps>
ia_comprobar_gpu() {
  if [ -f "$1" ] && grep -q "dropping integrated GPU" "$1"; then
    echo "Ollama va solo por CPU («dropping integrated GPU» en $1): arráncalo con 'flatpak-spawn --host bash -lic \"ollama serve\"' (QA-141)" >&2
    return 1
  fi
  if ! printf '%s\n' "$2" | grep -q "GPU"; then
    echo "'ollama ps' no muestra GPU: carga un modelo y revisa que Ollama use la GPU (QA-141)" >&2
    return 1
  fi
}
