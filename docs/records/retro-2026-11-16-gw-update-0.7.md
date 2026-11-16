# Retro: actualización del flujo a Galivelop-workflow v0.7.0 (2026-11-16)

Rama `claude/wonderful-volta-662qt8`. Incluye la pasada de `/gw-opt-tokens` (`measure.py --since b098334`: 68 llamadas,
7,5 M de entrada, el 97 % leída de caché, contexto medio 110k, suelo 94k, techo 107k, 1 compactación).

**Estado:** sin decidir; las propuestas esperan a la usuaria.

## Propuestas, de más a menos peso

1. **Suelo fijo de ~81k (87 % del arranque) por herramientas y MCP** (gasto). Ha subido de ~77k (`claude/gw-update-0.5.0`)
   a ~81k: entran conectores de claude.ai que este repo no usa (p. ej. Claude Docs). Desde el proyecto solo se
   puede apuntar; quien puede cambiarlo es la usuaria, desconectando en claude.ai los conectores que no use en las
   sesiones de código. Cambio en el proyecto: la cifra nueva en `.claude/gw/gw-opt-tokens.md` («Suelo fijo»).
   Riesgo de calidad: ninguno si solo se quitan los que no se usan. Ahorro: ~4k × cada llamada (unas 0,3 M en una
   sesión como esta). *Proyecto.*
2. **`Findings:` fuera del bloque final** (comprobaciones). El `commit-msg` rechazó el commit de la fase 1 porque había
   una línea en blanco entre `Findings:` y `Siguiente:`. El gancho ya lo pilla; falta decirlo en `AGENTS.md`
   («Mensajes de commit»): «`Findings:` y `Retries:` van en el bloque final, junto a `Siguiente:` y la atribución, sin
   línea en blanco». Coste: una línea. Riesgo: ninguno. *Proyecto* (el texto de `AGENTS.md` es nuestro), y al flujo
   la misma frase para su plantilla.
3. **Barrido `QA-362`: `tools/roadmap/resolver-conflicto.py`** (pendientes leves). Es el script con más leves abiertos (3):
   marcadores por texto exacto sin `conflict-marker-size`; dos parsers de marcadores con reglas distintas (con
   `tools/qa/resolver_hallazgos.py`); hay que lanzarlo a mano tras `git merge origin/main` (valorar un driver
   `merge=roadmap` en `.gitattributes`). Para cuando se vuelva al roadmap; la usuaria elige qué leves entran.
   *Proyecto.*
4. **El parche P24 de `test_measure.py` se reaplica en cada actualización** (navegación/flujo). En la v0.7.0 hubo que
   reaplicarlo a mano otra vez, y la revisión le encontró un leve (`StopIteration`). Que el test del flujo busque el
   archivo en la raíz y en `gw/` le quita el parche al proyecto. *Galivelop-workflow.*

## Skills

- `gw-selector`, `/code-review`: `review-scope.py --workflow ../galivelop-workflow` dejó 14 de 82 archivos y ~50 líneas;
  bastó la sesión, sin subagente. Bien.
- `gw-opt-tokens`: nada nuevo aparte del punto 1; las lecturas repetidas de `traspaso.md` (9×, 137k arrastrados) son de
  antes del `/clear` y ya las cubre `QA-261` (`recover.py --state`).

## For Galivelop-workflow

- Plantilla de `AGENTS.md`: decir que `Findings:`/`Retries:` van en el bloque final de trailers (punto 2).
- `gw-opt-tokens/scripts/test_measure.py`: buscar los archivos del flujo en la raíz y en `gw/`, con un error que nombre
  la ruta si no están (punto 4; hoy es el parche P24 de WMF).
