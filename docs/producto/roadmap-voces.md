# Roadmap del generador de voces — Tarkor

**Creado:** 2026-10-25 (usuaria). **Qué cubre:** voces por raza y sonidos de fauna en local (`voice-generator/`:
qwentts.cpp con Qwen3-TTS y SoX para los efectos), primero como herramienta de desarrollo y después dentro del
juego. Diseño, decisiones y fuentes en
[`02-voces-y-sonidos-locales.md`](../arquitectura/reutilizables/02-voces-y-sonidos-locales.md); cómo se usa, en
[`voice-generator/README.md`](../../voice-generator/README.md).
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días).

La fase V-A se hizo como excepción a la regla de las pruebas de juego (usuaria, 2026-10-25): son herramientas de
desarrollo que no tocan el juego ni el backend. Los scripts se escribieron en la nube, sin modelos ni Deck: **lo
que depende del motor lo prueba la usuaria en la Deck** y, hasta entonces, cada tarea queda 🚧.

## Fase V-A · Herramientas de desarrollo (pasos 1-3 del documento y la fauna)

- **VOZ-1 · Instalar el motor y los modelos** [A] (usuaria, 2026-10-25): `voice-generator/scripts/instalar.sh`
  clona qwentts.cpp, lo compila con Vulkan y con CPU (OpenBLAS) en carpetas aparte dentro de un distrobox con
  Ubuntu 24.04, y baja los cuatro GGUF de Hugging Face a un `.part` que se renombra al acabar. **S**
  🚧 2026-10-25: script hecho. Falta en la Deck: que compile y cargue con Vulkan, y que los nombres de los GGUF
  sigan siendo los del documento (desde la nube no se llega a huggingface.co).
- **VOZ-2 · Banco de pruebas en la Deck** [A] (usuaria, 2026-10-25; paso 1 del documento): `banco.sh` mide
  VoiceDesign 1,7B y los Base 0,6B y 1,7B en Vulkan y CPU, con frase corta y larga: segundos de audio, ms, RTF,
  memoria libre mínima y si el modelo conoce `Spanish`, en `generated/banco/<fecha>/banco.tsv`. Con las cifras se
  decide el modelo Base de cada nivel de hardware y se apuntan en el documento 02. **S**
  🚧 2026-10-25: script hecho. Falta en la Deck: correrlo, escuchar si suena a español y apuntar las cifras.
- **VOZ-3 · Diseñar, fijar y producir una voz** [A] (usuaria, 2026-10-25; paso 2 del documento): fichas
  `voces/<raza>/<voz>/diseno.json` con las 12 claves (`voces.py` rechaza la deriva infantil), `disenar.sh` (5
  tomas con VoiceDesign), `fijar.sh` (la elegida a `referencia.wav`, en git, y el `.spk`/`.rvq` del Base) y
  `producir.sh` (las 10 frases de `frases-prueba.txt` con la voz fijada). Primeras fichas: `orcos/guerrero-1` y
  `narrador/principal`. Hecho cuando las 10 frases suenan a la misma persona. **M**
  🚧 2026-10-25: scripts y fichas hechos, `voces.py comprobar` en los tests (`test_voces.py`). Falta en la Deck:
  las tomas, elegir y subir las dos `referencia.wav`, y escuchar las frases.
- **VOZ-4 · Efectos por raza como datos** [A] (usuaria, 2026-10-25; paso 3 del documento):
  `voces/<raza>/efectos.json` (orcos, goirntes, nabieus, faerus), una lista de efectos con nombre que `voces.py`
  pasa a SoX y que el juego aplicará con Web Audio (`VOZ-10`); `escuchar.sh` los pone a una toma o frase. **M**
  🚧 2026-10-25: datos y `escuchar.sh` hechos, probados con SoX sobre tonos de prueba. Falta: ajustarlos de oído
  en la Deck, y lo que SoX no hace (formantes, la capa de gruñido de los faerus, los arquetipos «etérea» y
  «mineral»), que se decide al llegar a Web Audio.
- **VOZ-5 · Sonidos de fauna** [A] (usuaria, 2026-10-25; doc 02, «Fauna y criaturas»): `fauna.sh` aplica la cadena
  de cada especie (`fauna/<especie>/cadena.json`) a sonidos base CC0 o propios (`licencias.tsv`, los demás no se
  usan) y saca variantes reproducibles de tono y tempo para ataque, herida, muerte y ambiente. **M**
  🚧 2026-10-25: script y `fauna/_plantilla/` hechos, probados con sonidos sintéticos. Falta: elegir las primeras
  especies (de la Hondonada) y sus sonidos CC0, y escucharlas en la Deck.
- **VOZ-6 · Interfaz de pruebas de voces** [P] (usuaria, 2026-10-25): como la de `image-generator/` (`CFG-43`):
  elegir raza y voz, generar tomas, escucharlas con y sin efectos, apuntar notas y fijar la elegida. Más adelante:
  por ahora basta la terminal. **M**

## Fase V-B · La voz en el juego

Opcional y sin dependencia dura: si el servidor de voz no está, el juego sigue sin voz (doc 02, «Acoplamiento a
Tarkor»).

- **VOZ-7 · Servidor de voz como proceso aparte** [P]: `tts-server` de qwentts.cpp con el modelo Base del nivel,
  arrancado como Ollama por el instalador distribuible; se detecta y, si falta, no hay voz. **M**
- **VOZ-8 · `POST /saves/:id/voz` con caché** [P]: el backend pide el audio de una narración al servidor de voz
  (`/v1/audio/speech`, en streaming) y lo guarda por `hash(texto + voz + modelo)` en `uploads/audio/`; si ya está,
  lo devuelve sin generar. **M**
- **VOZ-9 · Qué voz habla** [P]: el NPC habla con la voz de su raza (o la suya propia, si tiene carpeta en
  `voces/<raza>/<slug-del-npc>/`) según su raza y `Npc.genero`; la narración, con el narrador. Si necesita migración
  de BD, es puerta de un solo sentido. **M**
- **VOZ-10 · Efectos con Web Audio** [P]: el frontend reproduce el audio aplicando el `efectos.json` de la raza
  (BiquadFilter, ConvolverNode, desplazamiento de tono), incluidos formantes y capas. Depende de `SON-1`. **M**
- **VOZ-11 · Frases fijas con el 1,7B** [P]: las frases que no cambian (saludos, gritos de combate, avisos) se
  generan una vez en desarrollo con el Base 1,7B y van con el juego, para que suenen mejor también en el nivel más
  bajo. **S**
