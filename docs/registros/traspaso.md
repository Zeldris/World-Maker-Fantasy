# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-02 |
| **Rama de trabajo** | `claude/frontend-improvements-roadmap-0mpckt`. Flujo acordado (2026-10-01): commit + push a esta rama con cada cosa hecha; a `main` se pasa **por pull request** (desde esta sesión el push directo a `main` lo bloquea el filtro de permisos) |
| **Último commit en `main`** | Fusión del PR #3 (2026-10-02): bitácora recortada, paso 8 «después del 0.1», cobertura de roadmaps (367/367) y `tools/roadmap/cobertura.py`. La rama de trabajo y `main` quedan iguales |
| **Hito** | `0.2` Facciones vivas — [plan](../producto/plan-roadmap-0.2.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) (el `0.1` sigue abierto solo por las Fases E y F, ver abajo) |
| **Tarea en curso** | `0.2` Fase B — Interfaz base, **UX-B** (estado único, [roadmap-front-ux.md](../producto/roadmap-front-ux.md)): ~~`UX-1`~~ ✅, ~~`UX-2`~~ ✅ (`lib/gamePhase.ts`); ~~`UX-5`~~ ✅ (paneles en modo consulta); ~~`UX-7`~~ ✅ (brújula y mapa de zona respetan la fase); siguiente `UX-8` (candado y motivo en lo deshabilitado + indicador de fase en la cabecera), con la que se cierra UX-B. Fase A ✅ cerrada (`CR-1`…`CR-4`); Fase C (`CR-5`…`CR-8`) tras la B ([plan del 0.2](../producto/plan-roadmap-0.2.md)). Forma de trabajo: implementación continua con tests; pruebas de juego en la fase única antes de la beta (decisión de la usuaria, 2026-10-02). Del `0.1` quedan abiertas la Fase E (bloqueada, pobladores) y la F (Álvaro ejecuta el benchmark); la G, aplazada a la fase única |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 59 archivos / 355 tests (ahora incluye `src/pages/**`), `oxlint` 13 avisos (los mismos de antes). Backend en local con Postgres real: `tsc` 0, `vitest` 165/165 archivos, 2874 tests (última pasada completa, 2026-10-02); 1 test intermitente apuntado (G16). CI de GitHub en verde (PR #3) |

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

- **2026-10-02** — `UX-7`: la brújula se deshabilita con el motivo en vez de desaparecer y el mapa de zona no deja andar ni recoger cuando la fase no lo permite.
- **2026-10-02** — `UX-5`: paneles en modo consulta (se leen siempre; lo que cambia datos se deshabilita con el motivo de la fase), con aviso en el cajón.
- **2026-10-02** — `UX-1` y `UX-2`: fase única de partida y matriz de permisos (`lib/gamePhase.ts`, `useGamePhase`); `GameView` saca de ahí los bloqueos del composer y de los botones de turno.
- **2026-10-02** — `CR-4`: vista de administración del Libro de Sucesos (`GET /saves/:id/libro` + página `/admin/partida/:id/libro`). **Fase A del 0.2 cerrada.**
- **2026-10-02** — `CR-3`: el Libro de Sucesos ya recibe los sucesos del jugador y del mundo (combate, misiones, reino, diplomacia, expediciones, agenda, clima, cadáveres).
- **2026-10-02** — `CR-2`: `registrarSuceso()` y catálogo de los 74 tipos de suceso (familia, importancia, plantilla).
- **2026-10-02** — `CR-1`: modelos del Libro de Sucesos (`Suceso`, `SucesoCausa`, `SucesoActor`) con migración y test; el reinicio de partida vacía el Libro.
- **2026-10-02** — Fase G aplazada a una fase única de pruebas antes de la beta (decisión de la usuaria); se empieza el `0.2`. G1-G29 en `fase-g-0.1-hallazgos.md` (21 arreglados).
- **2026-10-02** — Fase G en curso: G1-G15 (14 arreglados): enlaces de entidades, asistente, combate (iniciativa, capturar, respaldo de narración, tiradas en grupo, nombre del rival), desollar al acabar, caza de grupos tras matar a uno, muerte con «Aceptar», «Acercarte». Detalle en `fase-g-0.1-hallazgos.md`.
- **2026-10-02** — PR #2 fusionado a `main` (Fases A, C, D, F parcial y todos los arreglos de
  interfaz del 0.1). Se sigue trabajando en la misma rama.
