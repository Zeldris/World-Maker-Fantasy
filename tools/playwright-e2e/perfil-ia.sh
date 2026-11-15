# QA-310: guarda (o olvida) con qué IA corre el juego en `logs/juego-ia.env`, para que `escenario.sh cargar|avanzar` lo
# recupere al relanzarlo. Se carga con `.` desde arrancar-juego.sh; usa IA_PERFIL e IA_REGISTRO del entorno.
# La primera línea lleva el id de arranque del sistema: tras un reinicio sin `--parar`, el archivo es de otra sesión y
# `escenario.sh` lo ignora (el perfil de ayer no se aplica solo a la ronda de hoy).
id_de_arranque() { cat /proc/sys/kernel/random/boot_id 2>/dev/null || true; }

guardar_perfil_ia() {
  mkdir -p logs
  if [ -n "${IA_PERFIL:-}" ]; then
    {
      printf '# boot=%s\n' "$(id_de_arranque)"
      printf 'export IA_PERFIL=%q\n' "$IA_PERFIL"
      [ -z "${IA_REGISTRO:-}" ] || printf 'export IA_REGISTRO=%q\n' "$IA_REGISTRO"
    } > logs/juego-ia.env
  else
    rm -f logs/juego-ia.env
  fi
}
