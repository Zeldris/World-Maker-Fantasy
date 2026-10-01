# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-01 |
| **Rama de trabajo** | `main` (no hay ninguna rama con trabajo a medias). La próxima tarea abre su propia rama y la apunta aquí |
| **Último commit en `main`** | `423c8a5` — roadmap de roadmaps y revisión cruzada de front y UX (+ el commit de esta bitácora) |
| **Hito** | `0.1` Llanuras estable — [plan](../producto/plan-roadmap-0.1.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) |
| **Tarea en curso** | Ninguna |
| **Tests** | Sin cambios de código desde el último estado conocido; comprobar antes de empezar (comandos abajo). La CI de GitHub sigue en rojo (Fase A del 0.1) |

## Siguientes pasos (en orden)

Del [plan del 0.1](../producto/plan-roadmap-0.1.md) y del [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito):

1. **Fase A — CI en verde:** Postgres 16 con pgvector en el job de backend de
   `.github/workflows/ci.yml`, `prisma migrate deploy` y `seed-catalog` antes de `npm test`.
2. **Fase C — test intermitente** de `combateMultipleOrquestacion.integration.test.ts`: causa raíz.
3. **Arreglos de interfaz del 0.1** (sin decisiones pendientes):
   - `UX-3`, `UX-4`, `UX-13`, `UX-16`, `UX-24` ([roadmap-front-ux.md](../producto/roadmap-front-ux.md))
   - `DAD-1`…`DAD-6`, `CFG-33`, `BAS-1` ([roadmap-front.md](../producto/roadmap-front.md))
   - Reino R-A: `REI-110`…`REI-116`, `REI-33`, `REI-40`, `REI-41` ([roadmap-front-reino.md](../producto/roadmap-front-reino.md))
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
# Postgres de desarrollo (si está caído): bash /home/user/devenv/up.sh y después bash /home/user/stop-be.sh
# (ver reglas comunes en docs/producto/plan-roadmap-0.1.md)
```

## Hecho recientemente

- **2026-10-01** — Seis roadmaps coordinados en `main` (`423c8a5`): front, UX, mapa de zona, Reino,
  Cronista, y `21-roadmap.md` convertido en roadmap de roadmaps. Solo documentación.
- **2026-10-01** — Reglas de trabajo por relevos (`CLAUDE.md`) y esta bitácora.
