# Retro: tercera tanda de correcciones de `QA-27` (2026-10-12)

Tramo revisado: rama `claude/wonderful-volta-662qt8`, P84-P119 de
[`pruebas-0.3-hallazgos.md`](pruebas-0.3-hallazgos.md), el `/code-review` previo a `main` (12 hallazgos)
y el [PR #49](https://github.com/Zeldris/World-Maker-Fantasy/pull/49), fusionado con el CI en verde.

**Estado: propuestas para la usuaria.** Ninguna es tarea todavía. Las que confirme entran en
`roadmap-front.md` con el siguiente número libre de `QA` (`QA-66` en adelante) y con su hito.

Ordenadas de más a menos grave.

## 1. Un commit que no se hizo y un push que dijo «todo en verde»

**Qué pasó.** Para cerrar P115 se encadenaron con `&&` el lint, la marca del hallazgo, la bitácora y el
commit. El lint se contaba con `grep -c " error "`: con 0 errores, `grep -c` imprime `0` y sale con
código 1. Eso cortó la cadena, así que no hubo ni marca ni commit. El `git push` iba en la línea
siguiente, se ejecutó igual e imprimió `pre-push: todo en verde.` sin subir nada. Durante dos tareas
pareció que P115 estaba subida, hasta que un `git status` lo destapó.

**Propuesta (comprobación automática).**
- En `.githooks/pre-push`, imprimir qué commits sube cada rama («sube 2 commits: …»). Si no sube
  ninguno, que lo diga en vez de «todo en verde».
- La comprobación de lint de los ejemplos de la bitácora y del runbook usa el código de salida de
  `oxlint`, no `grep -c`.

## 2. Un valor por defecto que esconde un campo olvidado

**Qué pasó.** P87: entradas del diario que desaparecían porque `LogEntry.fictionalMinutes` tenía
`@default(0)` y algunas creaciones no lo ponían. Se arregló primero sitio a sitio, con un test que lee
el código fuente (`logEntryConHora.test.ts`). El `/code-review` pidió ir a la raíz: al quitar el
`@default`, `tsc` encontró **7 creaciones más** que el test no veía (caravanas, viajeros, combate
múltiple), con un `?? undefined` que caía a 0.

**Propuesta (estándar de revisión).**
- Una regla en `REVIEW.md`, en «Un fallo que vuelve»: un campo que siempre hay que rellenar no lleva
  `@default`, para que el compilador obligue a ponerlo; `?? undefined` sobre un campo así es un
  hallazgo.
- Retirar `logEntryConHora.test.ts`: ahora lo comprueba el compilador, y dos comprobaciones de lo
  mismo se desincronizan.

## 3. Renombrar algo que las partidas guardan por nombre

**Qué pasó.** P100 renombró «Analisis Salvaje» en `SavedAction` y en `activeCombatAbilityNames`, pero
no en `SkillBar.abilityNames`: las barras guardadas habrían perdido el botón. Lo encontró el
`/code-review`, no la implementación.

**Propuesta (navegación).**
- Encabezar `habilidadesRenombradas.ts` con la lista de los sitios que guardan una habilidad por
  nombre.
- Una regla en `REVIEW.md`: renombrar algo que se guarda por nombre se comprueba contra
  `grep -n "por NOMBRE" backend/prisma/schema.prisma`, que ya marca esos campos.

## 4. La celda «Tarea en curso» con las dos cuentas

**Qué pasó.** Cada cuenta añadía su parte a la misma celda de la bitácora. Acabó con dos tareas y dos
«Siguiente» que se contradecían, por encima del límite de 5 líneas de `CLAUDE.md`. Lo marcó el
`/code-review`.

**Propuesta (comprobación automática y bitácora).**
- Una fila «Tarea en curso» por rama, cada una con su propio «Siguiente».
- Una comprobación en `pre-push`, unas líneas de Python, que falle si una fila «Tarea en curso» pasa
  de unos 600 caracteres.

## 5. Orden del diario en un turno, sin test

**Qué pasó.** P117: la subida de nivel salía después de «Estado: Muerto». El primer arreglo reservó la
hora solo para la línea de subida de nivel, y el `/code-review` vio que los desbloqueos de habilidad
seguían saliendo tarde. Se arregló moviendo los golpes gratis al final. Ningún test cubre el orden:
preparar un turno con subida de nivel y golpes gratis en `turnResolution` cuesta mucho.

**Propuesta (comprobación automática).** Un test de integración con un turno preparado (subida de nivel
más un golpe gratis) que compruebe el orden de las entradas por `createdAt`. Encaja en el hito de la
deuda de tests de `turnResolution`, si hay uno; si no, en la fila `0.8`.

## Lo que funcionó

- El `/code-review` antes de `main` encontró 12 problemas reales; ninguno llegó a `main`.
- `rojo-sin-arreglo.sh` demostró que el test nuevo de Desollar falla sin el arreglo.
- El driver de Playwright cubrió la caída del MCP sin tocar nada (`QA-41`).
- El gancho de `QA-50`/`QA-62` dejó fusionar solo con la marca de revisión y el CI en verde.
