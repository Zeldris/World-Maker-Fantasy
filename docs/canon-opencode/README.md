# Capa de canon para OpenCode

Resumen denso del lore de `docs/rpgtarkor/`, pensado para el agente `narrador-lore` de OpenCode
(Qwen3.5-9B, 32k de contexto). **No es la fuente de verdad**: si algo choca, manda
`docs/rpgtarkor/`.

**Por qué existe.** Los `.md` originales son demasiado grandes para el modelo local (el antiguo
`areas.md` ocupaba unos 23k tokens) y llevan notas de auditoría y referencias a código que el modelo
confunde con canon. Con esta capa, cada petición carga entre 6k y 8k tokens y deja sitio para
razonar y escribir.

## Estructura

| Fichero | Contenido | Se lee en |
|---|---|---|
| `00-nucleo.md` | Reglas duras, enums, escala de valor, lista de REVISA | siempre |
| `01-lenguas.md` | Diccionario de todas las lenguas | siempre |
| `02-razas.md` | Cómo es y vive cada raza | NPC, FACCIONES, EVENTOS, CULTURA |
| `regiones/<región>.md` | Zonas, habitantes, especies y **huecos** | todo lo que lleva `<región>` |
| `catalogo/fauna.md` | Toda la fauna con familia, nivel y temperamento | FAUNA, LUGARES |
| `catalogo/flora-minerales.md` | Toda la flora y los minerales, y los materiales animales | FLORA, LUGARES, CONSTRUCCIONES, RECETA |
| `catalogo/items.md` | Armas, armaduras y consumibles con sus números | ITEMS, RECETA |
| `catalogo/oficios-edificios.md` | Oficios reales, recetas de Reino, edificios de facción | FLORA, ITEMS, CONSTRUCCIONES, RECETA |
| `catalogo/clases.md` | 9 clases, especializaciones, razas y armaduras | NPC |
| `catalogo/facciones-npcs.md` | Facciones, relaciones y NPC existentes | NPC, FACCIONES, EVENTOS, CULTURA, GANCHO |
| `historia/cronologia.md` | Línea temporal completa con huecos | FACCIONES, EVENTOS, CULTURA, DOCUMENTO |

Slugs de región: `llanuras`, `cienaga`, `margen`, `meseta`, `cristal-helado`. Vaelira está fuera de
juego y solo aparece en el núcleo.

## Cómo se escribe una ficha de esta capa

Por orden de prioridad:
1. Lo que el modelo **debe respetar**: nombres exactos, posición, enums.
2. Lo que **debe reutilizar**: especies, materiales y NPC existentes.
3. Lo que **falta**: los huecos, para que proponga contenido que haga falta.
4. El color narrativo, solo si sobra espacio.

Sin fechas de auditoría ni rutas de código en el cuerpo. Una línea de cabecera con qué es, de dónde
sale y cuándo se sincronizó. `*` marca lo aprobado que todavía no está en el código.

## Mantenimiento

La actualiza **Claude al aprobar una propuesta**: cuando algo pasa a `docs/rpgtarkor/`, se actualiza
aquí su ficha y la fecha de "Sincronizado" (paso incluido en `docs/runbooks/ampliar-lore.md`).
Presupuesto: ninguna tabla `LEE` debe pasar de ~16k tokens (calculado como caracteres ÷ 3,3).
