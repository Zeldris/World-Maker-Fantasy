#!/bin/bash
# Lo común de los scripts de voz (VOZ-1): rutas, modelos, binario según el dispositivo y las protecciones de memoria
# de image-generator/scripts/generar.sh. La voz compite con Ollama por los 16 GB de la Deck: una generación a la vez
# (flock), memoria libre al empezar, vigilante de MemAvailable y timeout. Se carga con `. comun.sh`.
#
# Variables: DISPOSITIVO=Vulkan0|CPU (Vulkan0; CPU usa la compilación con OpenBLAS), BASE=<gguf del modelo Base>
# (el del nivel: 0,6B en la Deck, 1,7B con GPU de 6 GB o más), TOPE=<s> (600), LIBERAR_OLLAMA=1 (descarga sus
# modelos si falta memoria, en vez de abortar).
G=$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)   # voice-generator/
M=$G/modelos
DISENO=qwen-talker-1.7b-voicedesign-Q8_0.gguf
BASE=${BASE:-qwen-talker-0.6b-base-Q8_0.gguf}
CODEC=${CODEC:-qwen-tokenizer-12hz-Q8_0.gguf}
DISPOSITIVO=${DISPOSITIVO:-Vulkan0}
LANG_VOZ=${LANG_VOZ:-Spanish}   # (sin verificar que el GGUF lo tenga: lo dice banco.sh)
TOPE=${TOPE:-600}
MIN_INICIO_MB=${MIN_INICIO_MB:-4000}; MIN_VIGILA_MB=1500

# El binario de la compilación que toca: Vulkan para Vulkan0, OpenBLAS para CPU (instalar.sh hace las dos).
bin_dir() { case $DISPOSITIVO in CPU) echo "$G/qwentts/build-cpu" ;; *) echo "$G/qwentts/build-vulkan" ;; esac; }

disp() { awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo; }
cargados() { curl -s --max-time 2 localhost:11434/api/ps | python3 -c 'import json,sys; [print(m["name"]) for m in json.load(sys.stdin).get("models", [])]' 2>/dev/null; }

# Aborta si no hay memoria; con LIBERAR_OLLAMA=1 descarga antes los modelos de Ollama (como generar.sh, CFG-43).
memoria_inicial() {
  if [ "$(disp)" -lt "$MIN_INICIO_MB" ] && [ "${LIBERAR_OLLAMA:-0}" = 1 ]; then
    for m in $(cargados); do
      echo "Ollama: descargando $m"
      curl -s --max-time 10 localhost:11434/api/generate -d "{\"model\":\"$m\",\"keep_alive\":0}" > /dev/null
      curl -s --max-time 10 localhost:11434/api/embed -d "{\"model\":\"$m\",\"input\":\"\",\"keep_alive\":0}" > /dev/null
    done
    for _ in $(seq 15); do [ -z "$(cargados)" ] && break; sleep 1; done
  fi
  [ "$(disp)" -ge "$MIN_INICIO_MB" ] || { echo "ABORTO: solo $(disp) MB libres (<$MIN_INICIO_MB). Cierra navegador/Steam/juego o LIBERAR_OLLAMA=1."; exit 3; }
}

requisitos() {
  for f in "$@"; do [ -e "$f" ] || { echo "ABORTO: falta $f (voice-generator/scripts/instalar.sh)"; exit 3; }; done
}

# Una generación a la vez, aunque se lancen dos scripts: el segundo espera.
una_a_la_vez() {
  mkdir -p "$G/generated"
  exec 9> "$G/generated/.cerrojo"
  flock -n 9 || { echo "Otra generación de voz en marcha: esperando…"; flock 9; }
}

# lanzar <log> <orden…>: la corre con timeout y el vigilante; deja en MIN la memoria libre mínima y devuelve su salida.
lanzar() {
  local log=$1; shift
  # Sin `<&0`, bash da /dev/null como entrada a lo que va en segundo plano y qwen-tts no recibiría el texto
  # (`lanzar … < frase.txt`).
  LD_LIBRARY_PATH="$(bin_dir)" timeout "$TOPE" "$@" > "$log" 2>&1 <&0 &
  local pid=$!
  # $pid es el de `timeout`: un SIGKILL a él no llega al hijo, que seguiría con la memoria. Primero el hijo.
  MIN=$(disp)   # si muere antes de la primera vuelta, la de al empezar
  while kill -0 $pid 2>/dev/null; do
    local m; m=$(disp); [ "$m" -lt $MIN ] && MIN=$m
    if [ "$m" -lt $MIN_VIGILA_MB ]; then pkill -9 -P $pid; kill -9 $pid; echo "VIGILANTE: matado con $m MB libres"; break; fi
    sleep 1
  done
  wait $pid
}

# registrar <tsv> <cabecera> <fila>: añade una fila (y la cabecera si el archivo es nuevo).
registrar() {
  [ -f "$1" ] || printf '%s\n' "$2" > "$1"
  printf '%s\n' "$3" >> "$1"
}

valido() { for v in "$@"; do [[ $v =~ ^[A-Za-z0-9_-]+$ ]] || { echo "ABORTO: «$v» no es un nombre válido (letras, cifras, - y _)"; exit 2; }; done; }
