# Retro y opt-tokens · `claude/wonderful-volta-662qt8` (2026-10-25)

**Estado:** pendiente de la decisión de la usuaria.

Sesión de `VOZ-1`…`VOZ-6`. Se montó `voice-generator/` como `image-generator/` (scripts, fichas, efectos y
`roadmap-voces.md`), se dejó en pausa hasta traer el repo aparte de la usuaria y se lleva a `main`.

Cifras de `medir.py --since 04f693a`:
- 92 llamadas y 4 compactaciones;
- contexto medio de 117k, con techo de 143k por tramo, lo previsto con la ventana de 200k;
- la sesión principal, toda con Opus;
- 1 subagente, la revisión de código, también con Opus: 13 llamadas y 59k de arranque.

La revisión previa a `main` dio 21 hallazgos sobre unos scripts que no se habían ejecutado nunca. Se arreglaron 19 en
`a0a241c`; los 2 leves, la duplicación entre scripts, quedan en la bitácora.

## Lo que salió mal

- **Algunos scripts estaban rotos y no se habría visto sin ejecutarlos.** Cuatro casos:
  - `lanzar` dejaba a `qwen-tts` sin el texto: en segundo plano, bash le da `/dev/null` como entrada;
  - `fijar.sh` cambiaba la voz en git aunque fallara el codec;
  - `banco.sh` copiaba como referencia una toma a medias;
  - `instalar.sh` compilaba sin `Release`.

  Ningún test ejecutaba los scripts: solo había tests de `voces.py`.
- **Se releyeron documentos largos:**
  - el doc 02 de voces, 8 veces (83k arrastrados);
  - el `README.md` de `image-generator/`, 4 veces (93k);
  - `21-roadmap.md`, 12 veces (74k).

  `docs/mapa-agente.md` no tiene una sección de voces, y `cobertura.py` no tiene ninguna opción para sacar la fila de
  una tarea.

## Propuestas, de más a menos peso

1. **Simulacro de `voice-generator/` con binarios falsos** (comprobación automática, del proyecto).
   - **Qué:** un test en `tools/qa/tests/` que ponga en el `PATH` unos `qwen-tts`, `qwen-codec` y `sox` falsos (que
     escriben un wav y fallan cuando se les pide) y corra `fijar.sh`, `producir.sh` y `banco.sh` de punta a punta.
   - **Qué cazaría:** los cuatro fallos de arriba antes de la revisión.
   - **Cuándo:** como el código se rehará con el repo de la usuaria, entra como paso de `VOZ-6` en
     `roadmap-voces.md` y se escribe sobre los scripts que lleguen.
   - **Coste ahora:** una línea en el roadmap.
2. **Sección «Voces» en `docs/mapa-agente.md`** (navegación, del proyecto; también ahorra tokens).
   - **Qué:** igual que la de «Imágenes». Señala:
     - las secciones del doc 02;
     - los scripts de `voice-generator/scripts/` y sus órdenes;
     - las órdenes de `voces.py` (`comprobar`, `instruct`, `texto`, `semilla`);
     - `roadmap-voces.md`.
   - **Ahorro:** unos 80-170k tokens arrastrados por sesión que toque las voces.
   - **Riesgo:** que se quede vieja cuando llegue el repo. Lo compensa `mapa-agente.py`, que comprueba las rutas, y
     el paso de `VOZ-6`, que la pone al día.
3. **`cobertura.py --fila <ID>`** (herramienta, del proyecto).
   - **Qué:** saca solo la línea o las líneas de `21-roadmap.md` y del roadmap de la tarea donde aparece el id, con el
     número de línea. Así se edita sin `sed`/`grep` a ciegas sobre 407 líneas.
   - **Ahorro:** unos 70k arrastrados por tarea que toque el mapa de roadmaps.
   - **Riesgo:** ninguno; lleva su test en `tools/qa/tests`.

## Para Galivelop-workflow

- Nada nuevo: el patrón de la propuesta 1 (ejecutar los scripts con binarios falsos) ya está en el flujo como «lo
  comprobable lo hace un script».
