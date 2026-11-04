# Retro antes del PR de los hallazgos de QA-27, tandas 1 y 2 (2026-10-15)

Lo revisado: lo que va a entrar con el PR de la rama `claude/frontend-improvements-roadmap-0mpckt`: los
hallazgos de `QA-27` de las tandas 1 y 2 (P148…P183), el modelo de rumores `CR-69` llevado al roadmap y los
arreglos del `/code-review` del diff contra `main` (21 hallazgos).

**Estado (2026-10-15): aprobadas las dos por la usuaria y aplicadas en la misma rama, antes del PR**:
1 → `QA-88`; 2 → `QA-89`. De más a menos grave.

## 1. Un arreglo rompió tests unitarios y el push no lo vio

**Qué pasó.** P160 (energía pasiva al moverse y recolectar) añadió una lectura de `save.findUnique` en
`recolectar.ts`. El `tx` simulado de `recolectar.test.ts` no la tenía y 13 tests dieron 500. El pre-push solo
tipa y pasa el lint, así que no se vio hasta pasar la suite completa, varias tareas después.

**Propuesta (comprobación automática).** El pre-push pasa `vitest related` sobre los archivos que cambian:
en el backend solo el proyecto `unit` (los de BD real van en serie y son lentos), en el frontend todo.
Comprobado: con el arreglo del mock quitado, sale en rojo con esos 13; la rama entera tarda cerca de un minuto.

## 2. Un campo JSON leído con `!` tumbaba la partida

**Qué pasó.** `motivoNoEntregable` (P183) leía `h.objeto!.nombre` de los `huecos` de la misión, y lo usa
`GET /saves`. Una misión sin objeto rompía la carga de la partida entera. Lo cogió el `/code-review`.

**Propuesta (regla de revisión).** En `REVIEW.md`: lo que sale de una columna `Json` se lee con `?.` y un
camino para cuando falta, sin `!`. No es una regla de lint porque `!` está bien en muchos otros sitios.

## Sin propuesta

- Dos tests (P152, P159) pasaban sin el arreglo; `rojo-sin-arreglo.sh` los cogió antes del commit, como debe.
