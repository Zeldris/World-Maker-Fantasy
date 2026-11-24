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
