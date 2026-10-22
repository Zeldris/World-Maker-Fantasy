#!/bin/bash
# 3.2 (2026-10-21): cómo se construyen los escenarios de la ronda «Mundo vivo» a partir de otros, solo con las funciones
# del juego (dar-reino, preparar, avanzar: nada de UPDATE/INSERT a mano, QA-151). Cada paso lee y escribe la base que dicen
# `ESCENARIO_URL` (la de juego, o la temporal de `escenario.sh probar`), así se prueba sin tocar el juego:
#   escenario.sh probar <base> bash tools/qa/escenarios/construir.sh pasos <nombre>
# y se guarda de verdad con:  bash tools/qa/escenarios/construir.sh hacer <nombre>   (carga la base, aplica los pasos y guarda).
# Orden de la cadena: reino-dia39-recursos → reino-companero-npc → reino-sano-defensas → reino-guerra-vasallaje.
# `reino-hambre-sed`, `reino-combate-capitan` y `reino-combate-ganable` salen de reino-sano-defensas. Los dos de campamento y combate acaban jugando (ver el README de escenarios).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PARTIDA=cmvex1v0300057d0pdjlbezcj
e() { bash tools/qa/escenario.sh "$@"; }
modo="${1:?pasos|hacer}"; nombre="${2:?falta el escenario}"
base_de() {
  case "$1" in
    reino-companero-npc) echo reino-dia39-recursos ;;
    reino-sano-defensas) echo reino-companero-npc ;;
    reino-guerra-vasallaje|reino-hambre-sed|reino-combate-capitan|reino-combate-ganable) echo reino-sano-defensas ;;
    *) echo "escenario desconocido: $1" >&2; exit 2 ;;
  esac
}
# Única fuente de la descripción: `escenario.sh guardar` la escribe en la fila del README (no se edita a mano).
que_tiene() {
  case "$1" in
    reino-companero-npc) echo "Como \`reino-dia39-recursos\` más 2 Chozas nuevas y dos compañeros NPC reales (Tirag Susig, de Clan Serhu, y Hagar Kiugh, de Clan Helsig; sin \`rolReino\`, con \`sourceSlug\`, aprobación 50): para CR-15, CR-16, CR-42 (P289)" ;;
    reino-combate-capitan) echo "Como \`reino-sano-defensas\` con un combate ya abierto del personaje contra Ulkha Ketg (Int 20, capitán del bando), Hulki (Int 20) y herrero-serhu, abierto con \`combatePersonas\` en el lugar actual: para CR-45 (grupo hostil con capitán)" ;;
    reino-combate-ganable) echo "Como \`reino-sano-defensas\` con un combate abierto contra un solo rival débil, Herrero Serhu (nivel 1, sin capitán), con Tirag Susig y Hagar Kiugh (compañeros NPC) y Ruka en el grupo: el combate se gana en 1-3 rondas y el rival queda CONVALECIENTE, vivo, para elegir Matar o perdonar: para CR-15/CR-16 (vectores de aprobación, Recuerdos, título del vencedor, «se va», P293)" ;;
    reino-sano-defensas) echo "Como \`reino-companero-npc\` más Empalizada, Torre de vigía, Armería y Barracón, 5 súbditos orcos (3 soldados, 2 vigías), guarnición asignada y equipos de milicia comprados; sin asalto aún: para guarnición, milicia y cobertura de CR-65 y órdenes y caravanas de CR-47" ;;
    reino-guerra-vasallaje) echo "Como \`reino-sano-defensas\` con Clan Serhu en TENSIÓN con el Reino y Clan Helsig en GUERRA (presión por EXPANSION_TERRITORIAL_AGRESIVA); el vasallaje de Serhu sale en el panel del Reino: para CR-37 y CR-59" ;;
    reino-hambre-sed) echo "Como \`reino-sano-defensas\` con 40 días avanzados sin reponer: comida y bebida a 0, 4 días de hambre y 28 de sed (el Reino sin población nunca pasa hambre: hace falta tener súbditos): para CR-53 y CR-58" ;;
    *) echo "" ;;
  esac
}
pasos() {
  export ESCENARIO_URL="${ESCENARIO_URL:-postgresql://tarkor:tarkor@localhost:5432/tarkor_juego}"
  case "$1" in
    reino-companero-npc)
      e dar-reino "$PARTIDA" edificio:choza edificio:choza
      e preparar "$PARTIDA" reclutar:tirag-susig reclutar:hagar-kiugh
      ;;
    reino-sano-defensas)
      e dar-reino "$PARTIDA" edificio:empalizada edificio:torre-vigia edificio:armeria edificio:barracon
      e preparar "$PARTIDA" subditos:orcos:3:soldado subditos:orcos:2:vigia guarnicion milicia:2
      ;;
    reino-guerra-vasallaje)
      e preparar "$PARTIDA" relacion:clan-serhu:EXPANSION_TERRITORIAL_AGRESIVA:3 relacion:clan-helsig:EXPANSION_TERRITORIAL_AGRESIVA:6
      ;;
    reino-hambre-sed)
      e avanzar "$PARTIDA" "${DIAS_HAMBRE:-40}"
      ;;
    reino-combate-capitan)
      e preparar "$PARTIDA" combate:ulkha-ketg,hulki,herrero-serhu
      ;;
    reino-combate-ganable)
      e preparar "$PARTIDA" combate:herrero-serhu
      ;;
    *) echo "sin pasos: $1" >&2; exit 2 ;;
  esac
}
case "$modo" in
  pasos) pasos "$nombre" ;;
  hacer)
    e cargar "$(base_de "$nombre")"
    pasos "$nombre"
    e guardar "$nombre" "$(que_tiene "$nombre")"
    ;;
  *) echo "Uso: construir.sh pasos|hacer <escenario>" >&2; exit 1 ;;
esac
