# Voces y sonidos locales para juegos

Documento reutilizable (fuera del roadmap): análisis del prompt de la usuaria del 2026-10-13 sobre
voces sintéticas locales y plan para Tarkor y otros juegos. Comprobado el 2026-10-13 contra el
repositorio de `qwentts.cpp` y la documentación de Qwen3-TTS; lo que no se pudo medir va marcado
**(estimación)** o **(sin verificar)**.

## Veredicto

**`qwentts.cpp` es la elección correcta, pero no como la planteaba el prompt.**

1. **Licencias limpias.** Qwen3-TTS es Apache 2.0 (modelos y códec) y `qwentts.cpp` es MIT. Se puede
   distribuir con el juego.
2. **Escala sin cambiar de herramienta.** Compila para CPU (`buildcpu.sh`), Vulkan (`buildvulkan.sh`,
   la GPU de la Deck), CUDA y SYCL. Los mismos archivos GGUF sirven en todas, así que el requisito de
   escalar se cumple.
3. **Corrección de fondo: VoiceDesign no es el modo de producción.** VoiceDesign (solo en el modelo de
   1,7B) inventa una voz a partir de una descripción **en cada llamada**. Con la misma descripción, dos
   frases pueden sonar a dos personas distintas. No sirve para que un NPC hable igual en todo el juego.
   El flujo estable es este:

   ```text
   DISEÑAR (una vez, en tu PC, con VoiceDesign 1.7B)
     descripción + semilla fija → varias tomas → eliges la mejor → referencia.wav + referencia.txt
   FIJAR (una vez)
     qwen-codec --talker … -i referencia.wav → referencia.spk + referencia.rvq
   PRODUCIR (siempre, en la máquina del jugador, con el modelo Base)
     qwen-tts --ref-spk/--ref-rvq/--ref-text → todas las frases con esa misma voz
   ```

4. **Lo que protege la inversión es el `.wav` de referencia, no el embedding.** El `.spk` depende del
   modelo con el que se extrajo. Un audio de referencia limpio (10-30 s) y su transcripción sirven con
   este motor, con su modelo pequeño y con **cualquier** motor de clonación futuro. Las voces de las razas
   viven como audio más la ficha de diseño, y nunca quedan atadas a un formato.
5. **Una raza inventada no la da el modelo: la da una cadena de efectos.** Qwen3-TTS solo sabe hacer voces
   humanas. Pedirle «etérea» o «mineral» produce, como mucho, una persona susurrando o con voz grave. La
   identidad de cada raza sale de dos capas:
   - una **voz humana base** diseñada con VoiceDesign;
   - una **cadena de efectos fija por raza** (filtros, reverberación, coro, desplazamiento de formantes),
     aplicada al reproducir.

   Esto además evita la deriva hacia voces infantiles (ver abajo).
6. **La fauna no es TTS.** Un modelo de voz no hace gruñidos creíbles. Los sonidos de criaturas se
   preparan **en desarrollo**, no en la máquina del jugador: librerías de sonido CC0 más una cadena de
   efectos por especie (ver «Fauna»).

Sobre las opciones descartadas del prompt: de acuerdo con descartar Piper y Kokoro como motor principal,
y con descartar MOSS-TTS-Local y VibeVoice por peso. Solo un matiz: Piper o Kokoro quedan como **plan de
emergencia** si un equipo no da ni para el modelo de 0,6B (ver «Niveles»).

## Lo que no está claro (y cómo se resuelve)

| Duda | Estado | Qué hacer |
|---|---|---|
| El «instruct de 12 claves» | El README solo dice «instrucción libre de atributos (gender, age, pitch, style)». Las 12 claves **(sin verificar)** no están documentadas. | Usarlas como **plantilla propia** que se convierte en una frase. Si el modelo ignora alguna, se nota al probar y se quita. |
| Español | Qwen3-TTS anuncia 10-11 idiomas; que el español esté entre ellos **(sin verificar en el README)**. | Primera prueba: `--lang Spanish`. Si no está, las razas hablan en inglés o se busca otro motor solo para el español. |
| RTF ~1,3 en la Deck con CPU | **(sin verificar)**. El README no da cifras. | Medirlo en el Paso 3. Con Vulkan en la GPU de la Deck debería mejorar **(estimación)**. |
| Memoria con el LLM a la vez | En la Deck, Ollama (el narrador de Tarkor) y la voz compiten por los 16 GB. | Ver «Niveles»: modelo Base de 0,6B en la Deck y voz por cola, sin bloquear el turno. |

## Instalación en Steam Deck (SteamOS)

SteamOS es Arch con la raíz de solo lectura. No se toca: se compila en un contenedor `distrobox` y el
binario se usa desde el sistema normal (es un ejecutable autónomo).

```sh
distrobox create --name tts --image ubuntu:24.04
distrobox enter tts
sudo apt update && sudo apt install -y build-essential cmake git jq libvulkan-dev glslc libopenblas-dev
git clone --recurse-submodules https://github.com/ServeurpersoCom/qwentts.cpp ~/qwentts
cd ~/qwentts
./buildvulkan.sh        # GPU de la Deck; si da problemas: ./buildcpu.sh (CPU con OpenBLAS)
./models.sh             # descarga de modelos (revisar qué baja; ver la tabla)
```

| Archivo | Para qué | Tamaño (Q8_0) |
|---|---|---|
| `qwen-talker-1.7b-voicedesign-Q8_0.gguf` | Diseñar voces (solo en desarrollo) | 2,1 GB |
| `qwen-talker-1.7b-base-Q8_0.gguf` | Producir con clonación en un PC con GPU | 2,1 GB |
| `qwen-talker-0.6b-base-Q8_0.gguf` | Producir en la Deck y en equipos modestos | ~1 GB |
| `qwen-tokenizer-12hz-Q8_0.gguf` | Códec, compartido por todos | 291 MB |

**Paso 3: medir antes de decidir nada.** Con `time` sobre una frase de unos 10 segundos, en CPU y en
Vulkan, con 0,6B y 1,7B. Esas cuatro cifras deciden los niveles.

## Diseñar la voz de una raza

### 1. Ficha de diseño (la plantilla de 12 claves, como texto)

Se guarda en `voice-generator/voces/<raza>/<voz>/diseno.json` y de ahí se arma la frase del `--instruct`:

```json
{
  "gender": "male", "age": "middle-aged adult", "pitch": "low", "speed": "slow",
  "volume": "moderate", "clarity": "clear", "fluency": "measured, deliberate pauses",
  "accent": "neutral", "texture": "dry, slightly rough", "emotion": "calm",
  "tone": "authoritative", "personality": "precise and formal",
  "semilla": 1234, "texto_prueba": "La ley de los obeliscos no admite excepciones."
}
```

→ `--instruct "male, middle-aged adult, low pitch, slow speed, moderate volume, clear, measured with
deliberate pauses, neutral accent, dry slightly rough texture, calm, authoritative tone, precise and
formal personality"`

### 2. Evitar la deriva infantil

La deriva aparece al pedir voces agudas, brillantes, «ligeras» o «pequeñas»: el modelo las asocia a
niños. Reglas:
- **Edad siempre explícita y adulta** (`adult`, `middle-aged`, `elderly`), incluso para razas «jóvenes».
- **Tono medio o grave en el diseño.** Si la raza debe sonar aguda o etérea, se sube después con efectos
  (desplazamiento de formantes y tono), nunca pidiéndolo al modelo.
- **Sin** `bright`, `cute`, `small`, `light`, `childlike`, `high-pitched`. En su lugar, `airy`, `breathy`,
  `soft-spoken` o `whispering`.
- Escuchar la toma de prueba con una frase larga y emotiva: es donde aparece la deriva.

### 3. Tomas, elección y fijado

```sh
cd ~/qwentts
voz=~/proyecto/voces/orcos/guerrero-1                        # carpeta de la voz
# instruct = las 12 claves en una frase (lo mismo hace voice-generator/scripts/disenar.sh)
jq -r '"\(.gender), \(.age), \(.pitch) pitch, \(.speed) speed, \(.volume) volume, \(.clarity), \(.fluency), \(.accent) accent, \(.texture) texture, \(.emotion), \(.tone) tone, \(.personality) personality"' \
  "$voz/diseno.json" > /tmp/instruct.txt
jq -r .texto_prueba "$voz/diseno.json" > /tmp/texto_prueba.txt
for s in 11 22 33 44 55; do
  ./build/qwen-tts --model models/qwen-talker-1.7b-voicedesign-Q8_0.gguf \
    --codec models/qwen-tokenizer-12hz-Q8_0.gguf \
    --instruct "$(cat /tmp/instruct.txt)" --lang Spanish --seed $s -o "$voz/toma-$s.wav" < /tmp/texto_prueba.txt
done
# eliges la mejor → referencia.wav, su texto → referencia.txt, y la fijas:
./build/qwen-codec --model models/qwen-tokenizer-12hz-Q8_0.gguf \
  --talker models/qwen-talker-0.6b-base-Q8_0.gguf -i referencia.wav     # → referencia.spk / .rvq
```

Los `.spk`/`.rvq` se extraen **con el modelo Base que vaya a usarse** (0,6B en la Deck, 1,7B en GPU).
Como se guarda el `.wav`, se vuelven a extraer cuando haga falta.

### 4. Producir

```sh
./build/qwen-tts --model models/qwen-talker-0.6b-base-Q8_0.gguf \
  --codec models/qwen-tokenizer-12hz-Q8_0.gguf \
  --ref-spk referencia.spk --ref-rvq referencia.rvq --ref-text referencia.txt \
  --lang Spanish --seed 7 -o frase.wav < frase.txt
```

O como servicio: `tts-server` (HTTP compatible con OpenAI, `POST /v1/audio/speech`) con las voces
registradas una vez (`POST /v1/audio/voices` con `spk_b64`/`rvq_b64`). Admite `response_format: "pcm"`
para empezar a sonar mientras se genera.

## Voces de ejemplo

La voz base es humana; la raza la ponen los efectos. Las razas de Tarkor y tres arquetipos reutilizables:

| Raza / arquetipo | Voz base (instruct) | Cadena de efectos al reproducir |
|---|---|---|
| **Orcos** (Tarkor) | male, adult, low pitch, moderate speed, loud, rough gravelly texture, strong chest resonance, gruff, direct | leve saturación, ecualización con graves, sin reverberación |
| **Goirntes** (Tarkor, «los del Orden») | male/female, middle-aged, low-moderate pitch, slow, clear, measured pauses, dry texture, authoritative, formal | sala pequeña de piedra (reverberación corta), sin efectos de tono |
| **Nabieus** (Tarkor, «casi sin voz audible») / arquetipo **sombra** | adult, moderate pitch, slow, very soft, whispering breathy texture, calm, distant | filtro paso alto, coro sutil, volumen bajo y reverberación larga y oscura |
| **Faerus** (Tarkor, cazadores bestiales) | adult, low pitch, fast, rough breathy texture, tense, terse | gruñido sumado al inicio de frase (capa de fauna), ecualización media |
| **Etérea** | adult female, moderate pitch, slow, soft, airy breathy texture, serene | formantes +2-3 semitonos, coro, reverberación larga y brillante |
| **Mineral** | adult male, low pitch, very slow, clear, dry gritty texture, stoic | formantes −3 semitonos, resonancia metálica corta, ecualización con medios duros |

Las cifras de los efectos son puntos de partida, a ajustar de oído.

## Niveles de hardware (el mismo motor, distinta talla)

| Nivel | Detecta | Motor | Modelo de producción | Uso |
|---|---|---|---|---|
| Mínimo (Steam Deck) | sin GPU dedicada, o con menos de 6 GB | `qwentts.cpp` Vulkan, o CPU si falla | Base 0,6B Q8_0 | frases cortas con cola; narraciones largas troceadas por frases |
| Medio | GPU dedicada de 6 GB o más | `qwentts.cpp` Vulkan/CUDA | Base 1,7B Q8_0 | todo en tiempo real |
| Emergencia | ni el 0,6B rinde | Piper o Kokoro con voces fijas | — | solo narración, sin voces por raza |

Lo que no cambia entre niveles: las fichas de diseño, los `.wav` de referencia y las cadenas de efectos.
Cambia solo qué modelo Base extrae el `.spk` y produce: **el diseño de las voces nunca se rehace.**

## Generar antes o en el momento

| Qué | Cuándo | Por qué |
|---|---|---|
| Frases fijas (guiones como el de Gistera, avisos del sistema, saludos y frases de combate por raza) | **En desarrollo**, una vez, con el modelo 1,7B, y se distribuyen como audio | Calidad máxima y coste cero en la máquina del jugador |
| Narración y diálogos que escribe el LLM | **En el momento**, en la máquina del jugador, frase a frase | El texto no existe hasta que se juega |
| Caché | Por `hash(texto + voz + modelo)` | La misma frase no se genera dos veces |

## Fauna y criaturas

1. Sonidos base de librerías **CC0** (Freesound filtrado por CC0, packs libres de derechos) o grabaciones
   propias. Se anota la licencia de cada archivo.
2. Una **cadena de efectos por especie** en un script (SoX o ffmpeg): cambio de tono, formantes,
   estiramiento, distorsión y capas. Siempre la misma, para que cada especie suene reconocible.
3. Unas pocas variantes por acción (ataque, herida, muerte, ambiente) y la reproducción elige una al azar.
4. Todo se prepara en desarrollo: nada de esto corre en la máquina del jugador.

Los modelos de audio generativo (Stable Audio Open, AudioLDM…) quedan fuera por sus licencias de pesos.
Con los de Stability, el uso comercial depende de los ingresos **(sin verificar los términos vigentes)**.
Se revisarán si sale uno Apache/MIT de calidad.

---

## Plan de implementación

1. **Banco de pruebas** (½ día): compilar con Vulkan y CPU, medir RTF con 0,6B y 1,7B en la Deck y probar
   `--lang Spanish`. *Hecho cuando* hay una tabla de tiempos real y se sabe si el español funciona.
2. **Primera voz de raza** (1 sesión): orco. Ficha, 5 tomas, referencia elegida, `.spk`/`.rvq` y 10 frases
   de prueba con el modelo Base. *Hecho cuando* las 10 frases suenan a la misma persona.
3. **Efectos por raza** (1 sesión): las cadenas de la tabla, ajustadas de oído y guardadas como datos
   (`voces/<raza>/efectos.json`).
4. **Servicio de voz** (ver «Acoplamiento»): `tts-server` como proceso local junto a Ollama, cola y caché.
5. **Resto de razas y frases fijas pregeneradas.**
6. **Fauna**: script de cadenas por especie y primeras especies de la Hondonada.

## Acoplamiento a Tarkor

Lo que hay: el backend (Fastify) narra con Ollama y manda la narración al frontend web por NDJSON; el
instalador distribuible (`docs/arquitectura/20-instalador-distribuible.md`) ya arranca Ollama como proceso
aparte. La voz entra igual: **otro proceso local, sin dependencia dura**.

```text
voice-generator/                         # implementado (VOZ-1…VOZ-5); ver su README.md
├── voces/                               # datos, versionados
│   ├── orcos/
│   │   ├── efectos.json                 # cadena de la raza (SoX ahora; Web Audio en el juego)
│   │   └── guerrero-1/{diseno.json, referencia.wav, referencia.txt}
│   └── narrador/                        # «raza» especial: sin efectos.json
│       └── principal/{diseno.json, referencia.wav, referencia.txt}
├── fauna/<especie>/{cadena.json, licencias.tsv}
└── scripts/
    ├── instalar.sh, banco.sh            # motor y modelos; velocidad y español en la Deck
    ├── disenar.sh                       # tomas con VoiceDesign a partir de diseno.json
    ├── fijar.sh                         # .spk/.rvq para el modelo Base del nivel
    ├── producir.sh, escuchar.sh         # frases con la voz fijada; efectos de la raza
    └── fauna.sh                         # cadenas SoX por especie
```

```text
backend
  narración lista (texto) ──► POST /saves/:id/voz {texto, hablante}      # nuevo, opcional
     hablante → voz (NPC → su raza y voz; narrador → «narrador»)
     caché hash(texto+voz+modelo) en uploads/audio/ ── si está, se devuelve
     si no: tts-server /v1/audio/speech (pcm en streaming) → se guarda en la caché
frontend
  reproduce con Web Audio aplicando efectos.json de la raza
  (BiquadFilter, ConvolverNode para la reverberación, playbackRate/desplazamiento de tono)
```

Decisiones:
- **La voz es opcional:** sin `tts-server` el juego funciona igual, en texto. Ajuste en Configuración
  (voz sí/no, volumen, voces solo del narrador).
- **Los efectos de raza en el frontend** con Web Audio cuestan casi nada y se pueden ajustar sin regenerar
  audio.
- **El narrador por frases:** la narración se trocea por puntos y cada frase va a la cola en cuanto el LLM
  la termina. Así suena antes de que acabe el turno.
- **Asignar la voz**: la raza no está en el modelo `Npc` de la base de datos, sino en el catálogo
  (`raza` de cada NPC en `worldCatalog.ts`, slug de `BERIG_RAZAS`). Al sembrar se lleva a una tabla
  `slug de NPC → raza` (o a un campo nuevo `Npc.raza`, con su migración), y con `Npc.genero` elige la voz
  base de la raza. Un NPC con nombre puede tener la suya propia en `voces/<raza>/<slug-del-npc>/`. Sin
  raza en el catálogo (fauna, NPC de apoyo), habla el narrador.

## Para otro juego o aplicación

Lo reutilizable es el patrón, no los datos:
1. **Ficha de diseño** (plantilla de 12 claves → instruct).
2. **Referencia de audio como fuente de verdad** de cada voz (independiente del motor).
3. **Modelo Base por niveles** de hardware, con el mismo motor.
4. **Efectos como datos** aplicados al reproducir (Web Audio, FMOD, Wwise o el mezclador del motor).
5. **Servicio local opcional** detrás de una API estilo OpenAI, con caché por `hash`.

En un motor nativo (Godot, Unity, Unreal) se enlaza la biblioteca C (`qwen.h`, ABI estable en C) en lugar
de usar el servidor HTTP.

## Fuentes

- [qwentts.cpp](https://github.com/ServeurpersoCom/qwentts.cpp): README (VoiceDesign solo en 1,7B, `--instruct`, `qwen-codec --talker` → `.spk`/`.rvq`, `--ref-spk`/`--ref-rvq`, `tts-server` compatible con OpenAI, ABI en C), scripts `buildcpu.sh`/`buildvulkan.sh`, licencia MIT.
- [Qwen3-TTS GGUF (Serveurperso)](https://huggingface.co/Serveurperso/Qwen3-TTS-GGUF): tamaños de los archivos y licencia Apache 2.0 del modelo y el códec.
- [Gigazine: Qwen3-TTS de código abierto](https://gigazine.net/gsc_news/en/20260123-qwen3-tts-family-opensource) y [Better Stack: guía de Qwen3-TTS](https://betterstack.com/community/guides/ai/qwen3-tts/): familia VoiceDesign / CustomVoice / Base, Apache 2.0.
- Tarkor: `backend/src/services/berigLore.ts` (rasgos de las razas), `docs/arquitectura/20-instalador-distribuible.md`.
