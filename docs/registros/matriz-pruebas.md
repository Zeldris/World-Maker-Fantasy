# Matriz de cobertura de las pruebas jugando (`QA-101`)

Una fila por tarea cerrada de los hitos `0.0`…`0.3` (las `QA` no). La genera y la comprueba
`tools/qa/matriz-pruebas.py`; el estado y la prueba se editan a mano al jugar. Estados: **jugado** (con fecha y
hallazgo o recorrido en «Prueba»), **solo tests**, **sin jugar**, **no se juega** (con el porqué). Una ronda
coge un bloque y lo deja en «jugado» (`QA-105`, [runbook](../runbooks/rondas-de-pruebas.md)).

| Tarea | Bloque | Qué | Estado | Prueba |
|---|---|---|---|---|
| `CFG-1` | Configuración | Botón ⚙️ fijo | jugado | QA-27 (2026-10-09…17) |
| `CFG-2` | Configuración | `Esc` abre el menú | jugado | QA-27 (2026-10-09…17), Esc → pausa |
| `CFG-3` | Configuración | Menú de pausa | jugado | QA-27 (2026-10-09…17) |
| `CFG-4` | Configuración | Panel de configuración | jugado | 6 pestañas, Restablecer/Cancelar/Aplicar; Restablecer devuelve todo (también el ritmo del servidor) |
| `CFG-5` | Configuración | Persistencia | jugado | tras recargar siguen narración, animaciones, contraste y atajo |
| `CFG-6` | Configuración | `SettingsContext` | no se juega | contexto interno; se ve por CFG-4/5 |
| `CFG-13` | Configuración | Tamaño y tipografía de la narración | jugado | Grande + Serif: narración 14→16 px, Georgia |
| `CFG-14` | Configuración | Animaciones | jugado | Reducidas: data-motion y animaciones a none |
| `CFG-26` | Configuración | Atajos de teclado reasignables | jugado | Leyendas Y→U: U abre Leyendas, Y ya no; vuelve a Y al restablecer |
| `CFG-28` | Configuración | Alto contraste | jugado | data-contrast=alto; P227 (lang=en) pendiente |
| `CFG-34` | Configuración | Estilo del mundo | jugado | Caótico se guarda en /ritmo (CAOTICO) |
| `CFG-35` | Configuración | Avisos de sucesos | jugado | Solo graves: noticia NORMAL y GRAVE en El mundo, solo la GRAVE da aviso |
| `INT-1` | Cronista en la interfaz | Familias de sucesos con identidad propia | jugado | 2026-10-19: Leyendas con 5 familias, cada una con icono y color propios (Diplomacia, Tus hechos, Facciones, Tu Reino, Crónica); el filtro Diplomacia deja solo sus 6 entradas |
| `INT-2` | Cronista en la interfaz | Importancia visible | jugado | 2026-10-19: tres niveles (NORMAL sin borde, DESTACADO con borde, GRAVE con borde rojo y sello: «Gorhorn muere», «funda el reino») |
| `INT-3` | Cronista en la interfaz | Causas enlazadas | jugado | 2026-10-19: «Por qué pasó: Día 1 Gorhorn funda el reino…» en «Fundador» lleva a la causa y la resalta |
| `INT-4` | Cronista en la interfaz | Lo desconocido se ve como desconocido | jugado | 2026-10-19: de 119 sucesos de la partida, `/leyendas` da solo los 18 de `Conocimiento`; el rumor llega sin lugar, fecha ni actores («Rumor · lo supiste el día 10 · De oídas») |
| `INT-9` | Cronista en la interfaz | Rumor con lugar | jugado | 2026-10-19: 📜 sobre El Margen Silencioso en el mapa de Berig; al pulsar la región, su tarjeta enseña el rumor y el pergamino desaparece |
| `DAD-1` | Dados y tiradas | `key` por tirada en `TameoModal` (H18). S | jugado | Tameo: cada tirada nueva reanima los dados |
| `DAD-2` | Dados y tiradas | Veredicto de Tameo diferido a `onAllLanded` (H19), como ya hacen Recolección e | jugado | Tameo: veredicto y color tras aterrizar (~5 s) |
| `DAD-3` | Dados y tiradas | Mostrar siempre `dado + bono = total vs dificultad → Éxito/Fallo` al aterrizar (H20). S | jugado | P166 (tirada de encuentro) |
| `DAD-4` | Dados y tiradas | Nombres reales en los dos lados (personaje y rival) en vez de "Tú/el enemigo", y | jugado | P153 |
| `DAD-5` | Dados y tiradas | `scrollIntoView` solo si la tirada está fuera de la vista y el jugador no ha hecho | jugado | Tameo a 380 px: se desplaza sin scroll manual; con rueda reciente no |
| `DAD-6` | Dados y tiradas | Color propio de fallo (`danger-400`) y subir el contraste de "necesitas X". S | jugado | dado perdedor danger-400 + temblor; «necesitas» wood-400 en código |
| `BAS-1` | Interfaz | Fuentes empaquetadas | jugado | Cinzel e Inter cargan de /fonts locales; ninguna petición a Google Fonts |
| `BAS-3` | Interfaz | Foco visible y navegación | jugado | Tab recorre la pantalla con anillo de foco (contorno de 2 px + sombra) en cada parada |
| `BAS-5` | Interfaz | Partir `GameView.tsx` | no se juega | refactor de GameView |
| `BAS-7` | Interfaz | Animaciones de salida y de cambio de layout | jugado | drawer sale con drawer-down, modal con modal-out antes de desmontar, pestañas con View Transition |
| `BAS-8` | Interfaz | Librería de componentes base | no se juega | componentes base; se ven por todo |
| `BAS-9` | Interfaz | Catálogo visual | jugado | /admin/ui: chips, barra con fantasma 80→55, pestañas por teclado, fila con stepper, estados de modal (cargando, error con Reintentar, éxito), OfferCard, BotonMantener, tamaños de ModalShell y toasts |
| `HUD-6` | Interfaz | Notificaciones (toasts) | jugado | toast 📜 de noticia GRAVE con ✕, se cierra y se va solo (visto en CFG-35) |
| `HUD-12` | Interfaz | "El mundo avanza" | jugado | con la petición de noticias retrasada 5 s, la gema «El mundo avanza» se enciende de 1,4 a 6,1 s tras el turno y se apaga sola |
| `MOD-1` | Interfaz | `ModalShell` único | jugado | QA-27 (2026-10-09…17), todos los modales |
| `MOD-2` | Interfaz | Estados comunes | jugado | estados cargando/error con Reintentar/éxito en el catálogo y en el modal de Comer en partida |
| `MOD-3` | Interfaz | Teclado en modales | jugado | P202 (Escape en modales) |
| `MOD-4` | Interfaz | Modales de ceremonia | jugado | modal de clase a tamaño ceremonia; clic corto no confirma, mantener ~1 s llena la barra y fija GUERRERO |
| `MOD-5` | Interfaz | `QuantityStepper` compartido | jugado | Comer/Beber: −/+, Máx., tope «Ya estarías saciado…» en el title, número editable que se recorta al tope, rueda con foco; al beber vuelve el odre vacío. P228 (icono 🍖 en bebidas) |
| `MOD-6` | Interfaz | `EntityRow` con miniatura | jugado | sin miniatura en la ficha cae al icono; con thumbnail inyectado pinta <img> 32 px |
| `UX-1` | Interfaz | `useGamePhase` | no se juega | hook interno; se ve por UX-7/UX-8 |
| `UX-2` | Interfaz | Matriz de permisos | no se juega | tabla interna; se ve por UX-7/UX-8 |
| `UX-3` | Interfaz | Guardia en `handleSubmit` | jugado | tres Enter seguidos dan una sola TU ACCIÓN |
| `UX-4` | Interfaz | Tarjetas del registro con el estado global | jugado | QA-27 (2026-10-09…17), tarjetas del diario |
| `UX-5` | Interfaz | Paneles en modo consulta | jugado | con el narrador escribiendo, el cajón muestra «👁 Solo consulta: El narrador todavía está escribiendo.» y lo quita al terminar |
| `UX-6` | Interfaz | Un narrador a la vez | jugado | ambientación en curso (reloj adelantado 10 min): la acción la aborta (/entorno ERR_ABORTED), se quita «El mundo se mueve» y el turno responde |
| `UX-7` | Interfaz | La brújula y el mapa respetan la fase | jugado | QA-27 (2026-10-09…17), mapa bloqueado en combate |
| `UX-8` | Interfaz | Bloqueos visibles | jugado | QA-27 (2026-10-09…17), «El narrador todavía está escribiendo» |
| `UX-9` | Interfaz | Gestor de capas con prioridad | jugado | P188, P202 |
| `UX-10` | Interfaz | Decisiones en cola | jugado | partida nueva sin clase: aviso «por elegir» en cabecera ~12 s (lectura de la intro) y luego se abre el modal de clase |
| `UX-11` | Interfaz | Presentación en orden del turno | jugado | QA-27 (2026-10-09…17) |
| `UX-12` | Interfaz | Qué pasa con el cajón abierto cuando llega algo | jugado | lo importante avisa «📜 El narrador ha respondido» dentro del cajón; un combate abierto por turno no lo cierra (P232) |
| `UX-13` | Interfaz | `anyModalOpen` completo | jugado | QA-27 (2026-10-09…17) |
| `UX-16` | Interfaz | El asistente sobrevive a recargar | jugado | asistente conserva mundo y paso 3 al recargar; POST /saves en 500 → aviso con Reintentar y Volver; Reintentar crea la partida |
| `UX-24` | Interfaz | Ningún error en silencio | jugado | cambiar rol con POST forzado a 500: ErrorBanner con el detalle del backend, Reintentar aplica el cambio y el aviso se va; la carga (GET) falla en silencio (P230) y el classify cae en sondeo (P229) |
| `UX-29` | Interfaz | El mundo de fondo nunca bloquea | jugado | mientras la gema está encendida el campo de acción sigue libre (aria-disabled=false) |
| `UX-30` | Interfaz | Solo lo que el personaje sabe | jugado | 2026-10-20, Ollama real: Gistera no suelta nada de la rebelión ni de Grosh; Leyendas › Crónica solo enseña los 23 de 140 sucesos con Conocimiento, el rumor como «Rumor · lo supiste el día 10»; falla por el tooltip y «Responder», que enseñan la ficha secreta de un NPC (P260, grave), y por el Reino propio (P248) |
| `UX-31` | Interfaz | Varios días de golpe | jugado | «descansar tres días» deja un solo aviso «Mientras pasaban los días… (6 noticias)» plegable; P231: el descanso rechazado avanzó igual los días |
| `UX-35` | Interfaz | El turno no espera al día | jugado | el turno que cruzó tres días respondió en ~5 s y las noticias llegaron después |
| `UX-36` | Interfaz | Leyendas siempre a una tecla | jugado | Y abre Leyendas desde la partida |
| `UX-37` | Interfaz | Responder escribiendo | jugado | P141 (Responder escribiendo) |
| `UX-38` | Interfaz | Noticias del mundo que se pueden tocar | jugado | iconos de categoría, enlace de lugar abre su ficha, y con una oportunidad sembrada la etiqueta «📍 En Las Dunas Ahogadas · hasta el día 41» (también dentro del resumen) |
| `ZON-10` | Mapa de zona | Fichas con placa oscura + pictograma + anillo de disposición (Foundry VTT). La placa conse | jugado | P123, P147 |
| `ZON-11` | Mapa de zona | Tamaño mínimo garantizado : las fichas se dibujan a tamaño de pantalla fijo (~28 px de diá | jugado | P123 |
| `ZON-13` | Mapa de zona | Grupos legibles : insignia "×3" en píldora clara fuera de la ficha; a partir de 3, fichas | jugado | P147 |
| `ZON-14` | Mapa de zona | Ficha del personaje : retrato o inicial, anillo de cristal `accent` (el color de "tu perso | jugado | QA-27 (2026-10-09…17) |
| `ZON-17` | Mapa de zona | Salidas como estandartes de camino : flecha grande hacia el borde, placa con el nombre (o | jugado | P6, P164 (salidas) |
| `ZON-19` | Mapa de zona | Etiquetas de nombre : siempre visibles para los puntos a 2-3 celdas del personaje y para e | jugado | P123, P151 (etiquetas) |
| `ZON-20` | Mapa de zona | Leyenda compacta fija en una esquina del mapa (BG3), plegable, con las mismas fichas reale | jugado | 2026-10-19: leyenda plegada abajo a la izquierda; al abrirla, las fichas reales (fauna, recurso, NPC, edificio, suelo, cadáver, tú, salida, parcelas) y los colores de facción |
| `ZON-62` | Mapa de zona | Cuadrícula bajo demanda (Z11): oculta por defecto, visible al mantener `Alt`, al hacer zoo | jugado | 2026-10-19: oculta al abrir; visible solo mientras se mantiene `Alt`; «▦ Cuadrícula» la fija (`aria-pressed`) y la quita al volver a pulsar |
| `ZON-80` | Mapa de zona | Partir `ZonaPanel.tsx` | no se juega | refactor |
| `ZON-81` | Mapa de zona | Capas SVG ordenadas | no se juega | orden de capas; se ve por ZON-10/13 |
| `ZON-86` | Mapa de zona | Tests | no se juega | tests |
| `CR-1` | Mundo vivo | Modelos `Suceso`, `SucesoCausa`, `SucesoActor`, enums. S 2026-10-02: modelos y enums en `s | no se juega | modelos de datos; se ven por CR-19/20 |
| `CR-2` | Mundo vivo | `registrarSuceso()`, importancia y plantillas de texto para todos los tipos de § 6.1. M 20 | no se juega | motor; se ve por CR-19/20 |
| `CR-3` | Mundo vivo | Emisores en: turno (`turnResolution.ts`: combate, muerte causada, perdón, captura, | no se juega | emisores; se ven por CR-19/20 |
| `CR-4` | Mundo vivo | Vista de administración `/admin/partida/:id/libro` (solo lectura). M 2026-10-02 | no se juega | vista de administración |
| `CR-5` | Mundo vivo | Cambios de esquema § 5.2 + índices parciales. M 2026-10-02: migración | no se juega | migración |
| `CR-6` | Mundo vivo | `asegurarMundoDePartida` y adaptar lecturas/escrituras de facciones, relaciones, | no se juega | mundo por partida; se ve en todo |
| `CR-7` | Mundo vivo | `avanceDiario` por partida; sacar las funciones de mundo de `worldTick.ts`. M 2026-10-04. | no se juega | motor; se ve por el paso de días |
| `CR-8` | Mundo vivo | Script de migración (§ 16). M 2026-10-04: `services/cronista/migrarPartidas.ts` | no se juega | script de migración |
| `CR-9` | Mundo vivo | Lista cerrada de efectos con sus sucesos. M 2026-10-04 — paso 1: | sin jugar |  |
| `CR-10` | Mundo vivo | Reacciones inmediatas (tabla § 7.1). M 2026-10-04: `services/cronista/reacciones.ts` | jugado | Día 44: HAMBRUNA en Maktor → reacción de cohesión → REBELION |
| `CR-11` | Mundo vivo | Consecuencias aplazadas con sus disparos y las 7 iniciales (§ 7.2). M 2026-10-04 (4 reglas | jugado | Día 44: 47 consecuencias (NOTICIA y OPORTUNIDAD_CIERRA disparadas, CARAVANA_ASALTADA caducadas y pendiente) |
| `CR-12` | Mundo vivo | Narrador de fondo con presupuesto, enfriamientos y reglas de facción (§ 7.3); | jugado | Día 44: sucesos de fondo (expediciones, tormentas, caravanas, escaramuzas, alianzas, migraciones) en la Crónica; P234, P235 (textos) |
| `CR-13` | Mundo vivo | Nacimientos notables y generador de nombres (§ 12.3). M Incluye el efecto `crearNpc` | jugado | Día 44: «Nace Merkar Riuh, hijo de Grosh y Krarka» |
| `CR-14` | Mundo vivo | Etiquetas (§ 8.1). 2026-10-06 S Incluye las reacciones de CR-10: etiqueta tras matar a un | jugado | Etiqueta FUNDADOR al fundar el Reino (ETIQUETA_GANADA) |
| `CR-15` | Mundo vivo | Aprobación con valores (§ 8.2). 2026-10-06 M 15a 2026-10-06 (`cronista/aprobacion.ts`: val | sin jugar |  |
| `CR-16` | Mundo vivo | Recuerdos de NPC (§ 8.3). S Incluye las reacciones de CR-10: `recuerdo(testigos, | sin jugar | 2026-10-20: «Vencedor de Gorhorn» sí; ningún Recuerdo provocado (regalar no entrega, P241) |
| `CR-17` | Mundo vivo | Buscadores de historias e hilos (§ 7.4). 2026-10-06 M (`cronista/hilos.ts`; modelo | sin jugar |  |
| `CR-18` | Mundo vivo | Propagación y rumores (§ 9). M 2026-10-05 (pasos 18a-18e abajo; lo que falta de la | jugado | P165, P137 («¿Qué se cuenta?», bandos) |
| `CR-19` | Mundo vivo | Endpoints de Leyendas (§ 14). S 2026-10-05 (`cronista/leyendas.ts` y `routes/saves/leyenda | jugado | P137 (Leyendas) |
| `CR-20` | Mundo vivo | Front: Leyendas y fichas "En tu partida" en la Enciclopedia. M 2026-10-05 Decidido (`CR-18 | jugado | P137 |
| `CR-21` | Mundo vivo | Bloque de verdad obligatoria. S 2026-10-06 | jugado | 2026-10-20, Ollama real: el bloque sale bien; con el narrador en GPU lo usa (P251); la primera vez, solo CPU y con el RAG roto (P274), lo ignoró |
| `CR-22` | Mundo vivo | Callbacks por entidad. S 2026-10-06 | jugado | 2026-10-20, Ollama real: el callback del orco sale bien, la narración no lo usa (P252) |
| `CR-23` | Mundo vivo | Puntuación recencia + importancia + relevancia sobre Libro + crónica. M 2026-10-06 | jugado | 2026-10-20: con la acción de juego, «alianza/Concordia» sube las alianzas y «Maktor» el tratado y el espionaje (bloqueMemoria aparte); con «pozo/pobladores» «Se levanta un pozo» queda 8.º y «Llega un poblador» no entra; repetidos en P247 |
| `CR-32` | Mundo vivo | Reclutamiento pacífico e informantes (usuaria, 2026-10-04, Q14 de `CR-12`): convencer a | sin jugar |  |
| `CR-34` | Mundo vivo | Decisiones de facción 2026-10-05 (34d, expansión, pasa a `CR-39` en el `0.3`; Q20) (IA de | jugado | Día 44: GUERRA_DECLARADA (Serhu con la Concordia contra Helsig y Goshg), TRATADO_COMERCIAL, ESPIONAJE, ALIANZA |
| `CR-35` | Mundo vivo | Economía y expediciones de facción en el mundo de la partida (`CR-34` Q1). M | jugado | Día 44: 22 EXPEDICION_SALE y 21 EXPEDICION_VUELVE |
| `CR-37` | Mundo vivo | Guerra de una facción contra el Reino de la jugadora 2026-10-08 (`CR-34` Q7, `0.3`): solo | sin jugar |  |
| `CR-40` | Mundo vivo | Misiones secundarias por motor 2026-10-05 (fusionado en `main` con el PR #16; 40f-2 descar | jugado | P140, P183, P184, P201 (misiones del poste y encargos) |
| `CR-42` | Mundo vivo | Compañeros que cuentan lo de su tierra (`CR-18` Q9, va al `0.3` con `CR-15`): un compañero | sin jugar |  |
| `CR-43` | Mundo vivo | 2026-10-05 (ciclo vital, nombres de escisión con la goirnte «Los del Edicto/Estela/Tributo | sin jugar |  |
| `CR-44` | Mundo vivo | 2026-10-05 Moral y retirada de los NPC en combate. M Pasos: 44a reglas puras (`moralCombat | jugado | registro: pruebas-0.3-hallazgos.md |
| `CR-45` | Mundo vivo | 2026-10-05 (capitán = el de más Inteligencia ≥ 20 del bando enemigo; `objetivoConcentrado` | sin jugar |  |
| `CR-46` | Mundo vivo | 2026-10-05 (`GET /saves/:id/expediciones/mapa`, `expedicionesMapa.ts`; banderita ⚑ en el m | sin jugar |  |
| `CR-47` | Mundo vivo | 2026-10-05 Comercio de volumen Reino↔facción. L Pasos: 47a reglas puras, modelo y Mercado | sin jugar |  |
| `CR-48` | Mundo vivo | 2026-10-05 Pasada de rendimiento del avance diario con el motor completo. S | no se juega | rendimiento |
| `CR-50` | Mundo vivo | Campamentos de bandidos con cabecilla y refuerzos 2026-10-07 (Bellwright, Medieval Dynasty | jugado | Día 44: CAMPAMENTO_NUEVO «Se asientan nabieus enloquecidos en La Desembocadura Callada» |
| `CR-52` | Mundo vivo | Linajes y rastros 2026-10-06 (`cronista/linajes.ts`; modelos `Linaje` y `LinajeMiembro`, | jugado | Leyendas › Linajes: «Los Gorhorn, tu linaje» |
| `CR-53` | Mundo vivo | Economía de supervivencia del Reino (Fase D del `0.3`; números decididos por la usuaria el | sin jugar | parcial 2026-10-21 (suma al 2026-10-19): Leñera construida (leña 6 + fibra 2, materiales 30/60 → 30/180); tope de materiales al depositar (admite hasta 180, luego «No caben más materiales», P276); tope de comida de dar-reino (180 + 50 rechazado); Cisterna no jugable (pide Inteligencia 8, Gorhorn 7, P277); Granero solo por escenario; sed, hambre y muerte del Reino sin provocar (población 0 y comida 60); P275, P278, P279 |
| `CR-54` | Mundo vivo | Economía de supervivencia de las facciones (Q7-Q8 y Q16-Q20): 2026-10-06 reparto de la tab | jugado | Día 44: 6 HAMBRUNA de facción y REBELION en Maktor |
| `CR-55` | Mundo vivo | Ganadería 2026-10-06 (Q9, Q11, Q13 de la Fase D; ronda propia aceptada el 2026-10-06, deci | sin jugar |  |
| `CR-56` | Mundo vivo | Usos de la fauna 2026-10-06 (Q10, Q12 de la Fase D; ronda propia aceptada el 2026-10-06, d | sin jugar |  |
| `CR-58` | Mundo vivo | Factura de equipo (Fase D, Q25-Q27). 2026-10-06 (`cronista/facturaEquipo.ts`) | parcial 2026-10-21: acoger a Dolgeth Tiuh (trabajador) cobra 7 Goirnos del tesoro (241 → 234) y no queda «sin herramienta»; sin jugar: soldado/vigía (34), fabricación con taller (Q26), medio rendimiento sin equipo (Q27), sueldo semanal de 4/10 |
| `CR-59` | Mundo vivo | Vasallaje y deuda (Fase D, Q21-Q24 y Q28; Serhu bajo la Concordia). 2026-10-06 | sin jugar |  |
| `CR-61` | Mundo vivo | Comida por oficios 2026-10-07 (Q15 de la ronda de `CR-55`; ronda propia aceptada el 2026-1 | parcial 2026-10-21: selector «Tarea» de Súbditos con Recolector, Pescador, Cocinero, Ganadero y Fibrero y sus textos; cambio a Pescador guardado (tarea=pescador); la comida no se movió en 3+3 días con Recolector ni con Pescador (P279); sin jugar: Cocinero con Cocina, Ganadero, Fibrero, estaciones, platos nuevos |
| `CR-62` | Mundo vivo | Combate de fondo (Q6 de la ronda de `CR-56`; ronda propia aceptada el 2026-10-07, | jugado | P77, P130 (los que quedan fuera del combate) |
| `CR-63` | Mundo vivo | Partidas de caza y captura 2026-10-07 (ronda aceptada el 2026-10-07, decisiones en | sin jugar |  |
| `CR-65` | Mundo vivo | Defensa del Reino y milicia 2026-10-07 (Fase E del `0.3`, Q2-Q3 de su ronda, aceptada el 2 | sin jugar |  |
| `CR-67` | Mundo vivo | Intensidad de los asaltos en Configuración 2026-10-08 (Fase E, Q7, corregida el 2026-10-08 | jugado | 2026-10-20: Configuración › Partida, Intensidad Dura y Tamaño Fácil se guardan (WorldState.intensidadAsaltos=DURA, tamanoAsaltos=FACIL) y siguen tras recargar; sin ver su efecto en un asalto (texto de Intensidad: P257) |
| `NAR-9` | Narrador | Rumores en "El mundo" | jugado | 2026-10-19: un rumor del Cronista sale en pergamino con «Desde El Margen Silencioso · pasó el día 9» y «Ver en Leyendas», que abre Leyendas con la entrada resaltada; los «Se dice que…» de `darNoticia` salen sin estilo (P226) |
| `PAN-9b` | Paneles | Leyendas de tu partida | jugado | P137 |
| `REI-33` | Reino | Editar, reactivar y borrar órdenes (R13, R14): pestaña "Desactivadas" con *Reactivar*; men | jugado | 2026-10-19: ⏸ desactiva; «Desactivadas (1)» con Reactivar y Borrar; Borrar pide confirmación «No se puede deshacer» y borra (0 órdenes en la base); límite editable solo en «único» |
| `REI-40` | Reino | Agrupado por recurso (R9): una fila/carta por tipo con cantidad, icono, categoría (comida, | jugado | 2026-10-19, Súbditos › Almacén: «Raciones de viaje ×1» agrupado, con Retirar y tope; P215 |
| `REI-41` | Reino | Topes junto al stock (R22): barra `cantidad / tope` por recurso con el tope editable (step | jugado | 2026-10-19: fila del almacén con barra `role="meter"` «1 de 5» al 20 % y tooltip en el tope |
| `REI-54` | Reino | Llegadas y salidas : cuando la versión mínima de súbditos exista, tarjeta "Llegaron 2 pobl | jugado | 2026-10-19: tras P220, tarjeta «Llega a tu puerta» (ACOGER/Despedir, «Esperará un día tu respuesta»); en Súbditos «↩ Krarka — Se fue: …» y «✝ Grosh — Murió de hambre» |
| `REI-110` | Reino | Prioridad: guardar con *debounce* o al soltar, no en cada tecla (R18). S 2026-10-02 (`Nume | jugado | 2026-10-19: escribir la prioridad no manda nada; un solo PATCH `{"prioridad":8}` al salir del campo |
| `REI-111` | Reino | Todos los `try/finally` de Reino con `catch` y `ErrorBanner` visible (R19). S 2026-10-01 ( | jugado | 2026-10-19: con 500 forzado, Corrales, Partidas, Defensa y crear orden muestran `ErrorBanner` con Reintentar; la carga de órdenes, topes y súbditos falla en silencio (P225) |
| `REI-112` | Reino | Topes con `Enter` y confirmación visual (R20). S 2026-10-02 (mismo componente: ✓ al confir | jugado | 2026-10-19: Enter manda `limite:5` y muestra ✓; Esc deshace; vacío manda `limite:null` |
| `REI-113` | Reino | Sustituir los `<select>` nativos por los selectores del juego (R23). S 2026-10-02: nuevo ` | jugado | 2026-10-19: ningún `<select>` nativo en las 8 pestañas del Reino |
| `REI-114` | Reino | Esqueletos de carga en lugar de "Cargando…" (R24). S 2026-10-02: componente `Esqueleto` (p | jugado | 2026-10-19: con la carga retrasada, 3 `Esqueleto` `role="status"` en Producción y uno en Comercio («Cargando el Mercado…» solo para lector); se van al llegar los datos |
| `REI-115` | Reino | Tooltips de explicación en cada indicador, rol y estado (R25). S 2026-10-02: los 8 indicad | jugado | 2026-10-19: tooltips en Felicidad, Bebida y Visitantes (Visión general), títulos de estado en Edificios y de rol en Súbditos |
| `REI-116` | Reino | Declarar `xpGanada`, `nivelDiplomatico` y `stage` en `DiplomaciaResultado` (R4). S 2026-10 | jugado | 2026-10-19: negociar enseña «+50 XP de diplomacia · diplomático nivel 2»; espiar, «Presión 38 / 100» con barra y «Etapa 0 de 4» |
| `REI-118` | Reino | Súbditos como personas (Fase C del `0.3`, Q1-Q3 y Q7 de la usuaria, 2026-10-06): cada pobl | jugado | 2026-10-19: tarjetas de súbdito con nombre, raza, edad, linaje («de los Riuh»), papel y tarea editables, pareja y crías; Población cuenta súbditos ACTIVO |
| `REI-119` | Reino | Llegadas (Q4): una vez por semana, con cama libre, comida > 0, agua > 0 y felicidad ≥ 40, | jugado | 2026-10-19: con las 2 camas temporales (P220a) y la lista de requisitos en ✓ (P220b) llega Krarka; tarjeta «Llega a tu puerta» con ACOGER y queda de Trabajadora (Camas 1/2) |
| `REI-120` | Reino | Parejas y crías (Q5, como Medieval Dynasty): dos adultos del mismo pueblo con felicidad ≥ | jugado | 2026-10-19: Grosh y Krarka forman pareja («Pareja de X»); con camas llenas no nace nadie en 4 semanas; con cama libre nace Merkar Riuh («recién nacido · cría», padres «· 1 cría»). Sin aviso en el canal (P223) |
| `REI-121` | Reino | Salidas y muerte (Q6): con la felicidad del Reino 7 días seguidos por debajo de 20, cada s | jugado | 2026-10-19: con felicidad 10 siete días se va Krarka con su cría (tarjeta «↩ … Se fue»); con comida 0 Grosh muere de hambre el día 8 (tarjeta «✝ … Murió de hambre»). Pareja que no se limpia en el acto (P224) |
