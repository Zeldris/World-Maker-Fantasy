# Ampliar lore — checklist persistente

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de qué se ha añadido en cada
sesión de "ampliamos lore" (ver `docs/ampliar-lore.md` para el runbook) y qué queda pendiente de
llevar a código. La sección "Pendiente de código" es la que importa entre sesiones — la lista de
tareas de una conversación no sobrevive al cierre de la sesión, este archivo sí.

---

## En curso — repaso "zona por zona" de Las Llanuras del Viento Rojo (empezado 2026-08-21)

Modo de trabajo nuevo, ver `docs/ampliar-lore.md` § 1.5-1.7. **16 zonas cubiertas hasta ahora, en
este orden** (ver "Sesión 2026-08-21 (duodécima pasada)", "Sesión 2026-08-22 (decimotercera
pasada)" y "Sesión 2026-09-02/03 (decimocuarta pasada)" más abajo para el detalle completo de cada
una): 1. La Hondonada del Eco, 2. Los Pilares Rotos, 3. El Pozo de Cauce Viejo, 4. El Cruce de las
Cenizas, 5. Los Restos de Maktor (retirada), 6. El Campamento del Clan Serhu, 7. El Osario de la
Manada, 8. Las Agujas Imán, 9. Los Manaderos, 10. Los Túmulos del Honor (sin cambios), 11. Los
Pastos de la Deriva, 12. El Filo de las Brasas, 13. Las Fumarolas Negras, 14. La Sabana Alta,
15. Playa de Ceniza Blanca, 16. Los Acantilados Partidos.

**Parada aquí — la próxima zona es la 17: La Desembocadura Callada.** Después quedan, en el mismo
orden que `areas.md`: Las Pozas de Marea, El Embarcadero de Ceniza, Las Dunas Ahogadas, El Vientre
del Engaño, El Laberinto de Cañones, Las Fumarolas Negras *(ya cubierta, saltar)*, El Paso de los
Huesos, El Vergel de Kegi, El Campo Yermo, La Grieta Cantora, El Oasis de Juncos Rojos. Las 3 ruinas
Nabierus (Ciudad Hundida/Archivo Cegado/Observatorio Roto) siguen fuera del grafo jugable, no entran
en este repaso todavía (ver pendiente de código de arriba). **Al cerrar la última zona de la
región**, la usuaria pidió explícitamente una repasada completa de coherencia — ver si alguna zona
quedó poco alimentada de lore o si se coló algo que no encaja — antes de dar por cerrada Las
Llanuras del Viento Rojo.

## Propuestas de réplica entre zonas (análisis pedido por la usuaria al pausar, 2026-08-21)

De todo lo añadido en las 13 zonas de esta sesión, esto es lo que tiene sentido real replicar en
otras zonas/regiones por tránsito, caza o encaje de recursos.

**Aplicado en código el 2026-08-22** (los 4 candidatos que eran puramente mecánicos, sin lore
nuevo que inventar):
- **Corredor migratorio real de Corredores de Cauce** — RESUELTO. `faunaTerrainTag['corredor-de-
  cauce']` cambiado de `'humedo'` a `'vegetacion'` (`worldCatalog.ts`): ahora solo aparece en Los
  Manaderos (nace), Los Pastos de la Deriva (pasta) y La Sabana Alta (refugio/caza del Aullador
  Rojo) — antes, con `'humedo'`, aparecía también en 4 zonas costeras sin ninguna conexión de lore
  y NUNCA en La Sabana Alta pese a que `areas.md` la nombra explícitamente. El Paso de los Huesos
  se queda solo con los restos óseos ya descritos (no necesita encuentro vivo, es lore de
  migraciones ya fallidas). Anotado también en `areas.md` § Los Manaderos.
- **Ruptidar ("cualquier zona arenosa")** — RESUELTO. `faunaTerrainTag['ruptidar'] = 'arido'`
  añadido (antes no tenía tag y aparecía en TODA la región, playas incluidas). Cubre automáticamente
  Las Dunas Ahogadas, El Vientre del Engaño, La Fosa Horadada y el resto de zonas áridas, sin
  inventar nada nuevo — coincide exactamente con su propia bio ("cualquier zona arenosa").
- **Pasto Solar ("toda la llanura donde crece vegetación")** — RESUELTO, y con un hallazgo real de
  paso: tenía un candado de `Location` única en `harvestSourceHomeLocationSlug` (Los Pastos de la
  Deriva) que SÍ bloqueaba de verdad su aparición en cualquier otra zona (es un recurso PASIVO,
  ver `discovery.ts`) — contradecía su propia descripción ("la hierba base de TODA la llanura").
  Candado quitado + `lugarOrigen: 'Llanuras del Viento Rojo.'` añadido al ítem para que caiga en el
  filtro de región normal en vez de quedar sin filtrar del todo. Ya aparece en La Sabana Alta y
  cualquier otra zona de la región.
- **Rondador de Brasas ("donde hay brasas hay carne")** — ya cumplido sin tocar nada: nunca tuvo
  `faunaTerrainTag` propio, así que ya aparecía sin filtro en toda la región (Las Fumarolas Negras
  incluidas). Confirmado, no requería cambio.

**Hallazgo real no anticipado, encontrado al verificar lo de arriba (2026-08-22)**: 10 de los
recursos MINERIA/TALA/EXTRACCION añadidos en la pasada de código del 2026-08-21 (Lucre Blanco,
su Resina, Telda Común, Telda Ceniza, Resina Telda Gris, Flor Salvatura, Volcanita, Rovalnica,
Fercaneo, Yerreo) tenían `HarvestYield` pero NINGUNA fila en `worldPopulation.ts` —
`candidateSourcesFor` (recolectar.ts) exige una fila `WorldPopulation` con `poblacion > 0` para
poder ofrecer una fuente como candidata; sin ella, esos 10 recursos no podían recolectarse en
NINGUNA zona, con independencia de terreno. (Los recursos PASIVO de la misma pasada —Boungo,
Gradias, Musgo Rojo, Juncos Rojizos, Verdileas Acuáticas, Hojas de Telda, Osario de la Manada—
usan `discovery.ts`, no `WorldPopulation`, y ya funcionaban bien vía `harvestSourceHomeLocationSlug`.)
Añadidas las 10 filas que faltaban + etiquetas de terreno nuevas (`volcanico` para Volcanita/
Rovalnica/Fercaneo — con `'volcanico'` añadido también a `locationTerrainTags` de Filo de las
Brasas/Fumarolas Negras, antes ningún sitio lo usaba; `rocoso` para Yerreo/Lucre Blanco/su resina;
`humedo` para Telda Común/Ceniza/su resina; `vegetacion` para Flor Salvatura) — sin esas etiquetas,
arreglar solo la población los habría hecho aparecer en TODA la región de golpe, justo lo contrario
de "casi imposible de encontrar salvo aquí". Verificado con un script de integridad ad-hoc: cero
`sourceSlug` MINERIA/TALA/EXTRACCION sin `WorldPopulation` en el núcleo jugable tras el fix.

**Siguen pendientes de decisión de lore, no son solo código** (candidatos que si se aplican sin
más calcarían contenido en vez de darle variante propia, cosa que la propia usuaria pidió evitar):
- **Ecosistema de charca (Musgo Arcilla/Telda/Guchapos/Lebudes/Escorantes, de El Pozo de Cauce
  Viejo) → El Oasis de Juncos Rojos**: candidata fuerte para una VARIANTE (no las mismas 5 especies
  calcadas) del mismo ecosistema — necesita nombres/fauna propios, sesión de lore.
- **Ecosistema de Los Manaderos (Jusha/Miruina/Quio/Tura Jusha) → La Desembocadura Callada**:
  misma idea, pero en variante de agua salobre en vez de dulce — necesita sesión de lore.
- **Telda Común/Ceniza → El Vergel de Kegi**: sin decidir si tiene sentido (más verde por ser
  territorio Faerus) o si la usuaria prefiere flora propia de ese punto, no orca — pendiente de
  preguntarle directamente.
- **Enredaderas de las Llanuras → El Laberinto de Cañones / La Fosa Horadada**: candidata técnica
  (mismo criterio de sombra/humedad relativa), pero de baja prioridad — hoy Enredaderas no tiene
  `faunaTerrainTag`/`harvestSourceTerrainTag` propio (aparece sin filtrar en toda la región, lo que
  YA incluye estas dos zonas), así que no bloquea nada; solo quedaría pendiente si se decide
  taguearla con más precisión más adelante.
- **NO replicar sin más**: Yerreo/Hiyerro, Rocas Imanidas, Fercaneo y las 22 fichas de NPC del
  Campamento Serhu son deliberadamente ÚNICOS de su zona (escasez/unicidad es parte del diseño) —
  aparecer en más de un sitio les quitaría el sentido. Nota honesta: la exclusividad de Yerreo
  hoy solo llega hasta 'rocoso' (comparte tag con 8 zonas rocosas más) — el sistema de terreno
  actual no tiene una categoría lo bastante fina para aislarlo a una única `Location`; lograrlo de
  verdad exigiría que `candidateSourcesFor` empezara a mirar `harvestSourceHomeLocationSlug` como
  filtro real (hoy es solo flavor/Enciclopedia fuera del bucket PASIVO) — cambio de motor aparte,
  no de catálogo, mismo criterio que el resto de "pendiente de diseño".

---

## Pasada de código de la sesión 2026-08-21 (mismo día, tras la ronda de lore)

**La mayor parte de "Pendiente de código" de abajo ya está hecha** — llevada a `worldCatalog.ts`/
`worldPopulation.ts`/`crafting.ts` en 4 commits el mismo día (`b92d1ba`, `4ed9f09`, `064ac57`,
`5727f2c`): retirada de Los Restos de Maktor (Juguete/Brazalete fuera; Tótem/Tablilla dentro, ver
hallazgo abajo), 14 `NpcInput` de fauna nueva con nivel/atributos/habilidades propios, 42
`ItemCatalogInput`, ~65 `HarvestYield`, `harvestSourceRegion`/`harvestSourceHomeLocationSlug` para
~28 fuentes nuevas, 14 filas de `worldPopulation.ts`, `homeLocationSlug` del Rondador de Brasas en
El Filo de las Brasas, y el oficio `cocinero-orco-llanuras` con su primera receta real (Boungo
asado). Verificado en cada commit: `tsc -b` limpio + suite completa (1129/1129, excluidos los 2
archivos de integración con problemas de entorno preexistentes ya confirmados).

**Hallazgos reales durante la pasada de código, no anticipados en la sesión de lore**:
- El Tótem de clan roto NO se pudo retirar del todo como se había decidido primero — es ingrediente
  real de `MAKTOR_CLAN_TOTEM_RECIPE` (construction.ts), una receta de Reino ya implementada. Se
  revirtió su retirada; la Tablilla quemada (documento "La caída del Clan Maktor") tampoco se quitó,
  por el mismo motivo de no ser un trofeo suelto. Ver `docs/12-mundo-estructurado.md` § 4.3.
- El Pañuelo de luto Serhu nunca fue de Los Restos de Maktor — es de Los Túmulos del Honor. Error
  de una nota anterior, ya corregido en `areas.md`.
- El Osario de la Manada llevaba semanas de lore diciendo ser fuente de hueso/placa ósea "sin
  cacería" sin tener nunca un `sourceSlug` propio — resuelto de paso para los 2 recursos nuevos.
- Ya existía "Lingote de hierro imantado" (hierro + arena imán) y "Saquito de arena imán" (trofeo
  narrativo) — el nuevo Lingote de Hiyerro y el futuro Saco de Arena Imán (Fase 2) quedan con alias
  cuidadosamente distintos para no colisionar con ninguno de los dos.

**Sigue pendiente, genuinamente aparcado** (no solo relleno de catálogo — necesita diseño de motor
antes de escribir código, mismo criterio que ya se aplicó al sistema de niveles):
- **Fase 2 completa** (Rocas Imanidas de calidad variable + pérdida de inventario por zona + Saco
  de Arena Imán; sistema de "Reino" que consuma `capturablePct`/`reclutablePct`) — sin tocar.
- **Los 22 NPC del Campamento del Clan Serhu** (11 Maestro + 11 trabajador) — bloqueados de verdad
  en dos mecánicas que no existen: "aprender oficio de un NPC" (ni el cocinero recién creado ni
  alquimista, su precedente, tienen ninguna vía de aprendizaje hoy) y el propio sistema de Reino de
  arriba. Crear los 22 NPC sin ninguna de las dos mecánicas sería trabajo a medias — mejor esperar.
- **Pasivo de los Nuentes** (-2 al ataque del jugador con arma de metal) — no enganchado todavía en
  `combatExchange.ts`; el `NpcInput` de Nuente ya lleva un comentario marcando dónde debería vivir.
  *(Confirmado sin cambios en la auditoría del 2026-08-23 — sigue sin ningún caller real, sigue
  genuinamente pendiente.)*
- ~~`harvestSourceAliases`/`harvestSourceDisplayName`/`harvestSourceDescriptions` de los ~28
  `sourceSlug` nuevos~~ — **RESUELTO 2026-08-23**, misma auditoría lore↔código que confirmó todo lo
  demás de esta sección: rellenadas para ~40 slugs (los ~28 de aquí más los que se sumaron después,
  Ferike/Towrgu/Coracelo/etc.), incluidas las 3 tablas de `harvestSourceTerrainTag`/
  `faunaTerrainTag` que tampoco existían. Efecto colateral real detectado en la propia corrección:
  `canizor` (el hueco preexistente que ya predecía esta nota) tiene una colisión de fondo con
  `buitre-cenizo` en el matcher de tolerancia a erratas (`fuzzyMatchesAnyStem`, "canizor"~"cenizo" a
  distancia de edición 2) que NINGÚN orden de tabla arregla — documentado en el propio código, junto
  a 2-3 colisiones más de la misma familia (algunas ya existían antes de hoy: cardo/roca-pilares-
  rotos, hielo-sílice/veta-hierro, etc.). El propio algoritmo de tolerancia a erratas es demasiado
  permisivo (umbral distancia ≤2 sobre palabras de 5+ letras) — pendiente de diseño propio si se
  quiere cerrar del todo, no arreglable alias por alias.

## Pendiente de código (histórico de la sesión de lore, detalle bruto por zona — ver resumen arriba)

> **RESUELTO (verificado en la auditoría de lore del 2026-08-23)** — toda la lista de abajo, zona
> por zona, ya está implementada en `worldCatalog.ts`/`worldPopulation.ts`/`crafting.ts` (mismo
> trabajo que ya resume "Pasada de código de la sesión 2026-08-21" arriba). Se deja el detalle
> bruto sin borrar como registro histórico, pero **no hace falta leerlo para saber qué falta** — lo
> que sigue genuinamente pendiente es SOLO lo que ya lista "Sigue pendiente, genuinamente aparcado"
> unas líneas más arriba (Fase 2 de Las Agujas Imán — Rocas Imanidas/Saco de Arena Imán/pérdida de
> inventario por zona —, sistema de Reino + los 22 NPC del Campamento del Clan Serhu, y el pasivo de
> los Nuentes en `combatExchange.ts`). Confirmado también por dos agentes de auditoría independientes
> (zonas Objetos y Fauna/Flora) que hicieron `grep` contra el catálogo real antes de dar por bueno
> cada ítem. **Actualización 2026-08-23**: los alias/nombres de display que esta nota SÍ dejaba
> pendientes quedaron resueltos en una auditoría lore↔código posterior el mismo día — ver la entrada
> justo arriba de esta para el detalle y el hallazgo colateral de colisiones del matcher.

- **Sesión 2026-08-21 (fauna/flora/minerales de La Hondonada del Eco, ver más abajo)** — nada de
  esto está en `worldCatalog.ts` todavía: `NpcInput` nuevos para Gesgurio (PLANTILLA, insecto
  carroñero de emboscada), Kirelon Arenoso (PLANTILLA, reptil ciego nocturno 2-4m, nivel/atributos
  altos — pensar bien su nivel dado que da acceso a Yerreo) y Ruptidar (PLANTILLA, sin loadout,
  temperamento INOFENSIVO, sin loot — terreno arenoso en general, no solo Hondonada, así que
  probablemente `faunaTerrainTag` en vez de `homeLocationSlug` fijo a `hondonada-del-eco`);
  `ItemCatalogInput` nuevos: fibra vegetal (Enredaderas de las Llanuras), mena de Yerreo, Lingote
  de Yerreo, Lingote de Hiyerro (tier 5-7, receta hierro+Yerreo+Arena Imán), trozo/pieza de quitina
  roja (Gesgurio, receta 10:1), hueso/cráneo/piel de escamas/garras de Kirelon (garras → 2 Lingote
  de Yerreo directo, requiere herrero + fragua); nuevos `HarvestYield` para las 2 fauna con loot +
  la veta de Yerreo (mineral muy escaso — cantidad baja, quizá con cooldown/probabilidad de
  aparición distinta al resto de vetas); fila(s) nuevas en `worldPopulation.ts`. Además, renombrar
  (solo documentación/lore, el `ItemCatalog` de `piedra` ya es genérico) el source
  **Corrección 2026-08-23 (auditoría de items/materiales "¿todos tienen uso?")**: el `RESUELTO` de
  arriba es cierto para los `ItemCatalogInput`/`HarvestYield` (existen, se pueden recolectar), pero
  **la receta en sí nunca se implementó** — `mena-yerreo`/`lingote-yerreo`/`lingote-hiyerro`/
  `pieza-quitina-roja` no aparecen ni una sola vez en `crafting.ts` ni en ningún otro archivo de
  `backend/src/services`/`routes` fuera de su propia definición y un test suelto. Se puede minar
  Mena de Yerreo, pero no hay forma de fundirla en Lingote de Yerreo ni de combinarlo con hierro +
  Arena Imán para Lingote de Hiyerro — la receta descrita en `items.md`/`flora-fauna.md` es pura
  prosa todavía, sin `CraftingRecipe` real detrás.
  `roca-pilares-rotos` → concepto "Piedra de las Llanuras Rojas" si se quiere reflejar también en
  el slug/comentarios del catálogo técnico (no urgente, cosmético).
- **Los Pilares Rotos (misma sesión)**: `ItemCatalogInput` nuevos para Madera de Lucre Blanco
  (tier 5-7) y Resina de Lucre Blanco (tier 4-7, `category` tipo pegamento/adhesivo); `HarvestYield`
  nuevo con `sourceSlug` propio para el árbol de Lucre Blanco (metodoObtencion TALA probablemente,
  a decidir); Enredaderas de las Llanuras reutiliza el `sourceSlug`/`ItemCatalog` ya pendiente de
  La Hondonada del Eco, solo añadir este `Location` a donde aparece (o a `harvestSourceRegion` si
  se queda a nivel de región, ver nota de diseño pendiente sobre anclaje por zona).
- **El Pozo de Cauce Viejo (misma sesión)**: `NpcInput` nuevos para Guchapos (PLANTILLA, alfa rojo
  agresivo vs. resto INOFENSIVO — pensar si eso pide 2 filas de catálogo distintas o un único
  `temperamento` con matiz solo narrativo), Lebudes (PLANTILLA, ataque con veneno que reduce
  atributos temporalmente — mismo tipo de efecto que ya usa el sistema de combate, revisar cuál) y
  Escorantes (PLANTILLA, herbívoro cauteloso). `ItemCatalogInput` nuevos: Musgo Rojo, Madera de
  Telda, Resina Telda Gris, Hojas de Telda, Piel de Guchapo, Cera Lebude, Miel Lebude (sin
  profesión de cocina que la consuma todavía — solo el ítem, no la receta), Quitina Escorante.
  `HarvestYield` nuevos para las 2 flora + loot de las 3 fauna (Guchapo reutiliza `racion-carne`
  ya existente). Musgo Rojo/Hojas de Telda/Cera Lebude son materiales de construcción para
  edificaciones orcas de tier 1/3-4 que todavía no existen como sistema — dejar el ítem listo, sin
  receta de construcción hasta que se diseñe.
- **El Cruce de las Cenizas (misma sesión)**: renombrar `Telda Húmeda` → `Telda Común` en cualquier
  sitio de código que la referencie (todavía ninguno, sigue solo en `.md` — no hay nada que migrar
  en `worldCatalog.ts` de momento). `ItemCatalogInput` nuevo: Telda Ceniza reutiliza los MISMOS
  `ItemCatalogInput` que Telda Común (madera/resina/hojas) — solo necesita su propio `HarvestYield`/
  `sourceSlug` de árbol distinto (misma especie, apariencia distinta, dos fuentes de recolección).
  `NpcInput` nuevo para Ferike (PLANTILLA, tier de loot 6-7, tener en cuenta el dimorfismo sexual —
  probablemente 2 filas de catálogo, macho con cola/maza y hembra sin cola pero con
  habilidad racial de ataque más fuerte, en vez de una sola ficha genérica). `ItemCatalogInput`
  nuevos: Piel de Ferike, Garras Ferike (tier 6-7), Melena de cola Ferike (tier 7, probabilidad de
  loot muy baja — objeto "especial"). Hueso reutiliza `hueso-ligero` (default sin confirmar del
  todo con la usuaria — decirlo si prefiere un hueso propio dado que el resto del loot es tier 6-7)
  y carne reutiliza `racion-carne`, ambos ya existentes.
- **Los Restos de Maktor (misma sesión) — RETIRADA, no adición**: quitar de `worldCatalog.ts` los
  3 `ItemCatalogInput` (Brazalete trenzado del Clan Maktor, Pañuelo de luto Serhu, Tótem de clan
  roto) y las 4 filas de `HarvestYield` con `sourceSlug: 'restos-personales-maktor'`, más su
  entrada en `harvestSourceAliases`/`harvestSourceHomeLocationSlug`/`harvestSourceRegion`/
  `harvestSourceDisplayName` (buscar `restos-personales-maktor` — 2026-08-21 confirmó que ninguno
  de los 3 ítems se usa en ningún otro sitio, seguro borrarlos del todo). Comprobar que no queda
  fila huérfana en `WorldPopulation` para este `targetSlug` tampoco. `docs/12-mundo-estructurado.md`
  § 4.3 ya tachada (no borrada) con la fecha de esta decisión.
- **El Campamento del Clan Serhu (misma sesión) — el pendiente más grande de esta ronda**:
  `ItemCatalogInput` nuevo Leche de Múrgol; nuevo oficio `cocinero-orco-llanuras` en
  `startingProfessions.ts`/`professionAbilities.ts`/`crafting.ts` (asignar `oficio` a las recetas
  ya existentes de `racion-carne-ahumada` y `racion-viaje` si las tienen, o crearlas si no) —
  **decidir si Gorhorn empieza con este oficio de serie o si SOLO se puede aprender del Maestro**
  (a diferencia del resto de `GORHORN_STARTING_PROFESSIONS`, no se mencionó que lo lleve de
  fábrica). 22 `NpcInput` nuevos en el campamento (11 oficios × Maestro/trabajador) — los 11
  Maestros PRINCIPAL con `capturablePct`/`reclutablePct` bajos o 0 a propósito; los 11 trabajadores
  PLANTILLA con esos mismos campos altos, pensados para una mecánica de "Reino" que TODAVÍA NO
  EXISTE (asignar NPC capturado/reclutado como productor pasivo de recursos) — el catálogo puede
  ir por delante, pero el propio sistema de asignación a Reino es un bloque de trabajo aparte, no
  solo llevar esto a `worldCatalog.ts`. El requisito "reputación mínima + misión" de cada Maestro
  también queda sin diseñar (qué misión, qué umbral de reputación, cómo se mide hoy la reputación
  con un clan concreto).
- **El Osario de la Manada (misma sesión)**: `ItemCatalogInput` nuevos Fragmentos de Gargantúa
  (tier 1-2) y Huesos de Gargantúa (construcción tier 1) — DISTINTOS de los ya existentes Hueso
  largo de gargantúa/Placa ósea de gargantúa, no los sustituyen (a confirmar con la usuaria si
  esto es lo que quería o si en realidad buscaba consolidar/renombrar los 2 ya existentes).
  `HarvestYield` nuevos con `metodoObtencion: RECOLECCION` (no caza, es un esqueleto ya muerto) para
  ambos. `ItemCatalogInput` nuevo Boungo (flora, seta comestible) + receta de cocinero-orco-llanuras
  para un consumible de energía tier 1 que la use. Gesgurio/Cruzavientos no necesitan `NpcInput`
  nuevo, solo aparecer en la tabla de encuentros de esta `Location` (o su `faunaTerrainTag`/región,
  según se resuelva el pendiente de diseño de anclaje por zona).
- **Las Agujas Imán (misma sesión) — el pendiente MÁS complejo de toda esta ronda, requiere
  diseño propio antes de ser solo catálogo**: `NpcInput` nuevos para Imanio (PLANTILLA, temperamento
  INOFENSIVO salvo si se le ataca, con la habilidad de desprender una extremidad desmagnetizada
  para huir — regenera en unos días) y Nuente (PLANTILLA, nocturno, `habilidadesRaciales` Succión
  vital/Onda Magnética/Vuelo errático, y un **efecto pasivo confirmado con la usuaria: -2 a la
  tirada de ataque del jugador si usa arma de hierro/metal contra él** — necesita poder consultar
  el material/`tipoArma` del arma equipada del jugador desde `combatExchange.ts` o donde se calcule
  la tirada, algo que hoy no se comprueba para ningún NPC). `ItemCatalogInput` nuevo Saco de Arena
  Imán (contenedor). Rocas Imanidas: recolectable con **calidad variable** ("cuánto flota" determina
  cuánta Arena Imán da al procesarla) — el motor no tiene hoy ningún concepto de calidad variable
  de recolección, hace falta diseñarlo (¿un roll al recolectar? ¿una etiqueta baja/media/alta en el
  propio `HarvestYield`?). Solo se puede refinar a Arena Imán FUERA de esta `Location` — necesita
  lógica de recolección/crafteo condicionada por ubicación, que tampoco existe hoy. Y el efecto más
  nuevo de todos: **entrar en esta `Location` con Arena Imán suelta en el inventario (sin Saco) hace
  que se pierda** — el motor no tiene ningún precedente de "efecto de pérdida de inventario por
  entrar en una zona concreta"; antes de tocar `worldCatalog.ts` esto necesita decidirse como
  mecánica de verdad (¿se dispara en `syncFromSave`? ¿en el primer turno tras cambiar de Location?
  ¿aviso previo al jugador o pérdida silenciosa?).
- **Los Manaderos (misma sesión)**: `NpcInput` nuevos para Jusha Esmeralda (PLANTILLA, fauna
  acuática — primer pez del catálogo, revisar si el motor de caza/pesca actual ya contempla fuentes
  `metodoObtencion` en agua o si hace falta alguna adaptación), Miruina (PLANTILLA, nocturno, caza
  en manada) y Tura Jusha (PLANTILLA, diurno, sin vuelo). Quio (PLANTILLA, INOFENSIVO, sin loot de
  combate — recolección directa de Filtro de Quio, no caza). `ItemCatalogInput` nuevos: Verdileas
  Acuáticas, Juncos Rojizos (`HarvestYield` nuevo aunque el `ItemCatalog`/flavor ya existía como
  texto suelto en `areas.md`, nunca en catálogo), Carne de Jusha (receta cocinero-orco-llanuras),
  Escama de Jusha, Piel de Miruina, Filtro de Quio, Plumas de Tura Jusha, Garra retráctil de Tura
  Jusha. Liquen del Cauce/Bulbo del Cauce (ya existentes) necesitan `Location`/región también
  ligada a `manaderos`, no solo a la corriente en general.
- **Los Pastos de la Deriva (misma sesión)**: `ItemCatalogInput` nuevos Pasto Solar (el pasto base
  de toda la región — pensar si esto reemplaza/formaliza el "pastan" ya asumido por Múrgol/
  Corredores en su lore, o se queda solo como ítem de recolección nuevo sin tocar nada existente),
  Gradias (fibra), Flor Salvatura (alquimia, varias recetas tier 2-5 del mismo ingrediente — revisar
  cuántas recetas nuevas hacen falta en `crafting.ts`), Piel/Cuerno de Cuernahoja (cuerno de hembra
  como variante de tier más alto, a decidir si es una fila de `ItemCatalog` distinta o un modificador
  sobre la misma). `NpcInput` nuevo Cuernahoja (PLANTILLA, manada, temperamento INOFENSIVO salvo
  ataque, dimorfismo sexual en `attributes`/loot igual que Ferike).
- **El Filo de las Brasas (misma sesión)**: añadir `homeLocationSlug: 'filo-de-las-brasas'` (o
  equivalente por terreno) también al Rondador de Brasas, sin quitarle su presencia general de
  campamentos en el resto de la región — no es una retirada, es una segunda ubicación.
- **El Filo de las Brasas + Las Fumarolas Negras (misma sesión)**: `ItemCatalogInput` nuevos
  Volcanita (tier 3-4), Rovalnica (construcción tier 2-4, renombrada de "Vorcanenta" — la usuaria
  la cambió al vuelo tras el aviso de colisión con Volcanita; ya no hay riesgo real de confusión
  entre las dos). Fercaneo (tier 5-6, muy escaso). `HarvestYield` de Fercaneo con probabilidad más
  alta en `fumarolas-negras` que en `filo-de-las-brasas` (misma especie de mineral, dos
  probabilidades de aparición distintas por `Location` — comprobar si el sistema de recolección ya
  soporta eso hoy o si hace falta añadirlo). Vincular también el Fercaneo a la presencia de
  Salamandra de Escoria de alguna forma narrativa/de riesgo si se quiere que "protegido por
  Salamandras" tenga peso real y no sea solo texto.
- **3 zonas de las ruinas Nabierus siguen sin `Location`** (La Ciudad Hundida, El Archivo Cegado,
  El Observatorio Roto) — contenido futuro explícito (tras un terremoto sin fecha fijada aún), no
  deben entrar al grafo hasta que se decida cuándo ocurre ese evento. Las otras 16 zonas de la
  tercera ampliación ya están implementadas (ver sesión "séptima pasada" más abajo). Cuando se
  añadan, cuelgan de `dunas-ahogadas` o `vientre-del-engano` (ver docs/13-escala-del-mundo.md §
  2.2ter).
- ~~**`npm run reindex-lore` y `npm run seed-catalog` sin correr todavía**~~ — **superado** (ver
  sesiones octava a undécima más abajo): la usuaria sí corrió `seed-catalog` con backend/DB reales
  tras esta nota, lo que permitió detectar y arreglar en vivo el bug de `iniciar-tarkor.sh` (no lo
  corría solo), el de las líneas de ruta invisibles, y el de `seed-catalog` sin `delete` de rutas
  viejas (undécima pasada). Este entorno de Claude Code sigue sin Node/DB propios, pero eso ya no
  bloquea nada: la propia usuaria cierra el ciclo de verificación jugando.
- ~~**Tono de Ulkha/Torgash frente a "la casta de Ketg"** (detectado en la sexta pasada, sin
  resolver)~~ — **RESUELTO 2026-08-23**: la usuaria confirmó dejarlo tal cual — el contraste entre
  personas razonables atrapadas en un sistema cruel es el punto, no un descuido de tono. Sus bios
  siguen describiéndolos como personalmente razonables ("fría en el cálculo y cálida en el trato",
  "prefiere pactar a duelar") pese a ser miembros confirmados de un régimen de miedo sin exilio —
  matiz deliberado, cerrado.

---

## Pendiente de dataset (acumulado, revisar antes de cerrar cada pasada)

*(Sección nueva 2026-08-11, ver `docs/ampliar-lore.md` § 1.7.)* El narrador fine-tuneado
(`docs/fine-tuning-ia-local.md`) aprendió de ejemplos generados con el lore de su momento — un
cambio de fondo en vocabulario, tono o nombres puede dejar ejemplos ya entrenados desalineados con
el mundo actual, sin que nada lo avise solo. Cuando una sesión de "ampliamos lore" cambie algo así
de notable, se anota aquí (qué cambió y desde qué sesión) — no implica regenerar el dataset de
inmediato, solo dejar constancia para cuando se decida.

- **Sesión 2026-08-23 — el cambio de vocabulario más grande desde que existe esta sección**:
  - Renombre de Semillas: "El que Brota"/"El que Nace" → **Florial**/**Ferios** (nombre propio).
  - Las 3 Semillas Perdidas sin nombre → **Nemuey**, **Biur**, **Crout**, con dominio/personalidad
    propios.
  - `Arcano` deja de describirse como "el poder salvaje nacido de Tarkor" — pasa a ser 1 de **7**
    ramas de su magia (Arcano/Elemental/Oscuro/Purificador/Naturaleza/Dominio/**Salvaje**, esta
    última nueva como concepto nombrado).
  - Lore nuevo de los orcos y la Magia: no son magos, canalizan vía Chamán (tótems/runas) — párrafo
    nuevo en `razas.md`.
  - Diseño completo (documentado, NO aplicado al motor) de 9 clases de combate y 34
    especializaciones en `clases.md` — decenas de nombres de habilidad nuevos (Grito de Guerra,
    Tótem de Guerra, Runa Ilusoria, etc.) que un futuro dataset de ejemplos de combate debería
    conocer si se entrena sobre esa vía.
  - Fauna nueva de El Margen Silencioso: **Hetris**, **Mekiosi**, **Vistue** (a desarrollar más
    adelante) y **Vaeth, el Eco de la Manada** (espíritu, no fauna cazable).

  No implica regenerar el dataset ahora — el Modelfile actual del Narrador seguirá dando la versión
  vieja de estos nombres/conceptos hasta que se decida una pasada de reentrenamiento.

---

## Pendiente de diseño (decisiones de lore/mecánica aún sin cerrar con la usuaria)

*(Sección nueva 2026-08-21.)* A diferencia de "Pendiente de código" (ya decidido, falta trasladarlo)
esto es lore/mecánica que todavía no se ha decidido cómo funciona.

- [x] ~~**Sistema de estaciones por mes/región en Helek Sirik**~~ — cerrado y APLICADO al motor
  2026-08-24, ver [rpgtarkor/estaciones.md](../rpgtarkor/lore-mundo/estaciones.md): calendario único global (120
  días/año, 30 por estación), `estacionFor`/`estacionNombreFor` en `worldClock.ts`, gate real en
  `HarvestYield.estacionRequerida` (`boungo` ya lo usa). El Kirelon Arenoso sigue narrativa pura —
  su "largos inviernos" es tasa de aparición, no un `HarvestYield.condicion`, sistema aparte sin
  diseñar (encuentros ambientales por estación).
- **Fauna/flora/recursos anclados a "Llanuras del Viento Rojo" en conjunto en vez de a zonas
  concretas** (`harvestSourceRegion`, la práctica totalidad del catálogo salvo Salamandra de
  Escoria) — señalado por la usuaria 2026-08-21 como un error de diseño ("debería ser por
  región... eso lo miramos si no en otro momento"). No es una tarea de código suelta: implica
  decidir cómo se reparte lo ya existente entre las ~26 zonas nombradas de la región antes de
  tocar nada, así que queda aquí como pendiente de diseño, no de código.
  **Evidencia real de partida (2026-08-23, revisión de partida)**: esto ya no es solo un problema
  teórico — Quio (hogar real: Los Manaderos) aparece narrado como fauna ambiental en La Hondonada
  del Eco y en el Paso de los Pilares Rotos, zonas lejanas donde no debería estar, en la partida
  real de Gorhorn. Consistente con que Quio (y la mayoría del catálogo) no tiene `faunaTerrainTag`
  propio que lo restrinja — sube la prioridad de este pendiente, ya no es solo una inconsistencia
  de diseño en abstracto, es un bug de inmersión real y confirmado jugando ("meter al gusano por
  todas partes", cita textual de la usuaria).
- **Auditoría de items/materiales sin uso** (pedida 2026-08-23, revisión completa hecha a mano tras
  fallo repetido de agentes por límite de sesión/semanal): el sistema de crafteo tiene solo 17
  `CraftingRecipe` frente a 79 materiales/recursos (`tipo: RECURSO`/`MATERIAL`) en el catálogo — 65
  de esos 79 se pueden recolectar pero ninguna receta los consume (no es un caso aislado, es escala
  de diseño: el catálogo de materiales creció mucho más rápido que las recetas). Además, **8 items
  completamente huérfanos** (cero menciones en todo `backend/src` fuera de su propia definición —
  ni receta, ni loadout de NPC, ni recolección, ni inventario inicial, ni misión): `hacha-de-mano-orca`,
  `trampa-de-lazo`, `anillo-vertebra-corredor`, `capa-piel-gargantua`, `capucha-piel-corredor`,
  `cinturon-de-trofeos`, `marca-de-clan`, `silbato-hueso-caza`.

  **Los 8 cerrados (2026-08-24, APLICADO al motor)** — ninguno se retiró, todos con uso real:
  `hacha-de-mano-orca`/`anillo-vertebra-corredor`/`capa-piel-gargantua`/`capucha-piel-corredor`/
  `cinturon-de-trofeos` con `CraftingRecipe` nueva cada uno (`crafting.ts`, herrero/curtidor
  orcos-llanuras, materiales de caza ya existentes); `trampa-de-lazo` resultó ser exactamente la
  "cuerda de captura" que el diseño de `companeros-y-supervivencia.md` inventaba desde cero —
  conectado ahí, sin item nuevo; `marca-de-clan` en el loadout de Torgash Ketg (Kort'ikar del Clan
  Serhu, portador natural del símbolo de su clan); `silbato-hueso-caza` en el loadout de Cazadora
  Serhu ("señales de caza Serhu" encaja literal). Sigue pendiente: si merece la pena diseñar más
  recetas que consuman los 65 materiales sin uso o aceptarlo como fase de contenido adelantada a su
  propia mecánica — no decidido, fuera de alcance de esta pasada (solo los 8 huérfanos exactos).
  Corrección colateral ya aplicada arriba: Yerreo/Hiyerro nunca tuvo receta real pese a que una nota
  anterior de este mismo checklist lo daba por resuelto.
- **Rebalanceo de coste de Campamento/Ayuntamiento** (pedido 2026-08-23, revisión de partida —
  "lo vemos juntas mañana", solo anotar por ahora): la usuaria jugando en vivo con `CAMPAMENTO_RECIPE`/
  `AYUNTAMIENTO_*_RECIPE` (`backend/src/services/construction.ts`) considera que:
  - **Campamento** debería costar la MITAD de recursos para construirlo. Coste actual: 20 leña
    (madera) + 10 piedra + 5 piel = 35 unidades, 3 categorías.
  - **Ayuntamiento** debería pedir MÁS recursos y de MÁS TIPOS distintos (no solo piedra+leña).
    Costes actuales: pequeño 15 piedra + 10 leña (25, 2 categorías); mediano 30 piedra + 25 leña
    (55, 2 categorías); grande 60 piedra + 50 leña + 15 mena de hierro (125, 3 categorías — el
    único de los 3 que ya varía de categoría).
  Sin decidir todavía: la fórmula exacta ni qué categorías nuevas debería pedir el Ayuntamiento
  (¿piel para el pequeño, como el Campamento? ¿madera Y piedra Y algo más específico por nivel?).
- **Oficio de agricultura de Las Llanuras, único que se aprende por misión y no por NPC**
  (detectado 2026-08-22 al añadir el Trigo Escarlata de La Sabana Alta) — la propia usuaria lo
  aparcó explícitamente hasta que exista el sistema de Reino: qué misión, qué requisitos, y cómo
  convive con el resto de oficios (todos aprendidos de un Maestro hoy). Mismo bloque de diseño que
  el sistema de "trabajador de Reino" que ya bloquea a los 22 NPC del Campamento Serhu — probable
  que ambos se resuelvan juntos cuando se diseñe el sistema de Reino de verdad.
- **Riko, "de la Manada Rota"** (detectado 2026-08-23, auditoría lore↔código de personajes no-Gorhorn)
  — el nombre de su manada de origen aparece una única vez en `personajes.md` y nunca se desarrolla:
  sin ubicación, sin qué le pasó, sin miembros. Candidato natural para un pase de identidad como el
  que se hizo hoy con Nemuey/Biur/Crout, pendiente de que la usuaria lo pida.
- **Kael Dorn ↔ Ithren, hilo atado solo por un lado** (mismo detectado 2026-08-23): `npcs.md` dice
  que Ithren es de quienes "necesitan vivo" a Kael Dorn, pero ninguno de los 3 ganchos de aventura
  propios de Ithren en `personajes.md` menciona esa conexión. No es contradicción, es un hueco de
  desarrollo — falta añadir la mención en la ficha de Ithren si se quiere cerrar el hilo.
- **Kalisar sin NPC de apoyo propio** (mismo detectado 2026-08-23): Kelife, Goirntes, Nabieus e
  Ilvenar tienen al menos un NPC de su propia raza en `npcs.md` que conecta con la trama; Kalisar
  (raza de Ithren) no tiene ninguno — único punto de contacto Kalisar en toda la doc es el propio
  Ithren. Candidato a un NPC nuevo cuando se retome lore de Vaelira.
- **Ilvenar, la raza menos desarrollada de las 5 no-núcleo** (mismo detectado 2026-08-23): un solo
  párrafo, el más corto de Kelife/Kalisar/Jusaly/Ilvenar. Confirmado que NO es lore olvidado —
  Vaelira entera sigue fuera del núcleo jugable (solo Gorhorn/Berig en producción), así que es
  esperable, no un error. Anotado por si se retoma Vaelira más adelante.

---

## Sesión 2026-08-05 — personalidad orca general + Clan Serhu

- **Personalidad y valores de la raza orca** (`razas.md` § Orcos — Hijos del Estallido, nuevo
  bloque "Personalidad y valores"): directos, paciencia corta (su mayor fuente de mala fama
  externa), rara vez mienten pero ocultan la verdad sin conflicto moral, honor/fuerza sin odio
  (buscan redención, no venganza), rango social irrelevante frente a honor/fuerza/respeto
  ganado (de ahí que las hembras, más listas y con más dotes de mando, lideren como Terk'ikar).
  Sin rencor racial general — excepto contra los Goirntes, vistos como amenaza a destruir, no raza
  a la que culpar. Único pueblo de Berig dispuesto a tratar con cualquier otra raza que muestre
  honor/fuerza/liderazgo/entereza/respeto, a diferencia del aislamiento habitual entre razas-Semilla.
  Un favor a un orco crea una deuda de honor real. Nueva frase de Kekta transmitida a los jóvenes:
  *"Un orco es fuerte y debe demostrarlo, pues solo los fuertes vencen al odio y luchan por la
  libertad."*
- **Clan Serhu, mecanismo de control Goirnte** (`areas.md` § Clan Serhu, nuevo sub-bloque "La
  casta de Ketg"): gobierno interno por miedo, no honor — desviación calculada, no espontánea.
  Envíos mensuales de armas Goirnte (de mejor factura que su propia herrería, mediocre — ver
  corrección justo abajo) usados para someter a otras tribus orcas y en incursiones contra los
  Faerus de El Margen Silencioso — explica por primera vez por qué la confianza real de los
  Faerus fue siempre con los Maktor, nunca con los Serhu (dato ya existente, sin motivo hasta
  ahora). Verificado con la usuaria: el poder desde Ketg es una **casta cerrada** con disputas
  internas (no una dinastía única sin ruptura de 64 generaciones) — Ulkha es la ganadora más
  reciente de esa disputa, no necesariamente descendiente directa de Ketg.
- **Corrección + "Oficios por clan" (mismo día, tras corrección de la usuaria)**: los Serhu SÍ
  tienen herrería propia — la frase inicial de arriba ("nunca desarrolló herrería propia") era
  incorrecta y ya está corregida en `areas.md`. Lo real: trabajan materiales que no son los
  correctos para lo que ofrece su tierra y sin la destreza necesaria, así que su propia Arena
  Imán (mineral ya existente en `flora-fauna.md`/`worldCatalog.ts`, comprada en bruto por
  herreros Goirntes) casi nunca se trabaja en casa — alimenta sin que ellos lo noten su propio
  complejo de inferioridad frente a los Goirntes. Nuevo bloque comparativo en `razas.md` §
  Orcos ("Oficios por clan"): Helsig los mejores tallando mineral (hielo sílice abundante),
  Goshg los mejores en madera (Trepadores Ocaso abundantes), Serhu/Llanuras mediocres en ambos
  pero especializados (sin ser los mejores de Berig) en desuello y peletería — coherente con
  su vida de pastoreo y caza.
- **Segunda corrección de alcance (mismo día)**: la comparativa Helsig/Goshg/Serhu de arriba es
  SOLO entre clanes orcos, nunca frente al resto de razas de Berig — ningún orco alcanza la
  sofisticación de una fragua Goirnte o un taller Ilvenar (raza más joven de Helek Sirik, nacida
  por accidente de la magia salvaje, no diseñada por una Semilla); su fuerte es la variedad de
  materiales que trabajan, no la profundidad del proceso. Los Faerus quedan fuera de esta
  jerarquía a propósito: seres instintivos sin afán de crecimiento material, rivales dignos a
  destruir con honor o aliados de los que aprender, no comparables en esta escala. Añadido al
  mismo bloque "Oficios por clan" de `razas.md`.

---

## Sesión 2026-08-05 (continuación) — historia de Gistera Koh, gobierno orco, tótems, ritos

- **Historia completa de Gistera Koh y El Orco Enfurecido** (`npcs.md` #13/#14, reescritos por
  completo — sustituyen la versión "reto a duelo de honor" del 2026-07-28): Uhuld Koh, artesano
  Serhu, la adoptó a los 10 años tras encontrarla desorientada en el desierto (origen de ella
  sigue sin revelar, a propósito). Uhuld tramaba en secreto liberar a los orcos del yugo Goirnte;
  delatado por sus propios hermanos de confianza, los Goirntes pagaron a 3 guerreros Serhu para
  matarlo. Sus últimas palabras invocan a los Maktor — es la razón real de que Gistera confíe en
  Gorhorn al reconocer el símbolo en su tótem. El Orco Enfurecido es el mismo guerrero que le dio
  el golpe de gracia a Uhuld y persigue a Gistera por su cuenta desde entonces, sin orden de nadie.
  *(Corrección tras un primer repaso: se me había quedado fuera el final — en cuanto Gorhorn
  acepta ayudarla, Gistera parte sola hacia la Ciénaga Troncal y hace amistad con el Clan Goshg;
  si la partida lleva a Gorhorn allí, puede reencontrarla y reclutarla como compañera. Ya añadido
  a `npcs.md` #13.)* Además: los otros dos guerreros se llevan el cadáver de Uhuld para hacerlo
  desaparecer — negarle el rito funerario (ni velado ni recordado) es un castigo real de la casta
  de Ketg contra quien la desafía, práctica exclusiva de los Serhu, no del resto de clanes orcos
  (`npcs.md` #13 + `areas.md` § "La casta de Ketg").
- **Tótems de clan**: corregida la definición (`razas.md` § Orcos) — un tótem es ante todo una
  insignia/bandera de costumbres y honor, no "los muertos hechos madera" sin más (esa era una
  simplificación de la versión anterior). Su uso funerario es real pero es UN uso, no el único:
  al morir un orco se quema el cuerpo y se deja un tótem en el sitio — más grande y decorado solo
  si murió con honor (duelo, cacería ritual), nunca por clase social. Reconciliado con Los
  Túmulos del Honor (`areas.md`): tótem de madera sobre montículo de piedra, no "entierro" a
  secas — arreglado el verbo que contradecía la cremación.
- **Tótem/emblema de cada clan confirmado**: Maktor = colmillo mellado con marca de garras de
  Canizor (ya establecido, solo confirmado). Serhu = cabeza de Gargantúa de Ceniza tallada
  (nuevo) — herencia compartida de antes del golpe de Ketg, frente al colmillo propio que los
  Maktor adoptaron después por el vínculo de Tevya.
- **El camino a guerrero** (`areas.md`): la cacería ritual de Corredores de Cauce a los 10 años
  decide el oficio de toda una vida — quien la supera es guerrero reconocido de adulto, quien no
  pasa a labores de clan y no se entrena para la guerra.
- **Gobierno y asamblea** (`areas.md`): los clanes orcos se rigen por una asamblea abierta a todo
  orco libre (estilo democracia/senado), con la Terk'ikar teniendo la última palabra — respetada
  porque la cultura orca asume que sus jefas son las más inteligentes y las que mejor van a velar
  por todos (no siempre cierto en la práctica). El golpe de Ketg no solo cambió quién manda en
  los Serhu: destruyó esta asamblea entera, sustituida por la casta cerrada ya documentada.
- **Frecuencia de las incursiones Serhu** (pendiente desde ayer, ahora resuelto en parte): no son
  frecuentes, ~1 cada 5 meses, forzadas por presión Goirnte, casi siempre misiones suicidas con
  poco o ningún logro real — un segundo mecanismo de control de población Serhu además del cerco
  social. Sigue sin fecha de inicio exacta (dejado a propósito).
- **Liderazgo actual de Helsig y Goshg** (`areas.md`) — **nombres confirmados por la usuaria**:
  Helsig, Terk'ikar **Brenka** + su pareja la Kort'ikar **Solgra** (ambas hembras). Goshg,
  Terk'ikar **Doshka** + su hermano menor el Kort'ikar **Dulgren**.
- **Descendencia de Krugo y Tevya** (`areas.md` § Historia profunda): tienen 5 hijos propios: la
  hija mayor continúa el linaje Maktor. Kekta muere de vieja y nombra sucesor antes de irse.
- **Cocina y dieta orca** (`razas.md`): omnívoros pero sobre todo carnívoros, ahumado/secado por
  necesidad en la llanura seca. Helsig comen aún más carne/pescado (frío exige calorías). Goshg
  comen relativamente menos de los 3 pero han desarrollado la mayor variedad de platos, gracias a
  los recursos de la ciénaga.
- **Idioma orco nombrado**: **Kektira** (en honor a Kekta) — la lengua propia de campamento/ritual
  frente al Kerost de cara a forasteros.

**Pendiente de código**: ver sección de arriba (bios de Gistera/Orco Enfurecido en
`worldCatalog.ts`; nombres de Helsig/Goshg sin ficha técnica todavía, no urgente).

**Pendiente de código**: ninguno todavía — es lore puro (razas.md/areas.md), sin tocar
`worldCatalog.ts`, `loreChunks.ts` ni ninguna cifra de `worldPopulation.ts`. Si en esta misma
sesión se acaba tocando algo con equivalente técnico (p. ej. si se decide fechar las incursiones
Serhu-Faerus en la cronología, o si se detalla más la casta de Ketg con nombres propios), añadirlo
aquí antes de cerrar.

---

## Sesión 2026-08-03 — historia orca profunda + cronología del mundo

Primera sesión con este formato. Resumen de lo escrito (detalle completo en los propios `.md`, no
repetido aquí):

- **Historia orca profunda** (`areas.md` § Los clanes orcos): los 4 primeros orcos (Kekta, Tevya,
  Megug, Kegoht) → fundación de Tarkurok/Maktor → guerra Goirnte → golpe de Ketg (nace Clan Serhu)
  → migración → fundación de Helsig (Helsa+Bregnor) y Goshg (Gosha+Dulgar) → generación del padre
  de Gorhorn → caída del Clan Maktor. Incluye la etimología Makt'orik→Maktor (el Canizor, nueva
  fauna) y el emblema del clan.
- **Historia de Gorhorn reescrita** (`personajes.md`): descartada la versión anterior (padre muerto
  al nacer Gorhorn en duelo contra Serhu, exploración a los 7, entrenamiento a los 14, Concordia a
  los 18). Nueva: padre vivo hasta los 10 años de Gorhorn, lidera revuelta, muere en la cruzada
  Goirnte que aniquila el clan; años 10-20 de Gorhorn como ayudante de comerciantes → 4 años
  esclavo Goirnte → 1 año con los Faerus → resto con Goshg/Helsig (incluye lo ya establecido de
  Hagar). Tótem Maktor redefinido como fragmento tallado por Gorhorn, cosmético, no el artefacto
  ancestral completo.
- **Torgash desvinculado** del duelo del padre de Gorhorn (`npcs.md`, `areas.md`) — pendiente en
  código, ver arriba.
- **Dos documentos nuevos de cronología**: `cronologia-mitica.md` (antes del año 0, Semillas/Tarkor/
  Formación) y `cronologia.md` (desde el año 0, con años concretos hasta el presente de Gorhorn).
  Enlazados desde el pie de página de todo el lore.
- **Escala temporal ajustada dos veces** tras revisión de plausibilidad:
  - Población Tarkurok/Maktor: 200→800 años para llegar a 5.000 (la tasa a 200 años era ~3,6%/año,
    absurda; a 800 años, ~0,9%/año).
  - Adaptación física Helsig/Goshg: 500→1.000 años (28→56 generaciones orcas; se sostiene con que
    la magia salvaje acelera la biología orca, ya sugerido por el propio canon de piel-por-región).
  - Año de arranque de la partida de Gorhorn, resultado final: **4.010** (no 2.910 ni 3.510 —
    versiones intermedias durante la misma sesión).
- **Escala de creación del mundo** (`cronologia-mitica.md`, `genesis.md` § Madre): el ancla "Madre
  crea las Semillas" subió de −10.000 a −500.000.000 (escala planetaria real) y luego bajó a
  **−200.000.000** (el poder de las Semillas acelera la formación activa del mundo, no hace falta
  el tiempo "natural" completo). Tema nuevo explícito: Madre lleva presente solo una fracción
  mínima de la vida real del planeta y no sabe qué hay más allá de su propia creación — conecta con
  la Entidad Desconocida ya existente.
- **Ritmo de crecimiento del Clan Serhu explicado narrativamente** (`areas.md`): el número ya
  sembrado en `worldPopulation.ts` (800, no inventado en esta sesión) ya cuadraba con una tasa ~3x
  más lenta que Goshg/Helsig — se escribió el porqué (cerco social Goirnte, sin alianzas ni
  contacto exterior) en vez de tocar la cifra. De paso, nueva relación histórica Faerus↔Maktor (no
  Faerus↔Serhu) que explica por qué Gorhorn conectó con los Faerus en su juventud.

Ver memoria `tarkor_auditoria_lore_mapa_2026-08-03` y siguientes del mismo hilo para más contexto
de sesión (aunque esa memoria es de la auditoría de mapa previa, no de esta ampliación de lore).

---

## Pasada de código de la sesión 2026-08-03 (mismo día)

Los 5 pendientes de arriba, llevados a código el mismo día en vez de quedar para otra sesión:

- **Torgash** (`worldCatalog.ts`): bio reescrita sin el duelo, con la culpa por la inacción Serhu.
  Mismo ajuste en un comentario suelto de `orco-enfurecido-hondonada` que citaba el viejo ejemplo.
- **`loreChunks.ts`**: 3 chunks reescritos (cultura/liderazgo orco, Clan Maktor, Clan Serhu, Torgash
  — 4 en total) + `npm run reindex-lore` (50/50 chunks, sin errores).
- **Canizor**: entrada completa en `worldCatalog.ts` (PLANTILLA, nivel 1-4, `domesticablePct` 45/
  `capturablePct` 20, `temperamento: CAUTELOSO` — no `AGRESIVO`, para no bloquear la doma con
  combate forzado), item nuevo `piel-canizor`, 3 harvest yields, y fila en `worldPopulation.ts`
  (200/320, población baja a propósito por ser solitario/territorial). Confirmado que se integra
  solo en encuentros ambientales (`turnResolution.ts` ya consulta `Npc` PLANTILLA + `WorldPopulation`
  por región de forma genérica, sin lista fija que tocar).
- **Tótem Maktor**: verificado en DB (`ItemCatalog.statBonusAttribute`/`statBonusAmount` ambos
  null) — ya era puramente cosmético, no hizo falta ningún cambio.
- **`worldPopulation.ts`, `orcos-llanuras`**: label corregido de "Maktor/Serhu" a "Clan Serhu"
  (el número 800/1.000 no cambia, ya era correcto).

Verificado: `tsc --noEmit` limpio, `npm run seed-catalog` (103 objetos, 25 NPCs, 53 recursos, 19
poblaciones), `vitest run` → **518/518 tests, 51 archivos**, incluidos los 2 que llevaban semanas
fallando de forma intermitente en `turn.integration.test.ts` (ahora también en verde).

---

## Sesión 2026-08-05 (tercera pasada) — Signeran, Kurig, pintura, el plan de Uhuld

- **El Signeran** (`razas.md` § Orcos): el duelo de honor formal tiene nombre y reglas propias —
  sin armadura, solo hacha orca simple, a muerte (dejar vivo al perdedor es deshonra para los
  dos). Tres vías dan derecho a un Signeran: autorización de la asamblea, descendencia directa de
  un jefe de tribu o de guerra, o el propio líder de la tribu retando a otro cuando su honor exige
  defensa (**corregido** — no es que el líder retado decida aceptar: es el líder quien reta,
  quedando a quien recibe el reto aceptar o no). No es un cauce para cualquier disputa personal,
  es el mecanismo real para retar la legitimidad de un liderazgo.
  **Corrección sobre lo escrito antes**: el tamaño del tótem funerario NO lo decide morir en
  duelo/cacería — lo decide el juicio posterior de la propia tribu sobre si esa vida mereció
  honor. Ya corregido en `razas.md`.
- **Pintura de clan** (`razas.md`): solo importa el color, no la forma — rojo Maktor, naranja
  casi marrón Serhu, verde oscuro Goshg, azul muy claro con blanco Helsig.
- **Los Kurig** (`areas.md` § Gobierno y asamblea): cada Terk'ikar designa 5 Kurig (rango de los
  más inteligentes) — uno por justicia/economía/diplomacia/logística/filosofía. No deciden, filtran
  qué llega a la asamblea y registran la información de su área. La justicia sigue este cauce
  según la gravedad del caso.
- **El plan real de Uhuld Koh y el secreto de Gorhorn** (`npcs.md` #13, `personajes.md` § Gorhorn
  — el hallazgo más importante de la sesión): Uhuld no tramaba una revuelta cualquiera — buscaba
  a un descendiente de "sangre fundadora" con derecho real a un Signeran contra la casta de Ketg.
  Ese descendiente era Gorhorn (por Krugo y Tevya), sin que ni Uhuld ni el propio Gorhorn lo
  supieran nunca. Anotado como secreto reservado en la ficha de Gorhorn, solo para el Narrador —
  gancho de muy largo recorrido, no para resolver en una sola partida.
- **Ulkha y Torgash confirmados como descendientes de Ketg** (`areas.md` § La casta de Ketg) — ya
  no queda "no necesariamente descendiente directa", están dentro de la casta de nacimiento.
- **Corrección de las incursiones Serhu** (`areas.md`): no es "cada 5 meses" por calendario — los
  Goirntes emiten la orden cuando la población Serhu crece, y el mismo mecanismo se usa contra
  TODOS los orcos de Berig, no solo contra los Serhu (que además hacen de brazo ejecutor sin
  verlo así).
- **Postura de Helsig/Goshg ante la guerra, resuelta** (`areas.md`): perfil neutral-defensivo,
  bajo perfil ante los Goirntes; han resistido bien hasta ahora, pero los Goirntes les mandan cada
  vez menos patrullas propias, cediendo esa labor a los Serhu (mismo mecanismo de arriba).

**Pendiente de código** (añadido a la sección de arriba): las bios de `worldCatalog.ts` para
Gistera/Orco Enfurecido ahora también deberían reflejar el plan de Uhuld si se reescriben — no
hace falta que citen el secreto de Gorhorn (eso es solo para el Narrador/lore, nunca debería
filtrarse a texto que el jugador pueda leer directo).

---

## Sesión 2026-08-05 (cuarta pasada) — asamblea, casta sin exilio, y "el primer golpe" Maktor

- **Quién se sienta en la asamblea + los 4 ayudantes de cada Kurig** (`areas.md`): Terk'ikar,
  Kort'ikar, los 5 Kurig, y cualquier orco que los Kurig consideren relacionado con el tema del
  día — cámara no fija, se completa según lo que haya que tratar.
- **La casta de Ketg no exilia** (`areas.md`): solo dos caminos para quien la desafía — quedarse
  y resignarse, o morir y desaparecer. Confirmado explícitamente: es una dictadura de verdad
  (rango social y sangre por encima de todo), no una asamblea corrompida a medias.
- **Corrección del Signeran** (`razas.md`): la tercera vía no es "el líder retado decide
  aceptar" — es el líder de la tribu quien reta a otro cuando su honor exige defensa, y es el
  retado quien acepta o no. Ya corregido.
- **"El primer golpe" — la guerra interna Maktor-Serhu y los 1.200 guerreros** (`areas.md` §
  Historia profunda + `cronologia.md`, ~año 2.900-2.950, provisional; el hallazgo más grande de
  esta pasada): la cultura Maktor originaria —pacífica, orgullosa, respetuosa con la naturaleza,
  estilo "Tauren" pero con esa parte salvaje que los empuja a demostrar su valía— libra una larga
  guerra interna contra los Serhu (la misma que ya empujaba la migración a Cristal Helado/Ciénaga
  Troncal). Los Maktor ganan un Signeran final, el Kort'ikar Maktor perdona la vida al líder
  Serhu vencido —el mayor error del clan— y confían en que baste para acabar la guerra. La casta
  de Ketg traiciona esa confianza informando a los Goirntes, que mandan 1.200 guerreros contra lo
  que queda del clan. **No es el mismo suceso que la revuelta del padre de Gorhorn** (año 4.000,
  confirmado con la usuaria) — es un golpe anterior y distinto, que no extingue a los Maktor pero
  los deja "maltrechos" durante el milenio siguiente. Explica, por primera vez, por qué el texto
  ya llamaba "maltrecho" al clan justo antes de la revuelta final.
- **Nombres puestos** (mismo día, a petición de la usuaria): el Kort'ikar Maktor que gana el
  Signeran es **Kadrog**; el líder Serhu al que vence y perdona la vida es **Mordek** (sucesor de
  Ketg dentro de la casta). Ya en `areas.md` § Historia profunda y en `cronologia.md`.

---

## Sesión 2026-08-05 (quinta pasada) — el Reino Nabierus y 19 zonas nuevas de las Llanuras

Cierre del lore orco (confirmado con la usuaria que los huecos restantes eran menores) y salto al
mapa regional de Las Llanuras del Viento Rojo: primero rutas/topología (sin cambios de código,
solo confirmación de que el grafo disperso ya fuerza rodeos — ver "Pendiente de código" para el
resto), después expansión real del mapa con zonas nuevas.

- **El Reino Nabierus y el origen del nombre de la región** (`cronologia-mitica.md`, nueva
  sección; `areas.md` § "Antes de los orcos"; `razas.md` § Nabieus, nuevo bloque "El Reino
  perdido" — el hallazgo más grande de esta pasada): mucho antes del año 0, un reino Nabierus se
  alzó en lo que hoy son Las Llanuras, volcado en investigar más de lo que a Madre le convenía —
  qué descubrieron exactamente queda deliberadamente sin resolver, gancho abierto para el futuro.
  Madre no ataca de forma directa: engaña a sus propias Semillas, que sin saberlo desatan sequía y
  viento hasta enterrar el reino bajo la arena roja que ellas mismas levantan. Los supervivientes
  huyen hacia El Margen Silencioso y, generaciones después, Ciénaga Troncal — antepasados directos
  de los Nabieus de hoy, y origen real de su cultura del silencio (antes de, no en vez de, la
  persecución Goirnte del Yugo de Hierro, que sigue en pie tal cual). La tierra queda desierta y
  muerta hasta que el Estallido y la gestación de los primeros orcos le devuelven vida —una nueva,
  no la original— y el viento, ya muy diluido de lo que fue, es el que da nombre a la región:
  **Las Llanuras del Viento Rojo**. Explica de una vez el color de la tierra, el nombre de la
  región y por qué el desierto ya estaba ahí cuando aparecieron los cuatro primeros orcos.
- **19 zonas nuevas, "Puntos de interés — Llanuras del Viento Rojo"** (`areas.md`, nuevo bloque
  "Tercera ampliación"): de una lista inicial de 20 candidatas presentadas por categoría (sabana,
  fosa de Espina del Viento, costa/playas, puesto Serhu de pesca, ruinas Nabierus, varias más), la
  usuaria las aprobó todas con dos ajustes — fusionar la Necrópolis de Arena dentro de La Ciudad
  Hundida (no tiene sentido como zona aparte sin gente viviendo cerca), y fusionar El Ojo de la
  Tormenta con el punto de origen del engaño de Madre en una sola zona, **El Vientre del Engaño**.
  De las 3 zonas de ruinas propiamente dichas (La Ciudad Hundida, El Archivo Cegado, El
  Observatorio Roto), solo quedan 2 accesibles hoy en superficie (Las Dunas Ahogadas, fragmentos
  sueltos; El Vientre del Engaño) — las otras 3 son contenido **futuro explícito**: un terremoto
  global (fecha sin fijar, provisionalmente ~10 años después del año 4.010 de arranque) abrirá
  grietas reales hacia la ciudad enterrada. Motivo de la usuaria: "la ciudad está muy profunda...
  el objetivo de Madre era ocultar lo que descubrieron" — hoy casi no hay rastro a propósito.
- **Ninguna de las 19 zonas está todavía en el grafo de viaje ni en el mapa visual** — ver
  "Pendiente de código" arriba. Solo son lore por ahora, tal y como pidió la usuaria ("lo
  implementas de forma más detallada en los md" — nada de código en esta pasada).

---

## Sesión 2026-08-05 (sexta pasada) — auditoría lore↔código, primera pasada de traslado

Petición explícita: "revisa los md y actualiza y contrasta con el código... asegúrate de que el
traslado es correcto". Auditoría de `backend/src/scripts/worldCatalog.ts` (2.959 líneas: locations,
locationLinks, npcs, fauna, items, harvestYields), `worldPopulation.ts` y
`backend/src/scripts/loreChunks.ts` (fragmentos RAG que alimentan al Narrador en vivo) contra los
`.md` de `docs/rpgtarkor/`. Sin acceso a Node/DB en este entorno — no se pudo correr
`tsc --noEmit`, `npm run seed-catalog`, `npm run reindex-lore` ni `vitest`; verificado solo por
lectura y comprobación manual de llaves/paréntesis balanceados en los archivos tocados.

- **Bios de `gistera-koh` y `orco-enfurecido-hondonada` reescritas** (`worldCatalog.ts`) — tenían
  la historia antigua (reto a duelo de honor rechazado) pese a que npcs.md #13/#14 la sustituyó
  por completo el 2026-08-05 (Uhuld Koh, el encargo Goirnte, la trampa). Ahora coinciden.
- **Nombres de líderes Helsig/Goshg añadidos a sus asentamientos** (`worldCatalog.ts`,
  `veta-helada` y `cerco-de-los-pilotes`): Terk'ikar Brenka/Kort'ikar Solgra y Terk'ikar
  Doshka/Kort'ikar Dulgren, ya confirmados en `areas.md` pero ausentes del catálogo.
  Deliberadamente sin NpcState propio todavía (ver "Pendiente de código").
- **Nueva `Location` `jeyselt`** (`worldCatalog.ts`, región Ciénaga Troncal): el poblado Nabieus
  del sur de la ciénaga (Keseg Prisilke / Fin Susurrado) ya vivía en `areas.md` desde antes de
  esta sesión de lore pero nunca había llegado al catálogo — `territorios-clan-goshg` también
  actualizado para mencionarlo, en vez de dar a entender que solo hay orcos en la región.
  Sin `locationLink` (fuera del núcleo jugable, mismo criterio que Hashma/Kegi).
- **`loreChunks.ts` puesto al día** (hallazgo más importante de la pasada: era el mayor foco de
  desincronización real, porque alimenta directamente al Narrador vía RAG, no solo la Enciclopedia)
  — añadidos: El Reino Nabierus/origen del nombre de la región, El Signeran, Personalidad y
  valores orcos, Tótems y rito funerario, Gistera Koh + Uhuld Koh, El Orco Enfurecido (los dos
  últimos no existían en absoluto pese a ser el encuentro del primer turno). Actualizados: Cultura
  y liderazgo (Kurig/asamblea), Clan Maktor (los dos golpes, Kadrog/Mordek), Clan Serhu (la casta
  de Ketg), Clan Helsig/Goshg (nombres de líderes).
- **`worldPopulation.ts` revisado, sin cambios** — el label de `orcos-llanuras` ya se había
  corregido en una pasada anterior; el resto de labels siguen alineados con `areas.md`.
- **19 zonas nuevas y su topología de rutas siguen sin trasladar** — confirmado como fuera de
  alcance de esta pasada (ver "Pendiente de código"), es un bloque de trabajo propio.

---

## Sesión 2026-08-05 (séptima pasada) — topología de rutas y traslado a código de las 16 zonas

Cierre del bloque pendiente de la sexta pasada: topología de rutas confirmada con la usuaria
(cadenas de un único cuello de botella por zona nueva, sin línea recta posible desde el núcleo) y
las 16 zonas ya triangulables trasladadas a código — solo quedan fuera las 3 zonas futuras del
terremoto (sin fecha, sin arista que triangular todavía).

- **Topología** (propuesta y aprobada tal cual): 4 cadenas + 2 sueltas, cada una colgada de un
  único nodo del núcleo ya existente — río hacia el mar (Los Manaderos → Oasis → Desembocadura →
  abanico costero de 4 puntos), desierto profundo (Las Agujas Imán → Fosa → Dunas → Vientre →
  Laberinto), volcánico (El Filo de las Brasas → Fumarolas), sabana (Los Pastos de la Deriva →
  Paso de los Huesos → Sabana Alta), más Vergel de Kegi (desde El Cruce de las Cenizas) y Grieta
  Cantora/Campo Yermo (desde El Osario de la Manada / Los Restos de Maktor). Ninguna arista nueva
  toca los 12 nodos originales entre sí — solo añade ramas nuevas.
- **`backend/src/scripts/worldCatalog.ts`**: 16 `Location` nuevas + 16 `locationLinks` (minutos,
  terreno, riesgo — mismo método 5 km/h/sinuosidad 1,1 que el resto del grafo). Verificado a mano:
  sin slugs duplicados, sin referencias colgantes en `locationLinks`, llaves/paréntesis
  balanceados (el desbalance de 1 paréntesis de todo el archivo es preexistente, no de esta
  pasada — confirmado no cambia entre antes/después de estos edits).
- **`frontend/src/data/map.ts`**: 16 nodos visuales nuevos. El Vergel de Kegi y La Grieta Cantora
  cuelgan de la posición VISUAL de sus padres (El Cruce de las Cenizas, El Osario de la Manada) en
  vez de la mecánica, mismo criterio ya establecido para el propio Cruce — el resto usa la misma
  coordenada que su tabla mecánica, sin ajuste visual propio (igual que Pastos de la
  Deriva/Filo de las Brasas).
- **`docs/13-escala-del-mundo.md` § 2.2ter**: tabla de coordenadas nueva, mismo formato que §
  2.2bis, con nota explícita del desacople visual de Vergel/Grieta.
- **Sin verificación en ejecución real** (ver "Pendiente de código" arriba) — este entorno no
  tiene Node/DB. `npm run seed-catalog`, `npm run reindex-lore`, `tsc -b` (frontend), `tsc
  --noEmit` (backend) y `vitest run` quedan pendientes de correr con el backend arrancado.
- **Bug de infraestructura real, encontrado jugando**: las 16 zonas nuevas no aparecían en el
  mapa tras esta pasada — `seed-catalog` nunca se corría solo, ni al arrancar ni en ningún otro
  momento automático, así que el catálogo de la partida real llevaba varias sesiones de lore
  desincronizado de `worldCatalog.ts` sin que nadie lo notara hasta que faltó contenido visible.
  Arreglado: `iniciar-tarkor.sh`/`.bat` ahora corren `npm run seed-catalog` solos en cada arranque
  (idempotente, rápido, sin Ollama de por medio). Además, `actualizar-mundo.sh` (nuevo, raíz del
  repo) corre `seed-catalog` + `reindex-lore` juntos bajo demanda, para cuando cambie
  `loreChunks.ts` de verdad — ese sí es lento (embeddings) y no conviene forzarlo en cada arranque
  normal. `docs/15-instalacion.md` § 5 y § 7 actualizados a juego.

---

## Sesión 2026-08-05 (octava pasada) — calibración visual de las 16 zonas, una a una

Con `seed-catalog` corriendo solo (séptima pasada), las 16 zonas aparecieron en el mapa pero mal
colocadas — los deltas triangulados matemáticamente (5 km/h, sinuosidad 1,1) no se habían
verificado contra la forma real del polígono de Azgaar, y varios nodos caían fuera de la región
(sobre todo la cadena del desierto profundo, muy al oeste). Sin `rsvg-convert`/Node en este
entorno para repetir el proceso de verificación que se usó para El Cruce de las Cenizas en su día,
se hizo a mano: quitados los 16 del mapa, añadidos y ajustados de uno en uno contra capturas
reales que compartió la usuaria, cada uno confirmado antes de pasar al siguiente.

- **Las 16 posiciones visuales de `frontend/src/data/map.ts` quedan recalibradas y confirmadas**
  — todas decoupleadas de su distancia triangulada real, mismo criterio que ya regía El Cruce de
  las Cenizas: son solo dibujo, los tiempos de viaje reales no cambian (siguen en
  `LocationLink`/`worldCatalog.ts`, sin tocar en esta pasada).
- **La tabla de `docs/13-escala-del-mundo.md` § 2.2ter queda desactualizada a propósito** — documenta
  la triangulación mecánica original, no el ajuste visual final a mano (mismo motivo por el que la
  nota del Cruce nunca reescribió su propia fila de esa tabla).
- **Lección para la próxima ampliación del mapa**: triangular matemáticamente da coordenadas
  mecánicamente consistentes, pero NO garantiza que caigan dentro del polígono real dibujado en
  Azgaar (que es irregular, no un rectángulo) — sin herramientas de renderizado en este entorno,
  la única vía fiable es calibrar a mano contra capturas reales, zona a zona, en vez de intentar
  acertar la geometría a ciegas de una vez.

---

## Sesión 2026-08-05 (novena pasada) — bug real: las líneas de ruta llevaban invisibles siempre

Al pedir que se dibujaran líneas de ruta en el mapa, encontrado un bug preexistente (no causado
por las zonas nuevas): tanto `InteractiveMap.tsx` como `MapZoomModal.tsx` ya dibujaban las
`<line>` de cada `LocationLink` con las coordenadas correctas, pero con
`stroke="var(--color-iron-600)"` — esa variable CSS **no existe** en `index.css` (solo
`--color-iron-700/800/900`), así que el stroke era inválido y la línea, invisible. Llevaba así
desde que se construyó la función, para los 12 nodos originales también, no solo los nuevos.
Arreglado en ambos archivos: `stroke="var(--color-wood-300)"` (color ya definido, usado en el
resto del mapa para líneas — buen contraste contra el fondo marrón). Sin verificación visual real
en este entorno (sin navegador) — pendiente de que la usuaria lo confirme en su próxima recarga.

---

## Sesión 2026-08-05 (décima pasada) — replanteo de la topología según posiciones reales confirmadas

Con las líneas de ruta ya visibles, la usuaria detectó que varias cruzaban el mapa sin sentido —
consecuencia directa de haber diseñado la topología ANTES de calibrar las posiciones visuales
reales (novena/octava pasada). Recalculadas las distancias reales entre TODOS los nodos (no solo
el padre asignado a ciegas originalmente) para encontrar la conexión geométricamente correcta.

- **La Grieta Cantora, reenganchada** (`worldCatalog.ts`): colgaba de El Osario de la Manada (en
  el núcleo, distancia real ~112 unidades) — tras confirmar su posición quedó junto a El Cruce de
  las Cenizas (~46 unidades). Reenganchada a El Cruce.
- **La costa, de abanico a cadena** (`worldCatalog.ts`): Playa/Pozas/Acantilados/Embarcadero
  colgaban las 4 directamente de La Desembocadura Callada, todas volviendo al mismo punto — pero
  las 4 están mucho más cerca entre sí que de la Desembocadura. Nueva cadena: Desembocadura → Pozas
  de Marea → (Playa de Ceniza Blanca / Acantilados Partidos → Embarcadero de Ceniza). Responde
  también a la pregunta de la usuaria de por qué la costa no se comunicaba consigo misma.
- **La Desembocadura Callada sigue en recalibración visual** (pendiente en esta misma pasada,
  última posición sin confirmar: -2, 42) — sus hijos de costa (arriba) ya asumen su cadena nueva
  independientemente de dónde acabe exactamente ella.
- Sin verificar en ejecución real (mismo motivo de siempre: sin Node/DB en este entorno) — revisado
  a mano que no quedan referencias colgantes ni aristas duplicadas tras el replanteo (34 aristas en
  total, igual que antes: 3 quitadas del abanico de costa + 3 añadidas en cadena).

---

## Sesión 2026-08-05 (undécima pasada) — bug real: `seed-catalog` nunca borraba rutas viejas + minutos recalculados

- **Bug real, encontrado jugando**: la usuaria vio una línea fantasma Desembocadura↔Restos de
  Maktor que no existía en `worldCatalog.ts` — `seed-catalog.ts` hacía `upsert` de cada
  `LocationLink` pero nunca `delete` de las que se quitan del código al reestructurar rutas (las 3
  del abanico de costa + `osario→grieta`, todas de la décima pasada, se habían quedado vivas en la
  DB). Arreglado: `seed-catalog.ts` ahora borra todas las `LocationLink` del mundo antes de
  recrearlas (mismo patrón "borra y recrea" que ya usaba `harvestYield`). Requiere volver a correr
  `npm run seed-catalog` para que se limpien las filas fantasma ya sembradas.
- **Minutos de las 16 aristas nuevas, recalculados por segunda vez** — con las 16 posiciones
  visuales ya confirmadas de verdad (décima pasada), se calculó la distancia recta real entre cada
  par y se encontraron varias inversiones (un punto más lejano costando menos que uno más cercano)
  — regla explícita de la usuaria: "los tiempos se mantienen siempre que la distancia tenga
  sentido... lo que no puede ser es que un punto del otro extremo nos lleve menos que uno que está
  más cerca y viceversa". Todas corregidas en `worldCatalog.ts`; la más notable, El Cruce de las
  Cenizas → La Grieta Cantora pasó de 150 a 320 minutos (era la arista más larga de toda la
  ampliación — 46 km reales — pero tenía de los minutos más bajos).
- **`docs/13-escala-del-mundo.md` § 2.2ter reescrita del todo** — ya no es la triangulación a
  ciegas original (superseded), ahora documenta las coordenadas VISUALES reales confirmadas
  (iguales a `map.ts`, sin desacople para estas 16 zonas) y los minutos ya corregidos, con el
  historial de las 3 versiones por las que pasó esta tabla en la misma sesión.

---

## Sesión 2026-08-21 (duodécima pasada) — fauna/flora/minerales de La Hondonada del Eco, primera zona de un repaso región por región

Arranque de un repaso sistemático "1 a 1" de las zonas de Las Llanuras del Viento Rojo (motivado
por necesitar fauna/flora/recursos de tier alto antes de poder justificar objetos de tier alto) —
esta pasada cubre solo la primera zona, La Hondonada del Eco; el resto queda para sesiones
siguientes con el mismo formato.

- **Piedra de las Llanuras Rojas** (mineral, renombrado — antes conceptualmente "de los Pilares
  Rotos"): mismo material de siempre, solo se corrige que no es exclusivo de un punto.
- **Enredaderas de las Llanuras** (flora nueva): fibra vegetal, crafteo tier 1-2.
- **Yerreo** (mineral nuevo, muy escaso): veta rojiza/anaranjada, mena → Lingote de Yerreo; con
  hierro + Arena Imán da **Lingote de Hiyerro**, la mejor aleación orca de la región (armas tier
  5-7). Confirmado con la usuaria: además de minar la veta (rarísima), las garras del Kirelon
  Arenoso se funden directo en 2 Lingotes de Yerreo si el cazador es herrero con fragua a mano.
- **Gesgurio** (fauna nueva): insecto carroñero de emboscada, camuflado contra las paredes de
  arcilla de la Hondonada — sigue de lejos a moribundos/convalecientes. Loot: quitina roja.
- **Kirelon Arenoso** (fauna nueva, la más peligrosa de las tres): reptil ciego de 2-4m, caza por
  vibración, solo emerge de noche o con temperaturas bajas. Convierte la Hondonada en zona segura
  de día, real amenaza de noche. Loot: hueso, cráneo, piel, garras (ver Yerreo arriba).
- **Ruptidar** (fauna nueva, ambiental): reptil serpentiforme inofensivo de 30-60cm, "limpiador"
  de materia orgánica en CUALQUIER zona arenosa de la región, no solo la Hondonada — sin material
  de caza ni amenaza. Primer caso real de fauna anclada por terreno en vez de por región completa.
- **Actualización 2026-08-24**: el sistema de estaciones ya existe (ver
  [rpgtarkor/estaciones.md](../rpgtarkor/lore-mundo/estaciones.md)), pero el condicional "o en los largos
  inviernos" del Kirelon sigue como narrativa pura — es tasa de APARICIÓN, no un
  `HarvestYield.condicion` (sus 4 filas de loot no llevan ninguna condición de estación), así que
  no había nada mecánico que conectar aquí sin diseñar antes encuentros ambientales por estación.
- **Hallazgo de la usuaria, sin resolver esta sesión**: casi toda la fauna/flora/recursos ya
  existentes de la región están anclados a "Llanuras del Viento Rojo" en conjunto
  (`harvestSourceRegion`) en vez de a zonas concretas — considerado un error de diseño a revisar
  más adelante, no en esta pasada (ver "Pendiente de diseño" arriba).

**Pendiente de código**: ver entrada nueva en la sección de arriba (`worldCatalog.ts`: 3 `NpcInput`,
varios `ItemCatalogInput`, `HarvestYield` nuevos, filas de `WorldPopulation`).

**Segunda zona: Los Pilares Rotos**

- **Lucre Blanco** (flora nueva): árboles de 5-10m en las cumbres, dan la sombra donde de verdad
  anidan los Cruzavientos (ya establecido desde antes de esta pasada). Madera tier 5-7, Resina
  tier 4-7 (pegamento resistente) — segunda pareja de recursos de tier alto de esta sesión, esta
  vez de madera/resina en vez de mineral (Yerreo/Hiyerro de la Hondonada).
  - **Segunda vía de tier alto confirmada en esta pasada**: no todo el contenido de tier 5-7 tiene
    que salir de minerales — variedad real de rutas de crafteo.
- **Enredaderas de las Llanuras reutilizadas** en la base en sombra de los pilares — mismo recurso
  que en La Hondonada del Eco, no una variante nueva.
- **Sin fauna propia, a propósito**: zona de paso; el Cruzavientos reside pero caza lejos (vuela
  zonas enormes), no cuenta como fauna "de aquí" en el mismo sentido que Gesgurio/Kirelon en la
  Hondonada.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Tercera zona: El Pozo de Cauce Viejo**

- **Musgo Arcilla + Telda Común** (flora nueva, Telda renombrada más tarde en esta misma sesión —
  antes "Telda Húmeda", ver zona 4): Musgo Rojo (construcción tier 1) y tres recursos de Telda
  (madera tier 1-2, resina tier 2-3, hojas de construcción tier 1) — cubren tiers bajos que apenas
  existían en el catálogo hasta esta sesión.
- **Guchapos** (fauna nueva): sapos gigantes de 120-210cm, inofensivos salvo el alfa rojo de cada
  grupo. Piel tier 3, carne reutiliza `racion-carne` ya existente (confirmado que no hacía falta
  ítem nuevo).
- **Lebudes y Escorantes** (fauna nueva, cadena trófica propia): Lebudes (avispa-luciérnaga
  venenosa en colmena, veneno no letal que reduce stats un 50% temporalmente) cazan Escorantes
  (escarabajo acorazado, come Musgo Arcilla — confirmado con la usuaria tras preguntarlo, cierra
  el ecosistema del lugar) con bajas reales en la manada a cambio de un botín grande para la
  colmena. Cera/Miel de colmena (construcción tier 3-4 / futura cocina) y Quitina Escorante
  (tier 2-4).
- **Primer ecosistema de charca completo de la región** — más denso que las dos zonas anteriores a
  propósito: es el único punto de agua permanente del núcleo, justifica mayor biodiversidad que el
  resto.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Cuarta zona: El Cruce de las Cenizas**

- **Telda Ceniza** (variante nueva de Telda, misma especie/recursos/tiers que la Telda Común de
  El Pozo de Cauce Viejo, solo apariencia distinta) marca visualmente la frontera con la selva.
  **Telda Húmeda renombrada a Telda Común** en el mismo movimiento, para dejar sitio al nombre de
  variante ("Ceniza") sin ambigüedad.
- **Fauna dividida por lado, a propósito**: lado llanura = solo fauna de paso ya existente
  (Corredores de Cauce, Buitres Cenizos), sin nada nuevo. Lado selva = **Ferikes**, depredador
  ágil de 1,5-3m que solo teme a los Faerus — dimorfismo sexual real (machos con cola-maza
  usada también en cortejo; hembras sin cola pero alfas/cazadoras del grupo, dientes y garras más
  fuertes). Mismo patrón de liderazgo femenino que ya tiene la cultura orca (Terk'ikar), extendido
  aquí a la fauna sin que se pidiera explícitamente — coherencia de tono, no una regla impuesta.
  Loot: Piel/Garras Ferike (tier 6-7), Melena de cola Ferike (tier 7, probabilidad de loot muy
  baja — objeto especial para el crafteo de mayor calidad de ese tier). Hueso/carne reutilizan
  ítems ya existentes (`hueso-ligero`, `racion-carne`).

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Quinta zona: Los Restos de Maktor — la primera retirada de contenido de esta ronda**

- La usuaria corrigió los 3 objetos de recuerdo ya existentes (Brazalete trenzado del Clan Maktor,
  Pañuelo de luto Serhu, Tótem de clan roto) por no encajar con una zona verdaderamente muerta —
  "los restos oxidados son inservibles... solo el viejo recuerdo de lo que pudo ser". Zona sin
  recursos ni fauna/flora, a propósito: agrietada, atormentada por tormentas de arena, sin vida.
  Un evento futuro sin fecha desbloqueará cambios reales — hasta entonces se queda tal cual.
- **Contradicción real detectada y resuelta con la usuaria antes de tocar nada** (mismo patrón del
  runbook): el Tótem de clan roto era el disparador documentado del gancho de aventura "Un Maktor
  superviviente inesperado" (`docs/12-mundo-estructurado.md` § 4.3, `personajes.md` § Ganchos de
  aventura) y ya había aparecido en una partida real jugada (`docs/revisar-partida-hallazgos.md`).
  Preguntado antes de decidir — la usuaria eligió quitar los 3 sin excepción; el gancho sigue vivo
  solo por rumor/diálogo de NPC, nunca por objeto físico. Fila de `docs/12-mundo-estructurado.md`
  tachada con fecha, no borrada (regla del propio runbook de lore).

**Pendiente de código**: ver entrada nueva en la sección de arriba (esta vez es una RETIRADA).

**Sexta zona: El Campamento del Clan Serhu**

- **Geografía y sociedad**: circular, empalizada de Telda Común atada con fibra de Enredaderas
  (reutiliza los recursos de las 3 zonas anteriores), brecha económica real entre leales a Ketg
  (mejor equipados, guardia/ejército) y el resto bajo el miedo ya documentado de la casta de Ketg
  — primera vez que esa política tiene cara visible dentro del propio campamento. Recinto de
  Múrgol domados fuera de la empalizada (Leche de Múrgol, nueva; Lana de Múrgol, ya existía en
  catálogo). Pilares de hueso de Gargantúa del Osario de la Manada; trofeos de piel de Corredor de
  Cauce ligados al rito de caza ya establecido ("El camino a guerrero").
- **Un Maestro y un trabajador por cada uno de los 11 oficios de orco de las Llanuras** (el hallazgo
  más grande de esta zona): **Maestro `<Oficio>` Serhu** enseña el oficio vía reputación + misión
  (ambas por definir); **`<Oficio>` Serhu** es un trabajador PLANTILLA sin nada que enseñar, pensado
  para darle uso real a `capturablePct`/`reclutablePct` (campos que ya existían en el catálogo desde
  hace semanas sin ninguna mecánica que los consumiera) — capturado o reclutado, pasaría a producir
  ese recurso de forma pasiva para el Reino del jugador. La mecánica de asignación a Reino en sí NO
  existe todavía, es diseño a futuro; el catálogo de NPCs puede adelantarse.
- **Nuevo oficio: cocinero-orco-llanuras**, con Maestro propio en este campamento — reasigna
  Ración de carne ahumada y Ración de viaje (ya existentes) como sus productos, deja fuera a
  propósito la Ración de carne fresca (caza sin cocinar).

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Séptima zona: El Osario de la Manada**

- **Fragmentos de Gargantúa** (tier 1-2) y **Huesos de Gargantúa** (construcción tier 1) — nuevos,
  distintos del Hueso largo/Placa ósea de gargantúa ya existentes (a confirmar con la usuaria en
  la pasada de código si de verdad quería 4 objetos de gargantúa distintos o consolidar).
- **Boungo**: seta comestible, primer ingrediente propio (no ración reasignada) del oficio de
  cocinero-orco-llanuras. Crece en Vungrat (otoño) — gate real desde 2026-08-24, ver
  [rpgtarkor/estaciones.md](../rpgtarkor/lore-mundo/estaciones.md).
- Fauna solo de paso, reutilizada sin cambios: Gesgurio (Hondonada) y Cruzavientos.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Octava zona: Las Agujas Imán — la más ambiciosa mecánicamente de la sesión**

- **Imanio**: insecto lento cubierto de rocas imantadas flotantes como armadura, inofensivo salvo
  que se le ataque; se desprende de una extremidad desmagnetizada para huir/distraer, regenera en
  días.
- **Nuente**: depredador nocturno que "ve" magnetismo en vez de oír — primera criatura de la sesión
  que convierte el propio fenómeno ambiental ya establecido (desorientación magnética) en ventaja
  evolutiva real. Efecto pasivo confirmado: -2 al ataque del jugador si usa arma de metal contra él
  (más simple de implementar que la "onda activa" que se planteó primero, mismo resultado temático).
- **Rocas Imanidas / Saco de Arena Imán — sistema nuevo, no solo contenido**: se recolectan
  flotando (no se minan), calidad variable según cuánto floten, solo se refinan a Arena Imán fuera
  de la zona, y la propia zona hace perder cualquier Arena Imán suelta del inventario salvo que
  vaya en el Saco. Tres piezas de motor que no existen hoy (calidad variable de recolección, lógica
  condicionada por ubicación, pérdida de inventario al entrar en una zona) — marcado explícitamente
  para diseño propio en la pasada de código, no una fila más de catálogo.

**Pendiente de código**: ver entrada nueva en la sección de arriba (la más grande de la sesión).

**Novena zona: Los Manaderos — el ecosistema más completo de la sesión**

- Cadena trófica de 5 especies: Verdileas Acuáticas → Jusha Esmeralda → Miruina (nocturno, en
  manada) y Tura Jusha (diurna, crías desorientadas) sin pisarse el nicho pese a compartir presa;
  Quio como carroñero/filtrador aparte.
- **Juncos Rojizos formalizados**: ya estaban mencionados en el propio texto de `areas.md` desde
  el origen de la zona, nunca habían llegado a ser un recurso real.
- **Liquen del Cauce/Bulbo del Cauce reconfirmados como propios también de aquí** (ya existían,
  ligados a "la misma corriente subterránea" en general, sin `Location` concreta hasta ahora).
- Recursos decididos a discreción de Claude, aprobados sin cambios por la usuaria: Carne/Escama de
  Jusha, Piel de Miruina (impermeable), Filtro de Quio (sin loot de combate, solo recolección),
  Plumas/Garra de Tura Jusha.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Décima zona: Los Túmulos del Honor** — sin cambios, terreno sagrado neutral, la usuaria no
encontró nada que añadir; se queda deliberadamente sin recursos propios, como Los Restos de Maktor.

**Undécima zona: Los Pastos de la Deriva**

- **Pasto Solar**: primer ítem real para la hierba base de toda la región, hasta ahora solo
  asumida en el lore de Múrgol/Corredores sin ningún recurso detrás.
- **Cuernahoja**: gacela de manada, dimorfismo con hembras defensoras de cuernos más anchos —
  cuarta vez que aparece el patrón de liderazgo femenino en la sesión (Terk'ikar, Ferike,
  Cuernahoja — nadie lo pidió cada vez, es tono ya asentado de la región).
  Recursos a discreción de Claude, aprobados sin cambios.
- **Flor Salvatura**: primer ingrediente de alquimia multi-receta de la sesión (tier 2-5 con la
  misma planta base, confirmado con la usuaria) en vez de un objeto de tier fijo único.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Duodécima zona: El Filo de las Brasas**

- Sin fauna/flora nueva — solo confirmado que el Rondador de Brasas (ya existente, "no teme al
  fuego... busca ascuas") es también residente de aquí, no solo merodeador de campamentos en
  general. La usuaria lo recordaba como "aullador", corregido a Rondador de Brasas (el Aullador
  Rojo es una especie distinta, depredador de jauría de Corredores de Cauce).

**Pendiente de código**: ver entrada nueva en la sección de arriba.

**Decimotercera zona: El Filo de las Brasas (minerales) + Las Fumarolas Negras**

- Segunda gran zona de materiales de tier alto de la sesión: Volcanita (tier 3-4), Rovalnica
  (construcción tier 2-4), Fercaneo (tier 5-6, casi imposible de encontrar, protegido por las
  Salamandras de Escoria ya establecidas en esta misma zona — les da un motivo real más allá de
  territorio). Las Fumarolas Negras (dentro del mismo borde volcánico, más hostil) tienen mejor
  probabilidad de Fercaneo que el resto del Filo — respuesta directa a la pregunta abierta sobre
  qué añadir ahí.

---

## Sesión 2026-08-22 (decimotercera pasada) — el análisis de réplica entre zonas, aplicado, + La Sabana Alta

Retomado el repaso "zona por zona" tras el análisis de réplica de la sesión anterior. Antes de la
zona nueva, se aplicó el propio análisis pendiente (ver `docs/rpgtarkor/areas.md`/`flora-fauna.md`
para el detalle narrativo, y "Propuestas de réplica entre zonas" más arriba en este mismo archivo
para el detalle técnico completo) — resumen: Corredor de Cauce/Ruptidar/Pasto Solar quedan anclados
de verdad por terreno/región, y se corrige un hallazgo real no buscado (10 recursos de la pasada
2026-08-21 tenían `HarvestYield` pero ninguna fila en `worldPopulation.ts`, así que no podían
recolectarse en ninguna zona). Llevado a código y verificado el mismo día (`tsc -b` limpio + suite
completa) antes de continuar con la zona nueva.

**Decimocuarta zona: La Sabana Alta**

- Confirmado que Múrgol, Corretolvas, Buitre Cenizo y Aullador Rojo ya son fauna real de la zona
  (la mayoría gracias al propio ajuste de terreno de arriba) — la usuaria describió la zona como
  "prácticamente toda la fauna de la llanura" y el motor ya lo refleja sin tocar nada más.
- **Pasto de Sangre**: la hierba roja de la zona tiene nombre propio — misma raza que el Pasto
  Solar, teñida de rojo por la mineralización (también roja) del agua local.
- **Towrgu**: depredador solitario de emboscada, 120-160 cm, caza aprovechando el sigilo del Pasto
  de Sangre igual que el Aullador Rojo con los Corredores de Cauce. Nivel 4-12, agresivo, loot tier
  4-6 (piel/garras/colmillos).
- **Coracelo**: roedor constructor de madrigueras fortificadas, 40-100 cm, manos desarrolladas que
  usa como herramienta, cola-maza de escamas duras como el hierro para partir roca. Nivel 2-8,
  cauteloso, loot tier 2-4 — la Cola de Coracelo no es material de construcción, es el ingrediente
  real de una maza craftada por herrero-orco-llanuras (`CORACELO_MACE_RECIPE`, nueva).
- **Telda Atardecer**: misma especie que Telda Común/Ceniza, madera y resina rojas de tier más alto
  (tier 4/3) — "la mejor madera de todas las Telda". Las hojas siguen siendo las mismas Hojas de
  Telda de siempre, compartidas por las tres variantes (de paso, se corrigió un candado de zona
  única preexistente que ya impedía encontrarlas también en El Cruce de las Cenizas).
- **Trigo Escarlata**: grano salvaje, base de harina — los orcos de las Llanuras nunca han logrado
  cultivarlo de verdad (presión Goirnte + terreno), razón real de que el clan nunca se haya
  expandido como civilización asentada (nuevo párrafo en `razas.md` § Oficios por clan). Cuando
  exista un oficio de agricultura, el de esta región será el único que no se aprenda de un NPC —
  hará falta una misión especial ligada al futuro sistema de Reino (mismo criterio que el resto de
  profesiones de trabajador capturado del Campamento Serhu, deliberadamente aparcado, ver abajo).
- **Roca Luclara** (renombrada en vivo de "Roca Lucero" tras aviso de colisión leve con Lucre
  Blanco): piedra clara de construcción tier alto (tier 6), donde los Towrgu excavan sus nidos.

**Llevado a código el mismo día**: los 2 `NpcInput`, 12 `ItemCatalogInput` (incluida la Maza de
Coracelo, equipable) + su `CraftingRecipe` en `crafting.ts`, ~11 `HarvestYield`, entradas en
`harvestSourceRegion`/`harvestSourceHomeLocationSlug`/`harvestSourceTerrainTag`/`faunaTerrainTag`,
5 filas nuevas en `worldPopulation.ts` (2 FAUNA + 3 RECURSO). Verificado: `tsc -b` limpio, suite
completa en verde (solo los 2 archivos de integración con el flake de entorno preexistente,
confirmado también en el código sin tocar vía `git stash`), y un script de integridad ad-hoc sin
hallazgos (slugs duplicados, `itemSlug` huérfanos, conflictos de `metodoObtencion`, recursos sin
`WorldPopulation`).

**Pendiente de diseño (no de código)**: el oficio de agricultura de Las Llanuras y su vía de
aprendizaje por misión especial — la propia usuaria lo dejó explícitamente para cuando se
desarrolle el sistema de Reino, mismo criterio que el resto de mecánicas de "trabajador capturado"
del Campamento del Clan Serhu (ver "Pasada de código de la sesión 2026-08-21" arriba).

---

## Sesión 2026-09-02/03 (decimocuarta pasada) — Playa de Ceniza Blanca + Los Acantilados Partidos,
profesión Pescador nueva, documentación reconciliada tras avanzar en código sin pasar por este runbook

**Contexto real de esta pasada**: las zonas 15 y 16 se llevaron a código (`worldCatalog.ts`,
commits `6425566`/`e6573c3` para la 15, comentario "sesión categorías de raza de fauna" para la
16) en un tramo de conversación que no pasó formalmente por `docs/ampliar-lore.md`, dejando
`areas.md`/`flora-fauna.md`/`items.md`/este checklist desactualizados varios días. Reconciliado
2026-09-03 releyendo la transcripción real de esa sesión (no solo el commit) — de paso se
confirmó y documentó el proceso real seguido, ahora escrito en el runbook como dos variantes
nuevas: `docs/ampliar-lore.md § 1.6` (la usuaria dicta elemento por elemento, Claude busca un
objeto equivalente real como plantilla antes de proponer la ficha técnica completa, cierra
uno a uno) y `§ 1.7` (modo inverso — Claude propone la ficha completa primero, la usuaria
confirma o ajusta; activado por la propia usuaria al terminar la zona 15: *"sigamos, con el plan
de que ahora ya me das tú las recomendaciones completas y soy yo el que confirmo"*).

**Decimoquinta zona: Playa de Ceniza Blanca** — zona deliberadamente pacífica/de descanso, sin
fauna combatible. Flora: Junba Verde (árbol tipo palmera-seta, da Madera Jumba tier 2 + Resina
Jumba Verde tier 2, población 3000/1500) y Temune (algas de orilla, da Algas Temune tier 1,
población 2500). Fauna, todas obtenidas por la profesión nueva **Pescador** (nunca Cazar): Jashil
Verde/Rojo (pez abundante tier 1), Negueo Turquesa/Solar (pez carroñero tier 1), Toluh (pez
migratorio grande, solo en otoño, tier 7, el más codiciado), Bulco de Arena (marisco tier 1-2 vía
Buscar), y tres puramente ambientales sin recurso — Terinte, Benusa Pesquera, Manesti Azul. La
Roca de Llanura Roja (antes "Roca de Los Pilares Rotos", ya renombrada en la sesión anterior de
auditoría) se generalizó con terrain tag `arido` para aparecer también aquí sin `ZonePoint`
nuevo. El **Maestro Pescador Serhu** enseña el oficio.

**Pieza mecánica grande de esta sesión, no solo catálogo**: profesión **Pescador**, universal
(todas las razas, sin variante regional/racial) — dos habilidades: Pescar (peces, requiere caña +
cebo, atributo fuerza) y Buscar (marisco, sin herramienta, atributo voluntad). Cooldown propio
("3 usos seguidos, luego 30 min"), distinto del cooldown estándar por fuente del resto de
oficios. Doble tirada en tier alto (≥6): fuerza→inteligencia en Pescar, voluntad→destreza en
Buscar — mismo patrón que se aplicó de paso a los otros 4 oficios de recolección (minero, talador,
desollador, herborista) con sus propios pares de atributos. Nuevos `MetodoObtencion.PESCA`/
`BUSQUEDA`. De paso se cerraron 2 huecos reales que dejaban la profesión inalcanzable: caña de
pescar y cebo sin ninguna forma de conseguirse (ahora crafteables, caña con carpintero/cebo con el
propio pescador) y ningún NPC que enseñara el oficio (de ahí el Maestro Pescador Serhu).

**Decimosexta zona: Los Acantilados Partidos** — pared costera vertical, dos especies agresivas
propias de la peligrosidad del sitio. Celubia Pálida (ave marina de presa, nidifica en cornisas,
picados con estela de espuma seca, tier 2-4 loot: Plumas + Huevo) y Terkash (crustáceo de grietas
profundas, caparazón indistinguible de la roca, pinza mayor capaz de partirla, tier 2-4 loot:
Carne + Caparazón). Nombre corregido en vivo: la primera propuesta ("Alcatraz de Espuma") usaba
el nombre de un ave terrestre real — regla de mundo reforzada explícitamente en esta sesión: nunca
usar nombres de especies reales reconocibles, ni siquiera como base. La misma revisión encontró
**Buitre Cenizo** como otro caso ya colado en el catálogo — renombrado a Zense Ceniza en la misma
sesión (commits `fef3933`/`c8102fe`).

**Llevado a código en su momento, ahora reconciliado en `.md`**: `areas.md` (entradas de zona 15 y
16), `flora-fauna.md` (fichas completas de flora/fauna de ambas zonas), `items.md` (loot nuevo de
ambas). Verificado en su día: 1917/1917 tests, `tsc -b` limpio (ver commits reales arriba).

**Pendiente de documentación (nuevo, pedido explícito 2026-09-03)**: crear `docs/rpgtarkor/profesiones.md`
dedicado — hoy las profesiones/oficios (Pescador, Herborista, Minero, Talador, Desollador,
Cocinero-orco-llanuras, Carpintero, Curtidor, Herrero, Trabajador de Reino, primeros-auxilios...)
están dispersas inline en `areas.md`/`flora-fauna.md`/`items.md`, sin un documento propio que las
reúna todas: qué hace cada una, cómo se aprende (NPC maestro / de partida / misión futura),
variantes por raza+región (`REGION_PROFESSION_TOKEN`), y sus mecánicas propias cuando las tengan
(cooldowns distintos, tiradas dobles en tier alto). No es solo "mover texto que ya existe" — hace
falta reunir y organizar contenido que hoy vive repartido entre `.md` y directamente en
`professions.ts`/`harvestAbilities.ts`/`startingProfessions.ts` sin ningún resumen narrativo único.

**Parada aquí — la próxima zona es la 17: La Desembocadura Callada** (ver puntero actualizado en
"En curso" al principio de este archivo, y "Sesión 2026-09-04" más abajo — la zona 17 quedó
PAUSADA a medio elemento 2 cuando surgió el sistema de géneros de flora). Al cerrar la última zona
de Las Llanuras del Viento Rojo, la usuaria pidió repasar toda la región de nuevo por si alguna
zona quedó poco alimentada de lore o se coló algo que no encaja — antes de dar el repaso regional
por cerrado del todo.

**Pendiente de código**: ver entrada nueva en la sección de arriba.

---

## Sesión 2026-09-04 (decimoquinta pasada) — `FloraCategoria`, sistema de géneros de flora
(paralelo a `FaunaCategoria`), cerrado y llevado a código

**Contexto**: retomando la zona 17 (La Desembocadura Callada) con el modo § 1.7 (Claude propone,
la usuaria confirma), el primer elemento fichado (Esclipe de Marisma, anfibio ambiental sin
combate) reveló dos huecos de la plantilla real usada hasta ahora — corregidos en el runbook antes
de seguir (ver `docs/ampliar-lore.md § 1.8`, plantilla completa por tipo de elemento, con ejemplo
de `bio` detallada fijado como referencia de forma):
1. **`faunaCategoria` no era opcional por defecto** — la primera versión de la regla decía "siempre
   3 `habilidadesRaciales` salvo Ruptidar"; corregido: solo lleva las 3 específicas la fauna
   pensada para combate real, `[]` si es puramente narrativa/ambiental (mismo criterio que
   Terinte/Benusa Pesquera/Manesti Azul de la zona 15), aunque sí lleve `faunaCategoria` asignada.
2. **La `bio` necesitaba mucho más detalle** — la usuaria pidió explícitamente "ser detallista...
   Entornos, Físico, personalidad y comportamiento", con el aspecto físico como lo más importante,
   sin calcar fauna/flora real reconocible. El Esclipe de Marisma quedó fijado como ejemplo de
   FORMA (no de contenido) para toda `bio` futura.

**El elemento 2 de la zona 17** ("Chudo de la Marea", propuesta de flora de orilla) disparó un
hilo aparte: la usuaria pidió sustituir "Junco" por un nombre propio de mundo — mismo patrón que
Telda (especie base con variantes regionales: Común/Ceniza/Atardecer). Confirmado el nombre base
**"Chudo"**, pendiente de aplicar el renombrado completo (`juncos-rojizos`→`chudos-rojizos`,
`oasis-de-juncos-rojos`→`oasis-de-chudos-rojos`, `estera-junco-trenzado`→`estera-chudo-trenzado`,
más los textos narrativos que mencionan "juncos") — **NO aplicado todavía**, sigue pendiente,
ver más abajo.

**De ahí surgió el tema grande de la sesión**: la usuaria observó que la fauna ya tiene géneros
(`FaunaCategoria`) y pidió lo mismo para la flora, además de un `.md` de vocabulario/traducciones a
la lengua del juego (también pendiente, ver más abajo) y avisó de generalizar bien el concepto de
"especie base + variante regional" (Telda no es "árbol", es como "abeto"/"pino" — una familia real
que se puede reutilizar en otra región con una variedad nueva adaptada, ej. Cristal Helado).

**`FloraCategoria` — diseño cerrado y CONFIRMADO por la usuaria, llevado a código el mismo día**:
- 11 géneros funcionales bajo la Semilla Florial ("El que Brota", genesis.md): VELDRIAS (árboles
  madera+resina), ZARCOS (arbustos de leña), HELDRAS (hierbas/pastos base), GRANOLES (cereales),
  TRENIAS (fibra de tejido/cordaje), MARELAS (algas), BULVIAS (raíces/tubérculos), MUSCARIAS
  (líquenes/musgos), SALVIRAS (alquimia/curación), FONGARES (setas), VETRIAS (flora con mineral
  real en su propia estructura).
- 2 géneros bajo Tarkor (magia Salvaje), paralelo exacto a MUDOS_SALVAJE/ROKRATS_ESTALLIDO de
  fauna: **BROTES_SALVAJES** (flora normal mutada, especie base real con algo imposible en su bio
  — asignado a Raíz de Fuego y Cardo Brújula, ambos ya tenían la propiedad mágica sin categorizar)
  y **ROKTARS_FLORARES** (flora nacida directamente de la magia, sin especie base real — nombre
  deliberadamente emparentado, "Roktars" es el mismo juego de palabras "Tarkor" al revés que
  ROKRATS, "Florares" marca la rama de flora; sin ejemplo real todavía, tipo reservado).
- **Usos reales confirmados** (la usuaria descartó explícitamente un 4º uso — bonus de recolección
  por profesión afín al género, no se implementa): (1) filtro de terreno derivado — sugiere un
  `harvestSourceTerrainTag` por defecto coherente con el género, detecta asignaciones sospechosas;
  (2) filtro de Enciclopedia; (3) pista narrativa de "sabor" compartido para el Narrador.
- **Hallazgo real al implementar el uso 2**: `faunaCategoria` (el campo que ya existía desde
  2026-09-02) **nunca había llegado al frontend/Enciclopedia** pese a llevar 2 días en producción —
  vivía solo en la BD, sin exponerse en `buildFaunaFloraSection` (`world.ts`) ni en el tipo
  `EnciclopediaFaunaFloraInfo` (`api.ts`). Cerrado para AMBOS a la vez (decisión explícita de la
  usuaria al preguntarle) — ahora `faunaCategoria`/`floraCategoria` viajan en cada entrada de
  fauna/flora de la Enciclopedia, antepuestos al tooltip de recursos (`yieldsSummary`,
  `enciclopediaTargets.ts`).

**Llevado a código el mismo día**: `backend/src/services/floraCategoria.ts` (tipo nuevo, sin tocar
Prisma — la flora no tiene tabla propia, igual que `TerrainTag`), mapa
`harvestSourceFloraCategoria` en `worldCatalog.ts` con las 25 fuentes de flora ya existentes
asignadas (Trepador Ocaso, fuera del núcleo jugable, se dejó sin asignar a propósito — sin
suficiente lore para decidir entre VELDRIAS y BROTES_SALVAJES todavía), y la exposición a la
Enciclopedia (backend `world.ts` + frontend `api.ts`/`enciclopediaTargets.ts`). Verificado:
`tsc -b` limpio en backend y frontend, 191/191 tests frontend, 2015/2016 backend (1 flake
preexistente sin relación, ya documentado, confirmado en aislamiento).

**Renombrado "Junco" → "Chudo" — CERRADO el mismo día (2026-09-04)**: aplicado en todo el proyecto,
no solo `worldCatalog.ts` — se encontraron y corrigieron 6 archivos más con el nombre viejo
enterrado: `crafting.ts` (receta de la Estera, referenciaba `catalogSlug: 'juncos-rojizos'` directo,
sin pasar por el catálogo — se habría roto en silencio de no corregirse), `crafting.test.ts`
(fixture del mismo test), `entorno.ts` (banco de frases ambientales de la región), `faunaAbilities.ts`
(habilidad "Respiro entre juncos" de la categoría ZANCUDOS), `distillationScenarios.ts` (3 escenarios
del dataset de fine-tuning, con slug de `locationFact` desactualizado), y `frontend/src/data/map.ts`
(coordenada visual del pin de El Oasis, keyed por slug — se habría desalineado del mapa sin
corregir). Verificado: `tsc -b` limpio en backend y frontend, 2014/2016 tests backend (2 flakes
preexistentes sin relación, confirmados en aislamiento), 191/191 frontend.

- Asignar `floraCategoria` a Trepador Ocaso cuando se repase Ciénaga Troncal — sigue pendiente.

**Pendiente de documentación (nuevo, pedido explícito 2026-09-04)**: crear `docs/rpgtarkor/vocabulario.md`
— registro de traducciones a la lengua del juego (lengua común = castellano adaptado al lore para
muchos sustantivos, con variantes por raza cuando aplique) cada vez que se "traduce" algo nuevo. La
primera entrada real ya existe (Junco→Chudo, cerrado arriba) — sigue sin crearse el archivo en sí.

**Zona 17 sigue pausada** — retomar el Chudo de la Marea (elemento 2) ahora que el renombrado ya
está cerrado, antes de seguir con más elementos nuevos de la zona.

## Tanda OpenCode 2026-09-27 — 39 propuestas aprobadas, aplicadas a docs, código pendiente

Fichas completas en `docs/borradores-opencode/propuestas-aprobadas.md` (A-01…A-39). Ya están en
`docs/rpgtarkor/`; **todo lo de abajo es código pendiente**:

- **Facciones** (`worldCatalog.ts` → `factions`, `seed-catalog.ts`, `reputation.ts`,
  `worldPopulation.ts`): Los del Obelisco, Keseg Sael, Keseg Prisilke, Feg Tusha y Feg Ger. La
  Concordia pasa a tener como líder a `tarsen-vold` (hoy `yovenne-tal`, incoherente con el lore).
  Detalle en `facciones-diplomacia.md` § 7.2-bis.
- **NPC** (`worldCatalog.ts`): Tarsen Vold; Hulki, Tira, Kiri, Lusa y Gero en
  `campamento-feg-tusha-interior`; Yeru y Tasko en Kegi (`jakut-ger-interior` / `yegr-kegi`).
  Atributos y porcentajes en A-37 a A-39.
- **Edificios de facción Serhu** (`factionBuildings` + `ZonePoint` en `campamento-serhu-interior`):
  Herboristería, Taller de Alquimia, Corrales del Domador, Desolladero y Carpintería, con su Maestro
  ya sembrado (A-09). Enriquecer la descripción de la Herrería.
- **Locations nuevas del Margen**: `cruce-de-las-ausencias`, `aguas-sordas`, `proa-gris`. Meseta
  (opcional, fuera de núcleo): Puesto del Corredor, Canteras del Eje.
- **Fauna** (`fauna` + `HarvestYield`): Leshra (UMBRIAS), Morvasa, Brozán, Hoscón. Tampoco están en
  el catálogo Hetris, Mekiosi, Vistue, Sombras de Kroj ni Cornantes, que eran canon anterior.
- **Flora** (`ItemCatalog` + `HarvestYield`): Musgo Callado, Veldria Hueca (madera y resina), Flor de
  Víspera, Cántaro de Hoja (agua y tallo), Carnosa de Tocón, Bulbo de Turbera, Velo de Charca, Corteza
  Herrumbre (+ receta de fundición a mena de hierro pobre).
- **Items**: Colmillo de Ferike (+ `HarvestYield` del Ferike), Ashi'krul (loadout de Tasko),
  Desollador de sílice (a la venta en el Desolladero), Ungüento de Espina (receta de alquimista), Manto
  de Cornisa (receta de sastre), Incisivos de Miruina (+ `HarvestYield` de la Miruina).
- **Enciclopedia** (opcional): `historiaEntries` para el Pacto de la Primera Pieza, la Mesa del Lazo,
  el Primer Edicto del Tributo y la fundación de El Baluarte, cada una con su documento.
- **RAG**: `loreChunks.ts` + `npm run reindex-lore` con lo nuevo (clanes, Jakut, Keseg Sael,
  flora y fauna del Margen).
- **Pendiente de dataset**: el vocabulario nuevo (Drogh'tugh, Tovh'vhurne, Keseg Sael, Leshra,
  Ashi'krul) y los nombres de lugar nuevos.

## Pasada de conexión del lore — 2026-09-27 (Claude, a petición de Álvaro), código pendiente

Aplicado a `docs/rpgtarkor/` y a `docs/canon-opencode/`. Todo lo nuevo está marcado como
provisional o revisable en el historial de cada fichero.

- **Geografía**: `areas.md` § "Cómo encajan en el mapa". Berig en tres franjas (las Llanuras al oeste
  y la Ciénaga al este, lado a lado), con una tabla de rutas y distancias medidas sobre el mapa de
  Azgaar. Las jornadas sin medir en el juego van marcadas como *estimado*.
- **Hilos nuevos**: El Borde (los Nabieus como correos del orden, ~2.100-2.800), la Senda del Sílice
  (Helsig ↔ Goshg, ~3.000-3.500), los mil años salvajes (origen de los Mudos Salvaje de las
  Llanuras), la tala del borde (Goirntes ↔ Faerus), el tributo por mar desde la Costa Corredor, y
  El Claro de la Manada arrasado tras El Detonante (canon de Riko que faltaba en el Margen).
- **Código pendiente**:
  - Fauna: Hielaga, Nievón, Tragalodo, Borbol y Zancapilote. Además, familia y nivel para Sombras de
    Kroj (UMBRIAS 3-8), Hetris (ACECHANTES 4-9), Mekiosi (ACECHANTES 7-13), Vistue (GUELISES 3-7) y
    Cornantes (BESTIONES 3-8), ninguno sembrado todavía.
  - Flora: Liquen Escarcha y Bolco (resina).
  - NPC: `aven-tessk` (líder de Keseg Sael) e `ilka-dren` (líder de Keseg Prisilke).
  - Descripciones de las `Location` `costa-corredor` y `embarcadero-goshg`.
- **Pendiente de revisar**: el catálogo de Azgaar sitúa el campamento Serhu en el norte de las
  Llanuras y el Cruce de las Cenizas a ~110 km. En el juego están a 18-25 km (el Cruce se dibuja
  aparte, solo en el mapa visual). Es una incoherencia antigua y conocida (`13-escala-del-mundo.md`
  § 1.1); en esta pasada no se ha tocado.

- **Segunda pasada (misma fecha)**: descritos los 6 lugares de la Ciénaga que solo tenían nombre
  (rellenar `description` en sus `Location`); talleres del Cerco de los Pilotes (astillero de pilotes,
  resinería, ahumadero, talla de tótems; edificios y Maestros por crear); ciudades numeradas de la
  Meseta (Vresk Hes, Vresk Tuh y Vresk Kei); fauna nueva, el Vreskal (ORDENADOS, el primero) y el
  Escarchín (Lago Cristalice); cronología: ciudades numeradas (0-1.000) y nacimiento de la corriente
  radical (~3.650-3.700). Todo pendiente de código.

- **Edificios de oficio (2026-09-28)**: diseño en `rpgtarkor/sistemas-reino/edificios-de-oficio.md`.
  Todo el código pendiente está en su § 7.
