# Arquitectura técnica — Tarkor

**Estado:** vigente, comprobado contra el código el 2026-09-28.
**Qué cubre:** las piezas del sistema, cómo se hablan, dónde vive cada responsabilidad y los
principios que no se negocian. El porqué de cada decisión está en
[04-decisiones-tecnicas.md](04-decisiones-tecnicas.md); la instalación, en
[15-instalacion.md](15-instalacion.md).

---

## 1. Visión general

```
┌──────────────┐   REST + sondeo     ┌─────────────────────────┐  HTTP local   ┌──────────────┐
│  Frontend    │ ◄─────────────────► │  Backend (Fastify)      │ ────────────► │  Ollama      │
│  React SPA   │                     │  rutas · servicios puros│ localhost:    │  modelos     │
│  (Vite)      │                     │  cola Ollama · worldTick│ 11434         │  locales     │
└──────────────┘                     └───────────┬─────────────┘               └──────────────┘
                                                 │ Prisma
                                          ┌──────▼──────┐
                                          │  Postgres   │  (local, contenedor podman)
                                          └─────────────┘
```

Todo corre en la máquina del jugador (hoy, una Steam Deck). Sin servicios de pago ni cuentas. La
única excepción es opcional: la rotación de proveedores en la nube para **redactar prompts de
imagen** (`lib/aiProviders/`), que se salta si no hay claves configuradas.

---

## 2. Principios que no se negocian

1. **El motor decide, el LLM narra.** Tiradas, daño, XP, recolección, construcción, economía y
   relaciones entre facciones los calcula el backend de forma determinista. El modelo recibe el
   resultado ya fijado y lo cuenta. Si el modelo afirma algo que el motor no hizo (un objeto que no
   existe, un viaje a un lugar que no está en el mapa), el backend lo corta.
2. **Funciones puras en `services/`, efectos en el llamador.** La lógica de reglas no sabe quién la
   llama: una ruta HTTP, el bloque del turno o el `worldTick` leen de Prisma, llaman a la función
   pura y escriben el resultado.
3. **El mundo se pausa con el backend.** El reloj de ficción avanza mientras el backend corre; al
   apagarlo, todo se detiene y al volver continúa donde estaba. No hay recuperación de huecos.
4. **Una sola cola de generación.** Todas las llamadas a Ollama pasan por `ollamaQueue`
   (concurrencia 1); los embeddings, por `embedQueue`. Nunca compiten dos generaciones por la CPU.
5. **El jugador y las facciones juegan con el mismo motor** (mundo vivo, ver
   [22-mundo-vivo-x4-tecnico.md](22-mundo-vivo-x4-tecnico.md)).

---

## 3. Piezas

### 3.1 Backend — `backend/`

Node.js + TypeScript, **Fastify 5** y **Prisma 6** sobre Postgres. Sin login: usuario único
implícito (`lib/defaultUser.ts`).

| Carpeta | Qué hay |
|---|---|
| `src/server.ts` | Arranque de Fastify, registro de rutas y del `worldTick` |
| `src/routes/` | `turn.ts` (el turno: `/turn/classify` y `/turn/narrate`), `world.ts` (enciclopedia, catálogo), `factionRelations.ts`, `saves.ts` + `saves/` (29 módulos: combate, zona, compañeros, reino, parcelas, recolección, inventario, misiones…) |
| `src/services/` | Reglas puras y orquestación: tiradas (`dice.ts`), combate (`combatExchange.ts`, `combateMultiple*.ts`), resolución del turno (`turnResolution.ts`), narrador (`narrador.ts`), mundo (`worldClock.ts`, `worldAgenda.ts`, `population.ts`, `zonePoints.ts`), Reino (`kingdomTick.ts`, `kingdomProduction.ts`, `construction.ts`), facciones (`factionRelations.ts`, `economia.ts`)… |
| `src/lib/` | Cliente de Ollama y su cola, embeddings, Prisma, utilidades |
| `src/workers/worldTick.ts` | El reloj de fondo (§ 5) |
| `src/scripts/` | Catálogo del mundo (`worldCatalog.ts`), `seed-catalog.ts`, población inicial, índice de lore para RAG, datasets de fine-tuning |
| `prisma/` | Esquema (≈46 modelos) y migraciones. **Las migraciones aplicadas no se editan nunca** |

### 3.2 Frontend — `frontend/`

React 19 + Vite + Tailwind 4. Se habla con el backend por REST (`src/lib/api.ts`). No hay streaming
ni WebSocket: tras enviar una acción, el frontend espera la respuesta y, si el turno sigue
resolviéndose en segundo plano (acciones largas, tránsitos), consulta periódicamente
(`useReconnectionPolling`). `pages/GameView.tsx` es la vista de juego; los paneles viven en
`components/panels/` (Zona, Log, Personaje, Reino, Compañeros…).

### 3.3 Modelos locales (Ollama)

| Papel | Variable de entorno | Por defecto |
|---|---|---|
| Narrador (respuesta al jugador) | `OLLAMA_MODEL_NARRADOR` | `tarkor-narrador-llama31` (Llama 3.1 8B, desde el 2026-09-14, [04 § 14](04-decisiones-tecnicas.md#14-veredicto-de-modelos-alternativos-jugando-turnos-reales-en-vivo--2026-09-14)). Respaldo: `tarkor-narrador` (Qwen 2.5 7B), sin instalar desde la limpieza del 2026-09-28 |
| Cronista y clasificador de acciones | `OLLAMA_MODEL_CRONISTA` | `qwen2.5:1.5b-instruct` |
| Sugerencias | `OLLAMA_MODEL_SUGERENCIAS` | `qwen3.5:4b` |
| Embeddings (RAG de lore, hechos de sesión) | `OLLAMA_MODEL_EMBEDDINGS` | `nomic-embed-text` |

`OLLAMA_KEEP_ALIVE` (5 min) mantiene el modelo cargado entre turnos. Las salidas del modelo se
piden en JSON (`format`) y el backend las valida; si no cumplen, reintenta o cae a un texto
determinista.

### 3.4 Base de datos

Postgres local en un contenedor podman (`tarkor-postgres`). El estado de una partida vive en `Save`
y sus tablas hijas (inventario, compañeros, misiones, `LogEntry`, `SessionFact`, reino…). El mundo
compartido entre partidas vive en `World` y su catálogo (`Location`, `Npc`, `ItemCatalog`,
`Faction`, `WorldPopulation`, `ZonePoint`…), sembrado con `npm run seed-catalog`.

Cuidado: `ZonePoint` y `WorldPopulation` son **por mundo**, no por partida. No se modifican a mano
en la base de datos real para depurar (decisión B1 abierta, ver el roadmap).

---

## 4. El turno

1. El jugador escribe una acción.
2. **`POST /turn/classify`**: comprobaciones de sesión (partida terminada, tránsito, muerte
   pendiente, candado de turno), validación de la acción contra el lore
   ([18](../mecanicas/18-validacion-accion-jugador.md)), atajos deterministas (viaje, construir,
   saquear, recolectar…) y, si nada lo resolvió, clasificación por el Cronista:
   `{ requiereTirada, atributo, dificultad, banda, duración }`. El backend tira el dado.
3. Si la acción es larga, se crea un `CharacterTransit` y la resuelve el `worldTick`.
4. **`POST /turn/narrate`**: el Narrador cuenta el resultado ya fijado; el backend valida su salida
   y aplica los efectos (hechos, XP, condición física, inventario, misiones, Reino). Si el turno
   cruza medianoche de ficción, corre el tick diario (Reino, producción, facciones).

Detalle de reglas en [05-mecanicas-juego.md](../mecanicas/05-mecanicas-juego.md) y
[08-acciones-por-tiempo.md](../mecanicas/08-acciones-por-tiempo.md).

---

## 5. El reloj de mundo

- **Reloj de ficción:** `WorldState.fictionalMinutes`. Por defecto, 1 minuto real = 20 de ficción
  (`FICTION_MINUTES_PER_REAL_MINUTE`) para las esperas reales; el reloj de ficción avanza siempre
  el total, sin comprimir.
- **`worldTick`** corre cada `WORLD_TICK_INTERVAL_MINUTES` (2 min reales) mientras el backend está
  encendido: resuelve tránsitos vencidos, hace crecer la población, sincroniza la población de las
  facciones, avanza la agenda de mundo, aplica hambre y sed, y resuelve cadáveres y
  convalecencias. El reparto exacto entre turno y `worldTick` está en
  [22-mundo-vivo-x4-tecnico.md § 4](22-mundo-vivo-x4-tecnico.md#4-relojes-qué-avanza-y-cuándo).

---

## 6. Ritmo en sesión

Distinto del `worldTick`: controla cuándo aparecen entradas **secundarias** en los paneles durante
un turno (p. ej. un evento del Cronista tras la respuesta del Narrador). Espera un tiempo aleatorio
entre `PACING_MIN_MS` y `PACING_MAX_MS` (3-10 s por defecto, `config/pacing.ts`). La respuesta a la
acción del jugador nunca se retrasa a propósito.

---

## 7. Pruebas

- **Backend:** vitest. Los tests `*.integration.test.ts` usan Postgres real y se ejecutan en serie;
  el resto, en paralelo. Los de integración necesitan Ollama encendido para los embeddings.
- **Frontend:** vitest + Testing Library.
- **Compilación:** `npx tsc -b` en cada paquete (el frontend usa referencias de proyecto; `tsc` sin
  `-b` no comprueba nada).
- **En vivo:** herramienta Playwright en `tools/playwright-e2e/` y el runbook
  [revisar-partida.md](../runbooks/revisar-partida.md).

---

## Historial

- **2026-07-16** — Diseño inicial: backend Node/TS, Ollama local, worker de reloj, cola
  serializada, ritmo configurable. Máquina de entonces: i7-4700MQ sin GPU útil, con `qwen2.5:7b` de
  Narrador y `llama3.2` de Cronista (este nunca llegó a usarse). Base de datos prevista en Supabase.
- **2026-07-30** — Migración a local-first: Postgres en podman en vez de Supabase
  ([15-instalacion.md § 3bis](15-instalacion.md)).
- **Agosto de 2026** — Máquina de desarrollo: Steam Deck. Narrador propio (`tarkor-narrador`),
  Cronista `qwen2.5:1.5b-instruct`.
- **2026-09-14** — Ronda de rendimiento de Ollama en la iGPU; narrador pasa a
  `tarkor-narrador-llama31`.
- **Septiembre de 2026** — Mundo vivo estilo X4 (Reino, facciones, producción);
  ver [22-mundo-vivo-x4-tecnico.md](22-mundo-vivo-x4-tecnico.md).
- **2026-09-28** — Reescrito como descripción vigente; el diseño de julio queda resumido en este
  historial.
