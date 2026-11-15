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

2026-11-14, `/gw-opt-ai` (informe en la conversación; medidas también de `logs/ia/2026-11-14.jsonl`, la ronda local 2, cuyas filas viven en `claude/ronda-local-2`):

| Fecha | Modelo | Máquina y registro | Turnos / llamadas | Qué se probó | Incoherencias y hallazgos |
|---|---|---|---|---|---|
| 2026-11-14 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/qa289-ronda5.jsonl` | 11 turnos (45-60 s, uno de 101 s) | Ronda 5 `QA-289` (`ronda-qa289-4`): P412, P423, P417, P419 | P412 reabierto (4 de 11 abren con el NPC, también «Observo el cielo»); P423 y P417 ✅; nuevos P469 (Ulkha en tercera persona, tono contradictorio) y P470 (orco convaleciente narrado activo) |
| 2026-11-14 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/qa289-ronda5b.jsonl` | 5 turnos (45-104 s) | Ronda 5b `QA-289`: P412 con el arreglo de `conAccionDelanteDe` | 4 de 5 abren con Gorhorn; «Observo el cielo» sigue abriendo con Ulkha (el campo de la acción, probablemente vacío o copiado: no se registra); arranque con coma empalmada y réplica del NPC atribuida a Gorhorn (tipo P469) |
| 2026-11-14 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/qa289-ronda5c.jsonl` | 3 turnos sin diálogo (20-79 s en BD) | Ronda 5c `QA-289`: valor del campo de la acción (P412) | El campo llegó `null` 3 de 3 (no estaba en `required` del esquema); «Afilo mi cuchillo» abre con Ulkha |
| 2026-11-14 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/qa289-ronda5d.jsonl` | 5 turnos (24-52 s en BD) | Ronda 5d `QA-289`: P412 con el campo obligatorio | P412 ✅ 5 de 5 abren con Gorhorn; el campo llega en formas distintas (3.ª persona, infinitivo, primera persona, frase con el nombre): las dos malas ya no se ponen delante |

2026-11-15, `/gw-opt-ai` (informe en la conversación; comparada con `logs/ia/2026-11-14.jsonl`):

| Fecha | Modelo | Máquina y registro | Turnos / llamadas | Qué se probó | Incoherencias y hallazgos |
|---|---|---|---|---|---|
| 2026-11-15 | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/2026-11-15.jsonl` | 12 turnos de combate (23-50 s en BD) | `QA-340`: `resultadoDelGolpe` en el esquema | 1.ª pasada: 0 rechazos en 6 intercambios, 1 reintento por JSON cortado (300 tokens); 2.ª: «el orco desconocido» bien, 1 rechazo en un turno sin rival en el contexto (sin campo); P471 corta los intercambios desde el 3.er turno |
| 2026-11-15 (tanda 131) | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/2026-11-15.jsonl` | 3 turnos de combate (5 llamadas `narrar`, 2 `narrar_respaldo`; turno p50 87,8 s) | `P471` (Ataque Básico del panel, 1v1) y `QA-347` (tope 400) | P471 ✅: intercambio en cada turno de ataque; QA-347: 0 llamadas al tope (máx. 222, p50 192 tokens), pero intento 2 en 2 de 3 turnos y respaldo en 2 por rechazos del guardia (esquiva limpia con golpe conectado; jugador acertando cuando acertó el NPC). `escenario.sh cargar` restaura un lore sin indexar y `arrancar-juego.sh` aborta por rag-eval: hubo que `npm run reindex-lore` (con el juego ya en pie) |
| 2026-11-15 (tanda 132) | narrador (`tarkor-narrador-llama31`) | Deck, `logs/ia/2026-11-15.jsonl` y `logs/bench-26-qa348.json` | 4 turnos de combate 1v1 (5 llamadas `narrar`; 1 intento 2) + bench de 8 | `QA-348` (calentar con todos los hechos en combate) | 1.er turno tras reabrir en combate: prefill 9,4 s (antes 24-25 s), turno 25,3 s; calentamiento al abrir 4.496 tokens, 17,3 s en segundo plano. Sin calentar (partida sin prefijo), 1.er turno 25,2 s de prefill e intento 2. El Ollama de la tanda 131 era el que dejó encendido el script del GVE (`logs/gve`); `escenario.sh cargar` vuelve a pedir `reindex-lore` |
