# Roadmap — Tarkor (octubre 2026 → septiembre 2027)

**Actualizado:** 2026-09-28. Todo lo pendiente se ha comprobado contra el código ese día.
**En curso:** [plan-roadmap-oct-2026.md](plan-roadmap-oct-2026.md) (Ahora + Trimestre 1): fases 1-8 y 10 (tiradas visibles, `c088f1d`) hechas; fase 9 (verificación en vivo) en curso.
**Historial:** lo cerrado antes de esta fecha está en
[archivo/21-roadmap-2026-09-historico.md](../archivo/21-roadmap-2026-09-historico.md) y en los
roadmaps anteriores de [archivo/](../archivo/).

**Cómo se usa:**
- Cada punto lleva origen (quién lo pidió o dónde se detectó) y estado.
- Al cerrar uno, se tacha aquí con su commit. El detalle va al registro correspondiente, no aquí.
- **🧭 = decide Álvaro antes de empezar.** Nada marcado así se implementa sin su respuesta.
- Origen: **[A]** pedido o decidido por Álvaro · **[H]** hallazgo verificado en código · **[P]**
  propuesta de Claude.

---

## Meta del año

1. **Pre-alpha jugable en Las Llanuras** (final de 2026). Una partida completa con Gorhorn, sin
   huecos que rompan el juego: explorar la zona, combatir, oficios, compañeros y un Reino que
   produce y comercia de verdad.
2. **Mundo vivo de verdad** (primer semestre de 2027). Las facciones NPC actúan solas en
   `worldTick`: construyen, se expanden, envían expediciones y se declaran la guerra. El jugador ve
   las consecuencias.
3. **Segunda y tercera región jugables** (Cristal Helado y la Ciénaga) con su contenido de lore
   aprobado.
4. **Distribuible** (septiembre de 2027): instalador, rendimiento aceptable en la Steam Deck y un
   narrador local afinado.

---

## Ahora (octubre de 2026): bloqueantes verificados

Rompen una mecánica en partida real. Referencias H-x:
[22-mundo-vivo-x4-tecnico.md § 9](../arquitectura/22-mundo-vivo-x4-tecnico.md#9-huecos-verificados-en-el-código).

| # | Qué | Origen | Estado |
|---|---|---|---|
| 1 | ~~**Ningún súbdito puede recibir `rolReino`** (H-1)~~ — decidido: plantilla + selector en Súbditos | [H] | ✅ `0e47115` |
| 2 | **El diplomático no sube de nivel** y se bloquea tras una sola negociación (H-5). 🧭 ¿XP por acción o enseñanza de un Maestro? | [H] | Abierto |
| 3 | ~~**Producción de facción duplicada y sin consumo** (H-6)~~ — en `worldTick` con consumo | [H] | ✅ `e42ac7f` |
| 4 | ~~**Las facciones no tienen stock que vender** (H-2)~~ — depositan productos reales (tope 5 por objeto) | [H] | ✅ `e42ac7f` |
| 5 | Verificación **en vivo** de la tanda B1-B32 | [A] | En curso (2026-09-29): zona, caza, cadáveres, tiradas ✔️; faltan Goirnos de humanoide y Reino. Hallazgos F9-1..4 en `registros/pruebas-nube-2026-09-28-hallazgos.md` |
| 6 | ~~**B1**: `ZonePoint` por partida en vez de global~~ — plantilla de catálogo (`saveId` null) + copia por partida | [A] | ✅ `186e3e7` |
| 7 | ~~"Cargando partida…" infinito si se recarga en la creación de partida~~ | [H] | ✅ `a700a61` |
| 8 | ~~**Slugs de oficio incoherentes** (H-10)~~ — fuente única `backend/src/data/professions.ts` + `npm run sync-professions` | [H] | ✅ `cd96e9e` |

---

## Trimestre 1 (octubre-diciembre de 2026): pre-alpha en Las Llanuras

### Reino jugable de punta a punta
- Cuando estén el 1-4: probar el bucle completo jugando. Fundar, construir un Taller, asignar
  trabajador, producir, vender y negociar. **[P]**
- ~~Botón directo para el **Cuartel Avanzado** y sus mejoras (H-12)~~ ✅ `a700a61` **[H]**
- Sembrar las **`FactionRelation` iniciales** entre las 9 facciones (H-7). 🧭 Hacen falta los
  números; solo existe Concordia ↔ Los del Obelisco = 65. **[A]**
- ~~Llamar a **`decayPresion`** (H-4)~~ ✅ `e42ac7f` y ~~disparar **`BAJA_DE_GUERRA`** al matar a un NPC de otra
  facción en su región (H-3)~~ ✅ `a700a61`. **[H]**
- 🧭 ¿Filtrar las órdenes de producción por el oficio del edificio? (P-3 de la referencia técnica)
  **[H]**
- ~~Migración menor: `FactionRelation.presion @default(50)` (H-9)~~ ✅ `a700a61` **[H]**

### Mecánicas por zona (continuación del plan del 2026-09-28)
- ~~Pescar y Buscar necesitan puntos en el mapa~~ ✅ `e3c8464` (6 fuentes en la Playa de Ceniza Blanca, con test) **[H]**
- 36 de 67 `Location` no tienen ningún `ZonePoint`. ~~Completar al menos las de Las Llanuras~~ ✅ `e3c8464`: solo falta `jakut-ger-interior` (interior, necesita lore). El resto son de otras regiones. **[H]**
- 🧭 Viaje largo desde el mapa de mundo (la habilidad Viajar exige montura, sin implementar). **[A]**
- Tras Huir, comprobar que el jugador reaparece en la entrada de la zona. **[A]**

### Alcance pre-alpha
- ~~Aplicar la decisión del 2026-09-01: **solo Gorhorn es jugable**~~ ✅ `378c393`. Dessa, Yerin y Riko como NPC:
  🧭 propuesta de lore SIN REVISAR (falta dónde están, papel, nivel y facción). **[A]**
- "Charlar con NPC" enriquecido (Franja 4 del plan Interactuar): lore, reclutar e interrogar tras
  Clemente. Mapeado, sin implementar. **[A]**

### Deuda técnica que frena
- ~~**Partir `turnResolution.ts`**: primer corte, días cruzados a `services/dailyTick.ts`~~ ✅ `7d470f9` (7.694 líneas; siguen más cortes posibles) **[P]**
- **Partir `GameView.tsx`**: ~~zona/caza/cadáveres a `useZonaAcciones`~~ ✅ `7d470f9` (2.595 líneas); quedan equipar, tirar, modo dinámico y muerte. **[P]**
- Repasar [deuda-tecnica-hallazgos.md](../registros/deuda-tecnica-hallazgos.md): varias entradas ya
  están resueltas en código (guards de `endedAt` en compañeros, `npcAttributesForLevel`) y el
  registro no lo refleja. **[H]**

---

## Trimestre 2 (enero-marzo de 2027): mundo vivo

### Motor de facciones NPC en `worldTick` (decisiones D-4, D-5, D-7)
- La facción decide según la Inteligencia de su líder (`liderNpcId`): construir, expandirse, pactar
  o declarar la guerra. **[A]**
- **Motor de eventos de mundo unificado**: eventos discretos que alimentan relaciones, lore y
  misiones; función pura llamada desde el turno y desde `worldTick`. **[A]**
- **Migrar `worldAgenda.ts`** (conflicto fijo Serhu+Concordia contra Helsig+Goshg) a filas de
  `FactionRelation`. **[A]**
- 🧭 D-12 abre a disputa las regiones sin dueño, pero 3 son de Vaelira, que está fuera de juego
  (P-4). Propuesta: restringirlo a Berig. **[H]**

### Expediciones de facción (diseño cerrado)
- Modelos `Expedicion` y `ExpedicionMember`, riesgo de intercepción por `FactionRelation`, combate
  en `worldTick` con el motor existente, botín al Almacén de la facción. **[A]**
- Sembrar `NpcProfessionPotential` para los NPC que trabajan (H-8). **[H]**

### Misiones secundarias por motor
- Misiones generadas por eventos de mundo en vez de por el LLM (encaja con el motor de eventos;
  momento de revisitar la fusión de los tres `pending*Offer`). **[A]**

### IA de combate NPC, tramo Inteligencia 20+ (diseño cerrado)
- Retirada, concentrar ataques en el mismo objetivo y órdenes de un capitán. 🧭 Falta decidir la
  forma de "retirada de NPC" (¿estado nuevo de `CombatParticipant`?). **[A]**

---

## Trimestre 3 (abril-junio de 2027): más mundo

### Cristal Helado jugable (la siguiente región, decisión de Álvaro)
- `ZonePoint` y grupos de fauna de la región, recorrido de sus zonas, Maestros Helsig. **[A]**
- Sembrar la Casa de curas Helsig y el Obrador de piedra Serhu cuando existan sus Maestros. **[H]**

### Ciénaga Troncal
- Oficios de la Ciénaga (`carpintero-orcos-cienaga`, `cocinero-orcos-cienaga`, resinero) y los
  Maestros Goshg, para que sus talleres del lore (P-06) sean edificios. **[A]**
- Edificios de facción Goshg en `campamento-goshg-interior` (aplazado de la A-09). **[H]**

### Economía
- 🧭 **Comercio de volumen Reino↔facción** con `KingdomStats.riqueza`: qué se comercia, a qué
  escala y con qué fórmula. Sin diseñar. **[A]**
- Estaciones de recolección sin oficio (Leñera, Cantera, Fibrería), si hacen falta para alimentar
  las cadenas. **[P]**
- Edificios de defensa (empalizada, torre de vigía, foso) para los Cuarteles de Guerra. **[P]**
- Postura de compañero en combate (agresivo, defensivo, capturador, clemente). **[A]**

### Curvas dinámicas (§ 9 del diseño X4)
- Pasada de *grounding* dedicada: qué señal falta en el movimiento en zona, los oficios, el talento
  y la energía. Nada se diseña antes de esa pasada. **[A]**

---

## Trimestre 4 (julio-septiembre de 2027): distribuible

- **Instalador** (investigación en [20-instalador-distribuible.md](../arquitectura/20-instalador-distribuible.md)). **[A]**
- **Benchmark de latencia real** y objetivo de turno en la Steam Deck. **[A]**
- **Narrador local afinado** (guía en [fine-tuning-ia-local.md](../ia/fine-tuning-ia-local.md)):
  dataset de partidas reales, evaluación contra el modelo actual. **[A]**
- **Control de escuadrones** (patrullar, explorar), si el mundo vivo lo pide. **[A]**
- Pasada de rendimiento del `worldTick` con el motor de facciones completo. **[P]**

---

## Continuo: lore y documentación

- **Rondas de OpenCode** con la capa `canon-opencode/` y las chuletas nuevas. Primera prueba de
  control pendiente: `FAUNA margen`, `ITEMS llanuras` y `EVENTOS` orco, con HUECOS → ESCRIBE →
  REVISA. **[A]**
- 🧭 **Contradicciones de canon de la auditoría del 2026-09-28** (preguntas 11-17). Los arreglos
  mecánicos ya están hechos (`5ea81cb`, `e089754`). **[H]**
- Revisar la propuesta **B18** (Bolco/Bulco) en
  [propuestas-lore.md](../borradores-opencode/propuestas-lore.md). **[A]**
- Opcionales de las fichas aprobadas: entradas de `historiaEntries` con su documento, `loreChunks` +
  `reindex-lore`, interior del Archivo del Refugio, `ZonePoint` del Jakut. **[A]**
- Revisar la incoherencia de distancias: Karot Veku queda a ~110 km del Cruce en el mapa de Azgaar
  y a 18-25 km en el grafo del juego. **[A]**
- `ampliar lore` de Las Llanuras: parado en la zona 15-17 (ver
  [ampliar-lore-checklist.md](../registros/ampliar-lore-checklist.md)). **[A]**
- Documentación: aplicar la convención "estado arriba, historial abajo" al resto de `mecanicas/`
  y `rpgtarkor/` (hecho en 05, clases y el mundo vivo). **[P]**
- Registros: pasar las entradas cerradas de `revisar-partida-hallazgos.md`,
  `checklist-pruebas-juego.md` y `deuda-tecnica-hallazgos.md` a `archivo/`. **[P]**
- Prompts de imagen por nivel de Ayuntamiento y Cuartel, con los huecos de parcela (los genera y
  sube Álvaro). **[A]**

---

## Aparcado a propósito

No son fallos. Se retoman cuando cambie su condición.

| Qué | Por qué espera |
|---|---|
| Multijugador (`/multijugador` es un marcador de posición) | Hasta que el modo en solitario esté maduro |
| Tirada real de `comerciablePct` / `cortejablePct` | Solo avisos narrativos; falta diseñar la tirada |
| `percepcionPasivaFor` sin llamador | Sin diseño que la use |
| Fase 4 de clases (`RETIRAR`, cifras de `AUMENTO`/`DEBILIDAD`/`CURAZION`) | Álvaro rellena números en `clases.md` a su ritmo |
| Armas y armaduras marcadas "PENDIENTE DE IMPLEMENTAR" en `worldCatalog.ts` (báculo tier 7, dagas tier 3, arco tier 5…) | Sin receta de crafteo |
| `saquito-arena-iman`: efecto protector en Las Agujas Imán | El crafteo existe; falta el efecto |
| Profesión "ganadería" y `silbato-hueso-caza` | Sin diseño |
| PNG reales de banners de clase | Sin proveedor de imagen para esa categoría |
| Clemencia de enemigo y duelos de honor | Espera a la IA de combate NPC |
| Sub-combates fragmentados (>4 contra 4) huérfanos si el servidor cae a mitad | Reverificar: la caza pasó a `services/caza.ts`; `caza.integration.test.ts` cubre la sub-partición >4v4 pero no la caída a mitad |

---

## Preguntas abiertas para Álvaro

Resumen de todos los 🧭. Detalle técnico en la
[referencia X4 § 12](../arquitectura/22-mundo-vivo-x4-tecnico.md#12-preguntas-abiertas-para-álvaro).

1. ¿Cómo recibe un súbdito su `rolReino`? (Ahora, 1)
2. ¿Cómo sube de nivel el diplomático? (Ahora, 2)
3. ¿Pasamos la economía de facción a `worldTick` con consumo, y cómo consiguen stock que vender?
   (Ahora, 3-4)
4. ¿`ZonePoint` por partida (B1)? (Ahora, 6)
5. Presiones iniciales entre las 9 facciones. (Trimestre 1)
6. ¿Filtrar órdenes por el oficio del edificio? (Trimestre 1)
7. ¿Viaje largo desde el mapa de mundo? (Trimestre 1)
8. ¿Restringir D-12 (regiones disputables) a Berig? (Trimestre 2)
9. Forma de la retirada de NPC en combate. (Trimestre 2)
10. Comercio de volumen: qué, cuánto y con qué fórmula. (Trimestre 3)

**Lore** (auditoría de coherencia del 2026-09-28):

11. **El Baluarte de Goirme:** ¿es la mayor ciudad-fortaleza de la Meseta (catálogo, ficha de
    región) o solo la primera (cronología mítica, A-10)? ¿Su obelisco es el más alto por ser el
    primero?
12. **Objetos que rompen la regla de peso y Carisma** (capa de melena de Ferike, peto de placas de
    Gargantúa, lanza de hueso con Carisma, tocado de plumas…): ¿excepción histórica o reequilibrio?
    ¿Y el Desollador de sílice, 20 Goirnos o dentro de la escala de tier 3 (23-31)?
13. **Embarcadero de pesca:** ¿en la Playa de Ceniza Blanca (código, junto al Maestro Pescador) o en
    El Embarcadero de Ceniza (lore)?
14. **Kekta o Tevya:** `clanes-orcos.md` llama "la más inteligente de los cuatro" a las dos.
15. **Jeyselt / Jeyselet:** ¿el poblado Nabieus o su salón interior? ¿"Fin Susurrado" nombra al
    clan, al poblado o a los dos?
16. **Costa norte de las Llanuras:** la Playa de Ceniza Blanca y El Embarcadero de Ceniza son
    "costa norte", pero Cristal Helado ocupa el norte de costa a costa. ¿Es la costa noroeste?
17. **Kelife = "Brillo de luna"** (`razas.md`) en un mundo sin luna. ¿Se cambia la traducción?
