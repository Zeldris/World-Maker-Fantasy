# Pruebas en la nube — hallazgos (2026-09-28, vivo)

Sesión de Claude en un contenedor en la nube: Postgres local + **Ollama simulado** (responde JSON
válido según el `format` de cada llamada, sin LLM real) + backend + frontend + Playwright. Todo lo
determinista (movimiento, colisiones, combate, misiones, viaje, inventario) se prueba de verdad; la
**calidad narrativa NO** (las narraciones que salen son del simulador).

Flujo acordado con Álvaro: **pruebas → apuntar aquí → plan (Opus) → implementación (Sonnet)**.
Este documento se sube a la rama `claude/wonderful-volta-662qt8` al cerrar cada tanda.

Partida de prueba: Gorhorn **Guerrero** (elegido por error — el Gorhorn real es **Cazador /
Domador**; las siguientes tandas usan una partida nueva con esa clase).

---

## A. Ya arreglado en esta sesión (commits en la rama, con test y verificado en vivo)

| # | Hallazgo | Commit |
|---|---|---|
| A1 | 5 tests de Ayuntamiento sembraban `mena-de-hierro`, slug que ya no existe (solo pasaban con la fila vieja en BD) | `ebd7832` |
| A2 | Encuentro con un RECURSO no detenía el trayecto y la tarjeta solo aparecía tras recargar | `bc1c63d` |
| A3 | Rechazo de recurso decía "se te ha adelantado / fuera de temporada" cuando faltaba nivel de oficio | `bc1c63d` |
| A4 | Tras Ignorar/cerrar, cada paso dentro del radio volvía a disparar el mismo encuentro (campo nuevo `Save.zonaUltimoEncuentro`, migración) | `846b2cb` |
| A5 | `restart` no limpiaba `zonaCaminoPendiente` | `846b2cb` |
| A6 | Con "X te corta el paso" pendiente se podía seguir caminando e "Ignorar" era huida gratis | `39dbcac` |
| A7 | Una oferta pacífica sin responder bloqueaba cualquier encuentro nuevo en toda la zona (ahora alejarse la descarta) | `39dbcac` |
| A8 | Una defensa (texto sin nombre del rival) sacaba al rival de `npcsInScene` → sin tirada y combate "caído" en backend a mitad de pelea | `587cf12` |
| A9 | "Firmeza Férrea" SIEMPRE bloqueada ("No hay ningún Nuente…"): tolerancia a erratas de alias chocaba con 38 palabras frecuentes (fuente, muerte, quien, busca, mercado…) | `f93430d` |
| A10 | Abrir combate desde Interactuar no limpiaba la oferta forzada (reaparecía tras recargar y bloqueaba encuentros) | `f93430d` |
| A11 | Si Interactuar fallaba, la tarjeta perdía `combateForzado`/`quienInicia` | `f93430d` |
| A12 | Salidas: `alcanzable` no se refrescaba al moverse (había que cerrar/reabrir el modal); ahora pulsar una salida lejana camina hasta ella y abre Viajar | `9f4aab7` |
| A13 | Log no bajaba a la última entrada cuando cargaban imágenes (quedaba ~1300px arriba tras recargar) | `29d3441` |
| A14 | Salidas del mismo octante apiladas en el mismo píxel (Pilares Rotos: 3 destinos en (760,40), 2 inalcanzables); ahora por rumbo real. Entrada al llegar = salida del último tramo | `9a91396` |

Suites tras los arreglos: backend 2701/2701 (hay tests intermitentes por BD compartida, ver B13),
frontend 229/229, `tsc` limpio en ambos.

---

## A2. Cerrado en la tanda de implementación (2026-09-28, `plan-cierre-hallazgos-2026-09-28.md`)

Verificado con tsc + tests (suite completa del backend: 144 archivos / 2676 tests en verde con la
nueva configuración de B13; frontend 231). **Sin verificación en vivo** (Álvaro pidió parar las
pruebas y cerrar): conviene una pasada jugando en local. Las decisiones 🔵 se tomaron con el valor
por defecto del plan y son revisables.

| Hallazgo | Cierre | Commit |
|---|---|---|
| B25/B26 (Fases 1-3) | grupos reales, Cazar en la tarjeta, cobertura de Las Llanuras | 5f39880, dc4c802, 47b9a44 |
| Fase 4 + B20 | fuera Cazar/Minar/Talar/Recolectar/Recoger/Pescar/Buscar; barra inicial rellena | a0e1e93 |
| Fase 5 | cadáveres en el mapa con Saquear/Desollar; fuera el botón Saquear | 90121a9 |
| B2 🔵 | cada paso de zona = 1 min de reloj | 90121a9 |
| B3/B4 | "Ir hasta aquí" en la ficha del pin; botón "Cerrar" | 90121a9 |
| B5/B6 | salida sin visitar = "Camino hacia el {rumbo}"; flecha girada a su rumbo | 90121a9 |
| B7 | recurso por encima del nivel de oficio = avistamiento con motivo, sin oferta | 90121a9 |
| B30/B31 | los puntos no se amontonan; toparse con algo lo descubre | 90121a9 |
| B9 | abrir un combate forzado identifica al NPC | 42f785e |
| B10/B32 | Matar solo marca: el panel indica "Remata a X: elige un ataque" | 42f785e |
| B11 🔵 | Ataque Básico nunca bloqueado por energía; +1 energía/10 min fuera de combate | 42f785e |
| B12 🔵 | las acciones de combate no cuentan para el capítulo | 42f785e |
| B19 🔴 | habilidades de especialización al subir de nivel (+ reconciliación al cargar) | 42f785e |
| B22 | tramo gris previo al combate = "Fácil", como su tirada | 42f785e |
| B23 | fauna que "No ataca" se muestra revolviéndose, no "ataca y conecta" | 42f785e |
| B13 | vitest: tests con Postgres real en serie, el resto en paralelo | 6508574 |
| B14 | seed-catalog poda ItemCatalog retirados | 6508574 |
| B15 | imports/declaraciones sin usar fuera | 6508574 |
| B16 | aceptación de misión con el reloj ya avanzado | 6508574 |
| B24 | riel lateral sin etiquetas cortadas | 6508574 |
| B27 🔴🔵 | Goirnos al saquear humanoides (`goirnosDeBotin`) + UI de Vender en el Mercado | 6508574 |
| B28 | arquetipo predefinido neutro de clase (+ migración) | 6508574 |
| B21 | la caza sigilosa fallida ya no dice "fallo" junto a la tirada de apertura | este commit |
| B18 🔵 | propuesta de lore en `docs/borradores-opencode/propuestas-lore.md` (SIN REVISAR) | 521a8bd |

**Sigue abierto (decisión de Álvaro):** B1 — `ZonePoint` por partida en vez de global (cambio de
esquema grande que arrastra grupos, reconciliación y seed; fuera de esta tanda a propósito).
Pendiente de comprobar: tras Huir, el jugador reaparece en la entrada de la zona.

## B. Pendiente — apuntado, sin tocar (para el plan)

Gravedad: 🔴 bloquea/rompe · 🟠 mal comportamiento · 🟡 UX/pulido · 🔵 decisión de diseño/lore

### Movimiento en zona y viaje
- **B1 🔵 Posiciones de `ZonePoint` globales, no por partida.** Moverse en una partida mueve fauna/NPC
  de todas las demás. Solo se "resetea" porque `seed-catalog` corre en cada arranque. Decidir si
  pasan a ser por partida.
- **B2 🔵 Moverse por la zona no avanza el reloj.** Muchos pasos y encuentros siguen en "Día 1, 08:00".
- **B3 🟡 Pulsar un icono (fauna/recurso) abre su ficha en vez de caminar hasta él.** Propuesta: botón
  "Ir hasta aquí" en el modal de detalle.
- **B4 🟡 El modal de detalle de un pin tiene "Cancelar"** donde debería decir "Cerrar".
- **B5 🟡 Modal de salida a un sitio no visitado titula "???"** — mejor "Camino hacia el noreste"/teaser.
- **B6 🟡 El icono de salida siempre apunta a la derecha** — podría girar hacia su dirección real.
- **B7 🟠 Recurso de tier alto (Yerreo, tier 4) se ofrece como encuentro aunque sea imposible de
  recolectar** con el nivel actual — ahora al menos dice el motivo (A3). ¿Ofrecerlo solo como
  "descubrimiento"?
- **B8 ✅ comprobado, sin bug** Viaje largo por texto libre ("Viajo a los Restos de Maktor"): se
  interrumpió en Pilares Rotos ("algo te sale al paso"), el evento se resolvió, retomó el camino
  solo y llegó entrando por la salida correcta.

### Combate
- **B9 🟠 Nombre oculto incoherente:** el encuentro dice "Alguien se abalanza…", pero la ficha de
  combate muestra al instante "Orco enfurecido" con toda su historia (y la misión aceptada ya lo
  nombra).
- **B10 🟠 "Matar" convaleciente confuso (reproducir):** el primer "Matar" mostró "Combatir/Huir" pero
  dejó la tarjeta; al Combatir, habilidades bloqueadas con "Resuelve a los rivales convalecientes";
  hubo que pulsar "Matar" otra vez.
- **B11 🔵 Energía:** tras un combate queda 1/77 y no se recupera viajando (solo descansando, +30, 3h
  de cooldown). Con <5 ni siquiera se puede usar Ataque Básico — en un combate forzado solo queda
  defenderse.
- **B12 🔵 XP de capítulo:** cada 15 acciones = 500 XP, y cada botón de combate cuenta como acción.
  Una pelea casi completa un capítulo; da 5× lo que la misión del orco (100 XP).

### Técnico / deuda
- **B13 🟠 Tests intermitentes** al correr la suite completa (BD compartida en paralelo) — fallan 1-6
  distintos por corrida, pasan en solitario.
- **B14 🟡 `seed-catalog` nunca borra filas retiradas** de `ItemCatalog` (origen de A1): la BD local
  de Álvaro puede tener objetos fantasma.
- **B15 🟡 Imports/variables sin usar** (oxlint): `fijarEntradaAZona`, `parseActiveEffects`,
  `resolveInitialLocationId`, `huboMuerteEnEstaUbicacion` (turnResolution.ts), y 6 más en tests.
- **B16 🟡 Horas del log no monótonas:** el resumen de la conversación con Gistera (08:06) sale antes
  que la aceptación de la misión (08:04).
- **B17 ✅ falsa alarma** Panel "El mundo": sí recibe eventos del Cronista (uno a las 15:35 tras el
  viaje largo); simplemente son espaciados.

### Lore (para Álvaro, sin tocar `docs/rpgtarkor/`)
- **B18 🔵 "Bolco" (árbol de la Ciénaga) y "Bulco" (caracol de mar)** a una letra — confusión de
  nombres; en código queda excluido del matching (A9).

### Tanda 2 — Gorhorn Cazador → Domador (partida `cmulbkcro000w7d7l6aaucqvg`, nivel forzado por SQL)
- **B19 🔴 Las habilidades de ESPECIALIZACIÓN nunca se conceden al subir de nivel.** El bucle de
  subida (`turnResolution.ts` ~7044) solo usa `classAbilityUnlocksFor`, que filtra
  `!u.especializacion`. Domador (12 "Compañero cazador", 16, 24, 32, 40) solo recibe lo ya alcanzado
  en el momento de ELEGIR la especialización (`PATCH /especializacion`). Reproducido: Domador a
  nivel 11 → subida real a 12 en combate → sin "Compañero cazador". Afecta a todas las ramas.
- **B20 🟡 Partida nueva con la barra de habilidades vacía** ("Barra 1 (0)"): Cazar, Descansar,
  Viajar… solo accesibles desde el panel lateral Habilidades. Un jugador nuevo no los ve.
- **B21 🟠 Caza fallida con dados de éxito:** "Intento cazar… pero fallo" y justo debajo la tirada
  mostrada es 14+5=19 vs Fácil (12) = éxito — es la tirada de APERTURA del combate, no la de la
  caza, pero no se distingue.
- **B22 🟡 Etiquetas de dificultad distintas:** barra inferior "DIFICULTAD: TRIVIAL", tirada
  "Fácil (12)" para el mismo rival.
- **B23 🟠 Fauna inofensiva "ataca y conecta" en la UI sin hacer daño:** Ruptidar (`ataqueNatural`
  "No ataca…") sale como "RUPTIDAR ATACA CON 'MORDISCO DE SANGRE FRÍA'… Gana Ruptidar — el golpe
  conecta", pero el backend anula el daño (`npcAttackerIsInoffensive`). El jugador sigue Ileso 100.
  La tarjeta del intercambio y el nombre de la habilidad no deberían presentarse como ataque.
- **B24 🟡 Etiquetas del menú lateral cortadas** ("ompañeros", "nciclopedia").
- Especialización: modal lista → detalle → confirmación → persistente tras recarga ✔️.
- Caza: Explorar → elegir presa → caza sigilosa fallida → Combatir → Convaleciente ✔️.

- **B27 🔴 Sin fuente de ingresos para un jugador normal.** Partida nueva = 0 Goirnos; la ÚNICA
  vía de ganarlos es vender en el Mercado del Reino (`reino.ts` `mercado/vender`), que exige Reino
  fundado + tratado y cuyo botón "Vender" no tiene UI (TODO en `DiplomaciaMercadoSection.tsx`).
  Aprender oficio cuesta 10 Goirnos → un jugador sin reino nunca puede aprender un oficio nuevo.
  (El "🪙 50" del checklist 2026-08-31 se sembró a mano.)
- **B28 🟡 Cabecera de Estadísticas dice "Guerrero superviviente…"** aunque la clase elegida sea
  Cazador — es el `characterArchetype` fijo del personaje predefinido, no se adapta a la clase.
- **B29 🟠 Atacar por texto a fauna pacífica en escena no abre combate:** "Ataco al Gesgurio" con el
  Gesgurio adyacente → tirada + "+5 XP" y nada más. Hoy no hay forma desde el mapa de pelear contra
  fauna no agresiva (se resuelve con la Fase 2 del plan: "Cazar" en la tarjeta).
- Paneles recorridos sin errores (con recarga): Personaje/Equipo/Estadísticas, reparto de puntos de
  atributo (persistente ✔️), Inventario, Compañeros, Reino (vacío), Mapa (vista informativa),
  Diario, Misiones, Reputación (vacía), Enciclopedia.
- Captura: "🪢 Capturar en la zona" pide cuerdas ✔️; con cuerdas sembradas y Gesgurio convaleciente
  (`capturable: true`) — prueba del flujo completo pendiente de terminar tras las fases del plan.

### Tanda 3 — Fase 2 en vivo (Cazar desde la tarjeta, partida `cmul8w6vz00017dnjtogywkjw`)
- Tarjeta de fauna con Interactuar / **Cazar** / Ignorar ✔️; Cazar a un ×1 no débil abre el 1v1 ✔️.
  El 1v1 no descontaba el `ZonePoint` (el pin seguía tras matarlo) → arreglado en `caza.ts` + test.
- **B30 🟡 Grupos de la misma especie en la misma celda** al deambular (×4 y ×1 en 625,475): un pin
  tapa al otro.
- **B31 🟡 Pin "???"/"Todavía no lo has descubierto"** tras toparse con la especie (el log ya la
  nombra).
- **B32 🔴 Matar convaleciente (1v1) no cierra el combate** (= B10 reproducido): `combat/matar/ruptidar`
  → 200 y `targetedForKill=true`, pero sigue CONVALECIENTE, `pendingCombatNpcSlugs=["ruptidar"]`,
  Actuar deshabilitado; al recargar vuelve a ofrecer Combatir/Huir.
- Tras Huir, el jugador reaparece en la entrada de la zona (234,560): verificar si es lo esperado.

### Habilidades vs. mapa de zona (pregunta de Álvaro, 2026-09-28)

**Hallazgo base — B25 🔴 dos sistemas paralelos que no casan.** Los botones Cazar / Minar / Talar /
Recolectar hierbas / Recoger (`cazar/explorar`, `recolectar/*` → `candidateSourcesFor`) buscan por
**población regional**, sin mirar el mapa; el encuentro de zona (`/zona/mover` → Interactuar)
trabaja con **`ZonePoint`**. Visto jugando: Cazar en la Hondonada ofrece un Ruptidar que no está en
el mapa y NO ofrece el Gesgurio ×20 que sí está. Además el gate de cercanía que se diseñó para esto
(`zonePointMasCercano`/`RADIO_INTERACCION_PX`, zonaPosicion.ts) **no lo llama nadie**: desde
cualquier punto del mapa se caza/mina cualquier fuente de la región.

**B26 🔴 Grupos de fauna sin repartir** (bug del 2026-09-22 sigue abierto): `repartirEnGrupos` sin
ningún caller; en BD 7 puntos de fauna con `cantidad` 20 (tope) y ninguna especie repartida.
B25+B26 van juntos: con grupos reales en el mapa, "Cazar" puede salir de la tarjeta de encuentro
contra ESE grupo (combate múltiple si son varios) — idea ya anotada en el checklist (2026-09-22).

Cobertura real del mapa hoy (bloquea retirar botones sin más):

| Método | Fuentes | Con punto en mapa |
|---|---|---|
| CAZA | 30 | 20 |
| MINERIA | 8 | 5 |
| TALA | 6 | 4 |
| EXTRACCION (hierbas/recoger) | 26 | 15 |
| PESCA | 5 | **0** |
| BUSQUEDA | 1 | **0** |
| PASIVO | 3 | 3 |

31 de 67 Locations tienen algún `ZonePoint`; **36 no tienen nada en el mapa**.

Clasificación de las habilidades generales/profesión:

| Habilidad | Hoy | ¿La cubre el mapa? | Propuesta |
|---|---|---|---|
| Cazar | modal, población regional | Sí (fauna en mapa) — sin combate múltiple ni grupos | Mover a la tarjeta de encuentro ("Cazar") tras B26; retirar botón |
| Minar / Talar / Recolectar hierbas / Recoger | modal, población regional | Sí (RECURSO → Interactuar ya llama a `resolverRecoleccion`) | Retirar botones cuando toda fuente tenga punto; mientras, al menos gate de cercanía |
| Pescar / Buscar | modal | **No** (0 puntos) | Necesitan puntos en el mapa antes de retirar nada |
| Saquear | modal de cadáveres de la zona | Parcial ("Saquear todo" al acabar combate) | Pin de cadáver/botín en el mapa |
| Desollar | ya pasiva (aviso de escena) | — | Igual: pin de cadáver |
| Viajar | **deshabilitada** (exige montura, sin implementar) | Salidas del mapa (solo vecinos) + texto libre (rutas largas) | Decidir: ¿viaje largo desde el mapa de mundo? |
| Volver al campamento | modal | No | Mantener (viaje rápido) |
| Entregar | modal (dar objetos a compañeros) | No | Mantener, o desde el pin del compañero |
| Descansar / Curar / Comer-Beber | modales personales | No aplica | Mantener |
| Oficios de crafteo (tallar, trenzar, vendaje, infusión) | modal | No aplica | Mantener |
| Construir / Fundar / Ampliar ayuntamiento | reino | Parcelas solo en interiores | Revisar con Reino |

---

## C. Próximas tandas de prueba
1. Partida nueva Cazador → Domador: compañeros, captura, domesticación, grupos de combate.
2. Viaje largo con interrupciones (B8) y llegada.
3. Caza (`cazar/explorar` → combate múltiple), recolección, desuello.
4. Inventario/equipo, habilidades, misiones, enciclopedia, diario, reputación.
5. Reino: fundar, edificios, producción, diplomacia, mercado.
6. Muerte y reinicio.
7. Recorrido de cada pantalla con recarga (criterio obligatorio del checklist).
