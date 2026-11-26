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
