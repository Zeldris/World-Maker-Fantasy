# Ayudas para el MCP de Playwright

`QA-46` (retro de `QA-27`, 2026-10-12). Con el MCP, cada orden por separado costaba varias llamadas
(orden, captura y leer la imagen) y una orden de más de 60 s se corta. Estas ayudas caben en ese
límite y devuelven en texto lo que importa, así que solo hace falta una captura cuando hay algo que
mirar.

Cada archivo es una función `async (page) => …` que se lanza con `browser_run_code_unsafe` y
`filename: "tools/playwright-e2e/mcp/<archivo>.js"`. El MCP no guarda nada entre órdenes, así que los
parámetros van en la página: antes, `browser_evaluate` con `() => { window.tk = { … } }`.

| Archivo | Parámetros (`window.tk`) | Qué hace |
|---|---|---|
| `estado.js` | — | HUD, avisos, final del diario y panel de combate, en texto. |
| `turno.js` | `accion` | Escribe la acción en el cuadro que toque (combate o texto libre), espera al turno y devuelve el estado. |
| `mover.js` | `x`, `y` | Abre «Moverte por la zona» si hace falta, pulsa ese punto (píxeles de pantalla), acepta «Ir hasta aquí» y espera a llegar o a un encuentro. |
| `captura.js` | `nombre` | Captura en `.playwright-mcp/<nombre>.png`. |
