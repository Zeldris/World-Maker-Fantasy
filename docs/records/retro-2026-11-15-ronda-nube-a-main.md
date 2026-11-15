# Retro: ronda de la nube (tandas 131-133, P450), a `main` (2026-11-15)

Rama `claude/wonderful-volta-662qt8`, desde `455c6ca`: tandas 131-133 (P450, P128, P116, P243 comprobados; P131 en
parte; nuevo P472), arreglo de P450 y revisión de código con 8 hallazgos (7 arreglados en `dad8ee71`). Gasto medido
con `/gw-opt-tokens`: 121 llamadas en la principal, 13,2 M de entrada, contexto medio de 109k (suelo de 93k, techo de
130k), todo con Opus.

**Estado:** decidida por la usuaria (2026-11-15). T1, R1, R2 y R3 aprobadas: T1 aplicada (`QA-349`), R1 aplicada
(`QA-350`), R2 apuntada para el flujo y R3 se queda en la bitácora. T2 no elegida.

## Candidatas, de más a menos grave

- **T1 · Lecturas enteras de registros que ya tienen herramienta** (gasto, proyecto). `plan-comprobacion-puerta.md`
  21 veces (540k arrastrados), `pruebas-0.3-hallazgos.md` 13 (434k), `traspaso.md` 14 (290k) y
  `rondas-de-pruebas.md` 3 (439k), pese a `plan.py`, `marca-hallazgo.py`, `recover.py --state` y `seccion.sh`. Una
  regla escrita no bastaba: `tools/qa/aviso-lectura.py`, gancho que avisa sin bloquear (`QA-349`).
- **R1 · CI en rojo cinco commits sin que lo viera el `pre-push`** (comprobación, proyecto). `matriz-pruebas.py
  --comprobar` estaba solo en el check entero; el de rama corre los tests relacionados. Añadido a
  `relatedTests.fast` con los archivos que lee (`QA-350`).
- **T2 · Suelo de 93k por llamada** (gasto). 80k son del sistema y las herramientas (conectores como Claude Docs, que
  el proyecto no usa) y ~5k de la bitácora. No elegida.
- **R3 · Hallazgo leve de la revisión**: `asaltosRecientes` se lee fuera de la transacción de `GET /defensa`. Sigue en
  la bitácora como leve.

## For Galivelop-workflow

- **R2 · Avisos de lectura configurables.** `whole-read.py` solo mira `Read` y los registros por tamaño; casi todas
  las lecturas caras fueron por Bash (`sed`, `grep`, `cat`). Propuesta: una clave de `.claude/gw.json` que asocie cada
  archivo a la orden que lo sustituye (p. ej. `readPointers: {"<ruta>": "<orden>"}`) y un gancho del flujo para Bash
  y Read que avise con ella, como `tools/qa/aviso-lectura.py` en WMF.
