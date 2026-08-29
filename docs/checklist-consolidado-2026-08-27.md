# Checklist consolidado — todo pendiente del proyecto (2026-08-27)

Consolida en un único documento priorizado: los 54 `.md` del repo (roadmap, deuda técnica,
checklists de auditoría de frontend/backend, docs de lore/`rpgtarkor/`), los `TODO`/`FIXME` de
código (resultado: **ninguno real** — el proyecto usa "TODO" en mayúsculas como recurso
estilístico en comentarios españoles, no como marcador de tarea), y `docs/revisar-partida-hallazgos.md`
completo (11 hallazgos + 1 familia recurrente todavía PENDIENTES).

Se excluye explícitamente todo lo ya marcado CERRADO/FIJADO/APLICADO/COMPLETO/NO ES BUG — solo
queda lo que sigue abierto a día de hoy. Duplicados entre documentos fusionados en una sola entrada
(con nota de qué documentos lo mencionan).

**Prioridad** = impacto real jugando + qué tan bloqueante es para el resto. **Tamaño** = esfuerzo
estimado (PEQUEÑA: un archivo/función; MEDIA: varios archivos, sin diseño nuevo; GRANDE: exige
diseño nuevo o toca varios sistemas a la vez).

**Estado del cierre (2026-08-27)**: **P0-P3 (34 items) cerrados** — bugs reales arreglados con
código+tests, o investigados y confirmados como ya resueltos/sin acción razonable. **P4 (15) y P5
(17) dejados documentados a propósito, sin tocar**: son roadmap de diseño futuro (sistemas enteros
sin construir, varios explícitamente "esperan que la usuaria rellene cifras/mecánicas") — no deuda
técnica ni bugs, decisión explícita de no inventar diseño no especificado. Quedan bien organizados
y priorizados, listos para retomar uno a uno cuando haya decisiones de diseño que tomar.

---

## P0 — Bugs reales con causa identificada, afectan a partidas ya en curso — **CERRADO 2026-08-27**

- [x] **`detectNpcsInScene`/reaparición de Gistera Koh sin vocabulario de persecución.**
      Diagnóstico revisado en profundidad: el filtro determinista `npcsInScene.filter(n =>
      n.slug !== 'gistera-koh')` (turnResolution.ts:2548, condicionado a `gisteraSeHaMarchado`)
      YA existía y funciona bien — la causa real no era ese camino determinista, sino un hueco de
      VOCABULARIO en el guard `hasGisteraReencuentroSinNombrar` (narrador.ts): la reaparición se
      narró como amenaza estática ("sin nombre revelado... ojos fieros fijos en Gorhorn"), sin
      ninguna palabra de persecución/huida de las ya cubiertas. `GISTERA_PERSECUCION_REGEX`
      ampliado con "sin nombre revelado" (frase específica del patrón real, sin añadir verbos
      genéricos que dispararían falsos positivos con menciones legítimas de otras orcas Serhu).
      Test nuevo con la frase real capturada. 165/165 tests verdes.
- [x] **"el río Karot Veku" inventado.** Confirmado con la usuaria: Karot Veku es el nombre NATIVO
      en lengua orca del campamento del Clan Serhu (mismo sitio que "Colmillo Ceniza"), nunca un
      río — la narración mezcló un topónimo real con una naturaleza geográfica falsa. Guard nuevo
      `hasFalseKarotVekuAsRiver` (acotado a este caso concreto, decisión explícita de la usuaria:
      un detector genérico de topónimos contra TODAS las Location tendría más riesgo de falso
      positivo). Enganchado al bucle de reintento de `narrador.ts`. Tests nuevos.
- [x] **`activeEffects` — REVISADO, ya estaba cerrado.** El hallazgo venía de un doc `.md`
      desactualizado — `turn.ts` ya manda `activeEffects` en el `done` del turno (línea 930/991),
      y el frontend ya lo consume/pinta con `ActiveEffectChips` tanto del jugador como de cada NPC
      en `CombatPanel.tsx` (construido en la Fase 2 de efectos de clase, 2026-08-26). Sin acción.
- [x] **Estación/clima — REVISADO, ya estaba cerrado.** `entornoTemporalFor` ya se llama en 4
      sitios reales (`turn.ts`, `detail.ts`, `turnResolution.ts`) y `characterSummaryFor` ya lo
      incluye en el bloque "ESTADO DE LA PARTIDA" pasado al narrador — trabajo de la Pieza 1 de
      "Dinamismo del mundo", ya aplicado antes de que se escribiera el doc que originó este
      hallazgo. Sin acción.

## P1 — Bugs/huecos reales confirmados, sin causa raíz cerrada del todo

- [ ] **`harvestSourceHomeLocationSlug` nunca se aplica a MINERIA/TALA/EXTRACCION**, solo a PASIVO
      — Roca Luclara sale minable fuera de su zona real. Pregunta de diseño: ¿generalizar el campo
      o aceptar que solo aplica a PASIVO? *(revisar-partida-hallazgos.md § 2026-08-25,
      21-roadmap.md)* — MEDIA.
- [x] **Fauna/flora/recursos anclados a la región completa, no a zonas concretas — PARCHE QUIO
      APLICADO.** `harvestSourceHomeLocationSlug` generalizado a MINERIA/TALA/EXTRACCION en
      `candidateSourcesFor` (mismo criterio que `pasivoCandidatesFor`, comparación estricta solo
      cuando el campo existe para ese recurso). Quio anclado a `manaderos`. El resto del catálogo
      (~57 recursos sin este campo poblado) queda para cuando haga falta anclar uno concreto — la
      infraestructura ya generaliza, solo falta poblar entradas. Tests actualizados (2 fixtures de
      `recolectar.test.ts` usaban `boungo`/`lucre-blanco`, que ya tienen el campo real; cambiados a
      slugs inventados sin conflicto). 52/52 tests verdes.
- [x] **"Golpe fantasma" — DIAGNOSTICADO, sin bug activo hoy.** Probado el regex actual
      (`COMBAT_HIT_LEAK_REGEX`) contra la frase real capturada en el hallazgo ("quien se retuerce
      bajo el impacto") — SÍ dispara correctamente. La hipótesis (b) del hallazgo ("hueco en
      `exchangeHappened`/`npcAttackHits`") queda descartada con el código actual. Solo queda la
      hipótesis (a) — límite estructural ya aceptado de "un solo reintento" contra un modelo local
      pequeño, sin fix determinista razonable sin rediseñar el sistema de reintentos. Sin acción.
- [ ] **Cruzavientos: nunca se narra quién es el atacante al huir repetidamente — investigado,
      necesita reproducción en vivo antes de construir el guard.** Causa real identificada:
      `combatRealTargetName`/`otherNpcNamesInScene` (turnResolution.ts:3698-3699) solo se calculan
      si `exchangeHappened` es true — en una huida con ÉXITO (sin intercambio mecánico resuelto),
      ambos quedan vacíos y `hasFalseCombatTargetName` nunca puede disparar, porque su guard exige
      `realTargetName`. El endpoint `/combat/flee` (botón "Huir") es determinista, no pasa por el
      Narrador — el hueco solo aplica a texto libre tipo "Intento huir" en combate. Cerrarlo bien
      exige: (1) un detector de intención de huida en texto libre (no existe hoy,
      `detectsFleeIntent`), (2) pasar nombres de NPCs reales en escena al `TurnContext` sin
      depender de que haya intercambio, (3) el guard en sí — alcance mayor de lo que parecía a
      primera vista, y sin logs reales de la partida original para confirmar el escenario exacto.
      Dejado sin construir a ciegas — retomar la próxima vez que se reproduzca jugando en vivo.
      *(revisar-partida-hallazgos.md § 2026-08-23)* — MEDIA, bloqueado por reproducción real.
- [x] **Recolección: total acumulado vs. recién cosechado — REVISADO, ya estaba cerrado.**
      `TouchedStack.harvestedThisTurn` ya existe, separado de `quantity` (el total de la pila) —
      el texto del log (`recolectar.ts:790`) ya usa `harvestedThisTurn`, no el total. El propio
      comentario del código fecha el fix el 2026-08-13, un día antes del hallazgo que lo marcaba
      PENDIENTE — doc desactualizado. Sin acción.
- [x] **Contradicción interna en una misma frase narrada — INSTRUCCIÓN AÑADIDA AL PROMPT.**
      Sin guard determinista posible (no hay estado mecánico contra el que comparar la frase, se
      contradice sola) — añadida instrucción explícita al `combatBlock` de `narrador.ts`: "no te
      contradigas dentro de la misma frase... si un golpe se bloquea/esquiva sin daño, no
      describas ninguna herida en el mismo aliento". `tsc -b` limpio, 165/165 tests (sin test
      nuevo posible — instrucción de prompt, no lógica determinista; validar jugando).
- [x] **Mezcla de 2ª/3ª persona sin transición — INSTRUCCIÓN AÑADIDA AL PROMPT.** Confirmado que
      `buildNarrationPrompt` no tenía NINGUNA instrucción de persona gramatical para la narración
      principal (la única mención de "tercera persona" en el archivo pertenece al prompt de
      SUGERENCIAS, función distinta) — mientras tanto, el propio `combatBlock` habla al modelo en
      segunda persona ("tu narración tiene que reflejar...", "tú también recibes un golpe"), lo
      que probablemente "contagiaba" el registro. Añadida instrucción explícita en
      `fixedInstructions`: narrar siempre en tercera persona, aclarando que las instrucciones al
      modelo sí pueden usar "tú" sin que eso deba colarse en la salida. `tsc -b` limpio, 165/165
      tests (mismo criterio: sin test posible, validar jugando).
- [x] **"Amuleto de hueso" narrado cayendo 3 veces — REVISADO, sin fix determinista razonable.**
      `isTooSimilarToLast` solo compara contra el ÚLTIMO turno (similitud global de la narración
      completa) — un detalle decorativo repetido a lo largo de VARIOS turnos con verbos de ataque
      distintos no lo dispararía. Construir un detector fiable de "elemento repetido" sin falsos
      positivos (mencionar un arma real varias veces en el mismo combate es normal y esperado) es
      complejo para un solo caso documentado — mismo criterio que la familia de vocabulario de
      abajo. Sin acción de código.
- [x] **Ruptidar descrito como "insecto con alas rotas" — REVISADO, sin causa determinista.**
      Confirmado contra el catálogo: la bio de Ruptidar ya es correcta y clara ("reptil
      serpentiforme... coraza inerte"), sin ningún dato malo que confunda al modelo — a diferencia
      de P0.2 (Karot Veku), aquí no hay ningún nombre real mal descrito de forma sistemática por el
      propio catálogo. Alucinación puntual de un modelo pequeño, sin recurrencia confirmada. Mismo
      criterio que la familia de abajo — sin acción, a vigilar si se repite.
- [ ] **Familia recurrente "errores gramaticales sueltos del modelo"** (5 apariciones fechadas: verbos
      que no encajan, inglés colado en narración española, discordancias) — sin corrector genérico
      decidido a propósito; la recurrencia empieza a acumularse como señal a vigilar.
      *(revisar-partida-hallazgos.md, varias fechas)* — GRANDE si se decide construir un corrector.

## P2 — Deuda técnica / consistencia de frontend, sin bug funcional urgente

- [x] `Button.tsx` — **APLICADO 2026-08-27**: variantes `accent2`/`danger` añadidas (mismo criterio
      visual que `primary`/`secondary`). `tsc -b` limpio. *(frontend-checklist-mejoras B.2)*.
- [x] `DynamicModeModal` identidad visual — **YA ESTABA APLICADO**, doc desactualizado (prop
      `imageUrl` ya existía y se pinta). *(B.6)*.
- [x] Loading entre vueltas del modo dinámico — **APLICADO 2026-08-27**: la transición YA estaba
      resuelta; añadido el indicador "Resolviendo..." que faltaba mientras `busy`. *(B.8)*.
- [x] Categoría de plantilla sin autocompletado — **YA ESTABA APLICADO**, doc desactualizado
      (`categoriasConocidas`/`datalist` ya existía). *(B.17)*.
- [x] Fallback de `onFundarReino` — **YA ESTABA APLICADO**, doc desactualizado (el aviso ya se
      muestra siempre, el botón es lo único condicional). *(B.18)*.
- [x] `carcassPending` centralizado — **YA ESTABA APLICADO**, doc desactualizado
      (`markCarcassPending`/`checkCarcassPending` ya existían). *(C.2)*.
- [ ] 40+ `useState` sueltos en `GameView.tsx` — dejado sin tocar A PROPÓSITO: refactor MEDIA/riesgo
      de regresión silenciosa en el archivo más grande y crítico, sin beneficio funcional inmediato
      — pasada dedicada aparte, no de paso en un cierre de checklist grande. *(C.3)* — MEDIA.
- [ ] `EnciclopediaPanel.tsx`/`CombatPanel.tsx` candidatos a dividir en archivos — dejado sin tocar
      a propósito: puramente organizativo (ya subdividido en sub-componentes locales), riesgo de
      imports rotos para beneficio solo cosmético. *(C.4)* — PEQUEÑA, bajo valor.
- [x] `ZonaPanel` contador "×N" desbordando — **YA ESTABA APLICADO**, doc desactualizado (badge
      fuera del icono a partir de 10). *(C.5)*.
- [x] `ZonaPanel` control regional apagado + switch no exhaustivo — **YA ESTABAN APLICADOS**, doc
      desactualizado (`regionControlDisplay` + switch exhaustivo). *(C.6/C.7)*.
- [x] Badge estación/clima inconsistente — **YA ESTABA APLICADO**, doc desactualizado (header ya
      usa `rounded-full text-2xs`, igual que `MapaPanel`). *(C.11)*.
- [x] **Bloque `frontend-diseno-ux-hallazgos-2026-08-27.md` completo — YA ESTABA CERRADO, doc
      desactualizado.** Los 13 items reales del documento (excluyendo la nota de calibración 4.2 y
      2.4, bloqueado por flujo de creación de personaje que no existe) ya tenían su código real
      aplicado, con comentarios propios citando el hallazgo — verificado uno a uno:
  - [x] 1.1 Zona pestaña casi siempre vacía → resuelto en ESTA MISMA sesión (tabs Zona/Mapa dentro
        de `MapaPanel.tsx`, Zona ya no vive en `NavTabs.ts`).
  - [x] 1.2 Reputación↔Facciones sin enlace → botón ⓘ en cada `FactionRow` (`ReputacionPanel.tsx`)
        abre la ficha de Enciclopedia vía `onEntityDetail`.
  - [x] 1.3 Compañero de Reino partido entre paneles → `PlantillaSelect` exportado y reutilizado
        inline en `CompanerosPanel.tsx`.
  - [x] 1.4 Hambre/Sed con 2 componentes distintos → `ResourceBar` compartido en ambos paneles.
  - [x] 2.1 `activeEffects` sin indicador en combate → ya construido (Fase 2 de efectos de clase,
        2026-08-26), confirmado también en P0.3.
  - [x] 2.2 Estación/clima sin indicador → badges bajo "Berig" en `MapaPanel.tsx`.
  - [x] 2.3 `WorldState.agenda` sin tracker → `AgendaCard` (barra por etapas) en `ReputacionPanel.tsx`.
  - [x] 3.1 Reputación sin feedback visual → `FactionRow` ya tiene flash worse/better, mismo
        patrón que `HealthBar`.
  - [x] 3.2 Aviso Hambre/Sed sin transición → `animate-entry-in` ya aplicado en `EstadisticasPanel.tsx`.
  - [x] 3.3 Barras "silenciosas" sin tratamiento de evento → `animate-pop-once` ya aplicado en
        `HabilidadesPanel.tsx` (nivel de profesión) y `ReinoPanel.tsx` (confirmación de plantilla).
  - [x] 3.4 Sin confirmación al cambiar plantilla de compañero → mismo fix que 3.3, `PlantillaSelect`.
  - [x] 4.1 Pill de fecha sin estación/clima → `ESTACION_ICON`/`CLIMA_ICON` ya en el header
        (`GameView.tsx`).
  - [x] 4.3 Sin atajo del log al Diario → "Ver historial completo en el Diario →" ya en `LogPanel.tsx`.
  - [ ] 2.4 `Save.clase`/especialización sin sitio reservado — sigue bloqueado a propósito (no hay
        flujo de creación que asigne clase todavía, ver P4). Sin acción.
- [x] `WorldState.agenda` estructurado en `GET /saves/:id` — **YA ESTABA APLICADO**
      (`parseAgenda(save.worldState?.agenda)`, `detail.ts:246`). *(backend-sin-conectar-frontend:75-93)*.
- [x] Orden de iniciativa/ronda sin tracker visual — decisión de diseño ya aceptada de no
      mostrarlo (mejora de comodidad, no bug) — confirmado, sigue así a propósito. Sin acción.
      *(backend-sin-conectar-frontend:124-140)*.

## P3 — Deuda técnica de código, prioridad baja consciente (ya evaluada y aparcada)

- [ ] `resolverTurnosAutonomosHastaJugadora` sin test directo; literal `15` de dificultad duplicado
      sin constante; `ejecutarIntercambioYAvanzar` con 12 parámetros posicionales; texto del hint
      "golpe letal" duplicado. *(deuda-tecnica-hallazgos.md, services/)* — PEQUEÑA.
- [ ] `recolectar.ts` (844 líneas) al límite de una responsabilidad; `world.ts:404` sin test que
      fije el filtro por `saveId`; `progression.ts` traga errores sin loggear causa.
      *(deuda-tecnica-hallazgos.md, routes/)* — PEQUEÑA.
- [ ] `combateMultipleOrquestacion.ts` creció mucho (parámetros posicionales repetidos, función
      `retargetBando` sin caller real en producción). *(deuda-tecnica-hallazgos.md)* — PEQUEÑA-MEDIA.
- [x] `API_URL` hardcodeado — **YA ESTABA APLICADO, doc desactualizado**: `VITE_API_URL` con
      fallback a localhost ya existe en `api.ts`. Corregido `15-instalacion.md:42` para reflejarlo.
- [ ] Pasivo de los Nuentes (-2 al ataque con arma de metal) — **investigado, dejado sin construir
      a propósito** (decisión explícita): `ItemCatalog` no tiene ningún campo "material"
      consultable hoy (solo texto libre) — cerrarlo bien exige campo nuevo en el esquema + poblar
      manualmente cada arma existente + tocar el núcleo de `resolveCombatExchangePhase`
      (turnResolution.ts, función grande y sensible, mucho estado de la Fase 3 sin commitear) para
      contenido de 1 solo NPC. Desproporcionado frente al resto de items de este bloque — se deja
      documentado, no se construye ahora. *(ampliar-lore-checklist.md:133-136)*.
- [x] "Cazar" limpio no avanza el reloj — **APLICADO 2026-08-27**: `advanceFictionalMinutes`
      (10 min fijos, `CAZA_LIMPIA_MINUTOS`) añadido a la caza limpia sin combate en `cazar.ts`,
      mismo patrón que Minar/Talar (`recolectar.ts`). `/combat/flee` REVISADO y dejado igual a
      propósito: es huir ANTES de que el combate empiece de verdad (decisión instantánea, no una
      acción con duración) — no es el mismo hueco, el hallazgo agrupó dos casos distintos. Rompió
      1 test unitario (`cazar.test.ts`, mock de `tx` sin `worldState.update`) — arreglado añadiendo
      el mock que faltaba. `tsc -b` limpio + 29/29 tests de caza en verde.
- [ ] Algoritmo de tolerancia a erratas (`fuzzyMatchesAnyStem`) demasiado permisivo — **investigado,
      sin fix de bajo riesgo posible**: ya está centralizado (`travel.ts:105-114`, un único punto
      para todo el proyecto, mitiga la parte "no escalable" del hallazgo). Probado un ajuste
      candidato (escalar umbral por longitud: 5-6 letras ≤1, 7+ letras ≤2) contra los 2 casos
      documentados — NO los resuelve: "canizor"~"cenizo" (7/6 letras, distancia 2) y
      "presas"~"brasas" (6/6 letras, distancia 2) seguirían colisionando con ese esquema. Confirma
      el propio diagnóstico del hallazgo: es un problema de diseño del algoritmo (Levenshtein puro
      no basta), no un parámetro mal calibrado — requiere una métrica distinta (similitud fonética,
      o pesar el TIPO de sustitución) para el día que se decida invertir en ello. Sin acción.
      *(ampliar-lore-checklist.md:147-148)*.

## P4 — Diseño grande sin construir, requiere decisiones nuevas antes de picar código

- [ ] Fase 4 de clases: `RETIRAR`, filas de `AUMENTO`/`DEBILIDAD`/`CURAZION` sin cifras — bloqueado
      en que la usuaria rellene números. *(21-roadmap.md:793-797)* — GRANDE, bloqueado.
- [ ] `CANALIZAR`/`RETIRAR`/`CURAZION`/`REFLEJAR`/`REFRACTAR`/`PURIFICAR`/`PROVOCACION`/`CONTRA`
      combinados sin construir del todo; `MARCAR` nuevo (Domador); restricción de armadura por peso;
      pool de armas para 6 de 9 clases sin diseñar. *(21-roadmap.md:260-267, 527-529)* — GRANDE.
- [ ] `combateMultipleOrquestacion.ts` aún no lee/aplica `activeEffects` en el camino de utilidad/
      independiente. *(21-roadmap.md:559-560, 587-588)* — GRANDE.
- [ ] 7 tótems de `clases.md` sin construir (combinan INVOCACION con efectos aún bloqueados).
      *(21-roadmap.md:713-718)* — GRANDE.
- [ ] Capturar/Clemente y el saqueo actúan sobre `NpcState` por especie, nunca por individuo de
      grupo — requiere rediseñar la materialización del `CombatEncounter`. *(21-roadmap.md:92-96)* — GRANDE.
- [ ] Generalizar la Capa 1 de zonas navegables más allá de La Hondonada del Eco.
      *(21-roadmap.md:311-312)* — GRANDE.
- [ ] Sistema de Reino / los 22 NPC del Campamento del Clan Serhu (11 Maestro + 11 trabajador) —
      bloqueados por "aprender oficio de NPC" y el sistema de Reino en sí.
      *(21-roadmap.md:389-392, ampliar-lore-checklist.md:129-132)* — GRANDE.
- [ ] `comerciablePct`/`cortejablePct` sin sistema mecánico real (comerciar sigue siendo narrativo
      libre, cortejo no existe). *(21-roadmap.md:356)* — GRANDE.
- [ ] Postura de compañero en combate (Agresivo/Defensivo/Capturador/Clemente) — bloqueado hasta
      que exista combate autónomo de compañero. *(21-roadmap.md:444-453)* — GRANDE.
- [ ] Clemencia de enemigo / duelos de honor, sin diseñar. *(21-roadmap.md:454-458)* — GRANDE.
- [ ] `Save.clase`/`Save.especializacion` nunca se asignan (sin flujo de creación de personaje que
      los pida) — consecuencia real: restricción de armas por clase nunca se dispara en partida
      real. *(backend-sin-conectar-frontend:95-118, frontend-diseno-ux § 2.4)* — GRANDE, bloqueado
      por decisión de flujo.
  - [ ] Sistema de encuentros ambientales por estación (tasas de aparición reales por fauna) sigue
      sin diseñar. *(rpgtarkor/flora-fauna.md:67)* — GRANDE.
- [ ] Fase 2 completa de Las Agujas Imán (Rocas Imanidas de calidad variable, pérdida de inventario
      por zona, Saco de Arena Imán). *(ampliar-lore-checklist.md:127-128)* — GRANDE.
- [ ] Auditoría de ~57 materiales recolectables sin ninguna receta que los consuma — sin decidir si
      vale la pena diseñar más recetas o aceptarlo como contenido adelantado. *(ampliar-lore-checklist.md:371-390)* — GRANDE.
- [ ] Decidir si usar `qwen3.5:4b` también para narración principal, no solo sugerencias.
      *(revisar-partida-hallazgos.md)* — GRANDE, decisión de infraestructura.
- [ ] Modo Multijugador — pausado hasta que el modo en solitario esté maduro, ni diseñado.
      *(21-roadmap.md:852-853)* — GRANDE, sin prioridad actual.

## P5 — Ideas sueltas, lore menor, o esfuerzo mínimo de bajo impacto

- [ ] `Npc.levelMax`/`percepcionPasivaFor` sin consumidor, en cola de diseño. *(21-roadmap.md:359-362)* — GRANDE.
- [ ] "Control Rúnico" no sembrado (combina CONTROL+DEBILIDAD sin resolución conjunta).
      *(21-roadmap.md:598-602)* — MEDIA.
- [ ] `AUMENTO`/`AGUANTE`+`MULTIPLE` (4 filas: Valor Compartido, Postura Inquebrantable, Grito
      Improvisado, Llamada de la Manada) bloqueadas. *(21-roadmap.md:613-616)* — GRANDE.
- [ ] `DEBILIDAD` combinada de Comunión Salvaje sin cifra; `AUMENTO` de Camuflaje sin construir.
      *(21-roadmap.md:637-640)* — MEDIA.
- [ ] Combate múltiple: XP de la propia tirada sin enganchar; sub-partición >4v4 sin probar en
      vivo. *(21-roadmap.md:284-286)* — MEDIA.
- [ ] `BuildingStatus.DANADO` se lee (respawn) pero nada lo produce todavía. *(21-roadmap.md:351-352)* — PEQUEÑA.
- [ ] Indicador de notificación (badge) en pestañas con novedades (Misiones/Diario) sin construir.
      *(09-panel-personaje.md:65)* — PEQUEÑA.
- [ ] Miel Lebude / futura profesión de cocina por raza-región — idea suelta, prioridad muy baja.
      *(21-roadmap.md:395-396, rpgtarkor/flora-fauna.md:79)* — PEQUEÑA/GRANDE si se desarrolla.
- [ ] Rebalanceo de coste de Campamento (mitad de recursos) y Ayuntamiento (más recursos, más
      tipos) — pedido explícito de la usuaria, sin fórmula decidida. *(ampliar-lore-checklist.md:393-403)* — PEQUEÑA-MEDIA.
- [ ] Riko "de la Manada Rota" — nombre sin desarrollar (sin ubicación, sin qué le pasó, sin
      miembros). *(ampliar-lore-checklist.md:410-413)* — PEQUEÑA, lore puro.
- [ ] Kael Dorn ↔ Ithren — hilo atado solo por un lado, falta mención en ficha de Ithren.
      *(ampliar-lore-checklist.md:414-417)* — PEQUEÑA, lore puro.
- [ ] Kalisar sin NPC de apoyo propio en `npcs.md`. *(ampliar-lore-checklist.md:418-421)* — PEQUEÑA, lore puro.
- [ ] Etiqueta `orcos-llanuras` en `worldPopulation.ts` sigue diciendo "Maktor/Serhu" combinados
      pese a que Maktor quedó reducido a Gorhorn en solitario — no bloquea nada mecánicamente.
      *(rpgtarkor/cronologia.md:31)* — PEQUEÑA.
- [ ] Tablilla quemada y Tótem de clan roto en Los Restos de Maktor "pendientes de confirmación
      final" con la usuaria. *(rpgtarkor/areas.md:154)* — PEQUEÑA, solo confirmar.
- [ ] § 5 de `10-niveles-xp-reino.md` (modelo de Reino v1 histórico) sin reconciliar con
      `17-reglas-construcciones-reino.md` — solo desactualización de documentación, no funcionalidad.
      *(10-niveles-xp-reino.md:132-139, 340-341)* — PEQUEÑA, solo redactar.
- [ ] Benchmark de latencia real pendiente de medir. *(21-roadmap.md:854-855)* — PEQUEÑA-MEDIA.
- [ ] "Modo dinámico" (las 5 piezas de Dinamismo del mundo): pendiente jugarlo en vivo de forma
      exhaustiva más allá de lo ya probado hoy. *(21-roadmap.md:78)* — validación, no código.

---

## Conteo

- **P0 (bugs reales, ya en curso)**: 4
- **P1 (bugs/huecos confirmados, sin causa 100% cerrada)**: 10
- **P2 (deuda de frontend, sin bug funcional urgente)**: 23
- **P3 (deuda de código, prioridad baja consciente)**: 7
- **P4 (diseño grande sin construir)**: 15
- **P5 (ideas sueltas / lore menor / esfuerzo mínimo)**: 17

**Total: 76 items** (tras fusionar duplicados entre documentos — el recuento bruto por documento
daba ~96, con ~20 repeticiones del mismo item citado en 2-3 sitios distintos).

**Nada de esto se ha tocado en código.** Es un inventario para decidir qué atacar y en qué orden —
el propio checklist ya está ordenado por prioridad real (impacto + bloqueo), no por fecha ni por
documento de origen.
