#!/bin/bash
# est.sh <idPartida>: cifras del Reino (población, comida, bebida, felicidad, día) y todos los súbditos, por SQL.
[ -n "${1:-}" ] || { echo "uso: est.sh <idPartida>" >&2; exit 2; }
case "$1" in *[!A-Za-z0-9_-]*) echo "est.sh: id de partida no válido (solo letras, cifras, - y _)" >&2; exit 2 ;; esac
. "$(dirname "$0")/_raiz.sh"
S="$1"
bash tools/qa/sql.sh "select k.poblacion pob,k.felicidad fel,k.comida,k.bebida,k.riqueza,k.\"diasHambre\" h,k.\"diasSinCobrar\" sc,k.\"sinHerramienta\" sh,k.\"sinArma\" sa,k.forraje,k.\"diasFelicidadBaja\" fb,w.\"fictionalMinutes\"/1440+1 dia from \"KingdomStats\" k join \"WorldState\" w on w.\"saveId\"=k.\"saveId\" where k.\"saveId\"='$S'"
bash tools/qa/sql.sh "select \"name\",\"role\"::text,\"tarea\"::text from \"Subject\" where \"saveId\"='$S' order by 1" 2>&1
