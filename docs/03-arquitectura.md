# Arquitectura técnica — Tarkor

**Fase:** Diseño de arquitectura (post-producto, post-demo de frontend)
**Fecha:** 2026-07-16
**Punto de partida:** decisiones de producto cerradas en [02-decisiones.md](02-decisiones.md) + demo de frontend ya montada en `frontend/`.

**Actualizado 2026-08-11 — este archivo documenta el arranque del proyecto (2026-07-16) y queda
desfasado en varios puntos concretos, igual que ya se anotó en
[04-decisiones-tecnicas.md](04-decisiones-tecnicas.md) § Pendientes: la máquina real de desarrollo
hoy es una Steam Deck (APU AMD, sin GPU dedicada útil para LLM — no el i7-4700MQ/GT 730M de la
§ 4 de abajo), Postgres corre **local vía podman** (no Supabase — ver
[15-instalacion.md](15-instalacion.md) § 3bis, que sustituye a la § 8 de abajo), y el Narrador de
producción es el modelo propio fine-tuneado `tarkor-narrador` (no `qwen2.5:7b` a pelo — ver
[fine-tuning-ia-local.md](fine-tuning-ia-local.md)), con `qwen2.5:1.5b-instruct` como clasificador/
Cronista (no `llama3.2:latest`, nunca llegó a usarse). El diseño conceptual de abajo (Ollama en
local, sin coste de nube, worker propio para el reloj de mundo, cola serializada) sigue siendo
correcto y vigente — solo los detalles concretos de hardware/hosting/modelo cambiaron con el
tiempo. Se deja el resto del documento sin reescribir, por historial.**

---

## 1. Visión general

> **Actualizado 2026-07-16 — decisión 4 de [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md): todo el motor de IA corre 100% local con Ollama, sin ningún servicio en la nube de pago.** El diagrama y las secciones de abajo reflejan ese cambio.

```
┌──────────────┐   SSE / WebSocket   ┌───────────────────┐   HTTP local    ┌─────────────────┐
│  Frontend    │ ◄─────────────────► │  Backend (API)     │ ──────────────► │  Ollama          │
│  (React SPA) │   REST (CRUD)       │  Node.js/TS         │  localhost:11434│  (modelo local)  │
└──────────────┘                     └────────┬───────────┘                 └─────────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                    ┌──────────┐        ┌─────────────┐      ┌──────────────┐
                    │ Postgres │        │ Worker/cron │      │ Motor de     │
                    │ (estado  │        │ (avance del │      │ tiradas      │
                    │  y logs) │        │  mundo)     │      │ (determinista)│
                    └──────────┘        └─────────────┘      └──────────────┘

                    TODO el bloque de arriba (excepto el frontend, opcionalmente)
                    corre en tu propio PC. Cero servicios de pago, cero cuenta de API.
```

El frontend ya existe como demo (React + Vite + TS + Tailwind, con datos simulados). Lo que falta es todo lo de la derecha: un backend que posea el estado del juego, hable con Ollama en local, y un mecanismo que haga avanzar el mundo en tiempo real cuando el PC esté encendido (decisión 4, con el matiz añadido en la sección 6).

---

## 2. Backend

**Node.js + TypeScript**, mismo lenguaje que el frontend. Para un proyecto en solitario esto importa más de lo habitual: un solo lenguaje, tipos compartidos entre frontend y backend (los `types.ts` que ya existen en el frontend se pueden mover a un paquete compartido), y una sola caja de herramientas mental.

- **Framework: Fastify** (decidido — ver [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md)). No hace falta Next.js/framework full-stack: el frontend ya es una SPA independiente y separarlo del backend mantiene el despliegue simple.
- **ORM/DB layer: Prisma** sobre Postgres (decidido).
- **Autenticación: sin login real por ahora** — usuario único implícito (decidido). Se añadirá login real (email+contraseña o un proveedor externo) más adelante, cuando haga falta de verdad (p. ej. antes de abrir el modo Multijugador).

---

## 3. Base de datos (Postgres)

Mapeo directo de las entidades de dominio de [01-analisis-producto.md](01-analisis-producto.md#3-entidades-de-dominio-nivel-conceptual):

| Tabla | Contenido |
|---|---|
| `users` | cuenta del jugador |
| `worlds` | catálogo de mundos (plantilla) — hoy solo Valdreth, con su `theme` de color ya definido en el frontend |
| `characters_pregenerated` | personajes preseleccionables por mundo |
| `saves` | una partida: `world_id`, `character` (JSON o tabla propia si se permite editar tras crear), `world_state_id` |
| `world_states` | **la fuente de verdad** por partida: reloj de mundo (timestamp real, ya que decisión 4 = tiempo real 1:1), hechos establecidos (JSON o tabla `facts`), agenda de eventos pendientes, situación de facciones |
| `log_entries` | append-only: `save_id`, `channel` (character\|world), `text`, `roll` (JSON, opcional), `created_at` real y `fictional_time` |
| `character_transit` | "personaje ocupado/en tránsito" (decisión 4): `save_id`, `busy_until` (timestamp real), `activity`, contexto de la zona |
| `session_summaries` | resúmenes por capítulos (memoria de partida, para no perder coherencia en partidas largas — riesgo 1 del análisis) |

`world_states.facts` es lo importante: no es prosa, son hechos estructurados ("el puente está destruido", "el jugador tiene la carta comprometedora") que se inyectan en cada prompt para que Narrador y Cronista nunca se contradigan — esto es literalmente la mecánica descrita en el análisis de producto, sección 4.

---

## 4. Integración con el modelo de IA (Ollama, local)

**Motor:** [Ollama](https://ollama.com) corriendo en tu propio PC, expuesto en `http://localhost:11434`. El backend le habla igual que hablaría a cualquier API HTTP — no hay SDK de Anthropic, ni API key, ni coste por token. Esto sustituye por completo a Claude como motor de Narrador y Cronista; ver la comparación de opciones y el porqué en [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md#4-motor-de-ia-100-local-con-ollama--2026-07-16).

**Modelo concreto (según tu hardware real, comprobado 2026-07-16):** CPU Intel Core i7-4700MQ (Haswell, 2013, 4 núcleos/8 hilos), 16GB RAM DDR3-1600, GPU dedicada NVIDIA GT 730M con solo 1GB de VRAM (demasiado antigua/pequeña para acelerar de forma útil un LLM). En la práctica esto es **inferencia por CPU**, en un procesador ya con más de una década — hay que elegir el modelo pensando en velocidad, no solo en calidad:

- **Narrador: `qwen2.5:7b`** (~4.7GB, ya descargado). Buena calidad narrativa y especialmente fiable generando el JSON estructurado que necesitamos (sección 4.2) — pero espera generación lenta en esta CPU (probablemente varios segundos a más de un minuto por respuesta según longitud). Es tolerable porque el juego es por turnos y ya tenemos el sistema de ritmo de la sección 7bis, no es un chat en tiempo real.
- **Cronista y/o fallback si el 7B resulta demasiado lento: `llama3.2:latest`** (3B, ~2GB, ya descargado) — mucho más rápido en esta CPU, con menos calidad narrativa pero perfectamente usable, sobre todo para los eventos de fondo del Cronista (que importan menos que la respuesta directa al jugador).
- **La GPU (GT 730M) se ignora** — no merece la pena configurar aceleración CUDA para ella; Ollama debería usar CPU automáticamente.
- **Modelo propio vía `Modelfile`** (sección 4.3): en vez de usar `qwen2.5:7b` directamente, se crea `tarkor-narrador` a partir de él, para no compartir identidad con el otro proyecto que ya usa estos modelos.
- **Esto es un punto de partida, no una decisión cerrada para siempre:** conviene medir tokens/segundo con un prompt de ejemplo en cuanto exista el backend, y ajustar según la experiencia real de juego.

### 4.1. El "director de IA" como llamadas a Ollama

La mecánica de Narrador + Cronista (un director, dos voces, un estado compartido — ya diseñada en el análisis) se traduce así:

- **Un único "contexto de mundo" reutilizado**: el contrato del mundo (tono, letalidad, facciones, reglas) + el `world_state.facts` actual van en el prompt de sistema de cada llamada. Con Ollama no hay coste por token que cachear (el cómputo es gratis, es tu CPU/GPU), pero sí conviene usar `keep_alive` para mantener el modelo cargado en memoria entre llamadas y reducir la latencia de arranque en cada turno.
- **Llamada del Narrador**: se dispara siempre que el jugador envía una acción. Recibe la acción del jugador + el resultado de la tirada (ya calculada por el backend, no por el modelo — ver sección 5) y devuelve la narración del log de personaje, más una lista estructurada de "hechos nuevos" que actualizan `world_state.facts`.
- **Llamada del Cronista**: se dispara (a) tras cada turno del jugador, si el avance del reloj lo justifica, y (b) desde el worker de fondo (sección 6) cuando el mundo avanza sin que nadie juegue.
- **Streaming**: Ollama soporta streaming de tokens de forma nativa (`"stream": true` en su API) — el efecto "escribiendo…" de la demo de frontend se implementa igual que con cualquier streaming HTTP, sustituyendo la simulación con `setTimeout` que tiene ahora mismo.

### 4.2. Salidas estructuradas, no todo en prosa libre

Para que el "Estado de mundo" sea fiable, cada llamada al Narrador/Cronista debe devolver algo como:

```json
{
  "narration": "texto narrado para el log",
  "new_facts": ["el jugador ha registrado el escritorio del alcalde"],
  "clock_advance_minutes": 15
}
```

Ollama soporta forzar salida en formato JSON (parámetro `format` en su API, incluyendo JSON Schema en las versiones recientes), pero **es menos fiable que la salida estructurada de Claude** — hay que validar la respuesta en el backend y tener un plan B (reintentar, o extraer con una segunda pasada) si el modelo local no devuelve JSON válido. Esto es parte del precio de correr todo en local y hay que probarlo con el modelo concreto que se elija.

### 4.3. Compartir la instancia de Ollama con otro proyecto

La usuaria ya tiene Ollama instalado y en uso para otro proyecto distinto. **No hace falta ninguna instalación ni "espacio" separado**: Ollama es un único servicio (un daemon en `localhost:11434`) que sirve cualquier modelo que se le pida en cada petición — no tiene el concepto de "proyectos" ni reserva memoria en exclusiva para nadie. Mientras Tarkor y el otro proyecto no se usen **a la vez** (como confirma la usuaria), no hay conflicto real:

- Si ambos proyectos usan el mismo modelo, lo comparten sin más — ni siquiera hay que descargarlo dos veces.
- Si usan modelos distintos (razonable: Tarkor quiere un modelo bueno en narrativa, el otro proyecto puede necesitar otra cosa, p. ej. código), Ollama carga en memoria el modelo que se le pida en cada momento y descarga automáticamente el que lleve inactivo un rato (`keep_alive`, 5 minutos por defecto). Como nunca se lanzan a la vez, cada uno "hereda" la memoria libre cuando le toca.
- Para que el cambio de un proyecto a otro sea más ágil, se puede pedir explícitamente en las llamadas de Tarkor un `keep_alive` corto (o `0` para descargar el modelo justo después de cada turno) — así la memoria queda libre enseguida para cuando se use el otro proyecto, a cambio de algo más de latencia de arranque en el siguiente turno de Tarkor.

**Importante sobre "entrenamientos":** Ollama no "aprende" ni modifica el modelo con el uso normal — cada conversación es sin estado (igual que la API de Claude): tú envías el historial completo en cada petición, el modelo no retiene nada entre llamadas por sí mismo. No hay riesgo de que el uso de Tarkor "contamine" al otro proyecto por el mero hecho de compartir el servicio Ollama; eso solo pasaría si explícitamente se hiciera un fine-tuning y se guardara como un modelo nuevo.

Para que Tarkor tenga su propia identidad (system prompt específico del mundo, parámetros propios) sin tocar lo que use el otro proyecto, la forma limpia es crear un **modelo Ollama propio para Tarkor** vía un `Modelfile`:

```
# Modelfile
FROM qwen2.5:7b
SYSTEM """Eres el director de un juego de rol narrativo..."""
PARAMETER temperature 0.9
```

```bash
ollama create tarkor-narrador -f Modelfile
```

Esto crea un modelo con su propio nombre (`tarkor-narrador`) en la biblioteca local de Ollama — un artefacto completamente aparte del que use el otro proyecto, aunque ambos partan de la misma base (`qwen2.5:7b`, que la usuaria ya tenía descargada). Cada modelo con nombre distinto vive de forma aislada; no hay mezcla posible entre ellos. Es solo cuestión de qué **nombre de modelo** usa cada proyecto al llamar a la API de Ollama (`"model": "..."` en cada request).

---

## 5. Sistema de tiradas (determinista, no delegado al modelo)

Decisión 3 del documento de decisiones: atributos con efecto real y tiradas visibles. La tirada (d20 + atributo vs dificultad) la calcula el **backend**, no el LLM — igual que ya hace la demo de frontend en `lib/dice.ts`. El resultado (éxito/fallo, valores) se pasa al Narrador como parte del prompt, y el modelo narra alrededor de ese resultado ya fijado. Esto evita que el modelo "haga trampa" narrativamente o sea inconsistente entre tiradas iguales.

---

## 6. El reloj de mundo (la pieza más singular de este proyecto)

> **Decisión 4 de producto, revisada el 2026-07-16** (ver [02-decisiones.md](02-decisiones.md)): el mundo tiene su propio calendario y lógica interna (día/noche, agendas de facciones, rutinas de NPCs) y avanza **mientras el juego está en marcha** — se **pausa** cuando el backend no está corriendo, igual que cualquier videojuego. No hay que sincronizarlo con el reloj real de forma persistente a través de apagados del PC (esa versión, más estricta, queda reservada como posible requisito específico del modo Multijugador — ver la pregunta 6 de "Pendientes" en 02-decisiones.md).

Esto simplifica bastante lo que había planteado antes: no hace falta ningún mecanismo de "recuperación al arrancar" ni reconciliar huecos de tiempo. El mundo simplemente continúa desde donde lo dejó la última vez que el backend estuvo corriendo.

### Worker local

Un proceso Node (`setInterval` o un scheduler tipo `node-cron`) que corre junto al backend mientras este esté encendido, cada X minutos, y por cada partida activa:
1. Revisa si hay eventos de la agenda del mundo que "vencen" → llama al Cronista → nuevas entradas en `log_entries` (canal world).
2. Revisa personajes en `character_transit` cuyo tiempo de resolución haya llegado → resuelve sucesos automáticos a ritmo reducido → nuevas entradas en el canal character.

Mientras el backend está apagado, el mundo simplemente no avanza — no hay nada que "recuperar" al volver a encenderlo, el reloj retoma justo donde se quedó.

Se descarta la alternativa de un cron en la nube (Managed Agents de Anthropic o cualquier otro) por la decisión de ir 100% local — ver [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md).

---

## 7. Entrega en tiempo real al frontend

- **Mientras el jugador está en la vista de juego:** streaming de la respuesta del Narrador (SSE o WebSocket) para el efecto "escribiendo…" que ya tiene la demo. El panel de mundo puede recibir eventos del Cronista por el mismo canal si llegan mientras la pestaña está abierta.
- **Mientras el jugador tiene el backend encendido pero no está mirando la partida** (p. ej. cambió de pestaña, o el worker corre entre turnos): el worker de fondo sigue escribiendo en `log_entries`. Al volver a la vista de juego, el frontend simplemente pide "los logs desde la última vez que estuve aquí" — no hace falta nada especial de tiempo real para esto, es una consulta normal. Para el "algo te ha pasado mientras no estabas mirando" se puede añadir más adelante un resumen destacado al volver (usa la misma idea de "Memoria de partida" del análisis).
- **Mientras el backend está apagado:** no pasa nada — el mundo está pausado (ver sección 6), así que no hay eventos que recuperar ni sincronizar al volver a encenderlo.

---

## 7bis. Ritmo de generación en sesión activa (throttling)

Distinto del tick del worker de fondo (sección 6, escala de minutos): esto es el ritmo al que pueden aparecer **entradas nuevas en los paneles mientras el jugador está jugando activamente** — la respuesta del Narrador a la acción, más cualquier evento del Cronista que se enganche a ese mismo turno. Sin control, dos generaciones podrían solaparse (dos llamadas a Ollama a la vez, competitiendo por el mismo hardware) o el mundo podría "hablar" demasiado seguido y sentirse ruidoso (riesgo ya identificado en el análisis de producto: "el mundo como ruido").

**Dos mecanismos, ambos parametrizados:**

1. **Cola de generación serializada (`concurrency: 1`)**: todas las llamadas a Ollama —Narrador y Cronista, sea cual sea su origen— pasan por una única cola en el backend que solo deja una generación en marcha a la vez. Nunca se pisan dos peticiones. Como todo corre en tu misma máquina, no hace falta nada más sofisticado que una cola en memoria dentro del propio proceso Node (no hace falta Redis ni nada externo, dado que es un solo proceso y un solo jugador).
2. **Espaciado mínimo aleatorio entre entradas** (esto es lo que pedías): tras entregar una entrada de log al frontend, la siguiente entrada (si la hay, p. ej. un evento del Cronista que sigue a la respuesta del Narrador) espera un tiempo aleatorio dentro de un rango configurable — **por defecto entre 3 y 10 segundos**, elegido al azar cada vez dentro de ese rango (no siempre el mismo valor, para que no se note un patrón mecánico). Esto da al jugador un hueco real para leer y decidir antes de que le llegue más información, y de paso evita encadenar peticiones de generación sin descanso.

**Matiz importante:** este espaciado se aplica a las entradas *secundarias* de un turno (p. ej. el evento del Cronista que aparece después de tu acción), no a la respuesta del Narrador a tu propia acción — esa debe llegar tan rápido como el modelo pueda generarla, porque el jugador está esperándola activamente; retrasarla artificialmente se sentiría como un juego que no responde.

**Todo configurable, sin tocar código** — pensado como perfiles de "servidor" que se puedan cambiar y probar:

```env
# .env
PACING_MIN_MS=3000
PACING_MAX_MS=10000
```

```ts
// config/pacing.ts
export const pacing = {
  minDelayMs: Number(process.env.PACING_MIN_MS ?? 3000),
  maxDelayMs: Number(process.env.PACING_MAX_MS ?? 10000),
};
```

Cambiar de perfil (por ejemplo, un perfil "rápido" de 1-3s para pruebas de desarrollo, o uno "pausado" de 8-20s para sesiones más contemplativas) es solo cambiar estas dos variables y reiniciar el backend — no hace falta redeploy ni tocar la lógica.

---

## 8. Hosting — 100% local, coste cero garantizado

Con la decisión de usar Ollama en local para todo el motor de IA, el hosting deja de ser un problema de "tiers gratuitos con límites" y pasa a ser mucho más simple: **casi todo corre en tu propio PC.**

- **Backend + worker + Ollama:** todo en tu máquina. El backend es un proceso Node normal (`npm run dev` / `node dist/server.js`) que habla con Ollama en `localhost:11434`. El worker del reloj de mundo (sección 6) es otro proceso o un `setInterval` dentro del mismo backend — no hace falta ningún servicio externo.
- **Base de datos: Supabase** (Postgres gratuito en la nube — decidido, ver [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md#8-postgres-nube-gratuita-proveedor-supabase--2026-07-16)). Las partidas no dependen del disco local — sobreviven a una reinstalación del PC, a cambio de necesitar conexión a internet para jugar. **Aviso práctico:** el tier gratuito de Supabase pausa el proyecto tras una semana sin actividad — hay que reactivarlo manualmente desde su panel si ha pasado un tiempo sin tocar el juego.
- **Frontend:** puede correr como servidor de desarrollo local (`npm run dev`, como ya haces) para uso exclusivamente personal, o desplegarse gratis en Vercel/Netlify si en algún momento quieres poder abrir la partida desde el móvil o otro dispositivo sin tener el frontend corriendo en el PC. El backend seguiría viviendo solo en tu PC de cualquier forma (es el único sitio donde Ollama existe), así que esto no cambia nada de lo importante.
- **Coste real: 0€.** No hay API key de pago, no hay servicio en la nube que factura por uso. El único "coste" es el tiempo de cómputo de tu propio PC mientras el backend/worker estén corriendo.

---

## 9. Próximos pasos

1. Cerrar las preguntas técnicas abiertas (sección de abajo / [04-decisiones-tecnicas.md](04-decisiones-tecnicas.md)) — en particular, qué modelo de Ollama usar y si Postgres va local o en la nube gratuita.
2. Definir el esquema exacto de Postgres (migraciones) a partir de la tabla de la sección 3.
3. Montar el backend mínimo: endpoint para "enviar acción" que orqueste tirada → Narrador (Ollama) → actualización de `world_states` → respuesta en streaming.
4. Montar el worker local + mecanismo de recuperación al arrancar (sección 6) para el avance del reloj y la resolución de tránsitos.
5. Conectar el frontend real a este backend, sustituyendo `lib/simulateAI.ts` por llamadas reales.
