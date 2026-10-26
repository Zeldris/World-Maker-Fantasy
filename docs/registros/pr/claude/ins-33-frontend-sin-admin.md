**Título:** INS-33: frontend sin admin en el juego empaquetado

## Summary

Tarea `INS-33` del instalador de Tarkor ([Instalador-WMF-Tarkor](https://github.com/Zeldris/Instalador-WMF-Tarkor),
fase 3 «Modo empaquetado del juego»; no entra en los roadmaps de WMF). El juego de escritorio no lleva las
herramientas de admin ni la creación de personaje desde cero. Se detecta con `window.__TARKOR__`, que Tauri inyecta
(contrato en `docs/04-empaquetado-tauri.md` del instalador); en desarrollo y en la web no existe y todo sigue igual.

- `lib/empaquetado.ts`: `leerTarkor()` (lectura única, que usa también `apiBaseUrl()`) y `esEmpaquetado()`.
- `Home.tsx`: sin el enlace «Admin: enciclopedia completa».
- `App.tsx`: sin las rutas `/admin/*`. No hay ruta comodín: una URL `/admin/*` escrita a mano no casa con ninguna.
- `modoDesarrollador.ts`: `useHerramientasAdminVisibles()` devuelve `false`, esté o no el modo desarrollador.
- `CharacterSelect.tsx`: la pestaña «Crear desde cero» sale deshabilitada con «En construcción» (también fuera de
  Tauri); el formulario se deja sin alcanzar para retomarlo.
- `ComingSoon.tsx`: texto nuevo («en construcción para futuras versiones»).

El backend no cambia (`INS-34…36`).

Retro sin decidir: [`retro-2026-10-26-ins-33.md`](../../retro-2026-10-26-ins-33.md).

## Evidencia

- 9 tests nuevos (`App.empaquetado.test.tsx`, `empaquetado.test.ts`, `CharacterSelect.test.tsx`) que fallan sin el
  arreglo (comprobado desde el repo del instalador).
- Antes de los leves: `tsc`, `oxlint` y vitest, 798 tests en 168 archivos, en verde.
- `/code-review --max-findings all` contra `origin/main`: sin hallazgos graves ni medios; 3 leves de forma arreglados
  (`import` de `api.ts`, comentario de `modoDesarrollador.ts`, comentario de `App.tsx`). Queda uno apuntado en la
  bitácora: `setTab('custom')` y la rama `tab === 'custom'` quedan sin alcanzar, a propósito.
- CI local: ver la bitácora (cuota de Actions agotada, `QA-215`).

## Riesgo

Sin migración de BD ni cambios en las partidas guardadas: reversible.
