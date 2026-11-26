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
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ahora mismo una facción no echa nada en falta (comida sin tope y agua siempre cubierta por su fuente canónica), así que no tiene motivos para construir. ¿a) Le aplicamos los topes y el agua del Reino para que sus obras arreglen carencias reales, o b) seguimos sin carencias y las obras solo dan ventajas?
- Recommendation: a) Las facciones con las reglas del Reino: tope de comida 60 + 120 por Granero, tope de agua 60 + 120 por Cisterna, y la fuente canónica cubre solo lo que da hoy al Reino (20 al día) más 12 por Pozo. Al migrar, cada facción recibe los edificios que su tamaño necesita, para que nadie se hunda el primer día.
- Answer: a (ok)
- Answered: 2026-11-26

## Q-28
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿qué obras levantan las facciones?
- Recommendation: Pozo, Granero y Cisterna (supervivencia) y el taller de oficio que usa su reparto (Cocina y Corrales, subiendo de escalón). La defensa sigue siendo CR-65. Leñera, Cantera y Fibrería no, porque las facciones no llevan materiales.
- Answer: ok
- Answered: 2026-11-26

## Q-29
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿cómo pagan las obras y cuánto tardan?
- Recommendation: (Rehecha el 2026-11-26: la usuaria pide que, como en X4, los trabajadores se muevan y los recursos se transporten, con sus riesgos, y que las acciones vivan en el mapa; ADR 0003.) Nada en Goirnos abstractos: la obra pide los materiales reales de su receta (p. ej. Pozo, 6 de piedra) en el Almacén de la facción (`AlmacenItem.factionId`); los obreros son trabajadores que van a la obra como viajeros si está fuera del asentamiento; el plazo es el de la receta, hasta ×4 con pocos obreros (como los drones de X4); una obra a la vez y con 7 días de reserva de comida. De dónde salen los materiales y sus riesgos, Q-33…Q-36.
- Answer: ok
- Answered: 2026-11-26

## Q-30
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿cómo elige una facción qué construir?
- Recommendation: Una lista de prioridad fija (sed > almacén de comida lleno o hambre > taller de su oficio). La disposición del líder (CR-38) la matiza cuando exista.
- Answer: ok
- Answered: 2026-11-26

## Q-31
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿cómo se entera la jugadora de esas obras?
- Recommendation: Un suceso al empezar y otro al terminar (noticias del mundo y agenda), y el edificio aparece en su asentamiento en el mapa de zona.
- Answer: ok
- Answered: 2026-11-26

## Q-32
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿qué pasa con una obra a medias si atacan el asentamiento?
- Recommendation: (Cambiada tras contrastar, 2026-11-26.) Como en X4, donde la obra se para si matan al constructor y los módulos destruidos vuelven a «en construcción», la obra se para mientras el asentamiento está en guerra o lo asaltan, y sigue después sin perder lo pagado. El saqueo de CR-37 ya se lleva parte del tesoro. Sabotearla desde el Reino queda para después. Fuente: https://steamcommunity.com/app/392160/discussions/0/2269194717045881131
- Answer: ok (la recomendación cambiada tras contrastar)
- Answered: 2026-11-26

## Q-33
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿de dónde salen los materiales de la obra?
- Recommendation: a) Partidas de acopio (leñadores, canteros…) que salen como viajeros, con el mismo motor que las de caza (CR-63), hasta la fuente más cercana de su región y vuelven con la carga. b) Comprarlos a otra facción con una caravana entra cuando las caravanas sean viajeros (CR-64, 0.4). Hasta CR-39, las fuentes son los puntos de recurso de las zonas de su región.
- Answer: a (b con CR-64)
- Answered: 2026-11-26

## Q-34
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿las partidas de acopio corren riesgos por el camino y se pueden ver y tocar en el mapa?
- Recommendation: Sí, como las partidas de caza: por el camino pueden toparse con fauna, bandidos o una facción en guerra (combate de fondo, ADR 0002) y perder gente y carga. La jugadora puede cruzárselas en el mapa y preguntarles, comerciar, escoltarlas o asaltarlas; si la carga se pierde, la facción vuelve a mandar otra partida.
- Answer: ok
- Answered: 2026-11-26

## Q-35
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: ¿el Reino usa las mismas partidas de acopio?
- Recommendation: Sí, por «los mismos sistemas para todos» del ADR 0003: el Reino puede mandar partidas de acopio desde Reino › Partidas con el mismo motor, y la jugadora sigue pudiendo depositar a mano.
- Answer: ok
- Answered: 2026-11-26

## Q-36
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36: con todo esto la tarea crece: ¿la partimos en pasos?
- Recommendation: CR-36 pasa de M a L, con pasos dentro de la misma tarea: 36a obras con materiales del Almacén y orden de prioridad; 36b partidas de acopio para facciones y Reino; 36c obreros que viajan a la obra, pausa en guerra y avisos.
- Answer: ok; la usuaria añade: a estas partidas, y a caravanas u otras acciones, se les podrán asignar guardias que las protejan
- Answered: 2026-11-26

## Q-37
- Refs: CR-64
- Status: answered
- Asked: 2026-11-26
- Question: Guardias de partidas y caravanas: ¿cómo funcionan y dónde entran?
- Recommendation: Una sola regla para todo viajero (acopio, caza, caravanas, expediciones, mensajeros), del Reino y de las facciones: el rol «guardia» que ya prevé ViajeroMiembro. Los guardias salen de tus soldados o vigías y, en las facciones, de sus soldados, y dejan de defender el asentamiento mientras viajan. En un encuentro pelean primero y los porteadores solo si caen los guardias. Las facciones eligen cuántos según el riesgo de la ruta (fauna, bandidos, guerra) y lo que les sobre. Entra en 36b para el acopio y en la infraestructura de CR-64 para lo demás; «escoltar» a viajeros ajenos sigue en CR-64. Contraste: X4 asigna la escolta como orden persistente de «defender al comandante», pero sus escoltas se adelantan o llegan tarde porque solo reaccionan tras el primer golpe (wiki.egosoft.com, Defend Commander; forum.egosoft.com p=4781138). Aquí los guardias van al paso del viajero, en el mismo grupo, y entran en el encuentro desde el primer asalto. Bellwright, Manor Lords y Medieval Dynasty no tienen escolta (en Bellwright solo existe por mod); D&D 5e paga a un guardia como asalariado cualificado, 2 po/día (PHB, Hirelings).
- Answer: ok
- Answered: 2026-11-26

## Q-38
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36a: una facción grande necesita muchos edificios iguales (Concordia de Hierro, 1600 bocas: ~150 Pozos), pero Building solo admite uno por facción y receta. ¿a) Le añadimos un campo «cantidad», b) quitamos esa restricción y guardamos una fila por edificio, o c) otra idea?
- Recommendation: a) Un campo nuevo Building.cantidad (1 por defecto): la facción guarda «Pozo ×150» en una fila, como el resto de su economía, que ya va en agregado. El Reino sigue con una fila por edificio. Las obras de facción van en un modelo propio, ObraFaccion (una por facción), aparte de la cola del Reino.
- Contraste (X4 marca el camino): en X4 el `god.xml` reparte a cada facción un número de módulos de producción por tipo (el que se cita: Teladi, 40 módulos de piezas de casco), no estaciones únicas; y una estación levanta un módulo a la vez desde su almacén de obra. Eso es a): «Pozo ×N» por facción y una obra a la vez. Manor Lords y Bellwright no aclaran cómo guardan los pueblos de la IA (Manor Lords los simula edificio a edificio a escala de aldea, que no es nuestro caso). Fuentes: https://www.nexusmods.com/x4foundations/mods/794 · https://forum.egosoft.com/viewtopic.php?p=4820996 · https://www.dbltap.com/news/manor-lords-ai-controlled-towns-are-starting-to-take-shape
- Answer: a
- Answered: 2026-11-26

## Q-39
- Refs: CR-36
- Status: answered
- Asked: 2026-11-26
- Question: CR-36a: ¿con qué tamaño se siembran los edificios al migrar?
- Recommendation: Para su poblacionMax (no la de hoy): agua 20 + 12 por Pozo con un 10 % de margen; Cisternas para 30 días de agua; Graneros para 30 días de comida. Así crecer hasta su tope no les deja sin agua mientras no haya acopio (36b), porque en 36a su Almacén aún no recibe piedra ni leña.
- Contraste: X4 genera al crear el universo todas las estaciones de las facciones de golpe (el motor `god`) con sus cupos, y desde ahí la IA solo repone y amplía; es nuestra siembra única e idempotente. Lo de «a su máximo y no a la población de hoy» no sale de las fuentes (los cupos de inicio de X4 son por partida, no por población): es nuestro, para no tener regresión antes de 36b. En Bellwright el pueblo crece por prosperidad, con puntos de obra por nivel: encaja con que, pasado el arranque, crecer cueste obra. Fuentes: https://forum.egosoft.com/viewtopic.php?p=5223951 · https://forum.egosoft.com/viewtopic.php?p=4789241 · https://www.godisageek.com/2024/11/bellwright-villages-2-0-update-adds-new-mechanics-quality-of-life-improvements-and-more
- Answer: ok, y al hacer 36b se repasa la siembra: población de hoy más un margen, y el resto por obras
- Answered: 2026-11-26
