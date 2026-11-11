# Pendiente de `/gw-opt-ai` (`QA-306`)

Tandas con un modelo local de Tarkor (narrador con Ollama real, lore, mapas, prompts, imágenes…) que aún no ha
analizado `/gw-opt-ai`. Quien cierra la tanda añade una fila; los registros (`logs/ia/*.jsonl`) no se suben a git:
viven en la máquina de la fila.

**Umbral:** unos 30 turnos o 4 tandas del mismo modelo, lo que llegue antes, o un PR a `main` con filas sin analizar.
Al pasarlo, Claude **recomienda** `/gw-opt-ai` al usuario (lo lanza él: la skill no se invoca sola). Tras el análisis,
las filas analizadas pasan a «Analizadas» con la fecha y el informe.

## Sin analizar

| Fecha | Modelo | Máquina y registro | Turnos / llamadas | Qué se probó | Incoherencias y hallazgos |
|---|---|---|---|---|---|
| (ninguna) | | | | | |

## Analizadas

2026-11-11, `/gw-opt-ai` (informe en la conversación; propuestas aprobadas: `QA-307`…`QA-310`, tiempos aceptables en `.claude/gw/gw-opt-ai.md`):

| Fecha | Modelo | Máquina y registro | Turnos / llamadas | Qué se probó | Incoherencias y hallazgos |
|---|---|---|---|---|---|
| 2026-11-10 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/2026-11-10.jsonl` | 16 `narrar` + 4 `narrar_respaldo`, 1 `clasificar` | P435, P271 (`mv-hondonada-hostiles`; parada a mitad) | P435 sigue fallando (la narración bajo «… ATACA CON» no cuenta el ataque del NPC); 4 caídas al respaldo |
| 2026-11-11 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/2026-11-11.jsonl` (hasta las 10:23) | 13 `narrar`, 8 `clasificar`, 9 `rag` | P244, P268, P324, P310 (`local-gistera-raciones`) | P310 reabierto: con Gistera en otra zona, el narrador la trata como presente |
| 2026-11-11 | narrador (`tarkor-narrador-llama31`) | Deck, **sin registro** (`escenario.sh cargar` relanzó sin `IA_REGISTRO`; ver `fallos-herramientas.md`) | 8 turnos | (no medible: sin registro, `QA-310`) P306 (`t13b2-ketg`, `t65-poste-dia40`, `mv-hondonada-hostiles`) | P306 reabierto (amenaza con saludo y NPC agresivo no abren combate); P447 (tirada de Fuerza en charla pacífica); P448 (saludo al orco desconocido narrado sin él) |
