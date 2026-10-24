# Generación de imágenes en local (Steam Deck) para juegos

Documento reutilizable (fuera del roadmap): análisis del prompt de la usuaria del 2026-10-13 y plan
para generar los assets visuales de Tarkor —y de cualquier juego o aplicación futura— sin depender
de los límites de ChatGPT. Comprobado contra fuentes el 2026-10-13 y **revisado el 2026-10-24** (ver
«Novedades del 2026-10-24»); lo que no se pudo comprobar va marcado **(sin verificar)** o
**(estimación)**.

## Novedades del 2026-10-24

Revisión en busca de algo que encaje mejor que lo redactado el 2026-10-13. Tres cambios y un
descarte:

| Novedad | Lo comprobado | Qué cambia aquí |
|---|---|---|
| **FLUX.3 Image Klein** (BFL, 2026-10-15) | 5,6B parámetros, pesos abiertos. Destilado: 16 pasos, `cfg 1.0`; base: 50 pasos según BFL (20 y `cfg 3.5` según stable-diffusion.cpp). Hasta 10 imágenes de referencia; una LoRA entrenada en el base carga también en el destilado. BFL dice +91 Elo sobre FLUX.2 klein **9B** en texto a imagen (no se compara con el 4B). Soportado en `sd-cli` desde el 2026-10-16 (`docs/flux3.md`), con GGUF de `leejet` (Q8 5,9 GB, Q4 3,4 GB) y codificador **Qwen3-VL-4B**. **Licencia: FLUX Kommunity** (ver «Licencias»). | **Candidato**, no sustituto: se decide en la fase 1 con el mismo banco de prompts en los dos modelos (ver «Plan»). |
| **VAE con licencia abierta** | `black-forest-labs/FLUX.2-small-decoder` es **Apache 2.0**, se cambia sin más por el decodificador de FLUX.2 (el codificador no cambia), decodifica ~1,4× más rápido y gasta menos memoria. | Pasa a ser el VAE por defecto; el `ae.safetensors` de FLUX.2-dev (no comercial) queda descartado. |
| **Binario Linux con Vulkan ya compilado** | Los *releases* de stable-diffusion.cpp traen `sd-…-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip` (35 MB; el último, `master-1000-95ff762`, del 2026-10-23). | Los pasos 1 y 2 pasan a «descargar y probar»; compilar en `distrobox` queda de respaldo. Que corra tal cual en SteamOS **(sin verificar en la Deck)**. |
| Z-Image-Turbo (Tongyi-MAI) | Apache 2.0, 6B, 8 pasos, cabe en 16 GB; orientado a fotorrealismo y texto en la imagen, «diversidad baja» según su propia ficha. | **Descartado** como principal: no mejora al klein 4B en ilustración y pesa más. |

Lo que **no** cambia: no hay datos publicados de FLUX en la Steam Deck (ni del 2 ni del 3); los
tiempos siguen siendo estimación hasta el banco de la fase 1.

## Veredicto

**Útil, con correcciones.** La idea central es buena y está comprobada: **FLUX.2 [klein] 4B** con
**stable-diffusion.cpp** sobre **Vulkan** en la Steam Deck es hoy la mejor opción local, libre para
uso comercial y con calidad cercana a ChatGPT en ilustración. Desde el 2026-10-15 tiene un rival,
**FLUX.3 Image Klein**: más calidad, más lento y con licencia limitada; se comparan en la fase 1. Pero
el prompt de partida tiene fallos que harían perder horas:

| Lo que decía el prompt | Lo comprobado | Qué hacemos |
|---|---|---|
| FLUX.2 klein 4B, Apache 2.0 | ✅ Cierto. El **9B** es **no comercial** (FLUX Non-Commercial License). | Solo el 4B. El 9B queda descartado para el juego, no por hardware sino por licencia. |
| stable-diffusion.cpp lo soporta desde enero de 2026 | ✅ Cierto (soporte de FLUX.2-klein del 2026-01-18, `docs/flux2.md`). | Herramienta principal. |
| Cualquier GGUF sirve | ❌ Los GGUF de `city96` son para ComfyUI y **no cargan** en `sd-cli`. | Usar los GGUF de `leejet` (el autor de stable-diffusion.cpp). |
| `sudo apt install vulkan-sdk` | ❌ SteamOS es Arch con sistema de archivos de solo lectura; no hay `apt`. Los drivers Vulkan (RADV) ya vienen. | Binario Vulkan ya compilado de los *releases* (2026-10-24); si no arranca, compilar dentro de un contenedor `distrobox` (Ubuntu), que ve la GPU. |
| 50 pasos para la LoRA `light_fantasy` | ⚠️ El klein **destilado** usa 4 pasos y `cfg 1.0`; el **base** usa ~20 pasos y `cfg 4.0`. Una LoRA entrenada sobre el base pide el base. | Elegir modelo según la LoRA (ver «Parámetros»). |
| SD 1.5 para iterar rápido y FLUX para la final | ❌ Composición, encuadre y estilo no se trasladan entre modelos distintos: lo que salga en SD 1.5 no se parece a lo que hará FLUX. | Iterar con el **mismo** FLUX klein a 512×512 y 4 pasos, y sacar la final a tamaño completo con la misma semilla. |
| Consistencia con semillas y prompts | ⚠️ Ayuda poco. | FLUX.2 klein **edita con imagen de referencia** (`-r ref.png`): es la herramienta real de consistencia de personajes. |
| Goblin AI (`pip install goblin-ai`), sin límites | ❌ **No se encontró ese paquete.** | Descartado. Respaldo en la nube: Google Colab gratuito con el **mismo** modelo (ver «Respaldo»). |
| GLM-Image, Perchance | Perchance existe y es gratuito **(condiciones sin verificar)**. GLM-Image pide una GPU de más de 80 GB o varias (2026-10-24): imposible en local. | Solo para bocetos, nunca para assets finales sin leer sus condiciones. |
| LoRAs `light_fantasy`, `MS Fantasy Style`, etc. | **(sin verificar)**: nombres y pesos tal cual del prompt. | Comprobar cada una en su página: modelo base, licencia y palabra clave. |

## Requisitos y preparación de la Steam Deck

- **Memoria.** Son 16 GB compartidos entre CPU y GPU. Klein 4B en GGUF Q8 + Qwen3-4B Q4 + VAE ocupa unos
  7 GB en disco y algo más en memoria en marcha. Con 4 GB reservados para la GPU, al sistema le quedan
  12 GB: hay que generar con el juego y el navegador cerrados.
- **BIOS (UMA Frame Buffer):** apagar del todo, mantener **Volumen +** y pulsar encendido, entrar en
  *Setup Utility → Advanced → UMA Frame Buffer Size → 4G*. Con Vulkan en una APU, el driver también
  puede usar memoria compartida (GTT) más allá de esa reserva, así que 4G no es imprescindible para
  arrancar, pero evita fallos de memoria con imágenes grandes **(estimación; medirlo con las dos
  opciones)**.
- **Modo escritorio** y espacio libre: unos 15 GB entre modelos, compilación e imágenes.

### Paso 0. Binario ya compilado (probar primero, 2026-10-24)

Todo lo de este proyecto vive en [`image-generator/`](../../../image-generator/README.md), en la raíz
del repo (binario, modelos, scripts y pruebas; lo pesado, fuera de git). Las rutas de abajo son
relativas a la raíz del repo.

```sh
mkdir -p image-generator/descargas image-generator/bin && cd image-generator/descargas
# el nombre exacto cambia con cada release: copiarlo de github.com/leejet/stable-diffusion.cpp/releases
curl -LO https://github.com/leejet/stable-diffusion.cpp/releases/download/master-1000-95ff762/sd-master-95ff762-bin-Linux-Ubuntu-24.04-x86_64-vulkan.zip
unzip sd-*-vulkan.zip -d ../bin && ../bin/sd-cli --help | head
```

**Comprobado el 2026-10-24:** arranca tal cual en SteamOS (sin contenedor) y ve la GPU (`AMD Custom
GPU 0405 (RADV VANGOGH)`, `uma: 1`). Los pasos 1 y 2 sobran; se quedan por si un release futuro pide
bibliotecas que SteamOS no trae.

### Paso 1. Contenedor (sin tocar SteamOS), si el binario no arranca

```sh
# distrobox viene en SteamOS 3.5+; si no: curl -s https://raw.githubusercontent.com/89luca89/distrobox/main/install | sh -s -- --prefix ~/.local
distrobox create --name sdcpp --image ubuntu:24.04
distrobox enter sdcpp
sudo apt update && sudo apt install -y build-essential cmake git libvulkan-dev glslc mesa-vulkan-drivers vulkan-tools pipx
vulkaninfo --summary | grep -i deviceName   # tiene que salir la GPU de la Deck (AMD Custom GPU 0405 / RADV VANGOGH)
```

### Paso 2. Compilar stable-diffusion.cpp con Vulkan (solo si el Paso 0 no sirve)

```sh
git clone --recursive https://github.com/leejet/stable-diffusion.cpp ~/sdcpp
cd ~/sdcpp && mkdir -p build && cd build
cmake .. -DSD_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j4
./bin/sd-cli --help | head
```

El binario Linux con Vulkan existe (2026-10-24): ver Paso 0.

### Paso 3. Descargar los pesos

| Pieza | De dónde | Archivo |
|---|---|---|
| Modelo (destilado, 4 pasos) | `huggingface.co/leejet/FLUX.2-klein-4B-GGUF` | `flux-2-klein-4b-Q8_0.gguf` (o `flux-2-klein-4b-Q4_0.gguf` si falta memoria) |
| Modelo base (para LoRAs entrenadas en el base) | `huggingface.co/leejet/FLUX.2-klein-base-4B-GGUF` | ídem |
| Codificador de texto (Qwen3 4B) | `huggingface.co/unsloth/Qwen3-4B-GGUF` | `Qwen3-4B-Q4_K_M.gguf` |
| VAE (Apache 2.0) | `huggingface.co/black-forest-labs/FLUX.2-small-decoder` | `full_encoder_small_decoder.safetensors` (237 MB; el que indica `docs/flux2.md`) |
| *Candidato:* FLUX.3 Image Klein (destilado, 16 pasos) | `huggingface.co/leejet/flux-3-image-klein-GGUF` | `flux3-image-klein-Q8_0.gguf` (5,9 GB) o `-Q4_K.gguf` (3,4 GB) |
| *Candidato:* su codificador (Qwen3-VL 4B) | `huggingface.co/Qwen/Qwen3-VL-4B-Instruct-GGUF` | `Qwen3-VL-4B-Instruct-Q4_K_M.gguf` |

FLUX.3 Klein usa el mismo VAE de FLUX.2 (según `docs/flux3.md`; que el *small decoder* también le
sirva, **sin verificar**: se prueba en la fase 1).

```sh
pipx install huggingface_hub    # dentro del contenedor; pip a secas falla en Ubuntu 24.04 (PEP 668)
pipx ensurepath && exec bash    # deja `hf` en el PATH
M=image-generator/modelos; mkdir -p $M/{diffusion,text,vae,lora}
hf download leejet/FLUX.2-klein-4B-GGUF flux-2-klein-4b-Q8_0.gguf --local-dir $M/diffusion
hf download unsloth/Qwen3-4B-GGUF Qwen3-4B-Q4_K_M.gguf --local-dir $M/text
hf download black-forest-labs/FLUX.2-small-decoder full_encoder_small_decoder.safetensors --local-dir $M/vae
```

Los tres (6,6 GB) bajaron en unos 2 minutos el 2026-10-24.

Si la versión de `huggingface_hub` es antigua y no trae `hf`, el comando equivalente es
`huggingface-cli` (`download` igual; `login` en vez de `auth login`).

**Licencia del VAE (resuelto el 2026-10-24):** el `ae.safetensors` de FLUX.2-dev es no comercial; el
`FLUX.2-small-decoder` es Apache 2.0, se cambia sin más y es más rápido. Se usa este.

### Paso 4. Primera imagen

En la Deck, **siempre con [`image-generator/scripts/demo.sh`](../../../image-generator/scripts/demo.sh)**,
que lleva las protecciones de memoria (ver «Demo del 2026-10-24»). La orden que lanza por debajo:

```sh
M=image-generator/modelos
image-generator/bin/sd-cli \
  --diffusion-model $M/diffusion/flux-2-klein-4b-Q8_0.gguf \
  --llm $M/text/Qwen3-4B-Q4_K_M.gguf \
  --vae $M/vae/full_encoder_small_decoder.safetensors \
  -p "painterly fantasy illustration, an orc hunter with a bone-handled axe, red dust plains at dawn. No text, no signature, no watermark." \
  --cfg-scale 1.0 --steps 4 --sampling-method euler -W 512 -H 512 --seed 42 \
  --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2 -o prueba.png -v
```

- `--diffusion-fa` está obsoleta en el release `master-1000`: ahora es `--flash-attn off,diffusion=on`.
- **`--params-backend disk --max-vram vulkan0=2`, no `--offload-to-cpu`:** en la Deck la VRAM es RAM
  compartida (GTT). Con `--offload-to-cpu` el gestor de memoria decide según la VRAM «libre» que ve:
  recién reiniciada ve ~9 GB y duplica el modelo entero en RAM fijada y en GTT (se comió 10 GB en
  16 s); tras una ejecución ve 0 MB y falla. Subir `--max-vram` (6 GB) **bloqueó la Deck** y hubo que
  forzar el apagado. Leyendo los pesos del disco por segmentos con 2 GB de GPU, la memoria libre no
  baja de 9,2 GB y va más rápido.
- «No text, no signature, no watermark» al final: sin ello, la primera imagen salió con una firma
  inventada.
- Si algo falla, mirar los nombres exactos con `image-generator/bin/sd-cli --help`: cambian entre
  versiones.

## Parámetros recomendados

| Uso | Modelo | Pasos | `--cfg-scale` | Tamaño |
|---|---|---|---|---|
| Boceto / iterar composición | klein 4B destilado | 4 | 1.0 | 512×512 |
| Final sin LoRA | klein 4B destilado | 4-8 | 1.0 | el del perfil (ver Tarkor) |
| Final con LoRA entrenada en el base | klein **base** 4B | 20-30 | 3.5-4.0 | ídem |
| Edición / consistencia (con referencia) | klein 4B destilado | 4 | 1.0 | `-r referencia.png` |
| *Candidato:* final | FLUX.3 Image Klein destilado | 16 | 1.0 | ídem |
| *Candidato:* final con LoRA | FLUX.3 Image Klein **base** | 20 | 3.5 | ídem (la LoRA vale también en el destilado) |

FLUX.3 Klein trae un `flow shift` por defecto de 6,93 (`--flow-shift` para cambiarlo) y admite hasta
10 `-r` por imagen.

- **Sampler:** el de la documentación es `euler`; no tocarlo hasta tener una imagen que funcione.
- **Semilla:** fija (`--seed`) mientras se itera el prompt; así cada cambio se ve aislado.
- **LoRA:** se pone en el prompt como en stable-diffusion-webui, con `--lora-model-dir`:
  `-p "light_fantasy, retrato de… <lora:light_fantasy:0.8>" --lora-model-dir image-generator/modelos/lora`.
  Con modelos cuantizados (GGUF) se aplica en tiempo de ejecución: más lenta, pero más fiel.

## Expectativas realistas

- **Calidad:** en ilustración de fantasía, FLUX klein 4B está cerca de lo que da ChatGPT en
  composición y detalle, y por debajo en textos dentro de la imagen y en escenas con muchos personajes
  **(estimación, por comparativas públicas, no medida en la Deck)**. Para retratos, objetos e iconos
  basta; para escenas complejas hará falta repetir más tiradas.
- **Tiempo en la Deck, medido (2026-10-24, klein 4B Q8, 4 pasos):** ~60 s a 512×512 y ~57 s a
  768×304 en total (difusión 44-47 s, VAE 7-8 s, el resto carga). La estimación de abajo era
  pesimista: queda como referencia para FLUX.3 Klein, que no se ha medido.
- **Tiempo en la Deck (estimación previa):**
  - El dato más cercano publicado: una RX 580 de 8 GB con Vulkan tardó unos 14 minutos en FLUX.1-schnell
    (12B parámetros) a 1024×1024 y 4 pasos.
  - Klein 4B tiene un tercio de parámetros y la GPU de la Deck es más lenta: calcular **del orden de
    2-6 minutos a 512×512 y 8-20 minutos a 1024×1024 con 4 pasos**. El modelo base con 25 pasos tarda
    unas 6 veces más.
  - **FLUX.3 Image Klein:** 1,4× parámetros y 4× pasos (16 frente a 4): calcular **unas 5-6 veces
    lo del klein 4B**, es decir, del orden de 10-35 minutos a 512×512 y de una a dos horas a
    1024×1024 **(estimación, 2026-10-24)**. En la Deck sirve para lotes de noche pequeños o no sirve;
    en Colab, segundos o pocos minutos por imagen **(sin verificar)**.
  - Se mide en el Paso 4 con `time`, y la tabla se corrige con el dato real.
- **Memoria con FLUX.3 Klein:** Q8 (5,9 GB) + Qwen3-VL-4B Q4 (~2,5 GB, **estimación**) + VAE ronda
  los 9 GB: cabe en los 12 GB que quedan, justo. Con Q4_K (3,4 GB) hay margen a costa de algo de
  calidad.
- **Klein 9B:** descartado por licencia (no comercial). En hardware tampoco cabe bien: 9B más Qwen3 8B
  pasan holgadamente de la memoria disponible.

## Demo del 2026-10-24 (medido en la Deck)

Con [`demo.sh`](../../../image-generator/scripts/demo.sh) y los prompts reales del juego (tabla
`ImagePrompt`, sin LLM). Imágenes, logs y prompts en `image-generator/pruebas/demo/` (fuera de git).

| Prompt | Tamaño | Total | Memoria libre mínima | Frente a la imagen actual del juego |
|---|---|---|---|---|
| fauna `mekiosi`, thumbnail | 512×512 | 61 s | 9,7 GB | La actual es ilustración plana; el prompt guardado pide «photorealistic» y FLUX lo cumple. «muscular build» lo pone de pie, como un humanoide. |
| item `esquirla-celeste-caida`, banner | 768×304 | 57 s | 9,2 GB | Misma composición (cristal azul, tierra agrietada, tormenta); menos detalle y sin el polvo rojizo de la actual (1983×793). |
| location `acantilados-partidos-dia-primavera`, banner | 768×304 | 56 s | 9,5 GB | Acantilado con oleaje, gaviotas y flores, estilo pintado y limpio; buena a este tamaño. |

Conclusiones:

- **Funciona y es estable** en la Deck con las protecciones de `demo.sh`: ~1 minuto por imagen, sin
  acercarse al límite de memoria.
- **El estilo lo decide el prompt, no el modelo.** Los prompts guardados no fijan un estilo común
  (unos piden fotorrealismo, otros no) y las imágenes actuales tampoco lo siguen. Antes de generar en
  serie hace falta un prefijo de estilo único para todo el juego (punto 3 de «Consistencia»).
- **El tamaño de banner es el límite visible:** a 768×304 se pierde detalle frente a las actuales.
  Falta medir 1024 o generar a 768 y ampliar.
- Abierto: por qué el gestor de memoria ve «0 MB libres» tras una ejecución con `--offload-to-cpu`
  (con `--params-backend disk` no ha vuelto a pasar en tres seguidas).

## Banco del múrgol (2026-10-24, medido en la Deck)

Objetivo de la usuaria: igualar el banner actual del múrgol (`backend/uploads/images/fauna/murgol-macho-banner.png`,
1983×793, hecho fuera). Mismo prompt afinado a mano
([`prompts/murgol/v5.txt`](../../../image-generator/prompts/murgol/v5.txt); v1-v4, el camino hasta él), semilla 7
y 1280×512 salvo donde se dice; una prueba cada vez con
[`generar.sh`](../../../image-generator/scripts/generar.sh). Imágenes y logs en `image-generator/pruebas/murgol/`.

| Prueba | Total | Memoria libre mínima | Resultado |
|---|---|---|---|
| klein 4B, 4 pasos | 110 s | 9,2 GB | Base de comparación: forma y astas bien; color, brillos y sombras lejos del original. |
| klein 4B, 8 pasos | 193 s | 8,9 GB | Algo más de detalle y vetas rojas; casi igual. No compensa el doble de tiempo. |
| **klein 4B, 4 pasos + el banner original como referencia** (`-r`, reducido a 1024 de ancho; [`v6-ref.txt`](../../../image-generator/prompts/murgol/v6-ref.txt)) | 199 s | 8,8 GB | **La mejor** (también para la usuaria): cielo, vetas rojas, horizonte y hierba como el original. |
| La misma referencia con otro animal (cuernahoja, prompt guardado sin afinar) | 194 s | 8,9 GB | Solo trae suelo y bruma; no la paleta, y añade cuernos. La referencia de estilo sirve si el prompt describe una escena y una luz parecidas. |
| klein 4B **base**, 25 pasos, `cfg 4` | 1057 s | 8,9 GB | Más suave y con menos detalle de pelo. Descartado: 10× el tiempo sin mejora. |
| **FLUX.3 Image Klein** Q8, 16 pasos | — | — | **No arranca** con `--max-vram vulkan0=2`: su grafo va en un solo segmento de 6,2 GB y no se trocea. Subir el tope es lo que bloqueó la Deck; en la Deck queda descartado, solo en Colab. |
| La mejor con hires fix a 1920×768 (Lanczos, denoise 0,35) | 232 s | 8,7 GB | **Falla** en la segunda pasada: a 1920×768 no cabe en los 2 GB de GPU. Descartado en la Deck. |
| La mejor + RealESRGAN x4plus (BSD-3), reducida a 1983×794 | +141 s | 10,3 GB | A la resolución del original y muy cerca de él. |

Conclusiones:

- **La palanca grande es la imagen de referencia**, no el modelo ni los pasos. Para el juego: unas pocas imágenes
  ancla por tipo de escena (fauna al atardecer, interior, objeto…) en vez de un prefijo de estilo de texto.
- **Receta en la Deck:** klein 4B destilado, 4 pasos, referencia, 1280×512 y ESRGAN; ~5,5 minutos por banner.
- **FLUX.3 Image Klein** y hires fix solo se pueden probar en Colab.

## Consistencia de personajes

1. **Ficha visual fija por personaje**: un párrafo de rasgos (raza, piel, cicatrices, ropa, colores)
   que se pega igual en todos sus prompts. En Tarkor ya existe: es el contexto que arma
   `imagePromptContext.ts` desde el catálogo.
2. **Imagen de referencia**: la primera buena de cada personaje se guarda como referencia, y las
   siguientes se generan con `-r referencia.png` («mismo personaje, ahora…»). Es la palanca más
   fuerte de FLUX.2 klein. FLUX.3 Klein admite hasta 10 referencias a la vez (personaje + estilo +
   escenario), que sería su principal ventaja aquí.
3. **Misma LoRA de estilo y mismo peso** en todo el juego, para que el estilo no varíe.
4. **Semilla** solo como apoyo para variaciones pequeñas del mismo prompt.
5. **Un solo modelo para todo el juego.** Lo que vale entre SD 1.5 y FLUX vale entre FLUX.2 y FLUX.3:
   el estilo no se traslada. Se elige uno en la fase 1 y no se mezclan.

## Cómo escribir los prompts

Orden: **estilo → sujeto → acción/pose → entorno → luz → detalles de acabado**, en frases descriptivas
(FLUX entiende lenguaje natural, no listas de etiquetas sueltas).

- **Retrato:** `painterly fantasy illustration. Portrait of an orc hunter in his thirties, pale grey-green
  skin, a scar across the left brow, braided black hair with bone beads, leather armour with red clan
  markings. Three-quarter view, calm alert expression. Background: blurred red dust plains. Warm
  low morning light from the left. Fine brush texture, rich detail, centred composition.`
- **Escenario:** `painterly fantasy illustration. A ruined clay fortress on a cliff above a red canyon,
  broken watchtowers, banners torn by the wind. Wide view from below. Late afternoon, long shadows,
  dust in the air. Muted reds and ochres with teal sky.`
- **Objeto mágico:** `painterly fantasy item illustration. A short bone-handled axe with runes glowing
  faint blue along the blade, resting on dark stone. Centred, plain dark background, soft rim light,
  sharp detail on the runes.`
- **Icono de habilidad:** `fantasy game ability icon. A stylised magnifying lens made of bone and amber
  over a beast's eye. Bold silhouette, high contrast, centred, plain dark background, no text, no frame.`
- **Palabras clave de una LoRA**: van al principio del prompt, y la etiqueta `<lora:…>` al final.

## Respaldo si algo falla

| Problema | Qué hacer |
|---|---|
| `vulkaninfo` no ve la GPU | Fuera del contenedor, comprobar con `vulkaninfo` en SteamOS; recrear el contenedor con `distrobox create --additional-flags "--device /dev/dri"`. |
| Sin memoria (OOM) | `--offload-to-cpu --vae-tiling`, bajar a `Q4_0`, generar a 512 y escalar después, cerrar todo lo demás. |
| Imágenes raras con Vulkan en APU | Hay un aviso abierto de resultados distintos en GPUs integradas AMD (issue #563 del proyecto) **(sin verificar si afecta a la Deck)**. Probar la misma semilla en CPU (`-DSD_VULKAN=OFF`) para comparar. |
| Demasiado lento | Respaldo en la nube, abajo. |

**Respaldo en la nube (recomendado): Google Colab gratuito con el mismo modelo.** Una GPU T4 gratuita
con ComfyUI o `diffusers` ejecuta FLUX.2 klein 4B en segundos por imagen. Ventaja clave sobre
cualquier web «gratis e ilimitada»: es el **mismo modelo**, así que las imágenes encajan con las de la
Deck y la licencia es la misma (Apache 2.0). Límite: sesiones y cuota de GPU de Colab, que cambian sin
aviso **(sin verificar la cuota actual)**. Si en la fase 1 se elige FLUX.3 Image Klein, Colab pasa de
respaldo a sitio principal por lo lento que va en la Deck: su FP8 ocupa 5,6 GB y BFL dice que el
INT8 corre con 8 GB de VRAM, así que cabe en la T4 de 16 GB **(sin verificar en Colab)**.

Otros servicios gratuitos (Pollinations, Perchance…) solo para bocetos. Antes de publicar algo hecho con
ellos hay que leer sus condiciones, porque el modelo de detrás y sus derechos no siempre están claros.

## Licencias

- **FLUX.2 klein 4B:** Apache 2.0, con uso comercial permitido. Las imágenes generadas se pueden usar
  en el juego.
- **FLUX.2 klein 9B y FLUX.2 dev:** licencia no comercial. No sirven para el juego.
- **FLUX.3 Image Klein (FLUX Kommunity License, 2026-10-24; lectura del texto, no consejo legal):**
  - Uso comercial gratis solo para el «Qualifying User»: ingresos brutos anuales, **sumados los de
    las empresas vinculadas**, por debajo de 5 M$ **en todo momento**. Por encima, licencia aparte con
    BFL.
  - Las imágenes son de quien las genera (BFL no reclama propiedad) y se pueden usar en el juego.
  - Obligaciones: filtrar o **revisar cada imagen** antes de publicarla (contenido ilícito o que
    infrinja derechos) y **avisar de que es IA** donde la ley lo exija (Steam ya pide declararlo).
  - Prohibido usar el modelo o sus imágenes para mejorar otro modelo de imagen. Una LoRA o un ajuste
    propio es un «derivado» y arrastra las mismas condiciones.
  - Generar dentro del juego (en el equipo del jugador o en un servidor) cuenta como distribuir el
    modelo: atribución y copia de la licencia. Para assets generados fuera, no aplica.
  - Se termina sola ante cualquier incumplimiento, y BFL puede terminarla con aviso.
  - Frente al klein 4B (Apache 2.0, sin nada de esto), es la contrapartida de la calidad extra.
- **VAE:** `FLUX.2-small-decoder`, Apache 2.0 (Paso 3).
- **LoRAs:** cada una lleva su licencia en Civitai o Hugging Face (permiso de uso comercial, de venta
  de imágenes y de mezcla). Se apunta la licencia de cada LoRA usada junto a las imágenes que genera.
- **Servicios en la nube:** sus condiciones mandan sobre las imágenes. En Colab, como el modelo es el
  mismo, vale lo de arriba.

---

## Plan de implementación

Por fases; cada una acaba en algo comprobable.

1. **Banco de pruebas en la Deck** (½ día): pasos 0-4 (1-2 solo si el binario no arranca). Los
   **mismos 3 prompts** (retrato, escenario, icono; los de «Cómo escribir los prompts») y la misma
   semilla en **FLUX.2 klein 4B y FLUX.3 Image Klein** (2026-10-24). *Hecho cuando* sale `prueba.png`,
   se ha medido el tiempo de los dos a 512 y a 1024 con y sin el UMA a 4G, la tabla de «Expectativas»
   se corrige con esos datos y la usuaria elige **un** modelo viendo las imágenes lado a lado.
2. **Estilo de la casa** (1-2 sesiones): con el modelo elegido, destilado o base, LoRA si la hay (con su
   licencia apuntada) y un preámbulo de estilo fijo. *Hecho cuando* 5 retratos de personajes distintos se
   reconocen como del mismo juego.
3. **Generador por lotes** (ver «Acoplamiento a Tarkor»): un script que, sin supervisión, recorre lo
   que falta y deja las imágenes con su nombre correcto. *Hecho cuando* una noche de lote deja N
   imágenes válidas y `npm run audit-images` no da como faltante ninguna entidad del lote.
4. **Referencias de personaje**: carpeta de referencias y uso de `-r` en los personajes recurrentes.
5. **Respaldo en Colab**: un cuaderno con el mismo modelo, LoRA y preámbulo, que lee la misma lista de
   prompts. *Hecho cuando* la misma semilla y el mismo prompt dan una imagen equivalente en los dos
   sitios.

## Acoplamiento a Tarkor

Lo que ya existe:
- `POST /world/:slug/image-prompt` (`backend/src/routes/world.ts`) genera el **texto** del prompt de
  cada entidad con el LLM y lo guarda en `ImagePrompt` (por mundo, tipo, entidad y perfil de tamaño).
- Perfiles (`imagePromptGenerator.ts`): `thumbnail` 1024×1024, `banner` 1920×768, `mapa` 800×600,
  `icono` 512×512.
- Las imágenes se suben a mano a `backend/uploads/images/<tipo>/` como `<slug>-<perfil>.<ext>`
  (`imageAssets.ts` compara el nombre exacto). Excepciones con variantes:
  - las zonas, `<slug>[-dia|-noche][-estacion]-mapa.<ext>`, que vigila `imagenesZona.test.ts`;
  - la fauna, con sufijo de sexo (`-macho`/`-hembra`).
- `npm run audit-images` (`auditImages.ts`, en `backend/`) lista las imágenes huérfanas y las
  entidades sin imagen de fauna, flora, npc, item, location y faction. Solo orienta: no falla. Deja
  fuera `raza` aunque ya tiene imágenes subidas (18 el 2026-10-24); el lote que la genere tendrá que
  añadirla al audit.
- La API de prompts no recibe momento del día ni estación: las variantes de zona se piden
  añadiéndolas al prompt desde `generar.mjs`.

Lo que falta es el **renderizador**: hoy se copia el prompt a ChatGPT. La pieza nueva, fuera del
juego (no es dependencia del backend):

```text
tools/imagenes/
├── generar.mjs        # lote: qué falta → prompt (API) → sd-cli → archivo con su nombre
├── perfiles.json      # perfil → tamaño de generación y tamaño final (FLUX trabaja en múltiplos de 16)
├── estilo.json        # preámbulo de estilo, LoRA y peso, modelo y pasos: la «casa»
└── referencias/       # una imagen buena por personaje recurrente (para -r)
```

```text
generar.mjs --tipo npc --perfil thumbnail [--solo-faltantes]
  entidades del catálogo sin imagen en uploads/images/<tipo>/
  para cada una:
    prompt = POST /world/helek-sirik/image-prompt {entityType, entitySlug, sizeProfile}
    sd-cli  estilo.preambulo + prompt [+ <lora>] -W/-H del perfil [-r referencias/<slug>.png] --seed fija
    reescalar al tamaño final del perfil (banner 1920×768 se genera a 1280×512 y se escala)
    guardar con el nombre que espera el juego; anotar semilla y modelo en un .json al lado
  al final: npm run audit-images (faltan / sobran) y, si se tocaron zonas, npx vitest run src/scripts/imagenesZona.test.ts
```

Decisiones de diseño:
- **El backend no cambia**: el script usa la API que ya existe y escribe donde el juego ya lee.
  Si un día se quiere generar desde el propio juego, se añade un proveedor detrás de la misma
  interfaz (`renderizar(prompt, perfil, referencia?) → png`), con tres implementaciones: `sd-cli` local,
  Colab y «manual» (lo de hoy).
- **El prompt sigue siendo del LLM de Tarkor**: conoce el lore. El estilo y la LoRA los pone
  `estilo.json`, para no tener que regenerar todos los prompts si cambia el estilo.
- **Trazabilidad**: semilla, modelo, LoRA y su licencia en el `.json` de cada imagen, para poder
  regenerarla igual y para la revisión de licencias antes de publicar.

## Para otro juego o aplicación

El patrón se lleva tal cual; solo cambian las dos primeras piezas:

1. **Inventario de entidades** (qué necesita imagen y con qué nombre de archivo).
2. **Generador de prompts** con el contexto del mundo (en Tarkor, el LLM y el catálogo).
3. **Renderizador** intercambiable (`sd-cli` local, Colab, manual), con perfiles de tamaño.
4. **Validador de nombres** que dice qué falta y qué sobra (en Tarkor, `auditImages.ts` para todo y
   `imagenesZona.test.ts`, que sí falla, para las zonas). Mejor aún si falla en un test: en Tarkor
   sería convertir `auditImages.ts` en test cuando el lote esté completo.

`estilo.json`, `perfiles.json` y `generar.mjs` se copian y se adaptan; los modelos y la compilación de la
Deck se reutilizan sin cambios.

## Fuentes

- [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp): modelos soportados, Vulkan, `docs/flux2.md` (comandos de klein 4B/9B) y `docs/lora.md`.
- [leejet/FLUX.2-klein-4B-GGUF](https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF): archivos `flux-2-klein-4b-Q8_0.gguf` y `flux-2-klein-4b-Q4_0.gguf` (comprobado el 2026-10-13).
- [FLUX.2 klein base 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-4B) y GGUF de la comunidad ([w3ss](https://huggingface.co/w3ss/FLUX.2-klein-4B-GGUF), [MXKA](https://huggingface.co/MXKA/FLUX.2-klein-4B-GGUF)): licencias (4B Apache 2.0; 9B no comercial).
- [Hugging Face Forum: FLUX.1-schnell en 8 GB AMD sin CUDA](https://discuss.huggingface.co/t/flux-1-schnell-on-8gb-vram-amd-no-cuda-the-gguf-format-mismatch-that-wastes-hours/177010): tiempos en RX 580 con Vulkan y GGUF de city96 incompatibles con `sd-cli`.
- [Issue #563 de stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/issues/563): Vulkan en iGPU AMD.
- Búsqueda de «goblin-ai»: sin resultados del paquete (solo modelos de pago de ModelsLab con nombres parecidos).

Añadidas en la revisión del 2026-10-24:

- [Notas de versión de BFL](https://docs.eu.bfl.ai/release-notes) y [blog de FLUX 3 Image Klein](https://bfl.ai/blog/flux-3-image-klein): 5,6B, 16/50 pasos, 10 referencias, comparación con klein 9B, pesos en BF16 y FP8.
- [LICENSE.md de flux-3-image-klein](https://huggingface.co/black-forest-labs/flux-3-image-klein/blob/main/LICENSE.md) (FLUX Kommunity License) y [VentureBeat](https://venturebeat.com/technology/black-forest-labs-opens-flux-3-image-klein-weights-with-free-commercial-use-limited-to-smaller-businesses).
- [stable-diffusion.cpp: `docs/flux3.md`](https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux3.md) (archivos, pasos, `flow shift`), `docs/flux2.md` (`full_encoder_small_decoder.safetensors`) y [releases](https://github.com/leejet/stable-diffusion.cpp/releases) (binario Linux Vulkan de `master-1000-95ff762`).
- [leejet/flux-3-image-klein-GGUF](https://huggingface.co/leejet/flux-3-image-klein-GGUF): tamaños de Q2_K a Q8_0.
- [FLUX.2-small-decoder](https://huggingface.co/black-forest-labs/FLUX.2-small-decoder): Apache 2.0, ~1,4× más rápido.
- [Z-Image-Turbo](https://huggingface.co/Tongyi-MAI/Z-Image-Turbo): Apache 2.0, 6B, 8 pasos, fotorrealismo.
- [Wikipedia: Flux](https://en.wikipedia.org/wiki/Flux_(text-to-image_model)) y [BentoML](https://www.bentoml.com/blog/a-guide-to-open-source-image-generation-models) (GLM-Image y el resto de modelos abiertos de 2026).
- Sin datos de FLUX en la Steam Deck: la búsqueda solo dio tiempos en Apple Silicon ([lilting.ch](https://lilting.ch/en/articles/flux2-klein-apple-silicon)) y en CPU.
