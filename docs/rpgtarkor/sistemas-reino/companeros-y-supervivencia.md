# Helek Sirik — Compañeros y supervivencia — APLICADO al motor

[← Volver al índice del mundo](../lore-mundo/07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — captura y tameo de fauna/NPC como
compañeros, y de paso el sistema de Hambre/Sed del propio personaje (surgió de la misma
conversación, comparte ritmo e items). **APLICADO al motor el 2026-08-25** (auditoría de lore
2026-08-25: este banner seguía diciendo "nada implementado" pese a estar construido de punta a
punta el día siguiente al diseño): captura+jaula, tameo/persuasión con tirada opuesta real
(`resolverIntento`, incluido el malus de `reclutablePct`/`domesticablePct` — ver nota de § 3 más
abajo), Felicidad, slot garantizado del Domador, Hambre/Sed de compañero y de la propia jugadora,
equipo de compañero, Almacén de Reino + Plantillas de equipo. Única excepción real, dejada fuera A
PROPÓSITO: **muerte por inanición** (ver nota de § 5 más abajo — el tope real hoy es CONVALECIENTE,
nunca MUERTO). Referencia cruzada obligada con `docs/mecanicas/17-reglas-construcciones-reino.md` (slots de
compañero por edificio) y [combate-multiple.md](../sistemas-combate/combate-multiple.md) — un compañero ya lucha de
verdad a tu lado en combate (`Companion.attributes`, aplicado el mismo día que ese sistema).*

---

## Qué existe hoy en el motor (grounding, antes de diseñar encima)

- **`Companion`** (modelo real) — hoy solo `name`/`role` (texto libre)/`notes`. Se crea cuando el
  Narrador decide `newCompanion` en un turno con intención de reclutar/aliarse, sin felicidad, sin
  cuidado, sin equipo. Este documento lo sustituye por un proceso real.
- **Slots de compañero YA salen de edificios** (`companionSlotsForRecipeKey`, `construction.ts`):
  Campamento da 1, Choza da 2. Esto se queda para NPCs/aliados en general — la fauna tameada por un
  Domador usa un slot APARTE, garantizado, ver más abajo.
- **`domesticablePct`** (fauna, `worldCatalog.ts`) — calibrado por especie, sembrado en DB, **cero
  consumidores hasta hoy**. Pensado exactamente para esto.
- **`capturablePct`** — ¡cuidado, es OTRA cosa! Decide si una "caza limpia" mata sin combate a una
  presa débil (`services/caza.ts`). No tiene nada que ver con la captura viva de este documento — no
  compartir nombre ni campo.
- **`CondicionFisica`**: `ILESO → HERIDO → GRAVE → CONVALECIENTE → MUERTO`. `GRAVE`/`CONVALECIENTE`
  son los estados "incapacitado, no muerto" ya usados en combate (solo estos son saqueables) — la
  captura de este documento reutiliza exactamente estos dos estados como precondición.
- **Items de comida/agua ya existen**: `racion-viaje`, `racion-carne`, `racion-goirntes`,
  `odre-agua` — son la moneda real de Comida/Agua de todo este documento, sin inventar recurso
  nuevo.
- **`fictionalMinutes`/`fictionalDateLabel`** (`WorldState`) — el reloj de juego ya real que se usa
  para todo lo que depende de tiempo transcurrido (ver `services/caza.ts`, `turnResolution.ts`). El ritmo de
  Hambre/Sed de este documento se ancla aquí, no a turnos ni a días reales.

---

## 1. Captura (fauna y NPC, mismo mecanismo) — REDISEÑADO 2026-08-28

**Precondición, sin cambios**: el objetivo tiene que estar en `GRAVE` o `CONVALECIENTE` — subyugado
en combate de verdad, nunca un chollo gratis por sorpresa. Coherente con que solo esos dos estados
son "tocables" en el resto del motor.

**Ítem real: `cuerdas`, no `trampa-de-lazo`** (corregido 2026-08-26 — ver
`docs/producto/21-roadmap.md` § "CONVALECIENTE deja de significar victoria automática"). El diseño original
de este punto (2026-08-24) reutilizaba `trampa-de-lazo` ("Trampa de lazo de tendón", equipable, no se
gastaba nunca) — al construir de verdad el botón "Capturar" de la tarjeta Matar/Capturar/Clemente se
sustituyó por `cuerdas` (material consumible, receta con 2 fibra para `carpintero-orcos-llanuras` y
`constructor-orcos-llanuras`): **se consume 1 unidad al atar con éxito**, a diferencia de la trampa
reutilizable. `trampa-de-lazo` queda en el catálogo sin uso real por ahora. Sin `cuerdas` en
inventario, no se puede intentar atar a nadie, ni fauna ni NPC (`POST /saves/:id/capturar/:npcSlug`,
`companeros.ts`). Un ataque/habilidad normal nunca captura por sí solo.

**Rediseño real (nace de un bug de grupo — `NpcState` es una fila compartida por especie+ubicación;
capturar al individuo activo de un grupo cazado rompía la caza del resto, porque el estado viejo
"resucitaba" al siguiente individuo sobre la misma fila que la captura ya estaba usando)**: la
captura deja de vivir como estado de `NpcState` in-situ y pasa a **materializarse como un ítem en el
inventario del jugador** en cuanto se ata con éxito — esto es lo que libera la fila `NpcState`
original para seguir el resto de la caza en grupo con normalidad.

- **Solo 1 captura activa a la vez, para toda la partida** — mientras el jugador lleve una sin
  resolver (ni depositada+tameada, ni soltada/escapada), no puede atar a un segundo objetivo, ni de
  la misma especie ni de otra.
- **Ocupa slots de INVENTARIO** (no una ranura de equipo): Fauna `PEQUEÑA` → 3, `MEDIANA` → 5,
  `GRANDE` → 8 (`jaulaTamanoRequeridoFor`); NPC → 5 fijos (equivalente a MEDIANA, sin tabla propia
  por individuo). Sin hueco suficiente al atar, el intento FALLA directamente (la cuerda no se
  gasta, el objetivo sigue GRAVE/CONVALECIENTE para reintentar tras hacer hueco).
- **Plazo de expiración en el inventario, ANTES de depositar** — ligado al `tier` de la cuerda usada
  al atar (`plazoCapturaHorasForTier`, `companionSupervivencia.ts`), no una cifra única global: tier
  1 → 6h, 2 → 8h, 3 → 12h, 4 → 16h, 5 → 20h, 6 → 24h, 7 → nunca expira. Hoy solo existe la cuerda
  tier 1 en el catálogo; tiers 2-7 quedan sin craftear todavía, el motor ya los soporta sin tocar
  código cuando se añadan. Si expira sin depositarse, la captura se escapa sola del inventario
  (libera el slot de "1 captura a la vez" automáticamente).
- **Sin mecánica especial de pérdida en combate/muerte** — se comporta como cualquier otro objeto
  del inventario: si el jugador muere sin haber guardado con la captura encima, la pierde por el
  reinicio normal al último punto de guardado, no por una regla nueva de "botín valioso".
- Al atar con éxito:
  - **Fauna** → viaja en el inventario hasta depositarse en una **jaula** (ver § 2).
  - **NPC** → viaja en el inventario hasta un destino de "retenido" (ver § 3) — sin edificio propio
    todavía (Celda de Retención, ver nota al final de § 3), de momento expirar el plazo significa
    liberarlo directamente.

---

## 2. Tameo de fauna

### Jaula — destino final tras depositar, YA NO es requisito para intentar atar

Cambio de rol respecto al diseño original (donde la Jaula era la condición previa para poder
intentar tamear en absoluto): ahora la Jaula es donde el jugador **deposita** la captura que ya
lleva en el inventario, típicamente al volver a su Campamento/Reino — antes de depositarla, la
captura no se puede alimentar/tamear todavía. Construcción nueva, tres tamaños — **pequeña/mediana/
grande según el tamaño narrativo YA descrito en la bio de cada especie de fauna** (un Corredor
pequeño necesita jaula pequeña, una Gargántua necesita grande) — sin campo numérico nuevo en el
catálogo, se calibra igual que el resto de datos de fauna (`domesticablePct` etc.), a mano, por
especie.

La jaula es el sitio físico donde se cuida al animal DURANTE el proceso — **no es lo mismo que
tener sitio para quedártelo después**: una vez tameado con éxito, compite por un slot de compañero
como cualquier otro (ver § 4). Si no hay slot libre al completar el tameo, se queda en la jaula o se
suelta.

### El proceso: alimentar = tirada opuesta de atributo, ANCLADA al ritmo real de Hambre/Sed

Dentro de la Jaula, la captura tiene **Hambre/Sed real, igual que un `Companion` ya asentado**
(`lastFedAtMinutes`/`lastWateredAtMinutes`, mismo ritmo que § 4: agua ~5h, comida ~12h de
`fictionalMinutes`) — a diferencia del Companion/jugador ya asentados (donde el tope real es
CONVALECIENTE, nunca MUERTO, ver nota de § 5), **aquí SÍ hay riesgo real de perder la captura por
negligencia**: si no se le da de comer/beber a tiempo, puede morir.

Darle de comer/beber tiene **dos efectos independientes a la vez, no uno sustituyendo al otro**:
1. **Sacia el hambre/sed real** — actualiza `lastFedAtMinutes`/`lastWateredAtMinutes`, esto es lo
   que evita la muerte por negligencia, pase lo que pase con la tirada de abajo.
2. **En el mismo gesto, dispara la tirada opuesta de atributo**: eliges un atributo tuyo, compite
   contra el atributo propio de esa especie (campo de catálogo, calibrado por especie).
   - **Ganas** → sube Felicidad. **Pierdes** → baja Felicidad (puede bajar aunque la captura ya no
     tenga hambre — la comida siempre la salva de morir, pero no garantiza que le guste).

Es decir: alimentar solo se puede hacer cuando de verdad hay hambre/sed real (no es un botón
repetible sin límite), y siempre sacia el hambre, pero la Felicidad solo sube si la tirada sale bien.

**Ventaja del Domador sobre cualquier otra clase** (dos ventajas distintas, no una sola):
1. **Ve el atributo de resistencia ANTES de elegir con qué enfrentarse** — un no-Domador elige a
   ciegas, sin saber contra qué atributo va a competir.
2. **Necesita mucho menos Felicidad acumulada** para completar el tameo con éxito (umbral concreto
   a afinar en vivo, mismo criterio que otras cifras pendientes de este proyecto — la idea cerrada
   es que sea sustancialmente menor, no una diferencia simbólica).

Cualquier clase puede tamear, no es exclusivo de Domador — es la única forma en que "casi difícil
si no eres Domador, no imposible" se cumple sin depender de una profesión ni de tener Reino.

### Al completar el tameo — elección explícita, distinta según clase

- **Domador**: tiene un **slot de mascota propio y garantizado**, separado del todo de
  `companionSlotsForRecipeKey` — no depende de tener Campamento/Choza construidos. Esto sustituye
  lo que `clases.md § Domador nv.12 "Compañero cazador"` describe como "te desbloquea un slot". La
  opción de **Compañero personal** (slot de mascota) solo aparece si el jugador es Domador.
- **Cualquier otra clase**: la fauna tameada se une al **Reino** (guardia/trabajador/productor —
  contenido nuevo, sin roles de Reino formalizados hoy en el motor, a desarrollar cuando toque esta
  pieza), o compite por los slots normales de edificio (Campamento=1, Choza=2) igual que un NPC
  aliado cualquiera si no hay Reino.
- **Sin slot libre de ningún tipo**: la fauna tameada se queda como elemento narrativo del
  campamento (no combate, no Bestiario) o se suelta.

---

## 3. Captura y persuasión de NPC

Mismo mecanismo de atar (§ 1: `GRAVE`/`CONVALECIENTE` + cuerda de captura, viaja en el inventario) y
el mismo esqueleto de tirada opuesta que la fauna:

- **Eliges un atributo tuyo** (Carisma para convencer, Fuerza para amenazar, Inteligencia para
  razonar/negociar — libre elección, no solo Carisma) **contra el atributo de resistencia propio
  del NPC**, fijo en su ficha de catálogo — coherente con su personalidad ya escrita (un NPC
  orgulloso se resiste con Fuerza/Carisma, uno cauteloso con Inteligencia), calibrado a mano igual
  que `domesticablePct` en fauna.
- **`Npc.reclutablePct`/`domesticablePct` son la dificultad base de esta tirada** — APLICADO
  2026-08-25 (`resolverIntento`, `companionSupervivencia.ts`): un NPC/fauna con % alto parte de una
  dificultad más baja de convencer, uno con % bajo (ej. Torgash Ketg, `reclutablePct: 5`) casi nunca
  cede por persuasión sola. **Bug real cerrado la misma auditoría**: entre el diseño (2026-08-24) y
  esta comprobación de lore, la implementación real nunca había llegado a leer estos campos —
  cualquier NPC/fauna era igual de persuadible/domable con los atributos adecuados, sin importar su
  disposición de catálogo. Resistencia extra = `floor((100 - %) / 10)`, sumada al resultado ya
  tirado (nunca se toca `rollOpposed`/dice.ts, primitivo compartido con combate).
- **NPC tiene varias formas de subir Felicidad, no solo alimentar** — hablar con él, darle de
  comer/beber, y más formas a diseñar más adelante (lista deliberadamente abierta, ampliable — para
  la primera versión construible basta con alimentar/dar de beber + hablar).
- Al superar el umbral de Felicidad: **siempre 2 opciones, Reino o Compañero** — sin restricción de
  clase (a diferencia de fauna, donde Compañero personal exige Domador), cualquier jugador puede
  elegir cualquiera de las dos con un NPC.
- Sin slot libre de ningún tipo: se suelta, no se queda esperando indefinidamente.

**Camino alternativo, sin captura**: algunos NPC se reclutan por **misión dedicada** (una quest que
resuelve el reclutamiento por su cuenta, ver `Quest`) — no todo tiene que pasar por atar+convencer;
esto ya encaja con el patrón de quests existente, sin infraestructura nueva.

**Celda de Retención — diseño cerrado, SIN CONSTRUIR (pausado a propósito)**: equivalente a la Jaula
pero para NPC de razas inteligentes (tono narrativo de retención temporal mientras se completa la
persuasión, no una prisión punitiva) — 1 sola receta con 3 niveles mejorables (mismo patrón que el
Ayuntamiento, `upgradesRecipeKey`), capacidad 2 → 4 → 8 NPC retenidos a la vez (distinto de los 5
slots de inventario que ocupa transportar a uno). Explícitamente pausado ("fauna primero, Celda
después") — no bloquea el resto del rediseño, que se centró en fauna en grupo (el bug original).

---

## 4. Comida/Agua — ritmo de consumo (compañeros)

Reutiliza los items reales que ya existen (`racion-viaje`/`racion-carne`/`racion-goirntes` para
comida, `odre-agua` para agua) — nada de recurso abstracto nuevo.

- **Agua** baja más rápido — cada ~5 horas de juego (`fictionalMinutes`), poco a poco.
- **Comida** baja más despacio — cada ~12 horas de juego.
- Si Comida **o** Agua caen por debajo del 25%: Felicidad baja gradualmente, muy despacio (no es
  una caída brusca, es desgaste lento por negligencia).
- Si Comida **y** Agua están ambas a 0% durante **24 horas de juego seguidas**: el compañero muere.

Cifras exactas de "cuánta Felicidad sube/baja por intento" y "umbral de Felicidad para completar el
tameo" (§ 2) quedan como **a afinar en vivo**, mismo criterio que el resto de números pendientes de
este proyecto (ej. costes de Campamento/Ayuntamiento) — el diseño estructural ya está cerrado, los
valores concretos se prueban jugando.

---

## 5. Hambre/Sed del propio personaje (sistema nuevo, diseñado junto a compañeros)

Surgió de la misma conversación — decidido explícitamente diseñarlo ya, no aparcarlo. Mismo ritmo
de reloj que § 4 (agua ~5h, comida ~12h de `fictionalMinutes`), mismos items reales
(`racion-*`/`odre-agua`) como moneda.

**Consecuencia de quedarte sin uno de los dos** (solo agua, o solo comida, nunca los dos a la vez):
la vida baja poco a poco por cada hora de juego sin cubrir esa necesidad, **hasta estabilizarse en
`CONVALECIENTE`** — reutiliza el mismo estado que ya usa el combate (herido grave, no muerto). No
sigue bajando más allá de ahí con solo una carencia.

**Consecuencia de quedarte sin las DOS a la vez** (agua y comida ambas a 0): la vida sigue bajando
sin suelo, **hasta la muerte real** si se ignora del todo — diseño original, sin aplicar todavía.
**Excepción real dejada a propósito (2026-08-25, auditoría de lore)**: la implementación real
(`condicionPorSupervivencia`, `companionSupervivencia.ts`) topa incluso con las DOS carencias a la
vez en `CONVALECIENTE`, igual que con una sola — la muerte por inanición nunca llegó a construirse
(falta enganchar el pipeline real de muerte/respawn). Es la única pieza de todo este documento que
sigue siendo solo diseño; el resto está aplicado.

Esto significa que un personaje `CONVALECIENTE` por hambre/sed que entra en combate ya está a un
paso de la muerte — cruce intencional entre los dos sistemas (supervivencia y combate comparten
vocabulario de estados), no un bug si algún día se construye.

---

## 6. Equipo de compañeros y del Reino (2026-08-24)

Reparto cerrado, dos filosofías distintas a propósito — pocos compañeros personales merecen gestión
manual, muchos súbditos de Reino no:

### Compañero personal (fauna Y NPC) — equipo manual, lo pones tú

- **Fauna**: ranuras reducidas, ya descritas en `clases.md § Domador nv.12` — casco, armadura,
  espalda (bolsa/montacargas/accesorio), variando cuánto según tamaño/nivel de la bestia. Las
  piezas de equipo de mascota **solo se craftean**, nunca se saquean ni se compran.
- **NPC compañero**: **el set completo de 13 ranuras**, exactamente igual que el propio personaje —
  es una persona, no un animal, así que no tiene sentido reducirle el equipo.
- Ambos se gestionan desde un panel propio (Bestiario/Compañeros), tú decides pieza a pieza qué le
  pones — nada automático aquí.

### Reino — equipo automático por plantilla, desde un almacén nuevo

**Almacén de Reino** — pool de objetos NUEVO, separado de tu mochila personal (hoy no existe nada
así: los costes de construcción se pagan directo de tu inventario, no hay ningún fondo compartido
de Reino). Por ahora, **solo entra por depósito manual tuyo** — nada de producción automática de
equipo por trabajadores todavía, eso sería un sistema de producción de Reino aparte, más grande.

**Plantillas** — dos tipos:
- **Básicas, no editables**: vienen ya hechas por rol (guardia/trabajador/productor), listas para
  usar sin configurar nada. APLICADO (2026-08-26): se siembran 3 filas `personalizada: false` en la
  misma transacción de `POST /reino/fundar` — Guardia básico (arma + armadura), Trabajador básico y
  Productor básico (herramienta, ambos), mismo vocabulario de `category` que el resto del catálogo.
  El backend rechaza editarlas/borrarlas (`PATCH`/`DELETE /plantillas/:id`) y el frontend oculta el
  botón "Borrar" para ellas, mostrando "básica" en su lugar.
- **Personalizadas, creadas por ti**: usando el equipo disponible en el Reino, defines tu propia
  plantilla (qué ranuras rellenar con qué tipo de objeto) y se la asignas al rol/grupo que quieras.
  APLICADO tal cual.

Cada súbdito con una plantilla asignada se **auto-equipa** en cuanto haya en el almacén un objeto
que encaje con su plantilla, sin que tengas que hacerlo tú a mano uno a uno.

**Escasez**: si el almacén solo tiene una unidad de algo y varios súbditos con esa plantilla lo
están esperando, **tú defines el orden de prioridad entre plantillas** (qué plantilla se sirve
primero cuando el objeto escasea) — no hay una jerarquía fija tipo "guardias siempre antes que
trabajadores", es un orden editable por ti.

---

## 7. Infraestructura nueva necesaria — APLICADA (2026-08-25)

*Esta sección listaba lo que hacía falta construir; el título original decía "nada de esto existe
hoy" — se deja como referencia histórica de qué se pidió, con el estado real de cada punto
(auditoría de lore 2026-08-25).*

- ~~Item "cuerda de captura" nuevo en `ItemCatalog`~~ — a fecha 2026-08-25 se reutilizaba
  `trampa-de-lazo` (ya existente); **sustituido de verdad 2026-08-26** por `cuerdas`, un item nuevo
  real, consumible al atar — ver § 1 más arriba.
- `Jaula` (pequeña/mediana/grande) — APLICADO, `construction.ts`.
- Campo de "atributo de resistencia" — APLICADO (`Npc.atributoResistencia`).
- `Companion` con Felicidad + Comida/Agua reales — APLICADO
  (`felicidad`/`lastFedAtMinutes`/`lastWateredAtMinutes`).
- Reloj de Hambre/Sed en `Save` — APLICADO (`lastAteAtMinutes`/`lastDrankAtMinutes`).
- Slot de mascota garantizado del Domador — APLICADO (`Companion.esSlotDomador`).
- Roles de Reino (guardia/trabajador/productor) — APLICADO como convención de texto libre
  (`Companion.rolReino`/`Subject.role`), sin enum cerrado — decisión consciente, no un hueco.
- **Almacén de Reino** — APLICADO (`AlmacenItem`).
- **Plantillas de equipo** — APLICADO por completo (`PlantillaEquipo`), incluida la mitad "básicas,
  no editables" (seed al fundar el Reino, ver § 6 más arriba).
