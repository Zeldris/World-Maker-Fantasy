# Mundo estructurado: posición, NPCs, recursos y armería (diseño, 2026-07-18)

**Estado (actualizado 2026-07-18):** implementado y verificado extremo a extremo contra el backend real (migraciones, seed, servicios de viaje/NPC/despiece, prompts, worldTick, frontend). Ver § 7 para el detalle de qué está hecho y qué queda.
**Alcance:** SOLO el mundo de Gorhorn (Berig → Las Llanuras del Viento Rojo y su entorno inmediato). Los otros 7 personajes y Vaelira quedan fuera por decisión explícita de la usuaria — no aparecen en el juego todavía.
**Filosofía rectora** (palabras de la usuaria): *"la idea es completar mucha info e ir pudiéndole dar lo necesario a la IA para que piense lo mínimo posible y que solo deba conectar hechos, términos, etc."* Cada pieza de este documento existe para convertir una invención del modelo en una lectura de datos: el modelo pequeño ya ha demostrado que cuando tiene que inventar, alucina (el caso "oca" por "orco" quedó incrustado como hecho permanente). La regla de diseño de todo lo que sigue es: **el modelo conecta, el backend decide, las tablas saben.**

**Qué NO se toca:** la fórmula de tirada (`d20 + floor(atributo/2)`), los umbrales 8/12/15/18/22, el sistema de niveles/XP del jugador ([10-niveles-xp-reino.md](10-niveles-xp-reino.md)), la fórmula de viaje de `timedActions.ts` (se le da mejor entrada, no se sustituye), y el mecanismo `CharacterTransit`/`worldTick` (se reutiliza tal cual).

---

## 1. Sistema de posición: un grafo de ubicaciones, no un grid

### 1.1 Decisión y justificación

**Se elige grafo de ubicaciones** (nodos = lugares con nombre, aristas = rutas con tiempo base y terreno), **no grid x/y**. Razones:

1. **Todo lo ya construido habla en tiempo, no en distancia.** `timedActions.ts` calcula viajes con `minutos = base / (1 + destreza/20)`; `CharacterTransit` es "ocupado hasta X minutos"; las bandas de `narrador.ts` son temporales. Un grid daría distancias euclídeas que habría que reconvertir a tiempo de todas formas — el grafo da el tiempo directamente en la arista.
2. **El mapa del frontend ya es esquemático**, no cartográfico (`frontend/src/data/map.ts`: formas SVG aproximadas, sin coordenadas reales). Un grid obligaría a inventar coordenadas que no existen en ningún documento de lore y que nadie va a mantener.
3. **Es la estructura que menos hace pensar al modelo.** Con un grid, "viajo a Los Pilares Rotos" exige que alguien calcule ruta, obstáculos y distancia. Con un grafo, la pregunta se reduce a *elegir un elemento de una lista cerrada* — exactamente el tipo de tarea (clasificación con enum) en la que `llama3.2` ya funciona bien hoy. La ruta la calcula el backend con Dijkstra, determinista.
4. **El lore ya es un grafo implícito.** "El camino que viene de la Meseta se bifurca en el Cruce de las Cenizas", "el Pozo está sobre la corriente que siguen los Corredores" — los .md describen relaciones entre lugares, no posiciones absolutas.

Lo que se pierde con el grafo (posiciones libres "a mitad de camino", exploración de terreno no nombrado) lo cubre lo que ya existe: mientras se viaja el personaje está `CharacterTransit` (en ruta, no en un nodo), y el terreno sin nombre sigue siendo territorio del Narrador con los ganchos ambientales de siempre (tormenta, nido de Espinas).

### 1.2 Modelo de datos

Tres modelos nuevos + un campo en `Save`. `Location`/`LocationLink` son **catálogo de mundo** (hermanos de `LoreChunk`: se siembran desde un script y la fuente editorial sigue siendo `docs/rpgtarkor/areas.md`); `LocationVisit` es estado **por partida**.

```prisma
/// Ubicación conocida del mundo (catálogo, no estado de partida). Se siembra desde
/// backend/src/scripts/worldCatalog.ts (mismo patrón que loreChunks.ts + reindex-lore):
/// la fuente de verdad editorial sigue siendo docs/rpgtarkor/areas.md.
model Location {
  id          String   @id @default(cuid())
  worldId     String
  world       World    @relation(fields: [worldId], references: [id], onDelete: Cascade)
  /// Clave estable para seeds, aliases y referencias cruzadas ("hondonada-del-eco")
  slug        String
  name        String
  /// Nombre de región del lore — string libre, no FK (misma razón que Territory.region:
  /// el lore vive en .md)
  region      String
  /// Tipo libre ("refugio", "hito", "punto de agua", "cruce", "ruinas", "asentamiento") —
  /// no enum cerrado, misma razón que Companion.role
  kind        String
  /// Descripción de LLEGADA: lo que se inyecta al Narrador cuando el personaje llega aquí
  /// o está aquí — redactada con vocabulario de jugador (lección RAG 2026-07-18)
  description String
  /// Nombres con los que un jugador se refiere de verdad al sitio ("los pilares", "el pozo") —
  /// para que el matcher DETERMINISTA de destinos resuelva sin pasar por el modelo
  aliases     String[]
  createdAt   DateTime @default(now())

  linksFrom LocationLink[] @relation("linkFrom")
  linksTo   LocationLink[] @relation("linkTo")
  visits    LocationVisit[]

  @@unique([worldId, slug])
}

/// Ruta directa entre dos ubicaciones. Se guarda UNA fila por pareja y el grafo se trata
/// como bidireccional (ir y volver cuestan lo mismo en v1 — si algún día una ruta es
/// asimétrica, se añade la fila inversa con otro coste y gana la específica).
model LocationLink {
  id     String   @id @default(cuid())
  fromId String
  from   Location @relation("linkFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId   String
  to     Location @relation("linkTo", fields: [toId], references: [id], onDelete: Cascade)

  /// Minutos de viaje BASE (a pie, sin modificador). Es exactamente el `base` de la fórmula
  /// YA existente en timedActions.ts — minutos = base / (1 + destreza/20). No se toca la
  /// fórmula: solo se le da un `base` determinista sacado del grafo en vez de la estimación
  /// libre del clasificador.
  minutosBase Int
  /// Terreno libre ("llanura abierta", "arcilla agrietada", "senda de pastoreo") — color
  /// concreto para narrar el trayecto sin inventar
  terreno     String
  /// Riesgo conocido de la ruta ("nidos de Espina del Viento", "paso de patrullas de la
  /// Concordia") — material para el Narrador; null = sin riesgo señalado
  riesgo      String?

  @@unique([fromId, toId])
}

/// Primera visita de una partida a una ubicación — habilita el hito "descubrimiento"
/// (50 XP, tabla de docs/10 § 3.2) de forma DETERMINISTA: lo emite el backend al llegar
/// por primera vez, sin que el modelo tenga que proponerlo.
model LocationVisit {
  id             String   @id @default(cuid())
  saveId         String
  save           Save     @relation(fields: [saveId], references: [id], onDelete: Cascade)
  locationId     String
  location       Location @relation(fields: [locationId], references: [id], onDelete: Cascade)
  firstVisitedAt DateTime @default(now())

  @@unique([saveId, locationId])
}
```

En `Save` se añade:

```prisma
  /// Ubicación actual en el grafo (null = partidas antiguas sin posición todavía; se
  /// rellena con la ubicación inicial al migrar). Durante un viaje NO cambia: sigue
  /// siendo el origen hasta que worldTick resuelve el CharacterTransit — "dónde estoy"
  /// nunca es ambiguo, y "hacia dónde voy" vive en el tránsito.
  currentLocationId String?
  currentLocation   Location? @relation(fields: [currentLocationId], references: [id])
  locationVisits    LocationVisit[]
```

**Ubicación inicial de Gorhorn: La Hondonada del Eco** — es el lugar que surgió de su propia partida de prueba (acampando), y arrancar en un refugio da un primer turno tranquilo. Trivial de cambiar en el seed si la usuaria prefiere otro.

### 1.3 El grafo v1 de las Llanuras del Viento Rojo

**Nota (2026-08-13): este es el grafo de arranque, no el estado actual.** Desde 2026-07-20 se ha
ampliado varias veces (4 POIs el 2026-07-22, 2 más el 2026-07-22bis, 16 nodos nuevos —sabana, fosa,
costa norte, desierto Nabierus— el 2026-08-05) hasta pasar de 6 a más de 20 nodos. Las tablas de
nodos/aristas de más abajo quedan como estaban (siguen siendo canon para estos 6), pero para el
grafo completo ver `docs/13-escala-del-mundo.md` § 1.1, § 2.2bis y § 2.2ter (que sí se mantuvo al
día) y `backend/src/scripts/worldCatalog.ts`.

Los 5 POIs ya documentados + **un nodo nuevo necesario**: el **Campamento del Clan Serhu**. Sin él, los NPCs del § 2 no tienen dónde estar y los ganchos 2 y 6 de `personajes.md` no tienen origen físico. Es el único lugar nuevo que se canoniza aquí (habrá que añadirlo a `areas.md` y como lore chunk — ver pendientes). Se coloca cerca del Pozo de Cauce Viejo: un clan que pastorea y caza necesita el agua permanente, y explica que el Pozo sea "punto de encuentro para bien o para mal".

**Nodos:**

| slug | Nombre | kind | Notas |
|---|---|---|---|
| `hondonada-del-eco` | La Hondonada del Eco | refugio | Inicio de Gorhorn |
| `pilares-rotos` | Los Pilares Rotos | hito | Referencia visible desde casi todo el grafo |
| `pozo-cauce-viejo` | El Pozo de Cauce Viejo | punto de agua | Agua permanente, cruce de viajeros |
| `cruce-de-las-cenizas` | El Cruce de las Cenizas | cruce | Entrada/salida hacia la Meseta del Orden |
| `restos-de-maktor` | Los Restos de Maktor | ruinas | Gancho "un Maktor superviviente" |
| `campamento-serhu` | Campamento del Clan Serhu | asentamiento | **Nuevo** — hogar de Torgash y Ulkha (§ 2.3) |

**Aristas** (minutos base a pie; con destreza 9 de Gorhorn, dividir entre 1,45):

| Ruta | Base | Gorhorn | Terreno | Riesgo conocido |
|---|---|---|---|---|
| Cruce de las Cenizas ↔ Pilares Rotos | 240 | ~165 min | Camino apisonado que se deshace en llanura | Paso de patrullas de la Concordia cerca del Cruce |
| Cruce de las Cenizas ↔ Pozo de Cauce Viejo | 300 | ~207 min | Llanura abierta | Espinas del Viento tras las tormentas |
| Pilares Rotos ↔ Hondonada del Eco | 120 | ~83 min | Arcilla agrietada, llanura abierta | — |
| Pilares Rotos ↔ Pozo de Cauce Viejo | 180 | ~124 min | Llanura siguiendo el cauce subterráneo | Manadas de Corredores de Cauce en migración |
| Hondonada del Eco ↔ Pozo de Cauce Viejo | 150 | ~103 min | Terreno de hondonadas | Nidos de Espina del Viento entre las hondonadas |
| Pozo de Cauce Viejo ↔ Campamento Serhu | 120 | ~83 min | Senda de pastoreo marcada | Vigías Serhu — se llega visto desde lejos |
| Pilares Rotos ↔ Restos de Maktor | 300 | ~207 min | Estepa profunda sin senda | Tormentas de arena magnética, sin refugio |
| Campamento Serhu ↔ Restos de Maktor | 360 | ~248 min | Estepa profunda | Tormentas de arena magnética |

```
   (Meseta del Orden — fuera del área jugable v1)
                 |
      El Cruce de las Cenizas
        /                 \
     240                   300
      /                     \
 Los Pilares Rotos --180-- El Pozo de Cauce Viejo --120-- Campamento Serhu
      |        \             /                                  |
     120        \         150                                  360
      |          300       /                                    |
 La Hondonada     \       /                                     |
   del Eco         Los Restos de Maktor ------------------------+
```

Escala resultante: cruzar la región entera (Cruce → Restos de Maktor, 540 base ≈ 6h para Gorhorn) es una banda **extendida** larga; ningún viaje interno llega a **larga** (>24h). Coherente con un mundo pequeño (~6.000 habitantes máx.) donde la región de un clan se recorre en un día duro de marcha. Salir de la región (Meseta, Cristal Helado...) queda fuera del grafo v1: si el jugador lo intenta, el flujo del § 1.4 no encuentra destino y el turno se resuelve como hasta hoy (estimación del clasificador + tránsito largo) — no se bloquea, simplemente aún no está estructurado.

### 1.4 Flujo "viajar a X": del texto libre al grafo sin que el modelo invente

Principio: **el modelo nunca elige la ruta, solo (como mucho) el destino, y siempre de una lista cerrada.**

```
Jugador: "voy hacia el pozo a rellenar el odre"

1. [Backend, determinista] Detección de intención de viaje: el regex que YA existe en
   timedActions.ts (/viaj|camin|desplaz|ruta|tramo/) ampliado con /voy a|me dirijo|parto
   hacia|vuelvo a|me acerco a/.
2. [Backend, determinista] Matcher de destino: normalizar el texto (minúsculas, sin
   tildes) y buscar aliases de Location de la región actual.
   → "el pozo" ∈ aliases de pozo-cauce-viejo → destino resuelto SIN modelo.
3. [Modelo pequeño, solo si 2 falla o hay ambigüedad] El prompt de clasificación recibe
   un bloque nuevo con lista CERRADA y el JSON schema un campo nuevo:
       DESTINOS POSIBLES DESDE La Hondonada del Eco:
       - pilares-rotos (Los Pilares Rotos, ~1h30)
       - pozo-cauce-viejo (El Pozo de Cauce Viejo, ~2h)
       destino: { enum: ["pilares-rotos", "pozo-cauce-viejo", ..., "ninguno"] }
   El modelo hace matching de términos — la tarea de clasificación con enum que ya
   sabe hacer — no inventa lugares. "ninguno" = no es un viaje por el grafo.
4. [Backend, determinista] Ruta: Dijkstra sobre minutosBase desde currentLocationId.
   base = suma de aristas del camino más corto.
5. [Backend, determinista] Duración: la fórmula existente de timedActions.ts con ese
   base → minutos. La BANDA se deriva de los minutos (corta <60, extendida <1440,
   larga ≥1440) SOBREESCRIBIENDO la del clasificador: para viajes por grafo, el dato
   determinista manda sobre la estimación del modelo.
6. [Backend] Tránsito: exactamente el mecanismo actual de /turn/classify — banda
   extendida/larga ⇒ CharacterTransit con zoneContext ampliado:
       zoneContext: { action, classification, roll,
                      travel: { toLocationId, path: [slugs], baseMinutos } }
7. [worldTick, al vencer] ANTES de narrar: Save.currentLocationId = toLocationId;
   LocationVisit para el destino si es primera vez (+ marcar visitados los nodos
   intermedios del path, sin XP); si primera visita al destino → hito "descubrimiento"
   determinista (50 XP, entra en el tope de 1 hito/turno de docs/10 § 3.2).
8. [Modelo grande] La narración de llegada recibe la descripción del destino y de la
   ruta (terreno + riesgo de las aristas recorridas) — narra conectando datos, no
   inventando geografía.
```

- **Tiradas en viaje:** viajar por ruta conocida del grafo **no requiere tirada** (v1) — es terreno natal de Gorhorn y la lista de destinos es precisamente "lo que el personaje conoce". El peligro de las rutas entra por la narración de llegada (campo `riesgo` de la arista) y por los ganchos de siempre, no por una tirada de orientación que el clasificador tendría que inventarse.
- **Interrumpir un viaje** en marcha no existe hoy en `CharacterTransit` y no se diseña aquí — mismo comportamiento que cualquier acción extendida actual.
- **Lugares nuevos surgidos jugando** siguen el pipeline editorial ya establecido: nacen como `WorldState.facts`, y si merecen canon se añaden a `areas.md` + `worldCatalog.ts` + chunk y se re-siembra (igual que la propia Hondonada del Eco en su día). No se crean filas `Location` desde el modelo — el catálogo es curado, no generado.

### 1.5 Bloque de posición en TODOS los prompts de narración

Aunque el turno no sea un viaje, la narración recibe siempre:

```
UBICACIÓN ACTUAL: El Pozo de Cauce Viejo — uno de los pocos puntos de agua permanentes...
DESDE AQUÍ SE PUEDE IR A: Los Pilares Rotos (~2h), la Hondonada del Eco (~1h45),
el Campamento del Clan Serhu (~1h25), el Cruce de las Cenizas (~3h30).
```

Esto responde de raíz al objetivo de la usuaria ("saber bien dónde estás y hacia dónde avanzas"), reduce los casos `weaklyGrounded` (siempre hay al menos un lugar concreto que describir), y hace que cuando el jugador pregunte "¿qué hay cerca?" el modelo **lea** la respuesta en vez de inventarla.

### 1.6 Frontend

`Save.currentLocationId` sustituye al `isCurrent` hardcodeado de `map.ts`. Pendiente (no bloqueante): servir el catálogo de ubicaciones desde el backend (`GET /world/:id/locations`) para que `map.ts` deje de duplicar a mano lo que ya estará en `Location` — una sola fuente de verdad. El panel de mapa puede además listar "destinos desde aquí" con sus tiempos ya calculados para la destreza del personaje: la misma lista cerrada que ve el clasificador, visible para el jugador.

---

## 2. NPCs: principales con números fijos, genéricos por plantilla

### 2.1 Decisión de modelo: tabla nueva, no stats dentro de lore chunks

**Los números viven en una tabla (`Npc`); la prosa vive en lore chunks. Nunca al revés.** Justificación:

- La recuperación RAG es **semántica y con pérdida**: recupera "lo más parecido", no "exactamente esto". Para biografía y ganchos eso es perfecto; para stats es inaceptable — si el chunk de Torgash no entra en el top-k de esa acción, el Narrador le inventaría números, que es justo la clase de alucinación que este documento existe para eliminar.
- Los stats se necesitan con **consulta determinista** (por nombre exacto, siempre que el NPC esté en escena), que es una query SQL, no una búsqueda por embedding.
- Regla anti-desincronización: **los chunks de NPCs no llevan números** (ni atributos ni nivel). Así no pueden quedarse obsoletos respecto a la tabla. El bloque de stats se inyecta siempre desde `Npc` (§ 2.5).

```prisma
enum NpcKind {
  PRINCIPAL  // individuo con nombre propio: stats y equipo FIJOS, nunca los inventa el modelo
  PLANTILLA  // arquetipo instanciable ("guerrero orco rezagado"): statline canónica + rango de nivel
}

/// NPC del catálogo de mundo (no estado de partida — qué ha hecho un NPC en UNA partida
/// sigue viviendo en WorldState.facts, igual que hasta ahora). Sembrado desde
/// worldCatalog.ts; la prosa larga vive en docs/rpgtarkor/npcs.md y en lore chunks SIN números.
model Npc {
  id      String  @id @default(cuid())
  worldId String
  world   World   @relation(fields: [worldId], references: [id], onDelete: Cascade)
  kind    NpcKind
  slug    String
  name    String
  /// Formas reales de referirse a él/ella ("torgash", "el jefe de guerra serhu", "la terk'ikar")
  /// — para la detección determinista de "NPC en escena" (§ 2.5)
  aliases String[]
  /// Clan o facción, libre ("Clan Serhu", "Concordia de Hierro") — null para independientes
  faction String?
  /// Rol corto ("Kort'ikar del Clan Serhu", "soldado de patrulla") — libre
  role    String
  /// Nivel en la MISMA escala de docs/10-niveles-xp-reino.md. Para PRINCIPAL es fijo; para
  /// PLANTILLA es el nivel canónico (levelMax acota el rango típico). Hoy el motor no hace
  /// tiradas opuestas: este nivel sirve para que el clasificador calibre la dificultad y el
  /// Narrador el tono (§ 2.5), no para un sistema de combate simétrico.
  level    Int
  levelMax Int?
  /// AttributeBlock { fuerza, destreza, sigilo, voluntad, carisma, arcano }, rango 4-18 —
  /// mismo shape que Save.attributes para poder reutilizar tipos y validaciones
  attributes Json
  /// Biografía/descripción corta + personalidad: el resumen que se inyecta en el prompt.
  /// La versión larga y los ganchos viven en los .md y en lore chunks.
  bio         String
  personality String
  /// Dónde se le encuentra normalmente — slug de Location, string (no FK: una plantilla
  /// puede aparecer "en cualquier ruta"), null = itinerante
  homeLocationSlug String?

  items NpcItem[]

  @@unique([worldId, slug])
}
```

### 2.2 Escala de niveles y calibración de dificultad

Los NPCs usan la escala de niveles ya cerrada (docs/10). Presupuesto de atributos coherente con el jugador: **60 puntos + ASI por nivel (niveles 4/8/12/16/19, +2 cada uno)** para PRINCIPALES "de talla heroica"; las PLANTILLAS van deliberadamente por debajo (48–56 puntos) — la gente corriente no es un héroe.

Para que el clasificador (que hoy pone la dificultad sin saber contra quién) calibre sin calcular, cuando hay NPC en escena su prompt recibe una **regla ya masticada**, derivada de la diferencia de nivel:

| Nivel NPC − nivel jugador | Dificultad orientativa contra él |
|---|---|
| ≤ −2 | Fácil (12) |
| −1 a +1 | Media (15) |
| +2 a +4 | Difícil (18) |
| ≥ +5 | Muy difícil (22) |

El backend calcula la diferencia y le pasa al clasificador la frase resultante ("las acciones directas contra Torgash tienden a Difícil (18)") — el modelo conecta, no aritmetiza. Es orientación, no imposición: una acción ingeniosa o social puede clasificarse distinto.

### 2.3 NPCs principales v1 (Llanuras + vínculos directos de Gorhorn)

Solo los que ya tienen gancho con el material existente. Ningún NPC de Vaelira ni neutral del estrecho (fuera de alcance). Vrask Ombra y Yovenne Tal son de Berig pero operan en la Meseta/alto mando — quedan fuera del catálogo v1 hasta que la partida los acerque.

**1. Kort'ikar Torgash** — `torgash`, PRINCIPAL, **nivel 5**
*Decisión de diseño (revisable, ver § 6):* el "Jefe de Guerra Torgash" de `npcs.md` se concreta como **Kort'ikar del Clan Serhu**. Une tres piezas que ya existían sueltas: el único NPC orco con nombre, el clan rival ya documentado, y el gancho 6 ("un Kort'ikar en apuros, posiblemente Serhu"). Su agenda de `npcs.md` (sacar a los orcos de una guerra que no les pertenece) gana raíz: los Serhu vieron lo que la Concordia hizo con los Maktor.

- **Bio:** veterano de las escaramuzas fronterizas; ascendió a Kort'ikar cuando su predecesor murió en el frente. Busca unificar los clanes para retirar a su pueblo de la guerra de la Concordia. El padre de Gorhorn murió retando al **anterior** Kort'ikar Serhu, no a Torgash — Torgash lo recuerda, y respeta cómo murió (propuesta; ver § 6).
- **Personalidad:** grave, económico con las palabras, pragmático hasta rozar la herejía cultural (prefiere pactar a duelar). Detesta a la Concordia en silencio.
- **Atributos** (62 pts = 60 + ASI niv. 4): fuerza 16 · destreza 9 · sigilo 5 · voluntad 15 · carisma 12 · arcano 5
- **Se le encuentra:** `campamento-serhu` (o en ruta — gancho 6).

**2. Terk'ikar Ulkha** — `ulkha`, PRINCIPAL, **nivel 6** *(nombre nuevo — el rol existía sin nombre: "alguien del Clan Serhu" que gobierna, pedida explícitamente)*
- **Bio:** Jefa del Clan Serhu; gobierna asentamiento, pastoreo y migraciones. Fue ella quien decidió no acoger supervivientes Maktor tras la aniquilación — por cálculo de supervivencia, no crueldad: la Concordia buscaba rezagados y acogerlos era pintar una diana en su clan. Un Gorhorn vivo la enfrenta a esa decisión (usa la ambigüedad ya documentada: los Serhu como puente o como rencor).
- **Personalidad:** fría en el cálculo y cálida en el trato, en ese orden. Comulga con las Gargantúas en las migraciones (facultad de las Terk'ikar ya canónica).
- **Atributos** (62 pts): fuerza 9 · destreza 8 · sigilo 6 · voluntad 16 · carisma 15 · arcano 8
- **Se le encuentra:** `campamento-serhu`.

**3. Hagar** — `hagar`, PRINCIPAL, **nivel 2**
Ya existe con nombre en el lore (amigo de Gorhorn, Clan Helsig, minas de hielo sílice). Vive en Cristal Helado — fuera del grafo v1 — pero es EL vínculo personal vivo de Gorhorn: si la partida lo trae (mensaje, viaje, rumor), el Narrador no debe inventarle números.
- **Personalidad:** leal, ruidoso, de risa fácil — el opuesto exacto del Gorhorn callado de las minas, por eso encajaron.
- **Atributos** (60 pts): fuerza 15 · destreza 8 · sigilo 5 · voluntad 12 · carisma 11 · arcano 9
- **Se le encuentra:** Cristal Helado (sin slug v1 — `homeLocationSlug` null con nota).

### 2.4 Plantillas genéricas v1

Una statline canónica por plantilla (la que usa el motor), con `level`–`levelMax` como rango de tono. Instanciar = el Narrador dice "un guerrero rezagado" y el backend inyecta **estos** números y **este** equipo — cero invención. La variación entre individuos es narrativa (nombre, estado, actitud), nunca numérica en v1 (ver § 6).

| Plantilla | slug | Nivel (rango) | FUE | DES | SIG | VOL | CAR | ARC | Lleva encima (§ 4.4) |
|---|---|---|---|---|---|---|---|---|---|
| Guerrero orco rezagado | `orco-rezagado` | 2 (1–3) | 14 | 9 | 7 | 11 | 7 | 6 | maza mellada, amuleto de hueso, 1 ración pasada, marca de su clan |
| Joven cazador/a Serhu | `cazador-serhu` | 1 (1–2) | 11 | 12 | 10 | 9 | 8 | 4 | lanza corta de caza, cuerda de tendón, 2 raciones, 1 piel de corredor |
| Soldado de patrulla de la Concordia | `soldado-concordia` | 2 (2–3) | 12 | 10 | 6 | 13 | 8 | 4 | espada corta goirntes, cota ligera, 2 raciones goirntes |
| Oficial de patrulla de la Concordia | `oficial-concordia` | 4 (3–5) | 12 | 10 | 6 | 15 | 12 | 4 | espada goirntes, cota ligera, correspondencia sellada, sello de patrulla, 2 raciones |
| Mercader de paso | `mercader-de-paso` | 1 (1–1) | 7 | 9 | 8 | 10 | 14 | 4 | cuchillo corto, sal de trueque ×2, grano de espiga roja ×4, abalorios |

(Una "patrulla de la Concordia" tipo = 3 soldados + 1 oficial — composición fija documentada aquí para que el Narrador tampoco invente cuántos son.)

### 2.5 Inyección en los prompts: "PERSONAJE EN ESCENA"

Detección **determinista** (sin llamada extra a Ollama): el backend busca `Npc.aliases` (normalizados) en el texto de la acción y en los `WorldState.facts` de la sesión. Si hay match, ambos prompts del turno reciben:

```
PERSONAJE EN ESCENA: Kort'ikar Torgash — orco, Kort'ikar del Clan Serhu, nivel 5
(muy por encima de Gorhorn: acciones directas contra él tienden a Muy difícil).
Personalidad: grave, pragmático, detesta a la Concordia en silencio.
LLEVA ENCIMA: hacha de guerra orca con la marca Serhu, lanza de hueso de gargantúa,
amuleto de colmillos de corredor, raciones (3 días), una raíz de fuego.
Si es derrotado, registrado o comercia, lo que lleva encima es TODO lo que puede
aparecer — no existe ningún otro objeto.
```

- El clasificador recibe además la línea de calibración de dificultad del § 2.2.
- Para plantillas, el match es por alias del arquetipo ("patrulla", "rezagado", "mercader") o porque un fact previo lo fijó ("una patrulla de la Concordia (3 soldados y una oficial) vigila el Cruce").
- Los chunks RAG de estos NPCs (a crear, estilo GANCHO con vocabulario de jugador) siguen aportando el trasfondo largo cuando el embedding los trae — pero los números y el equipo llegan SIEMPRE por esta vía determinista, entren o no los chunks en el top-k.

---

## 3. Fauna y flora: cada especie dice qué recursos da

Objetivo: que "despiezo el corredor que he cazado" se responda leyendo una tabla, no improvisando. Los rendimientos son **fijos** (cantidades exactas, no rangos ni dados) — la variación ya la puso la tirada de caza previa; el despiece es lectura.

### 3.1 Especies existentes de las Llanuras → recursos

| Especie (ya canónica) | Recurso cosechable (→ § 4.3) | Cantidad fija | Condición |
|---|---|---|---|
| Corredor de Cauce | piel de corredor | 1 | cuchillo (deshuello) |
| | ración de carne | 4 | — |
| | cuerda de tendón | 2 | cuchillo |
| | hueso ligero | 6 | — |
| Gargantúa de Ceniza | placa ósea de gargantúa | 2 | SOLO cadáver ya muerto o cacería ritual de clan — los orcos las respetan (canon); una Gargantúa nunca es "loot casual" |
| | hueso largo de gargantúa | 1 | ídem |
| | piel de gargantúa | 1 | ídem |
| Espina del Viento | aguijón con veneno | 1 | extracción cuidadosa (destreza, Media 15 — falla = veneno perdido, no herida automática) |
| | caparazón quitinoso | 1 | — |
| Raíz de Fuego (flora, ya canónica) | raíz de fuego | 1 | extracción con cuidado (destreza, Media 15 — falla = se inflama) |

### 3.2 Especies nuevas (canon nuevo — revisar nombres, § 6)

Las Llanuras tenían fauna de peligro pero casi nada de sustento cotidiano: sin caza menor, planta medicinal ni leña, las acciones de supervivencia más obvias ("busco algo que comer", "junto leña", "curo la herida con algo") dejaban al Narrador sin material — exactamente el caso que produjo el cuelgue de "busca un lugar seguro para acampar". Cuatro adiciones mínimas, una por hueco:

| Especie nueva | Qué es | Recursos | Cantidad | Condición |
|---|---|---|---|---|
| **Corretolvas** (fauna, caza menor) | Criaturas corredoras incapaces de volar, de tamaño pequeño, en bandadas entre la hierba rojiza; se cazan con trampa o lanza corta | ración de carne | 1 | — |
| | | puñado de plumas rojizas | 1 | — |
| **Salvia del Polvo** (flora, medicinal) | Mata baja de hojas grises y aroma amargo; crece en hondonadas y zonas de sombra. Machacada corta hemorragias y limpia heridas | manojo de salvia del polvo | 1 | reconocerla (los orcos de las Llanuras la conocen de niños — para Gorhorn no requiere tirada) |
| **Espiga Roja** (flora, alimento) | Cereal silvestre de la estepa, del color de la tierra; grano comestible tostado, también forraje | grano de espiga roja | 1 por hora de recolección | fórmula determinista en timedActions.ts, patrón "leña" |
| **Matorral de Cuerno** (flora, combustible/madera) | Arbusto de madera densa y retorcida, arde lento y caliente; la única leña real de la llanura abierta | leña de matorral de cuerno | usa la fórmula de leña YA existente | — |

El Matorral de Cuerno además **legitima retroactivamente** la fórmula de cortar leña ya implementada (hasta hoy no existía en el lore nada que cortar en las Llanuras).

### 3.3 Modelo de datos: `HarvestYield`

```prisma
/// Qué recurso concreto da cada especie/planta al despiezarla o recolectarla — catálogo de
/// mundo. El "loot" de la naturaleza sigue la misma regla que el de los NPCs: es una lista
/// fija que se lee, nunca una tirada ni una invención del modelo. Las especies NO tienen
/// tabla propia: su prosa vive en flora-fauna.md/lore chunks; aquí solo la clave textual estable.
model HarvestYield {
  id         String      @id @default(cuid())
  worldId    String
  world      World       @relation(fields: [worldId], references: [id], onDelete: Cascade)
  /// Clave de la especie ("corredor-de-cauce", "salvia-del-polvo") — string, no FK
  sourceSlug String
  sourceName String
  itemId     String
  item       ItemCatalog @relation(fields: [itemId], references: [id], onDelete: Cascade)
  /// Cantidad FIJA por pieza/planta — la variación ya la puso la tirada de caza previa
  cantidad   Int         @default(1)
  /// Condición narrativa o de tirada ("cuchillo de deshuello", "extracción cuidadosa:
  /// destreza 15", "solo cadáver ya muerto") — null = sin condición
  condicion  String?

  @@index([worldId, sourceSlug])
}
```

Inyección: cuando la acción menciona una especie (matcher por alias, igual que NPCs — las especies canónicas y sus alias van en una lista en el servicio), la narración recibe:

```
DESPIECE/RECOLECCIÓN — Corredor de Cauce: 1 piel, 4 raciones de carne, 2 cuerdas de
tendón, 6 huesos ligeros (piel y tendón requieren cuchillo). Esto es TODO lo que da.
```

Y el backend materializa los `InventoryItem` correspondientes él mismo (ver § 4.5) — el modelo narra el despiece, no decide su resultado.

---

## 4. Armería: catálogo cerrado y "el loot es la lista, nunca el dado"

### 4.1 Principio

Instrucción explícita de la usuaria: **"El loot nunca será aleatorio, será lo que el NPC lleva encima."** Traducción a arquitectura:

1. Existe un **catálogo cerrado** de objetos (`ItemCatalog`) — el universo de cosas que pueden aparecer en las Llanuras.
2. Cada NPC (principal o plantilla) tiene una **lista fija** de qué lleva (`NpcItem`).
3. "Lootear" = el backend **lee** esa lista y copia filas a `InventoryItem`. Sin tirada, sin tabla de probabilidades, sin que el modelo proponga objetos.
4. El campo `newItem` del JSON de narración **queda restringido**: cuando hay NPC en escena o despiece activo, el backend IGNORA `newItem` y usa la lista (el prompt además instruye al modelo para dejarlo en null en esos casos). `newItem` sobrevive solo para el caso legítimo que ya cubría: objetos fabricados o hallados sin fuente estructurada (y como pendiente futuro, incluso eso puede pasar a validarse contra el catálogo).

Coherencia con la decisión de mecánicas 5 (revertida en parte el 2026-08-13): la mayoría de objetos siguen sin stats, pero el equipo real puede llevar `statBonuses` — el catálogo aporta identidad y procedencia siempre, y números reales cuando el objeto es equipable (ver `backend/src/services/equipment.ts`).

### 4.2 Modelo de datos

```prisma
/// Catálogo cerrado de objetos del mundo (armas, herramientas, materiales, consumibles,
/// documentos, objetos de valor narrativo). description es siempre contexto para el
/// Narrador; statBonuses (decisión de mecánicas 5, revertida en parte 2026-08-13) añade
/// bonificadores reales cuando el objeto es equipable. Sembrado desde worldCatalog.ts.
model ItemCatalog {
  id          String  @id @default(cuid())
  worldId     String
  world       World   @relation(fields: [worldId], references: [id], onDelete: Cascade)
  slug        String
  name        String
  /// Categoría libre ("arma", "herramienta", "ropa", "material", "consumible",
  /// "medicinal", "documento", "valor") — organiza el catálogo, no es mecánica
  category    String
  description String
  createdAt   DateTime @default(now())

  npcItems NpcItem[]
  yields   HarvestYield[]

  @@unique([worldId, slug])
}

/// Lo que un NPC lleva encima — la ÚNICA fuente de loot al derrotarlo/registrarlo/comerciar.
model NpcItem {
  id       String      @id @default(cuid())
  npcId    String
  npc      Npc         @relation(fields: [npcId], references: [id], onDelete: Cascade)
  itemId   String
  item     ItemCatalog @relation(fields: [itemId], references: [id], onDelete: Cascade)
  cantidad Int         @default(1)
  /// Personalización de ESTA pieza ("con la marca del Clan Serhu grabada", "mellada") —
  /// el mismo objeto de catálogo puede ser genérico en un NPC y significativo en otro
  notas    String?

  @@unique([npcId, itemId])
}
```

`InventoryItem` no cambia (no tiene campo cantidad): al lootear, la cantidad se pliega al nombre/descripción ("Raciones goirntes (2 días)") — mismo comportamiento que el inventario inicial de Gorhorn ("raciones para 5 días").

### 4.3 Catálogo v1 (~30 objetos)

Todo lo que ya existe en `rpgtarkor/items.md` § Armamento y loot + el inventario inicial de Gorhorn + los recursos del § 3. Nada fuera de la región y su comercio natural.

| slug | Nombre | Cat. | Nota |
|---|---|---|---|
| `hacha-guerra-orca` | Hacha de guerra orca | arma | El arma orca por excelencia |
| `maza-orca` | Maza orca | arma | La de un rezagado está "mellada" (notas) |
| `cuchillo-hielo-silice` | Cuchillo de hielo sílice | arma | Filo mineral, comercio con los Helsig |
| `cuchillo-deshuello` | Cuchillo de deshuello de hielo sílice | herramienta | Para pieles duras (canon Cristal Helado) |
| `lanza-hueso-gargantua` | Lanza de hueso de gargantúa | arma | Cacerías rituales y duelos de honor |
| `lanza-corta-caza` | Lanza corta de caza | arma | La de los jóvenes cazadores |
| `espada-corta-goirntes` | Espada corta goirntes | arma | Manufactura más refinada que la orca |
| `cuchillo-corto` | Cuchillo corto | arma | Común, sin origen especial |
| `pico-minero` | Pico de minero | herramienta | Hagar |
| `cuerda-tendon` | Cuerda de tendón | herramienta | De Corredor de Cauce |
| `odre-agua` | Odre de agua | herramienta | Imprescindible en la estepa |
| `piedras-chispa` | Piedras de chispa | herramienta | Encender fuego sin Raíz de Fuego |
| `arnes-cuero` | Arnés de cuero | ropa | Como el de Gorhorn |
| `cota-ligera-goirntes` | Cota de aleación ligera goirntes | ropa | De Hierba del Hierro procesada (canon) |
| `capa-piel-gargantua` | Capa de piel de gargantúa | ropa | Como la de Gorhorn |
| `piel-corredor` | Piel de Corredor de Cauce | material | Ligera, resistente al calor |
| `piel-gargantua` | Piel de gargantúa | material | Solo cacería ritual/cadáver |
| `placa-osea-gargantua` | Placa ósea de gargantúa | material | Construcción/armadura pesada |
| `hueso-largo-gargantua` | Hueso largo de gargantúa | material | Materia prima de lanzas |
| `hueso-ligero` | Hueso ligero | material | Abalorios, agujas, mangos |
| `caparazon-espina` | Caparazón de Espina del Viento | material | Quitina dura |
| `esquirla-hielo-silice` | Esquirla de hielo sílice | material | Para tallar filos y prótesis |
| `lena-matorral-cuerno` | Leña de matorral de cuerno | material | Producto de la fórmula de leña |
| `racion-viaje` | Ración de viaje | consumible | La unidad estándar ("para N días") |
| `racion-goirntes` | Ración goirntes | consumible | Compacta, mejor conservada |
| `racion-carne` | Ración de carne fresca | consumible | De caza; se estropea en días (narrativo) |
| `grano-espiga-roja` | Grano de espiga roja | consumible | Tostado o como forraje |
| `sal-trueque` | Sal de trueque | valor | Moneda de facto de la estepa |
| `manojo-salvia-polvo` | Manojo de salvia del polvo | medicinal | Corta hemorragias, limpia heridas |
| `veneno-espina` | Aguijón con veneno de Espina del Viento | medicinal | Altera la percepción del dolor (canon) |
| `raiz-de-fuego` | Raíz de fuego | consumible | Iniciador de fuego/explosivo (canon) |
| `correspondencia-concordia` | Correspondencia sellada de la Concordia | documento | Gancho puro — puede saber demasiado |
| `sello-patrulla-concordia` | Sello de patrulla de la Concordia | documento | Acredita (o incrimina) a quien lo lleva |
| `amuleto-hueso` | Amuleto de hueso | valor | Vértebras/colmillos de presa importante |
| `abalorios` | Abalorios variados | valor | Trueque menor |
| `marca-de-clan` | Cinturón de cargador | cosmetico | Renombrado 2026-09-02 (era "Marca de clan", solo decorativo) — equipable, `statBonuses: { inventorySlots: 4 }`, el clan concreto sigue yendo en `notas` de quien lo lleva |
| `totem-clan-roto` | Tótem de clan roto | valor | Gancho "Maktor superviviente" — **también ingrediente real de `MAKTOR_CLAN_TOTEM_RECIPE` (construction.ts)**, hallazgo de la ampliación de lore 2026-08-21 que hizo revertir su retirada inicial (ver `areas.md`, pendiente de confirmar con la usuaria si se mantiene tal cual) |
| `totem-maktor` | Tótem del Clan Maktor | valor | ÚNICO — el de Gorhorn; en catálogo para que su nombre sea estable en hechos y narración |

### 4.4 Equipo fijo de los NPCs principales

(Las plantillas ya llevan el suyo en la tabla del § 2.4.)

**Torgash:** `hacha-guerra-orca` (notas: "con la marca del Clan Serhu grabada en la cabeza"), `lanza-hueso-gargantua`, `amuleto-hueso` (notas: "colmillos de corredor de su primera cacería"), `racion-viaje` ×3, `raiz-de-fuego` ×1, `odre-agua`.

**Ulkha:** `cuchillo-deshuello`, `manojo-salvia-polvo` ×3, `amuleto-hueso` (notas: "vértebras de gargantúa — símbolo de su comunión"), `sal-trueque` ×2, `odre-agua`.

**Hagar:** `pico-minero`, `cuchillo-hielo-silice`, `esquirla-hielo-silice` ×2, `racion-viaje` ×2, `piedras-chispa`.

*(El inventario inicial de Gorhorn ya existe como `InventoryItem`; el catálogo simplemente da slug estable a esos mismos nombres para futuras referencias cruzadas.)*

### 4.5 Flujo de loot en el turno

```
1. Turno con NPC en escena resuelto como derrota/registro/trueque (lo dice la propia
   narración/acción — "registro el cuerpo", "le compro las raciones").
2. El prompt ya contenía LLEVA ENCIMA (§ 2.5) con la instrucción "esto y SOLO esto".
3. El backend NO confía en newItem para esto: un matcher sencillo sobre la acción
   ("registr|saque|desped|coj|robo|compr|qued") + NPC en escena activa el modo loot,
   y el frontend ofrece la lista fija ("¿Qué te llevas?") leída de NpcItem — o v1 aún
   más simple: se copian TODAS las filas del loadout a InventoryItem (origin:
   "botín de <npc>", notas incluidas) y el jugador descarta después.
4. newItem se ignora ese turno (y el prompt pide dejarlo null). Cero invención posible.
```

La elección entre "copiar todo" y "el jugador elige" es de UX, no de datos — se decide al implementar (pendiente 7); el modelo de datos es idéntico.

Para el despiece de fauna (§ 3.3), mismo flujo con `HarvestYield` como fuente, aplicando `condicion` (si exige tirada, la pone el clasificador como siempre — p. ej. destreza 15 para el aguijón).

---

## 5. Resumen de migraciones y campos

**Migración 3 — posición (§ 1):** modelos `Location`, `LocationLink`, `LocationVisit`; en `Save`: `currentLocationId String?` + relaciones. Backfill: saves existentes de Gorhorn → `hondonada-del-eco`.

**Migración 4 — NPCs y armería (§ 2–4):** modelos `Npc` (+ enum `NpcKind`), `ItemCatalog`, `NpcItem`, `HarvestYield`; relaciones inversas en `World`.

**Sin cambios en:** fórmulas de `timedActions.ts` (recibe mejor `base`), `CharacterTransit` (solo se amplía el shape JSON de `zoneContext`, sin migración), `InventoryItem`, tablas de XP/nivel, `LoreChunk` (solo filas nuevas de contenido).

**Seed:** `backend/src/scripts/worldCatalog.ts` + `npm run seed-catalog` (idempotente por `@@unique([worldId, slug])`, patrón upsert — mismo espíritu que `reindex-lore`).

---

## 6. Conflictos y decisiones que quedan para la usuaria

1. **Torgash = Kort'ikar del Clan Serhu (§ 2.3).** Es la fusión más económica del NPC ya existente con el clan ya existente y el gancho 6, y no contradice nada escrito — pero fija para siempre el clan de Torgash. Alternativa: hacerlo de un quinto clan nuevo (más trabajo, menos conexión con Gorhorn). **Propuesta: Serhu.**
2. ~~**La muerte del padre de Gorhorn y Torgash.** El padre murió retando al Kort'ikar Serhu de entonces...~~ — **decisión revisada 2026-08-03** (ampliación de la historia orca profunda, ver `areas.md` § Historia profunda): el padre de Gorhorn ya no muere en un duelo por el puesto de Kort'ikar Serhu al nacer Gorhorn. Vive hasta los 10 años de Gorhorn, lidera una revuelta contra el yugo Serhu, y muere cuando los Goirntes aniquilan al Clan Maktor en una incursión orquestada para desprestigiar a los Serhu (que se quedan mirando sin intervenir). Torgash pierde del todo la conexión personal con esa muerte — su ascenso sigue siendo "predecesor murió en el frente", sin más — y gana en su lugar el peso de la inacción de su clan durante la caída de los Maktor. Este punto deja de estar abierto: se resolvió con la usuaria, no queda como decisión pendiente.
3. **Nombres de canon nuevo:** Terk'ikar **Ulkha**, **Campamento del Clan Serhu**, y las 4 especies (**Corretolvas, Salvia del Polvo, Espiga Roja, Matorral de Cuerno**). Todo renombrable gratis hasta que se siembre e indexe.
4. **Plantillas: statline única vs. rango real (§ 2.4).** V1 propone números fijos por plantilla (máxima determinismo, mínima improvisación). Si jugando se siente repetitivo, la alternativa es 2-3 variantes fijas por plantilla ("soldado veterano/bisoño") — nunca stats aleatorios.
5. **Loot: ¿copiar todo el loadout o dejar elegir al jugador? (§ 4.5).** Decisión de UX para el momento de implementar; los datos no cambian.

---

## 7. Estado de implementación (actualizado 2026-07-18)

1. ~~**Migración 3** (posición)~~ — **hecho**: `Location`, `LocationLink`, `LocationVisit`, `Save.currentLocationId`. Backfill de la partida real de Gorhorn a `hondonada-del-eco` hecho vía `seed-catalog.ts`; además, `initialLocationSlugFor()` en `travel.ts` fija la ubicación inicial en **toda partida nueva** de Gorhorn (y en `/saves/:id/restart`), no solo como backfill puntual.
2. ~~**Seed del catálogo geográfico**~~ — **hecho**: `backend/src/scripts/worldCatalog.ts` (datos) + `backend/src/scripts/seed-catalog.ts` (runner, patrón `loreChunks.ts`/`reindex-lore.ts`) con los 6 nodos y 8 aristas del § 1.3, `npm run seed-catalog`.
3. ~~**Servicio de viaje**~~ — **hecho**: `backend/src/services/travel.ts` — normalizador, matcher de aliases, Dijkstra sobre `minutosBase`, derivación de banda por minutos, todo puro y sin IA.
4. ~~**Enganche al turno**~~ — **hecho**: `resolveTravel()` se llama en `/turn/classify` antes del clasificador; si resuelve, la clasificación es 100% determinista (sin tirada) y sobreescribe banda/duración. `zoneContext.travel` viaja tal cual a `CharacterTransit` y a `worldTick`. `narrateAndPersistTurn` (compartido entre turno síncrono y worker) actualiza `currentLocationId`, crea `LocationVisit` para destino + nodos intermedios, y emite el hito `descubrimiento` (50 XP) en la primera visita — respetando el tope de 1 hito/turno.
5. ~~**Bloque de posición en prompts**~~ — **hecho**: `turnResolution.ts` inyecta siempre `UBICACIÓN ACTUAL`/`DESDE AQUÍ SE PUEDE IR A` (o, en turno de viaje, `LLEGADA A...`/`RUTA RECORRIDA` con terreno y riesgo por tramo) — `weaklyGrounded` ahora también se apaga si hay bloque de posición/NPC/despiece.
6. ~~**Migración 4 + seed de contenido**~~ — **hecho**: `Npc` (+ enum `NpcKind`), `ItemCatalog`, `NpcItem`, `HarvestYield` con el contenido completo de § 2.3, 2.4, 3.1, 3.2, 4.3, 4.4 (39 objetos de catálogo, 8 NPCs, 15 filas de `HarvestYield`).
7. ~~**Inyección determinista de NPC en escena**~~ — **hecho**: `backend/src/services/npcScene.ts` — detección por alias en clasificación (línea de calibración de dificultad) y narración (bloque `PERSONAJE EN ESCENA` con personalidad + `LLEVA ENCIMA`). **Modo loot** (§ 4.5, decisión: copiar todo el loadout) implementado en `turnResolution.ts` — `newItem` se ignora cuando hay loot o despiece activo.
8. ~~**Despiece/recolección**~~ — **hecho**: `backend/src/services/harvest.ts` — matcher de especies, bloque de prompt, materialización de `InventoryItem` desde `HarvestYield` en éxito. *(Pendiente menor, no bloqueante: espiga roja y matorral de cuerno todavía no tienen una rama propia en `computeDuration`/`timedActions.ts` — hoy caen en el fallback genérico de banda, no en el patrón de leña ya existente.)*
9. ~~**Lore chunks nuevos**~~ — **hecho**: Torgash, Ulkha, Hagar (ampliado), Campamento Serhu, las 4 especies nuevas, y un gancho derivado ("acercarse al Campamento del Clan Serhu") — 9 fragmentos nuevos, corpus de 41→50, reindexado con `npm run reindex-lore`.
10. **Frontend** — **hecho lo esencial**: `MapaPanel`/`GameView` leen `Save.currentLocation`/`destinations` reales del backend (ya no hardcodeado) y muestran tiempos de viaje ya ajustados a destreza; `travel` viaja de `/turn/classify` a `/turn/narrate` en `api.ts`. **Pendiente, no bloqueante**: servir el catálogo completo de ubicaciones vía `GET /world/:id/locations` para que `frontend/src/data/map.ts` deje de duplicar a mano el mapa esquemático de regiones (el nivel de detalle de POI ya no depende de esa copia, pero el mapa SVG de regiones de Berig sigue siendo estático).
11. ~~Actualizar los .md afectados~~ — **hecho** (2026-07-18): `areas.md`, `npcs.md`, enlazado desde [11-roadmap-historico.md](archivo/11-roadmap-historico.md).

**Verificado en vivo (2026-07-18)** contra una partida desechable de prueba (creada y borrada en la misma sesión, sin tocar la partida real de la usuaria): crear partida → ubicación inicial correcta → `/turn/classify` resuelve "voy hacia el pozo a rellenar el odre" en 1.3s de forma 100% determinista (ruta, terreno, riesgo, banda `extendida` correctos) → `worldTick` resuelve el tránsito → `currentLocationId` actualizado, hito `descubrimiento` (+50 XP), narración anclada en el terreno real sin inventar nada → detección de NPC en escena (Torgash, calibración "Difícil" para la diferencia de nivel correcta; plantilla "patrulla de la concordia") → despiece de Corredor de Cauce y recolección de Salvia del Polvo con las cantidades/condiciones exactas del catálogo.

**Bug real encontrado y corregido durante la verificación**: el regex de detección de intención de viaje (`travel.ts`) no capturaba "voy **hacia**" (solo "voy a" literal) — una acción de viaje con esa redacción caía al flujo normal de clasificación con Ollama (~45s) en vez de resolverse de forma determinista e instantánea. Corregido a `voy (a|hacia)` + añadido "regreso a" a la lista.
