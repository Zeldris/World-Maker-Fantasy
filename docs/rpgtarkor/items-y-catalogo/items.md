# Helek Sirik — Items y equipamiento

[← Volver al índice del mundo](../lore-mundo/07-mundo-helek-sirik.md)

*Armamento, loot y objetos de trasfondo por región — contexto narrativo para el Narrador. La mayoría de esto no lleva bonificadores numéricos (decisión de mecánicas 5, [06-decisiones-mecanicas.md](../../mecanicas/06-decisiones-mecanicas.md)), pero esa decisión fue revertida en parte el 2026-08-13: el equipo real (armas/armaduras con entrada de catálogo) sí puede llevar `ItemCatalog.statBonuses`, aplicado de verdad al equiparlo (`backend/src/services/equipment.ts`) — los "hechos libres" narrativos sin entrada de catálogo (dinero, propiedades, trofeos) siguen sin números. El catálogo técnico (`ItemCatalog`) que implementa esto vive en `docs/12-mundo-estructurado.md` § 4 y toma como fuente editorial lo que hay aquí.*

---

## Armamento y loot — Llanuras del Viento Rojo (añadido 2026-07-17, Claude)

*Igual que el inventario (decisión de mecánicas 5, [06-decisiones-mecanicas.md](../../mecanicas/06-decisiones-mecanicas.md)), esto es contexto narrativo para el Narrador — la mayoría no lleva bonificadores numéricos, salvo el equipo real con entrada en `ItemCatalog` (ver nota de cabecera del documento). Sirve para responder con concreción cuando Gorhorn (u otro orco de esta región) fabrica, encuentra o comercia algo.*

**Armamento orco típico:**
- **Hachas de guerra y mazas**: el arma por excelencia — pesadas, poco elegantes, pensadas para el combate cuerpo a cuerpo directo que valora la cultura orca. La de Gorhorn está rota y la usa como maza, algo habitual entre quienes no tienen acceso a un herrero de clan — reforjarla (cabeza reasentada, filo devuelto) es posible mediante crafteo y la deja como lo único del Clan Maktor que ha vuelto a estar entero.
- **Cuchillos de hielo sílice**: filo de mineral en vez de metal, típico de quien ha comerciado con el Clan Helsig (como Gorhorn con Hagar) — más frágil que el acero pero no requiere fragua, solo tallado paciente.
- **Lanzas de hueso de Gargantúa**: usadas en las cacerías rituales de Corredores de Cauce y en la caza de Gargantúas de Ceniza adultas; también un arma de duelo de honor cuando se quiere dejar clara la distancia y el respeto (menos "sucio" que un hacha).
- **Amuletos y abalorios de hueso**: no son armas, pero son casi universales — vértebras, colmillos o garras de una presa importante, llevados como trofeo/recordatorio, igual que las trenzas de Gorhorn.

**Loot potencial explorando o cazando en la región:**
- **Veneno de Espina del Viento** (del aguijón): si se extrae con cuidado, alterador de percepción del dolor — valioso para un sanador o peligroso en manos equivocadas.
- **Caparazón de Espina del Viento**: placa de quitina oscura y brillante, dura como el cuerno — segundo loot de la misma cacería, junto al veneno.
- **Pieles de Corredor de Cauce**: ligeras, resistentes al calor, se usan para ropa de viaje — el arnés y los pantalones de Gorhorn son de un material similar.
- **Placas óseas de Gargantúa de Ceniza**: solo tras una cacería exitosa (o un cadáver ya viejo) — material de construcción/armadura pesado, poco práctico para un viajero solo.
- **Restos de campamento de la Concordia**: raciones, correspondencia sellada, a veces armas de manufactura Goirntes (más refinadas que las orcas) — si Gorhorn se cruza con la patrulla del gancho de aventura "Rezagados de la Concordia" (ver [personajes.md](../personajes/personajes.md#ganchos-de-aventura--llanuras-del-viento-rojo-gorhorn)).
- **Marcas y tótems de clan rotos** *(revisado 2026-08-21, confirmado 2026-08-23, ver Los Restos de Maktor en [areas.md](../lore-mundo/areas.md))*: el Tótem de clan roto se queda como loot real — es ingrediente de una receta de Reino ya implementada, reconstruir el Tótem del Clan Maktor sacrificando el tótem personal de Gorhorn. Planteamiento confirmado tal cual, sin cambios. *(Bug real detectado y corregido el mismo 2026-08-23, auditoría lore↔código: el otro ingrediente de esa receta, el "Tótem Maktor" personal de Gorhorn, llevaba desde 2026-08-15 referenciado por string en `startingInventory.ts`/`construction.ts` sin existir de verdad en `ItemCatalog` — invisible en la Enciclopedia. Ya tiene fila real.)*
- **Lingote de Hiyerro** *(añadido 2026-08-21)*: la mejor aleación orca de las Llanuras — hierro, Yerreo (mineral rojizo escaso) y Arena Imán fundidos juntos. Material de las armas de mayor tier que un herrero de la región puede forjar. El Yerreo en bruto se saca de una veta rarísima en La Hondonada del Eco o, más accesible, de las garras del Kirelon Arenoso que la habita.
- **Trozos de quitina roja / hueso, cráneo y piel de Kirelon**: loot de la nueva fauna de La Hondonada del Eco (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)) — quitina para crafteo ligero, el resto material de curtido/hueso propio de un depredador grande.
- **Leche de Múrgol** *(añadido 2026-08-21)*: del recinto de Múrgol domados fuera de la empalizada del Campamento del Clan Serhu — junto a raciones de carne y Lana de Múrgol (ya existente), es lo que de verdad sostiene la economía cotidiana del campamento.
- **Nuevo oficio: cocinero-orco-llanuras** *(añadido 2026-08-21, corregido 2026-09-01 tras auditoría de lore contra el código real)*: primer NPC-profesor de este oficio en el Campamento del Clan Serhu (ver [areas.md](../lore-mundo/areas.md)). La reasignación de **Ración de carne ahumada** y **Ración de viaje** a este oficio, planeada aquí en su día, **no llegó a aplicarse en el motor**: `SMOKE_MEAT_RECIPE` (Ración de carne ahumada, `crafting.ts`) sigue sin `oficio` a propósito (comentario del propio código: "ahumar carne sobre el fuego es una habilidad de supervivencia básica, al alcance de cualquiera sin necesitar oficio") y **la Ración de viaje no tiene ninguna receta de crafteo en absoluto** — solo existe como ítem de inventario inicial/recompensa fija. El oficio sí tiene recetas propias reales (Boungo asado y otras, `crafting.ts`), solo estas dos raciones concretas se quedaron sin reasignar. La Ración de carne fresca se queda fuera a propósito — es caza sin cocinar.
- **"Saco de Arena Imán"** *(añadido 2026-08-21, marcado como aspiracional 2026-09-02 tras auditoría de lore)*: diseñado como contenedor protector, único ítem que evitaría perder la Arena Imán suelta del inventario al entrar en Las Agujas Imán (ver [areas.md](../lore-mundo/areas.md) § Las Agujas Imán) — **nunca se implementó**: no existe como fila de `ItemCatalog` ni hay lógica de pérdida en el motor. Lo que sí existe es `punado-arena-iman` (materia prima) y `saquito-arena-iman` (objeto narrativo craftable, sin función protectora). Fragmentos de Gargantúa, Huesos de Gargantúa y Rocas Imanidas (mineral que flota, se recolecta no se mina) sí son reales y completan el resto de recursos nuevos de esta ronda de zonas.
- **Carne/Escama de Jusha, Piel de Miruina, Filtro de Quio, Plumas/Garra de Tura Jusha** *(añadido 2026-08-21, corregido 2026-09-02 tras auditoría de lore)*: loot del primer ecosistema de charca con pez propio del catálogo (Los Manaderos, ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)). La Carne de Jusha ahumada **no** lleva el oficio cocinero-orco-llanuras — mismo criterio que la Ración de carne ahumada (ver más abajo): ahumar carne sobre el fuego es una habilidad de supervivencia básica, al alcance de cualquiera. Las recetas reales de este oficio son Boungo asado, Agua hervida con liquen, Pan de trigo escarlata, Panal endulzado y Cuajada de múrgol.
- **Piel de Cuernahoja, Enganche de hueso de Cuernahoja, Flor Salvatura** *(añadido 2026-08-21, Cuerno renombrado 2026-09-02)*: loot y flora de Los Pastos de la Deriva (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)) — el Enganche de hueso es el casquillo real que une la punta de una lanza al asta, crafteo típico orco (pendiente de receta real, ver `ampliar-lore-checklist.md`); Flor Salvatura es ingrediente base de varias recetas de alquimia (pociones curativas tier 2 a 5), no un objeto de tier único.
- **Volcanita, Rovalnica, Fercaneo** *(añadido 2026-08-21)*: minerales de El Filo de las Brasas/Las Fumarolas Negras (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)) — segunda gran fuente de materiales de tier alto de la sesión, el Fercaneo (tier 5-6) protegido por las Salamandras de Escoria y más probable en Las Fumarolas Negras que en el resto del Filo.
- **Piel/Garras/Colmillos de Towrgu, Piel/Colmillos/Cola de Coracelo** *(añadido 2026-08-22)*: loot de La Sabana Alta (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)) — la Cola de Coracelo no es material de construcción, es el ingrediente real de la Maza de Coracelo (crafteo de herrero-orco-llanuras, receta nueva).
- **Telda Atardecer, Trigo Escarlata, Roca Luclara** *(añadido 2026-08-22)*: flora/mineral de La Sabana Alta — Telda Atardecer es la mejor madera de las tres variantes de Telda conocidas; Trigo Escarlata crece salvaje pero los orcos de las Llanuras nunca han logrado cultivarlo de verdad (ver [razas.md](../lore-mundo/razas.md#orcos--hijos-del-estallido)); Roca Luclara es piedra de construcción de tier alto, donde anidan los Towrgu.
- **Madera Jumba, Resina Jumba Verde, Algas Temune** *(añadido 2026-09-02)*: flora de Playa de Ceniza Blanca (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)) — Madera Jumba y su resina vienen del árbol Junba Verde; Algas Temune es ingrediente de cocina recogido de la orilla.
- **Carne de Jashil, Carne de Toluh, Escamas de Toluh, Carne de Negueo, Bulco de Arena** *(añadido 2026-09-02)*: loot pescable de Playa de Ceniza Blanca (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)), obtenido con la profesión nueva **Pescador** (Pescar/Buscar), nunca con Cazar — las Escamas de Toluh son especialmente codiciadas para armaduras, dado lo raro que es dar con uno.
- **Plumas de Celubia, Huevo de Celubia, Carne de Terkash, Caparazón de Terkash** *(añadido 2026-09-02)*: loot de Los Acantilados Partidos (ver [flora-fauna.md](../lore-mundo/flora-fauna.md#berig--el-continente-goirntes)).

*(Lista abierta, igual que los ganchos de aventura — se amplía con lo que surja jugando.)*

## Primera tanda aprobada de OpenCode — Llanuras y Kegi (2026-09-27, pendiente de código)

*Valores calibrados contra el catálogo real (un tier 6 ronda los 20 Goirnos). Ficha completa de cada
uno en `docs/borradores-opencode/propuestas-aprobadas.md` (A-32 a A-36).*

- **Colmillo de Ferike** (material, tier 6, 8 Goirnos; de hembra, 12): nuevo recurso de despiece del
  Ferike. Marfil con vetas pardas, de 20-35 cm, duro pero quebradizo contra la piedra.
- **Ashi'krul, "el colmillo que huele"** (daga Faerus, ARMA_SECUNDARIA, DAGA, tier 6, 30 Goirnos,
  +4 Destreza, requiere Destreza 13): tallada en Kegi en un colmillo de Ferike hembra, con la
  empuñadura envuelta en piel de Ferike. El Ferike solo teme a los Faerus, y la hembra es la alfa:
  llevar su colmillo dice que su portador cazó a quien caza. **No se fabrica**: se compra a Tasko en
  El Vergel de Kegi con la confianza del Feg Ger, o se gana en una misión Faerus.
- **Desollador de sílice** (ARMA_SECUNDARIA, CUCHILLO, tier 3, 20 Goirnos, +2 Destreza, requiere
  Destreza 9; herramienta de desollador, curtidor y peletero): cuchillo de desuello hecho entre dos
  clanes. La hoja de hielo sílice en media luna la tallan los Helsig; las cachas de Caparazón de
  Espina del Viento, que no resbalan con sangre, las pone el Desolladero Serhu. Se vende allí; no tiene
  receta. Es la versión de oficio del cuchillo de hielo sílice de Gorhorn.
- **Ungüento de Espina** (consumible medicinal, tier 3, 12 Goirnos; receta de alquimista: 1 Aguijón
  con veneno de Espina del Viento + 2 Flor de Ceniza + 1 Resina Telda Gris → 2 ungüentos): el veneno
  de Espina, diluido y ligado en resina, deja de ser un peligro y se vuelve un anestésico de campo.
  Pasta ámbar de olor amargo que adormece la piel en segundos; mal dosificada, adormece también el
  juicio.
- **Manto de Cornisa** (COSMETICO_ESPALDA, sin bonificadores, tier 2, 6 Goirnos; receta de sastre:
  4 Plumas de Celubia + 2 Lana de Múrgol): manto corto de fieltro de lana de Múrgol con plumas blancas
  de Celubia cosidas en hilera sobre los hombros. Lo lleva quien superó la prueba de la cornisa de
  Los Acantilados Partidos.
- **Incisivos de Miruina** (material y herramienta de curtidor y peletero, tier 2, 3 Goirnos): nuevo
  recurso de despiece de la Miruina. Un peine natural de dientes que arranca escamas y restos de una
  piel sin cortarla. Es la primera herramienta del catálogo que sale directamente de un animal.

## Equipo militar de la Concordia — patrullas goirntes (auditoría 2026-07-28)

*Las patrullas de la Concordia de Hierro que vigilan la frontera de las Llanuras (soldados y oficiales — ver las plantillas de NPC del catálogo técnico) llevan un equipo tan reconocible como el de los orcos, pero de fabricación opuesta: donde los orcos improvisan con hueso, cuero e hielo sílice, los Goirntes fabrican en serie con aleación gris pulida — el contraste de manufactura es deliberado.*

**Equipo de un soldado raso:**
- **Espada corta y pica de patrulla**: hoja recta de aleación gris pulida, más ligera y mejor equilibrada que cualquier arma orca — la pica es el arma de formación estándar cuando la patrulla marcha en columna.
- **Cota de aleación ligera y perneras de cuero reforzado**: de Hierba del Hierro procesada, sorprendentemente ligera para lo que protege — completa el uniforme el yelmo abierto con el sello de la Concordia en la frente y unas botas de marcha de suela claveteada.
- **Ración goirnte**: bloque compacto de comida prensada envuelto en papel encerado — se conserva mejor que cualquier ración de campaña orca.
- **Diario personal**: casi todos llevan uno — un nombre, una familia en la Meseta; humaniza el saqueo de quien cae en la frontera.

**Equipo adicional de un oficial:**
- **Manoplas de aleación articuladas en los nudillos**, daga corta de reserva, talabarte de cuero con la hebilla de la Concordia y un anillo de sello o disco de patrulla que acredita —o incrimina— a quien lo lleva.
- **Correspondencia sellada**: rollos de pergamino con el emblema de la Concordia que un oficial lleva de puesto en puesto — pueden saber demasiado si caen en manos equivocadas.
- **Croquis de rutas de patrulla**: mano alzada sobre cuero fino, rutas marcadas con tinta desvaída — saber por dónde no pasar.
- **Lingotes de aleación goirnte**: moneda de comercio serio de la Meseta del Orden, a veces usada como paga o soborno.

*(Mismo principio que el resto de este documento: nada de esto lleva bonificadores numéricos, es contexto para el Narrador cuando Gorhorn se cruza con una patrulla o registra a un caído — ver el gancho "Rezagados de la Concordia" más arriba.)*

---

**Ver también:** [Cronología mítica](../lore-mundo/cronologia-mitica.md) · [Cronología](../lore-mundo/cronologia.md) · [Génesis y Formación](../lore-mundo/genesis.md) · [Áreas y geografía](../lore-mundo/areas.md) · [Historia y presente](../lore-mundo/historia.md) · [Razas](../lore-mundo/razas.md) · [Flora y fauna](../lore-mundo/flora-fauna.md) · [Personajes](../personajes/personajes.md) · [NPCs](../personajes/npcs.md)
