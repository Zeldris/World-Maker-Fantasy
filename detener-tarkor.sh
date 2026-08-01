#!/bin/bash
# Contrapartida de iniciar-tarkor.sh (2026-07-31) — para todo lo que arranca ese script de un
# golpe: backend, frontend y Postgres. Identificado por PUERTO, no por nombre de ventana, para que
# funcione igual si acabaron en su propia ventana de terminal o en segundo plano (ver comentario
# de iniciar-tarkor.sh sobre por qué existen los dos caminos).
#
# Ollama se deja corriendo A PROPÓSITO — iniciar-tarkor.sh ya lo trata como posiblemente
# compartido con otro uso ("si ya estaba corriendo, no tocarlo"), así que pararlo aquí sería
# apagar algo que quizá no arrancó este script. Para pararlo también: cierra su ventana o
# `pkill -f "ollama serve"`.
set -e

echo "Parando Tarkor..."

for port in 3001 5173; do
  pid=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "Parando proceso en el puerto $port (PID $pid)..."
    kill "$pid" 2>/dev/null || true
  fi
done

if command -v podman >/dev/null 2>&1 && podman container exists tarkor-postgres 2>/dev/null; then
  if podman ps --format '{{.Names}}' | grep -qx tarkor-postgres; then
    echo "Parando Postgres (tarkor-postgres)..."
    podman stop tarkor-postgres >/dev/null
  fi
fi

echo
echo "Backend y frontend parados. Postgres parado (si estaba arriba)."
echo "Ollama se deja corriendo — para pararlo también, cierra su ventana o usa: pkill -f \"ollama serve\""
