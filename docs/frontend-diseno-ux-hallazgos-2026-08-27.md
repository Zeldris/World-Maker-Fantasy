# Frontend — diseño de producto/UX, hallazgos (2026-08-27)

Auditoría de diseño (no de bugs visuales): arquitectura de la información, datos que el juego ya
calcula pero no se ven, oportunidades de animación/feedback que ayuden a entender el estado del
juego, y cualquier "esto tendría más sentido de otra forma" a nivel de producto. Segundo encargo en
paralelo, pensado para apoyarse en `docs/backend-sin-conectar-frontend-2026-08-27.md` (primer
agente, backend→frontend) — sus 5 hallazgos se retoman aquí como munición, con foco en CÓMO se
deberían ver, no en repetir QUÉ falta.

Método: lectura completa de `frontend/src/pages/GameView.tsx` (orquestador, 1731 líneas),
`App.tsx`, `SideNav.tsx`/`NavTabs.ts` (estructura de navegación), los 14 paneles de
`frontend/src/components/panels/`, `CombatPanel.tsx`/`CombatExchangeBadge.tsx` (vista de combate,
la más rica de la app), `LogPanel.tsx`/`HealthBar.tsx`/`EnergyBar.tsx`/`AttributeBars.tsx`
(componentes de estado reutilizados), y los hooks de `frontend/src/hooks/` para ver qué estado
comparten/no comparten los paneles entre sí.

Cada hallazgo: severidad (impacto en cuánto mejora la experiencia de juego), componente(s) reales
implicados, y recomendación accionable. Solo listado — nada de esto se ha implementado.

Ver también `frontend-checklist-mejoras-2026-08-27.md` — segunda ronda del mismo día, 6 auditorías
en paralelo (UI/UX×4 + integración cruzada + calidad de código) sobre TODO el frontend, criterio
"qué está roto/a medias/inconsistente hoy" en vez de "cómo se debería organizar".

---

## 1. Reorganización / fusión de secciones

### 1.1 — "Zona" es una pestaña de nivel superior que hoy es un callejón sin salida en el 95% de las ubicaciones

**Severidad: media.**

`NavTabs.ts:34` da a "Zona" (🧭) el mismo rango que Mapa/Diario/Misiones/Enciclopedia — un icono
fijo en el riel derecho, siempre visible, siempre pulsable. Pero `ZonaPanel.tsx:42-50` explica por
qué eso es engañoso: *"Las posiciones reales de fauna, recursos y NPCs solo existen hoy en La
Hondonada del Eco"* — en cualquier otra ubicación de la partida, pulsar Zona abre un
`PanelEmptyState` estático y nada más. Conceptualmente Zona no es un tema al mismo nivel que Mapa
(región) — es un *detalle dentro de* la ubicación actual, casi siempre vacío. Competir por un icono
propio en el riel con paneles que casi siempre tienen contenido real (Misiones, Diario) le da a un
callejón sin salida el mismo peso visual que a las secciones que sí devuelven algo.

**Recomendación**: mientras el sistema siga acotado a una sola ubicación, plegar Zona como una
subsección DENTRO de `MapaPanel.tsx` (justo debajo de "Puntos de interés — {región}", que ya
muestra `currentLocation`) — visible solo cuando `data.disponible` es true, en vez de una pestaña
aparte casi siempre vacía. Cuando el sistema se generalice a más ubicaciones (roadmap ya lo prevé),
sí gana sentido como pestaña de pleno derecho.

### 1.2 — Reputación (viva, numérica) y Facciones (estática, narrativa) viven en dos rieles distintos sin ningún enlace entre sí

**Severidad: media-alta.**

`PersonajePanel.tsx` (riel izquierdo, "Tu personaje") tiene una sub-pestaña Reputación que renderiza
`ReputacionPanel.tsx` — barras 0-5000 por facción, banda (Enemigo/Agresivo/.../Amigable), todo
numérico y en vivo. `EnciclopediaPanel.tsx:447` tiene una pestaña "Facciones" aparte, en el riel
derecho ("El mundo"), con la descripción/historia estática de cada facción (confirmado en memoria
de proyecto: *"Faction.description estática a propósito"*). Son la MISMA entidad (la facción X)
mostrada en dos sitios sin ninguna conexión — el jugador que ve "Enemigo" en su barra de reputación
con los Helsig no tiene forma de saltar desde ahí a leer quiénes son o por qué le importa. La app ya
tiene la infraestructura para esto: `useEnciclopediaLink`/`onEntityDetail` (usado en Mapa, Diario,
Log, Combate) abre la ficha de Enciclopedia desde cualquier sitio con un solo clic — `ReputacionPanel`
es de los pocos paneles con datos de catálogo real que NO lo usa.

**Recomendación**: cada fila de `ReputacionPanel.tsx` (línea 53-71) debería ser clicable/tener un
botón ⓘ que abra la ficha de esa facción en la Enciclopedia (mismo patrón `onEntityDetail` que ya usa
`CombatPanel.tsx` para "Consultar en la Enciclopedia" de habilidades/objetos). Encaja también con el
hallazgo 2.3 de abajo (`WorldState.agenda`): si el tracker de conflicto se añade aquí, el salto a
"quiénes son estas dos facciones y por qué luchan" se vuelve aún más necesario.

### 1.3 — Compañero integrado en el Reino: mitad de su ficha vive en Compañeros, la otra mitad en Reino

**Severidad: baja-media.**

`CompanerosPanel.tsx:114-116` muestra `rolReino` como una línea de texto suelta ("Integrado en el
Reino como guardia") dentro de la tarjeta del compañero, pero la asignación real de su plantilla de
equipo (`plantillaEquipoId`) solo se gestiona desde `ReinoPanel.tsx:405-422`
(`companionesReino.map(...)` con su propio `PlantillaSelect`) — un panel distinto, detrás de otra
pestaña del riel izquierdo. Un jugador que quiere revisar o cambiar el equipo de un compañero
integrado tiene que saber de antemano que esa gestión concreta vive en Reino y no en Compañeros,
donde está el resto de su ficha (felicidad/comida/agua, botón "Equipo" que abre
`CompanionEquipModal`).

**Recomendación**: cuando `rolReino` no es null, la tarjeta de `CompanerosPanel.tsx` podría incluir
el mismo `PlantillaSelect` inline (o un enlace directo a la sección relevante de Reino), en vez de
obligar a cambiar de pestaña para completar una acción sobre la misma entidad que ya se está viendo.

### 1.4 — Hambre/Sed del jugador y de los compañeros usan dos componentes visuales distintos para el mismo concepto

**Severidad: baja.**

`EstadisticasPanel.tsx:87-116` pinta Hambre/Sed del jugador con un `<div>` inline a mano (label +
barra + porcentaje). `CompanerosPanel.tsx:14-27` define su propio componente `MiniBar` para
Felicidad/Comida/Agua del compañero — visualmente parecido pero no el mismo componente, con
pequeñas diferencias de tamaño/layout. Es la misma mecánica (recurso 0-100, degrada solo con el
reloj de ficción, umbral de aviso en 25%) mostrada con dos implementaciones separadas que ya han
empezado a divergir.

**Recomendación**: extraer un único componente de barra de recurso (label + pct + umbral de color)
reutilizado en los dos sitios — puramente de mantenimiento/consistencia visual, no cambia ninguna
mecánica.

---

## 2. Datos sin mostrar — arquitectura de cómo mostrarlos

Retoma los 5 hallazgos de `docs/backend-sin-conectar-frontend-2026-08-27.md`, con foco en el CÓMO.

### 2.1 — `activeEffects` (buffs/debuffs con duración por turnos) — cero indicador en combate

**Severidad: alta.** Confirmado leyendo `CombatPanel.tsx` completo (891 líneas) y
`CombatExchangeBadge.tsx` (423 líneas): no hay una sola mención a "efecto", "buff", "duración" ni
nada parecido en ninguno de los dos. El motor ya modela esto con mucho cuidado — `SideRow`
(`CombatExchangeBadge.tsx:197-328`) ya desglosa cada tirada en tooltip explícito: atributo base,
malus por condición física, multiplicador de la árbol de ventajas, todo trazable número a número.
Un AUMENTO/DEBILIDAD activo cambiaría ese mismo `side.value` sin que nada en la cadena lo señale —
es el único ingrediente de la fórmula que hoy queda mudo.

**Cómo mostrarlo, en dos capas**:
- **Capa "ficha", siempre visible durante el combate**: la barra de estado persistente de
  `CombatPanel.tsx:416-423` (`npcs.map(...)` con nombre + `HealthBar`) es hoy el único sitio que
  sobrevive tanto a `awaitingDefense` como al resto de la UI — el comentario de esa línea ya dice
  *"esta NUNCA se oculta... es justo cuando más falta hace verla"*. Añadir ahí, junto a cada nombre,
  un chip pequeño por efecto activo (↑ verde con `attributeColorClasses` del atributo afectado, ↓
  rojo, contador de turnos restantes) es el lugar natural: mismo criterio de "siempre visible" que
  ya justifica que la vida esté ahí. El jugador (su propia fila) necesita el mismo tratamiento —
  hoy esa fila de estado persistente solo lista NPCs (`playerCondicion`/`energia` se retiraron de
  aquí explícitamente en 2026-08-15 porque ya viven en el header, `GameView.tsx:1281-1282`); un
  chip de efecto activo del jugador encajaría junto a `HealthBar`/`EnergyBar` en ese header, que sí
  persiste durante todo el combate.
- **Capa "por qué", en el desglose de la tirada**: `SideRow` (`CombatExchangeBadge.tsx:265-294`) ya
  tiene el patrón exacto para esto — el `TooltipAnchor` de la línea 268 explica `malus` por
  condición física de la misma forma que debería explicar un efecto activo (`"Fuerza 14 +2 por
  Grito de guerra (1 turno restante) = 16"`). Es la misma cadena de causalidad que el jugador ya
  aprendió a leer para el malus de salud, extendida al nuevo caso.

### 2.2 — Estación y clima — el hueco más grave, y el más fácil de anclar a un lugar ya existente

**Severidad: alta.** `MapaPanel.tsx:225-244` tiene una `PanelSection title="Berig"` con el mapa
interactivo, y justo debajo (`:246`) `PanelSection title={... "Puntos de interés — ${región}"}` con
la ficha de la ubicación actual (`:251-257`, nombre + descripción). Es el sitio donde el jugador ya
va a mirar "dónde estoy y qué hay aquí" — y es exactamente donde falta "qué estación/clima hay
ahora", el dato que en la práctica decide qué puede recolectar. Encaja también con
`HarvestSelectionModal` (recolección real, gateada por `estacionRequerida`/`climaRequerido` según
el hallazgo del primer agente): un recurso ausente de esa lista sin explicación es la fricción real
que sufre la jugadora hoy.

**Cómo mostrarlo**: una fila de badges pequeña bajo el título "Berig" (mismo tratamiento visual que
ya usa el pill de `fictionalDate` del header, `GameView.tsx:1300-1302` — fondo `wood-950/60`, borde
`iron-700`, texto `2xs`) con icono de estación (☀️/🍂/❄️/🌸) + nombre Kektira ya construido en
backend (`estacionNombreFor`) y clima (con severidad, `climaNombreFor`). El propio `fictionalDate`
del header es candidato a fusionarse con esto — hoy es solo "Día X, mañana", sin ninguna pista de
estación/clima, aunque viva en la cabecera de la app entera, siempre visible.

### 2.3 — `WorldState.agenda` — mini-tracker junto a lo que ya muestra Reputación

**Severidad: media.** Con el enlace del hallazgo 1.2 ya resuelto, el sitio natural es
`ReputacionPanel.tsx` mismo: una tarjeta fija arriba de la lista de facciones (antes del
`entries.map` de la línea 50) con el conflicto activo y su etapa — *"⚔️ Conflicto Serhu-Concordia
vs Helsig/Goshg — Etapa 2/4"*. Para el patrón visual, la app ya tiene una barra de progreso por
etapas con el mismo espíritu (nivel de profesión, `HabilidadesPanel.tsx:249-264`: barra +
`current/span` + label) — reutilizar ese lenguaje (5 segmentos en vez de un porcentaje continuo,
ya que `maxStage` es un entero pequeño) evita inventar un tercer patrón de "progreso" en la misma
app.

### 2.4 — `Save.clase`/`especializacion` — dónde iría el día que exista el flujo

**Severidad: baja** (ya documentado como pendiente de diseño previo en el propio schema). El sitio
natural, el día que exista un flujo de asignación, es junto a `characterArchetype`/`characterOrigin`
en `EstadisticasPanel.tsx:58-61` — ya es la línea que muestra "arquetipo · origen" con el mismo sabor
informativo; "clase · especialización" encajaría en la misma fila o justo debajo, sin abrir una
sección nueva.

### 2.5 — Orden de iniciativa / ronda de combate múltiple — sin cambios, decisión de diseño ya confirmada

Sin hallazgo nuevo aquí — el roadmap ya registra que no mostrarlo aparte fue deliberado.

---

## 3. Animación / feedback visual

La app ya tiene un vocabulario de animación real y bien pensado (no parte de cero): `animate-pop-once`
en el chip de Nivel y el contador de Muertes del header (`GameView.tsx:1271/1288`, con comentario
explícito *"Pop... solo en una subida real, nunca al cargar la partida"*), el flash rojo/verde +
shake de `HealthBar.tsx:19-44` al recibir daño o curarse, el "campanada silenciosa" del hairline en
`LogPanel.tsx:148-154` cuando termina de pensar el Narrador. El problema no es falta de sistema —
es que ese sistema se aplicó a un puñado de valores y se paró ahí, dejando el resto de números que
cambian solos (sin acción directa del jugador) completamente mudos.

### 3.1 — Reputación de facción cambia en silencio — es el caso más parecido a HealthBar sin tener su tratamiento

**Severidad: media.** `ReputacionPanel.tsx:64-69` redimensiona la barra con
`transition-[width] duration-500` cuando `value` cambia — ninguna otra señal. Comparado con
`HealthBar.tsx`, que ante un cambio de `condicionFisica` dispara flash rojo/verde + shake + hace
`key={condicionFisica}` para remontar el one-shot: una bajada de reputación (p. ej. -50 por matar a
un miembro de una facción) es mecánicamente el mismo tipo de evento que "recibir daño" — un
resultado no elegido directamente por el jugador que cambia su relación con el mundo — pero hoy no
tiene ningún eco visual. Como el panel de Reputación además no está abierto la mayoría del tiempo
(vive detrás de Personaje > Reputación), un cambio real puede pasar completamente desapercibido
hasta que el jugador entra a mirar por curiosidad.

**Recomendación**: aplicar el mismo patrón `flash worse/better` de `HealthBar.tsx` a
`ReputacionPanel.tsx`, comparando el valor anterior por facción (mismo `useRef` + `useEffect` que ya
usa `HealthBar`). Si se resuelve el hallazgo 2.1 antes, hasta se podría usar la misma tarjeta de
"pop" que ya existe para Nivel/Muertes en el header, aplicada a un badge compacto de reputación.

### 3.2 — Hambre/Sed: el aviso de texto aparece de golpe, sin ninguna transición de entrada

**Severidad: baja-media.** `EstadisticasPanel.tsx:108-114` — el párrafo de aviso rojo
(`hambre < 25 || sed < 25`) se monta/desmonta en el DOM sin ninguna clase de animación, a diferencia
de otros textos transitorios de la app que sí usan `animate-entry-in`/`animate-entry-in-slow` (p.
ej. el bloque de fin de partida, `GameView.tsx:1476`). Es un caso particular: el propio comentario
de `hambre`/`sed` en `GameView.tsx:274-279` explica que estos valores *"avanzan solas en el
worldTick de fondo, no con cada acción"* — es decir, cruzar el umbral de 25% puede pasar mientras el
jugador está en OTRA pestaña haciendo cualquier otra cosa, sin ninguna acción propia que lo dispare.
Es el ejemplo más puro de "estado que cambia sin que nada en pantalla lo anuncie": no hay narración,
no hay entrada de log, no hay flash — solo un texto que, la próxima vez que alguien abra
Estadísticas, ya estaba ahí.

**Recomendación**: como mínimo, una entrada animada del aviso (`animate-entry-in`, ya existe en la
app). Más a fondo: considerar que el cruce del umbral se anuncie por el único canal que sí se lee de
forma pasiva — una entrada de log determinista en "El mundo" (mismo patrón ya usado para curaciones/
recolección deterministas, "sin depender de la AI") la primera vez que hambre o sed cruzan bajo 25,
en vez de depender de que el jugador entre a mirar la barra por su cuenta.

### 3.3 — Barras de progreso "silenciosas": profesión, economía de Reino, XP secundaria

**Severidad: baja.** Mismo patrón que 3.1/3.2 mirado más ampliamente: `HabilidadesPanel.tsx:259-264`
(barra de nivel de profesión), `ReinoPanel.tsx:113-124` (grid de estadísticas de economía —
población/felicidad/comida/etc., números crudos sin ninguna marca de "acaba de cambiar") y la propia
barra de XP de `EstadisticasPanel.tsx:72-77` cambian de valor con una transición de ancho suave, pero
ninguna anuncia el cambio como un evento — todas se limitan a `transition-[width] duration-500`, el
tratamiento "pasivo" que la propia app ya reserva para cambios rutinarios (ver el comentario de
`EnergyBar.tsx:1-3`: *"a diferencia de HealthBar, cambia casi cada turno... sin el flash/shake"*,
una decisión consciente y correcta para energía). El problema no es que falte flash en TODAS —sería
ruido si cada barra parpadeara todo el rato—, es que hoy solo dos valores en toda la app (Nivel,
Muertes) tienen el tratamiento "evento" y todo lo demás, incluidos números que sí deberían sentirse
como eventos poco frecuentes (subir de nivel de profesión, un Territorio que cambia de `control`),
usa el tratamiento "rutinario".

**Recomendación**: no aplicar el pop a todo, pero sí extenderlo selectivamente a los cambios que ya
son raros/significativos por diseño — un nivel de profesión que sube (ocurre pocas veces por
partida, ya se anuncia con log real) es la misma categoría de evento que subir de nivel de personaje,
que sí tiene su chip animado en el header.

### 3.4 — Compañero integrado en el Reino: sin ninguna señal de que su plantilla de equipo se aplicó de verdad

**Severidad: baja.** `ReinoPanel.tsx:405-422` — al cambiar la plantilla de un compañero/súbdito
(`PlantillaSelect` → `onChange` → `await asignarPlantillaCompanion(...)` → `onRefreshSave()`), el
`<select>` simplemente vuelve a renderizar con el nuevo valor seleccionado — no hay ninguna
confirmación visual de que el auto-equipo (que sí es una mutación real vía Almacén, según el propio
comentario del panel: *"depositar... dispara el auto-equipo del backend"*) se aplicó. Comparado con
`PaperdollSlot` (`EquipoPanel.tsx:76-111`), que sí tiene un flash + pop cuando el jugador cambia SU
PROPIO equipo, el equipo de un compañero/súbdito cambia en silencio absoluto.

**Recomendación**: menor, pero coherente con el resto de esta sección — un breve flash de
confirmación en la fila tras `onRefreshSave()` resuelto.

---

## 4. Otros hallazgos de diseño sueltos

### 4.1 — El pill de fecha en el header es el único dato de "mundo ambiental" siempre visible, y hoy solo dice el día

**Severidad: baja** (ligado a 2.2, pero es un hallazgo de posicionamiento aparte). `GameView.tsx:1300-1302`
renderiza `{fictionalDate}` como único elemento fijo del header con información del mundo (junto a
Nivel/Vida/Energía/Muertes, todos sobre el PERSONAJE). Es el espacio de mayor visibilidad de toda la
pantalla — sobrevive a cualquier pestaña abierta, a combate, a todo — y hoy transmite solo "Día 4,
tarde". Es candidato natural para absorber estación/clima (hallazgo 2.2) sin que la jugadora tenga
que ir a buscarlos a ningún panel: mismo dato, más contexto, cero clics adicionales.

### 4.2 — El combate ya es el panel mejor diseñado de la app — vale la pena tomarlo como referencia, no solo auditarlo

**No es un hallazgo, es una nota de calibración.** `CombatExchangeBadge.tsx` y `CombatPanel.tsx`
tienen un nivel de cuidado (tooltips que explican cada número, colores consistentes con
`attributeColorClasses` reutilizados en toda la cadena, distinción básica/racial/de clase, feedback
de "acaba de cambiar" en fichas de habilidad seleccionadas) que ningún otro panel de la app iguala
todavía. Varios de los huecos de esta auditoría (3.1, 3.3, 1.2) son, en el fondo, "el resto de la
app no ha llegado todavía al nivel de pulido que ya tiene Combate" — no hace falta inventar un
lenguaje visual nuevo para cerrarlos, solo extender el que ya existe y ya funciona.

### 4.3 — `DiarioPanel` es el único lugar con la vista completa del historial, pero no hay forma de llegar a él desde una mención en el log en vivo

**Severidad: baja.** `LogPanel.tsx` (log de personaje/mundo) muestra solo las últimas 24h de juego
por diseño (comentario línea 27-30: *"el log de personaje solo muestre 24h... si quieres verlo todo
vendrá clasificado por días en el diario"*), decisión correcta para no saturar el log en vivo. Pero
no hay ningún atajo desde el log en vivo hacia el Diario — el jugador tiene que saber por su cuenta
que existe esa pestaña aparte. Un enlace discreto tipo "Ver historial completo →" al principio del
log (cuando `entries.length` sugiere que hay más allá de las 24h) cerraría ese salto sin cambiar la
decisión de diseño de fondo.

---

## Resumen de severidad

| Hallazgo | Severidad | Sección |
|---|---|---|
| `activeEffects` sin indicador en combate | Alta | 2.1 |
| Estación/clima sin ningún indicador, ni narrativo ni de panel | Alta | 2.2 |
| Reputación y Facciones desconectadas entre paneles | Media-alta | 1.2 |
| Reputación cambia sin feedback visual (comparado con HealthBar) | Media | 3.1 |
| "Zona" es pestaña de nivel superior casi siempre vacía | Media | 1.1 |
| `WorldState.agenda` sin tracker junto a Reputación | Media | 2.3 |
| Compañero de Reino: ficha partida entre dos paneles | Baja-media | 1.3 |
| Hambre/Sed sin transición de entrada ni aviso proactivo | Baja-media | 3.2 |
| Barras "silenciosas" (profesión, economía, XP) sin tratamiento de evento | Baja | 3.3 |
| Hambre/Sed: dos componentes visuales para el mismo concepto | Baja | 1.4 |
| `Save.clase`/especialización sin sitio reservado (bloqueado por flujo previo) | Baja | 2.4 |
| Plantilla de compañero sin confirmación visual al cambiar | Baja | 3.4 |
| Pill de fecha del header sin estación/clima | Baja | 4.1 |
| Diario sin atajo desde el log en vivo | Baja | 4.3 |
