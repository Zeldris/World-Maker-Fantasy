# Niveles, XP y Reino (diseño, 2026-07-18)

**Estado:** diseño cerrado para revisión — nada de esto está implementado todavía.
**Origen:** reversión de la decisión de mecánicas 4 ([06-decisiones-mecanicas.md](06-decisiones-mecanicas.md)) por petición explícita de la usuaria: *"si que vamos a meter niveles y progreso por XP, vamos a intentar mantener los valores de DyD ya que tiene una base solida detrás para cualquier tipo de RPG"*. Además, la pestaña Reino del panel de personaje ([09-panel-personaje.md](09-panel-personaje.md) § 5) se construye ya, no se deja bloqueada — eso también se diseña aquí.

**Qué NO se toca:** la fórmula de tirada (`d20 + floor(atributo/2)`, decisión 1), los umbrales de dificultad (8/12/15/18/22), el alcance genérico (decisión 0 — nada de esto es exclusivo de combate), el inventario sin bonificadores (decisión 5) y el riesgo de `arcano` (decisión 6).

---

## 1. Filosofía: la armazón de D&D, el cuerpo de Tarkor

De D&D 5e se toma lo que está probado y es agnóstico al tipo de juego:

1. **La tabla de XP por nivel, con sus valores exactos** (§ 2) — es la parte que la usuaria pidió mantener, y su forma (subidas rápidas al principio, cada vez más caras) funciona igual de bien midiendo sesiones narrativas que combates.
2. **La filosofía de recompensa**: cuanto más difícil el desafío, más XP — pero en Tarkor "desafío" es cualquier tirada, no un monstruo. Convencer a un noble hostil (Muy difícil, 22) vale lo mismo que vencer a un rival igual de improbable.
3. **El ritmo de mejora de personaje**: D&D reparte ~+4 de bonificador de competencia y ~+10 puntos de característica a lo largo de 20 niveles. Tarkor concentra todo ese crecimiento en una sola vía —puntos de atributo— para no tocar la fórmula de tirada (§ 4).

Lo que NO se copia de D&D: clases (Tarkor no tiene), XP por matar (el 90% de las fuentes de XP de 5e), puntos de golpe por nivel (la condición física escalonada ya cerrada no es un contador), y bonificador de competencia como número aparte (§ 4.1 explica por qué).

---

## 2. Tabla de XP por nivel

**Valores exactos de D&D 5e, sin reescalar.** No hace falta dividir la tabla entre 10 para "ir más lento": lo que se calibra a la velocidad de Tarkor son las **recompensas** (§ 3), no los umbrales. Así, si algún día se quiere comparar con material de D&D o ajustar el ritmo, solo hay que tocar la tabla de recompensas — la de niveles queda fija para siempre.

| Nivel | XP total | Nivel | XP total | Nivel | XP total | Nivel | XP total |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 6 | 14.000 | 11 | 85.000 | 16 | 195.000 |
| 2 | 300 | 7 | 23.000 | 12 | 100.000 | 17 | 225.000 |
| 3 | 900 | 8 | 34.000 | 13 | 120.000 | 18 | 265.000 |
| 4 | 2.700 | 9 | 48.000 | 14 | 140.000 | 19 | 305.000 |
| 5 | 6.500 | 10 | 64.000 | 15 | 165.000 | 20 | 355.000 |

- **Nivel máximo: 20.** El XP acumulado por encima de 355.000 se guarda pero no da nada (por ahora).
- El XP **nunca baja** — no hay pérdida de XP por morir, fallar o perder territorio. Las consecuencias negativas ya las cubre la ficción (condición física, hechos del mundo, reputación).
- El nivel es **derivable del XP** (`nivel = mayor nivel cuya XP total ≤ xp`), pero se persiste igualmente (§ 6) para no recalcular en cada lectura y para poder mostrar "¡Gorhorn sube a nivel 3!" exactamente una vez.

---

## 3. Fuentes de XP — genéricas por diseño

Dos canales, los dos calculados por el **backend con tablas fijas** — el modelo nunca decide cuánta XP se gana, igual que nunca decide si una tirada tiene éxito (misma filosofía que la decisión de arquitectura "el backend tira el dado").

### 3.1 Canal automático: éxitos en tiradas

Cada vez que una acción con `requiereTirada = true` tiene **éxito**, el backend suma XP según la dificultad que fijó la clasificación. Da exactamente igual si la acción era luchar, negociar, construir o gobernar — la dificultad ya es la medida universal del desafío:

| Dificultad | Umbral | XP por éxito |
|---|---|---|
| Trivial | 8 | 0 |
| Fácil | 12 | 5 |
| Media | 15 | 25 |
| Difícil | 18 | 50 |
| Muy difícil | 22 | 100 |

- **Fallo = 0 XP** (v1). Simple y sin ambigüedad. Si jugando se ve que castiga demasiado el riesgo, la mejora natural es "25% de la XP al fallar Difícil o Muy difícil" — se anota como posible ajuste, no se implementa ahora.
- **Grados de éxito de acciones por tiempo** ([08-acciones-por-tiempo.md](08-acciones-por-tiempo.md) § 5): "éxito con coste" es éxito — XP completa. El coste ya lo paga la narración.
- **Anti-granjeo:** Trivial da 0 y Fácil solo 5 a propósito. Con turnos de 1-4 minutos reales en este hardware, granjear 300 XP a base de acciones Fáciles serían ~60 turnos de espera real — el coste en tiempo real ES el mecanismo anti-granjeo, no hace falta contador de repeticiones ni lógica de "acciones ya vistas". Además, la clasificación es contextual: repetir algo que ya no tiene tensión narrativa tenderá a clasificarse como Trivial o como `requiereTirada = false`.

### 3.2 Canal de hitos: lo que la tirada no captura

Gobernar bien, completar una misión o descubrir una ruina no siempre pasa por una tirada difícil. Para eso, la llamada de **narración** (la segunda llamada del turno, decisión 2) devuelve un campo opcional nuevo en su JSON:

```
"hitos": [ { "tipo": "descubrimiento" | "objetivo_menor" | "objetivo_mayor" | "capitulo" } ]
```

El modelo solo propone el **tipo** de hito; el backend lo traduce a número con esta tabla fija y lo registra:

| Tipo de hito | XP | Ejemplos (cualquier estilo de juego) |
|---|---|---|
| `descubrimiento` | 50 | Primera vez en una región nueva; primer contacto con un clan; encontrar el rastro de un Maktor superviviente |
| `objetivo_menor` | 100 | Cerrar un trato comercial importante; ganar el primer súbdito con nombre; ayudar al Kort'ikar en apuros |
| `objetivo_mayor` | 300 | Completar una misión de largo recorrido; reclamar un territorio; que un clan reconozca el nombre de los Maktor |
| `capitulo` | 500 | Cierre de capítulo — se dispara automáticamente al crear un `SessionSummary`, no lo propone el modelo |

- **Tope: 1 hito por turno** (si el modelo devuelve varios, el backend se queda con el de mayor valor). Evita que un turno efusivo del Narrador reparta 500 XP de golpe.
- `capitulo` es el único hito **determinista**: lo emite el backend al crear un `SessionSummary`, sin pasar por el modelo. Así el sistema de memoria por capítulos que ya existe se convierte gratis en el latido de progresión de fondo.
- Los eventos de Reino (§ 5.4) también entran por tablas deterministas del backend, no por el modelo.

### 3.3 Calibración con el personaje real

Sesión de test típica de Gorhorn (~15 turnos): pongamos 8 tiradas con éxito (3 Fáciles = 15, 3 Medias = 75, 2 Difíciles = 100) + 1 `objetivo_menor` (100) ≈ **290 XP → nivel 2 en una sesión**. Nivel 3 en ~2 sesiones más, nivel 4 en ~5-6, nivel 5 en ~10. Es exactamente la curva de 5e traducida de "combates" a "sesiones narrativas": arranque rápido para enganchar, y luego cada nivel es un pequeño arco de historia. Si al jugar resulta lento o rápido, el mando de ajuste es la tabla del § 3.1 (una constante), nunca la tabla de niveles.

---

## 4. Qué otorga subir de nivel

### 4.1 NO hay bonificador de competencia — y es una decisión, no un olvido

Añadir un bono por nivel encima de `floor(atributo/2)` rompería dos cosas cerradas a la vez: la fórmula de la decisión 1 (que pasaría a ser `d20 + atributo/2 + competencia`) y la escalera fija de dificultades. Con atributo 18 (+9) más una competencia tipo D&D (+6), un personaje de nivel alto acertaría "Muy difícil 22" con 7+ en el d20 — el mundo dejaría de tener desafíos, y en Tarkor las dificultades no suben con el nivel del jugador (no hay "monstruos de nivel 15" que compensen).

En su lugar, **todo el crecimiento numérico va por puntos de atributo** (§ 4.2). El tope de +9 (atributo 18) es el techo del mundo para siempre: incluso un nivel 20 con atributo a tope necesita 13+ en el d20 para lo Muy difícil. El mundo sigue siendo peligroso a cualquier nivel — coherente con la letalidad como rasgo de mundo, no de nivel.

### 4.2 Puntos de atributo — en los niveles ASI exactos de D&D

| Nivel alcanzado | Otorga |
|---|---|
| 4, 8, 12, 16, 19 | **+2 puntos de atributo** a repartir libremente (los dos al mismo atributo o separados) |

- **Tope duro de 18 por atributo** — el rango 4-18 del mundo no se rompe nunca. Gorhorn (fuerza 18 ya) tendrá que invertir en otra cosa: exactamente la clase de decisión interesante que queremos (¿voluntad para el mando? ¿carisma para restaurar el nombre Maktor?).
- Total en 20 niveles: **+10 puntos** sobre el presupuesto de creación de 60 (+16%, de media +1,6 por atributo — crecimiento visible pero no inflacionario, equivalente al +4 de competencia de D&D si se concentran).
- Los puntos **se pueden dejar sin gastar** (campo `pendingAttributePoints`, § 6): al subir a un nivel ASI el backend los acumula y el frontend ofrece repartirlos cuando el jugador quiera, sin bloquear el turno.
- Son los mismos niveles (4/8/12/16/19) que los ASI de 5e — otra pieza literal de la armazón que la usuaria pidió conservar.

### 4.3 Huecos de Habilidades — resuelve el conflicto de 09 § 3

La pestaña Habilidades (acciones rápidas guardadas, `SavedAction`) toma su cupo directamente del nivel:

```
huecosHabilidad(nivel) = 3 + floor(nivel / 2)
```

| Nivel | 1 | 2 | 4 | 6 | 10 | 14 | 20 |
|---|---|---|---|---|---|---|---|
| Huecos | 3 | 4 | 5 | 6 | 8 | 10 | 13 |

- 3 huecos desde nivel 1: la pestaña nunca nace inútil. +1 hueco en cada nivel par: subir de nivel casi siempre da *algo* tangible aunque no toque ASI.
- La curva (3→13) sigue la forma de los "conjuros conocidos" de las clases espontáneas de 5e: crece de por vida pero obliga a elegir.
- Esto **cierra el conflicto** documentado en [09-panel-personaje.md](09-panel-personaje.md) § 3 por la vía (B): la usuaria reabrió la decisión de niveles, así que el desbloqueo por hitos narrativos (vía A) queda descartado.

### 4.4 Lo que subir de nivel NO hace

- **No cura ni interactúa con la condición física** (`ileso→herido→grave→convaleciente→muerto`). No hay puntos de golpe: la escalera es narrativa y se recupera descansando (acciones por tiempo, banda extendida/larga), igual a nivel 1 que a nivel 20. Un nivel 20 `grave` está tan mal como un nivel 1 `grave`.
- **No atenúa el riesgo de `arcano`** (decisión 6): el coste narrativo de la magia salvaje es un rasgo del contrato de mundo de Helek Sirik, no una impericia que se entrene. Subir `arcano` con puntos ASI mejora la tirada como con cualquier atributo, pero el Narrador sigue pudiendo cobrar su precio incluso en éxito.
- **No desbloquea acciones**: en Tarkor se puede intentar cualquier cosa a cualquier nivel (decisión 0). El nivel mejora las probabilidades y el cupo de habilidades, nunca es una puerta.

---

## 5. Modelo de datos de Reino

**Para las reglas de construcción/Reino VIGENTES (edificios, materiales procesados, oficios
regionales, fundación), la fuente de verdad viva es
[17-reglas-construcciones-reino.md](17-reglas-construcciones-reino.md) — reescrito 2026-08-31 para
dejar de mezclar diseño histórico con notas de corrección.** Este § 5 se conserva por dos motivos
reales, no solo histórico: (a) los tres modelos `Territory`/`Building`/`Subject` de § 5.2 SÍ se
migraron tal cual y siguen siendo la base de datos real hoy, y (b) § 5.4 (Reino como fuente de XP)
sigue vigente, es el único sitio donde vive esa tabla. **Lo único que NO es cierto hoy** es la
afirmación central de § 5.1 ("sin capa de números de gestión") — desde 2026-07-23 existe
`KingdomStats` (población/felicidad/comida/bebida/riqueza/soldados/trabajadores/visitantes,
`schema.prisma`) con un tick diario real (`backend/src/services/kingdomTick.ts`), exactamente la
capa de gestión que aquí se descartaba en el diseño original de 2026-07-19.

### 5.1 Principio: tres piezas, y el vacío es un estado válido

La pestaña Reino muestra tres cosas ([09-panel-personaje.md](09-panel-personaje.md) § 2): súbditos, edificios y zonas conquistadas. Tres modelos nuevos, hermanos de `InventoryItem`/`Companion` en filosofía: **estado narrativo persistido, sin capa de números de gestión** (nada de comida/oro/moral por turno — eso sería un juego de estrategia dentro del RPG, y no está pedido). Si algún día se quiere simulación económica, estos modelos son la base, no un impedimento. *(Diseño original — ver nota de arriba: la capa de números de gestión SÍ llegó después, vía `KingdomStats`.)*

**El estado vacío es el punto de partida correcto, no un bug.** Gorhorn hoy: cero territorios, cero edificios, cero súbditos — único superviviente de su clan. El frontend no debe tratar "0 filas" como error ni como pestaña bloqueada: renderiza un estado vacío narrativo construido con lo que ya existe (`characterMotivation`), p. ej.: *"Gorhorn no gobierna a nadie todavía. El nombre de los Maktor aún espera ser restaurado."* La pestaña cuenta desde el primer día la historia de lo que falta — que es justo la historia de Gorhorn.

### 5.2 Los tres modelos (Prisma, para revisión — no migrar todavía)

```prisma
enum TerritoryControl {
  RECLAMADO    // el personaje lo reivindica y nadie se lo disputa activamente
  DISPUTADO    // otro poder lo reclama también
  CONSOLIDADO  // control asentado y reconocido
  PERDIDO      // se tuvo y se perdió — se conserva la fila: es historia del reino
}

/// Zona/territorio bajo control (o reclamación) del personaje.
model Territory {
  id          String           @id @default(cuid())
  saveId      String
  save        Save             @relation(fields: [saveId], references: [id], onDelete: Cascade)
  name        String           // "Vado de la Arena Roja"
  /// Nombre de región del lore (docs/rpgtarkor/lore-mundo/areas.md) — string libre, no FK: el lore vive en .md
  region      String?
  description String
  control     TerritoryControl @default(RECLAMADO)
  /// Población anónima estimada — los súbditos SIN nombre son un número, no filas (ver § 5.3)
  population  Int              @default(0)
  acquiredAt  DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  buildings Building[]
  subjects  Subject[]

  @@index([saveId])
}

enum BuildingStatus {
  EN_CONSTRUCCION
  ACTIVO
  DANADO
  ABANDONADO
}

/// Edificio/estructura construida o tomada por el personaje.
model Building {
  id          String         @id @default(cuid())
  saveId      String
  save        Save           @relation(fields: [saveId], references: [id], onDelete: Cascade)
  /// Opcional: un refugio levantado en mitad del viaje no pertenece a ningún territorio
  territoryId String?
  territory   Territory?     @relation(fields: [territoryId], references: [id], onDelete: SetNull)
  name        String         // "Refugio del tótem"
  /// Tipo libre ("refugio", "granja", "taller", "muralla", "monumento"...) — no enum cerrado:
  /// misma razón que Companion.role, no sabemos aún qué construirán los jugadores
  kind        String
  status      BuildingStatus @default(EN_CONSTRUCCION)
  description String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([saveId])
}

/// Súbdito CON NOMBRE — alguien que sigue/sirve al personaje ligado a su reino,
/// no a su persona (eso es Companion, ver § 5.3).
model Subject {
  id          String     @id @default(cuid())
  saveId      String
  save        Save       @relation(fields: [saveId], references: [id], onDelete: Cascade)
  territoryId String?
  territory   Territory? @relation(fields: [territoryId], references: [id], onDelete: SetNull)
  name        String
  /// "capataz", "guerrera", "consejera", "granjero"... — libre
  role        String
  notes       String
  createdAt   DateTime   @default(now())

  @@index([saveId])
}
```

En `Save` se añaden las relaciones inversas (`territories Territory[]`, `buildings Building[]`, `subjects Subject[]`) y un campo opcional:

```prisma
  /// Nombre del reino/dominio si el jugador lo bautiza ("Clan Maktor Restaurado") — null = aún sin reino
  kingdomName String?
```

`kingdomName = null` + cero filas = el estado inicial de Gorhorn, representado sin ningún campo booleano artificial.

### 5.3 Fronteras con lo que ya existe (para no duplicar conceptos)

| Concepto | Dónde vive | Regla de frontera |
|---|---|---|
| Compañero de viaje, aliado personal | `Companion` (ya existe) | Vinculado a la **persona**: viaja con el personaje. Hagar, si se reencontraran, sería Companion. |
| Súbdito con nombre | `Subject` (nuevo) | Vinculado al **reino/territorio**: sirve al dominio, no acompaña al aventurero. Un Companion puede "asentarse" y convertirse en Subject (se crea Subject y se borra Companion — operación de app, no automática). |
| Población anónima | `Territory.population` (nuevo) | Las masas son un número, nunca filas — 200 granjeros no son 200 registros. Solo quien tiene nombre en la historia merece fila. |
| Posesiones personales | `InventoryItem` (ya existe) | Lo que se lleva encima. Un edificio nunca es un item. |
| Hechos difusos de gobierno ("los Serhu respetan a Gorhorn") | `WorldState.facts` (ya existe) | Reputación y relaciones siguen siendo hechos libres (decisión 3) — Reino solo estructura lo enumerable: gente, piedra y tierra. |

### 5.4 Reino como fuente de XP (cierre del lazo con la parte 1)

Cuando el backend **crea o promociona** filas de Reino, otorga XP con esta tabla determinista (sin pasar por el modelo — son el equivalente estructural de los hitos del § 3.2):

| Evento de Reino | XP | Equivale a |
|---|---|---|
| Primer `Subject` de la partida | 100 | `objetivo_menor` — "ya no está solo" |
| Cada `Subject` posterior | 25 | — |
| `Building` pasa a `ACTIVO` | 100 | `objetivo_menor` |
| `Territory` creado (`RECLAMADO`) | 150 | — |
| `Territory` pasa a `CONSOLIDADO` | 300 | `objetivo_mayor` |
| `Territory` → `PERDIDO`, `Building` → `DANADO`/`ABANDONADO`, bajas de población | 0 | el XP nunca baja (§ 2) — la pérdida ya duele en la ficción |

Estos eventos **sustituyen** al hito genérico ese turno (siguen bajo el tope de 1 hito/turno del § 3.2, aplicando el mayor): ganar tu primer súbdito no paga dos veces.

**¿Quién crea las filas?** La llamada de narración devuelve, junto a `new_facts` y `hitos`, campos opcionales que el backend **valida contra el estado actual** y materializa. *(Diseño original: un único `reino_events`. En la implementación real son tres campos separados —
`newTerritory`/`newBuilding`/`newSubject`, ver `narrador.ts` — mismo espíritu, forma final
distinta.)* Es el mismo patrón de la decisión 2 (el modelo propone estructura, el backend
ejecuta) — validado con fiabilidad razonable jugando en vivo (reino "Maktor" fundado 2026-08-07),
sin necesitar el plan B de creación manual.

---

## 6. Campos de datos — resumen completo

**En `Save` (migración 1 — niveles):**

| Campo | Tipo | Default | Para qué |
|---|---|---|---|
| `level` | `Int` | `1` | Nivel actual (1–20) |
| `xp` | `Int` | `0` | XP total acumulada, nunca decrece |
| `pendingAttributePoints` | `Int` | `0` | Puntos ASI sin repartir (§ 4.2) |

**En `LogEntry` (migración 1):**

| Campo | Tipo | Default | Para qué |
|---|---|---|---|
| `xpDelta` | `Int?` | `null` | XP ganada en esa entrada — el Diario muestra "+50 XP" y el nivel es auditable sumando el log |

**En `Save` (migración 2 — Reino):** `kingdomName String?` + relaciones `territories`/`buildings`/`subjects`.

**Modelos nuevos (migración 2):** `Territory`, `Building`, `Subject` + enums `TerritoryControl`, `BuildingStatus` (§ 5.2).

**Sin entidad `CharacterProgress` aparte:** una partida = un personaje, así que nivel/XP viven en `Save` igual que `attributes`. Si algún día hay multi-personaje por partida, se extrae junto con todo lo demás.

---

## 7. Flujo de turno con XP (delta sobre [05-mecanicas-juego.md](05-mecanicas-juego.md) § 7)

```
3.  Si requiereTirada: backend tira el dado (sin cambios).
3b. Si éxito: xpTirada = tabla § 3.1 según dificultad.
4.  Llamada de narración → { narration, new_facts[], clock_advance_minutes,
                             condicionFisica?, hitos?, reino_events? }
4b. Backend: valida reino_events → filas de Reino → xpReino (tabla § 5.4).
    xpHito = max(hitos ∪ eventos de reino), tope 1 por turno (§ 3.2).
    xpTurno = xpTirada + xpHito.
5.  Guarda LogEntry (con xpDelta = xpTurno si > 0) + Save.xp += xpTurno.
5b. Si Save.xp cruza umbral de la tabla § 2: Save.level = nuevo nivel,
    pendingAttributePoints += 2 si el nivel es 4/8/12/16/19,
    LogEntry extra de subida de nivel (canal CHARACTER).
```

Coste añadido: **cero llamadas nuevas a Ollama** — `hitos` y `reino_events` viajan en el JSON de la narración que ya se paga, y todo lo demás son tablas en memoria. Misma disciplina que las acciones por tiempo (doc 08).

---

## 8. Conflictos y decisiones que quedan para la usuaria

1. **Ninguno bloqueante.** El conflicto de 09 § 3 (Habilidades ↔ nivel) queda resuelto por la propia reversión de la decisión 4 (vía B) — este documento solo le pone números (§ 4.3).
2. **A validar jugando, no ahora:** (a) la tabla de XP por éxito del § 3.1 (el único mando de ritmo); (b) si el fallo en tiradas Difícil/Muy difícil debería dar algo de XP; (c) la fiabilidad de `reino_events` en Qwen2.5:7b (con plan B ya previsto, § 5.4).
3. **Sugerencia menor, decidir cuando toque UI:** si `kingdomName` lo bautiza el jugador libremente o lo propone el Narrador al primer territorio. Sin impacto en el modelo de datos.

---

## 9. Pendientes de implementación (actualizado 2026-08-02)

1. ~~Migración 1 (niveles)~~ — hecho.
2. ~~Servicio de progresión~~ — hecho, `backend/src/services/progression.ts`, con tests unitarios.
3. ~~Enganchar al flujo de turno~~ — hecho.
4. ~~Migración 2 (Reino)~~ — hecho a nivel de schema (`Territory`/`Building`/`Subject`).
5. ~~XP por eventos de Reino~~ — hecho a nivel de código.
6. ~~Frontend — progresión~~ — hecho.
7. ~~Frontend — pestaña Reino~~ — hecho a nivel de componente.
8. ~~Validar `reino_events` con el modelo sobre casos reales~~ — **hecho, y Reino ya no está
   pausado** (actualización 2026-08-13): la pausa citada aquí (`docs/archivo/11-roadmap-historico.md`, 2026-07-19) se
   revirtió — reino fundado y jugado en vivo (2026-08-07), reglas de construcción cerradas
   (`docs/mecanicas/17-reglas-construcciones-reino.md`, 2026-08-04) y habilidades/recetas de construcción con
   deshabilitado en tiempo real (2026-08-13). **Reconciliación de § 5 con `docs/17` —
   cerrada 2026-08-31**: § 5 reescrito para señalar explícitamente qué sigue vigente (modelos
   `Territory`/`Building`/`Subject`, tabla de XP de § 5.4) frente a lo que ya no lo es (§ 5.1 "sin
   capa de números de gestión", superado por `KingdomStats`/`kingdomTick.ts` desde 2026-07-23), con
   puntero directo a `docs/17` como fuente de verdad viva de las reglas de construcción.
9. Actualizar los documentos afectados — parcialmente hecho por esta misma pasada (2026-08-02);
   pendiente real: reconciliar § 5 de este documento con `docs/17` (punto 8 de arriba).
