# Qué sacar de Claude-Code-Game-Studios (2026-10-30)

Repo: [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios), licencia MIT
(«Copyright (c) 2026 Donchitos»). Si se copia algo hay que conservar el aviso, igual que con
`.claude/skills/LICENSE-mattpocock-skills`. Lo leyó un subagente con un clon superficial (no se ejecutó nada de ese
repo), mirando los archivos clave, no las 638 piezas completas.

**Estado: propuestas SIN REVISAR, fuera del roadmap** (usuaria, 2026-10-30); apuntadas en la bitácora,
«Propuestas sin revisar».

## Qué es

Una plantilla de Claude Code que monta un «estudio de juegos» para Godot, Unity y Unreal: 49 agentes en
`.claude/agents/` (directores, jefes de área y especialistas), 74 skills con flujo por etapas
(`/brainstorm` → `/design-system` → `/create-stories` → `/gate-check`), 15 ganchos, reglas por ruta en
`.claude/rules/`, unas 70 plantillas en `.claude/docs/templates/` y pruebas de skills en `studio-tests/`. No trae
código de juego.

## Valoración frente a WMF

| Pieza (su ruta) | Qué hace | En WMF | Valoración |
|---|---|---|---|
| `skills/consistency-check` + `design/registry/entities.yaml` | Registro de cifras y nombres que se repiten entre documentos, y una comprobación contra los GDD | `GLOSSARY.md`, `canon-opencode/00-nucleo.md`; nada comprueba cifras entre `docs/mecanicas` y `docs/producto` | **Aporta**: registro YAML + script, como `cobertura.py` |
| Cabecera de `skills/balance-check` (FOUND/ABSENT, «NOT ASSESSED — NO DATA») | Si faltan datos, lo dice en vez de inventar el informe | — | **Aporta**: para `retro`, `opt-tokens`, `opt-ai` |
| `skills/review-all-gdds`, `balance-check` | Revisión transversal: contradicciones, estrategias dominantes, economía rota, deriva de pilares | `grilling` va sistema a sistema | **Aporta** como lista de comprobación antes de cada hito |
| `skills/skill-test` (estático), `studio-tests/`, `hooks/validate-skill-change.sh` | Linter y especificaciones de skills | `doctor.py`, `skills-con-tests.py`, `writing-for-agents` | **Aporta en parte**: ampliar el linter |
| `templates/narrative-character-sheet.md` (Voice Profile), «verdad oculta» de `rules/narrative.md` | Voz de cada personaje; respuesta verdadera documentada para cada misterio | Fichas en `docs/rpgtarkor/` | **Aporta en parte**: el Voice Profile podría alimentar el prompt del narrador (P263). Va a Álvaro por `propuestas-lore.md` |
| `docs/director-gates/*` (CD-GDD-ALIGN, ND-…) | Puertas de revisión por rol | `selector`, `orchestrate-dealer` | **En parte**: criterios sueltos sí; el sistema de directores es demasiado pesado para dos cuentas |
| `skills/propagate-design-change` | Avisa de los ADR obsoletos cuando cambia un diseño | `docs/adr/` sin aviso | Idea, no pieza |
| QA (`playtest-report`, `smoke-check`, `bug-triage`…), `code-review`, gestión de producción, `pre-compact.sh`/estado de sesión, `model-tiers.md` | — | Rondas con Playwright, P-números, roadmaps, `cobertura.py`, bitácora, `recuperar.py`, `selector` | **Ya lo tenemos**, más maduro |
| `rules/ai-code.md`, `agents/ai-programmer.md` | IA de NPC clásica (árboles, presupuesto de ms) | IA generativa con Ollama | **No encaja**; no hay nada sobre NPC con LLM |
| Skills de motor, publicación y arte (`godot-*`, `unity-*`, `launch-checklist`…) | — | — | **No encaja** |

## Qué traer, por orden de valor

1. Registro de entidades y cifras compartidas + script de consistencia en `tools/qa`.
2. Cabecera «sin datos, no se evalúa» en las skills que hacen informes.
3. Lista de revisión transversal de diseño antes de cerrar un hito.
4. Ampliar el linter de skills con sus comprobaciones estáticas.
5. Voice Profile y «verdad oculta», como propuesta de lore para Álvaro.

Nada de esto se ha aplicado ni entra en el roadmap; se revisa más adelante. Las piezas
genéricas del flujo (2, 4) encajan también como propuesta para Galivelop-workflow.
