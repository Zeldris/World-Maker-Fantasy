# Mecánicas de juego — Tarkor

**Qué cubre:** el motor de resolución de acciones que hay debajo de todo el juego: fórmula de tirada, quién decide qué se tira, estado del personaje y flujo de un turno.
**Estado:** vigente como base. Los sistemas llegados después tienen documento propio y mandan sobre este: combate ([14](14-combate-y-muerte.md)), niveles/XP/Reino ([10](10-niveles-xp-reino.md)), acciones por tiempo ([08](08-acciones-por-tiempo.md)), validación de la acción del jugador ([18](18-validacion-accion-jugador.md)).
**Fuente de verdad en código:** `backend/src/services/dice.ts` (tirada), `backend/src/services/narrador.ts` (`classifyAction`/`narrateAction`), `backend/src/services/turnResolution.ts` y `backend/src/routes/turn.ts` (orquestación). Decisiones razonadas en [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md).

---

## 0. Alcance — no es un RPG de combate

Tarkor es un motor de resolución de acciones **genérico**: observar, recolectar, construir, comerciar, gobernar, negociar, explorar, luchar… Se puede intentar casi cualquier cosa dentro de las normas del mundo y de lo que la partida ya ha establecido. Todo pasa por el mismo mecanismo de base (clasificación → tirada → consecuencias).

El combate sí tiene maquinaria propia encima de ese mecanismo (modo aparte por turnos, iniciativa, energía, rueda de ventajas por atributo — ver [14](14-combate-y-muerte.md)), pero usa la misma fórmula de tirada y la misma regla de que el backend decide y el modelo narra.

---

## 1. Principios fijos

- **Atributos jugables (7):** `fuerza`, `destreza`, `constitucion`, `inteligencia`, `voluntad`, `carisma`, `magia` (tipo `Attribute` en `dice.ts`; referencia D&D/BG3, con Voluntad en lugar de Sabiduría y Magia aparte). Rango típico 4–18 al crear; el tope sube con el nivel (ver [10](10-niveles-xp-reino.md) § 4.2).
- **Atributos secundarios** (`secondaryAttributes.ts`): `moral`, `resistenciaFrio`, `resistenciaCalor`, `suerte`, `honor`. Nunca se tiran: solo sirven como umbral de requisitos (objetos, construcciones, oficios).
- **El backend calcula la tirada, nunca el modelo.** El LLM narra alrededor de un resultado ya fijado.

---

## 2. Fórmula de resolución de tiradas

```
resultado = d20 + floor(atributo / 2)
éxito si resultado >= dificultad
```

Vale para cualquier tipo de acción. El clasificador decide qué atributo y qué dificultad corresponden según el contexto, no según una categoría fija.

| Dificultad | Valor | Ejemplo |
|---|---|---|
| Trivial | 8 | Abrir una puerta sin cerrojo |
| Fácil | 12 | Trepar un muro bajo |
| Media | 15 | Convencer a un guardia indeciso |
| Difícil | 18 | Forzar una cerradura compleja bajo presión |
| Muy difícil | 22 | Persuadir a un noble hostil de algo que le perjudica |

**Grados de éxito:** en tiradas de acción y de combate el resultado es **binario** (`GradoExito = 'claro' | 'fallo'`, `gradoExitoFor`). Hubo un tercer grado `con_coste` entre 2026-07-19 y 2026-09-07; se retiró porque en combate era solo una etiqueta que a veces contradecía el desenlace real. La **recolección** sí conserva tres tramos con efecto real (`GradoRecurso`: `claro` = cantidad completa, `con_coste` = la mitad, `fallo` = nada; `gradoForRecurso`, dificultad `10 + tier` del recurso).

**Ventaja/desventaja** (`rollD20`): 2d20 quedándose con el mejor o el peor, nunca un modificador plano.

---

## 3. Quién decide qué se tira

El jugador escribe texto libre, no elige de un menú. Algo tiene que traducir ese texto a `(requiereTirada, atributo, dificultad)` antes de tirar.

Se evaluaron tres vías (heurística de palabras clave, llamada de clasificación separada, una sola llamada con dos narraciones precalculadas). **Se usa la llamada de clasificación separada** (decisión 2 de [06](06-decisiones-mecanicas.md)): un modelo pequeño (Cronista, `qwen2.5:1.5b-instruct`) devuelve la clasificación, el backend tira, y el Narrador narra con el resultado fijado.

Antes del clasificador corren atajos deterministas que resuelven sin IA cuando pueden: viaje por el grafo ([12](12-mundo-estructurado.md) § 1.4), construcción, crafteo, descanso, saqueo, validación de la acción ([18](18-validacion-accion-jugador.md)), etc.

---

## 4. Estado del personaje

Modelo híbrido:

- **Condición física estructurada** en `Save.condicionFisica` (enum `ILESO → HERIDO → GRAVE → CONVALECIENTE → MUERTO`). Reglas en [14](14-combate-y-muerte.md) § 1.
- **Lo demás como hechos o como tablas propias.** Nació todo como hechos libres (`WorldState.facts`); con el tiempo varias cosas pasaron a tener modelo propio: inventario (`InventoryItem`), misiones (`Quest`), compañeros (`Companion`), reino (`Territory`/`Building`/`Subject`/`KingdomStats`), reputación por facción, hechos de sesión con embeddings (`SessionFact`). Lo que no tiene tabla sigue viviendo como hecho.

---

## 5. Progresión del personaje

Sí hay niveles y XP (tabla de D&D 5e ampliada). Ver [10-niveles-xp-reino.md](10-niveles-xp-reino.md).

---

## 6. Inventario y equipo

El equipo **equipado** suma bonificadores reales: `ItemCatalog.statBonuses` + `backend/src/services/equipment.ts` (`effectiveAttributes`, `effectiveSecondaryAttributes`, `effectiveDefense`, `effectiveInventorySlotsBonus`). La mochila nunca bonifica. El resto de posesiones siguen siendo contexto narrativo que el clasificador tiene en cuenta al fijar la dificultad.

---

## 7. Flujo de un turno

```
1. El jugador escribe una acción.
2. POST /turn/classify
   a. Guards de sesión (partida terminada, tránsito ocupado, muerte pendiente, candado de turno).
   b. Validación determinista de la acción (docs/18) — puede cortar el turno aquí.
   c. Atajos deterministas (viaje, construir, saquear, recolectar…).
   d. Si nada lo resolvió: classifyAction (Cronista) →
      { requiereTirada, atributo, dificultad, razon, banda, duracionEstimadaMinutos }
   e. Si requiereTirada: el backend tira (d20 + floor(atributo/2) vs dificultad).
   f. Banda extendida/larga → CharacterTransit (lo resuelve worldTick, docs/08).
3. POST /turn/narrate (bandas instantánea/corta)
   → narrateAction (Narrador) con el resultado ya fijado + estado de mundo
   → { narration, newFacts, condicionFisica?, combateIniciado?, hito?, newItem?, … }
4. El backend valida y materializa, guarda LogEntry (canal CHARACTER), actualiza
   WorldState, XP, condición física, reino, misiones.
5. Eventos del Cronista y del mundo → LogEntry (canal WORLD), con el espaciado de la
   decisión técnica 5.
```

Dos llamadas al modelo por turno. En la Steam Deck actual un turno completo ronda un minuto (ver benchmarks en [04-decisiones-tecnicas.md](../arquitectura/04-decisiones-tecnicas.md) § 13-14).

---

## Historial de cambios

- 2026-07-16 — Diseño inicial: fórmula, umbrales, clasificación en dos llamadas, condición física + hechos libres.
- 2026-07-18 — Revertida la decisión "sin niveles/XP" (ver [10](10-niveles-xp-reino.md)). Combate pasa a modo propio ([14](14-combate-y-muerte.md)).
- 2026-07-19 — Tercer grado de éxito `con_coste`; revertido el "inventario sin bonificadores" (equipo con `statBonuses`, ampliado 2026-08-03).
- 2026-07-29 — Rediseño de atributos a 7 jugables; `sigilo` baja a secundario.
- 2026-08-22 — Remodelado de secundarios: sale `sigilo` (pasa a tirada de Destreza), se eliminan las resistencias de combate, entran `suerte`/`honor`.
- 2026-09-01 — `arcano` renombrado a `magia`; `magia`/`poderSemilla` dejan de ser secundarios.
- 2026-09-07 — Retirado `con_coste` de las tiradas de acción/combate (se mantiene en recolección).
- 2026-09-28 — Auditoría de documentación: reescrito como referencia, notas de corrección fusionadas en el texto.
