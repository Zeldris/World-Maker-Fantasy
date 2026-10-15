# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-13 |
| **Ramas de trabajo** | Una por cuenta, cada una con su fila «Tarea en curso» (`QA-69`): `claude/frontend-improvements-roadmap-0mpckt` (desde el 2026-10-06, `CR-55`) y `claude/wonderful-volta-662qt8`. Las skills de `.claude/skills/` van versionadas (`git add -f`); a `main` se pasa **por pull request**. |
| **Último commit en `main`** | Fusión del PR #52 (2026-10-13, `e461496`, otra cuenta): `QA-71`, `QA-72` (retro del PR #51). Antes: PR #51 (documentos reutilizables), Fusión del PR #50 (2026-10-13, `03f6dfe`, CI en verde): retro `QA-66`…`QA-70`, «asentar antes del roadmap», primera tanda de la ronda (P123-P127) y `/retro` tras cada PR. Antes: PR #49 (`14d669e`), PR #47 y PR #45. |
| **Hito** | `0.3` Reino profundo, Fase D (economía y ganadería) y E (conflicto) — [plan](../producto/plan-roadmap-0.3.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (ver abajo) |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | Corrección de los hallazgos de `QA-27` (P147-P187), de lo rápido a lo largo (usuaria, 2026-10-15). Tanda 1 (textos) hecha: P148, P149, P152, P153, P156, P159, P163, P170, P171, P176, P180, P183. Tanda 2: hechos P157, P160, P161, P162, P167, P168, P169, P173, P175, P182; faltan P181, P158, P155, P154, P141, P165, P150, P177, P186. Luego tanda 3. **Siguiente:** P181. |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | Hechos P136, P139, P134, P124, su `/code-review` y las 3 propuestas de la retro (`retro-2026-10-13-pr56.md`). **Siguiente:** PR a `main` y fusionar con el CI en verde. Quedan P144, P123 y jugar `QA-73` (necesitan el navegador). |
| **Tests** | Rama `claude/frontend-improvements-roadmap-0mpckt` (2026-10-14, tras los arreglos del `/code-review` de la ronda): frontend `tsc -b` 0, `vitest` 140 archivos / 619 tests, `oxlint` 0 errores; backend `tsc` 0, `vitest` completo 288 archivos / 3549 tests, todo en verde. Intermitentes: G16 y `avanceDiario` (`QA-52`). Tras un reinicio del contenedor, `.claude/hooks/session-start.sh` (`QA-10`) levanta Postgres y el Ollama simulado. |

## Dónde está todo (para saber qué sigue)

Orden de lectura para decidir el siguiente trabajo, de lo general a lo concreto:

1. **Esta bitácora** — qué se está haciendo ahora y el paso inmediato.
2. **[Mapa de roadmaps](../producto/21-roadmap.md#mapa-de-roadmaps)** — la tabla [«Qué entra en cada
   hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito) dice, hito a hito (`0.1` → `1.0`), qué
   tareas de cada roadmap tocan. Todas las tareas de todos los roadmaps están asignadas a un hito
   (comprobado con `python3 tools/roadmap/cobertura.py`, 2026-10-02: 367 de 367).
3. **[Plan del hito actual (`0.2`)](../producto/plan-roadmap-0.2.md)** — fases A-G del `0.2` en orden, con su estado. El del `0.1` ([plan-roadmap-0.1.md](../producto/plan-roadmap-0.1.md)) sigue abierto solo por sus Fases E y F.
4. **Los roadmaps por tema** — el detalle de cada tarea, con su estado (`✅`, `🚧`, pendiente):
   - [roadmap-front.md](../producto/roadmap-front.md) — `CFG` `BAS` `DAD` `MOD` `PAN` `HUD` `NAR` `CMB` `ATM` `PRE` `SON` `QA` `INT`
   - [roadmap-front-ux.md](../producto/roadmap-front-ux.md) — `UX` (fases UX-A…UX-F)
   - [roadmap-front-zona.md](../producto/roadmap-front-zona.md) — `ZON` (fases Z-A…Z-F)
   - [roadmap-front-reino.md](../producto/roadmap-front-reino.md) — `REI` (fases R-A…R-F)
   - [roadmap-cronista.md](../producto/roadmap-cronista.md) — `CR` (fases 1-8)
5. **Lore:** propuestas pendientes de Álvaro en `docs/borradores-opencode/propuestas-lore.md` (nunca
   editar `docs/rpgtarkor/` directamente, ver `AGENTS.md`). Las propuestas de OpenCode las revisa la otra
   cuenta de Claude (rama `claude/wonderful-volta-662qt8`); la última revisión, la del 2026-10-07 (36 de
   Cultura: fichas D-01…D-03, G-01…G-04 y O-01 en `propuestas-aprobadas.md`), ya está en `docs/rpgtarkor/` y `docs/canon-opencode/`, sin código.

## Siguientes pasos (en orden)

Del [plan del 0.1](../producto/plan-roadmap-0.1.md) y del [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito):

1. ~~**Fase A — CI en verde**~~ ✅ (ya estaba en `ci.yml`; solo faltaba la Fase C).
2. ~~**Fase C — test intermitente**~~ ✅ 2026-10-01 (ver plan del 0.1).
3. ~~**Arreglos de interfaz del 0.1**~~ ✅ 2026-10-02 (todos):
   - ~~`UX-3`~~ ✅, ~~`UX-4`~~ ✅, ~~`UX-13`~~ ✅, ~~`UX-16`~~ ✅, ~~`UX-24`~~ ✅ ([roadmap-front-ux.md](../producto/roadmap-front-ux.md))
   - ~~`DAD-1`…`DAD-6`~~ ✅, ~~`CFG-33`~~ ✅, ~~`BAS-1`~~ ✅ ([roadmap-front.md](../producto/roadmap-front.md))
   - ~~Reino R-A~~ ✅ (`REI-110`…`REI-116`, `REI-33`, `REI-40`, `REI-41`; ver [roadmap-front-reino.md](../producto/roadmap-front-reino.md))
   - ~~Zona Z-A~~ ✅ (`ZON-10`, `11`, `13`, `14`, `17`, `19`, `20`, `62` + pictogramas del mapa de `BAS-2`; captura en `docs/producto/img/zona-mapa-z-a.jpg`)
4. ~~**Fase D — El mundo vivo, visible**~~ ✅ 2026-10-02 (noticias del mundo + agenda leída de `FactionRelation`; el Libro de Sucesos `CR-1`…`CR-4` sigue esperando la decisión de Álvaro).
5. 🚧 **Fase F — latencia en la Steam Deck**: script `npm run benchmark-turno` hecho (2026-10-02); falta que Álvaro lo ejecute en la Steam Deck y pase el JSON.
6. **Fase E — súbditos mínimos** (bloqueada, ver decisiones).
7. ⏸ **Fase G — pasada de juego completa**: aplazada a la **fase única de pruebas** (fila `0.8` del mapa). Lo hecho y lo pendiente, en [`fase-g-0.1-hallazgos.md`](fase-g-0.1-hallazgos.md).
8. 🚧 **Hito `0.2` Facciones vivas** (empezado 2026-10-02 por decisión de la usuaria, con el `0.1`
   aún abierto por E y F): seguir la fila `0.2` de
   [«Qué entra en cada hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito), y así hito a hito.
   **Forma de trabajo desde aquí:** implementación continua; cada tarea con sus tests y tsc + vitest
   + oxlint en verde antes de subir; sin pasadas de juego (solo una captura si algo no se puede
   comprobar de otra forma). Las pruebas de juego, en la fase única antes de la beta (`0.8`).
   La etiqueta `v0.1.0-alpha` espera a cerrar E y F.

## Decisiones de Álvaro que bloquean algo

| Bloquea | Pregunta | Dónde |
|---|---|---|
| Fase E del 0.1 | ¿Vale la propuesta de llegada de pobladores? | `21-roadmap.md`, preguntas abiertas 1 |
| Fase F del 0.1 (acción, no decisión) | Ejecutar `cd backend && npm run benchmark-turno -- --turnos 10` en la Steam Deck con el backend y el Ollama reales, y pasar el JSON que genera | `plan-roadmap-0.1.md` § Fase F |
| Maestro de diplomacia | ¿Quién lo enseña y dónde? | `21-roadmap.md`, preguntas abiertas 2 |
| Z-C (0.2) | ¿Dónde vive el mapa de zona? (`ZON-1`) | `roadmap-front-zona.md` § 16 |
| Equilibrio del Reino (no bloquea) | En el reino del jugador nada repone la **bebida** en el tick diario (`kingdomTick.ts`; solo se rellena la de las facciones): con habitantes acaba en 0 y la felicidad baja 5/día. ¿Falta una fuente (pozo, orden de producción) o es intencionado? | `roadmap-front-reino.md`, `REI-115` |

El resto de decisiones (Cronista D-1…D-10, 🧭 de los roadmaps de interfaz) tienen valor por defecto
o no bloquean el 0.1.

## Comandos para comprobar el estado

```bash
# Backend
cd backend && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx oxlint
# Frontend
cd frontend && npx tsc -b && npx vitest run && npx oxlint
# Para iterar (QA-11): npm run test:rapido en backend/ o frontend/ → solo los tests afectados por lo no confirmado;
#   toda la rama: npx vitest run --changed origin/main. La suite completa, siempre antes de cada push.
# Migraciones: escribir el SQL a mano o revisar el diff; `prisma migrate diff --from-schema-datasource` puede leer otra
#   base del .env y sacar tablas que ya existen (pasó con 20261005061000, 2026-10-05).
#   No usar `prisma format`: reformatea todo el esquema; editar `schema.prisma` a mano y lo mínimo. `prisma migrate diff`
#   también propone borrar los índices parciales de 20261002200000_mundo_por_partida: quitar esas líneas.
#   `tsc` no detecta campos de Prisma mal escritos dentro de `select`/`where` anidados: comprobar el nombre en el esquema.
#   Falta ejecutar `npm run cronista:migrar-partidas -- --aplicar` en la base real antes de llevar el 0.3 a jugadores.
#   La siembra no actualiza los KingdomStats de facción: tras cambiar repartoFacciones.ts, en local,
#   syncFactionPopulationToKingdomStats(prisma, { saveId: null }).
# Cobertura de los roadmaps (sin hito, identificadores nuevos sin definir, fases sin retro; también en la CI y en el
#   pre-push, QA-13/14/20): python3 tools/roadmap/cobertura.py
# Entorno (Postgres, base tarkor, migraciones, siembra, Ollama simulado): lo levanta solo el hook de inicio de
#   sesión (QA-10); a mano, tras un reinicio del contenedor: CLAUDE_CODE_REMOTE=true .claude/hooks/session-start.sh
# Postgres desde cero en un contenedor nuevo (como la CI): apt install postgresql-16-pgvector,
#   pg_ctlcluster 16 main start, usuario/BD tarkor:tarkor, CREATE EXTENSION vector; después en backend/:
#   export DATABASE_URL=postgresql://tarkor:tarkor@localhost:5432/tarkor DIRECT_URL=$DATABASE_URL OLLAMA_BASE_URL=http://localhost:11434
#   npx prisma migrate deploy && (node ../tools/ci/mock-ollama.mjs &) && npm run reindex-lore && npm run seed-catalog
# Vista previa del mapa de zona sin backend (no se sube al repo, está en .git/info/exclude): crear
#   frontend/preview-zona.html + src/previewZona.tsx que simulen GET /zona con window.fetch, `npx vite`
#   y abrir /preview-zona.html?ancho=600 (la imagen sale de backend/uploads con un route de Playwright).
# Postgres de desarrollo (si está caído): bash /home/user/devenv/up.sh y después bash /home/user/stop-be.sh
# (ver reglas comunes en docs/producto/plan-roadmap-0.1.md)
```

## Hecho recientemente

- **2026-10-15** — PR #58 en `main` (CI en verde): ronda de pruebas del 2026-10-14 (P147-P187), etiquetas del mapa de zona (P123, P151), P144, ~~`QA-63`~~ y la retro ~~`QA-82`…`QA-87`~~ con los arreglos de sus dos `/code-review`.
- **2026-10-14** — ~~`QA-82`…`QA-87`~~ (retro de la ronda `QA-27` del 2026-10-14): catálogo de `tarkor_juego` al día al arrancar, efectos secundarios de un arreglo de la rama antes del PR, resumen del registro de hallazgos generado, tarea tachada también en la bitácora (pre-push), capturas y `psql` en el runbook, moverse por el mapa de zona.
- **2026-10-14** — ~~`QA-63`~~ (los `afterEach` de `turn.integration.test.ts` con 60 s, 3 pasadas seguidas en verde) y de `QA-27` P144 (Reputación y Misiones a la misma altura) y P123 (las etiquetas no tapan fichas, jugador ni viajeros; tope de desplazamiento por P151), comprobados jugando. Ronda de pruebas del 2026-10-14: hallazgos P147-P187.
- **2026-10-13** — PR #54 en `main` (CI en verde): arreglos del `/code-review` del #53, `QA-77`…`QA-80` y de `QA-27` P128, P137, P90, P130, P132, P126, P141 y P140, con los arreglos de su `/code-review`.
- **2026-10-13** — Arreglos del `/code-review` del PR #53 (12) y su retro: ~~`QA-77`…`QA-80`~~ (`/code-review` antes de crear el PR, una regla en todos sus caminos, test de comprobaciones de las rutas de partida y el test de `factionRelations` con la base local).
- **2026-10-13** — ~~`QA-73`…`QA-76`~~ (retro del PR #50): el diario solo inventa líneas de error en el frontend, tests de `tools/qa` y del gancho en la CI, `/code-review` al cerrar cada tanda, avisos con nombre en `estado.js`.
- **2026-10-13** — ~~`QA-71`, `QA-72`~~ (retro del PR #51): criterios de comprobación en los documentos reutilizables y traer `main` siempre al empezar una tarea y al fusionar un PR (merge, no rebase).
- **2026-10-13** — Documentos reutilizables (fuera del roadmap) en `main` con el PR #51: `docs/arquitectura/reutilizables/` (imágenes con FLUX.2 klein 4B, voces con qwentts.cpp, agente local con Aider y Qwen3). Con su `/code-review` (15 hallazgos) y el CI en verde.
- **2026-10-13** — ~~`QA-66`…`QA-70`~~ (retro de la tercera tanda de `QA-27`): el push dice qué sube, sin `@default` en campos obligatorios, renombres en todos los campos (`CAMPOS_CON_NOMBRE_DE_HABILIDAD`), una fila «Tarea en curso» por rama con tope (`tools/qa/bitacora.py`), orden del diario tras el golpe (`lineasTrasElGolpe`).
- **2026-10-12** — `QA-27`, tercera tanda (otra cuenta): P84-P87 (descanso, horas del diario, entradas que desaparecían; `LogEntry.fictionalMinutes` ya sin valor por defecto), P90 (parte), P91-P94, P97-P101, P105-P108, P110, P112, P114, P115, P117-P119, y los arreglos de su `/code-review`.
