**Título:** La historia sin documento y la segunda pasada por la enciclopedia; el seed retira lo huérfano (QA-243, QA-244, QA-256, QA-257…QA-259, QA-272, QA-273)

## Summary

La enciclopedia, contrastada otra vez con el canon. Cada arreglo, con el sí de la usuaria y apuntado en
`docs/registros/lore-hallazgos.md`.

**`QA-244`: una entrada de historia ya no necesita documento.** Se descubre al visitar su lugar (como las bóvedas de
datos de X4) o, sin documento ni lugar, es saber común. Se calcula al leer, como `unlocked`.

```diff
 buildHistoriaSection(historiaRows, locationIdBySlug, ctx)      # b/routes/world.ts
-  discovered = ctx.isDiscovered('historia', slug)
+  if documentoItemSlug   discovered = ctx.isDiscovered('historia', slug)    # como antes
+  elif lugarSlug         discovered = el lugar está descubierto
+  else                   discovered = true                                  # saber común
 HistoriaEntry
-  documentoItemSlug String
+  documentoItemSlug String?      # nunca con lugarSlug a la vez (lo valida seed-catalog.ts)
+  lugarSlug         String?
```

También entran diez hechos de la cronología, y en el canon se arreglaron los tres choques con el juego.

**`QA-256`: el seed retira lugares, facciones y NPC que ya no están en el catálogo**, pero solo si ninguna partida
los referencia. Si alguna lo hace, se quedan y se avisa por consola con el motivo.

```text
seed-catalog.ts
  retirarLugaresHuerfanos / retirarFaccionesHuerfanas / retirarNpcsHuerfanos   (scripts/retirarHuerfanos.ts)
    candidatas = filas de catálogo (saveId null) cuyo slug ya no está en worldCatalog.ts
    cuenta las referencias de partida:
      las de FK
      las que van por slug, sin FK (población, puntos de zona, hogar, compañeros, combate pendiente…)
      los edificios de las facciones copia de partida, que no llevan saveId
    deleteMany con las mismas relaciones como condición (`none`)
      → una referencia creada durante el seed no se lleva datos de partida por la cascada
```

Además:
- textos de la enciclopedia sin notas de diseño, jerga del motor, inglés ni erratas («tier» → «nivel», también en
  el frontend);
- fichas según el canon: edades de los orcos, Kael Dorn arquero, materiales y lugares de origen;
- cinco habilidades de fauna renombradas («Posicion defensiva» → «Posición defensiva», «Vuelo en Bandada» →
  «Fuga en Bandada», «Brasa Berserker» → «Brasa Rabiosa»…), con su entrada en `HABILIDADES_RENOMBRADAS` para que
  las partidas guardadas pasen al nombre nuevo (`QA-68`).

**Retro aplicada** (`docs/registros/retro-2026-10-26-lore-enciclopedia.md`):

```diff
 docs/mapa-agente.md
+  «Copias de partida»: qué clona mundoPartida.ts, qué cuelga sin saveId y qué va por slug sin FK (QA-257)
 REVIEW.md
+  un where anidado de Prisma en un borrado lleva test contra Postgres (QA-258)
 docs/runbooks/ampliar-lore.md, .claude/gw/opt-tokens.md
+  tope de 30-40 llamadas también en las tandas de edición (QA-259)
 tools/qa/ficha.sh
+  acaba con «# Fuente»: archivo:línea del slug en backend/src/scripts y services (QA-272)
 backend/src/services/habilidadesConocidas.json
+  los 495 nombres de habilidad que una partida puede guardar; el test falla si uno desaparece sin renombre (QA-273)
```

## Evidence

- **Retiro de huérfanos.** `retirarHuerfanos.integration.test.ts` corre contra Postgres:
  - retira el lugar, la facción y el NPC que no tienen referencias;
  - conserva los que tienen una visita, un edificio de facción copia, un territorio, un estado de NPC o una
    población de partida, cada uno con su motivo.

  Sin el arreglo, el test falla (`rojo-sin-arreglo.sh`). El seed real retiró los 10 huérfanos de la base local: 8
  lugares, 1 facción y 1 NPC.
- **Historia sin documento.** `world.test.ts`:
  - una entrada por lugar está oculta hasta visitarlo;
  - una de saber común está abierta desde el principio;
  - la que tiene documento sigue como antes.
- **`ficha.sh`.**
  - **Antes:** había que hacer `grep`/`sed` sobre `worldCatalog.ts`, que se leyó 44 veces en la sesión.
  - **Después:** `ficha.sh guchapo` acaba con 13 líneas `archivo:línea`, entre ellas `sexDimorphism.ts:311`,
    `usosFauna.ts:37` y `companionSupervivencia.ts:114`. Lo cubre `ficha.test.ts › fuente` (rojo sin el arreglo).
- **Guardia de nombres (`QA-273`).** Sin las entradas de `HABILIDADES_RENOMBRADAS`, `habilidadesRenombradas.test.ts`
  falla con «añade "Vuelo en Bandada" a HABILIDADES_RENOMBRADAS (QA-68)…». Con ellas, 8/8.
- **CI local** (`tools/qa/ci-local.sh`, los tres jobs de `ci.yml`), en verde sobre `7c5da8d7`:

  | | tsc | vitest | oxlint |
  |---|---|---|---|
  | backend | 0 errores | 3822 tests (316 archivos) | 0 errores, 15 avisos |
  | frontend | 0 errores | 725 tests (156 archivos) | 0 errores, 29 avisos |

  Los commits posteriores (`QA-273` y sus arreglos) solo tocan tests y documentos; el pre-push pasó sus tests.

## Merge Danger

**Door:** one-way.

La migración `20261026120000_historia_sin_documento` deja `documentoItemSlug` como opcional y añade `lugarSlug`.
Volver atrás exigiría borrar las entradas sin documento. Además, el seed **borra** filas de catálogo huérfanas, y esas
filas no vuelven si se revierte el código, aunque nunca borra nada que tenga referencias de partida.

**Blast Radius:** enciclopedia.

- La pestaña de historia cambia qué está descubierto.
- Las partidas guardadas no cambian: sus copias de facciones, población y lugares llevan `saveId` y no se tocan.

Quedan como leves pendientes (aquí y en la bitácora de la rama):
- un CHECK en la base para «documento o lugar»;
- un aviso cuando se descubre una historia por lugar;
- las cuentas del retiro por lotes;
- el campo `pendiente` de `usosFauna`;
- `ficha.sh` con `archivo:línea` por campo;
- los de `QA-273`, en `roadmap-front.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
