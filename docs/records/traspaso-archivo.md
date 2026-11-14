# Archivo de la bitácora

Entradas antiguas de «Hecho recientemente» de [`traspaso.md`](traspaso.md), de la más nueva a la más antigua. Se buscan con `recover.py --search` o `grep`.

## Archivado el 2026-11-14, segunda vez (hasta el 2026-11-10)

- **2026-11-10** — Tanda 110 (lote F, juego): P440 y P442 ✅; P441 reabierto; P443 nuevo (leve). Antes: regresión de P375 en turn.integration arreglada (slug a `services/questSlugs.ts`).
- **2026-11-10** — Tanda 109 (repesca de lotes A y E): P426 y P437 ✅ comprobados jugando; P441 confirmado 2 de 2; P442 nuevo (leve, dudoso); P375 con NPC ausente sin reproducir.
- **2026-11-10** — Fase 1 de las tandas 107-108: P375 también descarta testigos inactivos a esa hora o ausentes tras un combate (test de integración); leves apuntados.
- **2026-11-10** — Tanda 108 (lote E, juego): P270, P319, P358, P375 y P380 ✅ comprobados jugando; P441 nueva (leve: «Tirag» suelto se toma por el Tótem de Guerra).
- **2026-11-10** — Tanda 107 (lote D, juego): P248, P381, P343, P379 y P435 (simulado) ✅ comprobados jugando; P342 sin ver (vasallo ajeno); sin hallazgos nuevos.
- **2026-11-10** — Lote D de la puerta cerrado y revisado (P248, P342, P343, P379, P381, P435 a jugar; P368 cerrada; P440 nueva pendiente), plan `plan-comprobacion-puerta.md` al día.
- **2026-11-10** — ~~`QA-303`~~: `marca-hallazgo.py --ver P<n>` y las tandas cerradas del plan de la puerta, en `plan-comprobacion-puerta-archivo.md` (86 → 22 kB).
- **2026-11-10** — ~~`QA-301`~~: `tools/qa/inventario-suelto.py` en el check (inventario sin lo de compañeros y súbditos); arregló 4 consultas más (viajeros, entregables, recolectar).
- **2026-11-10** — ~~`QA-304`~~, ~~`QA-305`~~ (retro del paso 3.4): el encargo de tanda lleva el tope de 50 llamadas (`skills-wmf.md`); `/clear` también al cerrar cada lote de una rama larga (`AGENTS.md`).
- **2026-11-09** — ~~`QA-300`~~: `escenario.sh dar-reino` resta con valores negativos (`comida=-2`; también bebida, goirnos y tesoro), suelo en 0 y aviso si se pide más de lo que hay; deja el Granero 178/180 para P336. Test en `darReinoLib.test.ts`.
- **2026-11-09** — ~~`QA-299`~~: `escenario.sh preparar` con `partida-caza:<presa>:heridos=<h>` (la partida vuelve sin piezas y con h heridos; aviso del juego en Reino › Avisos al preparar, P439) y `mochila-descartar[:<n>]` (tira lo suelto hasta dejar hueco; P336: `dar` no pasa de la capacidad y el Almacén lleno impedía `mochila-libre`). Sin cambio de reglas; tests rojos sin el arreglo.
- **2026-11-09** — ~~`QA-298`~~: `escenario.sh preparar <partida> partida-caza:<presa>:<n>[:permanente]` deja la partida de caza del Reino a punto de volver con n piezas (por el camino normal al avanzar el día), para jugar P339 y, con `danar:desolladero`, P338 en la tanda 103.

### Filas de ramas fusionadas y terminadas (de «Estado actual»)

| | |
|---|---|
| **Tarea en curso · `claude/generador-mapas`** | Fusionada en `main` (PR #89, 2026-11-10, CI en verde): ~~MAP-1~~…~~MAP-9~~, ~~MAP-16~~, ~~MAP-17~~; `MAP-18` cerrado en `claude/pedido-mapa` (PR #90). Rama terminada. |
| **Tarea en curso · `claude/limpieza`** | Fusionada en `main` sin PR, CI local (2026-11-02, `ab518ea8`, `QA-215`; confirmado por la usuaria): ~~`QA-271`~~ ✅ (código muerto fuera) y retro con `QA-278`, `QA-279` al roadmap. Rama terminada. |
| **Tarea en curso · `claude/gw-update-0.5.0`** | Fusionada en `main` (PR #84, 2026-11-04, `5b1f6a2e`, CI en verde): flujo v0.4.3 → v0.5.0. Rama terminada; lo pendiente pasó a la fila de `claude/wonderful-volta-662qt8`. |
| **Tarea en curso · `claude/puerta-pruebas`** | Fusionada en `main` (PR #74, 2026-10-21); rama cerrada. Las tandas 8-14 del 3.3 siguieron en `claude/pruebas-3.3`. |
| **Tarea en curso · `claude/pruebas-3.3`** | Fusionada en `main` (PR #75, 2026-10-22); rama cerrada. Las tandas 15-21 siguieron en `claude/pruebas-reino`. |
| **Tarea en curso · `claude/pruebas-reino`** | Fusionada en `main` sin PR (2026-10-22, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 15-21 del [reparto](plan-comprobacion-reino.md), P312-P319, retro `QA-208`…`QA-214`. Rama cerrada. |
| **Tarea en curso · `claude/piloto-galivelop-workflow`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): Galivelop-workflow v0.2.0 en WMF ([registro](piloto-galivelop-workflow.md), [retro](retro-2026-10-23-piloto-galivelop.md)); rama cerrada. **Pendiente:** la usuaria prueba `host.sh` en la Deck (push con el árbol sucio). |
| **Tarea en curso · `claude/pruebas-mundo-vivo`** | Fusionada en `main` sin PR (2026-10-23, cuota de Actions agotada; `tools/qa/ci-local.sh` en verde, `QA-215`): tandas 22-27 y retro `QA-216`-`QA-221` ([PR preparado](pr/claude/pruebas-mundo-vivo.md)); rama cerrada. **Pendiente** de la ronda: P51, P95, P163, P193 y la cría de CR-55. Leves de la revisión de la fusión: quitar el `cleanup` local de ~70 tests (ya va en el setup) y un `--raiz` en `.githooks/pre-commit` para no copiarlo al repo (preguntar a la usuaria, es del flujo). |
| **Tarea en curso · `claude/gh-en-la-deck`** | Fusionada en `main` (PR #82). Rama borrada el 2026-11-10, con `claude/fichas-banners` (ya entera en `claude/imagenes-por-fases`). |
| **Tarea en curso · `claude/lore-enciclopedia`** | Fusionada en `main` (PR #81, 2026-11-03, `97190433`, CI en verde): ~~`QA-243`~~, ~~`QA-244`~~, ~~`QA-272`…`QA-277`~~ ✅. Rama terminada. |

## Archivado el 2026-11-14 (hasta el 2026-11-08)

- **2026-11-08** — `MAP-1` y `MAP-2` (adelantados por la usuaria): `map-generator/importar.py` lee el `.map` de Azgaar sin escribirlo y `medir.py` comprueba las medidas del canon.
- **2026-11-05** — PR 86 fusionado (`d5521065`, CI en verde): licencias y roadmap de mapas en `main`.
- **2026-11-05** — `QA-297`: licencias del proyecto, MIT para el código y CC BY-NC-SA 4.0 para el contenido (usuaria).
- **2026-11-05** — Nuevo roadmap aparte [`roadmap-mapas.md`](../producto/roadmap-mapas.md) (`MAP-1`…`MAP-15`, hito `0.4`), valorado con Fable: el `.map` de Azgaar se importa una vez y no se vuelve a escribir; formato y editor propios en `map-generator/`, canon protegido por tests; el fondo de Azgaar se queda hasta que el dibujo propio lo iguale y la usuaria lo apruebe (`MAP-13`). Empieza al cerrar las pruebas de juego.
- **2026-11-04** — PR 85 fusionado (`d35bfaa1`, CI en verde): tandas 87-88 y cierre del paso 3.3; arreglado el resumen del registro 0.3 que rompía el job `roadmap`.
- **2026-11-04** — Paso 3.3 de la puerta cerrado (usuaria): tanda 88 con P367 ✅; P253 y P180 fuera de tanda.
- **2026-11-04** — Tanda 87 de la ronda de la puerta: P191 comprobado jugando (la caza del rebaño acorrala a 5 de 6 y lo dice en tercera persona); P180 sigue en parte, sin ver la variante de escasez.
- **2026-11-04** — PR 84 fusionado: flujo Galivelop-workflow v0.4.3 → v0.5.0 y tandas 83-88 de la ronda de la puerta (`QA-293`…`QA-296`).
- **2026-11-04** — ~~`QA-296`~~ (retro de la v0.5.0, R1): las reglas de `/gw-update` (reconciliación por subagente, fase 1 sin copias) en `skills-wmf.md`; R2 y R3 a Galivelop-workflow (P19, P18).
- **2026-11-04** — ~~`QA-294`~~, ~~`QA-295`~~ (`/gw-opt-tokens` de la v0.5.0): la fase 1 de una `/gw-update` sin las copias idénticas del flujo; barridos y `actions_list` con salida acotada.
- **2026-11-04** — ~~`QA-293`~~: `escenario.sh preparar <partida> combate1v1:<npc>` abre el combate 1v1 clásico contra ese NPC (efecto `forzarCombate` del Cronista), para jugar lo propio del 1v1 como la huida de la fauna (P373).
- **2026-11-03** — ~~`QA-290`~~, ~~`QA-291`~~, ~~`QA-292`~~ (retro de la ronda de la puerta): `tools/qa/humo-driver.sh`, humo del driver real en la CI; `tools/roadmap/siguiente-id.py` da el siguiente número libre mirando las ramas remotas; en una rama larga, revisión del código por bloques de ~10 tandas (`AGENTS.md`).
- **2026-11-03** — ~~`QA-286`~~, ~~`QA-287`~~ (retro de `claude/gh-en-la-deck`): varios PR listos, de uno en uno (`ramas-y-main.md`); ramas remotas en `recuperar.py` y `--footer` en el aviso de `revisado.sh`, para Galivelop-workflow.
- **2026-11-03** — ~~`QA-285`~~: la sesión local de la Deck crea sus PR con `gh` (`~/.local/bin/gh`, enlazado en el sandbox Flatpak de VS Code); estrenada con los PR #80 y #81. Sustituye a `QA-184` en `CLAUDE.md`, `AGENTS.md`, `ramas-y-main.md` y `skills-y-modelos.md`.
- **2026-11-03** — ~~`QA-280`…`QA-284`~~ (retro de `claude/plan-imagenes`): `/code-review` al cerrar cada `IMG-*`, a `main` por bloque, cadena fotorreal en `docs/mapa-agente.md`, `hoja.sh --archivos` y notas de `opt-tokens`.
- **2026-11-02** — ~~`QA-271`~~ (limpieza): fuera `test-retrieval.ts`, `test-worldtick.ts`, el SQL de arcano a magia (de un solo uso), `debug/` e `image-generator/scripts/obsoleto/`; retro con `QA-278` y `QA-279` al roadmap.
- **2026-10-26** — ~~`QA-268`~~, ~~`QA-269`~~, ~~`QA-270`~~: pasos nuevos de `escenario.sh preparar` para sucesos del mundo (`lider-muere`, `alianza`, `vasallo-paga`), ganado y captura (`domable`, `domador`, `dar-reino` de más tier) y un convaleciente a la vista (`convaleciente:<npc>:combate`).
- **2026-10-27** — ~~`QA-266`~~ (retro de `INS-34`): `entorno-nube.sh` instala `postgresql-16-pgvector` si falta. Las propuestas 1 (ya en el instalador) y 3 (no se aplica) no tocan este repo.
- **2026-10-26** — ~~`QA-272`…`QA-277`~~ (retro de la segunda pasada por la enciclopedia): «Copias de partida» en `docs/mapa-agente.md`, regla de `REVIEW.md` para `where` anidados de Prisma, tope de llamadas en las tandas de edición, `ficha.sh` con `archivo:línea` y la guardia de nombres de habilidad (`QA-273`, `habilidadesConocidas.json`: un nombre que desaparece sin renombre hace fallar el test).
- **2026-10-26** — ~~`QA-274`~~: segunda pasada por la enciclopedia: diez tandas contra el canon, cuatro bloques aprobados; canon al día (oficios, edificios, documentos, lo reservado de Tarkor), el seed retira lugares, facciones y NPC huérfanos (`retirarHuerfanos.ts`), unos 160 textos limpios y diez arreglos según el canon; `./actualizar-mundo.sh` en verde. Registro en `lore-hallazgos.md`.
- **2026-10-26** — ~~`QA-244`~~: la historia de la enciclopedia, completa: una entrada sin documento es saber común o se abre al visitar su lugar (como X4); diez hechos de la cronología con texto del canon y el sí de la usuaria.
- **2026-10-26** — ~~`QA-243`~~: la enciclopedia, auditada contra el canon sección a sección (NPC, clases, objetos, lugares, facciones, fauna y flora); `./actualizar-mundo.sh` en verde en la Deck; las imágenes de habilidades pasan a `IMG-9`.
- **2026-10-26** — ~~`QA-262`…`QA-265`~~ (retro de `INS-33`): «PR listo» solo con la URL del PR (`AGENTS.md`, `QA-184`), `import/first` en `frontend/.oxlintrc.json` (error en `src/lib/`, aviso en el resto), entrada «Modo empaquetado» en `docs/mapa-agente.md` y propuesta para Galivelop-workflow en la retro.
