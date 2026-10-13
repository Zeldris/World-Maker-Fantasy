# Generación de imágenes en local (Steam Deck) para juegos

Documento reutilizable (fuera del roadmap): análisis del prompt de la usuaria del 2026-10-13 y plan
para generar los assets visuales de Tarkor —y de cualquier juego o aplicación futura— sin depender
de los límites de ChatGPT. Comprobado contra fuentes el 2026-10-13; lo que no se pudo comprobar va
marcado **(sin verificar)** o **(estimación)**.

## Veredicto

**Útil, con correcciones.** La idea central es buena y está comprobada: **FLUX.2 [klein] 4B** con
**stable-diffusion.cpp** sobre **Vulkan** en la Steam Deck es hoy la mejor opción local, libre para
uso comercial y con calidad cercana a ChatGPT en ilustración. Pero el prompt de partida tiene fallos
que harían perder horas:

| Lo que decía el prompt | Lo comprobado | Qué hacemos |
|---|---|---|
| FLUX.2 klein 4B, Apache 2.0 | ✅ Cierto. El **9B** es **no comercial** (FLUX Non-Commercial License). | Solo el 4B. El 9B queda descartado para el juego, no por hardware sino por licencia. |
| stable-diffusion.cpp lo soporta desde enero de 2026 | ✅ Cierto (soporte de FLUX.2-klein del 2026-01-18, `docs/flux2.md`). | Herramienta principal. |
| Cualquier GGUF sirve | ❌ Los GGUF de `city96` son para ComfyUI y **no cargan** en `sd-cli`. | Usar los GGUF de `leejet` (el autor de stable-diffusion.cpp). |
| `sudo apt install vulkan-sdk` | ❌ SteamOS es Arch con sistema de archivos de solo lectura; no hay `apt`. Los drivers Vulkan (RADV) ya vienen. | Compilar dentro de un contenedor `distrobox` (Ubuntu), que ve la GPU. |
| 50 pasos para la LoRA `light_fantasy` | ⚠️ El klein **destilado** usa 4 pasos y `cfg 1.0`; el **base** usa ~20 pasos y `cfg 4.0`. Una LoRA entrenada sobre el base pide el base. | Elegir modelo según la LoRA (ver «Parámetros»). |
| SD 1.5 para iterar rápido y FLUX para la final | ❌ Composición, encuadre y estilo no se trasladan entre modelos distintos: lo que salga en SD 1.5 no se parece a lo que hará FLUX. | Iterar con el **mismo** FLUX klein a 512×512 y 4 pasos, y sacar la final a tamaño completo con la misma semilla. |
| Consistencia con semillas y prompts | ⚠️ Ayuda poco. | FLUX.2 klein **edita con imagen de referencia** (`-r ref.png`): es la herramienta real de consistencia de personajes. |
| Goblin AI (`pip install goblin-ai`), sin límites | ❌ **No se encontró ese paquete.** | Descartado. Respaldo en la nube: Google Colab gratuito con el **mismo** modelo (ver «Respaldo»). |
| GLM-Image, Perchance | Perchance existe y es gratuito **(condiciones sin verificar)**; GLM-Image **(sin verificar)**. | Solo para bocetos, nunca para assets finales sin leer sus condiciones. |
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

### Paso 1. Contenedor para compilar (sin tocar SteamOS)

```sh
# distrobox viene en SteamOS 3.5+; si no: curl -s https://raw.githubusercontent.com/89luca89/distrobox/main/install | sh -s -- --prefix ~/.local
distrobox create --name sdcpp --image ubuntu:24.04
distrobox enter sdcpp
sudo apt update && sudo apt install -y build-essential cmake git libvulkan-dev glslc mesa-vulkan-drivers vulkan-tools
vulkaninfo --summary | grep -i deviceName   # tiene que salir la GPU de la Deck (AMD Custom GPU 0405 / RADV VANGOGH)
```

### Paso 2. Compilar stable-diffusion.cpp con Vulkan

```sh
git clone --recursive https://github.com/leejet/stable-diffusion.cpp ~/sdcpp
cd ~/sdcpp && mkdir -p build && cd build
cmake .. -DSD_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release -j4
./bin/sd-cli --help | head
```

Si la página de *releases* trae un binario Linux con Vulkan, sirve igual **(sin verificar que exista
para Linux)**.

### Paso 3. Descargar los pesos

| Pieza | De dónde | Archivo |
|---|---|---|
| Modelo (destilado, 4 pasos) | `huggingface.co/leejet/FLUX.2-klein-4B-GGUF` | el `Q8_0` (o `Q4_K` si falta memoria) |
| Modelo base (para LoRAs entrenadas en el base) | `huggingface.co/leejet/FLUX.2-klein-base-4B-GGUF` | ídem |
| Codificador de texto (Qwen3 4B) | `huggingface.co/unsloth/Qwen3-4B-GGUF` | `Qwen3-4B-Q4_K_M.gguf` |
| VAE | `huggingface.co/black-forest-labs/FLUX.2-dev` | `ae.safetensors` (renombrado `flux2_ae.safetensors`) |

```sh
pip install -U "huggingface_hub[cli]"          # dentro del contenedor
mkdir -p ~/modelos/{diffusion,text,vae,lora}
huggingface-cli download leejet/FLUX.2-klein-4B-GGUF --include "*Q8_0*" --local-dir ~/modelos/diffusion
huggingface-cli download unsloth/Qwen3-4B-GGUF Qwen3-4B-Q4_K_M.gguf --local-dir ~/modelos/text
huggingface-cli login                           # el repo de FLUX.2-dev pide aceptar sus condiciones
huggingface-cli download black-forest-labs/FLUX.2-dev ae.safetensors --local-dir ~/modelos/vae
```

**Licencia del VAE:** viene del repositorio de FLUX.2-dev, cuya licencia es no comercial. Antes de
publicar el juego hay que confirmar que el VAE tiene su propia licencia abierta **(sin verificar)**. Si
no, la documentación de stable-diffusion.cpp ofrece como alternativa
`black-forest-labs/FLUX.2-small-decoder`.

### Paso 4. Primera imagen

```sh
cd ~/sdcpp/build
./bin/sd-cli \
  --diffusion-model ~/modelos/diffusion/flux-2-klein-4b-Q8_0.gguf \
  --llm ~/modelos/text/Qwen3-4B-Q4_K_M.gguf \
  --vae ~/modelos/vae/flux2_ae.safetensors \
  -p "painterly fantasy illustration, an orc hunter with a bone-handled axe, red dust plains at dawn" \
  --cfg-scale 1.0 --steps 4 -W 512 -H 512 --seed 42 \
  --diffusion-fa --vae-tiling --offload-to-cpu -o prueba.png -v
```

`--offload-to-cpu` y `--vae-tiling` son los que evitan quedarse sin memoria en hardware pequeño; si
sobra memoria, quitarlos acelera. Si algo falla, mirar los nombres exactos con `./bin/sd-cli --help`:
cambian entre versiones.

## Parámetros recomendados

| Uso | Modelo | Pasos | `--cfg-scale` | Tamaño |
|---|---|---|---|---|
| Boceto / iterar composición | klein 4B destilado | 4 | 1.0 | 512×512 |
| Final sin LoRA | klein 4B destilado | 4-8 | 1.0 | el del perfil (ver Tarkor) |
| Final con LoRA entrenada en el base | klein **base** 4B | 20-30 | 3.5-4.0 | ídem |
| Edición / consistencia (con referencia) | klein 4B destilado | 4 | 1.0 | `-r referencia.png` |

- **Sampler:** el de la documentación es `euler`; no tocarlo hasta tener una imagen que funcione.
- **Semilla:** fija (`--seed`) mientras se itera el prompt; así cada cambio se ve aislado.
- **LoRA:** se pone en el prompt como en stable-diffusion-webui, con `--lora-model-dir`:
  `-p "light_fantasy, retrato de… <lora:light_fantasy:0.8>" --lora-model-dir ~/modelos/lora`.
  Con modelos cuantizados (GGUF) se aplica en tiempo de ejecución: más lenta, pero más fiel.

## Expectativas realistas

- **Calidad:** en ilustración de fantasía, FLUX klein 4B está cerca de lo que da ChatGPT en
  composición y detalle, y por debajo en textos dentro de la imagen y en escenas con muchos personajes
  **(estimación, por comparativas públicas, no medida en la Deck)**. Para retratos, objetos e iconos
  basta; para escenas complejas hará falta repetir más tiradas.
- **Tiempo en la Deck (estimación):**
  - El dato más cercano publicado: una RX 580 de 8 GB con Vulkan tardó unos 14 minutos en FLUX.1-schnell
    (12B parámetros) a 1024×1024 y 4 pasos.
  - Klein 4B tiene un tercio de parámetros y la GPU de la Deck es más lenta: calcular **del orden de
    2-6 minutos a 512×512 y 8-20 minutos a 1024×1024 con 4 pasos**. El modelo base con 25 pasos tarda
    unas 6 veces más.
  - Se mide en el Paso 4 con `time`, y la tabla se corrige con el dato real.
- **Klein 9B:** descartado por licencia (no comercial). En hardware tampoco cabe bien: 9B más Qwen3 8B
  pasan holgadamente de la memoria disponible.

## Consistencia de personajes

1. **Ficha visual fija por personaje**: un párrafo de rasgos (raza, piel, cicatrices, ropa, colores)
   que se pega igual en todos sus prompts. En Tarkor ya existe: es el contexto que arma
   `imagePromptContext.ts` desde el catálogo.
2. **Imagen de referencia**: la primera buena de cada personaje se guarda como referencia, y las
   siguientes se generan con `-r referencia.png` («mismo personaje, ahora…»). Es la palanca más
   fuerte de FLUX.2 klein.
3. **Misma LoRA de estilo y mismo peso** en todo el juego, para que el estilo no varíe.
4. **Semilla** solo como apoyo para variaciones pequeñas del mismo prompt.

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
| Sin memoria (OOM) | `--offload-to-cpu --vae-tiling`, bajar a `Q4_K`, generar a 512 y escalar después, cerrar todo lo demás. |
| Imágenes raras con Vulkan en APU | Hay un aviso abierto de resultados distintos en GPUs integradas AMD (issue #563 del proyecto) **(sin verificar si afecta a la Deck)**. Probar la misma semilla en CPU (`-DSD_VULKAN=OFF`) para comparar. |
| Demasiado lento | Respaldo en la nube, abajo. |

**Respaldo en la nube (recomendado): Google Colab gratuito con el mismo modelo.** Una GPU T4 gratuita
con ComfyUI o `diffusers` ejecuta FLUX.2 klein 4B en segundos por imagen. Ventaja clave sobre
cualquier web «gratis e ilimitada»: es el **mismo modelo**, así que las imágenes encajan con las de la
Deck y la licencia es la misma (Apache 2.0). Límite: sesiones y cuota de GPU de Colab, que cambian sin
aviso **(sin verificar la cuota actual)**.

Otros servicios gratuitos (Pollinations, Perchance…) solo para bocetos. Antes de publicar algo hecho con
ellos hay que leer sus condiciones, porque el modelo de detrás y sus derechos no siempre están claros.

## Licencias

- **FLUX.2 klein 4B:** Apache 2.0, con uso comercial permitido. Las imágenes generadas se pueden usar
  en el juego.
- **FLUX.2 klein 9B y FLUX.2 dev:** licencia no comercial. No sirven para el juego.
- **VAE:** ver la nota del Paso 3.
- **LoRAs:** cada una lleva su licencia en Civitai o Hugging Face (permiso de uso comercial, de venta
  de imágenes y de mezcla). Se apunta la licencia de cada LoRA usada junto a las imágenes que genera.
- **Servicios en la nube:** sus condiciones mandan sobre las imágenes. En Colab, como el modelo es el
  mismo, vale lo de arriba.

---

## Plan de implementación

Por fases; cada una acaba en algo comprobable.

1. **Banco de pruebas en la Deck** (½ día): pasos 1-4. *Hecho cuando* sale `prueba.png` y se ha medido
   el tiempo a 512 y a 1024 con y sin el UMA a 4G; la tabla de «Expectativas» se corrige con esos datos.
2. **Estilo de la casa** (1-2 sesiones): elegir modelo (destilado o base), LoRA si la hay (con su
   licencia apuntada) y un preámbulo de estilo fijo. *Hecho cuando* 5 retratos de personajes distintos se
   reconocen como del mismo juego.
3. **Generador por lotes** (ver «Acoplamiento a Tarkor»): un script que, sin supervisión, recorre lo
   que falta y deja las imágenes con su nombre correcto. *Hecho cuando* una noche de lote deja N
   imágenes válidas y el test de nombres pasa.
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
- Las imágenes se suben a mano a `backend/uploads/images/<tipo>/` con la nomenclatura
  `<slug>[-dia|-noche][-estacion]-mapa.<ext>` de las zonas, que vigila `imagenesZona.test.ts`.

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
  al final: npx vitest run src/scripts/imagenesZona.test.ts
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
4. **Validador de nombres** que falla si falta o sobra algo (en Tarkor, `imagenesZona.test.ts`).

`estilo.json`, `perfiles.json` y `generar.mjs` se copian y se adaptan; los modelos y la compilación de la
Deck se reutilizan sin cambios.

## Fuentes

- [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp): modelos soportados, Vulkan, `docs/flux2.md` (comandos de klein 4B/9B) y `docs/lora.md`.
- [FLUX.2 klein base 4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-4B) y GGUF de la comunidad ([w3ss](https://huggingface.co/w3ss/FLUX.2-klein-4B-GGUF), [MXKA](https://huggingface.co/MXKA/FLUX.2-klein-4B-GGUF)): licencias (4B Apache 2.0; 9B no comercial).
- [Hugging Face Forum: FLUX.1-schnell en 8 GB AMD sin CUDA](https://discuss.huggingface.co/t/flux-1-schnell-on-8gb-vram-amd-no-cuda-the-gguf-format-mismatch-that-wastes-hours/177010): tiempos en RX 580 con Vulkan y GGUF de city96 incompatibles con `sd-cli`.
- [Issue #563 de stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/issues/563): Vulkan en iGPU AMD.
- Búsqueda de «goblin-ai»: sin resultados del paquete (solo modelos de pago de ModelsLab con nombres parecidos).
