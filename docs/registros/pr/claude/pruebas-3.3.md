**Título:** Tandas 8-14 del 3.3: comprobación jugando, cierre del reparto y retro aplicada (QA-195 a QA-200)

## Summary

El paso 3.3 de «La línea» (`21-roadmap.md`) termina su reparto. Esta rama solo jugó y apuntó; los arreglos los hace
la nube en su propia rama. Trae tres cosas: el registro de lo jugado, el cierre del reparto y la retro aplicada a las
herramientas de QA. No toca código del juego.

```text
tandas 8-14  (13a y 13b partidas en cinco, ≤ 60 llamadas cada una, QA-189)
  comprobados jugando  → 153
  reabiertos           P27 P99 P116 P136 P158 P169 P173   (para la nube)
  en parte             P82 P223
  nuevos               P303-P311   (P306 tirada de Fuerza al saludar abre combate,
                                    P308 «Cazar» rompe la pantalla, P310 texto fijo, P311 voces mezcladas…)
cierre del reparto
  no jugables          P25 P44 P52 P143 P174 → grupo propio
  sin ver              32, con lista y grupos al final de plan-comprobacion-3.3.md
```

La retro (`retro-2026-10-22-pruebas-3-3.md`, aprobadas las seis propuestas):

```diff
 tools/qa/
   marca-hallazgo.py
+    --comprobar falla si un «Reabierto <fecha>» es posterior al ✅ que lo sigue, o si queda
+    «falta ver» tras el último «comprobado jugando»                                (QA-195)
+    todo «reabierto» cuenta; ante la duda, pendiente
   tests/
+    test_atajos_deck.py: quien llama a psql/pg_dump/pg_restore carga _path.sh antes (QA-198)
 tools/playwright-e2e/
   arrancar-juego.sh
+    . tools/qa/deck/_path.sh       # la causa de fondo de QA-192: en la Deck no hallaba psql
 docs/runbooks/rondas-de-pruebas.md
+    escenario.sh en una orden sola, autorizado (QA-197) · 8 turnos con Ollama o bench (QA-200)
 docs/producto/roadmap-front.md
+    QA-196 (chuleta del driver) y QA-199 (partidas intermedias fuera de git) → paso 3.4
```

## Evidence

- **Antes:** P116 («Reabierto 2026-10-21 … arreglo ✅ 2026-10-13») contaba como arreglado, y P189 («comprobado
  jugando…; falta ver una hora») como comprobado. Los dos salieron en el `/code-review`, no al marcar.
  **Después:** `test_comprobar_falla_con_reabierto_posterior_o_falta_ver_que_cuenta_como_hecho` y
  `test_todo_reabierto_cuenta_tambien_en_plural_y_tras_un_no` pasan, y `marca-hallazgo.py --resumen --comprobar`
  sale limpio sobre el registro real. P99 y P202 se corrigieron por el camino: P99 vuelve a pendiente y P202 se
  reordenó.
- **Antes:** `juego.sh` llegó al PR #74 sin `_path.sh`, y no se vio hasta la tanda 14.
  **Después:** `test_atajos_deck.py` sale rojo si se quita la carga de `arrancar-juego.sh` o de `sql.sh`, y verde
  con ella.
- `python3 -m unittest discover -s tools/qa/tests`: 140 tests. Fallan 2 de `test_host` (`test_fuera_del_sandbox_…`,
  `test_solo_sandbox_1_…`), que ya fallaban antes de esta rama: en la Deck, el sandbox devuelve `/` en lugar de la
  raíz. Sin cambios en backend ni frontend: `tsc`, `vitest` y `oxlint` van por el pre-push, en verde.
- `python3 tools/roadmap/cobertura.py`: SIN HITO: 0.

## Merge Danger

**Door:** two-way

No hay migraciones ni cambios de partidas guardadas. Entran tres escenarios nuevos (`t13a-colmillo`, `t13a3-ketg`,
`t13b2-ketg`, unos 900 KB cada uno).

**Blast Radius:** herramientas de QA

`--comprobar` es más estricto y puede poner en rojo el CI de una rama que apunte un reabierto delante de un ✅ viejo.
El mensaje de error dice cómo arreglarlo: el estado vigente va al final.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
