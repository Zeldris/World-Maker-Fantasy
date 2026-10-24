#!/bin/bash
# NO USAR (2026-10-24): con --max-vram vulkan0=6 bloqueó la Deck por falta de memoria. Se guarda solo como
# registro; las rutas (~/sdcpp-bin, ~/modelos) ya no existen. Usar ../probar.sh.
exit 1
cd ~/sdcpp-bin
NO=" No text, no signature, no watermark."
gen() { # nombre ancho alto prompt
  t0=$(date +%s)
  ./sd-cli --diffusion-model ~/modelos/diffusion/flux-2-klein-4b-Q8_0.gguf --llm ~/modelos/text/Qwen3-4B-Q4_K_M.gguf \
    --vae ~/modelos/vae/full_encoder_small_decoder.safetensors -p "$4$NO" --cfg-scale 1.0 --steps 4 --sampling-method euler \
    -W $2 -H $3 --seed 42 --flash-attn off,diffusion=on --vae-tiling --offload-to-cpu --max-vram vulkan0=6 -o ~/sdcpp-pruebas/$1.png -v > ~/sdcpp-pruebas/$1.log 2>&1
  echo "$1 salida=$? total=$(( $(date +%s) - t0 ))s $(grep -o "sampling completed, taking [0-9.]*s" ~/sdcpp-pruebas/$1.log)"
}
gen 02-escenario-512 512 512 "painterly fantasy illustration. A ruined clay fortress on a cliff above a red canyon, broken watchtowers, banners torn by the wind. Wide view from below. Late afternoon, long shadows, dust in the air. Muted reds and ochres with teal sky."
gen 03-icono-512 512 512 "fantasy game ability icon. A stylised magnifying lens made of bone and amber over a beast's eye. Bold silhouette, high contrast, centred, plain dark background, no frame."
gen 04-retrato-1024 1024 1024 "painterly fantasy illustration. Portrait of an orc hunter in his thirties, pale grey-green skin, a scar across the left brow, braided black hair with bone beads, leather armour with red clan markings. Three-quarter view, calm alert expression. Background: blurred red dust plains. Warm low morning light from the left. Fine brush texture, rich detail, centred composition."
