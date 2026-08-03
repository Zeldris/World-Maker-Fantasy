# Nuevo elemento de catálogo — runbook

**Qué es:** el checklist real para cuando se añade un objeto, NPC/fauna, habilidad, ubicación o
personaje jugable nuevo — para que desde el primer día tenga las dos cosas que la auditoría de
"linkability + doble descripción" (2026-07-30) encontró que faltaban en más de la mitad del
catálogo: (1) una descripción real de cara al Narrador, no solo a la Enciclopedia, y (2) que sea
"linkable" (clicable/descubrible) aunque la narración no use su nombre exacto y completo.

Ver también `docs/revisar-partida.md` (mismo espíritu de runbook), la memoria
`tarkor_auditoria_linkability_doble_descripcion_2026-07-30` (Claude Code), y
`docs/puntos-de-codigo-nuevo-contenido.md` (mapa completo de qué ARCHIVOS tocar además de los
campos del catálogo — gotchas de compilación, colisión de alias frontend vs backend, mapa visual,
etc.).

## 1. Objeto nuevo (`ItemCatalog`, `worldCatalog.ts` § `items`)

Campos a rellenar, y por qué cada uno importa:

- `name`: el nombre completo de catálogo — el que ve la Enciclopedia y el que usa
  `entityDiscovery.ts`/`enciclopediaIndex.ts` por defecto.
- `description`: **esta SÍ llega al Narrador** — vía `equippedItemsSummary()` (equipment.ts, si el
  objeto se equipa) o vía `itemsLine()` (npcScene.ts, si lo lleva un NPC). Escríbela pensando en
  que el modelo la puede citar directamente en la narración, no solo como ficha de la Enciclopedia.
- `aliases?: string[]` — formas cortas/coloquiales de referirse al objeto ("hacha de mano" en vez
  de "Hacha de mano orca"). Añadir SOLO si:
  1. El nombre completo es largo/verboso (objetos ya cortos de 1-2 palabras no lo necesitan).
  2. El alias candidato **no es un sustantivo genérico sin calificador** — nunca "pantalones",
     "daga", "hacha" a secas. Un alias corto y sin capacidad de venta como los `res`/"presas" del
     runbook de NPCs de abajo produce el mismo bug: `entityDiscovery.ts` usa `.includes()` SIN
     límite de palabra, así que un alias que sea substring del nombre de OTRO objeto lo
     "descubre" falsamente en cuanto se menciona el otro.
  3. Verificar SIN colisión contra el resto del catálogo (y contra npc/fauna/location/personaje,
     que comparten el mismo mapa de texto clicable en `enciclopediaIndex.ts`) antes de darlo por
     bueno. No hay un script permanente para esto — se escribió uno de un solo uso
     (`_checkItemAliases.ts`, ver la auditoría 2026-07-30) y se borró al terminar; si hace falta
     nuevo, recrearlo es rápido: recorrer `items`/`npcs`/`fauna`/`locations`/`BERIG_PERSONAJES` con
     `normalizeText` (travel.ts) y comprobar `.includes()` bidireccional.

Después de editar `worldCatalog.ts`:

```
cd backend
npm run seed-catalog   # upsert contra el Postgres LOCAL (podman, ver docs/15-instalacion.md) — SÍ actualiza partidas ya en curso
```

`migrate dev` NUNCA en este proyecto (la shadow DB no tiene `vector` — ver docs/15-instalacion.md
§ 4); si el cambio necesita tocar `schema.prisma`, escribir la migración a mano y aplicar con
`npx prisma migrate deploy` + `npx prisma generate`.

## 2. NPC/fauna nuevo (`Npc`, `worldCatalog.ts` § `npcs`/`fauna`)

Ya tenía buen soporte desde antes — solo recordatorio:

- `aliases: string[]` es **obligatorio** (no opcional como en items) — sin él, `detectNpcsInScene`
  nunca lo encuentra en escena. Mismo cuidado con sustantivos cortos/genéricos que en items (ver
  el propio `docs/revisar-partida.md` § 3, los bugs reales de "res"/"presas"/"brasas").
- `bio` llega al Narrador entero vía el bloque "PERSONAJE EN ESCENA" (npcScene.ts) — es la
  "descripción de prompt" real de un NPC, ya bien resuelta.
- `loadout` (armas/objetos que lleva) usa `ItemCatalogInput.aliases` del punto 1 automáticamente
  en cuanto ese objeto los tenga — nada que hacer aparte.

## 3. Habilidad nueva (clase/arma/racial/genérica)

Patrón ya consolidado en `weaponAbilities.ts`/`classAbilities.ts`/`berigLore.ts`/
`genericCombatAbilities.ts`/`dynamicAbilities.ts` — replicarlo:

- `description`: 3ª persona, de cara al tooltip/Enciclopedia.
- `promptText`: 1ª persona, lo que de verdad se manda al Narrador como acción del jugador.
- `effect` (`AbilityEffect`: ATAQUE/ATURDIMIENTO/REMATE/INTIMIDACION/AGUANTE): si la habilidad hace
  algo más que un golpe normal, el motor YA sabe comunicárselo al Narrador vía
  `abilityEffectHint` (turnResolution.ts, resolveCombatExchangePhase) — no hace falta escribir
  nada especial en `promptText` para que el efecto "se note", el hint determinista ya lo cubre.

## 4. Ubicación nueva (`Location`, `worldCatalog.ts` § `locations`)

- `aliases: string[]` ya es obligatorio en el schema — para el matcher de viaje (`travel.ts`) Y
  (desde 2026-07-30) también para el texto clicable (`enciclopediaIndex.ts`).
- `description`: es la que se inyecta al Narrador al llegar/estar ahí (`turnResolution.ts`) — ya
  bien resuelta, sin cambios de este runbook.

## 5. Personaje jugable alternativo (`BERIG_PERSONAJES`, `berigLore.ts`)

- `aliases?: string[]`: nombre de pila si el nombre completo tiene apellido ("Dessa" para "Dessa
  Kaltrenn") — mismo criterio de riesgo que el resto: solo nombres propios, nunca un sustantivo
  genérico.

## 6. Verificación antes de dar por cerrado

```
cd backend  && npm run lint && npx tsc --noEmit && npx vitest run
cd frontend && npm run lint && npx tsc -b        && npx vitest run
```

Si se tocó `schema.prisma` o `worldCatalog.ts`, correr `npm run seed-catalog` (backend) para que
el Postgres local ya sembrado refleje el cambio — editar solo el archivo TS no basta.
