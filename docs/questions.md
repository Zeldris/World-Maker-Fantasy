# Questions

Questions for the user, one entry each; `python3 .claude/gw/scripts/questions.py` reads and rewrites this
file (format: header of scripts/questions.py). Answer by number: `questions.py answer "5. a, 6. ok"`.

## Q-1
- Refs: QA-514
- Status: answered
- Asked: 2026-11-20
- Question: QA-514: el recalentado no baja el prefill (24-26 s) y 4 de 5 acertaron la caché, así que dialogo_npc quizá ya no desaloja con Ollama 0.34.2. ¿Qué hago? a) tanda A/B sin recalentado (recomendado) b) recalentar con el último prompt del narrar entero c) quitar el recalentado sin medir
- Recommendation: a) tanda A/B: 8 turnos de texto libre en t13b2-ketg con el recalentado apagado; si el narrar tras dialogo_npc ya sale con ~13,5k comunes y 10-12 s, Ollama 0.34.2 no desaloja y se quita el recalentado (hoy recorta la caché)
- Answer: a
- Answered: 2026-11-20

## Q-2
- Refs: QA-514
- Status: answered
- Asked: 2026-11-20
- Question: Si la A/B confirma que no hay desalojo, ¿quito el recalentado y cierro QA-514, y sigo con QA-518?
- Recommendation: a) sí, cerrar QA-514 sin recalentado si la A/B lo confirma; recalentar el narrar entero solo si la A/B muestra desalojo
- Answer: ok
- Answered: 2026-11-20

## Q-3
- Refs:
- Status: open
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P1): L1 y L2 de la ronda local 3 se jugaron con Ollama real sin IA_REGISTRO (ia-ronda.sh arrancar + escenario.sh cargar, sin juego.sh). ¿Hacemos que arrancar-juego.sh falle en ese caso?
- Recommendation: Sí: arrancar-juego.sh se para con un error si :11434 es un Ollama real y no hay IA_PERFIL, y dice la orden (juego.sh); tarea QA nueva

## Q-4
- Refs:
- Status: open
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P2): P491 (Tirag no nombra a los Ketg como la casta que manda). ¿Se cierra o se trabaja el prompt de dialogo_npc?
- Recommendation: Cerrar P491 como «no aplica»: el lore entra en el prompt y Tirag, «sometida por los Ketg», calla por miedo, como dice ese lore

## Q-5
- Refs:
- Status: open
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P3): P492 (Torgash llama «forastero» a Gorhorn). ¿Se cierra como diseño?
- Recommendation: Cerrar como diseño (P467) la parte de «forastero», y comprobar en la próxima tanda, con registro, que tras «Soy Gorhorn» Torgash usa el nombre
