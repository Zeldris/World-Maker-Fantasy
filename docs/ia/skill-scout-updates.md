# Diseño: skill `scout-updates` (🚧 en construcción, `QA-176`)

Skill **bajo demanda** que hace inventario de un proyecto, lo ordena y busca actualizaciones, mejoras o candidatos
a migración para cada pieza. Solo propone. Nace de la ronda local del 2026-10-20: el narrador de Tarkor sale lento y
de mala calidad, y hacía falta una oferta de modelo con fundamento, no a ojo.

## Decisiones de la usuaria (2026-10-20)

| Tema | Decisión |
|---|---|
| Alcance | **Genérica y extrapolable a cualquier proyecto.** Mira lo que hay, lo ordena y luego busca. Nada de Tarkor en `SKILL.md`. |
| Memoria | **Dos `.md` en el proyecto:** `arquitectura.md` (la arquitectura y la fecha en que se comprobó; la siguiente vez solo se contrasta si sigue igual) y `propuestas.md` (acumulativo, para no repetir lo establecido ni lo ya rechazado). |
| Focos | Una skill genérica que lo mira todo, y «versiones» que miran una parte: `/scout-updates <sección>`, donde las secciones son las de `arquitectura.md`. |
| Lanzamiento | **Solo bajo demanda** (`disable-model-invocation: true`): gasta muchos tokens, decide la usuaria cuándo. Antes de buscar, estimación de coste y confirmación. |
| Modelos | **Local siempre que se pueda**, con la opción de usar Claude. La usuaria elige candidatos y juez entre los disponibles. |
| Hardware | En Tarkor, la **Steam Deck es el mínimo**; modelos mayores para equipos mayores son una fase final del roadmap. Va como restricción en `arquitectura.md`, no en la skill. |
| Coste | **Primero lo gratuito o de bajo coste.** Una propuesta de pago lleva el coste desglosado (precio publicado, uso estimado y su cálculo, total al mes) y qué calidad compra frente a la mejor gratuita, para juzgar calidad/precio. |
| Autonomía | Solo propone (como `opt-ai`). Lo que la usuaria apruebe se convierte en tareas con hito. |

## Flujo de una pasada

| Paso | Qué hace | Cierra cuando |
|---|---|---|
| 0. Arquitectura | Lee `arquitectura.md`; si no existe, la crea con `inventario.py` y confirma las restricciones con la usuaria. | Cada componente tiene qué es, versión, uso y dónde se configura; las restricciones, confirmadas. |
| 1. Contraste | `contrastar.py`: `git diff <commit-sello>..HEAD` sobre los archivos de cada sección y manifiestos nuevos sin sección. | Cada sección: igual (solo fecha nueva) o releída y reescrita; ningún manifiesto sin cuenta. |
| 2. Foco | Todo o la sección pedida; estimación de coste y confirmación. | La usuaria confirma foco y coste. |
| 3. Búsqueda | Subagente con el molde de `research`: fuentes de `fuentes.md`, cada afirmación con fuente y fecha, saltando lo que ya está en `propuestas.md`. | Cada componente del foco: candidatos con fuente, o «sin novedades» con lo consultado. |
| 4. Filtro | Contra las restricciones (memoria, idioma, local). | Cada candidato descartado lleva su restricción. |
| 5. Banco | Solo con modelos generativos y casos definidos en el proyecto: comparación ciega por pares. | Tasa de victorias y consistencia de posición por candidato. |
| 6. Informe | Tarjetas con anillo de Tech Radar, fuerza de la evidencia y **una** recomendación principal; latencia separada de calidad. | Cada tarjeta, en `propuestas.md` como `propuesta`. |

## Los dos archivos

**`arquitectura.md`** (inventario tipo SBOM/ML-BOM, sin su formato pesado):
- Secciones por tipo: modelos de IA, dependencias, runtimes, infraestructura y CI, servicios externos.
- Por componente: qué es, versión, uso y dónde se configura.
- Sección `Restricciones` (en Tarkor: Deck como mínimo, hueco del narrador más ~4 GB libres, solo local, español, Ollama).
- Sello por sección: fecha, commit y archivos fuente. Es lo que permite contrastar en vez de releer.

**`propuestas.md`** (registro acumulativo; nada se borra):
- Campos: id, fecha, componente, propuesta, fuente con fecha de consulta, estado.
- Estados: `propuesta` · `aceptada` · `aplicada` · `rechazada` (con motivo) · `superada` (por otra, que se nombra).
- Una rechazada solo se reabre si su motivo ya no se cumple, y la skill lo dice expresamente.

## Banco de calidad (genérico)

- Casos: los prompts reales que recibe el modelo (sistema + prompt + opciones), de 10 a 15 situaciones.
- Candidatos por un endpoint agnóstico del motor (API de Ollama u OpenAI-compatible).
- Juicio a ciegas por pares en **los dos órdenes**, por el sesgo de posición
  ([arXiv 2406.07791](https://arxiv.org/abs/2406.07791)); un par que cambia de ganador al girarlo cuenta como empate.
- Juez local por defecto, con aviso de su debilidad y la sugerencia de calibrar unos pares con Claude; Claude en la
  sesión como opción (los pares se exportan y los juzga la propia sesión).
- Rúbrica: coherencia, naturalidad del español, fidelidad al lore, ajuste de longitud, sin repeticiones.
- Latencia se mide aparte (la de `opt-ai`), nunca mezclada con la calidad.
- El banco y el filtro de memoria necesitan el motor local: en la nube la skill hace solo inventario y búsqueda.

## Diagnóstico del narrador de Tarkor (punto de partida de la primera pasada)

Dos problemas distintos:
- **Latencia:** prompt de ~6,3k tokens; el prefill son ~36 de 48 s. Turno p50 29-35 s tras `opt-ai`. Recortar el
  prompt es de `opt-ai`, no de esta skill.
- **Calidad:** modelo de 8B antiguo (`tarkor-narrador-llama31`, ajuste fino de Llama 3.1) escribiendo en español.

Pieza que falta en Tarkor: el registro de `opt-ai` (`iaRegistro.ts`) no guarda los prompts, y el banco los necesita
como casos. Hecho (2026-10-20): con `IA_CASOS=<ruta>` cada `/api/generate` que acaba bien añade su prompt completo y su salida en el formato de casos de `banco.py` (`registrarCaso`, `iaRegistro.ts`). Sin `system` en el caso, el narrador usó el SYSTEM de su Modelfile: para un candidato sin él, añadirlo desde `ollama show --system`.

## De dónde sale cada decisión

| Decisión | Fuente |
|---|---|
| Búsqueda en subagente, fuentes primarias, afirmaciones citadas | [`research`](../../.claude/skills/research/SKILL.md) de [mattpocock/skills](https://github.com/mattpocock/skills) |
| Tarjetas de candidato | `improve-codebase-architecture` (mattpocock/skills) |
| No reproponer lo rechazado, con motivo | `triage/OUT-OF-SCOPE.md` (mattpocock/skills) |
| `superada`, nunca reescrita | `chief-of-staff` (mattpocock/skills) |
| Fuentes curadas con «Huecos» | `teach/RESOURCES-FORMAT.md` (mattpocock/skills) |
| Planifica, no ejecuta | `wayfinder` (mattpocock/skills) |
| Inventario de modelos como componentes | [CycloneDX ML-BOM](https://cyclonedx.org/capabilities/mlbom/) |
| Modelos instalados del motor | [Ollama `/api/tags` y `/api/show`](https://docs.ollama.com/api/tags.md) |
| Qué manifiestos detectar | [Renovate managers](https://docs.renovatebot.com/modules/manager/) |
| Fin de vida de runtimes | [endoflife.date API](https://endoflife.date/docs/api/v1/) (en beta) |
| Vulnerabilidades por lockfile | [OSV-Scanner](https://google.github.io/osv-scanner-v1/supported-languages-and-lockfiles/) |
| Riesgos de los componentes de IA | [OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/) |
| Salud de dependencias | [OpenSSF Scorecard](https://github.com/ossf/scorecard) |
| Anillos Adoptar/Probar/Evaluar/Retirar | [Thoughtworks Tech Radar](https://www.thoughtworks.com/radar) |
| Juicio por pares de escritura creativa | [EQ-Bench Creative Writing v3](https://eqbench.com/creative_writing.html) |
| Forma de la skill (evaluaciones primero, < 500 líneas, referencias a un nivel) | [Anthropic, skill best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) |

## Plan de construcción

1. Este diseño y `QA-176`.
2. Evaluaciones (`evals/`), con un proyecto de ejemplo que no es Tarkor.
3. Scripts con tests: `inventario.py`, `contrastar.py`, `banco.py`.
4. `SKILL.md` y referencias: `formato-arquitectura.md`, `formato-propuestas.md`, `fuentes.md`, `banco-calidad.md`.
5. Captura de casos en Tarkor (`IA_CASOS`) y primera pasada con foco narrador.
