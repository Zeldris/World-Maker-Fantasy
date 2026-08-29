# Rediseño de captura — transporte en inventario, 1 captura a la vez

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de sistema (2026-08-28, sesión conjunta autora/Claude) — nace de investigar un bug real
encontrado probando en vivo: capturar al individuo GRAVE/CONVALECIENTE actual de un grupo cazado
(ej. 2+ buitres del mismo tipo) rompe el resto de la caza en grupo, porque `NpcState` es una fila
COMPARTIDA por especie+ubicación (§ "Bug original que dispara este documento" más abajo). Al discutir
el fix, la conversación derivó en un rediseño más amplio del flujo de captura completo —
**este documento reemplaza §§ 1-3 de `companeros-y-supervivencia.md`**, deja intactas §§ 4-7 de ese
documento (Comida/Agua, Hambre/Sed del jugador, Equipo, infraestructura ya aplicada).

**Estado: FAUNA APLICADA Y VERIFICADA DE PUNTA A PUNTA (2026-08-28)**, backend Y frontend. NPC
capturado queda pendiente de la Celda de Retención (pausada a propósito, ver cierre de ronda 4 más
abajo). Backend: migración, `companeros.ts` reescrito, sweep de expiración enganchado en
`turnResolution.ts`, 1632/1633 tests del suite completo en verde (único fallo el bug preexistente
"decapitar concurrente", ajeno a este trabajo) — incluye un test de integración que reproduce el bug
ORIGINAL exacto (2 buitres en grupo, capturar solo el primero) y confirma que el segundo sigue
cazable. Frontend: `InventarioPanel.tsx` gana una sección nueva "Capturas en tránsito" (Depositar/
Soltar), `CapturaModal.tsx` muestra un mensaje de éxito explicando el paso siguiente en vez de
cerrarse sin más — 105/105 tests de frontend en verde, `tsc -b` limpio en ambos lados. Sin probar en
vivo jugando todavía (solo verificado por tipos/tests, LLM mockeado en los tests de integración).

---

## Bug original que dispara este documento

`NpcState` es una fila por `(saveId, npcId, scope)` — para fauna `PLANTILLA` cazada en grupo
(`groupSize`/`groupDefeated`, `cazar.ts`), esa fila representa **un solo individuo "activo" a la
vez**: cuando cae, si quedan más del grupo, la misma fila "resucita" a ILESO para representar al
siguiente (`turnResolution.ts`, `grupoContinua`).

El flujo de Captura (`POST /saves/:id/capturar/:npcSlug`, `companeros.ts`) marca `capturado: true`
en esa misma fila compartida, sin saber nada de `groupSize`/`groupDefeated` — nunca dispara la
lógica de "resucita al siguiente". Además, `tameo-pendientes/intentar`/`confirmar` localizan la
captura en proceso con `findFirst({ where: { npcId, capturado: true } })`, **sin filtrar por
`scope`** — usan `capturado: true` como único marcador de "esto es lo que se está tameando ahora".

Estas dos piezas (una fila = un rol a la vez, localizado por un booleano sin desambiguar) es lo que
rompe con un grupo: no hay forma de que la misma fila sea "el individuo capturado en tameo" Y "el
individuo activo para seguir cazando al resto del grupo" simultáneamente.

**El rediseño de abajo resuelve esto de raíz**, cambiando el CONCEPTO de captura (deja de vivir
como un estado de `NpcState` in-situ, pasa a materializarse como un ítem propio en cuanto se ata) en
vez de parchear el caso de grupo por separado.

---

## Diseño cerrado con la usuaria (2026-08-28)

### 1. Solo 1 captura activa a la vez, para toda la partida

Regla nueva, no existía antes (hoy se pueden tener varias capturas en proceso de tameo
simultáneas). Mientras el jugador lleve una captura sin resolver (ni convertida en Companion/Reino,
ni soltada/escapada), **no puede atar a un segundo objetivo** — ni de la misma especie ni de otra.
Resuelve el bug de grupo de paso: si ya llevas una captura, tampoco puedes capturar a un segundo
individuo del mismo grupo hasta soltar/confirmar la primera.

### 2. La captura se transporta como un ítem del inventario del jugador

Al atar con éxito (mismo precondición que hoy: `GRAVE`/`CONVALECIENTE` + gastar `cuerdas`), la
captura deja de vivir en `NpcState` in-situ y se materializa como un **ítem nuevo en el inventario
del jugador**, mostrado con el nombre del NPC/fauna y una marca "(Capturado)" — no ocupa una ranura
de equipo normal, ocupa un número de **slots de inventario** según el tamaño de jaula que le
correspondería (reutiliza `jaulaTamanoRequeridoFor`, ya calibrado por especie en
`companionSupervivencia.ts`):

- **PEQUEÑA** → 3 slots.
- **MEDIANA** → 5 slots.
- **GRANDE** → 8 slots.

*(Cifras dadas explícitamente por la usuaria — no son "a afinar en vivo" como el resto de números
de este proyecto, se toman como cerradas.)*

Mientras se lleva así, el jugador puede seguir jugando con normalidad (viajar, combatir, etc.) —
la captura "va con él", no depende de estar en un sitio concreto. Esto es justo lo que libera la
fila `NpcState` del grupo original para seguir "resucitando" al siguiente individuo con normalidad.

### 3. Jaula sigue existiendo, pero como destino final, no como requisito para intentar tamear

Cambio de rol respecto al diseño original (§ 2 de `companeros-y-supervivencia.md`, donde la Jaula
era la condición previa para poder intentar tamear en absoluto): ahora la Jaula es donde el jugador
**deposita** la captura que ya lleva en el inventario, típicamente al volver a su Campamento/Reino.
Antes de depositarla en una Jaula, la captura no se puede alimentar/tamear todavía (coherente con
"la llevas encima, no la estás cuidando activamente hasta que la asientas en algún sitio").

### 4. Límite de tiempo en el inventario, ANTES de depositar en Jaula

Corregido tras aclaración de la usuaria (2026-08-28): **NO es una ventana fija de "3 días" para
completar el tameo** — es un límite de tiempo en el INVENTARIO, entre atar la captura y depositarla
en una Jaula. Si el jugador no la deposita en una Jaula antes de que expire ese plazo, **la captura
se escapa del inventario sola** (se pierde, libera el slot de "1 captura a la vez" automáticamente).
Una vez depositada en la Jaula, este límite deja de aplicar — pasa a regir el punto 5 de abajo.
Cifra exacta del plazo: **a afinar en vivo** (mismo criterio que el resto de números pendientes del
proyecto), no cerrada todavía.

### 5. Dentro de la Jaula: Hambre/Sed real de la captura, alimentar sube Felicidad

Corregido tras aclaración de la usuaria: NO hay una ventana fija de días para el tameo en sí —
reutiliza el mismo sistema de Hambre/Sed ya real de `Companion` (`companionSupervivencia.ts`,
`lastFedAtMinutes`/`lastWateredAtMinutes`, mismo ritmo que § 4 de `companeros-y-supervivencia.md`:
agua ~5h, comida ~12h de `fictionalMinutes`). Mientras está en la Jaula:

- **Comida y agua bajan con el tiempo**, igual que a un Companion normal — si el jugador se
  despista y no le da de comer/beber, **la captura puede morir** (a diferencia de la salvedad de
  "muerte por inanición sin construir" que aplica al Companion/jugador ya asentados — aquí SÍ hay
  riesgo real de perder la captura por negligencia, es parte del reto de domesticarla).
- **CONFIRMADO (ronda 3, corregido): darle de comer/beber tiene DOS efectos independientes A LA
  VEZ, no uno sustituyendo al otro.** (1) **Sacia el hambre/sed real** — actualiza
  `lastFedAtMinutes`/`lastWateredAtMinutes`, esto es lo que evita que la captura muera por
  negligencia, pase lo que pase con la tirada. (2) **En el mismo gesto, dispara la tirada opuesta**
  ya existente (elegir atributo propio vs. resistencia de la especie/NPC) — si gana, sube
  Felicidad; si pierde, baja (mismo `resolverIntento`/`FELICIDAD_GANANCIA`/`FELICIDAD_PERDIDA` de
  `companionSupervivencia.ts`, sin reinventar la fórmula). Es decir: alimentar SIEMPRE sacia el
  hambre (la captura no muere por darle de comer, gane o pierda la tirada), pero la Felicidad solo
  sube si la tirada sale bien — puede incluso BAJAR si sale mal, aunque la captura ya no tenga
  hambre. La diferencia real con el diseño viejo no es la tirada en sí — es que ahora está ANCLADA
  al ritmo real de hambre/sed (no puedes alimentarla cuando quieras sin límite, solo cuando de
  verdad tiene hambre/sed) en vez de ser un botón de "intentar alimentar" suelto y repetible sin
  restricción.
- **Fauna**: darle de comer/beber cuando tiene hambre/sed es la única vía de subir Felicidad.
- **NPC**: varias formas de subir Felicidad, no solo alimentar — **hablar con él, darle de
  comer/beber, y probablemente más formas a diseñar más adelante** ("y más cosas que ya
  pensaremos", cita textual de la usuaria) — este documento deja la lista de formas para NPC como
  ABIERTA, ampliable en una pasada futura, no cerrada hoy. Sin confirmar todavía si "hablar" (a
  diferencia de comer/beber) también depende de algún reloj propio o se puede hacer libremente.
- Al alcanzar el rango de Felicidad adecuado (umbral, cifra a afinar en vivo igual que en el diseño
  original), se puede completar el tameo — mismo desenlace que § 6 de abajo (elección Reino/
  Compañero).

### 6. Al completar Felicidad — elección explícita, distinta para fauna y NPC

- **Fauna tameada**: se une al **Reino** (como guardia/trabajador/productor, igual que el diseño
  viejo) — la opción de que sea **Compañero personal** (slot de mascota) solo aparece si el jugador
  **es Domador** (mismo criterio que ya existía: la ventaja real del Domador es tener esa opción
  extra, no solo tamear más fácil).
- **NPC persuadido** (raza inteligente): siempre 2 opciones, **Reino** o **Compañero** — sin
  restricción de clase, cualquier jugador puede elegir cualquiera de las dos con un NPC.

---

## Qué se mantiene igual del diseño original (`companeros-y-supervivencia.md`)

- Precondición de captura: `GRAVE`/`CONVALECIENTE`, ítem `cuerdas` consumido al atar con éxito.
- Mecanismo de tirada opuesta (atributo propio vs. resistencia de catálogo,
  `reclutablePct`/`domesticablePct` como dificultad base).
- Ventajas del Domador (ver atributo antes, umbral de Felicidad menor).
- §§ 4-7 completas: Comida/Agua de compañeros, Hambre/Sed del jugador, Equipo (ranuras reducidas de
  fauna / 13 ranuras de NPC), Almacén de Reino + Plantillas — nada de esto cambia.
- Camino alternativo de reclutamiento por misión dedicada (sin pasar por atar+convencer).

---

## Confirmado por la usuaria (2026-08-28, rondas 2-3) — TODO cerrado

- **Soltar/liberar en cualquier momento**: SÍ, siempre — tanto llevando la captura en el
  inventario como ya depositada en la Jaula. Libera el slot de "1 captura a la vez" al instante.
- **Plazo en el inventario antes de depositar en Jaula**: confirmado que existe — si expira, la
  captura se escapa sola del inventario. Cifra exacta a afinar en vivo.
- **Dentro de la Jaula, sin límite de tiempo fijo**: el proceso de tameo en sí no caduca — lo que
  arriesga a la captura es la negligencia (no alimentarla/darle de beber), que puede matarla, no un
  reloj de cuenta atrás.
- **Sin hueco en el inventario al atar**: el intento de atar FALLA directamente (mismo criterio que
  cualquier objeto que no cabe en un inventario lleno) — mensaje claro, la cuerda no se gasta, el
  objetivo sigue GRAVE/CONVALECIENTE para reintentar después de hacer hueco.
- **Riesgo en combate/muerte mientras se lleva la captura**: NO hay ninguna mecánica especial de
  pérdida — se comporta exactamente como cualquier otro objeto del inventario. Si el jugador muere
  sin haber guardado la partida con la captura encima, la pierde por el propio reinicio al último
  punto de guardado (mecanismo ya existente del juego), no por una regla nueva de "botín valioso
  que se pierde en combate".
- **La tirada opuesta de atributo SIGUE existiendo, con DOS efectos simultáneos al alimentar** (no
  uno sustituyendo al otro): darle de comer/beber SIEMPRE sacia el hambre/sed real (evita la
  muerte por negligencia, pase lo que pase con la tirada) Y, en el mismo gesto, dispara la tirada
  opuesta que puede subir O bajar la Felicidad. Ver detalle completo en § 5 arriba.

## Preguntas abiertas — todavía sin cerrar

1. **Lista completa de "formas de subir Felicidad" para NPC** (hablar, alimentar... "y más cosas
   que ya pensaremos") — dejada deliberadamente abierta por la usuaria, ampliable después; para la
   primera versión construible basta con alimentar/dar de beber + hablar. No bloqueante.
2. **Migración de datos**: hoy no hay ninguna captura en curso en partidas reales que migrar (el
   sistema apenas se ha usado), así que no debería hacer falta una migración de datos con cuidado
   especial — asumido como aceptable sustituir el flujo viejo sin preservar estado a medias de
   partidas existentes, salvo que la usuaria diga lo contrario al construir.

## Cierre de ronda 4 (2026-08-28) — slots de NPC, plazo ligado a tier de cuerda, Celda de Retención

### Slots de inventario que ocupa una captura

- **Fauna**: `jaulaTamanoRequeridoFor` de siempre (3/5/8, sin cambios).
- **NPC**: **5 slots fijos** (equivalente a MEDIANA) — un humanoide adulto no es tan voluminoso
  como una bestia GRANDE ni tan pequeño como una PEQUEÑA, sin necesidad de calibrar cada NPC uno a
  uno con una tabla nueva.

### Plazo de expiración en inventario — ligado al TIER de la cuerda usada al atar, no una cifra fija

Corregido tras la ronda 4: el plazo NO es una cifra única global — depende de la calidad de la
cuerda con la que se ató. Cifras dadas explícitamente por la usuaria:

| Tier de cuerda | Plazo en inventario |
|---|---|
| 1 | 6h |
| 2 | 8h |
| 3 | 12h |
| 4 | 16h |
| 5 | 20h |
| 6 | 24h |
| 7 | Nunca expira, no puede escaparse |

**Por ahora solo existe la cuerda tier 1** (`cuerdas`, `worldCatalog.ts` — gana un campo `tier: 1`
explícito, ya era el default de `ItemCatalog.tier`, se hace explícito). Tiers 2-7 quedan sin
diseñar/craftear todavía — cuando se añadan al catálogo con su `tier` correspondiente, la tabla de
arriba ya los cubre sin tocar el motor. El código de expiración lee `ItemCatalog.tier` de la cuerda
realmente consumida al atar (no un valor fijo), vía una función pura `plazoCapturaHorasForTier(tier)`
en `companionSupervivencia.ts`, mismo patrón que `npcCorpseShouldDespawn`/`npcRecoversFromConvaleciente`
(`death.ts`): puro, `sinceMinutes` + `nowMinutes` → booleano de "toca expirar".

**Aplica igual a fauna y NPC** (confirmado ronda 4: "Mismo plazo que fauna, ligado a la cuerda") —
si expira sin depositarse, la captura se escapa/libera del inventario sola. Para fauna eso significa
"no llegó a una Jaula"; para NPC, sin edificio de destino propio hasta que se construya la Celda de
Retención (ver abajo), de momento expirar significa liberarlo directamente.

### Celda de Retención — edificio nuevo para NPC capturados, diseño cerrado pero SIN CONSTRUIR

Equivalente a la Jaula pero para NPC de razas inteligentes — un NPC capturado no se deposita en una
Jaula (esa es solo para fauna), necesita su propio destino. **Decisión explícita de la usuaria**:
"no en sí una cárcel... pero el proceso debe ser el mismo que la fauna" — mismo rol estructural
(destino final tras atar, capacidad limitada, se comprueba igual que `capturaJaulaBuildingId`), tono
narrativo distinto (retención temporal mientras se completa la persuasión, no una prisión punitiva).

- **1 sola receta con 3 niveles mejorables** (mismo patrón EXACTO que el Ayuntamiento —
  `upgradesRecipeKey`/`ayuntamientoNivel` en `construction.ts`, las 3 filas comparten `key:
  'celda-retencion'`): **2 → 4 → 8 slots** (capacidad de NPC retenidos a la vez, NO slots de
  inventario — es la capacidad del edificio, distinto concepto que los 5 slots de inventario que
  ocupa transportar a un NPC capturado).
- Nombre de trabajo: "Celda de Retención" (pequeña/mediana/grande, igual que Ayuntamiento) — sin
  cerrar descripción narrativa/materiales/requisitos todavía, eso se decide al implementar esta
  pieza.
- **Explícitamente PAUSADO**: "Fauna primero, Celda después" — esta pieza no bloquea ni se
  construye en la misma tanda que el resto del rediseño de captura. El flujo de NPC capturado queda
  con el mismo hueco que tiene hoy (Capturar/tameo de NPC ya funciona para 1 individuo — el trabajo
  de esta tanda se centra en FAUNA en grupo, que es el bug original) hasta que se retome esta pieza.

---

## Trabajo a hacer cuando se cierre el diseño (borrador, sujeto a las preguntas pendientes)

- Nuevo campo/mecanismo para representar "captura en el inventario" — probablemente un
  `ItemCatalog`/`InventoryItem` sintético por captura concreta (no un slug de catálogo fijo, cada
  captura es una instancia con su propio NPC origen) — evaluar la forma exacta al implementar,
  coherente con cómo ya funciona el inventario real.
- Quitar el requisito de Jaula libre en el momento de ATAR (`companeros.ts`, endpoint de
  capturar) — la Jaula pasa a comprobarse al DEPOSITAR, no al atar.
- Nuevo endpoint de "depositar captura en Jaula" (o reutilizar el patrón de Almacén de
  Reino/`depositar`, que ya existe para objetos normales).
- Regla de "1 captura activa a la vez" — nuevo chequeo en el endpoint de capturar, antes del claim
  atómico existente.
- Nuevo endpoint de "soltar/liberar captura" (disponible tanto en inventario como en Jaula).
- Plazo de expiración en inventario (fuera de Jaula) — nuevo campo de timestamp
  (`fictionalMinutes` de cuándo se ató), gate que la libera automáticamente si expira sin
  depositarse.
- Reutilizar Hambre/Sed real de `Companion` (`lastFedAtMinutes`/`lastWateredAtMinutes`) para la
  captura en Jaula, con riesgo real de muerte por negligencia (a diferencia del Companion/jugador
  ya asentados, donde la muerte por inanición se dejó sin construir a propósito).
- Elección Reino/Compañero al completar Felicidad — ampliar el endpoint de `confirmar` (hoy fijo a
  Companion) con la rama de Reino, y la restricción de Domador para fauna.
- Actualizar `companeros-y-supervivencia.md` §§ 1-3 para apuntar aquí, o fusionar ambos documentos
  una vez cerrado y aplicado (decidir al construir, mismo criterio que otros documentos de esta
  sesión que se fusionaron tras aplicarse).
