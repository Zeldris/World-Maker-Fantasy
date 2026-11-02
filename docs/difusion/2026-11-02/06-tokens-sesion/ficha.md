# Ficha: 349 llamadas en 24 horas y el archivo de traspaso leído 39 veces (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/06-tokens-sesion/` (NN = 06, propuesta P6 del 2026-11-02).

Idiomas: es, en

## Canales

- x
- reddit
- linkedin

## Qué se cuenta

- **En una frase (quien lo usa):** medimos dónde se fueron los tokens de una sesión larga de agente de IA y lo que más
  pesó fue releer siempre el mismo archivo, no el código; por eso ahora se reparte el trabajo y se corta entre tareas.
- **En una frase (técnico):** una sesión sin subagentes de trabajo encadenó tres pull requests: 349 llamadas en 24 h,
  25 compactaciones, contexto medio de 113k; el archivo de estado se leyó 39 veces (305k) y una página de
  documentación pesó 144k; la causa, no cortar entre tareas.
- **Estado:** medición del 2026-10-21 hecha por nosotros en un solo proyecto; los cambios de flujo ya están aplicados
  y escritos en las instrucciones de los agentes. El ahorro del cambio no está medido: el texto no lo cifra.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Una sola sesión en la nube, sin subagentes de trabajo, encadenó tres pull requests (los #71 y #72 y el de esa retro) | `docs/registros/retro-2026-10-21-la-linea.md:17-18` |
| 349 llamadas en 24 horas | Ídem, línea 17 |
| 25 compactaciones en la sesión | Ídem, líneas 17-18 |
| Contexto medio de 113k (suelo medio 93k, techo medio 138k), lo esperado con una ventana de 200k | Ídem, líneas 18-19 |
| La causa: no cortar entre tareas | Ídem, línea 19 |
| Lo más arrastrado: el archivo de traspaso entre sesiones, leído 39 veces (305k), y una página de la documentación de Anthropic (144k) | Ídem, líneas 19-20 |
| Tras esa medida se aplicó: si la sesión ya compactó, al fusionar se propone seguir tras un `/clear`; el estado vive en el archivo de traspaso, así que el riesgo para la calidad es ninguno (según la retro) | Ídem, líneas 36-38 |
| Al cerrar cada tarea o PR se pide empezar con un `/clear`: el contexto largo es casi todo el gasto, y el archivo de traspaso basta para retomar | `AGENTS.md:47-49` |
| El trabajo de más de un paso se reparte a subagentes de contexto limpio; la sesión principal planea, decide y revisa | `AGENTS.md:124-126` |
| Al empezar una sesión se lee la fila propia del archivo de traspaso y los últimos commits con un script; el archivo entero, solo si falta algo | `AGENTS.md:10-13` |
| El código del proyecto es público en GitHub (ya publicado antes; no se anuncia como novedad) | `.claude/gw/gw-media-content.md` |

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Imágenes

Una fila por cada archivo de `medios/` que se usa. Fuentes en `medios/fuente/` (`metricas.html`, `metricas.en.html`, a
1600×900, paleta del Portal); se renderizan con
`node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/2026-11-02/06-tokens-sesion`.

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/metricas.webp` | es: Tarjeta de métricas: 349 llamadas en 24 horas en una sola sesión de agente sin subagentes; el archivo de traspaso leído 39 veces pesó 305k y una página de documentación 144k; 25 compactaciones y contexto medio de 113k / en: Metrics card: 349 calls in 24 hours in a single agent session with no subagents; the handoff file read 39 times weighed 305k and one documentation page 144k; 25 compactions and 113k average context | x, reddit |
| `medios/metricas.en.webp` | en: Metrics card: 349 calls in 24 hours in a single agent session with no subagents; the handoff file read 39 times weighed 305k and one documentation page 144k; 25 compactions and 113k average context | x, reddit |
| `medios/metricas.png` | es: Tarjeta de métricas: 349 llamadas en 24 horas en una sola sesión de agente sin subagentes; el archivo de traspaso leído 39 veces pesó 305k y una página de documentación 144k; 25 compactaciones y contexto medio de 113k / en: Metrics card: 349 calls in 24 hours in a single agent session with no subagents; the handoff file read 39 times weighed 305k and one documentation page 144k; 25 compactions and 113k average context | linkedin |
| `medios/metricas.en.png` | en: Metrics card: 349 calls in 24 hours in a single agent session with no subagents; the handoff file read 39 times weighed 305k and one documentation page 144k; 25 compactions and 113k average context | linkedin |

## Uso interno

Lo que sirve al equipo y no se publica.

- «Bitácora» en los textos públicos = «archivo de traspaso entre sesiones» (`docs/registros/traspaso.md`).
- Retro del PR de «la línea» (2026-10-21), medida con `/opt-tokens`; cambios aplicados: `QA-187` (propuesta de `/clear`
  al fusionar si la sesión ya compactó), reparto con `orchestrate-dealer`, y `QA-261` (leer solo la fila propia).
- La retro da 305k y 144k sin unidad escrita; la propuesta P6 habla de tokens y se usa «tokens» en los textos. Si la
  usuaria prefiere ser literal, quitar la palabra «tokens» tras esas dos cifras.
- Cifras de una sola sesión y un solo proyecto: en los textos se dice que no son una regla general.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
