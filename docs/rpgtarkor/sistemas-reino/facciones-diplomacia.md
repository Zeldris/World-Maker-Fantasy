# Facciones y diplomacia — motor de relaciones estilo X4

[← Volver al índice](mundo-vivo-x4.md)

---

### 4.3 Generalización de `worldAgenda.ts` — de un conflicto hardcodeado a un motor de disputas

Hoy: un único `CONFLICTO_ID` fijo, con 5 `STAGE_FACTS` de texto escritos a mano, bandos fijos
(Serhu+Concordia vs. Helsig+Goshg), que avanza por tiempo puro sin ninguna condición de disparo
real (siempre está "en marcha" desde el principio de cualquier partida).

Propuesta de generalización (a validar en sesión de implementación, aquí solo se deja planteada la
forma):

- Nuevo modelo `FactionRelation` (o `FactionConflict`, nombre a decidir) — par de facciones
  (`factionAId`, `factionBId`), tipo de relación (`NEUTRAL`/`TENSION`/`GUERRA`/`ALIANZA`/
  `TRATADO_COMERCIAL`), un valor numérico de "presión" (equivalente a `factionsStatus` pero entre
  dos facciones NPC, no jugador↔facción), y opcionalmente una etapa (mismo concepto que
  `STAGE_FACTS` hoy, pero generado por plantilla en vez de 5 líneas fijas por conflicto).
- Condiciones de disparo de un conflicto NUEVO (no el único ya existente) — candidatas a decidir en
  implementación: choque de expansión territorial (dos facciones reclamando la misma región vía el
  `Territory` ya generalizado en 4.2), presión acumulada por reputación cruzada, o ambas a la vez
  con pesos.
- El conflicto Serhu/Concordia vs. Helsig/Goshg actual se convierte en la PRIMERA fila real de este
  sistema genérico (dato, no código especial) — su texto narrativo curado a mano se conserva como
  contenido, pero el motor que lo avanza deja de ser una función dedicada a ese único caso.

### 4.4 Diplomacia comercial / mercado regulado — DIPLOMACIA CERRADA (2026-09-21, sesión
posterior), mercado regulado sin diseñar todavía

**Diplomacia del jugador — CERRADA e IMPLEMENTADA**, diseño completo en § 5-bis punto 6: acción
puntual estilo Agente de X4 (Negociación/Sabotaje/Espionaje), nunca presencia sostenida tipo
Bannerlord (habría exigido poblar Inteligencia en todas las facciones NPC destino, alcance
descartado explícitamente). `Companion`/`Subject` del jugador con `rolReino:'diplomatico'` y su
propio `ProfessionProgress.companionId` — nunca un `Npc` de facción (distinción Companion-vs-Npc).

Implementado: `POST /saves/:id/reino/diplomacia` (`reino.ts`) — 3 acciones (`negociar`/`sabotear`/
`espiar`), 2 `FactionEventType` nuevos (`NEGOCIACION_TREGUA` peso -12, `SABOTAJE_DIPLOMATICO` peso
+10, más moderados que los eventos "de mundo" 15/8) más `espiarFactionRelation` (nunca mueve
`presion`, primera vía real por la que el jugador ve el estado de una `FactionRelation`). Gate de
nivel nuevo (`nivelDiplomaticoRequerido`, `factionRelations.ts`): cuanto más lejos del neutro (50)
ya está la relación, más nivel exige moverla más — mismo criterio "cuesta más romper algo ya
asentado" que el resto del proyecto. Profesión `'diplomatico'` nueva en `professions.ts`
(frontend), sin sufijo raza/región (no depende de recursos locales, mismo criterio que "cazador"/
"mercader"). 5 tests de integración + 4 unitarios nuevos. Verificado: `tsc -b` limpio, suite
completa 2643/2643 en verde (aislado).

**Mercado regulado jugador↔Faction — CERRADO e IMPLEMENTADO** (2026-09-21, sesión posterior). Las 4
preguntas se resolvieron con grounding real (`WebSearch` X4: "automatic pricing means that a
station will automatically lower the ware price the more wares in stock, and vice versa" — precio
NUNCA es un tick de oferta/demanda simulado aparte, es una fórmula derivada del STOCK ACTUAL):

- **Precio dinámico**: `precioDinamico(valorGoirnos, stockDisponible)` (`economia.ts`) — factor
  0.5x-2x sobre `ItemCatalog.valorGoirnos` (el valor FINAL ya curado a mano, no
  `valorGoirnosBaseFor` recalculado de bruto), interpolado según el stock real de quien vende
  (`AlmacenItem.count`). Sin tick propio, se calcula en el momento de cada compra/venta.
- **Dos monedas separadas** (matiz real de Álvaro, más preciso que las dos opciones planteadas):
  jugador↔Faction con `Save.goirnos` (dinero individual, ya existía, solo usado antes para
  aprender oficio) — CERRADO. Reino↔Faction con `KingdomStats.riqueza` (comercio de volumen) queda
  como pieza aparte, sin código todavía (ver abajo).
- **`ItemCatalog.valorGoirnos`** (el valor final ya ajustado en `worldCatalog.ts`, no
  `valorGoirnosBaseFor` de bruto) es el precio base real que el mercado escala.
- **Tratado comercial como requisito real**: sin `FactionRelation.type` en `TRATADO_COMERCIAL` o
  `ALIANZA` con esa `Faction`, no hay acceso al mercado — cierra el bucle diplomacia→mercado
  (negociar de verdad ABRE comercio, sabotear lo CIERRA).

**Pieza que faltaba, resuelta al escribir el código**: `AlmacenItem` era 100% `saveId` (nunca
generalizado a facciones NPC, ver § 5-bis punto 2) — sin stock real de la Faction, no hay contra
qué comprar. Generalizado a `factionId` opcional (mismo XOR + `CHECK CONSTRAINT` real que
`ProfessionProgress`, criterio aplicado también a un modelo EXISTENTE que se toca en esta sesión,
no solo a los recién creados) — una `Faction` con `OrdenProduccion` activa acumula stock real ahí,
exactamente igual que el jugador.

Implementado: `POST /saves/:id/reino/mercado/comprar` y `/vender` (`reino.ts`) — comprar mueve
`Save.goirnos` y traspasa el `AlmacenItem` de `factionId` a `saveId`; vender al revés. Mismo patrón
de error interno capturado (`SinTratadoComercialError`/`StockInsuficienteError`) que diplomacia. 4
tests de integración + 8 unitarios de `precioDinamico`/`factorPrecioPorStock` nuevos. Verificado:
`tsc -b` limpio, suite completa 2657/2657 en verde.

**Comercio de volumen Reino↔Faction (`KingdomStats.riqueza`) — sin diseñar todavía**, pieza
separada pendiente: ¿qué se comercia (recursos de `OrdenProduccion` agregados, no objetos
individuales), a qué escala, y si usa el mismo `precioDinamico` o una fórmula propia de volumen.


---

### 7.2 Líder de facción — CERRADO

Punto abierto #5 (Inteligencia de facción): **la de su líder de GOBIERNO** (Terk'ikar/equivalente,
no el de guerra — decisión explícita de Álvaro, contra la recomendación de Claude de un campo
propio desacoplado). `Faction.liderNpcId` (FK real a `Npc`, a diferencia de `Npc.faction`/
`FactionBuilding.factionSlug` que son string libre — aquí sí hay una referencia estable real,
ambos catálogo del mismo `World`).

Hallazgo real: cada facción tiene DOS líderes de lore (gobierno + guerra) y **Clan Goshg no tenía
ningún NPC real sembrado** (solo prosa en `Location`/`Faction.description`). Resuelto sembrando
`doshka`/`dulgren` en `worldCatalog.ts` (mismo shape que Brenka/Solgra de Helsig, `nucleoJugable:
false` — fuera del núcleo jugable actual, coherente con su región). Líderes reales sembrados:
Serhu→Ulkha Ketg (Int 20), Helsig→Brenka (16), Goshg→Doshka (15), Concordia→Yovenne Tal (15).

### 7.2-bis Facciones nuevas aprobadas (2026-09-27) — pendientes de código

Primera tanda de propuestas de lore aprobadas. Ficha completa (descripción para `FactionInput`, líder,
población y relaciones iniciales) en `docs/borradores-opencode/propuestas-aprobadas.md` (A-01 a A-05,
A-37 a A-39).

| Facción | Raza | Región | Líder (`liderNpcId`) | Población |
|---|---|---|---|---|
| Los del Obelisco | goirntes | La Meseta del Orden (compartida con la Concordia) | `yovenne-tal` | 300 del pool `goirntes` |
| Keseg Sael | nabieus | El Margen Silencioso, mitad oriental | `aven-tessk`, portavoz de cónclave, sin cargo | 1.500 del pool `nabieus` |
| Keseg Prisilke | nabieus | Ciénaga Troncal (compartida con el Clan Goshg) | `ilka-dren` | 500 del pool `nabieus` |
| Feg Tusha | faerus | El Margen Silencioso, mitad occidental | `hulki` | 850 del pool `faerus` |
| Feg Ger | faerus | franja sur de las Llanuras, sin ser dueña | `yeru` | 200 del pool `faerus` |

**Cambios de código que implica:**
- `seed-catalog.ts` → `FACTION_LEADER_SLUG['concordia-de-hierro']` pasa de `yovenne-tal` a
  `tarsen-vold` (NPC nuevo). Corrige la incoherencia actual con `historia.md`, donde Yovenne es la
  oposición moderada.
- `reputation.ts` → `REGION_OWNING_FACTIONS`: `'La Meseta del Orden': ['Concordia de Hierro', 'Los del
  Obelisco']`, `'Ciénaga Troncal': ['Clan Goshg', 'Keseg Prisilke']`, `'El Margen Silencioso':
  ['Keseg Sael', 'Feg Tusha']`. El Margen deja de ser `SIN_DUENO` (`mundo-vivo-x4.md` § 5-bis punto 12).
- `FactionRelation` inicial: Concordia ↔ Los del Obelisco, presión 65 (TENSION). Las demás, según las
  tablas de relaciones de cada ficha.
- Los Faerus deciden desde el *Jakut*, sin cargo: su `liderNpcId` es quien más a menudo se sienta en
  él (ver [razas.md § Faerus](../lore-mundo/razas.md#faerus--los-furiosos)).

### 7.3 Motor de eventos de `FactionRelation` — CERRADO (diseño + código base), sin enganchar a eventos reales todavía

Punto abierto #6 (disparo de disputas): **reemplaza** el avance automático por tiempo puro del
`CONFLICTO_ID` original (decisión explícita de Álvaro). Forma final, cerrada tras contrastar con
el modelo real de X4 (Claude verificó cómo funciona X4 de verdad antes de proponer números):
**híbrido X4 + reputación estilo WoW**, no ambiente continuo:

- `FactionRelation` (nuevo modelo, DIRIGIDA a propósito — `sourceFactionId`→`targetFactionId`,
  nunca simétrica; decisión de Álvaro: "lo más completo y genérico para ampliar", against la
  opción simétrica más simple que Claude recomendó primero).
- `presion` 0-100 (50 = neutro) sube/baja por EVENTOS DISCRETOS con peso propio (estilo X4 real:
  sucesos puntuales, nunca "¿comparten región ahora mismo?" evaluado en cada tick) — bandas con
  nombre deciden `type` (0-19 ALIANZA / 20-39 TRATADO_COMERCIAL / 40-59 NEUTRAL / 60-79 TENSION /
  80-100 GUERRA), mismo espíritu que `reputation.ts` (bandas de 1000 sobre 0-5000).
- Decaimiento pasivo -1/semana de ficción sin eventos nuevos, hacia el neutro (nunca cruza de
  golpe, se detiene en 50).
- Código: `src/services/factionRelations.ts` (funciones puras: `typeForPresion`, `stageForPresion`,
  `applyFactionEvent`, `decayPresion`, `stageFactFor` — plantilla de texto por banda, generado con
  nombres de ambas facciones en vez de las 5 líneas fijas por conflicto del `STAGE_FACTS`
  original) + `recordFactionEvent`/`ensureFactionRelation` (wrapper Prisma). 16 tests unitarios en
  verde (`factionRelations.test.ts`).
- **Pendiente real, sin cerrar**: NINGÚN caller en producción todavía dispara
  `recordFactionEvent` — los 2 eventos definidos (`EXPANSION_TERRITORIAL_AGRESIVA`,
  `BAJA_DE_GUERRA`) están tipados pero sin enganchar. El enganche real quedó bloqueado por la
  pieza de conquista territorial de § 7.4 (más abajo) — decidir juntos en la próxima sesión cómo
  se conectan.
- `worldAgenda.ts` (el conflicto original Serhu+Concordia vs. Helsig+Goshg) **todavía no se ha
  tocado ni retirado** — sigue funcionando en paralelo, sin migrar a `FactionRelation` todavía.
  Migrar su única fila real a la primera fila de este sistema genérico (tal como proponía § 4.3)
  queda pendiente.

