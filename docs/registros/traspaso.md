# Bitácora de traspaso

**Para qué:** que cualquier sesión de Claude, de cualquiera de las dos cuentas, sepa exactamente
por dónde va el trabajo y pueda seguir. Reglas en [`CLAUDE.md`](../../CLAUDE.md). **Se actualiza en
cada commit.**

---

## Estado actual

| | |
|---|---|
| **Actualizado** | 2026-10-07 |
| **Rama de trabajo** | `claude/frontend-improvements-roadmap-0mpckt` (desde el 2026-10-06, `CR-55`; parte de `main` en `2750d6a`). La anterior era `claude/wonderful-volta-662qt8` (la otra cuenta). Las skills de `.claude/skills/` van versionadas (`git add -f`); a `main` se pasa **por pull request**. |
| **Último commit en `main`** | Fusión del PR #33 (2026-10-07, `f78d800`, CI en verde, la usuaria lo pidió): `CR-65` defensa y milicia y `CR-50` campamentos de bandidos, con la revisión de código (13 arreglos). Antes, PR #31 (`cd32dcc`): `CR-63`. Antes, PR #30 (`456bcef`): `QA-13`…`QA-20`. |
| **Hito** | `0.3` Reino profundo, Fase D (economía y ganadería) y E (conflicto) — [plan](../producto/plan-roadmap-0.3.md) · [mapa de roadmaps](../producto/21-roadmap.md#qué-entra-en-cada-hito). El `0.1` y el `0.2` siguen abiertos solo por lo que espera a Álvaro (ver abajo) |
| **Tarea en curso** | Fase E del `0.3`: `CR-65`, `CR-50`, `CR-37` y `CR-67` ✅. **Siguiente:** PR a `main` (revisión hecha: 10 arreglos; «Fácil por debajo del margen» se queda, es la decisión de la usuaria); después, ronda de `CR-66` postura de compañero. Pendiente de la usuaria: razas para los campamentos. Esperan a Álvaro: 49c, Z-C (`ZON-1`), lista de lugares de `CR-39`. |
| **Tests** | Frontend: `tsc -p tsconfig.app.json` 0, `vitest` 108 archivos / 527 tests (2026-10-08, `CR-67`) (incluye `src/pages/**`), `oxlint` 0 errores. Backend en local con Postgres real: `tsc` 0, `vitest` 263 archivos / 3420 tests en verde (2026-10-08, `CR-67`), `oxlint` 0 errores (15 avisos, los mismos de antes). Intermitentes: G16. El de `ProduccionSection.test.tsx` está diagnosticado y arreglado (`QA-12`, 2026-10-05). «combate múltiple: crea el encuentro con iniciativa real…» diagnosticado y arreglado el 2026-10-04 (el tope de 60 turnos del test era corto: ~1/40 combates lo pasan; ahora 400). P3.2 del viaje interrumpido diagnosticado con `diagnosing-bugs` (2026-10-04): era un fallo real (ver «Hecho recientemente»); si vuelve a salir `travelResumed` nulo en suite completa, es otra causa sin reproducir aún. La deriva de XP de los NPC («expected N to be greater than N») la evita el `globalSetup` de `bd-real` (`QA-8`). Tras un reinicio del contenedor, `.claude/hooks/session-start.sh` (`QA-10`) vuelve a levantar Postgres y el Ollama simulado. CI de GitHub en verde (PR #11) |

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

- **2026-10-08** — ~~`CR-67` asaltos por estado e intensidad~~: principios 9 (nada se apaga) y 10 (nada en bucle fijo) del Cronista; campamentos y ejércitos deciden por fuerza, motivo y defensa estimada, sin «cada 7 días»; intensidad contenida/normal/dura y tamaño fácil/normal en Configuración › Partida. Migración `20261008100000_intensidad_asaltos`.
- **2026-10-08** — ~~`CR-37` guerra contra el Reino~~: las facciones en guerra mandan ejércitos semanales (viajero `ASALTO` con facción) contra el asentamiento más cercano; defienden también los guardias de fauna y el personaje con su grupo; tributo para bajar la presión y contraataque a su casa; «Guerra» en Reino › Defensa.
- **2026-10-07** — ~~`CR-50` campamentos de bandidos~~: aparecen (1 por región con ocupantes de semilla, se rehacen a los 20 días), se refuerzan y crecen, asaltan a viajeros, caravanas y al Reino (viajero `ASALTO` que entra en la defensa de `CR-65`), se conocen por visita, rumor o Torre, y se acaba con ellos en vivo, con una partida del Reino o con patrullas de facción. Migración `20261008000000_campamentos`.
- **2026-10-07** — ~~`CR-65` defensa del Reino y milicia~~: módulos de defensa por asentamiento (Empalizada con cobertura y aguante, Torre de vigía como radar, Armería con equipos de milicia, Barracón con guarnición y moral), asaltos de fondo con saqueo, facciones con Empalizada que refuerzan, y Reino › Defensa con alerta y alcance en el mapa. Migraciones `20261007230000_defensa` y `20261007233000_milicia_radar`. Regla nueva: diseño contrastado con los juegos, X4 primero.
- **2026-10-07** — ~~`CR-63` partidas de caza y captura~~: viajeros con ruta real (jornada de 8 h, `services/viajeros.ts`), caza de fondo y piezas que caducan con el Desolladero, captura con cuerdas y Jaula, Reino › Partidas con rol «cazador» y órdenes permanentes, en el mapa de Berig y «De paso por aquí» con marcador en la zona (preguntar con rumores, comprar y vender), encuentros por el camino, y las facciones cazando con partidas si les sobra comida (prototipo y Q12). Migraciones `20261007200000_viajeros`, `20261007210000_piezas`, `20261007220000_viajero_encuentro`.
- **2026-10-07** — ~~`CR-61` comida por oficios~~: fin de la comida pasiva (2 por trabajador, +3 por Cocina). Reglas puras en `cronista/comidaOficios.ts`; las facciones reparten sus trabajadores por la costumbre de su pueblo (caza de orcos y Faerus en agregado hasta `CR-63`) y estiman su balance con `produccionDeFaccion`; cada súbdito trabajador tiene su tarea (`Subject.tarea`, migración `20261007120000_subdito_tarea`, selector en Reino › Súbditos) y de ella sale `comidaDelReino`; los súbditos ganaderos y fibreros trabajan en Corrales y Fibrería; los platos suman su `curaHambre` y hay 4 recetas nuevas de Obrador y Gran obrador.
- **2026-10-07** — ~~`CR-62` combate de fondo~~: ronda aceptada (Q1-Q6 en `plan-roadmap-0.3.md`; sub-combates de 8 sin la jugadora y de 4 con ella; tarea nueva `CMB-9` en el `0.8` para subir el tope de 4). Motor puro `services/combateDeFondo.ts` (grupos, emparejamiento, iniciativa, objetivo, capitán, moral y retirada, 3 % de muertes); combatientes de facción (`cronista/combatientesFaccion.ts`); la intercepción de expediciones, la escaramuza del narrador (2d4 contra 2d4) y la patrulla de vasallaje (20 contra 1d6+2) pelean con él (`cronista/escaramuzas.ts`); en la caza en grupo, tus grupos 2, 3… luchan de fondo contra los grupos enemigos que sobran, con su resumen.
- **2026-10-06** — ~~`CR-56` usos de la fauna~~: ronda aceptada (Q1-Q6 en `plan-roadmap-0.3.md`) con la regla de combate de la usuaria ([ADR 0002](../adr/0002-dos-formas-de-combate.md): en vivo con la jugadora y su grupo; todo lo demás, de fondo con el mismo motor) y tarea nueva `CR-62`. Ficha de usos (`cronista/usosFauna.ts`) en la Enciclopedia; Rondador, Cruzavientos y Salamandra como ganado de guardia; «Llevar contigo» / «Devolver al corral» para la Domadora (migración `20261006190000_companero_de_corral`); guardias de facción por versiones del rebaño (Serhu 6 Canizores, Feg Ger 3; migración `20261006200000_ganado_version`).
- **2026-10-06** — ~~`CR-55` ganadería~~: diseño en una ronda (`grilling` + `domain-modeling`; Q1-Q16 en `plan-roadmap-0.3.md`), tarea nueva `CR-61` (comida por oficios). Oficio `domador-…` → `ganadero-…` (el Domador es especialización de combate); `Ganado` del Reino (un animal por fila, un corral por especie, «Al corral» al domesticar, Fibrería y forraje, avance diario, «Sacrificar»); `GanadoFaccion` por cohortes dentro de `producirFacciones` (ganaderos y fibreros fuera de la comida pasiva; rebaño Serhu 60 Múrgol y 20 Corretolvas); Q16 con la libertad de la usuaria: leche ×3, Huevo de Corretolvas, pastoreo en las Llanuras; Reino › Corrales en el front. Migraciones `20261006160000_oficio_ganadero`, `20261006170000_ganado`, `20261006171000_sin_orden_leche`, `20261006180000_ganado_faccion`. `/code-review` del diff contra `main` (10 hallazgos, todos arreglados: «Al corral» bajo candado y nunca de un compañero ya confirmado; herbívoros y carnívoros comen por separado; el Granero se comparte con el forraje; crías tras las muertes; el ganado de las facciones bebe; sin macho tras el sacrificio no hay crías; los ganaderos de facción conservan su riqueza; la comida fraccionaria no se pierde; el rebaño solo se reescribe si cambia). De paso, `diagnosing-bugs`: el test de `MUERTE_LIDER` de `reacciones.integration.test.ts` dependía del orden de la base (el primer NPC Helsig podía ser la líder); arreglado.
- **2026-10-06** — Skills al día con mattpocock/skills v1.3.1 (las nuestras ya eran esa versión). Añadidas `prototype` (HTML con botones para que la usuaria pruebe números y reglas en las rondas de diseño; se guarda en `docs/prototipos/`) y `pr` (descripción de los PR a `main` tras `/code-review`); descartadas con su motivo `tdd`, `to-questionnaire`, `wait-what` y las de issues. Flujo de skills de una tarea escrito en `docs/runbooks/skills-y-modelos.md` y enlazado desde `CLAUDE.md` y `selector`. `retro` ya la lanza Claude al cerrar cada fase (la usuaria revisa y confirma sus propuestas). Rama: `claude/frontend-improvements-roadmap-0mpckt` (al día con `main` en `6404270`).
