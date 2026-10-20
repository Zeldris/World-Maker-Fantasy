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
#   escenario.sh dar-reino <partida> comida=N bebida=N goirnos=N tesoro=N almacen:<slug>:<n>…
#                                               recursos del Reino (QA-143): comida/bebida (KingdomStats), Goirnos de la
#                                               bolsa (Save.goirnos) o del tesoro (KingdomStats.riqueza), objetos del
#                                               Almacén del Reino (AlmacenItem). Suma a lo que hay
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE=tarkor_juego
URL="postgresql://tarkor:tarkor@localhost:5432/$BASE"
DIR=tools/qa/escenarios
INDICE="$DIR/README.md"
case "${1:-}" in
  lista)
    sed -n '/^| /p' "$INDICE"
    ;;
  guardar)
    nombre="${2:?falta el nombre}"; que="${3:?falta qué tiene (partida, estado, día)}"
    [[ "$nombre" =~ ^[a-z0-9-]+$ ]] || { echo "nombre en minúsculas y guiones"; exit 2; }
    pg_dump -Fc --no-owner "$URL" -f "$DIR/$nombre.dump"
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
  *)
    sed -n '2,16p' "$0"; exit 2
    ;;
esac
