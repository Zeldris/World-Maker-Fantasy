# Pendientes leves

Movido de [`traspaso.md`](traspaso.md) el 2026-11-14 (`QA-342`). Pendientes leves de revisiones ya cerradas.

## Pendientes leves del mapa (revisión de la fase 1, 2026-11-10)

- `editar.py`: ríos importados sin `puntos` rompen `_trazos_lote` y la costa (hoy 0 ríos); la costa compara cuántos puntos quedan mal, no cuáles, y no recalcula el `continente` de rutas no tocadas; `_alturas` mira los lugares de antes del lote.
- `servir.py`: GET de `/historial.json` y `/helek.json` fuera del cerrojo; el CLI escribe sin cerrojo y con `base` opcional.
- `InteractiveMap.tsx`: los bbox de Llanuras y Cristal Helado salen del `helekRegiones.ts` regenerado (repintar mueve LocationLink y la escala); ids 17-21 y región 18 por defecto en el visor, a mano.
- Ollama simulado: el arranque está copiado en `ci-local.sh`, `entorno-nube.sh` y `con-mock-ollama.sh` (unificar); `vitest --project bd-real` a mano sigue sin levantarlo (un `globalSetup` lo cubriría).
- `consultar.py lugares --radio` compara en unidades, no en km (hoy `kmPorUnidad` = 1); `_ficha_celda` con un `x` sin uso y `GEOJSON` sin uso en `banco.py`.

## Pendientes leves de la revisión de las tandas 107-108 (fase 1, 2026-11-10)

- `sucesos.ts` `esDelReinoPropio`: un suceso de importancia 4 con el Reino propio y una aliada como actores recibe el TESTIGO y ya no da la noticia ALIADA en «El mundo»; además hace un `faction.count` por suceso menor.
- `dailyTick.ts`: el aviso P381 corre antes que las órdenes de cocina (lotes que no entran en el balance): puede avisar un día antes. `avisoDeReserva` repite el aviso si el balance oscila en torno a 0.
- `narrador.ts` respaldo de combate (P435): en combate sin tirada dice «Aún no se ha resuelto ningún intercambio» también al huir u hablar.
- `/mundo/nuevas` (`log.ts:67`) pagina por `createdAt` y el worldLog se ordena con `ORDEN_LOG` (ya apuntado en el lote D).
- `diarioFecha.ts` duplica `DIAS_POR_ESTACION` del backend y recalcula `diaAbsoluto`; las pestañas de día del Diario repiten «de Verano, año 1».
- Clemente devuelve siempre `factionRepChange: null` (P270): el campo y su rama del frontend ya no se usan.

## Pendientes leves de la revisión del lote G4 (2026-11-11)

- `prepararAvance.ts#reponerZonaActual` recalcula siempre; el juego, al abrir el mapa, solo con FAUNA sin `lastUpdated` o en zonas de inicio (`zona.ts:317`). Usa `currentLocation`, no el destino de un viaje en curso, y `avanzarDias` dice «Fauna de X repuesta» aunque no haya puntos.
- `prepararEdificios.ts#textoSinReparar` repite cifras y podría decir «faltan 0» en una carrera.
- `interactuar.js`: el `dialog` puede casar con el propio mapa de zona; los mensajes nuevos de `interactuar.js`/`mover.js` y que `avanzar` repone la fauna no están en `rondas-de-pruebas.md`.
- P383: `t56-reino-dia75` sigue con 11 de 12 edificios dañados (documentado; para asaltos, `t68`).

## Pendientes leves de la revisión del bloque P461-P463 (2026-11-14)

- `death.ts`: la acción de despawn se aplica copiada en `turnResolution.applyCondicionTimeouts` y `companionSupervivencia.advanceCorpseAndRecoveryTimeouts`; mejor un helper que la aplique entera.
- Huida (`session.ts` ~247/372): `descubrirNpcsDelCombate` + `descubrirNpc` por `freshSlugs` repiten upserts; `descubrirSiConvaleciente` hace un `findUnique` extra por escritura y `combateDesde` descubre en serie.
- `zona.ts` ~1038: el `sort` de `puntosVivos` recalcula `celdaDePixel`/`hypot` en cada comparación.
- `useCombatFlow.ts` ~1023: `closeCombat` aplica el intercambio antes de `cancelarTiradasPendientes()` (posible doble aplicación, sin verificar).
- `useMovimientoZona.ts` ~93: ternario sobrante alrededor de `moverEnZona`; `interactuar.js`: `todos.count()` dos veces.
- `turn.integration.test.ts` «despiece SÍ da algo» (caza en grupo) en rojo también en `main` (`19d8c523`): sin mirar.

## Pendientes leves de la fase 3 de los lotes F-I (2026-11-11)

- `tools/qa/plan.py` toma como tanda o lote cualquier fila de tabla del plan cuya primera celda sea un número o una sola mayúscula, sea de la tabla que sea.
- `dailyTick.ts` (P444): con el Ayuntamiento de territoryId null, o con su territorio ya PERDIDO antes, los de su región no caen nunca en una rebelión (el comentario ya lo dice; decidir si es lo querido).

## Pendientes leves de la fase 3 de `claude/narrador-tiempos` (2026-11-14)

- `tools/roadmap/resolver-conflicto.py`: busca los marcadores por texto exacto (no respeta `conflict-marker-size`, y un subrayado setext `=======` dentro de un trozo se toma por separador).
- `resolver-conflicto.py` y `tools/qa/resolver_hallazgos.py`: dos parsers de marcadores con reglas distintas; unificar.
- `resolver-conflicto.py` es manual (hay que acordarse tras `git merge origin/main`): valorar un driver `merge=roadmap` en `.gitattributes`, que además tendría la base.
- `.gitattributes` `merge=union` del ledger no deduplica: un registro idéntico en los dos lados (cherry-pick) queda dos veces y `metrics.py` lo cuenta doble.

## Pendientes leves de la fase 3 de `claude/wonderful-volta-662qt8` (2026-11-15)

- GET `/defensa`: `asaltosRecientes` se lee fuera de la transacción del resto de la respuesta.
- `tools/qa/aviso-lectura.py` (`QA-349`): no avisa de las lecturas enteras con Grep ni con `jq`, `wc` o `node`.

## Pendiente

Los pendientes leves de revisiones ya cerradas están en [`pendientes-leves.md`](pendientes-leves.md) (`QA-342`); el del PR en curso (`QA-289`), abajo.

Del PR de `QA-289`, revisión de bloque (2026-11-14):

- La réplica anterior que ve el NPC (`ultimaReplica(lastNarration)`, `turnResolution.ts`) puede ser de otro NPC.
- `retrieval.ts`: `SELECT DISTINCT title` y la consulta de filas directas, en serie en cada turno; cachear los títulos por mundo y lanzarlas en paralelo.
- `narrador.ts`: `console.warn('[lint] campo-accion …')` en cada turno sin fallo.
- Escapado de regex y normalización sin tildes repetidos (`escapar`, `contieneNombre`, `normalizar`…); usar `escapeForRegex` y `normalizeText`.
- Altura: la «una voz por llamada» es una cadena de parches de regex sobre la narración; valorar el gesto del NPC como campo del JSON.
- Si `generateNpcReply` lanza excepción, el `catch` sigue sin réplica de respaldo; `quitarFrasesRepetidas` une con espacio y pierde los párrafos si quita una frase.

## Actualización del flujo a v0.7.0 (`claude/wonderful-volta-662qt8`, 2026-11-16)

- ~~`test_measure.py` (parche P24): `StopIteration` sin ruta~~ ✅ 2026-11-18 (`QA-511`): ahora `FileNotFoundError` con las rutas buscadas.

## QA-353 (`claude/ronda-local-2`, 2026-11-16)

- `vigilante-memoria.sh`: con MemAvailable ilegible `desde` no se reinicia (la racha previa se hereda al volver la lectura) y, tras suspender la Deck, `SECONDS` salta y una racha abierta antes de dormir dispara la alerta al despertar.
- `vigilante-memoria.sh`: la ventana de 30 s es fija; un `escenario.sh cargar` que dure más de 30 s por debajo de 1500 MiB para la ronda en mitad de la carga (`VENTANA_S` la sube a mano).
- `ia-ronda.sh estado`: avisa «FALTA el vigilante» con cualquier Ollama en :11434, también el de otra rama (GVE, imágenes), que no es de la ronda; visto en la Deck, 2026-11-16.

## Sesión de arreglos de la ronda local 2 (`claude/ronda-local-2`, 2026-11-16)

- QA-354, `detectsUnknownConstructionClaim`: «se levanta una empalizada» (impersonal) ya no cuenta como construir.
- QA-355, `hasFalseCombatAttacker`: el golpe con el jugador detrás del verbo («un tajo certero de Gorhorn abre…») ya no se rechaza; tampoco «Gorhorn mira. El orco golpea a Gorhorn» se libra (como antes).
- P474, `hasPlayerLineAddressedToPlayer`: «Gorhorn escucha a Ulkha: «Tus clanes cayeron, Gorhorn»» (la oración empieza por el jugador, pero habla el NPC) se rechaza de más; solo cuesta un reintento.

## Pendientes leves de la revisión de bloque de la ronda local 2 (2026-11-19)

- `npcScene.ts` P479 (~358): un PRINCIPAL ya conocido se reconoce por la primera palabra de su nombre (≥4 letras): si es un título o palabra común («Vieja Ulma», «Hermano X»), «busco a la vieja del pozo» lo mete en escena; un nombre de pila de menos de 4 letras («Kor») nunca casa.

## Pendientes leves de la revisión de bloque de la ronda local 2 (2026-11-20)

Los dos de `iaRegistro.ts`, cerrados con ~~`QA-520`~~ ✅ 2026-11-20.

- `iniciar-tarkor.sh`, `actualizar-mundo.sh`, `generar-dataset-dpo.sh`: Ollama fijo en `~/ollama-bin` sin respaldo a `~/.local/ollama` (como hace `ia-ronda.sh`) y `docs/arquitectura/04-decisiones-tecnicas.md:154` sigue con la ruta vieja.

## Pendientes leves de la revisión de bloque de la ronda local 3 (2026-11-20)

- `iaRegistro.ts` (`ventanaDeLinea`, ~177-191): con la cola cortada a mitad de línea, `prefijo_linea` da la línea vieja entera con `−` (no solo lo que se fue); `'X\nB'` → `'\nB'` da `''` (el test qa520-c lo fija) en vez de `−X`; y la ventana puede partir un par sustituto UTF-16.

## Pendientes leves de la revisión de bloque de QA-531 (2026-11-26)

- `narrador.ts` `JSON_LEAK_REGEX` (~2384): no casa `hitoMotivo"` (la alternativa `hito` pide `"` justo detrás); si el modelo escribe `"hitoMotivo": …` en `narration` sin otra clave antes, `stripLeakedJson` no lo corta. Arreglo: `hito(?:Motivo)?` y un caso en su test.

## Pendientes leves de la revisión de bloque de QA-523 (2026-11-27)

- `worldFacts.ts` (~167): la dimensión 1024 no se valida; con `OLLAMA_MODEL_EMBEDDINGS` de otro tamaño, el re-embebido falla en cada arranque y `appendSessionFacts` lanza en cada turno con hechos nuevos. Arreglo: comprobar `vector.length === 1024` en un solo punto, con un error que nombre la variable.
- `server.ts` (~109): el re-embebido de todas las partidas arranca a la vez que el precalentamiento y comparte `embedQueue` con el RAG; contamina la medición de `QA-523` (cada instantánea anterior a la migración vuelve a vaciar los vectores): medir tras el log «Re-embebidos N hechos».
