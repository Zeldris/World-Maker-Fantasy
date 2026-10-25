# voice-generator

Voces y sonidos en local (Steam Deck) con [qwentts.cpp](https://github.com/ServeurpersoCom/qwentts.cpp) (MIT) y los
modelos Qwen3-TTS (Apache 2.0), más SoX para los efectos por raza y la fauna. El diseño, las decisiones y las fuentes
están en [`02-voces-y-sonidos-locales.md`](../docs/arquitectura/reutilizables/02-voces-y-sonidos-locales.md); las
tareas, en [`roadmap-voces.md`](../docs/producto/roadmap-voces.md) (`VOZ-n`). Por ahora son solo herramientas de
desarrollo (pasos 1-3 del documento y la fauna): nada de esto corre en la máquina del jugador ni lo usa el juego.

**Nada de esto se ha probado todavía con el motor**: los scripts se escribieron en la nube, sin modelos ni Deck. Lo
de probar se hace en la Deck (lista al final).

## Estructura

| Carpeta | Qué guarda | En git |
|---|---|---|
| `scripts/` | `instalar.sh` (motor y modelos, `VOZ-1`), `banco.sh` (velocidad y español, `VOZ-2`), `disenar.sh`, `fijar.sh` y `producir.sh` (`VOZ-3`), `escuchar.sh` (efectos, `VOZ-4`), `fauna.sh` (`VOZ-5`); `comun.sh` (rutas y protecciones de memoria) y `voces.py` (fichas → `--instruct`, efectos → SoX, `comprobar`) | sí |
| `voces/<raza>/` | `efectos.json`, la cadena de efectos de la raza (slug de `BERIG_RAZAS`; `narrador` no lleva) | sí |
| `voces/<raza>/<voz>/` | `diseno.json` (las 12 claves de la plantilla, semilla y texto de prueba), `referencia.txt` (lo que dice la referencia) y `referencia.wav`, la toma elegida | sí |
| `voces/frases-prueba.txt` | frases neutras, sin lore, para `producir.sh` | sí |
| `fauna/<especie>/` | `cadena.json` (mismo formato que `efectos.json`) y `licencias.tsv`; `_plantilla/` para copiar | sí |
| `qwentts/` | el clon del motor y sus dos compilaciones: `build-vulkan/` y `build-cpu/` (OpenBLAS) | no |
| `modelos/` | `qwen-talker-1.7b-voicedesign-Q8_0.gguf`, `qwen-talker-1.7b-base-Q8_0.gguf`, `qwen-talker-0.6b-base-Q8_0.gguf` y `qwen-tokenizer-12hz-Q8_0.gguf` | no |
| `sonidos/fauna/<especie>/` | los sonidos base de fauna (CC0 o propios) | no |
| `generated/` | `banco/<fecha>/`, `<raza>/<voz>/` (`tomas/`, `logs/`, `registro.tsv`, `notas.md`, `fijado/<modelo>/` con el `.spk` y el `.rvq`, `frases/`) y `fauna/<especie>/` | no |

## Instalar (una vez)

En SteamOS el sistema es de solo lectura: se compila dentro de un distrobox con Ubuntu 24.04.

```bash
distrobox create -n voz -i ubuntu:24.04 && distrobox enter voz
sudo apt install build-essential cmake git curl libvulkan-dev glslc libopenblas-dev sox
voice-generator/scripts/instalar.sh          # todo; o solo una parte: motor | modelos
```

Compila con Vulkan (la GPU de la Deck) y con CPU (OpenBLAS), en carpetas aparte; si Vulkan falla, queda la de CPU
(`DISPOSITIVO=CPU`). Los modelos van a un `.part` y se renombran al acabar. Termina comprobando que el codec carga.

## El flujo de una voz

```bash
voice-generator/scripts/banco.sh [rondas]               # VOZ-2: una vez, para decidir modelo y dispositivo
voice-generator/scripts/disenar.sh orcos guerrero-1      # 5 tomas con VoiceDesign 1,7B (semillas 11 22 33 44 55)
voice-generator/scripts/escuchar.sh orcos <toma.wav>     # la toma con los efectos de la raza
voice-generator/scripts/fijar.sh orcos guerrero-1 <toma.wav>   # la elegida pasa a referencia.wav y se codifica
voice-generator/scripts/producir.sh orcos guerrero-1 [frases.txt]   # el modelo Base dice las frases con esa voz
voice-generator/scripts/fauna.sh <especie> [variantes]   # VOZ-5
```

1. **`banco.sh`** saca una referencia del narrador con VoiceDesign y, con ella, prueba cada modelo Base (0,6B y
   1,7B) en cada dispositivo, con una frase corta y una larga. Deja `generated/banco/<fecha>/banco.tsv` (segundos de
   audio, ms, RTF, memoria libre mínima y si conoce el español) y los `.wav` para escucharlos.
2. **`disenar.sh <raza> <voz>`** lee `voces/<raza>/<voz>/diseno.json`, monta el `--instruct` con las 12 claves y
   saca una toma por semilla (`SEMILLAS="…"` cambia la lista) en `generated/<raza>/<voz>/tomas/`. Lo que te parezca
   cada una, en `notas.md`.
3. **`escuchar.sh <raza> <wav>`** le pone la cadena de `voces/<raza>/efectos.json` y la reproduce (`REPRODUCIR=0`
   solo la escribe). Los efectos se ajustan de oído en el `.json`: las cifras de ahora son de partida.
4. **`fijar.sh <raza> <voz> <toma>`** copia la toma a `voces/<raza>/<voz>/referencia.wav`, apunta su semilla en la
   ficha y saca con `qwen-codec` el `.spk` y el `.rvq` del modelo Base (`BASE=…`), en `generated/…/fijado/`. Sin
   toma, solo vuelve a codificar la referencia que ya hay (p. ej., al cambiar de modelo Base).
5. **`producir.sh <raza> <voz> [frases]`** dice cada línea del archivo con la voz fijada (`SEMILLA`, 7 por defecto);
   con `EFECTOS=1`, también con los efectos de la raza.

`python3 voice-generator/scripts/voces.py comprobar` revisa todas las fichas y cadenas (lo corren los tests de
`tools/qa`).

### Fichas de diseño y la deriva infantil

Cada `diseno.json` lleva las 12 claves de la plantilla del documento 02 (`gender`, `age`, `pitch`, `speed`,
`volume`, `clarity`, `fluency`, `accent`, `texture`, `emotion`, `tone`, `personality`), en inglés, más `semilla` y
`texto_prueba`. `voces.py` rechaza lo que lleva a voces de niño: edad que no sea adulta explícita, tono agudo en el
diseño (se diseña medio o grave y se sube con efectos) y palabras como *bright*, *cute*, *small*, *young*…

### Efectos

`efectos.json` y `cadena.json` son una lista de efectos con nombre y parámetros (`paso_alto`, `paso_bajo`,
`ecualizador`, `graves`, `agudos`, `saturacion`, `coro`, `reverberacion`, `tono`, `volumen`, `eco`); los mismos datos
los aplicará Web Audio en el juego (`VOZ-10`). `formantes` y `capa` (mezclar un sonido, como el gruñido de los
faerus) no los hace SoX: se avisan y se saltan (pendiente, `VOZ-4`), como los arquetipos «etérea» y «mineral».

## Memoria: lo que no se toca

La voz compite con Ollama por los 16 GB de la Deck, y la Deck se congela sin memoria en vez de matar el proceso (le
pasó al generador de imágenes el 2026-10-24). `comun.sh` copia las protecciones de
`image-generator/scripts/generar.sh`:

- Una generación a la vez (`flock` sobre `generated/.cerrojo`): un segundo script espera.
- Al empezar, al menos `MIN_INICIO_MB` (4000) libres; si no, aborta, o con `LIBERAR_OLLAMA=1` descarga antes los
  modelos de Ollama.
- Un vigilante que mata el proceso si quedan menos de 1,5 GB libres, y un tope de tiempo (`TOPE`, 600 s).

Variables: `DISPOSITIVO=Vulkan0|CPU`, `BASE=<gguf del modelo Base>` (0,6B por defecto), `LANG_VOZ` (`Spanish`),
`TOPE`, `LIBERAR_OLLAMA=1`.

## Sin verificar (se prueba en la Deck)

- Que compile y cargue en la Deck (Vulkan y CPU) dentro del distrobox.
- Los nombres de los GGUF en Hugging Face (desde la nube no se llega a huggingface.co).
- Que el modelo conozca `Spanish` y suene a español; el RTF de cada modelo y dispositivo (`banco.sh`).
- Cuánto cambian la voz las 12 claves y las semillas (`disenar.sh`), y que el modelo Base clone bien la referencia.
- Las cadenas de efectos de cada raza, de oído (con SoX sobre tonos de prueba ya funcionan).
