# Retro y opt-tokens · `claude/interfaz-imagenes` (2026-10-25)

**Estado:** aprobada entera por la usuaria (2026-10-25) y aplicada en la rama: 1 → `QA-228`, 2 → `QA-229`,
3 → `QA-230`, 4 → `QA-231`, 5 → `QA-232` (también en `.githooks/commit-msg`), 6 → `QA-233`. Los puntos 4 y 5
quedan además para Galivelop-workflow (abajo).

Sesión de `CFG-43` (interfaz del generador, todo por elemento en `generated/`, lista de la enciclopedia), el roadmap
`IMG` y `opt-ai` de imágenes, sobre el final de `claude/imagenes-local`: 698 llamadas, 9 compactaciones, contexto
medio 115k (suelo ~66k, techo ~163k por tramo, lo previsto con la ventana de 200k). Toda la principal con Opus; 4
subagentes (3 con Opus, 1 con Sonnet). 29 imágenes leídas. La revisión de código antes de `main` dio 17 hallazgos,
todos arreglados en `385f5ad7`.

## Lo que salió mal

- **La lista de elementos se dio por completa tres veces sin serlo.** Primero 121 (solo lo que tenía prompt), luego
  853 (las secciones de primer nivel de la enciclopedia) y al final 2.550, cuando la usuaria vio que de clases solo
  salía Cazador. Se comprobaba contra lo que la propia función devolvía, no contra la lista de tipos que el juego
  ilustra (`ImagePromptEntityType`): faltaban variantes por sexo, de raza y de tiempo, mapas de `zona`, habilidades,
  clases y especializaciones.
- **La usuaria no vio las fases antes de `main`** y preguntó si se estaban saltando. No: la rama no había ido a
  `main`; pero la bitácora no decía en qué fase estaba.
- **Un push rechazado por la fecha de «Actualizado»** de la bitácora obligó a rehacer dos commits sin subir
  (`reset --soft`); el pre-push lo detecta tarde, cuando ya hay commits encima.

## Propuestas, de más a menos peso

1. **Comprobación de que la lista cubre todos los tipos de imagen** (comprobación automática, del proyecto). Un test
   en `test_interfaz_imagenes.py` que lea la unión `ImagePromptEntityType` de
   `backend/src/services/imagePromptGenerator.ts` y falle si `catalogo()` no puede dar alguno de esos tipos (con una
   enciclopedia de ejemplo con una ficha de cada sección). Si el juego añade un tipo, el test se pone rojo en vez de
   esperar a que la usuaria lo eche en falta. Coste: bajo. Riesgo: ninguno.
2. **Mapa del agente: la interfaz del generador** (navegación y opt-tokens, del proyecto). `servidor.py` se leyó 43
   veces (962k tokens arrastrados, la lectura más cara) y `01-generacion-imagenes-local.md` 24 (895k). La sección
   «Imágenes» de `docs/mapa-agente.md` sigue diciendo `pruebas/<tanda>/`: pasaría a `generated/<tipo>/<slug>/` y
   añadiría las entradas de `servidor.py` (`catalogo`, `elementos`, `Trabajo.lanzar`, `leer_progreso`, `elegir`),
   `index.html` (`elegirElemento`, `traerPrompt`, `pintarGaleria`), `abrir.sh` y su test. Coste: bajo. Riesgo:
   ninguno (`mapa-agente.py` comprueba las rutas).
3. **Resumen en texto de la interfaz en vez de capturas** (opt-tokens, del proyecto). 29 imágenes (~1.600 tokens cada
   una, arrastradas): parte eran capturas de la propia página para ver si la lista o el progreso salían bien. Un
   `image-generator/interfaz/resumen.py` que pida `/api/elementos` y `/api/estado` y dé en unas líneas los elementos por
   tipo, el aviso y el estado del trabajo; la captura, solo para lo visual. Ahorro estimado: ~0,5-1M tokens
   arrastrados por sesión de interfaz. Riesgo: no ver un fallo de maquetación; contrapeso, una captura al cerrar.
4. **La fila de la bitácora dice la fase antes de `main`** (flujo, general → Galivelop-workflow). Cuando una tarea se
   cierra y queda ir a `main`, la fila pone «fase 1/2/3 pendiente» o «hecha (commit)»; así la usuaria ve en qué punto
   está sin preguntar. Se propone al flujo (abajo).
5. **La fecha de «Actualizado» en el commit, no en el push** (comprobación, general → Galivelop-workflow). Que
   `bitacora.py check` corra en `commit-msg` (`.githooks/`, hay que pedir permiso para tocarlo) para que el aviso
   llegue antes de apilar commits. Se propone al flujo (abajo).
6. **Subagentes con Opus para trabajo mecánico** (opt-tokens, usar `selector`). Tres de cuatro subagentes fueron con
   Opus; el de reescribir la interfaz con un plan cerrado fue con Sonnet y salió bien. Nada nuevo: aplicar `selector`
   al lanzar cada uno.

## For Galivelop-workflow

- La fila de tarea de la bitácora lleva el estado de las fases antes de la rama protegida (punto 4).
- `bitacora.py check` también en `commit-msg`, no solo en `pre-push` (punto 5).
