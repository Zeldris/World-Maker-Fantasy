# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-20 |
| **Ramas de trabajo** | Una por cuenta, cada una con su fila «Tarea en curso» (`QA-69`): `claude/frontend-improvements-roadmap-0mpckt` (desde el 2026-10-06, `CR-55`) y `claude/wonderful-volta-662qt8`. Las skills, ganchos y `settings.json` de `.claude/` van versionados con `git add` normal (`QA-112`); a `main` se pasa **por pull request**. |
| **Último commit en `main`** | Fusión del PR #65 (2026-10-19, `a1445c2`, CI en verde, confirmada por la usuaria): ronda `QA-105` cerrada, arreglos P215-P221, ~~`CR-70`~~…~~`CR-72`~~ al roadmap, ~~`QA-122`~~…~~`QA-130`~~. |
| **Hito** | `0.3` Reino profundo, Fase D (economía y ganadería) y E (conflicto) — [plan](../producto/plan-roadmap-0.3.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (ver abajo) |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | Ronda de pruebas del 2026-10-17 (`QA-27`), partida `cmvcunmm300017d64k8qxe0t3`: comprobados 12 del PR #60 y P197 (arreglado); reabierto P177; nuevos P188-P206; su retro `QA-94`…`QA-97` hecha. **Siguiente:** arreglar P206, P177 y P188, y seguir jugando desde el Hogar Ketg (misión de las Agujas, P184). |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | 🚧 skill `opt-ai` ([diseño](../ia/skill-opt-ai.md), [registro](../ia/opt-ai-registro.md)), aprobada para `main`. Hecho: `retro` y `opt-tokens` proponen desde las skills propias. En marcha, en worktrees: backend (`iaRegistro`, `rag-eval`, casos semilla) y skill. Falta: fusionarlos, docs y el PR. Ronda con Ollama real (2026-10-20): P225, P230-P233 comprobados; P234/P235 no salieron; P238 y P239 nuevos, a decidir. Siguiente: revisar y fusionar las dos ramas. |
| **Tests** | Rama `claude/frontend-improvements-roadmap-0mpckt` (2026-10-17, tras el `/code-review` de los hallazgos de `QA-27`): backend `tsc` 0, `vitest` completo 293 archivos / 3599; frontend `tsc -b` 0, `vitest` 145 / 643, `oxlint` 0 errores; todo en verde. Intermitentes: G16 y `avanceDiario` (`QA-52`). Tras un reinicio del contenedor, `.claude/hooks/session-start.sh` (`QA-10`) levanta Postgres y el Ollama simulado. |

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

## Propuestas aprobadas para el roadmap cuando acaben las pruebas

Aprobadas por la usuaria; entran como tareas (con su hito) al volver al roadmap, no antes.

| Propuesta | Detalle | Origen |
|---|---|---|
| Recuerdo propio del NPC que vence a la jugadora | Que el vencedor recuerde el combate, no solo la etiqueta | P233 (2026-10-19) |
| No repetir «ha colgado nuevos avisos» | Si hace pocos días del último aviso del mismo tablón | P237 (2026-10-20) |
| Skill `scout-updates` (búsqueda de actualizaciones) | Skill aparte (sacada de `opt-ai`) que busque en la web novedades para todos los elementos del juego: modelos, librerías, técnicas. Se valora en el futuro | 2026-10-20 |
| Leyendas por categorías con filtros genéricos | Entra todo (también los avisos menores del Reino) y lo que se ve lo eligen filtros combinables: **origen** (Tú, Tu Reino, Aliados, Mundo), **familia** (varias a la vez), **importancia** (Todo / Notable / Grave, por marca, nunca número) y **vía** (lo viviste, te lo contaron, de oídas, tablón). Por defecto «Notable»; recuerda el último filtro; contador por categoría; avisos iguales del mismo día agrupados. Referencias: registro de X4 por pestañas (marca el camino), avisos del asentamiento aparte en Manor Lords y Bellwright, diario por pestañas de BG3, fuentes y rumores de D&D 5e. Hoy: `LeyendasPanel.tsx` filtra por una familia y los avisos del Reino no llegan por el umbral de importancia | 2026-10-20 |

En diseño (no es tarea todavía): skill `opt-ai` tras cada tanda de pruebas, en [`docs/ia/skill-opt-ai.md`](../ia/skill-opt-ai.md).

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

- **2026-10-20** — ~~`QA-131`~~, ~~`QA-132`~~, ~~`QA-133`~~, ~~`QA-134`~~, ~~`QA-135`~~ (`/opt-tokens` y `/retro` del PR de P223-P237): revisión de cada rama de subagente en el paso 3 de `orchestrate-dealer`, registros compartidos solo en la principal, campo `HERRAMIENTAS:`, `medir.py --desde` y `tools/qa/fusionar.sh`.
- **2026-10-19** — P223-P235 de la ronda `QA-105` (registro `pruebas-0.3-hallazgos.md`): avisos del reino por parejas, nacimientos, muertes y deserciones, y viudos sin pareja (P223, P224); errores con *Reintentar* en Producción, Almacén y Súbditos (P225, P230); marca de rumor (P226); `lang="es"`, iconos de bebida y odre (P227, P228); 5xx de classify con aviso (P229); descanso rechazado de 1 min (P231); cajón al abrir combate (P232); muerte sin convaleciente previa con COMBATE_PERDIDO y vencedor (P233); mayúsculas y coma de sucesos (P234, P235). Sin jugar aún.
- **2026-10-19** — ~~`QA-123`~~, ~~`QA-124`~~, ~~`QA-125`~~, ~~`QA-126`~~, ~~`QA-127`~~, ~~`QA-128`~~, ~~`QA-129`~~, ~~`QA-130`~~ (`/opt-tokens` y `/retro` del PR de la ronda `QA-105`): tope de compactación a 200k, rondas en un subagente `sonnet`, ayudas del driver arregladas y `pelear`, `/code-review` de cada arreglo de subagente, `medir.py` por tramo, `orden.sh` guarda la respuesta, calidad primero en `opt-tokens` y la `/retro` revisa las skills propias.
- **2026-10-19** — ~~`QA-122`~~: puntos de `/clear` (runbook `skills-y-modelos.md`, paso 1): Claude lo recomienda en puntos estables con la sesión lista (commit, push, bitácora); tope de compactación a 300k y `recuperar.py --estado` también tras `/clear`.
- **2026-10-19** — ~~`QA-121`~~: skill `orchestrate-dealer`: la sesión principal reparte cada trozo a un subagente de contexto limpio (encargo con criterio de hecho, vuelta en 15 líneas) para trabajar sin `/clear`; compactar a 200k; sustituye la sesión nueva de `QA-110`.
- **2026-10-19** — ~~`QA-119`~~ y ~~`QA-120`~~ (retro, segunda vuelta): constructor común de registros de sesión para los tests y test de los ganchos de `.claude/settings.json`; antes, los 16 arreglos del segundo `/code-review`.
- **2026-10-19** — ~~`QA-118`~~: escalera de modelos para subagentes (sube un peldaño por fallo, tope de dos), parar si una tanda no cierra nada y `modelo:` en cada tarea nueva.
- **2026-10-19** — ~~`QA-116`~~: `recuperar.py` (buscar lo de antes de compactar y estado que el gancho vuelve a poner tras compactar) y presupuesto de 1 a 5 compactaciones por tarea en el `selector`.
- **2026-10-19** — ~~`QA-117`~~: `medir.py` por modelo (principal y subagentes) y el runbook manda escribir con un subagente `sonnet` cuando el plan está cerrado.
- **2026-10-19** — ~~`QA-112`~~, ~~`QA-113`~~, ~~`QA-114`~~ y ~~`QA-115`~~ (retro previa al PR): `.claude/` versionado sin `-f`, test por herramienta con su comprobación, `opt-tokens` mira primero la curva y fecha de la bitácora comprobada en el pre-push.
