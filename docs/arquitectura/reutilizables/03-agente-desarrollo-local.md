# Agente de desarrollo local (Steam Deck + Ollama)

Documento reutilizable (fuera del roadmap): análisis del prompt de la usuaria del 2026-10-13 sobre
un agente de desarrollo 100% local en la Steam Deck LCD, y plan para Tarkor y otros proyectos.
Comprobado el 2026-10-13. Las velocidades son **(estimación)** por cálculo de ancho de banda: hay que
medirlas en la Deck.

## Veredicto

**Viable como ayudante para tareas acotadas; no como sustituto del agente actual para el roadmap de
Tarkor.**

- **Lo que sí se puede:** un modelo de unos 14B con buen razonamiento (Qwen3 14B en modo «pensar»)
  corre en la Deck a unos pocos tokens por segundo. Con Aider da para:
  - un test de una función;
  - un borrador de lore;
  - explicar o revisar un fragmento;
  - un arreglo en uno o dos archivos pequeños.
- **Lo que no:** las tareas del roadmap de Tarkor tocan archivos de 7.000-12.000 líneas
  (`turnResolution.ts`, `worldCatalog.ts`), varios a la vez, y siguen reglas largas (`CLAUDE.md`,
  `REVIEW.md`, runbooks). Eso exige mucho contexto y mucho razonamiento, que es justo lo que la Deck no
  da: en un agente, cada paso vuelve a leer el contexto, y en la GPU integrada leer 20.000 tokens cuesta
  **minutos** (estimación). A eso se suma que un modelo de 14B se equivoca bastante más en ediciones de
  varios archivos.
- **Si lo que se quiere es calidad de verdad sin nube:** el mismo esquema con Ollama en **otro equipo de
  casa** (un PC con 24 GB de GPU, o un Mac de 32 GB o más) y la Deck como terminal. Sigue siendo privado
  y sin costes recurrentes, y ahí sí cabe Devstral Small 2. Es la recomendación de fondo de este
  documento.

Sobre las opciones del prompt:

| Opción | Veredicto | Por qué |
|---|---|---|
| **Devstral Small 2** (`devstral-small-2`, 24B) | ❌ En la Deck. ✅ En un PC con 24 GB. | Existe, es Apache 2.0 y Mistral da 68% en SWE-bench Verified. Pero en Q4 pesa unos 13-15 GB: con SteamOS, el escritorio y la caché de contexto no caben en 16 GB, y entrar en swap lo deja por debajo de 1 token/s **(estimación)**. |
| **Qwen3-Coder-Next** (80B MoE) | ❌ | ~48 GB. Correcto descartarlo. |
| **PocketCoder** | ❌ Descartado | No se encontró ni en PyPI ni en búsquedas. Si existe, es demasiado reciente o marginal para confiarle el repositorio. |
| **LocalForge** | ❌ Descartado | Ídem: no se encontró. |
| **Aider** | ✅ **Elegido** | Maduro, consciente del repositorio (mapa con tree-sitter), un commit de git por cambio (se deshace con `/undo`) y edición por formato de diff: **no depende de que el modelo llame herramientas**, que es donde más fallan los modelos pequeños. |

## Límites reales del hardware

- **Memoria:** 16 GB compartidos entre CPU y GPU. SteamOS con el escritorio usa unos 3-4 GB. Si además
  corren el backend de Tarkor, Postgres, Vite y los tests, quedan **9-10 GB útiles** para pesos y caché.
  La GPU integrada no suma memoria: descargar capas en ella solo cambia **quién calcula**, no cuánto cabe.
- **Velocidad de generación:** la marca el ancho de banda de memoria (LPDDR5, unos 88 GB/s). Por cada
  token se leen todos los pesos activos: un 14B en Q4 (~9 GB) da como máximo teórico unos 9 tokens/s;
  en la práctica, **3-6 tokens/s**. Un 8B (~5 GB), **8-14 tokens/s** **(estimación)**.
- **Lectura del contexto (prefill):** es el cuello de botella real de un agente, porque cada paso manda
  archivos y el historial. En la GPU de la Deck se estiman **decenas o pocos cientos de tokens/s**: 20.000
  tokens son minutos **(estimación)**.
- **Modelos MoE** (gpt-oss-20b, Qwen3-30B-A3B): generan rápido porque activan pocos parámetros, pero los
  pesos **completos** tienen que caber (13-19 GB en Q4). No caben con lo demás.
- **Batería y calor:** el agente lleva la APU al máximo durante minutos. Conviene enchufarla; con batería,
  calcular 1-2 horas de uso y el ventilador alto.
- **Choque con el propio Tarkor:** el juego usa Ollama para el narrador. No se pueden tener a la vez el
  modelo del agente y el del juego; Ollama descarga uno para cargar el otro, con su espera.

## Modelos que caben (por calidad de razonamiento)

| Modelo (etiqueta de Ollama) | Q4 en disco | Memoria con 16k de contexto | Licencia | Para agente |
|---|---|---|---|---|
| **Qwen3 14B** (`qwen3:14b`) | ~9 GB | ~10-11 GB | Apache 2.0 | **El mejor razonamiento que cabe.** Modo pensar (`/think`). Edita bien con Aider. Justo de memoria. |
| Qwen3 8B (`qwen3:8b`) | ~5 GB | ~6-7 GB | Apache 2.0 | Más rápido y con margen; razona peor. El de trabajo diario si 14B va demasiado lento. |
| Qwen2.5-Coder 14B (`qwen2.5-coder:14b`) | ~9 GB | ~10-11 GB | Apache 2.0 | Mejor siguiendo formatos de edición; no razona en modo pensar. |
| Qwen3 4B Thinking 2507 (`qwen3:4b`) | ~2,5-3 GB | ~4 GB | Apache 2.0 | Para preguntas y planes cortos con contexto largo; flojo editando. |

Los porcentajes de SWE-bench de estos modelos pequeños no se publican de forma comparable con los de
Devstral o los modelos grandes. El tablero de Aider (polyglot) es la referencia más útil para
agentes de edición: consultarlo antes de elegir, porque cambia con cada versión.

Las etiquetas y tamaños exactos hay que mirarlos en `ollama.com/library` antes de bajar el modelo.

## Agentes CLI

| Agente | Instalación | Memoria de sesión | Conoce el repo | Edita con aprobación | Para modelos pequeños |
|---|---|---|---|---|---|
| **Aider** | `python -m pip install aider-install && aider-install` | Historial en `.aider.chat.history.md`; se retoma con `--restore-chat-history` | Sí (mapa del repositorio) | Aplica el diff y hace commit; `/undo` deshace; `--no-auto-commits` para revisar antes | **Sí**: formatos de edición sin llamadas a herramientas |
| OpenCode | ya usado en el proyecto para el lore (`AGENTS.md`) | Sí | Sí | Sí | Regular: necesita llamadas a herramientas fiables |
| Mistral Vibe CLI | pensado para Devstral | Sí | Sí | Sí | Para Devstral en un PC con GPU, no para la Deck |

## Instalación recomendada (Deck)

### 1. Ollama con Vulkan y memoria contenida

Ollama ya está instalado. Configuración con un *override* de su servicio (si corre como servicio de
usuario, `systemctl --user edit ollama`; si se arranca a mano, exportar las variables antes de
`ollama serve`):

```ini
[Service]
Environment="OLLAMA_VULKAN=1"              # GPU de la Deck por Vulkan (experimental; ROCm no soporta su gfx1033)
Environment="OLLAMA_FLASH_ATTENTION=1"     # necesario para cuantizar la caché
Environment="OLLAMA_KV_CACHE_TYPE=q8_0"    # caché de contexto a la mitad de memoria
Environment="OLLAMA_CONTEXT_LENGTH=16384"  # contexto por defecto: subirlo solo si sobra memoria
Environment="OLLAMA_NUM_PARALLEL=1"        # una sola petición: no duplica la caché
Environment="OLLAMA_MAX_LOADED_MODELS=1"   # un modelo cargado a la vez
Environment="OLLAMA_KEEP_ALIVE=30m"        # no recargar el modelo entre pasos del agente
```

- Comprobar que usa la GPU: `ollama ps` (columna PROCESSOR) y `ollama run qwen3:14b --verbose`
  (velocidades de prompt y de generación).
- **Capas en la GPU:** por defecto Ollama decide. Para forzar todas, un Modelfile con `PARAMETER
  num_gpu 99`; si falla por memoria, bajar el número hasta que cargue.
- **UMA en la BIOS** (4G, ver el documento de imágenes): en Vulkan sobre APU no es imprescindible, pero
  hay que medir con y sin él.
- Si Vulkan da problemas, quitar `OLLAMA_VULKAN`: Ollama vuelve a la CPU, más lenta pero estable.

### 2. Modelo

```sh
ollama pull qwen3:14b
ollama pull qwen3:8b        # el de respaldo rápido
```

### 3. Aider con el modelo local

```sh
python -m pip install aider-install && aider-install
export OLLAMA_API_BASE=http://127.0.0.1:11434
cd ~/proyecto
aider --model ollama_chat/qwen3:14b --no-auto-commits --map-tokens 1024 \
      --read CONVENCIONES-agente-local.md
```

Ajustes de contexto para Aider en `.aider.model.settings.yml`, en la raíz del proyecto:

```yaml
- name: ollama_chat/qwen3:14b
  extra_params:
    num_ctx: 16384
  edit_format: diff
```

- `ollama_chat/` (no `ollama/`) es el prefijo recomendado por Aider.
- `--map-tokens 1024`: mapa del repositorio pequeño, para no gastar el contexto en él.
- **Modo de trabajo:**
  1. `/ask` para entender y planear, con el modo pensar del modelo;
  2. `/add` solo de los archivos que hay que cambiar;
  3. pedir el cambio y revisar el diff antes de `/commit`.

## Expectativas

| Tarea | Con qwen3:14b en la Deck **(estimación)** |
|---|---|
| Pregunta sobre un archivo de 300 líneas | 1-3 min |
| Test unitario de una función | 3-10 min, a veces dos intentos |
| Cambio en dos archivos pequeños | 5-20 min, revisar el diff con cuidado |
| Tarea del roadmap de Tarkor (varios archivos grandes) | No recomendable |

## Acoplamiento a Tarkor

- **Dónde encaja:** como **tercer relevo** para trabajo pequeño cuando las dos cuentas de Claude no
  tienen margen:
  - borradores de lore (el flujo de OpenCode con `AGENTS.md` y `docs/borradores-opencode/` ya existe);
  - tests unitarios de funciones puras;
  - textos;
  - revisar un diff pequeño.
- **Contexto en pequeño:** igual que `docs/canon-opencode/` resume el canon para OpenCode, un
  `CONVENCIONES-agente-local.md` de una página (idioma, nombres, tests con vitest, `tsc` y `oxlint`
  antes de subir, rama de trabajo, «nunca editar `docs/rpgtarkor/`»). `CLAUDE.md` y `REVIEW.md` enteros
  no caben en su contexto.
- **Rama propia:** el agente local trabaja en `local/<tarea>`. Lo que haga lo revisa Claude o la usuaria
  antes de entrar en la rama de trabajo, con el `/code-review` de siempre.
- **No a la vez que el juego:** para jugar o pasar la ronda de pruebas, parar el agente
  (`ollama stop qwen3:14b`).
- **Comprobaciones iguales para todos:** el gancho de pre-push (`tsc`, `oxlint`, cobertura) también
  frena al agente local.

## Para otro proyecto

1. Ollama configurado como arriba (es igual en cualquier Linux con APU AMD).
2. Aider con un `CONVENCIONES-agente-local.md` de una página por proyecto.
3. Rama propia para el agente local y revisión antes de integrar.
4. Si el proyecto es grande, el mismo esquema con Ollama en un equipo con GPU de la red local
   (`OLLAMA_API_BASE=http://<equipo>:11434`) y Devstral Small 2.

## Plan de implementación

1. **Medir** (½ hora): `ollama run qwen3:8b --verbose` y `qwen3:14b --verbose` con y sin
   `OLLAMA_VULKAN`, con un prompt de unos 4.000 tokens. *Hecho cuando* hay cifras reales de lectura y de
   generación, y la tabla de «Expectativas» se corrige con ellas.
2. **Configurar** Ollama y Aider como arriba, más `CONVENCIONES-agente-local.md`.
3. **Prueba con tres tareas reales y acotadas** de Tarkor (un test, un borrador de lore, un arreglo
   de texto), revisadas como cualquier otra. *Hecho cuando* se sabe qué porcentaje sale bien a la
   primera y cuánto tarda.
4. **Decidir** con esos datos: quedarse con el ayudante en la Deck, o montar Ollama en un equipo con
   GPU de casa.

## Resumen ejecutivo

**Recomendación definitiva: Aider + `qwen3:14b`, en modo pensar, con 16k de contexto, caché `q8_0` y
Vulkan.** Es el mejor razonamiento que cabe en la Deck, sin nube. Aider no depende de las llamadas a
herramientas y deja cada cambio en un commit que se puede deshacer.

Úsalo para tareas pequeñas y acotadas, nunca para el roadmap de Tarkor. Si se busca calidad de
agente de verdad sin pagar nube, el siguiente paso no es otro modelo en la Deck, sino Ollama con
Devstral Small 2 en un equipo con GPU de casa y la Deck como terminal.

## Fuentes

- [Mistral: Devstral 2 y Vibe CLI](https://mistral.ai/news/devstral-2-vibe-cli/): Devstral Small 2 de 24B, 68,0% en SWE-bench Verified, Apache 2.0.
- [Guía de Devstral en Ollama](https://codersera.com/blog/run-devstral-locally-with-ollama/amp/) y [canirun.ai](https://www.canirun.ai/model/devstral-small-2-24b): etiqueta `devstral-small-2`, ~12,8-15 GB en Q4.
- [Phoronix: Vulkan experimental en Ollama](https://www.phoronix.com/news/ollama-Experimental-Vulkan) y [Ollama 0.12.11 con Vulkan](https://www.phoronix.com/news/ollama-0.12.11-Vulkan): `OLLAMA_VULKAN=1`.
- [9 modelos locales para agentes (2026)](https://www.kunalganglani.com/blog/best-local-model-agentic-coding): gpt-oss-20b justo en 16 GB; Qwen3 4B Thinking; fiabilidad de llamadas a herramientas antes que puntuaciones.
- Búsqueda de PocketCoder y LocalForge: sin resultados (solo otros agentes experimentales, como `ocla` u `ollama-code-cli`).
- Tarkor: `AGENTS.md`, `docs/canon-opencode/`, tamaños de `turnResolution.ts` (7.375 líneas) y `worldCatalog.ts` (12.482 líneas).
