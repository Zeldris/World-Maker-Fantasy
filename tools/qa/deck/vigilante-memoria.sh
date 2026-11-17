#!/bin/bash
# QA-353: vigilante de memoria de la ronda. Un OOM del kernel (2026-11-15, 17:22) mató `llama-server` y, por ir
# todo en `flatpak-session-helper`, también el juego y Postgres. Este vigilante mira MemAvailable de /proc/meminfo
# y, si se queda por debajo del umbral más de la ventana, avisa y para la tanda (`juego.sh --parar`) antes de
# que llegue el OOM. Los picos cortos (`escenario.sh cargar` baja a ~1.000 MiB unos segundos) no lo disparan.
# Lo arranca y lo para `ia-ronda.sh` (PID en logs/vigilante-memoria.pid, registro en logs/vigilante-memoria.log).
# Variables (los tests usan valores diminutos): MEMINFO (/proc/meminfo), UMBRAL_MIB (1500), VENTANA_S (30),
# INTERVALO_S (2), MAX_VUELTAS (0 = sin tope), PARAR_TANDA (la orden que para la ronda: `ia-ronda.sh parar`).
# Sale con 0 al acabar MAX_VUELTAS y con 3 tras parar la tanda.
# QA-503: cada MUESTRA_S segundos (60; 0 lo apaga) apunta también el RSS de `llama-server` (suma de sus procesos,
# RSS_ORDEN: `ps -C llama-server -o rss=`), para ver si la caché de prompts en RAM («size limit: 8192 MiB») crece.
. "$(dirname "$0")/_raiz.sh"
MEMINFO="${MEMINFO:-/proc/meminfo}"
UMBRAL_MIB="${UMBRAL_MIB:-1500}"
VENTANA_S="${VENTANA_S:-30}"
INTERVALO_S="${INTERVALO_S:-2}"
MAX_VUELTAS="${MAX_VUELTAS:-0}"
MUESTRA_S="${MUESTRA_S:-60}"
RSS_ORDEN="${RSS_ORDEN:-ps -C llama-server -o rss=}"
# Por defecto para la ronda entera (juego, Ollama y este vigilante): bajar solo el juego deja el Ollama con el modelo
# cargado y la memoria baja.
PARAR_TANDA="${PARAR_TANDA:-bash $DECK/ia-ronda.sh parar}"

log() { echo "$(date +%H:%M:%S) $*"; }
# MemAvailable en MiB; vacío si el archivo falta o el valor no es un número.
disponible_mib() {
  local kb
  kb="$(awk '/^MemAvailable:/ {print $2; exit}' "$MEMINFO" 2>/dev/null)"
  case "$kb" in ''|*[!0-9]*) return 1 ;; esac
  echo $((kb / 1024))
}

# RSS de llama-server en MiB (suma de todos sus procesos); «-» si no hay ninguno.
rss_llama_mib() {
  $RSS_ORDEN 2>/dev/null | awk '$1 ~ /^[0-9]+$/ {s += $1; n++} END {if (n) print int(s / 1024); else print "-"}'
}

ultima_muestra=""
desde=""  # segundo (SECONDS) en que empezó la racha por debajo del umbral
avisado_ilegible=0
vueltas=0
log "vigilante de memoria: umbral ${UMBRAL_MIB} MiB, ventana ${VENTANA_S} s (MemAvailable de $MEMINFO)"
while :; do
  if mib="$(disponible_mib)"; then
    avisado_ilegible=0
    if [ "$MUESTRA_S" -gt 0 ] && { [ -z "$ultima_muestra" ] || [ $((SECONDS - ultima_muestra)) -ge "$MUESTRA_S" ]; }; then
      log "muestra: disponible ${mib} MiB · llama-server $(rss_llama_mib) MiB"
      ultima_muestra=$SECONDS
    fi
    if [ "$mib" -lt "$UMBRAL_MIB" ]; then
      [ -z "$desde" ] && desde=$SECONDS
      if [ $((SECONDS - desde)) -ge "$VENTANA_S" ]; then
        log "ALERTA: memoria disponible ${mib} MiB (llama-server $(rss_llama_mib) MiB), por debajo de ${UMBRAL_MIB} MiB desde hace $((SECONDS - desde)) s: se para la ronda para evitar el OOM." | tee /dev/stderr
        DESDE_VIGILANTE=1 $PARAR_TANDA || log "Aviso: no se pudo parar la tanda ($PARAR_TANDA)."
        exit 3
      fi
    else
      desde=""
    fi
  else
    # Sin lectura no se puede vigilar: se avisa una vez y se sigue (no se para una tanda sin motivo).
    [ "$avisado_ilegible" = 0 ] && log "Aviso: no se lee MemAvailable de $MEMINFO; sin vigilancia hasta que vuelva."
    avisado_ilegible=1
  fi
  vueltas=$((vueltas + 1))
  [ "$MAX_VUELTAS" -gt 0 ] && [ "$vueltas" -ge "$MAX_VUELTAS" ] && exit 0
  sleep "$INTERVALO_S"
done
