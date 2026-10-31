# Lo investigado, aplicado a los generadores de lore (2026-10-31)

Pregunta de la usuaria: ¿lo mirado para el narrador (RLM, Vectorless RAG, búsqueda híbrida, Claude-Code-Game-Studios,
InkOS) sirve también para el generador de lore? Solo análisis, sin código.

**Estado: propuestas SIN REVISAR, fuera del roadmap** (usuaria, 2026-10-31); apuntadas en la bitácora,
«Propuestas sin revisar». Lo del agente de OpenCode va a Álvaro, que es quien usa esa herramienta.

Fuentes: [RAG y RLM](investigacion-2026-10-30-rag-rlm.md),
[Claude-Code-Game-Studios](../registros/investigacion-2026-10-30-claude-code-game-studios.md),
[InkOS](investigacion-2026-10-30-inkos.md).

## Dos generadores distintos

- **A. Agente de lore de OpenCode** (`opencode.json`, agente `narrador-lore`). Lo usa Álvaro fuera del juego para
  redactar propuestas. Funciona con Qwen3.5 9B y 32k de contexto
  (`modelfiles/qwen35-9b-32k.Modelfile`), con temperatura 0,15 y `maxSteps` 7. Solo puede leer: no tiene `grep`,
  `glob` ni `bash`, y no edita archivos. La latencia apenas importa.
- **B. Generador de lore en vivo**: crearía NPC, sitios e hilos mientras se juega
  (`docs/rpgtarkor/sistemas-reino/mundo-vivo-x4-vision.md` §1 y §3). Sin diseñar. Tiene un hueco hermano en las
  misiones secundarias (§2.9), que hoy propone el LLM.

## Cada idea, aplicada a A y a B

| Idea (origen) | A (OpenCode) | B (en vivo) |
|---|---|---|
| Recorrer un índice en árbol (Vectorless RAG / PageIndex) | **Encaja.** En el narrador se descartó por las llamadas de más, pero aquí la espera no importa. `docs/canon-opencode/` ya es ese árbol (`00-nucleo` → región → catálogo); se trata de afinar el índice para que el agente lo recorra, y quizá subir `maxSteps` | No encaja: demasiado lento |
| RLM | **No**: pide ejecutar código (`bash` está prohibido) y un modelo que programe bien | No |
| Búsqueda híbrida y entrada por entidad | Poco: el agente lee archivos, no busca | **Sí**: antes de crear algo, encontrar lo que ya hay con ese nombre o en esa región |
| Auditor con evidencia citada (InkOS) | **Lo mejor para A**: cada afirmación de la propuesta cita la línea del canon en la que se apoya, y lo que no cita nada se marca como «inventado», que es lo que revisa Álvaro | Su versión barata, comprobada con código |
| Registro de entidades + script de consistencia (CCGS) | **Sí**: un script, sin LLM, comprueba nombres, enums y cifras frente a `00-nucleo.md` y al catálogo, y avisa de nombres de especies reales | **Imprescindible** como filtro antes de guardar nada |
| El LLM propone y el código valida y aplica (núcleo de InkOS) | No aplica: la salida es un `.md` | **Diseño de base**: el modelo devuelve una entidad en JSON con los campos del catálogo; el código comprueba enums, región, escala de valor y duplicados antes de insertarla. El LLM no decide reglas, como pide `mundo-vivo-x4` |
| Estados del lore (insinuado / visto / verificado) e hilos con id (InkOS) | No | **Sí**: lo generado se revela poco a poco y no se repite; sirve también para las misiones |
| Voice Profile y «verdad oculta» (CCGS) | **Sí**, como plantilla de las fichas que propone | Sí: el NPC generado nace ya con su voz y su secreto |

## Propuestas

**Para A** (baratas, sin cambiar de modelo):
1. Que las propuestas citen el canon en el que se apoyan.
2. Un script de consistencia contra el núcleo y el catálogo.
3. Un índice del canon pensado para que el agente lo recorra.

**Para B** (material para cuando se diseñe; hoy no es una tarea): la entidad en JSON validada por código, con el
registro de entidades como filtro, los estados del lore y la voz más el secreto de cada NPC. Se diseña junto a las
misiones secundarias.

**Riesgo:** el 9B devuelve JSON a través de `opencode-ollama-toolcall-proxy`, y con modelos pequeños la salida
estructurada suele fallar. Antes de decidir nada sobre B, hace falta un `prototype` que lo mida.
