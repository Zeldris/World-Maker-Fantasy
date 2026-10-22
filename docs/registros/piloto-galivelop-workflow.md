# Piloto de Galivelop-workflow v0.2.0 en World-Maker-Fantasy

Fase 6 del plan del flujo. Rama `claude/piloto-galivelop-workflow`, desde `main` (`76ec6ae`), 2026-10-22.
Encargo y decisiones: la usuaria aprobó las propuestas de esta sesión (2026-10-22).

## Decisiones

- **`check`** (lo que hoy corre el pre-push, unos 80 s): tsc + lint de backend (con `prisma generate`) y frontend,
  `cobertura.py`, `mapa-agente.py` y `matriz-pruebas.py --comprobar`. Cada orden con npx pasa por `tools/qa/host.sh`
  (sandbox Flatpak de la Deck, `QA-180`).
- **Solo en el CI** (`ci.yml`, como hoy): `bitacora.py`, `enlaces-md.py` (15 s) y los unittest de `tools/qa` (300 s).
- **`relatedTests`**: `fast`, `tools/qa/tests-vitest.sh unidad {files}` (`vitest related` de backend `unit` y
  frontend, más el test de nombres de imágenes, `QA-35`); `slow`, `tests-vitest.sh integracion {files}` (BD real de
  lo que cambia, `QA-98`). Sustituye a `tools/qa/tests-relacionados.sh`.
- **`reviewMark`**: se mantiene `.claude/revision-main.sha`, ahora versionada (el flujo la commitea).
- **`requireRetro: true`**: conserva `QA-91` (sin retro decidida no hay marca).
- **`content`**: `docs/rpgtarkor|registros|producto/`, los `.md` de la raíz y los de las skills. Quedan fuera
  `docs/runbooks/` y `docs/mapa-agente.md`: son instrucciones para los agentes.
- **`designReferences`**: los seis juegos de la regla de diseño de `CLAUDE.md` (X4 primero).

## Fricciones

| # | Paso | Qué pasó | Cómo se resolvió |
|---|---|---|---|
| 1 | 2, `aplicar.py` | El clasificador del modo automático lo deniega entero («Code from External»), no solo al escribir `.claude/settings.json`: no llega a avisar. | Lo lanza la usuaria en su terminal. |
| 2 | 2 | El `.gitignore` de WMF ignoraba `.claude/*` salvo settings, hooks y skills: `.claude/gw.json` y `.claude/gw/` no se habrían subido, y nada lo avisa. La marca `.claude/revision-main.sha` también estaba ignorada. | Excepciones en `.gitignore`. |
| 3 | 1, `check` | `check` no tiene forma de relanzarse fuera de un sandbox (Flatpak de la Deck): el `pre-push` de WMF se relanzaba entero en el host. | Cada orden con npx, envuelta en `tools/qa/host.sh`. |

## For Galivelop-workflow

- `aplicar.py`: el aviso del modo automático llega tarde; el clasificador puede denegar la orden entera por ser código
  de otro repo. La guía (paso 2) debería decir de entrada que la lance la persona.
- `aplicar.py`/`doctor.py`: comprobar que `.claude/gw.json`, `.claude/gw/` y `reviewMark` no están en `.gitignore`
  (`git check-ignore`) y avisar con la línea que lo arregla.
- `check`/`pre-push`: un gancho para ejecutar las órdenes dentro de un envoltorio del proyecto (p. ej. `checkWrapper`)
  evitaría repetir `host.sh` en cada orden.
