# Skills y selector de modelo

**Para qué:** qué skills usa Claude en este proyecto, cuándo, y con qué modelo conviene trabajar
cada tipo de tarea. Petición de la usuaria (2026-10-04), tras revisar
[mattpocock/skills](https://github.com/mattpocock/skills).

**`.claude/skills/`, `.claude/hooks/` y `.claude/settings.json` están versionados** (decisión de la usuaria,
2026-10-04: subir las skills junto con lo que vaya a `main`); el resto de `.claude/` es local y está en el
`.gitignore` (`QA-112`). Una skill nueva se añade con `git add` normal. Si una skill no está cargada, se sigue su
descripción de aquí.

## Cómo se usa: el flujo de una tarea

Lo sigue cualquier sesión, de cualquiera de las dos cuentas. Cada skill se carga con la herramienta
Skill (no basta con nombrarla); `/grill-with-docs` solo lo lanza la usuaria, con
`/grill-with-docs`.

1. **Empezar la tarea:** cargar `selector`, clasificar la tarea con su tabla y decir en una línea
   qué skill y qué modelo pide, y su presupuesto de compactaciones (1 a 5, `QA-116`).
   **Sesión directora** (`QA-121`): con `orchestrate-dealer`, la principal reparte cada trozo a un subagente de
   contexto limpio y solo recibe su resumen; se trabaja horas sin `/clear` ni `/compact` de la usuaria.
   **Puntos de `/clear`** (`QA-122`, usuaria, 2026-10-19): la compactación automática (tope de 200k, `QA-123`) es la red;
   el corte limpio es un `/clear` en un punto estable. Claude lo recomienda: al cerrar una tarea del roadmap o una
   tanda de arreglos, al cerrar una ronda o un bloque de pruebas, tras fusionar un PR, y cuando el contexto pasa de
   ~200k o la tarea ya gastó su presupuesto de compactaciones, siempre entre pasos y nunca a mitad de uno. Entre el
   `/code-review` y la `/retro` de un PR no se limpia: `/opt-tokens` y la `/retro` leen esta sesión. Antes de
   recomendarlo deja la sesión lista: todo con commit y push, la fila de la bitácora con el siguiente paso concreto
   y el estado de los tests, y lo que tenga que sobrevivir (una decisión, un dato a medias) en un `.md`. Entonces
   dice en una línea «Punto de `/clear`: todo subido (`<commit>`). Escribe `/clear` y después «sigue».»; Claude no
   puede lanzarlo. Tras el `/clear`, el gancho de `SessionStart` pone el estado (`recuperar.py --estado`) y se sigue
   por «Al empezar cualquier sesión» de `CLAUDE.md`.
   **Compactar sin perder** (`QA-116`): el tope de 200k (`QA-109`, bajado a 200k en `QA-121`, a 300k en `QA-122` y de vuelta a
   200k en `QA-123`: con 300k el techo pasó de ~145k a ~220k y el medio, de ~115k a ~150k por llamada) es la red. Tras cada compactación, el gancho de `SessionStart` (`recuperar.py --estado`) vuelve a poner la fila de la bitácora,
   `git status`, los últimos commits y las compactaciones llevadas; un detalle de antes (un error, lo que dijo la
   usuaria) se busca con `python3 tools/qa/recuperar.py "<regex>"`, que lee el registro de la sesión sin
   cargarlo entero. Una sesión nueva no tiene ese registro: lo que tiene que sobrevivir, a la bitácora.
2. **Si hay diseño o una decisión abierta:** `grilling` + `domain-modeling` (o `/grill-with-docs` si
   lo lanza la usuaria), con los juegos de referencia. **Toda ronda de diseño, también las de
   detalle (números), se contrasta siempre** con X4: Foundations, D&D 5e, Baldur's Gate 3, Medieval
   Dynasty, Bellwright y Manor Lords, y cada pregunta dice de cuál sale (o que ninguno lo cubre).
   **X4 marca el camino** siempre que se pueda: si los juegos se contradicen, gana lo que hace X4
   (usuaria, 2026-10-07). Antes de presentar la ronda, cada pregunta pasa tres preguntas (QA-21):
   ¿de qué juego sale?, ¿sale del estado del mundo o es un temporizador «cada N días»?, ¿apaga una
   contingencia o solo la regula? (principios 9 y 10 del
   [Cronista](../producto/roadmap-cronista.md#2-principios-y-límites)). Si una pregunta pide decidir números o reglas
   que hay que probar para sentirlas, `prototype` y el enlace en la pregunta. Lo decidido, a su
   roadmap; los términos, a `GLOSSARY.md`; lo difícil de revertir, a `docs/adr/`.
3. **Implementar** por pasos pequeños, cada uno con sus tests, y commit + push en cada punto
   estable (`CLAUDE.md`). En cada paso, los tests de lo tocado (`npx vitest run <archivos>`); la
   suite entera del backend (5-10 min) en segundo plano, con 30 minutos de tope (`timeout: 1800000`;
   con el de 10 se corta a medias y deja el catálogo sucio, retro del PR #56), y aparte del push (el pre-push ya pasa tsc,
   lint y cobertura) (QA-24). Antes del commit de un arreglo, «Un dato, un sitio» de
   [`REVIEW.md`](../../REVIEW.md#un-dato-un-sitio): `grep` de los otros sitios que hacen lo mismo (la
   regla llega a todos) y nada que el frontend recalcule de lo que ya decide el backend (QA-81).
4. **Si algo falla** (test rojo, intermitente, bug): `diagnosing-bugs` antes de tocar el código.
5. **Cerrar la tarea:** tachada en su roadmap y en el mapa, bitácora al día, commit + push. El
   `/code-review` y la `/retro` van al final, no por tanda: el `/code-review`, después `/opt-tokens` (usuaria,
   2026-10-19), después la `/retro` (que revisa también la skill `opt-tokens`) y lo que la usuaria apruebe de
   ellas, todo **antes de crear** el PR a `main` (pasos 6 y 7) (usuaria, 2026-10-13; sustituye
   a `QA-75` y al `/code-review` cada 5-6 hallazgos de `QA-40`). El PR #53 se revisó ya fusionado y
   sus 12 fallos llegaron a `main` (`QA-77`). Al
   contárselo a la usuaria, el destino con su nombre: «en la rama de trabajo, no en `main`» o «en
   `main` (PR #N)» (QA-36).
   «Actualiza con main» (o «trae main») es traer `main` a la rama de trabajo en local y decir si está
   al día; sin commit de bitácora y sin subir, salvo que lo pida (QA-61). Aparte, `main` se trae
   siempre al empezar una tarea y al fusionar un PR (QA-72, `CLAUDE.md`).
6. **Antes de un PR a `main`** (solo cuando lo pide la usuaria), en tres fases (usuaria, 2026-10-21, `QA-183`); esta es
   la fuente única del orden:
   1. **Código:** `git fetch origin main` y `/code-review --max-findings all` del diff contra `origin/main` (sin el tope
      de 10 hallazgos, `QA-18`; criterio en [`REVIEW.md`](../../REVIEW.md)); contra un `main` local viejo revisa código
      que ya está en `main`. Se arregla lo que encuentre y se sube.
   2. **Entorno:** si la rama trae tandas jugadas con Ollama real (registro de `IA_REGISTRO`), `/opt-ai` (`QA-142`);
      luego `/opt-tokens` y `retro` (paso 7). Va tras el código porque la retro aprende de sus hallazgos. Lo que apruebe
      la usuaria se aplica en la rama.
   3. **Cierre:** si la fase 2 añadió código (herramientas, scripts, skills con tests), `/code-review --max-findings all`
      solo de esos commits (`<commit de la retro>..HEAD`) y sus arreglos: en la del banco del narrador encontró dos
      fallos en lo recién aplicado. Luego `bash tools/qa/revisado.sh`, la descripción con `pr` y se crea el PR.
   Desde una sesión local (la Deck) el PR no se crea (`QA-184`): no hay `gh` ni herramienta de GitHub y el modo auto
   no deja usar la credencial de git. La local sube la descripción a `docs/registros/pr/<rama>.md` y escribe en su fila
   de la bitácora «PR listo para la nube» con el título; ese commit es el último y el revisado. Claude en la nube trae la rama,
   comprueba que su último commit es el de esa fila y que no lleva nada detrás, pasa `revisado.sh` (la marca no se versiona) y crea el PR con esa descripción.
   Tras crear el PR, `subscribe_pr_activity` y se fusiona al llegar el CI en
   verde, nunca antes (`QA-62`: el gancho de `QA-50` lo bloquea). Al fusionarlo, la siguiente tarea sigue en la misma
   sesión como directora (`orchestrate-dealer`, `QA-121`, sustituye la sesión nueva de `QA-110`): el trabajo va a
   subagentes de contexto limpio y la principal no arrastra lo leído.
7. **Antes de crear cada PR a `main` (fase 2 del paso 6), y al cerrar una fase o un
   hito:** `retro` (usuaria, 2026-10-13), que lanza Claude sobre lo que va a entrar con el PR o sobre toda
   la fase.
   Sus propuestas se presentan a la usuaria, que las revisa y confirma (nada se aplica antes). Cada pocas fases,
   `/improve-codebase-architecture`. Lo aceptado entra como tarea con hito.

Nada cambia de las reglas de `CLAUDE.md`: las skills se apoyan en ellas, no las sustituyen.

## Skills que encajan

| Skill | Se invoca | Qué hace | Cuándo, en este proyecto |
|---|---|---|---|
| `selector` (propia) | sola, al empezar tarea | Elige skill y modelo según el caso | Siempre, al arrancar una tarea, un bug o un diseño |
| `orchestrate-dealer` (propia) | Claude, en toda tarea de más de un paso (la apunta el `selector`) | La sesión principal parte y decide; cada trozo va a un subagente de contexto limpio que devuelve un resumen de 15 líneas | Tareas del roadmap, tandas de arreglos, rondas de pruebas (en serie): trabajar horas sin `/clear` (`QA-121`) |
| `/grill-with-docs` | la usuaria o Claude al proponer diseño | Entrevista por rondas (preguntas numeradas, cada una con la respuesta recomendada) hasta no dejar nada supuesto; mantiene `GLOSSARY.md` y los ADR | Antes de diseñar algo grande: una fase nueva del Cronista, una mecánica, una decisión de Álvaro. Sustituye a las preguntas sueltas |
| `grilling` | por debajo de la anterior | La entrevista en sí | — |
| `domain-modeling` | por debajo de la anterior, o al discutir términos | Glosario (`GLOSSARY.md`) y decisiones difíciles de revertir (`docs/adr/`) | Términos del motor y producto (mundo de la partida, catálogo, Suceso…). El lore sigue en `docs/rpgtarkor/` y no se toca |
| `diagnosing-bugs` | sola ante un bug o test rojo | Primero un test o comando que reproduzca el fallo; luego minimizar, hipótesis, arreglo y test de regresión | Bugs que encuentras jugando (como Matar/Clemente) y tests intermitentes (G16, P3.2) |
| `/improve-codebase-architecture` | la usuaria o al cerrar fase | Busca módulos que simplificar y los presenta en un informe | Cada pocas fases. Candidatos claros: `turnResolution.ts` (más de 7.000 líneas), `turn.ts` |
| `codebase-design` | por debajo de la anterior | Vocabulario para diseñar módulos con interfaz pequeña | — |
| `opt-tokens` | Claude, antes de crear cada PR a `main` (tras el `/code-review`, antes de la `/retro`), o la usuaria con `/opt-tokens` | Mide dónde se fueron los tokens de la sesión (`medir.py`) y propone cómo gastar menos | Las propuestas las confirma la usuaria; lo confirmado entra como tarea con hito |
| `opt-ai` | Claude o la usuaria con `/opt-ai`, tras cada tanda de pruebas con el modelo real, antes de cambiar de modelo o cuando la IA va lenta | Mide la IA local con el registro por llamada (`medir.py`), contrasta el RAG con las incoherencias de la tanda (`npm run rag-eval`) y propone configuración por perfil de máquina (la Steam Deck, siempre) | Solo propone; lo que confirme la usuaria entra como tarea con hito. Sin registro (`IA_REGISTRO`) no hay nada que medir |
| `scout-updates` | Solo la usuaria con `/scout-updates [sección]` (gasta muchos tokens) | Inventaria la arquitectura (`docs/scout/arquitectura.md`, con sello por sección), busca actualizaciones con fuentes citadas, filtra por las restricciones (la Steam Deck) y compara modelos con un banco por pares a ciegas | Solo propone; lo propuesto queda en `docs/scout/propuestas.md` y lo aprobado entra como tarea con hito |
| `retro` | Claude, antes de crear cada PR a `main` (tras el `/code-review` y `/opt-tokens`; revisa también la skill `opt-tokens`) y al cerrar fase o hito (o la usuaria con `/retro`) | Propone mejoras del entorno: comprobaciones automáticas, instrucciones, herramientas | Antes de cada PR y al final de cada fase. Las propuestas las revisa y confirma la usuaria; solo lo confirmado entra como tarea con hito |
| `writing-for-agents` | sola al escribir para agentes | Cómo escribir CLAUDE.md, skills y documentos para agentes | Al tocar `CLAUDE.md`, la bitácora o una skill |
| `prototype` | Claude, dentro de una ronda de diseño | Prototipo para tirar: un HTML con botones que mueve la lógica (o variantes de una pantalla) para probar una decisión antes de tomarla | Cuando la usuaria decide números o reglas (economía, ganadería, combate, ritmo). El HTML se publica como Artifact o se le envía; se guarda en `docs/prototipos/` y el veredicto va al roadmap |
| `pr` | Claude, al abrir un PR a `main` | Descripción del PR: resumen visual del cambio, evidencia antes/después y peligro del merge | Cada PR a `main`, tras `/code-review`. Evidencia: los números de `tsc`, `vitest` y `oxlint` |

## Descartadas, y por qué

- **`handoff`**: guarda el traspaso en una carpeta temporal; en la nube se pierde. Ya está la
  bitácora (`docs/registros/traspaso.md`).
- **`to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `setup-matt-pocock-skills`**:
  suponen un gestor de issues. Aquí el trabajo vive en los roadmaps `.md` con hitos; serían dos
  sistemas a la vez.
- **`tdd`**: ya se trabaja con tests en verde antes de cada subida; además pide acordar con la
  usuaria qué se prueba, y aquí la implementación es continua (revisado otra vez el 2026-10-06).
- **`code-review`**: Claude Code trae `/code-review` de serie.
- **`to-questionnaire`** (revisada el 2026-10-06): las preguntas a Álvaro ya tienen su sitio en
  `docs/borradores-opencode/propuestas-lore.md`.
- **`wait-what`** (revisada el 2026-10-06): repite la explicación en inglés técnico simplificado;
  a la usuaria le basta con pedirlo en español.
- **`git-guardrails-claude-code`**, **`setup-pre-commit`**: bloquean `git push` o pasan la suite
  (unos 7 min) en cada commit, contra el commit + push constante.
- **`ask-matt`**: es un selector de las skills de su repositorio; se sustituye por `selector`, que
  además elige modelo.

## Selector de modelo

El repositorio original **no** trae selector de modelo; este es propio, adaptado al proyecto.
Tres tamaños: **grande** (Opus), **medio** (Sonnet), **ligero** (Haiku).

| Caso | Modelo | Por qué |
|---|---|---|
| Diseño, decisiones, `/grill-with-docs` | grande | Es donde un error sale más caro: se arrastra a todo lo que se construye encima |
| Motor con varios sistemas, BD, migraciones, concurrencia (`CR-*`) | grande | Muchas piezas a la vez; ej. al clonar el mundo por partida apareció un fallo en el Reino que no estaba en el plan |
| Bug difícil o intermitente | grande | Hace falta sostener la hipótesis y el bucle de prueba |
| Bug con causa visible, tarea de roadmap acotada (componente, ajuste, endpoint) | medio | Bien definida; lo caro es escribir, no pensar |
| Cambios mecánicos (docs, bitácora, renombrados, tests por firma nueva) | medio o ligero | Poco razonamiento |
| Búsquedas amplias en el código (subagente) | ligero | Solo localizar; la conclusión la saca la sesión principal. Lo que el subagente afirme («X no existe», «Y corre sobre el catálogo») se comprueba con un grep antes de llevarlo a una pregunta de diseño (`QA-9`: en la Fase D del `0.2` un dato falso acabó en la Q1 de `CR-34`) |
| Revisión del diff antes de PR, `/retro`, arquitectura | grande | Juicio sobre el conjunto |

**Límites:**

- El modelo de la sesión lo elige la usuaria con `/model`; Claude no puede cambiarlo desde dentro.
  Si la tarea pide otro, lo dice en una línea al empezar y sigue (salvo riesgo alto: entonces espera).
- Claude sí elige el modelo de los **subagentes** que lance (búsquedas, tareas mecánicas). El diseño y
  las decisiones nunca se delegan.
- **Planificar con el grande, escribir con el medio** (usuaria, 2026-10-19, `QA-117`): con el plan cerrado y escrito
  (archivos, funciones, tests que tienen que pasar), la implementación acotada va a un subagente `sonnet` con ese
  plan y la sesión principal revisa su diff antes del commit. Se queda en la sesión principal lo que pide
  sostener contexto: el bug difícil, el motor con varios sistemas, lo que cambia el plan a mitad. `medir.py`
  (`POR MODELO`) dice en cada `/opt-tokens` si se está haciendo.
- **Escalera y topes** (`QA-118`, ideas del workflow `implement-afk` que se revisó el 2026-10-19; el resto no
  encaja: paralelo con base de datos compartida, issues, rebase forzado): cada subagente empieza en el peldaño
  más barato que encaje y sube uno por fallo (`sonnet` low → `sonnet` medium → `opus` medium → `opus` high), con
  dos fallos como tope; un fallo al arrancar no sube ni cuenta; una tanda sin supervisión que no cierra nada
  para. Al escribir en un roadmap una tarea pendiente que implemente un subagente, se le apunta
  su peldaño de partida (p. ej. `modelo: sonnet-medium`), para que la otra cuenta no tenga que decidirlo otra vez;
  las tareas ya cerradas y las del entorno que hace la sesión principal no lo llevan. Detalle en el `selector`.
- En la duda, el de más riesgo.
