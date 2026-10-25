# Retro y opt-tokens · `claude/frontend-improvements-roadmap-0mpckt` (2026-10-25)

**Estado:** aprobada entera por la usuaria (2026-10-25) y aplicada en la rama: 1 → `QA-236`, 2 → `QA-237`, 3 →
`QA-238`, 4 → `QA-239`. Las propuestas 1-3 quedan además para Galivelop-workflow.

Es la sesión de `QA-235`: la carpeta `docs/difusion/` y la skill `gw-media-content`, con su tarjeta, su diagrama y su
captura. Desde `2d4a082d` hubo 83 llamadas y 3 compactaciones. El contexto medio fue de 121k, con un techo de 144k por
tramo, por debajo del umbral de 150k de `orchestrate-dealer`. Todo fue con Opus: la sesión principal y un subagente de
revisión (8 llamadas, 667k de entrada). La revisión de código antes de `main` dio 13 hallazgos, todos arreglados en
`a9eb7bbf`.

## Propuestas, de más a menos grave

1. **Una skill nueva con script llega sin tests (revisión de código, mecánica).** 11 de los 13 hallazgos eran de
   robustez de `comprobar.py` (tipos del JSON, huecos que no se buscaban en la ficha, peso de los emoji, falsos
   positivos de jerga). Los tests solo llegaron con el arreglo.
   - **Propuesta:** una comprobación en el check que falle si un `.claude/skills/*/scripts/*.py` no tiene al lado su
     `test_*.py` y si esos tests no se corren en `ci.yml`.
   - **Destino:** Galivelop-workflow. Sirve en cualquier proyecto con skills propias.
2. **La bitácora se comprueba tarde (comprobación).** El pre-push rechazó el commit porque `QA-235` estaba tachada en
   el plan pero no aparecía en «Hecho recientemente». Hubo que hacer un amend y volver a subir.
   - **Propuesta:** añadir `bitacora.py` (la misma comprobación del pre-push) a la lista `check`, para que falle antes
     del commit.
   - **Destino:** Galivelop-workflow, y también este repo en `.claude/gw.json`.
3. **«Lleva a `main`» con la usuaria fuera choca con `QA-95` (`AGENTS.md`).** La usuaria pidió llevarlo a `main` y se
   fue a dormir, pero `QA-95` dice que la retro se presenta antes de fusionar, y `requireRetro` pide su decisión. La
   sesión lo dejó todo listo y se paró antes de la marca de revisión.
   - **Propuesta:** escribir esa regla en `AGENTS.md`: «si la usuaria no está, se deja todo listo para un solo paso
     (retro escrita, CI local en verde sobre la fusión con `main`, descripción en `docs/registros/pr/`) y su
     confirmación de la retro lo lleva a `main`».
   - **Destino:** este repo, y también Galivelop-workflow por el lado de `requireRetro`.

4. **`ci-local.sh` en un worktree da tres rojos falsos (herramienta).** `QA-215` pide pasarlo en un worktree, pero
   tres tests de `tools/qa/tests` fallan ahí: `test_commit_msg` (2) porque `.git` es un archivo y no una carpeta, y
   `test_host` (1) porque compara contra el directorio del worktree. Fallan igual con `main` solo (`076fe877`) y pasan
   en el checkout normal.
   - **Propuesta:** que esos tests tomen la raíz con `git rev-parse` y el índice con `git rev-parse --git-path index`.
   - **Destino:** este repo.

## opt-tokens

- **Curva:** sin propuesta. El contexto medio es de 121k, los suelos de unos 96k y los techos de unos 130k, con 24
  llamadas por tramo, lo esperable con la ventana actual.
- **Lecturas repetidas:**
  - `tools/playwright-e2e/README.md` se leyó 5 veces y `.claude/skills/README.md` 7. Los pasos para capturar ya están
    en `.claude/gw/gw-media-content.md`, así que la próxima vez no hace falta volver a leerlos.
  - `comprobar.py` se leyó 13 veces durante los arreglos. Es el ciclo normal de editar y comprobar, no una pérdida.
- **Modelo:** el subagente de revisión con Opus está justificado, porque revisar es criterio. No hubo trabajo mecánico
  con el modelo grande que se pudiera mover a uno más barato.
- **Imágenes:** se leyeron 6, todas para mirar las WebP renderizadas, que es lo que pide la skill. Tienen un fin
  visual, así que no hay ahorro.

## For Galivelop-workflow

- Propuesta 1: un script de skill sin tests al lado hace fallar el check.
- Propuesta 2: `bitacora.py` en el check por defecto.
- Propuesta 3: qué hace `requireRetro` cuando la persona pide fusionar y no está para decidir.
