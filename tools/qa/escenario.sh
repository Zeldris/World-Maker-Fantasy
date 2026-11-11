#!/bin/bash
# QA-102 (2026-10-19): escenarios preparados de la base de juego (`tarkor_juego`). Llegar jugando a «reino con
# súbditos y bandidos cerca» cuesta cientos de acciones; se llega una vez, se guarda la instantánea (la base
# entera pesa menos de 1 MB) y cualquier cuenta la carga en segundos. Al cargar se aplican las migraciones y
# el catálogo nuevos (`arrancar-juego.sh`), así que una instantánea vieja sigue valiendo.
#
#   escenario.sh lista [patrón]                 las instantáneas y qué tienen (con patrón, solo las filas que casan,
#                                               sin distinguir mayúsculas; QA-312)
#   escenario.sh guardar <nombre> "<qué tiene>"  guarda la base de juego como tools/qa/escenarios/<nombre>.dump
#   escenario.sh cargar <nombre>                 la sustituye por esa instantánea y arranca el juego
#   escenario.sh avanzar <partida> <días> [--reparar]  avanza N días con el avance diario de siempre (para el juego y lo
#                                               vuelve a arrancar: el servidor no ve este avance en su cola). P369: con
#                                               --reparar avanza día a día y repara tras cada día los edificios dañados con
#                                               la función del botón «Reparar» (cuesta materiales; sin ellos lo avisa y sigue)
#   escenario.sh dar <partida> <slug>:<n>…        mete objetos del catálogo en su inventario (origen «escenario de prueba»)
#   escenario.sh dar-reino <partida> comida=N bebida=N goirnos=N tesoro=N almacen:<slug>:<n> edificio:<receta>…
#                                               recursos del Reino (QA-143): comida/bebida (KingdomStats), Goirnos de la
#                                               bolsa (Save.goirnos) o del tesoro (KingdomStats.riqueza), edificio:<receta> ya terminado, objetos del
#                                               Almacén del Reino (AlmacenItem). Suma a lo que hay; QA-300: con signo negativo RESTA (comida=-2,
#                                               también bebida, goirnos y tesoro), sin bajar de 0 y avisando si se pide más de lo que hay (para
#                                               dejar hueco en el Granero, que comparten comida y forraje: P336, 180/180 -> 178/180 con comida=-2)
#   escenario.sh preparar <partida> <paso…>      (3.2) estados que dar-reino no alcanza, solo con funciones del juego
#                                               (prepararReino.ts): subditos:<pueblo>:<n>[:<rol>][:sexo=m|f|pareja] (P378: por defecto alterna macho y hembra),
#                                               reparar (P369: repara todos los edificios dañados, como el botón «Reparar»), danar:<receta> (P301: deja dañado
#                                               el edificio activo de esa receta, como una tormenta), reclutar:<npc>, guarnicion,
#                                               milicia:<n>, relacion:<facción>:<EVENTO>:<n>, ganado:<especie>:<n>, convaleciente:<npc>[:combate],
#                                               combate:<npc>,<npc>… (de grupo), QA-293: combate1v1:<npc> (el 1v1 clásico contra ese NPC, viva donde viva: se lanza
#                                               contra la jugadora como un agresor; el panel sale al recargar; para P373, la huida por habilidad), P370: herido:<npc>[:grave|herido] (un compañero del combate en curso queda GRAVE o HERIDO:
#                                               el capitán enemigo, que manda caer sobre el más herido, lo señala en la ronda siguiente; para P292); QA-268: lider-muere:<facción> (el líder muere de viejo con 2
#                                               candidatos), alianza:<A>:<B> (alianza, ruptura y alianza nueva), vasallo-paga:<vasallo>
#                                               (fondos para la cuota entera sin saldar la deuda); QA-269: domable:<especie>
#                                               (un animal domable vencido y atado en una Jaula libre, para «Al corral»),
#                                               domador:<nivel> (Cazador Domador de ese nivel, mínimo 10, con sus puntos sin repartir);
#                                               QA-270: convaleciente:<npc>:combate (además deja el combate sin resolver: la tarjeta
#                                               «convaleciente» con Matar/Capturar/Clemente sale en el diario; el animal sigue ausente del mapa 6 h)
#                                               QA-266: sin-aliados (los compañeros salen del Grupo 1; el combate que se abra después lleva solo a la jugadora), punto-retirado:<especie>[:<n>] (un punto de fauna retirado con n presas, activo false, en el lugar actual;
#                                               usa una especie que el lugar no tenga: abrir el mapa de zona recompone y borra el de una que sí)
#                                               QA-298: partida-caza:<presa>:<n>[:permanente] (una partida de caza del Reino, la que hay en marcha tras esa presa o
#                                               una lanzada con la función del panel, queda en casa y a punto de volver con n piezas: al avanzar el día vuelve por el
#                                               camino normal, con el aviso «La partida de caza vuelve con…» y el paso por el Desolladero; con :permanente repite la
#                                               orden, así que con danar:desolladero se juega el corte de P338; pide cazadores libres con arma y la presa vista; para P338 y P339),
#                                               QA-299: partida-caza:<presa>:heridos=<h>[:permanente] (la partida vuelve sin piezas y con h heridos: el aviso «…no abate ninguno: 1 de los suyos sale herido… y la partida se retira» (con h > 1: «h de los suyos salen heridos… y se retiran»)
#                                               sale en Reino › Avisos al preparar, con el texto del juego; para P439) y mochila-descartar[:<n>] (tira lo suelto de la mochila hasta dejar n huecos libres,
#                                               10 por defecto, sin tocar lo equipado; con el Almacén lleno `mochila-libre` no sirve y `dar` no pasa de la capacidad; para P336),
#                                               P180: escasez:<facción>[:comida] (daña las cocinas de la facción hasta dejarla con carencia de comida: pedir
#                                               trabajo y los bandos dicen «le falta…»), P295: asalto:<facción> (un asalto viajero a la Capital con la Torre
#                                               dándolo por avisado y la milicia sin armar; la jugadora ha de estar en la Capital), P367: mochila-libre[:<n>]
#                                               (deposita en el Almacén, con Depositar, hasta dejar n huecos libres; 10 por defecto), P370: nivel:<n>[:<atr>,…] (sube de
#                                               nivel como ganar XP, de 2 a 19; sin atributos, los puntos quedan sin repartir; P386: con ellos,
#                                               p. ej. nivel:19:constitucion,fuerza, los reparte todos por turno, también con un combate abierto) y, en `dar`, el inventario no pasa de su capacidad
#                                               (avisa y da lo que cabe)
#                                               y, en dar-reino, edificio:<receta> de más tier que el personaje (se da como lo
#                                               levantaría la Casa de obras; p. ej. ayuntamiento-mediano y después jaula-grande)
#   escenario.sh probar <nombre> <orden…>        (QA-153) restaura la instantánea en una base temporal `prueba_<pid>` del mismo
#                                               Postgres (sin parar el juego ni tocar su base), corre la orden desde la raíz y
#                                               borra la base al acabar, también si la orden falla; sale con el código de la orden.
#                                               La orden es `dar …`, `dar-reino …` o `preparar …` (subcomandos de este script contra la base
#                                               temporal) o cualquier otra con DATABASE_URL y DIRECT_URL exportadas a ella
#                                               (p. ej. `npx tsx backend/src/scripts/x.ts`; ojo: corre desde la raíz). Ej.:
#                                               escenario.sh probar reino-dia39-recursos dar-reino <partida> comida=10
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# QA-188: en la Deck el host no trae psql, pg_dump ni pg_restore; los envoltorios de tools/qa/deck (van por podman) se añaden al PATH como respaldo.
. tools/qa/deck/_path.sh
BASE=tarkor_juego
ADMIN="postgresql://tarkor:tarkor@localhost:5432/tarkor"
URL="${ESCENARIO_URL:-postgresql://tarkor:tarkor@localhost:5432/$BASE}"
DIR=tools/qa/escenarios
INDICE="$DIR/README.md"
# P407: `cargar` y `avanzar` paran y relanzan el juego; la página que tiene abierta el driver de Playwright se quedaba
# con lo de antes (otro nivel) o en «ERR_CONNECTION_REFUSED» si se recargó mientras el juego estaba parado. Con el
# juego ya listo, se le pide que recargue (la misma URL si era del juego; si no, la portada). Sin driver no hace nada.
# Reabierto en la tanda 82: Vite vuelve unos 2 s antes que el backend y su cliente recarga solo la página vieja, que
# pide la partida con el backend caído («No se encuentra esta partida»). Por eso no basta un `goto`: se repite hasta
# que la página se queda en su URL sin ese error (5 intentos), y si no lo logra lo dice con un AVISO.
# `preparar`, `dar` y `dar-reino` no paran el juego pero cambian la partida: también recargan (no dentro de `probar`,
# que va contra una base temporal que la página no ve).
# QA-310: relanza el juego con el perfil de IA y el registro con que corría (los guarda arrancar-juego.sh); sin ellos,
# la tanda con Ollama real dejaba de escribir en logs/ia/. Lo que venga en el entorno manda. El archivo lleva el id de
# arranque del sistema en su primera línea (perfil-ia.sh): el de una sesión anterior (reinicio sin `--parar`) se ignora.
relanzar_juego() {
  if [ -z "${IA_PERFIL:-}" ] && [ -f logs/juego-ia.env ] &&
    [ "$(head -n1 logs/juego-ia.env)" = "# boot=$(cat /proc/sys/kernel/random/boot_id 2>/dev/null || true)" ]; then
    . logs/juego-ia.env
  fi
  bash tools/playwright-e2e/arrancar-juego.sh
}

recargar_pagina() {
  [ -s tools/playwright-e2e/driver.token ] || return 0
  [ -z "${ESCENARIO_URL:-}" ] || return 0
  bash tools/playwright-e2e/orden.sh <<'JS' || true
const u = page.url(); const destino = u.startsWith(FRONT) ? u : FRONT; let visto = '';
for (let i = 1; i <= 5; i++) {
  await page.goto(destino, { waitUntil: 'load' }).catch((e) => { visto = e.message.split('\n')[0]; });
  await page.waitForTimeout(1500);
  const texto = await page.locator('body').innerText().catch(() => '');
  if (page.url() === destino && texto.trim() && !/No se encuentra esta partida|ERR_CONNECTION_REFUSED/.test(texto)) return 'Página recargada: ' + destino + (i > 1 ? ' (intento ' + i + ')' : '');
  visto = visto || texto.trim().slice(0, 80); await page.waitForTimeout(1000);
}
return 'AVISO: la página del driver no carga la partida tras 5 intentos (' + page.url() + '): ' + visto;
JS
}

case "${1:-}" in
  lista)
    # QA-312: el índice entero son ~3,7k tokens; con un patrón, la cabecera y las filas que casan.
    if [ -n "${2:-}" ]; then
      sed -n '/^| /p' "$INDICE" | awk -v pat="$2" 'NR<=2 || tolower($0) ~ tolower(pat)'
    else
      sed -n '/^| /p' "$INDICE"
    fi
    ;;
  guardar)
    nombre="${2:?falta el nombre}"; que="${3:?falta qué tiene (partida, estado, día)}"
    [[ "$nombre" =~ ^[a-z0-9-]+$ ]] || { echo "nombre en minúsculas y guiones"; exit 2; }
    # QA-211: t16-reino y t20-mundo se guardaron con el id de la partida como descripción y el índice no decía qué
    # tenían. La descripción es una frase: partida, estado y día.
    [[ "$que" =~ [^[:space:]]+[[:space:]]+[^[:space:]]+ && ! "$que" =~ (^|[[:space:]])c[a-z0-9]{24}($|[[:space:]]) && "$que" != *"|"* ]] ||
      { echo "«$que» no describe la instantánea: di qué tiene (partida, estado, día), sin el id de la partida ni «|»"; exit 2; }
    # Por la salida estándar, no con `-f`: así vale también el shim de la Deck (pg_dump va dentro del contenedor).
    pg_dump -Fc --no-owner "$URL" > "$DIR/$nombre.dump.tmp" || { rm -f "$DIR/$nombre.dump.tmp"; echo "pg_dump ha fallado: no se guarda nada"; exit 1; }
    mv "$DIR/$nombre.dump.tmp" "$DIR/$nombre.dump"
    # La partida que se ha jugado la última (la de la última entrada del diario).
    partida=$(psql "$URL" -Atc 'select "saveId" from "LogEntry" order by "createdAt" desc limit 1')
    [ -n "$partida" ] || { rm -f "$DIR/$nombre.dump"; echo "No hay ninguna partida con diario: juega una acción antes de guardar"; exit 1; }
    grep -v "^| \`$nombre\` |" "$INDICE" > "$INDICE.tmp" && mv "$INDICE.tmp" "$INDICE"
    echo "| \`$nombre\` | \`$partida\` | $que | $(date +%F) |" >> "$INDICE"
    echo "Guardado $DIR/$nombre.dump ($(du -h "$DIR/$nombre.dump" | cut -f1)); partida $partida"
    ;;
  cargar)
    nombre="${2:?falta el nombre}"
    [ -f "$DIR/$nombre.dump" ] || { echo "No existe $DIR/$nombre.dump (escenario.sh lista)"; exit 1; }
    bash tools/playwright-e2e/arrancar-juego.sh --parar-juego > /dev/null
    psql postgresql://tarkor:tarkor@localhost:5432/tarkor -Atq -c "DROP DATABASE IF EXISTS $BASE WITH (FORCE)" -c "CREATE DATABASE $BASE"
    # pg_restore sale con 1 por avisos que no rompen nada (p. ej. el comentario de la extensión `vector`): se
    # enseñan y se sigue, para que el juego se arranque siempre.
    pg_restore --no-owner -d "$URL" "$DIR/$nombre.dump" 2> logs/escenario-restore.log || { echo "pg_restore con avisos:"; grep -m5 -i error logs/escenario-restore.log || true; }
    # La huella del catálogo se borra: arrancar-juego.sh vuelve a sembrarlo si la instantánea es de antes.
    rm -f "logs/catalogo-$BASE.huella"
    relanzar_juego
    recargar_pagina
    grep "^| \`$nombre\` |" "$INDICE" || true
    ;;
  avanzar)
    partida="${2:?falta la partida}"; dias="${3:?faltan los días}"; extra="${4:-}"
    [ -z "$extra" ] || [ "$extra" = "--reparar" ] || { echo "«$extra»: solo se admite --reparar"; exit 2; }
    bash tools/playwright-e2e/arrancar-juego.sh --parar-juego > /dev/null
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/avanzarDias.ts "$partida" "$dias" $extra) || { relanzar_juego; recargar_pagina; exit 1; }
    relanzar_juego
    recargar_pagina
    ;;
  dar)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/darObjetos.ts "$partida" "$@") || exit $?
    recargar_pagina
    ;;
  dar-reino)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/darReino.ts "$partida" "$@") || exit $?
    recargar_pagina
    ;;
  preparar)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/prepararReino.ts "$partida" "$@") || exit $?
    recargar_pagina
    ;;
  probar)
    nombre="${2:?falta el nombre}"; shift 2
    [ $# -gt 0 ] || { echo "falta la orden (escenario.sh probar <nombre> <orden…>)"; exit 2; }
    [ -f "$DIR/$nombre.dump" ] || { echo "No existe $DIR/$nombre.dump (escenario.sh lista)"; exit 1; }
    temporal="prueba_$$"
    tmpurl="postgresql://tarkor:tarkor@localhost:5432/$temporal"
    borrar_temporal() { psql "$ADMIN" -Atq -c "DROP DATABASE IF EXISTS $temporal WITH (FORCE)" >/dev/null 2>&1 || echo "AVISO: no pude borrar la base $temporal"; }
    trap borrar_temporal EXIT
    psql "$ADMIN" -Atq -c "CREATE DATABASE $temporal" || { echo "No pude crear la base $temporal"; exit 1; }
    # Como en `cargar`: pg_restore sale con 1 por avisos que no rompen nada.
    pg_restore --no-owner -d "$tmpurl" "$DIR/$nombre.dump" 2>/dev/null || true
    # Una instantánea vieja no trae las columnas nuevas: se aplican las migraciones (como `cargar`, que lo hace al arrancar).
    (cd backend && DATABASE_URL="$tmpurl" DIRECT_URL="$tmpurl" npx prisma migrate deploy >/dev/null) || { echo "No pude aplicar las migraciones a $temporal"; exit 1; }
    codigo=0
    case "$1" in
      dar|dar-reino|preparar) ESCENARIO_URL="$tmpurl" bash "$0" "$@" || codigo=$? ;;
      *) DATABASE_URL="$tmpurl" DIRECT_URL="$tmpurl" "$@" || codigo=$? ;;
    esac
    exit "$codigo"
    ;;
  *)
    sed -n '2,47p' "$0"; exit 2
    ;;
esac
