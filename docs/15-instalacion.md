# Instalación (2026-07-24, actualizado 2026-07-30 — migración local-first)

**Por qué existe este documento:** para poder valorar si merece la pena mover Tarkor a otra máquina (p. ej. una Steam Deck, para comparar tiempos de narración) sin tener que reconstruir estos pasos de memoria cada vez.

**Actualización 2026-07-30:** Tarkor es un juego de un solo jugador que corre siempre en un solo dispositivo — no hay motivo para depender de una base de datos remota. El camino por defecto ahora es **Postgres local vía podman** (sección 3bis); Supabase remoto queda documentado como alternativa solo por si algún día hiciera falta jugar de verdad desde varios dispositivos con la misma partida sincronizada.

---

## 1. Requisitos previos

- **Node.js** — usado en esta máquina: v24 (backend y frontend son proyectos `type: "module"`, sin fichero `.nvmrc` que fije una versión mínima exacta; cualquier Node 20+ debería servir).
- **Ollama** instalado y accesible en `http://localhost:11434` (o la URL que se ponga en `OLLAMA_BASE_URL`).
- **Postgres local vía podman** (ver 3bis) — `podman` es la única herramienta de contenedores presente en esta máquina (no hay `docker`/`psql`/`postgres` nativos). Necesaria la extensión **pgvector** (`LoreChunk.embedding` es de tipo `vector`).

## 2. Clonar el repo e instalar dependencias

```
git clone https://github.com/raquelccarreraA/RPG_Takor.git
cd RPG_Takor/backend && npm install
cd ../frontend && npm install
```

## 3. Configurar `backend/.env`

`backend/.env` nunca se sube al repo (está en `.gitignore`). Desde la migración local-first (2026-07-30), `DATABASE_URL`/`DIRECT_URL` apuntan al Postgres local de la sección 3bis (misma URL para las dos, no hace falta pooler en local):
```
DATABASE_URL="postgresql://tarkor:tarkor@localhost:5432/tarkor"
DIRECT_URL="postgresql://tarkor:tarkor@localhost:5432/tarkor"
```

Resto de variables (sin cambios):
- `PORT=3001`
- `OLLAMA_BASE_URL="http://localhost:11434"`, `OLLAMA_MODEL_NARRADOR="tarkor-narrador"`, `OLLAMA_MODEL_CRONISTA="qwen2.5:1.5b-instruct"`, `OLLAMA_KEEP_ALIVE="5m"`
- `PACING_MIN_MS=3000`, `PACING_MAX_MS=10000`
- `WORLD_TICK_INTERVAL_MINUTES=2`
- `TRANSIT_MAX_REAL_MINUTES=10`
- `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `SAMBANOVA_API_KEY` rellenas (cuenta propia de Tarkor); `CLOUDFLARE_*` vacías — rotación con failover para generar imágenes de la Enciclopedia, opcional: sin ninguna, esa función cae sola a Ollama local.

**Alternativa (Supabase remoto):** solo si algún día hace falta jugar de verdad desde varios dispositivos a la vez con la misma partida sincronizada — ver `.env.example` para la plantilla comentada. Si se usa, habilitar la extensión a mano igual (Prisma no la gestiona vía schema, ver comentario en `schema.prisma`): `CREATE EXTENSION IF NOT EXISTS vector;`.

El frontend no tiene `.env` — `API_URL` está hardcodeado a `http://localhost:3001` en `frontend/src/lib/api.ts` (pendiente de mover a variable de entorno). Esto significa que **backend y frontend tienen que correr en la MISMA máquina** — no vale instalar solo el frontend apuntando a un backend remoto sin tocar ese archivo primero.

## 3bis. Postgres local vía podman (por defecto desde 2026-07-30)

Contenedor `tarkor-postgres`, imagen `pgvector/pgvector:pg16` (trae pgvector ya instalado), volumen nombrado `tarkor-postgres-data` para persistencia, puerto expuesto solo en `127.0.0.1:5432`.

**Crear el contenedor (solo la primera vez):**
```
podman run -d --name tarkor-postgres \
  -e POSTGRES_USER=tarkor \
  -e POSTGRES_PASSWORD=tarkor \
  -e POSTGRES_DB=tarkor \
  -v tarkor-postgres-data:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  docker.io/pgvector/pgvector:pg16

podman exec tarkor-postgres psql -U tarkor -d tarkor -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Arrancar/parar en cada sesión de juego** (el contenedor no se reinicia solo al reiniciar la Steam Deck):
```
podman start tarkor-postgres   # antes de jugar
podman stop tarkor-postgres    # al terminar, si se prefiere no dejarlo corriendo de fondo
podman ps                      # comprobar que está arriba
```

Los datos viven en el volumen `tarkor-postgres-data`, sobreviven a `podman stop`/`start` y a reinicios de la máquina — solo se pierden con `podman volume rm tarkor-postgres-data` explícito.

## 4. Migraciones de base de datos

Con el contenedor de 3bis arriba y el `.env` apuntando a él:
```
cd backend
npx prisma migrate deploy
npx prisma generate
```
Usar `migrate deploy`, no `migrate dev` — `migrate dev` crea una base de datos "shadow" para verificar el historial completo de migraciones desde cero, y esa base "shadow" no tiene la extensión `vector` habilitada (falla con `ERROR: type "vector" does not exist` la primera vez, ver migración `20260717200323_add_lore_chunk_rag`). `migrate deploy` no usa shadow database, aplica directo.

## 5. Sembrar el mundo (SOLO la primera vez que se crea el contenedor/DB)

```
cd backend
npm run reindex-lore     # crea el World "helek-sirik" + indexa docs/rpgtarkor/*.md (necesita Ollama corriendo, usa nomic-embed-text)
npm run seed-catalog     # ubicaciones, NPCs, objetos, fauna/flora, rutas (worldCatalog.ts)
npm run seed-image-prompts  # opcional: prompts de imagen para la Enciclopedia
```

Las imágenes ya subidas (`backend/uploads/images/`) SÍ están versionadas en el repo (a diferencia de `uploads/opciones/`, que es solo staging personal y está en `.gitignore`) — no hace falta copiarlas aparte, vienen con el `git clone`.

**Después de la primera vez** (2026-08-05, bug real: varias sesiones de lore cambiaron `worldCatalog.ts` sin que nadie corriera `seed-catalog` de nuevo — el contenido nuevo no aparecía en el juego pese a estar bien en el código): `iniciar-tarkor.sh`/`.bat` ya corren `npm run seed-catalog` solo (rápido, idempotente, sin Ollama de por medio) en cada arranque, así que el catálogo nunca se queda desincronizado sin querer. `npm run reindex-lore` es más lento (necesita Ollama para los embeddings) y no se corre en cada arranque — usar `./actualizar-mundo.sh` (raíz del repo) cuando cambie `loreChunks.ts` de verdad, hace ambas cosas (`seed-catalog` + `reindex-lore`) sin necesidad de arrancar backend/frontend.

## 6. Modelos de Ollama

Tres modelos distintos, cada uno con su rol (ver `docs/03-arquitectura.md` § 4.3):

| Uso | Modelo | Cómo se obtiene |
|---|---|---|
| Narrador (narración principal) | `tarkor-narrador` (modelo propio, `FROM qwen2.5:7b`) | `ollama pull qwen2.5:7b` y luego, desde `backend/`: `ollama create tarkor-narrador -f Modelfile` |
| Cronista (clasificación de acciones) | `qwen2.5:1.5b-instruct` | `ollama pull qwen2.5:1.5b-instruct` |
| Embeddings (RAG de lore) | `nomic-embed-text` | `ollama pull nomic-embed-text` |

Si se cambia el `Modelfile` en el futuro, hay que reconstruir `tarkor-narrador` con el mismo comando `ollama create` de arriba.

## 7. Arrancar todo

La usuaria tiene `iniciar-tarkor.sh`/`detener-tarkor.sh` (Linux/SteamOS, el sistema real de uso — arranca Postgres/Ollama si hace falta, corre `seed-catalog`, y abre backend+frontend cada uno en su propia ventana de terminal) e `iniciar-tarkor.bat`/`detener-tarkor.bat` (Windows, equivalente más simple, sin la orquestación de Postgres/Ollama) en la raíz del repo. El equivalente manual, si hiciera falta, en dos terminales separadas:

```
# Terminal 1
cd backend && npm run dev:nowatch

# Terminal 2
cd frontend && npm run dev
```

Frontend en `http://localhost:5173`, backend en `http://localhost:3001`.

## Notas / limitaciones conocidas

- Todo asume **la misma máquina** para backend+frontend+Ollama+Postgres (ver nota del punto 3 sobre `API_URL` hardcodeado). Decisión deliberada (2026-07-30): Tarkor es de un solo jugador en un solo dispositivo, así que no hay motivo para pagar la complejidad de una topología distribuida.
- Postgres corre en un contenedor podman (`tarkor-postgres`, sección 3bis) — hay que arrancarlo (`podman start tarkor-postgres`) antes de `npm run dev:nowatch`, si no se ha dejado corriendo de fondo.
- El worker de fondo (`worldTick`, resuelve tránsitos largos) arranca solo con el backend, no necesita paso aparte.
