# Decisiones técnicas — Tarkor

Documento vivo, igual que [02-decisiones.md](02-decisiones.md) pero para arquitectura/tecnología. Referencia: [03-arquitectura.md](03-arquitectura.md).

---

## Decididas

### 1. ORM / capa de base de datos — **2026-07-16**

**Decisión:** **Prisma**, sobre Postgres.

**Por qué:** es gratis (herramienta open source, sin coste de licencia ni de uso — el coste de infraestructura viene de dónde se aloja la base de datos, no de Prisma en sí), y para un proyecto en solitario prioriza velocidad de arranque: schema declarativo, migraciones automáticas, cliente muy tipado. Se valoró Drizzle (más ligero, más control) pero no aporta ventaja suficiente para justificar la fricción extra en esta fase.

**Contexto importante:** la usuaria dejó claro que este es un proyecto sin presupuesto — no hay intención de pagar por infraestructura mientras esté en fase de demo/MVP personal. Esto no afecta a la elección de Prisma (gratis en cualquier caso), pero desencadenó una revisión completa del resto de la arquitectura — ver decisión 4 más abajo, que sustituye la API de Claude por Ollama en local y elimina por completo el coste de las llamadas de IA (antes mitigado con `claude-haiku-4-5`, ahora directamente gratis).

### 2. Autenticación para el MVP — **2026-07-16**

**Decisión:** sin sistema de login real por ahora — el backend asume un **usuario único implícito**.

**Por qué:** permite centrar el esfuerzo del MVP en el motor de juego (mundo, personaje, tiradas, Narrador/Cronista) sin gastar tiempo en un sistema de cuentas que no aporta nada mientras el proyecto lo usa solo la propia usuaria.

**Impacto:** el modelo de datos debe seguir teniendo una tabla `users` (aunque solo haya una fila) para no tener que remodelar `saves` más adelante cuando se añada login real (email+contraseña o un proveedor externo como Clerk/Auth.js — ninguna de las dos opciones se ha descartado, se decidirá cuando haga falta login de verdad, p. ej. antes de abrir el modo Multijugador).

### 3. Motor de avance del reloj de mundo en tiempo real — **2026-07-16**

**Decisión:** **worker propio** (no los *scheduled deployments* de Managed Agents de Anthropic).

**Por qué:** control total sobre cómo se actualiza `world_states`/`log_entries` (nuestro propio modelo de datos relacional), sin acoplar la lógica central del juego a una API en beta de Anthropic pensada para agentes con sandbox de herramientas, no para motores de juego con estado propio.

**Impacto (revisado tres veces):** primero se planteó como cron externo gratuito en la nube (Render Cron Jobs / GitHub Actions); al pasar a Ollama 100% local (decisión 4 de este documento), ya no tiene sentido un cron en la nube porque no podría hablar con Ollama, así que pasa a ser un proceso local (`setInterval` / `node-cron` dentro del propio backend). Tras la revisión de la decisión 4 de producto ([02-decisiones.md](02-decisiones.md)), el modelo final es aún más simple de lo planteado en un primer momento: el mundo **se pausa** cuando el backend no está corriendo (no hace falta ningún mecanismo de "recuperación al arrancar" ni reconciliar huecos de tiempo real) — ver [03-arquitectura.md § 6](03-arquitectura.md#6-el-reloj-de-mundo-la-pieza-más-singular-de-este-proyecto).

### 4. Motor de IA: 100% local con Ollama — **2026-07-16**

**Decisión:** el motor de IA (Narrador + Cronista) usa **Ollama en local** (`http://localhost:11434`), no la API de Claude. La usuaria ya tiene Ollama instalado (usado también por otro proyecto, nunca en paralelo con Tarkor).

**Por qué:** coherente con la restricción de presupuesto cero de la decisión 1 — Ollama es 100% gratis (cómputo del propio PC), frente al pago por token de la API de Claude (que aunque barato para uso personal, no es estrictamente gratis). Se valoraron también proveedores gratuitos en la nube (Groq, Gemini API) como alternativa híbrida, pero la usuaria prefirió ir "todo local" para garantizar coste cero absoluto.

**Compartir Ollama con otro proyecto sin mezclar "entrenamientos":** Ollama no aprende ni modifica modelos con el uso normal (conversaciones sin estado, como la API de Claude) — no hay riesgo de contaminación cruzada por compartir el servicio. Para mantener a Tarkor con su propia identidad (system prompt, parámetros) totalmente separada de lo que use el otro proyecto, se crea un modelo Ollama propio vía `Modelfile` (`ollama create tarkor-narrador -f Modelfile`) — un artefacto con nombre propio, aislado del resto de modelos locales aunque parta de la misma base. Detalle completo en [03-arquitectura.md § 4.3](03-arquitectura.md#43-compartir-la-instancia-de-ollama-con-otro-proyecto).

**Impacto:**
- Se elimina el uso de la API de Claude/Anthropic del núcleo del motor de juego (secciones 4 y 8 de la arquitectura, reescritas).
- Se elimina también la necesidad de hosting en la nube para backend/worker — todo corre en el PC de la usuaria (sección 8 reescrita: coste 0€ garantizado).
- Riesgo aceptado y documentado: la calidad narrativa de un modelo local es menor que Claude, y la salida estructurada (JSON) es menos fiable — hay que validar y tener plan B en el backend.
- La decisión de producto 4 se revisó por esto mismo (ver [02-decisiones.md](02-decisiones.md)): el mundo ya no se plantea como "reloj 1:1 sincronizado con el tiempo real incluso apagado", sino como un mundo con calendario propio que se pausa cuando el backend no está corriendo — más simple y más fiel a la intención original ("que sea un mundo real" = lógica y calendario internos, no supervivencia a apagones del PC). La versión más estricta queda reservada como posible requisito del modo Multijugador.
- Nueva pregunta abierta: qué modelo concreto de Ollama usar (depende del hardware disponible) — ver Pendientes.

### 5. Ritmo de generación en sesión activa — **2026-07-16**

**Decisión:** las entradas de log durante una partida activa (Narrador + eventos del Cronista enganchados al mismo turno) se espacian con un **retardo mínimo aleatorio configurable, por defecto entre 3 y 10 segundos**, y todas las llamadas a Ollama pasan por una **cola serializada** (nunca dos generaciones a la vez). Ambos parámetros (`PACING_MIN_MS`, `PACING_MAX_MS`) viven en variables de entorno, no en código, para poder probar distintos "perfiles de servidor" sin redeploy.

**Por qué:** con todo el motor de IA corriendo en local (decisión 4), el cuello de botella ya no es el coste por token sino el hardware del propio PC — dos generaciones simultáneas competirían por la misma CPU/GPU y degradarían ambas. Además, un mundo que reacciona instantáneamente tras cada acción se siente ruidoso y no da tiempo real de lectura/decisión al jugador (riesgo "el mundo como ruido" de [01-analisis-producto.md](01-analisis-producto.md)).

**Importante — esto es distinto del tick del worker de fondo** (decisión 3 de este documento, escala de minutos, para cuando el mundo avanza sin que nadie esté jugando). Son dos mecanismos de ritmo independientes que operan en capas distintas: éste regula la sesión activa, aquél regula el avance del mundo en segundo plano.

**Impacto:** ver [03-arquitectura.md § 7bis](03-arquitectura.md#7bis-ritmo-de-generación-en-sesión-activa-throttling) para el diseño completo (cola + espaciado + config). El retardo se aplica a las entradas *secundarias* de un turno (el Cronista), no a la respuesta directa del Narrador a la acción del jugador, que debe llegar sin demora artificial.

### 6. Framework de backend — **2026-07-16**

**Decisión:** **Fastify**.

**Por qué:** más moderno y rápido que Express, con validación de esquemas integrada y muy buen soporte de TypeScript — menos boilerplate para una API estructurada como la de Tarkor. Se valoró Express (ecosistema más grande, más tutoriales) pero no compensa frente a lo que Fastify da "de serie" para este proyecto.

### 7. Modelo concreto de Ollama — **2026-07-16**, revisada **2026-07-16** (provisional, a validar con benchmark real)

**Decisión (revisada):** `qwen2.5:7b` para el Narrador, `llama3.2:latest` (3B) para el Cronista y como fallback si el 7B va demasiado lento. **Ambos ya están descargados en la máquina de la usuaria** (comprobado con `ollama list`) — no hace falta descargar nada para empezar a probar.

**Hardware real comprobado** (vía PowerShell): CPU Intel Core i7-4700MQ (Haswell, 2013, 4 núcleos/8 hilos), 16GB RAM DDR3-1600, GPU dedicada NVIDIA GT 730M con solo 1GB VRAM. Es un portátil de 2013-2014; la GPU es demasiado antigua y con muy poca VRAM para acelerar de forma útil un LLM, así que la inferencia es efectivamente **por CPU**.

**Por qué se revisó:** al comprobar los modelos ya instalados (`ollama list`), la usuaria ya tenía `qwen2.5:7b` (4.7GB) y `llama3.2:latest` (2GB, la 3B) descargados de antes — probablemente del otro proyecto que menciona usa Ollama. Usar estos en vez de `llama3.1:8b-instruct-q4_K_M` (que había que descargar) evita una descarga innecesaria y Qwen2.5 tiene fama de ser especialmente fiable generando salida estructurada (JSON) comparado con Llama, que es justo el punto débil que ya habíamos señalado de correr el motor en local (sección 4.2 de la arquitectura). Tamaño de modelo (7B) y por tanto velocidad esperada en esta CPU son equivalentes a la elección anterior.

**Importante — recordatorio de la decisión 4 de este documento:** para que Tarkor no comparta identidad con el otro proyecto que usa estos mismos modelos, hay que crear el modelo propio vía `Modelfile` (`ollama create tarkor-narrador -f Modelfile`, partiendo `FROM qwen2.5:7b`) en vez de usar `qwen2.5:7b` a pelo.

**Importante — esto sigue siendo un punto de partida, no definitivo:** hace falta probar ambos modelos con el backend real y medir tokens/segundo antes de darlo por cerrado del todo.

### 8. Postgres: nube gratuita, proveedor Supabase — **2026-07-16**

**Decisión:** Postgres en la nube gratuita (no local), con **Supabase**.

**Por qué:** se descartó Postgres local porque las partidas no deben depender del propio disco (sobreviven a una reinstalación del PC). Entre Neon y Supabase, se recomendó Neon (más simple, sin el inconveniente de que Supabase pausa proyectos gratuitos tras una semana de inactividad), pero la usuaria prefirió Supabase — probablemente valorando tener disponibles sus extras (Auth, Storage, Realtime) por si se usan más adelante, aunque hoy nuestra arquitectura los rodea (backend propio como única fuente de verdad, sin que el frontend hable directamente con Supabase). Se respeta la preferencia; no hay ninguna razón técnica de peso en contra.

**Impacto:** hay que recordar reactivar manualmente el proyecto en Supabase si lleva más de una semana sin usarse (pausa automática del tier gratuito) — a diferencia de Neon, que no requiere ese paso manual.

### 9. Contexto del modelo Ollama ampliado a 8192 — **2026-07-17**

**Decisión:** `PARAMETER num_ctx 8192` en el `Modelfile` de `tarkor-narrador` (por defecto Ollama usa 4096).

**Por qué:** con RAM libre de sobra en la máquina (16GB, veriai y tarkor-narrador nunca cargados a la vez), hay margen para meter más contexto por prompt — hechos del mundo, historial reciente y ficha del personaje necesitan espacio. Coste medido: pasar de 4096 a 8192 solo añadió ~400MB de RAM (5.1GB → 5.5GB con el modelo cargado).

### 10. Benchmark real de `tarkor-narrador` (qwen2.5:7b) — **2026-07-17**

**Resultado, sustituye la estimación anterior de la decisión 7:**
- **Primera llamada (carga en frío del modelo en RAM):** ~99.5s totales.
- **Llamadas siguientes con el modelo ya caliente** (gracias a `keep_alive`): **~24.6s** para una respuesta corta (~82 tokens, ≈3.5 tokens/s).
- Con el flujo de turno de dos llamadas (decisión 2 de [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md)), un turno completo con el modelo ya caliente ronda **~50 segundos** — mucho más jugable que la estimación pesimista inicial (2-3 min) basada en el dato en frío.
- **Verificado que inyectar los hechos del mundo en el prompt evita inconsistencias**: sin dar el dato explícito, el modelo narró "luna llena" (Helek Sirik no tiene luna convencional); al incluir el hecho en el prompt, la siguiente respuesta narró correctamente el cinturón de micro-cristales. Confirma que el diseño de `WorldState.facts` inyectado en cada llamada (arquitectura § 4.1) es necesario, no opcional.

**Pendiente:** comparar con `llama3.2:latest` (3B) para el Cronista/fallback — todavía no medido.

**Nota de conexión (2026-07-16, tras montar el backend real):** la conexión directa de Supabase (`db.xxxxx.supabase.co:5432`) **solo resuelve a IPv6** en el tier gratuito, y no era alcanzable desde la red de la usuaria (sin IPv6 funcional) — daba `P1001: Can't reach database server`. Solución: usar los **poolers de Supabase** (compatibles con IPv4), tal como recomienda su propia guía de conexión para Prisma:
- `DATABASE_URL` → pooler de **transacciones** (puerto 6543, host `*.pooler.supabase.com`, con `?pgbouncer=true`) — la usa la app en tiempo de ejecución.
- `DIRECT_URL` → pooler de **sesión** (puerto 5432, mismo host) — el que necesitan las migraciones de Prisma (`prisma migrate dev`).

`prisma/schema.prisma` tiene ambas variables (`url` y `directUrl`) en el datasource. La migración inicial (`20260716195550_init`) ya se aplicó correctamente contra la base de datos real, y el endpoint `/health` del backend confirma `database: "ok"`.

---

## Pendientes

Preguntas técnicas que quedaron abiertas en [03-arquitectura.md](03-arquitectura.md) y que aún no se han cerrado:

1. ~~Esquema exacto de las tablas de Postgres~~ — **hecho**, ver `backend/prisma/schema.prisma` y la migración `20260716195550_init`.
2. ~~Benchmark real del Narrador (qwen2.5:7b)~~ — **hecho**, ver decisión 10. Sigue pendiente medir `llama3.2:latest` (3B) para el Cronista/fallback.
3. **Construir el servicio de tiradas y la orquestación de turno** en el backend (clasificación → tirada → narración) — ver pendientes de [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md).
