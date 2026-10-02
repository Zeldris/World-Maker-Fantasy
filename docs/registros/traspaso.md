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
| **Último commit en `main`** | Fusión del PR #5 (2026-10-02, pedida por la usuaria): UX-C (`UX-9`…`UX-12`), `UX-6` (opción B) y `BAS-3`. CI en verde. Antes, PR #4 (Fase G del 0.1, Libro de Sucesos y UX-B). La rama de trabajo sigue desde ese punto |
| **Hito** | `0.2` Facciones vivas — [plan](../producto/plan-roadmap-0.2.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) (el `0.1` sigue abierto solo por las Fases E y F, ver abajo) |
| **Tarea en curso** | `0.2` Fase B — Interfaz base. **UX-B ✅ cerrada** (`UX-1`, `UX-2`, `UX-5`, `UX-7`, `UX-8`, `UX-37`; `lib/gamePhase.ts`). **UX-C** orden y prioridad de lo que se abre ([roadmap-front-ux.md](../producto/roadmap-front-ux.md) § 4.3): ~~`UX-9`~~ ✅ (gestor de capas, `lib/capas.ts` + `<Capa>`); ~~`UX-10`~~ ✅ (decisiones en cola, `useDecisionesEnCola`); ~~`UX-11`~~ ✅ (consecuencias tras la tirada, `lib/presentacionTurno.ts`); ~~`UX-12`~~ ✅ (`lib/llegadas.ts`) → **UX-C cerrada**. ~~`UX-6`~~ ✅ (opción B, decisión de la usuaria: la ambientación se cancela al enviar una acción; revisar con `CR-12`). ~~`BAS-3`~~ ✅ (foco visible y flechas en rejillas). 🚧 `BAS-5` partir `GameView.tsx` (2382 → 2185 líneas): hechos `GameHeader` y `GameFooter`; `GameModals`/`GameLayout` aplazados al final de la Fase B (135 nombres de GameView; se hará con un contexto de partida). ~~`MOD-1`~~ ✅ (`ModalShell`, 7 overlays migrados; el visor de imagen fuera a propósito). ~~`MOD-2`~~ ✅ (`EstadosModal`: cargando, error con Reintentar, éxito). ~~`MOD-3`~~ ✅ (teclado en modales). ~~`MOD-4`~~ ✅ (ceremonia + `BotonMantener`). Siguiente: `MOD-5` (`QuantityStepper` compartido: Máx., mantener para repetir, rueda, número editable, vista previa) y `MOD-6` (`EntityRow` con miniatura). Después, el resto de la Fase B según [plan-roadmap-0.2.md](../producto/plan-roadmap-0.2.md):, `BAS-7`…`BAS-9`, `MOD-1`…`MOD-6`, `HUD-6`, `HUD-12`, configuración básica (`CFG-*`). `UX-14` espera a `ZON-1` (🧭 Álvaro). Fase A ✅ (`CR-1`…`CR-4`); Fase C (`CR-5`…`CR-8`) tras la B. |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 73 archivos / 397 tests (ahora incluye `src/pages/**`), `oxlint` 12 avisos. Backend en local con Postgres real: `tsc` 0, `vitest` 165/165 archivos, 2874 tests (última pasada completa, 2026-10-02); 1 test intermitente apuntado (G16). CI de GitHub en verde (PR #3) |

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

- **2026-10-02** — `MOD-4`: modales de ceremonia; clase, especialización y fundar reino se confirman manteniendo pulsado 1 s.
- **2026-10-02** — `MOD-3`: teclado en modales (números 1-9 eligen, flechas recorren, Enter confirma).
- **2026-10-02** — `MOD-2`: estados comunes de modal (esqueleto al cargar, error con «Reintentar», éxito con sello) en nueve modales.
- **2026-10-02** — `MOD-1`: `ModalShell` único (tamaños, ✕, pie fijo, foco devuelto); Clase, Especialización, Fundar reino, Modo dinámico, Detalle y los dos mapas migrados.
- **2026-10-02** — PR #5 fusionado a `main` (UX-C, `UX-6`, `BAS-3`). Se sigue en la misma rama, al día con `main`.
- **2026-10-02** — `BAS-3`: anillo de foco global y navegación con flechas/cruceta en inventario, habilidades, equipo y barra de habilidades.
- **2026-10-02** — `UX-6` (opción B, decisión de la usuaria): enviar una acción cancela la ambientación del mundo en curso. Revisar la opción A con `CR-12`.
- **2026-10-02** — `UX-12`: con el cajón abierto, un combate lo cierra y una narración u oferta nueva avisa dentro con «Ver». **UX-C cerrada.**
- **2026-10-02** — `UX-11`: en un turno recién llegado, misión, ofertas, XP y reputación entran cuando aterriza la tirada, no a la vez que el texto.
- **2026-10-02** — `UX-10`: clase, especialización y fundar reino esperan al combate, la escena y a leer la narración, con aviso en la cabecera para abrirlas antes.
