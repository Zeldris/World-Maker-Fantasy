# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-11-10 |
| **Ramas de trabajo** | Cada sesión, su rama con su fila «Tarea en curso» (`QA-69`, `QA-136`). Activas: `claude/frontend-improvements-roadmap-0mpckt` (desde el 2026-10-06), `claude/interfaz-imagenes` (desde el 2026-10-24, `CFG-43`), `claude/limpieza` (desde el 2026-10-27, `QA-271`). Fusionadas y por cerrar: `claude/gw-update-0.5.0` (PR 84, falta borrarla), `claude/banco-narrador`, `claude/pruebas-local`, `claude/opt-ai-mejoras`. Parada desde el 2026-09-28: `claude/instalador-empaquetado` (lo decide la usuaria). Las demás ya están en `main` (historial: `git log --merges origin/main`). `.claude/` va versionado con `git add` normal (`QA-112`); a `main`, **por pull request**, o con la cuota de Actions agotada por `tools/qa/ci-local.sh` y push directo (`QA-215`). |
| **Último commit en `main`** | PR #87 de `claude/wonderful-volta-662qt8` (2026-11-05, `e9649fac`, CI en verde): roadmap de idiomas (`IDI-1`…`IDI-15`); Beta `0.7`, Personaje propio `1.1`. |
| **Hito** | Único frente: la puerta de pruebas (paso 3 de [la línea](../producto/21-roadmap.md#la-línea-usuaria-2026-10-21)). Después, `0.3` Reino profundo, Fases D y E — [plan](../producto/plan-roadmap-0.3.md). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (se cierran en el paso 4) |
| **Tarea en curso · `claude/generador-mapas`** | Generador de mapas adelantado por la usuaria (2026-11-08). ~~MAP-1~~…~~MAP-9~~, ~~MAP-16~~, ~~MAP-17~~ ✅ (MAP-1…9 probados por la usuaria en la Deck y MAP-8 con Playwright, 2026-11-10). MAP-17: agente local 5/5 en el banco (174 s de media; Haiku 35 s), con `camino`, `lugares --nombre` y `frontera --pasar N`. Ollama parado. **Siguiente:** la usuaria decide si el agente local entra en el mapa, y elige otra tarea de M-C o llevar la rama a main. |
| **Tarea en curso · `claude/limpieza`** | Fusionada en `main` sin PR, CI local (2026-11-02, `ab518ea8`, `QA-215`; confirmado por la usuaria): ~~`QA-271`~~ ✅ (código muerto fuera) y retro con `QA-278`, `QA-279` al roadmap. Rama terminada. |
| **Tarea en curso · `claude/ins-34-backend-sin-curacion`** | Fusionada en `main` sin PR, CI local (2026-10-27, `QA-215`; retro aprobada por la usuaria): `INS-34` del instalador ([plan](https://github.com/Zeldris/Instalador-WMF-Tarkor/blob/main/docs/05-plan-de-trabajo.md)), backend empaquetado sin curación ni cloud. Leves sin tarea: test del bundle en ESM y `esbuild` pinneado; `image-prompt` GET/PUT, variables cloud de `env.ts` y aviso de `LIVE_TEACHER_CAPTURE_ENABLED` siguen en el build. Siguiente: nada. |
| **Tarea en curso · `claude/ins-33-frontend-sin-admin`** | Fusionada en `main` sin PR (2026-10-26, `47f6806`, `QA-215`; retro aprobada por la usuaria): `INS-33` del instalador ([plan](https://github.com/Zeldris/Instalador-WMF-Tarkor/blob/main/docs/05-plan-de-trabajo.md), fase 3), frontend sin admin empaquetado, y retro `QA-262`…`QA-265`. Leve pendiente: rama `custom` de `CharacterSelect` inalcanzable a propósito. **Siguiente:** nada en esta rama; `INS-34`. |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | 2026-11-02: flujo Galivelop-workflow v0.2.0 → v0.4.3 (`aplicar.py --update`, 3 ganchos nuevos, sin `comprobar.yml`). Desvíos y hallazgos del flujo, propuestos arriba en `docs/records/propuestas-flujo.md` (P1-P13). Pieza de difusión en `docs/media/2026-10-23/01-mundo-vivo` (formato nuevo); Reddit, sin publicar hasta pegar sus normas (aviso de `tools/qa/difusion.py`; la nube no lee reddit.com). Fases 1 y 2 hechas; retro aprobada (R1 `tools/qa/difusion.py` en el check, R3 en opt-tokens.md). **Siguiente:** fase 3 (code-review de R1, `revisado.sh --footer`, PR). |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | A `main` confirmado por la usuaria (2026-11-10): tandas 89-106, lotes A-C, `QA-298`-`QA-305`. Fases 1-3 ✅ (marca `bafb7c7a`); [retro](retro-2026-11-10-puerta-3.4.md) aprobada entera. PR [#88](https://github.com/Zeldris/World-Maker-Fantasy/pull/88): `roadmap` corregido (estados P363/P430/P435/P436); `backend` falló por el test de la emboscada P233 (frontera en el mismo milisegundo), hecho robusto. **Siguiente:** fusionar #88 con el CI en verde y elegir con la usuaria el siguiente lote de la puerta. |
| **Tarea en curso · `claude/gw-update-0.5.0`** | Fusionada en `main` (PR #84, 2026-11-04, `5b1f6a2e`, CI en verde): flujo v0.4.3 → v0.5.0. Rama terminada; lo pendiente pasó a la fila de `claude/wonderful-volta-662qt8`. |
| **Tarea en curso · `claude/pruebas-local`** | Rondas de pruebas en la Deck con Ollama real (2026-10-20; solo se apunta). Hecho: P238-P274 (graves: P240, P260); jugados UX-30, CR-21/22/23, CR-67; `/code-review`, `/opt-ai`, `/opt-tokens` y `/retro` pasados, sus propuestas aprobadas sin aplicar. Bloqueadas: CR-53/55/58/61/63/65 y CR-32/42. PR #68 fusionado en `main`; rama por cerrar (paso 2 de la línea). |
| **Tarea en curso · `claude/opt-ai-mejoras`** | ✅ `/opt-ai` (`QA-160`…`QA-168`): turno p50 61 → 29-35 s, primera palabra 45 → 17-19 s. `/code-review`, `/opt-tokens` y [retro](retro-2026-10-20-opt-ai-mejoras.md) hechos y aplicados (`QA-169`…`QA-175`; bench con `tools/qa/bench-ia.sh`). Tests: `tools/qa` 119 (2 de `test_host` fallan solo en el sandbox), `opt-ai` OK. PR #70 fusionado en `main`; rama por cerrar (paso 2 de la línea). |
| **Tarea en curso · `claude/puerta-pruebas`** | Fusionada en `main` (PR #74, 2026-10-21); rama cerrada. Las tandas 8-14 del 3.3 siguieron en `claude/pruebas-3.3`. |
| **Tarea en curso · `claude/pruebas-3.3`** | Fusionada en `main` (PR #75, 2026-10-22); rama cerrada. Las tandas 15-21 siguieron en `claude/pruebas-reino`. |
| **Tarea en curso · `claude/pruebas-reino`** | Fusionada en `main` sin PR (2026-10-22, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 15-21 del [reparto](plan-comprobacion-reino.md), P312-P319, retro `QA-208`…`QA-214`. Rama cerrada. |
| **Tarea en curso · `claude/piloto-galivelop-workflow`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): Galivelop-workflow v0.2.0 en WMF ([registro](piloto-galivelop-workflow.md), [retro](retro-2026-10-23-piloto-galivelop.md)); rama cerrada. **Pendiente:** la usuaria prueba `host.sh` en la Deck (push con el árbol sucio). |
| **Tarea en curso · `claude/pruebas-mundo-vivo`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 22-27 y retro `QA-216`-`QA-221` ([PR preparado](pr/claude/pruebas-mundo-vivo.md)); rama cerrada. **Pendiente** de la ronda: P51, P95, P163, P193 y la cría de CR-55. Leves de la revisión de la fusión: quitar el `cleanup` local de ~70 tests (ya va en el setup) y un `--raiz` en `.githooks/pre-commit` para no copiarlo al repo (preguntar a la usuaria, es del flujo). |
| **Tarea en curso · `claude/imagenes-local`** | A `main` **sin PR, CI local** (`QA-215`, cuota de Actions agotada; confirmado por la usuaria el 2026-10-24): ~~`CFG-38`~~…~~`CFG-40`~~, `probar.sh`, ~~`QA-222`~~…~~`QA-226`~~; descripción en `docs/records/pr/claude/imagenes-local.md`. Al fusionarse, rama terminada. **Siguiente:** la usuaria prueba prompts con `probar.sh` → `CFG-42` (en la Deck) → `CFG-41`. |
| **Tarea en curso · `claude/interfaz-imagenes`** | ~~`CFG-43`~~ ✅: interfaz local del generador (`image-generator/abrir.sh`), todo por elemento en `generated/<tipo>/<slug>/`, con toda la enciclopedia y lo anidado (2.550). Tests 37/37, probada en la Deck. Roadmap `roadmap-imagenes.md` (`IMG-1`…`IMG-3`, `0.4`). Fases 1-3 hechas (retro `QA-228`…`QA-233`, leves `QA-234`). A `main` **sin PR, CI local** (`QA-215`, confirmado por la usuaria el 2026-10-25; [descripción](pr/claude/interfaz-imagenes.md)). **Siguiente:** `CFG-42` → `CFG-41`. |
| **Tarea en curso · `claude/gh-en-la-deck`** | Fusionada en `main` (PR #82). Rama borrada el 2026-11-10, con `claude/fichas-banners` (ya entera en `claude/imagenes-por-fases`). |
| **Tarea en curso · `claude/narrador-tiempos`** | `QA-289` 🚧 parada desde el 2026-11-04 (32 commits fuera de `main`, 59 por detrás; usa aún `docs/registros/`): narrador con Ollama real, rondas 2-4, arreglos P410-P425, investigación en `docs/ia/investigacion-narrador-repos.md`. P412 arreglado sin comprobar jugando. **Siguiente:** cuando toque y con la memoria libre, `git merge origin/main`, jugar los 4 casos de la ronda 4 (escenario `ronda-qa289-4`), `/gw-opt-ai` y P423; luego PR. |
| **Tarea en curso · `claude/img-6-pilotos`** | 3 commits fuera de `main` (2026-11-03): `pilotos.sh` con la cadena fotorreal y el veredicto de la usuaria sobre los 5 pilotos (Pastos 9/10, aullador 3-4/10, Cardo 5/10, Hulki 6/10, aullador en zona 7/10), que no está en `claude/imagenes-por-fases`. **Siguiente:** al cerrar IMG-55…57, pasar el veredicto al roadmap de imágenes de esa rama y borrar esta. |
| **Tarea en curso · `claude/plan-imagenes`** | Fusionada en `main` (PR #80, 2026-11-03, `304872b9`, CI en verde): ~~`IMG-15`~~…~~`IMG-33`~~ ✅, ~~`IMG-4`~~ ✅, retro ~~`QA-280`~~…~~`QA-284`~~. Rama terminada. **Siguiente bloque:** `IMG-6`, los 5 pilotos con la cadena fotorreal en una tanda de noche (antes, preguntar a la usuaria qué cerrar por memoria); luego la noche (`IMG-16`, `IMG-17`) e `IMG-7` → `IMG-25`, en una rama nueva desde `main`. |
| **Tarea en curso · `claude/lore-enciclopedia`** | Fusionada en `main` (PR #81, 2026-11-03, `97190433`, CI en verde): ~~`QA-243`~~, ~~`QA-244`~~, ~~`QA-272`…`QA-277`~~ ✅. Rama terminada. |
| **Tarea en curso · `claude/ins-31-url-backend`** | Fusionada en `main` sin PR (2026-10-26, `b76c66b`, `QA-215`; retro aprobada por la usuaria): `INS-31` del instalador ([plan](https://github.com/Zeldris/Instalador-WMF-Tarkor), fase 3), `apiBaseUrl()` en `api.ts` (`window.__TARKOR__.apiUrl` → `VITE_API_URL` → `localhost:3001`), y retro `QA-259`…`QA-261`. GitHub marcó el PR #78 como fusionado. **Siguiente:** nada en esta rama. |
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
5. 🚧 **Fase F — latencia en la Steam Deck**: script `npm run benchmark-turno` hecho (2026-10-02); falta que Álvaro lo ejecute en la Steam Deck y pase el JSON.
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

Aprobadas por la usuaria; entran como tareas (con su hito) al volver al roadmap, no antes.

| Propuesta | Detalle | Origen |
|---|---|---|
| Paso `fuera:<lugar>` y `sin-guarnicion` en `escenario.sh preparar` | Cierra P427; deja ver P253 en pantalla sin SQL | [retro cierre 3.3](retro-2026-11-04-cierre-3.3.md) (2026-11-04) |
| Lo preparado a mano se devuelve «sin ver» | Una línea en `rondas-de-pruebas.md`: sin seguir jugando sobre un estado hecho por SQL | [retro cierre 3.3](retro-2026-11-04-cierre-3.3.md) (2026-11-04) |
| `marca-hallazgo.py --ver P<n>` | Estado y tandas de un hallazgo, recortados, sin releer el plan (~300k de entrada por sesión) | [retro cierre 3.3](retro-2026-11-04-cierre-3.3.md) (2026-11-04) |
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
| Construcción por oficio y Casa de obras | Ningún edificio pide atributos: cada uno lleva tier 1-9 (T1-3 libres, T4-6 con Ayuntamiento mediano, T7-9 con el grande; nivel de constructor = tier máximo, como el resto de oficios). Casa de obras (Bellwright) con 3 escalones (tiers 1-3/4-6/7-9, plazas 1/2/3): sus trabajadores sacan una cola reordenable de obras y reparaciones; la obra se hace si un constructor asignado llega al tier (si no, 🔒N y aviso) y consume del almacén por días (X4). El PJ construye solo hasta T3 (Medieval Dynasty) y sube su nivel construyendo; los súbditos, el suyo. Lo ya construido no se respeta: la regla nueva vale para todo, y las partidas guardadas no necesitan compatibilidad porque solo las juegan las dos cuentas (usuaria, 2026-10-21). Tiers: T1 Campamento, Pozo, Leñera, Fibrería, Tablón, Jaula pequeña · T2 Choza, Tótem, Ayuntamiento pequeño, Granero, Cisterna, Empalizada, Mercado, talleres sencillos (Cocina, Curtiduría, Peletería, Sastrería, Herboristería, Casa de curas, Corrales, Desolladero, Embarcadero) · T3 Herrería, Carpintería, Taller de piedra, Boca de mina, Alquimia, Torre, Armería, Barracón, Cuartel avanzado, Puesto comercial, Jaula mediana · T4-5 obradores, T5 versiones de piedra, T6 Cuartel de guerra y Ayuntamiento mediano, Jaula grande · T7-8 grandes obradores, T8 Muralla, T9 Ayuntamiento grande | P277, P284 (2026-10-21) Pendiente del code-review (2026-10-22): constructores con plaza y sin obra posible recolectan; quitar una obra devuelve lo gastado; si la cuota del más rápido no cabe en el Almacén, probar con otro; un solo valor por defecto de plazasConstructor; comentario de CasaDeObrasCola y texto de «Constructor» en Súbditos; repartirObras solo en tests; vi.resetModules en su test. |

Implementada (2026-10-20): skill `opt-ai` tras cada tanda de pruebas ([diseño](../ia/skill-opt-ai.md), [skill](../../.claude/skills/gw-opt-ai/SKILL.md)); se activa con `IA_REGISTRO`/`IA_PERFIL` al arrancar ([runbook](../runbooks/rondas-de-pruebas.md)).

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

## Hecho recientemente

- **2026-11-10** — ~~`QA-303`~~: `marca-hallazgo.py --ver P<n>` y las tandas cerradas del plan de la puerta, en `plan-comprobacion-puerta-archivo.md` (86 → 22 kB).
- **2026-11-10** — ~~`QA-301`~~: `tools/qa/inventario-suelto.py` en el check (inventario sin lo de compañeros y súbditos); arregló 4 consultas más (viajeros, entregables, recolectar).
- **2026-11-10** — ~~`QA-304`~~, ~~`QA-305`~~ (retro del paso 3.4): el encargo de tanda lleva el tope de 50 llamadas (`skills-wmf.md`); `/clear` también al cerrar cada lote de una rama larga (`AGENTS.md`).
- **2026-11-09** — ~~`QA-300`~~: `escenario.sh dar-reino` resta con valores negativos (`comida=-2`; también bebida, goirnos y tesoro), suelo en 0 y aviso si se pide más de lo que hay; deja el Granero 178/180 para P336. Test en `darReinoLib.test.ts`.
- **2026-11-09** — ~~`QA-299`~~: `escenario.sh preparar` con `partida-caza:<presa>:heridos=<h>` (la partida vuelve sin piezas y con h heridos; aviso del juego en Reino › Avisos al preparar, P439) y `mochila-descartar[:<n>]` (tira lo suelto hasta dejar hueco; P336: `dar` no pasa de la capacidad y el Almacén lleno impedía `mochila-libre`). Sin cambio de reglas; tests rojos sin el arreglo.
- **2026-11-09** — ~~`QA-298`~~: `escenario.sh preparar <partida> partida-caza:<presa>:<n>[:permanente]` deja la partida de caza del Reino a punto de volver con n piezas (por el camino normal al avanzar el día), para jugar P339 y, con `danar:desolladero`, P338 en la tanda 103.
- **2026-11-08** — `MAP-1` y `MAP-2` (adelantados por la usuaria): `map-generator/importar.py` lee el `.map` de Azgaar sin escribirlo y `medir.py` comprueba las medidas del canon.
- **2026-11-05** — PR 86 fusionado (`d5521065`, CI en verde): licencias y roadmap de mapas en `main`.
- **2026-11-05** — `QA-297`: licencias del proyecto, MIT para el código y CC BY-NC-SA 4.0 para el contenido (usuaria).
- **2026-11-05** — Nuevo roadmap aparte [`roadmap-mapas.md`](../producto/roadmap-mapas.md) (`MAP-1`…`MAP-15`, hito `0.4`), valorado con Fable: el `.map` de Azgaar se importa una vez y no se vuelve a escribir; formato y editor propios en `map-generator/`, canon protegido por tests; el fondo de Azgaar se queda hasta que el dibujo propio lo iguale y la usuaria lo apruebe (`MAP-13`). Empieza al cerrar las pruebas de juego.
- **2026-11-04** — PR 85 fusionado (`d35bfaa1`, CI en verde): tandas 87-88 y cierre del paso 3.3; arreglado el resumen del registro 0.3 que rompía el job `roadmap`.
- **2026-11-04** — Paso 3.3 de la puerta cerrado (usuaria): tanda 88 con P367 ✅; P253 y P180 fuera de tanda.
- **2026-11-04** — Tanda 87 de la ronda de la puerta: P191 comprobado jugando (la caza del rebaño acorrala a 5 de 6 y lo dice en tercera persona); P180 sigue en parte, sin ver la variante de escasez.
- **2026-11-04** — PR 84 fusionado: flujo Galivelop-workflow v0.4.3 → v0.5.0 y tandas 83-88 de la ronda de la puerta (`QA-293`…`QA-296`).
- **2026-11-04** — ~~`QA-296`~~ (retro de la v0.5.0, R1): las reglas de `/gw-update` (reconciliación por subagente, fase 1 sin copias) en `skills-wmf.md`; R2 y R3 a Galivelop-workflow (P19, P18).
- **2026-11-04** — ~~`QA-294`~~, ~~`QA-295`~~ (`/gw-opt-tokens` de la v0.5.0): la fase 1 de una `/gw-update` sin las copias idénticas del flujo; barridos y `actions_list` con salida acotada.
- **2026-11-04** — ~~`QA-293`~~: `escenario.sh preparar <partida> combate1v1:<npc>` abre el combate 1v1 clásico contra ese NPC (efecto `forzarCombate` del Cronista), para jugar lo propio del 1v1 como la huida de la fauna (P373).
- **2026-11-03** — ~~`QA-290`~~, ~~`QA-291`~~, ~~`QA-292`~~ (retro de la ronda de la puerta): `tools/qa/humo-driver.sh`, humo del driver real en la CI; `tools/roadmap/siguiente-id.py` da el siguiente número libre mirando las ramas remotas; en una rama larga, revisión del código por bloques de ~10 tandas (`AGENTS.md`).
- **2026-11-03** — ~~`QA-286`~~, ~~`QA-287`~~ (retro de `claude/gh-en-la-deck`): varios PR listos, de uno en uno (`ramas-y-main.md`); ramas remotas en `recuperar.py` y `--footer` en el aviso de `revisado.sh`, para Galivelop-workflow.
- **2026-11-03** — ~~`QA-285`~~: la sesión local de la Deck crea sus PR con `gh` (`~/.local/bin/gh`, enlazado en el sandbox Flatpak de VS Code); estrenada con los PR #80 y #81. Sustituye a `QA-184` en `CLAUDE.md`, `AGENTS.md`, `ramas-y-main.md` y `skills-y-modelos.md`.
- **2026-11-03** — ~~`QA-280`…`QA-284`~~ (retro de `claude/plan-imagenes`): `/code-review` al cerrar cada `IMG-*`, a `main` por bloque, cadena fotorreal en `docs/mapa-agente.md`, `hoja.sh --archivos` y notas de `opt-tokens`.
- **2026-11-02** — ~~`QA-271`~~ (limpieza): fuera `test-retrieval.ts`, `test-worldtick.ts`, el SQL de arcano a magia (de un solo uso), `debug/` e `image-generator/scripts/obsoleto/`; retro con `QA-278` y `QA-279` al roadmap.
- **2026-10-26** — ~~`QA-268`~~, ~~`QA-269`~~, ~~`QA-270`~~: pasos nuevos de `escenario.sh preparar` para sucesos del mundo (`lider-muere`, `alianza`, `vasallo-paga`), ganado y captura (`domable`, `domador`, `dar-reino` de más tier) y un convaleciente a la vista (`convaleciente:<npc>:combate`).
- **2026-10-27** — ~~`QA-266`~~ (retro de `INS-34`): `entorno-nube.sh` instala `postgresql-16-pgvector` si falta. Las propuestas 1 (ya en el instalador) y 3 (no se aplica) no tocan este repo.
- **2026-10-26** — ~~`QA-272`…`QA-277`~~ (retro de la segunda pasada por la enciclopedia): «Copias de partida» en `docs/mapa-agente.md`, regla de `REVIEW.md` para `where` anidados de Prisma, tope de llamadas en las tandas de edición, `ficha.sh` con `archivo:línea` y la guardia de nombres de habilidad (`QA-273`, `habilidadesConocidas.json`: un nombre que desaparece sin renombre hace fallar el test).
- **2026-10-26** — ~~`QA-274`~~: segunda pasada por la enciclopedia: diez tandas contra el canon, cuatro bloques aprobados; canon al día (oficios, edificios, documentos, lo reservado de Tarkor), el seed retira lugares, facciones y NPC huérfanos (`retirarHuerfanos.ts`), unos 160 textos limpios y diez arreglos según el canon; `./actualizar-mundo.sh` en verde. Registro en `lore-hallazgos.md`.
- **2026-10-26** — ~~`QA-244`~~: la historia de la enciclopedia, completa: una entrada sin documento es saber común o se abre al visitar su lugar (como X4); diez hechos de la cronología con texto del canon y el sí de la usuaria.
- **2026-10-26** — ~~`QA-243`~~: la enciclopedia, auditada contra el canon sección a sección (NPC, clases, objetos, lugares, facciones, fauna y flora); `./actualizar-mundo.sh` en verde en la Deck; las imágenes de habilidades pasan a `IMG-9`.
- **2026-10-26** — ~~`QA-262`…`QA-265`~~ (retro de `INS-33`): «PR listo» solo con la URL del PR (`AGENTS.md`, `QA-184`), `import/first` en `frontend/.oxlintrc.json` (error en `src/lib/`, aviso en el resto), entrada «Modo empaquetado» en `docs/mapa-agente.md` y propuesta para Galivelop-workflow en la retro.

1. 2026-11-09 — ~~`MAP-9`~~ (2026-11-09): historial de guardados del mapa y deshacer (visor y consola).
