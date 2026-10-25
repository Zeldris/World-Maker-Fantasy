# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-25 |
| **Ramas de trabajo** | Cada sesión, su rama con su fila «Tarea en curso» (`QA-69`, `QA-136`): `claude/frontend-improvements-roadmap-0mpckt` (desde el 2026-10-06, `CR-55`; fusionada en `main` sin PR, CI local, `QA-215`, 2026-10-25), `claude/wonderful-volta-662qt8`; `claude/piloto-galivelop-workflow` (piloto del flujo; fusionada en `main` sin PR, CI local, `QA-215`); `claude/puerta-pruebas` (fusionada en `main`, PR #74); `claude/pruebas-3.3` (fusionada en `main`, PR #75); `claude/pruebas-reino` (fusionada en `main` sin PR, CI local, `QA-215`); `claude/pruebas-mundo-vivo` (tandas 22-27; fusionada en `main` sin PR, CI local, `QA-215`); `claude/imagenes-local` (fusionada en `main` sin PR, CI local, `QA-215`, `7f550735`); `claude/interfaz-imagenes` (desde el 2026-10-24, `CFG-43`); `claude/plan-imagenes` (desde el 2026-10-25, plan de imágenes y panel de lore). Fusionadas y por cerrar (paso 2 de la línea): `claude/banco-narrador`, `claude/pruebas-local`, `claude/opt-ai-mejoras`. Parada desde el 2026-09-28: `claude/instalador-empaquetado` (lo decide la usuaria). Las skills, ganchos y `settings.json` de `.claude/` van versionados con `git add` normal (`QA-112`); a `main` se pasa **por pull request**, o con la cuota de Actions agotada por `tools/qa/ci-local.sh` y push directo (`QA-215`). |
| **Último commit en `main`** | Fusión de `claude/frontend-improvements-roadmap-0mpckt` sin PR (2026-10-25, cuota de Actions agotada, `QA-215`; pedido y retro aprobada por la usuaria): carpeta de difusión y skill `gw-media-content` `QA-235`, retro `QA-236`…`QA-239`, con `tools/qa/ci-local.sh` en verde. Antes, fusión de `claude/interfaz-imagenes` sin PR (2026-10-25, cuota de Actions agotada, `QA-215`; confirmado por la usuaria): interfaz local del generador `CFG-43`, roadmap `IMG` y retro `QA-228`…`QA-233`, con `tools/qa/ci-local.sh` en verde. Antes, Fusión de `claude/pruebas-mundo-vivo` sin PR (2026-10-23, cuota de Actions agotada, `QA-215`): tandas 22-27 del Mundo vivo y arreglados comprobados jugando, retro `QA-216`…`QA-221`, con `tools/qa/ci-local.sh` en verde. Antes, fusión de `claude/piloto-galivelop-workflow` sin PR (2026-10-23, cuota de Actions agotada, `QA-215`): Galivelop-workflow v0.2.0 en WMF ([registro](piloto-galivelop-workflow.md)), con `tools/qa/ci-local.sh` en verde. Antes, fusión de `claude/pruebas-reino` sin PR (2026-10-22, cuota de Actions agotada, `QA-215`): tandas 15-21 del Reino y retro `QA-208`…`QA-214`, con `tools/qa/ci-local.sh` en verde. Antes, PR #76 (`76ec6ae`): arreglos de la puerta de pruebas; PR #75 (`11a201b`): tandas 8-14 del 3.3. |
| **Hito** | Único frente: la puerta de pruebas (paso 3 de [la línea](../producto/21-roadmap.md#la-línea-usuaria-2026-10-21)). Después, `0.3` Reino profundo, Fases D y E — [plan](../producto/plan-roadmap-0.3.md). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (se cierran en el paso 4) |
| **Tarea en curso · `claude/frontend-improvements-roadmap-0mpckt`** | Fusionada en `main` sin PR (2026-10-25, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde sobre `258827eb`, `QA-215`): ~~`QA-235`~~ ✅ difusión (`docs/difusion/` y la skill `gw-media-content`) y ~~`QA-236`…`QA-239`~~ ✅ retro aplicada. Rama terminada. **Pendiente:** la usuaria valida el estilo del ejemplo de difusión; los leves de `QA-236`/`QA-237`/`QA-239` en `roadmap-front.md`. |
| **Tarea en curso · `claude/wonderful-volta-662qt8`** | Lote 1 (usuaria, 2026-10-20) con `orchestrate-dealer`: `QA-140`…`QA-150` en roadmap-front §14 (retro de pruebas-local y `/opt-tokens`; las 9 de `/opt-ai` van en `claude/opt-ai-mejoras`). Hechas 141-150; 140 a falta de `Desarrollos/CLAUDE.md` (sesión local en la Deck). PR a `main` pedido: 16 hallazgos del `/code-review` arreglados, `/opt-tokens` hecho, retro aprobada y aplicada (`QA-151`…`QA-154`). PR #69 fusionado en `main`. Siguiente: lo que se reparta de la puerta de pruebas (la línea). |
| **Tarea en curso · `claude/pruebas-local`** | Rondas de pruebas en la Deck con Ollama real (2026-10-20; solo se apunta). Hecho: P238-P274 (graves: P240, P260); jugados UX-30, CR-21/22/23, CR-67; `/code-review`, `/opt-ai`, `/opt-tokens` y `/retro` pasados, sus propuestas aprobadas sin aplicar. Bloqueadas: CR-53/55/58/61/63/65 y CR-32/42. PR #68 fusionado en `main`; rama por cerrar (paso 2 de la línea). |
| **Tarea en curso · `claude/opt-ai-mejoras`** | ✅ `/opt-ai` (`QA-160`…`QA-168`): turno p50 61 → 29-35 s, primera palabra 45 → 17-19 s. `/code-review`, `/opt-tokens` y [retro](retro-2026-10-20-opt-ai-mejoras.md) hechos y aplicados (`QA-169`…`QA-175`; bench con `tools/qa/bench-ia.sh`). Tests: `tools/qa` 119 (2 de `test_host` fallan solo en el sandbox), `opt-ai` OK. PR #70 fusionado en `main`; rama por cerrar (paso 2 de la línea). |
| **Tarea en curso · `claude/puerta-pruebas`** | Fusionada en `main` (PR #74, 2026-10-21); rama cerrada. Las tandas 8-14 del 3.3 siguieron en `claude/pruebas-3.3`. |
| **Tarea en curso · `claude/pruebas-3.3`** | Fusionada en `main` (PR #75, 2026-10-22); rama cerrada. Las tandas 15-21 siguieron en `claude/pruebas-reino`. |
| **Tarea en curso · `claude/pruebas-reino`** | Fusionada en `main` sin PR (2026-10-22, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 15-21 del [reparto](plan-comprobacion-reino.md), P312-P319, retro `QA-208`…`QA-214`. Rama cerrada. |
| **Tarea en curso · `claude/piloto-galivelop-workflow`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): Galivelop-workflow v0.2.0 en WMF ([registro](piloto-galivelop-workflow.md), [retro](retro-2026-10-23-piloto-galivelop.md)); rama cerrada. **Pendiente:** la usuaria prueba `host.sh` en la Deck (push con el árbol sucio). |
| **Tarea en curso · `claude/pruebas-mundo-vivo`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 22-27 y retro `QA-216`-`QA-221` ([PR preparado](pr/claude/pruebas-mundo-vivo.md)); rama cerrada. **Pendiente** de la ronda: P51, P95, P163, P193 y la cría de CR-55. Leves de la revisión de la fusión: quitar el `cleanup` local de ~70 tests (ya va en el setup) y un `--raiz` en `.githooks/pre-commit` para no copiarlo al repo (preguntar a la usuaria, es del flujo). |
| **Tarea en curso · `claude/imagenes-local`** | A `main` **sin PR, CI local** (`QA-215`, cuota de Actions agotada; confirmado por la usuaria el 2026-10-24): ~~`CFG-38`~~…~~`CFG-40`~~, `probar.sh`, ~~`QA-222`~~…~~`QA-226`~~; descripción en `docs/registros/pr/claude/imagenes-local.md`. Al fusionarse, rama terminada. **Siguiente:** la usuaria prueba prompts con `probar.sh` → `CFG-42` (en la Deck) → `CFG-41`. |
| **Tarea en curso · `claude/interfaz-imagenes`** | ~~`CFG-43`~~ ✅: interfaz local del generador (`image-generator/abrir.sh`), todo por elemento en `generated/<tipo>/<slug>/`, con toda la enciclopedia y lo anidado (2.550). Tests 37/37, probada en la Deck. Roadmap `roadmap-imagenes.md` (`IMG-1`…`IMG-3`, `0.4`). Fases 1-3 hechas (retro `QA-228`…`QA-233`, leves `QA-234`). A `main` **sin PR, CI local** (`QA-215`, confirmado por la usuaria el 2026-10-25; [descripción](pr/claude/interfaz-imagenes.md)). **Siguiente:** `CFG-42` → `CFG-41`. |
| **Tarea en curso · `claude/plan-imagenes`** | Plan de imágenes ([plan](../producto/plan-imagenes/plan.md)): decisiones tomadas, `IMG-4`…`IMG-13` en el roadmap. Fase 1: `IMG-4` hecha (faltan sus [propuesta]), `IMG-5` y `IMG-14` (momento y estación) hechas, 69 tests; `IMG-6`: 2.ª tanda generada, falta su veredicto; `IMG-15`: banco por rondas ([resultados](../producto/plan-imagenes/banco/resultados.md)); VAE completo y Q8 no aportan, Z-Image entra. **Siguiente:** rondas de estilo, Z-Image Q6, sampler y semillas; luego, D8 y pilotos con la usuaria. |
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
2. **Ramas cerradas:** una línea por cuenta, cada sesión su rama (`QA-136`); cerrar las ya fusionadas que solo llevan la bitácora; `claude/instalador-empaquetado`, lo decide la usuaria.
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
| Construcción por oficio y Casa de obras | Ningún edificio pide atributos: cada uno lleva tier 1-9 (T1-3 libres, T4-6 con Ayuntamiento mediano, T7-9 con el grande; nivel de constructor = tier máximo, como el resto de oficios). Casa de obras (Bellwright) con 3 escalones (tiers 1-3/4-6/7-9, plazas 1/2/3): sus trabajadores sacan una cola reordenable de obras y reparaciones; la obra se hace si un constructor asignado llega al tier (si no, 🔒N y aviso) y consume del almacén por días (X4). El PJ construye solo hasta T3 (Medieval Dynasty) y sube su nivel construyendo; los súbditos, el suyo. Lo ya construido no se respeta: la regla nueva vale para todo, y las partidas guardadas no necesitan compatibilidad porque solo las juegan las dos cuentas (usuaria, 2026-10-21). Tiers: T1 Campamento, Pozo, Leñera, Fibrería, Tablón, Jaula pequeña · T2 Choza, Tótem, Ayuntamiento pequeño, Granero, Cisterna, Empalizada, Mercado, talleres sencillos (Cocina, Curtiduría, Peletería, Sastrería, Herboristería, Casa de curas, Corrales, Desolladero, Embarcadero) · T3 Herrería, Carpintería, Taller de piedra, Boca de mina, Alquimia, Torre, Armería, Barracón, Cuartel avanzado, Puesto comercial, Jaula mediana · T4-5 obradores, T5 versiones de piedra, T6 Cuartel de guerra y Ayuntamiento mediano, Jaula grande · T7-8 grandes obradores, T8 Muralla, T9 Ayuntamiento grande | P277, P284 (2026-10-21) Pendiente del code-review (2026-10-22): constructores con plaza y sin obra posible recolectan; quitar una obra devuelve lo gastado; si la cuota del más rápido no cabe en el Almacén, probar con otro; un solo valor por defecto de plazasConstructor; comentario de CasaDeObrasCola y texto de «Constructor» en Súbditos; repartirObras solo en tests; vi.resetModules en su test. |

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

- **2026-10-25** — ~~`QA-236`…`QA-239`~~ (retro de la difusión): `test_herramientas_con_test`, `skills-con-tests.py` y `bitacora-check.sh` en el check; regla de «lleva a `main`» con la usuaria fuera en `AGENTS.md`; `ci-local.sh` en un worktree sin rojos falsos ni `node_modules` vaciados.
- **2026-10-25** — ~~`QA-235`~~: `docs/difusion/` (guía de canales, plantilla por actualización y ejemplo del Mundo vivo con tarjeta, diagrama y captura) y la skill `gw-media-content`: `render.mjs` (fuentes a WebP) y `comprobar.py` (en el check y el CI, 11 tests).
- **2026-10-25** — ~~`QA-228`…`QA-233`~~ (retro de `claude/interfaz-imagenes`): test de que la lista de imágenes cubre toda la unión `ImagePromptEntityType`, la interfaz en el mapa del agente, `image-generator/interfaz/resumen.py` (lista y trabajo en texto), la fase antes de `main` en la fila de la bitácora, `bitacora.py check` en `commit-msg` y `selector` para cada subagente.
- **2026-10-24** — ~~`CFG-43`~~: interfaz local del generador de imágenes (`image-generator/abrir.sh`, `interfaz/servidor.py` sin dependencias): pegar o traer el prompt usado o base, generar con `probar.sh` (`PROMPT_ARCHIVO`, `LIBERAR_OLLAMA=1`), progreso del muestreo, notas por imagen y «Elegir esta» a `generated/<tipo>/<slug>/<slug>-<perfil>.png`; la lista trae toda la enciclopedia.
- **2026-10-24** — ~~`QA-227`~~: `tools/qa/host.sh` rehace el worktree del pre-push en `logs/` de la copia principal y no en `.git/` (Vite 8 niega `**/.git/**` y vitest no encontraba su setupFiles).
- **2026-10-24** — ~~`QA-222`…`QA-226`~~ (retro de `claude/imagenes-local`): sección «Imágenes» en `docs/mapa-agente.md`, análisis de `CFG-42` en un subagente, `tools/qa/backend-dev.sh` (reinicia el backend de desarrollo y espera a `/health`), `sql.sh` contra `tarkor` en el mapa y `generar.sh` avisando de que el tercer argumento es una ruta.
- **2026-10-24** — ~~`CFG-40`~~: paisaje y luz por región (`REGION_ESCENA`) y hasta 2 prompts usados como ejemplos en el generador de imágenes; región de fauna como la Enciclopedia (arregla «Llanuras» para todos); probado con LLM real + FLUX en la Deck.
- **2026-10-24** — ~~`CFG-39`~~: `imagePromptGenerator.ts` con las reglas FLUX del banco del múrgol (orden, sin medidas ni negativos, símiles de naturaleza, cierre); 11 tests; probado con LLM real + FLUX en la Deck.
- **2026-10-24** — ~~`CFG-38`~~: prompt de imagen usado editable aparte del base (`promptUsado`, migración `20261024120000_image_prompt_usado`, `GET`/`PUT` de `image-prompt`); 4 tests de UI y 29 de `world.test.ts`; probado en la enciclopedia real con Playwright (editar, recargar, volver al base).
- **2026-10-23** — Tandas 22-27 del Mundo vivo en `main` sin PR, CI local (`claude/pruebas-mundo-vivo`): arreglados comprobados jugando, ayudas MCP (`QA-218`, `QA-219`), `preparar convaleciente:` (`QA-220`) y retro `QA-216`…`QA-221`.
