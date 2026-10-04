# Roadmap — El Cronista: historia viva de cada partida

**Creado:** 2026-10-01. **Estado:** diseño completo, listo para implementar por fases.
**Qué es:** el sistema que **registra todo lo que hace el personaje y todo lo que pasa en el mundo,
lo convierte en el lore de esa partida, hace que cada hecho persista e influya, y hace evolucionar
el mundo** (clima, naturaleza, diplomacia, nacimientos, muertes, caída y nacimiento de facciones…).
**De dónde viene:** desarrolla dos piezas ya señaladas en el diseño del mundo vivo
(`docs/rpgtarkor/sistemas-reino/mundo-vivo-x4-vision.md` § 1: *"el modelo que modifica y crea lore
mientras juegas"*, la única pieza nueva que faltaba) y el **punto 7 ya cerrado** de
`mundo-vivo-x4.md` (*motor de eventos unificado, función pura invocable desde el turno y desde
`worldTick.ts`, el LLM narra y nunca decide*).

**Convenio:** identificadores `CR-n` por tarea; **🧭** = decisión de Álvaro (cada una lleva un
**valor por defecto** para no bloquear la implementación: si no se dice nada, se implementa el
valor por defecto); esfuerzo **S** (horas) · **M** (1-2 días) · **L** (varios días).
**Hito de cada fase:** [mapa de roadmaps](21-roadmap.md#qué-entra-en-cada-hito) — Fases 1, 2, 3 y 5
en `0.2` (la 1 venía del `0.1` como 🧭; pasó al `0.2` el 2026-10-02, [plan del 0.2](plan-roadmap-0.2.md)), Fases 4 y 6 en `0.3`, Fase 7 en `0.4`, Fase 8 en `0.5`. Lo
que esto exige a la interfaz está en `roadmap-front.md` § 15 (`INT`) y en
`roadmap-front-ux.md` § 4.7.

---

## Índice
0. [Resumen en una página](#0-resumen-en-una-página)
1. [Referencias y qué tomamos de cada una](#1-referencias-y-qué-tomamos-de-cada-una)
2. [Principios y límites](#2-principios-y-límites)
3. [Lo que ya existe y cómo se reutiliza](#3-lo-que-ya-existe-y-cómo-se-reutiliza)
4. [Arquitectura](#4-arquitectura)
5. [Modelo de datos](#5-modelo-de-datos)
6. [Catálogo de sucesos](#6-catálogo-de-sucesos)
7. [El motor: reacciones, consecuencias, narrador de fondo](#7-el-motor-reacciones-consecuencias-narrador-de-fondo)
8. [Etiquetas, aprobación y memoria de personajes](#8-etiquetas-aprobación-y-memoria-de-personajes)
9. [Conocimiento y rumores](#9-conocimiento-y-rumores)
10. [La IA: Escriba, Árbitro y Cronista](#10-la-ia-escriba-árbitro-y-cronista)
11. [Memoria del narrador](#11-memoria-del-narrador)
12. [Canon y validación](#12-canon-y-validación)
13. [Reloj, cola y rendimiento](#13-reloj-cola-y-rendimiento)
14. [Lo que ve el jugador](#14-lo-que-ve-el-jugador)
15. [Herramientas de administración](#15-herramientas-de-administración)
16. [Migración de partidas existentes](#16-migración-de-partidas-existentes)
17. [Fases de implementación](#17-fases-de-implementación)
18. [Pruebas](#18-pruebas)
19. [Riesgos](#19-riesgos)
20. [Decisiones (con valor por defecto)](#20-decisiones-con-valor-por-defecto)
21. [Glosario](#21-glosario)
22. [Fuentes](#22-fuentes)

---

## 0. Resumen en una página

```
 Jugador actúa ─┐                      ┌─► Reacciones inmediatas (reglas)
 Mundo avanza ──┼─► LIBRO DE SUCESOS ──┼─► Consecuencias aplazadas (reglas)
 (clima, facc., │   (todo queda        ├─► Narrador de fondo diario (reglas + IA elige)
  población…)   │    apuntado, con     ├─► Buscadores de historias (patrones)
                │    causas)           ├─► Etiquetas, aprobación, recuerdos (reglas)
                │                      ├─► Conocimiento y rumores (reglas)
                │                      └─► Cronista (IA escribe crónica, biografías, leyendas)
                │                                     │
                └──────── Narrador del turno ◄────────┘ (memoria: verdad + recuerdos + crónica)
```

- **Simular → registrar → encontrar historias → contarlas → recordarlas.**
- **Las reglas deciden qué pasa y qué efectos tiene. La IA explica por qué, pone nombres y lo
  cuenta.** Nunca toca números.
- **Todo es por partida.** El catálogo escrito a mano es la semilla; cada partida guarda sus
  diferencias.
- **Nada depende de que la IA responda:** sin IA, el mundo sigue evolucionando y la crónica sale de
  plantillas.

---

## 1. Referencias y qué tomamos de cada una

| Referencia | Qué hace | Qué tomamos |
|---|---|---|
| **Baldur's Gate 3** (Larian, sistema Osiris) | Base de datos de hechos + reglas que **escuchan sucesos** y reaccionan con prioridad fija; consecuencias que aparecen **actos después** (salvar a los tieflings en el Acto 1 los trae a Last Light en el 3); **etiquetas** (raza, clase, origen) que cambian diálogos; **aprobación** de compañeros con valores propios; narrador-máster que refleja tus decisiones y **epílogo** que repasa lo que hiciste | Reacciones inmediatas (§ 7.1), **consecuencias aplazadas** (§ 7.2), etiquetas ganadas (§ 8.1), aprobación (§ 8.2), callbacks por entidad (§ 11), epílogo (§ 14) |
| **Dwarf Fortress** (modo Leyendas) | Cada suceso del mundo queda registrado; historia oculta hasta que alguien la descubre | Libro de Sucesos (§ 5) y conocimiento por suceso (§ 9) |
| **Caves of Qud** | Genera sucesos y **después los justifica** buscando patrones en lo ya ocurrido | El Árbitro justifica con hechos del Libro en vez de planificar (§ 10.2): fiable con modelos pequeños |
| **Story sifting** (James Ryan, Felt) | Patrones que detectan secuencias interesantes en un historial grande | Buscadores de historias e hilos (§ 7.4) |
| **RimWorld** | Narradores que eligen sucesos de un catálogo con pesos, enfriamientos y presupuesto de tensión | Narrador de fondo (§ 7.3) |
| **Crusader Kings 3** | Sucesos con condiciones y cadenas (*story cycles*) | Cadenas de sucesos; la agenda actual pasa a ser una (§ 7.3) |
| **Bannerlord / Kenshi** | Reino sin feudos se disuelve; muerto el líder la facción cae; los clanes se dispersan | Reglas de caída, escisión y absorción (§ 6) |
| **Shadow of Mordor** (Némesis) | Los enemigos recuerdan lo que les hiciste y vuelven cambiados | Recuerdos de NPC (§ 8.3) |
| **Valve** (Left 4 Dead, diálogo por reglas) | Miles de hechos uniformes consultados por reglas | Estado consultable (§ 4, capa 2) |
| **Generative Agents** (Stanford) | Memoria puntuada por recencia + importancia + relevancia, y **reflexiones** periódicas | Memoria del narrador (§ 11) y reflexiones del Cronista (§ 10.3) |
| **Wildermyth** | Cada personaje acumula su historia; leyendas que pasan entre campañas | Biografías vivas (§ 10.3), legado opcional (§ 20) |

---

## 2. Principios y límites

1. **Las reglas deciden, la IA cuenta.** Toda consecuencia mecánica sale de una regla en código
   con efectos de una lista cerrada (§ 7.5). La IA solo: elige entre opciones válidas, justifica
   con hechos registrados, rellena huecos de texto (nombres, motivos) y escribe.
2. **Todo deja rastro con su causa.** Ningún cambio del mundo ocurre sin un `Suceso` que lo
   explique y que enlace con sus causas.
3. **Por partida.** Lo que pasa en una partida no existe en otra.
4. **Determinista y reproducible.** Todo el azar usa semilla `(saveId, día, regla)`; dos ejecuciones
   con el mismo estado dan el mismo mundo.
5. **Sin IA no se rompe nada.** Cada tarea de IA tiene una alternativa de plantilla.
6. **El canon manda sobre la invención, la partida manda sobre el canon estático.** La IA nunca
   contradice `docs/canon-opencode/00-nucleo.md` ni los hechos protegidos; pero si en tu partida
   murió un NPC del catálogo, en tu partida está muerto.
7. **Nunca escribe en `docs/rpgtarkor/`.** Lo que merezca ser canon se exporta a
   `docs/borradores-opencode/propuestas-lore.md` para el runbook habitual (`AGENTS.md`).
8. **El turno del jugador nunca espera** al Cronista: todo lo que no sea el turno corre en segundo
   plano con menos prioridad.

**Fuera de alcance:** misiones secundarias generadas (se deja el gancho, § 7.5, pero no se
implementan aquí); razas, regiones, magia o especies nuevas; cambios en el combate.

---

## 3. Lo que ya existe y cómo se reutiliza

| Pieza actual | Archivo | Papel en el Cronista |
|---|---|---|
| Puntos del mapa por partida (plantilla + copia viva) | `zonePoints.ts` → `asegurarZonePointsDePartida` | **Patrón** para hacer por partida facciones, relaciones, población y expediciones |
| `NpcState` (por partida) | `schema.prisma` | Se amplía: muerte, cargo, lealtad (§ 5.2) |
| `Save.npcsRetiredForever` | `worldFacts.ts`, `npcScene.ts` | Se migra a `NpcState.muerto` |
| `Npc.muertoEnMundo` | `factionExpeditions.ts:408` | Deja de escribirse (era de mundo, rompía partidas) |
| `Faction` con `saveId?` | `schema.prisma` | Las de catálogo se clonan por partida; la del jugador ya es por partida |
| `FactionRelation` + `recordFactionEvent` + `stageFactFor` | `factionRelations.ts` | Emite sucesos; las frases quedan como plantilla de reserva |
| `worldAgenda.ts` (conflicto Serhu) | `worldAgenda.ts` | Primera **cadena** del narrador de fondo; cumple "Migrar `worldAgenda.ts`" del hito `0.1` |
| Expediciones | `factionExpeditions.ts` | Emiten sucesos; pasan a ser por partida |
| Población | `population.ts` | Emite nacimientos/declive; por partida |
| Economía de facción | `factionEconomy.ts` | Por partida; emite escasez/auge |
| Clima por región | `worldClock.ts` → `climaFor`, `calendarioFor` | Fuente de sucesos de clima (pura, determinista) |
| Reino del jugador | `dailyTick.ts`, `kingdomTick.ts` | Emiten rebelión, consolidación, hambre |
| Muerte del jugador | `death.ts` | Emite muerte, renacer, fin |
| Cadáveres y recuperación | `worldTick.ts` → `advanceCorpseAndRecoveryTimeouts` | Emiten desaparición/recuperación |
| `SessionFact` + `selectRelevantFacts` | `worldFacts.ts` | Se amplía la puntuación con importancia y se alimenta del Libro |
| `SessionSummary` + `chapterSummary.ts` | `chapterSummary.ts` | **Semilla del Cronista** (reclamo, programación diferida, antiduplicados) |
| `LoreChunk` + embeddings | `retrieval.ts`, `embeddings.ts` | Misma infraestructura vectorial para crónica y reflexiones |
| `NarrationResult` del narrador (`newFacts`, `newCompanion`…) | `narrador.ts` | Entrada del Escriba: se convierte en sucesos validados |
| `ollamaQueue` | `lib/ollamaQueue.ts` | Se le añaden prioridades (§ 13.2) |
| Nombres por idioma | `loreLanguages.ts`, `docs/canon-opencode/01-lenguas.md` | Base del generador de nombres (§ 12.3) |
| Canal `WORLD` / `KINGDOM` de `LogEntry` | `schema.prisma` | Rumores y noticias para el jugador |
| `HistoriaEntry`, Diario, Enciclopedia | front | Vista de Leyendas (§ 14) |
| Orquestador nube + captura de profesor | `aiProviders/orchestrator.ts`, `liveTeacherCapture.ts` | Opción nube para el Cronista y destilación futura |

---

## 4. Arquitectura

| Capa | Qué es | IA |
|---|---|---|
| **0 · Mundo de la partida** | Catálogo = semilla inmutable; cada partida guarda su estado (facciones, relaciones, población, NPC, expediciones) | No |
| **1 · Libro de Sucesos** | Registro que solo crece: tipo, actores, lugar, fecha, causas, efectos, importancia | No |
| **2 · Estado consultable** | Servicio `estadoDelMundo(saveId)`: líderes, muertos, guerras, territorios, etiquetas, aprobación | No |
| **3 · Motor** | Reacciones inmediatas, consecuencias aplazadas, narrador de fondo, efectos cerrados | No (salvo el Árbitro, que elige) |
| **4 · Buscadores de historias** | Patrones sobre el Libro → hilos | No |
| **5 · IA** | Escriba (tras turno), Árbitro (diario), Cronista (en huecos) | Sí |
| **6 · Memoria del narrador** | Verdad obligatoria + sucesos/crónica por relevancia + callbacks por entidad | Embeddings |
| **7 · Jugador** | Rumores, Leyendas, notificaciones, epílogo | No |

**Código nuevo** (todo en `backend/src/services/cronista/`, cada archivo con su test):

| Archivo | Contenido |
|---|---|
| `sucesos.ts` | Tipos, `registrarSuceso()`, cálculo de importancia |
| `efectos.ts` | Lista cerrada de efectos y su aplicación (§ 7.5) |
| `reacciones.ts` | Catálogo de reacciones (datos) + `ejecutarReacciones()` |
| `consecuencias.ts` | Programar, evaluar y disparar consecuencias aplazadas |
| `narradorFondo.ts` | Catálogo de sucesos de fondo + presupuesto de tensión + selección de candidatos |
| `cadenas.ts` | Cadenas de varios pasos (incluida la agenda Serhu migrada) |
| `historias.ts` | Patrones de búsqueda e hilos |
| `etiquetas.ts` | Reglas de etiquetas ganadas |
| `aprobacion.ts` | Valores de compañeros y reacción a sucesos |
| `conocimiento.ts` | Propagación y rumores |
| `estadoMundo.ts` | `estadoDelMundo(saveId)` y bloque de verdad obligatoria |
| `mundoPartida.ts` | `asegurarMundoDePartida(saveId)` (clonado perezoso) |
| `avanceDiario.ts` | Orquestador del día ficticio por partida (§ 13.1) |
| `ia/escriba.ts`, `ia/arbitro.ts`, `ia/cronista.ts` | Prompts, esquemas JSON, validación, alternativas |
| `nombres.ts` | Generador de nombres por lengua (§ 12.3) |
| `validacion.ts` | Cadena de validación de canon (§ 12) |

---

## 5. Modelo de datos

### 5.1 Modelos nuevos (borrador Prisma)

```prisma
/// Libro de Sucesos — todo lo que pasa en una partida, del jugador o del mundo. Solo crece.
model Suceso {
  id               String        @id @default(cuid())
  saveId           String
  save             Save          @relation(fields: [saveId], references: [id], onDelete: Cascade)
  tipo             String        /// clave del catálogo (§ 6), p. ej. "MUERTE_NPC"
  familia          FamiliaSuceso
  fictionalMinutes Int           /// cuándo ocurrió en la ficción
  regionSlug       String?
  locationId       String?
  importancia      Int           /// 1-10, por reglas (§ 6.3)
  origen           OrigenSuceso  /// JUGADOR | MUNDO | MOTOR | IA_PROPUESTA
  datos            Json          /// payload tipado por `tipo` (§ 6.2)
  texto            String        /// frase de plantilla, siempre presente (alternativa sin IA)
  textoNarrado     String?       /// versión del Cronista, si existe
  causas           SucesoCausa[] @relation("efecto")
  efectos          SucesoCausa[] @relation("causa")
  actores          SucesoActor[]
  conocimiento     Conocimiento[]
  logEntryId       String?       /// entrada del registro que lo originó, si la hay
  semilla          String        /// para reproducir el azar
  embedding        Unsupported("vector(768)")?
  createdAt        DateTime      @default(now())

  @@index([saveId, fictionalMinutes])
  @@index([saveId, tipo])
  @@index([saveId, importancia])
}

model SucesoCausa {
  causaId  String
  causa    Suceso @relation("causa", fields: [causaId], references: [id], onDelete: Cascade)
  efectoId String
  efecto   Suceso @relation("efecto", fields: [efectoId], references: [id], onDelete: Cascade)
  @@id([causaId, efectoId])
}

/// Quién participa y con qué papel. entidadTipo: PERSONAJE | NPC | COMPANERO | FACCION | REGION | LOCATION | TERRITORIO | EDIFICIO
model SucesoActor {
  sucesoId    String
  suceso      Suceso @relation(fields: [sucesoId], references: [id], onDelete: Cascade)
  entidadTipo String
  entidadId   String
  papel       String /// AUTOR | VICTIMA | TESTIGO | BENEFICIARIO | AFECTADO | LUGAR
  @@id([sucesoId, entidadTipo, entidadId, papel])
  @@index([entidadTipo, entidadId])
}

/// Consecuencias aplazadas (estilo Baldur's Gate 3).
model ConsecuenciaPendiente {
  id              String   @id @default(cuid())
  saveId          String
  origenSucesoId  String
  regla           String   /// clave en consecuencias.ts
  disparo         Json     /// condición: { tipo: "LLEGAR_REGION"|"DIAS"|"ENCUENTRO_NPC"|"SUCESO"|"ETIQUETA", ... }
  noAntesDe       Int      /// fictionalMinutes
  caducaEn        Int?     /// fictionalMinutes; si pasa, se descarta con un suceso CONSECUENCIA_PERDIDA
  datos           Json
  estado          String   @default("PENDIENTE") /// PENDIENTE | DISPARADA | CADUCADA | ANULADA
  @@index([saveId, estado])
}

/// Quién sabe qué (propagación de rumores).
model Conocimiento {
  sucesoId     String
  suceso       Suceso @relation(fields: [sucesoId], references: [id], onDelete: Cascade)
  sabeTipo     String /// JUGADOR | FACCION | REGION | NPC
  sabeId       String
  desdeMinutes Int
  @@id([sucesoId, sabeTipo, sabeId])
}

/// Hilos narrativos detectados por los buscadores.
model Hilo {
  id           String   @id @default(cuid())
  saveId       String
  patron       String   /// VENGANZA | ASCENSO | CAIDA | DEUDA | RIVALIDAD | ...
  estado       String   /// ABIERTO | AVANZANDO | CERRADO
  tension      Int      /// 0-10
  actores      Json
  sucesoIds    String[]
  resumen      String?  /// del Cronista
  abiertoEn    Int
  cerradoEn    Int?
  @@index([saveId, estado])
}

/// Lo que escribe el Cronista.
model CronicaEntrada {
  id            String   @id @default(cuid())
  saveId        String
  tipo          String   /// CRONICA_DIA | CRONICA_SEMANA | BIOGRAFIA | LEYENDA | RUMOR | REFLEXION | EPILOGO
  entidadTipo   String?  /// para BIOGRAFIA
  entidadId     String?
  desdeMinutes  Int
  hastaMinutes  Int
  titulo        String
  texto         String
  sucesoIds     String[]
  importancia   Int
  fuente        String   /// IA_LOCAL | IA_NUBE | PLANTILLA
  embedding     Unsupported("vector(768)")?
  createdAt     DateTime @default(now())
  @@index([saveId, tipo, desdeMinutes])
  @@index([saveId, entidadTipo, entidadId])
}

/// Etiquetas ganadas por el personaje (y por NPC/facciones si se quiere).
model Etiqueta {
  id          String  @id @default(cuid())
  saveId      String
  entidadTipo String  /// PERSONAJE | NPC | FACCION | COMPANERO
  entidadId   String
  clave       String  /// "VERDUGO_DE:torgash", "AMIGO_DE:helsig", "ROMPE_JURAMENTOS"
  texto       String  /// "Verdugo de Torgash"
  sucesoId    String
  desdeMinutes Int
  activa      Boolean @default(true)
  @@unique([saveId, entidadTipo, entidadId, clave])
}

/// Recuerdos de NPC (estilo Némesis) y aprobación de compañeros.
model Recuerdo {
  id          String @id @default(cuid())
  saveId      String
  npcId       String?
  companionId String?
  sobreTipo   String /// PERSONAJE | NPC | FACCION
  sobreId     String
  sucesoId    String
  sentimiento Int    /// -10..+10
  @@index([saveId, npcId])
  @@index([saveId, companionId])
}

enum FamiliaSuceso { CLIMA NATURAL VIDA_MUERTE DIPLOMACIA FACCION ECONOMIA REINO JUGADOR LORE SISTEMA }
enum OrigenSuceso { JUGADOR MUNDO MOTOR IA_PROPUESTA }
```

### 5.2 Cambios en modelos existentes

| Modelo | Cambio | Motivo |
|---|---|---|
| `Faction` | `@@unique([worldId, slug])` → índice único parcial `(worldId, slug) WHERE saveId IS NULL` + `(saveId, slug) WHERE saveId IS NOT NULL`; nuevo `origenSlug String?` (de qué facción de catálogo es copia, o de cuál se escindió), `disueltaEn Int?`, `fundadaEn Int?`, `cohesion Int @default(70)` | Clonar por partida; caída, escisión y fundación |
| `FactionRelation` | Sin cambio de esquema: al colgar de facciones clonadas, ya es por partida. Se añade `saveId String?` solo como índice de consulta | Por partida |
| `WorldPopulation` | `saveId String?`; único `(saveId, targetType, targetSlug)` para filas de partida | Por partida |
| `Expedicion` | `saveId String?` | Por partida |
| `Npc` | `saveId String?` (NPC nacidos en la partida); único parcial como en `Faction` | Nacimientos, sucesores, líderes nuevos |
| `NpcState` | `muerto Boolean @default(false)`, `muertoEn Int?`, `cargo String?` (p. ej. `LIDER:<factionId>`), `lealtadFaccionId String?` | Muertes y cargos por partida |
| `Companion` | `valores Json @default("{}")` (p. ej. `{ "piedad": 2, "honor": 1, "codicia": -1 }`), `aprobacion Int @default(50)` | Aprobación |
| `WorldState` | `ultimoDiaSimulado Int @default(0)`, `presupuestoTension Int @default(0)`, `estiloNarrador String @default("EQUILIBRADO")`, `mundoClonadoEn DateTime?` | Avance diario por partida |
| `Save.npcsRetiredForever` | Se migra a `NpcState.muerto` y se deja de leer | Fuente única |
| `Npc.muertoEnMundo` | Se deja de escribir; lectura solo para filas sin partida | Era de mundo |

### 5.3 Clonado por partida (`mundoPartida.ts`)

`asegurarMundoDePartida(tx, saveId)` — perezoso e idempotente, mismo patrón que
`asegurarZonePointsDePartida`:
1. Si `WorldState.mundoClonadoEn` existe, no hace nada.
2. Clona las `Faction` de catálogo (`saveId` null) del mundo → filas con `saveId` y `origenSlug`.
   Remapea `liderNpcId` (sigue apuntando al `Npc` de catálogo; su estado vive en `NpcState`).
3. Clona `FactionRelation` entre facciones de catálogo → entre sus copias.
4. Clona `KingdomStats`, `Territory`, `Building` de facción a las copias.
5. Clona `WorldPopulation` → filas con `saveId`.
6. Marca `mundoClonadoEn`.
7. Emite el suceso `SISTEMA_MUNDO_INICIADO` (importancia 1).

Se llama al crear una partida y, por seguridad, al inicio de `narrateAndPersistTurn` y de
`avanceDiario`. **Todo el juego lee solo filas de su partida** (como ya hace `ZonePoint`).

---

## 6. Catálogo de sucesos

### 6.1 Familias y tipos iniciales

Cada tipo tiene: clave, familia, importancia base, actores, `datos` tipados, frase de plantilla y
alcance de conocimiento inicial (§ 9). Lista inicial (ampliable como datos):

| Familia | Tipos |
|---|---|
| **JUGADOR** | `ACCION_RELEVANTE`, `COMBATE_GANADO`, `COMBATE_PERDIDO`, `MUERTE_CAUSADA`, `PERDON_CONCEDIDO` (dejar vivir/clemente), `CAPTURA`, `PROMESA`, `PROMESA_CUMPLIDA`, `PROMESA_ROTA`, `REGALO` (entregar), `ROBO`, `MISION_COMPLETADA`, `MISION_FALLIDA`, `DESCUBRIMIENTO`, `OFICIO_APRENDIDO`, `MUERTE_JUGADOR`, `RENACER`, `FIN_PARTIDA` |
| **VIDA_MUERTE** | `NACIMIENTO_NOTABLE` (NPC con nombre), `MUERTE_NPC`, `MUERTE_LIDER`, `SUCESION`, `HEREDERO_DESIGNADO`, `RECUPERACION_NPC`, `CADAVER_DESAPARECE` |
| **DIPLOMACIA** | `CAMBIO_RELACION` (de `recordFactionEvent`), `GUERRA_DECLARADA`, `TREGUA`, `ALIANZA`, `TRATADO_COMERCIAL`, `RUPTURA`, `SABOTAJE`, `ESPIONAJE`, `ESCARAMUZA` (CR-12) |
| **FACCION** | `FACCION_CAE`, `FACCION_ESCINDIDA`, `FACCION_FUNDADA`, `FACCION_ABSORBIDA`, `CAMBIO_LIDER`, `TERRITORIO_CONQUISTADO`, `TERRITORIO_PERDIDO`, `EXPEDICION_SALE`, `EXPEDICION_INTERCEPTADA`, `EXPEDICION_VUELVE`, `MALESTAR_INTERNO` (CR-12) |
| **CLIMA** | `TORMENTA`, `TORMENTA_EXTREMA`, `CAMBIO_ESTACION`, `SEQUIA`, `OLA_FRIO` |
| **NATURAL** | `MIGRACION_FAUNA`, `PLAGA`, `INCENDIO`, `CRECIDA`, `DESPRENDIMIENTO`, `AUGE_POBLACION`, `DECLIVE_POBLACION` |
| **ECONOMIA** | `ESCASEZ`, `AUGE_COMERCIAL`, `CARAVANA`, `PRECIOS_DISPARADOS` |
| **REINO** | `REINO_FUNDADO`, `EDIFICIO_CONSTRUIDO`, `EDIFICIO_DANADO`, `REBELION`, `CONSOLIDACION`, `HAMBRUNA`, `LLEGADA_POBLADORES`, `VISITANTE_ILUSTRE` |
| **LORE** | `HALLAZGO_RUINA`, `HALLAZGO_DOCUMENTO` (enlaza `HistoriaEntry`), `LEYENDA_NACE` (una hazaña se convierte en leyenda) |
| **SISTEMA** | `SISTEMA_MUNDO_INICIADO`, `CONSECUENCIA_PERDIDA`, `HILO_ABIERTO`, `HILO_CERRADO` |

Los sucesos `NATURAL`, `CLIMA` y `ECONOMIA` solo usan regiones, fauna y recursos **ya existentes
en el catálogo**; ninguno inventa especies ni lugares.

### 6.2 Contrato de registro

```ts
// services/cronista/sucesos.ts
export interface NuevoSuceso<T extends TipoSuceso = TipoSuceso> {
  saveId: string
  tipo: T
  fictionalMinutes: number
  regionSlug?: string | null
  locationId?: string | null
  actores: { entidadTipo: EntidadTipo; entidadId: string; papel: Papel }[]
  datos: DatosSuceso[T]            // tipado por tipo
  causas?: string[]                // ids de sucesos previos
  origen: OrigenSuceso
  logEntryId?: string
}

/// Única puerta de entrada. Dentro de la transacción del llamador:
/// 1. calcula importancia y texto de plantilla, 2. inserta Suceso + actores + causas,
/// 3. siembra Conocimiento inicial (§ 9), 4. encola reacciones (se ejecutan al final del turno/día,
///    nunca recursivamente dentro de la misma llamada), 5. devuelve el id.
export async function registrarSuceso(tx: Tx, s: NuevoSuceso): Promise<string>
```

**Profundidad de cascada:** las reacciones de un suceso pueden registrar sucesos nuevos, que a su
vez tienen reacciones. Se procesan en anchura con un **tope de 3 niveles y 20 sucesos por
cascada**; lo que supere el tope se convierte en consecuencia aplazada para el día siguiente.

### 6.3 Importancia (1-10, por reglas)

| Base | Ejemplos |
|---|---|
| 1-2 | Clima normal, expedición sale, recuperación de un NPC plantilla |
| 3-4 | Combate ganado contra plantilla, tormenta grande, descubrimiento, edificio construido |
| 5-6 | Muerte de un NPC con nombre, tregua, escasez, tormenta extrema, promesa |
| 7-8 | Muerte de un NPC principal, guerra declarada, territorio conquistado, rebelión, reino fundado |
| 9-10 | Muerte de un líder, caída, escisión o fundación de facción, muerte o fin del jugador |

Modificadores: **+1** si el jugador es AUTOR; **+1** si afecta a un NPC con `nucleoJugable`;
**+1** si cierra o abre un hilo; tope 10.

---

## 7. El motor: reacciones, consecuencias, narrador de fondo

### 7.1 Reacciones inmediatas (estilo Osiris)

```ts
// services/cronista/reacciones.ts — datos, no lógica dispersa
export interface Reaccion {
  id: string                            // "LIDER_MUERE_ABRE_SUCESION"
  escucha: TipoSuceso[]                 // ["MUERTE_LIDER"]
  prioridad: number                     // menor = antes; orden estable
  condicion: (ctx: CtxReaccion) => boolean
  efectos: (ctx: CtxReaccion) => Efecto[]   // solo efectos de la lista cerrada (§ 7.5)
}
```

Reacciones iniciales (cada una con test):

| Escucha | Condición | Efectos |
|---|---|---|
| `MUERTE_CAUSADA` por el jugador | La víctima pertenece a una facción | `cambiarPresion(facción víctima → facción del jugador, BAJA_DE_GUERRA)`; `recuerdo(testigos, jugador, -6)`; etiqueta si es NPC con nombre |
| `MUERTE_NPC` | El NPC es líder (`Faction.liderNpcId`) | Registrar `MUERTE_LIDER` |
| `MUERTE_LIDER` | — | `cohesion -= 25`; programar consecuencia `SUCESION_PENDIENTE` (1-3 días) |
| `PERDON_CONCEDIDO` | La víctima sobrevive | `recuerdo(víctima, jugador, +5)`; programar `DEUDA_DE_VIDA` (§ 7.2) |
| `PROMESA` | — | Programar `PROMESA_VENCE` con caducidad |
| `TERRITORIO_CONQUISTADO` | La facción perdedora se queda sin territorios | Registrar `FACCION_CAE` |
| `TORMENTA_EXTREMA` | Hay edificios del jugador en la región | `danarEdificio` (con tirada); `moverPoblacion(fauna, región vecina)` |
| `HAMBRUNA` | 3 días seguidos | `cohesion -= 10` del reino; probabilidad de `REBELION` |
| `CAMBIO_RELACION` a `GUERRA` | — | Registrar `GUERRA_DECLARADA`; subir riesgo de expediciones |
| Cualquier suceso con el jugador como AUTOR | — | Evaluar etiquetas (§ 8.1) y aprobación (§ 8.2) |

### 7.2 Consecuencias aplazadas (la pieza clave de Baldur's Gate 3)

```ts
// services/cronista/consecuencias.ts
export interface ReglaConsecuencia {
  id: string                                  // "DEUDA_DE_VIDA"
  disparo: Disparo                            // cuándo puede dispararse
  efectos: (ctx: CtxConsecuencia) => Efecto[] // qué pasa entonces
  caducaDias?: number
}
type Disparo =
  | { tipo: 'DIAS'; min: number; max: number }
  | { tipo: 'LLEGAR_REGION'; regionSlug: string | 'CUALQUIERA_SALVO_ORIGEN' }
  | { tipo: 'ENCUENTRO_NPC'; npcId: string }
  | { tipo: 'SUCESO'; tipos: TipoSuceso[]; con?: Record<string, unknown> }
  | { tipo: 'ETIQUETA'; clave: string }
```

`evaluarConsecuencias(saveId, momento)` se llama: al final de cada turno, al entrar en una
`Location`, al cruzar un día y en cada encuentro de zona. Usa índices por `estado` y tipo de
disparo para que sea barato.

Consecuencias iniciales:

| Id | Origen | Disparo | Efecto |
|---|---|---|---|
| `DEUDA_DE_VIDA` | Perdonar a un NPC | `LLEGAR_REGION` distinta, 3-20 días | El NPC aparece (punto de zona) como aliado/mercader con oferta especial, o ayuda en el siguiente combate |
| `VENGANZA_PARIENTE` | Matar a alguien con pariente o testigo | `ENCUENTRO_NPC` o `DIAS 5-15` | El vengador aparece en la ruta del jugador (punto agresivo con recuerdo) |
| `PROMESA_VENCE` | Promesa | `DIAS` | Si no se cumplió: `PROMESA_ROTA`, etiqueta `ROMPE_JURAMENTOS` si se repite |
| `PUEBLO_ABANDONADO` | No ayudar en una crisis local (hambruna, ataque) | `LLEGAR_REGION` de origen | Precios peores y NPC hostiles en ese lugar |
| `SUCESION_PENDIENTE` | Muerte de un líder | `DIAS 1-3` | El narrador de fondo ofrece Sucesión / Escisión / Absorción (§ 7.3) |
| `REFUGIADOS` | Facción caída | `DIAS 2-6` | Población se mueve a regiones vecinas; llegada de pobladores al Reino si hay vivienda |
| `RUMOR_DE_HAZANA` | Suceso del jugador con importancia ≥ 7 | `LLEGAR_REGION` donde ya se sabe | NPC comentan la hazaña; puede abrir `LEYENDA_NACE` |

### 7.3 Narrador de fondo (estilo RimWorld + cadenas de CK3)

Se ejecuta **una vez por día ficticio y partida** (`avanceDiario`, § 13.1):

1. **Candidatos:** recorre el catálogo de sucesos de fondo (`narradorFondo.ts`); cada entrada:
   `{ tipo, familia, condicion(estado), peso(estado), enfriamientoDias, coste }`.
2. **Presupuesto de tensión** (`WorldState.presupuestoTension`): crece cada día según el estilo
   (`EQUILIBRADO` +3/día, `TRANQUILO` +1, `CAOTICO` +5); cada suceso cuesta según su importancia;
   el día de mucha actividad del jugador gasta presupuesto (para no ahogarlo).
3. **Selección:** se eligen por peso con semilla los **2-4 candidatos** que caben en el
   presupuesto, respetando enfriamientos y **favoreciendo continuar hilos abiertos** (peso ×2).
4. **Árbitro (IA, opcional):** elige uno de esos candidatos y justifica (§ 10.2). Sin IA, gana el
   de más peso.
5. **Aplicación:** efectos cerrados + `registrarSuceso`.

**Cadenas:** sucesos de varios pasos con estado (p. ej. guerra: tensión → escaramuzas → guerra →
desgaste → tregua o caída). La agenda Serhu (`worldAgenda.ts`) se reescribe como la primera
cadena; sus `STAGE_FACTS` pasan a ser los textos de plantilla de cada paso.

**Reglas de facción** (Bannerlord/Kenshi):
- **Caída:** sin territorios **o** población 0 **o** líder muerto sin sucesor tras `SUCESION_PENDIENTE`
  y cohesión < 20 → `FACCION_CAE`: relaciones se eliminan, población a refugiados, NPC sin facción.
- **Escisión:** líder muerto **y** cohesión 20-50 **y** población ≥ 2 grupos → `FACCION_ESCINDIDA`:
  nace una facción nueva (`origenSlug` = la antigua) con parte de la población y un NPC como líder.
- **Fundación:** escisión, o el jugador funda su reino (ya existe), o refugiados que se asientan
  (población ≥ umbral en una región sin dueño de su raza).
- **Absorción:** facción débil (cohesión < 30) en alianza con una fuerte → la fuerte la absorbe.

**Nacimientos:** cuando la población de una raza en una región cruza un múltiplo de N (p. ej. cada
+10), `NACIMIENTO_NOTABLE` crea un `Npc` PLANTILLA→individuo con `saveId`, nombre generado
(§ 12.3), padres o clan de origen, y entra en la cola de candidatos a líder o recolector.

### 7.4 Buscadores de historias

Patrones (consultas sobre `Suceso` + `SucesoActor`, puras y con test):

| Patrón | Detecta | Abre hilo con |
|---|---|---|
| `VENGANZA` | A causa muerte de B; C es pariente o testigo de B y sigue vivo | Tensión según importancia de la muerte |
| `ASCENSO` | Un NPC sin cargo pasa a líder o funda facción | — |
| `CAIDA` | Una facción pierde ≥ 2 territorios o su líder en 10 días | — |
| `DEUDA` | Perdón o regalo sin devolver | — |
| `RIVALIDAD` | Dos actores enfrentados ≥ 3 veces | — |
| `REDENCION` | Etiqueta negativa seguida de 2+ sucesos positivos hacia el mismo grupo | — |

Los hilos alimentan: el peso del narrador de fondo, la memoria del narrador y los temas del
Cronista. Un hilo se cierra cuando ocurre su desenlace (muerte del vengador, venganza cumplida,
etc.) y genera `HILO_CERRADO`.

### 7.5 Lista cerrada de efectos

Cada efecto es una función en `efectos.ts` que valida, aplica y **registra su propio suceso**:

`cambiarPresion` · `matarNpc` · `crearNpc` · `asignarCargo` · `crearFaccion` · `disolverFaccion` ·
`absorberFaccion` · `cambiarLider` · `cambiarCohesion` · `moverPoblacion` · `ajustarPoblacion` ·
`danarEdificio` · `repararEdificio` · `cambiarControlTerritorio` · `crearPuntoZona` /
`retirarPuntoZona` · `ajustarPrecios` · `programarConsecuencia` · `anularConsecuencia` ·
`anadirEtiqueta` / `quitarEtiqueta` · `cambiarAprobacion` · `anadirRecuerdo` ·
`propagarConocimiento` · `abrirHilo` / `cerrarHilo` · `ofrecerMision` *(gancho, sin implementar)*.

Ninguna IA puede llamar a un efecto directamente: la IA devuelve una **elección y textos**; el
motor traduce eso a efectos.

---

## 8. Etiquetas, aprobación y memoria de personajes

### 8.1 Etiquetas ganadas

Reglas en `etiquetas.ts` evaluadas tras cada suceso con el jugador como AUTOR:

| Etiqueta | Regla |
|---|---|
| `VERDUGO_DE:<npc>` | El jugador causa la muerte de un NPC con nombre |
| `AMIGO_DE:<facción>` / `ENEMIGO_DE:<facción>` | Relación o reputación cruza umbral alto/bajo |
| `ROMPE_JURAMENTOS` | 2+ `PROMESA_ROTA` |
| `CLEMENTE` | 3+ `PERDON_CONCEDIDO` |
| `CARNICERO` | 5+ muertes de rendidos o convalecientes |
| `SALVADOR_DE:<lugar>` | Resolver una crisis local |
| `FUNDADOR` | Reino fundado |
| `CAZADOR_TEMIDO` | X cazas de fauna peligrosa |

Uso: el narrador las recibe en el bloque de verdad obligatoria; las reacciones de NPC y las
condiciones del motor las consultan; el front las muestra en la ficha del personaje. Una etiqueta
negativa puede **desactivarse** por un patrón `REDENCION`.

### 8.2 Aprobación de compañeros

- `Companion.valores`: 3-5 valores con peso (-2..+2) — `piedad`, `honor`, `codicia`,
  `lealtad_clan`, `crueldad`, `prudencia`. Se siembran por compañero a partir de `Npc.personality`
  (tabla manual para los existentes; regla por defecto para los nuevos).
- Cada tipo de suceso del jugador tiene un vector de valores (p. ej. `PERDON_CONCEDIDO`:
  `piedad +2, crueldad -2`). `aprobacion += Σ valor × peso`, acotado 0-100.
- Umbrales: **< 20** → se niega a combatir a tu lado o a ciertas órdenes; **< 10** con 3 días
  seguidos → `COMPANERO_SE_VA`; **> 80** → desbloquea una escena (oferta de modo dinámico).
- Reacción visible en el registro: "Kaila frunce el ceño." (plantilla por valor), como el aviso de
  aprobación de BG3.

### 8.3 Recuerdos de NPC (Némesis)

- `Recuerdo` por NPC sobre el jugador u otros, enlazado a su suceso, con sentimiento.
- Se usan en: reacciones (un NPC con recuerdo muy negativo pasa a hostil), el narrador (bloque de
  "lo que este NPC recuerda de ti" al aparecer, § 11), el modo dinámico (opciones distintas) y
  consecuencias (`VENGANZA_PARIENTE`).
- NPC que sobrevive a un combate contra el jugador: recuerdo + posible cambio (nivel +1, etiqueta
  "Superviviente de Gorhorn") → al volver a aparecer, el narrador lo sabe.

---

## 9. Conocimiento y rumores

Al registrar un suceso se siembra `Conocimiento` inicial y luego se propaga cada día
(`conocimiento.ts`):

| Importancia | Quién lo sabe al instante | Propagación |
|---|---|---|
| 1-3 | Testigos y actores | Nunca se propaga |
| 4-6 | + facciones de los actores | Región: +2 días |
| 7-8 | + región | Regiones vecinas: +2 días |
| 9-10 | + región | Todo Berig: +5 días |

**El jugador** sabe un suceso si: es actor o testigo; está en una región que lo sabe y pasa un día
allí; habla con un NPC de una facción que lo sabe (modo dinámico); o encuentra un documento. Al
saberlo:
- se crea una entrada `WORLD` de tipo rumor ("Se dice en las Llanuras que…");
- aparece en **Leyendas** (§ 14);
- desde ese momento puede llegar a la memoria del narrador como "algo que el personaje sabe".

El narrador **nunca** recibe como sabido algo que el personaje no sabe (evita que filtre
información); sí puede recibir "lo que este NPC sabe" para sus diálogos.

---

## 10. La IA: Escriba, Árbitro y Cronista

Todos usan `ollamaGenerate` con `format` JSON (como `classifyAction`, el modo dinámico y el combate
múltiple), pasan por la cola con prioridad (§ 13.2) y tienen alternativa sin IA.

### 10.1 Escriba (tras cada turno)

| | |
|---|---|
| **Cuándo** | Al terminar `narrateAndPersistTurn`, fuera de la transacción del turno |
| **Modelo** | `ollamaModelCronista` (qwen2.5 1.5B), `temperature: 0`, `keepAlive: '0'` |
| **Prioridad** | P1 |
| **Entrada** | Acción del jugador, narración final, `NarrationResult` (`newFacts`, `newCompanion`, `newTerritory`, `newBuilding`, `newSubject`, `newQuest`, `questProgress`, `combateIniciado`, `condicionFisica`), NPC en escena con ids, ubicación |
| **Salida (JSON)** | `{ sucesos: [{ tipo, actores: [{ nombre, papel }], datos }] }` con `tipo` restringido al enum de familia `JUGADOR` |
| **Validación** | Nombres → ids contra NPC en escena / catálogo / `NpcState` (si no resuelve, se descarta); tipo válido; sin duplicar sucesos ya registrados por código en el mismo turno |
| **Alternativa** | Solo los sucesos que el código ya registra de forma determinista (muertes, combates, misiones, construcción, entrega, captura, perdón) |

**Importante:** los sucesos con efecto mecánico del turno (muerte, combate, misión, construcción,
fundación) **los registra el código del turno directamente**, no el Escriba. El Escriba solo
añade lo que únicamente está en el texto: promesas, amenazas, regalos dichos, descubrimientos
narrados. Las creaciones del narrador (`newCompanion`, `newTerritory`…) pasan a registrarse como
suceso `IA_PROPUESTA` a través de los mismos efectos, sin cambiar su comportamiento actual
(🧭 D-6 para endurecerlo).

### 10.2 Árbitro (una vez por día ficticio)

| | |
|---|---|
| **Cuándo** | En `avanceDiario`, si hay ≥ 2 candidatos del narrador de fondo y la cola está libre |
| **Modelo** | `ollamaModelNarrador`, `temperature: 0.4` |
| **Prioridad** | P2 |
| **Entrada** | 2-4 candidatos `{ id, tipo, descripcion, actoresPosibles }`; los 15 sucesos más importantes de los últimos 14 días; hilos abiertos; etiquetas del jugador |
| **Salida (JSON)** | `{ elegido: id, justificacion: string, sucesosCitados: string[], huecos: { nombre?: string, motivo?: string, … } }` |
| **Validación** | `elegido` ∈ candidatos; cada id de `sucesosCitados` existe en la partida; nombres pasan por el generador/validador de nombres (§ 12.3); justificación ≤ 300 caracteres y sin entidades desconocidas |
| **Alternativa** | El candidato de más peso; justificación de plantilla; nombre del generador |

La justificación se guarda en `Suceso.datos.justificacion` y las citas como `SucesoCausa`: así el
"por qué" queda enlazado de verdad (Caves of Qud).

### 10.3 Cronista (en huecos)

| | |
|---|---|
| **Cuándo** | Cola vacía y sin turno en curso: al cruzar un día (crónica del día), cada 7 días (crónica de semana + reflexiones), tras sucesos ≥ 8 (biografía de los implicados), al cerrar un hilo (leyenda), al terminar la partida (epílogo) |
| **Modelo** | `ollamaModelNarrador` (local) por defecto; nube opcional (🧭 D-4) vía `completeWithFallback` |
| **Prioridad** | P3 |
| **Entrada** | Sucesos del periodo **que el jugador conoce** (o todos, si es biografía de algo conocido), con textos de plantilla; entidades implicadas; estilo; reglas de canon resumidas |
| **Salida (JSON)** | `{ titulo, texto, sucesoIds }` para crónica/biografía/leyenda; `{ reflexiones: [{ texto, importancia, sucesoIds }] }` para reflexiones |
| **Validación** | § 12 completa; longitud (crónica de día ≤ 900 caracteres); ninguna entidad fuera de los sucesos dados |
| **Alternativa** | Concatenación de los textos de plantilla en orden, con conectores ("Ese mismo día…") |

**Reflexiones** (Generative Agents): cada 7 días el Cronista recibe los sucesos importantes de la
semana y propone 1-3 ideas de alto nivel ("En los clanes se dice que Gorhorn no perdona"). Se
guardan como `CronicaEntrada` tipo `REFLEXION` con importancia y embedding, y entran en la memoria
del narrador.

**Epílogo:** al `FIN_PARTIDA`, el Cronista recorre personajes, facciones y lugares con sucesos y
escribe qué fue de cada uno (estilo epílogo de BG3). Alimenta la pantalla de epílogo (`UX-18`).

---

## 11. Memoria del narrador

En `turnResolution.ts`, donde hoy se montan `contextBlocks` y se llama a `selectRelevantFacts`:

1. **Verdad obligatoria** (`estadoMundo.bloqueVerdad(saveId, escena)`, generado por código, nunca
   por IA, ≤ 600 caracteres): muertos relevantes de la escena, líderes actuales de las facciones
   presentes, guerras activas en la región, etiquetas del personaje, aprobación de compañeros
   presentes.
2. **Callbacks por entidad** (BG3): por cada NPC, facción o lugar de la escena, los 3 sucesos más
   importantes que lo implican **y que el personaje conoce**, más los recuerdos del NPC sobre el
   personaje.
3. **Memoria por relevancia** (Generative Agents): sobre `Suceso` + `CronicaEntrada` +
   `SessionFact`, puntuación `0,3·recencia + 0,3·importancia + 0,4·relevancia` (recencia con
   decaimiento por días ficticios), con el mismo tope de envío que hoy (10 elementos).
4. **Hilos abiertos** que tocan a algún actor de la escena (1 línea cada uno).

Presupuesto total del bloque: ≤ 1.800 caracteres, para no crecer el prompt frente a hoy más de lo
que el contexto de 8192 admite (decisión técnica 9).

---

## 12. Canon y validación

### 12.1 Cadena de validación (`validacion.ts`)
1. **Esquema JSON** (con `format` de Ollama y comprobación en código).
2. **Integridad:** toda entidad nombrada existe en la partida o es nueva y pasa por el generador
   de nombres; todo id citado existe.
3. **Hechos protegidos** (`protectedFacts.ts`) y **verdad obligatoria**: no se contradicen (p. ej.
   no se puede narrar vivo a un muerto).
4. **Reglas duras de canon** (`docs/canon-opencode/00-nucleo.md`), traducidas a comprobaciones:
   sin razas nuevas, sin magia sin explicación, solo regiones existentes, sin nombres de especies
   o plantas reales (lista de bloqueo), enums reales.
5. **Duplicados:** similitud con sucesos y crónicas recientes (`similarity` de `worldFacts.ts`) por
   encima de umbral → descartar.
6. **Si falla cualquier paso:** se usa la alternativa de plantilla y se registra el fallo para la
   herramienta de administración.

### 12.2 Límites de creación (por defecto, 🧭 D-3)
- **Sí:** NPC con nombre (nacimientos, sucesores, líderes, vengadores), facciones nuevas
  **solo** por escisión o asentamiento de refugiados de razas existentes, rumores, leyendas,
  biografías.
- **No:** razas, regiones, lugares de mapa, especies, objetos de catálogo, magia, dioses.

### 12.3 Generador de nombres (`nombres.ts`)
- Determinista con semilla; construye nombres combinando las raíces del diccionario de
  `docs/canon-opencode/01-lenguas.md` por lengua de la raza (Kektira, Feg, Naebius, Kerost,
  Sirikel) y los patrones de `loreLanguages.ts`.
- Facciones nuevas: patrón por raza ("Clan <raíz>", etc.) tomando el nombre del fundador o del
  lugar.
- La IA puede **proponer** un nombre; si no pasa el validador (raíces, longitud, no repetido, no
  real), se usa el del generador.

### 12.4 Promoción a canon
Script `npm run exportar-leyendas -- <saveId>` que vuelca a
`docs/borradores-opencode/propuestas-lore.md` las leyendas, facciones y personajes nuevos de una
partida, con el formato de entrada que pide `AGENTS.md` (fecha, tema, `SIN REVISAR`, qué archivos
tocaría). **Nunca** escribe en `docs/rpgtarkor/`.

---

## 13. Reloj, cola y rendimiento

### 13.1 Avance diario por partida (`avanceDiario.ts`)
- **El mundo de una partida avanza con el reloj de esa partida** (`WorldState.fictionalMinutes`),
  no con el tiempo real. Coherente con la decisión 4 de `mundo-vivo-x4.md` (el Reino ya va atado
  al turno) y con `Save.pausedAt`.
- `avanzarMundoHasta(saveId, fictionalMinutes)`: si `dia(fictionalMinutes) > WorldState.ultimoDiaSimulado`,
  simula cada día pendiente **en orden**, con tope de 30 días por llamada (viajes muy largos se
  completan en llamadas sucesivas). Por día:
  1. clima (sucesos de `climaFor` por región al cambiar de estado);
  2. población, economía y expediciones de facción **de la partida** (las funciones actuales,
     adaptadas a `saveId`);
  3. Reino del jugador (`dailyTick` ya existente);
  4. consecuencias con disparo `DIAS`;
  5. narrador de fondo (+ Árbitro si hay IA libre; si no, decisión determinista);
  6. propagación de conocimiento;
  7. buscadores de historias;
  8. encola Cronista (P3).
- **Quién lo llama:** `narrateAndPersistTurn` (ya detecta `daysCrossed`), la resolución de
  tránsitos de `worldTick.ts` y el movimiento por zona (que avanza 1 min por paso).
- **`worldTick.ts`** se queda con lo que es de tiempo real: resolver tránsitos, supervivencia del
  personaje y compañeros, timeouts de cadáveres. Las funciones de mundo (`growAllPopulations`,
  `advanceFactionEconomy`, `advanceFactionExpeditions`, `advanceWorldAgenda`) dejan de recorrer
  mundos y pasan a ser pasos de `avanceDiario` por partida. (🧭 D-1)

### 13.2 Cola con prioridades (`lib/ollamaQueue.ts`)
- `enqueue(task, { prioridad: 0|1|2|3, timeoutMs })`: cola de prioridad; P0 = turno (narrador,
  clasificación, modo dinámico, combate), P1 = Escriba, P2 = Árbitro, P3 = Cronista.
- Una tarea P2/P3 **no empieza** si hay alguna P0 esperando; una P3 en curso no se corta (no hay
  cancelación fiable en Ollama), por eso las P3 se limitan a ≤ 400 tokens de salida.
- Se mantiene el guard anti-zombie actual por tarea.

### 13.3 Presupuestos
| Tarea | Frecuencia | Tokens salida | Tiempo esperado en Steam Deck |
|---|---|---|---|
| Escriba | 1 por turno | ≤ 200 | 3-6 s (1.5B) |
| Árbitro | ≤ 1 por día ficticio | ≤ 250 | 15-30 s |
| Crónica de día | ≤ 1 por día ficticio | ≤ 350 | 20-40 s |
| Reflexiones | 1 por semana | ≤ 300 | 20-35 s |
| Biografía | por suceso ≥ 8 | ≤ 300 | 20-35 s |

Si la cola acumula más de 5 tareas P3, se descartan las más antiguas de menor importancia (se
usará la alternativa de plantilla).

---

## 14. Lo que ve el jugador

| Pieza | Dónde | Detalle |
|---|---|---|
| **Rumores** | Panel "El mundo" (canal `WORLD`) | "Se dice en las Llanuras que…" al llegar el conocimiento |
| **Noticias del Reino** | Canal `KINGDOM` | Sucesos del Reino |
| **Leyendas de tu partida** | Nueva pestaña del Diario o panel propio | Crónica (por días/semanas), Personajes, Facciones, Lugares, Línea temporal; solo lo que el personaje sabe; enlaces cruzados a la Enciclopedia |
| **Fichas vivas** | Enciclopedia | En la ficha de un NPC/facción/lugar, sección "En tu partida" con su biografía y sucesos |
| **Etiquetas** | Panel Personaje | Títulos ganados con el suceso que los otorgó |
| **Aprobación** | Panel Compañeros | Barra de aprobación y reacciones recientes |
| **Notificaciones** | `HUD-6` del roadmap de front | Sucesos ≥ 7 que el personaje sabe |
| **Epílogo** | `UX-18` del roadmap de UX | Qué fue de cada uno |

Endpoints nuevos (`routes/saves/cronista.ts`):
`GET /saves/:id/leyendas?tipo=&desde=&hasta=` · `GET /saves/:id/leyendas/entidad/:tipo/:id` ·
`GET /saves/:id/etiquetas` · `GET /saves/:id/epilogo`. Todos filtran por conocimiento del jugador.

---

## 15. Herramientas de administración

- **`/admin/partida/:id/libro`** (como `/admin/enciclopedia`): todos los sucesos con causas y
  efectos en árbol, conocimiento, consecuencias pendientes, hilos, presupuesto de tensión,
  fallos de validación de la IA. Permite **anular** un suceso de IA (marca y revierte efectos
  reversibles) y **forzar** un suceso del catálogo para probar.
- **`npm run cronista:simular -- <saveId> <dias>`**: avanza N días sin jugar y saca un informe
  (para ajustar pesos y presupuesto).
- **`npm run cronista:reproducir -- <saveId>`**: rehace el avance con las mismas semillas y compara.
- **`npm run exportar-leyendas -- <saveId>`** (§ 12.4).

---

## 16. Migración de partidas existentes

1. Migración Prisma con los modelos nuevos y los cambios de § 5.2 (índices únicos parciales en SQL
   a mano, como ya se hizo con `vector`).
2. Script `npm run cronista:migrar-partidas`:
   - `asegurarMundoDePartida` para cada partida;
   - `Save.npcsRetiredForever` → `NpcState.muerto`;
   - NPC con `Npc.muertoEnMundo = true` → `NpcState.muerto` **solo** en las partidas que ya los
     tenían retirados o en las que murieron (si no se puede saber, se marca muerto en todas las
     existentes y se documenta);
   - `WorldState.agenda` → estado de la cadena Serhu;
   - `WorldState.ultimoDiaSimulado` = día actual;
   - sucesos fundacionales opcionales a partir de `SessionSummary` (importancia 3, origen `MUNDO`).
3. Las partidas nuevas nacen con el mundo clonado.

---

## 17. Fases de implementación

Cada fase es usable por sí sola. "Hecho cuando" = criterio de aceptación.

### Fase 1 — Libro de Sucesos (sin IA) · **M-L**
- ~~**CR-1** Modelos `Suceso`, `SucesoCausa`, `SucesoActor`, enums. **S**~~ ✅ 2026-10-02: modelos y enums en `schema.prisma` (migración `20261002120000_libro_de_sucesos`, hecha con `migrate diff` porque la base sombra no tiene pgvector), el reinicio de partida vacía el Libro, test de integración `services/cronista/libroSucesos.integration.test.ts`. Quedan para sus tareas: `Conocimiento` (CR-18) y el `embedding` (cuando se use).
- ~~**CR-2** `registrarSuceso()`, importancia y plantillas de texto para todos los tipos de § 6.1. **M**~~ ✅ 2026-10-02: `services/cronista/catalogoSucesos.ts` (los 74 tipos de § 6.1 con familia, importancia base de § 6.3 y plantilla; datos tipados por tipo) y `services/cronista/sucesos.ts` (`registrarSuceso`, dentro de la transacción del llamador; modificadores +1 jugador autor / núcleo jugable / hilo). Del contrato de § 6.2 quedan para sus tareas: sembrar `Conocimiento` (CR-18) y encolar reacciones (CR-10). Tests: `catalogoSucesos.test.ts` y `libroSucesos.integration.test.ts`.
- ~~**CR-3** Emisores en: turno (`turnResolution.ts`: combate, muerte causada, perdón, captura,
  misión, construcción, fundación, entrega), `death.ts`, `recordFactionEvent`, expediciones,
  población, agenda, clima, `dailyTick`, cadáveres/recuperación. **M**~~ ✅ 2026-10-02.
  Emisores: fundación (`REINO_FUNDADO`), captura, Clemente (`PERDON_CONCEDIDO`), muerte del
  jugador / fin de partida / despertar, muerte causada y combate ganado (`applyKillSideEffects`,
  1v1 y grupo; en grupo el autor es el bando del jugador), combate perdido (caer convaleciente),
  misiones completadas/fallidas por sus 5 caminos (`registrarFinDeMision`), construcción, entrega
  (`REGALO`), cambios de banda de relación (`recordFactionEvent(…, saveId?)`), sabotaje y
  espionaje, expediciones (salida/asalto/vuelta), etapas de la agenda Serhu, clima (tormentas en la
  región del personaje y cambio de estación, `cronista/clima.ts`) y recuperación/cadáver
  (`registrarSucesoDeNpc`). Los del mundo se apuntan en cada partida viva del mundo
  (`registrarEnPartidasDelMundo`) hasta que CR-6 dé un mundo por partida. Convención de actores:
  PERSONAJE = id de la partida, NPC = `Npc.id`, FACCION/REGION = slug.
  **Queda fuera a propósito:** población (auge/declive): qué cambio merece un suceso lo decide el
  narrador de fondo (`CR-12`). Tests de integración con aserciones del Libro en cada ruta.
- ~~**CR-4** Vista de administración `/admin/partida/:id/libro` (solo lectura). **M**~~ ✅ 2026-10-02.
  Ruta `GET /saves/:id/libro` (`routes/saves/libro.ts`: filtros `familia`, `tipo`, `importanciaMin`,
  paginación `limite` + `antesDe` = id del último suceso; cada suceso con fecha de ficción, texto,
  actores y causas/efectos) y página `frontend/src/pages/AdminLibro.tsx` (filtro por familia e
  importancia mínima, «Cargar más», causas y efectos resueltos a su texto). Sin enlace en flujos de
  jugador, como `/admin/enciclopedia`. Tests: integración de la ruta y test de la página.
  **Queda:** el «Hecho cuando» de abajo (1 hora de juego) se comprueba en la fase única de pruebas.
- **Hecho cuando:** jugar 1 hora deja en el Libro todos los sucesos con causas correctas; tests de
  cada emisor.

### Fase 2 — Mundo por partida · **L**
- ~~**CR-5** Cambios de esquema § 5.2 + índices parciales. **M**~~ ✅ 2026-10-02: migración
  `20261002200000_mundo_por_partida` con los campos de § 5.2 (`Faction.origenSlug/disueltaEn/
  fundadaEn/cohesion`, `saveId` en `FactionRelation`, `WorldPopulation`, `Expedicion` y `Npc`,
  `NpcState.muerto/muertoEn/cargo/lealtadFaccionId`, `Companion.valores/aprobacion`, `WorldState.
  ultimoDiaSimulado/presupuestoTension/estiloNarrador/mundoClonadoEn`) y únicos **parciales** para
  `Faction`, `Npc` y `WorldPopulation` (catálogo `saveId IS NULL` por mundo; partida por `saveId`).
  Las búsquedas por `worldId_slug` de NPC/facción pasan a `findFirst` con `saveId: null` (la fila
  de catálogo, mismo resultado que antes); la siembra hace `upsert` por id (sigue idempotente).
  **Ojo:** Prisma no expresa índices parciales; `prisma migrate diff` propondrá borrarlos en
  migraciones futuras: quitar esas líneas. Aún nada lee ni escribe por partida: eso es `CR-6`.
- ~~**CR-6** `asegurarMundoDePartida` y adaptar lecturas/escrituras de facciones, relaciones,
  población, expediciones y NPC muertos a la partida. **L**~~ ✅ 2026-10-04 (pasos 1-4; expediciones
  y muertes de NPC por expedición **pasan a `CR-7`**: las mueve el tick del mundo por día de ficción
  del mundo, y § 13.1 las pone en el avance diario de cada partida) — **paso 1 hecho:**
  `services/mundoPartida.ts` (`asegurarMundoDePartida`, con candado de Postgres; clona facciones
  con `origenSlug`, relaciones, `KingdomStats`, territorios y edificios de facción —sin `saveId`,
  cuelgan de la copia—, población; marca `mundoClonadoEn` y emite `SISTEMA_MUNDO_INICIADO`) y
  `copiaDeFila` (Json nulos como `DbNull`). Test de integración: idempotente, dos partidas
  divergen, se borra con la partida. **Paso 2 hecho (2026-10-03): población por partida.**
  `ambitoPoblacion(db, saveId)` (clona el mundo de la partida la primera vez que se necesita; sin
  `WorldState`, catálogo) y `FiltroPoblacion`; lo usan muertes (`decrementPopulationOnDeath` recibe
  `saveId`), caza, recolección (`candidateSourcesFor` con filtro, por defecto catálogo para las
  expediciones), modo dinámico de recurso, encuentros de viaje y en el sitio, puntos de zona y
  encuentro ambiental. `syncFactionPopulationToKingdomStats` agrupa por partida. La agenda del mundo
  (`worldAgenda.ts`) sigue en catálogo hasta `CR-7`. Arreglos que trajo la clonación: el Reino del
  jugador se busca con `origenSlug: null` (combate, expansión, rutas de reino, enciclopedia) y la
  diplomacia apunta a catálogo o al propio Reino; reiniciar la partida borra su copia del mundo y
  limpia `mundoClonadoEn`. **Paso 3 hecho (2026-10-04): enganchado.** `asegurarMundoDePartida` se
  llama al crear la partida y al reiniciarla (fuera de su transacción) y al inicio de
  `narrateAndPersistTurn` (las partidas anteriores reciben su copia en su primer turno; luego es una
  sola lectura). Test de integración: crear clona tantas facciones y filas de población como el
  catálogo, y reiniciar las rehace sin duplicar. **Paso 4 hecho (2026-10-04): relaciones por
  partida.** `FiltroFacciones` / `ambitoFacciones` (copias de la partida, sin su Reino). El conflicto
  de la agenda (`WorldState.agenda`, ya de cada partida) sincroniza las relaciones Serhu→defensores
  de SU copia y resta de SU población; el control de región (turno y zona) y el listado
  `GET /world/:slug/faction-relations?saveId=` leen la copia de la partida. Las relaciones
  jugador↔facción (bajas de guerra, expansión, diplomacia, mercado) siguen contra la facción de
  catálogo porque su almacén y su economía no se copian hasta `CR-7`; ya guardan el `saveId` de la
  partida. Test: el conflicto de una partida no toca el de otra ni el del catálogo.
- ~~**CR-7** `avanceDiario` por partida; sacar las funciones de mundo de `worldTick.ts`. **M**~~ ✅ 2026-10-04. Incluye
  lo que pasa de `CR-6`: expediciones de facción de la partida (`factionExpeditions.ts`, con
  `Expedicion.saveId`) y sus muertes de NPC en `NpcState.muerto` en vez de `Npc.muertoEnMundo`;
  economía y decaimiento de presión de las copias; y entonces almacén/mercado de las copias y las
  relaciones jugador↔facción contra la copia (hoy contra el catálogo). 🚧 2026-10-04 — **paso 1
  hecho:** `services/avanceDiario.ts` (`avanzarMundoHasta`, candado por partida, tope de 30 días por
  llamada, `WorldState.ultimoDiaSimulado`): crece la población de la partida por días de ficción
  (`crecerPoblacionDePartida`, compuesto con la fracción ganada por probabilidad; antes era por días
  reales), la refleja en el `KingdomStats` de sus facciones y avanza su agenda
  (`avanzarAgendaDePartida`). Se llama tras el commit de cada turno. `worldTick` ya no avanza la
  agenda y su crecimiento de población solo toca el catálogo. Tests: unitarios del cálculo y de
  integración (crece solo la partida, cada día una vez). **Paso 2 hecho (2026-10-04): economía por
  partida.** `factionEconomy.ts` partida en `producirFacciones` y `decaerRelaciones` por ámbito: el
  tick del mundo solo procesa el catálogo; el avance diario, las copias de la partida y sus
  relaciones. El clonado arranca los marcadores de día/semana de las copias en el día de la partida
  (antes copiaba los del mundo, que podían ir muy por delante) y copia el almacén de cada facción.
  **Paso 3a hecho (2026-10-04):** `npcVivoEnPartida(saveId)` / `npcsMuertosEnPartida`: todo lo que
  lista NPC (escena, encuentros ambientales y de viaje, objetivos de misión, mapa y colisiones de
  zona) excluye también los muertos fuera de escena en esa partida (`NpcState.muerto`), además de
  `muertoEnMundo`. **Paso 3b hecho (2026-10-04): expediciones por partida.** `factionExpeditions.ts`
  recibe el ámbito (`saveId`, o null = catálogo) en toda la cadena: lanzar (copias, NPC vivos en la
  partida, protegidos y población de la partida, `Expedicion.saveId`), llegar e interceptar (facción
  hostil = copia; muertes en `NpcState.muerto` de la partida, no `muertoEnMundo`; relación con
  `saveId`), volver; Libro de Sucesos y noticias solo en esa partida. `avanzarExpedicionesDePartida`
  va en el avance diario y `worldTick` ya no lanza expediciones (el catálogo es plantilla).
  `advanceFactionExpeditions` queda para el catálogo (lo usan sus tests). Test: muerte en una
  partida, vivo en otra y en el mundo. **Paso 4 hecho (2026-10-04):** diplomacia, mercado, bajas de
  guerra y expansión van contra la copia de la facción en la partida (su almacén ya se copia), y
  `worldTick` deja de avanzar el catálogo (crecimiento, reino de facciones, economía): solo queda lo
  de tiempo real (tránsitos, supervivencia, cadáveres), como pide D-1. `asegurarMundoDePartida` no
  hace nada sin `WorldState`. **Paso 5 hecho (2026-10-04):** `registrarAvanceTrasAcciones` (gancho
  `onResponse` de Fastify, `server.ts`): tras cada POST correcto a `/saves/:id/...` (zona, descanso,
  recolección, caza, modo dinámico…) avanza el mundo si el reloj cruzó un día (una lectura si no);
  los tránsitos ya pasan por `narrateAndPersistTurn`. Borradas `growAllPopulations` y
  `advanceWorldAgenda` (sus tests, a la partida). `advanceFactionEconomy` y
  `advanceFactionExpeditions` quedan solo como ejecución sobre el catálogo que usan sus tests de
  integración del núcleo (no las llama nadie más). El test P3.2 del viaje interrumpido que fallaba
  a veces se diagnosticó con `diagnosing-bugs` (2026-10-04): era un fallo real de `worldTick.ts`
  (la resolución anticipada se rendía con el candado del turno cogido y dejaba el viaje atascado),
  ya arreglado.
- ~~**CR-8** Script de migración (§ 16). **M**~~ ✅ 2026-10-04: `services/cronista/migrarPartidas.ts`
  (`migrarPartida`, `migrarTodasLasPartidas`) y `npm run cronista:migrar-partidas` (solo informa;
  `-- --aplicar` aplica; idempotente). Por partida: clona su mundo, pasa a `NpcState.muerto` sus
  `npcsRetiredForever` y los `Npc.muertoEnMundo` (en todas las partidas existentes, D-10; luego se
  quita la marca del `Npc` para que las partidas nuevas los reciban vivos), lleva la etapa del
  conflicto de su agenda a sus relaciones y fija `ultimoDiaSimulado` en el día actual. Sin los
  sucesos fundacionales desde `SessionSummary` (opcionales). Test de integración (simulación sin
  cambios, aplicar, repetir sin cambios). **Pendiente de ejecutar con `--aplicar` en la base real**
  (Supabase) antes de llevar el hito a los jugadores.
- **Hecho cuando:** dos partidas del mismo mundo divergen (una mata a un NPC, la otra no lo ve);
  todos los tests de integración actuales pasan.

### Fase 3 — Motor sin IA · **L**
- ~~**CR-9** Lista cerrada de efectos con sus sucesos. **M**~~ ✅ 2026-10-04 — **paso 1:**
  `services/cronista/efectos.ts` (`aplicarEfecto`/`aplicarEfectos` con `CtxEfecto`; lo que no se
  puede aplicar devuelve `aplicado: false` sin fallar). Efectos de facciones y NPC: `cambiarPresion`,
  `matarNpc` (`NpcState.muerto`), `asignarCargo` (suceso solo para heredero), `cambiarCohesion` (sin
  suceso: número interno), `cambiarLider`, `crearFaccion` (escisión o fundación, con su reino),
  `disolverFaccion` (nunca el Reino del jugador) y `absorberFaccion` (gente, recursos, territorios,
  edificios y almacén). **Paso 2:** `ajustarPoblacion` (auge/declive si cambia ≥ 10 %),
  `moverPoblacion` (reparte `distribucion`; `MIGRACION_FAUNA`), `danarEdificio`/`repararEdificio`,
  `cambiarControlTerritorio` (conquista o pérdida; el del jugador cuelga de la partida) y
  `crearPuntoZona`/`retirarPuntoZona`. 11 tests de integración. **Van con su tarea** (anotados en
  ellas): `programarConsecuencia`/`anularConsecuencia` y `ajustarPrecios` (CR-11), `crearNpc`
  (CR-13), etiquetas/aprobación/recuerdos (Fase 4), conocimiento (Fase 5), hilos (buscadores) y
  `ofrecerMision` (gancho).
- ~~**CR-10** Reacciones inmediatas (tabla § 7.1). **M**~~ ✅ 2026-10-04: `services/cronista/reacciones.ts`
  (datos `Reaccion`: escucha, prioridad, condición, efectos de la lista cerrada o sucesos
  derivados). Cola en BD (`Suceso.reaccionesPendientes`, `nivelCascada`; migración
  `20261004180000_cola_reacciones`, los sucesos previos no reaccionan) y `procesarReacciones` en
  anchura con tope de 3 niveles y 20 sucesos (lo que pasa del tope, `CONSECUENCIA_PERDIDA` hasta
  CR-11). Se procesa tras cada turno, cada día simulado y cada POST a `/saves/:id/...`. Reacciones:
  muerte causada por el jugador → presión de la facción de la víctima contra su Reino; muerte del
  líder → `MUERTE_LIDER` → cohesión −25; perder el último territorio → `FACCION_CAE`; tormenta
  extrema → tirada de daño a edificios del jugador en la región. `GUERRA_DECLARADA` ya la registra
  `recordFactionEvent`. Las que faltan van con su tarea (anotado en ellas): CR-11, CR-12, CR-14, CR-16.
- ~~**CR-11** Consecuencias aplazadas con sus disparos y las 7 iniciales (§ 7.2). **M**~~ ✅ 2026-10-04 (4 reglas; las otras 3, con su tarea — ver decisiones). Incluye los
  efectos `programarConsecuencia`/`anularConsecuencia` y `ajustarPrecios` (para `PUEBLO_ABANDONADO`)
  en `efectos.ts` (CR-9), las reacciones que programan consecuencias (`SUCESION_PENDIENTE` tras
  `MUERTE_LIDER`, `DEUDA_DE_VIDA` tras `PERDON_CONCEDIDO`, `PROMESA_VENCE` tras `PROMESA`) y pasar
  lo que supera el tope de cascada a consecuencia del día siguiente (hoy `CONSECUENCIA_PERDIDA`) (CR-10).
  **Decisiones de la entrevista con la usuaria (2026-10-04, `/grill-with-docs`):**
  - **Alcance:** infraestructura completa (modelo, disparos, caducidad, evaluación) +
    `DEUDA_DE_VIDA`, `SUCESION_PENDIENTE`, `VENGANZA_PARIENTE` y la parte de población de
    `REFUGIADOS`. `PROMESA_VENCE` espera a que algo registre promesas (misiones/diálogo),
    `RUMOR_DE_HAZANA` a la Fase 5 (conocimiento), `PUEBLO_ABANDONADO` a que haya comercio local, y
    la llegada de refugiados al Reino a la pregunta 1 de Álvaro (población).
  - **Deuda de vida:** el perdonado aparece como punto de NPC en la zona de otra región (3-20 días);
    al interactuar regala un objeto de su equipo (o 10-30 goirnos) y se registra `REGALO`. El punto
    se va al aceptar o al salir de la región. Si el NPC murió o es hostil, la deuda se pierde. La
    ayuda en combate, al `0.3`.
  - **Venganza:** solo testigos (NPC con nombre en escena al matar; se apuntan en la muerte). Como
    mucho un vengador: el testigo de la facción de la víctima. A los 5-15 días o al cruzarse,
    aparece como punto agresivo en la zona del jugador y el choque abre combate. Se cierra si muere
    o se le perdona; se pierde si el testigo muere antes. El parentesco, como propuesta de lore.
  - **Sucesión sin IA:** determinista por cohesión (§ 7.3): < 20 cae, 20-50 escisión, > 50
    sucesión. Sucesor: el heredero designado si lo hay; si no, el NPC con nombre vivo de más
    Inteligencia de la facción. CR-12 podrá matizarlo.
  - **Escisión:** nombre según el pueblo (propuesta `propuestas-lore.md`, 2026-10-04): orcos, el
    nombre de quien la encabeza sin vocal final + -ig/-g (Helsa → Helsig, Gosha → Goshg; Varka →
    Clan Varkig); Nabieus, Keseg +
    palabra; Faerus, Feg + palabra; con su traducción en la descripción. Los goirntes no se escinden
    hasta que Álvaro decida (Q13).
  - **Refugiados:** se reparten por las regiones vecinas que da el lore (`areas.md` § Cómo encajan
    en el mapa); la misma tabla sirve a la fauna que huye de una tormenta (CR-12).
  - **Lo que ve la jugadora:** las consecuencias de sus actos, insinuadas con una frase al crearse
    («Algo te dice que volverás a ver a *X*.»); las del mundo, ocultas hasta que pasan. Admin ve
    todas. Al caducar, `CONSECUENCIA_PERDIDA` en silencio.
  🚧 2026-10-04 — **paso 1 hecho (infraestructura):** modelo `Consecuencia` (migración
  `20261004200000_consecuencias`), efectos `programarConsecuencia` (con aviso opcional en el canal
  del personaje) y `anularConsecuencia`, `services/cronista/consecuencias.ts` (`registrarRegla`,
  `evaluarConsecuencias`: caduca lo vencido y dispara por días o por estar en una región;
  `ENCUENTRO_NPC` por los `npcIds` del momento; `SUCESO` desde la cola de reacciones). Se evalúa
  tras cada turno, día y acción. Lo que supera el tope de cascada de CR-10 es ya la regla
  `REACCION_APLAZADA` del día siguiente (vuelve a comprobar su condición). 5 tests de integración.
  **Paso 2a hecho (2026-10-04):** `SUCESION_PENDIENTE` (reacción a `MUERTE_LIDER`, 1-3 días; por
  cohesión cae, se escinde o sucede; sucesor: heredero designado o el NPC con nombre vivo de más
  Inteligencia; la escindida se lleva el 30 % de la gente) y `REFUGIADOS` (reacción a
  `FACCION_CAE`, 2-6 días; la mitad del peso regional de su raza se reparte por las regiones
  vecinas y la facción se queda sin gente), en `reglasConsecuencias.ts`; nombres de escisión
  (`nombresFaccion.ts`) y regiones vecinas del lore (`regiones.ts`). Arreglo: una muerte que llega
  por dos vías ya no registra dos veces la muerte del líder. **Paso 2b hecho (2026-10-04):**
  `DEUDA_DE_VIDA` — reacción a `PERDON_CONCEDIDO` (solo NPC con nombre; aviso «Algo te dice que
  volverás a ver a X.»), se dispara al estar en otra región tras 3+ días (caduca a los 20): el
  perdonado aparece como punto de NPC a una celda de la jugadora; al cruzarse (`ENCUENTRO_NPC` =
  punto activo a ≤ 1,5 celdas en su lugar actual) regala un objeto de su equipo o 10-30 goirnos
  (efecto nuevo `regalarAlJugador`, suceso `REGALO`) y se va; sin cruce, se va a los 2 días
  (`alCaducar`). **Paso 2c hecho (2026-10-04):** al matar, los NPC con nombre con punto activo en
  el lugar quedan como `TESTIGO` del suceso (`testigos.ts`); `VENGANZA_PARIENTE` (reacción a
  `MUERTE_CAUSADA` si un testigo es de la facción de la víctima; aviso «X lo ha visto todo, y no lo
  va a olvidar.»; 5-15 días, caduca a los 30): el vengador aparece a una celda y, al cruzarse,
  ataca (efecto nuevo `forzarCombate`, mismo camino que un viaje interrumpido); si muere antes, se
  pierde. Arreglo de paso: dos `NOT` en el mismo filtro de Prisma se pisaban y colaban muertos como
  vivos (ahora `AND`). **Pendiente, con su tarea:** `PROMESA_VENCE` (cuando algo registre promesas),
  `RUMOR_DE_HAZANA` (Fase 5), `PUEBLO_ABANDONADO` (comercio local), refugiados al Reino (pregunta 1
  de Álvaro), ayuda en combate de la deuda de vida (`0.3`).
- **CR-12** Narrador de fondo con presupuesto, enfriamientos y reglas de facción (§ 7.3);
  agenda Serhu como primera cadena. **L** Al hacerlo, revisar `UX-6` (roadmap-front-ux.md): hoy
  la ambientación se cancela al enviar una acción porque no pesa nada; con contenido real puede
  convenir que la acción espere (opción A). Incluye de la tabla de reacciones (CR-10): la fauna
  que huye de una tormenta extrema a una región vecina (necesita vecinos entre regiones) y
  `HAMBRUNA` 3 días seguidos → cohesión −10 y posible `REBELION` (necesita llevar la cuenta).
  🚧 en curso (2026-10-04): diseño acordado con la usuaria (grill, ronda 1):
  - **Pasos:** 12a motor (candidatos, presupuesto, enfriamientos, elección por peso sin IA) +
    catálogo inicial + «Ritmo del mundo» en Configuración; 12b agenda Serhu como primera cadena;
    12c fauna que huye de la tormenta extrema y `HAMBRUNA`. «Favorecer hilos» espera a CR-17 y el
    árbitro con IA, a la Fase 7.
  - **Catálogo inicial (8):** escaramuza (tensión/guerra → presión), caravana (tratado/alianza →
    riqueza y distensión), plaga y auge de fauna en una región, migración de fauna a región vecina,
    incendio o crecida (daña edificio de facción), malestar interno (cohesión baja → baja más),
    visitante ilustre en el Reino de la jugadora (felicidad).
  - **Ritmo:** +3/+1/+5 al día (Equilibrado/Tranquilo/Caótico), coste = importancia (3-5); día con
    3+ sucesos de la jugadora → sin suceso de fondo.
  - **Visibilidad:** todo al Libro; al canal «El mundo» solo lo que el personaje podría saber
    (facción conocida o región donde está), mismo filtro que las noticias de expediciones (D-5).
  - **Estilo (D-7):** opción «Ritmo del mundo» en Configuración › Partida, cambiable siempre.
  - **Reglas de facción:** absorción como candidato del narrador de fondo; fundación por
    asentamiento queda para cuando se resuelva la pregunta 1 de Álvaro (población).
  - **UX-6:** se mantiene la opción B (la ambientación se cancela al actuar). La usuaria pide en su
    lugar **dar valor de verdad al canal «El mundo»** (que sirva y aporte algo). Ronda 2 cerrada:
  - **12d — noticias que abren oportunidades:** cada suceso de fondo que llega al canal deja algo
    que hacer con plazo (consecuencia programada + punto de zona; si no vas, se pierde sin más):
    escaramuza → campo de batalla con botín y un herido al que ayudar o rematar (3 días); caravana →
    comerciar a mejor precio o asaltarla (2 días); plaga/auge de fauna → caza escasa o abundante
    en la región (5 días); incendio/crecida → la facción pide materiales, llevarlos da reputación
    (5 días); malestar interno → un descontento se ofrece como informante o recluta (4 días);
    visitante ilustre → audiencia en tu Reino (3 días).
  - **Rumor o certeza por distancia:** misma región, al momento y como hecho; región vecina, al día
    siguiente y como «Se dice que…»; más lejos, 2-3 días y como rumor (la oportunidad puede llegar
    pasada). Aliados o con tratado avisan sin retraso. Sin rumores falsos aún (`RUMOR_DE_HAZANA`,
    Fase 5).
  - **Resumen al cruzar varios días:** una entrada «Mientras viajabas…» desplegable en vez de
    ráfaga (es `UX-31`).
  - **Ambientación informada:** la llamada de ambientación (`routes/entorno.ts`) recibe los 2-3
    últimos sucesos visibles de la región para hablar de ellos.
  - **Frontend:** entradas con icono, enlaces y etiqueta de distancia/plazo → `UX-38`.
  - ✅ **12a hecho (2026-10-04):** `services/cronista/narradorFondo.ts` (`narrarDia`, una vez por día
    simulado desde `avanceDiario`): presupuesto +1/+3/+5 con tope 10, coste = importancia base,
    enfriamiento por tipo (días desde el último de ese tipo con origen `MUNDO`), día con 3+ sucesos
    de la jugadora sin suceso de fondo, elección por peso. Catálogo: escaramuza, caravana (riqueza
    +5 a las dos, efecto nuevo `ajustarReino`), plaga, auge, migración de fauna, incendio, crecida
    (solo Ciénaga Troncal), malestar interno, visitante ilustre (felicidad +5) y absorción. Tipos
    nuevos `ESCARAMUZA` y `MALESTAR_INTERNO`; `ajustarPoblacion`/`moverPoblacion` aceptan
    `sinSuceso`. Noticia al canal «El mundo» con el filtro de `difundirNoticias`. «Ritmo del mundo»:
    `GET/PATCH /saves/:id/ritmo` y pestaña «Partida» en Configuración (solo con partida abierta).
    **Queda:** 12b, 12c, 12d.
  - ✅ **12b hecho (2026-10-04):** motor de cadenas `services/cronista/cadenas.ts` (`Cadena`:
    pasos con texto, sucesos y efectos; `intervaloDias`; `aplicaA`; `motivoDeCorte`; `sincronizar`;
    estado en `WorldState.agenda` con la forma de siempre, sin migración). La agenda Serhu es
    `CADENA_CONFLICTO_SERHU` (`worldAgenda.ts`): los textos de `STAGE_FACTS` son los de cada paso, las
    bajas de Helsig y Goshg van por `ajustarPoblacion`, y la cadena **se corta** si cae el Clan Serhu
    o caen Helsig y Goshg a la vez (noticia de cierre en «El mundo»). **Queda:** cadenas que nazcan a
    mitad de partida (p. ej. una guerra a partir de escaramuzas), como candidatos del narrador de
    fondo; 12c y 12d.
  - ✅ **12c hecho (2026-10-04):** reacción `TORMENTA_ESPANTA_FAUNA` (hasta 2 especies de la región
    de una `TORMENTA_EXTREMA` mueven el 30 % de su peso a una región vecina, `MIGRACION_FAUNA`) y
    hambruna: `KingdomStats.diasHambre` (migración `20261004220000_dias_hambre`) cuenta los días
    seguidos con déficit de comida; cada 3 se registra `HAMBRUNA` (`cronista/hambruna.ts`) y la
    reacción `HAMBRUNA_DIVIDE` quita 10 de cohesión y puede desatar `REBELION` (25 %, 50 % si la
    cohesión queda por debajo de 30). **Pendiente:** la hambruna solo se registra para el Reino de la
    jugadora; en las facciones del mundo está apagada (`HAMBRUNA_EN_FACCIONES`) porque con los números
    provisionales de su economía 6 de las 9 sembradas pasan hambre siempre. Se enciende con los
    números de la economía de supervivencia (pregunta 5 a Álvaro). `REBELION` aún no tiene
    consecuencias propias más allá del Libro (las tendrá con la economía y las reglas de facción).
  - 🚧 **12d en curso (2026-10-04).** Hecho:
    - **Rumor por distancia** (`cronista/noticias.ts`, `darNoticia`): misma región o facción aliada
      / con tratado del Reino → al momento y como hecho; vecina → 1 día; más lejos → 2-3 días, como
      «Se dice que…»; sin lugar → solo si conoce la facción, 1 día y como rumor. Lo que llega tarde
      es una consecuencia `NOTICIA` (disparo por días). Lo usa el narrador de fondo.
    - **Ambientación informada** (`cronista/rastros.ts`): la ambientación es de plantillas (no usa
      IA, corrige lo dicho en la ronda 2), y ahora añade hasta 2 rastros de sucesos de los últimos
      3 días en la región (incendio, crecida, tormenta, plaga, auge, fauna que llega, edificio
      dañado).
    **Falta:** resumen «Mientras viajabas…» al cruzar varios días y las oportunidades con plazo.
- **CR-13** Nacimientos notables y generador de nombres (§ 12.3). **M** Incluye el efecto `crearNpc`
  en `efectos.ts` (CR-9).
- **Hecho cuando:** `cronista:simular 60` produce caídas, escisiones, tormentas con daños, guerras
  y nacimientos coherentes; perdonar a un NPC lo hace volver en otra región.

### Fase 4 — Personas que recuerdan · **M**
- **CR-14** Etiquetas (§ 8.1). **S** Incluye las reacciones de CR-10: etiqueta tras matar a un NPC
  con nombre y evaluación de etiquetas por cualquier suceso del jugador como autor.
- **CR-15** Aprobación con valores (§ 8.2). **M**
- **CR-16** Recuerdos de NPC (§ 8.3). **S** Incluye las reacciones de CR-10: `recuerdo(testigos,
  jugador, −6)` tras una muerte causada y `recuerdo(víctima, jugador, +5)` tras un perdón.
- **CR-17** Buscadores de historias e hilos (§ 7.4). **M**
- **Hecho cuando:** matar al hermano de un NPC abre un hilo de venganza y el vengador aparece;
  un compañero se queja y acaba yéndose si se le contraría repetidamente.

### Fase 5 — Conocimiento y lo que ve el jugador · **M**
- **CR-18** Propagación y rumores (§ 9). **M**
- **CR-19** Endpoints de Leyendas y etiquetas (§ 14). **S**
- **CR-20** Front: Leyendas, fichas "En tu partida", etiquetas, aprobación. **M**
- **Hecho cuando:** un suceso lejano llega como rumor días después y aparece en Leyendas; nada que
  el personaje no sepa es visible.

### Fase 6 — Memoria del narrador · **M**
- **CR-21** Bloque de verdad obligatoria. **S**
- **CR-22** Callbacks por entidad. **S**
- **CR-23** Puntuación recencia + importancia + relevancia sobre Libro + crónica. **M**
- **Hecho cuando:** al volver a ver a un NPC perdonado, la narración lo menciona; nunca narra
  vivo a un muerto (test con escenas preparadas).

### Fase 7 — IA · **L**
- **CR-24** Cola con prioridades (§ 13.2). **M**
- **CR-25** Escriba (§ 10.1) con validación y alternativa. **M**
- **CR-26** Cronista: crónica de día y semana, biografías, reflexiones (ampliando
  `chapterSummary.ts`). **L**
- **CR-27** Árbitro (§ 10.2). **M**
- **CR-28** Epílogo (§ 10.3) + pantalla `UX-18`. **M**
- **Hecho cuando:** con IA, la crónica y las justificaciones citan sucesos reales; sin IA (Ollama
  apagado) todo sigue funcionando con plantillas; ningún turno del jugador se retrasa por el
  Cronista.

### Fase 8 — Pulido · **M**
- **CR-29** `cronista:reproducir`, anulación de sucesos de IA en admin. **M**
- **CR-30** `exportar-leyendas` a `propuestas-lore.md`. **S**
- **CR-31** Ajuste de pesos y presupuesto con 3 partidas largas simuladas. **M**

---

## 18. Pruebas

- **Unitarias (vitest), una por archivo de `services/cronista/`:** importancia, plantillas,
  cada reacción, cada consecuencia (disparo y caducidad), selección del narrador de fondo con
  semilla, reglas de facción, etiquetas, aprobación, patrones de historias, propagación,
  generador de nombres, cadena de validación (incluidos casos de IA que inventa nombres, cita ids
  inexistentes o contradice un hecho protegido).
- **Integración (BD real, como las actuales `*.integration.test.ts`):** clonado por partida y
  divergencia entre dos partidas; avance diario de 30 días; cascada con tope; migración de una
  partida antigua.
- **IA con dobles:** respuestas grabadas del modelo (válidas e inválidas) para Escriba, Árbitro y
  Cronista; nunca se llama a Ollama en los tests.
- **Reproducibilidad:** el mismo estado + semillas da el mismo Libro.
- **Rendimiento:** `avanceDiario` de un día < 300 ms sin IA con el catálogo actual.

---

## 19. Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo local contradice el canon o inventa | La IA no aplica nada; validación en 6 pasos; alternativa de plantilla; herramienta de anulación |
| Cola saturada en la Steam Deck | Prioridades; tareas P3 cortas y descartables; todo tiene plantilla |
| El mundo se desboca (demasiados sucesos o efectos en cascada) | Presupuesto de tensión; enfriamientos; tope de cascada 3 niveles / 20 sucesos; `cronista:simular` para ajustar |
| `turnResolution.ts` (7.125 líneas) es frágil | Emisores en pocos puntos con `registrarSuceso`; sin cambiar la lógica del turno en la Fase 1 |
| Migración de partidas existentes | Clonado perezoso e idempotente; script con modo `--dry-run`; copia de la BD antes |
| Facciones nuevas que chocan con el lore cerrado | Solo por escisión/asentamiento de razas existentes; nombres por generador; exportación a propuestas para revisión |
| Filtrar información que el personaje no sabe | Conocimiento por suceso; endpoints y memoria del narrador filtran por él |

---

## 20. Decisiones (con valor por defecto)

| Id | Pregunta | Por defecto |
|---|---|---|
| **D-1** 🧭 | ¿El mundo de cada partida avanza solo con su reloj ficticio (no en tiempo real)? | **Sí.** `worldTick` solo para tránsitos y supervivencia |
| **D-2** 🧭 | ¿La IA elige entre candidatos del motor (no propone sucesos libres)? | **Sí** |
| **D-3** 🧭 | Límites de creación | § 12.2: NPC y facciones (por escisión/asentamiento) sí; razas, regiones, lugares, especies, magia no |
| **D-4** 🧭 | ¿Nube para el Cronista si hay clave? | **No** (solo local); el interruptor existe en `env` |
| **D-5** 🧭 | ¿El jugador solo ve lo que su personaje sabe? | **Sí** (estilo Dwarf Fortress); Admin ve todo |
| **D-6** 🧭 | ¿Endurecer las creaciones libres del narrador (compañeros, territorios…) para que el motor las pueda rechazar? | **No por ahora:** se registran como `IA_PROPUESTA` sin cambiar el comportamiento |
| **D-7** 🧭 | Estilo del narrador de fondo elegible en Configuración | **Sí**, `EQUILIBRADO` por defecto |
| **D-8** 🧭 | Legado entre partidas (leyendas que aparecen en otras partidas) | **Fuera de alcance** de este roadmap |
| **D-9** 🧭 | ¿Los compañeros pueden marcharse por baja aprobación? | **Sí**, con aviso previo de 3 días |
| **D-10** 🧭 | Marcar muertos en partidas antiguas cuando no se sabe en cuál murió un NPC | Muerto en todas las existentes, documentado |

---

## 21. Glosario

- **Suceso:** cualquier cosa que pasa en la partida, registrada en el Libro.
- **Libro de Sucesos:** tabla `Suceso` y sus relaciones.
- **Reacción:** regla que se ejecuta en cuanto se registra un suceso.
- **Consecuencia aplazada:** regla programada que se dispara más adelante cuando se cumple su condición.
- **Narrador de fondo:** selección diaria de sucesos del mundo con presupuesto de tensión.
- **Cadena:** suceso de varios pasos con estado (p. ej. una guerra).
- **Hilo:** historia detectada en el Libro (venganza, ascenso, caída…).
- **Etiqueta:** título ganado por lo que se ha hecho.
- **Escriba / Árbitro / Cronista:** los tres papeles de IA.
- **Verdad obligatoria:** bloque de hechos que el narrador no puede contradecir, generado por código.

---

## 22. Fuentes

- Baldur's Gate 3 — [Larian approached reactivity as 'weird Dungeon Masters' (PC Gamer)](https://www.pcgamer.com/games/rpg/larian-gave-baldurs-gate-3-its-acclaimed-reactivity-by-approaching-it-as-weird-dungeon-masters/), [Scripting: Introduction to Osiris](https://docs.baldursgate3.game/Scripting:_Introduction_to_Osiris), [Osiris Design Patterns](https://docs.larian.game/Osiris_Design_Patterns), [Approval — bg3.wiki](https://bg3.wiki/wiki/Approval), [Endings — bg3.wiki](https://bg3.wiki/wiki/Endings), [Save the Tiefling refugees (GameSpot)](https://www.gamespot.com/articles/baldurs-gate-3-save-tiefling-refugees-druid-grove/1100-6516508/), [DART tags framework](https://www.nexusmods.com/baldursgate3/mods/17561)
- Dwarf Fortress — [Legends (DF Wiki)](https://dwarffortresswiki.org/index.php/DF2014:Legends)
- Caves of Qud — [Subverting historical cause & effect](https://www.pcgworkshop.com/archive/grinblat2017subverting.pdf), [GDC: Procedurally Generating History](https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves)
- Story sifting — [Felt: A Simple Story Sifter](https://mkremins.github.io/publications/Felt_SimpleStorySifter.pdf), [James Ryan — publicaciones](https://www.jamesryan.world/publications)
- RimWorld — [AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers)
- Crusader Kings 3 — [Event modding](https://ck3.paradoxwikis.com/Event_modding)
- Bannerlord — [reinos destruidos](https://steamcommunity.com/app/261550/discussions/0/4035852798881126635)
- Shadow of Mordor — [Designing the Nemesis system](https://www.gamedeveloper.com/design/designing-i-shadow-of-mordor-i-s-nemesis-system)
- Valve — [AI-driven Dynamic Dialog (GDC 2012)](https://steamcdn-a.akamaihd.net/apps/valve/2012/GDC2012_Ruskin_Elan_DynamicDialog.pdf)
- Generative Agents — [Memory stream](https://agentpatterns.ai/agent-design/generative-agents-memory-stream/)
- Wildermyth — [Legacy and mythmaking](https://adventurerules.blog/2022/02/17/how-wildermyths-legacy-mechanic-supports-mythmaking/)
- LLM y estado de juego — [Schema-Governed LLM Pipeline for RPGs](https://www.mdpi.com/2079-8954/14/2/175)
