# Retro del PR de `claude/pruebas-local` (2026-10-20)

Lo revisado: lo que entra con el PR a `main` (`git log origin/main..HEAD`, solo docs): las rondas de pruebas jugando en
la Deck con Ollama real (UX-30, CR-21/22/23, CR-67, P220), los hallazgos P238-P274, la matriz, el runbook de rondas, la
bitácora, `CLAUDE.md`, la primera medida de `opt-ai` en `docs/ia/opt-ai-registro.md`, el `/code-review --max-findings
all` previo (14 hallazgos de docs, arreglados en `02674ce4`) y las skills `opt-ai`, `opt-tokens`,
`orchestrate-dealer`, `retro` y `/code-review`.

**Estado (2026-10-20): pendiente de la usuaria.**

## Medida (`/opt-tokens`)

Principal: 136 llamadas, contexto medio 144k (techo 256k, sin compactar). El 80 % de la entrada fue a subagentes; las
tandas de juego con `sonnet` pesan 68,8M (92-136k de contexto medio por tanda). Sus propuestas (tandas de ~60 llamadas
con traspaso por escenario guardado, capturas más pequeñas, comprobar la GPU antes de una tanda de IA, `tools/qa/host.sh`
y `sql.sh` para el sandbox Flatpak, lanzar desde el repo, arreglar `medir.py`) se recogen abajo donde caen en una skill.

## 1. La sesión se lanzó desde `Desarrollos/`, no desde el repo

**Qué pasó.** Sin `.claude/settings.json`: ni compactación a 200k (el techo llegó a 256k), ni ganchos (`session-start`,
`revision-antes-de-main`), ni skills del repo (`Unknown skill: opt-ai`). Por eso la principal analizó la tanda de IA a
mano y la skill tuvo que corregirlo después (se cayó «prefijo fijo primero», ya hecho). **Propuesta.** Un
`Desarrollos/CLAUDE.md` de una línea (es lo único que se carga desde ahí): «Tarkor vive en `World-Maker-Fantasy/`;
lanza `claude` desde esa carpeta: desde aquí no cargan sus skills, sus ganchos ni el tope de 200k». **Riesgo:** ninguno.

## 2. `arrancar-juego.sh` no comprueba el entorno de la IA

**Qué pasó.** Tres fallos de arranque costaron tandas enteras: Ollama con `bash -c` (sin GPU, FA ni KV `q8_0`: las tandas
del día por CPU, hubo que repetir la de IA, y P249/P262/P264 eran artefactos), el escenario de la nube con embeddings
del Ollama simulado (P274, RAG roto hasta `reindex-lore`) e `IA_REGISTRO` relativo, que se resuelve desde `backend/` y
no escribe. Además, el runbook (`Cómo se juega`, paso 1) sigue dando el comando con la ruta relativa que su propia nota
de «Fallos de las herramientas» dice que no vale. **Propuesta.** Con `IA_PERFIL` puesto, el script: pasa `IA_REGISTRO` a
ruta absoluta antes del `cd backend`; tras arrancar, para con error si `logs/ollama.log` dice «dropping integrated GPU»
(o `ollama ps` no da GPU) en el perfil `deck`; y corre `npm run rag-eval` y para si sale con código 1 (casos
`debe_pasar`). Así se aplican «avisar sin GPU» y «reindexar el lore» que el informe de `/opt-ai` sostiene, como
comprobación y no como nota. El paso 1 del runbook, con la ruta absoluta; las dos notas de «Lo que engaña», a una línea
que apunte al script. **Riesgo:** el arranque tarda lo que tarde `rag-eval`; solo con `IA_PERFIL`.

## 3. El flujo del PR no nombra `/opt-ai`, y la ronda no sabía que no analiza

**Qué pasó.** El runbook (punto 4) dice que el análisis lo hacen las skills «en el flujo del PR», pero ese flujo
(`CLAUDE.md` «Ramas y `main`», runbook punto 7, `skills-y-modelos.md` paso 6) es `/code-review` → `/opt-tokens` →
`/retro`, sin `/opt-ai`; solo la bitácora lo añadía. Álvaro tuvo que corregir dos veces (no arreglar; no analizar). El
`/code-review` no vio la contradicción del punto 2. **Propuesta.** En `skills-y-modelos.md` paso 6 (fuente única):
«si la rama tiene tandas con Ollama real, `/opt-ai` tras el `/code-review`»; `CLAUDE.md` y el punto 7 del runbook
apuntan ahí. En `orchestrate-dealer`, tabla de reparto: «Analizar una tanda (medidas, causas, RAG): `/opt-ai` en el flujo
del PR, no la ronda». **Riesgo:** ninguno.

## 4. Partidas de pruebas: permiso y escenario sin recursos

**Qué pasó.** `reino-dia39` no tiene comida ni materiales: 6 tareas del Reino bloqueadas; un subagente vio denegado
`escenario.sh dar` por el clasificador, y luego Álvaro dio permiso amplio sobre las partidas propias. **Propuesta.**
Dejarlo escrito en el entorno: regla `allow` en `.claude/settings.json` para `tools/qa/escenario.sh` (por `host.sh` si
se aprueba); quitar «necesita el permiso de la usuaria» del runbook; guardar un escenario `reino-dia39-recursos` (con
`dar` y `guardar`) para jugar Corrales, Partidas, Defensa, oficios y llegadas. **Riesgo:** `dar` solo toca
`tarkor_juego`, nunca la partida real de Álvaro.

## 5. Un `git add docs/` metió los borradores de Álvaro

**Qué pasó.** Entraron sus cambios sin commitear de `docs/borradores-opencode/`; se sacaron a mano antes del commit.
**Propuesta.** En `.githooks` (ya es `core.hooksPath`), un `pre-commit` que con `CLAUDECODE=1` rechaza archivos
preparados bajo `docs/borradores-opencode/`, con test en `tools/qa/tests`. **Riesgo:** ninguno para Álvaro (fuera de
Claude Code no corre).

## 6. Fila ajena de la bitácora editada

**Qué pasó.** El `/code-review` tuvo que devolver la fila compartida «Ramas de trabajo» (`QA-136`: cada rama, su fila).
**Propuesta.** `bitacora.py` en el pre-push: falla si el commit cambia una fila «Tarea en curso · `<otra rama>`» o una
fila compartida sin `--compartida`. **Riesgo:** un aviso de más al cerrar un PR; se pasa con la opción.

## 7. Skills propias: lo que se quedó corto

- **`opt-tokens`.** `medir.py` no desglosa por subagente (llamadas, contexto medio, salida) y cuenta de menos su salida,
  con el 80 % del gasto ahí. **Propuesta:** el desglose por subagente, con un caso con `subagents/*.jsonl` en
  `tools/qa/tests/test_medir.py`; y en `orchestrate-dealer` (paso 1) la tanda de juego se mide en llamadas (~60) con
  traspaso por escenario guardado, no solo en comprobaciones, como propone `/opt-tokens`.
- **`opt-ai`.** `proyecto.md` dice «Lo que ya hay: nada todavía»: apuntar ahí «prefijo fijo primero (~2.600 tokens de
  caché por turno)», y en el paso 0 de la skill, descartar la tanda si no corrió con la configuración del perfil (la
  comprobación del punto 2).
- **Rindieron bien:** `/opt-ai` corrigió el análisis a mano; el `/code-review` encontró 14 fallos de docs.
