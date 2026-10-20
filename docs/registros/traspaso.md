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
| **Último commit en `main`** | Fusión del PR #68 (2026-10-20, `cdca443`): rondas de pruebas en la Deck con Ollama real y primera medida de `opt-ai` (`claude/pruebas-local`). Antes, PR #67 (`78f1c86`): skill `opt-ai`, ~~`QA-136`~~…~~`QA-139`~~. |
| **Hito** | `0.3` Reino profundo, Fase D (economía y ganadería) y E (conflicto) — [plan](../producto/plan-roadmap-0.3.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (ver abajo) |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | `QA-176` 🚧 skill `scout-updates` ([diseño](../ia/skill-scout-updates.md)): diseño, evals, `inventario.py` y `contrastar.py` (7 tests) hechos; faltan `banco.py`, `SKILL.md` y referencias, `IA_CASOS` y la primera pasada con foco narrador. Aparcado: P206, P177, P188 y seguir jugando desde el Hogar Ketg (P184). **Siguiente:** `banco.py` de `scout-updates`. |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | Lote 1 (usuaria, 2026-10-20) con `orchestrate-dealer`: `QA-140`…`QA-150` en roadmap-front §14 (retro de pruebas-local y `/opt-tokens`; las 9 de `/opt-ai` van en `claude/opt-ai-mejoras`). Hechas 141-150; 140 a falta de `Desarrollos/CLAUDE.md` (sesión local en la Deck). PR a `main` pedido: 16 hallazgos del `/code-review` arreglados, `/opt-tokens` hecho, retro aprobada y aplicada (`QA-151`…`QA-154`). PR #69 creado; CI arreglado (apt de Microsoft 403 y test de oferta dinámica al azar, también rojo en `main`). Siguiente: CI en verde, `revisado.sh` y fusionar. |
| **Tarea en curso · `claude/pruebas-local`** | Rondas de pruebas en la Deck con Ollama real (2026-10-20; solo se apunta). Hecho: P238-P274 (graves: P240, P260); jugados UX-30, CR-21/22/23, CR-67; `/code-review`, `/opt-ai`, `/opt-tokens` y `/retro` pasados, sus propuestas aprobadas sin aplicar. Bloqueadas: CR-53/55/58/61/63/65 y CR-32/42. En curso: PR a `main`. Siguiente: CI en verde, fusionar y seguir las pruebas. |
| **Tarea en curso · `claude/opt-ai-mejoras`** | ✅ `/opt-ai` (`QA-160`…`QA-168`): turno p50 61 → 29-35 s, primera palabra 45 → 17-19 s. `/code-review`, `/opt-tokens` y [retro](retro-2026-10-20-opt-ai-mejoras.md) hechos y aplicados (`QA-169`…`QA-175`; bench con `tools/qa/bench-ia.sh`). Tests: `tools/qa` 119 (2 de `test_host` fallan solo en el sandbox), `opt-ai` OK. Siguiente: `revisado.sh` y PR a `main` (confirmado por la usuaria). |
| **Tests** | Rama `claude/wonderful-volta-662qt8` (2026-10-20, antes del PR de `opt-ai`): backend `tsc` 0, `vitest` 302 archivos / 3661 con 2 rojos que también fallan en `main` con la misma base (`mundoPartida` y `deudaDeVida`, integración: estado de la base tras la ronda con Ollama real, no del PR); frontend `tsc -b` 0; `tools/qa/tests` 68 y `opt-ai` 16 en verde. Tras un reinicio del contenedor, `.claude/hooks/session-start.sh` (`QA-10`) levanta Postgres y el Ollama simulado. |

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
| Skill `scout-updates` (búsqueda de actualizaciones) | En construcción como `QA-176` ([diseño](../ia/skill-scout-updates.md)) | 2026-10-20 |
| Leyendas por categorías con filtros genéricos | Entra todo (también los avisos menores del Reino) y lo que se ve lo eligen filtros combinables: **origen** (Tú, Tu Reino, Aliados, Mundo), **familia** (varias a la vez), **importancia** (Todo / Notable / Grave, por marca, nunca número) y **vía** (lo viviste, te lo contaron, de oídas, tablón). Por defecto «Notable»; recuerda el último filtro; contador por categoría; avisos iguales del mismo día agrupados. Referencias: registro de X4 por pestañas (marca el camino), avisos del asentamiento aparte en Manor Lords y Bellwright, diario por pestañas de BG3, fuentes y rumores de D&D 5e. Hoy: `LeyendasPanel.tsx` filtra por una familia y los avisos del Reino no llegan por el umbral de importancia | 2026-10-20 |
| Colisión de combate con la posición real del hostil | La puerta de colisión (`turnResolution.ts:6940`) usa la posición de `NpcState` cuando la tenga y el ZonePoint de catálogo si no; hoy un ataque por texto a un hostil que deambula no abre combate y el narrador narra el golpe igual | P238 (2026-10-20) |
| Escape cierra primero el cajón | Con el Diario o Leyendas abierto, Escape cierra el cajón en vez de abrir la Pausa | P239 (2026-10-20) |
| `arrancar-juego.sh` hace `prisma generate` | Tras una migración nueva el cliente quedaba viejo y el primer turno daba «Error narrando el turno» | Ronda P232 (2026-10-20) |
| Retro del PR de `claude/pruebas-local` (7) | Lanzar Claude desde el repo (`Desarrollos/CLAUDE.md`); `arrancar-juego.sh` comprueba `IA_REGISTRO` absoluto, GPU y `rag-eval` con `IA_PERFIL`; `/opt-ai` en el flujo del PR; permiso de `escenario.sh` y escenario del Reino con recursos; gancho contra los borradores en commits; `bitacora.py` en el pre-push contra filas ajenas; mejoras de `opt-tokens`, `orchestrate-dealer` y `opt-ai`. Detalle en [`retro-2026-10-20-pruebas-local.md`](retro-2026-10-20-pruebas-local.md). Sin aplicar: la implementación la gestiona Álvaro | Retro 2026-10-20 |
| `/opt-ai`, primera medida en la Deck (9) | Menos intentos 2 de `narrar`; recortar la parte variable del prompt; `keep_alive` 1h en `resumen`; contexto del respaldo; escalera del RAG con los casos de la ronda; registro y `medir.py`; `lengthGuidance` tras el bloque fijo; `keep_alive` de `clasificar` (experimento); desactivar la captura remota (privacidad). Umbral por turno incluido. Detalle en [`opt-ai-registro.md`](../ia/opt-ai-registro.md). Sin aplicar | `/opt-ai` 2026-10-20 |
| `/opt-tokens` de la sesión de rondas (6) | Tandas de juego de ~60 llamadas con traspaso por escenario; capturas más pequeñas; comprobar la GPU antes de una tanda de IA; `tools/qa/host.sh` y `sql.sh` para el sandbox Flatpak; lanzar Claude Code desde `World-Maker-Fantasy`; `medir.py` con desglose por subagente. Sin aplicar | `/opt-tokens` 2026-10-20 |

Implementada (2026-10-20): skill `opt-ai` tras cada tanda de pruebas ([diseño](../ia/skill-opt-ai.md), [skill](../../.claude/skills/opt-ai/SKILL.md)); se activa con `IA_REGISTRO`/`IA_PERFIL` al arrancar ([runbook](../runbooks/rondas-de-pruebas.md)).

## Decisiones de Álvaro que bloquean algo

| Bloquea | Pregunta | Dónde |
|---|---|---|
| Fase E del 0.1 | ¿Vale la propuesta de llegada de pobladores? | `21-roadmap.md`, preguntas abiertas 1 |
| Fase F del 0.1 (acción, no decisión) | Ejecutar `cd backend && npm run benchmark-turno -- --turnos 10` en la Steam Deck con el backend y el Ollama reales, y pasar el JSON que genera | `plan-roadmap-0.1.md` § Fase F |
| Reputación (no bloquea) | ¿Perdonar a un rival (Clemente) debe restar 50 con su clan? (P270) | `pruebas-0.3-hallazgos.md` |
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

- **2026-10-20** — ~~`QA-173`~~ (retro del PR de `opt-ai`): `tools/qa/bench-ia.sh` versionado, probado con la pasada `10-bench-ia`.
- **2026-10-20** — ~~`QA-169`~~, ~~`QA-170`~~, ~~`QA-171`~~, ~~`QA-172`~~, ~~`QA-174`~~, ~~`QA-175`~~ (retro del PR de `opt-ai`, aprobadas por la usuaria): `/code-review low` de cada tarea de `opt-ai`; `keep_alive`/`num_ctx` alineados por modelo; `tools/roadmap/cerrar.py`; «Prompt del narrador» en `mapa-agente.md`; `.prettierrc.json` del backend; `POR ARCHIVO` en `medir.py` de `opt-tokens`.
- **2026-10-20** — ~~`QA-160`~~, ~~`QA-161`~~, ~~`QA-162`~~, ~~`QA-163`~~, ~~`QA-164`~~, ~~`QA-165`~~, ~~`QA-166`~~, ~~`QA-167`~~, ~~`QA-168`~~ (`/opt-ai` en la Deck): captura remota apagada en las tandas, `keep_alive` 1h en `resumen` y calentamiento, registro por turno (`app.turno`, `app.intento`, rechazos, `num_ctx` efectivo) con tabla TURNOS en `medir.py`, los casos de la ronda en `rag-casos.jsonl` `combateIniciado` solo con agresores (respaldo 14 % → 0 %) y lo variable del prompt tras lo estable, también la guía de longitud (turno p50 61 → 33 s) respaldo con 8192 de contexto lore indexado en trozos (recall@4 0,875) y `clasificar` con `keep_alive` 5m (turno p50 29 s); medidas en [`opt-ai-registro.md`](../ia/opt-ai-registro.md).
- **2026-10-20** — ~~`QA-151`~~, ~~`QA-152`~~, ~~`QA-153`~~, ~~`QA-154`~~ (retro del lote 1, aprobadas por la usuaria): `orchestrate-dealer` pide pasar por las reglas del juego al escribir la partida; `fusionar.sh` borra rama y worktree del subagente tras los tests; `escenario.sh probar` contra una base temporal; `medir.py` da el arranque de cada subagente.
- **2026-10-20** — ~~`QA-143`~~ (lote 1): regla `allow` de `escenario.sh`; escenario `reino-dia39-recursos` (Granero, comida 180, Goirnos, materiales) y `escenario.sh dar-reino`.
- **2026-10-20** — ~~`QA-142`~~, ~~`QA-147`~~, ~~`QA-148`~~ (lote 1): `/opt-ai` en el flujo del PR (paso 6 de `skills-y-modelos.md`, fuente única); tandas de juego de ~60 llamadas con traspaso por escenario (`orchestrate-dealer`); `opt-ai` apunta lo que ya hay y descarta la tanda sin la configuración del perfil. `QA-140`: nota en el runbook (falta el archivo de la Deck).
- **2026-10-20** — ~~`QA-141`~~, ~~`QA-144`~~, ~~`QA-145`~~, ~~`QA-149`~~, ~~`QA-150`~~ (lote 1): `arrancar-juego.sh` comprueba GPU, registro y `rag-eval`; `pre-commit` contra borradores; el pre-push rechaza filas ajenas de la bitácora (`BITACORA_COMPARTIDA=1` para las compartidas); capturas JPEG; `host.sh` y `sql.sh`.
- **2026-10-20** — ~~`QA-146`~~ (lote 1): `medir.py` de `opt-tokens` desglosa por subagente y cuenta bien la salida (máximo por respuesta, no el valor provisional del streaming).
- **2026-10-20** — ~~`QA-137`~~, ~~`QA-138`~~, ~~`QA-139`~~ (retro del PR de `opt-ai`): la revisión corta mira el contrato y un test compara las tareas de `opt-ai` con el backend; el mapa se escribe tras fusionar la rama; commit WIP del subagente en worktree.
- **2026-10-20** — ~~`QA-136`~~ (usuaria): cada sesión, su propia rama; regla en `CLAUDE.md` («Ramas y `main`»), porque la sesión local y la de la nube subían a la misma rama y se reescribían la fila de la bitácora.
