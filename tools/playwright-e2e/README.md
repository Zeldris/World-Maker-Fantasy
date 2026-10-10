# Playwright para jugar el frontend real (herramienta de Claude)

No es dependencia del juego — instalación persistente para que Claude pruebe el frontend jugando de
verdad, sin reinstalar cada sesión. Ignorada por git (ver `.gitignore` de la raíz).

## Uso

```sh
export PATH="$HOME/.var/app/com.visualstudio.code/config/nvm/versions/node/v22.23.1/bin:$PATH"
cd tools/playwright-e2e
node smoke.mjs   # o cualquier script .mjs suelto que se escriba para una sesión de pruebas
```

Backend y frontend los arranca la usuaria — nunca arrancar/parar servidores desde aquí.

## Gotchas conocidos

- `npx playwright install chromium --with-deps` falla (`spawn su ENOENT`, sin `su` en este sandbox).
  Usar sin `--with-deps`: `npx playwright install chromium` a secas funciona bien headless.
- El botón "Actuar" existe DOS veces en el DOM (panel de acción libre + panel de combate) — usar
  `getByRole('button', { name: /^actuar$/i }).nth(0)` para el de texto libre.
- 409 "Todavía se está resolviendo tu turno anterior" es el guard `turnLock` funcionando bien — dar
  2-3s de margen tras cada acción antes de la siguiente.
- Resolución de turno vía Ollama puede tardar 20-30s reales — no es un cuelgue.
- `POST /saves/:id/resume` como `net::ERR_ABORTED` en consola de red al cargar es falso positivo de
  React StrictMode, no un bug.
- El composer normal (fuera de combate) NO es un `<input>`/`<textarea>` con `placeholder` real — es
  un `<div contentEditable>` con `data-placeholder`, `role="textbox"` y
  `aria-label="Acción de tu personaje"`. Usar `page.getByRole('textbox', { name: 'Acción de tu
  personaje' })` (nunca `input[placeholder=...]`, que da 0 resultados siempre) y comprobar
  `aria-disabled` en vez de `.isDisabled()`. El composer DENTRO de combate (`CombatComposer.tsx`) sí
  es un `<input>` normal con `placeholder="O describe tu acción..."`, distinto de este.

Después de un `page.goto()` nuevo, el directorio de trabajo del shell puede haberse reseteado a la
raíz del repo entre llamadas de Bash — usar siempre `cd` explícito a esta carpeta antes de `node
algo.mjs`, no asumir que el `cd` de una llamada anterior sigue vigente.

Detalle completo de estos gotchas y el historial de por qué se eligió Playwright sobre el MCP
oficial: memoria persistente de Claude, `tarkor_herramienta_playwright_2026-08-27.md`.
