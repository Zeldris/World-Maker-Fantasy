# Retro del PR del proceso de pruebas (2026-10-19)

Lo revisado: lo que entra con el PR a `main` de la rama `claude/wonderful-volta-662qt8` tras el PR #63: P205,
el proceso de pruebas (~~`QA-101`~~…~~`QA-107`~~), el mapa del agente (~~`QA-108`~~), el `/opt-tokens`
(~~`QA-109`~~…~~`QA-111`~~), su `/code-review` (16 puntos) y la propia skill `opt-tokens`.

**Estado (2026-10-19): aprobadas las cuatro por la usuaria y aplicadas en la rama antes del PR**, como ~~`QA-112`~~ (1),
~~`QA-113`~~ (2), ~~`QA-114`~~ (3) y ~~`QA-115`~~ (4). De más a menos grave.

## 1. `.claude/` ignorado entero: el `-f` subió bytecode

**Qué pasó.** `git add .claude/settings.json docs` falló (carpeta ignorada), la cadena con `&&` se cortó y el push
no subió nada. Al repetirlo con `git add -f` sobre la carpeta de la skill, entró
`.claude/skills/opt-tokens/__pycache__/medir.cpython-311.pyc`.

**Propuesta (comprobación automática).** `.gitignore` con `.claude/*` y excepciones para `settings.json`, `hooks/` y
`skills/`: lo compartido se añade con `git add` normal y `__pycache__/` sigue fuera. Se quita el `.pyc` y la
instrucción del `-f` del runbook y de la bitácora.

## 2. Herramientas nuevas sin tests

**Qué pasó.** `mapa-agente.py`, `enlaces-md.py`, `matriz-pruebas.py` y `medir.py` entraron sin test aunque
`tools/qa/tests/` existe y lo corre la CI. El `/code-review` les encontró seis fallos (uso doblado en `medir.py`,
bloques de código con sangría, `--generar` que podía borrar filas jugadas, `--bloque` sin valor).

**Propuesta (comprobación automática).** Un test por herramienta y `test_herramientas_con_test.py`: falla si una
herramienta de `tools/qa` o una `.py` de una skill no tiene su `test_<nombre>.py`, salvo las que necesitan el
juego o Postgres, listadas con el porqué.

## 3. `opt-tokens` dio cifras dobladas y no miraba la curva primero

**Qué pasó.** La primera medida dio 543 llamadas y 566k de contexto medio: `medir.py` contaba cada bloque de una
respuesta. La palanca real (el techo de ~742k antes de compactar) salió tarde, después de proponer herramientas.

**Propuesta (instrucciones).** El paso 1 de la skill lee primero la curva (contexto medio y tramos) y, si dos
cifras no cuadran, arregla `medir.py` antes de proponer. `proyecto.md` con las cifras buenas (578 llamadas en
24 h, 428k de media, techo 742k).

## 4. La fecha de la bitácora se quedó en el 2026-10-17

**Qué pasó.** La fila «Actualizado» decía 2026-10-17 con commits de la bitácora del 19.

**Propuesta (comprobación automática).** `bitacora.py --fecha`: el pre-push la pasa con el día de cada commit
que cambia la bitácora y falla si «Actualizado» es anterior.
