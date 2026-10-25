#!/bin/bash
# VOZ-1: instala el motor de voz (qwentts.cpp, MIT) y sus modelos (Qwen3-TTS, Apache 2.0) en voice-generator/.
# En SteamOS, dentro de un contenedor distrobox con Ubuntu 24.04 (el sistema de la Deck es de solo lectura):
#   distrobox create -n voz -i ubuntu:24.04 && distrobox enter voz
#   sudo apt install build-essential cmake git curl libvulkan-dev glslc libopenblas-dev sox
#   voice-generator/scripts/instalar.sh            # todo; o una parte: motor | modelos
# Compila dos veces, en carpetas aparte para que una no borre la otra (buildvulkan.sh y buildcpu.sh del motor
# borran build/): qwentts/build-vulkan (Vulkan, la GPU de la Deck) y qwentts/build-cpu (OpenBLAS, si Vulkan falla).
# Los modelos se bajan con curl (la CLI `hf` de models.sh choca con PEP 668 y solo baja el 0,6B): los nombres son
# los del doc 02, verificados el 2026-10-13 (sin verificar desde la nube después: huggingface.co está bloqueado).
# MODELOS="…" cambia la lista; ya bajados, no se repiten.
set -u
G=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)   # voice-generator/
QT=$G/qwentts; M=$G/modelos
REPO=${REPO:-https://github.com/ServeurpersoCom/qwentts.cpp}
HF=https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF/resolve/main
MODELOS=${MODELOS:-"qwen-tokenizer-12hz-Q8_0.gguf qwen-talker-0.6b-base-Q8_0.gguf qwen-talker-1.7b-base-Q8_0.gguf qwen-talker-1.7b-voicedesign-Q8_0.gguf"}
QUE=${1:-todo}

motor() {
  for h in git cmake c++ glslc; do command -v $h > /dev/null || { echo "ABORTO: falta $h (apt install, ver la cabecera)"; exit 3; }; done
  if [ -d "$QT/.git" ]; then git -C "$QT" pull --ff-only && git -C "$QT" submodule update --init --recursive
  else git clone --recurse-submodules "$REPO" "$QT"; fi || { echo "ABORTO: no se pudo clonar o actualizar $REPO"; exit 4; }
  echo "motor: $(git -C "$QT" log -1 --format='%h %cs')"
  cmake -S "$QT" -B "$QT/build-vulkan" -DGGML_VULKAN=ON && cmake --build "$QT/build-vulkan" --config Release -j"$(nproc)" \
    || echo "AVISO: falló la compilación con Vulkan; queda la de CPU (DISPOSITIVO=CPU)"
  cmake -S "$QT" -B "$QT/build-cpu" -DGGML_BLAS=ON && cmake --build "$QT/build-cpu" --config Release -j"$(nproc)" \
    || { echo "ABORTO: falló también la compilación de CPU"; exit 4; }
  for b in build-vulkan build-cpu; do
    for x in qwen-tts qwen-codec tts-server; do [ -x "$QT/$b/$x" ] && echo "ok: $b/$x" || echo "falta: $b/$x"; done
  done
}

modelos() {
  mkdir -p "$M"
  for f in $MODELOS; do
    [ -s "$M/$f" ] && { echo "ya está: $f"; continue; }
    echo "bajando $f…"
    # A un .part y se renombra al acabar: un corte no deja un GGUF a medias que parezca bueno.
    curl -fL --retry 3 -C - -o "$M/$f.part" "$HF/$f" && mv "$M/$f.part" "$M/$f" || echo "AVISO: no se bajó $f (¿cambió el nombre en $HF?)"
  done
  ls -lh "$M"
}

case $QUE in
  todo) motor; modelos ;;
  motor) motor ;;
  modelos) modelos ;;
  *) sed -n 3,6p "$0"; exit 2 ;;
esac
# Comprobación de carga: sin -i, qwen-codec solo carga el tokenizador.
B=$QT/build-cpu; [ -x "$QT/build-vulkan/qwen-codec" ] && B=$QT/build-vulkan
[ -x "$B/qwen-codec" ] && [ -s "$M/qwen-tokenizer-12hz-Q8_0.gguf" ] && \
  LD_LIBRARY_PATH="$B" "$B/qwen-codec" --model "$M/qwen-tokenizer-12hz-Q8_0.gguf" > /dev/null 2>&1 && echo "codec: carga bien"
echo "Siguiente: voice-generator/scripts/banco.sh (VOZ-2)"
