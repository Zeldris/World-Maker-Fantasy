#!/bin/bash
# QA-30 (retro del 2026-10-09): servidor MCP de Playwright para jugar el frontend real.
# En la nube no hay Chrome de sistema y @playwright/mcp lo buscaba en /opt/google/chrome: se usa el
# Chromium ya instalado en /opt/pw-browsers, sin ventana. En una máquina con navegador propio (la
# Steam Deck) se arranca como siempre.
CHROMIUM=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort | tail -1)
if [ -n "$CHROMIUM" ]; then
  exec npx -y @playwright/mcp@latest --browser chromium --executable-path "$CHROMIUM" --headless "$@"
fi
exec npx -y @playwright/mcp@latest "$@"
