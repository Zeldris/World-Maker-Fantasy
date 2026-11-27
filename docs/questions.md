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
- Asked: 2026-11-22
- Question: gw-update 0.8.1→0.8.2: ¿aplico apply.py --update (scripts, skills, ganchos y agentes del flujo)?
- Recommendation: sí: 111 archivos del flujo sin cambios locales, más gw.json a 0.8.2 y alta de .claude/agents/gw-reviewer.md
- Answer: ok
- Answered: 2026-11-22

## Q-4
- Refs:
- Status: answered
- Asked: 2026-11-22
- Question: ¿Añado a REVIEW.md la regla nueva: el código que lee lo que escribe un agente o una persona lleva un test con una muestra real?
- Recommendation: sí: añadirla a REVIEW.md tal cual y subir su marca a v0.8.2
- Answer: ok
- Answered: 2026-11-22

## Q-5
- Refs:
- Status: answered
- Asked: 2026-11-22
- Question: ¿Añado a AGENTS.md la regla de la plantilla de no hacer commits solo para el ledger de métricas?
- Recommendation: sí: añadir a AGENTS.md (Relevos) que no se hace un commit solo para el ledger de métricas; lo lleva el pre-commit del siguiente commit de trabajo
- Answer: ok
- Answered: 2026-11-22

## Q-6
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: Hay v0.9.0 del flujo (proyecto en 0.8.2, sin PR todavía). ¿Aplico apply.py --update (17 nuevos, 113 actualizados, hook PreToolUse nuevo en .claude/settings.json, propuestas AGENTS.md/CLAUDE.md.gw-new)?
- Recommendation: ok: aplicar --update ahora en esta misma rama; el PR llevará 0.8.1 → 0.9.0 de una vez
- Answer: ok
- Answered: 2026-11-24

## Q-7
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: schemaVersion 1 → 2 en .claude/gw.json: ¿migrar language y visibleLanguages al bloque languages?
- Recommendation: ok: migrar language/visibleLanguages al bloque languages (docs.primary es, ui vacío; code en)
- Answer: ok
- Answered: 2026-11-24

## Q-8
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: REVIEW.md/GLOSSARY.md: ¿solo subir la marca a v0.9.0?
- Recommendation: ok: REVIEW.md solo cambia la línea marca a v0.9.0 (nuestra regla de idiomas visibles no existe y ui está vacío); GLOSSARY.md, solo la marca
- Answer: ok
- Answered: 2026-11-24

## Q-9
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: ¿Instalar la skill nueva gw-seo?
- Recommendation: ok: crear gw-seo en .claude/skills y .agents/skills (es del flujo; WMF no tiene web pública, no estorba); alternativa: no, y se excluye
- Answer: ok
- Answered: 2026-11-24

## Q-10
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: workflowClone → ../galivelop-workflow
- Recommendation: ok
- Answer: ok
- Answered: 2026-11-24

## Q-11
- Refs:
- Status: answered
- Asked: 2026-11-24
- Question: Quitar los 8 worktrees ya fusionados
- Recommendation: ok
- Answer: ok
- Answered: 2026-11-24

## Q-12
- Refs: retro-2026-11-24-gw-update-0.9
- Status: answered
- Asked: 2026-11-24
- Question: Retro del gw-update 0.9.0: ¿P1 (nota en gw-scout-updates.md: skills-con-tests.py antes del primer push), P2 (desconectar conectores sin uso), G1 y G2 (propuestas al flujo)?
- Recommendation: aplicar P1; P2 la haces tú; G1 y G2 al flujo
- Answer: ok
- Answered: 2026-11-24

## Q-13
- Refs: QA-528
- Status: answered
- Asked: 2026-11-24
- Question: ¿Fusionar claude/imagenes-por-fases en main (IMG-34…58)?
- Recommendation: sí, en su propia sesión, por merge
- Answer: ok (en su propia sesión, por merge)
- Answered: 2026-11-24

## Q-14
- Refs: QA-528
- Status: answered
- Asked: 2026-11-24
- Question: ¿Está listo galivelop-voice-generator para levantar la pausa de VOZ en 0.3?
- Recommendation: confirmarlo antes de empezar 0.3; si no está, VOZ-1…3 pasan a 0.4
- Answer: ok (confirmarlo antes de empezar 0.3; si no está, VOZ-1…3 pasan a 0.4)
- Answered: 2026-11-24

## Q-15
- Refs: QA-528
- Status: answered
- Asked: 2026-11-24
- Question: ¿Vale el reparto de los generadores por hito?
- Recommendation: sí
- Answer: ok
- Answered: 2026-11-24

## Q-16
- Refs: QA-528
- Status: answered
- Asked: 2026-11-24
- Question: ¿Pasar el veredicto de los pilotos de IMG-6 al roadmap de imágenes?
- Recommendation: sí, cuando dé el veredicto
- Answer: ok (cuando dé el veredicto)
- Answered: 2026-11-24

## Q-17
- Refs: QA-528
- Status: answered
- Asked: 2026-11-24
- Question: ¿Se confirman las 32 filas «no se juega» de matriz-pruebas (IMG y MAP cerradas)?
- Recommendation: sí
- Answer: ok
- Answered: 2026-11-24

## Q-18
- Refs:
- Status: answered
- Asked: 2026-11-26
- Question: Siguiente lote de la puerta (paso 3): a) arreglos de código en la nube P266+P273+P486; b) tanda de juego P131 (huir en combate) y P429 (Interactuar sobre el recinto); c) los dos
- Recommendation: a) lote de arreglos en la nube: P266 (frase fija del guion), P273 (el registro de IA dice por qué rechaza), P486 (narración contra la tarjeta de defensa); con test en rojo y jugado con el simulado
- Answer: a
- Answered: 2026-11-26

## Q-19
- Refs:
- Status: answered
- Asked: 2026-11-26
- Question: P311 (Interactuar no ofrece regalar): ¿se cierra por no haber regalo, o se abre un camino para regalar?
- Recommendation: cerrar P311: no hay camino de regalo en Interactuar y lo que queda es voz del narrador (Ollama real, ya en «Para la sesión local»)
- Answer: ok (cerrar P311)
- Answered: 2026-11-26

## Q-20
- Refs:
- Status: answered
- Asked: 2026-11-26
- Question: Lo que queda de la puerta depende casi todo de Ollama real o de arte: ¿tras este lote pasamos al paso 4 (limpieza del roadmap)?
- Recommendation: después del lote, pasar al paso 4 (limpieza del roadmap) y dejar a la Deck lo que solo sale con Ollama real o arte
- Answer: ok (paso 4 tras el lote)
- Answered: 2026-11-26

## Q-21
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: Tareas del Cronista del 0.3 o posteriores metidas en fases del 0.2 (CR-50…52, 57, 60, 64, 69…72): a) moverlas a una sección «Fuera de fase» de su hito en roadmap-cronista.md; b) tolerarlas con una lista de excepciones en cobertura.py
- Recommendation: a) sección «Fuera de fase» por hito en roadmap-cronista.md y mover allí esas líneas
- Answer: a
- Answered: 2026-11-26

## Q-22
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: Las 8 propuestas aprobadas de tipo QA (filas 1-3, 6 y 10-13 de propuestas-aprobadas.md): a) al hito 0.7, cada una con su id QA-n; b) dejarlas sin hito hasta cerrar las pruebas
- Recommendation: a) una fila «QA de las pruebas» en el hito 0.7, un QA-n por propuesta
- Answer: a
- Answered: 2026-11-26

## Q-23
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: CFG-20 («dónde se muestran» las tiradas) está a medias: ¿se queda 🚧 en el 0.2, con lo que falta apuntado?
- Recommendation: sí: CFG-20 queda 🚧 en el 0.2 con lo que falta apuntado
- Answer: sí
- Answered: 2026-11-26

## Q-24
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: ¿Pasan a «Preguntas abiertas para Álvaro» el objetivo de turno de la Fase F del 0.1 y CR-49c?
- Recommendation: sí
- Answer: sí
- Answered: 2026-11-26

## Q-25
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: ¿Se marcan el 0.1 y el 0.2 como «cerrados salvo Álvaro», con la lista de lo que espera (Fase E de súbditos, objetivo de turno, ZON-1/UX-14, CR-49c, etiquetas v0.1.0/v0.2.0; la Fase G del 0.1 pasa al 0.7; CR-8 falta correrlo con --aplicar en la base real)?
- Recommendation: sí
- Answer: sí
- Answered: 2026-11-26

## Q-26
- Refs: QA-532
- Status: answered
- Asked: 2026-11-26
- Question: La matriz tiene 21 filas nuevas (CFG-9 y 20 de ZON: 2, 3, 4, 6, 16, 18, 30…34, 36, 38, 40, 41, 45, 50, 51, 53, 58) como «no se juega, sin ronda registrada; para la fase única del 0.7»: a) se quedan así; b) pasan a «sin jugar» y entran en la puerta de pruebas
- Recommendation: a) se quedan en «no se juega», como las 32 de Q-17; el 0.7 tiene su fase de pruebas
- Answer: a
- Answered: 2026-11-26

## Q-27
- Refs:
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P1): L1 y L2 de la ronda local 3 se jugaron con Ollama real sin IA_REGISTRO (ia-ronda.sh arrancar + escenario.sh cargar, sin juego.sh). ¿Hacemos que arrancar-juego.sh falle en ese caso?
- Recommendation: Sí: arrancar-juego.sh se para con un error si :11434 es un Ollama real y no hay IA_PERFIL, y dice la orden (juego.sh); tarea QA nueva
- Answer: a
- Answered: 2026-11-20

## Q-28
- Refs:
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P2): P491 (Tirag no nombra a los Ketg como la casta que manda). ¿Se cierra o se trabaja el prompt de dialogo_npc?
- Recommendation: Cerrar P491 como «no aplica»: el lore entra en el prompt y Tirag, «sometida por los Ketg», calla por miedo, como dice ese lore
- Answer: a
- Answered: 2026-11-20

## Q-29
- Refs:
- Status: answered
- Asked: 2026-11-20
- Question: /gw-opt-ai 2026-11-20 (P3): P492 (Torgash llama «forastero» a Gorhorn). ¿Se cierra como diseño?
- Recommendation: Cerrar como diseño (P467) la parte de «forastero», y comprobar en la próxima tanda, con registro, que tras «Soy Gorhorn» Torgash usa el nombre
- Answer: a
- Answered: 2026-11-20

## Q-30
- Refs: QA-361
- Status: answered
- Asked: 2026-11-21
- Question: La L4 no arranca: con bge-m3, la guarda rag-eval de arrancar-juego.sh falla en 3 casos obligatorios (Vaelira/Kelife resumen ES y EN, y «quién manda en el Clan Serhu» en inglés; el mismo resultado del cierre del GVE, 0.815). ¿a) tarea nueva: mirar esos 3 casos y arreglar el índice/búsqueda o rebajarlos a no obligatorios, y luego jugar; b) variable de pruebas para saltar la guarda y jugar ya; c) volver a nomic para esta ronda?
- Recommendation: a) tarea de arreglo pequeña en esta rama antes de la L4
- Answer: a
- Answered: 2026-11-21

## Q-31
- Refs: QA-361
- Status: answered
- Asked: 2026-11-21
- Question: ¿Paro Ollama y el vigilante mientras tanto (ia-ronda.sh parar) para liberar memoria?
- Recommendation: parar ya
- Answer: ok
- Answered: 2026-11-21

## Q-32
- Refs: P251, QA-526
- Status: answered
- Asked: 2026-11-21
- Question: Arreglo de P251: a) pasar a generateNpcReply solo las líneas «En <facción> manda <líder>» (y los muertos) de verdadObligatoria, como un punto más de «LO QUE SABES DEL MUNDO»; b) pasar el bloque de verdad entero (guerras, etiquetas, compañeros: más tokens y más riesgo de recitar)
- Recommendation: a
- Answer: a
- Answered: 2026-11-21

## Q-33
- Refs: P251, QA-526
- Status: answered
- Asked: 2026-11-21
- Question: Tirag esquiva la pregunta (4/5) aun con la verdad delante: a) vale, en su carácter: su caso solo exige que no se invente otro líder; b) exigir que diga Ulkha
- Recommendation: a
- Answer: a
- Answered: 2026-11-21

## Q-34
- Refs: P496
- Status: answered
- Asked: 2026-11-21
- Question: P496, la réplica anterior de otro NPC en el prompt: a) arreglarlo junto a P251 (la guarda de repetición solo con la última réplica del mismo NPC), con test en rojo; b) dejarlo para otra sesión
- Recommendation: a
- Answer: a
- Answered: 2026-11-21
