**Título:** INS-31: URL del backend en tiempo de ejecución (`window.__TARKOR__.apiUrl`)

## Summary

Tarea `INS-31` del instalador de Tarkor ([Instalador-WMF-Tarkor](https://github.com/Zeldris/Instalador-WMF-Tarkor),
fase 3 «Modo empaquetado del juego»; no entra en los roadmaps de WMF). En la app de escritorio, Tauri elige un
puerto libre para el backend al arrancar, así que `VITE_API_URL`, que se fija al compilar, no sirve. Ahora el
frontend toma la URL en tiempo de ejecución:

- `apiBaseUrl()` en `frontend/src/lib/api.ts`, síncrona y sin barra final. Toma `window.__TARKOR__.apiUrl` si es una
  cadena no vacía; si no, `VITE_API_URL`; si no, `http://localhost:3001`. Sustituye a la constante `API_URL`, y todas
  las URLs de `api.ts` (también `resolveImageUrl`) pasan por ella. Fuera de Tauri todo funciona igual.
- Tipo de `window.__TARKOR__` en `vite-env.d.ts`.
- `useReconnectionPolling.ts`: el aviso de backend caído ya no nombra `localhost:3001`.
- `docs/arquitectura/15-instalacion.md` explica el nuevo orden.

El contrato está en `docs/04-empaquetado-tauri.md` del repo del instalador. La inyección del lado de Tauri
(`initialization_script`) es `INS-41`.

Retro sin decidir: [`retro-2026-10-26-ins-31.md`](../../retro-2026-10-26-ins-31.md).

## Evidencia

- `apiBaseUrl.test.ts`, 8 casos: el orden de las tres fuentes, los valores no válidos de `apiUrl` (cadena vacía,
  número, `null`, `undefined`) y la barra final.
- CI local (`tools/qa/ci-local.sh`, cuota de Actions agotada, `QA-215`) sobre la fusión con `main` (`a099e75`,
  avance rápido): los tres jobs en verde salvo un paso. Backend: lint, tsc, migraciones, esquema, `reindex-lore`,
  `seed-catalog` y vitest con Postgres, 3953 tests en 321 archivos. Frontend: lint, build y vitest, 788 tests en
  165 archivos. El paso rojo es la descarga de Chromium para Playwright: el proxy del contenedor bloquea
  `cdn.playwright.dev`. El test de navegador (`test_ayudas_mcp.py`, 8 tests, con `CI=true`) pasa aparte con el
  Chromium ya instalado en `/opt/pw-browsers`.

## Riesgo

Sin migración de BD ni cambios en las partidas guardadas: es reversible. Hay un caso límite sin cambiar: con
`VITE_API_URL=""` la base queda vacía y las peticiones son relativas, igual que antes.
