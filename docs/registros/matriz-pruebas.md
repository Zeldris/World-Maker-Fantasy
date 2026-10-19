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
| `CFG-4` | Configuración | Panel de configuración | sin jugar |  |
| `CFG-5` | Configuración | Persistencia | sin jugar |  |
| `CFG-6` | Configuración | `SettingsContext` | no se juega | contexto interno; se ve por CFG-4/5 |
| `CFG-13` | Configuración | Tamaño y tipografía de la narración | sin jugar |  |
| `CFG-14` | Configuración | Animaciones | sin jugar |  |
| `CFG-26` | Configuración | Atajos de teclado reasignables | sin jugar |  |
| `CFG-28` | Configuración | Alto contraste | sin jugar |  |
| `CFG-34` | Configuración | Estilo del mundo | sin jugar |  |
| `CFG-35` | Configuración | Avisos de sucesos | sin jugar |  |
| `INT-1` | Cronista en la interfaz | Familias de sucesos con identidad propia | sin jugar |  |
| `INT-2` | Cronista en la interfaz | Importancia visible | sin jugar |  |
| `INT-3` | Cronista en la interfaz | Causas enlazadas | sin jugar |  |
| `INT-4` | Cronista en la interfaz | Lo desconocido se ve como desconocido | sin jugar |  |
| `INT-9` | Cronista en la interfaz | Rumor con lugar | sin jugar |  |
| `DAD-1` | Dados y tiradas | `key` por tirada en `TameoModal` (H18). S | sin jugar |  |
| `DAD-2` | Dados y tiradas | Veredicto de Tameo diferido a `onAllLanded` (H19), como ya hacen Recolección e | sin jugar |  |
| `DAD-3` | Dados y tiradas | Mostrar siempre `dado + bono = total vs dificultad → Éxito/Fallo` al aterrizar (H20). S | jugado | P166 (tirada de encuentro) |
| `DAD-4` | Dados y tiradas | Nombres reales en los dos lados (personaje y rival) en vez de "Tú/el enemigo", y | jugado | P153 |
| `DAD-5` | Dados y tiradas | `scrollIntoView` solo si la tirada está fuera de la vista y el jugador no ha hecho | sin jugar |  |
| `DAD-6` | Dados y tiradas | Color propio de fallo (`danger-400`) y subir el contraste de "necesitas X". S | sin jugar |  |
| `BAS-1` | Interfaz | Fuentes empaquetadas | sin jugar |  |
| `BAS-3` | Interfaz | Foco visible y navegación | sin jugar |  |
| `BAS-5` | Interfaz | Partir `GameView.tsx` | no se juega | refactor de GameView |
| `BAS-7` | Interfaz | Animaciones de salida y de cambio de layout | sin jugar |  |
| `BAS-8` | Interfaz | Librería de componentes base | no se juega | componentes base; se ven por todo |
| `BAS-9` | Interfaz | Catálogo visual | sin jugar |  |
| `HUD-6` | Interfaz | Notificaciones (toasts) | sin jugar |  |
| `HUD-12` | Interfaz | "El mundo avanza" | sin jugar |  |
| `MOD-1` | Interfaz | `ModalShell` único | jugado | QA-27 (2026-10-09…17), todos los modales |
| `MOD-2` | Interfaz | Estados comunes | sin jugar |  |
| `MOD-3` | Interfaz | Teclado en modales | jugado | P202 (Escape en modales) |
| `MOD-4` | Interfaz | Modales de ceremonia | sin jugar |  |
| `MOD-5` | Interfaz | `QuantityStepper` compartido | sin jugar |  |
| `MOD-6` | Interfaz | `EntityRow` con miniatura | sin jugar |  |
| `UX-1` | Interfaz | `useGamePhase` | no se juega | hook interno; se ve por UX-7/UX-8 |
| `UX-2` | Interfaz | Matriz de permisos | no se juega | tabla interna; se ve por UX-7/UX-8 |
| `UX-3` | Interfaz | Guardia en `handleSubmit` | sin jugar |  |
| `UX-4` | Interfaz | Tarjetas del registro con el estado global | jugado | QA-27 (2026-10-09…17), tarjetas del diario |
| `UX-5` | Interfaz | Paneles en modo consulta | sin jugar |  |
| `UX-6` | Interfaz | Un narrador a la vez | sin jugar |  |
| `UX-7` | Interfaz | La brújula y el mapa respetan la fase | jugado | QA-27 (2026-10-09…17), mapa bloqueado en combate |
| `UX-8` | Interfaz | Bloqueos visibles | jugado | QA-27 (2026-10-09…17), «El narrador todavía está escribiendo» |
| `UX-9` | Interfaz | Gestor de capas con prioridad | jugado | P188, P202 |
| `UX-10` | Interfaz | Decisiones en cola | sin jugar |  |
| `UX-11` | Interfaz | Presentación en orden del turno | jugado | QA-27 (2026-10-09…17) |
| `UX-12` | Interfaz | Qué pasa con el cajón abierto cuando llega algo | sin jugar |  |
| `UX-13` | Interfaz | `anyModalOpen` completo | jugado | QA-27 (2026-10-09…17) |
| `UX-16` | Interfaz | El asistente sobrevive a recargar | sin jugar |  |
| `UX-24` | Interfaz | Ningún error en silencio | sin jugar |  |
| `UX-29` | Interfaz | El mundo de fondo nunca bloquea | sin jugar |  |
| `UX-30` | Interfaz | Solo lo que el personaje sabe | sin jugar |  |
| `UX-31` | Interfaz | Varios días de golpe | sin jugar |  |
| `UX-35` | Interfaz | El turno no espera al día | sin jugar |  |
| `UX-36` | Interfaz | Leyendas siempre a una tecla | sin jugar |  |
| `UX-37` | Interfaz | Responder escribiendo | jugado | P141 (Responder escribiendo) |
| `UX-38` | Interfaz | Noticias del mundo que se pueden tocar | sin jugar |  |
| `ZON-1` | Mapa de zona | El mapa vive en la pantalla de juego, no en un modal 🧭. Tres opciones: (A, recomendada) la | jugado | QA-27 (2026-10-09…17) |
| `ZON-2` | Mapa de zona | Minimapa permanente (si no se elige A): esquina de la cabecera o del registro, ~200 px, co | sin jugar |  |
| `ZON-3` | Mapa de zona | Un solo mapa : la vista de consulta de *Mapa → Zona* pasa a ser la misma vista, con el mov | jugado | QA-27 (2026-10-09…17) |
| `ZON-4` | Mapa de zona | Atajos : `M` abre o centra el mapa, `Z` alterna mapa grande / minimapa, flechas o `WASD` m | sin jugar |  |
| `ZON-6` | Mapa de zona | Pantalla completa del mapa (`F` o doble clic en el borde) para explorar con detalle. S | sin jugar |  |
| `ZON-10` | Mapa de zona | Fichas con placa oscura + pictograma + anillo de disposición (Foundry VTT). La placa conse | jugado | P123, P147 |
| `ZON-11` | Mapa de zona | Tamaño mínimo garantizado : las fichas se dibujan a tamaño de pantalla fijo (~28 px de diá | jugado | P123 |
| `ZON-13` | Mapa de zona | Grupos legibles : insignia "×3" en píldora clara fuera de la ficha; a partir de 3, fichas  | jugado | P147 |
| `ZON-14` | Mapa de zona | Ficha del personaje : retrato o inicial, anillo de cristal `accent` (el color de "tu perso | jugado | QA-27 (2026-10-09…17) |
| `ZON-17` | Mapa de zona | Salidas como estandartes de camino : flecha grande hacia el borde, placa con el nombre (o  | jugado | P6, P164 (salidas) |
| `ZON-19` | Mapa de zona | Etiquetas de nombre : siempre visibles para los puntos a 2-3 celdas del personaje y para e | jugado | P123, P151 (etiquetas) |
| `ZON-20` | Mapa de zona | Leyenda compacta fija en una esquina del mapa (BG3), plegable, con las mismas fichas reale | sin jugar |  |
| `ZON-45` | Mapa de zona | Lista lateral útil en vez de duplicada (Z25): puntos agrupados por tipo y ordenados por di | sin jugar |  |
| `ZON-62` | Mapa de zona | Cuadrícula bajo demanda (Z11): oculta por defecto, visible al mantener `Alt`, al hacer zoo | sin jugar |  |
| `ZON-80` | Mapa de zona | Partir `ZonaPanel.tsx` | no se juega | refactor |
| `ZON-81` | Mapa de zona | Capas SVG ordenadas | no se juega | orden de capas; se ve por ZON-10/13 |
| `ZON-86` | Mapa de zona | Tests | no se juega | tests |
| `CR-1` | Mundo vivo | Modelos `Suceso`, `SucesoCausa`, `SucesoActor`, enums. S 2026-10-02: modelos y enums en `s | no se juega | modelos de datos; se ven por CR-19/20 |
| `CR-2` | Mundo vivo | `registrarSuceso()`, importancia y plantillas de texto para todos los tipos de § 6.1. M 20 | no se juega | motor; se ve por CR-19/20 |
| `CR-3` | Mundo vivo | Emisores en: turno (`turnResolution.ts`: combate, muerte causada, perdón, captura, | no se juega | emisores; se ven por CR-19/20 |
| `CR-4` | Mundo vivo | Vista de administración `/admin/partida/:id/libro` (solo lectura). M 2026-10-02 | no se juega | vista de administración |
| `CR-5` | Mundo vivo | Cambios de esquema § 5.2 + índices parciales. M 2026-10-02: migración | no se juega | migración |
| `CR-6` | Mundo vivo | `asegurarMundoDePartida` y adaptar lecturas/escrituras de facciones, relaciones, | no se juega | mundo por partida; se ve en todo |
| `CR-7` | Mundo vivo | `avanceDiario` por partida; sacar las funciones de mundo de `worldTick.ts`. M 2026-10-04.  | no se juega | motor; se ve por el paso de días |
| `CR-8` | Mundo vivo | Script de migración (§ 16). M 2026-10-04: `services/cronista/migrarPartidas.ts` | no se juega | script de migración |
| `CR-9` | Mundo vivo | Lista cerrada de efectos con sus sucesos. M 2026-10-04 — paso 1: | sin jugar |  |
| `CR-10` | Mundo vivo | Reacciones inmediatas (tabla § 7.1). M 2026-10-04: `services/cronista/reacciones.ts` | sin jugar |  |
| `CR-11` | Mundo vivo | Consecuencias aplazadas con sus disparos y las 7 iniciales (§ 7.2). M 2026-10-04 (4 reglas | sin jugar |  |
| `CR-12` | Mundo vivo | Narrador de fondo con presupuesto, enfriamientos y reglas de facción (§ 7.3); | sin jugar |  |
| `CR-13` | Mundo vivo | Nacimientos notables y generador de nombres (§ 12.3). M Incluye el efecto `crearNpc` | sin jugar |  |
| `CR-14` | Mundo vivo | Etiquetas (§ 8.1). 2026-10-06 S Incluye las reacciones de CR-10: etiqueta tras matar a un  | sin jugar |  |
| `CR-15` | Mundo vivo | Aprobación con valores (§ 8.2). 2026-10-06 M 15a 2026-10-06 (`cronista/aprobacion.ts`: val | sin jugar |  |
| `CR-16` | Mundo vivo | Recuerdos de NPC (§ 8.3). S Incluye las reacciones de CR-10: `recuerdo(testigos, | sin jugar |  |
| `CR-17` | Mundo vivo | Buscadores de historias e hilos (§ 7.4). 2026-10-06 M (`cronista/hilos.ts`; modelo | sin jugar |  |
| `CR-18` | Mundo vivo | Propagación y rumores (§ 9). M 2026-10-05 (pasos 18a-18e abajo; lo que falta de la | jugado | P165, P137 («¿Qué se cuenta?», bandos) |
| `CR-19` | Mundo vivo | Endpoints de Leyendas (§ 14). S 2026-10-05 (`cronista/leyendas.ts` y `routes/saves/leyenda | jugado | P137 (Leyendas) |
| `CR-20` | Mundo vivo | Front: Leyendas y fichas "En tu partida" en la Enciclopedia. M 2026-10-05 Decidido (`CR-18 | jugado | P137 |
| `CR-21` | Mundo vivo | Bloque de verdad obligatoria. S 2026-10-06 | sin jugar |  |
| `CR-22` | Mundo vivo | Callbacks por entidad. S 2026-10-06 | sin jugar |  |
| `CR-23` | Mundo vivo | Puntuación recencia + importancia + relevancia sobre Libro + crónica. M 2026-10-06 | sin jugar |  |
| `CR-32` | Mundo vivo | Reclutamiento pacífico e informantes (usuaria, 2026-10-04, Q14 de `CR-12`): convencer a | sin jugar |  |
| `CR-34` | Mundo vivo | Decisiones de facción 2026-10-05 (34d, expansión, pasa a `CR-39` en el `0.3`; Q20) (IA de  | sin jugar |  |
| `CR-35` | Mundo vivo | Economía y expediciones de facción en el mundo de la partida (`CR-34` Q1). M | sin jugar |  |
| `CR-37` | Mundo vivo | Guerra de una facción contra el Reino de la jugadora 2026-10-08 (`CR-34` Q7, `0.3`): solo  | sin jugar |  |
| `CR-40` | Mundo vivo | Misiones secundarias por motor 2026-10-05 (fusionado en `main` con el PR #16; 40f-2 descar | jugado | P140, P183, P184, P201 (misiones del poste y encargos) |
| `CR-42` | Mundo vivo | Compañeros que cuentan lo de su tierra (`CR-18` Q9, va al `0.3` con `CR-15`): un compañero | sin jugar |  |
| `CR-43` | Mundo vivo | 2026-10-05 (ciclo vital, nombres de escisión con la goirnte «Los del Edicto/Estela/Tributo | sin jugar |  |
| `CR-44` | Mundo vivo | 2026-10-05 Moral y retirada de los NPC en combate. M Pasos: 44a reglas puras (`moralCombat | jugado | registro: pruebas-0.3-hallazgos.md |
| `CR-45` | Mundo vivo | 2026-10-05 (capitán = el de más Inteligencia ≥ 20 del bando enemigo; `objetivoConcentrado` | sin jugar |  |
| `CR-46` | Mundo vivo | 2026-10-05 (`GET /saves/:id/expediciones/mapa`, `expedicionesMapa.ts`; banderita ⚑ en el m | sin jugar |  |
| `CR-47` | Mundo vivo | 2026-10-05 Comercio de volumen Reino↔facción. L Pasos: 47a reglas puras, modelo y Mercado  | sin jugar |  |
| `CR-48` | Mundo vivo | 2026-10-05 Pasada de rendimiento del avance diario con el motor completo. S | no se juega | rendimiento |
| `CR-50` | Mundo vivo | Campamentos de bandidos con cabecilla y refuerzos 2026-10-07 (Bellwright, Medieval Dynasty | sin jugar |  |
| `CR-52` | Mundo vivo | Linajes y rastros 2026-10-06 (`cronista/linajes.ts`; modelos `Linaje` y `LinajeMiembro`, | sin jugar |  |
| `CR-53` | Mundo vivo | Economía de supervivencia del Reino (Fase D del `0.3`; números decididos por la usuaria el | sin jugar |  |
| `CR-54` | Mundo vivo | Economía de supervivencia de las facciones (Q7-Q8 y Q16-Q20): 2026-10-06 reparto de la tab | sin jugar |  |
| `CR-55` | Mundo vivo | Ganadería 2026-10-06 (Q9, Q11, Q13 de la Fase D; ronda propia aceptada el 2026-10-06, deci | sin jugar |  |
| `CR-56` | Mundo vivo | Usos de la fauna 2026-10-06 (Q10, Q12 de la Fase D; ronda propia aceptada el 2026-10-06, d | sin jugar |  |
| `CR-58` | Mundo vivo | Factura de equipo (Fase D, Q25-Q27). 2026-10-06 (`cronista/facturaEquipo.ts`) | sin jugar |  |
| `CR-59` | Mundo vivo | Vasallaje y deuda (Fase D, Q21-Q24 y Q28; Serhu bajo la Concordia). 2026-10-06 | sin jugar |  |
| `CR-61` | Mundo vivo | Comida por oficios 2026-10-07 (Q15 de la ronda de `CR-55`; ronda propia aceptada el 2026-1 | sin jugar |  |
| `CR-62` | Mundo vivo | Combate de fondo (Q6 de la ronda de `CR-56`; ronda propia aceptada el 2026-10-07, | jugado | P77, P130 (los que quedan fuera del combate) |
| `CR-63` | Mundo vivo | Partidas de caza y captura 2026-10-07 (ronda aceptada el 2026-10-07, decisiones en | sin jugar |  |
| `CR-65` | Mundo vivo | Defensa del Reino y milicia 2026-10-07 (Fase E del `0.3`, Q2-Q3 de su ronda, aceptada el 2 | sin jugar |  |
| `CR-67` | Mundo vivo | Intensidad de los asaltos en Configuración 2026-10-08 (Fase E, Q7, corregida el 2026-10-08 | sin jugar |  |
| `NAR-9` | Narrador | Rumores en "El mundo" | sin jugar |  |
| `PAN-9b` | Paneles | Leyendas de tu partida | jugado | P137 |
| `REI-10` | Reino | Cabecera del reino : estandarte con nombre, emblema y color (ver MOD-27), nivel del Ayunta | sin jugar |  |
| `REI-11` | Reino | Medidores con su forma : Felicidad como dial 0-100 con las marcas de 20 (rebelión) y 70 (c | sin jugar |  |
| `REI-12` | Reino | Balance de mañana (R1): por cada recurso, `entra +X · sale −Y = neto` desglosado (trabajad | sin jugar |  |
| `REI-14` | Reino | Panel de avisos priorizado : "Te quedas sin agua en 2 días", "2 órdenes paradas por falta  | sin jugar |  |
| `REI-15` | Reino | Consejero del reino 🧭: tres sugerencias concretas calculadas en cliente ("Asigna 1 trabaja | sin jugar |  |
| `REI-16` | Reino | Acciones rápidas : Descansar en el campamento, ir al Ayuntamiento, nueva orden, depositar  | sin jugar |  |
| `REI-21` | Reino | Vista lista alternativa (la actual mejorada): tarjeta por edificio con imagen o icono, est | sin jugar |  |
| `REI-22` | Reino | Catálogo de construcción completo (R12): todas las recetas de construcción con coste (mate | sin jugar |  |
| `REI-23` | Reino | Mejoras de edificio (Ayuntamiento pequeño → mediano → grande, Cuartel → de guerra / comerc | sin jugar |  |
| `REI-26` | Reino | Ficha de parcela mejorada : hoy una parcela ocupada solo dice "Ya hay una construcción aqu | sin jugar |  |
| `REI-31` | Reino | Progreso de la orden (R3): `producido / límite` como barra; en modo *reponer*, stock actua | sin jugar |  |
| `REI-32` | Reino | Nueva orden con ficha de receta (R7): selector visual con buscador, mostrando ingredientes | sin jugar |  |
| `REI-33` | Reino | Editar, reactivar y borrar órdenes (R13, R14): pestaña "Desactivadas" con *Reactivar*; men | sin jugar |  |
| `REI-34` | Reino | Prioridad arrastrable estilo Bellwright: las órdenes de un edificio en lista ordenable (ar | sin jugar |  |
| `REI-40` | Reino | Agrupado por recurso (R9): una fila/carta por tipo con cantidad, icono, categoría (comida, | sin jugar |  |
| `REI-41` | Reino | Topes junto al stock (R22): barra `cantidad / tope` por recurso con el tope editable (step | sin jugar |  |
| `REI-42` | Reino | Depositar y retirar en cantidad (R15): selector de cantidad (`QuantityStepper`, MOD-5), "D | sin jugar |  |
| `REI-43` | Reino | Buscar, filtrar, ordenar (por categoría, cantidad, cerca del tope). S | sin jugar |  |
| `REI-50` | Reino | Tabla de personal (R10): una fila por persona (compañero o súbdito) con retrato, raza (`ra | sin jugar |  |
| `REI-51` | Reino | Roles como tarjetas explicadas (R25): Trabajador, Guardia, Productor, Diplomático, con qué | sin jugar |  |
| `REI-52` | Reino | Editor de plantillas visual (R17): el muñeco de ranuras de `EquipoPanel` en pequeño; en ca | sin jugar |  |
| `REI-54` | Reino | Llegadas y salidas : cuando la versión mínima de súbditos exista, tarjeta "Llegaron 2 pobl | sin jugar |  |
| `REI-60` | Reino | Mapa de territorios : los territorios del reino sobre el mapa de Berig con su color de con | sin jugar |  |
| `REI-61` | Reino | Ficha de territorio (R8): población y su variación diaria (`+2`/`−3`), barra de días hacia | sin jugar |  |
| `REI-63` | Reino | Presencia de otras facciones en la región del territorio (control regional que ya pinta `Z | sin jugar |  |
| `REI-70` | Reino | Tarjetas de facción con emblema, líder (retrato), raza (paleta por raza ya existente) y la | sin jugar |  |
| `REI-71` | Reino | Diplomático visible (R4): retrato, nivel de diplomático y XP; al negociar, "+XP" flotante  | sin jugar |  |
| `REI-72` | Reino | Acciones explicadas : qué hace Negociar, Sabotear y Espiar, qué riesgo tienen y el resulta | sin jugar |  |
| `REI-73` | Reino | Informe de espionaje como ficha: lo que se descubre de la facción (presión, relación, hech | sin jugar |  |
| `REI-80` | Reino | Pestaña propia con dos columnas (Comprar Vender) y la facción elegida arriba; Goirnos siem | sin jugar |  |
| `REI-90` | Reino | Registro de reino dentro del panel (hoy `kingdomLog` solo en el panel "El mundo" con el bo | sin jugar |  |
| `REI-91` | Reino | Hitos del reino como línea de tiempo: fundación, primer territorio consolidado, mejoras de | sin jugar |  |
| `REI-110` | Reino | Prioridad: guardar con *debounce* o al soltar, no en cada tecla (R18). S 2026-10-02 (`Nume | sin jugar |  |
| `REI-111` | Reino | Todos los `try/finally` de Reino con `catch` y `ErrorBanner` visible (R19). S 2026-10-01 ( | sin jugar |  |
| `REI-112` | Reino | Topes con `Enter` y confirmación visual (R20). S 2026-10-02 (mismo componente: ✓ al confir | sin jugar |  |
| `REI-113` | Reino | Sustituir los `<select>` nativos por los selectores del juego (R23). S 2026-10-02: nuevo ` | sin jugar |  |
| `REI-114` | Reino | Esqueletos de carga en lugar de "Cargando…" (R24). S 2026-10-02: componente `Esqueleto` (p | sin jugar |  |
| `REI-115` | Reino | Tooltips de explicación en cada indicador, rol y estado (R25). S 2026-10-02: los 8 indicad | sin jugar |  |
| `REI-116` | Reino | Declarar `xpGanada`, `nivelDiplomatico` y `stage` en `DiplomaciaResultado` (R4). S 2026-10 | sin jugar |  |
| `REI-118` | Reino | Súbditos como personas (Fase C del `0.3`, Q1-Q3 y Q7 de la usuaria, 2026-10-06): cada pobl | sin jugar |  |
| `REI-119` | Reino | Llegadas (Q4): una vez por semana, con cama libre, comida > 0, agua > 0 y felicidad ≥ 40,  | sin jugar |  |
| `REI-120` | Reino | Parejas y crías (Q5, como Medieval Dynasty): dos adultos del mismo pueblo con felicidad ≥  | sin jugar |  |
| `REI-121` | Reino | Salidas y muerte (Q6): con la felicidad del Reino 7 días seguidos por debajo de 20, cada s | sin jugar |  |
