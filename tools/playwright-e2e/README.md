# Jugar el frontend real con Playwright

Herramienta para las rondas de pruebas jugando (`QA-27`, `QA-30`): no es dependencia del juego. Sirve
en la nube y en la Steam Deck. Los scripts se versionan; las dependencias, los navegadores, las
capturas y los registros, no (`.gitignore` de la raíz).

## Arrancar

```sh
bash tools/playwright-e2e/arrancar-juego.sh        # base propia `tarkor_juego`, backend :3001, frontend :5173
cd tools/playwright-e2e && npm ci                  # la primera vez (en la nube, con PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)
node smoke.mjs                                     # el navegador arranca y el frontend responde
```

`arrancar-juego.sh` juega en una base aparte de la de los tests (que dejan partidas, Capitales y lugares
sueltos), con viajes acortados. `--rehacer` la borra y la siembra de cero. En la Deck, si los
servidores ya los arrancó la usuaria, basta con `smoke.mjs`.

La Deck necesita su Node en el `PATH`: `export PATH="$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node/v22.23.1/bin:$PATH"`.

## Escribir un script

Importa `lib.mjs` y pasa la partida por entorno: `SAVE_ID=<id> node mi_script.mjs`.

- `abrirNavegador()` y `abrirPartida()`: en la nube usan el Chromium de `/opt/pw-browsers`; en la Deck,
  el de Playwright. `FRONT` y `BACK` cambian las URL (por defecto `localhost:5173` y `:3001`).
- `actuar`, `atacarEnCombate`, `defenderseEnCombate`, `elegirOpcionDialogo`, `turnoDirecto`…:
  esperan a la condición real (el turno con LLM tarda de 30 s a varios minutos), no a un tiempo fijo.
- Las capturas van a `screenshots/` (ignorada por git).
- `historico/`: los scripts de sesiones pasadas, con ids de partida y rutas de la Deck fijos. Sirven de
  ejemplo, no para volver a ejecutarlos tal cual.

## Lo que se aprendió jugando

- El botón «Actuar» está dos veces en el DOM (acción libre y panel de combate): el de texto libre es
  `getByRole('button', { name: /^actuar$/i }).nth(0)`.
- El cuadro de acción fuera de combate es un `<div contentEditable>` con `role="textbox"` y
  `aria-label="Acción de tu personaje"` (`getByRole('textbox', { name: 'Acción de tu personaje' })`,
  y `aria-disabled` en vez de `.isDisabled()`). Dentro de combate es un `<input>` con
  `placeholder="O describe tu acción..."`.
- Un 409 «Todavía se está resolviendo tu turno anterior» es el candado de turno: dar 2-3 s de margen.
- `POST /saves/:id/resume` como `net::ERR_ABORTED` al cargar es React StrictMode, no un fallo.
- Con el Ollama simulado (`tools/ci/mock-ollama.mjs`) las narraciones meten trozos del prompt: no es
  un fallo del juego. La calidad narrativa se prueba con Ollama real.
- La forma de jugar, apuntar y arreglar en una ronda de pruebas está en el runbook
  [`docs/runbooks/rondas-de-pruebas.md`](../../docs/runbooks/rondas-de-pruebas.md).
