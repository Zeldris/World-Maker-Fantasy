# Retro del PR de «la línea» (2026-10-21)

Lo revisado: lo que entra con el PR a `main` desde `claude/frontend-improvements-roadmap-0mpckt`
(`git log origin/main..HEAD`):

- la sección «La línea» de `21-roadmap.md` y los siguientes pasos de la bitácora;
- el `/code-review --max-findings all` previo: 9 hallazgos de documentación, arreglados en `da5568de`;
- el arreglo de `marca-hallazgo.py`, que contaba como pendientes las filas «arreglado (…)» sin ✅: 10 filas, P215 y
  P218 entre ellas, que el borrador de la línea daba como decisiones pendientes.

También se revisan `opt-tokens` y `/code-review`.

**Estado (2026-10-21): aprobadas las tres por la usuaria y aplicadas en la rama** (`QA-185`…`QA-187`).

## Medida (`/opt-tokens`)

Una sola sesión en la nube, sin subagentes de trabajo, encadenó los PR #71 y #72 y este: 349 llamadas en 24 h, 25
compactaciones en la sesión, contexto medio de 113k (suelo medio 93k, techo medio 138k, lo esperado con la ventana de 200k de
`QA-123`). El gasto viene de no cortar entre tareas. Lo más arrastrado: la bitácora, leída 39 veces (305k), y
una página de la documentación de Anthropic (144k).

## Lo que funcionó

- El `/code-review` de un diff solo de `.md` encontró 9 fallos reales: cifras copiadas de un resumen viejo, filas de
  ramas ya fusionadas y dos choques con `CLAUDE.md` (retros y `QA-136`).

## Propuestas

1. **Comprobaciones automáticas.** El resumen de hallazgos lo genera `marca-hallazgo.py` y el CI lo comprueba, pero
   el clasificador solo conocía el formato «✅ arreglado». Desde la ronda del 2026-10-19 las filas abren con
   «arreglado (…)», y 10 filas contaban como pendientes sin que nada avisara. **Aplicada (`QA-185`):**
   `--comprobar` (CI) falla con una fila contada como pendiente cuyo estado no lo dice.
2. **Navegación y estado.** Las filas de la bitácora de los PR #68, #69 y #70 seguían diciendo «fusionar» después de
   fusionarse. **Aplicada (`QA-186`):** el último commit antes del PR deja la fila como «al fusionarse, rama terminada», para que
   `main` la reciba ya cerrada.
3. **Economía de herramientas (`opt-tokens`).** Sin reparto en `orchestrate-dealer`, la sesión siguió de un PR al
   siguiente. **Aplicada (`QA-187`):** si la sesión ya compactó, al fusionar Claude propone seguir tras un `/clear`.
   Riesgo para la calidad: ninguno, porque el estado vive en la bitácora.

## Revisión de la fase 3

`/code-review` de los commits de la retro: 10 hallazgos. Arreglados: el aviso pasa a error en CI; `raro()` admite
negritas, emoji y plurales, y comparte con `grupo()` la regla de «reabierto»; el estado se parte una vez por fila;
`QA-186` se cumple antes del PR, no después; `QA-187` tiene un disparador que se puede comprobar; y la cifra del
techo se aclara. Queda como está: la propuesta de un grupo «desconocido» en `grupo()`, porque el error de
`--comprobar` ya cubre ese caso sin cambiar el resumen.
