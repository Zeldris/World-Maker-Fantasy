# Ronda de pruebas del 0.3 (`QA-27`): hallazgos (vivo)

Pedida por la usuaria el 2026-10-09: jugar como una jugadora normal, buscar bugs e incoherencias y
arreglarlos. Mismo método que la [Fase G del `0.1`](fase-g-0.1-hallazgos.md).

Entorno: contenedor en la nube con Postgres local, **Ollama simulado** (`tools/ci/mock-ollama.mjs`),
backend (`npx tsx src/server.ts`, viajes acortados: `TRAVEL_SEGUNDOS_PRIMER_TRAMO=5`,
`TRAVEL_SEGUNDOS_POR_TRAMO_EXTRA=3`, `TRAVEL_SEGUNDOS_MAXIMOS=20`) y frontend (`vite`), manejados
con Chromium (Playwright). Lo determinista (interfaz, movimiento, combate, Reino) se prueba de
verdad; la calidad narrativa no (las narraciones son del simulador).

## Hallazgos

| # | Hallazgo | Estado |
|---|---|---|
