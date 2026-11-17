# Investigación: modelos de imagen nuevos frente a Qwen-Image 2.1 en la Deck (2026-11-17)

Encargo: ¿hay modelos de texto a imagen (y edición con referencia) publicados desde ~2026-10-15 que mejoren la calidad de
Qwen-Image 2.1 Q4_K para concept art de fantasía (criaturas, paisajes, banners 1920x768) y corran en la Deck (16 GB unificados,
Vulkan, `sd-cli`)? No se descargó ni se generó nada. No repite FLUX.2 klein, FLUX.3 Image Klein, Qwen-Image-Edit 2509/2511,
LongCat edit, Z-Image-Turbo, SD 1.5/SDXL ni el repack «Uncensored-Omni».

**Fuentes:** [P] primaria, [C] comunidad/prensa, [E] estimación mía.
**No pude leer:** huggingface.co, artificialanalysis.ai, alphasignal.ai, wavespeed.ai, neurohive.io (red bloqueada; no hay fichas HF
oficiales leídas). Sí pude leer github.com/leejet/stable-diffusion.cpp (README y `docs/models/*.md`, rama master, 2026-11-17).
Lo de HF sale de resultados de búsqueda (resúmenes) y de lo que cita la doc de sd.cpp. Ningún «es mejor que Qwen» está medido por mí.

## Resumen

1. **Nada comprobado mejora a Qwen-Image 2.1 y cabe en la Deck.** Lo más nuevo que sd.cpp ya soporta (día 0) es **MiniMax-H3-Image**
   (11-nov) y **P-H3-Image** (derivado de Pruna): 33 B de parámetros y codificador de 32 B (Q4_K_M ≈ 18 GB) o INT8 de ≈21 GB: no caben [P/C].
2. **Único candidato razonable para probar: MOSS-Image-SFT (5 B, Apache-2.0, 16-oct)**: DiT de 5 B + Qwen3.5-9B Q4_K_M + VAE FLUX.2,
   cabe holgado y es más rápido que un 8 B [E]. Riesgo: pensado para texto largo/maquetación, sin datos de arte fantástico [C];
   hay que probarlo con 3 prompts de criatura/paisaje/banner antes de decidir.
3. Edición con referencia en sd.cpp nueva: solo MiniMax-H3-Image (`-r`, hasta 16 refs) y P-H3-Image; ninguna cabe. Qwen Image 2.1 ya tiene edición en sd.cpp [P].
4. Para velocidad, lo útil es **P-H3-Image o MiniMax-H3 en 6-8 pasos sin CFG** (el 4B de texto lo hace viable en memoria del codificador, pero no el DiT) [E].
5. Sin hallazgos de otros modelos de noviembre: el resto de la lista de sd.cpp (Krea2, Fibo 2.0, SenseNova U1.5, MiniT2I, SeFi, Iris-3B, Ming,
   Mage-Flow, ERNIE, Boogu, HiDream-O1) no pude fecharlo ni evaluarlo; están sin analizar, no descartados.

## 1. MOSS-Image-Base / SFT (OpenMOSS) — candidato a probar

| Campo | Dato |
|---|---|
| Publicación | 2026-10-16, día 0 en sd.cpp [P: README sd.cpp; C: ifeng, aiweekly] |
| Parámetros | DiT 5 B; Qwen3.5-9B (texto) y VAE FLUX.2 aparte [C: ifeng] |
| Licencia | Apache-2.0 (pesos y código) [C: aiweekly, espejos HF; la doc de sd.cpp no la dice]. Hay que confirmarla en la ficha oficial OpenMOSS-Team |
| Soporte sd.cpp | Sí, `docs/models/moss_image.md`; `--tokenizer` obligatorio (tokenizer.json de Qwen3.5), cfg 3.0, `--flow-shift` por defecto 5, `--offload-to-cpu` [P] |
| GGUF | `leejet/MOSS-Image-Base-GGUF` y `leejet/MOSS-Image-SFT-GGUF` (tamaños no leídos) [P enlace]; también safetensors INT8 ConvRot `moss_image_*_int8_convrot_attn` [P]. Texto: `unsloth/Qwen3.5-9B-GGUF` Q4_K_M (≈5-6 GB [E]) |
| Memoria en la Deck | DiT 5 B Q4 ≈ 3 GB [E] + texto ≈ 5,5 GB + VAE ≈ 0,3 GB: ≈ 9 GB [E]. Cabe con margen |
| Por qué podría mejorar | Mejor en texto largo (96,3 % LongLongTextBench) y maquetación (RealLayoutArena, el generador 1.º) [C]; útil para banners con rótulos. SFT es el de generar; Base, para LoRA [C] |
| Riesgos | Sin datos de estilo fantástico/concept art; sin edición con referencia en sd.cpp; sin velocidad medida; ficha no leída |

## 2. MiniMax-H3-Image (MiniMax) — no cabe

| Campo | Dato |
|---|---|
| Publicación | ≈2026-11-10/11 (sd.cpp día 0 el 11-nov [P]; 10-nov [C: neurohive vía búsqueda]) |
| Parámetros | DiT 33,1 B; checkpoint BF16 68,65 GB [C] |
| Licencia | Sin confirmar: MiniMax H3 License; una fuente excluye EE. UU./UE/Reino Unido/Corea, otras dicen no comercial libre y comercial < 20 M USD [C, contradictorias] |
| Soporte sd.cpp | Sí, `minimax_h3_image.md`; texto→imagen y `-r` (hasta 16 refs), 6 pasos, cfg 1, `--sigmas minimax-h3-image`, `--offload-to-cpu --vae-tiling` [P] |
| GGUF | Solo del codificador Qwen3-VL-32B: `leejet/MiniMax-H3-GGUF` (Q4_K_M ≈ 18 GB [P]). DiT: safetensors poda BF16 o INT8 ConvRot; no vi GGUF del DiT |
| Memoria en la Deck | Codificador 18 GB solo ya pasa de 16 GB; DiT INT8 ≈ 33 GB [E]. **No cabe**, ni con disco (Deck lentísima) |
| Por qué podría mejorar | 4K nativo, edición y generación en uno, 6 pasos [C]; encabeza el ranking abierto de Artificial Analysis [C, sin leer] |
| Riesgos | Memoria; licencia con restricciones geográficas; sin métricas propias publicadas [C] |

## 3. P-H3-Image (Pruna AI, derivado de MiniMax-H3) — no cabe

| Campo | Dato |
|---|---|
| Publicación | Anunciado ≈2026-11-03 [C: una fuente, fecha a confirmar]; día 0 en sd.cpp [P: README] |
| Parámetros | No encontrados (hereda el DiT de H3 [C]) |
| Licencia | Hereda la de MiniMax-H3 (excluye UE, Reino Unido, Corea y EE. UU. sin acuerdo) [C: alphasignal vía búsqueda]; la doc de sd.cpp no dice nada |
| Soporte sd.cpp | Sí, `p_h3_image.md`; 8 pasos, cfg 1, euler, `--sigmas p-h3-image`, hasta 2912x2912, `-r` para edición [P] |
| GGUF | Ninguno del DiT: `PrunaAI/P-H3-Image-Comfy` en safetensors INT8 ConvRot y 4 bits; texto Qwen3-VL-4B bf16 (≈8 GB [E]) o el de 32 B [P] |
| Memoria en la Deck | INT8/4 bits ≈ 21 GB de VRAM en una GPU grande [C]; sin cifra de fichero. Con codificador 4B, **no cabe sin disco** [E] |
| Por qué podría mejorar | 8 MP en 8 pasos sin CFG [C]; rapidez |
| Riesgos | Memoria, licencia, sin GGUF |

## 4. HiDream-O1-Image-Dev — sin evidencia suficiente

Soporte sd.cpp sí (`hidream_o1_image.md`, `-m` con safetensors BF16, cfg 1) [P]; solo hay safetensors en `Comfy-Org/HiDream-O1-Image`, sin GGUF
ni tamaños ni licencia en la doc [P]. Un resultado de búsqueda lo describe como 8 B nativo en píxeles y que superó a un FLUX.2 de 56 B [C: wavespeed,
título, sin leer]. Fecha desconocida. Un 8 B en BF16 son ≈16 GB: no cabe sin cuantizar [E]. No lo recomiendo hasta ver un GGUF.

## Descartado por no ser nuevo o no verificable

- Qwen-Image 2.1 (20-sep, la base actual) y FLUX.3 Image Klein (16-oct, ya evaluado) [P: README sd.cpp].
- Fibo 2.0 (Bria, oct-2026 [C]), Krea2 (sd.cpp 25-jun), Ideogram4 (4-jun), Lens, PiD: anteriores a la ventana o sin fecha; no analizados.
- FLUX 3 Dev y Ideogram 4.5: sin pesos abiertos a mediados de noviembre [C: csuite].

## Siguiente paso sugerido

1. Bajar `leejet/MOSS-Image-SFT-GGUF` (Q4 o el que haya) + `Qwen3.5-9B-Q4_K_M.gguf` + `flux2_ae.safetensors` + `tokenizer.json`,
   con la versión de sd-cli que ya trae `moss_image` (el binario `95ff762`/`290148d` puede ser anterior al 16-oct: comprobar con `--help`).
2. Probar 3 prompts fijos (criatura, paisaje, banner 1920x768) a 1024x1024 y a 1920x768, midiendo tiempo y memoria, y comparar con Qwen 2.1.
3. Comprobar la licencia en la ficha oficial `OpenMOSS-Team/MOSS-Image-SFT` antes de adoptarlo.

## Enlaces

- sd.cpp README y novedades: https://github.com/leejet/stable-diffusion.cpp [P]
- Docs: `docs/models/moss_image.md`, `minimax_h3_image.md`, `p_h3_image.md`, `hidream_o1_image.md` en esa misma rama master [P]
- GGUF: https://huggingface.co/leejet/MOSS-Image-SFT-GGUF, https://huggingface.co/leejet/MiniMax-H3-GGUF (no leídos)
- Repo MOSS-Image: https://github.com/OpenMOSS/MOSS-Image [C: solo el resultado de búsqueda]
- Prensa: https://aiweekly.co/alerts/moss-image-5b-tops-open-weight-long-text-rendering-at-963 , https://tech.ifeng.com/c/8xXR3pNaBD3 ,
  https://csuite.so/blog/ai-models-roundup-november-2026 , https://runtimewire.com/article/minimax-h3-open-weights-us-license-restrictions [C]
