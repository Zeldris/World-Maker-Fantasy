# Retro del PR de la ronda `QA-105` (2026-10-19)

Lo revisado: lo que entra con el PR a `main` de la rama `claude/wonderful-volta-662qt8` desde el anterior: la ronda
`QA-105` (P215-P235, 30 compactaciones), los arreglos de los subagentes, ~~`CR-70`~~…~~`CR-72`~~ al roadmap,
~~`QA-122`~~, el `/code-review` previo (10 puntos, 9 arreglados) y las skills `opt-tokens`, `retro` y `/code-review`.

**Estado (2026-10-19): aprobadas todas por la usuaria y aplicadas en la rama antes del PR**, como ~~`QA-123`~~ (A),
~~`QA-124`~~ (B), ~~`QA-125`~~ y ~~`QA-128`~~ (C y 4), ~~`QA-126`~~ (1), ~~`QA-127`~~ (3) y `proyecto.md` al día (2).
La usuaria añadió dos: ~~`QA-129`~~ (`opt-tokens` busca ahorrar sin perder calidad) y ~~`QA-130`~~ (la `/retro`
revisa también las skills propias y el `/code-review`).

## A. Con 300k se compacta más tarde y el contexto medio sube

**Qué pasó.** Con el tope a 300k (`QA-122`), `medir.py` dio el techo de ~145k a ~220k y el medio de ~115k a ~150k:
cada llamada cuesta más y no hubo menos compactaciones útiles.

**Propuesta (economía).** Volver a 200k en `.claude/settings.json` y en los runbooks, con la cifra que lo justifica.

## B. La sesión principal jugó la ronda entera

**Qué pasó.** 1.295 llamadas (1.150 Bash, 44 capturas) con el modelo grande, para pulsar botones y leer estado.

**Propuesta (modelo).** La ronda la juega un subagente `sonnet` con el escenario y la matriz; la principal reparte,
apunta los hallazgos y decide. La principal no corre `orden.sh`.

## C y 4. Las ayudas del driver fallaban y la salida se perdía

**Qué pasó.** `opcion` agotaba el tiempo (el número de la opción es `aria-hidden`) e `interactuar` no veía el
`menuitem` del menú del NPC; cada fallo eran varias llamadas a mano. Las respuestas largas de `orden.sh` se
recortaban y había que repetir la orden.

**Propuesta (herramientas).** `opcion` por `[data-opcion]`, `interactuar` con el `menuitem`, ayuda nueva `pelear`
(mover, interactuar, combatir) y `orden.sh` guarda la respuesta entera en `shots/ultima-respuesta.txt` y muestra 40
líneas. Falta estrenarlas en la próxima ronda.

## 1. Arreglos de subagente fusionados sin revisar

**Qué pasó.** El `/code-review` previo al PR encontró en los arreglos de P215-P220a fallos que una revisión corta al
fusionar cada uno habría visto antes (un llamante sin actualizar, un caso de raza).

**Propuesta (revisión).** `orchestrate-dealer`: el encargo pide buscar a todos los que usan lo que cambia, y cada
diff del worktree pasa un `/code-review` corto antes de fusionarse.

## 2 y 3. `opt-tokens` medía la sesión entera de golpe

**Qué pasó.** Con 30 compactaciones, la media de la sesión escondía la curva y el primer tramo a medias la bajaba.

**Propuesta (medida).** `medir.py` da medio y techo por tramo y el medio sin el primer tramo; `proyecto.md` apunta las
herramientas nuevas y el gasto de la ronda para no volver a proponerlas.
