# Decisiones de mecánicas de juego — Tarkor

Documento vivo, igual que [02-decisiones.md](../producto/02-decisiones.md) y [04-decisiones-tecnicas.md](../arquitectura/04-decisiones-tecnicas.md) pero para el sistema de juego interno. Referencia: [05-mecanicas-juego.md](05-mecanicas-juego.md).

**Nota (2026-08-13, auditoría de documentación):** mismo aviso que en 05 — este documento fija
decisiones de ARRANQUE (2026-07-16) y varias siguen vigentes tal cual, pero sistemas grandes
llegados después tienen su propio documento como fuente de verdad:
[14-combate-y-muerte.md](14-combate-y-muerte.md) (combate por turnos, energía/fatiga, árbol de
ventajas por atributo), [10-niveles-xp-reino.md](10-niveles-xp-reino.md) (niveles/XP/Reino),
[08-acciones-por-tiempo.md](08-acciones-por-tiempo.md) (acciones por tiempo),
[18-validacion-accion-jugador.md](18-validacion-accion-jugador.md) (validador de grounding).

---

## Decididas

### 0. Corrección de alcance: motor de acciones genérico, no RPG de combate — **2026-07-16**

**Decisión:** Tarkor resuelve cualquier tipo de acción (observar, recolectar, construir, comerciar, gobernar, dar órdenes, negociar, explorar, luchar...) con el mismo mecanismo — no hay un subsistema especial para combate.

**Por qué:** al diseñar el modelo de salud, la usuaria corrigió que el diseño se estaba orientando implícitamente a un RPG de acción/combate. La idea de Tarkor es poder intentar prácticamente cualquier cosa dentro de las normas del mundo y de la partida.

**Impacto:** todas las decisiones de este documento (tiradas, estado del personaje, progresión, inventario) están pensadas para ser genéricas por tipo de acción, no específicas de combate.

**Corrección (2026-08-13):** el principio de motor genérico se mantiene, pero desde [14-combate-y-muerte.md](14-combate-y-muerte.md) (diseñado 2026-07-18, ya implementado) el combate vive en un **modo aparte por turnos** (popup dedicado, tarjetas de habilidad, coste de energía, ventajas por tipo de atributo) — no es "un tipo de acción más" resuelto exactamente igual que recolectar o construir. Ver ese documento para el diseño real de combate, no descrito aquí.

### 1. Fórmula de resolución de tiradas y umbrales de dificultad — **2026-07-16**

**Decisión:** `resultado = d20 + floor(atributo / 2)`, éxito si `resultado >= dificultad`. Umbrales: Trivial 8, Fácil 12, Media 15, Difícil 18, Muy difícil 22. Grados de éxito **binarios** (éxito/fallo, sin críticos por ahora).

**Corrección (2026-08-13):** la fórmula y los umbrales siguen igual, pero los grados de éxito ya no son binarios — `gradoExitoFor` (`backend/src/services/dice.ts`) distingue `claro` / `con_coste` / `fallo` sobre el mismo resultado, enganchado en la narración real (`turnResolution.ts`, `narrador.ts`). No es un sistema de críticos nuevo, es leer en tres tramos la misma tirada.

**Por qué:** fórmula ya prototipada en la demo de frontend (`lib/dice.ts`), se formaliza como la real. Binario en vez de con críticos para no complicar el prompting del Narrador desde el principio (2 casos a narrar, no 4) — se puede añadir después sin romper nada.

**Impacto:** el backend implementa esta fórmula como servicio de tiradas (pendiente de construir). El frontend ya la tiene prototipada, así que solo hay que portarla/confirmarla, no diseñarla desde cero.

### 2. Arquitectura de clasificación de acciones — **2026-07-16**

**Decisión:** **dos llamadas al modelo por turno** — primero una llamada de clasificación (`{ requiereTirada, atributo, dificultad, razon }`), el backend tira el dado, y luego una segunda llamada de narración con el resultado ya fijado.

**Por qué:** el jugador escribe acción libre, no elige de un menú — hace falta traducir texto libre a atributo/dificultad de forma sensible al contexto (que funcione igual para "construyo una cerca" que para "ataco al guardia"). Una heurística de palabras clave (como la demo del frontend) es frágil y no generaliza a acciones no físicas. Una única llamada con "plantilla condicionada" (el modelo escribe de antemano las dos narraciones posibles) ahorraría una llamada pero no está validada — se descarta por ahora, no probada.

**Impacto:** cada turno del jugador implica 2 generaciones de Ollama en vez de 1 — en el hardware de la usuaria (CPU, ver [03-arquitectura.md](../arquitectura/03-arquitectura.md) § 4) esto es más lento por turno. Aceptado porque el juego es por turnos y ya existe el sistema de ritmo (decisión técnica 5 en [04-decisiones-tecnicas.md](../arquitectura/04-decisiones-tecnicas.md)). A revisar cuando se haga el benchmark real pendiente — si resulta demasiado lento en la práctica, la Opción C (una sola llamada) queda como alternativa a probar.

### 3. Modelo de estado del personaje — **2026-07-16**

**Decisión:** modelo híbrido — **un campo estructurado ligero para la condición física** (`ileso` → `herido` → `grave` → `convaleciente` → `muerto`), y **todo lo demás (reputación, posesiones, a quién gobierna, qué ha construido, relaciones...) como hechos libres** en `WorldState.facts`, sin campos fijos.

**Por qué:** dado el alcance genérico (decisión 0), el estado del personaje es mucho más que salud. Un campo fijo solo para la condición física mantiene algo mostrable en la ficha de personaje del frontend (que ya tiene ese hueco en el diseño), mientras que todo lo demás necesita la flexibilidad de hechos libres porque puede ser literalmente cualquier cosa (gobernar una región, poseer una granja, tener mala reputación con una facción...) y no tiene sentido intentar tabular de antemano todos los campos posibles.

**Impacto:** el modelo `WorldState` ya tiene `facts: Json` para esto. Falta añadir el campo estructurado de condición física — pendiente al diseñar el modelo `Save`/`WorldState` con más detalle (hoy `Save` no tiene un campo de condición física explícito, hay que añadirlo).

### 4. Progresión del personaje — **2026-07-16, REVERTIDA 2026-07-18**

**Decisión original:** sin sistema de niveles/XP. Progresión puramente narrativa — lo que el personaje logra, posee, construye o gobierna es la progresión.

**Por qué (original):** coherente con el alcance genérico (decisión 0): "mejorar" puede significar cosas muy distintas según lo que el jugador haga (gobernar mejor, tener más reputación, poseer más tierras), y una barra de experiencia numérica no captura eso bien.

**Reversión (2026-07-18):** la usuaria pidió explícitamente introducir niveles y progreso por XP, usando como base los valores de D&D — "tiene una base solida detrás para cualquier tipo de RPG". Esto también resuelve el conflicto abierto en `docs/09-panel-personaje.md` § 3 (Habilidades dependía de "nivel del personaje", que no existía). Diseño concreto y ya implementado en [10-niveles-xp-reino.md](10-niveles-xp-reino.md): tabla de XP de D&D 5e sin reescalar, XP por éxito en tiradas + hitos narrativos (ambos con tablas fijas del backend, el modelo nunca decide cantidades), todo el crecimiento numérico por puntos de atributo en los niveles ASI (4/8/12/16/19, tope 18/atributo, sin bonificador de competencia aparte), y huecos de Habilidades = `3 + floor(nivel/2)`.

**Impacto:** migración aplicada (`Save.level/xp/pendingAttributePoints`, `LogEntry.xpDelta`), servicio `backend/src/services/progression.ts`, enganchado en `POST /turn`.

### 5. Inventario y equipo — **2026-07-16**

**Decisión:** contexto narrativo, **sin bonificadores mecánicos fijos tabulados**. Lo que el personaje posee vive como hechos libres; el Narrador lo tiene en cuenta al narrar y al fijar la dificultad de una tirada, pero no hay una tabla de "objeto X = +2 a tirada Y".

**Por qué:** más simple de implementar y coherente con no tener números fijos para casi nada salvo los atributos y la fórmula de tirada. Añadir bonificadores tabulados es una mejora natural para más adelante si hace falta, no bloqueante ahora.

**Impacto:** no hace falta una tabla de objetos/bonificadores en el modelo de datos por ahora. El inventario, si se representa, vive como hechos libres igual que el resto del estado no estructurado.

**Reversión (2026-08-13, decisión tomada 2026-07-19, ampliada 2026-08-03):** la usuaria pidió explícitamente reabrir esto — "mejora natural para más adelante si hace falta" dejó de ser hipotético. Hoy sí hay una tabla real: `ItemCatalog`/`InventoryItem.statBonuses` + `backend/src/services/equipment.ts`, que suma bonificadores reales a atributos/defensa/slots de inventario cuando el objeto está **equipado** (la mochila nunca bonifica). Los hechos libres narrativos ("tiene 200 monedas", "posee una granja") siguen existiendo para todo lo que no es equipo mecánico.

### 6. Magia (`arcano`) como riesgo narrativo, no como mecánica nueva — **2026-07-17**

**Decisión:** usar el atributo `arcano` siempre conlleva un pequeño riesgo, incluso en éxito — el Narrador puede añadir un coste o efecto secundario narrativo (algo se resiente, atrae atención, deja un rastro) aunque la tirada salga bien.

**Por qué:** viene del contrato del primer mundo ([07-mundo-helek-sirik.md](../rpgtarkor/lore-mundo/07-mundo-helek-sirik.md), § Contrato de mundo): en Helek Sirik la magia nace del origen salvaje e incontrolado de Tarkor, nunca fue diseñada ni domesticada del todo por nadie. Un `arcano` que se comporta igual que cualquier otro atributo perdería ese matiz de fondo.

**Impacto:** **no es una mecánica de dados nueva** — la fórmula de tirada (decisión 1) no cambia para `arcano`. El efecto se resuelve enteramente en la narración de la llamada de narración (paso 4 del flujo de turno, [05-mecanicas-juego.md](05-mecanicas-juego.md) § 7): cuando la clasificación identifica que la acción usa `arcano`, el prompt del Narrador debe saber que puede introducir una consecuencia narrativa aunque el resultado sea éxito. Esto es específico del contrato de Helek Sirik — si en el futuro se añaden otros mundos con una magia de naturaleza distinta (domesticada, académica...), este comportamiento no tiene por qué aplicarse igual; vive en el contrato de cada mundo, no en la mecánica global de `arcano`.

---

## Pendientes

*(Actualizado 2026-08-02 — todo lo de abajo salvo el punto 5 lleva meses hecho; se deja tachado por
historial. Desfase de documentación arrastrado desde la auditoría de `docs/archivo/11-roadmap-historico.md` 2026-07-18.)*

1. ~~Añadir el campo de condición física~~ — **hecho**, `Save.condicionFisica` (enum `ILESO→HERIDO→GRAVE→CONVALECIENTE→MUERTO`), junto con todo el sistema de combate/muerte/descanso de [14-combate-y-muerte.md](14-combate-y-muerte.md).
2. ~~Construir el servicio de tiradas~~ — hecho, `backend/src/services/dice.ts`.
3. ~~Construir la orquestación de turno~~ — hecho, `backend/src/routes/turn.ts` + `backend/src/services/turnResolution.ts` (clasificar → tirar → narrar, dividido en `/turn/classify` + `/turn/narrate` desde `docs/08-acciones-por-tiempo.md`).
4. ~~Diseñar los prompts del Narrador~~ — hecho, `backend/src/services/narrador.ts` + `backend/Modelfile`.
5. **Benchmark real** de latencia por turno con las dos llamadas al modelo (decisión 2), para confirmar que es jugable en este hardware — sigue sin medirse formalmente, perf, no bloqueante.
6. ~~Asignar atributos numéricos~~ — **hecho**, ver [rpgtarkor/personajes.md](../rpgtarkor/personajes/personajes.md).
7. ~~Sustituir el mundo y personajes placeholder~~ ("Valdreth" + Kaelen/Sylas/Ithraë/Mirren) — **hecho**, `frontend/src/data/mock.ts` usa Helek Sirik y sus personajes desde hace tiempo.
