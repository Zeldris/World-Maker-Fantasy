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
| 2 | **El diplomático no sube de nivel** y se bloquea tras una sola negociación (H-5). Decidido (2026-09-29): lo enseña un Maestro y luego sube por negociación | [H] | Abierto (falta el Maestro de diplomacia en el lore) |
| 3 | ~~**Producción de facción duplicada y sin consumo** (H-6)~~ — en `worldTick` con consumo | [H] | ✅ `e42ac7f` |
| 4 | ~~**Las facciones no tienen stock que vender** (H-2)~~ — depositan productos reales (tope 5 por objeto) | [H] | ✅ `e42ac7f` |
| 5 | Verificación **en vivo** de la tanda B1-B32 | [A] | En curso (2026-09-29): zona, caza, cadáveres, tiradas ✔️; faltan Goirnos de humanoide y Reino. Hallazgos F9-1..4 en `registros/pruebas-nube-2026-09-28-hallazgos.md` |
| 6 | ~~**B1**: `ZonePoint` por partida en vez de global~~ — plantilla de catálogo (`saveId` null) + copia por partida | [A] | ✅ `186e3e7` |
| 7 | ~~"Cargando partida…" infinito si se recarga en la creación de partida~~ | [H] | ✅ `a700a61` |
| 8 | ~~**Slugs de oficio incoherentes** (H-10)~~ — fuente única `backend/src/data/professions.ts` + `npm run sync-professions` | [H] | ✅ `cd96e9e` |
| 9 | **Cazar un grupo mata a un nivel 1 en un solo turno** (F9-1). Decidido (2026-09-29): solo un aviso de riesgo en la tarjeta de caza | [H] | Abierto |

---

## Trimestre 1 (octubre-diciembre de 2026): pre-alpha en Las Llanuras

### Reino jugable de punta a punta
- ~~Probar el bucle del Reino jugando~~ ✔️ 2026-09-29 (fundar, rol, negociar, producción de facción,
  vender y comprar); falta el Taller con trabajador. **[P]**
- ~~**F9-5**: vender un montón del Almacén cobra solo una unidad~~ ✅ `fe72966` **[H]**
- ~~**F9-6**: el modal del Reino corta el contenido~~ ✅ `fe72966` **[H]**
- **F9-7**: un Reino recién fundado no tiene súbditos. Decidido (2026-09-29): **sistema de
  población y reproducción al estilo Medieval Dynasty** (llegan, forman familia, tienen hijos que
  crecen y trabajan). Pieza de diseño grande: propuesta en `propuestas-lore.md`. **[A]**
- ~~Botón directo para el **Cuartel Avanzado** y sus mejoras (H-12)~~ ✅ `a700a61` **[H]**
- Sembrar las **`FactionRelation` iniciales** entre las 9 facciones (H-7). Decidido (2026-09-29):
  sacarlas de las tablas "Relaciones iniciales" de A-01..A-05 (`propuestas-aprobadas.md`) y del
  conflicto Serhu+Concordia contra Helsig+Goshg de `worldAgenda.ts`. **[A]**
- ~~Llamar a **`decayPresion`** (H-4)~~ ✅ `e42ac7f` y ~~disparar **`BAJA_DE_GUERRA`** al matar a un NPC de otra
  facción en su región (H-3)~~ ✅ `a700a61`. **[H]**
- Filtrar las órdenes de producción por el oficio del edificio (P-3). Decidido (2026-09-29): sí. **[H]**
- ~~Migración menor: `FactionRelation.presion @default(50)` (H-9)~~ ✅ `a700a61` **[H]**

### Mecánicas por zona (continuación del plan del 2026-09-28)
- ~~Pescar y Buscar necesitan puntos en el mapa~~ ✅ `e3c8464` (6 fuentes en la Playa de Ceniza Blanca, con test) **[H]**
- 36 de 67 `Location` no tienen ningún `ZonePoint`. ~~Completar al menos las de Las Llanuras~~ ✅ `e3c8464`: solo falta `jakut-ger-interior` (interior, necesita lore). El resto son de otras regiones. **[H]**
- Viaje largo desde el mapa de mundo (la habilidad Viajar exige montura). **Aparcado** (2026-09-29). **[A]**
- ~~Tras Huir, comprobar que el jugador reaparece en la entrada de la zona~~ ✅ `3a60fcd` (las huidas de combate ya lo hacían; la de la tarjeta de encuentro no, arreglada y cubierta por test) **[A]**
- ~~La hora de la cabecera no avanza al caminar (F9-2) y "TU ACCIÓN" sale con la hora vieja (F9-3)~~ ✅ `8b8a0b2` **[H]**
- ~~Dos tiradas visibles que no quedan en el log (F9-4)~~ ✅ `8b8a0b2` **[H]**
- ~~**B29**: atacar por texto libre a fauna adyacente no abría combate~~ ✅ `8b8a0b2` (se resuelve como Cazar) **[H]**
- ~~Efecto de B1: un re-seed del catálogo no llega a las partidas que ya clonaron esa zona~~ ✅ `00b3607`:
  resincronización aditiva (solo añade lo que falta; un punto retirado del catálogo sigue en las
  partidas que ya lo tenían). **[P]**

### Alcance pre-alpha
- ~~Aplicar la decisión del 2026-09-01: **solo Gorhorn es jugable**~~ ✅ `378c393`. Dessa, Yerin y Riko como NPC:
  🧭 propuesta de lore SIN REVISAR (falta dónde están, papel, nivel y facción). **[A]**
- "Charlar con NPC" enriquecido (Franja 4 del plan Interactuar): lore, reclutar e interrogar tras
  Clemente. Mapeado, sin implementar. **[A]**

### Deuda técnica que frena
- ~~**Partir `turnResolution.ts`**~~: días cruzados a `dailyTick.ts` (`7d470f9`) y saqueo/muerte/despiece a `turnLootKill.ts` (`fe72966`), 7.125 líneas. Queda el bloque de combate múltiple, muy entrelazado. **[P]**
- ~~**Partir `GameView.tsx`**~~: `useZonaAcciones` (`7d470f9`), `useInventarioAcciones` y `useModoDinamico` (`fe72966`), `useHabilidadesAcciones` y `useMisionesAcciones` (`4d3245d`), 2.114 líneas. **[P]**
- ~~Repasar [deuda-tecnica-hallazgos.md](../registros/deuda-tecnica-hallazgos.md)~~ ✅ la tabla
  "Estado verificado" ya refleja lo resuelto; tamaños al día tras la Fase 12. **[H]**

---

## Trimestre 2 (enero-marzo de 2027): mundo vivo

### Motor de facciones NPC en `worldTick` (decisiones D-4, D-5, D-7)
- La facción decide según la Inteligencia de su líder (`liderNpcId`): construir, expandirse, pactar
  o declarar la guerra. **[A]**
- **Motor de eventos de mundo unificado**: eventos discretos que alimentan relaciones, lore y
  misiones; función pura llamada desde el turno y desde `worldTick`. **[A]**
- **Migrar `worldAgenda.ts`** (conflicto fijo Serhu+Concordia contra Helsig+Goshg) a filas de
  `FactionRelation`. **[A]**
- D-12 abre a disputa las regiones sin dueño, pero 3 son de Vaelira (P-4). Decidido (2026-09-29):
  restringirlo a Berig. **[H]**

### Expediciones de facción (diseño cerrado)
- ~~Modelos `Expedicion` y `ExpedicionMember`, riesgo de intercepción por `FactionRelation`, combate
  en `worldTick` con el motor existente, botín al Almacén de la facción~~ ✅ `8c293d8`, `cbbc0b8`
  (primer corte, Fase 13 del plan; valores por defecto en las preguntas 25-28). **[A]**
- ~~Sembrar `NpcProfessionPotential` para los NPC que trabajan (H-8)~~ ✅ `5140580` (30 NPC). **[H]**
- Que el jugador vea las expediciones (mapa de mundo, noticias en el log): fuera del primer corte.
  **[P]**

### Misiones secundarias por motor
- Misiones generadas por eventos de mundo en vez de por el LLM (encaja con el motor de eventos;
  momento de revisitar la fusión de los tres `pending*Offer`). **[A]**

### IA de combate NPC, tramo Inteligencia 20+ (diseño cerrado)
- Retirada, concentrar ataques en el mismo objetivo y órdenes de un capitán. Retirada decidida
  (2026-09-29): huida inmediata con tirada. **[A]**

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
- **Comercio de volumen Reino↔facción**. Decidido (2026-09-29): todo el catálogo, según el origen
  del objeto y el oficio de los NPC (los oficios van por raza y región). Falta la fórmula. **[A]**
- **Economía de supervivencia de facción** (2026-09-29): el tope del Almacén depende de los
  edificios; hay que llevar reservas de agua, producción activa y comida. Esto y los Goirnos son la
  base que activa el dinamismo de la facción: sin ellos no actúa y acaba muriendo. Propuesta de
  diseño en `propuestas-lore.md`. **[A]**
- **Ganadería** (2026-09-29): oficio de ganadero y edificios por especie de fauna que generan
  recursos (estilo Bellwright; p. ej. los Murgol). Propuesta de diseño en `propuestas-lore.md`. **[A]**
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
- **Contradicciones de canon de la auditoría del 2026-09-28**: decididas por Álvaro el 2026-09-29
  (ver "Respuestas del 2026-09-29" abajo); falta aplicarlas a `rpgtarkor/` con el runbook. **[A]**
- **B18**: decidido renombrar el árbol **Bolco → Holdo** (el caracol Bulco se queda). **[A]**
- Dessa, Yerin y Riko como NPC: **aparcado** hasta que Álvaro escriba su lore. **[A]**
- 🧭 **Terreno contra hogar** en 6 fuentes del catálogo (`gargantua-de-ceniza`, `junba-verde` y su
  resina, `temune`, `ferike`, `telda-ceniza`): su terreno no casa con la Location donde viven, así que
  no tienen `ZonePoint` (excepciones de `zonePointsCobertura.test.ts`). **[H]**
- `jakut-ger-interior`: única Location de Las Llanuras sin `ZonePoint`. Es el interior (ciudadela) del Jakut Ger de los Feg Ger, Faerus de las Llanuras; poblarlo necesita lore de qué hay dentro. **[H]**
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

Resumen de los 🧭 que quedan. Detalle técnico en la
[referencia X4 § 12](../arquitectura/22-mundo-vivo-x4-tecnico.md#12-preguntas-abiertas-para-álvaro).

1. **Maestro de diplomacia** (H-5): ¿quién lo enseña y dónde?
2. Dessa, Yerin y Riko: aparcado hasta su lore.

## Respuestas del 2026-09-29

- F9-1 caza en grupo: solo aviso de riesgo en la tarjeta.
- F9-7 súbditos: sistema de población y reproducción al estilo Medieval Dynasty.
- H-7 relaciones iniciales: de las tablas de A-01..A-05 y del conflicto de `worldAgenda.ts`.
- H-5 diplomático: lo enseña un Maestro y sube por negociación.
- Órdenes de producción: filtradas por el oficio del edificio.
- Viaje largo: aparcado. D-12: solo Berig. Retirada de NPC: huida inmediata con tirada.
- Comercio de volumen: todo el catálogo según origen del objeto y oficio del NPC (por raza y región).
- Reloj de 1 min por paso: ok. Capítulo sin acciones de combate: ok.
- **Energía**: el Ataque Básico cuesta energía y se bloquea sin ella, como antes de B11 (se retira
  la excepción). La regeneración pasiva se queda.
- **Economía de facción**: el tope del Almacén depende de los edificios; agua, comida y producción
  activa obligatorias; sin ellas la facción se apaga y muere.
- Nombres de oficios nuevos: la duda era solo de nombre visible; se quedan.
- **Potencial de NPC**: los topes gustan; todos empiezan en nivel 1 sin XP.
- Expediciones (ritmo, riesgo, combate): ok. **Bajas**: sí, con probabilidad muy baja; cada muerte cuenta.
- Lore: el Baluarte de Goirme es la mayor ciudad-fortaleza y su obelisco el más alto por ser el
  primero; los objetos que rompen la regla de peso y Carisma se reequilibran (y el Desollador de
  sílice entra en la escala de tier 3); el embarcadero de pesca está en la Playa de Ceniza Blanca,
  puesto avanzado de los Serhu; la más inteligente de los cuatro es Tevya; el nombre es Jeyselt;
  Kelife = "Brillo de aurora"; hay que crear el oficio de ganadero; el árbol Bolco pasa a Holdo;
  Dessa, Yerin y Riko aparcados.
- Goirnos de humanoide 2 + 2 × nivel: ok. Nombres de oficios nuevos: ok.
- Terreno contra hogar (6 fuentes): se corrige el terreno de la ficha para que case con el lugar
  donde viven (el lugar sale del lore).
- Playa de Ceniza Blanca: está en el tramo norte de la costa de las Llanuras (su costa oeste), no
  en una "costa norte" de la región; corregir la redacción.
- **Reproducción sin comprimir**: las crías crecen a tiempo real de juego (un orco tarda 10 años de
  ficción en ser adulto).
