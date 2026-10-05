# Skills y selector de modelo

**Para qué:** qué skills usa Claude en este proyecto, cuándo, y con qué modelo conviene trabajar
cada tipo de tarea. Petición de la usuaria (2026-10-04), tras revisar
[mattpocock/skills](https://github.com/mattpocock/skills).

**`.claude/` sigue en el `.gitignore`, pero `.claude/skills/` está versionado** (decisión de la
usuaria, 2026-10-04: subir las skills junto con lo que vaya a `main`). Git sigue los archivos ya
añadidos aunque la carpeta esté ignorada; una skill **nueva** se añade con
`git add -f .claude/skills/<nombre>`. Si una skill no está cargada, se sigue su descripción de aquí.

## Cómo se usa

1. **Al empezar cada tarea**, Claude aplica el selector (la tabla de abajo): clasifica la tarea, dice en una
   línea qué skill y qué modelo pide, y sigue.
2. **La usuaria** puede invocar a mano las de la columna «Se invoca»: escribiendo `/nombre`.
3. **Nada cambia** de las reglas de `CLAUDE.md`: commit + push, bitácora, roadmaps con hito, tests en
   verde. Las skills se apoyan en ellas, no las sustituyen.

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
| `/retro` | al cerrar fase o hito | Propone mejoras del entorno: comprobaciones automáticas, instrucciones, herramientas | Fin de cada fase. Lo aceptado entra como tarea con hito |
| `writing-for-agents` | sola al escribir para agentes | Cómo escribir CLAUDE.md, skills y documentos para agentes | Al tocar `CLAUDE.md`, la bitácora o una skill |

## Descartadas, y por qué

- **`handoff`**: guarda el traspaso en una carpeta temporal; en la nube se pierde. Ya está la
  bitácora (`docs/registros/traspaso.md`).
- **`to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement`, `setup-matt-pocock-skills`**:
  suponen un gestor de issues. Aquí el trabajo vive en los roadmaps `.md` con hitos; serían dos
  sistemas a la vez.
- **`tdd`**: ya se trabaja con tests en verde antes de cada subida.
- **`code-review`**: Claude Code trae `/code-review` de serie.
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
- En la duda, el de más riesgo.
