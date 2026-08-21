# Instalador distribuible (investigación, 2026-08-20)

**Por qué existe este documento:** la usuaria preguntó si sería posible empaquetar Tarkor como
un instalador de escritorio de verdad — que cargue como una app, sin depender de desplegar en un
dominio público ni de abrir un navegador apuntando a una URL. Esto es solo la investigación de
viabilidad; **no se ha tocado ningún código todavía**. Sirve de punto de partida cuando se decida
abordarlo de verdad.

No confundir con `docs/15-instalacion.md` — ese documento es la guía para instalar el **entorno de
desarrollo** (clonar el repo, levantar Postgres vía podman, `npm install`...). Este documento habla
de generar un **paquete distribuible** para alguien que no va a tocar código ni terminal.

## 1. Por qué hoy no se puede simplemente "empaquetar"

Tarkor hoy son tres piezas separadas que hay que arrancar a mano: backend Fastify (Node), frontend
Vite/React servido aparte, y Postgres en un contenedor podman (`docs/15-instalacion.md` § 3bis). Un
instalador de escritorio normal no puede depender de que el usuario tenga podman instalado y un
contenedor de Postgres corriendo — todo tiene que arrancar solo, como una app.

## 2. Arquitectura propuesta

**Tauri** (en vez de Electron: usa el webview del sistema operativo en vez de empaquetar Chromium
entero, así que el instalador resultante pesa bastante menos) envolviendo:
- El frontend ya compilado (build de Vite) cargado directamente en el webview.
- El backend Node como proceso "sidecar" — un binario que Tauri arranca y para junto con la propia
  app, hablando por `localhost` con el frontend exactamente igual que en desarrollo.
- Base de datos **local al propio paquete**, sin contenedor ni servicio externo que instalar aparte
  (ver § 3).

Con esto, "instalar el juego" pasa a ser un único instalable por plataforma (.exe/.dmg/.AppImage),
sin dominio público, sin navegador, sin pasos manuales de Postgres/podman.

## 3. El obstáculo real: Postgres

Se auditó el `schema.prisma` completo y el código real (`grep` de `$queryRaw`/`$executeRaw` en
`backend/src`) para ver cuánto del motor depende de verdad de Postgres en vez de SQL genérico. La
dependencia es más superficial de lo que parecía — tres puntos concretos, nada más:

### 3.1 pgvector (el más importante)

`LoreChunk.embedding` y `SessionFact.embedding` son `Unsupported("vector(768)")` — la extensión
`pgvector`, habilitada a mano (`CREATE EXTENSION vector`, ver comentario del `datasource` en
`schema.prisma`), no gestionada por Prisma. Se usa en exactamente dos sitios con SQL crudo:

- `backend/src/services/retrieval.ts` (líneas ~31-36) — RAG de lore: `ORDER BY embedding <=>
  ${queryLiteral}::vector`.
- `backend/src/services/worldFacts.ts` (líneas ~104-143) — recuperación de `SessionFact` por
  relevancia (ver memoria `tarkor_sessionfacts_relevancia_2026-07-30`), mismo operador `<=>`
  (distancia coseno).

SQLite no tiene pgvector. Pero Tarkor es un juego de un solo jugador, local: las tablas con
embeddings son pequeñas POR PARTIDA (cientos de filas, no millones) — no hace falta una extensión
de base de datos para esto. **Alternativa viable:** guardar el embedding como JSON (array de 768
floats) y calcular la similitud coseno en memoria, en JS, al leer las filas candidatas. A esa
escala el coste es insignificante; se pierde el índice `ivfflat`/`hnsw` de pgvector, pero nunca
llegó a hacer falta un índice para este volumen de datos.

### 3.2 Un `SELECT ... FOR UPDATE`

`backend/src/routes/saves/progression.ts` (~línea 46) usa `FOR UPDATE` para bloquear la fila de
`Save` mientras se resuelve una subida de atributo — arregla un bug real (doble clic/doble pestaña
duplicando el gasto de un punto de ascenso, ver comentario en el propio archivo). `FOR UPDATE` es
sintaxis estándar SQL que SQLite no soporta igual (bloquea la base de datos entera, no por fila).

En un instalador de escritorio de un solo proceso local, el problema que este candado resolvía dejo
de existir de la misma forma: ya no hay dos pestañas de navegador hablando con un servidor
compartido por red, solo un proceso local. Se puede sustituir por un mutex en memoria (un `Map` de
locks por `saveId`, o una cola de promesas) — más simple que el original, no un downgrade.

### 3.3 Columnas de array nativo

12 campos `String[]`/`AbilityEffect[]` en el schema (`World.factions`, `Location.aliases`,
`Save.unlockedRecipeKeys`, `LoreChunk.tags`, `SavedAction.effects`, `Quest.rewardItems`,
`Quest.rewardRecipeKeys`, `Npc.aliases`, `LogEntry` no tiene pero `Building.lootedItemNames` sí,
`CraftingRecipe.herramientaParaOficio`, `HarvestYield.aliases`, y algún otro — ver
`grep -n '\[\]$' prisma/schema.prisma` para la lista exacta y actualizada). Prisma no soporta
listas escalares nativas contra SQLite — hay que convertir cada uno a un campo `String` con JSON
serializado a mano (mismo patrón que ya usan varios campos `Json` del propio schema, no es una
técnica nueva en este código).

## 4. Lo que NO hay que tocar

El resto del schema es SQL estándar sin nada específico de Postgres: todas las columnas `Json`
(bonificadores, atributos, agenda del mundo...), todos los enums, todas las relaciones y índices
normales, y el resto de queries de Prisma Client (`findMany`/`update`/transacciones normales) — eso
funciona igual contra SQLite sin cambios.

## 5. Alternativas descartadas o aparcadas

- **Bundlear un binario portable de Postgres** dentro del instalador (en vez de migrar a SQLite):
  evita tocar el schema y las dos queries de vector, pero complica el empaquetado por plataforma y
  no resuelve el problema de raíz — seguiría haciendo falta compilar/distribuir pgvector junto al
  binario, que no siempre trae extensiones de terceros de serie. Descartado por más complejo sin
  beneficio claro dado que la migración a SQLite es acotada.
- **Electron** en vez de Tauri: funcionaría igual de bien técnicamente (mismo patrón de sidecar),
  pero el instalador resultante pesa bastante más al empaquetar Chromium completo. Sin motivo para
  preferirlo aquí.
- Mantener Postgres +remoto (Supabase) para el instalador: no tiene sentido — el objetivo explícito
  de la usuaria es NO depender de un dominio público.

## 6. Si se retoma esto: orden de trabajo sugerido

1. Sustituir las dos queries `<=>` (retrieval.ts, worldFacts.ts) por similitud coseno en JS,
   guardando el embedding como JSON en vez de `vector(768)` — probar primero contra el propio
   Postgres de desarrollo (esto no depende de SQLite para funcionar, se puede validar aparte).
2. Sustituir el `FOR UPDATE` de `progression.ts` por un mutex en memoria por `saveId`.
3. Convertir los 12 campos array nativo a `String` con JSON serializado (migración de schema +
   arreglar cada sitio que lee/escribe esos campos).
4. Cambiar el `datasource` de `schema.prisma` a `sqlite` para la build empaquetada (probablemente
   como variante de build, no sustituyendo Postgres en desarrollo — decidir si se mantienen los dos
   `schema.prisma` o uno con `datasource` parametrizado).
5. Montar el envoltorio Tauri: sidecar del backend Node, frontend compilado, primer arranque
   creando el `.sqlite` local si no existe (equivalente a `prisma migrate deploy` empaquetado).
6. Probar el instalador real en la propia Steam Deck (o la máquina que se use) antes de dar el
   trabajo por terminado — el resto del proyecto sigue el mismo criterio de "probar en vivo, no solo
   que compile" para cualquier cambio de esta envergadura.

Nada de esto está calendarizado ni decidido — queda aquí documentado para no perder la
investigación cuando se decida (o no) seguir adelante.
