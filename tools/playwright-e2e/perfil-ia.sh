# QA-310: guarda (o olvida) con qué IA corre el juego en `logs/juego-ia.env`, para que `escenario.sh cargar|avanzar` lo
# recupere al relanzarlo. Se carga con `.` desde arrancar-juego.sh; usa IA_PERFIL, IA_REGISTRO e IA_CASOS del entorno.
# QA-519 (P494): con IA_REGISTRO y sin IA_CASOS, los casos (system y prompt enteros de cada llamada) van junto al
# registro, en `<registro>.casos.jsonl`: así se ve qué entra en una réplica sin relanzar el juego a mano.
# La primera línea lleva el id de arranque del sistema: tras un reinicio sin `--parar`, el archivo es de otra sesión y
# `escenario.sh` lo ignora (el perfil de ayer no se aplica solo a la ronda de hoy).
id_de_arranque() { cat /proc/sys/kernel/random/boot_id 2>/dev/null || true; }

guardar_perfil_ia() {
  mkdir -p logs
  if [ -n "${IA_PERFIL:-}" ]; then
    if [ -n "${IA_REGISTRO:-}" ] && [ -z "${IA_CASOS:-}" ]; then export IA_CASOS="${IA_REGISTRO%.jsonl}.casos.jsonl"; fi
    {
      printf '# boot=%s\n' "$(id_de_arranque)"
      printf 'export IA_PERFIL=%q\n' "$IA_PERFIL"
      [ -z "${IA_REGISTRO:-}" ] || printf 'export IA_REGISTRO=%q\n' "$IA_REGISTRO"
      [ -z "${IA_CASOS:-}" ] || printf 'export IA_CASOS=%q\n' "$IA_CASOS"
    } > logs/juego-ia.env
  else
    rm -f logs/juego-ia.env
  fi
}
