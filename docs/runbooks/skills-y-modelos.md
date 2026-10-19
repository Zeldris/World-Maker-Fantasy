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
   qué skill y qué modelo pide.
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
6. **Antes de un PR a `main`** (solo cuando lo pide la usuaria): `/code-review --max-findings all`
   del diff contra `main` (sin el tope de 10 hallazgos, `QA-18`; criterio en [`REVIEW.md`](../../REVIEW.md)), arreglar lo que encuentre y escribir
   la descripción con `pr`. Tras crear el PR, `subscribe_pr_activity` y se fusiona al llegar el CI en
   verde, nunca antes (`QA-62`: el gancho de `QA-50` lo bloquea). Al fusionarlo, Claude le recuerda a la usuaria
   que empiece una sesión nueva (`/clear` u otra sesión) para la siguiente tarea: arranca en ~70k tokens con la
   bitácora en vez de arrastrar la conversación entera (`QA-110`).
7. **Antes de crear cada PR a `main` (tras el `/code-review` y sus arreglos), y al cerrar una fase o un
   hito:** `retro` (usuaria, 2026-10-13), que lanza Claude sobre lo que va a entrar con el PR o sobre toda
   la fase.
   Sus propuestas se presentan a la usuaria, que las revisa y confirma (nada se aplica antes). Cada pocas fases,
   `/improve-codebase-architecture`. Lo aceptado entra como tarea con hito.

Nada cambia de las reglas de `CLAUDE.md`: las skills se apoyan en ellas, no las sustituyen.

## Skills que encajan

| Skill | Se invoca | Qué hace | Cuándo, en este proyecto |
|---|---|---|---|
| `selector` (propia) | sola, al empezar tarea | Elige skill y modelo según el caso | Siempre, al arrancar una tarea, un bug o un diseño |
| `/grill-with-docs` | la usuaria o Claude al proponer diseño | Entrevista por rondas (preguntas numeradas, cada una con la respuesta recomendada) hasta no dejar nada supuesto; mantiene `GLOSSARY.md` y los ADR | Antes de diseñar algo grande: una fase nueva del Cronista, una mecánica, una decisión de Álvaro. Sustituye a las preguntas sueltas |
| `grilling` | por debajo de la anterior | La entrevista en sí | — |
| `domain-modeling` | por debajo de la anterior, o al discutir términos | Glosario (`GLOSSARY.md`) y decisiones difíciles de revertir (`docs/adr/`) | Términos del motor y producto (mundo de la partida, catálogo, Suceso…). El lore sigue en `docs/rpgtarkor/` y no se toca |
| `diagnosing-bugs` | sola ante un bug o test rojo | Primero un test o comando que reproduzca el fallo; luego minimizar, hipótesis, arreglo y test de regresión | Bugs que encuentras jugando (como Matar/Clemente) y tests intermitentes (G16, P3.2) |
| `/improve-codebase-architecture` | la usuaria o al cerrar fase | Busca módulos que simplificar y los presenta en un informe | Cada pocas fases. Candidatos claros: `turnResolution.ts` (más de 7.000 líneas), `turn.ts` |
| `codebase-design` | por debajo de la anterior | Vocabulario para diseñar módulos con interfaz pequeña | — |
| `opt-tokens` | Claude, antes de crear cada PR a `main` (tras el `/code-review`, antes de la `/retro`), o la usuaria con `/opt-tokens` | Mide dónde se fueron los tokens de la sesión (`medir.py`) y propone cómo gastar menos | Las propuestas las confirma la usuaria; lo confirmado entra como tarea con hito |
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
- En la duda, el de más riesgo.
