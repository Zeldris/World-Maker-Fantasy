# Retro y opt-tokens · `claude/lore-enciclopedia` (2026-10-26)

**Estado:** aprobada entera por la usuaria (2026-10-26) y aplicada en la rama: 1 → `QA-257`, 2 → `QA-258`,
3 → `QA-259`, 6 → `QA-260`. La 4 y la 5 se quedan en «Para Galivelop-workflow» para `gw-harvest`.

Sesión de `QA-243`, `QA-244` y `QA-256`:
- la historia, sin documento: saber común o por lugar, con la migración `20261026120000_historia_sin_documento`;
- la segunda pasada por la enciclopedia, con el canon al día;
- el seed sin huérfanos;
- los textos limpios y los arreglos según el canon.

Para el trabajo mecánico se usaron tandas de subagentes: 9 de auditoría y los bloques 1 y 2 de edición.

Cifras de `medir.py --hours 0`:
- **Sesión principal:**
  - 275 llamadas y 3 compactaciones;
  - contexto medio de 112k, con techo de 165k;
  - toda con Opus.
- **Subagentes:**
  - el bloque 1 (Sonnet): 66 llamadas, 103k de media y 6,8M de entrada;
  - el de Opus más caro: 34 llamadas y 3,3M;
  - un subagente arranca de media con 38k.
- **Total con subagentes:** 51,3M de entrada.

La revisión previa a `main` dio 12 hallazgos, todos verificados:
- 7 se arreglaron en `f14a541b`;
- 4 leves quedan en la bitácora;
- 1 era cierto pero inocuo, y se explica en un comentario.

## Lo que salió mal

- **El retiro de huérfanos se dejó referencias de partida.** Al bloque 2 se le escaparon varias:
  - las referencias sin FK, que apuntan por slug (`WorldPopulation.targetSlug`, `ZonePoint.targetSlug`,
    `Npc.homeLocationSlug`, `Save.pendingCombatNpcSlugs`);
  - los edificios de las facciones copia de partida, que cuelgan de la copia sin `saveId` (`mundoPartida.ts`).

  Las cazó la revisión de código (hallazgos 2-4). Que una copia de partida tenga hijos sin `saveId` no lo dice ningún
  documento: hay que leer `clonarConCandado`.
- **tsc no vio un nombre de relación equivocado.** Dentro del `where` anidado de un `deleteMany`, tsc aceptó
  `almacen` (la relación es `almacenItems`), y ni siquiera con `prisma generate` saltó con un nombre inventado. Solo
  lo detectó el test de integración contra Postgres.
- **Un falso verde en `rojo-sin-arreglo.sh`.** La orden era `host.sh bash -c "… | grep …"`, y el `pipefail` del
  script no llega al `bash -c` interior: el `grep` se tragó el código de salida y el test «pasaba sin arreglo». El
  script ya tiene `--fails-with REGEX`, que hace eso mismo sin pipe.
- **Una regla de reemplazo del encargo B1 era demasiado amplia y renombró nombres canónicos.** Se revirtió a mano. El
  encargo daba la regla («X, nunca Y») sin decir dónde Y sí es correcto.
- **Gasto:**
  - el bloque 1 se llevó 6,8M (el 13 % del total) en una sola tanda de 66 llamadas que terminó con 103k de contexto
    medio;
  - en la sesión principal, `worldCatalog.ts` se leyó 44 veces (542k arrastrados) y `lore-hallazgos.md` 17 veces
    (300k).

## Lo que salió bien

- Las auditorías de unas 30 llamadas por tanda, con `ficha.sh` (`QA-245`/`QA-247`), dieron hallazgos con cita y
  propuesta, listos para decidir por bloques.
- La usuaria decidió los cuatro bloques en una ronda de preguntas, y los falsos positivos (Detonante, la fecha del
  Pacto del Canizor, Yerreo) se cerraron sin tocar el canon.

## Propuestas

Ordenadas por gravedad. Entre paréntesis, a dónde va cada una.

1. **Puntero a las copias de partida en `docs/mapa-agente.md`** (proyecto, navegación). Una entrada en «Datos que se
   confunden»:
   - `mundoPartida.ts#clonarConCandado` copia facciones (`saveId` + `origenSlug`) y población (`saveId`);
   - los territorios, edificios y almacén de una facción copia cuelgan de ella **sin `saveId`**;
   - estas referencias van por slug, sin FK: `targetSlug` de `WorldPopulation` y `ZonePoint`, `homeLocationSlug`,
     `Companion.sourceSlug` y `pendingCombatNpcSlugs`.

   Coste: 3 líneas. Riesgo: ninguno.
2. **Regla de `REVIEW.md`** (proyecto, revisión). Un borrado o una actualización con condición sobre relaciones de
   Prisma (`where` anidado) lleva un test de integración contra Postgres, porque tsc no valida esos nombres. Coste: 1
   línea. Riesgo: ninguno; es criterio del revisor y no carga contexto en la implementación.
3. **Tope de llamadas también en las tandas de edición** (proyecto, opt-tokens). Hoy `.claude/gw/opt-tokens.md` pone
   el tope de unas 30 llamadas solo a las de auditoría. Con un tope de 30-40 también en las de edición, un bloque
   como el 1 se habría partido en 2-3 tandas con el mismo encargo.
   - Ahorro: unos 2-3M por sesión parecida, porque el contexto medio pasa de 103k a unos 60k.
   - Riesgo: criterios distintos entre tandas. Contrapeso: el mismo encargo y revisar el diff entero en la principal.
4. **Encargos con reemplazos globales** (general, para `orchestrate-dealer`). Una regla «X, nunca Y» va con su
   `grep` previo y con la lista de los sitios donde Y es correcto, que el subagente no toca. Ver abajo.
5. **`rojo-sin-arreglo.sh` y los pipes** (general). Ver abajo.
6. **Leer por partes** (proyecto, opt-tokens, prioridad baja). `lore-hallazgos.md` se lee por secciones
   (`grep -n "^## "` y luego `sed -n`). Para los textos de `worldCatalog.ts`, `ficha.sh` ya da la ruta: falta que dé
   también el `archivo:línea` de cada texto visible. Ahorro: unos 0,5M por sesión de lore. Riesgo: ninguno.

## Para Galivelop-workflow

- **`orchestrate-dealer`:** cuando un encargo da una regla de reemplazo global, que la acompañe con:
  - el `grep` que muestra todas las apariciones antes de editar;
  - la lista de excepciones que no se tocan.

  Si no, el subagente aplica la regla también donde el nombre es correcto.
- **`rojo-sin-arreglo.sh`:**
  - avisar (o fallar) si la orden lleva `|` sin `pipefail`, porque un `bash -c "… | grep"` da falso verde;
  - en la ayuda, recomendar `--fails-with` en lugar de filtrar con `grep`.
