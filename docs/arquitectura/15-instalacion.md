# Instalación

**Por qué existe este documento:** para no tener que reconstruir de memoria los pasos de instalación cada vez que Tarkor se mueve o se reinstala en una máquina — el traslado a Steam Deck (motivo original de este documento, para comparar tiempos de narración) ya se hizo y es la máquina real de desarrollo/juego desde entonces.

**Actualización 2026-07-30:** Tarkor es un juego de un solo jugador que corre siempre en un solo dispositivo — no hay motivo para depender de una base de datos remota. El camino por defecto ahora es **Postgres local vía podman** (sección 3bis); Supabase remoto queda documentado como alternativa solo por si algún día hiciera falta jugar de verdad desde varios dispositivos con la misma partida sincronizada.

---

## 1. Requisitos previos

- **Node.js** — backend y frontend son proyectos `type: "module"`, sin fichero `.nvmrc` que fije una versión mínima exacta; cualquier Node 20+ debería servir. En la práctica, tanto `iniciar-tarkor.sh` como `actualizar-mundo.sh` fijan `nvm use 22` en cada ventana nueva que abren (ver `NVM_INIT` en ambos scripts) — usar la 22 si hay dudas de cuál instalar.
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

Resto de variables:
- `PORT=3001`
- `OLLAMA_BASE_URL="http://localhost:11434"`, `OLLAMA_MODEL_NARRADOR="tarkor-narrador"`, `OLLAMA_MODEL_CRONISTA="qwen2.5:1.5b-instruct"`, `OLLAMA_MODEL_SUGERENCIAS="qwen3.5:4b"`, `OLLAMA_KEEP_ALIVE="5m"`
- `PACING_MIN_MS=1000`, `PACING_MAX_MS=5000` (bajados desde 3000/10000 originales — sin fecha exacta registrada, `.env.example` se quedó con los valores viejos)
- `WORLD_TICK_INTERVAL_MINUTES=1` (bajado de 2 a 1 el 2026-08-07, junto con `TRANSIT_MAX_REAL_MINUTES` de abajo — ver comentario en `.env`)
- `TRANSIT_MAX_REAL_MINUTES=5` (bajado de 10 a 5 el 2026-08-07, el rendimiento del motor mejoró bastante desde que se fijó el 10 original)
- `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `SAMBANOVA_API_KEY`, `CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY`, `GROQ_API_KEY` — las 6 rellenas (cuenta propia de Tarkor; Gemini/Groq se sumaron a la rotación el 2026-08-07). Mismo orquestador (`lib/aiProviders/orchestrator.ts`, rotación con failover Cerebras→Mistral→SambaNova→Cloudflare→Gemini→Groq) para generar prompts de imagen de la Enciclopedia Y para `generate-distillation-dataset.ts` (ver `docs/ia/fine-tuning-ia-local.md`) — opcional en los dos casos: sin ninguna clave, cae sola a Ollama local.
- `LIVE_TEACHER_CAPTURE_ENABLED`/`LIVE_TEACHER_CAPTURE_SAMPLE_RATE` — captura en vivo para el pipeline DPO, ver `docs/ia/fine-tuning-ia-local.md` § "Recolección en vivo de pares de preferencia".

**Alternativa (Supabase remoto):** solo si algún día hace falta jugar de verdad desde varios dispositivos a la vez con la misma partida sincronizada — ver `.env.example` para la plantilla comentada. Si se usa, habilitar la extensión a mano igual (Prisma no la gestiona vía schema, ver comentario en `schema.prisma`): `CREATE EXTENSION IF NOT EXISTS vector;`.

El frontend lee `VITE_API_URL` (variable de entorno de Vite, `frontend/src/lib/api.ts`) con fallback
a `http://localhost:3001` si no se define — apuntar a un backend en otra máquina ya no exige tocar
código, solo definir `VITE_API_URL` en un `.env` del frontend antes de arrancar.

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

Cuatro modelos, cada uno con su papel (ver [03-arquitectura.md § 3.3](03-arquitectura.md#33-modelos-locales-ollama)):

| Uso | Modelo | Cómo se obtiene |
|---|---|---|
| Narrador (narración principal) | `tarkor-narrador-llama31` (modelo propio, `FROM llama3.1:8b-instruct-q4_K_M`) | `ollama pull llama3.1:8b-instruct-q4_K_M` y luego, desde `backend/`: `ollama create tarkor-narrador-llama31 -f Modelfile.llama31` |
| Cronista (clasificación de acciones) | `qwen2.5:1.5b-instruct` | `ollama pull qwen2.5:1.5b-instruct` |
| Sugerencias ("Sugerir" bajo demanda, separado del Narrador desde 2026-08-21) | `qwen3.5:4b` | `ollama pull qwen3.5:4b` |
| Embeddings (RAG de lore) | `nomic-embed-text` | `ollama pull nomic-embed-text` |

Si se cambia un `Modelfile`, hay que reconstruir su modelo con el mismo `ollama create`. El narrador en uso lo fija `OLLAMA_MODEL_NARRADOR` en `backend/.env`.

## 7. Arrancar todo

Álvaro tiene `iniciar-tarkor.sh`/`detener-tarkor.sh` (Linux/SteamOS, el sistema real de uso — arranca Postgres/Ollama si hace falta, corre `seed-catalog`, y abre backend+frontend cada uno en su propia ventana de terminal) e `iniciar-tarkor.bat` (Windows, equivalente más simple, sin la orquestación de Postgres/Ollama — `detener-tarkor.bat` ya no existe, se quitó el 2026-07-29 al pasar el foco a Linux/SteamOS, así que en Windows hay que cerrar las ventanas a mano) en la raíz del repo. El equivalente manual, si hiciera falta, en dos terminales separadas:

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
