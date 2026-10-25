# Retro y opt-tokens · `claude/lore-enciclopedia` (2026-10-25)

**Estado:** aprobada entera por la usuaria (2026-10-25) y aplicada en la rama:
- 1 → `QA-245` (`tools/qa/ficha.sh`);
- 2 → `QA-246` (`cobertura.py --libre` y «ABIERTAS TAMBIÉN EN MAIN», que compara con la base común y no con el
  título, para no fallar cuando una rama cambia el título de una tarea de `main`);
- 3 → `QA-247` (`ampliar-lore.md` § 0.5);
- 4 → `QA-248` (sección «Enciclopedia y lore» de `docs/mapa-agente.md`).

Sesión de `QA-243`: se audita la enciclopedia y se corrige lo que estaba mal en el código y en el canon, siempre con
el sí de la usuaria. Se revisaron cuatro bloques:
1. NPC y razas;
2. fichas y clases;
3. objetos y recetas;
4. lugares, facciones, fauna y flora.

También se añadieron traducciones de facción a `lenguas-helek.md`.

Cifras de `medir.py --hours 0`:
- **Sesión principal (toda con Opus):** 431 llamadas y 6 compactaciones. Contexto medio de 111k; techo de unos 166k
  por tramo, lo previsto con la ventana de 200k.
- **9 subagentes de auditoría (8 con Sonnet):** 292 llamadas y 32M de entrada, el 40 % de toda la sesión. Su contexto
  medio fue de 102k a 118k, entre 34 y 49 llamadas cada uno.

## Lo que salió mal

- **Choque de identificadores con `main`.** La rama abrió `QA-240` y `QA-241`, pero `main` ya los había usado para las
  voces mientras tanto. Al traer `main` hubo que renumerar a `QA-243` y `QA-244` en código, tests, canon, roadmap,
  bitácora y memoria: un commit entero solo para eso. Nada avisa de que un identificador nuevo ya existe en
  `origin/main`.
- **El test de región solo cubría la fauna.** Once plantas de fuera de las Llanuras se quedaron sin región, y lo vio
  la revisión, no el test. Está arreglado en la fase 1: el test cubre ya toda fuente de recolección.
- **Se releyó `worldCatalog.ts` 140 veces** (36k tokens, 1,5M arrastrados), siempre con `grep` y `sed` para reunir
  lo de un mismo slug: el objeto, el despiece, la región, el nombre y la descripción en la enciclopedia, la población,
  las recetas y los chunks de lore. Esos datos están en seis diccionarios y tres archivos.
- **Los subagentes de auditoría crecieron hasta los 110k** porque cada uno cubría un bloque entero (todos los lugares,
  toda la fauna) y leía el canon completo por su cuenta.
- **No hay sección de la enciclopedia en `docs/mapa-agente.md`.** La sesión la buscó con `grep` y leyó
  `routes/world.ts` 13 veces para saber de dónde saca cada ficha sus datos.

## Propuestas, de más a menos peso

1. **`tools/qa/ficha.py <slug>`** (economía de herramientas, del proyecto; `opt-tokens`).
   - **Qué:** en una sola salida, todo lo de un slug:
     - la ficha del catálogo (objeto, fauna o NPC) y sus alias;
     - el despiece;
     - la región;
     - el nombre y la descripción de la enciclopedia;
     - la población;
     - las recetas que lo usan o lo fabrican;
     - los chunks de lore que lo nombran;
     - dónde lo menciona el canon (`archivo:línea`).
   - **Ahorro:** casi todas las 140 lecturas de `worldCatalog.ts` y unas 50 llamadas por sesión de lore (unos 5M de
     entrada a precio de caché).
   - **Coste:** un script de unas 150 líneas y su test en `tools/qa/tests/`.
   - **Riesgo:** que se deje un diccionario. El test compara el script con los nombres de lo que exporta
     `worldCatalog.ts`.
2. **Avisar de un identificador que ya usa `main`** (comprobación automática, del proyecto).
   - **Qué:** `cobertura.py --libre QA` da el siguiente número libre mirando la rama y `origin/main`. Además, el
     pre-push avisa si una tarea que define la rama ya está definida en `origin/main` con otro texto.
   - **Ahorro:** el commit de renumeración y su riesgo de dejarse una mención.
   - **Riesgo:** ninguno. Si no hay `origin/main` a mano, solo avisa.
3. **Auditorías de lore en tandas pequeñas** (`orchestrate-dealer`, del proyecto; `opt-tokens`).
   - **Qué:** una línea en el runbook `ampliar-lore.md` o en `skills-y-modelos.md`:
     - una tanda de auditoría cubre una región o un catálogo, no un bloque entero;
     - el encargo apunta al resumen de `docs/canon-opencode/` y a `ficha.py`;
     - tope de unas 30 llamadas;
     - devuelve una tabla de hallazgos.
   - **Ahorro:** de 110k a unos 60-70k de contexto medio en las tandas, que son el 40 % de la entrada.
   - **Riesgo:** más tandas y más trabajo de reparto en la principal. La tabla de cada tanda sigue pasando por la
     revisión de la principal.
4. **Sección «Enciclopedia y lore» en `docs/mapa-agente.md`** (navegación, del proyecto).
   - **Qué:** las rutas de `routes/world.ts` que montan cada pestaña de la enciclopedia, los diccionarios de
     `worldCatalog.ts` de los que salen (`harvestSourceDisplayName`, `harvestSourceDescriptions`,
     `harvestSourceRegion`), `worldPopulation.ts`, `loreChunks.ts`, los tests de integridad (`floraConFicha.test.ts`,
     `crafting.test.ts`) y `docs/canon-opencode/`. `mapa-agente.py` comprueba las rutas.
   - **Ahorro:** las 13 lecturas de `world.ts` y las búsquedas por el mapa.
   - **Riesgo:** ninguno.

## For Galivelop-workflow

- **Identificadores de tarea entre ramas paralelas.** Con dos sesiones abriendo tareas a la vez, el siguiente número
  libre se reparte dos veces. El flujo podría dar el siguiente identificador libre mirando también la rama protegida,
  o comprobar al traer `main` que ningún identificador nuevo de la rama choca con uno de `main`.
