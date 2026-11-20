# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-11-20 |
| **Ramas de trabajo** | Cada sesión, su rama y su fila (`QA-69`, `QA-136`). Activas: `claude/frontend-improvements-roadmap-0mpckt` (desde 2026-10-06), `claude/limpieza` (desde 2026-10-27, `QA-271`). Fusionadas y por cerrar: `claude/gw-update-0.5.0`, `claude/lore-enciclopedia`, `claude/generador-mapas`, `claude/banco-narrador`. Filas de ramas cerradas: [`traspaso-archivo.md`](traspaso-archivo.md#filas-archivadas-2026-11-14-qa-342). Parada desde el 2026-09-28: `claude/instalador-empaquetado` (lo decide la usuaria). Las demás, en `main`. `.claude/` va versionado con `git add` normal (`QA-112`); a `main`, **por pull request**, o con la cuota de Actions agotada por `tools/qa/ci-local.sh` y push directo (`QA-215`). |
| **Último commit en `main`** | PR #103 de `claude/wonderful-volta-662qt8` (2026-11-19, `2b7ff9ba`, CI en verde): flujo Galivelop-workflow v0.8.1; antes, PR #102 (`docs/metrics/` como contenido, retro `QA-511`), PR #100 de `claude/marca-imagenes` y PR #99. |
| **Hito** | Único frente: la puerta de pruebas (paso 3 de [la línea](../producto/21-roadmap.md#la-línea-usuaria-2026-10-21)). Después, `0.3` Reino profundo, Fases D y E — [plan](../producto/plan-roadmap-0.3.md). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (se cierran en el paso 4) |
| **Tarea en curso · `claude/ronda-local-2`** | Ronda local 2 (Deck): tandas L1-L8 y /gw-opt-ai hechos; ~~QA-516~~, ~~QA-512~~, ~~QA-505~~, ~~QA-508~~, ~~QA-510~~, ~~QA-513~~, ~~QA-517~~, ~~QA-509~~, ~~QA-514~~, ~~QA-518~~ (L8: P487 arreglado, P491 en parte). Pendientes: P311, P485, P491, P492, P493 (réplica que recita y mezcla el lore), P494 (IA_CASOS en las rondas). Siguiente: preguntar al usuario si sigue con P493/P494 o cierra la rama hacia main (fase 1). |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | 2026-11-02: flujo Galivelop-workflow v0.2.0 → v0.4.3 (`aplicar.py --update`, 3 ganchos nuevos, sin `comprobar.yml`). Desvíos y hallazgos del flujo, propuestos arriba en `docs/records/propuestas-flujo.md` (P1-P13). Pieza de difusión en `docs/media/2026-10-23/01-mundo-vivo` (formato nuevo); Reddit, sin publicar hasta pegar sus normas (aviso de `tools/qa/difusion.py`; la nube no lee reddit.com). Fases 1 y 2 hechas; retro aprobada (R1 `tools/qa/difusion.py` en el check, R3 en opt-tokens.md). **Siguiente:** fase 3 (code-review de R1, `revisado.sh --footer`, PR). |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | PR a main: flujo Galivelop-workflow v0.8.1 (gw-update 0.8.0 → 0.8.1, 2026-11-19). Fases 1-3 hechas (revisión trivial, 0 hallazgos; retro decidida: C1-C3 para gw-harvest, C4 aplazada, C5 la aplica la usuaria). Al fusionarse, rama terminada. Sigue pendiente IMG-59 en la Deck. |
| **Tarea en curso · `claude/narrador-tiempos`** | Fusionada en `main` (PR #97, 2026-11-15) y, con ~~`QA-347`~~, ~~`QA-348`~~ y las tandas 131-132, en `claude/ronda-local-2` (2026-11-15). Rama terminada. |
| **Tarea en curso · `claude/marca-imagenes`** | Al fusionarse, rama terminada: no queda nada pendiente en ella. |
| **Tarea en curso · `claude/img-6-pilotos`** | 3 commits fuera de `main` (2026-11-03): `pilotos.sh` con la cadena fotorreal y el veredicto de la usuaria sobre los 5 pilotos (Pastos 9/10, aullador 3-4/10, Cardo 5/10, Hulki 6/10, aullador en zona 7/10), que no está en `claude/imagenes-por-fases`. **Siguiente:** al cerrar IMG-55…57, pasar el veredicto al roadmap de imágenes de esa rama y borrar esta. |
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

**Pendiente de filas archivadas** ([`traspaso-archivo.md`](traspaso-archivo.md#filas-archivadas-2026-11-14-qa-342)): medir `QA-307` (prefijo estable en combate) en la Deck (está en `roadmap-front.md`); leves de `gw-update-0.6` (CI duplicado, ledger compartido, `test_fusionar` sin ganchos; ver [su retro](retro-2026-11-14-gw-update-0.6.md)); la usuaria desactiva el conector Claude Docs.

**La línea (usuaria, 2026-10-21):** un solo frente cada vez. Detalle en
[21-roadmap.md](../producto/21-roadmap.md#la-línea-usuaria-2026-10-21).

1. **Entorno congelado:** ninguna tarea `QA-*` nueva salvo bloqueo; de las retros, solo lo que la usuaria apruebe aplicar ya; el resto se apunta abajo y espera.
2. ~~**Ramas cerradas**~~ ✅ 2026-11-03: borradas `claude/limpieza`, `opt-ai-mejoras`, `pruebas-local` e `instalador-empaquetado` (con el sí de la usuaria); sigue una línea por cuenta, cada sesión su rama (`QA-136`).
3. **Puerta de pruebas** (único frente): graves P240 y P260 → lo sin jugar de `matriz-pruebas.py` → arreglados y
   arreglados en parte sin comprobar, por sistema → resto de pendientes (cifras en el resumen de los hallazgos).
4. **Limpieza ligera del roadmap:** cerrar `0.1` y `0.2` (lo de Álvaro a sus preguntas), `cobertura.py` sin dobles ni
   sin definir, y meter las propuestas aprobadas con su hito.
5. **Vuelta al `0.3`** (Fases D y E), un solo hito activo y una línea por cuenta.

Lo nuevo que surja va a «Propuestas aprobadas…» (abajo) sin hito, como bandeja de ideas.

**Hasta el 2026-10-21** (cerrado o absorbido por la línea), del [plan del 0.1](../producto/plan-roadmap-0.1.md) y del [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito):

1. ~~**Fase A — CI en verde**~~ ✅ (ya estaba en `ci.yml`; solo faltaba la Fase C).
2. ~~**Fase C — test intermitente**~~ ✅ 2026-10-01 (ver plan del 0.1).
3. ~~**Arreglos de interfaz del 0.1**~~ ✅ 2026-10-02 (todos):
   - ~~`UX-3`~~ ✅, ~~`UX-4`~~ ✅, ~~`UX-13`~~ ✅, ~~`UX-16`~~ ✅, ~~`UX-24`~~ ✅ ([roadmap-front-ux.md](../producto/roadmap-front-ux.md))
   - ~~`DAD-1`…`DAD-6`~~ ✅, ~~`CFG-33`~~ ✅, ~~`BAS-1`~~ ✅ ([roadmap-front.md](../producto/roadmap-front.md))
   - ~~Reino R-A~~ ✅ (`REI-110`…`REI-116`, `REI-33`, `REI-40`, `REI-41`; ver [roadmap-front-reino.md](../producto/roadmap-front-reino.md))
   - ~~Zona Z-A~~ ✅ (`ZON-10`, `11`, `13`, `14`, `17`, `19`, `20`, `62` + pictogramas del mapa de `BAS-2`; captura en `docs/producto/img/zona-mapa-z-a.jpg`)
4. ~~**Fase D — El mundo vivo, visible**~~ ✅ 2026-10-02 (noticias del mundo + agenda leída de `FactionRelation`; el Libro de Sucesos `CR-1`…`CR-4` sigue esperando la decisión de Álvaro).
5. ✅ **Fase F — latencia en la Steam Deck**: medida el 2026-11-14 con Ollama real (turno total: mediana 29 s, p90 44,7 s); falta que Álvaro fije el objetivo de turno.
6. **Fase E — súbditos mínimos** (bloqueada, ver decisiones).
7. ⏸ **Fase G — pasada de juego completa**: aplazada a la **fase única de pruebas** (fila `0.7` del mapa). Lo hecho y lo pendiente, en [`fase-g-0.1-hallazgos.md`](fase-g-0.1-hallazgos.md).
8. 🚧 **Hito `0.2` Facciones vivas** (empezado 2026-10-02 por decisión de la usuaria, con el `0.1`
   aún abierto por E y F): seguir la fila `0.2` de
   [«Qué entra en cada hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito), y así hito a hito.
   **Forma de trabajo desde aquí:** implementación continua; cada tarea con sus tests y tsc + vitest
   + oxlint en verde antes de subir; sin pasadas de juego (solo una captura si algo no se puede
   comprobar de otra forma). Las pruebas de juego, en la fase única antes de la beta (`0.7`).
   La etiqueta `v0.1.0-alpha` espera a cerrar E y F.

## Propuestas sin revisar (fuera del roadmap)

Apuntadas a petición de la usuaria (2026-10-30) para revisarlas más adelante: ni aprobadas ni con hito, no entran en
el roadmap hasta que ella decida.

| Propuesta | Detalle | Origen |
|---|---|---|
| RAG del lore: híbrida BM25 + vector y entrada directa por entidad | RLM y Vectorless RAG descartados por la latencia en la Deck; lo que ataca P251/P272 es buscar nombres exactos (`tsvector`) y meter seguro el trozo de la entidad nombrada. Después, Contextual Retrieval; reranker o `bge-m3` solo si no basta | [investigación](../ia/investigacion-2026-10-30-rag-rlm.md) (2026-10-30) |
| Registro de entidades y cifras compartidas + script de consistencia | YAML con los números y nombres que cruzan sistemas, comprobado contra `docs/mecanicas` y `docs/producto` (como `cobertura.py`) | [Claude-Code-Game-Studios](investigacion-2026-10-30-claude-code-game-studios.md) (2026-10-30) |
| «Sin datos, no se evalúa» en las skills de informe | Cabecera FOUND/ABSENT en `retro`, `opt-tokens`, `opt-ai`; también propuesta para Galivelop-workflow | ídem |
| Revisión transversal de diseño antes de cerrar un hito | Contradicciones, estrategias dominantes, economía rota, deriva de pilares, todos los sistemas a la vez | ídem |
| Linter de skills más completo | Las comprobaciones estáticas de su `skill-test`, junto a `doctor.py` y `skills-con-tests.py` | ídem |
| Voice Profile y «verdad oculta» de cada misterio | Fichas de voz por personaje (podrían ayudar con P263) y respuesta verdadera documentada por misterio; iría a Álvaro por `propuestas-lore.md` | ídem |
| Comprobar por código si la narración usó el lore entregado | Tras narrar, sin LLM: ¿nombra las entidades y hechos de los trozos recibidos? Mide P263 y permitiría regenerar solo si falta algo crítico | [InkOS](../ia/investigacion-2026-10-30-inkos.md) (2026-10-30, AGPL: solo ideas) |
| Contexto del narrador por prioridad y traza de recuperación | Trozos protegidos o recortables dentro de los 8192 tokens, estados de lore mostrado, y candidatos con puntuación por turno para depurar P251/P272 | ídem |
| Agente de lore de OpenCode: citas del canon, script de consistencia, índice para recorrer | Cada afirmación de la propuesta cita su línea del canon (lo que no cita, «inventado»); script sin LLM de nombres, enums y cifras contra `00-nucleo.md` y el catálogo; `canon-opencode/` como árbol para el agente. Va a Álvaro | [generador de lore](../ia/investigacion-2026-10-31-generador-lore.md) (2026-10-31) |
| Generador de lore en vivo: entidad en JSON validada por código | Para cuando se diseñe (junto a las misiones, `mundo-vivo-x4` §1 y §2.9): el LLM propone y el código valida contra el registro de entidades; estados del lore, voz y secreto de cada NPC. Antes, un `prototype` con el 9B | ídem |
| Agente de lore: verificación dirigida, avisos con exención, hilos dormidos, evaluación congelada | Veredicto `clear`/`conflict`/`unknown` por afirmación con cita comprobada por script; clave estable por aviso y «intencionado» que no vuelve a salir; preguntas abiertas con aviso de dormidas; casos congelados para medir el prompt. Va a Álvaro | [AI-Novel-Writer](../ia/investigacion-2026-10-31-generador-lore.md#añadido-ai-novel-writer--pagekin-2026-10-31) (2026-10-31, GPL: solo ideas) |
| Agente de lore: diff de avisos, aviso sin ancla descartado, lista de lo omitido | El script de consistencia enseña solo los avisos que trae la propuesta (canon contra canon + propuesta); un conflicto cuya cita no está literal en el canon se descarta; el contexto recortado avisa de lo omitido para que el 9B no lo invente. Va a Álvaro | [Novel-OS, OpenNovel, show-me-the-story](../ia/investigacion-2026-10-31-generador-lore.md#añadido-novel-os-opennovel-y-show-me-the-story-2026-10-31) (2026-10-31, MIT) |

## Propuestas aprobadas para el roadmap cuando acaben las pruebas

Aprobadas por la usuaria, a la espera del roadmap: ahora en [`propuestas-aprobadas.md`](propuestas-aprobadas.md) (`QA-342`).

## Decisiones de Álvaro que bloquean algo

| Bloquea | Pregunta | Dónde |
|---|---|---|
| Fase E del 0.1 | ¿Vale la propuesta de llegada de pobladores? | `21-roadmap.md`, preguntas abiertas 1 |
| Fase F del 0.1 | Medida en la Deck (2026-11-14): turno total mediana 29 s, p90 44,7 s (narrar, 13 · 30 s). ¿Qué objetivo de turno se fija en el roadmap? | `plan-roadmap-0.1.md` § Fase F |
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
#   sesión (QA-10); a mano, tras un reinicio del contenedor: CLAUDE_CODE_REMOTE=true .claude/hooks/entorno-nube.sh
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

## Pendiente (leves)

Lo pendiente está en [`docs/records/pendientes-leves.md`](pendientes-leves.md); se añade y se quita allí.

## Hecho recientemente
- **Archivado (2026-11-14):** lo hecho hasta el 2026-11-11 y las filas de ramas fusionadas y terminadas, en [`traspaso-archivo.md`](traspaso-archivo.md) (`QA-333`, `QA-342`).


1. 2026-11-20 — QA-518: lore de lo que nombra el jugador en la réplica del NPC (loreParaReplica), desde su lado; L8: P487 arreglado, P491 en parte, P493 y P494 nuevos
2. 2026-11-20 — QA-514: cerrada sin recalentado; la tanda A/B L7 mostró que con Ollama 0.34.2 dialogo_npc no desaloja al narrador (narrar tras diálogo 10-22 s de prefill frente a 24-26 s con recalentado); revert del código
3. 2026-11-19 — QA-509: volátiles de combate al final de hechos; primera palabra p50 21,6→12,5 s en la tanda L5
4. 2026-11-19 — QA-517: sin falsos positivos de las guardas de golpe en la tanda L5 (intento 2 25→13 %, respaldo 0)
5. 2026-11-19 — QA-508: en defensa sin acierto el rival sigue en pie; bench 28-qa508 sin empeorar
