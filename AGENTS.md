<!-- galivelop-workflow v0.2.0 -->
# World-Maker-Fantasy — instrucciones para agentes

Este proyecto se trabaja por relevos desde **dos cuentas de Claude** (y OpenCode para el lore): una sesión puede
acabarse en cualquier momento (tokens, contenedor, cambio de cuenta) y la siguiente tiene que seguir **sin perder nada
y sin preguntar por dónde iba**. Todo lo de este archivo existe para eso. El flujo es Galivelop-workflow v0.2.0; sus
scripts están en `.claude/gw/scripts/`, sus skills en `.claude/skills/` y su configuración en `.claude/gw.json` (solo
la lee `.claude/gw/scripts/config.py`).

## Al empezar cualquier sesión

1. Lee la bitácora, [`docs/registros/traspaso.md`](docs/registros/traspaso.md): rama, tarea en curso, qué falta y
   siguiente paso.
2. `git fetch origin <rama>` y comprueba que el último commit coincide con lo que dice la bitácora.
3. Comprueba que el check está en verde (y los tests como dice la bitácora) antes de tocar nada: las órdenes de
   `check` en `.claude/gw.json` (`python3 .claude/gw/scripts/config.py get check`).
4. Sigue por el **siguiente paso** de la bitácora, salvo que la usuaria pida otra cosa.
5. **Al empezar cada tarea y al fusionar cada PR, trae `main`** (`QA-72`), aunque parezca al día:
   `git fetch origin main` y, si trae commits, `git merge origin/main` (merge, nunca rebase: las ramas están subidas).
   Si el conflicto toca la misma lógica por los dos lados o dos migraciones, se para y se consulta a la usuaria.
6. Al empezar cada tarea, aplica la skill `selector` y sigue el flujo de skills de una tarea (diseño, prototipo,
   bugs, PR, retro) de [`docs/runbooks/skills-y-modelos.md`](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea).
7. **La sesión se abre con el repo como carpeta de trabajo.** Abierta en otra, no carga `.claude/settings.json`: ni el
   tope de compactación, ni el gancho de inicio, ni el que vigila la subida a `main`. Si pasa, dilo a la usuaria para
   que la reabra desde el repo; mientras tanto, `git config core.hooksPath .githooks` antes del primer commit y, antes
   de subir a `main` o de crear o fusionar un PR, comprueba a mano la marca de revisión del mismo commit y el CI en verde.

**Antes de buscar código de un sistema** (turno, zona, combate, reino, súbditos, Cronista, caza), abre
[`docs/mapa-agente.md`](docs/mapa-agente.md): funciones de entrada, tests, tablas, interfaz y qué no leer (`QA-108`).
Orden y fases de todo el trabajo: [mapa de roadmaps](docs/producto/21-roadmap.md#mapa-de-roadmaps), y la forma de
trabajo de cada plan de hito (p. ej. [`plan-roadmap-0.1.md`](docs/producto/plan-roadmap-0.1.md)).

## Relevos: commit y push constantes

Cada sesión corre en un contenedor temporal: **lo que no está subido a GitHub no existe** para la siguiente.

- **Al cerrar cada tarea** del roadmap (`UX-3`, `CR-12`, `ZON-10`…): commit + push en el acto, la tarea tachada en su
  roadmap y en el mapa de `21-roadmap.md`, y la bitácora actualizada.
- **El estado vive en los `.md`, no en la conversación** (usuaria, 2026-10-02): en el roadmap, junto al tachado,
  `✅ fecha` + qué se hizo y **qué queda pendiente** si se cerró solo en parte. Una tarea a medias se marca
  `🚧 en curso` con lo hecho y lo que falta.
- **Ninguna tarea sin hito** (usuaria, 2026-10-02): toda tarea nueva entra en una fase de su roadmap o en una fila de
  «Qué entra en cada hito» (`21-roadmap.md`); `python3 tools/roadmap/cobertura.py` tiene que dar «SIN HITO: 0».
- Commit + push en cada punto estable (check en verde). **Nunca más de 30-45 minutos de trabajo sin subir.** Las
  tareas grandes se parten en pasos pequeños con su propio commit.
- **La bitácora se actualiza en el mismo commit** que el trabajo que describe, no al final de la sesión.
- Si hay que parar con algo a medias o en rojo: commit igualmente con `WIP:` al principio del mensaje y, en la
  bitácora, qué falla y por qué. Nunca dejar trabajo solo en local.
- Push tras cada commit a la rama de trabajo (`git push -u origin <rama>`); si falla por red, reintentar con espera
  2, 4, 8 y 16 s.
- **Tras una llamada interrumpida o rechazada, `git status` y `git diff` antes de repetirla** (`QA-48`): el cambio
  puede haberse guardado, o incluso subido, y repetirlo lo duplica.
- Si la usuaria dice que se para, se para: se sube lo que haya, se deja la bitácora al día y no se sigue con nada más.
- **Al cerrar una fase** (o una tarea grande), con la bitácora al día, se recomienda `/clear` antes de la siguiente.
- **Al cerrar cada bloque o fase, mira el CI de la última subida.** Un CI que no arranca (sin cuota, sin runners)
  cuenta como rojo: se dice a la usuaria y no se da nada por comprobado en el CI.

## Pruebas de juego

**Hasta cerrar las pruebas, no hay roadmap** (usuaria, 2026-10-13). Ninguna tarea nueva del roadmap, ni se añaden
más, hasta que se haya probado jugando todo lo implementado (del `0.1` al hito en curso). Las dos cuentas juegan
rondas de pruebas y, en sesiones aparte, arreglan lo que sale y cierran lo que está a medias (p. ej. `QA-63`); la
ronda en sí solo juega y apunta (usuaria, 2026-10-20). Sí entran las tareas de las retros que apruebe la usuaria.

**Al volver al roadmap, cada tarea se prueba al momento**: se implementa, se pasan los tests y se juega lo que cambia
antes de darla por cerrada.

**Al jugar** (ronda de pruebas, «sigue probando», «juega»): quien lanza `orden.sh` (en una ronda repartida, el
subagente de cada tanda), antes de la primera acción, relee
[`docs/runbooks/rondas-de-pruebas.md`](docs/runbooks/rondas-de-pruebas.md) (`QA-56`). La sesión que reparte lee solo
«Qué se prueba» (`QA-209`).

## Comprobar

- **El check del proyecto** es la lista `check` de `.claude/gw.json`: tsc y lint de backend (con `prisma generate`) y
  frontend, `cobertura.py`, `mapa-agente.py` y `matriz-pruebas.py --comprobar`; cada orden con npx pasa por
  `tools/qa/host.sh` (sandbox Flatpak de la Deck, `QA-180`). `.githooks/pre-push` lo corre sobre el commit que se
  sube, y después los tests de lo que cambia (`relatedTests`: `tools/qa/tests-vitest.sh`). El CI completo
  (`.github/workflows/ci.yml`) corre además los tests de backend con Postgres, los de frontend y los de `tools/qa`.
- **Lo comprobable lo hace un script**, no un agente: si una regla se sigue rompiendo, se convierte en una comprobación.
- **Lo que depende de una máquina concreta no se da por probado con tests** (la Deck, Ollama real): se apunta como
  pendiente en el plan, con quién lo comprueba y dónde.
- Un test nuevo tiene que fallar sin su arreglo: `bash .claude/gw/scripts/rojo-sin-arreglo.sh "<orden del test>"
  <archivo-del-arreglo>...`. Un test que espera un fallo comprueba **el motivo**, no solo el código de salida.
- `python3 .claude/gw/scripts/doctor.py` dice si el flujo está bien montado, con la orden que arregla cada problema.

## Mensajes de commit

- Primera línea en español: qué cambia, con los identificadores de las tareas tocadas.
- Cuerpo: qué se hizo, qué queda de esa tarea si no está cerrada, y estado del check y de los tests.
- **Última línea: `Siguiente: <próximo paso concreto>`**, en el mismo bloque final que las líneas de atribución.

## Ramas y `main`

- Se trabaja en la rama que indique la bitácora (o la que asigne la sesión, que se apunta nada más empezar).
- **Cada sesión, su propia rama** (usuaria, 2026-10-20, `QA-136`): dos sesiones a la vez (las dos cuentas, la local y
  la de la nube) nunca suben a la misma rama. Si la rama de la bitácora ya la usa otra sesión, crea `claude/<tema>`
  desde ella, con su fila «Tarea en curso · `<rama>`», y escribe solo en esa fila. Lo suyo vuelve por `git merge`
  antes del PR a `main`. El pre-push rechaza tocar filas de otra rama o compartidas (`QA-145`); para una compartida
  (p. ej. añadir tu rama a «Ramas de trabajo»), `BITACORA_COMPARTIDA=1 git push`.
- Merge, nunca rebase: las ramas están subidas.
- **A `main` solo con confirmación de la usuaria**, y se apunta en la bitácora. Se pasa por pull request
  (`pushToProtected: pr`): un gancho de Claude Code pide la marca de revisión antes de crearlo o fusionarlo; un push
  directo la sigue pidiendo.
- **Se fusiona solo con el CI en verde** (usuaria, 2026-10-12), también cuando pide «fusiona directamente»: eso quita
  esperar a más revisiones, nunca el CI ni la retro presentada a la usuaria (`QA-95`).
- **«Lleva a `main`» con la usuaria fuera** (usuaria, 2026-10-25, `QA-238`): se deja todo a un paso (retro escrita,
  CI local en verde sobre la fusión con `main`, descripción en `docs/registros/pr/`) y se para antes de
  `revisado.sh`; su decisión sobre la retro es la confirmación que lo lleva a `main`, sin más preguntas.
- **Con la cuota de GitHub Actions agotada, a `main` sin PR** (usuaria, 2026-10-22, `QA-215`): las tres fases de
  abajo igual, pero en vez del PR, la nube fusiona la rama en `main` en un worktree, pasa
  `bash tools/qa/ci-local.sh <worktree>` (los tres jobs de `ci.yml`) hasta verde y sube con `git push origin HEAD:main`.
  Se apunta en la bitácora como «sin PR, CI local». Solo mientras dure la cuota agotada.
- **El PR de una sesión local lo crea Claude en la nube** (usuaria, 2026-10-21, `QA-184`): en la Deck no hay `gh` ni
  herramienta de GitHub. Tras la fase 3, la local sube la descripción a `docs/registros/pr/<rama>.md` y deja en su
  fila de la bitácora «PR listo» con el título, en el último commit; la nube comprueba que nada va detrás de ese
  commit, pasa `revisado.sh`, crea el PR y sigue con el CI y la fusión.
- La rama de un subagente vuelve con `bash tools/qa/fusionar.sh <rama> "<mensaje>" --revisada` (no la de `.claude/gw/scripts/`): la de WMF
  resuelve sola los conflictos del registro de hallazgos (`resolver_hallazgos.py`) y pasa los tests del paquete tocado.

## Antes de ir a `main`: tres fases

Nunca sobre trabajo ya fusionado (`QA-77`). Detalle en el
[paso 6 del runbook](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea) (usuaria, 2026-10-21, `QA-183`).

1. **Código:** `git fetch origin main` y `/code-review --max-findings all` del diff contra `origin/main`, con el
   criterio de `REVIEW.md`. Arreglos con commit y subidos: lo grave o medio y lo que el propio arreglo rompe; lo leve
   se apunta como pendiente en la bitácora. Lo que casa con `content` de `.claude/gw.json` es contenido, no código.
2. **Entorno:** `/opt-ai` si hubo tandas con Ollama real (`QA-142`), `/opt-tokens` y `/retro`, que revisa también
   `opt-tokens`. Sus propuestas se **presentan a la usuaria**; lo que confirme se aplica en la rama.
3. **Cierre:** si la fase 2 trajo código, `/code-review --max-findings all` solo de esos commits y sus arreglos; luego
   `bash .claude/gw/scripts/revisado.sh` (escribe la marca, `.claude/revision-main.sha`, y hace su commit; sin retro
   decidida no hay marca, `requireRetro`) y `git push`; la descripción con la skill `pr`. Solo entonces se crea el PR.
   Sin la marca del mismo commit, los ganchos lo rechazan (`QA-50`).

## La bitácora (`docs/registros/traspaso.md`)

Tiene siempre al día: rama de trabajo, hito y fase, tarea en curso con lo hecho y lo pendiente, último commit y estado
de los tests, siguientes pasos en orden, decisiones de Álvaro que bloquean algo, y los comandos para comprobar el
estado. Al cerrar una tarea, se mueve a «Hecho recientemente» (las 10 últimas). Cada rama tiene su fila «Tarea en
curso · `<rama>`» y solo escribe en la suya: la tarea actual, lo que falta y el siguiente paso, como mucho 600
caracteres (lo comprueba el push con `.claude/gw/scripts/bitacora.py`, `QA-69`).

## Subagentes

**Reparto a subagentes autorizado:** el trabajo de más de un paso se reparte a subagentes de contexto limpio con la
skill `orchestrate-dealer` (y los modelos que elija la skill `selector`) sin preguntar cada vez; la sesión principal
planea, decide y revisa. Esta línea es la autorización que piden las instrucciones del propio agente.

- Cada subagente recibe un encargo: objetivo, rutas, restricciones, el check que debe pasar y qué tiene que devolver.
- Otros repositorios se leen con un subagente que devuelve un resumen con rutas; desde aquí nunca se modifican.

## Las skills del flujo en este repositorio

Lo propio de WMF que las skills genéricas no dicen (todo en español):

- **Diseño** (`grilling`, `selector`; usuaria, 2026-10-07): toda ronda, también las de detalle, se contrasta con los
  `designReferences` de `.claude/gw.json` buscando cómo lo resuelven (`WebSearch`); **X4 marca el camino** siempre
  que se pueda, y la ronda acaba con las fuentes enlazadas. Si una pregunta pide decidir números o reglas que sobre
  el papel no se sienten, `prototype` con el enlace en esa pregunta.
- **`prototype`:** el HTML de lógica se queda en `docs/prototipos/<tarea>-<tema>.html` (no hay rama aparte); el
  veredicto, en la entrada de la tarea en su roadmap con el enlace.
- **`domain-modeling`:** `GLOSSARY.md` es el vocabulario del motor y del producto; el lore canónico vive en
  `docs/rpgtarkor/` y un término de lore se enlaza, no se redefine. ADR en `docs/adr/`.
- **`improve-codebase-architecture` y `retro`:** cada propuesta aceptada entra como tarea con hito en su roadmap.
- **`pr`:** título con los identificadores de las tareas; evidencia con los números de `tsc`, `vitest` y `oxlint` de
  backend y frontend y el test que cubre cada cambio importante; una migración de BD o un cambio de partidas
  guardadas es puerta de un solo sentido.
- **`orchestrate-dealer`:** el encargo apunta a la fila de la bitácora, el P-número del registro, la fila de la
  matriz y la función de `docs/mapa-agente.md`. Antes de repartir una tanda, la principal comprueba que el escenario
  da el estado que pide cada id (montura, lugar visitado, animal, convaleciente…); si falta, el primer trozo lo
  prepara (`QA-216`). Una tanda de juego, 6-8 hallazgos y ~60 llamadas; una de arreglos, como mucho 5
  hallazgos y ~90 llamadas, y la revisión con Opus junta dos tandas (`QA-257`). Al llegar la de juego,
  `tools/qa/escenario.sh guardar` y la siguiente lo carga (`QA-147`); si el encargo escribe en la partida, se prueba
  con `escenario.sh probar` (`QA-153`) y pasa por las funciones del juego que aplican esas reglas, sin rehacerlas a
  mano (`QA-151`). Los P-números de `FOUND` van al registro de la ronda y los de `TOOLS` a
  [`fallos-herramientas.md`](docs/registros/fallos-herramientas.md) (`QA-133`); con subagentes en paralelo, solo la
  principal escribe la bitácora y `docs/registros/pruebas-0.3-hallazgos.md` (`QA-132`).
- **`opt-ai` y `scout-updates`:** lo de WMF (Ollama real, `tools/qa/bench-ia.sh`, perfiles de la Deck) está en
  `.claude/gw/opt-ai.md` y `.claude/gw/scout-updates.md` (la memoria del scout sigue en `docs/scout/`); `opt-tokens`, en `.claude/gw/opt-tokens.md`.

## Reglas del proyecto

- Instalar: `cd backend && npm ci`, `cd frontend && npm ci`. Tras un reinicio del contenedor,
  `.claude/hooks/entorno-nube.sh` levanta Postgres (con pgvector, base `tarkor`) y el Ollama simulado (`QA-10`).
- **El lore no lo edita un agente**: nunca se toca `docs/rpgtarkor/` ni otro `.md` de lore ya existente salvo que
  la usuaria pida pasar lo aprobado al canon; ver abajo. Los borradores de Álvaro (`docs/borradores-opencode/`) no se
  commitean desde Claude Code (`protectedPaths`, `QA-144`).

### Sesiones de debate de lore

Cuando la conversación sea sobre diseño/lore del mundo (facciones, razas, construcciones, historia, personajes,
sistemas narrativos — cualquier tema de `docs/rpgtarkor/`), al llegar a una propuesta completa (no a mitad de debate,
solo cuando ya hay algo cerrado que proponer):

1. **Nunca edites directamente ningún archivo de `docs/rpgtarkor/`** ni ningún otro `.md` de lore ya existente. Esas
   ediciones las decide Álvaro tras revisar la propuesta, siguiendo el runbook de `docs/runbooks/ampliar-lore.md`.
2. En su lugar, **añade la propuesta a** `docs/borradores-opencode/propuestas-lore.md`, dentro de su categoría
   correspondiente (Facciones y diplomacia / Razas y cultura / Idiomas / Construcciones y reino / Historia y
   cronología / Fauna y flora / Personajes y NPCs / Otros). Lee el archivo completo antes de escribir y reescríbelo
   entero (todo lo que ya había + la entrada nueva) — **nunca sobrescribas ni elimines una entrada existente**.
3. Cada entrada nueva debe llevar cabecera con: fecha de hoy, tema tratado, y estado inicial `SIN REVISAR`.
4. Sé explícito en la propuesta: qué se propone exactamente, por qué (razonamiento, no solo la conclusión), y qué
   archivos de `docs/rpgtarkor/` tocaría si se aprueba — para que la revisión posterior sea rápida.
5. No toques código (`backend/src`, `frontend/src`) en ninguna sesión de lore salvo que se te pida explícitamente.

### Dónde está el canon (para el agente de lore)

Lee SIEMPRE `docs/canon-opencode/00-nucleo.md` antes de proponer nada: reglas duras, enums reales, escala de valor y
lista de comprobación. El resto de `docs/canon-opencode/` es el resumen del canon por región y por catálogo (ver su
`README.md`). Los originales completos están en `docs/rpgtarkor/`, que manda si algo choca.

### Estilo del mundo (aplica a toda propuesta de lore)

- Mundo fantástico con base científica — coherencia interna, sin magia como comodín sin explicación. Todo debe estar
  conectado narrativamente con lo ya establecido.
- Nunca uses el nombre de una especie/planta real reconocible para fauna/flora nueva, ni siquiera como base de un
  nombre propio.
- Antes de proponer un elemento nuevo, busca un equivalente ya existente en el catálogo como plantilla de qué
  campos/nivel de detalle hacen falta.
