# Banco de calidad (`IMG-15`): resultados

Semilla 3, banner 1280×512, en la Deck. Cada ronda es un `rN-*.tsv` de esta carpeta (se lanza con
`bash docs/producto/plan-imagenes/banco.sh <ronda>`); los prompts salen de `prompts.py` a `prompts/`. Las imágenes
quedan en `image-generator/generated/banco/<ronda>-<nombre>/intentos/` (no se suben). Para comparar el detalle fino,
`recorte.sh` apila la misma zona al 100 %. Referencia: los banners de ChatGPT de `backend/uploads/images/`.

Antes de este banco (`calidad.sh`, 2026-10-25): 12 pasos ≈ 6; hires fix, peor; Real-ESRGAN, misma imagen a
5120×2048 (sirve para el tamaño final); `klein-base` con cfg 3,5, 15 min y sobresaturado; **el estilo «cine»
(luz dorada dramática, gradación cálida) es lo que más acerca**.

## Lo que se ve en las referencias de ChatGPT

Luz: sol bajo a contraluz, cielo naranja o carmesí saturado, polvo encendido, borde de luz en el sujeto. Diseño:
rasgos del canon exagerados hasta lo fantástico (cresta de púas rojas, cuernos en hoja), aunque a veces fuera del
canon (su aullador es largo y de patas cortas; el canon dice patas largas).

## r1 · VAE (2026-10-25)

| Prueba | Decodificar | Lectura |
|---|---|---|
| `full_encoder_small_decoder` (hoy) | 22 s | referencia |
| `flux2-vae.safetensors` (completo, Apache 2.0, `unsloth/FLUX.2-VAE`) | 41 s | igual a la vista; al 200 %, pelo y hierba prácticamente iguales (PSNR 29-34 dB) |
| VAE de `black-forest-labs/FLUX.2-klein-4B` (diffusers) | 41 s | idéntico al completo |

**Veredicto:** el VAE no es el cuello de botella; se queda el pequeño.

## r2 · Codificador de texto Qwen3-4B Q8 frente a Q4_K_M

Mismo tiempo (~2,6 min). Cambia algo la composición (manada, cola), sin mejora clara de calidad ni de fidelidad.
**Veredicto:** neutro; se decide con más semillas si hace falta.

## r4 · Z-Image-Turbo Q4_K (Apache 2.0, 6B, 8 pasos)

Arranca en la Deck con las mismas protecciones (mín. libre ~8 GB), **~6 min** por banner. Aullador: la anatomía del
canon mejor que klein (patas largas y finas, colmillos curvos, manada a contraluz entre polvo), pero más blando y
pictórico. Pastos: más neblina y menos detalle; los Cuernahoja salen como caballos. **Veredicto:** prometedor en
fauna; se prueba en Q6_K por si la blandura es de la cuantización.

## r3 · Estilo del prompt

En curso.
