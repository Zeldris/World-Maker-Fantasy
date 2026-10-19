# `opt-tokens` en Tarkor

Lo propio de este proyecto para la skill. En otro proyecto, este archivo se reescribe.

## Lo que ya ahorra (no proponerlo otra vez)

- **Rondas de pruebas en texto** (`QA-104`): `tools/playwright-e2e/mcp/estado.js` (HUD, modales y cajones con sus
  botones, tarjeta del encuentro, tooltips, lo escrito, diario y combate en unas 10 líneas) y `pulsar.js` (pulsar
  por texto); se lanzan con `tools/playwright-e2e/orden.sh --ayuda <ayuda> '<tk>'`. Captura solo para lo visual.
- **Escenarios** (`QA-102`): `tools/qa/escenario.sh` guarda y carga la base de juego, avanza días y da objetos: no se
  vuelve a jugar para llegar a un estado.
- **Recorridos** (`QA-103`): `tools/qa/recorrer.sh`, una línea por comprobación ya escrita.
- **Matriz de cobertura** (`QA-101`): `tools/qa/matriz-pruebas.py --bloque <Bloque>` dice qué falta sin leer el roadmap.
- **SQL contra la partida** en vez de navegar la interfaz para mirar datos (`rondas-de-pruebas.md`, `QA-97`).
- **Mapa del agente** (`QA-108`): `docs/mapa-agente.md` da por sistema las funciones de entrada, tests, tablas e
  interfaz; si una sesión exploró para encontrar algo que no estaba, se añade ahí.
- **Compactar a 300k** (`QA-109`): `CLAUDE_CODE_AUTO_COMPACT_WINDOW` en `.claude/settings.json`; antes el contexto
  crecía de ~76k a ~742k por tramo (media 428k por llamada).
- **Sesión nueva tras cada PR fusionado** (`QA-110`, runbook `skills-y-modelos.md`, paso 6).
- **Curva de contexto en `medir.py`** (`QA-111`): suelo, techo y llamadas por tramo entre compactaciones.
- **Tests de las herramientas** (`QA-113`): `medir.py` tiene el suyo en `tools/qa/tests/test_medir.py`; si se toca,
  se pasa `python3 -m unittest discover -s tools/qa/tests`.
- **Modelo por tarea** (`QA-117`): `medir.py` reparte la entrada por modelo, sesión principal y subagentes; el
  runbook `skills-y-modelos.md` manda escribir con un subagente `sonnet` cuando el plan está cerrado.
- **Pre-push con tests de lo que cambia** (`QA-88`, `QA-98`): no hace falta pasar la suite entera tras cada cambio.

## Gastos conocidos

- **Sesiones largas sin compactar**: el 2026-10-19, 578 llamadas en 24 h con 428k tokens de contexto medio (el 99 % de
  caché leída); en toda la sesión, 15 tramos de suelo ~76k y techo ~742k, unas 440 llamadas por tramo. (Las cifras
  de la primera medida, 543 llamadas y 566k, salían dobladas: `medir.py` contaba cada bloque de una respuesta.) Es la palanca más grande: contexto medio × llamadas
  (`QA-109`, `QA-110`).
- **Todo con el modelo grande**: en la sesión del 2026-10-19, la principal (Opus) llevó el 92 % de la entrada
  (2.795M de 3.046M) y 23 de los 61 subagentes también fueron con Opus (`QA-117`).
- **Rondas de pruebas**: muchas llamadas pequeñas (pulsar, mirar, pulsar). Encadenar pasos en una orden de
  `orden.sh` y mirar el estado al final.
- **Suites con base real** (backend, ~3.600 tests): la salida entera es grande; filtrar con `grep -E "Test Files|Tests
  |FAIL"`.
- **El registro de la sesión** pesa cientos de MB: medirlo con `medir.py`, nunca leerlo.
