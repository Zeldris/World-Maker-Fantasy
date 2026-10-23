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
| `estado.js` | `diario` (líneas, 3) | En unas 10 líneas (`QA-104`): HUD, modales abiertos, la tarjeta del encuentro con sus botones (entre paréntesis, los desactivados), avisos, final del diario y panel de combate. |
| `turno.js` | `accion` | Escribe la acción en el cuadro que toque (combate o texto libre), espera al turno y devuelve el estado. |
| `mover.js` | `x`, `y` | Abre «Moverte por la zona» si hace falta, pulsa ese punto (píxeles de pantalla), acepta «Ir hasta aquí» y espera a llegar o a un encuentro. Devuelve `POSICIÓN` y `HORA` antes → después; con error claro si el punto cae fuera del mapa o tapado, hay un encuentro abierto o el personaje no se mueve (`SIN MOVIMIENTO`). |
| `viajar.js` | `x`, `y` | Cruza a otra zona por esa salida: pasa los encuentros tranquilos, confirma «Viajar»/«Entrar»/«Salir» y espera a llegar. Para ante uno hostil o un combate. |
| `puntos.js` | — | Cada punto del mapa de zona abierto, con su nombre y sus coordenadas de pantalla. |
| `pulsar.js` | `texto`, `contiene` (`true`, o el texto parcial solo), `mantener` (ms), `forzar` | Pulsa con el ratón lo visible con ese texto, también lo que Playwright no da por estable (tarjetas con animación) o no es un botón (pestañas); `mantener` para «Mantén para…». Con varias coincidencias elige la visible de más arriba; error claro si no hay ninguna, está deshabilitada o tapada por otro panel (`forzar: true` hace un clic del DOM). |
| `interactuar.js` | — | Pulsa «Interactuar» (aviso del mapa, menú del NPC o diario) y devuelve la escena o «COMBATE». |
| `opcion.js` | `opcion` (número o texto) | Elige una opción de la escena (`[data-opcion]`) y devuelve la vuelta siguiente. |
| `combate.js` | `ataque`, `defensa`, `rondas` | Juega rondas de combate con esas habilidades. |
| `pelear.js` | `x`, `y` (opcionales), `ataque`, `defensa`, `rondas` (3) | Se acerca, interactúa, elige «Combatir» y juega las rondas (`QA-125`). Solo con `orden.sh --ayuda pelear`. |
| `captura.js` | `nombre`, `selector`, `clip`, `calidad`, `png`, `completo` | Captura en `.playwright-mcp/<nombre>.jpg` (JPEG calidad 50; `QA-149`); `png:true` da PNG, `selector`/`clip` recortan (`selector` no admite `clip` ni `completo`: error), `completo:true` da PNG de página entera. Misma semántica que `shot()` del driver. |
