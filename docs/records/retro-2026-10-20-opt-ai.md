# Retro del PR de la skill `opt-ai` (2026-10-20)

Lo revisado: lo que entra con el PR a `main` desde la retro anterior: la skill `opt-ai` (`medir.py`, `SKILL.md`,
`proyecto.md`, `motores.md`), el registro por llamada del backend (`iaRegistro`, `rag-eval`, 12 casos), `QA-136`, los
cambios en `retro` y `opt-tokens`, el `/code-review --max-findings all` previo (13 hallazgos, arreglados en un
subagente) y las skills `orchestrate-dealer`, `opt-tokens`, `retro` y `/code-review`.

**Estado (2026-10-20): aprobadas las tres por la usuaria y aplicadas en la rama antes del PR**, como ~~`QA-137`~~ (1),
~~`QA-138`~~ (2) y ~~`QA-139`~~ (3). Además, el test de `QA-137` destapó que `test_herramientas_con_test.py` tomaba
`opt-ai/test_medir.py` por herramienta sin test (la CI habría salido roja): ahora vale el test al lado de la herramienta.

## Medida (`/opt-tokens`)

Desde el tip de `main`: 112 llamadas de la principal, contexto medio ~108k (suelo 85k, techo 137k). El reparto funcionó:
el código lo escribieron subagentes en worktree. El suelo de 85k es contexto fijo de la sesión, fuera del repo.

## 1. La revisión corta por rama no ve los contratos entre ramas (`orchestrate-dealer`, `QA-126`)

**Qué pasó.** Cada rama pasó su revisión corta, pero el `/code-review` final encontró fallos *entre* ramas: `medir.py`
frente a lo que escribe el backend (agrupar por modelo, `calentar`), las tareas de `proyecto.md` frente a las del
código y `rag-eval` llamando al RAG distinto que el juego. **Propuesta.** En el encargo de la revisión corta, comparar
el diff con el doc del contrato y con el llamador real (grep fuera de la rama), y un check mecánico: un test que
compare las tareas de `opt-ai/proyecto.md` con los `tarea:` del backend. **Riesgo:** ninguno; la revisión se alarga un
poco.

## 2. Lo que nombra archivos de un worktree se escribe al fusionarlo (`orchestrate-dealer`)

**Qué pasó.** El mapa (`docs/mapa-agente.md`) nombró archivos del backend antes de fusionar su rama: el pre-push lo
rechazó y hubo que quitar y volver a poner las rutas (dos commits de apaño, ~6 llamadas, ~650k tokens). **Propuesta.**
Una línea en «Reglas»: el mapa y los docs que nombran archivos de una rama se escriben en la principal tras fusionarla.
**Riesgo:** ninguno.

## 3. Commit WIP del subagente en cada punto estable (`orchestrate-dealer`)

**Qué pasó.** Se perdieron dos subagentes en un reinicio con el trabajo sin commit en su worktree. **Propuesta.** La
plantilla del encargo pide commit (`WIP:` si hace falta) en cada punto estable, también en worktree. **Riesgo:** ninguno.

## Skills que rindieron bien

`opt-tokens` con `--desde <sha>` (`QA-134`) midió justo el tramo del PR. `fusionar.sh --revisada` fusionó sin choques.
