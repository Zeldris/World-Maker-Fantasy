# Retro del PR del proceso de pruebas (2026-10-19)

Lo revisado: lo que entra con el PR a `main` de la rama `claude/wonderful-volta-662qt8` tras el PR #63: P205,
el proceso de pruebas (~~`QA-101`~~…~~`QA-107`~~), el mapa del agente (~~`QA-108`~~), el `/opt-tokens`
(~~`QA-109`~~…~~`QA-111`~~), su `/code-review` (16 puntos) y la propia skill `opt-tokens`.

**Estado (2026-10-19): aprobadas las cuatro por la usuaria y aplicadas en la rama antes del PR**, como ~~`QA-112`~~ (1),
~~`QA-113`~~ (2), ~~`QA-114`~~ (3) y ~~`QA-115`~~ (4). De más a menos grave. La 5 y la 6 (segunda vuelta, sobre
~~`QA-112`~~…~~`QA-118`~~ y su `/code-review` de 16 puntos), pendientes de la usuaria.

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

## Segunda vuelta: ~~`QA-112`~~…~~`QA-118`~~ y su `/code-review`

El segundo `/code-review` (16 puntos, todos arreglados) cayó casi entero sobre las herramientas recién escritas:
`recuperar.py` (6), `medir.py` (4), la fecha de la bitácora (4) y los ganchos (2). Los tests de esas herramientas
pasaban: estaban escritos a la medida de lo que el código hacía, no de lo que trae un registro real.

## 5. Tests de los registros de sesión hechos a mano y a la medida del código

**Qué pasó.** `test_recuperar.py` llamaba al script como `recuperar.py Serhu`, sin `python3` ni ruta, y no traía
avisos del sistema (`isMeta`, `<system-reminder>`) ni un subagente dentro del registro principal. `recuperar.py`
filtraba la línea JSON en crudo (comillas y saltos escapados no casaban) y descartaba toda línea que nombrase el
script; `medir.py` sumaba los subagentes del registro principal en su cuenta por modelo. Cada test tenía su propio
constructor de líneas y ninguno las copiaba del formato real.

**Propuesta (comprobación automática).** Un único constructor de líneas de registro en `tools/qa/tests/comun.py`,
copiado de líneas reales (varias líneas por respuesta con el mismo `id`, `isMeta`, `isSidechain` dentro del
principal, `tool_use` de `Bash` con la orden completa, `compact_boundary`), que usen `test_medir.py` y
`test_recuperar.py`. El que añada otra herramienta que lea registros parte de él.

## 6. El gancho de arranque también corría al compactar

**Qué pasó.** El `SessionStart` de `session-start.sh` no tenía `matcher` y, tras cada compactación, metía en el
contexto la instalación y el estado del entorno junto al estado que de verdad hace falta (`recuperar.py --estado`).

**Propuesta (comprobación automática).** Un test de `.claude/settings.json`: cada `SessionStart` lleva `matcher`,
`compact` solo en el de `recuperar.py --estado`, y cada orden apunta a un archivo que existe.
