# Decisiones técnicas — Tarkor

Documento vivo, igual que [02-decisiones.md](../producto/02-decisiones.md) pero para arquitectura/tecnología. Referencia: [03-arquitectura.md](03-arquitectura.md).

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

**Impacto (revisado tres veces):** primero se planteó como cron externo gratuito en la nube (Render Cron Jobs / GitHub Actions); al pasar a Ollama 100% local (decisión 4 de este documento), ya no tiene sentido un cron en la nube porque no podría hablar con Ollama, así que pasa a ser un proceso local (`setInterval` / `node-cron` dentro del propio backend). Tras la revisión de la decisión 4 de producto ([02-decisiones.md](../producto/02-decisiones.md)), el modelo final es aún más simple de lo planteado en un primer momento: el mundo **se pausa** cuando el backend no está corriendo (no hace falta ningún mecanismo de "recuperación al arrancar" ni reconciliar huecos de tiempo real) — ver [03-arquitectura.md § 6](03-arquitectura.md#6-el-reloj-de-mundo-la-pieza-más-singular-de-este-proyecto).

### 4. Motor de IA: 100% local con Ollama — **2026-07-16**

**Decisión:** el motor de IA (Narrador + Cronista) usa **Ollama en local** (`http://localhost:11434`), no la API de Claude. La usuaria ya tiene Ollama instalado (usado también por otro proyecto, nunca en paralelo con Tarkor).

**Por qué:** coherente con la restricción de presupuesto cero de la decisión 1 — Ollama es 100% gratis (cómputo del propio PC), frente al pago por token de la API de Claude (que aunque barato para uso personal, no es estrictamente gratis). Se valoraron también proveedores gratuitos en la nube (Groq, Gemini API) como alternativa híbrida, pero la usuaria prefirió ir "todo local" para garantizar coste cero absoluto.

**Compartir Ollama con otro proyecto sin mezclar "entrenamientos":** Ollama no aprende ni modifica modelos con el uso normal (conversaciones sin estado, como la API de Claude) — no hay riesgo de contaminación cruzada por compartir el servicio. Para mantener a Tarkor con su propia identidad (system prompt, parámetros) totalmente separada de lo que use el otro proyecto, se crea un modelo Ollama propio vía `Modelfile` (`ollama create tarkor-narrador -f Modelfile`) — un artefacto con nombre propio, aislado del resto de modelos locales aunque parta de la misma base. Detalle completo en [03-arquitectura.md § 4.3](03-arquitectura.md#43-compartir-la-instancia-de-ollama-con-otro-proyecto).

**Impacto:**
- Se elimina el uso de la API de Claude/Anthropic del núcleo del motor de juego (secciones 4 y 8 de la arquitectura, reescritas).
- Se elimina también la necesidad de hosting en la nube para backend/worker — todo corre en el PC de la usuaria (sección 8 reescrita: coste 0€ garantizado).
- Riesgo aceptado y documentado: la calidad narrativa de un modelo local es menor que Claude, y la salida estructurada (JSON) es menos fiable — hay que validar y tener plan B en el backend.
- La decisión de producto 4 se revisó por esto mismo (ver [02-decisiones.md](../producto/02-decisiones.md)): el mundo ya no se plantea como "reloj 1:1 sincronizado con el tiempo real incluso apagado", sino como un mundo con calendario propio que se pausa cuando el backend no está corriendo — más simple y más fiel a la intención original ("que sea un mundo real" = lógica y calendario internos, no supervivencia a apagones del PC). La versión más estricta queda reservada como posible requisito del modo Multijugador.
- Nueva pregunta abierta: qué modelo concreto de Ollama usar (depende del hardware disponible) — ver Pendientes.

### 5. Ritmo de generación en sesión activa — **2026-07-16**

**Decisión:** las entradas de log durante una partida activa (Narrador + eventos del Cronista enganchados al mismo turno) se espacian con un **retardo mínimo aleatorio configurable, por defecto entre 3 y 10 segundos**, y todas las llamadas a Ollama pasan por una **cola serializada** (nunca dos generaciones a la vez). Ambos parámetros (`PACING_MIN_MS`, `PACING_MAX_MS`) viven en variables de entorno, no en código, para poder probar distintos "perfiles de servidor" sin redeploy.

**Por qué:** con todo el motor de IA corriendo en local (decisión 4), el cuello de botella ya no es el coste por token sino el hardware del propio PC — dos generaciones simultáneas competirían por la misma CPU/GPU y degradarían ambas. Además, un mundo que reacciona instantáneamente tras cada acción se siente ruidoso y no da tiempo real de lectura/decisión al jugador (riesgo "el mundo como ruido" de [01-analisis-producto.md](../producto/01-analisis-producto.md)).

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
- Con el flujo de turno de dos llamadas (decisión 2 de [06-decisiones-mecanicas.md](../mecanicas/06-decisiones-mecanicas.md)), un turno completo con el modelo ya caliente ronda **~50 segundos** — mucho más jugable que la estimación pesimista inicial (2-3 min) basada en el dato en frío.
- **Verificado que inyectar los hechos del mundo en el prompt evita inconsistencias**: sin dar el dato explícito, el modelo narró "luna llena" (Helek Sirik no tiene luna convencional); al incluir el hecho en el prompt, la siguiente respuesta narró correctamente el cinturón de micro-cristales. Confirma que el diseño de `WorldState.facts` inyectado en cada llamada (arquitectura § 4.1) es necesario, no opcional.

**Pendiente:** comparar con `llama3.2:latest` (3B) para el Cronista/fallback — todavía no medido.

### 11. `OLLAMA_IGPU_ENABLE=1` — variable crítica para la iGPU de la Steam Deck — **2026-09-14**

**Hallazgo real:** Ollama detecta la iGPU integrada de la Steam Deck (AMD Van Gogh, RDNA2, vista como `Vulkan0 — AMD Custom GPU 0405 (RADV VANGOGH)`) pero **la descarta activamente por defecto** ("dropping integrated GPU") salvo que se active explícitamente `OLLAMA_IGPU_ENABLE=1`. Sin esa variable, toda la inferencia cae a CPU pura sin ningún aviso visible salvo en logs de debug (`OLLAMA_DEBUG=1`).

**Cómo se descubrió:** comparando Mistral Nemo 12B contra `tarkor-narrador`/`qwen2.5:3b` (ambos en 100% GPU) dio ~3.1-3.2 tok/s en CPU pura — muy por debajo de lo que reportaban otros usuarios con el mismo modelo en Steam Deck (~25-30s por respuesta). La causa: al reiniciar el servidor Ollama para las pruebas se perdió una variable de entorno que ya estaba activa en una sesión de terminal previa, sin persistir en ningún archivo de configuración. Con la variable activa, Mistral Nemo pasó a ~7.1-7.2 tok/s (89% GPU / 11% CPU, offload parcial — el modelo completo no cabe entero en lo que la iGPU puede reservar).

**Fix aplicado:** `export OLLAMA_IGPU_ENABLE=1` añadido a `~/.bashrc` — persiste en cualquier terminal nueva, no depende de recordarlo al arrancar Ollama a mano.

**Benchmark real en esta Steam Deck (2026-09-14, servidor con la iGPU activa):**

| Modelo | Procesador | Generación |
|---|---|---|
| `tarkor-narrador` (qwen2.5:7b) | 100% GPU | ~12.6-13.0 tok/s |
| `qwen2.5:3b` | 100% GPU | ~26.2-26.8 tok/s |
| Mistral Nemo 12B (`tarkor-narrador-nemo`) | 89% GPU / 11% CPU | ~7.1-7.2 tok/s |

Sustituye como referencia real de hardware actual al benchmark de la decisión 10 (~3.5 tok/s), que es del hardware viejo (i7-4700MQ, GT 730M) y no de la Steam Deck.

### 12. `OLLAMA_FLASH_ATTENTION` + `OLLAMA_KV_CACHE_TYPE=q8_0` — más margen de GTT en memoria unificada — **2026-09-14**

**Contexto de hardware:** la iGPU de la Steam Deck solo tiene **1GB de VRAM fija** (`mem_info_vram_total`), pero **8GB de GTT** (memoria de sistema mapeable a GPU, `mem_info_gtt_total`) — así reserva memoria para modelos grandes. Mistral Nemo 12B (Q4_K_M, ~7.5GB en disco, ~9GB cargado con contexto) se quedaba justo corto de ese margen, cayendo a offload parcial (89% GPU / 11% CPU, decisión 11).

**Cambio:** `OLLAMA_FLASH_ATTENTION=1` (kernel de atención más eficiente en memoria) + `OLLAMA_KV_CACHE_TYPE=q8_0` (caché K/V cuantizado a 8 bits en vez de f16 por defecto) liberan justo el margen que faltaba.

**Resultado medido:** Mistral Nemo pasó de 89% GPU/11% CPU a **100% GPU** — y de ~7.1-7.2 tok/s a **~8.3 tok/s** (+16%), con dos llamadas en caliente consistentes (155 tokens/18.7s y 305 tokens/36.9s). `tarkor-narrador` (7B) y `qwen2.5:3b`, que ya estaban en 100% GPU, no empeoraron (dentro de margen de ruido de medición) — el caché cuantizado no penalizó a los modelos que ya cabían enteros.

**Coste de calidad:** no evaluado a fondo en esta sesión — `q8_0` es una cuantización ligera (vs. f16), en teoría con pérdida mínima, pero conviene vigilarlo si se nota degradación narrativa al jugar en vivo con cualquiera de los 3 modelos.

**Fix aplicado:** ambas variables añadidas a `~/.bashrc` junto a `OLLAMA_IGPU_ENABLE=1`.

### 13. Ronda de optimización completa — actualización Ollama, `num_thread`, ROCm descartado — **2026-09-14**

Tras la decisión 12, se probaron todas las palancas adicionales identificadas ese mismo día.

**Ollama actualizado de 0.32.3 a 0.34.0** (instalación portable en `~/.local/ollama/`, binario + `lib/ollama/` reemplazados, backup completo de la versión vieja conservado en `~/ollama_update/`). Mejora medida, sin tocar nada más:
- `tarkor-narrador` (7B): ~13.0 → **~14.3 tok/s**
- `qwen2.5:3b`: ~26.8 → **~31.3 tok/s**
- Mistral Nemo (100% GPU ya con la decisión 12): ~8.3 → **~8.7 tok/s**

**`num_thread` subido de 4 a 8** en `backend/src/lib/ollama.ts` (ver comentario ahí) — con la iGPU activa, la carga en CPU que queda (offload parcial de Mistral Nemo) ya no compite tanto por el bus de RAM como en CPU pura. Medido +6%: Mistral Nemo ~8.7 → **~9.2 tok/s**. Verificado que la premisa original (thread4 > thread8 en CPU pura) SIGUE siendo cierta forzando `num_gpu: 0` (thread4 ~11.3 tok/s vs thread8 ~10.2 tok/s) — el cambio es correcto solo porque casi nadie llama con `forceCpu: true` hoy; si eso cambia, revisar de nuevo.

**Benchmark final consolidado (Ollama 0.34.0 + iGPU + flash attention + KV cache q8_0 + num_thread 8):**

| Modelo | Procesador | Generación |
|---|---|---|
| `tarkor-narrador` (qwen2.5:7b) | 100% GPU | ~14.3 tok/s |
| `qwen2.5:3b` | 100% GPU | ~31.3 tok/s |
| Mistral Nemo 12B (`tarkor-narrador-nemo`) | 100% GPU | ~9.2 tok/s |

Frente al punto de partida real de esta sesión (Mistral Nemo en CPU pura por la iGPU descartada, decisión 11: ~3.1 tok/s), el resultado final es **~3x más rápido**, y los 3 modelos terminan en 100% GPU.

**ROCm investigado y descartado**: AMD no da soporte oficial de ROCm a Van Gogh (gfx1033, la iGPU de la Steam Deck) — confirmado por la propia documentación de Ollama y varios issues abiertos sin resolver en los repos de ROCm/llama.cpp. Vulkan (lo que ya usa el proyecto) es la vía correcta y recomendada para esta iGPU, no un workaround inferior — no merece la pena perseguir el paquete `ollama-linux-amd64-rocm`.

**Gobernador de CPU `performance` + perfil de GPU `COMPUTE` — probados en vivo, SIN mejora medible**: con los 3 modelos ya en 100% GPU (gracias a las decisiones 11-12), el cuello de botella real ya no es la frecuencia de CPU ni el perfil de energía general — es la propia iGPU trabajando a su ritmo. Aplicados y medidos en la Steam Deck real de la usuaria:
- `echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor` (CPU pasó de ~40% a ~79% de frecuencia en reposo).
- `echo 5 | sudo tee /sys/class/drm/card0/device/pp_power_profile_mode` (el índice numérico del modo `COMPUTE`, no el nombre — `pp_power_profile_mode` solo acepta el número de la lista).

Resultado: `tarkor-narrador` ~14.3 tok/s (igual), `qwen2.5:3b` ~30.8-31.3 tok/s (igual, dentro de ruido), Mistral Nemo ~9.2-9.3 tok/s (igual). **Sin beneficio real, con más consumo/calor de por vida útil de batería** — recomendado revertir ambos salvo que se note alguna otra ventaja jugando en vivo (framerate si se juega mientras se narra, por ejemplo):
```
echo powersave | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
echo 0 | sudo tee /sys/class/drm/card0/device/pp_power_profile_mode
```
Ambos son temporales (no persisten a un reinicio), así que tampoco es urgente revertirlos si se quiere seguir probando.

**Ya descartadas, no aplican a este proyecto:**
- `OLLAMA_NUM_PARALLEL`/`OLLAMA_MAX_LOADED_MODELS`: el proyecto ya sirve una petición a la vez por diseño (decisión técnica 5, `ollamaQueue.ts`), y solo un modelo suele estar cargado a la vez por RAM ajustada (14GB reales disponibles, no 16GB completos).

### 14. Veredicto de modelos alternativos jugando TURNOS REALES en vivo — **2026-09-14**

Las decisiones 11-13 miden tok/s puro con prompts sintéticos cortos. Esta ronda mide el coste real de
un TURNO completo (clasificar + narrar + resto de trabajo del backend) jugando la partida de TEST
de verdad, vía Playwright, contra la Location `campamento-serhu-interior` (Ulkha Ketg/Gogorath).

**`tarkor-narrador` (7B, producción) — turno de referencia**: ~55s completo (7.6s clasificar con el
1.5B + 47.7s narrar), sin ningún error de nombre en varias interacciones seguidas.

**Mistral Nemo como narrador (`tarkor-narrador-nemo`) — descartado como narrador de producción**:
- Turno en frío (carga de modelo incluida): ~129s.
- Turno en caliente (modelo ya cargado, 91% GPU): **~181s** — más de 3x el tiempo de `tarkor-narrador`
  para un turno real completo, muy por encima de lo que sugería el tok/s puro medido en la decisión 13
  (la diferencia crece con el contexto real de mundo/historial que un prompt sintético corto no tiene).
- **Fallo de calidad real detectado**: una narración escribió `"Ulkhaketg"` (nombre propio pegado, sin
  espacio) — un error que `tarkor-narrador` no comete con el mismo SYSTEM prompt en las mismas
  condiciones. Un solo caso, no es una muestra estadística, pero es justo el tipo de fallo de fidelidad
  al lore que motivó la decisión de mantener el modelo fine-tuneado de producción en primer lugar.
- Veredicto: **no usar como narrador de producción** — ni la velocidad ni la calidad compensan frente
  a `tarkor-narrador`. Sigue disponible para pruebas puntuales de comparación (`.env`, comentado).

**Investigación de causa raíz (2026-09-14, tras pedir explícitamente no descartar Nemo sin
entender el fallo primero)**: el proyecto fuerza `format` (JSON estructurado vía gramática GBNF,
`narrador.ts`) en toda narración — Mistral Nemo usa el tokenizer **Tekken** (BPE), distinto del que
usa Qwen (`tarkor-narrador`). Encontrado en fuentes externas (GitHub/HuggingFace, no verificado
directamente en este proyecto): "Mistral's strict-schema support is uneven" bajo grammar-constrained
decoding — un patrón de fallo YA conocido en la comunidad de llama.cpp con esta familia de modelo,
no exclusivo de esta Steam Deck. La plantilla de chat en sí (`[INST]...[/INST]`) se confirmó correcta
en el `.gguf` usado (`ollama show --template`), así que el fallo no es de template mal aplicado.

**Ronda 2 — `Mistral-Nemo-12B-Celeste-V1.9` (fine-tune específico de RPG, recomendado por la
comunidad en vez del Instruct genérico) — probado en vivo, RESULTADO PEOR, no mejor**:
- Fuente: `nothingiisreal/MN-12B-Celeste-V1.9-GGUF` (Hugging Face, mismo patrón de descarga directa
  que el Nemo base — `ollama pull` contra el registry falla igual). Template ChatML correcto
  copiado del Modelfile oficial publicado en Ollama Registry (`vanilj/mistral-nemo-12b-celeste-v1.9`,
  confirmado con `curl` contra el blob real del template — no adivinado).
- Turno en frío: ~142s. Turno en caliente: **~226s** — más lento todavía que Nemo Instruct base.
- **Fallos de calidad graves, peores que el Instruct base**:
  - Filtración de metadatos internos a la prosa visible: `"Terk'ikar Ulkha Ketg se encuentra
    en_x:200,y:200, frente a_x:200,y:200"` — ningún dato de coordenadas se inyecta en el prompt
    real (confirmado revisando `narrador.ts`), es alucinación del modelo arrastrada probablemente
    de sus datos de entrenamiento de RP (SillyTavern/tarjetas de personaje sí usan metadatos así en
    crudo). Bug de calidad mucho más grave que el simple error de nombre de la ronda 1.
  - Inventó un NPC/fauna (`Zense Ceniza`) en escena sin ningún motivo de los hechos dados — viola
    directamente la regla explícita del SYSTEM ("nunca añadas una segunda [amenaza] que no está
    ahí").
  - Tituló mal a un NPC con ficha propia (`"Kort'ikar Ulkha Ketg"`, el título correcto es
    Terk'ikar — el mismo tipo de error de fidelidad de la ronda 1, repetido).
  - Contradicción interna sin sentido en el propio diálogo generado ("busco a un Terk'ikar que no
    está aquí" hablando de sí misma, ya nombrada como Terk'ikar en la misma frase).
- **Hallazgo de fondo (de la propia documentación oficial del modelo, HuggingFace README)**: Celeste
  se entrenó y se recomienda para **chat libre sin schema forzado** ("ChatML with no system
  prompt... ChatML with no system prompt"; "Mistral seems weaker with OOC and instruct smarts and
  more prone to repetition" — admitido por el propio autor del fine-tune). El caso de uso de este
  proyecto (JSON estructurado obligatorio, SYSTEM prompt largo con reglas duras de mundo) es
  precisamente el escenario contrario al que Celeste se afinó — un fine-tune de RP conversacional
  libre no traduce automáticamente a "mejor narrador bajo grammar-constrained decoding".
- Veredicto: **peor que el Nemo Instruct base bajo las condiciones reales de este proyecto** — el
  fine-tune de RP no compensa el choque estructural con `format`, lo agrava. No usar como narrador
  de producción sin antes resolver el choque `format`+Mistral en sí (ver pendiente más abajo).

**Pendiente real, no resuelto en esta sesión**: si en algún momento se quiere que la familia Mistral
(Nemo/Celeste u otra) funcione bien en este proyecto, el camino correcto no es seguir probando más
fine-tunes de la misma familia — es resolver el choque de raíz entre `format` (GBNF) y esta familia
de tokenizer, p.ej. probando narración SIN `format` (parseando la prosa con un post-proceso en vez
de JSON forzado) solo para Mistral, o verificando si una versión más reciente de llama.cpp mejora el
soporte de grammar para tokenizers BPE no-Qwen. Ninguna de las dos vías se ha intentado todavía.

**`qwen2.5:3b` como cronista (clasificador) — descartado, hallazgo de arquitectura, no solo velocidad**:
- Turno en caliente: ~76-88s, notablemente más lento que ~55s con el 1.5B.
- **Causa real, no es solo que el 3B razone más lento**: `keepAlive: '0'` en las llamadas de
  clasificación (`narrador.ts`, ver comentario ahí — "descarga el modelo pequeño en cuanto clasifica,
  antes de que narrateAction cargue el modelo grande... nunca los dos a la vez en memoria") fuerza
  descargar el cronista inmediatamente tras CADA turno, para no competir en RAM con el narrador de 7B
  cargado a la vez. El 1.5B (986MB) paga esa carga en frío casi gratis en cada turno; el 3B (1.9GB) no
  — nunca llega a aparecer "caliente" en `ollama ps` porque se descarga antes de la siguiente medición.
- Esto significa que el 3B no es un simple "drop-in más lento": para que valiera la pena, habría que
  revisar la propia decisión de `keepAlive: '0'` (p.ej. permitir que conviva con el narrador si hay RAM,
  o aceptar el coste de recarga a cambio de mejor clasificación) — cambio de arquitectura, no solo de
  nombre de modelo en `.env`. No evaluado si la calidad de clasificación en sí mejora con el 3B; el
  coste de velocidad ya descarta usarlo sin resolver antes este punto.
- Veredicto: **no usar como cronista de producción** sin revisar `keepAlive` primero.

### 15. Warm-up del narrador al arrancar — funciona, pero solo cubre una parte del prefijo — **2026-09-14**

Álvaro señaló correctamente que "cargado en GPU" (`ollama ps`) no implicaba que el primer turno tras
un reinicio fuera rápido — investigación completa en vivo, con hallazgos reales no obvios.

**Hallazgo 1 — el coste real invisible es `prompt_eval_duration`, no la carga del modelo.**
`load_duration` (lo que confirma `ollama ps`) solo cubre los PESOS del modelo en GPU. Ollama/
llama.cpp cachea aparte el **KV-cache del prompt**, por coincidencia EXACTA de prefijo de tokens —
si el prefijo del turno actual no coincide con nada ya procesado, se re-evalúa entero desde cero,
sin que `ollama ps` lo refleje en absoluto. Medido: recalcular un prefijo de ~2800 tokens sin
cachear cuesta 7-21s (varió según carga del sistema en el momento) — invisible mirando solo
`ollama ps`/`load_duration`.

**Fix aplicado**: `narratorWarmupPrompt()` (narrador.ts) construye el mismo prefijo fijo que un
turno real (reutilizando `buildNarrationPrompt`, nunca copiado a mano — así nunca se desincroniza
si `fixedInstructions` cambia), y `server.ts` lo dispara al arrancar sin bloquear el arranque.

**Hallazgo 2 — el prefijo "fijo" no es tan fijo como parecía: depende de si hay NPC en escena.**
Investigado con un log temporal que volcó el prompt REAL de un turno de juego para comparar
carácter a carácter contra el warm-up. Los primeros ~5400 caracteres SÍ coinciden siempre
(`GOOD_NARRATION_EXAMPLE` + la mayor parte de `fixedInstructions`), pero justo después diverge:
`nonHostileHint` (dentro de `fixedInstructions`) incluye el **nombre real de cada NPC no-agresivo
en escena** directamente en el texto del prompt (`` `${nonHostileNames.join(', ')} no es agresivo...` ``)
— así que el prefijo cacheable real es DISTINTO según qué NPC concreto esté presente, no un único
"caso fijo" universal. El warm-up genérico (sin NPC en escena) beneficia turnos donde el jugador
está solo, pero no beneficia turnos con NPC presente (la mayoría de la partida real) porque esos
~5400 caracteres coinciden, pero el texto que sigue inmediatamente después no.

**Estado actual**: el warm-up SÍ reduce el coste en el caso "sin NPC en escena" (turnos de
exploración solitaria), confirmado con mediciones aisladas (`prompt_eval` de 21s → 0.1-0.5s cuando
el prefijo coincide de verdad). NO elimina el coste en turnos con NPC presente — esos siguen
pagando el reprocesamiento de la parte final del prompt (nombres/hechos/personaje/acción, que
nunca puede precalentarse de forma genérica porque varía por diseño en cada turno). Se mantiene
como mejora parcial real, no una solución completa — documentado aquí en vez de venderlo como
"turno rápido garantizado".

**Actualización (2026-09-14, mismo día) — el fix de `combatBlock` se aplicó, pero reveló que la
premisa entera del warm-up estaba equivocada.** Se movió `combatBlock` (que contiene
`nonHostileHint`/`ambushHint`, con los nombres reales de NPC) fuera de `fixedInstructions` — ahora
vive junto a `rollBlock`/`ACCIÓN DEL JUGADOR`, la parte que ya variaba turno a turno de todos
modos. `fixedInstructions` es ahora de verdad idéntico letra a letra en cualquier turno de
cualquier partida, con o sin NPC en escena. `tsc -b --force` limpio tras el cambio — este cambio en
sí sigue siendo correcto y se mantiene (mejor organización del prompt, coste cero).

**Verificación en vivo (B1 del checklist, decisión 16) — hallazgo real, contrario a lo esperado**:
medido con Playwright contra la partida de TEST (Ulkha Ketg en escena) y confirmado después con
llamadas aisladas a `/api/generate` con datos nunca usados antes (para descartar contaminación de
cache de pruebas previas): un turno real con NPC en escena, tras el warm-up, sigue costando
**~5.8-5.9s de `prompt_eval_duration`** — prácticamente el mismo coste que si no hubiera warm-up en
absoluto, pese a que el prefijo de ~2784 tokens coincide carácter a carácter con lo que el warm-up
ya precalentó.

**Causa raíz encontrada**: Ollama/llama.cpp cachea por **coincidencia EXACTA del prompt COMPLETO**,
no por reuso de prefijo compartido entre prompts de distinta longitud. La reinterpretación correcta
de la medición original de esta misma decisión ("21s → 0.1-0.5s cuando el prefijo coincide") es que
en realidad comparaba el MISMO prompt repetido dos veces (p.ej. warm-up ejecutado dos veces
seguidas), no un prefijo compartido con contenido variable nuevo al final — cualquier turno real de
juego SIEMPRE añade al menos la acción del jugador, así que nunca coincide con el warm-up letra a
letra. Confirmado con 3 experimentos aislados y repetibles: (1) prompt corto tras uno largo que lo
contiene como prefijo exacto → cache miss completo; (2) prompt largo tras el corto que es su
prefijo → cache miss completo; (3) el mismo prompt EXACTO repetido → siempre cache hit perfecto
(0.09-0.15s). El mecanismo de reuso de prefijo parcial (`--cache-reuse`/`n_cache_reuse` en
llama.cpp) existe en el motor pero está **desactivado por defecto** (chunk mínimo 0) y **Ollama no
lo expone** como variable de entorno oficial ni lo activa internamente.

**Workaround indocumentado probado y también sin efecto**: `llama-server` (el binario que Ollama
lanza como proceso hijo) soporta activar cualquier flag vía variable de entorno `LLAMA_ARG_<FLAG>`
(confirmado en el código fuente real de llama.cpp, `common/arg.cpp`: `--cache-reuse` se mapea a
`LLAMA_ARG_CACHE_REUSE`), y Ollama sí propaga su entorno al proceso hijo (confirmado con
`strings`/binario, ya usa este mismo patrón para `LLAMA_ARG_FIT`). Se probó exportando
`LLAMA_ARG_CACHE_REUSE=256` antes de `ollama serve`, confirmado que la variable llegó al proceso
`llama-server` real (`/proc/<pid>/environ`) — pero el resultado medido fue idéntico, sin ningún
reuso parcial. Hay un issue abierto y sin resolver en `ggml-org/llama.cpp` (#15082) que documenta
una regresión de `--cache-reuse` en versiones recientes ("no longer seems to be caching prompt
prefixes"), consistente con lo medido aquí — no se puede confirmar con certeza si es la misma causa
sin acceso al código exacto de la versión vendorizada en Ollama 0.34.0, pero es la explicación más
plausible encontrada. Workaround revertido tras la prueba (no aporta nada, añade una variable no
estándar sin beneficio).

**Veredicto final, honesto**: el warm-up del narrador (`narratorWarmupPrompt`/`server.ts`) **NO
reduce el coste de `prompt_eval` de ningún turno real de juego** — solo evita el coste de cargar
los PESOS del modelo en RAM/GPU (`load_duration`), que es un ahorro real pero mucho menor que el
que se documentó originalmente. El mecanismo de KV-cache de Ollama solo beneficia repeticiones
EXACTAS del mismo prompt completo, un caso que no ocurre en el juego real (cada turno tiene al
menos una acción de jugador distinta). **No se revierte el warm-up** — seguir cargando el modelo en
RAM al arrancar sigue siendo mejor que no hacerlo — pero se corrige la expectativa: no es una
optimización de `prompt_eval`, solo de `load_duration`. Sin vía conocida para arreglar esto sin
migrar de runtime (ya descartado en la decisión de "Ollama vs alternativas" de esta misma ronda,
por otras razones de peso) o sin que llama.cpp/Ollama arreglen la regresión de `--cache-reuse` en
una versión futura.

**Nota de conexión (2026-07-16, tras montar el backend real):** la conexión directa de Supabase (`db.xxxxx.supabase.co:5432`) **solo resuelve a IPv6** en el tier gratuito, y no era alcanzable desde la red de la usuaria (sin IPv6 funcional) — daba `P1001: Can't reach database server`. Solución: usar los **poolers de Supabase** (compatibles con IPv4), tal como recomienda su propia guía de conexión para Prisma:
- `DATABASE_URL` → pooler de **transacciones** (puerto 6543, host `*.pooler.supabase.com`, con `?pgbouncer=true`) — la usa la app en tiempo de ejecución.
- `DIRECT_URL` → pooler de **sesión** (puerto 5432, mismo host) — el que necesitan las migraciones de Prisma (`prisma migrate dev`).

`prisma/schema.prisma` tiene ambas variables (`url` y `directUrl`) en el datasource. La migración inicial (`20260716195550_init`) ya se aplicó correctamente contra la base de datos real, y el endpoint `/health` del backend confirma `database: "ok"`.

### 16. Checklist de la ronda de investigación "velocidad/calidad IA local" — **2026-09-14**

Tras las decisiones 11-15 (hardware/Ollama) se lanzaron 4 investigaciones más (WebSearch, sin tocar
código) para agotar la pregunta "¿qué más se puede mejorar?": hardware/Ollama avanzado, arquitectura
multi-modelo (¿separar en más agentes?), Ollama vs runtimes alternativos, y reestructuración de los
prompts del Cronista/Narrador. Este es el checklist masticado de las 4, en orden de implementación —
agrupado para que cada medición en vivo aísle una sola variable y no se mezclen ganancias.

**Ya decidido, sin necesidad de más pruebas:**
- Arquitectura de 2 pasos (Cronista clasifica → motor determinista sin LLM → Narrador narra) se
  **mantiene** — evidencia real (paper "Two Calls Beat Five Agents", modelos locales ≤7B) de que
  pipelines de más pasos con JSON intermedio degradan precisión y multiplican latencia en este tipo
  de hardware. No fragmentar el Cronista en sub-clasificadores tampoco — sus 4 decisiones no son
  independientes entre sí.
- **Quedarse en Ollama**, sin migrar de runtime — el bug de cache roto (`ollama#14780`) está acotado
  a `/api/chat` en CPU puro; el proyecto usa `/api/generate`, que el propio issue confirma que
  cachea bien, y la medición propia del warm-up (6.7s→0.5s) ya lo demuestra en producción. Ninguna
  alternativa (`llama-server`, koboldcpp, LM Studio) aporta ventaja real que compense perder la
  gestión automática de `keepAlive` que hoy simplifica el patrón clasificador efímero + narrador
  persistente.
- No reescribir las reglas "NUNCA/JAMÁS" del Narrador en positivo — evidencia insuficiente/débil,
  no vale el esfuerzo.

**Fase A — cambios de código, sin depender de medir en vivo (se pueden hacer ya, la próxima sesión):**

- [x] **A1. Reestructurar `fixedInstructions` del Narrador con headers temáticos** (evidencia más
  sólida de las 4 investigaciones: paper que testea Qwen-7B-chat directamente muestra que mezclar
  reglas en prosa continua hace que el modelo "invente" si la regla no está pegada a donde busca).
  Agrupar las 8+ reglas actuales en 4-5 bloques con etiqueta corta (p.ej. `PERSPECTIVA:`, `TONO:`,
  `MUNDO:`, `CAMPOS OPCIONALES:`), sin perder ninguna regla existente, solo reordenando/etiquetando.
  **HECHO 2026-09-14** — aplicado en `narrador.ts` (`fixedInstructions` del Narrador), `tsc -b
  --force` limpio, verificado con 2 turnos reales (con y sin NPC) sin regresión de calidad frente a
  las variantes ya medidas en B1/B4 (género correcto de NPC, materiales válidos del mundo, sin
  invención de detalles ausentes). No se movió la prohibición de alucinar combate a este bloque —
  ese contenido vive en `combatBlock` por una razón real (depende de `ctx.enCombate`/
  `npcFallsUnconsciousThisTurn`, no es texto fijo que se pueda mover sin más). El intento de atacar
  ese fallo concreto con un segundo few-shot (A3) se probó por separado y no dio mejora medible.
- [x] **A2. Sacar `hito` y `questProgress` del JSON forzado — DESCARTADO tras revisar el código
  real, 2026-09-14.** La premisa de la investigación externa ("son clasificación con datos ya
  conocidos, se pueden mover a regex/heurística en TypeScript") no se sostiene al leer
  `turnResolution.ts`: `questProgress` depende de que el LLM decida si ESTA escena narrada resuelve
  semánticamente una misión activa concreta (comentario real en el código, línea ~4027: "cerrar
  misiones por título EXACTO sin decirle qué misiones activas existen era casi imposible" — ya se
  intentó sin dárselo al LLM y no funcionó bien). `hito` depende de si la escena "logra algo
  significativo" — juicio narrativo, no keyword-matching; el propio código documenta un bug de
  calidad real de este campo (XP inflado por alucinación, ya mitigado con lista blanca
  `HITOS_QUE_PUEDE_PROPONER_EL_MODELO`, no relacionado con esto). Sacarlos del LLM a regex sería
  MÁS frágil, no menos — se mantienen dentro de `format` tal como están.
- [x] **A3. Segundo few-shot de combate (ambush) — PROBADO Y DESCARTADO, 2026-09-14.** Se
  implementó un ejemplo contrastivo (bien/mal) específico contra el fallo de "narrar un golpe ya
  conectado en el turno que INICIA el enfrentamiento" (guard `hasPrematureCombatResolution`), y se
  midió con un A/B limpio: 3 intentos con el ejemplo, 3 sin él, mismo prompt base, mismo escenario
  de emboscada. Resultado: 2/3 fallos CON el ejemplo, 2/3 fallos SIN él — sin diferencia real
  atribuible al ejemplo (dentro del ruido de una muestra tan pequeña). **Revertido** — no se deja
  código sin mejora medida. El fallo de fondo (el modelo narra el golpe conectado pese a la
  instrucción explícita) sigue existiendo y sigue dependiendo del guard post-hoc + reintento como
  única red de seguridad real; un few-shot adicional no lo resuelve, al menos no con este enfoque.
- [x] **A4. Simplificar el JSON schema del narrador — DESCARTADO, nada que simplificar.**
  Revisado el schema real: `newItem`/`newCompanion` ya son objetos planos de 2-3 campos string, sin
  anidación adicional; los campos de Reino (`newTerritory`/`newBuilding`/`newSubject`) YA aplican el
  principio de "fuera del schema salvo que la acción lo sugiera" desde 2026-07-19 (`reinoActive`),
  el mismo patrón que la investigación recomendaba. No hay grasa real que cortar sin perder
  información funcional necesaria.
- [x] Tras A1-A4: `tsc -b --force` limpio backend — verificado repetidamente durante la sesión, sin
  ningún test unitario roto por depender del texto literal de `fixedInstructions`.

**Fase B — requieren Ollama arrancado, medibles con el mismo método ya usado en esta sesión
(`prompt_eval_duration`/`load_duration` de la respuesta real de `/api/generate`, turnos jugados vía
Playwright contra la partida de TEST):**

- [x] **B1. Verificar el warm-up con NPC en escena** — **HECHO 2026-09-14, hallazgo negativo
  importante**: el warm-up NO reduce `prompt_eval_duration` de ningún turno real (con o sin NPC),
  solo evita el coste de carga del modelo en RAM (`load_duration`). Causa raíz: Ollama solo cachea
  por coincidencia EXACTA del prompt completo, no por prefijo compartido — ver decisión 15
  actualizada arriba para el detalle completo (3 experimentos aislados + workaround
  `LLAMA_ARG_CACHE_REUSE` probado y sin efecto). El fix de mover `combatBlock` sigue siendo correcto
  y se mantiene, pero A1 (headers en `fixedInstructions`) ya no tiene el mismo beneficio de cache
  que se esperaba — sigue aportando por la razón original (adherencia de reglas en modelos 7B), no
  por el cache.
- [x] **B2. `num_batch` 512→1024** — **YA APLICADO de fábrica, nada que cambiar.** Confirmado
  inspeccionando la línea de comandos real del proceso `llama-server` que Ollama 0.34.0 lanza:
  `-b 1024 -ub 1024` — Ollama ya usa 1024 como batch size por defecto en esta versión, no el 512
  que documentaba la investigación externa (probablemente el default de versiones más viejas de
  llama.cpp). No hay palanca que tocar aquí.
- [x] **B3. Confirmar capas del narrador en GPU vs CPU** — **YA AL MÁXIMO, nada que forzar.**
  Confirmado con `/api/ps`: `size_vram` (4899146300) == `size` (4899146300) — el narrador (7B) ya
  está 100% en VRAM/GTT, sin ninguna capa en CPU. No hace falta forzar `num_gpu=999` porque ya no
  queda margen que ganar por esta vía; el issue `ollama#14953` (overhead de ~450MB) no está
  bloqueando nada observable aquí, el modelo entero ya cabe.
- [x] **B4. Probar el campo `system` de Ollama para `fixedInstructions`** — **PROBADO Y
  DESCARTADO, 2026-09-14.** A/B real con 2 rondas (con NPC y sin NPC), `fixedInstructions` +
  `GOOD_NARRATION_EXAMPLE` movidos a `system`, resto en `prompt`. Velocidad: sin cambio real
  (`prompt_eval_duration` similar en ambas variantes, coherente con B1 — ninguna cachea porque el
  contenido variable siempre difiere). Calidad: **peor con `system`, en 2 de 2 muestras** — ronda 1
  confundió el género de un NPC femenino ("Ulkha Ketg, que está sentado") e inventó una chimenea no
  presente en los hechos dados; ronda 2 usó "metal" (material prohibido explícitamente en el SYSTEM,
  el mundo solo tiene hierro/hueso/cuero/madera/hielo sílice/arcilla). Confirma el riesgo anticipado
  en la investigación: el fine-tune de `tarkor-narrador` se entrenó con todo concatenado en un solo
  turno, y separar en rol `system` desalinea con eso. **No se aplica.**
- [x] **B5. Probar Qwen3-1.7B como reemplazo de `qwen2.5:1.5b-instruct` en el Cronista** —
  **PROBADO Y DESCARTADO, 2026-09-14.** Descargado vía `ollama pull qwen3:1.7b` (funcionó sin
  problemas de red, a diferencia de Mistral), registrado como `tarkor-cronista-qwen3`
  (`Modelfile.qwen3cronista`, con `/no_think` en el SYSTEM para desactivar el modo razonamiento
  nativo de Qwen3 — no queríamos tokens de pensamiento en una tarea de clasificación rápida). Medido
  con el mismo rigor que descartó el 3B (`keep_alive: '0'`, coste de carga en frío real, 2
  clasificaciones seguidas):
  - **Velocidad peor**: `eval_duration` (generación) 3.65-4.13s vs 2.50-2.56s del 1.5B actual —
    turno completo ~6-7s vs ~5-6s. Ninguna ganancia pese al benchmark teórico favorable.
  - **Calidad peor, con 2 fallos reales concretos**: pese al `/no_think` explícito, el campo
    `"razon"` seguía "razonando en voz alta" con párrafos de ~350 caracteres (el 1.5B da una frase
    corta); clasificó "examinar el terreno" como `"corta"`/15 min cuando la propia regla del
    Cronista dice que examinar es SIEMPRE "instantanea" (el 1.5B lo clasificó bien); y en una
    segunda prueba alucinó una justificación falsa ("el texto menciona una duración explícita")
    para una acción que no menciona ninguna duración. El 1.5B actual no cometió ninguno de estos
    fallos en las mismas 2 pruebas. **No se aplica** — modelo de prueba eliminado
    (`ollama rm tarkor-cronista-qwen3`), `Modelfile.qwen3cronista` se deja en el repo como registro
    del experimento (mismo patrón que `Modelfile.nemo`/`Modelfile.celeste`).

**Orden recomendado de la sesión de pruebas**: B1 primero (verifica que A1 tiene sentido aplicarlo
sobre una base que funciona) → A1-A4 aplicados y compilados → B1 remedido tras A1 → B2 → B3 → B4 →
B5, cada uno medido de forma aislada (un cambio, una medición, antes de aplicar el siguiente) para
poder atribuir la ganancia real a cada palanca por separado y no mezclarlas. Si algún experimento de
la Fase B no da la ganancia esperada, revertirlo antes de seguir con el siguiente — no acumular
cambios sin confirmar cada uno.

**Veredicto final de modelos — cerrado, 2026-09-14**: tras esta ronda completa (decisión 14: Nemo/
Celeste descartados; esta decisión: Qwen3-1.7B descartado para el Cronista), **`qwen2.5:7b`
fine-tuneado (`tarkor-narrador`) queda como narrador de producción y `qwen2.5:1.5b-instruct` como
Cronista, sin ningún candidato alternativo pendiente de probar por decisión explícita** — Llama 3.1
8B y otras familias quedan sin evaluar, no descartadas por evidencia sino por decisión de no seguir
ampliando la búsqueda dado el patrón consistente observado: cada alternativa "mejor sobre el papel"
probada en esta sesión (Nemo, Celeste, Qwen3) perdió al medirla en condiciones reales (turno
completo, JSON forzado, hardware real) frente al modelo ya en producción. Esto no es evidencia de
que Qwen2.5 sea el mejor modelo posible en abstracto — es evidencia de que es el mejor de los
candidatos evaluados en el caso de uso exacto de este proyecto (narrativa + JSON estructurado vía
GBNF + Steam Deck), y de que la búsqueda de "algo mejor" tiene rendimientos decrecientes claros a
estas alturas. Reabrir esta pregunta en el futuro solo si aparece una razón concreta (un modelo
nuevo con buena fama específicamente en JSON estructurado, no solo narrativa libre).

**Sobre el fallo de combate prematuro (narrar un golpe ya conectado antes de que el motor lo
resuelva)**: investigado a fondo, con hallazgo real (`ollama#`/papers sobre "priming failure" —
nombrar explícitamente lo prohibido en una instrucción negativa activa esa representación en vez de
suprimirla, en vez de evitarla). El guard post-hoc (`hasPrematureCombatResolution`) que ya existe
NO es un parche temporal a sustituir — es estructuralmente la única capa que puede dar una garantía
dura sobre el CONTENIDO de un campo de texto libre, porque GBNF solo controla el FORMATO (que sea
JSON válido), nunca el significado de la prosa dentro de un campo string. Pendiente de probar (no
aplicado todavía): reescribir `ambushHint` sin nombrar léxicamente "golpe/herida/derriba/dolor",
sustituyendo la prohibición por una instrucción de FORMA (dónde debe terminar la frase en el tiempo
narrativo) — con expectativa realista de reducir la tasa de fallo, no eliminarla del todo.

**Sobre el Cronista y el RAG**: revisados con el mismo escrutinio que motivó A1 (prosa mezclada sin
estructura) — ninguno de los dos tiene el mismo problema. El bloque de instrucciones del Cronista ya
está organizado en listas cortas por tema, sin necesidad de headers adicionales. El sistema RAG de
lore (`retrieval.ts`, `loreChunks.ts`) está sano: topK/umbral/truncado ya calibrados con medición
real en sesiones previas, sin ningún bug de "aparición fantasma" pendiente (ya resuelto con
`excludeTags` + separación de bloques en el prompt). Único hallazgo menor, no urgente: `retrieveLore`
y `selectRelevantFacts` podrían lanzarse en paralelo (`Promise.all`) en vez de secuencial — ahorro
de milisegundos, no prioritario frente al resto del roadmap del proyecto.

**Sobre el coste de generación (`eval_duration`) — auditoría barata cerrada, 2026-09-14**: dos
puntos de riesgo identificados en la investigación de sampling, ambos revisados y descartados.
(1) `top_k`: ni `Modelfile` ni `Modelfile.llama31` fijan un valor explícito, y `lib/ollama.ts` no
envía ningún `top_k`/`top_p`/`repeat_penalty` propio en la petición — ambos modelos usan el default
de Ollama (`40`), lejos del caso catastrófico (`top_k=0`, ~100x más lento en sampling puro) que
motivó la comprobación. (2) Antipatrón de gramática `x? x? x?...` en vez de `x{0,N}`: no aplica —
el único array real del schema (`newFacts`) usa la forma estándar de JSON Schema
(`{ type: 'array', items: {...} }`), delegado al conversor interno de Ollama, nunca una gramática
`.gbnf` escrita a mano donde ese antipatrón podría colarse.

**Cambio de narrador de producción (2026-09-14)**: `OLLAMA_MODEL_NARRADOR` pasó de `tarkor-narrador`
(Qwen2.5 7B) a `tarkor-narrador-llama31` (Llama 3.1 8B Instruct, `Modelfile.llama31`) — corrige el
prejuicio sin verificar de la decisión técnica 7 (2026-07-16, Llama descartado sin probar nunca).
Medido con el mismo rigor que descartó Mistral: fidelidad de NPC/materiales/JSON idéntica a Qwen,
pero resolvió 4/4 el fallo de "golpe de combate narrado antes de tiempo" que Qwen fallaba 2/4 veces
— el único fallo de calidad real y medido de toda la sesión que no se consiguió arreglar tocando el
prompt. ~20-30% más lento por turno en caliente, aceptado a cambio de la mejora de calidad. `tsc -b
--force` limpio; suite completa (2402 tests) verde cuando `turn.integration.test.ts` corre aislado
(los 16 fallos vistos en la corrida completa son un flake preexistente de candados compartidos entre
archivos, reproducido igual con y sin este cambio — no relacionado con el modelo). `tarkor-narrador`
(Qwen) se deja registrado como rollback, comentado en `.env`.

---

## Pendientes

*(Actualizado 2026-08-02 — este archivo documenta decisiones del arranque del proyecto (2026-07-16),
muy anterior a la migración local-first a Postgres/podman (2026-07-30, ver `docs/arquitectura/15-instalacion.md`)
y a todo el motor de turnos/combate actual. Los puntos 1 y 3 llevan meses hechos; se dejan tachados
por historial, no como pendiente real.)*

Preguntas técnicas que quedaron abiertas en [03-arquitectura.md](03-arquitectura.md) y que aún no se han cerrado:

1. ~~Esquema exacto de las tablas de Postgres~~ — **hecho**, ver `backend/prisma/schema.prisma` (el datasource remoto de Supabase de la nota de arriba fue sustituido por Postgres local vía podman, ver `docs/arquitectura/15-instalacion.md`).
2. ~~Benchmark real del Narrador (qwen2.5:7b)~~ — **hecho**, ver decisión 10. La comparación pendiente con `llama3.2:latest` (3B) para el Cronista/fallback quedó **obsoleta, no solo sin medir**: `llama3.2` nunca llegó a usarse — el Cronista/clasificador de producción es `qwen2.5:1.5b-instruct` (ver la nota de actualización 2026-08-11 en [03-arquitectura.md](03-arquitectura.md) § 1).
3. ~~Construir el servicio de tiradas y la orquestación de turno~~ — **hecho**, `backend/src/services/dice.ts` + `backend/src/routes/turn.ts` + `backend/src/services/turnResolution.ts` (motor de combate/exploración completo, muy por encima del alcance original de este punto).
