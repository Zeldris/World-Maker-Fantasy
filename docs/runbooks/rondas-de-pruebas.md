# Ronda de pruebas jugando — runbook

Para cuando la usuaria pide «probar», «jugar como una jugadora» o una ronda de pruebas (`QA-27`,
retro del 2026-10-09). Herramientas: [`tools/playwright-e2e/`](../../tools/playwright-e2e/README.md).

**Quién juega** (`QA-124`): un subagente `sonnet` por tanda de 3-5 comprobaciones, con la forma de encargo de
[`orchestrate-dealer`](../../.claude/skills/orchestrate-dealer/SKILL.md); la sesión principal no lanza `orden.sh`, solo
reparte y apunta. Para pelear, `orden.sh --ayuda pelear` (acercarse, interactuar y combatir en una orden, `QA-125`).

## Qué se prueba, en este orden

`QA-44` (retro de `QA-27`, 2026-10-12):

1. **Lo arreglado en la ronda que solo tiene tests**: verlo funcionar jugando y apuntarlo como
   comprobado en el registro.
2. **Todo lo implementado, del `0.1` al hito en curso** (usuaria, 2026-10-13: hasta probarlo todo no
   se vuelve al roadmap). Las filas de
   [«Qué entra en cada hito»](../producto/21-roadmap.md#qué-entra-en-cada-hito) dicen qué entra en cada
   uno; lo que ya está probado en vivo, en
   [`checklist-pruebas-juego.md`](../registros/checklist-pruebas-juego.md).
3. Lo que el roadmap no tiene (p. ej. «Crear desde cero» en la creación de personaje) no se prueba.

**Con qué se juega** (`QA-56`, usuaria, 2026-10-12): Gorhorn, el personaje preseleccionado, con la
clase **Cazador** (la especialización, Domador, se elige a nivel 10). «Crear desde cero» es del final del
roadmap: no se abre.

Cómo provocar cada cosa (los encuentros salen al moverse por el mapa de zona, no escribiendo
«salgo a cazar») y qué está ya probado en vivo:
[`checklist-pruebas-juego.md`](../registros/checklist-pruebas-juego.md).

**Moverse** (`QA-87`, usuaria, 2026-10-14): dentro de una zona y de una a otra, por el mapa de zona y
sus salidas, como una jugadora. El viaje directo a otra zona es de las monturas (P164).

**Capturas y datos de la partida** (`QA-86`):

- Cada orden de `orden.sh` tiene `shot('nombre')`, que guarda en `tools/playwright-e2e/shots/` y
  devuelve la ruta: `orden.sh "await page.getByText('Mapa').click(); return await shot('r1-mapa')"`.
- Para mirar la partida por dentro, SQL contra la base de juego:
  `psql postgresql://tarkor:tarkor@localhost:5432/tarkor_juego -c '<consulta>'` (tablas con el nombre
  del modelo entre comillas, p. ej. `"Save"`, `"ZonePoint"`; columnas en camelCase).
- Las consultas de cada ronda (`QA-97`, retro del 2026-10-17), con `D=postgresql://tarkor:tarkor@localhost:5432/tarkor_juego`
  y `S=<id de la partida>`:

  ```sh
  # Dónde está (zona y px del mapa) y a qué hora (minutos desde el día 1 a las 00:00)
  psql $D -c "select l.slug, s.\"zonaPosX\", s.\"zonaPosY\", w.\"fictionalMinutes\" from \"Save\" s join \"Location\" l on l.id = s.\"currentLocationId\" join \"WorldState\" w on w.\"saveId\" = s.id where s.id = '$S'"
  # Reputación con cada bando (vacía = la de partida)
  psql $D -c "select \"factionsStatus\" from \"WorldState\" where \"saveId\" = '$S'"
  # Últimas líneas del diario
  psql $D -c "select \"createdAt\"::time, left(text, 120) from \"LogEntry\" where \"saveId\" = '$S' order by \"createdAt\" desc limit 10"
  # Puntos de una zona (posición en px del mapa de 800×600, dueño)
  psql $D -c "select zp.tipo, zp.\"targetSlug\", zp.x, zp.y, zp.cantidad, zp.\"factionSlug\" from \"ZonePoint\" zp join \"Location\" l on l.id = zp.\"locationId\" where zp.\"saveId\" = '$S' and l.slug = '<slug>'"
  # Coordenadas de las zonas del catálogo (y crece hacia el norte: sirve para saber por qué salida se va)
  psql $D -c "select slug, x, y from \"Location\" where \"saveId\" is null and slug in ('<slug>', '<slug>')"
  # El último encuentro (enfriamiento de P177)
  psql $D -c "select \"zonaUltimoEncuentro\" from \"Save\" where id = '$S'"
  ```

## Una ronda, un bloque (`QA-105`)

Una ronda coge **un bloque** de la matriz de cobertura y lo cierra entero, sin saltar de un sitio a otro:

1. **Qué falta**: `python3 tools/qa/matriz-pruebas.py` (resumen por bloque) y `--bloque <Bloque>` (las tareas sin
   jugar de ese bloque). El bloque, el que tenga menos jugado o el que pida la usuaria.
2. **Escenario**: `tools/qa/escenario.sh lista`; si ninguno deja cerca lo que se va a probar, se llega jugando una
   vez y se guarda (`escenario.sh guardar <nombre> "<qué tiene>"`, `QA-102`). Lo que tarda días, con
   `escenario.sh avanzar <partida> <días>`.
3. **Jugar**: cada comprobación se mira en texto (`orden.sh --ayuda estado`, `QA-104`); captura solo si algo no
   cuadra o es visual. Lo que vale la pena repetir se escribe como recorrido en
   `tools/playwright-e2e/recorridos/` (`QA-103`, su cabecera en `recorrer.mjs`) y se pasa con
   `bash tools/qa/recorrer.sh [filtro]`: una línea por recorrido.
4. **Apuntar**: hallazgos con `marca-hallazgo.py` (abajo) y, en la matriz, cada tarea jugada como `jugado` con la
   fecha y el hallazgo o recorrido que lo prueba.
5. **Cerrar**: arreglos, sus recorridos en verde y el bloque en `jugado` en la matriz. Entonces, el siguiente.

## Cómo se juega

1. Arranca con `bash tools/playwright-e2e/arrancar-juego.sh` (base `tarkor_juego`, aparte de la de
   los tests). Partida nueva desde el menú, como una jugadora. Para manejar el navegador con el MCP
   de Playwright, carga antes las ayudas de `tools/playwright-e2e/mcp/` (`QA-46`, su README).
   **Con el modelo real** (en local), arranca con el registro de la IA para que la tanda se pueda analizar:
   `IA_REGISTRO=backend/ia/registro-<fecha>.jsonl IA_PERFIL=deck bash tools/playwright-e2e/arrancar-juego.sh`
   (`IA_PERFIL`: `deck`, `cpu`, `gpu8` o `gpu12`, según la máquina). Al acabar la tanda, `/opt-ai` mide los tiempos,
   contrasta el RAG con las incoherencias apuntadas y propone ajustes ([skill](../../.claude/skills/opt-ai/SKILL.md)).
2. Juega paso a paso y **mira cada paso**: en texto con `estado.js` (`QA-104`); captura si algo no cuadra o es
   visual (botones, textos, mapa, avisos). **Si hace falta una captura para entender algo que no es visual**
   (usuaria, 2026-10-19), después se mejora `estado.js` o la ayuda que toque para que lo dé en texto la próxima vez
   (así salieron los cajones, los tooltips y `pulsar.js`).
   Un bucle automático (combate, caminar) solo para repetir algo ya visto; lo nuevo se juega a mano.
3. Apunta cada hallazgo en el registro de la ronda (`docs/registros/pruebas-<hito>-hallazgos.md`,
   tabla `| P<n> | Hallazgo | Estado |`): fallos, incoherencias de texto o de lore, y detalles de
   interfaz, con la causa si se ve. Con `tools/qa/marca-hallazgo.py` (`QA-42`, `QA-47`):
   `--nuevo "<hallazgo>" "<estado>"` añade la fila con el siguiente número, y
   `P<n> "<texto viejo>" "<texto nuevo>"` cambia su estado; las dos rehacen el resumen de la cabecera
   (`QA-84`). Lo comprobado jugando se marca con «Comprobado jugando» en el estado.
4. **La ronda no escribe código** (`QA-45`, petición de la usuaria del 2026-10-12): la prioridad es
   probar. **Desde el 2026-10-20 (usuaria), una sesión de pruebas solo apunta, nunca corrige código** (ni del
   juego ni de las herramientas): lo que la usuaria acepte va a «Propuestas aprobadas para el roadmap cuando
   acaben las pruebas» de la bitácora. Lo que sigue de este punto queda para las sesiones de arreglos. Solo se arregla un fallo **bloqueante** (no se puede seguir jugando, o el juego hace algo
   imposible), con su test y comprobado en vivo; que el test falle sin el arreglo se comprueba con
   `tools/qa/rojo-sin-arreglo.sh` (`QA-58`). También se arregla, antes del PR, el efecto secundario de
   un arreglo de esta misma rama que aún no está en `main` (`QA-83`; p. ej. P151, de P123): es parte
   de ese arreglo y se vuelve a jugar. Lo demás va al registro como «pendiente»; las
   mejoras y el diseño, al roadmap como tarea con hito. Las retros y los arreglos de lo apuntado se
   hacen antes o después de la ronda, no en medio. Si el MCP de Playwright no conecta,
   `driver.mjs` de `tools/playwright-e2e/` (`QA-41`), con las mismas ayudas: `orden.sh --ayuda
   <archivo> '<tk>'` (`QA-57`).
5. Antes de pasar la suite con base real, `bash tools/playwright-e2e/arrancar-juego.sh --parar`: con el
   juego y el driver en marcha, la carga suma fallos por tiempo límite (`QA-65`).
6. Commit y push tras cada tanda de hallazgos; la tarea de la ronda en su roadmap lleva qué está
   hecho y qué falta.
7. **Al final, no por tanda:** `/code-review`, luego `/opt-tokens`, luego `/retro` y lo aprobado de ellas, **antes de crear** el PR a `main` (usuaria, 2026-10-13; sustituye al `/code-review` cada 5-6 hallazgos de `QA-40`; `QA-77`).

## Lo que engaña

- Las narraciones del Ollama simulado meten trozos del prompt («se narró como si…») o frases fijas
  («El personaje observa con atención a su alrededor…»): no es un fallo. `estado.js` las marca
  «[simulado]» (`QA-60`).
- `GET /saves` y «la última partida» de la base de los tests pueden ser de un test en marcha: juega
  en `tarkor_juego` y saca el id de la partida de la URL (`/solitario/partida/<id>`).
- `arrancar-juego.sh` no recarga el backend al cambiar el código (`tsx` sin `watch`): tras un arreglo, `--parar` y
  arrancar de nuevo antes de jugarlo (`QA-97`).
- Tras reiniciar el backend, el frontend conserva datos viejos hasta recargar la página.
- En la Deck, Ollama se arranca con `flatpak-spawn --host bash -lic 'ollama serve'` (con `-lic`, para que cargue el
  `~/.bashrc` con `OLLAMA_IGPU_ENABLE`, `OLLAMA_FLASH_ATTENTION` y `OLLAMA_KV_CACHE_TYPE`). Con `bash -c` va solo por
  CPU (`logs/ollama.log`: «dropping integrated GPU»): turnos de 3-10 min, timeouts y casi todo narrado por el modelo
  de respaldo, que parecen fallos del narrador y no lo son (2026-10-20).
- Un escenario guardado en la nube trae los embeddings del lore del Ollama simulado: con el Ollama real, `npm run
  reindex-lore` (en `backend/`, con la `DATABASE_URL` de `tarkor_juego`) antes de jugar; si no, el RAG devuelve trozos al
  azar (P274).

## Fallos de las herramientas

Lo que devuelven los subagentes en `HERRAMIENTAS` (`QA-133`) se apunta aquí, con su remedio:

- `turno.js` falla con un cajón abierto (el clic queda interceptado): cerrar el cajón antes.
- El driver de Playwright muere cada vez que `escenario.sh` reinicia el juego: relanzarlo.
- Lanzar el driver con `setsid node … < /dev/null &`: con `nohup … &` no responde y `orden.sh` devuelve vacío. Antes,
  comprobar que no queden drivers viejos (el `driver.log` puede mostrar el error de otro).
- No usar `pkill -f driver.mjs`: casa también con la shell que lo lanza y la mata (código 144). Matar por PID.
- Con un encuentro hostil que corta el paso, «Moverte por la zona» queda deshabilitado y `puntos.js` y `mover.js` fallan
  por timeout: resolver antes el encuentro.
- El Ollama simulado nunca devuelve `combateIniciado`: lo que pide un combate abierto desde texto libre no se prueba con él.
- Tras una migración nueva, el cliente de Prisma puede quedar viejo: el primer turno da «Error narrando el turno» (`Unknown
  field` en `logs/backend.log`). Remedio: `npx prisma generate` en `backend/` y volver a lanzar `arrancar-juego.sh`
  (ronda P232, 2026-10-20).
- Con Ollama real (Deck, por CPU) cada turno tarda 3-6 min: `combate.js` da «sigue desactivada tras 20 s» mientras
  giran los dados; esperar a que el HUD deje de decir «El narrador escribe».
- En la Deck no hay `psql` fuera del contenedor `tarkor-postgres`: envoltorios de `psql`, `pg_restore` y `pg_dump` con
  `podman exec -i` en `logs/bin/` (ignorada por git), en el `PATH` de `flatpak-spawn --host bash -lic '…'`.
- `orden.sh` también necesita `node`: en la Deck, por `flatpak-spawn --host` (el sandbox no ve el `/tmp` del host).
- `turno.js` da «textbox no encontrado» con la barra de habilidades activa (el botón ✨ la alterna) o con un modal abierto.
- `pulsar.js` con el texto «Leyendas» casa con el rótulo LEYENDA del mapa de zona.
- El prompt del narrador no se registra: para ver un bloque (verdad, callbacks, memoria), ejecutar `bloqueMemoria` aparte con `tsx`.
- Desde el sandbox, `flatpak-spawn --host --directory=<repo>`: sin `--directory` sale «No existe el fichero o directorio»
  (el directorio de trabajo es el del scratchpad). El SQL con comillas va mejor por stdin al envoltorio de `psql` que con `-c`.
- `pulsar.js` con solo `contiene` falla («Falta window.tk.texto»); `pulsar` «Reino» no dice si se abrió el cajón.
- El escenario `reino-dia39` no tiene comida, materiales ni Goirnos: Corrales, Partidas, Defensa, oficios y llegadas no
  se pueden provocar sin `escenario.sh dar` (necesita el permiso de la usuaria) o recolectar fuera de la Hondonada.
- `orden.sh` por `flatpak-spawn` no ve el `/tmp` del sandbox: ni `< archivo` ni `--ayuda` con una ruta de allí (vale
  pasar el JS en base64 por stdin, o dejar el archivo dentro del repo en una carpeta ignorada).
- Con Ollama real, `turno.js` y `combate.js` vuelven a los ~40 s con el HUD aún en «El narrador escribe»: esperar en un
  bucle a que desaparezca. `combate.js` con `rondas:1` a veces juega Defensa (por la iniciativa) sin avisar.
- `IA_REGISTRO` con ruta relativa se resuelve desde `backend/` (donde corre el servidor): `backend/ia/…` no escribe
  nada. Usar la ruta absoluta (`$PWD/backend/ia/registro-$(date +%F).jsonl` desde la raíz).
