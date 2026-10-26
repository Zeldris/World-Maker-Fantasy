#!/bin/bash
# QA-102 (2026-10-19): escenarios preparados de la base de juego (`tarkor_juego`). Llegar jugando a «reino con
# súbditos y bandidos cerca» cuesta cientos de acciones; se llega una vez, se guarda la instantánea (la base
# entera pesa menos de 1 MB) y cualquier cuenta la carga en segundos. Al cargar se aplican las migraciones y
# el catálogo nuevos (`arrancar-juego.sh`), así que una instantánea vieja sigue valiendo.
#
#   escenario.sh lista                          las instantáneas y qué tienen
#   escenario.sh guardar <nombre> "<qué tiene>"  guarda la base de juego como tools/qa/escenarios/<nombre>.dump
#   escenario.sh cargar <nombre>                 la sustituye por esa instantánea y arranca el juego
#   escenario.sh avanzar <partida> <días>        avanza N días con el avance diario de siempre (para el juego y lo
#                                               vuelve a arrancar: el servidor no ve este avance en su cola)
#   escenario.sh dar <partida> <slug>:<n>…        mete objetos del catálogo en su inventario (origen «escenario de prueba»)
#   escenario.sh dar-reino <partida> comida=N bebida=N goirnos=N tesoro=N almacen:<slug>:<n> edificio:<receta>…
#                                               recursos del Reino (QA-143): comida/bebida (KingdomStats), Goirnos de la
#                                               bolsa (Save.goirnos) o del tesoro (KingdomStats.riqueza), edificio:<receta> ya terminado, objetos del
#                                               Almacén del Reino (AlmacenItem). Suma a lo que hay
#   escenario.sh preparar <partida> <paso…>      (3.2) estados que dar-reino no alcanza, solo con funciones del juego
#                                               (prepararReino.ts): subditos:<pueblo>:<n>[:<rol>], reclutar:<npc>, guarnicion,
#                                               milicia:<n>, relacion:<facción>:<EVENTO>:<n>, ganado:<especie>:<n>, convaleciente:<npc>,
#                                               combate:<npc>,<npc>…; QA-259: lider-muere:<facción> (el líder muere de viejo con 2
#                                               candidatos), alianza:<A>:<B> (alianza, ruptura y alianza nueva), vasallo-paga:<vasallo>
#                                               (fondos para la cuota entera sin saldar la deuda)
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
case "${1:-}" in
  lista)
    sed -n '/^| /p' "$INDICE"
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
    bash tools/playwright-e2e/arrancar-juego.sh --parar > /dev/null
    psql postgresql://tarkor:tarkor@localhost:5432/tarkor -Atq -c "DROP DATABASE IF EXISTS $BASE WITH (FORCE)" -c "CREATE DATABASE $BASE"
    # pg_restore sale con 1 por avisos que no rompen nada (p. ej. el comentario de la extensión `vector`): se
    # enseñan y se sigue, para que el juego se arranque siempre.
    pg_restore --no-owner -d "$URL" "$DIR/$nombre.dump" 2> logs/escenario-restore.log || { echo "pg_restore con avisos:"; grep -m5 -i error logs/escenario-restore.log || true; }
    # La huella del catálogo se borra: arrancar-juego.sh vuelve a sembrarlo si la instantánea es de antes.
    rm -f "logs/catalogo-$BASE.huella"
    bash tools/playwright-e2e/arrancar-juego.sh
    grep "^| \`$nombre\` |" "$INDICE" || true
    ;;
  avanzar)
    partida="${2:?falta la partida}"; dias="${3:?faltan los días}"
    bash tools/playwright-e2e/arrancar-juego.sh --parar > /dev/null
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/avanzarDias.ts "$partida" "$dias") || { bash tools/playwright-e2e/arrancar-juego.sh; exit 1; }
    bash tools/playwright-e2e/arrancar-juego.sh
    ;;
  dar)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/darObjetos.ts "$partida" "$@")
    ;;
  dar-reino)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/darReino.ts "$partida" "$@")
    ;;
  preparar)
    partida="${2:?falta la partida}"; shift 2
    (cd backend && DATABASE_URL="$URL" DIRECT_URL="$URL" npx tsx src/scripts/prepararReino.ts "$partida" "$@")
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
    codigo=0
    case "$1" in
      dar|dar-reino|preparar) ESCENARIO_URL="$tmpurl" bash "$0" "$@" || codigo=$? ;;
      *) DATABASE_URL="$tmpurl" DIRECT_URL="$tmpurl" "$@" || codigo=$? ;;
    esac
    exit "$codigo"
    ;;
  *)
    sed -n '2,26p' "$0"; exit 2
    ;;
esac
