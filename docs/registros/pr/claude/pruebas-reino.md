**Título:** Tandas 15-21: Mundo vivo y arreglados del Reino comprobados jugando, retro aplicada (QA-208 a QA-214)

## Summary

Pasos 3.2 y 3.3 de «La línea» (`21-roadmap.md`) para el Reino y Mundo vivo, según el
[reparto](docs/registros/plan-comprobacion-reino.md). Esta rama solo jugó y apuntó; no toca código del juego. Trae el registro
de lo jugado, dos instantáneas nuevas y la retro aplicada a las herramientas de QA.

```text
tandas 15-21 (subagentes sonnet en serie, Deck)
  matriz Mundo vivo   sin jugar 11 → 4   (CR-43, CR-55, CR-56, CR-63: piden un estado o azar que no salió)
  comprobados jugando P275-P278 P280-P284 P286-P288 P291 P294 P296-P298 P302 P303
  en parte            P279 P292 P295
  reabiertos          P299 (aviso «x de 7 días» con el territorio perdido)
  sin ver             P285 P290 P300 P301
  nuevos              P312-P319   (P316: los sucesos del mundo no llegan a la jugadora; fallo, usuaria)
  instantáneas        t16-reino (día 52, fauna agotada) · t20-mundo (día 1479)
```

Retro (aprobada por la usuaria):

```diff
 docs/runbooks/rondas-de-pruebas.md
-## Fallos de las herramientas        # 22,8 KB, lo leía entero cada tanda
+## Trucos de las herramientas        # 17 vigentes (QA-208)
+docs/registros/fallos-herramientas.md   # el historial
 CLAUDE.md «Al jugar»                   # lo relee quien juega (QA-209)
+.githooks/commit-msg                   # pide «Siguiente:» con CLAUDECODE=1 (QA-210)
 tools/qa/escenario.sh guardar          # rechaza una descripción que no es frase o lleva el id (QA-211)
 tools/qa/matriz-pruebas.py --comprobar # «jugado» con prueba «parcial» falla el pre-push (QA-213)
 .gitignore                             # *.kate-swp (QA-214)
```

## Evidence

- **Antes:** `matriz-pruebas.py` daba SIN JUGAR 11 en Mundo vivo; `escenario.sh guardar t16-reino <id>` escribía el id
  en el índice; un commit sin `Siguiente:` pasaba.
  **Después:** SIN JUGAR 4 de 135 y `--comprobar` en verde; `test_escenario.Guardar` (id, una palabra, espacios,
  «|» → código 2 sin tocar postgres), `test_commit_msg` (sin `Siguiente:` → 1; merge, revert y fuera de Claude Code
  → 0), `test_matriz_pruebas.test_jugado_con_prueba_parcial_falla`.
- Tests de `tools/qa`: 146 en verde salvo los 2 de `test_host`, que ya fallaban antes (sandbox de la Deck).
  `marca-hallazgo.py --resumen --comprobar` y `cobertura.py` (SIN HITO: 0) en verde. Backend y frontend sin cambios.

## Merge Danger

**Door:** two-way

Documentos, dos `.dump` (~2,2 MB) y herramientas de QA. Sin migraciones ni partidas guardadas del juego.

**Blast Radius:** entorno

El gancho `commit-msg` rechaza en sesiones de Claude los commits sin `Siguiente:` (merges, squash, cherry-pick y
revert pasan); la matriz falla el pre-push si una fila «jugado» empieza por «parcial».

🤖 Generated with [Claude Code](https://claude.com/claude-code)
