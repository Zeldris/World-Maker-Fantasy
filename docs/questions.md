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
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P1): L1 y L2 de la ronda local 3 se jugaron con Ollama real sin IA_REGISTRO (ia-ronda.sh arrancar + escenario.sh cargar, sin juego.sh). ¿Hacemos que arrancar-juego.sh falle en ese caso?
- Recommendation: Sí: arrancar-juego.sh se para con un error si :11434 es un Ollama real y no hay IA_PERFIL, y dice la orden (juego.sh); tarea QA nueva
- Answer: a
- Answered: 2026-11-20

## Q-4
- Refs:
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P2): P491 (Tirag no nombra a los Ketg como la casta que manda). ¿Se cierra o se trabaja el prompt de dialogo_npc?
- Recommendation: Cerrar P491 como «no aplica»: el lore entra en el prompt y Tirag, «sometida por los Ketg», calla por miedo, como dice ese lore
- Answer: a
- Answered: 2026-11-20

## Q-5
- Refs:
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P3): P492 (Torgash llama «forastero» a Gorhorn). ¿Se cierra como diseño?
- Recommendation: Cerrar como diseño (P467) la parte de «forastero», y comprobar en la próxima tanda, con registro, que tras «Soy Gorhorn» Torgash usa el nombre
- Answer: a
- Answered: 2026-11-20

## Q-6
- Refs: QA-361
- Status: answered
- Asked: 2026-11-21
- Question: La L4 no arranca: con bge-m3, la guarda rag-eval de arrancar-juego.sh falla en 3 casos obligatorios (Vaelira/Kelife resumen ES y EN, y «quién manda en el Clan Serhu» en inglés; el mismo resultado del cierre del GVE, 0.815). ¿a) tarea nueva: mirar esos 3 casos y arreglar el índice/búsqueda o rebajarlos a no obligatorios, y luego jugar; b) variable de pruebas para saltar la guarda y jugar ya; c) volver a nomic para esta ronda?
- Recommendation: a) tarea de arreglo pequeña en esta rama antes de la L4
- Answer: a
- Answered: 2026-11-21

## Q-7
- Refs: QA-361
- Status: answered
- Asked: 2026-11-21
- Question: ¿Paro Ollama y el vigilante mientras tanto (ia-ronda.sh parar) para liberar memoria?
- Recommendation: parar ya
- Answer: ok
- Answered: 2026-11-21

## Q-8
- Refs: P251, QA-526
- Status: open
- Asked: 2026-11-21
- Question: Arreglo de P251: a) pasar a generateNpcReply solo las líneas «En <facción> manda <líder>» (y los muertos) de verdadObligatoria, como un punto más de «LO QUE SABES DEL MUNDO»; b) pasar el bloque de verdad entero (guerras, etiquetas, compañeros: más tokens y más riesgo de recitar)
- Recommendation: a

## Q-9
- Refs: P251, QA-526
- Status: open
- Asked: 2026-11-21
- Question: Tirag esquiva la pregunta (4/5) aun con la verdad delante: a) vale, en su carácter: su caso solo exige que no se invente otro líder; b) exigir que diga Ulkha
- Recommendation: a

## Q-10
- Refs: P496
- Status: open
- Asked: 2026-11-21
- Question: P496, la réplica anterior de otro NPC en el prompt: a) arreglarlo junto a P251 (la guarda de repetición solo con la última réplica del mismo NPC), con test en rojo; b) dejarlo para otra sesión
- Recommendation: a
