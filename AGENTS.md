<!-- galivelop-workflow v0.4.3 -->
# World-Maker-Fantasy — instrucciones para agentes

Este proyecto se trabaja por relevos desde **dos cuentas de Claude** (y OpenCode para el lore): una sesión puede
acabarse en cualquier momento (tokens, contenedor, cambio de cuenta) y la siguiente tiene que seguir **sin perder nada
y sin preguntar por dónde iba**. Todo lo de este archivo existe para eso. El flujo es Galivelop-workflow (versión en
la primera línea): scripts en `.claude/gw/scripts/`, skills en `.claude/skills/` y configuración en `.claude/gw.json`.

## Al empezar cualquier sesión

1. Lee la bitácora, [`docs/registros/traspaso.md`](docs/registros/traspaso.md): rama, tarea en curso, qué falta y
   siguiente paso. Tu fila y los últimos commits, con `python3 .claude/gw/scripts/recuperar.py --estado`; el archivo
   entero, solo si falta algo (`QA-261`).
2. `git fetch origin <rama>`: el último commit coincide con la bitácora, y el check está en verde antes de tocar nada
   (`python3 .claude/gw/scripts/config.py get check`).
3. Sigue por el **siguiente paso** de la bitácora, salvo que la usuaria pida otra cosa.
4. **Al empezar cada tarea y al fusionar cada PR, trae `main`** (`QA-72`), aunque parezca al día:
   `git fetch origin main` y, si trae commits, `git merge origin/main` (merge, nunca rebase: las ramas están subidas).
   Si el conflicto toca la misma lógica por los dos lados o dos migraciones, se para y se consulta a la usuaria.
5. Al empezar cada tarea, aplica la skill `selector` y sigue el flujo de skills de una tarea (diseño, prototipo,
   bugs, PR, retro) de [`docs/runbooks/skills-y-modelos.md`](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea).
6. **La sesión se abre con el repo como carpeta de trabajo**; en otra no carga `.claude/settings.json` (ni sus
   ganchos): dilo a la usuaria, y mientras, `git config core.hooksPath .githooks` y la marca de revisión y el CI a mano.

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
- Commit + push (`git push -u origin <rama>`, en segundo plano; por red, reintentos a 2, 4, 8 y 16 s) en cada punto
  estable: **nunca más de 30-45 minutos sin subir**, y **la bitácora en el mismo commit** que el trabajo. Algo a
  medias o en rojo se sube igual, con `WIP:` delante y en la bitácora qué falla y por qué.
- **Tras una llamada interrumpida o rechazada, `git status` y `git diff` antes de repetirla** (`QA-48`): el cambio
  puede haberse guardado, o incluso subido, y repetirlo lo duplica.
- Si la usuaria dice que se para, se para: se sube lo que haya, se deja la bitácora al día y no se sigue con nada más.
- **Al cerrar cada tarea o PR** (y cada fase), con todo subido y la bitácora al día, se pide a la usuaria un `/clear`
  en una línea, con el porqué: el contexto largo es casi todo el gasto, y la bitácora basta para retomar.
- **Al cerrar cada bloque o fase, mira el CI de la última subida.** Uno que no arranca (sin cuota, sin runners) es
  rojo: se dice a la usuaria, y el check local del mismo commit (`pre-push`, o `tools/qa/ci-local.sh`, `QA-215`) vale
  **solo si ella lo confirma**, apuntado como «comprobado solo en local»; uno que arrancó y falló, nunca.

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

- **El check del proyecto** es la lista `check` de `.claude/gw.json` (cada orden con npx pasa por `tools/qa/host.sh`,
  el sandbox Flatpak de la Deck, `QA-180`); `.githooks/pre-push` lo corre con los tests de lo que cambia, y el CI
  (`.github/workflows/ci.yml`) añade los tests completos.
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
- **Cada sesión, su propia rama** (`QA-136`): dos sesiones a la vez nunca suben a la misma. Si la de la bitácora ya la
  usa otra, crea `claude/<tema>` desde ella con su fila «Tarea en curso · `<rama>`» y escribe solo en esa fila; vuelve
  por `git merge` antes del PR. Para tocar una fila compartida (`QA-145`), `BITACORA_COMPARTIDA=1 git push`.
- Merge, nunca rebase: las ramas están subidas.
- **A `main` solo con confirmación de la usuaria**, apuntado en la bitácora, por pull request (`pushToProtected: pr`;
  los ganchos piden la marca de revisión), y **se fusiona solo con el CI en verde**, también con «fusiona
  directamente»: eso quita esperar revisiones, nunca el CI ni la retro presentada a la usuaria (`QA-95`).
- **Casos especiales**, en [`ramas-y-main.md`](docs/runbooks/ramas-y-main.md): «lleva a `main`» con la usuaria fuera
  (`QA-238`), cuota de Actions agotada (`QA-215`), PR de una sesión local (`QA-285`, con `gh`; «PR listo» sin él), tareas `INS-*`
  (`QA-259`) y la rama de un subagente (`tools/qa/fusionar.sh`).

## Antes de ir a `main`: tres fases

Nunca sobre trabajo ya fusionado (`QA-77`). Detalle en el
[paso 6 del runbook](docs/runbooks/skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea) (usuaria, 2026-10-21, `QA-183`).

1. **Código:** `git fetch origin main` y `/code-review --max-findings all` del diff contra `origin/main`, con el
   criterio de `REVIEW.md`. Arreglos con commit y subidos: lo grave o medio y lo que el propio arreglo rompe; lo leve
   se apunta como pendiente en la bitácora. Lo que casa con `content` de `.claude/gw.json` es contenido, no código.
2. **Entorno:** `/opt-ai` si hubo tandas con Ollama real (`QA-142`), `/opt-tokens` y `/retro`, que revisa también
   `opt-tokens`. Sus propuestas se **presentan a la usuaria**; lo que confirme se aplica en la rama.
3. **Cierre:** si la fase 2 trajo código, `/code-review --max-findings all` solo de esos commits y sus arreglos; luego
   `bash .claude/gw/scripts/revisado.sh --footer "Siguiente: <paso>"` (el `commit-msg` pide esa línea; escribe la
   marca, `.claude/revision-main.sha`, y hace su commit; sin retro decidida no hay marca, `requireRetro`) y
   `git push`; la descripción con la skill `pr`. Solo entonces se crea el PR. Sin la marca del mismo commit, los
   ganchos lo rechazan (`QA-50`).

## La bitácora (`docs/registros/traspaso.md`)

Al día siempre: hito y fase, cada rama con su fila «Tarea en curso · `<rama>`» (la tarea, lo que falta y el siguiente
paso; ≤600 caracteres, `bitacora.py`, `QA-69`), estado de los tests, decisiones de Álvaro que bloquean algo, y
«Hecho recientemente» con las tareas cerradas.

## Subagentes

**Reparto a subagentes autorizado:** el trabajo de más de un paso se reparte a subagentes de contexto limpio con la
skill `orchestrate-dealer` (y los modelos que elija la skill `selector`) sin preguntar cada vez; la sesión principal
planea, decide y revisa. Esta línea es la autorización que piden las instrucciones del propio agente.

- Cada subagente recibe un encargo: objetivo, rutas, restricciones, el check que debe pasar y qué tiene que devolver.
- Otros repositorios se leen con un subagente que devuelve un resumen con rutas; desde aquí nunca se modifican.

## Las skills del flujo en este repositorio

Lo propio de WMF de cada skill (diseño contra `designReferences` con X4 de guía, `prototype`, `domain-modeling`,
`pr`, el tamaño de las tandas de `orchestrate-dealer`, `opt-ai`…) está en
[`skills-wmf.md`](docs/runbooks/skills-wmf.md): léelo al aplicar cualquiera de ellas.

## Reglas del proyecto

- Instalar: `cd backend && npm ci`, `cd frontend && npm ci`. Tras un reinicio del contenedor,
  `.claude/hooks/entorno-nube.sh` levanta Postgres (con pgvector, base `tarkor`) y el Ollama simulado (`QA-10`).
- **El lore no lo edita un agente**: nunca se toca `docs/rpgtarkor/` ni otro `.md` de lore ya existente salvo que
  la usuaria pida pasar lo aprobado al canon; ver abajo. Los borradores de Álvaro (`docs/borradores-opencode/`) no se
  commitean desde Claude Code (`protectedPaths`, `QA-144`).

### Sesiones de lore

En toda sesión sobre diseño o lore del mundo (facciones, razas, construcciones, historia, personajes, sistemas
narrativos: cualquier tema de `docs/rpgtarkor/`), **lee antes [`sesion-de-lore.md`](docs/runbooks/sesion-de-lore.md)**:
dónde va la propuesta (`docs/borradores-opencode/propuestas-lore.md`, `SIN REVISAR`, sin borrar entradas), dónde está
el canon (`docs/canon-opencode/00-nucleo.md` siempre) y el estilo del mundo. El canon de `docs/rpgtarkor/` lo cambia
solo Álvaro, tras revisar la propuesta (`docs/runbooks/ampliar-lore.md`); la sesión de lore deja el código como está.
