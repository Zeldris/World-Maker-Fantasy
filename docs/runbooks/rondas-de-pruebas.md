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
  **Por defecto, JPEG de calidad 50** (`.jpg`, unas 4-5 veces menos bytes que el PNG; `QA-149`). Para gastar aún menos,
  recorta: `shot('n', {selector: '.mapa'})` (a ese elemento) o `shot('n', {clip: {x:0, y:0, width:400, height:300}})`.
  **A tamaño completo** (PNG, página entera): `shot('n', {completo: true})`; `{png: true}` solo cambia el formato y
  `{calidad: 80}` la calidad. `selector` no se combina con `clip` ni `completo` (error). `captura.js` (MCP) acepta lo mismo en `tk`: `nombre`, `selector`, `clip`, `calidad`, `png`, `completo`.
- Para mirar la partida por dentro, SQL contra la base de juego con `tools/qa/sql.sh` (`QA-150`): la consulta por
  argumento o, si lleva comillas, por stdin (`bash tools/qa/sql.sh <<'SQL' … SQL`). Usa `psql` o, si no hay, `podman exec -i
  tarkor-postgres psql`, y en la Deck pasa solo por `host.sh`. Base: `TARKOR_DB_URL` (por defecto `tarkor_juego`). Tablas
  con el nombre del modelo entre comillas, p. ej. `"Save"`, `"ZonePoint"`; columnas en camelCase.
- Las consultas de cada ronda (`QA-97`, retro del 2026-10-17), con `S=<id de la partida>`:

  ```sh
  # Dónde está (zona y px del mapa) y a qué hora (minutos desde el día 1 a las 00:00)
  bash tools/qa/sql.sh "select l.slug, s.\"zonaPosX\", s.\"zonaPosY\", w.\"fictionalMinutes\" from \"Save\" s join \"Location\" l on l.id = s.\"currentLocationId\" join \"WorldState\" w on w.\"saveId\" = s.id where s.id = '$S'"
  # Reputación con cada bando (vacía = la de partida)
  bash tools/qa/sql.sh "select \"factionsStatus\" from \"WorldState\" where \"saveId\" = '$S'"
  # Últimas líneas del diario
  bash tools/qa/sql.sh "select \"createdAt\"::time, left(text, 120) from \"LogEntry\" where \"saveId\" = '$S' order by \"createdAt\" desc limit 10"
  # Puntos de una zona (posición en px del mapa de 800×600, dueño)
  bash tools/qa/sql.sh "select zp.tipo, zp.\"targetSlug\", zp.x, zp.y, zp.cantidad, zp.\"factionSlug\" from \"ZonePoint\" zp join \"Location\" l on l.id = zp.\"locationId\" where zp.\"saveId\" = '$S' and l.slug = '<slug>'"
  # Coordenadas de las zonas del catálogo (y crece hacia el norte: sirve para saber por qué salida se va)
  bash tools/qa/sql.sh "select slug, x, y from \"Location\" where \"saveId\" is null and slug in ('<slug>', '<slug>')"
  # El último encuentro (enfriamiento de P177)
  bash tools/qa/sql.sh "select \"zonaUltimoEncuentro\" from \"Save\" where id = '$S'"
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

0. **Claude se lanza desde `World-Maker-Fantasy/`**, no desde `Desarrollos/` (`QA-140`): desde fuera no cargan
   `.claude/settings.json` (tope de 200k), los ganchos ni las skills del repo (`Unknown skill: opt-ai`).
1. Arranca con `bash tools/playwright-e2e/arrancar-juego.sh` (base `tarkor_juego`, aparte de la de
   los tests). Partida nueva desde el menú, como una jugadora. Para manejar el navegador con el MCP
   de Playwright, carga antes las ayudas de `tools/playwright-e2e/mcp/` (`QA-46`, su README).
   **Con el modelo real** (en local), arranca con el registro de la IA para que la tanda se pueda analizar:
   `IA_REGISTRO=$PWD/backend/ia/registro-<fecha>.jsonl IA_PERFIL=deck bash tools/playwright-e2e/arrancar-juego.sh`
   En la Deck, `bash tools/qa/host.sh bash tools/qa/deck/juego.sh` lo pone solo (`deck` y `logs/ia/<fecha>.jsonl`, `QA-192`).
   (`IA_REGISTRO` con ruta absoluta: el servidor corre en `backend/`; el script completa una relativa. `IA_PERFIL`: `deck`,
   `cpu`, `gpu8` o `gpu12`, según la máquina; con él, el script comprueba GPU y `rag-eval` y para si fallan, `QA-141`). Al acabar la tanda, `/opt-ai` mide los tiempos,
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
4. **La ronda solo juega y apunta** (`QA-45`, usuaria, 2026-10-12; endurecido el 2026-10-20): no corrige código, ni
   del juego ni de las herramientas, tampoco un fallo bloqueante, ni analiza (medidas, causas en el código, casos del
   RAG): eso lo hacen las skills (`/opt-ai`, `/code-review`, `/retro`) en el flujo del PR. Lo que la usuaria acepte va a
   «Propuestas aprobadas para el roadmap cuando acaben las pruebas» de la bitácora; los arreglos, en una sesión de
   arreglos aparte. Si el MCP de Playwright no conecta, `driver.mjs` de `tools/playwright-e2e/` (`QA-41`), con las
   mismas ayudas: `orden.sh --ayuda <archivo> '<tk>'` (`QA-57`).
5. Antes de pasar la suite con base real, `bash tools/playwright-e2e/arrancar-juego.sh --parar`: con el
   juego y el driver en marcha, la carga suma fallos por tiempo límite (`QA-65`).
6. Commit y push tras cada tanda de hallazgos; la tarea de la ronda en su roadmap lleva qué está
   hecho y qué falta.
7. **Al final, no por tanda:** `/code-review`, `/opt-ai` si hubo tandas con Ollama real ([paso 6](skills-y-modelos.md#cómo-se-usa-el-flujo-de-una-tarea), `QA-142`), luego `/opt-tokens`, luego `/retro` y lo aprobado de ellas, **antes de crear** el PR a `main` (usuaria, 2026-10-13; sustituye al `/code-review` cada 5-6 hallazgos de `QA-40`; `QA-77`).

## Lo que engaña

- Las narraciones del Ollama simulado meten trozos del prompt («se narró como si…») o frases fijas
  («El personaje observa con atención a su alrededor…»): no es un fallo. `estado.js` las marca
  «[simulado]» (`QA-60`).
- `GET /saves` y «la última partida» de la base de los tests pueden ser de un test en marcha: juega
  en `tarkor_juego` y saca el id de la partida de la URL (`/solitario/partida/<id>`).
- `arrancar-juego.sh` no recarga el backend al cambiar el código (`tsx` sin `watch`): tras un arreglo, `--parar` y
  arrancar de nuevo antes de jugarlo (`QA-97`).
- Tras reiniciar el backend, el frontend conserva datos viejos hasta recargar la página.
- GPU de Ollama en la Deck y lore sin reindexar con el Ollama real: los comprueba `arrancar-juego.sh` con `IA_PERFIL` y
  para con el arreglo en el mensaje (`QA-141`, [script](../../tools/playwright-e2e/arrancar-juego.sh)).

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
- En la Deck, lo que necesita el host (`node`, `psql`, `ollama`, `podman`) va por `bash tools/qa/host.sh <orden…>`
  (`QA-150`: `flatpak-spawn --host --directory=<raíz> bash -lic`; fuera del sandbox ejecuta la orden tal cual). El SQL,
  por `tools/qa/sql.sh` (sin `psql` usa `podman exec -i tarkor-postgres psql`).
- `turno.js` da «textbox no encontrado» con la barra de habilidades activa (el botón ✨ la alterna) o con un modal abierto.
- `pulsar.js` con el texto «Leyendas» casa con el rótulo LEYENDA del mapa de zona.
- El prompt del narrador no se registra: para ver un bloque (verdad, callbacks, memoria), ejecutar `bloqueMemoria` aparte con `tsx`.
- Las fichas de la Enciclopedia son un modal con fundido: `txt.sh` y el texto del cuerpo no las ven al instante; `j.sh` con una espera de 1 s y buscar el elemento con el nombre y «Reclutar» (o una captura `shot`) las da (ronda 3.3, tanda 10).
- `ronda.sh` y `combate.js` dicen «no hay combate en marcha» hasta pulsar «Combatir» (`pulsar` con `contiene`), y no rematan: con rivales convalecientes hay que pulsar «Matar», elegir «Ataque Básico» y «Actuar» con `j.sh`; luego «Salir» del fin de combate (ronda 3.3, tanda 10).
- `pulsar.js` con solo `contiene` falla («Falta window.tk.texto»); `pulsar` «Reino» no dice si se abrió el cajón.
- El escenario `reino-dia39` no tiene comida, materiales ni Goirnos: Corrales, Partidas, Defensa, oficios y llegadas no
  se pueden provocar así: para eso está `reino-dia39-recursos` (`QA-143`: Granero, comida 180, bolsa 300 y tesoro 251 Goirnos,
  materiales en el inventario y el Almacén). Más recursos, con `escenario.sh dar` o `dar-reino`: tiene regla `allow` en
  `.claude/settings.json`, también por `host.sh` (solo toca `tarkor_juego`, nunca la partida real de Álvaro).
- `orden.sh` por `host.sh` no ve el `/tmp` del sandbox: ni `< archivo` ni `--ayuda` con una ruta de allí (vale
  pasar el JS en base64 por stdin, o dejar el archivo dentro del repo en una carpeta ignorada).
- Con Ollama real, `turno.js` y `combate.js` vuelven a los ~40 s con el HUD aún en «El narrador escribe»: esperar en un
  bucle a que desaparezca. `combate.js` con `rondas:1` a veces juega Defensa (por la iniciativa) sin avisar.
- `IA_REGISTRO` con ruta relativa se resuelve desde `backend/` (donde corre el servidor): `backend/ia/…` no escribe
  nada. Usar la ruta absoluta (`$PWD/backend/ia/registro-$(date +%F).jsonl` desde la raíz).
- En la Deck, `escenario.sh cargar/avanzar` por `host.sh` falla con «psql: orden no encontrada» (el host no tiene `psql`, `pg_restore` ni `pg_dump`; ronda 2026-10-21). Remedio (ya en el repo, `QA-188`; `escenario.sh` lo aplica solo si no hay `psql`): scripts `psql`/`pg_restore`/`pg_dump` en `tools/qa/deck/` (versionados, `QA-188`) que van por `podman exec -i tarkor-postgres …`, y `PATH` con esa carpeta delante. `escenario.sh guardar` ya vale así (3.2, 2026-10-21): vuelca por stdout (`pg_dump -Fc … > fichero.tmp && mv`), no con `-f`, que escribía dentro del contenedor. Los escenarios del 3.2 se rehacen con `bash tools/qa/escenarios/construir.sh hacer <nombre>` (y se prueban con `escenario.sh probar <base> bash tools/qa/escenarios/construir.sh pasos <nombre>`); `escenario.sh preparar` da súbditos, compañeros NPC, guarnición, milicia, relaciones y combate con funciones del juego. Solo un Reino con súbditos pasa hambre y sed (`poblacion` 0 no gasta nada), y el agua sigue en 60 mientras haya fuente. El driver muere tras cada `avanzar`.
- `escenario.sh dar-reino` aborta entero si un solo valor no cabe (tope de comida o bebida) o un slug no existe («No se ha dado nada»): dar de uno en uno. Con dos drivers vivos `orden.sh` da «Prohibido: falta la clave de driver.token»: matar el viejo por PID (ronda 2026-10-21, tanda 3).
- `pelear.js` y `mover.js` se cortan en cada encuentro con un recurso («Pared de arcilla»): pulsar «Ignorar» y repetir la orden (tanda 4, 2026-10-21).
- `combate.js` busca el botón «Defensa» y en el panel se llama «Defenderse»; «Tajo Horizontal» da «sigue desactivada tras 20 s» (tanda 4, 2026-10-21; ver P288).
- Los NPC de encuentro vagan: tras `mover.js` el marcador cambia de sitio; volver a pedir `puntos.js` antes de repetir (tanda 5, 2026-10-21). `viajar.js` pulsa VIAJAR por su cuenta: un CANCELAR posterior ya no cancela. El mapa de Berig solo dibuja banderitas con el objeto «Mapa de las Llanuras» (`escenario.sh dar <partida> mapa-de-las-llanuras:1`); `pulsar` «Mapa» abre la pestaña Zona y la de Berig es el botón «Mapa» de dentro.
- `tools/qa/deck/lanza.sh` espera en bucle a que el driver responda (12-28 s, tope 60 s) y se niega a lanzar si ya hay uno en el puerto: en ese caso, `relanza.sh <partida>` (mata solo el driver de este checkout, espera al puerto libre y lanza). Pueden pasar de 30 s en primer plano: lanzarlos en segundo plano y esperar (remate A, 2026-10-21).
- `combate.js` con `rondas:1` sigue mientras giran los dados: esperar ~3 s antes de leer. El combate no deja `LogEntry`; su diario solo está en el DOM (remate A, 2026-10-21).
- Tras `escenario.sh preparar` el driver sigue vivo pero con otra clave: `lanza.sh` da «Prohibido: falta la clave de driver.token». Remedio: `tools/qa/deck/relanza.sh <partida>` (no matar a mano con `pgrep -f` o `pkill -f`: se mata la propia shell, código 144) (remate B, 2026-10-21). `escenario.sh avanzar` de varios días salta el aviso del asalto: para jugar «Llamar a la milicia», avanzar de día en día y mirar `GET /saves/<id>/defensa` (`avistados`).
- `escenario.sh preparar`/`dar-reino`/`avanzar` solo valen por `bash tools/qa/host.sh bash tools/qa/escenario.sh …` (`escenario.sh` pone solo `tools/qa/deck` en el PATH): sin `host.sh` dan «npx: command not found» o «podman: not found». `relanza.sh <partida>` (en segundo plano, 15-35 s) mata el driver de este checkout y lanza de nuevo. `preparar subditos:<pueblo>:<n>:<rol>` solo acepta roles de defensa (soldado, vigia, cazador…): «recolector» da «Rol desconocido», las tareas se cambian en la UI (clic en «Recolector» del súbdito y luego en la tarea). El escenario `reino-hambre-sed` pierde el Ayuntamiento (territorio PERDIDO, P299) y los 5 súbditos mueren o se van al avanzar: para jugar hambre y sed hay que dar súbditos de nuevo con `preparar` (remate C, 2026-10-21).
- `arrancar-juego.sh` y `escenario.sh cargar/avanzar/dar-reino` solo van por `bash tools/qa/host.sh …` (fuera del host: «psql: command not found»). Para entrar a un interior de clan: `mover.js` al punto «Entrar en …», pulsar «Ignorar» si salta un recurso encima (el Recinto de múrgoles tapa «Entrar en Hogar Ketg») y `viajar.js`; con una tarjeta de encuentro abierta `viajar.js` se cuelga más de 120 s: `timeout 80` y `relanza.sh` (remate D, 2026-10-21). `pulsar.js` «Interactuar» a veces no abre la escena: usar `interactuar.js` y esperar ~15 s al narrador antes de leer `estado.js`.
- Remate E (2026-10-21): tras `escenario.sh dar`, la pestaña Edificios sigue con los costes viejos («mena 0/6») hasta recargar la página, pero pulsar el botón (deshabilitado en pantalla) puede haber construido ya; mirar `Building` antes de repetir. Construir tarda ~30 s en aparecer (espera al narrador): pulsar dos veces duplica el edificio. Cambiar rol o tarea de un súbdito por la UI: `page.getByText('<rol actual>',{exact:true}).nth(i).click({force:true})` y luego `getByText('<nuevo>',{exact:true}).last().click({force:true})`; con `Escape` antes se cierra todo el panel. El tesoro del Reino pasa a la bolsa con «A tu bolsa» (campo «Goirnos a mover») sin tocar la base: sirve para provocar sueldos y equipo sin pagar. Con un solo trabajador asignable (Ruka) los talleres se activan pulsando su nombre en Reino › Producción.
- Tanda 1 del 3.3 (2026-10-21): el botón ⓘ de una habilidad (`aria-label="Detalle de <nombre>"`) solo se ve con el ratón encima y `hover`/`click` fallan por timeout; vale `page.getByLabel('Detalle de X').dispatchEvent('click')` y leer el texto del cuerpo. Con ese modal abierto el pie dice «Resuelve lo que tienes abierto…» (correcto). Elegir clase pide mantener pulsado el botón («MANTÉN PARA ELEGIR»): `mouse.down()`, 3 s, `mouse.up()`. Con el juego ya arrancado y sin driver, basta `bash tools/qa/host.sh bash -c 'cd tools/playwright-e2e && setsid node driver.mjs < /dev/null > driver.log 2>&1 &'` y esperar a que responda (12-28 s; `lanza.sh` lo hace solo).
- Tanda 2 del 3.3 (2026-10-21): tras `escenario.sh dar` hay que recargar la página para ver los objetos; en el Inventario, el chip de un objeto se pulsa con `page.mouse.click` sobre las coordenadas de la captura (1280×720). `pulsar.js` con `contiene` vale para «Responder»; `page.getByRole('button',{name:/Responder/}).click({force:true})` no abre nada. Para dar objetos, el slug del catálogo (`ItemCatalog.slug`, p. ej. `pico-minero`, `racion-carne`), no el nombre. Esperar un descanso de 2 h en vivo tarda ~5 min reales.
- Tanda 3 del 3.3 (2026-10-21): `lanza.sh` deja abierto el cajón Reino (cerrarlo con «Cerrar ✕»). `pulsar.js` «Interactuar» con la tarjeta abierta en el mapa casa dos botones: `page.getByTestId('encuentro-en-mapa').getByRole('button',{name:'Interactuar'})`. La energía está en `"Save".energia`. Un recurso recolectado queda «agotado por ahora» y no se repite; los avisos (toast) duran unos 4 s y no se ven con el mapa de zona abierto encima.
- `viajar.js` pulsa VIAJAR y espera al fin del viaje; pulsar la casilla del jugador sobre una salida abre su aviso (P6) y CANCELAR queda en el diálogo. Sin interrupciones en 8 viajes Hondonada-Pozo: P46/P47 no se provocan a voluntad (tanda 4, 2026-10-21). `puntos.js` oculta la salida en la que se está.
- Tanda 5a del 3.3 (2026-10-21): `viajar.js` con una salida pulsa VIAJAR y cruza de verdad: en una prueba de P204 llevó al Paso de los Pilares Rotos; para volver, `viajar.js` a su salida del Pozo. Comer/Beber está en la barra de habilidades (✨, «Barra 1», icono 🍖); «Beber de la fuente» se confirma solo al pulsarlo. El driver quedó vivo toda la tanda: `tools/qa/deck/o.sh <ayuda> '<json>'` y `j.sh '<js>'`.
- Con la barra de habilidades activa, `turno.js` no encuentra el cuadro: pulsar «Escribir» (`pulsar.js`, `texto: "Escribir"`) o el teclado de la esquina inferior izquierda antes. `combate.js` pide una ronda por llamada con Ollama real (3-6 min por turno en la Deck): en bucle de shell con `rondas: 1`, y las llamadas que dicen «sigue desactivada tras 20 s» no cuentan como ronda (tanda 5b, 2026-10-21).
- Tanda 6 del 3.3 (2026-10-21): el Orco Enfurecido de `reino-dia39` no sale en `puntos.js` hasta aceptar la misión de Gistera Koh (`interactuar.js` con ella; opciones con `pulsar.js` `{texto, contiene:true}`; «CONTINUAR» al final). Tras cargar, Gorhorn está arriba (425,25) y se cierra el cajón Reino. En combate el Inventario no está disponible; el modal «Descansar» está en el cajón Reino (clic en el icono de la barra izquierda, 47,305; `pulsar` «Reino» abre la pestaña de la derecha), no en la barra de habilidades (el 🏕️ es «Volver al campamento» y el 🔥 escribe un descanso por texto). `tools/qa/deck/ronda.sh` (espera al narrador y juega una ronda) sirve en el combate.
- En la Deck, `escenario.sh` falla con «psql: orden no encontrada» aun por `host.sh`: antes de `QA-188` había que usar `bash tools/qa/host.sh bash tools/qa/deck/esc.sh <orden…>` (pone en el PATH los shims `psql`/`pg_dump` de `tools/qa/deck/`, que van por `podman exec`; ronda tanda 7, 2026-10-21).
- `escenario.sh cargar reino-combate-capitan` abre un combate de 3 rivales (Muy difícil) en que Gorhorn muere en 3 rondas; para ver remate y curar, `cargar reino-sano-defensas` y `preparar <partida> combate:ulkha-ketg,herrero-serhu`. El panel de combate sale al pulsar «COMBATIR» del escenario cargado.
- Con un combate abierto por `escenario.sh` (`combatePersonas`) el panel no sale solo: `ronda.sh` y `combate.js` dan «no hay combate en marcha» hasta pulsar COMBATIR (`o.sh pulsar '{"texto":"COMBATIR"}'`). Un cajón se cierra con `«Cerrar ✕»`, no con «Cerrar» (ronda de la tanda 8, 2026-10-21).
- El modal «Fin de la partida» sale con opacidad 0 en el driver (no se puede pulsar «Ir a tus partidas»; visto en la tanda 8, sin confirmar si es del driver o de la interfaz).
- `bash tools/qa/deck/lanza.sh <partida>` tarda más de 120 s en la Deck tras `escenario.sh cargar`: lanzarlo en segundo plano y esperar (tanda 9, 2026-10-21). Para forzar un 500 en el driver, `page.route` con un regex como `/subditos/` también casa con los módulos de Vite (`SubditosSection.tsx`) y deja la página en blanco: filtrar por `u.pathname` sin extensión `.tsx?`. `r.sh` solo vale con el panel del Reino abierto (un `page.reload()` lo cierra: abrir con `button` `/🏰/`). `escenario.sh dar-reino` no pasa del tope (comida 180, bebida 60) y no hay fuente de agua: los súbditos nuevos mueren de sed en ~15 días; para ver parejas hay que reponer `bebida=60` cada 2 días con `avanzar`.
- Tanda 11 del 3.3 (2026-10-21): en el Paso de los Pilares Rotos, `interactuar.js` sobre «te corta el paso» abre el combate (no es huir): para huir, `pulsar` «HUIR» con `contiene`. Con el Mapa de las Llanuras dado, la pestaña del mundo se abre con `page.getByRole('button',{name:'Mapa',exact:true}).last()` dentro del modal Mapa. `puntos.js` y `mover.js` fallan con el modal Mapa abierto: cerrarlo con «Cerrar ✕».
- Tanda 13a-1 del 3.3 (2026-10-21): `turno.js` pide `accion`, `opcion.js` `opcion` (número) y no hay «Continuar»; con una escena abierta `mover.js` falla («Moverte por la zona» no está): pulsar «Salir». `interactuar.js` no abre la ficha de un recurso: `page.mouse.click` sobre INTERACTUAR de la tarjeta (coordenadas de la captura) y luego RECOGER. `viajar.js` no vuelca los botones del aviso de una puerta. Las capturas de `captura.js` quedan en `tools/playwright-e2e/.playwright-mcp/`.
- Tanda 13a-2 del 3.3 (2026-10-21): en Hogar Ketg, `mover.js` con `{x,y}` sobre un edificio deja el menú (Interactuar / Ver ficha completa) con un clic de `j.sh` en las coordenadas de la captura; `mover.js` no acepta `texto`. El poste de cacería es el botón de arriba a la derecha del mapa de zona (1139,113). Los botones de «Cerrar» del mapa y de los modales no casan por `getByText('Cerrar',{exact:true})` con un modal encima: clics por coordenadas. Con `pulsar` «COMBATIR» tras un turno de texto se entra en combate de verdad (no hay marcha atrás: Huir falla y deja convaleciente): mirar antes la captura. `captura.js` por `j.sh` no guarda en la carpeta esperada: usar `o.sh captura`. `escenario.sh guardar` pide `<nombre> <partida> "<qué tiene>"`.
- Tanda 13a-3 del 3.3 (2026-10-22): tras `escenario.sh cargar` con el juego ya en marcha basta `relanza.sh <partida>` (el `juego.sh` suelto da «psql: orden no encontrada» pero el juego sigue vivo). Un clic en un marcador del mapa de zona abre el menú de la ficha; "Ir hasta aquí" lleva y salta la tarjeta del encuentro. El mapa de zona es un modal: con él abierto el compositor está deshabilitado (`turno.js` falla; cerrar con clic en 1215,68). Los modales apilados (Poste, ficha de NPC) se cierran con la × de cada uno (828,86) o CANCELAR; un clic fuera deja el mapa debajo. La fauna del poblado (Corredor de Cauce) no ofrece Combatir al interactuar: no hay victoria a mano sin combate de Torgash (P306).
- Tanda 13b-1 del 3.3 (2026-10-22): un punto de zona pegado al borde queda bajo el botón «Cuadrícula» y el clic lo pulsa a él: acercarse con `mover.js` a un sitio libre al lado y pulsar el punto (menú «Interactuar / Ver ficha»). `escenario.sh dar` lo deniega el modo auto en esta sesión: sin agua, la sed 0% baja la condición rápido, así que beber antes de jugar caza o combate. `viajar.js` con encuentros de fauna en el camino pasa de 120 s: lanzarlo en segundo plano. Los P de caza de grupo (P191, P192) piden una caza que acabe en combate; «Cazar» sobre un rebaño de 6 mata uno en sigilo y no lo da.
- Tanda 13b-2 del 3.3 (2026-10-22): `viajar.js` y `mover.js` piden `{x,y}` (no `texto`); `lanza.sh` no hace falta tras `escenario.sh cargar` si se usa `relanza.sh <partida>` en segundo plano. Beber en el Pozo: ✨ Habilidades, Comer/Beber (316,440) y clic en «Beber de la fuente» (580,407), que se confirma solo. En Hogar Ketg el mapa de `mover.js` usa coordenadas de pantalla iguales a las de `puntos.js`; `pulsar` «Mapa» abre el modal informativo (sin «Ir hasta aquí»), el de moverse es el de `mover.js`. Las opciones de la tarjeta de un NPC se pulsan con `pulsar {texto, contiene:true}` (INTERACTUAR, «TIENES TRABAJO») y cada paso tarda ~25-30 s por el narrador.
