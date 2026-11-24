# Retro: gw-update 0.8.1 → 0.9.0 (`claude/wonderful-volta-662qt8`, 2026-11-24)

Revisión de la fase 1: 0 hallazgos (12 archivos propios; 129 copiados del flujo fuera). `/gw-opt-tokens` medido en la
misma sesión (5607 llamadas, 73 compactaciones; arranque fijo ~95k por llamada, el 86 % de la entrada).

## Propuestas

- **P1 · Comprobar las skills con tests antes de subir tras un gw-update** (proyecto). El primer push lo rechazó el
  `pre-push`: `tools/qa/skills-con-tests.py` pedía los tests de `gw-seo` en `ci.yml` y `ci-local.sh`. Arreglo: una
  línea en `.claude/gw/gw-scout-updates.md` (notas del proyecto para la actualización): «tras instalar una skill con
  `scripts/test_*.py`, `python3 tools/qa/skills-con-tests.py` antes del primer push». Riesgo: ninguno.
- **P2 · Arranque fijo y bucle de compactación** (proyecto, lo hace la usuaria). El arranque es ~95k de un corte de
  160k: cada tramo empieza al 66 % y compacta cada ~76 llamadas. Desconectar en claude.ai los conectores que no se
  usan aquí (Claude Docs, entre otros; `/context` los lista). Ya apuntado en `gw-opt-tokens.md`; sigue siendo la
  mayor palanca. Riesgo: ninguno si se dejan GitHub y el remoto.

## For Galivelop-workflow

- **G1 · `workflowClone` por defecto con la mayúscula del nombre del repo** (`../Galivelop-workflow`): el clon real
  estaba en `../galivelop-workflow` y `apply.py`/`review-scope.py` no lo encontraban. Propuesta: buscar sin distinguir
  mayúsculas, o que `doctor.py` avise con la ruta hallada.
- **G2 · `config.py set <clave> <valor>`**: no existe; poner `workflowClone` obligó a editar el JSON con Python.

**Estado:** aprobada por la usuaria el 2026-11-24 (Q-12): P1 aplicada en `.claude/gw/gw-scout-updates.md`; P2 la hace ella en claude.ai; G1 y G2 decididas para el flujo (las recoge `gw-harvest`).
