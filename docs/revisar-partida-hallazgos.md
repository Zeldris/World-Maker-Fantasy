# Revisar partida — hallazgos

**Continúa a [archivo/revisar-partida-hallazgos-historico.md](archivo/revisar-partida-hallazgos-historico.md)**
(archivado 2026-09-03, cubre 2026-08-01→2026-08-30) desde 2026-09-03. Este documento arranca limpio
— las nuevas entradas de sesiones de juego a partir de aquí van abajo.

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de lo que se ha encontrado cada
vez que se ejecuta el runbook de `revisar-partida.md` sobre una partida real. Objetivo: antes de
reportar algo como "nuevo", mirar aquí (y en el archivo histórico) si ya se vio y qué se decidió —
evita re-investigar lo mismo dos veces y deja claro qué clases de fallo ya tienen detector
determinista y cuáles siguen abiertas. **Verificar siempre contra el código real antes de dar algo
por pendiente solo porque un documento lo diga** — la auditoría de 2026-09-03 confirmó varias veces
que memoria/checklists se desincronizan del código más rápido de lo esperado.

Cada entrada: fecha, qué se detectó (cita textual si es narración), causa raíz, y estado.

---

## Índice

- **2026-09-06** — sesión de pruebas larga de la usuaria (~40 hallazgos): timing de combate/
  iniciativa, matching de texto (Espina del Viento/dorsal), diseño de barras de habilidades,
  interacción con NPCs (Aprender oficio/Entregar/Capturar), enciclopedia/mapa de zona
  desincronizados, generación de prompts de imagen rota, vocabulario de tiradas. Todos PENDIENTES.

---

## 2026-09-06 — Sesión de pruebas larga de la usuaria

Volcado de una sesión de juego extensa, mensajes sueltos con capturas de pantalla, sin runbook
completo ejecutado aparte (no se corrió `auditSave.ts` ni se revisó `logs/backend.log` línea a
línea para esta tanda — cada hallazgo parte solo de lo que se ve en la captura/mensaje). Todos
PENDIENTES salvo que se indique lo contrario. Organizado por fase del runbook.

### FASE 1 — Funcionalidad / integridad técnica

1. **Al derrotar (MUERTO) a un Ruptidar y a un Guchapo, no se ofrece la opción de Desollar** —
   ambos NPCs deberían tener despiece real (ver `flora-fauna.md`). Falta confirmar si es un bug de
   la UI (no aparece el botón) o si el catálogo real de esos dos NPCs no tiene `harvestYields`
   asociado a MUERTO. **PENDIENTE.**
2. **Vencer al Ruptidar no dio experiencia** — a confirmar si es la regla real (algunos NPCs sin
   XP asignada aposta) o un bug; la usuaria lo señala "por si acaso", no como bug confirmado.
   **PENDIENTE, verificar regla real primero.**
3. **La energía de una habilidad debe restarse en el momento de pulsar "Actuar", no antes/después**
   — a día de hoy aparentemente no se resta en ese momento exacto (sin más detalle de cuándo se
   resta hoy). **PENDIENTE — falta reproducir con más precisión cuándo pasa hoy.**
4. **Capturar debe exigir tener un ítem de captura real en el inventario** — confirmado que hoy
   el botón "Capturar" YA se ofrece correctamente solo sobre CONVALECIENTE (no sobre MUERTO, eso es
   correcto y no es bug). Lo pendiente es una funcionalidad nueva: que el botón solo aparezca si el
   inventario tiene al menos un ítem capturador real, y que al pulsarlo se abra un modal para elegir
   CON QUÉ ítem capturar (listando todos los que sirvan), en vez de resolverlo sin más. **PENDIENTE
   — funcionalidad nueva a construir, no una corrección de un bug visible hoy.**
5. **Saquear solo debería poder usarse sobre enemigos MUERTOS en la zona con loot sin saquear
   todavía** — a día de hoy (aparentemente) se puede invocar en otros casos. **PENDIENTE —
   confirmar la condición real de habilitación del botón/habilidad hoy.**
6. **"Aprender oficio" no debería ser una habilidad genérica más** — en vez de depender de una
   habilidad suelta, al interactuar con un NPC tipo Maestro de oficio (o comerciante, NPC de
   misión, NPC de lore) en un interior debería abrirse un menú contextual de opciones según el tipo
   de NPC: Charlar / Aprender profesión / Comerciar / Reclutar / Misión: <título> / Combatir / Salir
   (lista de ejemplo, no cerrada) — sustituyendo el modelo actual de "todo depende de una
   habilidad". **CERRADO (2026-09-06)**: campo nuevo `Npc.interactionTypes` (multivaluado,
   MAESTRO_OFICIO/NPC_MISION/NPC_LORE), disparado por texto libre (`dialogueTarget`), tarjeta
   persistente (`pendingNpcInteractionOffer`, mismo patrón que `pendingQuestOfferInfo`). 12 Maestros
   de oficio ya sembrados. Comerciar y Reclutar pacífico por conversación quedan fuera de alcance
   (sin mecánica real todavía, anotados para diseño futuro). Ver plan completo en el historial de
   commits. `tsc -b` limpio, 19 tests nuevos en verde.
7. **"Entregar" debe ser solo para entregar ítems a compañeros del equipo** — hoy parece permitir
   entregar a cualquiera; debe limitarse a consultar/entregar en el inventario de los compañeros
   reclutados, no NPCs sueltos. **CERRADO (2026-09-06)**: `entrega.ts` ahora exige un `Companion`
   real (`sourceSlug` coincidente) tanto en `GET /entregables` como en el `POST`, en vez de aceptar
   cualquier NPC interactuable en escena. 2 tests nuevos confirman el rechazo real. `tsc -b` limpio.
8. **Recoger vs Recolectar mezclados** — "Recoger" debería ser SOLO para ítems sueltos en el
   suelo de la zona (incluyendo objetos que el propio jugador tire desde su inventario — falta la
   funcionalidad de "tirar" que los coloque en la Zona/mapa, visible y recogible después);
   "Recolectar" es la habilidad de recursos naturales de herboristería/similar. Hoy hay cosas que
   salen en Recoger que deberían salir en Recolectar.
   **CERRADO COMPLETO (2026-09-06)**:
   - **Mitad de datos**: 10 fichas de `HarvestYield` de categoría `planta` (enredaderas-llanuras,
     musgo-arcilla, hojas-telda-fuente, boungo, verdileas-acuaticas, chudos-rojizos, pasto-solar,
     gradias, pasto-de-sangre, trigo-escarlata) llevaban `metodoObtencion: 'PASIVO'` (Recoger) en
     vez de `'EXTRACCION'` (Recolectar/herborista) — corregido, solo quedan en Recoger las 2
     fuentes que sí encajan (`osario-de-la-manada`, `restos-personales-maktor`, categoría `objeto`).
   - **Mecánica nueva de "tirar"**: tabla nueva `DroppedItem` (por partida, posición = `Save.zonaPosX/Y`
     del jugador en el momento de tirar, persiste para siempre hasta recogerlo — ambas decisiones
     confirmadas con la usuaria). Botón "Tirar" en el detalle de un objeto del Inventario (solo si
     no está equipado ni es una captura en tránsito); aparece como pin gris nuevo (tipo `OBJETO`) en
     el mapa de Zona, con botón "Recoger" en su modal de detalle — mismo patrón visual que NPC/fauna
     dinámicos, sin tocar `ZonePoint` (catálogo fijo). Endpoints
     `POST /saves/:id/inventario/:itemId/tirar` y `POST /saves/:id/dropped-items/:droppedItemId/recoger`.
   - Verificado: `tsc -b` limpio backend+frontend, 42 tests nuevos en verde (unitarios + integración
     real contra Postgres), guards clave verificados rigurosamente (revertir/confirmar fallo/restaurar).
   - Pendiente reverificar en vivo con Playwright (requiere reiniciar backend por la migración nueva).
9. **Desollar está marcada como habilidad PASIVA pero se puede añadir a la barra de habilidades**
   — una pasiva no debería poder añadirse a ninguna barra activa. **CERRADO (2026-09-06)**: la lista
   `PASSIVE_ABILITY_NAMES` solo la conocía `HabilidadesPanel.tsx`; movida a
   `frontend/src/lib/passiveAbilities.ts` y aplicada también al filtro de candidatos del editor de
   barras (`GameView.tsx`). `tsc -b` limpio.
10. **Rediseño completo de las barras de habilidades** (sustituye el diseño de "Combate/Profesión/
    Reino/General" de sesiones anteriores, ver `tarkor_sistema_unificado_tirada_dados_2026-09-04` en
    memoria): en vez de poder tener 3 barras POR TIPO con 12 slots cada una, pasar a 3 barras EN
    GENERAL (sin diferenciar tipo) de 20 slots cada una — la primera creada por defecto y vacía, las
    otras 2 opcionales. Al editar una barra, 3 tabs dentro del modal (General/Profesión/Reino) para
    elegir qué habilidades meter, sin importar de qué tab salieron una vez están en la barra. Al
    pulsar el botón de Habilidades en juego, se listan directamente las barras que ya tienes (sin el
    paso intermedio de "qué tipo de barra quieres" que hay hoy).
    **CERRADO (2026-09-06)**: `SkillBar` pierde el campo `category` (tope de slots 12→20, tope de
    barras pasa a ser del save entero, no por categoría); `SkillBarMenu.tsx` fusiona las 2 pantallas
    viejas en una sola (lista directa de barras); `SkillBarEditor.tsx` gana 3 tabs
    General/Profesión/Reino. Añadido de paso: botón para borrar una barra 2ª/3ª (el endpoint ya
    existía sin ningún botón que lo usara). **Sin migración de datos** (decisión explícita de la
    usuaria, "empezar de cero") — las 4 filas de `SkillBar` que había en la única partida real
    existente se perdieron con la migración. Verificado: `tsc -b` limpio backend+frontend, 40 tests
    backend en verde (12 unitarios + 4 integración + 24 de `detail.test.ts` actualizado), guard
    clave verificado rigurosamente. Pendiente reverificar en vivo con Playwright (requiere reiniciar
    backend por la migración).
11. **Descansar debe reponer solo +30 de energía** (hoy repone más, sin cifra exacta dada) **y
    tener cooldown de 3h de tiempo de FICCIÓN** (no tiempo real) — si se intenta usar antes de que
    pasen 3h desde el último uso, debería responder narrativamente que el personaje no está cansado
    y no quiere volver a descansar, forzando a usar comida para completar la energía que falte tras
    ese tope. **CERRADO (2026-09-06)**: causa raíz real era que Descansar reponía al 100% del tope
    (refugio) o al 50% (cualquier sitio) — desproporcionado con Constitución alta. Ahora repone
    `ENERGY_REST_RESTORE = 30` fijo, igual en cualquier sitio. Cooldown de 3h de ficción nuevo
    (`Save.lastRestAtMinutes`, mismo patrón que `dispersadoDesdeMinutes` de caza) — un intento
    dentro del cooldown se rechaza con narración determinista fija, sin tocar energía ni reiniciar
    el propio cooldown. **Decisión ampliada de la usuaria durante el diseño**: Descansar deja de
    curar condición física por completo (antes curaba hasta HERIDO/GRAVE según el sitio) — la única
    vía de curar condición fuera de combate pasa a ser "Curar" con objetos médicos (ya existía,
    intacta). Comer/Beber gana de paso la capacidad de reponer energía (`curaEnergia` de catálogo,
    antes ignorado por completo, solo aplicaba `curaHambre`) — necesario para que "forzar a usar
    comida para completar la energía" tenga sentido real. Verificado: `tsc -b` limpio
    backend+frontend, 2 guards clave verificados rigurosamente, suites en verde (línea base de
    fallos de infraestructura preexistente sin cambios). Pendiente reverificar en vivo (requiere
    reiniciar backend por la migración nueva).
12. **Dificultades de las habilidades de utilidad deben ser Fácil (6) / Medio (12) / Difícil (18)**
    (escala nueva, más baja que la actual) — y la dificultad concreta asignada a cada uso debe variar
    según el nivel/fuerza real del NPC objetivo (ej. Analizar a un enemigo "fácil" debería tirar
    contra Fácil, no siempre el mismo umbral fijo). **CERRADO (2026-09-07)**: rediseño más amplio de
    lo que sugería el enunciado, aclarado con la usuaria durante el diseño — lo que decide la
    dificultad no es el nivel sino la **diferencia de SUMA de los 7 atributos** de cada lado
    (`sumAttributes`, `equipment.ts`), con 4 tramos **6/12/15/18** (`utilityDifficultyFor`,
    `npcScene.ts`, junto a `difficultyHintFor` que sigue igual para ataque/defensa). Además, la
    usuaria pidió una matriz completa por combinación de roles, no solo el número: confirmado contra
    el catálogo real (13 habilidades `rol:'utilidad'` en `classAbilities.ts`) que **ataque-vs-defensa
    ya es tirada-vs-tirada directa** (`resolveExchange`, la dificultad ahí no decide nada) y
    **utilidad-vs-cualquiera ya es dificultad fija propia** (`resolveIndependentExchange`) — el único
    caso especial es **ataque-vs-utilidad**: si la utilidad lleva `ATAQUE`/`ATURDIMIENTO`/
    `INTIMIDACION`/`CONTROL` (para/interrumpe el ataque rival — Adaptación Rápida/Aullido Adaptativo/
    Camuflaje/Opresión Mental), pasa a tirada-vs-tirada como una defensa real (`isReactiveUtility`,
    `combatExchange.ts`, nuevo); si lleva solo `ANALISIS`/`RECUPERACION` (7+1 habilidades, nunca para
    el ataque), el ataque entra normal Y la utilidad se juzga en paralelo con la escala nueva. Ajuste
    fino en la rama `resolveExchange` de `turnResolution.ts` (CASO DEFENSA/CASO ATAQUE): además del
    gate ya existente de contragolpe (`ATAQUE`/`CONTRA`/`REFRACTAR`), ahora también sabe "interrumpir"
    (`ATURDIMIENTO`/`INTIMIDACION`/`CONTROL`, roba iniciativa; `INTIMIDACION` además cancela el golpe
    base entrante), con el mismo margen decisivo (±10) que ya exigía un contragolpe real. Verificado:
    `tsc -b` limpio backend+frontend, 13 tests unitarios nuevos (`sumAttributes`/
    `utilityDifficultyFor`/`isReactiveUtility`) verificados rigurosamente, suite de integración
    existente ampliada con aserciones reales de dificultad (encontró y corrigió un bug real propio:
    el lado JUGADOR de "Analizar rival" usaba la dificultad vieja por nivel, solo el lado NPC estaba
    arreglado) y 2 tests reescritos para el nuevo comportamiento de Contraataque (ganar el contraste
    ahora para el golpe, no "recibes Y devuelves"). Línea base de fallos de infraestructura
    preexistente sin cambios (33, mismos 3 archivos de siempre). CONTRA/REFRACTAR/AGUANTE (siempre
    `rol:'defensa'`, nunca `'utilidad'`) confirmados fuera de alcance — ya funcionaban bien.
    Combate múltiple (`combateMultiple.ts`) fuera de alcance, no tocado. Pendiente reverificar en
    vivo con Playwright.
13. **El consumo de agua pasa a depender de un ítem "odre"** — se craftea con peletería T1; en una
    zona con agua, una acción narrativa de "recoger agua" lo convierte en "odre con agua"; beber de
    él sube el agua del personaje al 100%. Revisar también qué recursos/comida ya existentes deberían
    subir agua al consumirse (comida cocinada u otros) — estos suben un % proporcional al agua que
    contengan, no el 100% fijo del odre. **CERRADO (2026-09-07)**: el viejo botón fijo "Beber agua"
    (sin ítem, repone 100% en cualquier sitio, `Save.beberAgua`) se retiró del todo — Sed ahora sube
    por `ItemCatalog.curaAgua` de ítems reales, mismo mecanismo exacto que `curaHambre`
    (`lastAtMinutesForGanancia`). Modelo de dos ítems (decisión explícita, no un campo de estado en
    `InventoryItem`): `odre-agua` (el accesorio decorativo que ya existía en el catálogo, reubicado
    a `tipo: 'CONSUMIBLE'` sin equipar) es el vacío; `odre-agua-lleno` (nuevo, `curaAgua: 100`) es el
    lleno. Se craftea vacío con peletería (`curtidor-orcos-llanuras`, T1, mismo patrón que
    `SAND_POUCH_RECIPE`) en cualquier sitio; "recoger agua" lo llena SOLO en una de 3 Locations reales
    con agua (Los Manaderos/El Pozo de Cauce Viejo/El Oasis de Chudos Rojos — `CraftingRecipe.location`
    ganó soporte de array de slugs, `location: string | string[] | null`, sin romper las 51 recetas
    existentes con slug único). Al beberlo, un campo nuevo `emptyContainerCatalogSlug` en
    `ItemCatalog` devuelve el odre vacío al inventario en vez de que desaparezca del todo (mecanismo
    genuinamente nuevo, primer caso de "objeto con dos estados" del proyecto). 5 ítems narrativos ya
    existentes ganan `curaAgua` proporcional tras revisar el catálogo completo (31 consumibles reales
    comprobados, no solo los 2 candidatos obvios): `agua-hervida-liquen`, `bulbo-cauce`,
    `liquen-humedo`, `infusion-espiga-roja`, `infusion-petalos-flor-ceniza` — `aguardiente-goirntes`
    quedó fuera a propósito (alcohol, no hidrata). Verificado: `tsc -b` limpio backend+frontend, 8
    tests unitarios nuevos en `crafting.ts` (gate multi-slug + las 2 recetas) verificados
    rigurosamente, test de integración de Comer/Beber reescrito por completo para el nuevo mecanismo
    (confirmando ración+odre en el mismo turno, el odre vacío vuelve al inventario, no desaparece).
    Línea base de fallos de infraestructura preexistente sin cambios (33, mismos 3 archivos de
    siempre). Pendiente reverificar en vivo con Playwright (requiere reiniciar backend + reseed del
    catálogo, ya aplicado en este entorno).
14. **La primera tirada de iniciativa de un combate debe ser "tirada del jugador vs tirada del
    enemigo"**, no una comparación contra una dificultad fija como aparentemente ocurre hoy.
    **CERRADO (2026-09-07)**: confirmado que combate múltiple ya funcionaba así de origen
    (`rollInitiativeMultiple`, tirada real de Destreza para cada participante, sin dificultad fija
    — desempate ya bien resuelto: por `result` → por `destreza` cruda → orden de aparición estable,
    sin necesidad de una tirada extra de desempate). El bug real estaba solo en el 1v1: en la
    apertura de un combate nuevo, un ataque de apertura CON ÉXITO garantizaba la iniciativa al
    jugador sin ninguna tirada real (caía directo a CASO ATAQUE del turno siguiente por simple
    ausencia de `pendingNpcAttack`) — "quién empieza" se decidía solo por si el propio ataque
    superaba `difficultyHintFor` (dificultad fija por nivel), nunca por una tirada-vs-tirada
    Destreza real. Solo el camino de FALLO ya tiraba `rollInitiative`, y de forma puramente
    decorativa (el NPC ya tenía la iniciativa garantizada por el fallo, el resultado no cambiaba
    nada). Fix: añadido un `else if` gemelo al bloque de fallo (`turnResolution.ts`, junto a la
    línea 966) que tira `rollInitiative` real también en el caso de ÉXITO — si el NPC gana, se le
    siembra un `pendingNpcAttack` real (mismo `chooseNpcAbility` reutilizado) para que el
    intercambio del turno siguiente entre en CASO DEFENSA pese a que el jugador fue quien "atacó"
    primero en el texto; si el jugador gana, sin cambios (CASO ATAQUE de siempre). Alcance
    deliberadamente acotado a la apertura (decisión explícita de la usuaria) — rondas posteriores
    del combate se quedan igual, coherente con el propio diseño ya existente (quien gana un
    intercambio mantiene la iniciativa hasta perderla). Verificado: `tsc -b` limpio
    backend+frontend, 2 tests de integración nuevos (NPC gana la apertura / jugador gana la
    apertura) verificados rigurosamente, tests de apertura ya existentes sin cambios de
    comportamiento. Línea base de fallos de infraestructura preexistente sin cambios (3 tests,
    ninguno relacionado con este hallazgo, confirmados fallando igual con y sin el fix).
    **Pendiente aparte, anotado para diseño futuro (fuera de este hallazgo, decisión explícita de
    la usuaria)**: mejorar la PRESENTACIÓN visual de la apertura de combate múltiple en fases
    (tirada propia → resultado de todos → pantalla de elección de objetivo) — el motor de
    emparejamiento (`resolverEnganchesRonda`, reserva/cancelación en cadena/no-vuelve-a-elegir) ya
    existe y funciona bien server-side, recalculado cada ronda tal como la usuaria confirmó que
    debe seguir siendo; lo que falta es solo exponerlo/mostrarlo en UI, sin tocar la lógica de
    negocio ya construida.
15. **Quitar el concepto "Éxito con coste"** de las tiradas — la usuaria considera que hoy no
    aporta ningún valor real (no hay ningún coste real asociado a ese grado de éxito). Ver también
    el caso concreto del hallazgo 19b (Fase 3) sobre el propio bug de esta etiqueta. **CERRADO
    (2026-09-07)**: confirmado que existen dos sistemas paralelos deliberadamente separados —
    `GradoExito` (combate y acciones libres/Huir/Tameo) y `GradoRecurso` (recolección de recursos).
    En combate, `con_coste` era puramente cosmético: el desenlace real de un intercambio
    (`ExchangeOutcome`, decide daño/contragolpe) ya se calculaba por el margen ANTES de que
    `gradoExito` se sobrescribiera solo para reutilizar el mismo campo visual — nunca decidía nada
    mecánico distinto de un éxito limpio, y a veces contradecía el resultado real (el propio bug del
    hallazgo 19b: "Gana Gorhorn" + "Éxito con coste" + 🏆 a la vez). Fuera de combate tampoco tenía
    efecto mecánico, solo cambiaba parcialmente el texto sugerido al LLM. `GradoRecurso`
    (recolección) SÍ tiene efecto real (mitad de cantidad recolectada) y queda intacto, sin tocar —
    decisión explícita de la usuaria durante la sesión ("si con_coste se usa para algo hay que
    ajustar DÓNDE aparece", no eliminarlo de raíz sin mirar). `GradoExito` pasa a ser binario
    (`'claro' | 'fallo'`) en `dice.ts`/`combatExchange.ts`/`narrador.ts` y en los 3 componentes
    frontend que lo pintan (`RollBadge.tsx`, `CombatExchangeBadge.tsx`, `DiceRoll.tsx` — el 🏆
    contradictorio desaparece junto con la etiqueta, el margen real sigue visible). Verificado:
    `tsc -b` limpio backend+frontend, tests unitarios de `dice.ts`/`combatExchange.ts` actualizados
    y verificados rigurosamente, `GradoRecurso`/`recolectar.ts`/`recolectar.test.ts` confirmados
    intactos (mismo número de ocurrencias que antes del cambio). Línea base de fallos de
    infraestructura preexistente sin cambios (4 tests, confirmados fallando igual con y sin el
    fix). Pendiente reverificar en vivo con Playwright: un combate con margen bajo (5-9) y confirmar
    que ya solo aparece "Éxito", sin la etiqueta "con coste" contradictoria.

### FASE 2 — Coherencia narrativa

16. **"MISIÓN PROPUESTA: Acabar con el Orco Enfurecido" describe la misión como si ya se hubiera
    aceptado** ("Gorhorn ha aceptado") en el propio panel de PROPUESTA, antes de que la usuaria
    pulse "Aceptar" — contradicción de estado: si es "propuesta" con botones Aceptar/Cancelar
    todavía visibles, el texto no puede narrar el hecho como ya consumado. **CERRADO (2026-09-06)**:
    era un texto ESTÁTICO de backend (`turnResolution.ts`, no pasa por el LLM, ningún guard podía
    verlo), reescrito en condicional ("pide ayuda... Aceptar la pondría a salvo"). Test de
    integración actualizado. `tsc -b` limpio.
17. **La narración indica que Gorhorn huye del combate, pero el combate se abre igualmente** (ver
    captura del Ruptidar: "el Ruptidar se gira... Gorhorn lanza su hacha... apenas rozan las
    escamas... dejando a Gorhorn solo en el vacío eco de la hondonada" seguido de COMBATIR/HUIR en
    pantalla) — la narración describe una escapada/fallo sin combate trabado, pero el motor abre el
    panel de combate de todos modos. **CERRADO (2026-09-07)**: NO era un guard narración-vs-mecánica
    (tipo `hasFalseDefenseNarration`) — esos comparan la prosa contra un hecho YA calculado; aquí no
    existía ningún hecho calculado de "ataque a distancia fallido, la presa escapa". La apertura de
    combate (`shouldForceCombat`, dentro de `resolveCombatSlugsAndPersist`) decidía mirando solo
    `detectsAttackIntent(action)` sobre el texto del jugador, sin mirar el resultado real de la
    tirada ni el temperamento del objetivo — el Ruptidar ya tenía `temperamento: 'INOFENSIVO'`
    (comentario del enum: "nunca inicia combate"), pero esa protección solo cubría que fuera el
    AGRESOR, no que fuera la VÍCTIMA de un ataque fallido. Decisión de diseño confirmada: si el
    ataque de apertura FALLA contra fauna INOFENSIVO/CAUTELOSO, no se abre combate (la presa escapa
    de verdad); si ACIERTA, se abre con normalidad (fauna inofensiva sigue siendo cazable). Dos
    puntos tocados en `turnResolution.ts`: (1) la rama `detectsAttackIntent` de `shouldForceCombat`
    ahora se condiciona a `!attackMissedNonAggressiveTarget` (nuevo, con reputación de facción vía
    `effectiveTemperamento`); (2) el bloque de apertura que siembra `pendingNpcAttack` en caso de
    fallo tampoco lo hace ya contra fauna no agresiva (`npcTemperamentoNoAgresivo`, temperamento de
    catálogo puro) — sin esto, `esperandoDefensaJugador` seguía quedando `true` pese a no abrirse
    combate, dejando al jugador "defendiéndose" de un NPC que ni ataca ni tiene panel abierto.
    Verificado: `tsc -b` limpio backend+frontend, 2 tests de integración nuevos (Ruptidar real del
    catálogo, apertura con fallo/éxito) verificados rigurosamente en ambos puntos del fix por
    separado. Línea base de fallos de infraestructura preexistente sin cambios (3, mismos tests de
    siempre). Pendiente reverificar en vivo con Playwright: atacar a fauna inofensiva (Ruptidar u
    otra) y confirmar que un fallo no abre el panel de combate, solo narra la escapada.
18. **Rematar a un enemigo ya CONVALECIENTE con un ataque no debería narrarse como un golpe de
    combate normal** — debería narrarse explícitamente como el remate/golpe final que acaba con su
    vida, y ese remate debe describirse a través de la habilidad concreta que se decidió usar para
    ese golpe (no una frase genérica de "impacta de nuevo"). **CERRADO (2026-09-07)**: investigación
    previa confirmó que el nombre/lore de la habilidad de ataque del jugador YA llega al Narrador
    (mecanismo distinto del que se sospechaba en un principio) — cada habilidad del catálogo trae su
    propio `promptText` con lore propio (ej. "Canalizo fuego a través de mi puño..." vs "Aprieto los
    dientes y aguanto el golpe por pura dureza física..."), y ese texto se usa literalmente como la
    acción del jugador (`handleCombatAttack`, frontend) — confirmado con la propia usuaria durante el
    diseño ("¿no lo hacemos ya así?... que siga la línea del lore de la habilidad", sí, ya se hace).
    El hueco real era solo el caso REMATE: `hitSeverityHint` (`combatExchange.ts`) devuelve string
    VACÍO cuando la nueva condición es CONVALECIENTE/MUERTO, así que un golpe normal (no LETAL, que
    ya tenía su propio hint de "golpe final") que remataba a un NPC ya CONVALECIENTE solo recibía el
    texto genérico de `OUTCOME_NARRATION_HINT` por margen ("narra el golpe"), sin ninguna instrucción
    de que ESE golpe concreto acaba con la vida del rival. Fix: bloque nuevo en `turnResolution.ts`
    (hermano del ya existente para LETAL, mismo patrón "YA RESUELTO"), gateado por condición PREVIA
    (`npcParaIntercambio.condicionFisica === 'CONVALECIENTE' && npcTargetNewCondicion === 'MUERTO' &&
    !abilityEffects.includes('LETAL')`) — decisión explícita de la usuaria: bloque independiente por
    condición previa, no ampliar el gate de LETAL existente. No repite el nombre de la habilidad (ya
    llega por `ctx.action`), solo añade la instrucción de que es un remate. Sin guard de prosa nuevo
    (confirmado que el patrón del proyecto para instrucciones de tono/énfasis, como el propio LETAL,
    siempre confía en el hint del prompt sin verificación posterior — no hay precedente de guard para
    este tipo de caso). Verificado: `tsc -b` limpio backend+frontend, test de integración nuevo
    (mismo NPC/siembra CONVALECIENTE que el describe de reputación ya existente) verificando que el
    hint de REMATE llega al contexto del Narrador (`worldFacts`), verificado rigurosamente
    (revertir/confirmar fallo/restaurar). Línea base de fallos de infraestructura preexistente sin
    cambios (3, confirmados con `git stash`/`git stash pop` — un 4º fallo puntual visto en una
    corrida conjunta resultó ser un flake de contención de suite ya conocido, no relacionado:
    `combateMultipleOrquestacion.integration.test.ts` pasa limpio en aislamiento con y sin el fix).
    Pendiente reverificar en vivo con Playwright: rematar a un NPC CONVALECIENTE con un golpe normal
    y confirmar que la narración real menciona el desenlace de muerte a través de la habilidad usada.

### FASE 3 — Vocabulario y prosa (tiradas de dados)

19a. **"Fallo/Fallo" mostrado en una tirada donde, a ojos de la usuaria, Gorhorn (6) debería haber
    ganado por sacar más que Guchapo (11 no, al revés — Guchapo sacó 11, Gorhorn 6)** — **revisando
    con más cuidado, esto NO es un bug de cálculo**: el propio texto del sistema explica "cada lado
    se juzga por su cuenta, sin comparar uno contra otro — el intento de Gorhorn (6) no alcanza lo
    que necesitaba (15)... Guchapo (11) tampoco alcanza lo que necesitaba (15)" — es una tirada de
    utilidad sin oposición directa, cada lado contra un umbral FIJO de 15, no una comparación directa
    entre ambos. "Fallo/Fallo" es coherente con esa regla. Lo que la usuaria cuestiona de fondo es el
    propio DISEÑO de "cada lado contra un umbral fijo" en vez de comparación directa — mismo tema que
    el hallazgo 14 (iniciativa tirada-vs-tirada, no contra dificultad). **NO ES BUG DE CÁLCULO — es
    la misma discusión de diseño del hallazgo 14, revisar juntos qué tiradas deberían ser
    comparación directa y cuáles contra umbral fijo.**
19b. **"Éxito con coste 🏆" mostrado en un resultado de éxito limpio real** (ver captura del combate
    contra el Guchapo: Gorhorn 18+5=23 vs Guchapo 17, "Gana Gorhorn", etiquetado "Éxito con coste")
    — coherente con el hallazgo 15 (Fase 1): la usuaria pide eliminar el concepto "Éxito con coste"
    porque hoy no acarrea ningún coste real distinguible de un éxito limpio. **CERRADO junto al
    hallazgo 15 (2026-09-07)** — causa raíz confirmada: `gradoExito` en combate se sobrescribía por
    el margen del intercambio (umbral `DECISIVE_MARGIN=10`), una escala distinta de "¿quién ganó?" —
    Gorhorn ganó con margen 6 (por debajo del umbral) → `con_coste`, pese a que el resultado real ya
    decía "Gana Gorhorn" con 🏆. Con `GradoExito` binario, este caso ahora muestra solo "Éxito".
20. **Los textos de desglose de tiradas (`(11 −2sal + 2hab = 11/2)` etc.) fuerzan salto de línea y
    quedan mal ajustados cuando se acumulan muchos modificadores** (malus + bonus + multiplicador) —
    pide revisar la disposición visual de esos datos (quizás apilar en vez de forzar una sola línea
    horizontal). **CERRADO (2026-09-07)**: confirmado que el JSX ya segmentaba cada término (malus/
    bono/multiplicador) en su propio `<span>` con color propio, pero el contenedor de la fracción
    entera actuaba como un único bloque inline sin puntos de quiebre internos — con los 3
    modificadores a la vez (`(15 −3sal +4hab = 16 ×1.5 ≈24/2)`) podía desbordar o forzar un salto de
    línea a mitad de un término, sobre todo en badges estrechas de combate múltiple. Decisión
    explícita de la usuaria: NO un wrap libre término a término (dejaría cada número en una posición
    distinta según el ancho, obligando a releer la ecuación cada vez) — quería algo "adaptativo y
    responsive pero que todo coincida siempre en la misma posición". Fix: nuevo componente compartido
    `RollBreakdown.tsx` (petición explícita de la usuaria, además de aprovechado para eliminar la
    duplicación letra por letra que había entre `DiceRoll.tsx`/`CombatExchangeBadge.tsx`) que agrupa
    los términos en 2 átomos con `whitespace-nowrap` propio (`(valor −malus +bono = cruda` / `×mult
    ≈efectiva/2)`) dentro de un `inline-flex flex-wrap` — el orden es siempre el mismo, y si no cabe
    todo en una línea, el corte cae siempre entre los dos grupos completos, nunca a mitad de un
    número; el grupo del multiplicador (el más largo, el que menos aporta a la lectura rápida del
    resultado ya mostrado fuera del paréntesis) es el que cae a una segunda línea cuando hace falta.
    Verificado: `tsc -b` limpio backend+frontend, suite completa de frontend en verde (207 tests, sin
    tests de renderizado dedicados a estos componentes — cambio puramente visual). Pendiente
    reverificar en vivo con Playwright: un intercambio de combate con malus+bono+multiplicador a la
    vez (pasiva racial + condición física degradada + habilidad con bono) y confirmar que el desglose
    se lee bien en ancho estrecho, sin desbordar ni partirse a mitad de número.

### FASE 4 — Lore / catálogo

21. **La veta de hierro de Los Pilares Rotos tiene nombre/slug erróneo en la Enciclopedia**: se
    muestra como "Veta de hierro de Los Pilares Rotos" — según la corrección de hoy mismo (ver
    sesión de lore, punto A3/#11), es hierro corriente de TODA la llanura, no exclusivo de Los
    Pilares Rotos — debería llamarse "Veta de Hierro de las Llanuras Rojas" (nombre exacto a
    confirmar con la usuaria). **CERRADO (2026-09-07)**: el grueso del renombrado YA se había hecho
    en la propia sesión de lore del mismo día (`worldCatalog.ts:8208`, `name:
    'Veta de Hierro de las Llanuras Rojas'`, slug sin tocar —
    `veta-hierro-pilares-rotos` — coherente con `docs/rpgtarkor/actualizaciones-pendientes-lore.md`
    punto A3, ya CERRADO). Quedaban 2 flecos sin propagar, encontrados al reverificar: un comentario
    cosmético desactualizado (`worldCatalog.ts:7649`) y, más importante, el `label` real de
    `WorldPopulation` en `worldPopulation.ts:259` (usado en runtime para spawn/población, no solo
    display) que seguía con el nombre viejo. Ambos corregidos. `loreChunks.ts` confirmado sin ningún
    chunk sobre esta veta (0 coincidencias, coherente con otro hallazgo ya anotado del mismo
    documento de lore: la veta sigue pendiente de indexar en el RAG del narrador, fuera de alcance
    de este hallazgo). Slug estable, sin migración de datos de partidas necesaria — `seed-catalog.ts`
    hace upsert por slug, no reseed destructivo. Verificado: `tsc -b` limpio backend, cambio de datos
    declarativos puros (sin lógica ni guard que verificar), `npm run seed-catalog` corrido para
    propagar el nombre a Postgres local (confirmado "Catálogo de mundo sembrado correctamente",
    incluida la sección "Población del mundo").
22. **Ítem "Leche de Múrgol"/planta "Múrgoles domados" mal categorizado** — la captura muestra "3
    Leche de Múrgol" con un icono/etiqueta de "Múrgoles domados" bajo un icono de hoja (flora), pese
    a que la leche de Múrgol es un producto animal, no flora — algo está mal en el `category`/
    `role`/icono de este ítem en el catálogo. **CERRADO (2026-09-07)**: el ITEM `leche-murgol` en sí
    (`category: 'alimento'`) estaba bien — el icono de hoja venía de la vista de FUENTE/recurso
    (Enciclopedia fauna/flora), que decide 🐾 vs 🌿 mirando `esFauna` (`world.ts`), calculado como
    `ctx.npcSlugs.has(sourceSlug) || harvestSourcesThatAreFaunaWithoutNpc.has(sourceSlug)`. La
    HarvestYield real de esta leche usa `sourceSlug: 'murgoles-domados-campamento'` (DISTINTO del
    Npc `murgol` a propósito — invariante de `metodoObtencion` compartido por `sourceSlug`, el
    Múrgol salvaje ya es CAZA y este es PASIVO, leche de ejemplares ya domados del campamento), así
    que `ctx.npcSlugs.has(...)` siempre daba `false`. Mismo bug EXACTO ya resuelto una vez para
    Cornante/Espina del Viento/Sombra de Kroj (Set `harvestSourcesThatAreFaunaWithoutNpc`,
    `worldCatalog.ts`, comentario de 2026-07-22) — a `murgoles-domados-campamento` nunca se le
    había añadido pese a ser el mismo caso (`sourceCategory: 'fauna'`, sin fila `Npc` con ese slug
    exacto). Fix: añadido al mismo Set — corrige a la vez el icono (`faunaFloraIcon`) y la carpeta
    de imágenes (`imageEntityTypeFor`, mismo criterio compartido). Verificado: `tsc -b` limpio, test
    de integración nuevo (`world.test.ts`, mismo patrón que el test ya existente de Ruptidar)
    confirmando `esFauna === true` para esta fuente, verificado rigurosamente (revertir/confirmar
    fallo/restaurar). Línea base de fallos de infraestructura preexistente sin cambios (2 de los 3
    de siempre en esta corrida — el 3º es un flake probabilístico que no siempre dispara).
23. **"Bug de matching de texto": "la espina dorsal" enlazada como la criatura "Espina del Viento"**
    — narración real: "una sensación de alerta le recorre la [Espina del Viento] dorsal" (la frase
    natural es "la espina dorsal"). **YA CERRADO ANTES DE ESTA SESIÓN (2026-09-06, commit
    `e4534e1`)** — confirmado al reverificar el 2026-09-07: el alias corto `'espina'` (sin "del
    viento") se quitó de `harvestSourceAliases['espina-del-viento']` en `worldCatalog.ts` (comentario
    explicando el motivo junto a la entrada: "espina" es sustantivo común de la lengua, sin relación
    con la criatura en frases normales como "espina dorsal"), quedando solo `['espina del viento',
    'espinas del viento']`. Confirmado que este array (`harvestSourceAliases`) alimenta A LA VEZ el
    enlazador de la Enciclopedia (vía `world.ts` → `entry.aliases` → `enciclopediaIndex.ts`) Y la
    detección de intención de recolección/caza del jugador en texto libre (`matchHarvestSource`,
    `harvest.ts`) — mismo dato, dos consumidores. Al revisar el mismo patrón se encontraron 4 alias
    similares de riesgo teórico (sustantivos comunes: `musgo`, `roca`/`piedra`, `veta`/`mena`,
    `espiga`) — decisión explícita de la usuaria: NO quitarlos de forma preventiva, a diferencia de
    "espina" estos SÍ tienen uso legítimo real (el jugador necesita poder escribir "pico piedra"/
    "recojo musgo" y que el motor lo reconozca) — se actuará solo si aparece un caso real de
    colisión jugando, mismo criterio que motivó el fix original de "espina".

### FASE 5 — UX visible en pantalla

**Timing de combate/iniciativa** (relacionado con los 2 bugs de timing ya cerrados hoy en
`useCombatFlow.ts`/`DiceRoll.tsx`/`CombatPanel.tsx` — commits `f82198b`/`8889cd5`/`3dc2713` — pero
la sesión de pruebas encontró MÁS problemas del mismo área que esos fixes no cubrieron):
24. **El fondo del panel de iniciativa (rojo/azul según quién gana) sigue cambiando de color antes
    de que la animación de los dados termine**, y el texto de "elige a ciegas cómo defenderte"
    también aparece antes de tiempo — esto es DISTINTO del bug ya cerrado hoy (el de "Actúas
    primero."/vida del NPC): aquí es el caso `awaitingDefense` (el otro bloque de `CombatPanel.tsx`,
    líneas ~609-630, el que NO se tocó en el fix de hoy) el que necesita el mismo tratamiento
    (`onAllLanded`/estado `initiativeRevealed`) que ya se aplicó al bloque de `!awaitingDefense`.
    **YA CERRADO ANTES DE ESTA SESIÓN (2026-09-06, commit `6fe5eba`)** — confirmado al reverificar
    el 2026-09-07: exactamente el mismo patrón (`initiativeRevealed`/`onAllLanded`) ya se aplicó al
    bloque `awaitingDefense`, con el fondo gateado por `defenseBg = !ended && awaitingDefense &&
    (!lastInitiativeRoll || initiativeRevealed)` y el texto por `{initiativeRevealed ? '...' :
    'Tirando iniciativa...'}`.
25a. **Mientras se está ejecutando CUALQUIER tirada de iniciativa, todo debería estar bloqueado**
    — la usuaria consiguió lanzar una habilidad antes de que el roll de los dados de iniciativa
    terminara de animarse/resolverse. Reportado como mensaje separado e independiente del 25b.
    **CERRADO (2026-09-07)**: el mismo commit `6fe5eba` (ayer) ya había creado el estado
    `awaitingNextInitiative` en `useCombatFlow.ts` (true desde que se programa el retraso de
    2×ROLL_DURATION_MS hasta que se aplica de verdad) pero se quedó a medias — el estado existía y
    se exponía desde el hook, pero ningún consumidor lo leía: `GameView.tsx` seguía pasando solo
    `busy={combat.combatBusy}` a `CombatPanel`/`CombatComposer`, sin incluirlo en el cálculo. Fix:
    cableado en los 2 sitios (`busy={combat.combatBusy || combat.awaitingNextInitiative}`) — ahora
    el composer de texto libre y los botones de habilidad quedan bloqueados también durante la
    animación de la iniciativa siguiente, no solo mientras se espera la respuesta del turno.
    Verificado: `tsc -b` limpio, 2 aserciones nuevas en el describe de timing ya existente
    (`useCombatFlow.test.tsx`, fake timers) confirmando que `awaitingNextInitiative` pasa a `true`
    en el mismo instante que se programa el retraso y vuelve a `false` cuando se aplica, verificado
    rigurosamente (revertir/confirmar fallo/restaurar). Suite completa de frontend en verde (207
    tests). Pendiente reverificar en vivo con Playwright: lanzar una habilidad justo después de que
    se resuelva un intercambio y confirmar que el composer/botones quedan bloqueados hasta que la
    animación de la iniciativa siguiente termina.
25b. **Entre que se resuelve un intercambio de combate y se lanza/muestra la tirada de iniciativa
    siguiente pasa demasiado tiempo** — debería ser casi inmediato. Y durante ESE tramo concreto
    (resultado del combate ya mostrado, iniciativa aún sin lanzar/resolver) todo debería estar
    BLOQUEADO también. **CERRADO (2026-09-07)**: investigado en dos partes. (1) Bloqueo — confirmado
    que `lastInitiativeRoll` se anima y `awaitingNextInitiative` se activa de forma SÍNCRONA en el
    mismo tick que se resuelve el turno (`useCombatFlow.ts`, `handleCombatTurnResolved`) — no hay
    ningún `setTimeout`/debounce intermedio ni hueco sin bloquear entre "el intercambio se resuelve"
    y "el lock se activa"; el fix del hallazgo 25a (cableado de `awaitingNextInitiative` a `busy`,
    mismo commit) ya cubre este tramo entero de punta a punta, sin cambios adicionales necesarios.
    (2) La percepción de "demasiado tiempo" en sí: confirmado que NO es un delay muerto añadido —
    `DiceRollVs` anima los 2 dados de iniciativa SECUENCIALMENTE (uno tras otro, diseño deliberado
    de una sesión anterior, "como si jugaras una partida D&D de verdad"), ~10s reales totales
    (2×`ROLL_DURATION_MS`) desde que se resuelve el turno hasta que el segundo dado (el que decide
    el ganador) aterriza. Decisión explícita de la usuaria: dejar la duración de la animación como
    está, no es un bug — el hallazgo queda cerrado solo con la parte de bloqueo, ya cubierta por el
    commit del 25a (`66a2e6a`).
26. **El estado final del NPC tras una tirada de iniciativa a veces se representa mal en el
    frontend** (sin más detalle de qué "mal" exactamente — revisar con más capturas o reproduciendo
    en vivo). **PENDIENTE — reproducir con más detalle.**
27. **El scroll/foco automático a la tirada NO se posiciona bien para las tiradas de iniciativa**
    en general (la propia usuaria matiza después que en el caso concreto de turno de defensa sí
    funciona bien — así que el problema parece acotado a iniciativa fuera de ese caso). **CERRADO
    (2026-09-07)**: causa raíz confirmada — `useScrollIntoViewOnMount` (`DiceRoll.tsx`) dispara el
    `scrollIntoView` dentro de un `useEffect(..., [])`, que solo corre en el MONTAJE real del
    componente. Los dos `<DiceRollVs>` de iniciativa en `CombatPanel.tsx` (bloques `awaitingDefense`
    y `!awaitingDefense`) no llevaban ningún `key` — `CombatPanel` se monta una única vez por
    combate y permanece montado turno tras turno, así que React reconciliaba la MISMA instancia de
    `DiceRollVs` en cada iniciativa nueva en vez de desmontar/remontar: el scroll solo se disparaba
    en la primera iniciativa del combate, nunca en las siguientes — coherente con que la usuaria
    viera bien el caso de defensa (a menudo la primera transición tras abrir el panel) y mal el
    resto. Fix: `key={`${jugador.roll}-${npc.roll}`}` en ambos `<DiceRollVs>` — los rolls crudos de
    cada tirada bastan como identidad distinta turno a turno, forzando el remount real (y con él,
    que el `useEffect` de scroll se dispare de nuevo) en cada iniciativa. Verificado: `tsc -b`
    limpio, suite completa de frontend en verde (207 tests, sin regresión) — sin test de
    renderizado dedicado (`CombatPanel.tsx` no tiene test file propio, `scrollIntoView` tampoco
    existe en jsdom, mismo criterio que el resto de scroll automático del proyecto). Pendiente
    reverificar en vivo con Playwright: combate con 2+ intercambios y confirmar que la vista hace
    scroll a la tirada de iniciativa en CADA transición, no solo la primera.

**Interacción con la zona y el mapa**:
28. **La Zona no muestra ni menciona al propio Gorhorn en el mapa** (ver captura de La Hondonada del
    Eco, sin marcador del jugador visible) — relacionado con la pieza "Punto del jugador en el mapa
    de Zona" ya cerrada el 2026-09-04 (commit `48d78f9`, ver memoria) — puede haberse roto o no
    aplicarse en esta Location/momento concreto. **YA CERRADO ANTES DE ESTA SESIÓN (2026-09-06,
    commit `15fa0cf`)** — confirmado al reverificar el 2026-09-07: era una regresión real, no un
    caso puntual de esta Location. `48d78f9` implementó `Save.zonaPosX/Y` pero nunca los
    inicializaba al CREAR una partida — solo se fijaban la primera vez que se resolvía un viaje
    real. Una partida que actuaba (cazar, recolectar, hablar...) sin haber viajado todavía se
    quedaba con `zonaPosX/Y = null` para siempre, así que `GET /saves/:id/zona` devolvía
    `jugador: null` — exactamente el caso de La Hondonada del Eco (Location de inicio del
    personaje). El commit `15fa0cf` (mismo día, comentario citando textualmente "la zona no está
    presentando a Gorhorn") inicializa `zonaPosX/Y`/`zonaPosEntradaX/Y` al centro del lienzo
    (400, 300) en `saves/creation.ts` al crear la partida. Endpoint y frontend confirmados sin
    ningún otro cambio de fondo desde entonces, mecanismo intacto.
29. **En el Campamento del Clan Serhu, los puntos del mapa de Zona no están bien colocados** — la
    usuaria debería aparecer más cerca del Pozo de Cauce Viejo (de donde viene) y hay fauna colocada
    DENTRO del recinto amurallado del campamento, lo cual no tiene sentido narrativo (un campamento
    vigilado no debería tener fauna salvaje suelta dentro). **CERRADO (2026-09-07)**: reverificado
    contra el catálogo real — el problema de fondo (fauna dentro del recinto) ya no existe: el
    hallazgo es de ANTES de la pieza "Trabajador de Reino" (2026-08-31), que movió toda la fauna
    (Torgash/Ulkha) al interior del campamento y dejó el mapa exterior con solo 2 `ZonePoint`
    (Edificio Karot Vekhad + Recurso de múrgoles ya domados) — coherente con la descripción real de
    la Location ("empalizada de estacas afiladas... vigías en las torres de la entrada"), sin nada
    salvaje suelto hoy. La parte de "aparecer más cerca del Pozo de Cauce Viejo": confirmado que la
    posición de entrada al llegar a CUALQUIER Location se calcula por dirección cardinal genérica
    entre coordenadas de mundo (`turnResolution.ts`/`zonaPosicion.ts`, uno de 8 puntos fijos del
    lienzo), el MISMO mecanismo para todo el juego — decisión explícita de la usuaria: no es un bug
    puntual de este campamento, no se construye una entrada custom por pareja origen→destino.
29b. **Lo marcado con puntos en el mapa de Zona no coincide con lo que ofrecen realmente Cazar/
    Recolectar/Minar** — confirmado en DOS Locations distintas (primero en La Hondonada del Eco, y
    después confirmado también en Los Pilares Rotos: "ya me sale lo mismo en esas habilidades que
    me salía en la Hondonada", como si el pool de recursos/fauna no cambiara de verdad entre
    Locations) — parece un problema general de desincronización entre el `ZonePoint` mostrado en el
    mapa y el pool real que consultan esas 3 habilidades, no un caso puntual de una sola zona.
    **CERRADO (2026-09-07)**: confirmado bug real de cobertura incompleta, no diseño deliberado —
    `zona.ts` ya filtraba correctamente por Location exacta; `recolectar.ts` (Minar/Talar/
    Recolectar) ya tenía un candado OPCIONAL (`harvestSourceHomeLocationSlug`, sin entrada = sigue
    elegible en toda la región) pero cubría solo 39/77 fuentes; `cazar.ts` **nunca lo consultaba en
    absoluto**, así que NINGUNA de las 37 fichas de fauna cazable respetaba Location alguna, ni
    siquiera las que ya tenían `Npc.homeLocationSlug` propio (usado solo por `npcScene.ts` hasta
    ahora). Decisión de la usuaria: ir a fondo, no dejar la mitad para otra sesión — auditoría
    completa del catálogo (77 fuentes + 37 fichas de fauna) y decisión de lore caso por caso para
    las que no tenían ningún ancla real, no solo conectar lo mecánico. Cambios: (1)
    `harvestSourceHomeLocationSlug` ampliado a `Record<string, string | string[]>` para representar
    fielmente casos multi-Location reales (misma corriente subterránea aflorando en 3 puntos —
    Bulbo/Liquen del Cauce); (2) 11 fichas de fauna con `homeLocationSlug` ya escrito conectadas
    mecánicamente a la tabla; (3) 7 fichas de fauna sin ningún ancla, decididas con la usuaria a
    partir de su propio lore (Aullador Rojo→Pastos de la Deriva, Canizor→Restos de Maktor por su
    mención directa al Clan, Corredor de Cauce→Manaderos donde parece, Gargantúa de
    Ceniza→Osario de la Manada donde ya hay un esqueleto sembrado, Corretolvas/Múrgol trasladados
    desde su propio `ZonePoint` ya existente); (4) 6 fuentes de flora/mineral con pista de lore
    clara (Arena Imán→Agujas Imán, Flor de Ceniza/Raíz de Fuego→Fumarolas Negras, Salvia del
    Polvo→Hondonada del Eco); (5) función pura compartida `matchesHarvestSourceHome` (`harvest.ts`)
    extraída para que `cazar.ts` y `recolectar.ts` apliquen el mismo candado sin duplicar lógica.
    Decisiones explícitas de NO anclar (mantener el filtro de región amplio, coherente con su
    propio lore): Ruptidar ("presente en cualquier zona arenosa, no en un único punto", ya bien
    representado por 6 `ZonePoint`), Zense Ceniza ("carroñera errante", y además fauna de prueba
    compartida en la suite de integración real — revertido tras encontrar que romper 7 tests de
    integración por esta única entrada no compensaba, mismo criterio de "no forzar candado sin
    necesidad real" que Ruptidar), Cardo Brújula/Espiga Roja/Matorral de Cuerno (sin ninguna pista
    de lore que las distinga de la llanura genérica — decisión explícita de no inventar). Verificado:
    `tsc -b` limpio, tests nuevos en `harvest.test.ts` (función pura), `cazar.integration.test.ts` y
    `recolectar.integration.test.ts` (candado string único, candado array multi-Location, fauna sin
    candado sin regresión), verificado rigurosamente (revertir/confirmar fallo/restaurar). Tests
    unitarios existentes de `cazar.test.ts`/`recolectar.test.ts` (mocks completos de Prisma)
    ajustados: sus fixtures reutilizaban slugs reales del catálogo (`murgol`/`cruzavientos`/
    `arena-iman`/`salvia-del-polvo`) sin Location coherente con el candado nuevo — corregido con la
    Location real de cada uno. Confirmado que ninguna Location elegida queda fuera del núcleo
    jugable (`nucleoJugable` por defecto `true`, ninguna de las candidatas lo desactiva). Línea base
    de fallos de infraestructura preexistente sin cambios (3, mismos de siempre, confirmado con
    `git stash`/`git stash pop` que el caso "Múrgol/Ruptidar" ya fallaba igual ANTES de este
    hallazgo). Pendiente reverificar en vivo con Playwright: ir de La Hondonada del Eco a Los
    Pilares Rotos y confirmar que el pool de Cazar/Recolectar/Minar cambia de verdad entre ambas.
30. **No hay forma de acceder al interior del campamento (Karot Vekhad) desde la Zona** — pese a que
    hoy mismo se documentó el interior en `areas.md`/`loreChunks.ts` (ver sesión de lore de hoy), no
    está claro cómo se entra a él desde la vista de Zona en el juego real — falta confirmar si existe
    algún link/acción real para entrar, o si es un hueco de UI. **CERRADO — VERIFICADO, NO ES BUG
    (2026-09-07)**: `campamento-serhu-interior` ya es una Location real jugable (`kind: 'interior'`,
    solo metadato descriptivo, sin filtro real en el código) con `LocationLink` real desde
    `campamento-serhu` (instantáneo a propósito, ~1 min de ficción, "reutiliza el sistema de viaje
    normal sin ningún mecanismo narrativo nuevo", pieza "Trabajador de Reino" 2026-08-31). El
    mecanismo real de entrada YA funciona hoy vía el botón "Viajar" estándar del panel Mapa
    (`TravelDestinationModal` → `GET /saves/:id/destinos-viaje`) — lista cualquier Location ya
    visitada, o (con el mapa de Llanuras revelado) toda Location de la región, sin ningún filtro
    por `kind` que excluya interiores. El "EDIFICIO Karot Vekhad" que sí aparece como `ZonePoint`
    en el mapa exterior es solo informativo/posicional (abre su modal de detalle), no dispara viaje
    — pero no hace falta, el modal "Viajar" ya cubre la entrada igual que cualquier otra Location.
    Único requisito real: haber visitado `campamento-serhu-interior` al menos una vez o tener el
    mapa revelado — casi seguro cumplido si el jugador ya usó "Trabajador de Reino" en esa partida.
31. **La zona en el mapa mezcla fauna diurna y nocturna a la vez siendo de día** — se supone que la
    Zona debe reflejar solo lo que está en escena/activo según el momento del día real. **YA CERRADO
    ANTES DE ESTA SESIÓN (2026-09-06, commit `15fa0cf`)** — confirmado al reverificar el 2026-09-07:
    el filtro `faunaMomentoDelDia` ya existía para NPC/fauna dinámicos sin `ZonePoint` propio, pero
    nunca se aplicaba a los puntos sembrados a mano del catálogo (ej. Kirelon Arenoso, fauna
    nocturna) — corregido en el mismo commit del hallazgo 28.
32. **Las zonas deben tener variante visual de estación** (igual que ya tienen de día/noche) — salvo
    los interiores de campamentos, que no deberían tener variante de estación. **CERRADO (2026-09-07,
    parte de código)**: confirmado que el sistema de variante de estación para Location/Zona ya
    existe COMPLETO desde el 2026-08-27 (backend YA lee `Estacion` real vía `estacionFor` y hace
    fallback en cascada en `zoneMapImageUrl`, frontend YA tiene tabs de estación en la Enciclopedia)
    — el hallazgo estaba redactado sin conocer ese trabajo previo. Lo único que faltaba de verdad:
    ningún filtro excluía `kind: 'interior'` (hoy solo `campamento-serhu-interior`) del cruce de
    estación — `zona.ts` le aplicaba `estacionFor` igual que a cualquier Location exterior. Fix:
    `estacion = kind === 'interior' ? null : ESTACION_A_SLUG[estacionFor(...)]` — `zoneMapImageUrl`
    ya admitía `estacion: null` con fallback en cascada, sin tocar su firma. Verificado: `tsc -b`
    limpio, 2 tests nuevos en `zona.test.ts` (interior pide sin estación / exterior sí la pide)
    verificados rigurosamente (revertir/confirmar fallo/restaurar). Línea base de fallos de
    infraestructura preexistente sin cambios (3, mismos de siempre). **Pendiente aparte, fuera de
    alcance de este cambio de código**: generar/subir las imágenes reales de verano/otoño/invierno
    para las 12 Locations existentes (hoy solo tienen primavera subida, decisión ya conocida y
    anotada en `docs/rpgtarkor/imagenes-prompts.md`) — trabajo de asset, no de lógica.
33. **En la vista previa/modal de una Location del mapa, muchas imágenes no se ven aunque ya estén
    descubiertas y la imagen ya esté generada** (ver captura de La Hondonada del Eco, con miniatura
    negra/vacía en el modal pese a "Generar mapa" ya hecho). **YA CERRADO ANTES DE ESTA SESIÓN
    (2026-09-06, commit `15fa0cf`)** — confirmado al reverificar el 2026-09-07: el comentario del
    propio fix cita casi textualmente este hallazgo ("muchas locations en la preview del mapa no se
    ven aunque ya las descubrí y la imagen ya está añadida"). Causa raíz: un asentamiento exigía
    ÚNICAMENTE su `iconoUrl` (asset propio nuevo, mucho menos probable de estar generado) e ignoraba
    el banner/thumbnail ya generados que alimentan el propio mapa de Zona — `DetailModal.tsx` ahora
    hace fallback completo: `iconoUrl ?? banner ?? thumbnail`.
34. **Desde el mapa de Zona se puede llegar a fichas de la Enciclopedia de cosas aún NO descubiertas
    en la partida real** — clicando un punto del mapa de Zona que el jugador no ha descubierto
    todavía en la ficción, hoy se puede acceder a su información completa. Se pide que, en ese caso,
    el nombre en el punto de la Zona se muestre con interrogantes y que el modal NO ofrezca el botón
    "Ver en la Enciclopedia", para no filtrar información de algo no descubierto. **CERRADO
    (2026-09-07)**: diagnóstico previo confirmado y aplicado. `zona.ts` ahora cruza cada `ZonePoint`/
    dinámico contra `DiscoveredEntity` (mismo criterio real ya usado en `world.ts` § `isDiscovered`,
    sin la excepción de `nucleoJugable===false`: esos NPC nunca aparecen en escena/mapa real). La
    traducción `ZonePoint.tipo → entityType` no es 1:1 (matiz no anticipado en el diagnóstico
    original): FAUNA/NPC resuelven a `'npc'` o `'fauna'` según `Npc.kind` (`'PRINCIPAL'` → npc, el
    resto → fauna), RECURSO resuelve a `'fauna'` (fuente sin ficha Npc propia, ver hallazgo 22) o
    `'flora'` — mismo mapeo que `imageEntityTypeFor` en `world.ts`, sin poder reutilizarlo directo
    (función local no exportada). EDIFICIO siempre "descubierto" (nunca tiene ficha). OBJETO
    (dinámico "Tirar", hallazgo 8, posterior al diagnóstico original) también siempre "descubierto"
    a propósito: es una instancia real ya visible en el suelo de esa partida, no un secreto de
    catálogo. Backend devuelve `nombre: '???'` directamente cuando no está descubierto (cubre el
    mapa entero de una vez, sin tocar cada renderizado del frontend) más un campo `descubierto`
    nuevo; `ZonePointDetailModal.tsx` oculta "Ver en la Enciclopedia" cuando `!descubierto`, aunque
    exista ficha real, y muestra un texto distinto ("Todavía no lo has descubierto en la partida").
    Verificado: `tsc -b` limpio backend+frontend, 4 tests nuevos en `zona.test.ts` (FAUNA/RECURSO no
    descubiertos → `'???'`, EDIFICIO/OBJETO siempre descubiertos), 19 tests preexistentes del mismo
    archivo ajustados (mock de `discoveredEntity` nuevo, con los 4 slugs ya usados simulados como
    ya descubiertos para no tocar sus aserciones de nombre), verificado rigurosamente (revertir/
    confirmar fallo/restaurar). Suite completa backend (2253 tests) y frontend (207 tests) en verde.
    Línea base de fallos de infraestructura preexistente sin cambios (3, mismos de siempre).

**Enciclopedia y generación de imágenes**:
35. **El Ruptidar no aparece como descubierto en la Enciclopedia** pese a haberlo encontrado/
    combatido en la partida real. **YA ARREGLADO ANTES DE ESTA SESIÓN (2026-09-03)** —
    `recordEntityDiscoveries` ya usa `npcAttackTarget?.name` de forma determinista (no depende de
    que el LLM lo nombre), con test de integración real para el caso Ruptidar
    (`turn.integration.test.ts`, "recordEntityDiscoveries usa npcAttackTarget de forma
    determinista"). Si la usuaria lo sigue viendo en su partida real, lo más probable es que sea una
    partida creada ANTES de ese fix (nunca se le aplicó retroactivamente) — **PENDIENTE solo
    reverificar en vivo con una partida/combate nuevo**, no hace falta más código.
35b. **Algunas imágenes no se ven en fichas de la Enciclopedia** (mensaje separado del 33, que es
    sobre el modal del mapa de Zona — este es sobre la navegación de la Enciclopedia en sí) — la
    usuaria sospecha que puede ser un desajuste entre el nombre real del archivo de imagen ya subido
    y el nombre/slug que la ficha busca. **CERRADO (2026-09-07)**: script de auditoría nuevo
    (`backend/src/scripts/auditImages.ts`, `npm run audit-images`) — solo lectura, compara
    `uploads/images/<entityType>/*` contra los slugs reales del catálogo (fauna/flora/npc/item/
    location/faction, más zona por el mismo slug que location) y lista huérfanos (archivo sin slug
    real que lo reclame) y slugs sin imagen. Match por PREFIJO, no igualdad exacta — necesario tras
    descubrir en la primera corrida que tanto `location` (sufijos de momento/estación, hallazgo 32)
    como `fauna` (sufijo de sexo `-macho`/`-hembra`) ya usan nombres reales con variante que un
    match exacto habría marcado como 16+ falsos huérfanos. Corrida real sobre el estado actual del
    proyecto: encontró 3 huérfanos reales — `buitre-cenizo-macho-banner.png` (nombre viejo, el slug
    real es `zense-ceniza` tras un renombrado de sesión anterior), `clan-serhu-banner2.png` (sufijo
    `banner2` en vez de `banner`), `campamento-serhu-interior-dia-primavera.png` (sin sufijo `-mapa`
    esperado) — y decenas de "sin imagen" reales (esperado, la mayoría del catálogo nunca tuvo
    imagen subida). Verificado: `tsc -b` limpio, corrida real confirmada contra el filesystem del
    proyecto. Sin test dedicado (mismo criterio que el resto de `scripts/`, ninguno lo tiene — solo
    I/O de filesystem/catálogo estático, sin lógica de producción).
36. **La generación de prompts/imágenes (miniatura, banner, mapa) está fallando con "No se pudo
    generar — inténtalo de nuevo"** en varias entidades — a investigar si es un problema puntual de
    la sesión (límite de API/rate limit) o un bug real. La usuaria plantea, aparte, la idea de
    montar un agente de generación de prompts en local para no depender de límites de API externos
    — **anotada como idea a futuro, no una tarea inmediata.** **CAUSA RAÍZ ENCONTRADA Y CERRADA
    PARCIALMENTE (2026-09-06)**: el mensaje genérico ocultaba la causa real en 2 sitios —
    `ImagePromptDisplay.tsx` descartaba el error en un `catch {}` mudo (ahora muestra `err.message`
    real, que `fetchJson` ya propaga desde `body.error`), y el backend (`world.ts`,
    `POST /world/:slug/image-prompt`) no tenía try/catch cuando TODOS los proveedores de IA fallaban
    — devolvía un 500 crudo de Fastify en vez de un mensaje legible (ahora 502 con mensaje claro +
    log del error real). Con esto la próxima vez que falle se podrá ver la causa real (rate limit
    vs. entidad inválida vs. todos los proveedores caídos) en vez de un mensaje mudo — sigue
    PENDIENTE confirmar en vivo cuál era la causa real de esta sesión concreta.
37. **Los banners mostrados en el log deben seguir 4 reglas de selección de variante**: (1) momento
    del día (día/noche) y (2) estación del personaje son SIEMPRE obligatorias; (3) variante sexo
    (macho/hembra) de un ser vivo es obligatoria SOLO de noche, y en el resto de casos se usa si
    existen variantes o la única versión si no las hay. Confirmar si el selector de banner real hoy
    ya sigue esta lógica o hace algo distinto. **DIAGNOSTICADO — ES TRABAJO NUEVO, no un bug**:
    `resolveBannerUrl` (`mentionedEntityBanner.ts`) hoy NO mira momento/estación en absoluto, y usa
    SIEMPRE la primera variante de sexo disponible (no "solo de noche"). Además, el modelo de datos
    (`variantesTiempo`) solo existe para `Location` — fauna/NPC no tienen ningún campo de variante
    día/noche/estación todavía. Haría falta (a) decidir si se amplía `variantesTiempo` a fauna/NPC
    en catálogo+API, y (b) reescribir `resolveBannerUrl` para las 4 reglas. **PENDIENTE — pieza de
    diseño/implementación completa, no un ajuste de una línea; alcance a decidir con la usuaria.**

**Otras piezas de UX/diseño**:
38. **Falta mostrar la imagen de la Location en el log cuando se produce un DESCUBRIMIENTO** (viajar
    y llegar a un sitio nuevo debería venir acompañado de la imagen de esa Location en el propio
    mensaje del log, no solo el texto "+50 XP"). **CERRADO (2026-09-07)**: diagnóstico previo
    confirmado y aplicado, más simple de lo que parecía — `TravelResolution.path` (travel.ts) ya
    trae los slugs del camino en orden, así que el último elemento (`path[path.length-1]`) es el
    slug del destino, sin necesitar ampliar `TravelResolution` con un `toLocationSlug` nuevo como
    sugería el diagnóstico original. Backend: campo nuevo `discoveredLocationSlug: string | null` en
    `NarrateAndPersistResult` (`turnResolution.ts`) — `null` salvo que este turno sea la primera
    visita real al destino de un viaje (`isFirstVisitToDestination`, calculado dentro de la
    transacción principal, expuesto vía el resultado de `$transaction` igual que `deathCount`).
    Frontend: `buildEntityBanner` (`useEntityBanner.ts`) gana un tercer parámetro opcional
    `forcedTarget: { entityType, entitySlug }` con prioridad ABSOLUTA — se salta
    `pickMentionedEntityBanner` (texto) del todo y resuelve directo vía `resolveEntityBannerFromRef`
    (mismo mecanismo ya usado para banners persistidos), con fallback al camino normal si la
    Location forzada no tiene imagen real subida. `useTurnFlow.ts` pasa `{ entityType: 'location',
    entitySlug: discoveredLocationSlug }` cuando el campo viene relleno. Verificado: `tsc -b` limpio
    backend+frontend, 2 tests de integración nuevos en backend (primera visita real trae el slug /
    segunda visita al mismo destino da `null`) y 3 tests nuevos en frontend (`forcedTarget` gana a
    una mención de NPC en el texto, persiste la referencia forzada, cae al camino normal si la
    Location forzada no tiene imagen), verificado rigurosamente (revertir/confirmar fallo/
    restaurar) en ambos lados. Suite completa backend (2254 tests, línea base de 3 fallos de
    infraestructura preexistente sin cambios, confirmado estable en 3 corridas — un 4º fallo
    puntual visto en una corrida resultó ser el mismo flake de contención de suite ya conocido de
    `combateMultipleOrquestacion.integration.test.ts`, pasa limpio en aislamiento) y frontend (210
    tests) en verde. Pendiente reverificar en vivo con Playwright: viajar por primera vez a una
    Location con imagen banner subida y un NPC presente a la vez, confirmar que el banner mostrado
    es el de la Location, no el del NPC.
39. **Al usar una habilidad de crafteo desde el composer, el texto completo de la habilidad se pega
    en el prompt en vez de un link/chip que luego se sustituya** — se pide que, igual que otros
    chips ya clicables, insertar una habilidad de crafteo en el composer deje un link que en la
    narración final se sustituya por el texto real, en vez de pegar el texto completo de la
    habilidad tal cual en el campo de escritura. **CERRADO (2026-09-07)**: mecanismo de chip
    (`insertChip`/`ComposerChip.value`, `ChatComposer.tsx`) ya existía y era reutilizable — no hizo
    falta diseñar nada nuevo. Causa raíz: todas las tarjetas de habilidad (combate y crafteo)
    comparten un único `handleAttachAbility` (`GameView.tsx`), cuya rama final por defecto (sin
    modal propio) llamaba `setText(ability.promptText)` — decisión explícita de 2026-08-30 para
    habilidades GENERALES de combate ("sustituir, no concatenar"), aplicada sin querer también a
    recetas de crafteo, pegando el texto completo en vez de un chip. Fix: nueva rama para
    `ability.category === 'profesion'` (criterio ya usado en el resto del archivo para distinguir
    crafteo) que guarda `{ chip: {...} }` en `pendingComposerTextRef` en vez de un string — mismo
    patrón ya existente de "texto pendiente hasta que el composer se remonte" (bug de 2026-08-30,
    la barra de habilidades desmonta `ChatComposer`), extendido para admitir también un chip
    pendiente (`clear()` + `insertChip()` en vez de `setText()`). El valor real que lee el modelo
    (`promptText`) sigue viajando igual (`ComposerChip.value`); solo cambia lo que se VE en el
    composer — nombre corto + icono en vez de texto largo. Combate general (fuera de `'profesion'`)
    sin cambios, sigue con `setText` tal como la usuaria ya había decidido. Verificado: `tsc -b`
    limpio, suite completa de frontend en verde (210 tests, sin regresión) — sin test dedicado
    (`GameView.tsx`/`ChatComposer.tsx` no tienen test unitario propio en todo el proyecto, se
    prueban jugando en vivo). Pendiente reverificar en vivo con Playwright: pulsar una receta de
    crafteo y confirmar que el composer muestra un chip corto, no el texto completo de la acción.
40. **Las habilidades/recetas de crafteo deberían mostrar en el hover si el jugador tiene los
    recursos necesarios o no** — o, alternativamente, mostrarse habilitadas/deshabilitadas (con
    sombreado) según si se puede craftear ya mismo o no. **YA CERRADO ANTES DE ESTA SESIÓN
    (2026-08-13)** — confirmado al reverificar el 2026-09-07: implementado en su totalidad desde
    hace casi un mes, ambas variantes pedidas a la vez. `GET /saves/:id/recipes-status`
    (`backend/src/routes/saves/recipesStatus.ts`) cruza cada receta contra el inventario real, los
    atributos efectivos (equipo incluido), la ubicación actual y las reglas de reino, reutilizando
    literalmente `checkIngredients()`/`checkRequisitos()` — las mismas funciones que ya validan un
    crafteo real al confirmarlo, "nunca se duplica el criterio de qué hace falta, solo se expone en
    modo consulta" (comentario propio del archivo). Frontend: `AbilityGrid`/`IconCard`
    (`HabilidadesPanel.tsx`) deshabilita la tarjeta con sombreado real (`disabled={!status.met}`) Y
    muestra tooltip con el detalle exacto ("Necesita: Cuero 5/10, Fibra 2/3.", más requisitos de
    atributo/ubicación faltantes) — `useRecipesData.ts` recarga el estado con cada cambio de
    inventario/atributos/ubicación. Pendiente reverificar en vivo con Playwright: abrir la pestaña
    Profesiones con recursos insuficientes para alguna receta y confirmar el sombreado + tooltip.
41. **"Infusión de Pétalos de Flor de Ceniza" aparece como RECOLECTABLE cuando debería ser
    CRAFTEABLE** (una infusión no se recolecta directamente de la naturaleza, se prepara). **NO ES
    UN BUG DE CLASIFICACIÓN — es una decisión de balance ya tomada (2026-08-13, sistema de
    Primeros Auxilios): `flor-de-ceniza` da esta infusión "en crudo" a propósito, deliberadamente
    MÁS FUERTE que las 3 recetas crafteadas de la profesión (curan HERIDO/GRAVE de golpe sin
    craftear nada, según el comentario de esa sesión) — el crafteo existe solo para el escalón
    final (HERIDO→ILESO), no para competir con la materia prima. Decisión confirmada con la usuaria
    (2026-09-07): SÍ quiere cambiarlo a crafteable de verdad (mover `flor-de-ceniza` a dar un
    ingrediente crudo distinto — pétalos sueltos — y añadir una receta de crafteo para la infusión),
    pero **solo apuntado por ahora, no implementado esta sesión** — el cambio exige también revisar
    el balance de las 3 recetas de Primeros Auxilios que hoy asumen que la infusión cruda es más
    fuerte que cualquiera de ellas, trabajo de diseño aparte que no se aborda aquí. **PENDIENTE DE
    IMPLEMENTAR EN OTRA SESIÓN — `worldCatalog.ts`, HarvestYield de `flor-de-ceniza` (línea ~6832)
    + nueva CraftingRecipe + revisar balance de `vendaje-improvisado-orcos-llanuras` y hermanas.**
42. **Las sugerencias de acción ("💡 Sugerir") se descartan del juego por ahora** — decisión
    explícita de la usuaria: "son malísimas y no aportan casi ningún valor... por ahora lo
    descartamos... dejándolo pendiente por si algún día lo mejoramos". **YA CERRADO ANTES DE ESTA
    SESIÓN (2026-09-06)** — confirmado al reverificar el 2026-09-07: `GameView.tsx` ya no pasa
    `onRequestSuggestions` a `ChatComposer.tsx`, así que el botón nunca se monta (renderizado
    condicional en `onRequestSuggestions && (...)`); `SuggestionBar` ya no se importa ni se
    renderiza en ningún JSX; `handleRequestSuggestions` está comentado entero, sin ninguna llamada
    automática de fondo (el diseño original ya era "bajo demanda", solo el clic disparaba la
    llamada — sin el clic posible, no queda nada que se dispare solo). Backend intacto a propósito
    (`POST /saves/:id/suggestions`, código de generación conservado sin tocar, tal como pedía el
    hallazgo) — como el frontend ya no lo llama, el coste de LLM no se incurre. Sin tests rotos
    (ningún test frontend referenciaba el botón; el test backend del endpoint sigue en verde).
43. **Revisar cuándo y cómo se lanza "¿Interactuar?" (el aviso de "Gesgurio busca tu atención...")**
    — la usuaria pide anotarlo en el checklist de pruebas vivo (`docs/checklist-pruebas-juego.md`)
    como funcionalidad a probar a fondo y mejorar hasta que aporte valor real, no arreglarlo ya
    mismo. **CERRADO (2026-09-07)**: confirmado que ya estaba anotado en el checklist vivo
    (§ 6 "Modo dinámico", fila "Revisión de diseño de '¿Interactuar?'", `❌ sin probar a fondo,
    pendiente de mejorar`, citando ya este mismo hallazgo 43) — no hacía falta ninguna acción nueva.

---
