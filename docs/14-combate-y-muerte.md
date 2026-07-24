# Combate, muerte y descanso (diseño, 2026-07-18)

**Estado:** diseño cerrado para revisión — nada de esto está implementado todavía.
**Origen:** la usuaria pidió que las acciones de banda corta (buscar, recolectar) revelen hallazgos concretos de forma progresiva en vez de una narración única, que todo lo interactuable (objetos, NPCs) funcione como las habilidades (icono clicable que compone la acción), y que el combate viva en un modo aparte por turnos — lo que a su vez forzó la pieza que llevaba pendiente desde `docs/06-decisiones-mecanicas.md`: la condición física real. El sistema de muerte/descanso surgió de ahí, con una pieza de canon nueva de la propia usuaria (la Entidad Desconocida, ver `docs/rpgtarkor/genesis.md`).

**Qué NO se toca:** la fórmula de tirada, los umbrales de dificultad, el sistema de niveles/XP, el grafo de ubicaciones de `docs/12` (los puntos de descanso son un USO nuevo de `Location`, no un sistema paralelo).

---

## 1. Condición física — por fin implementada

Decisión de mecánicas 3 (`docs/06-decisiones-mecanicas.md`), nunca llevada al schema. Campo estructurado en `Save`:

```prisma
enum CondicionFisica {
  ILESO
  HERIDO
  GRAVE
  INCAPACITADO
  MUERTO
}
```

En `Save`: `condicionFisica CondicionFisica @default(ILESO)`.

- La narración de combate (§ 2) es la vía principal para cambiarla — el JSON de narración gana un campo opcional `condicionFisica?: CondicionFisica` que el backend valida (nunca deja que suba dos escalones de golpe salvo excepción explícita del Narrador, nunca la baja el modelo fuera de combate).
- Curar/descansar (§ 4) es la vía principal para mejorarla.
- `INCAPACITADO` no es lo mismo que `MUERTO`: incapacitado significa fuera de la acción actual (inconsciente, inmovilizado) pero recuperable sin la intervención de la Entidad; `MUERTO` es lo que dispara § 4.

---

## 2. Combate: modo aparte, por turnos, en popup

### 2.1 Detección y entrada

La narración normal (dentro del flujo ya existente de `/turn/narrate`) gana un campo opcional `combateIniciado: { npcSlugs: string[] } | null`. Cuando el Narrador resuelve una escena que deriva en enfrentamiento real, lo marca ahí — el backend no lo infiere por regex (a diferencia de viajar o recolectar, un inicio de combate depende demasiado de contexto narrativo para reducirlo a palabras clave fiables).

El frontend, al recibir `combateIniciado`, no narra el combate en los logs normales: muestra un aviso en rojo y clicable — **"⚔️ Combatir"** — al final de la narración. El jugador decide cuándo entrar (permite terminar de leer, no fuerza el popup). Mientras `combateIniciado` esté pendiente de abrirse, el composer normal queda deshabilitado (igual que hoy con `busyUntil`) — no se puede seguir jugando fuera mientras hay un combate sin resolver.

### 2.2 El popup

Contenido:
- **NPCs en escena**: nombres clicables (mismo patrón que inventario/habilidades) — sacados de `Npc` vía los `npcSlugs` de `combateIniciado`. Cada uno muestra su condición física actual de esta pelea (§ 2.4).
- **Habilidades de combate**: solo la pestaña "Combate" de `SavedAction` (ya construida) — las generales no tienen sentido aquí y no se muestran.
- **Composer de combate**: mismo mecanismo de adjuntos combinables que el composer normal (§ 3), pero acotado a este contexto — habilidad/objeto + NPC objetivo → `"Atacar con maza 'Orco 1'"`.
- **Huir**: acción siempre disponible, no requiere tirada para intentarla salir del popup — si el jugador la usa, se resuelve como una acción más (puede fallar narrativamente, igual que cualquier otra).

### 2.3 Turno de combate

Cada turno dentro del popup es un turno normal (`/turn/classify` + `/turn/narrate`) con un flag `enCombate: true` añadido al contexto: cambia el estilo de la instrucción de narración (más corta, más directa, sin ambientación de relleno — el ritmo de un intercambio, no una escena) y activa la lectura/escritura de `condicionFisica` en cada resolución. La clasificación de dificultad usa la calibración por nivel de NPC ya diseñada en `docs/12` § 2.2.

### 2.4 Condición física en combate — por bando

Un combate puede tener varios NPCs; cada uno lleva su propia condición física **de esa pelea**, no persistida en `Npc` (que es catálogo de mundo, no estado de partida) — vive en el `zoneContext` del combate activo (ver § 2.5) mientras dura, y se descarta al terminar (salvo lo que el Narrador decida guardar como hecho: "el Orco rezagado escapó herido" sí puede quedar en `WorldState.facts`, sus números no).

### 2.5 Estado del combate activo

No hace falta un modelo nuevo — reutiliza el patrón de `CharacterTransit` pero sin tiempo de espera real (el combate no es una acción en diferido, es una serie de turnos síncronos). Basta un campo en memoria de sesión del lado del frontend (qué NPCs siguen en pie, su condición) más lo que cada turno ya persiste (LogEntry, XP, condición física del jugador). Si se necesita sobrevivir a un refresco de página a mitad de combate, se añade más adelante un `CombatSession` — no se diseña aquí por no ser necesario para v1 (nadie ha pedido persistencia de combate a mitad de pelea todavía).

### 2.6 Fin del combate

- **Victoria**: los NPCs derrotados entran en el flujo de loot ya diseñado (`docs/12` § 4.5) — el popup ofrece "Registrar" sobre cada NPC vencido. Cierra el popup, vuelve al flujo normal.
- **Huida exitosa**: cierra el popup, el personaje puede acabar en tránsito (banda extendida si huir implica alejarse de verdad) o simplemente vuelve a la escena normal.
- **Derrota** (condición física del jugador llega a `MUERTO`): dispara § 4, no un "fin de combate" normal.

---

## 3. Interactuables: objetos, materiales y NPCs como habilidades

Generalización del `ComposerAttachment` ya construido (`frontend/src/types.ts`). Hoy soporta `ability` e `item` (inventario); se amplía a cualquier cosa clicable que aparezca en una narración o revelado:

```ts
export type ComposerAttachment =
  | { type: 'ability'; ability: SavedActionInfo }
  | { type: 'item'; item: InventoryItemInfo }
  | { type: 'discoveredItem'; name: string; itemCatalogSlug: string; cantidad: number }
  | { type: 'npc'; name: string; npcSlug: string }
```

**Composición verbo + objetivo:** hasta ahora los adjuntos solo se concatenaban (`buildActionText`). Se añade una regla de plantilla cuando hay un adjunto de tipo `ability`/verbo y uno de tipo `npc`/`discoveredItem`/objetivo en la misma tanda:

```
"{promptText de la habilidad, ya en su forma natural} '{nombre del objetivo}'"
```

Ejemplo real: habilidad "Furia de Maktor" (prompt: *"Suelto un rugido de guerra y cargo contra mi enemigo, descargando mi hacha rota..."*) + NPC "Orco 1" → *"Suelto un rugido de guerra y cargo contra mi enemigo, descargando mi hacha rota... 'Orco 1'."* — funciona porque los prompts de habilidad ya están redactados en primera persona con el enemigo implícito ("mi enemigo"); añadir el nombre entre comillas al final desambigua el objetivo sin tener que reescribir cada prompt. Para recolección, la plantilla usa cantidad explícita: `"Recojo {cantidad} '{nombre}'."` cuando el adjunto es `discoveredItem` sin habilidad asociada.

### 3.1 Revelado progresivo (búsquedas y recolección)

Cuando una acción de banda corta es de tipo búsqueda/recolección (mismo detector determinista que ya existe para viajar en `docs/12` § 1.4, ampliado con verbos de buscar/recolectar), el flujo cambia:

1. **Backend, determinista**: antes de narrar, decide QUÉ se encuentra — lee `HarvestYield`/`ItemCatalog` de las especies/recursos reales de la `Location` actual (o su región), y arma una lista fija de 2-4 hallazgos. El modelo no inventa qué hay, igual que en todo `docs/12`.
2. **Backend**: una sola llamada de narración describe la escena general (no cada objeto individual) — el coste en Ollama no crece con el número de objetos.
3. **Frontend**: muestra un contador (duración = `duracionMinutos` de la clasificación, comprimida a una espera visual razonable — no literalmente minutos de reloj) y va revelando la lista ya decidida en el paso 1 uno a uno, cada uno como un `discoveredItem` clicable, mientras el contador baja. Al llegar a 0, aparece también la prosa del paso 2.
4. El jugador puede clicar cualquier hallazgo (incluso antes de que el contador termine) para adjuntarlo al composer y decidir qué hacer con él — recogerlo, ignorarlo, usarlo en combinación con otra cosa.

---

## 4. Muerte y descanso — la Entidad Desconocida

### 4.1 Puntos de descanso

Un `Location` cuenta como punto de descanso válido si `kind` ∈ {`refugio`, `asentamiento`} — nunca un `hito` o `cruce` de paso. "Descansar" reconoce estos tipos automáticamente; no hace falta un campo nuevo en `Location`.

```prisma
// En Save:
lastRestLocationId String?
lastRestLocation   Location? @relation(fields: [lastRestLocationId], references: [id])
```

Se actualiza cuando una acción de descanso/acampar (banda extendida o larga, ya detectada por `timedActions.ts`) se resuelve con éxito **estando en** un `Location` válido. Si el jugador "descansa" en terreno abierto (sin `Location` válido en `currentLocationId`), no cuenta como punto de guardado — puede recuperar condición física narrativamente si el Narrador lo concede, pero no mueve el punto de reaparición.

### 4.2 Dificultad — el límite de muertes es una elección del jugador, no un número fijo

Tres modos, elegidos al crear la partida (mismo momento que elegir personaje — un paso más en el flujo de creación, no una pantalla nueva separada):

```prisma
enum Dificultad {
  NOVATO   // sin límite de muertes — la Entidad siempre responde
  MEDIO    // límite 4 (3 se perdonan, la 3ª ya avisa, la 4ª es definitiva)
  AVANZADO // límite 2 (1 se perdona y avisa, la 2ª es definitiva)
}
```

En `Save`: `dificultad Dificultad @default(MEDIO)`.

```prisma
// En Save:
deathCount Int @default(0)
```

`limiteMuertes(dificultad)`: `NOVATO` → sin límite (∞, nunca dispara fin de partida); `MEDIO` → 4; `AVANZADO` → 2. Determinista, en `backend/src/services/death.ts` — una función pura, mismo estilo que `progression.ts`.

### 4.3 Flujo al llegar a MUERTO

```
1. condicionFisica llega a MUERTO (en combate, § 2, o cualquier otra resolución).
2. deathCount += 1.
3. limite = limiteMuertes(save.dificultad).
4. Si dificultad != NOVATO y deathCount >= limite: FIN DE PARTIDA (ver § 4.4) — no hay
   más turnos, no hay respawn, la Entidad no vuelve a susurrar.
5. Si no (incluye SIEMPRE el caso NOVATO): resolución determinista (sin pasar por el
   modelo grande el texto exacto de la Entidad, aunque el Narrador SÍ narra el instante
   previo de la muerte con normalidad):
   - condicionFisica → ILESO
   - currentLocationId → lastRestLocationId (si es null, fallback al Location inicial del
     personaje — nunca deja al jugador sin dónde aparecer)
   - LogEntry determinista (channel CHARACTER) con el susurro:
     "...un frío total, y entre la nada una voz que no es de este mundo susurra: 'Aún no
     ha llegado tu momento...' [nombre] despierta de golpe, como de una pesadilla, en
     [nombre del lugar de descanso]."
   - Si dificultad != NOVATO y deathCount == limite − 1 (la última que se perdona):
     añade una frase de aviso propia — la Entidad avisa de que es la última vez. En
     NOVATO nunca se añade este aviso (no hay una "última vez").
   - Nada más se deshace: XP, hechos, inventario, nivel — todo lo conseguido desde el
     último descanso se queda. El único coste es narrativo (el hecho de haber muerto
     una vez más queda registrado) y, salvo en NOVATO, el contador en sí, que se acerca
     al límite.
```

Ejemplo con AVANZADO (límite 2): la 1ª muerte respawnea con aviso de última oportunidad; la 2ª es fin de partida. Con MEDIO (límite 4): las muertes 1ª y 2ª respawnean sin aviso especial, la 3ª respawnea con aviso, la 4ª es fin de partida. Con NOVATO: siempre respawnea, nunca hay fin de partida por muerte.

### 4.4 Fin de partida (4ª muerte)

No es lo mismo que "borrar" ni "reiniciar" (`docs/` ya tiene ambos). Es un tercer estado: la partida sigue existiendo (no se borra), pero no se puede seguir jugando. Campo:

```prisma
// En Save:
endedAt DateTime?
```

`endedAt` no nulo bloquea `/turn/classify` (mismo patrón 409 que `CharacterTransit`, mensaje distinto) y el frontend muestra la partida como cerrada en `CharacterSaves.tsx` — desde ahí se puede reiniciar (vuelve a `deathCount = 0`, `endedAt = null`, como cualquier otro reinicio) pero no continuar tal cual.

---

## 5. Resumen de migraciones y campos

**Migración 5:** en `Save` — `condicionFisica CondicionFisica @default(ILESO)` (+ enum), `lastRestLocationId String?` (+ relación, requiere que exista ya `Location` de `docs/12` migración 3), `deathCount Int @default(0)`, `dificultad Dificultad @default(MEDIO)` (+ enum), `endedAt DateTime?`.

**Sin modelos nuevos** para combate (v1 vive en memoria de sesión + los modelos ya existentes de `docs/12`).

**Dependencia de orden:** este documento necesita `Location` (`docs/12` migración 3) para `lastRestLocationId` y para calibrar qué cuenta como descanso válido, y necesita `Npc`/`ItemCatalog`/`HarvestYield` (`docs/12` migración 4) para el combate y el revelado progresivo. No se puede implementar antes que `docs/12`.

---

## 6. Estado de implementación (actualizado 2026-07-18)

1. ~~**Migración 5**~~ — **hecho**: `CondicionFisica`/`Dificultad` (enums) + `Save.condicionFisica/lastRestLocationId/deathCount/dificultad/endedAt`.
2. ~~**Selector de dificultad en la creación de partida**~~ — **hecho**: `SessionContext` guarda `selectedDificultad`, seleccionable en `CharacterSaves.tsx` (Novato/Medio/Avanzado con frase corta) justo antes de "+ Nueva partida"; se manda en `POST /saves`.
3. ~~**Detección de descanso válido**~~ — **hecho**: `detectsRestIntent()` (movido a `timedActions.ts`, mismo regex que ya usaba `computeDuration`) + `isValidRestLocationKind()` en `death.ts`, enganchado en `turnResolution.ts` — verificado en vivo: descansar en La Hondonada del Eco (kind refugio) fija `lastRestLocationId` correctamente.
4. ~~**Flujo de muerte determinista**~~ — **hecho**: `backend/src/services/death.ts` (`limiteMuertes`, `resolveDeathOutcome`, `whisperText`, `nextCondicionFisica`, `isValidRestLocationKind`), enganchado en `turnResolution.ts` donde `condicionFisica` pasa a `MUERTO`. Verificado con pruebas unitarias puras (los 3 niveles de dificultad, avisos de última oportunidad, fin de partida) — todas correctas.
5. ~~**Combate**~~ — **hecho**: `combateIniciado`/`condicionFisica` en el JSON de `narrateAction` (enriquecido con nombres de NPC antes de llegar al frontend), `CombatModal.tsx` con composer propio (habilidades de categoría combate + NPCs clicables + Huir), flag `enCombate` que cambia el tono del prompt y las reglas de `nextCondicionFisica`. **Simplificación v1 explícita**: la condición física de los NPCs durante el combate es un heurístico puramente visual del propio `CombatModal` (sube un escalón si la tirada del jugador tiene éxito) — no hay modelo de datos para combate, tal y como decide el propio § 2.5.
6. ~~**`ComposerAttachment` ampliado**~~ — **hecho**: variantes `discoveredItem`/`npc` + plantilla verbo+objetivo en `buildActionText` (`GameView.tsx`) — empareja habilidad+objetivo por índice, con fallback para hallazgos sueltos ("Recojo...") y NPCs sueltos.
7. ~~**Revelado progresivo**~~ — **hecho**: `backend/src/services/discovery.ts` (detector de búsqueda genérica + selección de 2-4 hallazgos desde `HarvestYield`, calculado en `/turn/classify` para que el frontend arranque el contador de inmediato) + `DiscoveryReveal.tsx` (revelado con temporizador comprimido, hallazgos clicables).
8. ~~**`CharacterSaves.tsx`**~~ — **hecho**: partidas con `endedAt` se muestran como "Partida terminada" (no navegables, pero reiniciables/borrables), badge de dificultad visible en cada partida.

**Verificado en vivo (2026-07-18)** contra una partida desechable de prueba (creada y borrada en la misma sesión, dificultad AVANZADO): creación con dificultad → `GET /saves/:id` la refleja → forzar `endedAt` a mano bloquea `/turn/classify` con 409 (`{"error":"Esta partida ha terminado", ...}`) → `/saves/:id/restart` resetea `condicionFisica`/`deathCount`/`endedAt` mantendiendo la `dificultad` elegida → turno real de descanso (con Ollama) narra sin errores por los campos nuevos del JSON (`condicionFisica`, `combateIniciado`) y fija `lastRestLocationId` correctamente. Las 5 funciones puras de `death.ts` verificadas con casos concretos de las 3 dificultades (avisos de última oportunidad, fin de partida en el límite exacto).

**No verificado en vivo (limitación práctica, no bug conocido)**: la transición real a `MUERTO` vía el modelo (no se puede forzar de forma fiable que Ollama devuelva ese valor concreto en una prueba dirigida) y el popup de combate en navegador (requiere UI real, no solo curl) — ambos revisados a mano y compilan/tipan limpio, pero sin partida jugada de verdad todavía. Recomendado: la próxima vez que la usuaria juegue con Gorhorn, provocar un combate real y forzar una muerte para confirmar el flujo completo de extremo a extremo.
