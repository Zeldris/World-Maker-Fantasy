## Summary

Banco de calidad del narrador de `QA-176` ([informe](docs/scout/informes/2026-10-21.md)). El actual `tarkor-narrador-llama31` gana a los tres candidatos. La usuaria rechazó P-005, P-006 y P-007, y los modelos de prueba están borrados de la Deck.

```text
tasa de victorias (juicio a ciegas, los dos órdenes; consistencia 0,939)
  llama31 (actual)   0,727
  gemma4:e2b (P-007) 0,500   más rápido (turno p50 18,8 s frente a 29,3 s), misma RAM
  qwen3.5:4b (P-006) 0,394
  gemma3:4b  (P-005) 0,379
```

Con el PR entra también la retro, aprobada entera por la usuaria ([retro](docs/registros/retro-2026-10-21-banco-narrador.md)):

```diff
 .claude/skills/scout-updates/
+  banco.py resumen --detalle      # cara a cara, puntos por caso, derrotas (QA-177)
+  banco-calidad.md «Decisión»     # adoptar / dentro del ruido / rechazar (QA-178)
 .claude/skills/opt-tokens/medir.py
+  `bash x.sh` es ejecución, no lectura (QA-179)
 .githooks/pre-push
+  en el sandbox Flatpak se relanza por host.sh (QA-180)
 tools/qa/host.sh
+  filtra el ruido del bashrc de la Deck en español y de nvm (QA-180)
 tools/qa/bitacora.py
+  --en-curso: avisa de una tarea 🚧 citada sin tocar su entrada (QA-182)
```

`QA-181` (herramientas del driver) queda para la próxima sesión de arreglos. Y dos reglas del flujo del PR (`QA-183`, `QA-184`): antes del PR, tres fases (código, entorno, cierre), y el PR de una sesión local lo crea Claude en la nube.

## Evidence

- No toca ni backend ni frontend: el pre-push pasó `tsc` y `oxlint` de los dos en cada push.
- `test_banco.py`, 5 OK: `resumen` devuelve `cara_a_cara`, `por_caso` y `derrotas` con el mismo conteo que la tasa. Un par que cambia al girarlo cuenta como empate, un veredicto repetido no cuenta y un veredicto sin ganador cuenta como empate.
- `test_medir.py`, 8 OK. En la sesión real, `tools/qa/host.sh` pasa de 23 lecturas a 5, que son las lecturas de verdad.
- `test_host.py`, 6 OK en el host. Antes de este PR también fallaban dentro del sandbox los dos tests que miran el caso de fuera del sandbox. El `git push` normal desde el sandbox ya pasa el gancho, cuando antes fallaba sin avisar.
- `test_bitacora.py` y `test_prepush_ramas.py`, 34 OK.
- `cobertura.py`: SIN HITO 0.

## Merge Danger

**Door:** two-way

Sin migraciones y sin cambios en partidas guardadas. El juego no se toca.

**Blast Radius:** herramientas

Si el filtro de `host.sh` o el relanzado del pre-push fallan, afectan a los pushes desde la Deck. El aviso `--en-curso` nunca bloquea.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
