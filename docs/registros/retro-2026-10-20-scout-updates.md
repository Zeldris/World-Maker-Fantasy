# Retro del PR de `claude/frontend-improvements-roadmap-0mpckt` (2026-10-20)

Lo revisado: lo que entra con el PR a `main` (`git log origin/main..HEAD`): `QA-176`, la skill `scout-updates` (diseño en
`docs/ia/skill-scout-updates.md`, `SKILL.md`, scripts `inventario.py`, `contrastar.py` y `banco.py` con sus tests, evals),
la primera pasada (`docs/scout/arquitectura.md`, informe del 2026-10-20, `propuestas.md` P-001 a P-021), las decisiones
de la usuaria, el borrado de los Modelfiles sin uso, la captura `IA_CASOS` en el backend, el `/code-review --max-findings
all` previo (17 hallazgos, arreglados en `bde0a825`) y las skills `scout-updates`, `opt-tokens` y `/code-review`.

**Estado (2026-10-20): pendiente de la usuaria.**

## Medida (`/opt-tokens`)

Principal: 211 llamadas, contexto medio 114,5k, 8 compactaciones (suelo 92k, techo 138k): la curva está sana, se
compacta a tiempo. Lo caro fue lo de alrededor: 4 subagentes de búsqueda en Opus con 4,59M de entrada (arranque ≈ 52k
cada uno); `docs/scout/arquitectura.md` leído 26 veces (146k arrastrados), `inventario.py` 20 y `ollama.ts` 11; un
WebFetch de la guía de skills de Anthropic metió 12k de golpe y arrastró 144k. Además, `medir.py` da a los subagentes
1.168 tokens de salida en 60 llamadas: el registro de los subagentes guarda el `usage` de los bloques a medias, así que
su salida no es fiable (ver 4).

## 1. Los scripts de la skill tenían fallos de análisis que sus tests no cubrían

**Qué pasó.** El `/code-review` encontró 17 hallazgos, casi todos en `inventario.py`, `contrastar.py` y `banco.py`:
`dependencies` de pyproject con `]` dentro de una cadena (`uvicorn[standard]`), versiones de Cargo en tabla en línea,
imágenes Docker con puerto de registro, digest o nombre de etapa (`AS`), un sello sin archivos que contaba como `igual`,
una carpeta como ruta de sello, y un juez caído que tiraba lo ya juzgado. Los tests usaban manifiestos de una línea, sin
esos casos. Se arreglaron todos y `test_scripts.py` pasó de 11 a 15 tests. **Propuesta.** En `scout-updates`, que
`evals/proyecto-ejemplo/` traiga un manifiesto de cada caso difícil (extras con corchetes, tabla en línea, imagen con
puerto y digest, Dockerfile multietapa) y `test_scripts.py` corra el inventario sobre él comparando con una salida
esperada: un formato nuevo se prueba añadiendo un archivo, no escribiendo un test. **Riesgo:** ninguno; la salida
esperada hay que regenerarla a mano cuando cambie el formato a propósito.

## 2. `arquitectura.md` se leyó entera 26 veces

**Qué pasó.** Cada sección que se sellaba, contrastaba o citaba desde el informe se buscaba con un `cat` del archivo
entero (≈ 5,6k tokens por lectura, 146k arrastrados). **Propuesta.** `contrastar.py --seccion <título>` imprime solo esa
sección con su sello, y el paso 1 de `SKILL.md` lo nombra: «para releer una sección, `--seccion`, no el archivo».
**Riesgo:** ninguno; si la sección no existe, el script lista los títulos.

## 3. Subagentes de búsqueda en Opus con arranque de 52k

**Qué pasó.** Las 4 búsquedas del paso 3 heredaron el modelo de la sesión (Opus) y arrancaron con ≈ 52k de contexto
cada una: 4,59M de entrada, más que la mitad de la principal. Buscar y resumir fuentes es el caso que `opt-tokens` marca
para un modelo más barato. **Propuesta.** En el paso 3 de `scout-updates`, los subagentes con `model: sonnet` y un
encargo cerrado (componentes, restricciones, fuentes de `fuentes.md`, formato de la tarjeta), sin pasarles el informe
ni `arquitectura.md` enteros. **Riesgo:** más afirmaciones equivocadas o fuentes peor elegidas. Contrapeso: el paso 6
ya obliga a recomprobar cada afirmación **fuerte** con su «cómo se comprueba»; se mide en la próxima pasada cuántas
caen en esa comprobación frente a esta.

## 4. `opt-tokens`: la salida de los subagentes sale casi a cero

**Qué pasó.** `medir.py` suma la salida por id de mensaje con el máximo de sus líneas, que vale para la principal; en
los registros de los subagentes las líneas guardan el `usage` del bloque a medias (en una muestra, 20 mensajes con 370
tokens de salida), así que `POR SUBAGENTE` da una salida imposible para quien escribió cuatro informes. **Propuesta.**
En `medir.py`, si la salida media de un subagente baja de un umbral (p. ej. 100 tokens por llamada), la columna sale
como «—» con una nota («el registro del subagente no guarda la salida final»), en vez de una cifra falsa. **Riesgo:**
ninguno; la entrada, que es lo que pesa, no cambia.

## 5. Páginas largas traídas a la principal

**Qué pasó.** Un WebFetch de la guía de buenas prácticas de skills metió 12k tokens en la principal, que arrastró 144k
hasta la siguiente compactación, para sacar unas pocas reglas. **Propuesta.** En `opt-tokens/proyecto.md`, entre los
gastos conocidos: «una página de documentación larga se lee con un WebFetch de pregunta estrecha (qué dice sobre X) o
en un subagente que devuelva solo lo que se busca». **Riesgo:** perder un matiz de la página; si hace falta, se
vuelve a pedir con otra pregunta.

## 6. `QA-176` entró durante la congelación del roadmap

**Qué pasó.** El `/code-review` lo marcó: `CLAUDE.md` dice que hasta cerrar las pruebas no entra ninguna tarea nueva del
roadmap. `QA-176` la pidió la usuaria directamente (mejora del entorno, como las de las retros). **Propuesta.** Ninguna
regla nueva: se le presenta para que confirme que cuenta como excepción, y la fila de `QA-176` lo dice
(«pedida por la usuaria durante la congelación»). **Riesgo:** ninguno.

## 7. `/code-review`: hallazgos que los tests debían haber visto

**Qué pasó.** La revisión hizo su trabajo, pero llegó al final: los fallos de análisis eran de escribir el script sin
casos reales. **Propuesta.** Ninguna a la revisión; la 1 los adelanta al test. **Riesgo:** ninguno.
