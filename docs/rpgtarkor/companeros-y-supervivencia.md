# Helek Sirik — Compañeros y supervivencia

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-24, sesión conjunta autora/Claude) — captura y tameo de fauna/NPC como
compañeros, y de paso el sistema de Hambre/Sed del propio personaje (surgió de la misma
conversación, comparte ritmo e items). **Nada de esto está implementado en el motor todavía**:
documentación pura, mismo criterio que `clases.md`. Referencia cruzada obligada con
`docs/17-reglas-construcciones-reino.md` (slots de compañero por edificio, ya real),
`clases.md § Cazador — Domador` (ventajas de esta clase sobre el resto de este sistema) y
[combate-multiple.md](combate-multiple.md) — que un compañero luche de verdad a tu lado depende por
completo de esa pieza (necesita atributos/vida propios, hoy `Companion` es puramente narrativo).*

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
  presa débil (`cazar.ts`). No tiene nada que ver con la captura viva de este documento — no
  compartir nombre ni campo.
- **`CondicionFisica`**: `ILESO → HERIDO → GRAVE → CONVALECIENTE → MUERTO`. `GRAVE`/`CONVALECIENTE`
  son los estados "incapacitado, no muerto" ya usados en combate (solo estos son saqueables) — la
  captura de este documento reutiliza exactamente estos dos estados como precondición.
- **Items de comida/agua ya existen**: `racion-viaje`, `racion-carne`, `racion-goirntes`,
  `odre-agua` — son la moneda real de Comida/Agua de todo este documento, sin inventar recurso
  nuevo.
- **`fictionalMinutes`/`fictionalDateLabel`** (`WorldState`) — el reloj de juego ya real que se usa
  para todo lo que depende de tiempo transcurrido (ver `cazar.ts`, `turnResolution.ts`). El ritmo de
  Hambre/Sed de este documento se ancla aquí, no a turnos ni a días reales.

---

## 1. Captura (fauna y NPC, mismo mecanismo)

**Precondición**: el objetivo tiene que estar en `GRAVE` o `CONVALECIENTE` — subyugado en combate de
verdad, nunca un chollo gratis por sorpresa. Coherente con que solo esos dos estados son "tocables"
en el resto del motor.

**Objeto nuevo necesario**: una cuerda de captura (`ItemCatalog`, categoría herramienta/consumible,
nombre a decidir al escribirla en catálogo) — sin ella equipada/en inventario, no se puede intentar
atar a nadie, ni fauna ni NPC. Un ataque/habilidad normal nunca captura por sí solo.

Al atar con éxito:
- **Fauna** → pasa a esperar en una **jaula** (ver § 2) mientras se intenta tamear.
- **NPC** → pasa a un estado "retenido", a la espera de persuasión (ver § 3).

---

## 2. Tameo de fauna

### Jaula — requisito para poder INTENTAR tamear (no es el slot final)

Construcción nueva, tres tamaños — **pequeña/mediana/grande según el tamaño narrativo YA descrito
en la bio de cada especie de fauna** (un Corredor pequeño necesita jaula pequeña, una Gargántua
necesita grande) — sin campo numérico nuevo en el catálogo, se calibra igual que el resto de datos
de fauna (`domesticablePct` etc.), a mano, por especie.

La jaula es el sitio físico donde se cuida al animal DURANTE el proceso — **no es lo mismo que
tener sitio para quedártelo después**: una vez tameado con éxito, compite por un slot de compañero
como cualquier otro (ver § 4). Si no hay slot libre al completar el tameo, se queda en la jaula o se
suelta.

### El proceso: alimentar = tirada opuesta de atributo

Cada intento de alimentar a la fauna capturada es una tirada: **eliges un atributo tuyo, compite
contra el atributo propio de esa especie** (campo nuevo de catálogo, calibrado por especie —
coherente con que cada fauna ya tiene rasgos/personalidad propios en su ficha).

- **Ganas** la tirada → sube Felicidad, el animal come.
- **Pierdes** → baja Felicidad, no come ese intento (se pierde la ración usada).

**Ventaja del Domador sobre cualquier otra clase** (dos ventajas distintas, no una sola):
1. **Ve el atributo de resistencia ANTES de elegir con qué enfrentarse** — un no-Domador elige a
   ciegas, sin saber contra qué atributo va a competir.
2. **Necesita mucho menos Felicidad acumulada** para completar el tameo con éxito (umbral concreto
   a afinar en vivo, mismo criterio que otras cifras pendientes de este proyecto — la idea cerrada
   es que sea sustancialmente menor, no una diferencia simbólica).

Cualquier clase puede tamear, no es exclusivo de Domador — es la única forma en que "casi difícil
si no eres Domador, no imposible" se cumple sin depender de una profesión ni de tener Reino.

### Al completar el tameo — se convierte en Companion

- **Domador**: tiene un **slot de mascota propio y garantizado**, separado del todo de
  `companionSlotsForRecipeKey` — no depende de tener Campamento/Choza construidos. Esto sustituye
  lo que `clases.md § Domador nv.12 "Compañero cazador"` describe como "te desbloquea un slot".
- **Cualquier otra clase**: la fauna tameada compite por los slots normales de edificio
  (Campamento=1, Choza=2), igual que un NPC aliado cualquiera.
- **Con Reino**: la fauna tameada, ADEMÁS de (o en vez de, según sitio disponible) ocupar un slot de
  compañero, puede integrarse como **guardia, trabajador o productor** del Reino — el rol concreto
  depende de la especie y de lo que se especifique al construirlo (ej. un Corredor de Cauce como
  productor de algo relacionado con su comportamiento, un Makt'orik como guardia). Esto es contenido
  nuevo, sin roles de Reino formalizados hoy en el motor (no existe ningún enum de rol) — a
  desarrollar cuando toque esta pieza.
- **Sin Reino**: nada cambia respecto a lo de arriba — Reino NO es requisito para tener un
  compañero real y utilizable (con Domador o con slot de edificio). Reino solo añade la opción
  EXTRA de integrarlo como guardia/trabajador/productor. Sin slot libre de ningún tipo, la fauna
  tameada se queda como elemento narrativo del campamento (no combate, no Bestiario) o se suelta.

---

## 3. Captura y persuasión de NPC

Mismo mecanismo de atar (§ 1: `GRAVE`/`CONVALECIENTE` + cuerda de captura) y el mismo esqueleto de
tirada opuesta que la fauna:

- **Eliges un atributo tuyo** (Carisma para convencer, Fuerza para amenazar, Inteligencia para
  razonar/negociar — libre elección, no solo Carisma) **contra el atributo de resistencia propio
  del NPC**, fijo en su ficha de catálogo — coherente con su personalidad ya escrita (un NPC
  orgulloso se resiste con Fuerza/Carisma, uno cauteloso con Inteligencia), calibrado a mano igual
  que `domesticablePct` en fauna.
- Ganas → sube Felicidad. Pierdes → baja Felicidad.
- Al superar el umbral de Felicidad: eliges que sea **Companion**, o (si hay Reino) que se **una al
  Reino** en vez de ser compañero personal.
- Sin slot libre de ningún tipo: se suelta, no se queda esperando indefinidamente.

**Camino alternativo, sin captura**: algunos NPC se reclutan por **misión dedicada** (una quest que
resuelve el reclutamiento por su cuenta, ver `Quest`) — no todo tiene que pasar por atar+convencer;
esto ya encaja con el patrón de quests existente, sin infraestructura nueva.

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
sin suelo, **hasta la muerte real** si se ignora del todo.

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
  usar sin configurar nada.
- **Personalizadas, creadas por ti**: usando el equipo disponible en el Reino, defines tu propia
  plantilla (qué ranuras rellenar con qué tipo de objeto) y se la asignas al rol/grupo que quieras.

Cada súbdito con una plantilla asignada se **auto-equipa** en cuanto haya en el almacén un objeto
que encaje con su plantilla, sin que tengas que hacerlo tú a mano uno a uno.

**Escasez**: si el almacén solo tiene una unidad de algo y varios súbditos con esa plantilla lo
están esperando, **tú defines el orden de prioridad entre plantillas** (qué plantilla se sirve
primero cuando el objeto escasea) — no hay una jerarquía fija tipo "guardias siempre antes que
trabajadores", es un orden editable por ti.

---

## 7. Infraestructura nueva necesaria (nada de esto existe hoy — resumen para cuando toque construirlo)

- Item "cuerda de captura" nuevo en `ItemCatalog`.
- `Jaula`: tipo de construcción nuevo (pequeña/mediana/grande), en `construction.ts` — igual que
  Ayuntamiento tiene 3 tamaños con receta propia.
- Campo de "atributo de resistencia" nuevo, tanto en catálogo de fauna como en NPCs reclutables.
- `Companion` necesita Felicidad + Comida/Agua actuales como campos reales (hoy solo
  `name`/`role`/`notes`) — y distinguir fauna de NPC si el comportamiento diverge lo suficiente al
  construirlo.
- Reloj de Hambre/Sed en `Save` (dos contadores, comida y agua) + lógica de tick basada en
  `fictionalMinutes` — nuevo, sin precedente de "contador que baja con el tiempo" en el motor hoy
  (lo más parecido es `NpcState.condicionFisicaSinceMinutes`, que solo registra un instante, no
  decae).
- Slot de mascota garantizado del Domador, separado de `companionSlotsForRecipeKey`.
- Roles de Reino (guardia/trabajador/productor) para compañeros integrados — no existe ningún enum
  de rol de Reino hoy, `Companion.role`/`Subject.role` son texto libre.
- **Almacén de Reino** — modelo nuevo del todo, pool de objetos equipables a nivel de Reino,
  separado de `InventoryItem` personal.
- **Plantillas de equipo** — modelo nuevo (nombre, lista de ranuras/tipos deseados, básica o
  personalizada) + asignación a rol/grupo de súbditos + orden de prioridad editable entre
  plantillas para cuando el almacén escasea.
