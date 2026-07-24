# Instalación en otro equipo (2026-07-24)

**Por qué existe este documento:** para poder valorar si merece la pena mover Tarkor a otra máquina (p. ej. una Steam Deck, para comparar tiempos de narración) sin tener que reconstruir estos pasos de memoria cada vez.

Hay dos caminos: **reutilizar la base de datos ya existente** (Supabase, en la nube — lo más rápido, cero configuración de Postgres) o **montar una base de datos local desde cero** (instalación totalmente independiente). Se indica en cada paso cuál aplica.

---

## 1. Requisitos previos

- **Node.js** — usado en esta máquina: v24 (backend y frontend son proyectos `type: "module"`, sin fichero `.nvmrc` que fije una versión mínima exacta; cualquier Node 20+ debería servir).
- **Ollama** instalado y accesible en `http://localhost:11434` (o la URL que se ponga en `OLLAMA_BASE_URL`).
- Solo si se monta base de datos local: **PostgreSQL** con la extensión **pgvector** disponible (necesaria para el RAG de lore — `LoreChunk.embedding` es de tipo `vector`).

## 2. Clonar el repo e instalar dependencias

```
git clone https://github.com/raquelccarreraA/RPG_Takor.git
cd RPG_Takor/backend && npm install
cd ../frontend && npm install
```

## 3. Configurar `backend/.env`

**Sobre los valores reales (DB y claves de API):** `backend/.env` nunca se sube al repo (está en `.gitignore`) y por eso este documento tampoco los escribe tal cual — copiarlos aquí, en un archivo que sí viaja con git, sería filtrar la contraseña de la base de datos y las claves de los proveedores de imagen. La forma correcta de llevarlos al equipo nuevo es **copiar el archivo `backend/.env` directamente** (USB, SCP, un gestor de contraseñas, lo que prefieras) — nunca pegándolo en un commit ni en este documento.

Con eso claro, esto es lo que trae ese `.env` de este equipo, para saber qué esperar:

- `DATABASE_URL` / `DIRECT_URL`: apuntan al mismo proyecto Supabase (`aws-0-eu-west-3.pooler.supabase.com`, puertos 6543/5432) que usa este equipo — copiando el `.env` tal cual, el equipo nuevo ve la misma partida de Gorhorn, el mismo catálogo de mundo y el mismo lore indexado, sin sembrar nada (**camino rápido**).
- `PORT=3001`
- `OLLAMA_BASE_URL="http://localhost:11434"`, `OLLAMA_MODEL_NARRADOR="tarkor-narrador"`, `OLLAMA_MODEL_CRONISTA="qwen2.5:1.5b-instruct"`, `OLLAMA_KEEP_ALIVE="5m"`
- `PACING_MIN_MS=3000`, `PACING_MAX_MS=10000`
- `WORLD_TICK_INTERVAL_MINUTES=2` (ya bajado del default de `env.ts`/`.env.example` tras encontrar en partida real que 20 dejaba un tránsito vencido esperando de más)
- `TRANSIT_MAX_REAL_MINUTES=30`
- `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `SAMBANOVA_API_KEY` rellenas (cuenta propia de Tarkor); `CLOUDFLARE_*` vacías — rotación con failover para generar imágenes de la Enciclopedia, opcional: sin ninguna, esa función cae sola a Ollama local.

**Camino independiente (Postgres local en vez de Supabase):** en su lugar, `DATABASE_URL`/`DIRECT_URL` apuntando a esa instancia local, y antes de migrar, habilitar la extensión a mano (Prisma no la gestiona vía schema, ver comentario en `schema.prisma`):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

El frontend no tiene `.env` — `API_URL` está hardcodeado a `http://localhost:3001` en `frontend/src/lib/api.ts` (pendiente de mover a variable de entorno). Esto significa que **backend y frontend tienen que correr en la MISMA máquina** — no vale instalar solo el frontend apuntando a un backend remoto sin tocar ese archivo primero.

## 4. Migraciones de base de datos

- **Camino rápido (Supabase ya existente):** no hace falta nada — las migraciones ya están aplicadas ahí.
- **Camino independiente (Postgres local, recién creada):**
  ```
  cd backend
  npx prisma migrate deploy
  npx prisma generate
  ```
  Usar `migrate deploy`, no `migrate dev` — `migrate dev` crea una base de datos "shadow" para verificar el historial completo de migraciones desde cero, y esa base "shadow" no tiene la extensión `vector` habilitada (falla con `ERROR: type "vector" does not exist` la primera vez, ver migración `20260717200323_add_lore_chunk_rag`). `migrate deploy` no usa shadow database, aplica directo.

## 5. Sembrar el mundo (SOLO si es una base de datos nueva, nunca si se reutiliza Supabase)

```
cd backend
npm run reindex-lore     # crea el World "helek-sirik" + indexa docs/rpgtarkor/*.md (necesita Ollama corriendo, usa nomic-embed-text)
npm run seed-catalog     # ubicaciones, NPCs, objetos, fauna/flora, rutas (worldCatalog.ts)
npm run seed-image-prompts  # opcional: prompts de imagen para la Enciclopedia
```

Las imágenes ya subidas (`backend/uploads/images/`) SÍ están versionadas en el repo (a diferencia de `uploads/opciones/`, que es solo staging personal y está en `.gitignore`) — no hace falta copiarlas aparte, vienen con el `git clone`.

## 6. Modelos de Ollama

Tres modelos distintos, cada uno con su rol (ver `docs/03-arquitectura.md` § 4.3):

| Uso | Modelo | Cómo se obtiene |
|---|---|---|
| Narrador (narración principal) | `tarkor-narrador` (modelo propio, `FROM qwen2.5:7b`) | `ollama pull qwen2.5:7b` y luego, desde `backend/`: `ollama create tarkor-narrador -f Modelfile` |
| Cronista (clasificación de acciones) | `qwen2.5:1.5b-instruct` | `ollama pull qwen2.5:1.5b-instruct` |
| Embeddings (RAG de lore) | `nomic-embed-text` | `ollama pull nomic-embed-text` |

Si se cambia el `Modelfile` en el futuro, hay que reconstruir `tarkor-narrador` con el mismo comando `ollama create` de arriba.

## 7. Arrancar todo

En Windows, la usuaria ya tiene `iniciar-tarkor.bat`/`detener-tarkor.bat` en la raíz del repo (abren dos ventanas: backend con `npm run dev:nowatch`, frontend con `npm run dev`). En otro sistema operativo (p. ej. SteamOS/Linux en modo escritorio, si se prueba en una Steam Deck), el equivalente manual es, en dos terminales separadas:

```
# Terminal 1
cd backend && npm run dev:nowatch

# Terminal 2
cd frontend && npm run dev
```

Frontend en `http://localhost:5173`, backend en `http://localhost:3001`.

## Notas / limitaciones conocidas

- Todo asume **la misma máquina** para backend+frontend+Ollama (ver nota del punto 3 sobre `API_URL` hardcodeado).
- No hay Docker/contenedor todavía — instalación manual pieza a pieza.
- El worker de fondo (`worldTick`, resuelve tránsitos largos) arranca solo con el backend, no necesita paso aparte.
