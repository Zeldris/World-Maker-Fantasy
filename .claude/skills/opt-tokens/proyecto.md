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
- **Pre-push con tests de lo que cambia** (`QA-88`, `QA-98`): no hace falta pasar la suite entera tras cada cambio.

## Gastos conocidos

- **Sesiones largas sin compactar**: el 2026-10-19, 543 llamadas en 6 h con 566k tokens de contexto medio (el 99 % de
  caché leída). Es la palanca más grande: contexto medio × llamadas.
- **Rondas de pruebas**: muchas llamadas pequeñas (pulsar, mirar, pulsar). Encadenar pasos en una orden de
  `orden.sh` y mirar el estado al final.
- **Suites con base real** (backend, ~3.600 tests): la salida entera es grande; filtrar con `grep -E "Test Files|Tests
  |FAIL"`.
- **El registro de la sesión** pesa cientos de MB: medirlo con `medir.py`, nunca leerlo.
