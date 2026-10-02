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
| **Hito** | `0.1` Llanuras estable — [plan](../producto/plan-roadmap-0.1.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) |
| **Tarea en curso** | 🚧 **Fase G — pasada de juego completa** con el Ollama simulado (lo determinista; la calidad narrativa queda para Ollama real). Guion, estado por tramo y hallazgos en [`fase-g-0.1-hallazgos.md`](fase-g-0.1-hallazgos.md). Fase F espera a que Álvaro ejecute el benchmark; Fase E bloqueada (pobladores) |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 56 archivos / 334 tests, `oxlint` 13 avisos (los mismos de antes). Backend en local con Postgres real: `tsc` 0, `vitest` 165/165 archivos, 2874 tests (última pasada completa, 2026-10-02); 1 test intermitente apuntado (G16). CI de GitHub en verde (PR #3) |

## Dónde está todo (para saber qué sigue)

Orden de lectura para decidir el siguiente trabajo, de lo general a lo concreto:

1. **Esta bitácora** — qué se está haciendo ahora y el paso inmediato.
2. **[Mapa de roadmaps](../producto/21-roadmap.md#mapa-de-roadmaps)** — la tabla [«Qué entra en cada
   hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito) dice, hito a hito (`0.1` → `1.0`), qué
   tareas de cada roadmap tocan. Todas las tareas de todos los roadmaps están asignadas a un hito
   (comprobado con `python3 tools/roadmap/cobertura.py`, 2026-10-02: 367 de 367).
3. **[Plan del hito actual](../producto/plan-roadmap-0.1.md)** — fases A-G del `0.1` con su estado.
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
7. 🚧 **Fase G — pasada de juego completa** (en curso, ver [`fase-g-0.1-hallazgos.md`](fase-g-0.1-hallazgos.md): seguir el guion por el primer tramo pendiente y arreglar cada hallazgo) y cierre del hito.
8. **Después del 0.1:** cerrar el hito (etiqueta `v0.1.0-alpha`, subida a GitHub) y seguir con el
   hito `0.2` Facciones vivas según la fila `0.2` de
   [«Qué entra en cada hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito), y así hito a hito
   hasta `1.0`. Regla del roadmap: un hito no empieza hasta cerrar el anterior; adelantar trabajo
   del `0.2` mientras el `0.1` espera a Álvaro solo si él lo decide.

## Decisiones de Álvaro que bloquean algo

| Bloquea | Pregunta | Dónde |
|---|---|---|
| Fase E del 0.1 | ¿Vale la propuesta de llegada de pobladores? | `21-roadmap.md`, preguntas abiertas 1 |
| Fase F del 0.1 (acción, no decisión) | Ejecutar `cd backend && npm run benchmark-turno -- --turnos 10` en la Steam Deck con el backend y el Ollama reales, y pasar el JSON que genera | `plan-roadmap-0.1.md` § Fase F |
| Fase D del 0.1 | ¿Se adelanta el Libro de Sucesos (`CR-1`…`CR-4`) al 0.1 o espera a 0.2? | `21-roadmap.md`, preguntas abiertas 8 |
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
# Si el contenedor se reinicia: pg_ctlcluster 16 main start y volver a lanzar el Ollama simulado
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

- **2026-10-02** — Fase G en curso: G1-G15 (14 arreglados): enlaces de entidades, asistente, combate (iniciativa, capturar, respaldo de narración, tiradas en grupo, nombre del rival), desollar al acabar, caza de grupos tras matar a uno, muerte con «Aceptar», «Acercarte». Detalle en `fase-g-0.1-hallazgos.md`.
- **2026-10-02** — PR #2 fusionado a `main` (Fases A, C, D, F parcial y todos los arreglos de
  interfaz del 0.1). Se sigue trabajando en la misma rama.
- **2026-10-02** — Fase F: script `npm run benchmark-turno` (clasificar / resolver / narrar, con
  mediana, p90 y JSON). Pendiente: ejecución en la Steam Deck.
- **2026-10-02** — Fase D parte 2: el control de las regiones en conflicto sale de las relaciones
  reales Serhu→Helsig/Goshg; la agenda las empuja. Arreglado un test que borraba Serhu→Helsig.
  **Fase D cerrada.**
- **2026-10-02** — Fase D parte 1: noticias de expediciones de facción en "El mundo", repartidas
  según lo que sabe cada personaje y recogidas sin recargar.
- **2026-10-02** — Z-A paso 4: `ZON-20` (leyenda en la esquina del mapa) y `ZON-62` (cuadrícula con
  `Alt` o botón). **Zona Z-A completa; con ella, todos los arreglos de interfaz del 0.1.**
- **2026-10-02** — Z-A paso 3: `ZON-17` (salidas como estandartes con el destino) y `ZON-19`
  (nombres cerca del personaje, del seleccionado y al pasar el ratón).
- **2026-10-02** — Z-A paso 2: `ZON-14`, ficha del personaje con anillo de cristal, dirección y halo.
- **2026-10-02** — Z-A paso 1: `ZON-10`, `ZON-11`, `ZON-13` — fichas del mapa de zona con placa,
  pictograma y anillo de color (tokens), tamaño fijo de pantalla e insignia de grupo.
- **2026-10-02** — `REI-116`: XP y nivel del diplomático al negociar; presión con barra y etapa al
  espiar. **Reino R-A completa.**
