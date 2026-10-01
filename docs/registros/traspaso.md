# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-01 |
| **Rama de trabajo** | `claude/frontend-improvements-roadmap-0mpckt`. Flujo acordado (2026-10-01): commit + push a esta rama con cada cosa hecha; a `main` se pasa **por pull request** (desde esta sesión el push directo a `main` lo bloquea el filtro de permisos) |
| **Último commit en `main`** | `423c8a5` — roadmap de roadmaps y revisión cruzada de front y UX (+ el commit de esta bitácora) |
| **Hito** | `0.1` Llanuras estable — [plan](../producto/plan-roadmap-0.1.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) |
| **Tarea en curso** | Ninguna. Bloque UX-A cerrado (`UX-3/4/13/16/24`); siguiente: `DAD-1`…`DAD-6` |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 42 archivos / 292 tests, `oxlint` 13 avisos (los mismos de antes). Backend en local con Postgres real: `tsc` 0, `oxlint` 0 (solo avisos previos), `vitest` 162/162 archivos, 2851 tests. CI de GitHub en verde (PR #2) |

## Siguientes pasos (en orden)

Del [plan del 0.1](../producto/plan-roadmap-0.1.md) y del [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito):

1. ~~**Fase A — CI en verde**~~ ✅ (ya estaba en `ci.yml`; solo faltaba la Fase C).
2. ~~**Fase C — test intermitente**~~ ✅ 2026-10-01 (ver plan del 0.1).
3. **Arreglos de interfaz del 0.1** (sin decisiones pendientes):
   - ~~`UX-3`~~ ✅, ~~`UX-4`~~ ✅, ~~`UX-13`~~ ✅, ~~`UX-16`~~ ✅, ~~`UX-24`~~ ✅ ([roadmap-front-ux.md](../producto/roadmap-front-ux.md))
   - `DAD-1`…`DAD-6`, `CFG-33`, `BAS-1` ([roadmap-front.md](../producto/roadmap-front.md))
   - Reino R-A: `REI-110`…`REI-116` (~~`REI-111`~~ ✅), `REI-33`, `REI-40`, `REI-41` ([roadmap-front-reino.md](../producto/roadmap-front-reino.md))
   - Zona Z-A: `ZON-10`, `11`, `13`, `14`, `17`, `19`, `20`, `62` + iconos del mapa de `BAS-2` ([roadmap-front-zona.md](../producto/roadmap-front-zona.md))
4. **Fase D — El mundo vivo, visible** (+ Libro de Sucesos mínimo `CR-1`…`CR-4` si Álvaro lo aprueba, ver decisiones).
5. **Fase F — latencia en la Steam Deck** (script de benchmark; lo ejecuta Álvaro).
6. **Fase E — súbditos mínimos** (bloqueada, ver decisiones).
7. **Fase G — pasada de juego completa** y cierre del hito.

## Decisiones de Álvaro que bloquean algo

| Bloquea | Pregunta | Dónde |
|---|---|---|
| Fase E del 0.1 | ¿Vale la propuesta de llegada de pobladores? | `21-roadmap.md`, preguntas abiertas 1 |
| Fase D del 0.1 | ¿Se adelanta el Libro de Sucesos (`CR-1`…`CR-4`) al 0.1 o espera a 0.2? | `21-roadmap.md`, preguntas abiertas 8 |
| Maestro de diplomacia | ¿Quién lo enseña y dónde? | `21-roadmap.md`, preguntas abiertas 2 |
| Z-C (0.2) | ¿Dónde vive el mapa de zona? (`ZON-1`) | `roadmap-front-zona.md` § 16 |

El resto de decisiones (Cronista D-1…D-10, 🧭 de los roadmaps de interfaz) tienen valor por defecto
o no bloquean el 0.1.

## Comandos para comprobar el estado

```bash
# Backend
cd backend && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx oxlint
# Frontend
cd frontend && npx tsc -b && npx vitest run && npx oxlint
# Postgres desde cero en un contenedor nuevo (como la CI): apt install postgresql-16-pgvector,
#   pg_ctlcluster 16 main start, usuario/BD tarkor:tarkor, CREATE EXTENSION vector; después en backend/:
#   export DATABASE_URL=postgresql://tarkor:tarkor@localhost:5432/tarkor DIRECT_URL=$DATABASE_URL OLLAMA_BASE_URL=http://localhost:11434
#   npx prisma migrate deploy && (node ../tools/ci/mock-ollama.mjs &) && npm run reindex-lore && npm run seed-catalog
# Postgres de desarrollo (si está caído): bash /home/user/devenv/up.sh y después bash /home/user/stop-be.sh
# (ver reglas comunes en docs/producto/plan-roadmap-0.1.md)
```

## Hecho recientemente

- **2026-10-01** — `UX-24` (+ `REI-111`): `ErrorBanner` con *Reintentar* en Reino y en la lista de
  partidas; Descansar en el campamento avisa del fallo. Bloque UX-A del 0.1 completo.
- **2026-10-01** — `UX-16`: la elección del asistente sobrevive a recargar (`sessionStorage`) y un
  fallo al crear la partida avisa con *Reintentar*. `vitest.config.ts` incluye ya `src/context`.
- **2026-10-01** — `UX-13`: composer deshabilitado y sin foco con cualquier capa abierta encima.
- **2026-10-01** — **CI de GitHub en verde** por primera vez desde los tests con Postgres real
  (run 79 del PR #2, con el arreglo de la Fase C).
- **2026-10-01** — `UX-4`: las tarjetas del registro (misión, modo dinámico, NPC, recolección,
  convalecientes) se deshabilitan con el motivo mientras no se puede actuar.
- **2026-10-01** — `UX-3`: `handleSubmit` rechaza un turno si el narrador ya escribe (y el doble
  clic); Construir, Viajar, Campamento y salida de zona se deshabilitan con el motivo. Front: `tsc`,
  281 tests y lint sin avisos nuevos.
- **2026-10-01** — Seis roadmaps coordinados en `main` (`423c8a5`): front, UX, mapa de zona, Reino,
  Cronista, y `21-roadmap.md` convertido en roadmap de roadmaps. Solo documentación.
- **2026-10-01** — Fase C del 0.1: test intermitente "ANALIZAR RIVAL: contra un miembro de grupo"
  arreglado (el test suponía un orden de `findMany`; ahora usa el rival en duelo real). Fase A cerrada.
- **2026-10-01** — Reglas de trabajo por relevos (`CLAUDE.md`) y esta bitácora.
