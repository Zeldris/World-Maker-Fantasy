# Mapa del agente (`QA-108`)

Por dónde entrar al código de cada sistema sin explorar: funciones de entrada, tests, tablas, cómo llegar en la
interfaz y trampas ya conocidas. Las referencias van como `` `ruta#función` `` (nombre, no línea, para que no
caduquen); `python3 tools/qa/mapa-agente.py` comprueba en el CI que cada una existe. Rutas desde la raíz del repo;
`b/` = `backend/src/`, `f/` = `frontend/src/`.

**Cómo usarlo:** busca el sistema, abre solo lo que nombra y lee la función con `grep -n` + `sed -n`, no el
archivo entero (los grandes pasan de 2.000 líneas). Si algo de aquí ya no es cierto o falta un punto de entrada
que has tenido que buscar, **corrígelo en el mismo commit**.

## Qué no leer

- `docs/archivo/`, `docs/borradores-opencode/`, `tools/playwright-e2e/historico/`: historia, no el estado actual.
- `docs/registros/checklist-pruebas-juego.md` y los `retro-*.md`: registros cerrados; la matriz
  (`docs/registros/matriz-pruebas.md`) dice qué falta probar.
- `docs/rpgtarkor/`: lore; solo cuando la tarea es de lore, y nunca se edita a mano (`AGENTS.md`).
- `b/services/turnResolution.ts` entero (7.400 líneas): busca la sección (abajo) con `grep -n`.
- El registro `.jsonl` de la sesión: se mide con `.claude/skills/opt-tokens/scripts/medir.py`.

## Comandos

| Para | Dónde |
|---|---|
| Jugar (arrancar, driver, `estado.js`, `pulsar.js`, escenarios, recorridos) | [rondas-de-pruebas.md](runbooks/rondas-de-pruebas.md) |
| Qué falta probar de un bloque | `python3 tools/qa/matriz-pruebas.py --bloque <Bloque>` |
| Mirar datos de la partida | SQL contra `tarkor_juego` ([rondas-de-pruebas.md](runbooks/rondas-de-pruebas.md)) |
| Añadir contenido (objeto, NPC, fauna, flora, habilidad, ubicación) | [nuevo-elemento-catalogo.md](runbooks/nuevo-elemento-catalogo.md) y [puntos-de-codigo-nuevo-contenido.md](runbooks/puntos-de-codigo-nuevo-contenido.md) |
| Skills y modelo de cada tarea, flujo de PR | [skills-y-modelos.md](runbooks/skills-y-modelos.md) |
| Fusionar la rama de un subagente (merge, conflictos de hallazgos, tests del paquete) | `tools/qa/fusionar.sh <rama> "<mensaje>"` (`QA-135`) |
| Medir la IA local de una tanda, evaluar el RAG | `/opt-ai` (registro con `IA_REGISTRO`/`IA_PERFIL`, `npm run rag-eval`, [formato](ia/opt-ai-registro.md)) |
| Tests de un archivo | `cd backend && npx vitest run <ruta>` (filtra con `grep -E "Test Files\|Tests \|FAIL"`) |

## Datos que se confunden

- El reino de la jugadora es la `Faction` con `saveId` y `origenSlug: null`. Sus cifras están en `KingdomStats`
  (`comida`, `bebida`, `felicidad`…); «Almacén comida 60 · agua 60» en la interfaz es el **tope**, no lo guardado.
- El catálogo es `ItemCatalog` (no `CatalogItem`); los objetos de la jugadora, `InventoryItem`; los del reino, `AlmacenItem`.
- `Save` no tiene `updatedAt`: la última partida jugada sale del último `LogEntry`.
- `LogEntry.channel` es `CHARACTER` (diario) o `KINGDOM` (registro del reino); `entityBannerSlug`/`entityBannerType`
  dan la ficha que sale con la línea.
- Lo que existe en una partida: `ZonePoint` (fichas del mapa de zona), `Npc`+`NpcState`, `Location` (zonas y la
  capital `ayuntamiento-interior-<saveId>`, con sus `Parcela`).

## Turno y narrador

- **Código:** la ruta `b/routes/turn.ts` (`/turn/classify`, `/turn/narrate`) llama a
  `b/services/turnResolution.ts#narrateAndPersistTurn`, que lo hace todo en línea. Secciones (busca con `grep -n`):
  `resolveBuildIntentContext` (construir), `narration.newTerritory` (fundar), `decideOfertaModoDinamico` (oferta de
  encuentro al pasar el turno), `resolveCombatExchangePhase` (golpe en combate). Narrador:
  `b/services/narrador.ts#classifyAction`, `narrateAction`, `buildNarrationPrompt`, `generateSuggestions`
  (con sus filtros `dropSuggestions*`), `deterministicFallbackNarration`.
- **IA y RAG:** llamadas al modelo local en `b/lib/ollama.ts#ollamaGenerate`, `ollamaGenerateStream` (opción `tarea`),
  embeddings en `b/lib/embeddings.ts#embed`, lore en `b/services/retrieval.ts#retrieveLore`; cada llamada se apunta
  con `b/lib/iaRegistro.ts` si está `IA_REGISTRO`. Casos del RAG: `backend/ia/rag-casos.jsonl`.
- **Tests:** `b/services/turnLock.test.ts`, `b/services/narrador*.test.ts`.
- **Interfaz:** `f/hooks/useTurnFlow.ts#useTurnFlow`, `f/components/ChatComposer.tsx` (escribir y «Actuar»),
  `f/components/LogPanel.tsx` (diario).
- **Trampas:** el modelo real no está en la nube; corre el Ollama simulado (`tools/ci/mock-ollama.mjs`), así que
  la narración es de plantilla. Las decisiones de verdad (tiradas, costes, efectos) son deterministas y van antes
  de narrar.

## Prompt del narrador (`QA-172`)

- **Orden de bloques** de `b/services/narrador.ts#buildNarrationPrompt` (fijo primero, para la caché de prompt de
  Ollama, `QA-165`): `GOOD_NARRATION_EXAMPLE`, `fixedInstructions` (idéntico en todos los turnos), PERSONAJE
  (`identidad`), HECHOS DEL MUNDO (`hechosBlock`, luego `estadoPartida`, `narracionAnterior`, `backgroundLoreBlock`
  con el lore del RAG), `groundingBlock`, `rollBlock`, `combatBlock`, `lengthGuidance` y la acción del jugador.
- **Intentos** en `b/services/narrador.ts#narrateAction`: `attempt1` (narrador, `maxTokens` 300, 90 s);
  si se rechaza, `attempt2` (narrador, `retryPrompt` con `retryFacts`: solo los hechos críticos, `maxTokens`
  400); si también, `attempt3` (cronista, mismo `retryPrompt`, tarea `narrar_respaldo`); si todo falla,
  `deterministicFallbackNarration`. El registro los marca con `app.intento` 1/2/3 (`QA-162`).
- **Modelo, `num_ctx` y `keep_alive` por tarea** (en Ollama son del modelo cargado: se alinean en todas sus llamadas,
  `QA-170`):

  | Tarea | Modelo (`env.…`) | `num_ctx` | `keep_alive` | Dónde |
  |---|---|---|---|---|
  | `narrar`, `dialogo_npc`, `resumen`, `combate`, `modo_dinamico` | `ollamaModelNarrador` | el del Modelfile (8192) | `1h` | `narrador.ts`, `chapterSummary.ts`, `combateMultipleNarracion.ts`, `dynamicModeNarracion.ts` |
  | `clasificar`, `narrar_respaldo` | `ollamaModelCronista` | `CTX_CRONISTA` (8192) | `5m` | `narrador.ts` (`classifyAction`, `attempt3`) |
  | `prompts_imagen` (solo si fallan las nubes) | `ollamaModelCronista` | el del modelo | `OLLAMA_KEEP_ALIVE` (5m) | `b/lib/aiProviders/orchestrator.ts` |
  | `sugerir` | `ollamaModelSugerencias` | el del modelo | `0` | `narrador.ts` (`generateSuggestions`) |
  | embeddings del RAG | `ollamaModelEmbeddings` | el del modelo | `OLLAMA_KEEP_ALIVE` | `b/lib/embeddings.ts` |

- **Medirlo:** `bash tools/qa/bench-ia.sh <etiqueta> --anterior <etiqueta>` (`QA-173`); las cifras, en
  `docs/ia/opt-ai-registro.md`.

## Mapa de zona y encuentros

- **Código:** `b/routes/saves/zona.ts` (`GET /saves/:id/zona`, `POST …/zona/mover`, `…/zona/cazar`); dentro,
  `b/routes/saves/zona.ts#detectarEncuentroEnCelda` decide el encuentro al pisar una celda (la rama de recurso usa
  `b/services/murosZona.ts#alcanzableDesde`). Movimiento: `b/services/zonaPosicion.ts#calcularCamino`,
  `moverJugadorA`, `quienIniciaEncuentro`; las fichas avanzan con `b/services/zonePoints.ts#avanzarZonePointsUnPaso`
  y `b/services/movementTemplates.ts#siguienteCeldaDeZonePoint`; muros con `b/services/murosZona.ts#murosDe` e
  `interiorDe`. Qué fichas hay: `b/services/zonePoints.ts#asegurarZonePointsDePartida`, `recalcularZonePointsDeLocation`.
- **Oferta (la tarjeta del encuentro):** nombre y frase en `b/services/dynamicMode.ts#decideOfertaModoDinamico`,
  `quienEnAviso`, `nombreVisibleDeNpc`, `conDefinido`, `conIndefinido`, `pluralDeEspecie` y
  `b/services/ofertaNombre.ts#nombrarOferta`. Responder:
  `b/routes/saves/dynamicMode.ts` (`/modo-dinamico/responder`, `/ignorar`) y `dynamicModeRecurso.ts`.
- **Nombre de un NPC sin descubrir en la escena (narración, combate):** `b/services/npcScene.ts#conNombreVisible`
  (pone `NpcInScene.nombreVisible`) y `nombreNarrado`; el combate múltiple, en `combateMultipleOrquestacion.ts#datosVivosDe`.
- **Campos de la oferta** (`quien`, `aQuien`, `deBando`): se rellenan en
  `b/routes/saves/zona.ts#detectarEncuentroEnCelda` y en el turno; los lee `b/services/dynamicMode.ts#quienEnAviso`.
- **Tests:** `b/routes/saves/zona*.integration.test.ts`, `b/services/zonaPosicion.test.ts`, `zonePoints*.test.ts`,
  `murosZona.test.ts`, `dynamicMode*.test.ts`, `ofertaNombre.integration.test.ts`; frontend
  `f/components/zona/*.test.tsx`, `f/lib/ofertaModoDinamico.test.ts`, `f/hooks/useMovimientoZona.test.ts`.
- **Datos:** `ZonePoint` (posición, plantilla de movimiento, facción, cantidad), `Location`, `LocationLink`.
- **Interfaz:** `f/components/panels/ZonaPanel.tsx`; tarjeta `f/components/zona/MenuFicha.tsx#TarjetaEncuentro`
  con `f/lib/ofertaModoDinamico.ts#presentacionOferta` y `altoDeTarjeta`; ruta prevista
  `f/lib/zonaRuta.ts#rutaPrevista`, `riesgoDeRuta`; mover `f/hooks/useMovimientoZona.ts#useMovimientoZona`.
  Test ids: `cuadricula`, `jugador-zona`, `tarjeta-ficha`, `encuentro-en-mapa`, `bandera-destino`, `coste-ruta`,
  `radio-amenaza`, `ruta-en-riesgo`.
- **Trampas:** la oferta se construye en **dos sitios** (colisión en `zona.ts` y la ambiental del turno en
  `turnResolution.ts`): un cambio de texto va en los dos. `calcularCamino` existe en backend y en
  `f/lib/zonaRuta.ts`: tienen que dar lo mismo. Distancias en pasos (celdas), no en píxeles (P194).

## Combate

- **Código:** `b/services/combateMultipleOrquestacion.ts#iniciarCombatEncounter`, `resolverTurnoJugador`,
  `resolverTurnoAutonomo`, `resolverTurnosAutonomosHastaJugadora`, `esAtacanteDeMasPermitido` (máximo 2 atacantes
  sobre uno), `topeDeRondaJugadora`; tiradas en `b/services/combatExchange.ts#resolveExchange`, `rollInitiative`;
  salud y muerte en `b/services/death.ts#resolveDeathOutcome`, `nextCondicionForAttack`. Rutas:
  `b/routes/saves/session.ts` (`/combat/flee`, `/combat/cerrar`, `/combat/matar/:npcSlug`), `combatGroups.ts`.
- **Tests:** `b/services/combateMultiple*.test.ts`, `combatExchange.test.ts`, `combatePersonas*.test.ts`,
  `b/routes/saves/session.*.integration.test.ts`; frontend `f/components/CombatPanel.test.tsx`,
  `f/hooks/useCombatFlow.test.tsx`.
- **Datos:** `CombatEncounter`, `CombatParticipant`, `CombatGroup`.
- **Interfaz:** `f/components/CombatPanel.tsx`, `f/hooks/useCombatFlow.ts#useCombatFlow`; test id `combate-usables`.
- **Trampas:** `dueloYaResueltoPorElOtro` nunca da por resuelto el duelo de la JUGADORA (P192).

## Reino y construcción

- **Código:** fundar: `POST /saves/:id/reino/fundar` en `b/routes/saves/reino.ts` y la sección
  `narration.newTerritory` del turno. Recetas y costes: `b/services/construction.ts#checkRecipe`,
  `planDeterministicBuild`, `computeBuildBlockedReason`, `detectsBuildIntent`. Edificios en el mapa:
  `b/services/fichaEdificio.ts#fichaDeEdificio`, `encargadoDe`; rutas `b/routes/saves/edificios.ts`,
  `parcelas.ts`. Día a día: `b/services/kingdomTick.ts#tickKingdomOneDay`, `b/services/dailyTick.ts#runDailyTick`,
  economía `b/services/cronista/economiaReino.ts`. Defensa `b/services/defensaReino.ts#defensaVista`; bandidos
  `b/services/campamentos.ts#lanzarAsaltosAlReino`; guerra `b/services/guerraReino.ts`.
- **Tests:** `b/services/construction.test.ts`, `kingdomTick.test.ts`, `kingdomProduction.test.ts`,
  `defensaReino.integration.test.ts`, `b/routes/saves/reino*.test.ts`, `edificios.integration.test.ts`,
  `parcelas.integration.test.ts`; frontend `f/components/panels/reino/*.test.tsx`.
- **Datos:** `Faction` (el reino, ver arriba), `KingdomStats`, `Territory`, `Building`, `Parcela`, `AlmacenItem`,
  `AlmacenLimite`, `OrdenProduccion`, `Subject`.
- **Interfaz:** fundar: cajón Habilidades › pestaña Reino › «Fundar ayuntamiento» rellena el compositor › Actuar ›
  modal «Fundación de reino» (`f/components/KingdomFoundingModal.tsx`) › mantener «Mantén para fundar». La capital
  se entra por la salida de la zona; la choza se construye en una «Parcela vacía»
  (`f/components/ParcelaDetailModal.tsx`), no desde Habilidades. Panel: `f/components/panels/ReinoPanel.tsx` y sus
  secciones en `f/components/panels/reino/`; estado `f/hooks/useKingdomState.ts#useKingdomState`.
- **Trampas:** recetas actuales: ayuntamiento piedra 14, madera 6, hueso 6, resina 8, mena 2, fibras 8; choza piel
  10, `hueso-largo-gargantua` 6, `cuerda-tendon` 4 (para dar materiales: `tools/qa/escenario.sh dar`). El registro
  del reino se refresca al levantar o mejorar el campamento o el ayuntamiento (`useTurnFlow#hitoDeReinoNuevo`, P209);
  las demás entradas KINGDOM (súbditos, caravanas, tick diario) llegan al recargar.

## Súbditos y llegadas

- **Código:** `b/services/cronista/llegadas.ts#revisarLlegadas`, `motivoSinLlegada`, `responderLlegada`;
  `b/services/cronista/subditos.ts#crearSubdito`, `avanzarSubditos`, `cupoDeCamas`, `felicidadHacia`. Rutas en
  `b/routes/saves/companeros.ts` (`/subditos`, `/subditos/:subjectId/llegada`, `/subjects/:subjectId/rol`, `…/tarea`).
- **Tests:** `b/services/cronista/llegadas.integration.test.ts`, `subditos.integration.test.ts`; `f/lib/llegadas.test.ts`,
  `f/components/panels/reino/SubditosSection.test.tsx`.
- **Datos:** `Subject`, `KingdomStats`.
- **Interfaz:** panel Reino › Súbditos (`f/components/panels/reino/SubditosSection.tsx`).
- **Trampas:** una llegada pide cama libre, `comida` > 0, `bebida` > 0 y `felicidad` ≥ 40 en `KingdomStats`; para
  provocarla, `tools/qa/escenario.sh avanzar <partida> <días>` tras dejar comida y agua.

## Cronista (mundo vivo, sucesos, misiones)

- **Código:** avance del mundo `b/services/avanceDiario.ts#avanzarMundoHasta`, `registrarAvanceTrasAcciones`;
  sucesos `b/services/cronista/sucesos.ts#registrarSuceso` y efectos `b/services/cronista/efectos.ts#aplicarEfectos`.
  Misiones: `b/services/cronista/generarMisiones.ts#renovarTablones`, `ofrecerTrabajoDeNpc`;
  `b/services/cronista/misiones.ts#textoDeMision`, `bando`; quién encarga
  `b/services/cronista/quienEncarga.ts#conQuienVisible`, `conQuienVisibleEnLote`; reputación por coger lo ajeno
  `b/services/cronista/testigos.ts#aprovecharseDeLoAjeno`. Rutas `b/routes/saves/misiones.ts` (tablones, aceptar,
  entregar, abandonar). Mundo por partida: `b/services/mundoPartida.ts#asegurarMundoDePartida`.
- **Tests:** uno por módulo junto a él en `b/services/cronista/` (`*.integration.test.ts` con base real);
  `simulacion60.integration.test.ts` simula 60 días.
- **Datos:** `Suceso`, `SucesoCausa`, `SucesoActor`, `Consecuencia`, `Conocimiento`, `Recuerdo`, `Hilo`,
  `MisionOfrecida`, `Quest`, `Etiqueta`, `Linaje`.
- **Interfaz:** `f/components/panels/MisionesPanel.tsx`, `LeyendasPanel.tsx`, `HistoriasEnMarcha.tsx`.
- **Trampas:** el diseño está en [roadmap-cronista.md](producto/roadmap-cronista.md) y
  [22-mundo-vivo-x4-tecnico.md](arquitectura/22-mundo-vivo-x4-tecnico.md); léelos solo si cambias reglas.

## Caza, recolección y fauna

- **Código:** `b/services/caza.ts#iniciarCaza`, `groupVarianceDiario`, `descontarZonePointCaza`; recolectar
  `b/routes/saves/recolectar.ts`; capturar y domar `b/routes/saves/companeros.ts` (`/capturar/:npcSlug`); ganado
  `b/routes/saves/ganado.ts` y `b/services/cronista/ganadoReino.ts`.
  Cazar la fauna de la escena sin punto (P307): `zona/cazar` con `{ targetSlug }` → `b/services/zonePoints.ts#puntoDeFaunaDeEscena`.
- **Tests:** `b/services/caza.integration.test.ts`, `cazaRiesgo.test.ts`, `partidasCaza.integration.test.ts`,
  `b/routes/saves/recolectar*.test.ts`, `zonaCazar.integration.test.ts`, `ganado*.integration.test.ts`.
- **Datos:** `ZonePoint` (cantidad), `HarvestYield`, `Ganado`, `Companion`.
- **Interfaz:** `f/components/HarvestSelectionModal.tsx`, `f/components/TameoModal.tsx`,
  `f/components/panels/reino/CorralesSection.tsx`.
- **Trampas:** cazar ganado ajeno resta reputación (`REP_CAZAR_GANADO_AJENO` −100, `REP_COGER_LO_AJENO` −50, en
  `b/services/cronista/testigos.ts`).

## Catálogo y siembra

- **Código:** datos en `b/scripts/worldCatalog.ts`; siembra `b/scripts/seed-catalog.ts` con
  `b/scripts/plantillaZonePoint.ts#datosDePlantillaZonePoint`. Para pruebas: `b/scripts/darObjetos.ts`, `b/scripts/prepararReino.ts` (súbditos, compañero NPC, guarnición, milicia, relaciones, combate; `escenario.sh preparar`), `b/scripts/darReino.ts` (comida, Goirnos, Almacén y edificios del Reino),
  `b/scripts/avanzarDias.ts` (los usa `tools/qa/escenario.sh`).
- **Trampas:** añadir contenido sigue [puntos-de-codigo-nuevo-contenido.md](runbooks/puntos-de-codigo-nuevo-contenido.md).

## Enciclopedia y lore (`QA-248`)

- **Todo lo de un slug:** `bash tools/qa/ficha.sh <slug> [--canon]` (`QA-245`) da la ficha, el despiece, la región,
  la población, las recetas, los chunks y, con `--canon`, dónde lo nombra el canon.
- **Código:** la ruta `/world/:slug/enciclopedia` de `b/routes/world.ts` monta una sección por pestaña:
  `b/routes/world.ts#buildFaunaFloraSection`, `buildItemsSection`, `buildNpcsSection`, `buildLocationsSection`,
  `buildFactionsSection`, `buildHistoriaSection`, `buildRazasSection`, `buildClassesSection` y
  `buildCraftingRecipesSection`.
- **Datos:** en `b/scripts/worldCatalog.ts`. La flora y los minerales sin NPC toman el nombre de
  `harvestSourceDisplayName` y la descripción de `harvestSourceDescriptions`. La región sale de `harvestSourceRegion`,
  que usa también `b/services/playerActionValidation.ts#detectsWrongRegionHarvestClaim`. La población está en
  `b/scripts/worldPopulation.ts`, el texto del RAG en `b/scripts/loreChunks.ts`, y los renombres de habilidades en
  `b/services/habilidadesRenombradas.ts#renombrarHabilidadesDePartida`, que se aplica al cargar la partida.
- **Tests de integridad:** `b/scripts/floraConFicha.test.ts` comprueba la ficha, la región y la población de toda
  fuente. `b/services/crafting.test.ts` comprueba que cada receta está alineada con su ficha de catálogo.
- **Interfaz:** `f/components/panels/EnciclopediaPanel.tsx`.
- **Canon:** primero el resumen de `docs/canon-opencode/` (empieza por `00-nucleo.md`); `docs/rpgtarkor/` solo para
  el detalle. Los hallazgos de cada auditoría van en `docs/registros/lore-hallazgos.md`.

## Imágenes (prompts y generación local)

- **Código:** `b/services/imagePromptGenerator.ts#generateImagePrompt` (reglas de FLUX en el prompt del sistema,
  `buildPrompt`, `REGION_ESCENA`); el contexto de lore, `b/services/imagePromptContext.ts#loreContextFor`, y los
  prompts usados como ejemplos, `b/services/imagePromptContext.ts#ejemplosDePromptsUsados`; rutas
  `/world/:slug/image-prompt` (GET y POST) e `image-prompt/usado` (PUT) en `b/routes/world.ts`.
- **Tests:** `b/services/imagePromptGenerator.test.ts`, `b/services/imagePromptContext.test.ts`,
  `f/components/ImagePromptDisplay.test.tsx`.
- **Datos:** `backend/prisma/schema.prisma#ImagePrompt` (`prompt` base y `promptUsado`, por mundo, entidad y perfil),
  base `tarkor` (la de desarrollo): `TARKOR_DB_URL=postgresql://tarkor:tarkor@localhost:5432/tarkor tools/qa/sql.sh`.
- **Interfaz:** `f/components/ImagePromptDisplay.tsx` (enciclopedia, modo desarrollador). Tras editar el backend,
  `bash tools/qa/backend-dev.sh` (`tsx watch` no ve los cambios del sandbox).
- **Generar en la Deck:** `image-generator/scripts/probar.sh` (con el prompt de la base) y `generar.sh` (el tercer
  argumento es la ruta de un archivo de prompt); todo por elemento en `image-generator/generated/<tipo>/<slug>/`
  (`intentos/`, `prompts/`, `logs/`, `registro.tsv`, `notas.md`, `elegidas.tsv`), fuera de git.
- **Interfaz del generador (`CFG-43`):** la abre `image-generator/abrir.sh` (127.0.0.1:7861). Servidor,
  `image-generator/interfaz/servidor.py`: `catalogo` (la enciclopedia con lo anidado y los enums de clase),
  `elementos` (la lista), `Trabajo.lanzar` (una imagen a la vez), `leer_progreso`, `elegir`. Página,
  `image-generator/interfaz/index.html`: `elegirElemento`, `traerPrompt`, `pintarGaleria`. Para ver la lista o el
  progreso sin captura: `python3 image-generator/interfaz/resumen.py [--tipo <tipo>]`. Test:
  `python3 -m unittest discover -s tools/qa/tests -p test_interfaz_imagenes.py`.
- **Bocetos por plan corporal (`IMG-24`):** `image-generator/bocetos/plantilla.py#componer` (el SVG desde un plan y
  sus números, escalado al lienzo 1280x512) y `#validar` (cada valor malo, con su motivo); los planes y sus parámetros,
  `python3 image-generator/bocetos/plantilla.py --planes`; `image-generator/bocetos/rasterizar.sh` (fichas con
  `boceto.plan`, `--planes` o un plan) deja los PNG junto al SVG. Test: `tools/qa/tests/test_bocetos.py`.
- **Banco de calidad (`IMG-15`):** `docs/producto/plan-imagenes/banco.sh <ronda>` (un TSV por ronda en `banco/`,
  resultados en `banco/resultados.md`); para mirar una ronda, `bash docs/producto/plan-imagenes/hoja.sh <prefijo>` (hojas de
  contactos de 6 con la leyenda en texto, `QA-249`), y solo la finalista a tamaño completo.
- **Documento:** `docs/arquitectura/reutilizables/01-generacion-imagenes-local.md`; lee solo su apartado
  («Cómo escribir los prompts», «Parámetros recomendados», «Banco del múrgol») con `grep -n '^## '` + `sed -n`.

## Voces y sonidos (generación local, `QA-241`)

En pausa hasta traer el repo aparte de la usuaria (`VOZ-6`); al traerlo, esta sección se rehace con lo que llegue.

- **Scripts:** `voice-generator/scripts/`; cada uno dice su uso en las tres primeras líneas (`sed -n 2,4p`).
  `instalar.sh` (motor y modelos), `banco.sh` (tiempos por modelo y dispositivo), `disenar.sh` (tomas desde la
  ficha), `fijar.sh` (referencia, `.spk` y `.rvq`), `producir.sh` (frases), `escuchar.sh` (efectos de la raza con
  SoX), `fauna.sh` (sonidos de una especie). Lo común, en `voice-generator/scripts/comun.sh#lanzar` (segundo plano
  con tope de tiempo y de memoria), `voice-generator/scripts/comun.sh#memoria_inicial` y
  `voice-generator/scripts/comun.sh#una_a_la_vez`.
- **Fichas:** `voice-generator/voces/<raza>/<voz>/v1/diseno.json` y `voice-generator/voces/<raza>/efectos.json`;
  `voice-generator/fauna/<especie>/cadena.json`. Las valida `voice-generator/scripts/voces.py#errores_ficha` (deriva
  infantil) y `voice-generator/scripts/voces.py#errores_cadena`; `python3 voice-generator/scripts/voces.py comprobar`
  las mira todas (también `instruct`, `texto`, `semilla`, `sox` sobre una). Test:
  `python3 -m unittest discover -s tools/qa/tests -p test_voces.py`.
- **Documento:** `docs/arquitectura/reutilizables/02-voces-y-sonidos-locales.md`; lee solo su apartado («Diseñar la
  voz de una raza», «Fauna y criaturas», «Acoplamiento a Tarkor») con `grep -n '^## '` + `sed -n`. Tareas,
  `docs/producto/roadmap-voces.md`.
