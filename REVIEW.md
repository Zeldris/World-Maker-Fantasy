<!-- galivelop-workflow v0.5.0 -->
# Guía de revisión

Lo que el revisor (`/code-review`) comprueba en cada diff, además de los fallos de siempre. Son los
fallos que más se han repetido en las revisiones de las fases (retros del 2026-10-07, `QA-16`). Lo
mecánico ya lo comprueban los tests, el hook `pre-push` y la CI; aquí está lo que pide criterio.
Cada regla acaba en `(check: …)`, con lo que la hace cumplir, o en `(criterio)` si no hay check; una regla
mecánica marcada `(criterio)` pide su check.

## Cómo se informa

- Antes de dar un hallazgo, intenta refutarlo: busca el código, el test o el gancho que ya lo cubre. Solo se informa
  de lo que sobrevive, con la ruta y la línea. (criterio)
- Los hallazgos se escriben también en un archivo fuera del árbol (el scratchpad, o
  `"$(git rev-parse --git-dir)/review.md"`), no solo en la conversación: una compactación o un relevo se los lleva, y
  de ese archivo salen los encargos de los arreglos y los leves que se apuntan en la bitácora. (criterio)
- Un dato que caduca (una versión, un precio, una cuota, un límite de un servicio externo) escrito en el diff lleva su
  fecha y su fuente; si no, es un hallazgo. (criterio)
- La revisión acaba con un veredicto, uno de tres: `SHIP` (nada que arreglar), `SHIP WITH FIXES` (hay arreglos, ninguno
  bloquea) o `DO NOT SHIP` (algo grave o que rompe). (criterio)

## El mundo avanza solo

- **Salto de varios días.** Todo lo diario (`avanceDiario.ts` y lo que cuelga de él) da lo mismo en
  un salto de N días que en N veces un día: cada día usa su estación, su reserva y las bajas del
  anterior, y lo que cuenta «por semana» mira su propia semana. (criterio)
- **Decimales.** La comida, el agua o el forraje con medias (2,5 por recolector) se reparten por el
  número de día (`porcionDelDia`) en vez de redondear cada día hacia abajo o guardar un resto que
  solo vive dentro de un salto. (criterio)
- **Procesos de fondo enteros.** Un combate o proceso sin la jugadora se resuelve hasta el final o
  se cierra (tablas); nada queda abierto bloqueando la siguiente acción. (criterio)
- **Escrituras a la vez.** Lo que puede pasar a la vez (dos pasadas del avance, una acción mientras
  corre el avance de fondo, dos clics) va bajo el candado del avance o con un update condicionado
  (`updateMany` con la condición en el `where`, `createMany` con `skipDuplicates`). (criterio)

## Quién cuenta

- **Una sola vez.** Quien come, bebe o cobra se cuenta una vez (`poblacion` son los civiles; soldados
  y visitantes van aparte). (criterio)
- **Por persona, solo con nombre.** Recuerdos, aprobación, rencor y lo que es «de alguien» solo valen
  para NPC con nombre; la fauna y los genéricos comparten ficha entre ejemplares. (criterio)
- **Muertos y caídos.** Un muerto, convaleciente o alguien en un combate en curso no actúa: no da
  noticias, no es objetivo de un grupo, no se mueve al corral ni se recluta. (criterio)
- **Del Reino es `esDelReino`.** Un viajero sin facción puede ser un asalto de bandidos: lo del Reino
  (sus partidas, sus avisos, «De paso por aquí») se filtra con `esDelReino` / `TIPOS_SIN_DUENO`,
  nunca con `factionId: null` a secas. (criterio)
- **El tope cuenta al decidir.** Un tope o límite (tamaño de un ejército, plazas, equipos) entra en
  la decisión, no se recorta después: nadie sale sabiendo que va corto. (criterio)

## Cada partida, lo suyo

- **Lo que nace en una partida lleva su `saveId`** (`QA-31`, retro del 2026-10-09). Una fila creada
  jugando (un lugar, un edificio, una población) es de esa partida; sin dueña, la ven todas (pasó con
  los interiores de Capital y Cuartel: se podía viajar al de otra partida). Las consultas de `Location`
  por mundo o región pasan por `lugaresVisibles` (`mundoPartida.ts`). Lo vigila
  `backend/src/scripts/locationConDuena.test.ts` para `location.create`. (check: `locationConDuena.test.ts`, solo `location.create`; las consultas, criterio)
- **Renombrar algo que las partidas guardan por nombre** (`QA-68`, retro del 2026-10-13) cambia todos
  los campos que lo guardan, no solo el principal. Habilidades: un campo nuevo que guarde nombres de
  habilidad lleva en el esquema «Guarda nombres de habilidad (QA-68)» y su función en `RENOMBRAR`
  (`habilidadesRenombradas.ts`); el test de ese archivo exige que coincidan. Pasó con P100: las barras
  (`SkillBar.abilityNames`) se quedaban con el nombre viejo.
  Además, `habilidadesConocidas.json` (`QA-273`) guarda todos los nombres de habilidad del catálogo: si uno
  desaparece sin entrar en `HABILIDADES_RENOMBRADAS`, falla el test. Un nombre quitado de ese JSON es una habilidad
  retirada: el revisor comprueba que la usuaria lo decidió y que no es un renombre escondido. (check: el test de `habilidadesRenombradas.ts` y `habilidadesConocidas.json`)
- **Un borrado o una actualización con condición sobre relaciones** (`where` anidado de Prisma: `none`, `some`,
  `every`) lleva test de integración contra Postgres (`QA-276`, retro del 2026-10-26): tsc no valida esos nombres de
  relación (aceptó `almacen` por `almacenItems` en `retirarHuerfanos.ts`). Si borra filas de catálogo, el test pone
  también una referencia de partida sin FK y una copia de partida (`docs/mapa-agente.md`, «Copias de partida»). (criterio)

## Un dato, un sitio

Retro de `QA-27` (2026-10-12, `QA-40`): tres de los diez fallos de la revisión de la ronda eran esto.

- **La ficha de un ser vivo, con `entityTypeDeSerVivo`** (retro del PR #56). Si es `npc` o `fauna` en la
  Enciclopedia (`DiscoveredEntity.entityType`) se decide solo con `entityTypeDeSerVivo`
  (`entityDiscovery.ts`), al guardar y al leer. Elegirlo a mano (por `kind`, por `tipo` del punto) es un
  hallazgo: P134 dejó a la Cazadora Serhu en «???» porque el mapa lo decidía por `kind`. (criterio)

- **Mismo filtro en los dos caminos.** Si dos caminos muestran o usan lo mismo (lo que se pinta en el
  mapa y lo que te corta el paso; la lista y su detalle), filtran igual, mejor con la misma función.
  Pasó en `zona.ts`: la fauna fuera de su sitio no se pintaba, pero seguía colisionando. (criterio)
- **Una regla nueva, en todos sus caminos** (`QA-78`, retro del PR #53). Cuando un arreglo añade una
  regla (un tope, un atributo, una comprobación) a una función o a una ruta, se buscan con `grep` los
  sitios que hacen lo mismo y la regla llega a todos, o el diff dice por qué no. Mejor aún, un solo
  sitio por donde pasan todos y un test que lo exija (`condicionTrasGolpe` en el combate de grupo).
  Siete de los doce fallos del PR #53 eran esto: el tope de ronda de P129 en 2 de 6 golpes, la Destreza
  de P109 en una de dos tiradas, la energía de P121 sin tope y `/abrir` sin las comprobaciones de la
  ruta que sustituye. (criterio)
- **La oferta de un encuentro se arma en dos sitios** (`QA-99`, retro de P189-P205): la colisión del mapa
  (`detectarEncuentroEnCelda`, `zona.ts`) y la oferta ambiental del turno (`turnResolution.ts`). Un campo o una
  regla nueva de la oferta (`quien`, `deBando`, lo que se alcanza desde dónde) va en los dos, o el diff dice por
  qué no. P190 y P193 llegaron al `/code-review` en uno solo. (criterio)
- **Sin copias entre backend y frontend.** Lo que decide el backend viaja en su respuesta (un campo,
  como `currentLocation.puntoDeAgua`); una lista copiada a mano en el frontend se desfasa. Lo mismo con
  el diario: una línea que cuenta algo del juego llega del backend con su `logEntryId`, y el frontend
  solo inventa las de error (`lineasLocalesDelDiario.test.ts`, `QA-73`). (check: `lineasLocalesDelDiario.test.ts`, solo el diario; lo demás, criterio)
- **El filtro mira la consulta, no la página.** Lo que depende de filas vecinas (quitar una línea
  porque otra la repite) se decide contra la base: en una lista paginada, la vecina puede caer en
  otra página. (criterio)

- **Lo que sale de una columna JSON se comprueba** (`QA-89`, retro de los hallazgos de `QA-27`). Un
  campo `Json` (los `huecos` de una misión, `pendingDynamicModeOffer`, `pendingNpcInteractionOffer`)
  llega con el tipo que se le pone con `as`, no con el que tiene: una fila vieja o a medias puede no
  traer el campo. Lo que se lee de ahí va con `?.` y un camino para cuando falta, sin `!`; con más
  razón en una ruta que pinta la partida entera. `motivoNoEntregable` tumbaba `GET /saves` con
  `h.objeto!.nombre` en una misión sin objeto. (criterio)

## Un fallo que vuelve

- **Una plantilla del catálogo que las partidas ya copiaron no se mueve ni se renombra** sin decir qué pasa
  con sus copias (`QA-90`, retro del 2026-10-17). Las partidas copian recursos y edificios por (tipo, slug, x, y):
  moverla deja dos puntos en las partidas viejas. Pasó con el recinto de múrgoles (P185); lo vigila
  `posicionesPlantillas.test.ts`. (check: `posicionesPlantillas.test.ts`)
- **Un hallazgo ya arreglado que vuelve** (`QA-64`, retro del 2026-10-12) se arregla en la raíz: el diff
  dice qué función crea el dato, enumera a quién la llama y cubre cada camino con un test (o explica por
  qué un camino no lo necesita). Pasó con P32: se arregló camino a camino dos veces, y la revisión del
  segundo arreglo aún encontró cuatro caminos sin cubrir. (criterio)
- **Un campo que siempre hay que dar no lleva `@default`** (`QA-67`, retro del 2026-10-13). Sin valor por
  defecto, el compilador marca cada creación que lo olvida; un `?? undefined` sobre ese campo vuelve a
  caer al valor por defecto y es un hallazgo. Pasó con P87: `LogEntry.fictionalMinutes` valía 0 si no se
  daba, y las entradas desaparecían del diario. Un test que leía el código buscando el campo no vio 7
  creaciones; quitar el `@default` las sacó todas en `tsc`. (criterio)

## Textos que se leen

- **Un nombre de encuentro dentro de una frase** (`QA-59`, retro del 2026-10-12) pasa por
  `nombreEnFrase` (`services/dynamicMode.ts`), que pone el artículo, y un grupo se nombra como grupo
  («un grupo de 5 Cruzavientos»). El frontend enseña la frase que manda el backend, no la rehace.
  Pasó con P63, P90 y P102: cada sitio que componía su propia frase dejaba el nombre sin artículo o
  en singular. (criterio)
- **Las comillas que se leen son « »** (P57, P94, P111). Las rectas quedan para lo que no se lee: la
  acción que el backend analiza (`contra 'X'`), los prompts y las trazas. `comillasEnPantalla.test.tsx`
  vigila componentes y páginas. (check: `comillasEnPantalla.test.tsx`)

## Lo hostil y la jugadora

- **Colocar o mover algo hostil** (fauna AGRESIVA, enemigos, grupos) dice qué pasa junto a la
  jugadora, en la entrada de la zona y donde se reaparece tras morir, y lleva un test con un agresivo
  cerca de ella (`QA-51`, retro del 2026-10-12). Pasó con P82: repartir los grupos por la zona
  (P50) los dejó junto al punto de reaparición y se moría en bucle hasta la muerte permanente. Lo que
  empieza un combate respeta la gracia tras reaparecer (`enGraciaTrasRenacer`, `services/death.ts`). (criterio)

## Las facciones también

- **Mismos sistemas** ([ADR 0003](docs/adr/0003-todo-viaja-de-verdad.md)). Cada mecánica que manda
  algo por el mapa (partidas, expediciones, caravanas, patrullas) dice cómo la usan las facciones y
  tiene un test para ellas. Ninguna es solo de la jugadora. (criterio)

## Rutas

- **Un GET solo lee.** Descubrir, revisar o apuntar algo va en el avance diario o en la acción que lo
  causa, nunca al abrir un panel. (criterio)
- **Listas del cuerpo.** Los ids que llegan en una petición se leen con `idsDelCuerpo` (solo cadenas,
  sin repetidos) y quien no puede ir se rechaza con su motivo, no se descarta en silencio. (criterio)

## Roadmap y documentos

- **Tarea cerrada.** Tachada en su roadmap con `✅ fecha`, qué se hizo y qué queda, y en el mapa de
  `docs/producto/21-roadmap.md`; la bitácora al día en el mismo commit (`CLAUDE.md`). (check: `tools/roadmap/cobertura.py` y `tools/qa/bitacora-check.sh`, en parte; el tachado, criterio)
- **Tareas `INS-*`.** Son del repo del instalador: sin hito en los roadmaps de WMF ni fila en el mapa; basta su fila
  de la bitácora con el enlace a su plan (`AGENTS.md`, `QA-259`). No es un hallazgo de «sin hito» ni de pausa de pruebas. (criterio)
- **Lore.** Nada editado en `docs/rpgtarkor/` (`AGENTS.md`); las propuestas, en
  `docs/borradores-opencode/propuestas-lore.md`. (check: `protectedPaths` para los borradores; `docs/rpgtarkor/`, criterio)

## Ganchos y scripts del flujo

Desde el piloto de Galivelop-workflow (2026-10-22) los ganchos y scripts del flujo son los de `.githooks/` y
`.claude/gw/scripts/`: no se editan aquí, se proponen en el repo del flujo (`docs/records/piloto-galivelop-workflow.md`,
«For Galivelop-workflow»; check: `config-guard.py` pregunta antes de editarlos). Lo de WMF es su configuración (`.claude/gw.json`), sus scripts de `tools/qa/` y sus tests.

- La raíz del repo se saca de la ruta del script (`$(dirname "$0")`), no de `$CLAUDE_PROJECT_DIR` ni del directorio
  actual: en la nube la sesión puede arrancar en `/home/user`. (criterio)
- Un gancho de subida comprueba el commit que se sube, no la carpeta de trabajo, y falla cerrado cuando le falta un
  dato (un commit que no tiene, una API que no responde). Excepción razonada: las claves de rutas de `.claude/gw.json`
  (`log`, `reviewMark`, `recordsDir`, `proposalsDir`, `ciLocalLog`) son opcionales con defecto en inglés, así que una
  ausente no es un dato que falte. (criterio)
- Los scripts de shell corren en bash 3.2 (macOS): nada de `mapfile` ni arrays asociativos. (criterio)
- Una carpeta con nombre fijo en un directorio compartido (`$TMPDIR`, `/tmp`) es por usuario, se crea con permisos 700
  y se rechaza si ya existe como symlink o de otro usuario; los archivos sueltos, con `mktemp`. (criterio)
- Un gancho que pregunta o bloquea se revisa **probando cómo saltárselo**: envoltorios con opciones que llevan valor
  (`sudo -u X`, `sudo -uX`, `env -u X`, `nice -n 5`, `timeout 5`, `xargs -I{}`), el destino de los copiadores (`cp`,
  `install`, `rsync`, `dd of=`, `-t DIR`), una carpeta antecesora de la protegida y una ruta relativa o con `..`; y
  los falsos positivos habituales (leer o copiar **desde** la carpeta, `git restore --staged`). Cada forma, su caso. (criterio)
- `pkill -f <patrón>` (y `pgrep -f`) casa también con la orden que lo lanza cuando el patrón va en ella
  (`bash -c "… pkill -f servidor"`), y la mata: un pidfile, `pgrep -x` o un patrón que no se case a sí mismo
  (`[s]ervidor`). (criterio)
- Un runbook o encargo que sigue una tarea programada (una sesión sin persona delante) se revisa como código, aunque
  case con `content`: lo que dice se ejecuta tal cual. (criterio)
- Una orden con `npx` en `check` pasa por `tools/qa/host.sh` (sandbox Flatpak de la Deck, `QA-180`). (check: `tools/qa/tests/test_host.py`; ponerla en `check`, criterio)
- Un cambio en `.claude/gw.json` (sobre todo `check`, `relatedTests`, `protectedPaths` o `reviewMark`) o en
  `.githooks/` lleva su caso en `tools/qa/tests/` (`test_pre_commit.py`, `test_prepush_ramas.py`). (criterio)
