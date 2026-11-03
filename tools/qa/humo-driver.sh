#!/bin/bash
# QA-291: humo del driver con el juego y el navegador de verdad. Los tests de escenario.sh usan un driver falso y los de
# mcp/estado.js, una página fija: P400 (el driver no recargaba tras `cargar`), P407 (ni tras `preparar`) y P409 (estado.js
# leía el texto de los tooltips de los chips) se vieron jugando. Aquí: `cargar` un escenario pequeño, la página del driver
# abierta en la partida enseña lo cargado (estado.js: HUD con «Gorhorn» y «Nivel 1»), `preparar nivel:3` y la página
# enseña «Nivel 3» (recarga de `preparar`), y un segundo `cargar` la devuelve a «Nivel 1» (recarga de `cargar`: sin ella
# se queda en el «Nivel 3» de antes).
# Uso: bash tools/qa/humo-driver.sh      (lo corre la CI tras «Escenarios de pruebas»)
# Sin Postgres, Playwright o Chromium: en local sale 0 con «OMITIDO: …»; en la CI (CI=true) es un fallo.
# En local se niega si el juego ya está en marcha (`cargar` lo pararía en plena ronda): HUMO_FORZAR=1 lo salta.
# Usa su propio driver (puerto 9399) y, al acabar, lo para junto al juego y restaura driver.token.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
. tools/qa/deck/_path.sh
ESCENARIO=hondonada-inicio
PARTIDA=cmvex1v0300057d0pdjlbezcj   # la de su fila en tools/qa/escenarios/README.md
export DRIVER_PORT="${HUMO_DRIVER_PORT:-9399}"
TOKEN=tools/playwright-e2e/driver.token

omitir() {
  if [ "${CI:-}" = true ]; then echo "FALLO (CI): $1" >&2; exit 1; fi
  echo "OMITIDO: $1"; exit 0
}
fallar() { echo "FALLO: $1" >&2; echo "--- estado de la página:" >&2; estado >&2; exit 1; }

command -v psql >/dev/null && psql postgresql://tarkor:tarkor@localhost:5432/tarkor -Atqc 'select 1' >/dev/null 2>&1 || omitir "sin Postgres local (tarkor:tarkor@localhost:5432)"
[ -d tools/playwright-e2e/node_modules/playwright ] || omitir "sin Playwright (cd tools/playwright-e2e && npm ci)"
[ -d backend/node_modules ] && [ -d frontend/node_modules ] || omitir "faltan backend/node_modules o frontend/node_modules (npm ci)"
if [ -z "${HUMO_FORZAR:-}" ] && [ "${CI:-}" != true ] && curl -s -m 2 -o /dev/null localhost:3001/health; then
  omitir "el juego ya está en marcha en :3001 (una ronda en curso); páralo o HUMO_FORZAR=1"
fi

token_previo="$(cat "$TOKEN" 2>/dev/null || true)"
mkdir -p logs
limpiar() {
  [ -z "${PID_DRIVER:-}" ] || kill "$PID_DRIVER" 2>/dev/null
  bash tools/playwright-e2e/arrancar-juego.sh --parar >/dev/null 2>&1
  # `--parar` baja el puerto del driver por defecto (9333), no el nuestro: ya está parado con su PID.
  if [ -n "$token_previo" ]; then printf '%s' "$token_previo" > "$TOKEN"; else rm -f "$TOKEN"; fi
}
trap limpiar EXIT

estado() { bash tools/playwright-e2e/orden.sh --ayuda estado '{"diario":1}' 2>&1; }
# Espera (20 s) a que el HUD de la página cumpla el patrón; devuelve 1 si no.
espera_hud() {
  for _ in $(seq 1 20); do estado | grep -E '^HUD: ' | grep -Eq "$1" && return 0; sleep 1; done
  return 1
}

node tools/playwright-e2e/driver.mjs > logs/humo-driver.log 2>&1 &
PID_DRIVER=$!
for _ in $(seq 1 20); do grep -q '^driver en' logs/humo-driver.log && break; kill -0 "$PID_DRIVER" 2>/dev/null || break; sleep 1; done
grep -q '^driver en' logs/humo-driver.log || { PID_DRIVER=; omitir "el driver no arranca (¿Chromium de Playwright?): $(head -c 300 logs/humo-driver.log | tr '\n' ' ')"; }

echo "== cargar $ESCENARIO"
bash tools/qa/escenario.sh cargar "$ESCENARIO" >/dev/null || fallar "escenario.sh cargar $ESCENARIO"
bash tools/playwright-e2e/orden.sh "await page.goto(FRONT + '/solitario/partida/$PARTIDA', { waitUntil: 'load' }); return 'abierta'" >/dev/null
espera_hud 'Gorhorn.*Nivel 1( |$)' || fallar "tras cargar, el HUD no enseña a Gorhorn de Nivel 1"
echo "ok: la partida cargada se ve (Gorhorn, Nivel 1)"

echo "== preparar nivel:3 (P407: debe recargar la página)"
bash tools/qa/escenario.sh preparar "$PARTIDA" nivel:3 >/dev/null || fallar "escenario.sh preparar nivel:3"
espera_hud 'Gorhorn.*Nivel 3( |$)' || fallar "tras preparar, el HUD sigue sin Nivel 3: la página no se recargó (P407)"
echo "ok: preparar recarga (Nivel 3)"

echo "== cargar otra vez (P400/P407: la página abierta en la partida debe recargar)"
bash tools/qa/escenario.sh cargar "$ESCENARIO" >/dev/null || fallar "escenario.sh cargar $ESCENARIO (2.ª vez)"
espera_hud 'Gorhorn.*Nivel 1( |$)' || fallar "tras el segundo cargar, el HUD no vuelve a Nivel 1: la página no se recargó (P400/P407)"
echo "ok: cargar recarga (vuelve a Nivel 1)"

# P409: estado.js no mete el texto de los tooltips de los chips en el HUD (la bio de un chip no es del HUD).
estado | grep -E '^HUD: ' | grep -Eiq 'tooltip|biograf' && fallar "el HUD de estado.js arrastra texto de un tooltip (P409)"
echo "Humo del driver: todo bien"
