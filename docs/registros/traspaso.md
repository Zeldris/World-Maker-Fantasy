# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-04 |
| **Rama de trabajo** | `claude/frontend-improvements-roadmap-0mpckt`. Flujo acordado (2026-10-01): commit + push a esta rama con cada cosa hecha; a `main` se pasa **por pull request** (desde esta sesión el push directo a `main` lo bloquea el filtro de permisos) |
| **Último commit en `main`** | Fusión del PR #10 (2026-10-03, pedida por la usuaria): `CR-6` paso 2 (población por partida), CI en verde. Antes, PR #9 (cierre de Fase B, `BAS-7/8/9`, `CR-5`, `CR-6` paso 1), #8, #7, #6, #5 y #4. Pausa pedida por la usuaria; al volver, `CR-6` paso 3 |
| **Hito** | `0.2` Facciones vivas — [plan](../producto/plan-roadmap-0.2.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) (el `0.1` sigue abierto solo por las Fases E y F, ver abajo) |
| **Tarea en curso** | `0.2` **Fase C — Mundo por partida** ([plan](../producto/plan-roadmap-0.2.md), [Cronista Fase 2](../producto/roadmap-cronista.md#fase-2--mundo-por-partida--l)): ~~`CR-5`~~ ✅ (migración `20261002200000_mundo_por_partida`, únicos parciales en `Faction`/`Npc`/`WorldPopulation`; **`prisma migrate diff` propondrá borrarlos: quitar esas líneas**); 🚧 `CR-6`: paso 1 hecho (`services/mundoPartida.ts`, `asegurarMundoDePartida`); paso 2 hecho (población por partida con `ambitoPoblacion`; el Reino del jugador se busca con `origenSlug: null`, porque las copias del mundo también llevan `saveId`). Paso 3 hecho (2026-10-04): se clona al crear y al reiniciar la partida y al inicio de cada turno. Paso 4 hecho: relaciones entre facciones y conflicto de la agenda por partida (`ambitoFacciones`); jugador↔facción sigue contra catálogo hasta `CR-7` (economía). **`CR-6` cerrada** (2026-10-04); expediciones y muertes de NPC por expedición pasan a `CR-7` (§ 13.1). 🚧 `CR-7` pasos 1-2 hechos (2026-10-04): `avanceDiario.ts` (población, economía de facción y agenda de la partida con su reloj, tras cada turno). Paso 3a hecho: todo lo que lista NPC respeta `NpcState.muerto` de la partida. Siguiente: paso 3b, expediciones de facción de la partida (que marquen `NpcState.muerto`). Cada sistema con su test de integración y la suite completa en verde, `CR-7` (avance diario por partida), `CR-8` (migración). Fase A ✅. **Fase B cerrada con pendientes apuntados** en el plan (resto de `BAS-5` y salida de `ModalShell` con un contexto de partida; View Transitions de `BAS-7`; `UX-14` espera `ZON-1`; parte de `CFG-20`). Lint: contar también errores (`npx oxlint src` y buscar «error»); en `GameView`, ningún hook tras los `return` de carga |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 83 archivos / 424 tests (ahora incluye `src/pages/**`), `oxlint` 12 avisos. Backend en local con Postgres real: `tsc` 0, `vitest` 172 archivos, 2906 tests (2026-10-04, tras `CR-7` paso 3a: pasada completa en verde; ojo, si el contenedor se reinicia hay que volver a lanzar el mock de Ollama o salen 27 fallos «fetch failed»), `oxlint` 0 errores; 1 test intermitente apuntado (G16) y P3.2 del viaje interrumpido falló una vez en suite completa (pasa aislado y en la pasada siguiente). CI de GitHub en verde (PR #3) |

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
   editar `docs/rpgtarkor/` directamente, ver `AGENTS.md`).

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
# Cobertura de los roadmaps (¿alguna tarea sin hito?): python3 tools/roadmap/cobertura.py
# Si el contenedor se reinicia (pasa a menudo): pg_ctlcluster 16 main start y volver a lanzar el Ollama simulado
#   (node tools/ci/mock-ollama.mjs &) — sin él fallan ~27 tests con ECONNREFUSED 11434.
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

- **2026-10-04** — `CR-7` pasos 1-2: avance diario por partida (`avanceDiario.ts`): población, economía de facción y agenda avanzan con el reloj de cada partida.
- **2026-10-04** — `CR-6` cerrada (paso 4: el conflicto de la agenda mueve las relaciones y la población de cada partida). Expediciones y muertes de NPC pasan a `CR-7`.
- **2026-10-04** — `CR-6` paso 3: la copia del mundo se crea al crear y reiniciar la partida y al inicio de cada turno.
- **2026-10-04** — Guía de skills y selector de skill/modelo: [`docs/runbooks/skills-y-modelos.md`](../runbooks/skills-y-modelos.md); `CLAUDE.md` pide aplicar el selector al empezar cada tarea. `.claude/` sigue fuera de git por decisión de la usuaria: las skills solo están en local.
- **2026-10-03** — PRs #9 y #10 fusionados (pausa tras ellos). `CR-6` paso 2: población por partida (muertes, caza, recolección, encuentros, zona) y Reino del jugador distinguido de las copias del mundo.
- **2026-10-02** — `CR-5`: esquema del mundo por partida (campos de § 5.2 y únicos parciales); backend 2893 tests en verde.
- **2026-10-02** — `BAS-7`: también las notificaciones animan su salida. **Fase B del 0.2 cerrada** con pendientes apuntados; se pasa a la Fase C (mundo por partida).
- **2026-10-02** — `BAS-7` (en parte, opción A por defecto): `usePresence`; el cajón de paneles anima su salida.
- **2026-10-02** — PR #8 fusionado (configuración básica). `BAS-8` (componentes base: Chip, ProgressBar con barra fantasma, Tabs, EntityRow) y `BAS-9` (catálogo `/admin/ui`).
- **2026-10-02** — `CFG-26`: atajos de teclado reasignables (I, M, P, H, J, K, L, Z) con pestaña «Controles». Arreglado además el orden de hooks de `GameView` (los de `CFG-3` iban tras los `return` de carga). **Configuración básica del 0.2 hecha.**
