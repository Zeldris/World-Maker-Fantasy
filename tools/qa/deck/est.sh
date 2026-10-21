#!/bin/bash
# est.sh <idPartida>: cifras del Reino (población, comida, bebida, felicidad, día) y los súbditos, por SQL.
[ -n "${1:-}" ] || { echo "uso: est.sh <idPartida>" >&2; exit 2; }
. "$(dirname "$0")/_raiz.sh"
S="$1"
bash tools/qa/sql.sh "select k.poblacion pob,k.felicidad fel,k.comida,k.bebida,k.riqueza,k.\"diasHambre\" h,k.\"diasSinCobrar\" sc,k.\"sinHerramienta\" sh,k.\"sinArma\" sa,k.forraje,k.\"diasFelicidadBaja\" fb,w.\"fictionalMinutes\"/1440+1 dia from \"KingdomStats\" k join \"WorldState\" w on w.\"saveId\"=k.\"saveId\" where k.\"saveId\"='$S'"
bash tools/qa/sql.sh "select \"nombre\",\"rol\"::text,\"tarea\"::text from \"Subdito\" where \"saveId\"='$S' order by 1" 2>&1 | head -12
