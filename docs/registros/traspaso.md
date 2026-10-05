# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-05 |
| **Rama de trabajo** | `claude/wonderful-volta-662qt8` (desde 2026-10-04, sesión de la otra cuenta; parte de `main` en `697b4a7`). La anterior era `claude/frontend-improvements-roadmap-0mpckt`. Las skills de `.claude/skills/` van versionadas (forzadas con `git add -f`, `.claude/` sigue en el `.gitignore`) y suben a `main` con todo lo demás (usuaria, 2026-10-04). Flujo acordado (2026-10-01): commit + push a esta rama con cada cosa hecha; a `main` se pasa **por pull request** (desde esta sesión el push directo a `main` lo bloquea el filtro de permisos) |
| **Último commit en `main`** | Fusión del PR #16 (2026-10-05, `cbfef9e`, CI en verde, visto bueno de la usuaria): `CR-34` decisiones de facción, `CR-35`, `CR-40` misiones secundarias por motor (jugable; falta 40f-2, interno) y 8 arreglos de `/code-review`. Antes, PR #15, #14… |
| **Hito** | `0.2` Facciones vivas — [plan](../producto/plan-roadmap-0.2.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito) (el `0.1` sigue abierto solo por las Fases E y F, ver abajo) |
| **Tarea en curso** | ~~**`CR-34` Decisiones de facción**~~ ✅ (IA de decisión de facción, siguiente en el orden de la Fase D; la usuaria pidió seguir el orden del roadmap usando las skills). `selector` → `/grill-with-docs` (`grilling` + `domain-modeling`). Ronda 1 aceptada entera (Q1-Q9 en la entrada `CR-34` de `roadmap-cronista.md`); términos nuevos en `GLOSSARY.md`; tareas nuevas `CR-35` (0.2), `CR-36`, `CR-37`, `CR-38`. Ronda 2 (Q10-Q18) y Q19 (manda la IA: la paz corta la cadena Serhu) aceptadas; **diseño cerrado**. ~~`CR-35`~~ ✅ 2026-10-04 (ya lo hacía `CR-7`; quitadas las versiones de catálogo de economía y expediciones, tests portados a partida). `CR-34` 34a ✅ (`cronista/carencias.ts`, puro), 34b ✅ (expediciones dirigidas; migración `20261005030000_expedicion_motivo`), 34c ✅ (diplomacia entre facciones, `cronista/decisionesFaccion.ts`; migración `20261005040000_decisiones_faccion`; disposiciones propuestas a Álvaro). 34e ✅ (propuestas al Reino con Aceptar/Rechazar y plazo de 3 días). 🧭 34d bloqueada: no hay territorios de facción en `Territory` (el dominio de regiones está fijo en `REGION_OWNING_FACTIONS`); pregunta hecha a la usuaria. 34f ✅ (simulación de 60 días, `cronista/simulacion60.integration.test.ts`). **`CR-34` cerrada** (2026-10-05); la expansión pasa entera a `CR-39` en el `0.3` (Q20: la usuaria eligió la versión completa, con territorios reales y sin tabla fija). 🚧 **`CR-40` Misiones secundarias por motor** (siguiente de la Fase D): `selector` → `/grill-with-docs`; ronda 1 aceptada (Q1-Q9 en la entrada `CR-40` del roadmap-cronista) con dos añadidos de la usuaria: plantillas y reglas contra la basura, y las misiones las dan NPC o un tablón en el interior de las ciudades (edificio construible). Ronda 2 (Q10-Q17) aceptada: **diseño cerrado**; glosario (misión, misión secundaria, tablón de avisos; encargo redefinido) y nombres del tablón propuestos a Álvaro. 40a ✅ (`cronista/misiones.ts`, puro). 40b ✅ (migración `20261005050000_misiones_motor`). 40c ✅ (tablones sembrados y receta del Reino). De paso, arreglado un fallo real de `CR-34` (pedir la paz se medía contra el enemigo más fuerte, no contra el de esa guerra; test intermitente ~1/4). 40d ✅ (`cronista/generarMisiones.ts`: tablones rellenos cada día con misiones del mundo de la partida). 40e ✅ (aceptar, progreso, cumplir, fallar, abandonar; rutas `/saves/:id/misiones/…`). 40f-1 ✅ (el narrador deja de crear misiones; «¿Tienes trabajo?» con misión personal). 40g ✅ (tablón en el panel de zona, modal de avisos, oferta del NPC, Entregar/Abandonar en Misiones). PR #16 fusionado en `main` (2026-10-05). 40f-2 descartado (Q21, ADR 0001: las misiones del motor no usan oferta pendiente). **`CR-40` cerrada.** `/retro` de la Fase D hecho (2026-10-05): cinco propuestas aceptadas como `QA-8`…`QA-12` (roadmap-front § 14, fila `0.2`); ~~`QA-8`~~ ✅, ~~`QA-9`~~ ✅, ~~`QA-10`~~ ✅ (hook de inicio de sesión: Postgres, base, migraciones, siembra y Ollama simulado). ~~`QA-11`~~ ✅ (`npm run test:rapido`), ~~`QA-12`~~ ✅ (el intermitente de `ProduccionSection` era un fallo real de `NumeroGuardable`, arreglado). **Retro de la Fase D cerrada.** **Siguiente:** la **Fase E — Rumores y Leyendas** (`CR-18`…`CR-20`, `PAN-9b`, `INT-1`…`INT-4`, `INT-9`, `NAR-9`, `CFG-34`, `CFG-35`): `selector` y después su ronda de diseño (`grilling` + `domain-modeling`). La Fase D no se cierra entera: la economía de supervivencia sigue bloqueada por la pregunta 5 a Álvaro. Antes: `0.2` **Fase D — Motor de eventos y facciones** ([plan](../producto/plan-roadmap-0.2.md), [Cronista Fase 3](../producto/roadmap-cronista.md#fase-3--motor-sin-ia--l)). ~~`CR-9`~~ ✅ (lista cerrada de efectos, `services/cronista/efectos.ts`; los que dependen de modelos nuevos están anotados en su tarea). ~~`CR-10`~~ ✅ (reacciones en cola, `reacciones.ts`; migración `20261004180000_cola_reacciones`). 🚧 `CR-11` (consecuencias aplazadas): entrevista de diseño hecha con la usuaria (decisiones en el roadmap-cronista, entrada `CR-11`; nombres de escisión como propuesta de lore). Paso 1 hecho (infraestructura: modelo, disparos, evaluación, `REACCION_APLAZADA`). Paso 2a hecho (sucesión y refugiados, nombres de escisión, regiones vecinas). **`CR-11` cerrada** (2026-10-04): sucesión, refugiados, deuda de vida y venganza. **`CR-12` cerrada** (2026-10-04, diseño en dos rondas de `/grill-with-docs` + Q14): narrador de fondo (`narradorFondo.ts`), «Ritmo del mundo», cadenas (`cadenas.ts`, agenda Serhu), fauna que huye y hambruna, rumor por distancia (`noticias.ts`), rastros en la ambientación (`rastros.ts`), resumen de varios días, «Ayudar» (`ayudarNpc.ts`) y oportunidades (`oportunidades.ts`); pendientes con su tarea en la entrada `CR-12`. ~~`UX-38`~~ ✅ (2026-10-04): `NoticiaMundo.tsx` y `LogEntry.noticia` (migración `20261004230000_noticia_log`). 🚧 `CR-13`: diseño cerrado en dos rondas (decisiones en su entrada del roadmap-cronista: «alguien que destaca», nombres, herencia de los padres, edad, madurez y vejez; cifras provisionales de razas en `propuestas-lore.md` para Álvaro; envejecimiento de la jugadora → `CR-33`). 13a ✅ (2026-10-04): nombres, herencia, `crearNpc`, `NPC_DESTACA` en el narrador y categoría Gente. 13b ✅ (2026-10-04): `edades.ts`, `envejecer.ts`, `Npc.nacidoEn`/`atributosPotenciales` (migración `20261005010000_npc_edad`); pendiente la vejez de atributos del catálogo (va en 13c). **`CR-13` cerrada** (2026-10-04, 13c: nacimientos de verdad, niños fuera de expediciones, vejez del catálogo por partida en `NpcState.vejez`). **Cronista Fase 3 cerrada** (`CR-9`…`CR-13`). Siguiente (relevo a la otra cuenta, 2026-10-04): la usuaria debe elegir entre **IA de decisión de facción** y **misiones secundarias por motor** (las dos necesitan ronda de diseño: cargar `selector`, luego `grilling` + `domain-modeling` con la herramienta Skill); la economía de supervivencia sigue bloqueada por la pregunta 5 a Álvaro; `/retro` al cerrar la Fase D. Las skills se usan de verdad (la usuaria lo pidió otra vez el 2026-10-04 tras ver que `CR-13` se hizo sin cargar `selector` ni `domain-modeling`): `selector` cargado (con la herramienta Skill) al empezar cada tarea; `grilling` + `domain-modeling` en cada ronda de diseño y el glosario al día; `diagnosing-bugs` para fallos e intermitentes; `code-review` antes de cada PR a `main`; `/grill-with-docs` para la economía de supervivencia (bloqueada por la pregunta 5 a Álvaro). Fase C cerrada; **falta ejecutar `npm run cronista:migrar-partidas -- --aplicar` en la base real** antes de llevar el hito a jugadores. Ojo: `prisma migrate diff` propondrá borrar los índices parciales de `20261002200000_mundo_por_partida`: quitar esas líneas. Lint: contar también errores; en `GameView`, ningún hook tras los `return` de carga |
| **Tests** | Frontend: `tsc -b` 0, `vitest` 86 archivos / 440 tests (2026-10-05, tras `QA-12`) (incluye `src/pages/**`), `oxlint` 12 avisos. Backend en local con Postgres real: `tsc` 0, `vitest` 201 archivos / 3039 tests en verde (2026-10-05, tras la revisión del PR de `CR-34`/`CR-40`; la suite tarda ~7 min), `oxlint` 0 errores (15 avisos, los mismos de antes). Intermitentes: G16. El de `ProduccionSection.test.tsx` está diagnosticado y arreglado (`QA-12`, 2026-10-05). «combate múltiple: crea el encuentro con iniciativa real…» diagnosticado y arreglado el 2026-10-04 (el tope de 60 turnos del test era corto: ~1/40 combates lo pasan; ahora 400). P3.2 del viaje interrumpido diagnosticado con `diagnosing-bugs` (2026-10-04): era un fallo real (ver «Hecho recientemente»); si vuelve a salir `travelResumed` nulo en suite completa, es otra causa sin reproducir aún. La deriva de XP de los NPC («expected N to be greater than N») la evita el `globalSetup` de `bd-real` (`QA-8`). Tras un reinicio del contenedor, `.claude/hooks/session-start.sh` (`QA-10`) vuelve a levantar Postgres y el Ollama simulado. CI de GitHub en verde (PR #11) |

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
# Para iterar (QA-11): npm run test:rapido en backend/ o frontend/ → solo los tests afectados por lo no confirmado;
#   toda la rama: npx vitest run --changed origin/main. La suite completa, siempre antes de cada push.
# Cobertura de los roadmaps (¿alguna tarea sin hito?): python3 tools/roadmap/cobertura.py
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

- **2026-10-05** — `/retro` de la Fase D: `QA-8` (los tests `bd-real` restauran el progreso de los NPC y borran sus interiores de prueba), `QA-9` (verificar con grep lo que reporta un subagente; puntero a `avanceDiario.ts`) `QA-10` (hook de inicio de sesión que monta el entorno) `QA-11` (`npm run test:rapido`) y `QA-12` (lo escrito en un campo numérico recién montado se perdía: causa del intermitente de `ProduccionSection`).
- **2026-10-05** — `CR-40` (misiones secundarias por motor) jugable: plantillas cerradas, tablones de avisos, generación diaria, aceptar/cumplir/fallar/abandonar, «¿Tienes trabajo?», interfaz; revisión con `/code-review` (8 arreglos). Queda 40f-2 (oferta única, interna).
- **2026-10-05** — `CR-34` 34a-34c, 34e y 34f: carencias, expediciones dirigidas, diplomacia entre facciones, propuestas al Reino con Aceptar/Rechazar y simulación de 60 días. 34d (expansión) bloqueada por falta de territorios de facción.
- **2026-10-04** — `CR-35`: economía y expediciones de facción solo en el mundo de la partida (quitadas las versiones de catálogo; tests portados). Diseño de `CR-34` cerrado en tres rondas.
- **2026-10-04** — Revisión con `/code-review` antes del PR (7 arreglos: encargo que no se podía completar, disparos por lugar, caídos en combate, nacimientos sin pareja fértil, resumen con sus metadatos, edad de los líderes) y `GLOSSARY.md` al día con `domain-modeling`.
- **2026-10-04** — `CR-13` cerrada: nacimientos de verdad con herencia y vejez del catálogo por partida. Cronista Fase 3 cerrada.
- **2026-10-04** — `CR-13` 13b: edad, madurez y vejez; los nacidos en la partida crecen y envejecen con sus atributos y los NPC con nombre mueren de viejo.
- **2026-10-04** — `CR-13` 13a: «alguien que destaca» con herencia de los padres y nombre generado por pueblo; los NPC nacidos en una partida no existen en las demás.
- **2026-10-04** — `UX-38`: noticias de «El mundo» con icono de categoría, etiqueta de oportunidad (lugar y día límite) y resumen de varios días plegado.
- **2026-10-04** — `CR-12` cerrada: «Ayudar» a malheridos y oportunidades con plazo (campo de batalla, caravana, encargo de materiales).
