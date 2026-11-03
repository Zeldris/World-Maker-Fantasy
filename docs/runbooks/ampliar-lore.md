# Ampliar lore — runbook

**Qué es:** los pasos a seguir cuando la usuaria escriba **"ampliamos lore"** (o pida una sesión de
añadir/mejorar lore en general, no un bug ni una feature de código). Objetivo: la próxima vez,
arrancar directamente en este modo de trabajo en vez de tener que redescubrirlo. Ver también
`docs/registros/ampliar-lore-checklist.md` — el registro persistente de qué se ha añadido y qué falta llevar
a código, que sobrevive entre sesiones (a diferencia de la lista de tareas de una conversación).

## 0. Antes de nada

Leer `docs/registros/ampliar-lore-checklist.md` — la sección "Pendiente de código" puede tener trabajo de una
sesión anterior sin cerrar. Mencionarlo si hay algo ahí antes de seguir con lore nuevo.

## 0.5. Auditar la enciclopedia contra el canon (`QA-247`)

Cuando la sesión revisa lo que ya hay (como en `QA-243`), la auditoría se reparte en **tandas pequeñas**
(`orchestrate-dealer`, con Sonnet). Cada tanda:

- cubre una región o un catálogo (la fauna de la Ciénaga, los objetos de Cristal Helado), no un bloque entero;
- empieza por el resumen de `docs/canon-opencode/` y por la sección «Enciclopedia y lore» de `docs/mapa-agente.md`;
- mira cada elemento con `bash tools/qa/ficha.sh <slug> --canon`;
- tiene un tope de unas 30 llamadas;
- devuelve una tabla de hallazgos con columnas elemento · qué dice el juego · qué dice el canon · propuesta.

La principal revisa la tabla, la presenta a la usuaria y apunta lo aplicado en `docs/registros/lore-hallazgos.md`.
Los arreglos aprobados se aplican también en tandas de 30-40 llamadas (`QA-277`), con el mismo encargo, y la principal
revisa el diff entero.
Medida en `QA-243`: con un bloque por tanda, el contexto medio llegó a 110k y las tandas fueron el 40 % de la
entrada de la sesión.

## 1. El flujo de la sesión

La usuaria da indicaciones de lore (a veces un párrafo denso con varios personajes/eventos/reglas
de golpe). El trabajo, en orden:

1. **Leer primero los `.md` ya existentes que toquen ese tema** (`genesis.md`, `historia.md`,
   `clanes-orcos.md`, la región afectada en `lore-mundo/regiones/`, `areas.md` como índice, `razas.md`, `npcs.md`, `personajes.md`, `flora-fauna.md`, `items.md`,
   `cronologia-mitica.md`, `cronologia.md`) antes de escribir nada — el lore nuevo casi siempre
   toca algo ya establecido, y a veces ya jugado en partidas reales.
2. **Detectar contradicciones reales contra lo ya escrito y PARAR a preguntar**, no decidir en
   silencio. Ejemplo real de esta sesión: la nueva historia decía que el padre de Gorhorn moría a
   los 10 años de Gorhorn liderando una revuelta; `personajes.md` (ya jugado) decía que moría al
   nacer Gorhorn en un duelo contra el Clan Serhu — y esa segunda versión estaba tejida en la bio
   de un NPC real (Torgash) en `npcs.md`, `areas.md` **y en el catálogo técnico**
   (`worldCatalog.ts`, `loreChunks.ts`). Preguntar cuál se queda ANTES de tocar nada — no asumir.
3. **Cuando la usuaria pida explícitamente proponer algo** (nombres, huecos, etc.), proponerlo con
   el mismo estilo/fonética que el canon ya existente, y presentarlo para aprobación antes de darlo
   por fijado.
4. **Verificar la cronología, no solo la narrativa.** Antes de fijar un "X años después", cruzarlo
   contra `docs/rpgtarkor/lore-mundo/cronologia.md` (desde el año 0) o `cronologia-mitica.md` (antes del año
   0). Comprobar en concreto:
   - **Tasas de crecimiento de población** — calcular la tasa anual implícita (`(N/N0)^(1/años)-1`)
     y compararla con lo ya sembrado en `backend/src/scripts/worldPopulation.ts` si el target ya
     existe ahí (esta sesión: casi se reinventó un número que ya estaba puesto y que, de hecho, ya
     cuadraba con la explicación narrativa pedida — comprobar el catálogo ANTES de asumir que hace
     falta inventar o ajustar una cifra).
   - **Generaciones para cambios biológicos/adaptación** — con la esperanza de vida y edad de
     madurez ya establecidas de la raza en cuestión, calcular cuántas generaciones caben en el
     intervalo propuesto y compararlo con referencias reales (adaptación de pigmentación humana:
     ~100 generaciones en el caso más rápido bajo presión extrema, miles en el caso típico). Si el
     intervalo se queda corto, decir cuánto y ofrecer opciones (alargar el intervalo, o justificarlo
     con una regla ya establecida del mundo — aquí, que la magia salvaje acelera la biología orca).
   - Escalas de tiempo puramente políticas/económicas (golpes de estado, hambrunas) no necesitan
     este nivel de escrutinio — décadas son plausibles sin más.
5. **Actualizar todos los `.md` afectados**, no solo el que la usuaria mencionó — un cambio de
   biografía casi siempre toca personajes.md + areas.md + npcs.md a la vez si hay NPCs con bios
   cruzadas.
6. **Registrar en `docs/registros/ampliar-lore-checklist.md`**: qué se escribió (MD, hecho ya) y qué queda
   para cuando se haga la pasada de código (bios de NPCs en `worldCatalog.ts`, chunks RAG en
   `loreChunks.ts` + `npm run reindex-lore`, nuevas criaturas/objetos en el catálogo técnico, etc.)
   — la sesión de lore NO toca código salvo que la usuaria lo pida explícitamente; solo dejarlo
   anotado para la pasada posterior.
7. **Si la sesión cambió vocabulario, tono o nombres de forma notable** (no una corrección menor),
   anotarlo TAMBIÉN bajo "Pendiente de dataset" en `docs/registros/ampliar-lore-checklist.md` — el narrador
   fine-tuneado (`docs/ia/fine-tuning-ia-local.md`) aprendió de ejemplos generados con el lore de su
   momento; un cambio de fondo puede dejar ejemplos ya entrenados desalineados con el mundo actual
   sin que nada lo avise. No implica regenerar el dataset en la misma sesión — solo dejar constancia
   para cuando se decida.

8. **Sincronizar la capa de OpenCode** (añadido 2026-09-27): todo lo que pase a `docs/rpgtarkor/`
   se refleja también en `docs/canon-opencode/`. Una línea en la ficha regional afectada (y en el
   catálogo correspondiente: fauna, flora, objetos, NPC…), se quita de "Huecos" lo que ya esté
   cubierto y se actualiza la fecha de "Sincronizado" de la cabecera. Después, recalcular el tamaño
   (caracteres ÷ 3,3): ninguna tabla `LEE` por encima de ~16k tokens. Ver
   `docs/canon-opencode/README.md`.
9. **Estructura de los `.md` de lore** (2026-09-27): cada región tiene su fichero en
   `lore-mundo/regiones/` con geografía, lugares, fauna y flora juntos, un encabezado por entidad y
   una línea de metadatos (*familia · nivel · temperamento · Catálogo: `slug`*). Las notas de
   auditoría NO van en el cuerpo: van a "Historial de cambios", al final del fichero. Antes de
   cerrar, pasar `node tools/lore-links/check.mjs` (con `flatpak-spawn --host` desde el sandbox):
   0 enlaces rotos.

## 2. Verificación numérica — cómo, en la práctica

Para cualquier cálculo de tasa/generaciones, usar `python3 -c "..."` vía Bash en vez de estimar de
cabeza — esta sesión encontró un error propio (28 generaciones cuando parecía razonable a ojo,
resultó ser menos que la estimación humana más rápida) que a ojo no se habría visto tan claro.

## 1.5. Modo "zona por zona" (añadido 2026-08-21)

Variante del flujo general de arriba, para cuando la usuaria quiere recorrer una región entera de
forma sistemática en vez de dar indicaciones sueltas por tema. Se activa con algo como "vamos a ir
diciéndome 1 a 1 las regiones/zonas de X, citando ya los recursos que tiene, y yo voy ampliando".

1. Recorrer las `Location`/puntos de interés de la región en el MISMO orden en que aparecen en
   `areas.md` (orden geográfico ya establecido, no alfabético ni aleatorio).
2. Por cada zona: nombrarla, dar 1-2 líneas de recordatorio de lo que ya es, y citar EXACTAMENTE lo
   que ya está anclado ahí — mirando `harvestSourceHomeLocationSlug`/`homeLocationSlug` (fauna) para
   lo verdaderamente específico de ese punto, y siendo explícito cuando algo solo existe a nivel de
   región completa (`harvestSourceRegion`), no de esta zona en concreto.
3. La usuaria añade fauna/flora/recursos nuevos para esa zona — a veces en un solo mensaje denso, a
   veces en varios turnos con correcciones sobre la marcha (nombres, mecánicas, resources que deja a
   discreción de Claude). Revisar cada bloque como cualquier ampliación de lore normal: contradicción
   con lo ya escrito, coherencia ecológica/de nombres (colisión de alias por edición cercana, como
   "Volcanita"/"Vorcanenta" — avisar, la usuaria puede renombrar al vuelo), y confirmar antes de
   escribir cuando haya algo genuinamente ambiguo (p.ej. si un recurso reemplaza o convive con uno ya
   existente).
4. Escribir a los `.md` afectados (normalmente `flora-fauna.md` + `areas.md` + `items.md` si hay
   loot/equipo) Y al checklist (pendiente de código + resumen de la zona en el registro de sesión)
   ANTES de pasar a la siguiente zona — no acumular varias zonas sin escribir, la usuaria puede
   cortar la sesión en cualquier momento (motivo real la primera vez: "no sé si nos llegarán los
   tokens de sesión").
5. Mecánicas que se salen de "solo catálogo" (ej. Rocas Imanidas/Saco de Arena Imán: recolección de
   calidad variable + pérdida de inventario por ubicación) se marcan explícitamente como diseño
   propio en el pendiente de código, no se mezclan con las filas normales de `worldCatalog.ts`.
6. Al cerrar la sesión (o pausarla): dejar anotado en el checklist EXACTAMENTE en qué zona se quedó
   (para retomar ahí la próxima vez, sin repetir zonas ya cubiertas) y, si la usuaria lo pide, un
   análisis de qué contenido nuevo tiene sentido REPLICAR en otras zonas/regiones por tránsito
   migratorio, tipo de caza o encaje de recursos — ver sección "Propuestas de réplica" en el
   checklist para el formato de esa entrega.

## 1.6. Variante "zona por zona" — elemento por elemento con plantilla equivalente (confirmada
2026-09-02/03, sesión de la zona 15, Playa de Ceniza Blanca)

Reconstruida releyendo la transcripción real de esa sesión (no solo el commit final) porque la
primera versión de esta entrada asumía un formato equivocado: **no es Claude proponiendo el bloque
completo de la zona para aprobación en bloque.** El patrón real, confirmado turno a turno:

1. Tras el recordatorio de zona del paso 2 general (lo que ya es + lo ya anclado), la usuaria
   dicta el contenido nuevo **elemento por elemento** (un recurso o un animal cada vez, a veces
   varios mensajes seguidos si el primero se corta) — no toda la zona de golpe. Frase real que fijó
   este modo: *"desarrolla bien todo añadiendo lo que falte para hacerlo real, me lo vas dando 1 a 1
   lo reviso y vamos cerrando todo"*.
2. **Antes de proponer la ficha técnica de cada elemento, buscar un objeto/fuente ya existente en
   el catálogo que sea equivalente** (mismo tipo: árbol con madera+resina, alga de recolección
   pasiva de costa, pez inofensivo con receta de cocina...) y usarlo como plantilla de qué campos
   hacen falta de verdad — no improvisar el molde. Frase real que fijó esto: *"revisa un item que ya
   tengamos que sea 'equivalente' siempre para asegurarte de que me estás dando toda la información
   necesaria"*. Ejemplo real: para Junba Verde (árbol con madera+resina) se revisó Lucre Blanco
   completo (`ItemCatalog` + `HarvestYield` de la fuente) antes de proponer nada.
3. Proponer la ficha completa de ESE único elemento (nombre, bio, tier, `homeLocationSlug`,
   `metodoObtencion`, terrain tag, población si aplica) — la usuaria confirma ("perfecto") o corrige
   antes de pasar al siguiente. No se escribe nada a los `.md`/código todavía en este punto —  se
   van cerrando fichas "en memoria de la conversación" hasta cerrar toda la zona.
4. **Mecánica que se sale de "solo catálogo" se aparca explícitamente sin bloquear el resto** (igual
   que ya decía el § 1.5 general) — aquí surgió a mitad de fauna: la profesión "pescador" (caña+cebo
   para Pescar, sin herramienta para Buscar marisco, tirada doble en tier alto) no encajaba en
   ningún `MetodoObtencion` existente. Se ficha el animal en lore igualmente, marcando explícito que
   su recolección real queda pendiente de esa pieza de diseño.
5. **Cuando hay un lote con ambigüedad de coherencia repetida** (ej.: de 9 animales, ¿cuáles tienen
   recurso real y cuáles quedan puramente ambientales/narrativos?), en vez de preguntar uno a uno,
   **lanzar un agente en background** con el catálogo completo, el criterio ya fijado en la
   conversación (ej. "solo lo que aporta recurso real entra en un modal") y la lista concreta a
   auditar — resume los veredictos con su precedente real y se aplican de una vez. Frase real que
   pidió esto: *"lanza un agente de todo lo que tenemos y esta lista y me digas tú que cuadra sin
   recurso, que cuadra con... busca completar y dar coherencia"*.
6. **Solo al cerrar TODA la zona** (todos los elementos ya confirmados uno a uno) se decide si se
   lleva a código en la misma sesión o se deja para una pasada aparte — no es una decisión de
   arranque, es una decisión de cierre. En la sesión de la zona 15 se decidió llevarlo a código de
   una vez ahí mismo, paso a paso con verificación real (compilar + tests) en cada pieza, igual que
   en la zona 14. Si se hace así, seguir los puntos 1-3 de la variante `## 1.6` original (ahora
   más abajo, renumerada): `WorldPopulation` real para cada recurso, `tsc -b` + suite en verde,
   checklist con el conteo real de lo llevado a código.
7. Riesgo real si el paso 6 (llevar a código) ocurre en una sesión que no pasó por este runbook —
   visto en vivo con la propia zona 15, cuyo código (`worldCatalog.ts`) avanzó en un tramo de esta
   misma conversación posterior al que generó la memoria persistente de "ampliamos lore", dejando el
   checklist desactualizado un tiempo: la próxima sesión de "ampliamos lore" debe comprobar primero
   si `git log` tiene commits de `worldCatalog.ts` más recientes que la última entrada del
   checklist, y si los hay, presentar el resumen de lo YA anclado en código como si fuera la
   propuesta pendiente de aprobar (mismo formato del paso 2 general) — no reescribirlo de cero ni
   asumir que sigue sin decidir, y no seguir a la zona siguiente hasta cerrar ese hueco documental.

## 1.7. Segunda variante "zona por zona" — Claude propone, la usuaria confirma (confirmada
2026-09-03, al terminar la zona 15 y arrancar la zona 16, Los Acantilados Partidos)

Modo **inverso** al § 1.6: en vez de que la usuaria dicte el contenido nuevo elemento por elemento
(§ 1.6 punto 1), aquí **Claude propone la ficha técnica completa de cada elemento y la usuaria
solo confirma o pide ajustes**. La propia usuaria lo fijó explícitamente al cerrar la zona 15:
*"sigamos, con el plan de que ahora ya me das tú las recomendaciones completas y soy yo el que
confirmo"*. Son dos modos reales y confirmados, no uno "correcto" y otro obsoleto — cuál usar en
cada zona lo decide la usuaria, preguntando si no lo ha dicho ya para esa sesión.

Diferencias sobre el flujo de § 1.6:

1. Tras el recordatorio de zona (paso 2 general), Claude diseña y propone directamente 1 elemento
   con la ficha técnica COMPLETA — mismos campos que en § 1.6 punto 2/3 (slug, alias, tier,
   `homeLocationSlug`/región, terrain tag, `metodoObtencion`, bio, población si aplica), buscando
   igualmente un objeto equivalente real como plantilla antes de proponer (mismo criterio de § 1.6
   punto 2, no cambia). Formato exacto pedido por la usuaria: *"dame la [ficha] en el formato que me
   lo dabas antes, poniendo ya todos los campos de slug, alias etc y yo te digo que ajustamos"* —
   no un resumen narrativo suelto, la ficha con los campos reales visibles.
2. **Regla de mundo explícita en este modo** (puede aplicar también al § 1.6, pero se remarcó aquí):
   *"que todo lo creamos sea fantástico en mayor o menor medida y que tenga sentido"* — no animales/
   plantas 1:1 de la fauna real de la Tierra sin ningún giro propio del mundo. Y, más estricto
   todavía: **nunca usar el nombre de una especie real reconocible**, ni siquiera como base del
   nombre propio — error real cometido en la sesión: proponer "Alcatraz de Espuma" (alcatraz es un
   ave terrestre real) fue señalado de inmediato por la usuaria, que además aprovechó para pedir
   revisar si había más nombres así colados en el catálogo ya existente (encontró **Buitre
   Cenizo**, renombrado a Zense Ceniza en la misma sesión, commits `fef3933`/`c8102fe`). Antes de
   fijar un nombre propio nuevo, contrastar mentalmente si sería el nombre de un animal/planta real
   de este mundo — si suena a fauna terrestre reconocible, buscar una alternativa.
3. La usuaria confirma o pide cambios sobre la ficha propuesta (igual que § 1.6 punto 3) antes de
   pasar al siguiente elemento — el resto del flujo (agente para lotes con ambigüedad, mecánica que
   se sale de catálogo aparcada aparte, decisión de código en el mismo commit al cerrar toda la
   zona) es idéntico a § 1.6 puntos 4-7.

## 1.8. Plantilla de campos por tipo de elemento (fijada 2026-09-03, tras dos rondas de "faltan
campos" en la misma sesión — de referencia obligada antes de proponer o pedir cualquier ficha)

Antes de proponer/pedir la ficha de un elemento nuevo, **buscar siempre un elemento real ya
existente del mismo tipo como plantilla** (§ 1.6 punto 2) — la lista de campos de abajo es una
referencia de qué NO olvidar, no un sustituto de mirar el equivalente real (los valores concretos
de cada campo dependen del animal/planta en cuestión).

**Fauna** (`NpcInput`, `kind: 'PLANTILLA'`) — campos obligatorios:
- `slug`, `name`, `aliases` (variantes de texto para el matching)
- `role` (una línea, para listados/Enciclopedia), `articulo` (`'el'`/`'la'`)
- `level` / `levelMax`
- `attributes`: los 7 completos — `fuerza, destreza, constitucion, inteligencia, voluntad, carisma, magia`
- `bio` — descripción larga y detallista, no un resumen de 1-2 frases (regla explícita 2026-09-03:
  "ser detallista en la descripción. Entornos, Físico, personalidad y comportamiento... explique
  bien"), con el **aspecto físico como lo más importante de todo**: tamaño exacto en cm/m, forma
  corporal, textura/color de piel-pelaje-caparazón, rasgos de cabeza/ojos/extremidades, cómo se
  mueve — y, coherente con el tema real de su `faunaCategoria` (§ "Categorías de raza de fauna" en
  `faunaAbilities.ts`), nunca calcado de un animal real reconocible (mismo criterio ya fijado en
  § 1.7 punto 2). Estructura habitual, fundida en prosa corrida, no como lista: dónde vive/entorno →
  físico detallado → comportamiento/personalidad → cómo interactúa con el jugador si se le
  encuentra. Ejemplo de referencia del nivel de detalle esperado (Esclipe de Marisma, zona 17,
  aprobado explícitamente como plantilla de FORMA, no de contenido — no copiar el animal en sí):
  > "Habita exclusivamente el fango de la marisma salobre, donde la corriente dulce de tierra
  > adentro se pierde por fin en el mar — nunca se aleja del barro húmedo, ni siquiera para tomar el
  > sol. Cuerpo de 25 a 35 cm, aplanado y ancho como una hoja de junco caída, con cuatro patas
  > cortas terminadas en membranas anchas que se abren al pisar el fango y lo sostienen sin
  > hundirlo. Piel sin escamas, lisa y fría al tacto, casi transparente en los flancos — bajo ella
  > se adivina el tejido oscuro de las venas, que cambia de tono con la marea: más claro y gris
  > cuando el agua es dulce, más verdoso y turbio cuando sube la salada. Cabeza pequeña y chata,
  > hundida entre los hombros, con dos ojos saltones sin párpado visible que sobresalen justo por
  > encima del nivel del barro cuando se entierra, el resto del cuerpo invisible bajo la superficie.
  > No tiene voz — ni canto, ni bramido, ni siquiera un chasquido de alarma; se comunica entre
  > ejemplares moviendo el fango en ondas concéntricas que el resto siente a través de las
  > membranas de las patas. Solitario y sedentario, pasa la vida entera en el mismo tramo de
  > marisma, hundiéndose por completo al primer indicio de vibración extraña en el barro."
- `personality` (una línea de comportamiento, complementa a la `bio` sin repetirla)
- `homeLocationSlug` (si es específico de una zona) o sin él (si es de región completa, como
  Ruptidar)
- `loadout: []` (salvo que lleve equipo)
- `ataqueNatural` (una línea, se narra en combate)
- `temperamento` (`INOFENSIVO`/`CAUTELOSO`/`AGRESIVO`/...)
- `domesticablePct` + `atributoResistencia` SOLO si es tameable (no todos lo son)
- `faunaCategoria` — una de las 13 reales (`backend/src/services/faunaAbilities.ts`, tipo
  `FaunaCategoria`): GUELISES, ACECHANTES, CORVENES, ZANCUDOS, BESTIONES, RONDINES, QUITINOS,
  ESCAMADOS, NADANTES, ORDENADOS, UMBRIAS, MUDOS_SALVAJE, ROKRATS_ESTALLIDO — **nunca inventar una
  categoría nueva sin comprobar antes** (error real cometido en esta sesión: proponer "ANFICOS"
  para un anfibio cuando la categoría real ya existente es ESCAMADOS, que cubre reptiles Y
  anfibios).
- **`habilidadesRaciales`: 3 entradas SOLO si la fauna está pensada para combatir de verdad —
  `[]` si es puramente narrativa/ambiental** (corregido 2026-09-03, primera versión de esta regla
  decía "siempre 3 salvo Ruptidar" y no era el criterio real). El criterio no es "inofensivo o no"
  por sí solo — es si tiene sentido real que la jugadora la enfrente en combate: fauna diseñada
  para dar vida a la escena (presas muy pequeñas, animales que huyen sin más, curiosidades
  ambientales tipo Terinte/Benusa Pesquera/Manesti Azul de Playa de Ceniza Blanca) se queda en
  `[]` aunque sí lleve `faunaCategoria` asignada (para completitud del catálogo/Enciclopedia) —
  igual que Ruptidar, que sigue siendo el ejemplo de referencia, no la excepción. Cuando SÍ está
  pensada para combate real (aunque sea de temperamento CAUTELOSO, no solo AGRESIVO), lleva las 3
  completas: cada fauna combatible recibe 10 habilidades totales — 7 compartidas por toda su
  `faunaCategoria` (niveles 1×3/8/16/24/32, viven aparte en `FAUNA_CATEGORIA_ABILITIES`, no se
  tocan aquí) + estas 3 específicas del propio animal, en los niveles fijos 4/12/20 — por
  convención 1 ataque + 1 defensa + 1 utilidad, con su propio `preferredAttribute` y `effects`
  reales (ver la lista de efectos con motor real en el comentario de cabecera de
  `faunaAbilities.ts` antes de inventar uno). Cada objeto lleva `icon`, `name`, `description`,
  `categoria`, `preferredAttribute`, `level`, `effects`.

**Flora/recurso** (`harvestYields` + `ItemCatalog`, con sus mapas `harvestSource*` en `worldCatalog.ts`) — mismo nivel de detalle que fauna, misma regla
de "detallista, sin calcar nada real" (confirmado 2026-09-03: *"y el formato y los datos igual que
el anterior?... vamos con flora, recursos y materiales igual, misma idea que con fauna"* — la
descripción corta de Junba Verde/Temune de la zona 15 NO es el nivel a replicar, era antes de fijar
esta regla). Campos obligatorios:
- Fuente: `slug`, `homeLocationSlug`, `harvestSourceRegion`, terrain tag, display name.
- Descripción de la fuente — igual de larga y detallista que una `bio` de fauna: entorno (dónde
  crece/se forma, qué necesita para darse ahí), físico detallado (tamaño real, forma, color,
  textura al tacto, cómo cambia con estación/marea/luz si aplica — lo más importante de todo, igual
  que en fauna), y algún rasgo de comportamiento si es planta con algo de vida propia (se cierra,
  sigue la luz, atrae algo) — fundido en prosa, no en lista. Sin calcar ninguna planta/mineral real
  reconocible, coherente con el resto del mundo.
- Por cada producto derivado (puede haber más de uno, como madera+resina): `itemSlug` propio,
  `metodoObtencion` (`TALA`/`EXTRACCION`/`MINERIA`/`PESCA`/`BUSQUEDA`/`CAZA`), `category`, `tipo:
  'RECURSO'`, `tier`, `valorGoirnos`, `dimensiones`, `description` (esta sí puede ser más corta —
  describe el material ya extraído, no la fuente viva).
- `WorldPopulation`: una fila por producto (`targetType: 'RECURSO'`), con la cifra propuesta
  explícita para que la usuaria la confirme o corrija — nunca inventar sin proponerla en voz alta.

**Equipo/loot de un NPC** (`loadout` en `worldCatalog.ts`) — fórmula general confirmada
2026-09-04 (rebalanceo del Orco Enfurecido, `docs/producto/21-roadmap.md`): salvo que la ficha del NPC pida
explícitamente lo contrario (fauna pura, un NPC ya despojado a propósito, etc.), un `loadout` de
NPC humanoide/con inventario real debería incluir, casi siempre:
- **1 objeto curativo** (`category: 'medicinal'`, p.ej. `vendaje-improvisado-*` o una cataplasma —
  revisar si ya existe uno tematizado a la cultura/región del NPC antes de crear uno nuevo).
- **1 objeto de comida** y, si tiene sentido para el personaje/contexto, **agua** (`category:
  'consumible'`/`'alimento'`, p.ej. `racion-carne-ahumada`, `odre-agua` — revisar equivalentes ya
  existentes primero).
- **Lo que lleve equipado de verdad** (arma, armadura, cosméticos) — coherente con lo que la propia
  bio/rol describe, nunca más de lo que un personaje así llevaría encima.
- **Materiales/recursos no equipables** si el rol lo justifica (un minero con mena en el bolsillo,
  un cazador con una piel a medio curtir).

Regla de coherencia (la que motivó esta fórmula): **todo lo que aparece en `loadout` se saquea del
cadáver** — no hay ningún mecanismo que separe "lo que el NPC lleva puesto" de "lo que suelta al
morir" salvo la recompensa de misión explícita (`Quest.rewardItems`, ver
`docs/mecanicas/19-post-combate-y-recompensas-mision.md`). Si se le quita un objeto al `loadout` por
cualquier motivo (rebalanceo de combate, corrección de lore), hay que decidir a la vez si ese
objeto desaparece del todo del saqueo o se sustituye por otro coherente — nunca dejarlo a medias.

## 3. Qué NO hacer

- No editar `docs/mecanicas/12-mundo-estructurado.md` como si el pasado se pudiera reescribir — si una
  decisión registrada ahí queda obsoleta, tachar y anotar la revisión con fecha, nunca borrar el
  registro original.
- No tocar código (`worldCatalog.ts`, `loreChunks.ts`, etc.) en la misma sesión salvo petición
  explícita — anotar en el checklist y esperar a la pasada de código.
- No inventar una cifra (población, año) si ya existe una sembrada en el catálogo técnico —
  buscarla primero (`grep` en `backend/src/scripts/`).

---

**Ver también:** [Checklist persistente](../registros/ampliar-lore-checklist.md) · [Índice del mundo](../rpgtarkor/lore-mundo/07-mundo-helek-sirik.md)
(todo el lore) · [Revisar partida](revisar-partida.md) (runbook equivalente para auditar partidas
jugadas, no para ampliar lore)
