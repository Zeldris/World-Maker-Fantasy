# Reddit: 349 llamadas en 24 horas y el archivo de traspaso leído 39 veces

Perfil propio (`## Reddit` en `ficha.md`). Imagen: la tarjeta de métricas.

## es

**Título:** Medimos una sesión larga de agente de IA: 349 llamadas en 24 h, y lo que más pesó fue releer el mismo archivo
Imagen: medios/metricas.webp

Trabajamos con agentes de IA (Claude Code, entre otros) y el proyecto se pasa de una sesión a otra por un archivo de
traspaso: rama, tarea en curso, qué falta y siguiente paso. Revisamos dónde se fueron los tokens de una sesión larga y
esto salió:

- Una sola sesión, sin subagentes de trabajo, encadenó tres pull requests: **349 llamadas en 24 horas**.
- **25 compactaciones** de contexto; contexto medio de **113k** (suelo medio 93k, techo medio 138k) con una ventana de 200k.
- Lo más arrastrado: el archivo de traspaso, **leído 39 veces (305k)**, y una página de documentación (**144k**).
- La causa: no cortar entre tareas. No era el código, era releer lo mismo una y otra vez.

**Qué cambiamos** (está escrito en las instrucciones de los agentes):

- El trabajo de más de un paso se reparte a subagentes de contexto limpio; la sesión principal planea, decide y revisa.
- Al cerrar cada tarea o PR se pide empezar de cero con `/clear`: el contexto largo es casi todo el gasto, y el archivo
  de traspaso basta para retomar.
- Al empezar, un script devuelve solo la fila de la rama propia y los últimos commits; el archivo entero se lee solo si
  falta algo.

Ojo con lo que no sabemos: son cifras de una sola sesión y un solo proyecto, medidas por nosotros, y no
cifran cuánto ahorra el cambio.

¿Cuántas veces relee vuestro agente el mismo archivo? ¿Cortáis entre tareas o dejáis que la sesión compacte?

El flujo completo está en el repositorio: https://github.com/Zeldris/World-Maker-Fantasy

## en

**Title:** We measured a long AI agent session: 349 calls in 24 h, and what weighed most was re-reading the same file
Imagen: medios/metricas.en.webp

We work with AI agents (Claude Code, among others) and the project passes from one session to the next through a
handoff file: branch, current task, what's left and next step. We reviewed where the tokens of a long session went and
this is what came out:

- A single session, with no working subagents, chained three pull requests: **349 calls in 24 hours**.
- **25 context compactions**; average context of **113k** (average floor 93k, average ceiling 138k) with a 200k window.
- What was dragged along the most: the handoff file, **read 39 times (305k)**, and one documentation page (**144k**).
- The cause: never cutting between tasks. It wasn't the code, it was re-reading the same thing over and over.

**What we changed** (it's written into the agents' instructions):

- Work of more than one step goes to clean-context subagents; the main session plans, decides and reviews.
- When each task or PR closes, we start fresh with `/clear`: a long context is almost all of the cost, and the handoff
  file is enough to pick up again.
- At startup, a script returns only the row for the session's own branch and the latest commits; the whole file is read
  only if something is missing.

What we don't know: these are figures from a single session and a single project, measured by us, and they
don't say how much the change saves.

How often does your agent re-read the same file? Do you cut between tasks or let the session compact?

The whole workflow is in the repository: https://github.com/Zeldris/World-Maker-Fantasy
