# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-04 |
| **Rama de trabajo** | `claude/frontend-improvements-roadmap-0mpckt`. Las skills de `.claude/skills/` van versionadas (forzadas con `git add -f`, `.claude/` sigue en el `.gitignore`) y suben a `main` con todo lo demás (usuaria, 2026-10-04). Flujo acordado (2026-10-01): commit + push a esta rama con cada cosa hecha; a `main` se pasa **por pull request** (desde esta sesión el push directo a `main` lo bloquea el filtro de permisos) |
| **Último commit en `main`** | Fusión del PR #13 (2026-10-04, pedida por la usuaria, CI en verde): `CR-11` cerrada, `CR-12` 12a-12c y parte de 12d, arreglos de la revisión con `/code-review`. Antes, PR #12, #11, #10… |
| **Hito** | `0.2` Facciones vivas — [plan](../producto/plan-roadmap-0.2.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) (el `0.1` sigue abierto solo por las Fases E y F, ver abajo) |
| **Tarea en curso** | `0.2` **Fase D — Motor de eventos y facciones** ([plan](../producto/plan-roadmap-0.2.md), [Cronista Fase 3](../producto/roadmap-cronista.md#fase-3--motor-sin-ia--l)). ~~`CR-9`~~ ✅ (lista cerrada de efectos, `services/cronista/efectos.ts`; los que dependen de modelos nuevos están anotados en su tarea). ~~`CR-10`~~ ✅ (reacciones en cola, `reacciones.ts`; migración `20261004180000_cola_reacciones`). 🚧 `CR-11` (consecuencias aplazadas): entrevista de diseño hecha con la usuaria (decisiones en el roadmap-cronista, entrada `CR-11`; nombres de escisión como propuesta de lore). Paso 1 hecho (infraestructura: modelo, disparos, evaluación, `REACCION_APLAZADA`). Paso 2a hecho (sucesión y refugiados, nombres de escisión, regiones vecinas). **`CR-11` cerrada** (2026-10-04): sucesión, refugiados, deuda de vida y venganza. **`CR-12` cerrada** (2026-10-04, diseño en dos rondas de `/grill-with-docs` + Q14): narrador de fondo (`narradorFondo.ts`), «Ritmo del mundo», cadenas (`cadenas.ts`, agenda Serhu), fauna que huye y hambruna, rumor por distancia (`noticias.ts`), rastros en la ambientación (`rastros.ts`), resumen de varios días, «Ayudar» (`ayudarNpc.ts`) y oportunidades (`oportunidades.ts`); pendientes con su tarea en la entrada `CR-12`. ~~`UX-38`~~ ✅ (2026-10-04): `NoticiaMundo.tsx` y `LogEntry.noticia` (migración `20261004230000_noticia_log`). 🚧 `CR-13`: diseño cerrado en dos rondas (decisiones en su entrada del roadmap-cronista: «alguien que destaca», nombres, herencia de los padres, edad, madurez y vejez; cifras provisionales de razas en `propuestas-lore.md` para Álvaro; envejecimiento de la jugadora → `CR-33`). 13a ✅ (2026-10-04): nombres, herencia, `crearNpc`, `NPC_DESTACA` en el narrador y categoría Gente. Siguiente: 13b (edades, madurez y vejez: columnas en `Npc`, edades provisionales del catálogo, atributos que crecen hasta la madurez, vejez y muerte de viejo). Las skills se usan de verdad desde aquí: `selector` cargado al empezar cada tarea; `diagnosing-bugs` para P3.2; `/grill-with-docs` para la economía de supervivencia (bloqueada por la pregunta 5 a Álvaro). Fase C cerrada; **falta ejecutar `npm run cronista:migrar-partidas -- --aplicar` en la base real** antes de llevar el hito a jugadores. Ojo: `prisma migrate diff` propondrá borrar los índices parciales de `20261002200000_mundo_por_partida`: quitar esas líneas. Lint: contar también errores; en `GameView`, ningún hook tras los `return` de carga |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 84 archivos / 429 tests (incluye `src/pages/**`), `oxlint` 12 avisos. Backend en local con Postgres real: `tsc` 0, `vitest` 190 archivos / 2978 tests en verde (2026-10-04, tras `CR-13` 13a), `oxlint` 0 errores. Intermitentes: G16. «combate múltiple: crea el encuentro con iniciativa real…» diagnosticado y arreglado el 2026-10-04 (el tope de 60 turnos del test era corto: ~1/40 combates lo pasan; ahora 400). P3.2 del viaje interrumpido diagnosticado con `diagnosing-bugs` (2026-10-04): era un fallo real (ver «Hecho recientemente»); si vuelve a salir `travelResumed` nulo en suite completa, es otra causa sin reproducir aún. Si un test de expediciones falla con XP «expected N to be greater than N», es deriva de la base local: `delete from "NpcProfessionProgress"` y `npm run seed-catalog`. Si el contenedor se reinicia hay que volver a lanzar el mock de Ollama (si no, 27 fallos «fetch failed»). CI de GitHub en verde (PR #11) |

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

- **2026-10-04** — `CR-13` 13a: «alguien que destaca» con herencia de los padres y nombre generado por pueblo; los NPC nacidos en una partida no existen en las demás.
- **2026-10-04** — `UX-38`: noticias de «El mundo» con icono de categoría, etiqueta de oportunidad (lugar y día límite) y resumen de varios días plegado.
- **2026-10-04** — `CR-12` cerrada: «Ayudar» a malheridos y oportunidades con plazo (campo de batalla, caravana, encargo de materiales).
- **2026-10-04** — PR #13 fusionado en `main`. `CR-12` 12d: rumor por distancia, ambientación con rastros de la región y resumen de varios días en «El mundo».
- **2026-10-04** — Revisión (`/code-review`) del PR #13 con 3 arreglos: plaga y auge restan solo la parte de la región, las regiones del narrador van por slug, y los refugiados ya no llenan el Libro de ruido. Intermitente de combate múltiple diagnosticado (`diagnosing-bugs`): el tope de turnos del test era corto.
- **2026-10-04** — `CR-12` paso 12c: la fauna huye de las tormentas extremas; hambruna con cuenta de días (migración `20261004220000_dias_hambre`), cohesión −10 y posible rebelión.
- **2026-10-04** — `CR-12` paso 12b: cadenas del Cronista (`cadenas.ts`); la agenda Serhu es la primera y se corta si cae una de las partes.
- **2026-10-04** — `CR-12` paso 12a: narrador de fondo (presupuesto por ritmo, enfriamientos, 10 sucesos de fondo con noticia filtrada) y «Ritmo del mundo» en Configuración › Partida. Diseño de `CR-12` cerrado en dos rondas de `/grill-with-docs` (12a-12d y `UX-38`).
- **2026-10-04** — `CR-11` cerrada: consecuencias aplazadas (sucesión por cohesión con escisiones con nombre de lore, refugiados a regiones vecinas, deuda de vida con regalo, venganza de testigos).
- **2026-10-04** — Arreglo (diagnosticado con `diagnosing-bugs` desde el test intermitente P3.2): la resolución anticipada de un viaje se rendía si el turno aún tenía el candado y dejaba el tránsito reclamado para siempre (viaje atascado). Ahora espera al turno y, si no, libera la fila para el barrido. PR #12 fusionado.
