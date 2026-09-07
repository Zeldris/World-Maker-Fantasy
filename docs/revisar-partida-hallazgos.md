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
    ese tope. **PENDIENTE.**
12. **Dificultades de las habilidades de utilidad deben ser Fácil (6) / Medio (12) / Difícil (18)**
    (escala nueva, más baja que la actual) — y la dificultad concreta asignada a cada uso debe variar
    según el nivel/fuerza real del NPC objetivo (ej. Analizar a un enemigo "fácil" debería tirar
    contra Fácil, no siempre el mismo umbral fijo). **PENDIENTE — revisar la asignación real hoy.**
13. **El consumo de agua pasa a depender de un ítem "odre"** — se craftea con peletería T1; en una
    zona con agua, una acción narrativa de "recoger agua" lo convierte en "odre con agua"; beber de
    él sube el agua del personaje al 100%. Revisar también qué recursos/comida ya existentes deberían
    subir agua al consumirse (comida cocinada u otros) — estos suben un % proporcional al agua que
    contengan, no el 100% fijo del odre. **PENDIENTE — sistema nuevo, cambia la mecánica actual de
    agua.**
14. **La primera tirada de iniciativa de un combate debe ser "tirada del jugador vs tirada del
    enemigo"**, no una comparación contra una dificultad fija como aparentemente ocurre hoy.
    **PENDIENTE — confirmar el cálculo real de la primera iniciativa en `turnResolution.ts`.**
15. **Quitar el concepto "Éxito con coste"** de las tiradas — la usuaria considera que hoy no
    aporta ningún valor real (no hay ningún coste real asociado a ese grado de éxito). Ver también
    hallazgo de FASE 3 (nº 27) sobre el propio bug de esta etiqueta. **PENDIENTE — decisión de
    diseño, simplificar a Éxito/Fallo (¿se mantiene "claro" como matiz, o se unifica del todo?
    aclarar con la usuaria antes de tocar `dice.ts`/`combatExchange.ts`.**

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
    panel de combate de todos modos. Puede ser el mismo tipo de guard de "narración-vs-mecánica" que
    ya existe para otros casos (`hasFalseDefenseNarration` y similares) pero sin cubrir este patrón
    concreto ("intento fallido de ataque a distancia, la presa escapa" ≠ "combate trabado").
    **PENDIENTE — revisar guards de apertura de combate.**
18. **Rematar a un enemigo ya CONVALECIENTE con un ataque no debería narrarse como un golpe de
    combate normal** — debería narrarse explícitamente como el remate/golpe final que acaba con su
    vida, y ese remate debe describirse a través de la habilidad concreta que se decidió usar para
    ese golpe (no una frase genérica de "impacta de nuevo"). **PENDIENTE — revisar el bloque de
    `narration.narration` para el desenlace MUERTO cuando el NPC ya venía CONVALECIENTE.**

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
    porque hoy no acarrea ningún coste real distinguible de un éxito limpio — no es un bug de cálculo
    en este caso concreto, es la misma petición de simplificación del hallazgo 15.
20. **Los textos de desglose de tiradas (`(11 −2sal + 2hab = 11/2)` etc.) fuerzan salto de línea y
    quedan mal ajustados cuando se acumulan muchos modificadores** (malus + bonus + multiplicador) —
    pide revisar la disposición visual de esos datos (quizás apilar en vez de forzar una sola línea
    horizontal). **PENDIENTE — ajuste de CSS/layout en `DiceRoll.tsx`/`CombatExchangeBadge.tsx`.**

### FASE 4 — Lore / catálogo

21. **La veta de hierro de Los Pilares Rotos tiene nombre/slug erróneo en la Enciclopedia**: se
    muestra como "Veta de hierro de Los Pilares Rotos" — según la corrección de hoy mismo (ver
    sesión de lore, punto A3/#11), es hierro corriente de TODA la llanura, no exclusivo de Los
    Pilares Rotos — debería llamarse "Veta de Hierro de las Llanuras Rojas" (nombre exacto a
    confirmar con la usuaria). **PENDIENTE — renombrar en `worldCatalog.ts` + `loreChunks.ts` +
    `flora-fauna.md` si aplica.**
22. **Ítem "Leche de Múrgol"/planta "Múrgoles domados" mal categorizado** — la captura muestra "3
    Leche de Múrgol" con un icono/etiqueta de "Múrgoles domados" bajo un icono de hoja (flora), pese
    a que la leche de Múrgol es un producto animal, no flora — algo está mal en el `category`/
    `role`/icono de este ítem en el catálogo. **PENDIENTE — revisar la ficha real en
    `worldCatalog.ts`.**
23. **"Bug de matching de texto": "la espina dorsal" enlazada como la criatura "Espina del Viento"**
    — narración real: "una sensación de alerta le recorre la [Espina del Viento] dorsal" (la frase
    natural es "la espina dorsal"). Investigación en curso (agente interrumpido por límite de
    sesión) apuntaba a que `worldCatalog.ts` registra `'espina'` (sola, sin "del viento") como alias
    corto de `espina-del-viento`, y ese alias se reutiliza sin filtro de longitud/contigüidad en el
    enlazador de texto clicable de la Enciclopedia (mismo patrón de fallo YA documentado en el punto
    "Detectores de texto libre" de `revisar-partida.md`, hallazgo 1: alias cortos sin filtro de
    longitud). **PENDIENTE — retomar la investigación, `worldCatalog.ts` línea ~7728, alias
    `'espina'` de `espina-del-viento`, y revisar el enlazador de la Enciclopedia (probablemente
    `enciclopediaIndex.ts` en frontend) para exigir coincidencia de la frase completa, no solo la
    primera palabra.**

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
    **PENDIENTE — aplicar el mismo patrón del fix de hoy también al bloque `awaitingDefense`.**
25a. **Mientras se está ejecutando CUALQUIER tirada de iniciativa, todo debería estar bloqueado**
    — la usuaria consiguió lanzar una habilidad antes de que el roll de los dados de iniciativa
    terminara de animarse/resolverse. Reportado como mensaje separado e independiente del 25b.
    **PENDIENTE — revisar qué bloquea hoy el composer/botones de acción mientras `lastInitiativeRoll`
    está animándose (`DiceRollVs` en curso).**
25b. **Entre que se resuelve un intercambio de combate y se lanza/muestra la tirada de iniciativa
    siguiente pasa demasiado tiempo** — debería ser casi inmediato. Y durante ESE tramo concreto
    (resultado del combate ya mostrado, iniciativa aún sin lanzar/resolver) todo debería estar
    BLOQUEADO también. **PENDIENTE — revisar el delay real entre el fin del intercambio y el inicio
    de la animación de iniciativa siguiente, y si hay algún lock durante ese tramo.**
26. **El estado final del NPC tras una tirada de iniciativa a veces se representa mal en el
    frontend** (sin más detalle de qué "mal" exactamente — revisar con más capturas o reproduciendo
    en vivo). **PENDIENTE — reproducir con más detalle.**
27. **El scroll/foco automático a la tirada NO se posiciona bien para las tiradas de iniciativa**
    en general (la propia usuaria matiza después que en el caso concreto de turno de defensa sí
    funciona bien — así que el problema parece acotado a iniciativa fuera de ese caso). **PENDIENTE
    — acotar exactamente en qué transición de iniciativa falla el `useScrollIntoViewOnMount` de
    `DiceRoll.tsx`.**

**Interacción con la zona y el mapa**:
28. **La Zona no muestra ni menciona al propio Gorhorn en el mapa** (ver captura de La Hondonada del
    Eco, sin marcador del jugador visible) — relacionado con la pieza "Punto del jugador en el mapa
    de Zona" ya cerrada el 2026-09-04 (commit `48d78f9`, ver memoria) — puede haberse roto o no
    aplicarse en esta Location/momento concreto. **PENDIENTE — verificar si el marcador del jugador
    sigue funcionando tras cambios posteriores.**
29. **En el Campamento del Clan Serhu, los puntos del mapa de Zona no están bien colocados** — la
    usuaria debería aparecer más cerca del Pozo de Cauce Viejo (de donde viene) y hay fauna colocada
    DENTRO del recinto amurallado del campamento, lo cual no tiene sentido narrativo (un campamento
    vigilado no debería tener fauna salvaje suelta dentro). **PENDIENTE — revisar el sembrado de
    `ZonePoint` de `campamento-serhu` en `worldCatalog.ts`.**
29b. **Lo marcado con puntos en el mapa de Zona no coincide con lo que ofrecen realmente Cazar/
    Recolectar/Minar** — confirmado en DOS Locations distintas (primero en La Hondonada del Eco, y
    después confirmado también en Los Pilares Rotos: "ya me sale lo mismo en esas habilidades que
    me salía en la Hondonada", como si el pool de recursos/fauna no cambiara de verdad entre
    Locations) — parece un problema general de desincronización entre el `ZonePoint` mostrado en el
    mapa y el pool real que consultan esas 3 habilidades, no un caso puntual de una sola zona.
    **PENDIENTE — alto impacto, revisar cómo `cazar.ts`/`recolectar.ts`/minería obtienen su pool de
    candidatos frente a lo que `zona.ts` sirve como `ZonePoint`, puede que compartan una fuente que
    no distingue bien la Location actual.**
30. **No hay forma de acceder al interior del campamento (Karot Vekhad) desde la Zona** — pese a que
    hoy mismo se documentó el interior en `areas.md`/`loreChunks.ts` (ver sesión de lore de hoy), no
    está claro cómo se entra a él desde la vista de Zona en el juego real — falta confirmar si existe
    algún link/acción real para entrar, o si es un hueco de UI. **PENDIENTE — investigar el flujo
    real de entrada a `campamento-serhu-interior`.**
31. **La zona en el mapa mezcla fauna diurna y nocturna a la vez siendo de día** — se supone que la
    Zona debe reflejar solo lo que está en escena/activo según el momento del día real. **PENDIENTE
    — revisar el filtro de día/noche en el endpoint de Zona (`zona.ts`).**
32. **Las zonas deben tener variante visual de estación** (igual que ya tienen de día/noche) — salvo
    los interiores de campamentos, que no deberían tener variante de estación. **PENDIENTE —
    confirmar si esto ya existe parcialmente o es trabajo nuevo del todo.**
33. **En la vista previa/modal de una Location del mapa, muchas imágenes no se ven aunque ya estén
    descubiertas y la imagen ya esté generada** (ver captura de La Hondonada del Eco, con miniatura
    negra/vacía en el modal pese a "Generar mapa" ya hecho). **PENDIENTE — revisar por qué el modal
    no está resolviendo la URL de la imagen ya generada.**
34. **Desde el mapa de Zona se puede llegar a fichas de la Enciclopedia de cosas aún NO descubiertas
    en la partida real** — clicando un punto del mapa de Zona que el jugador no ha descubierto
    todavía en la ficción, hoy se puede acceder a su información completa. Se pide que, en ese caso,
    el nombre en el punto de la Zona se muestre con interrogantes y que el modal NO ofrezca el botón
    "Ver en la Enciclopedia", para no filtrar información de algo no descubierto. **DIAGNOSTICADO,
    PENDIENTE DE APLICAR** — confirmado que `GET /saves/:id/zona` no cruza contra `DiscoveredEntity`
    (el modelo real de "¿está descubierto?" en este proyecto, ya usado en `world.ts`), así que todo
    `ZonePoint` revela su nombre real y su botón de Enciclopedia sin mirar si la partida ya lo
    descubrió. Fix identificado: `zona.ts` anota cada punto con un booleano `descubierto` (cruzando
    `DiscoveredEntity` por `targetSlug`+tipo), `ZonePointDetailModal.tsx` usa `'???'` en vez del
    nombre real y oculta el botón cuando `!descubierto`. No aplicado todavía en esta ronda — toca el
    contrato de la respuesta de Zona, mejor con más tiempo dedicado que el resto de fixes puntuales
    de hoy.

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
    y el nombre/slug que la ficha busca. **DIAGNOSTICADO** — confirmado: `imageAssets.ts` hace match
    EXACTO de string (`${entitySlug}-${sizeProfile}.${ext}`) sin ninguna normalización, así que
    cualquier archivo subido a mano cuyo nombre no coincida carácter a carácter con el slug real del
    catálogo queda invisible sin ningún error visible (falla silenciosa, `imageUrls` vuelve `null`).
    Es una dependencia frágil de nomenclatura manual, no un bug de lógica — **PENDIENTE decidir con
    la usuaria si se construye un script de auditoría que liste `uploads/images/**` contra los slugs
    reales del catálogo y señale huérfanos**, antes de perseguir fichas una a una.
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
    mensaje del log, no solo el texto "+50 XP"). **DIAGNOSTICADO, PENDIENTE DE APLICAR** — el banner
    del log hoy lo decide siempre el FRONTEND (`mentionedEntityBanner.ts`, por prioridad de mención
    en el TEXTO de la narración, nunca de forma determinista), así que un turno de llegada que
    también menciona a un NPC presente pierde el banner de la Location (prioridad NPC > Location).
    `isFirstVisitToDestination`/hito `'descubrimiento'` ya se calculan en `turnResolution.ts:6053-
    6093` pero no viajan al payload del turno de forma que el frontend pueda forzar el banner de la
    Location con prioridad. Requiere decidir el contrato de `NarrateResult` (exponer
    `toLocationSlug` del turno de viaje) antes de tocar el flujo central de narración — no aplicado
    todavía por precaución, es una pieza más grande de lo que aparenta.
39. **Al usar una habilidad de crafteo desde el composer, el texto completo de la habilidad se pega
    en el prompt en vez de un link/chip que luego se sustituya** — se pide que, igual que otros
    chips ya clicables, insertar una habilidad de crafteo en el composer deje un link que en la
    narración final se sustituya por el texto real, en vez de pegar el texto completo de la
    habilidad tal cual en el campo de escritura. **PENDIENTE.**
40. **Las habilidades/recetas de crafteo deberían mostrar en el hover si el jugador tiene los
    recursos necesarios o no** — o, alternativamente, mostrarse habilitadas/deshabilitadas (con
    sombreado) según si se puede craftear ya mismo o no. **PENDIENTE.**
41. **"Infusión de Pétalos de Flor de Ceniza" aparece como RECOLECTABLE cuando debería ser
    CRAFTEABLE** (una infusión no se recolecta directamente de la naturaleza, se prepara). **PENDIENTE
    — revisar su ficha en `worldCatalog.ts`, parece un item mal clasificado.**
42. **Las sugerencias de acción ("💡 Sugerir") se descartan del juego por ahora** — decisión
    explícita de la usuaria: "son malísimas y no aportan casi ningún valor... por ahora lo
    descartamos... dejándolo pendiente por si algún día lo mejoramos". **ACCIÓN CLARA: quitar el
    botón/funcionalidad de sugerencias del frontend (sin borrar el código de generación del todo,
    solo desactivar la entrada visible) — pendiente de ejecutar.**
43. **Revisar cuándo y cómo se lanza "¿Interactuar?" (el aviso de "Gesgurio busca tu atención...")**
    — la usuaria pide anotarlo en el checklist de pruebas vivo (`docs/checklist-pruebas-juego.md`)
    como funcionalidad a probar a fondo y mejorar hasta que aporte valor real, no arreglarlo ya
    mismo. **ACCIÓN CLARA: añadir entrada al checklist de pruebas vivo, sin tocar código todavía.**

---
