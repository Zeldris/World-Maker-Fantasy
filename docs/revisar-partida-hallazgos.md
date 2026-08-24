# Revisar partida — hallazgos

Registro cronológico (más antiguo arriba, añadir SIEMPRE al final) de lo que se ha encontrado cada
vez que se ejecuta el runbook de `revisar-partida.md` sobre una partida real. Objetivo: antes de
reportar algo como "nuevo", mirar aquí si ya se vio y qué se decidió — evita re-investigar lo mismo
dos veces y deja claro qué clases de fallo ya tienen detector determinista y cuáles siguen abiertas.

Cada entrada: fecha, qué se detectó (cita textual si es narración), causa raíz, y estado.

---

## Índice

**2026-08-01**
- [descansar no curaba + objeto médico narrado sin usarse](#2026-08-01-descansar-no-curaba-objeto-médico-narrado-sin-usarse)
- [el orco ya muerto "volvió a aparecer"](#2026-08-01-el-orco-ya-muerto-volvió-a-aparecer)
- [auditoría completa de `pendingCombatNpcSlugs` ("al reiniciar me empieza en combate")](#2026-08-01-auditoría-completa-de-pendingcombatnpcslugs-al-reiniciar-me-empieza-en-combate)
- [arma equivocada en narración (dos rondas)](#2026-08-01-arma-equivocada-en-narración-dos-rondas)
- [narración autocontradictoria (esquiva + sangra en la misma frase)](#2026-08-01-narración-autocontradictoria-esquiva-sangra-en-la-misma-frase)
- [narración de combate anticipada en el turno de aceptar la misión de Gistera Koh](#2026-08-01-narración-de-combate-anticipada-en-el-turno-de-aceptar-la-misión-de-gistera-koh)
- [Hagar aparece de la nada y responde en vez de Gistera Koh](#2026-08-01-hagar-aparece-de-la-nada-y-responde-en-vez-de-gistera-koh)
- ["Los Restos de Maktor" enlazado al saquear (CONFIRMADO con captura)](#2026-08-01-los-restos-de-maktor-enlazado-al-saquear-confirmado-con-captura)
- ["Clan Serhu" enlaza al Campamento aunque nadie esté ahí](#2026-08-01-clan-serhu-enlaza-al-campamento-aunque-nadie-esté-ahí)
- [el tiempo de ficción no avanza durante el combate (por diseño, pero se siente roto)](#2026-08-01-el-tiempo-de-ficción-no-avanza-durante-el-combate-por-diseño-pero-se-siente-roto)
- [narración de ambientación repetida sin progreso tras el combate ("bucle")](#2026-08-01-narración-de-ambientación-repetida-sin-progreso-tras-el-combate-bucle)
- ["Las Agujas Imán" partido en dos, esta vez en el propio texto del jugador](#2026-08-01-las-agujas-imán-partido-en-dos-esta-vez-en-el-propio-texto-del-jugador)
- ["el cuerpo del múrgol" al decapitar al Orco Enfurecido](#2026-08-01-el-cuerpo-del-múrgol-al-decapitar-al-orco-enfurecido)

**2026-08-03**
- [auditoría "revisa todos los MD" (sincronización lore↔código) + "y el resto de zonas están bien?" (posiciones del mapa)](#2026-08-03-auditoría-revisa-todos-los-md-sincronización-lorecódigo-y-el-resto-de-zonas-están-bien-posiciones-del-mapa)
- [análisis completo backend/frontend (mejoras y huecos sin cubrir)](#2026-08-03-análisis-completo-backendfrontend-mejoras-y-huecos-sin-cubrir)

**2026-08-07**
- ["no aparece ningún recurso" recolectando en la Hondonada del Eco](#2026-08-07-no-aparece-ningún-recurso-recolectando-en-la-hondonada-del-eco)
- ["hielo sílice" narrado sin venir a cuento en combate (Orco Enfurecido)](#2026-08-07-hielo-sílice-narrado-sin-venir-a-cuento-en-combate-orco-enfurecido)
- [objetos recién recolectados "sin categorizar" en el Inventario](#2026-08-07-continuación-objetos-recién-recolectados-sin-categorizar-en-el-inventario)
- [la recolección no acumula, crea una fila nueva cada vez](#2026-08-07-continuación-la-recolección-no-acumula-crea-una-fila-nueva-cada-vez)
- [consumir un objeto médico/de energía no lo quitaba del inventario](#2026-08-07-continuación-consumir-un-objeto-médicode-energía-no-lo-quitaba-del-inventario)
- [el modal de "qué equipar" no mostraba ninguna estadística](#2026-08-07-continuación-el-modal-de-qué-equipar-no-mostraba-ninguna-estadística)
- [consumibles equipados "no salen en el inventario": SIN REPRODUCIR](#2026-08-07-continuación-consumibles-equipados-no-salen-en-el-inventario-sin-reproducir)
- [Minar/Talar sin ningún límite: recolección indefinida sin moverse](#2026-08-07-continuación-minartalar-sin-ningún-límite-recolección-indefinida-sin-moverse)

**2026-08-08**
- [repetición literal de la ambientación de "mañana" (`entorno.ts`)](#2026-08-08-repetición-literal-de-la-ambientación-de-mañana-entornots)
- [errores gramaticales sueltos del modelo en narración de combate/exploración](#2026-08-08-errores-gramaticales-sueltos-del-modelo-en-narración-de-combateexploración)
- ["orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo](#2026-08-08-continuación-orca-enfurecidael-orco-enfurecido-en-el-mismo-párrafo)
- ["Un pequeño raposa": género de artículo + animal inventado](#2026-08-08-continuación-un-pequeño-raposa-género-de-artículo-animal-inventado)
- ["buscar presas" no conecta nunca con un encuentro real](#2026-08-08-continuación-buscar-presas-no-conecta-nunca-con-un-encuentro-real)
- [género inconsistente de "Orco Enfurecido" ("la orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo)](#2026-08-08-continuación-género-inconsistente-de-orco-enfurecido-la-orca-enfurecidael-orco-enfurecido-en-el-mismo-párrafo)
- ["Un pequeño raposa": animal inventado fuera del roster](#2026-08-08-continuación-un-pequeño-raposa-animal-inventado-fuera-del-roster)
- [repetición literal de ambientación de "mañana": FIJADO](#2026-08-08-continuación-repetición-literal-de-ambientación-de-mañana-fijado)
- [capacidad de inventario por filas, no por cantidad](#2026-08-08-continuación-partida-reiniciada-capacidad-de-inventario-por-filas-no-por-cantidad)
- ["Cazar" narró la presa ya atrapada sin combate mecánico real](#2026-08-08-continuación-cazar-narró-la-presa-ya-atrapada-sin-combate-mecánico-real)
- [imagen ausente en la ficha de combate (sí sale en la narración)](#2026-08-08-continuación-imagen-ausente-en-la-ficha-de-combate-sí-sale-en-la-narración)
- [posible reaparición de la escena de Gistera Koh sin nombrarla](#2026-08-08-continuación-posible-reaparición-de-la-escena-de-gistera-koh-sin-nombrarla)
- [capacidad de inventario: bug real confirmado, no solo percepción](#2026-08-08-continuación-capacidad-de-inventario-bug-real-confirmado-no-solo-percepción)
- [Cazar ofrecía cualquier presa de la región, sin detección real](#2026-08-08-continuación-cazar-ofrecía-cualquier-presa-de-la-región-sin-detección-real)
- [Hagar alucinado por SEGUNDA vez, ahora con NpcState real corrompido](#2026-08-08-continuación-hagar-alucinado-por-segunda-vez-ahora-con-npcstate-real-corrompido)
- [fauna sin arma pierde su ataque real en combate ("el orco lanudo")](#2026-08-08-continuación-fauna-sin-arma-pierde-su-ataque-real-en-combate-el-orco-lanudo)
- [el modelo podía autoconcederse hito "capitulo" (500 XP, el tope absoluto)](#2026-08-08-continuación-partida-reiniciada-el-modelo-podía-autoconcederse-hito-capitulo-500-xp-el-tope-absoluto)
- [hueco de gerundios en los detectores de golpe prematuro/fantasma](#2026-08-08-continuación-hueco-de-gerundios-en-los-detectores-de-golpe-prematurofantasma)
- ["+525 XP" seguía viéndose: pendiente de reiniciar backend, no bug nuevo](#2026-08-08-continuación-525-xp-seguía-viéndose-pendiente-de-reiniciar-backend-no-bug-nuevo)
- [Gistera Koh reaparece sin nombrarse, tercera vez confirmada](#2026-08-08-continuación-gistera-koh-reaparece-sin-nombrarse-tercera-vez-confirmada)

**2026-08-11**
- [pruebas por API tras el rediseño de combate (fuera de combate a propósito)](#2026-08-11-pruebas-por-api-tras-el-rediseño-de-combate-fuera-de-combate-a-propósito)
- [misiones "conseguir X" nunca se cierran si el objeto viene de Minar/Talar/Desollar/Cazar](#2026-08-11-continuación-misiones-conseguir-x-nunca-se-cierran-si-el-objeto-viene-de-minartalardesollarcazar)
- [el objeto recién crafteado sale "sin categorizar" (regresión parcial del fix de 2026-08-07)](#2026-08-11-continuación-el-objeto-recién-crafteado-sale-sin-categorizar-regresión-parcial-del-fix-de-2026-08-07)
- [segunda tanda: reino, capítulo, muerte definitiva, despiece (sin bugs nuevos)](#2026-08-11-continuación-segunda-tanda-reino-capítulo-muerte-definitiva-despiece-sin-bugs-nuevos)
- [tercera tanda: sesión (pausa/cancelar/huir), habilidades generales, construcción, validación de creación](#2026-08-11-continuación-tercera-tanda-sesión-pausacancelarhuir-habilidades-generales-construcción-validación-de-creación)
- [cuarta tanda: calidad de narración (petición explícita: "buscar mejoras... qué es necesario mejorar para que la narración sea de calidad")](#2026-08-11-continuación-cuarta-tanda-calidad-de-narración-petición-explícita-buscar-mejoras-qué-es-necesario-mejorar-para-que-la-narración-sea-de-calidad)

**2026-08-12**
- [Orco Enfurecido (ya MUERTO) narrado atacando a Gorhorn durante una cacería de Múrgol, en otra ubicación](#2026-08-12-orco-enfurecido-ya-muerto-narrado-atacando-a-gorhorn-durante-una-cacería-de-múrgol-en-otra-ubicación)

**2026-08-13**
- [Gistera Koh nombrada explícitamente en mitad de un combate, tras marcharse para siempre](#2026-08-13-gistera-koh-nombrada-explícitamente-en-mitad-de-un-combate-tras-marcharse-para-siempre)
- ["Misión completada" aparece en el log ANTES que la narración del turno que la resolvió](#2026-08-13-misión-completada-aparece-en-el-log-antes-que-la-narración-del-turno-que-la-resolvió)
- [continuación: "Vendaje improvisado" usado pero nunca consumido del inventario (CONFIRMADO en BD)](#2026-08-13-continuación-vendaje-improvisado-usado-pero-nunca-consumido-del-inventario-confirmado-en-bd)
- [continuación: arma narrada como lanzada en un ataque cuerpo a cuerpo, sin reflejo mecánico](#2026-08-13-continuación-arma-narrada-como-lanzada-en-un-ataque-cuerpo-a-cuerpo-sin-reflejo-mecánico)
- [continuación: cambio de equipo alucinado y contradictorio ("capa... como falda" → "capa... como asiento")](#2026-08-13-continuación-cambio-de-equipo-alucinado-y-contradictorio-capa-como-falda-capa-como-asiento)
- [continuación: palabra en inglés colada en narración española ("small clearing")](#2026-08-13-continuación-palabra-en-inglés-colada-en-narración-española-small-clearing)
- [continuación: aportes en vivo de la usuaria, 6 puntos (habilidad no-daño, crafteo, tiempo, energía, recolección, viaje/caza)](#2026-08-13-continuación-aportes-en-vivo-de-la-usuaria-6-puntos-habilidad-no-daño-crafteo-tiempo-energía-recolección-viajecaza)

**2026-08-14**
- [XP de recompensa de misión se narra pero no se aplica a `Save.xp` al completarse matando/decapitando al NPC objetivo](#2026-08-14-xp-de-recompensa-de-misión-se-narra-pero-no-se-aplica-a-savexp-al-completarse-matandodecapitando-al-npc-objetivo)
- [continuación: ronda de 6 hallazgos en vivo tras "revisar partida" (persistencia de ability-used, descubrimientos de Enciclopedia, categoría de Herborista, narración "inconsciente", renombrado Decapitar→Matar, Sella Marn/núcleo jugable)](#2026-08-14-continuación-ronda-de-hallazgos-en-vivo-tras-revisar-partida-6-puntos)
- [continuación: objetos narrativos "PASIVO" salían en cualquier sitio de la región, incluida la primerísima escena](#2026-08-14-continuación-objetos-narrativos-pasivo-salían-en-cualquier-sitio-de-la-región-incluida-la-primerísima-escena)
- [continuación: objetos recolectados de verdad descubiertos en BD, pero invisibles en la Enciclopedia (frontend nunca la refrescaba)](#2026-08-14-continuación-objetos-recolectados-de-verdad-descubiertos-en-bd-pero-invisibles-en-la-enciclopedia-frontend-nunca-la-refrescaba)
- [continuación: golpes_mutuos también dañaba con una habilidad defensiva sin `ATAQUE`](#2026-08-14-continuación-golpes_mutuos-también-dañaba-con-una-habilidad-defensiva-sin-ataque)
- [continuación: crafteo narraba con el modelo en vez de la frase determinista](#2026-08-14-continuación-crafteo-narraba-con-el-modelo-en-vez-de-la-frase-determinista)
- [continuación: combate "sin sentido" con Cruzavientos + reloj de mundo congelado en recolección](#2026-08-14-continuación-combate-sin-sentido-con-cruzavientos-reloj-de-mundo-congelado-en-recolección)
- [continuación: revisión centrada en narración — ataque a Múrgol narrado como si fuera contra Cruzavientos](#2026-08-14-continuación-revisión-centrada-en-narración-ataque-a-múrgol-narrado-como-si-fuera-contra-cruzavientos)

**2026-08-15**
- [rediseño de balance: la rueda de debilidades solo premia, nunca penaliza](#2026-08-15-rediseño-de-balance-la-rueda-de-debilidades-solo-premia-nunca-penaliza)

**2026-08-20**
- [escena de Gistera Koh: figura sin resolver en el acantilado, diálogo mal atribuido, Orco Enfurecido con caballo/armadura inventados](#2026-08-20-escena-de-gistera-koh-figura-sin-resolver-en-el-acantilado-diálogo-mal-atribuido-orco-enfurecido-con-caballoarmadura-inventados)

**2026-08-21 — auditoría de código (sin partida jugada, 5 agentes en paralelo back+front)**
- [despiece narrado por texto libre duplicaba botín en fauna cazada en grupo](#2026-08-21-despiece-narrado-por-texto-libre-duplicaba-botín-en-fauna-cazada-en-grupo)
- [cazar/recolectar/fundar reino seguían funcionando tras una muerte definitiva](#2026-08-21-continuación-cazarrecolectarfundar-reino-seguían-funcionando-tras-una-muerte-definitiva)
- [reiniciar partida dejaba una `Faction` fantasma que bloqueaba refundar el reino](#2026-08-21-continuación-reiniciar-partida-dejaba-una-faction-fantasma-que-bloqueaba-refundar-el-reino)
- [doble submit al equipar/desequipar objetos desde el modal de detalle](#2026-08-21-continuación-doble-submit-al-equiparsequipar-objetos-desde-el-modal-de-detalle)
- [panel de combate no se abría tras resolver una caza sin combate](#2026-08-21-continuación-panel-de-combate-no-se-abría-tras-resolver-una-caza-sin-combate)
- [renombrado PACIFICA→CONQUISTADA (reputation.ts, 2026-08-15) nunca propagado al frontend](#2026-08-21-continuación-renombrado-pacificaconquistada-reputationts-2026-08-15-nunca-propagado-al-frontend)
- [continuación: diálogo del jugador entre comillas bloqueado como "NPC inventado"](#2026-08-20-continuación-diálogo-del-jugador-entre-comillas-bloqueado-como-npc-inventado)
- [continuación: el "perseguidor" de Gistera Koh nunca se detecta en escena si no se le nombra "Orco enfurecido"](#2026-08-20-continuación-el-perseguidor-de-gistera-koh-nunca-se-detecta-en-escena-si-no-se-le-nombra-orco-enfurecido)
- [continuación: sugerencia "Acepto ayudarla y busco al que me persigue" — REGLA 4 comprimida + pronombre equivocado, y un bug propio de raíz verbal](#2026-08-20-continuación-sugerencia-acepto-ayudarla-y-busco-al-que-me-persigue-regla-4-comprimida-pronombre-equivocado-y-un-bug-propio-de-raíz-verbal-descubierto-al-arreglarlo)
- [continuación: reintento cuando la ÚNICA aceptación se descarta + segundo bug de raíz verbal en "Examina"/"Examinó"](#2026-08-20-continuación-reintento-cuando-la-única-aceptación-se-descarta-segundo-bug-de-raíz-verbal-en-examinaexaminó)
- [continuación: rediseño a sugerencias cortas + investigación 9B/4B (modelos qwen3.5 de "razonamiento")](#2026-08-2021-continuación-rediseño-a-sugerencias-cortas-investigación-9b4b-modelos-qwen35-de-razonamiento)

**2026-08-21**
- [mensaje de iniciativa + tirada de dados perdidos al recargar tras abrir combate](#2026-08-21-mensaje-de-iniciativa-tirada-de-dados-perdidos-al-recargar-tras-abrir-combate)

**2026-08-23**
- [Quio narrado en 3 ubicaciones distintas el mismo día](#2026-08-23-quio-narrado-en-3-ubicaciones-distintas-el-mismo-día)
- [Cruzavientos ataca repetidamente y nunca se narra quién es (reportado en vivo por la usuaria)](#2026-08-23-cruzavientos-ataca-repetidamente-y-nunca-se-narra-quién-es-reportado-en-vivo-por-la-usuaria)
- [Ruptidar "ataca" en combate pese a ser INOFENSIVO/"No ataca"](#2026-08-23-ruptidar-ataca-en-combate-pese-a-ser-inofensivono-ataca)
- [Ruptidar descrito como "insecto" con "alas rotas" (es un reptil sin alas)](#2026-08-23-ruptidar-descrito-como-insecto-con-alas-rotas-es-un-reptil-sin-alas)
- [continuación: "several pasos", inglés colado en narración española (2ª vez)](#2026-08-23-continuación-several-pasos-inglés-colado-en-narración-española-2ª-vez)
- [continuación: "reptil reptilise"/"reptil reptil reptil", errores gramaticales del modelo](#2026-08-23-continuación-reptil-reptilisereptil-reptil-reptil-errores-gramaticales-del-modelo)
- [XP de capítulo (+500×2) verificado — NO ES BUG](#2026-08-23-xp-de-capítulo-500×2-verificado--no-es-bug)

---

## 2026-08-01 — descansar no curaba + objeto médico narrado sin usarse

**Síntoma**: "descansar no funcionó, además consumió objetos sin pedirlo". Narración: *"Agarra la
cataplasma de salvia del polvo y aplica una fina capa en una herida abierta"* sin que la jugadora
lo pidiera y sin que el objeto se consumiera de verdad (seguía en el inventario).

**Causa raíz**: (1) `healCeilingFor` excluye a propósito INCAPACITADO/MUERTO de la curación por
descanso — **decisión de diseño confirmada, no es bug**, se queda así. (2) La narración alucinó el
uso de un objeto real sin que `detectMedicalItemUse` lo hubiera detectado en la acción del jugador.

**Estado**: FIJADO. `hasFalseItemUse` (narrador.ts) — post-hoc, por frase: verbo de consumo + nombre
real de un objeto médico/de energía que no se detectó usado este turno → reintento. Ver
`tarkor_curacion_incapacitado_y_objeto_falso_2026-08-01.md` (memoria).

---

## 2026-08-01 — el orco ya muerto "volvió a aparecer"

**Síntoma**: "el orco que metí volvió a aparecer". Con el Orco Enfurecido `MUERTO`+`saqueado` desde
hacía varios turnos, "Exploro la zona" narró: *"una mirada al oeste revela un conjunto de huellas
recientes... Gorhorn reconoce el paso de un orco — probablemente el Orco Enfurecido."*

**Causa raíz**: puramente narrativo (DB correcta). `npcSceneBlockFor` ya instruye "no lo narres
como amenaza activa... nunca un encuentro nuevo" para NPCs ya resueltos, pero el modelo la ignoró.

**Estado**: FIJADO. `hasResurrectedDeadNpc` (narrador.ts) — vocabulario de presencia activa/reciente
("huellas recientes", "reconoce el paso de", "sigue vivo", "reaparece"...) + nombre del NPC en la
misma frase → reintento. Ver `tarkor_npc_muerto_resucita_narracion_2026-08-01.md`.

**Efecto secundario descubierto al investigar** (no era solo narrativo): `agresivoSlugsInScene`
(turnResolution.ts) tampoco miraba `condicionFisica` — un NPC muerto podía reabrir
`pendingCombatNpcSlugs`/`combateIniciado` DE VERDAD, no solo en el texto. Ver siguiente entrada.

---

## 2026-08-01 — auditoría completa de `pendingCombatNpcSlugs` ("al reiniciar me empieza en combate")

**Síntoma**: "me pasa muchas veces que al reiniciar la partida me empieza en combate".

**3 causas raíz independientes, las 3 arregladas**:
1. `/saves/:id/restart` nunca limpiaba `pendingCombatNpcSlugs`/`pendingNpcAttack` — un combate sin
   cerrar de la partida ANTERIOR sobrevivía entero al reinicio.
2. `agresivoSlugsInScene`/`shouldForceCombat` (turnResolution.ts) no miraban `condicionFisica` — un
   NPC ya muerto podía reabrir combate de verdad si su alias seguía en `sessionFacts` recientes
   (mismo mecanismo que la entrada de arriba).
3. `GET /saves/:id` reconstruía `combateIniciado` desde el campo persistido sin filtrar por
   `saqueado` — última línea de defensa que tampoco existía.

**Estado**: FIJADO, las 3. Ver `tarkor_pendingcombatnpcslugs_auditoria_2026-08-01.md`. 424 tests
backend en el momento del fix.

---

## 2026-08-01 — arma equivocada en narración (dos rondas)

**Síntoma ronda 1**: Ataque Básico (mano principal garantizada por diseño) narrado con el arma
secundaria: *"le clava su cuchillo de hielo sílice"* llevando el hacha en la principal.

**Síntoma ronda 2** (misma partida, turno distinto): "Tajo Horizontal" (real de categoría HACHA)
narrado igual con el cuchillo: *"Gorhorn lanza su cuchillo de hielo sílice en un tajo amplio..."*

**Causa raíz**: el contextBlock "ARMA DEL PERSONAJE" lista las dos armas equipadas juntas sin decir
cuál usa ESTE golpe — con dos igual de válidas a la vista, el modelo elige mal.

**Estado**: FIJADO, las 2 rondas. Ronda 1: hint explícito solo para Ataque Básico (única tier con
mano garantizada por diseño). Ronda 2: `weaponCategoryForRealAbilityName` (weaponAbilities.ts) hace
el camino inverso nombre-de-habilidad → categoría → mano exacta, para cualquier real de categoría
no-dualWield. Ver `tarkor_arma_equivocada_narracion_2026-08-01.md`. 425 tests backend.

---

## 2026-08-01 — narración autocontradictoria (esquiva + sangra en la misma frase)

**Síntoma**: mismo turno de "Tajo Horizontal" de arriba: *"pero este esquiva fácilmente, dejando
una línea de sangre fría donde la hoja rozó su armadura."* — dice fallo (esquiva) e impacto
(sangre) en la misma frase, sea cual sea el resultado mecánico real.

**Causa raíz**: `hasFalseCombatHit` no lo detecta — su lista de palabras busca "rastro de
sangre"/"sangrando"/"sangra por", no "línea de sangre" (hueco de vocabulario, no de lógica).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `COMBAT_HIT_LEAK_REGEX` (narrador.ts) amplía la
lista con `l[ií]nea de sangre`. Test nuevo en `narrador.test.ts`.

---

## 2026-08-01 — narración de combate anticipada en el turno de aceptar la misión de Gistera Koh

**Síntoma**: al decir "Yo me encargaré de tu perseguidor" (sin haber pulsado Combatir todavía, sin
ningún intercambio mecánico este turno), la narración describe un choque real: Gorhorn lanza el
cuchillo, acierta, el orco huye cojeando — y dos turnos después el jugador vuelve a atacar al mismo
orco como si nunca se hubiera ido. **Confirmado en dos partidas seguidas** (mismo patrón el
2026-07-31 y el 2026-08-01) — deja de parecer casualidad del modelo.

**Causa raíz**: sin investigar a fondo todavía — candidato: falta un contextBlock que dirija
explícitamente la narración del turno de aceptación hacia "promesa a futuro", no "choque ya
resuelto", ya que `combateActivo`/`exchangeHappened` son `false` este turno (no hay grounding
determinista que lo contradiga, a diferencia del resto de fixes de hoy).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Nueva función `hasPrematureCombatResolution`
(narrador.ts), mismo patrón que `hasFalseCombatHit` — se activa con el flag `combatNotYetResolved`
(`npcsInScene.length > 0 && !exchangeHappened && executeTargets.length === 0`, la misma condición
que ya disparaba el contextBlock de aviso) calculado en turnResolution.ts. Si la narración describe
de todos modos un golpe conectado/un enemigo huyendo herido, se reintenta. Tests nuevos en
`narrador.test.ts`.

---

## 2026-08-01 — Hagar aparece de la nada y responde en vez de Gistera Koh

**Síntoma**: en el turno "Me acerco y le digo: 'Quién eres y qué buscas?'" (dirigido a la orca sin
nombre que se acerca corriendo, la futura Gistera Koh), tras la presentación real de Gistera Koh la
narración añade, pegado a lo mismo: *"Jajaja, quién lo diría, un día me encuentro a alguien valiente
lo bastante como para preguntarle a una orca marcada qué busca. Soy Hagar, minero de hielo sílice
del Clan Helsig..."* — un segundo personaje, sin relación con la escena, respondiendo como si él
fuera a quien se le preguntó. Hagar es un NPC "fuera del grafo v1" (vive en Cristal Helado, a
cientos de km) que solo debería aparecer si la partida lo trae de forma expresa.

**Causa raíz CONFIRMADA (no es solo narrativo, es mecánico)**: el alias de Hagar (`"hagar"`, 5
letras, entra en la tolerancia a erratas de `matchNpcAliases`) está a distancia Levenshtein 2 de
"**lugar**" (l→h, u→a) — una de las palabras más comunes del castellano. El primer hecho de sesión
de la partida ("...lo que sugiere que este **lugar** ha sido escenario de conflictos recientes")
lo contiene, y como los `sessionFacts` no caducan en esta partida (van todos en la ventana), Hagar
queda mecánicamente "en escena" (`npcsInScene`) desde el turno 1 y DURANTE TODA LA PARTIDA. Mismo
patrón exacto que el bug histórico "presas"~"brasas" (`docs/revisar-partida.md` § 3.7).

Verificado end-to-end con `detectNpcsInScene` real (no simulado) contra el estado exacto de la
partida en ese turno: devuelve `[Hagar]` — ni rastro de Gistera Koh (ella se gestiona aparte, fuera
de `npcsInScene`, ver el "encuentro guionizado" de `turnResolution.ts`). Como no hay objetivo citado
entre comillas, `dialogueTarget = dialoguePartners[0]` (turnResolution.ts:960) cae en Hagar por ser
el único NPC mecánicamente detectado — de ahí que le tocara "contestar" a él.

**Efecto secundario, más grave que el narrativo**: al estar permanentemente en `npcsInScene`, Hagar
también puede colarse como `candidateAttackTarget` (`npcsInScene[0]`) en cualquier turno de ataque
SIN objetivo citado entre comillas. Confirmado en la propia partida: su `NpcState` quedó con
`energia: 89` (nunca se toca ese campo salvo dentro de un intercambio de combate real resuelto
contra él, `turnResolution.ts` ~1670) tras el primer intento de "Tajo Horizontal" (turno sin comillas,
que además narrativamente fue un fallo) — ese intercambio se resolvió mecánicamente contra Hagar,
no contra el Orco Enfurecido, y solo no se notó porque fue un fallo (`condicionFisica` no cambia en
un fallo). Con más mala suerte, un turno de ataque sin comillas podría haber dañado/matado a un NPC
que ni siquiera está en la escena, dejando al enemigo real intacto.

**Fix propuesto (no aplicado todavía)**: mismo patrón ya usado para el bug histórico "hierro"~
"hiero" (`ATTACK_FUZZY_EXCLUSIONS`, npcScene.ts) — una lista de exclusión de palabras comunes que
nunca deben colar por tolerancia a erratas dentro de `matchNpcAliases` (empezando por `"lugar"`).
Alternativa más ancha: subir el umbral de longitud de la rama de tolerancia a erratas de 5 a 6+
letras (afecta a más alias, a revisar cuántos quedarían excluidos del todo).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts) —
`'lugar'` (y `'remato'`/`'remata'`/`'rematar'`/`'remate'`/`'rematan'`/`'rematamos'`, ver el hallazgo
del Múrgol más abajo) quitadas de la tolerancia a erratas de `matchNpcAliases`. Tests nuevos en
`npcScene.test.ts` (incluye uno confirmando que Hagar SÍ se sigue detectando por su alias real).

---

## 2026-08-01 — "Los Restos de Maktor" enlazado al saquear (CONFIRMADO con captura)

**Síntoma**: el texto determinista de saqueo — *"Gorhorn rebusca entre los restos y se hace con lo
siguiente: Maza orca, Amuleto de hueso."* — se renderiza en el frontend con "los restos" convertido
en un pin 📍 clicable a **"Los Restos de Maktor"**, una ubicación real del núcleo jugable (ruinas
del propio clan de Gorhorn) que no tiene NADA que ver con este saqueo (el combate fue contra un Orco
Enfurecido del Clan Serhu en la Hondonada del Eco). Confirmado con captura de pantalla de la usuaria.

(Primer intento de investigar esto, más arriba en este mismo documento, buscó mal — miró si el
Narrador con LLM mencionaba "Maktor" en el texto, y como el saqueo ya es 100% determinista desde
ayer, no encontró nada. El bug no está en la narración, está en el enlazado de texto clicable del
frontend.)

**Causa raíz CONFIRMADA**: `worldCatalog.ts:74`, la ubicación `restos-de-maktor` tiene el alias
`'los restos'` — elegido porque "ya es inequívoco por sí solo" (comentario del propio catálogo,
línea 73). Pero el propio motor de saqueo (`turnResolution.ts:1339-1340`) usa la frase fija
`"rebusca entre los restos"` para CUALQUIER saqueo del juego, de cualquier NPC, en cualquier
ubicación — contiene el alias exacto. El linker de texto clicable del frontend (`enciclopediaIndex.ts`)
lo encuentra y lo convierte en pin, sin mirar si tiene sentido en contexto. 100% reproducible: pasa
en TODOS los saqueos de la partida, no es un caso puntual — simplemente no se había mirado el
render visual hasta ahora, solo el texto plano del log.

**Fix propuesto (no aplicado)**: quitar `'los restos'` de los aliases de `restos-de-maktor` (se
queda con `'restos de maktor'`/`'ruinas de maktor'`, ya inequívocos de verdad) — es exactamente el
mismo criterio de "nunca un alias genérico sin calificador" que ya documenta
`docs/nuevo-elemento-catalogo.md` § 1, aplicado esta vez a una ubicación en vez de a un objeto/NPC.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Quitado `'los restos'` de los aliases de
`restos-de-maktor` (`worldCatalog.ts`) — se queda con `'los restos de maktor'`/`'ruinas de maktor'`.
Hallazgo lateral al arreglarlo: el propio archivo fuente YA tenía este alias corregido de una pasada
anterior (junto con `agujas-iman` y `campamento-serhu`, ver más abajo), pero nunca se había subido a
la base de datos local con `npm run seed-catalog` — el bug seguía reproduciéndose en partida por
eso, no porque el código estuviera mal. `territorios-clan-goshg` sí necesitaba el arreglo de verdad
(ver hallazgo de "Ciénaga Troncal" más abajo). `seed-catalog` corrido y verificado contra Postgres.

---

## 2026-08-01 — "Clan Serhu" enlaza al Campamento aunque nadie esté ahí

**Síntoma**: cualquier mención de "Clan Serhu" en la narración (p. ej. "una orca marcada del Clan
Serhu", "guerrero Serhu deshonrado" — hablando de la AFILIACIÓN de un personaje, no del sitio) se
enlaza como pin 📍 al "Campamento del Clan Serhu", una ubicación real y concreta donde nadie de la
escena actual está.

**Causa raíz CONFIRMADA**: `worldCatalog.ts:83`, la ubicación `campamento-serhu` tiene entre sus
alias `'clan serhu'` y `'los serhu'` — frases que suenan específicas pero en la práctica se usan
todo el rato para describir DE QUIÉN es alguien, no DÓNDE está. El enlazador de texto clicable del
frontend (`enciclopediaIndex.ts`) hace matching literal por substring/palabra, sin mirar contexto —
mismo mecanismo exacto que causó el bug de "Los Restos de Maktor" de la entrada de arriba, y la
misma familia (aunque por un camino distinto, sin fuzzy de por medio) que el bug histórico de
Torgash/Ulkha via "Serhu" en `matchNpcAliases` (backend, ya documentado en `docs/revisar-partida.md`
§ 3) — la lección de aquel bug (alias multi-palabra con el nombre de una facción es site de colisión
segura) no se aplicó todavía a este alias de ubicación.

**Fix propuesto (no aplicado)**: quitar `'clan serhu'`/`'los serhu'` de los aliases de
`campamento-serhu` — se queda con `'campamento serhu'`/`'campamento del clan serhu'`/
`'el campamento'`, que sí hablan inequívocamente del SITIO, nunca de la afiliación de alguien.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). El código fuente ya no tenía `'clan serhu'`/
`'los serhu'` (arreglado en una pasada anterior a esta sesión) — el bug seguía viéndose en partida
solo porque nunca se había sembrado en la base local (mismo hallazgo que "Los Restos de Maktor" de
arriba). `seed-catalog` corrido y verificado.

**Reproducido de nuevo (2026-08-01, partida reiniciada)**: misma frase exacta ("...en dirección a
la Ciénaga Troncal, perdiéndose pronto entre la maleza.") vuelve a enlazar mal — este SÍ necesitó
arreglo real de código (a diferencia del resto de esta entrada, `'la cienaga'`/`'la ciénaga'` seguían
en el archivo fuente). **FIJADO (2026-08-02)**: quitados de los aliases de `territorios-clan-goshg`
— se queda con `'cienaga troncal'`/`'ciénaga troncal'`/`'territorios del clan goshg'`/`'clan goshg'`,
ninguno prefijo de otro. `seed-catalog` corrido y verificado.

---

## 2026-08-01 — el tiempo de ficción no avanza durante el combate (por diseño, pero se siente roto)

**Síntoma**: reportado como "una de las cosas más graves". En la partida reiniciada, 14 turnos
seguidos (esquivar, atacar, usar habilidad, saquear ×2, rematar) quedan clavados en exactamente
"Día 1, 08:20" — ni un minuto de ficción avanza en todo el combate.

**Causa raíz — es diseño explícito, no bug de datos**: cualquier turno clasificado como banda
"instantánea" (ataque, diálogo, saqueo, rematar, aceptar una petición verbal — ver
`turnResolution.ts`/`turn.ts`, las redes de seguridad que fuerzan banda a "instantanea") usa
`computeDuration` → `{ minutos: 0 }` (`timedActions.ts:43`), a propósito, para que un solo golpe no
"cueste" tiempo de ficción. El problema es el efecto acumulado: una pelea de varios intercambios
seguidos no avanza el reloj NADA, cuando en la ficción debería llevar al menos unos minutos.

**Fix propuesto (no aplicado, es una decisión de diseño, no solo un bug)**: darle un suelo pequeño
(1-2 min) a los turnos de combate/diálogo en vez de 0 fijo, para que una pelea larga sí acumule
minutos reales de ficción sin dejar de sentirse "instantánea" turno a turno.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `computeDuration` (timedActions.ts) usa
`{ minutos: 1 }` en vez de `{ minutos: 0 }` para banda "instantánea" — un combate largo ya acumula
minutos reales de ficción en vez de quedarse clavado. Test nuevo en `timedActions.test.ts`.

---

## 2026-08-01 — narración de ambientación repetida sin progreso tras el combate ("bucle")

**Síntoma**: tras rematar al Orco Enfurecido, 4 turnos seguidos del jugador ("avanzo por una salida"
→ "Continuo por la cueva" → "Continuo hasta llegar a la siguiente localización" → "Busco enemigos a
mi alrededor") narran casi lo mismo (viento, olor a arcilla húmeda, luego olor a hierba seca) sin que
la ubicación cambie de verdad (`currentLocation` sigue siendo "La Hondonada del Eco" los 4 turnos) ni
aparezca nada nuevo — dan XP pero no aportan progreso real.

**Causa raíz (probable, no tan confirmada como las de arriba)**: el jugador nunca nombró un destino
concreto en el texto libre (ningún alias de `pozo-cauce-viejo`/`pilares-rotos`, los dos destinos
reales conectados a Hondonada del Eco) — el matcher determinista de viaje (`travel.ts`) exige un
nombre real para disparar, así que sin él el motor solo rellena con ambientación genérica, turno
tras turno, sin ningún gancho de contenido nuevo (`selectDiscoveries` no tenía nada más que ofrecer
en esta región/momento).

**Efecto secundario menor detectado de paso**: dos hechos de sesión casi duplicados seguidos
("El Orco Enfurecido ha sido derrotado y ahora está herido, ~50/100 de salud" / "El Orco Enfurecido
ahora está herido, ~50/100 de salud") — el filtro de similitud de `appendSessionFacts` no los
consideró lo bastante parecidos para descartar el segundo.

**Estado**: PARCIALMENTE FIJADO (2026-08-02, "ponte con todo"). El efecto secundario concreto (los 2
hechos casi duplicados) SÍ se arregló — `DUPLICATE_THRESHOLD` (worldFacts.ts) bajado de 0.7 a 0.65
(la pareja real de esta partida medía 0.69, justo por debajo del umbral viejo). Test nuevo en
`worldFacts.test.ts`. La causa raíz principal (frases de movimiento vagas — "avanzo por una salida",
"continuo por la cueva" — no disparan ni el matcher de viaje ni `detectsSearchIntent`, así que no
hay ningún gancho determinista que darle al Narrador) sigue sin un fix de código: sería un cambio de
contenido/UX especulativo (p. ej. nudge hacia los destinos reales) sin poder probarlo en vivo antes
de aplicarlo — se deja anotado para decidir con calma, no forzado bajo esta pasada.

**Actualización (2026-08-03)**: la parte de "no encontrar nuevos enemigos en las zonas" de la queja
original que motivó esta entrada queda cubierta por un sistema nuevo, ver
[16-poblacion-dinamica.md](16-poblacion-dinamica.md) — los encuentros ambientales ahora se
ponderan por población real (`WorldPopulation`, hasta ahora dato semilla nunca leído) y se filtran
por región, así que cazar mucho una especie en una zona la hace de verdad más rara ahí y matar
NPCs con nombre propio también depleciona la población de su raza; una especie puede extinguirse
de verdad.

**Actualización (2026-08-03), causa raíz principal FIJADA**: petición explícita de la usuaria
("con prompts tipo 'Avanzo a la siguiente zona'... que no te quedes encerrado en un bucle infinito
que no lleva a nada"). `travel.ts` gana `detectsVagueMovementIntent` — "avanzo"/"prosigo"/"me
adentro" solos, o "sigo"/"continúo" acompañados de una palabra de desplazamiento ("por &lt;lugar&gt;",
"camino", "adelante", "zona", "hasta llegar"...) — acotado para no confundir "sigo mirando"/
"continúo hablando" (no es movimiento) ni el idiom "continúo por ahora". `resolveTravel` prueba
primero el destino nombrado de siempre; si no hay ninguno Y el texto es movimiento vago, mira las
salidas reales desde la ubicación actual (`destinationsFrom`): con **exactamente una**, viaja ahí
sin ambigüedad real que resolver (el modelo sigue sin elegir nunca la ruta); con **2 o más**, no
adivina — `turnResolution.ts` añade un aviso reforzado forzando al Narrador a preguntar
explícitamente cuál de los caminos reales elige, en vez de narrar ambientación genérica otra vez.
Cualquiera de los dos casos rompe el bucle en como mucho 2 turnos (viaje inmediato, o pregunta →
el jugador nombra uno real → matchea). IMPLEMENTADO+VERIFICADO (`travel.test.ts`, tsc + 456/458
tests, los 2 que fallan son pre-existentes y no relacionados), pendiente confirmar en vivo. La
causa raíz de las frases de movimiento vagas queda así fijada — antes se documentaba como
"especulativo, sin poder probarlo en vivo"; con el nuevo detector y el fallback de salida única/
pregunta explícita, deja de ser especulativo.

---

## 2026-08-01 — "Las Agujas Imán" partido en dos, esta vez en el propio texto del jugador

**Síntoma**: la propia acción del jugador, "Avanzo a las Agujas Iman", se renderiza como "Avanzo a
[📍 Las Agujas Imán] Iman" — el pin se traga solo parte del nombre y deja "Iman" suelto repetido
justo después, igual que pasó con "Ciénaga Troncal" pero esta vez en el bloque "TU ACCIÓN", no en
la narración del Narrador.

**Causa raíz CONFIRMADA — mismo mecanismo exacto que el bug de "Ciénaga Troncal" de arriba**:
`worldCatalog.ts:106`, la ubicación `agujas-iman` tiene el alias `'las agujas'`, que es un PREFIJO
LITERAL de `'las agujas imán'`/`'agujas imán'` (aliases más específicos de la misma ubicación). El
enlazador (`enciclopediaIndex.ts`) escanea el texto de izquierda a derecha y usa el primer match que
encuentra en cada posición — como "las agujas" empieza a matchear 3 caracteres antes que "agujas
imán", gana él aunque sea menos específico, dejando "Imán"/"Iman" fuera del pin como texto suelto.
El comentario del propio archivo ("alternativa larga-a-corta para que gane la coincidencia más
específica") solo ordena la alternancia POR POSICIÓN — no evita que un alias corto que empieza antes
gane a uno más largo y específico que empieza después.

**Confirma que es un patrón sistémico, no un caso aislado**: van ya 2 ubicaciones con exactamente el
mismo tipo de colisión (alias corto = prefijo de uno más específico de la misma entidad) —
`ciénaga-troncal`~`la ciénaga` (dentro de `territorios-clan-goshg`) y ahora `agujas-iman`~`las agujas`.
Cualquier ubicación cuyo nombre completo empiece con un alias corto ya registrado por separado es
candidata al mismo bug — merece una pasada por TODO `worldCatalog.ts` buscando este patrón, no solo
arreglar estos dos.

**Fix propuesto (no aplicado)**: quitar `'las agujas'` de los aliases de `agujas-iman` (igual que se
propuso quitar `'la ciénaga'`/`'la cienaga'` de `territorios-clan-goshg`) — ya se queda con
`'agujas iman'`/`'agujas imán'`/`'rocas imantadas'`/`'piedras negras'`, todos inequívocos sin ser
prefijo de otro alias de la misma entidad.

**Estado**: FIJADO (2026-08-02, "ponte con todo"). Quitado `'las agujas'` de los aliases de
`agujas-iman` (`worldCatalog.ts`) — se queda con `'las agujas iman'`/`'las agujas imán'`.
`seed-catalog` corrido y verificado contra Postgres.

---

## 2026-08-01 — "el cuerpo del múrgol" al decapitar al Orco Enfurecido

**Síntoma**: turno final de combate, "Remato a Orco enfurecido, asestándoles el golpe de gracia
final." → *"Gorhorn golpea con fuerza al orco, acabando con él de un último puñetazo que hace
temblar la arcilla. El cuerpo del **múrgol** permanece inerte en el suelo, sin reacción alguna."*
El Múrgol es el ganado lanudo e inofensivo de los clanes de las Llanuras — no pintaba nada en este
combate. `WorldState`/`SessionFact` incluso registró un hecho aparte, "Múrgol muerto", generado por
la extracción de hechos de ese mismo turno.

**Causa raíz CONFIRMADA (misma familia que el bug de Hagar/"lugar" de arriba)**: el verbo **"Remato"**
— el que usa CUALQUIER acción de rematar/decapitar en el juego — está a distancia Levenshtein 2 de
"**rebano**" (uno de los alias del Múrgol: r-e-m-a-t-o vs r-e-b-a-n-o, 2 sustituciones). Verificado
ejecutando `matchNpcAliases`/`detectNpcsInScene` reales contra el turno exacto: el Múrgol entra en
`npcsInScene` solo por la palabra "Remato", sin que el jugador lo mencione ni esté cerca. Al entrar
en escena, su bloque de contexto ("PERSONAJE EN ESCENA: Múrgol... dócil, gregario...") se manda al
Narrador junto al del Orco, y el modelo mezcló las dos fichas al escribir el cadáver.

**Sin daño mecánico esta vez** (el Múrgol no tenía `NpcState` previo, así que no pudo "ejecutarse"
de verdad — solo contaminó el contexto de texto), pero es más grave que el de Hagar en alcance: como
"Remato" es el verbo fijo de cualquier decapitar/rematar del juego, esta colisión se repetirá SIEMPRE
que se remate a un enemigo, no es un caso puntual de esta partida.

**Fix propuesto (no aplicado)**: mismo patrón que el resto de esta familia — añadir "remato" (y
variantes: rematar/remata/rematé...) a una lista de exclusión de palabras que nunca deben colar por
tolerancia a erratas contra alias de un solo NPC, o quitar "rebano"/"rebaño" de la rama de tolerancia
a erratas (dejarlos solo como substring exacto, ya son bastante largos y específicos para no
necesitar fuzzy).

**Estado**: FIJADO (2026-08-02, "ponte con todo"). `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts,
compartido con el fix de Hagar/"lugar" de arriba) — `'remato'`/`'remata'`/`'rematar'`/`'remate'`/
`'rematan'`/`'rematamos'` quitadas de la tolerancia a erratas de `matchNpcAliases`. Tests nuevos en
`npcScene.test.ts` (incluye uno confirmando que el Múrgol SÍ se sigue detectando por su alias real).

---

## 2026-08-03 — auditoría "revisa todos los MD" (sincronización lore↔código) + "y el resto de zonas están bien?" (posiciones del mapa)

Dos pasadas de auditoría de solo lectura pedidas explícitamente por la usuaria, cruzando los 8
documentos de `docs/rpgtarkor/` y el mapa real de Azgaar (`docs/map/Helek_World.map`) contra el
código actual.

**Hallazgo 1 — alias nativo del Campamento Serhu nunca llegó al código**: `docs/rpgtarkor/areas.md`
documenta desde su redacción original que "el nombre del poblado es **Karot Veku** en lengua común
**Colmillo Ceniza**", pero `worldCatalog.ts` (`campamento-serhu`) solo tenía `'campamento del clan
serhu'` como alias — confirmado por `git log` que nunca existió en ningún commit. Detectado por la
propia usuaria jugando ("juraría que le habíamos puesto un alias").
**Estado**: FIJADO. Añadidos `'karot veku'`/`'colmillo ceniza'` a los aliases, re-sembrado el
catálogo y confirmado en Postgres.

**Hallazgo 2 — resto de la auditoría de lore↔código**: ubicaciones, NPCs con nombre propio, fauna/
flora e items de las Llanuras del Viento Rojo, todos en sincronía con `worldCatalog.ts`/
`berigLore.ts`. Único detalle informativo (no bug): `berigLore.ts` usa el slug `orcos-cienaga-troncal`
(variante racial/visual) mientras que `worldPopulation.ts`/`population.ts` usan `orcos-cienaga` —
dos sistemas independientes que no necesitan compartir slug, pero es una inconsistencia de nombres
a tener en cuenta si algún día se cruzan.
**Estado**: sin acción necesaria.

**Hallazgo 3 — bug de signo en la calibración del mapa (`LLANURAS_OFFSET_Y`)**: el offset de Y del
núcleo de Llanuras (`frontend/src/data/map.ts`) se despejó con el signo cambiado — el propio nodo
ancla (Campamento Serhu) no reproducía su propio punto de referencia real en Azgaar, quedando
proyectado 10 km más al sur de lo que la calibración pretendía. Error uniforme sobre los 12 nodos
del núcleo, no se notaba porque las posiciones relativas entre ellos seguían intactas.
**Estado**: FIJADO (`185.10536193847656 - 5` en vez de `+ 5`) — verificado que la proyección de
Campamento Serhu ahora reproduce el ancla exacta. `tsc -b` limpio en frontend.

**Hallazgo 4 — El Cruce de las Cenizas no llega a la frontera real con El Margen Silencioso**:
motivado por la usuaria ("a mi no me cuadró porque debería estar mucho más al sur, en la frontera
con el Margen Silencioso"). `docs/13-escala-del-mundo.md` § 2.2 (escrito 2026-07-18, antes de que
existiera el mapa real de Azgaar) asumía que el núcleo v1 era "su esquina suroccidental" dentro de
la región completa de Llanuras. Al proyectar las coordenadas del núcleo (ya con el signo corregido)
sobre el polígono real de Azgaar, el núcleo entero cae en la zona **norte-central** de la región,
no en la esquina suroeste — quedan **~90 km** de llanura sin detallar hasta el borde real dibujado
de El Margen Silencioso.
**Estado**: FIJADO documentalmente, sin tocar el mapa de Azgaar ni las coordenadas del núcleo (ambos
correctos en sí mismos — es la prosa de 2026-07-18 la que quedó desfasada por un mapa que no
existía todavía cuando se escribió). `areas.md` y `docs/13-escala-del-mundo.md` actualizados: el
Cruce de las Cenizas sigue siendo el límite del núcleo JUGABLE, pero el límite FÍSICO con El Margen
Silencioso queda más al sur, en el tramo "existe pero sin detallar" que la propia doc ya reservaba.

---

## 2026-08-03 — análisis completo backend/frontend (mejoras y huecos sin cubrir)

Auditoría de solo lectura pedida explícitamente ("análisis completo... buscando mejoras o huecos
que aún no hemos cubierto"), seguida de "arregla todo". Tres hallazgos, los tres arreglados:

**1. ~10 servicios de lógica pura sin ningún test** — `worldClock.ts` (avance de tiempo ficticio),
`baseAttack.ts`, `requisitos.ts`, `characterSummary.ts`, `secondaryAttributes.ts`, `retrieval.ts`
(solo las funciones puras), `itemTaxonomy.ts`, `classAbilities.ts`, `protectedFacts.ts`,
`discovery.ts` (solo `detectsSearchIntent`/`coreRegionOf`) — todos con ramas reales y cero
cobertura, pese a la cultura de testing ya establecida en el resto del proyecto.
**Estado**: FIJADO — 10 archivos de test nuevos (58 tests), `tsc --noEmit` limpio, `vitest run`
515/517 (los 2 que fallan son los mismos pre-existentes de siempre, sin relación).

**Hallazgo colateral real, encontrado escribiendo el test de `requisitos.ts`**: `Attribute` (7
jugables, dice.ts) y `SecondaryAttribute` (9 narrativos, secondaryAttributes.ts) comparten la clave
`'inteligencia'` desde el rediseño de atributos a 7 (antes, Inteligencia era puramente secundaria).
`checkRequisitos` (`atributo in attributes`) mira SIEMPRE primero el bloque jugable, así que un
requisito `{ inteligencia: N }` NUNCA puede leer el atributo secundario — `crafting.ts` (receta del
contraveneno de salvia y ceniza, tier 2) documenta expresamente la intención de comprobar la
Inteligencia SECUNDARIA, pero en la práctica siempre comprueba la PRIMARIA. Hoy es inofensivo para
Gorhorn (sus dos valores de Inteligencia coinciden, ambos 10), pero es una trampa latente para
cualquier personaje futuro donde diverjan. **No se ha arreglado** (es una decisión de diseño —
¿debería "Inteligencia" seguir existiendo como atributo secundario aparte, ahora que es jugable? —
no solo un bug de código) — documentado con un test explícito en `requisitos.test.ts` para que quien
lo toque no lo redescubra por sorpresa.

**2. Código muerto confirmado**: `isConsumibleSlot` en `backend/src/services/equipment.ts` —
duplicado exacto de `frontend/src/lib/equipSlots.ts` (que sí se usa desde `GameView.tsx`), nunca
llamado desde ningún sitio del backend, sin test.
**Estado**: FIJADO — función borrada del backend (la del frontend se queda, es la real).

**3. Sin `ErrorBoundary` de React**: cualquier fallo al renderizar dejaba la app entera en pantalla
en blanco, sin aviso ni forma de recuperarse salvo recargar a ciegas.
**Estado**: FIJADO — `frontend/src/components/ErrorBoundary.tsx` nuevo, envuelve toda la app en
`main.tsx` (fuera de `SessionProvider`, para capturar fallos también ahí) — pantalla de aviso con
botón "Recargar" en vez de blanco.

Verificación final: `tsc --noEmit`/`tsc -b` limpios en ambos, `oxlint` sin warnings en ambos,
`vitest run` completo backend (515/517) y frontend (18/18).

**Actualización 2026-08-03 (misma sesión, continuación) — el hallazgo colateral SÍ se arregló**:
la usuaria confirmó explícitamente "inteligencia es un atributo primario", resolviendo la
ambigüedad de diseño de arriba. Investigando más a fondo salió que no era una simple ambigüedad:
`frontend/src/types.ts` YA tenía `SecondaryAttribute` correcto (con `'sigilo'`, sin `'inteligencia'`)
desde el rediseño de atributos a 7 (2026-07-29) — es `backend/src/services/secondaryAttributes.ts`
el que se quedó con la lista vieja, nunca actualizado en aquella sesión (confirmado también por el
propio comentario de `npcScene.ts`: "sigilo bajó a secundario"). Efecto real: la barra de "Sigilo"
en Estadísticas llevaba desde 2026-07-29 mostrando 0 para Gorhorn (el JSON guardado nunca tenía esa
clave), mientras un `inteligencia` residual y ya sin sentido ocupaba su sitio.
**Estado**: FIJADO — `secondaryAttributes.ts`/`startingSecondaryAttributes.ts`/comentario de
`crafting.ts` corregidos (sigilo en vez de inteligencia), tests actualizados, `docs/rpgtarkor/
personajes.md` anotado con el intercambio de categorías, y la única partida real existente en la
DB local (Gorhorn) migrada a mano (`UPDATE` sobre `secondaryAttributes`) para que ya tenga
`sigilo: 5` en vez del `inteligencia: 10` residual. Verificado: `tsc`/`oxlint`/`vitest` limpios
(516/518 backend, 18/18 frontend).

---

## 2026-08-07 — "no aparece ningún recurso" recolectando en la Hondonada del Eco

**Síntoma**: la usuaria, probando el pop-up nuevo de recolección (Minar/Talar), reportó que en la
Hondonada del Eco no aparecía ningún recurso ni opción de Explorar.

**Causa raíz**: `WorldPopulation.distribucion` se siembra SIN artículo ("Llanuras del Viento
Rojo"), pero `Location.region` siempre lo lleva completo ("Las Llanuras del Viento Rojo") —
comparar uno contra otro directamente (`distribucion[region]`) fallaba en silencio para 3 de las 5
regiones reales del mundo (Llanuras del Viento Rojo, Margen Silencioso, Meseta del Orden — las
otras dos, Cristal Helado y Ciénaga Troncal, no llevan artículo y "funcionaban" por coincidencia).
Confirmado consultando la DB local real: las 3 filas `WorldPopulation` tipo `RECURSO` existían con
población > 0, pero nunca pasaban el filtro de región.

**Alcance real, más allá del síntoma reportado**: el mismo patrón roto vivía en dos sitios más,
ambos silenciosos porque son sugerencias opcionales sin ningún error visible si no encuentran nada:
la ponderación de encuentros ambientales por población real (`turnResolution.ts`, función de
2026-08-03, rota desde que se construyó) y quién aparece al interrumpirse un viaje largo
(`travelInterruption.ts`, función de 2026-08-05) — en este último, además INVERTIDO: los NPCs sin
fila de población colaban con un peso por defecto, mientras los que sí tenían datos reales quedaban
descartados por el propio bug.

**Estado**: FIJADO. `stripRegionArticle` (`population.ts`) nueva, aplicada en los 3 sitios
(`recolectar.ts`, `turnResolution.ts`, `travelInterruption.ts`). 2 tests de
`travelInterruption.test.ts` tenían el mismo error en su propio mock (clave con artículo) —
corregidos también. Verificado: `tsc` limpio, 678 tests backend en verde. Sigue sin commitear.

## 2026-08-07 — "hielo sílice" narrado sin venir a cuento en combate (Orco Enfurecido)

**Síntoma**: dos turnos seguidos de combate (08:18 y 08:19 de la misma partida) mencionan "hielo
sílice" sin relación con el arma o habilidad usada — 08:18: *"Gorhorn lanza un tajo certero pero el
Orco Enfurecido esquiva con una agilidad sorprendente, dejando un rastro de hielo sílice en su
piel"* (atacando con el hacha, no con el cuchillo de hielo sílice — y además se contradice: dice
"esquiva" pero luego narra una marca en la piel). 08:19, con una habilidad de furia/racial sin
relación con hielo: *"en un destello de hielo sílice, derriba a Orco Enfurecido..."*.

**Causa raíz**: sin confirmar — parece el modelo local enganchándose a un objeto del inventario
(el cuchillo de hielo sílice está equipado como arma secundaria) sin relación con la acción real,
más que un bug determinista con causa raíz clara. La frase de 08:18 no dispara `hasFalseCombatHit`
(el vocabulario "rastro de hielo sílice" no coincide con `COMBAT_HIT_LEAK_REGEX`, pensado para
"rastro de sangre").

**Estado**: PENDIENTE, sin arreglar — un solo caso no basta para diseñar un detector nuevo sin
riesgo de falso positivo (mismo criterio que la "maza mal atribuida" de la auditoría 2026-07-31).
Si se repite, anotar aquí el segundo caso para diseñar el detector con confianza.

## 2026-08-07 (continuación) — objetos recién recolectados "sin categorizar" en el Inventario

**Síntoma**: capturas de pantalla del panel de Inventario mostrando "Piedra (3)" y "Leña de
matorral de cuerno" duplicados — una vez bien agrupados bajo "RECURSOS" (con icono real) y otra
vez bajo "SIN CATEGORIZAR" (icono de caja genérica).

**Causa raíz**: NO son filas duplicadas de verdad (confirmado consultando la DB: 4 filas reales
`InventoryItem`, todas con `catalogSlug` correcto, de 2 recolecciones reales distintas hechas
~7 minutos aparte). Es un fallo de categorización: `InventoryItem` no guarda ninguna columna
`tipo` — se calcula al vuelo en `GET /saves/:id` (`detail.ts`) vía join con `ItemCatalog`. Ningún
sitio del motor de turnos que crea un objeto NUEVO (saqueo/crafteo/despiece/producción/recolección)
mandaba `tipo` en su respuesta inmediata — el frontend agrupa por `item.tipo` (InventarioPanel.tsx),
así que cualquier objeto recién conseguido caía en "sin categorizar" hasta la próxima recarga
completa de la partida, momento en el que `detail.ts` sí lo resuelve bien. Mismo patrón exacto que
ya se arregló DOS VECES antes para `equipSlot` (2026-07-30) y `effectKey` (2026-08-06) — `tipo` se
quedó fuera en ambos arreglos.

**Estado**: FIJADO. `tipo` añadido a `NewInventoryItemInfo` (turnResolution.ts, los 5 sitios que
crean objetos) y a `NpcItemInScene`/`buildNpcInScene` (npcScene.ts, saqueo) y al endpoint de
recolección (`recolectar.ts`) — hardcodeado a `'RECURSO'` en despiece/recolección (siempre lo son
por diseño), tomado del catálogo cuando está disponible en saqueo/crafteo, `null` en objetos
narrativos sueltos sin `catalogSlug` (producción/newItem del modelo). Verificado: tsc limpio en
los dos lados, 678 tests backend + 18 frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — la recolección no acumula, crea una fila nueva cada vez

**Síntoma**: mismo screenshot de arriba, tras el primer arreglo — ya categorizado bien, pero
"Piedra (3)" y "Leña de matorral de cuerno" seguían apareciendo DOS veces cada uno en vez de sumar
a "Piedra (6)".

**Causa raíz**: `POST /saves/:id/recolectar/confirmar` creaba siempre una fila `InventoryItem`
nueva, sin comprobar si el jugador ya tenía una pila del mismo `catalogSlug` a la que sumar. El
propio proyecto ya tiene el patrón correcto para esto (cantidad en el nombre, `quantityOf`/
`baseNameOf` de `ingredients.ts`, usado por crafteo/construcción para CONSUMIR) — nunca se aplicó
en sentido contrario (ACUMULAR) en la recolección nueva.

**Estado**: FIJADO. `confirmar` ahora busca una fila existente sin equipar del mismo `catalogSlug`
antes de crear; si existe, suma la cantidad y actualiza su nombre en vez de crear una fila nueva
(también dentro de una misma petición, si dos selecciones distintas producen el mismo objeto).
Respuesta extendida con `updatedItems` (mismo patrón que `removedInventoryItemIds`/
`updatedInventoryItems` ya resuelve para crafteo/construcción) para que el frontend actualice la
pila existente en su estado local en vez de solo añadir. Verificado: tsc limpio, 679 tests backend
(+2 nuevos) + 18 frontend en verde. Sigue sin commitear.

**Nota**: las 4 filas ya creadas en la partida real de la usuaria ANTES de este arreglo (2×
"Piedra (3)", 2× "Leña de matorral de cuerno") no se fusionan solas — el fix solo evita NUEVOS
duplicados. Pendiente: preguntar si quiere que se fusionen a mano en su partida actual, o dejar que
se auto-corrija la próxima vez que recolecte cada uno (se sumará sobre una de las dos filas
existentes, quedando 3 en vez de 2 hasta que se recoja una tercera vez).

## 2026-08-07 (continuación) — consumir un objeto médico/de energía no lo quitaba del inventario

**Síntoma**: "he consumido una ración de comida y no ha desaparecido del inventario" — la usuaria
confirmó que ya le había pasado lo mismo antes en combate.

**Causa raíz**: grave, y llevaba ahí desde que existe el sistema de fatiga (2026-07-29).
`detectMedicalItemUse`/`detectEnergyItemUse` (itemReference.ts) decidían correctamente el efecto
mecánico (curar hasta X / restaurar N de energía) según qué objeto real nombraba la acción, pero
**ningún sitio del motor de turnos borraba ni reducía la fila `InventoryItem` correspondiente** —
el efecto se aplicaba, el objeto se quedaba para siempre, reutilizable sin límite. Confirmado
contra la DB real: "Raciones de viaje" y "Cataplasma de salvia del polvo" de la partida de la
usuaria, ambas con `curaEnergia`/`curaHasta` reales en catálogo, `slot: null`, nunca borradas.

**Estado**: FIJADO. Los dos detectores ahora devuelven también el `id` real de la fila que
matcheó (antes solo el valor derivado). Dentro de la transacción, revalidado contra
`freshInventoryRows` (mismo criterio anti-carrera del resto del archivo) y consumido de verdad:
borra la fila si era la última unidad, reduce el sufijo de cantidad si quedan más (`quantityOf`/
`baseNameOf`, mismo patrón que crafteo/construcción). Verificado: tsc limpio, 682 tests backend
(+7 nuevos) + 18 frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — el modal de "qué equipar" no mostraba ninguna estadística

**Síntoma**: "al equipar cuando eliges que poner no estan saliendo las stats de lo que llevas
equipado y de lo que puedes equipar".

**Causa raíz**: confirmado en el código — `DetailModal.tsx`, rama `slotManager`, nunca renderizaba
`statBonuses` ni para el objeto puesto ahora mismo ni para ninguna de las opciones candidatas
(a diferencia de la ficha de un objeto suelto y de las tarjetas del panel de Inventario, que sí lo
hacen). Imposible comparar qué conviene equipar sin recargar mentalmente qué bonus tenía cada cosa.

**Estado**: FIJADO. Añadidos los mismos badges de `statBonuses` (`+N Atributo`) que ya usa el resto
de la UI, tanto en la tarjeta de "puesto ahora mismo" como en cada fila de opción candidata.
Verificado: tsc -b limpio, 18 tests frontend en verde. Sigue sin commitear.

## 2026-08-07 (continuación) — consumibles equipados "no salen en el inventario": SIN REPRODUCIR

**Síntoma**: "los consumibles que me equipo por alguna razón al tenerlos equipados no salen en el
inventario".

**Investigado, no confirmado como bug de código todavía**: `InventarioPanel.tsx` agrupa TODO
objeto con `slot` no nulo (equipado, sea el tipo que sea) en su propia sección "Equipados" arriba
del todo — por diseño explícito, no debería desaparecer, solo cambiar de sección. La validación de
ranura (`equipSlotFamily`, equipment.ts) y el catálogo real (`equipSlot: 'CONSUMIBLE_1'` en
`racion-viaje`/`cataplasma-salvia`) se revisaron y son correctos. En la partida real de la usuaria,
en el momento de revisar, NINGÚN consumible estaba equipado (`slot: null` en ambos) — no se pudo
verificar el síntoma contra datos reales.

**Estado**: NO ES BUG — confirmado con capturas de pantalla completas (sin cortar por scroll):
"Raciones de viaje" y "Cataplasma de salvia del polvo" SÍ aparecen bajo "Equipados", justo al
principio de la sección, con el mismo badge "E" que el resto de objetos equipados. La primera
captura que dio pie a esta investigación estaba cortada por el scroll — no llegaba a mostrar el
principio de la sección "Equipados" (tampoco se veía "Arnés de cuero", equipado desde el inicio de
la partida, lo que ya lo delataba). El código funciona exactamente como está diseñado.

**Lo que SÍ era un bug real, visible en esa misma captura completa**: TODOS los objetos bajo
"Equipados" mostraban el mismo icono de espadas cruzadas, sin importar qué fueran de verdad
("Raciones de viaje", "Cataplasma de salvia del polvo" o "Tótem Maktor" equipados salían con
icono de arma). Causa: `ItemGrid` (InventarioPanel.tsx) forzaba el icono de arma para CUALQUIER
objeto con `slot` no nulo, en vez de usar `itemIcon(item.category)` como ya hace con los objetos
sin equipar. Mismo patrón roto en la ficha de detalle de un objeto suelto (`DetailModal.tsx`,
rama `item`).

**Estado**: FIJADO en los dos sitios — el icono ahora siempre refleja la categoría real del
objeto (arma/ropa/consumible/medicinal/cosmético...), tanto equipado como no; el badge "E" ya
existente sigue siendo la única señal de "está equipado". El paperdoll (`EquipoPanel.tsx`) no
tenía este problema — ahí el icono es intencionalmente el de la RANURA (consumible/casco/...),
diseño distinto y correcto. Verificado: tsc -b limpio, 18 tests frontend en verde. Sigue sin
commitear.

## 2026-08-07 (continuación) — Minar/Talar sin ningún límite: recolección indefinida sin moverse

**Síntoma**: "puedo darle a minar y que salga todo el rato 3 de piedra y añadir toda la piedra que
quiera indefinidamente dandole a la habilidad... recoger recursos en una misma zona ilimitadamente
sin tener que moverme de ella".

**Diagnóstico**: la población SÍ bajaba de verdad (confirmado contra la DB real: 500→477 tras
varias recolecciones, coincidiendo exacto con lo que había en el inventario) — no era un pozo
infinito, pero con 500-600 de población y sin ningún coste por uso (Minar/Talar son deterministas,
sin turno ni tirada), en la práctica se sentía indistinguible de infinito: se podía pulsar la
habilidad tan rápido como se quisiera, sin moverse, sin límite entre intentos.

**Decisión (consultada con la usuaria, opción recomendada elegida)**: cooldown real por fuente, no
solo un coste de tiempo — cada fuente recuerda cuándo se recolectó por última vez de verdad; hasta
que no pasa un tiempo real fijo, esa fuente concreta no vuelve a ofrecerse aunque le quede
población. Además, petición explícita de la usuaria en el mismo mensaje: "deberiamos tambien
añadir un texto de narracion (quizas que no dependa de la AI) para dejar escrito los recursos que
se han recoletado".

**Estado**: FIJADO. `WorldPopulation.lastHarvestedAt` nuevo (migración manual aplicada), cooldown
de 30 min reales (cifra de partida, ajustable) comprobado en el MISMO guard atómico que la
población (`poblacion: {gte}` + `OR: [{lastHarvestedAt: null}, {lastHarvestedAt: {lt: cutoff}}]`)
— dos selecciones de la misma fuente en una sola petición no se bloquean entre sí (el cooldown solo
se comprueba la primera vez que se toca esa fuente en la petición). El pop-up distingue "no hay
nada aquí" de "está agotado por ahora, vuelve más tarde". Registro escrito determinista añadido:
al confirmar una recolección con éxito, se crea un `LogEntry` real ("Gorhorn recolecta en la zona:
Piedra (3)...") sin pasar por Ollama ni por el Narrador, más un hecho de sesión para que el propio
Narrador lo sepa más adelante si hace falta. Verificado: tsc limpio en los dos lados, 685 tests
backend (+13 en recolectar.test.ts) + 18 frontend en verde (con `--no-file-parallelism` para
esquivar un flake preexistente de los tests de integración compartiendo Postgres real, sin
relación con este cambio). Sigue sin commitear.

## 2026-08-08 — repetición literal de la ambientación de "mañana" (`entorno.ts`)

**Síntoma**: 3 de las 4 veces que tocó franja "mañana" en la misma sesión (08:57, 09:57, 09:58,
10:28) salió la frase idéntica: *"El sol de la mañana pega bajo y de lado, alargando cada sombra
sobre la arena."*.

**Causa raíz confirmada leyendo el código**: `generateSurroundings` (`entorno.ts`) elige con
`Math.random()` puro, sin memoria del turno anterior, sobre una banca de solo 2 frases por franja
horaria para "mañana" — con 2 opciones y tiradas independientes, repetir 3 de 4 veces es
simplemente lo esperable estadísticamente (nunca se comprueba si coincide con lo último mostrado).
A diferencia de la narración de combate (que sí tiene anti-repetición con reintento, ver
`tarkor_antirepeticion_reintento_2026-07-31`), esta ambientación determinista no tiene ningún
mecanismo equivalente — tiene sentido, nunca hizo falta hasta que la banca por franja se quedó tan
pequeña.

**Fix propuesto, no aplicado todavía**: pasar el texto de la última ambientación mostrada (fácil de
tener a mano, ya se persiste como `LogEntry` de canal MUNDO) y volver a tirar si `pick(...)` repite
exactamente la frase de terreno o de franja anterior — mismo espíritu que el anti-repetición de
combate, más barato aquí porque no hace falta ni una llamada a Ollama (es solo re-tirar el dado
determinista). Alternativa más simple todavía: ampliar la banca de "mañana" (y revisar si alguna
otra franja se ha quedado igual de corta) de 2 a 4-5 frases, que ya bajaría mucho la probabilidad
de repetir sin tocar la lógica.

**Estado**: PENDIENTE — encontrado revisando la partida, sin aplicar fix a falta de luz verde.

## 2026-08-08 — errores gramaticales sueltos del modelo en narración de combate/exploración

**Síntomas concretos** (mismo tramo de partida, turnos ya narrados por el modelo, no por texto
determinista):
- 08:19: *"...en un destello de hielo sílice, **derriba a** Orco Enfurecido con una patada..."* —
  falta la contracción "al" (debería ser "derriba **al** Orco Enfurecido"). El mismo turno reincide
  además en el "hielo sílice" fuera de lugar ya registrado más arriba (mismo caso de siempre, no
  cuenta como tercer caso nuevo — es la misma frase de la misma sesión ya vista).
- 09:57: *"Bebe un poco de agua de la **cantea** que lleva atada a la muñeca..."* — "cantea" no es
  una palabra española real (probablemente cruce/alucinación con "cantimplora").
- 10:58: *"...su mirada **escanean** el entorno..."* — discordancia número sujeto/verbo ("su
  mirada", singular, con verbo en plural).
- 08:22 (más dudoso, a vigilar si se repite): *"Gorhorn clava su hacha... en el torso del orco,
  quien esquiva con una parada rápida y salvaje."* — mezcla en la misma frase un impacto directo
  ("clava... en el torso") con una esquiva, ambiguo/contradictorio según se lea.

**Causa raíz**: calidad de redacción del modelo local suelto, no un bug de código determinista con
un patrón claro y barato de detectar (a diferencia de anacronismo/npc-muerto/golpe-falso/repetición
de vocabulario, que sí tienen detectores deterministas con reintento). Un corrector gramatical
genérico sería una pieza nueva de infraestructura (otra pasada de detección + reintento, o una
segunda llamada a un modelo corrector) — no trivial, y con riesgo de falsos positivos si el
detector es simplista (regex de concordancia en español no es fiable en general).

**Estado**: PENDIENTE, registrado para tener referencia si se repite el patrón. No se propone fix
de código todavía — a decidir si merece la pena invertir en un corrector gramatical determinista/
con reintento o se acepta como ruido ocasional del modelo actual.

## 2026-08-08 (continuación) — "orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo

**Síntoma**: 08:16, mismo combate: *"Gorhorn se gira bruscamente hacia **la orca enfurecida** que
acaba de aparecer... pero **el Orco Enfurecido** ya está a menos de diez pasos..."* — femenino y
masculino para el mismo NPC en la misma frase/párrafo.

**Causa raíz confirmada leyendo el catálogo**: de los 13 NPC con nombre propio de `worldCatalog.ts`
(sin contar fauna), solo **uno** tiene `genero` puesto — Gistera Koh, arreglada el 2026-08-07
precisamente por este mismo bug (`tarkor_genero_npc_gistera_koh_2026-08-07`). "Orco Enfurecido" es
inequívocamente masculino (nombre, bio: "él mismo", "orco") pero se quedó fuera de aquel arreglo —
sin `genero`, `generoHintFor` (`npcScene.ts`) no añade ninguna pista de género al prompt, así que el
modelo queda libre de mezclar "orco"/"orca" a su aire.

**Alcance real más allá del síntoma reportado**: mismo hueco en el resto del roster con género
inequívoco por bio — al menos Guerrero orco rezagado, Oficial/Soldado de patrulla de la Concordia
(a confirmar si son ambiguos por diseño o no), General Vrask Ombra, Kael Dorn, Hagar, Torgash
(masculinos); Terk'ikar Ulkha, Archimagistrada Yovenne Tal, Sella Marn (femeninos). Dos plantillas
SÍ son ambiguas por diseño a propósito (alias con las dos formas): "Cazador/a Serhu" y "Peregrino/a
de los Túmulos" — a esas NO hay que ponerles `genero` fijo.

**Estado**: PENDIENTE. Fix de patrón ya validado (mismo que Gistera Koh) — añadir `genero: 'M'`/`'F'`
a cada NPC inequívoco del catálogo (empezando por Orco Enfurecido, el caso confirmado) y reseed. Sin
aplicar todavía, a falta de luz verde y de confirmar caso a caso cuáles son plantillas ambiguas.

## 2026-08-08 (continuación) — "Un pequeño raposa": género de artículo + animal inventado

**Síntoma**: 10:58, *"Un pequeño raposa, asustada, desaparece entre los matorrales de cuerno."*

**Dos problemas distintos**:
1. Gramatical: "raposa" es femenino ("la raposa") — debería ser "**una** pequeña raposa", no "un".
2. De grounding: "raposa" no existe en ningún sitio del catálogo/lore (`grep` sin resultados) — la
   fauna real y establecida de Las Llanuras del Viento Rojo es Aullador Rojo, Buitre Cenizo,
   Canizor, Corredor de Cauce, Corretolvas, Cruzavientos, Gargantúa de Ceniza, Múrgol, Rondador de
   Brasas, Salamandra de Escoria — ninguna es un equivalente de "zorro". El modelo se inventó un
   animal genérico del mundo real en vez de usar el roster real, el mismo tipo de fallo que ya se
   prohíbe explícitamente para materiales de arma/armadura (`narrador.ts`) pero nunca se extendió a
   fauna.

**Estado**: PENDIENTE. Sin detector/regla determinista todavía — a decidir si se extiende la misma
instrucción de "usa solo lo ya establecido" (hoy limitada a materiales) también a fauna/animales.

## 2026-08-08 (continuación) — "buscar presas" no conecta nunca con un encuentro real

**Síntoma**: 3 turnos seguidos (09:58, 10:28, 10:58) de "buscar presas"/"cazar" en la misma sesión
no produjeron nunca un encuentro real — solo prosa ambiental repetitiva y, en el último, un animal
inventado que desaparece sin más (ver hallazgo anterior). Ninguno enganchó con combate real pese a
que la fauna itinerante SÍ tiene población real y activa en esa región ahora mismo (confirmado en
el volcado: Cruzavientos/Corredor de Cauce/Gargantúa de Ceniza/Múrgol con `WorldPopulation` > 0).

**Causa raíz, leyendo el código**: por diseño (`harvest.ts`: *"el 'cazar' en sí lo resuelve el
combate"*) cazar debería derivar en un combate real contra fauna del catálogo, pero el único puente
hacia eso es la "sugerencia ambiental de encuentro" (`turnResolution.ts` ~L1191) — genérica, dispara
solo un 25% de las veces en CUALQUIER turno con la escena vacía (nada que ver con que el jugador
esté cazando de verdad), y es puramente opcional para el modelo ("úsala solo si encaja, ignórala si
no"). No hay ningún detector que reconozca "estoy intentando cazar" y refuerce/obligue a que el
encuentro sugerido sea real y del roster — así que en una racha de mala suerte con la tirada del
25% (o si el modelo decide ignorar la sugerencia), cazar se queda en pura ambientación sin salida,
indistinguible de "no funciona".

**Estado**: FIJADO (2026-08-08). Nueva habilidad general "Cazar" (mismo patrón que Minar/Talar):
abre `HuntSelectionModal` con la fauna real con población activa en la región actual
(`GET /saves/:id/cazar`), checkboxes sin cantidad (una especie es "sí/no", no hay stock que
repartir). Diseño de la resolución, decidido con la usuaria en la propia conversación:
- Una ÚNICA presa "muy débil" (nivel ≤ nivel del jugador − 2, mismo umbral que la banda "Fácil" de
  `difficultyHintFor`) ofrece una tirada de caza limpia SIN combate — % = `capturablePct` de
  catálogo (dato ya sembrado desde 2026-07-29 y sin ningún caller hasta hoy, pensado explícitamente
  para esto) + la destreza del personaje, tope 90. Si sale bien: narración determinista (sin IA,
  mismo criterio que recolectar.ts), la presa queda MUERTA sin pelear, población depleciona de
  verdad (`decrementPopulationOnDeath`).
- Elegir varias presas a la vez, o una sola que no sea lo bastante débil, o que la propia tirada de
  caza limpia falle: SIEMPRE combate real. Corrección de diseño importante hecha a media
  implementación: la primera versión abría el combate ella misma (escritura directa de `NpcState`/
  `pendingCombatNpcSlugs`, sin narración) — la usuaria corrigió: "cazar sí que fuerza una narración
  cuando eliges objetivos y esa narración inicia el combate". La versión final NO escribe nada de
  combate en el backend para este caso: solo valida y devuelve un `actionText` con los nombres
  citados entre comillas (p. ej. "Salgo a cazar y ataco a 'Múrgol', 'Corredor de Cauce'."), y el
  FRONTEND lo manda por el turno normal (`handleSubmit`) — la narración real y el
  `shouldForceCombat`/`detectNpcsInScene` ya existentes abren el combate exactamente igual que si
  el jugador lo hubiera escrito él mismo, sin duplicar ninguna lógica de combate nueva.
- Solo se admite una presa por ESPECIE por petición (no cantidad) — `NpcState.scope` es
  `Location.id` para una `PLANTILLA`, dos individuos de la misma especie a la vez en el mismo sitio
  violarían `@@unique([saveId, npcId, scope])` sin un rediseño mayor del modelo de encuentros.
  Combinar varias especies distintas no tiene ese problema y es justo lo que pide "combate contra
  tantos enemigos como selecciones de la lista".

Verificado: tsc limpio en los dos lados, 1379 tests backend (+8 en `cazar.test.ts`) + 18 frontend
en verde. Sigue sin commitear.

## 2026-08-08 (continuación) — género inconsistente de "Orco Enfurecido" ("la orca enfurecida"/"el Orco Enfurecido" en el mismo párrafo)

**Causa raíz confirmada**: de los 13 NPC con nombre propio de `worldCatalog.ts`, solo Gistera Koh
tenía `genero` puesto (arreglo de 2026-08-07) — nunca se propagó al resto del roster con género
inequívoco por bio.

**Estado**: FIJADO. `genero` añadido a los 6 casos con señal textual explícita en su propia bio
(nunca por heurística de nombre, mismo criterio ya establecido para este campo): Orco Enfurecido,
Guerrero orco rezagado, Mercader de paso, Hagar, Torgash → 'M' ("Orco de..."); Terk'ikar Ulkha →
'F' ("Orca del Clan Serhu"); Archimagistrada Yovenne Tal → 'F' (el propio título ya es la forma
femenina). Dejados SIN tocar a propósito: Cazador/a Serhu y Peregrino de los Túmulos (ambiguos por
diseño, alias con las dos formas), y Oficial/Soldado de patrulla, General Vrask Ombra, Kael Dorn,
Sella Marn (razas Goirnte/Nabieus sin ningún sustantivo de especie con género gramatical en su bio,
ni "él"/"ella" explícito — poner algo aquí sería adivinar, no leer un dato ya establecido).
`npm run seed-catalog` reejecutado para aplicar los cambios a la partida real. Verificado: tsc +
1379 tests backend en verde. Sigue sin commitear.

## 2026-08-08 (continuación) — "Un pequeño raposa": animal inventado fuera del roster

**Estado**: FIJADO. La instrucción ya existente que prohíbe inventar materiales de arma/armadura
(`narrador.ts`, `fixedInstructions`) se amplió con la misma regla para fauna: "usa solo fauna ya
establecida en este mundo... nunca un animal mundano del mundo real que no exista aquí (zorro,
ciervo, conejo, lobo, oso...)". El error de artículo/género ("un" en vez de "una") no tiene detector
determinista propio — con la fauna ya acotada al roster real por la nueva habilidad "Cazar" (ver
arriba) y este recordatorio de prompt, el caso concreto reportado no debería volver a darse.

## 2026-08-08 (continuación) — repetición literal de ambientación de "mañana": FIJADO

**Estado**: FIJADO (visto arriba como PENDIENTE, resuelto en la misma sesión). `generateSurroundings`
(`entorno.ts`) ahora recibe el texto del último `LogEntry` de canal MUNDO (`routes/entorno.ts` ya lo
leía para el corte por `timeLabel`) y reintenta hasta 5 veces si la tirada repite la misma frase
literal — sin bucle infinito: si de verdad no hay alternativa (banca de 1 sola frase, caso
`SIN_UBICACION`), acepta la repetición en vez de insistir para siempre. Verificado con test nuevo
(`entorno.test.ts`) que fuerza la coincidencia y comprueba el reintento, más el caso sin alternativa.

## 2026-08-08 (continuación, partida reiniciada) — capacidad de inventario por filas, no por cantidad

**Síntoma reportado**: "tengo 9 piedras y cuentan como 1 en el inventario" — la usuaria lo señaló
como error.

**No es un bug**: es la decisión de diseño explícita de la propia usuaria del 2026-08-07 ("el
inventario va a ser por slots y dependerá en parte de los stats de fuerza y constitución... un
slot = una fila de InventoryItem, no peso" — `inventoryCapacity.ts`). Una pila de 9 piedras es UNA
fila (`"Piedra (9)"`), así que cuenta como 1 slot a propósito, igual que en muchos RPG donde
apilar el mismo recurso no cuesta hueco extra. Confirmado que el código hace exactamente lo que se
pidió entonces, no lo que se podría estar esperando ahora al verlo en juego.

**Estado**: PENDIENTE de decisión — no se ha tocado nada. Si la usuaria prefiere que la cantidad
apilada SÍ cuente (p. ej. 9 piedras = 9 de los N slots), es un cambio de mecánica real a decidir
explícitamente, no un fix de bug.

## 2026-08-08 (continuación) — "Cazar" narró la presa ya atrapada sin combate mecánico real

**Síntoma**: "Salgo a cazar y ataco a 'Corretolvas'" abrió combate real (Corretolvas ILESO en la
base de datos, ningún golpe dado todavía — tirada de Destreza "Éxito con coste" fue la
clasificación genérica de la acción libre, no un intercambio de combate), pero la narración dijo
*"lanzando una astuta trampa que atrapa al Corretolva... Con el Corretolva ya inmovilizado, decide
registrar su cuerpo para encontrar algo útil"* — un desenlace que el turno todavía no había
decidido. Mecánicamente correcto (`CombatPanel` sí mostraba Corretolvas ILESO); la PROSA
contradecía esa mecánica.

**Causa raíz**: ya existía el detector exacto para esta clase de bug —
`hasPrematureCombatResolution`/`combatNotYetResolved` (2026-08-02, mismo hueco con vocabulario de
golpe/huida: "acierta", "huye cojeando"...) — pero su lista de palabras nunca cubría vocabulario de
captura/inmovilización, porque la habilidad "Cazar" no existía todavía cuando se escribió.

**Estado**: FIJADO. `PREMATURE_COMBAT_REGEX` ampliado con `atrap(a/ó)/atrapad[oa]`,
`inmoviliz(a/ó)/inmovilizad[oa]`, `captur(a/ó)/capturad[oa]`. Test nuevo con el texto real de este
bug. Verificado: 1380 tests backend en verde.

**Hallazgo colateral, no relacionado, no arreglado (un solo caso)**: la misma narración incluyó
*"coge la lanza corta de caza esgrimida por Hagar"* — Hagar es un NPC real del catálogo (amigo de
Gorhorn en Cristal Helado) que no tiene NINGUNA relación con esta escena ni con ese objeto
concreto; parece una alucinación pura del modelo tirando de un nombre real del lore sin venir a
cuento. Un solo caso no basta para diseñar un detector sin riesgo de falso positivo (mismo criterio
que el resto de esta lista) — anotado por si se repite.

## 2026-08-08 (continuación) — imagen ausente en la ficha de combate (sí sale en la narración)

**Síntoma**: la ficha de "Información" del enemigo en `CombatPanel` mostraba el placeholder
genérico (⚔️) para Corretolvas, mientras la MISMA especie sí mostraba su imagen real bajo la
narración del diario, unos párrafos más abajo en la misma pantalla.

**Causa raíz confirmada**: Corretolvas (como buena parte de la fauna) solo tiene subida la imagen
de su variante de sexo (`corretolvas-macho-banner.png`), no una imagen "neutra" en
`corretolvas-banner.png` — así que `fauna.imageUrls.banner` es `null` para estas especies. Este
hueco exacto ya se encontró y arregló el 2026-07-24 para el banner que aparece bajo la narración
(`mentionedEntityBanner.ts` § `resolveBannerUrl`, con su propio comentario citando el mismo bug con
Múrgol) — pero `CombatPanel.tsx` (escrito 4 días después, 2026-07-28) nunca se actualizó con el
mismo fallback: leía `imageUrls.banner` a secas, tanto en la ficha ampliada del enemigo como en la
miniatura del selector de objetivo.

**Estado**: FIJADO en los dos sitios de `CombatPanel.tsx` (ficha ampliada + miniatura del
selector), con el mismo fallback ya validado: variante de sexo → imagen base. Verificado: tsc -b
limpio, 18 tests frontend en verde. Nota: el mismo hueco podría existir en algún otro sitio del
panel de Enciclopedia que no se ha barrido a fondo — no reportado por la usuaria, fuera de alcance
de esta pasada.

## 2026-08-08 (continuación) — posible reaparición de la escena de Gistera Koh sin nombrarla

**Síntoma**: tras rematar al Orco Enfurecido, "Explorar la zona" narró: *"Una orca marcada del
Clan Serhu se acerca a Gorhorn con agitación, contando que algo la persigue"* — casi calcado a la
escena de introducción de Gistera Koh (misma partida, unos turnos antes), pese a que los hechos de
mundo ya establecen que "Gistera Koh se marchó hacia la Ciénaga Troncal... no volverá a aparecer".

**Por qué las redes de seguridad existentes no lo cazan**: la exclusión de Gistera Koh
(`tarkor_gistera_koh_despedida_2026-08-01`) opera sobre su `Npc` real — aquí el modelo no la
nombra, solo repite la misma escena con una orca sin nombre, así que ninguna detección por slug la
alcanza. `isTooSimilarToLast` tampoco, porque compara solo contra el texto del turno INMEDIATAMENTE
anterior, no contra hechos de varios turnos atrás.

**Estado**: PENDIENTE, sin fix — un solo caso, sin patrón determinista barato evidente (¿comparar
contra TODOS los hechos de sesión, no solo el último turno? riesgo real de falsos positivos con
escenas genuinamente similares pero no repetidas). Anotado para vigilar si se repite.

## 2026-08-08 (continuación) — capacidad de inventario: bug real confirmado, no solo percepción

**Corrección sobre el hallazgo anterior** ("capacidad de inventario por filas, no por cantidad —
NO ES BUG"): la usuaria matizó — "un slot pero lo que se acumule en él cuenta como slot... sino es
que podemos tener inventario infinito". No pedía cambiar "1 fila = 1 slot visual" (eso se queda
igual), sino que la CANTIDAD acumulada dentro de esa fila pese contra el tope, cosa que el código
no hacía: `recolectar.ts` comprobaba `InventoryItem.count()` (filas) contra `selections.length`
(número de selecciones, ni siquiera la cantidad pedida) — una vez existe una pila ("Piedra (1)"),
seguir recolectando solo incrementa su cantidad sin crear fila nueva, así que ninguno de los dos
números subía nunca. Inventario realmente sin límite para cualquier recurso ya poseído, confirmado
como bug real, no solo una decisión de diseño ya tomada.

**Estado**: FIJADO. Nueva `totalInventoryUnits()` (unidades reales sumando `quantityOf` de cada
fila, no 1 por fila) en `inventoryCapacity.ts` (backend y frontend, mismo criterio de duplicado a
propósito que el resto de fórmulas de esa carpeta). `recolectar.ts` ya no rechaza la petición
entera si no cabe (esto NO cambió: sigue "coger lo que se pueda", mismo criterio que el tope de
`HarvestYield.cantidad`/población) — ahora topa la cantidad real añadida por el espacio libre
REAL en unidades, dentro del propio bucle, restando lo ya usado a medida que se procesa cada
selección. `InventarioPanel.tsx` y el contador del pop-up de recolección (`HarvestSelectionModal`
vía `GameView.tsx`) también corregidos para mostrar unidades reales, no filas — antes mostraban
p. ej. "5/40" con 38 piedras acumuladas en 1 sola fila, mintiendo sobre cuánto quedaba libre de
verdad. Verificado: tsc limpio en los dos lados, 1386 tests backend (+4 en `inventoryCapacity.test.ts`,
+2 nuevos en `recolectar.test.ts`) + 18 frontend en verde.

## 2026-08-08 (continuación) — Cazar ofrecía cualquier presa de la región, sin detección real

**Síntoma**: el pop-up de Cazar mostraba cualquier especie con población real en TODA la región
(p. ej. "Las Llanuras del Viento Rojo" puede tener miles de individuos, `worldPopulation.ts`), sin
importar el punto exacto donde estuviera el jugador ni si de verdad había rastro de ella ahí ahora
— "podría pelear/cazar cualquier presa en cualquier zona". Petición explícita: mismo patrón que
Minar/Talar/Saqueo — detección determinista de lo que hay AHORA, con cantidades realistas ("2
Múrgol, 8 Corretolvas, 1 Gargantúa"), pudiendo no encontrar nada, como al buscar recursos.

**Diseño implementado**:
- Mismo flujo en dos pasos que recolección: `GET /saves/:id/cazar` comprueba primero si ya se
  "localizó" fauna en esta visita (hechos de sesión, reutilizando `detectHarvestSourcesInScene` de
  harvest.ts sin cambios — los mismos alias de despiece sirven para detectar fauna en escena); si
  no hay nada localizado, `puedeExplorar: true` en vez de la lista completa.
- `POST /saves/:id/cazar/explorar` — determinista salvo por una tirada real de qué se encuentra
  (nunca gasta turno): hasta 3 intentos, cada uno con un 35% de no encontrar nada (para que "no
  encuentras nada" sea un resultado real) y, si no falla, una tirada ponderada por población real
  (mismo peso ya usado por la sugerencia de encuentro ambiental, `pickAmbientEncounterCandidate`)
  sobre los candidatos reales de la región. Si las 3 fallan, no se localiza nada y no se escribe
  ningún hecho de sesión (se puede reintentar).
- La CANTIDAD mostrada ("avistados") nunca es la población mundial real (cientos o miles) ni una
  tirada que haya que recordar aparte — se deriva de `capturablePct` de catálogo (ya curado a mano
  por especie: 80 para Múrgol/dócil-común, 10 para Cruzavientos/Gargantúa/rara-peligrosa) dividido
  entre 10, topado por la población real restante — así baja sola a medida que se caza de verdad,
  sin inventar ni persistir un contador nuevo.

**Estado**: FIJADO. Verificado: tsc limpio en los dos lados, 1420 tests backend (+11 nuevos en
`cazar.test.ts`: `avistadosFor`, `rollSightings`, GET con/sin localización, POST /explorar con
éxito/fallo) + 18 frontend en verde. `HuntSelectionModal.tsx` ahora tiene el mismo botón "Explorar"
que `HarvestSelectionModal` y muestra "×N avistados" por especie. Sigue sin commitear.

## 2026-08-08 (continuación) — Hagar alucinado por SEGUNDA vez, ahora con NpcState real corrompido

**Síntoma**: en dos turnos de la partida real (uno narrando que Gorhorn coge una lanza "esgrimida
por Hagar", otro narrando "Gorhorn se gira hacia Hagar, quien lo observa con ojos preocupados")
Hagar apareció sin venir a cuento — vive en Cristal Helado, fuera del núcleo jugable actual, sin
ninguna relación con la Hondonada del Eco. Peor aún: el `NpcState` de Hagar en la partida real
quedó con `condicionFisica: HERIDO` y `energia: 89` — no solo una alucinación narrativa, un
intercambio de combate real (contra el Orco Enfurecido) le aplicó daño A ÉL en vez de al enemigo
de verdad.

**Causa raíz confirmada** (reproducido con `matchNpcAliases` contra los hechos reales de la
partida): esto es la MISMA clase de bug ya documentada y arreglada una vez el 2026-08-02 —
"lugar"~"hagar" (Levenshtein 2) — pero con una palabra NUEVA no cubierta entonces:
**"hablar"~"hagar" (Levenshtein 2: b→g, l→a)**. El propio bio de catálogo del Orco Enfurecido ya
dice *"ataca al primer contacto sin intentar hablar"* — un hecho de sesión con esa frase basta para
colar a Hagar en `npcsInScene` durante TODA la partida a partir de ahí (`kind: 'PRINCIPAL'` lo hace
candidato en cualquier sitio, sin ninguna acotación por región).

**Estado**: FIJADO. `'hablar'` añadido a `NPC_ALIAS_FUZZY_EXCLUSIONS` (npcScene.ts) — comprobado
que ninguna conjugación real (habla/hablo/hablan/hablando/etc.) está de verdad a distancia ≤2 de
"hagar" (solo el infinitivo lo está), así que no hace falta excluir más que esa forma. Test nuevo
con el texto real del bio de Orco Enfurecido. El `NpcState` corrompido de Hagar en la partida real
se ha borrado (nunca estuvo realmente en la escena). Verificado: 1422 tests backend en verde.

## 2026-08-08 (continuación) — fauna sin arma pierde su ataque real en combate ("el orco lanudo")

**Síntoma**: un Múrgol (fauna dócil, cuadrúpedo lanudo, `ataqueNatural`: "Topetazo torpe con su
cornamenta ramificada, casi siempre sin intención real de dañar") se narró repetidamente como
*"el orco lanudo"*/*"orco enmarañado"* dando *"zarpazos"* — confundiendo su especie (fauna vs. una
persona orca) Y su forma de atacar (garras en vez de cornamenta).

**Causa raíz confirmada leyendo el código**: `baseAttackFor` (baseAttack.ts) SÍ calcula bien la
descripción real ("Topetazo torpe...") cuando no hay arma — pero `npcCombatAbilitiesFor`
(npcCombatAbilities.ts) construía el objeto `NpcCombatAbility` sin ningún campo `description`,
descartándola en el acto. El único dato que llegaba después al Narrador
(`exchangeNarrationBlock`/`PendingNpcAttack`, turnResolution.ts/combatExchange.ts) era el NOMBRE de
la habilidad — siempre literalmente **"Ataque base"**, idéntico para cualquier especie desarmada,
sin ninguna pista de cómo ataca de verdad esta en concreto. Sin nada que agarrar, el modelo cayó en
vocabulario genérico de combate orco (mucho más presente en el resto de la partida) en vez de usar
el dato real ya calculado y disponible.

**Alcance real**: afecta a CUALQUIER combatiente sin arma cuyo nombre de habilidad no sea ya
descriptivo por sí mismo — todas las habilidades de clase/raciales SÍ tienen nombre propio
("Puño de Hierro", "Furia de Maktor"), así que el hueco real es sobre todo fauna sin arma
(la mayoría del bestiario) usando el "Ataque base" genérico.

**Estado**: FIJADO. `description` añadido a `NpcCombatAbility` (npcCombatAbilities.ts) y
propagado en los 6 sitios que construyen una (Ataque base, habilidad de clase, racial de
ataque/defensa, racial de fauna, Esquivar/Defenderse genéricos) — nunca se pierde de nuevo.
`exchangeNarrationBlock`/`PendingNpcAttack.abilityDescription` (combatExchange.ts/
turnResolution.ts) ahora la incluyen junto al nombre en el contexto que recibe el Narrador. Test
nuevo reproduciendo el caso real del Múrgol. Verificado: tsc limpio, 1422 tests backend + 18
frontend en verde.

**Hallazgos colaterales de la misma partida, sin arreglar (criterio de "un solo caso, sin patrón
barato" de siempre)**:
- El Orco Enfurecido (bio: "ataca al primer contacto sin intentar hablar", AGRESIVO) se narró
  suplicando piedad ("¡No me mates, te lo ruego!") y retrocediendo defensivamente — contradice de
  frente su propia caracterización ya establecida. Un solo caso.
- "El metal partierto"/"la maza partierta" — palabra inventada (ni "partido" ni ninguna forma real
  española), aparece dos veces con género distinto en el mismo combate. Ruido del modelo, sin
  patrón claro que detectar.
- Un turno de esquiva simple concedió +500 XP (vs. los +25 habituales de cada intercambio) — el
  modelo decide libremente cuándo marcar un "hito" (descubrimiento/objetivo), y aquí pareció
  sobrevalorar una esquiva normal como logro mayor. Sin forma barata de validar "¿de verdad merecía
  esto un hito?" contra ningún dato mecánico real — se deja como observación, no como bug con fix.

## 2026-08-08 (continuación, partida reiniciada) — el modelo podía autoconcederse hito "capitulo" (500 XP, el tope absoluto)

**Síntoma confirmado**: el "+500/+525 XP en un turno normal de combate, justo al subir de nivel"
observado ya DOS veces en dos partidas distintas (visto antes como simple observación, "el modelo
decide libremente cuándo marcar un hito") resultó ser un bug real y serio, no solo una rareza del
modelo.

**Causa raíz confirmada leyendo el código**: `narrador.ts` § `HitoTipo` (el tipo que usa el propio
JSON del modelo) ya documenta la intención: *"'capitulo' no está aquí porque ese lo emite el
backend, no el modelo"* — pero `JSON.parse(text) as NarrationResult` es una ASERCIÓN de tipo, no
una validación real; TypeScript no protege nada en tiempo de ejecución. `turnResolution.ts` hacía
`if (narration.hito) hitos.push(narration.hito)` sin comprobar el valor contra nada — si el modelo
alucinaba igualmente la cadena `"capitulo"` en su JSON (probablemente por haberla visto mencionada
en el propio prompt/instrucciones), se aceptaba sin más. `xpForHitos` se queda con el máximo de
todos los hitos del turno (500, el tope absoluto reservado para cerrar un capítulo entero de la
historia) — un simple "ataco a un buitre" podía llevarse esa recompensa entera.

**Estado**: FIJADO. Lista blanca explícita en `turnResolution.ts`
(`HITOS_QUE_PUEDE_PROPONER_EL_MODELO = ['descubrimiento', 'objetivo_menor', 'objetivo_mayor']`) —
"capitulo" solo puede entrar ahora vía `chapterDue` (`claimChapterIfDue`, determinista, ya
existente, nunca decidido por el modelo). Sin test unitario dedicado (misma limitación de siempre:
esta lógica vive dentro de la función gigante `narrateAndPersistTurn`, no exportada ni testeada por
separado — se confirma jugando en vivo). Verificado: tsc limpio, 1424 tests backend en verde.

## 2026-08-08 (continuación) — hueco de gerundios en los detectores de golpe prematuro/fantasma

**Síntoma**: "Salgo a cazar y ataco a 'Buitre Cenizo'" (primer turno del combate, sin ningún
intercambio mecánico todavía — `NpcState` real del Buitre quedó en GRAVE, no MUERTO) se narró como
*"Gorhorn... da un fuerte golpe con la hacha, **atravesando** el cuello del ave... El buitrón cae
al suelo..."* — el mismo tipo de contradicción narración-vs-mecánica que `hasPrematureCombatResolution`
ya detecta (y que se acababa de ampliar ese mismo día para "atrapa"/"inmoviliza"), pero esta vez el
verbo SÍ estaba en la lista (`atraves[oó]|atraviesa`) en sus formas de pasado/presente, nunca en
gerundio (`atravesando`).

**Alcance real**: el mismo hueco existía en potencia para CUALQUIER verbo de las dos listas
(`COMBAT_HIT_LEAK_REGEX`/`PREMATURE_COMBAT_REGEX`) — "golpeando", "hiriendo", "rebanando" tampoco
estaban cubiertos, solo sus formas en pasado/presente.

**Estado**: FIJADO. Gerundios añadidos a las dos listas (`golpeando`, `impactando`, `hiriendo`,
`atravesando`, `rebanando`). Tests nuevos con el texto real del bug en las dos funciones. Verificado:
1424 tests backend en verde.

**Hallazgos colaterales de la misma partida, sin arreglar (un solo caso cada uno, mismo criterio de
siempre)**:
- Antes de derrotar y saquear al Orco Enfurecido, la narración le hizo empuñar "la maza orca" a
  Gorhorn — un objeto que no entra al inventario hasta el saqueo, varios turnos después.
- Tras matar y saquear al Orco Enfurecido, un turno posterior de "Uso 'Cataplasma de salvia del
  polvo'" narró que Gorhorn le aplicaba el ungüento AL PROPIO Orco Enfurecido (ya muerto y
  saqueado) en vez de a sí mismo — variante nueva de la familia "NPC muerto tratado como si
  siguiera presente" (`hasResurrectedDeadNpc`), pero con vocabulario de curación en vez de señales
  de presencia activa; su regex actual no lo cubre y ampliarlo con un solo caso arriesga falsos
  positivos legítimos ("recordó cuando le aplicó una cataplasma a X").

## 2026-08-08 (continuación) — "+525 XP" seguía viéndose: pendiente de reiniciar backend, no bug nuevo

**Importante para no confundir**: esta ronda mostró OTRA VEZ el mismo "+525 XP en un ataque normal,
justo al subir de nivel" que se acababa de fijar (ver entrada anterior, "el modelo podía
autoconcederse hito capitulo"). Comprobado por timestamp real (`LogEntry.createdAt`): la partida se
jugó con el backend todavía sirviendo el código de ANTES del fix — no hay forma de que un proceso
Node ya arrancado recoja un cambio de archivo sin reiniciar. No es una recaída del fix, es la propia
usuaria quien reinicia el backend cuando le toca (nunca esta sesión de Claude) — quedará resuelto en
la próxima partida tras reiniciar.

## 2026-08-08 (continuación) — Gistera Koh reaparece sin nombrarse, tercera vez confirmada

**Síntoma**: tras rematar al Orco Enfurecido, la narración volvió a describir "una orca marcada del
Clan Serhu, sin nombre revelado... con prisuebas [sic], jadeante" — y más tarde en el mismo log,
otra vez: "el hocico húmedo de una orca Serhu... algo invisible persigue su silueta". Es la MISMA
escena de introducción de Gistera Koh, reciclada palabra por palabra, pese a que el hecho de sesión
ya dice que se marchó para siempre. Ya se había visto una vez antes (2026-08-08, ronda anterior) y
se dejó como PENDIENTE por ser un solo caso — con esta ronda van 3 apariciones confirmadas.

**Por qué la protección existente no lo cazaba**: `gisteraSeHaMarchado` (turnResolution.ts) ya
excluye a Gistera Koh de `npcsInScene` por SLUG desde el 2026-08-01 — pero el texto nunca dice
"Gistera Koh", así que ninguna detección por nombre/slug puede alcanzarlo.

**Estado**: FIJADO. Nuevo detector `hasGisteraReencuentroSinNombrar` (mismo patrón que
`hasResurrectedDeadNpc`) — exige mención del clan ("orca... Serhu") Y vocabulario de
persecución/huida A LA VEZ en la misma narración (nunca cada uno por separado, para no disparar con
una mención neutra y legítima de Ulkha/Torgash — también "del Clan Serhu", pero siempre nombrados y
sin huir de nada). Activo solo cuando `gisteraSeHaMarchado` ya es cierto. Tests nuevos con las 2
variantes reales observadas + caso negativo de Ulkha. Verificado: tsc limpio, 1428 tests backend +
18 frontend en verde.

## 2026-08-11 — pruebas por API tras el rediseño de combate (fuera de combate a propósito)

Tras terminar el rediseño de combate (rol ataque/defensa/utilidad, ver plan `melodic-riding-
shannon`), la usuaria pidió expresamente "prueba todo, no solo combate" — ronda de pruebas contra
el backend real (dos partidas nuevas de Gorhorn) hablando directo con la API (`curl`), sin frontend.
4 hallazgos, ninguno arreglado todavía (pendiente decidir orden con la usuaria).

**1. Narración de inventario alucinada al "revisar el equipo"**. Acción libre "Reviso mi equipo y
observo con calma el terreno..." (banda instantánea, sin combate) narró: *"notando que el cuchillo
de hielo sílice y el tótem Maktor son los únicos objetos que lleva consigo en este viaje"* — el
inventario real tenía 8 objetos (hacha, cuchillo, tótem, arnés, pantalones, capa, raciones,
cataplasma). Mismo defecto de fondo que la familia "golpe falso"/"objeto falso" ya cerrada en
combate (`hasFalseCombatHit`/`hasFalseItemUse`), pero esta ruta narrativa genérica (fuera de
combate, sin acción de objeto detectada) no tiene ningún detector post-hoc equivalente.
**Estado**: FIJADO (2026-08-11) — nuevo detector `hasFalseInventoryReview` (narrador.ts), mismo
patrón que la familia golpe/objeto falso, wireado en el reintento y en `runDetectors`.

**2. Viaje fantasma con destino inventado**. "Salgo de la hondonada y camino hacia el norte,
alejándome del orco" (sin nombrar ningún destino real de los conectados a la ubicación actual) —
`classification`/`travel` vuelven `travel: null` (no hay viaje mecánico, correcto: "norte" no es
ningún alias real) pero la narración de todos modos describe el desplazamiento como si hubiera
ocurrido: *"Gorhorn sale de la hondonada, caminando firme hacia el norte..."*. Confirmado que
`currentLocation` no cambia tras el turno — el jugador cree que se movió y no es así. Mismo patrón
de fondo que el hallazgo 1 (narración sin grounding determinista que la contradiga cuando no hay
ningún objeto/NPC/golpe real de por medio que comprobar).
**Estado**: FIJADO (2026-08-11) — nuevo detector `hasFalsePhantomTravel` (narrador.ts) +
corrección post-hoc en `turnResolution.ts` (mismo patrón que `hasFalseTravelClaim`), que reescribe
la narración si el modelo afirma haber salido de la ubicación actual sin ningún viaje mecánico
resuelto.

**3. Una fuente de recolección "desaparece" si se descubre junto a otra en el mismo turno**.
Explorando minería en Los Pilares Rotos con `POST /saves/:id/recolectar/minero-llanuras/explorar`
aparecen 2 fuentes reales (Roca y Veta de hierro, las dos con `WorldPopulation` > 0 en esa región) —
pero al reabrir el panel (`GET /saves/:id/recolectar/minero-llanuras`) solo "Roca de Los Pilares
Rotos" sigue localizada; la veta de hierro ya no aparece, como si nunca se hubiera descubierto.
Confirmado leyendo la tabla `SessionFact` directamente: solo se guardó *"Gorhorn localiza roca de
los pilares rotos en la zona."* — el hecho de la veta nunca llegó a persistirse.

**Causa raíz confirmada**: `appendSessionFacts` (`worldFacts.ts`) descarta un hecho nuevo si su
`similarity` contra uno ya existente (`seen`, incluye los del MISMO turno) supera
`DUPLICATE_THRESHOLD` (0.65) — pensado para cazar parafraseos casi idénticos del mismo hecho (ver
el fix de 2026-08-02 que bajó el umbral de 0.7 a 0.65). `similarity` es solapamiento de palabras sin
pesos: *"Gorhorn localiza roca de los pilares rotos en la zona."* vs *"Gorhorn localiza veta de
hierro de los pilares rotos en la zona."* comparten 9 de 11 palabras (toda la plantilla fija
"Gorhorn localiza ... en la zona" + "de los pilares rotos") → similarity ≈ 0.82, muy por encima del
umbral, aunque las dos frases hablen de entidades completamente distintas (roca vs. veta de hierro).
Cualquier lote de 2+ hechos generados con la misma plantilla en el mismo turno es candidato al mismo
bug — no es exclusivo de recolección, es un defecto de la métrica de similitud en sí.
**Estado**: FIJADO (2026-08-11) — nueva `factSimilarity` (worldFacts.ts) dedicada a este chequeo:
quita stopwords y compara solo las palabras de contenido (Jaccard), en vez de la `similarity`
compartida con `isTooSimilarToLast` (narrador.ts) que comparaba solapamiento plano de plantilla
completa. "Roca" y "veta de hierro" de los pilares rotos ya se guardan como hechos distintos.

**4. La descripción de "Descansar" promete algo que la mecánica no cumple**. Su texto in-game dice
*"Se detiene donde esté, monta un vivac breve y descansa para recuperar fuerzas — sin necesitar
volver a un lugar conocido."* (`startingAbilities.ts`), pero la curación real
(`restSucceeds`/`isValidRestLocationKind`, `death.ts`/`turnResolution.ts`) solo se activa si
`currentLocation.kind` es `'refugio'` o `'asentamiento'` — en cualquier otro tipo (p. ej. Los
Pilares Rotos, `kind: 'hito'`) el descanso narra recuperación pero no cura ni un punto de energía,
sin ningún aviso de por qué. Confirmado con prueba de control: mismo texto exacto de acción, mismo
personaje, en Hondonada del Eco (`refugio`) sí curó energía al máximo (30→86); en Los Pilares Rotos
(`hito`) no cambió nada.
**Estado**: FIJADO (2026-08-11) — rediseño de dos tramos acordado con la usuaria (no era ninguna de
las dos opciones planteadas inicialmente): descansar en cualquier sitio cura de verdad, pero con
tope GRAVE; solo en refugio/asentamiento real el tope sube a HERIDO. `healCeilingFor` (death.ts)
pasa a recibir `restAttempted`/`restInValidLocation` en vez de un único booleano, y el texto de la
habilidad (`startingAbilities.ts`) ahora describe los dos tramos en vez de prometer curación total
en cualquier sitio.

**Confirmado funcionando bien en esta ronda** (no hace falta re-probarlo): equipar/desequipar con
validación de ranura y familia de 6 huecos de consumible; resincronización de habilidades de arma
al cambiar de arma equipada; viaje con destino real nombrado explícitamente; techo de curación de
Descansar (energía llena, condición tope en HERIDO — por diseño, `healCeilingFor`); puntos de
atributo bajo 6 peticiones `POST /saves/:id/attribute-points` simultáneas de verdad (el `SELECT ...
FOR UPDATE` aguanta, sin puntos perdidos); tope máximo de atributo sin consumir el punto; recarga de
partida estable (`GET /saves/:id` idéntico en dos lecturas seguidas); `POST /saves/:id/restart`
limpio (XP/nivel/condición/ubicación reseteados, sin combate colgado).

**Nota de metodología, no un bug**: llamar a `/turn/narrate` directamente después de una acción de
banda "extendida" (viajes largos) sin pasar por el protocolo real duplica el procesamiento — el
propio `/turn/classify` ya crea el `CharacterTransit` y dos `LogEntry` ("se pone a ello...") y
devuelve sin narrar; el frontend real (`GameView.tsx`) nunca llama a narrate en ese caso, solo
sondea `GET /saves/:id` cada 30s hasta que el worker de fondo (`worldTick.ts`) resuelve el tránsito
solo. Confirmado narrando manualmente de todos modos: el worker, al no encontrar el tránsito ya
finalizado, lo reprocesó una segunda vez (dos narraciones de llegada distintas para el mismo viaje).
Como el frontend real jamás toma ese camino, no se cuenta como hallazgo de producto — se deja
anotado aquí para no repetir el mismo rodeo la próxima vez que se pruebe por API.

**Pendiente para otra ronda** (no probado todavía): misión completa (aceptar→cumplir), crafteo,
enciclopedia, reino/construcción.

## 2026-08-11 (continuación) — misiones "conseguir X" nunca se cierran si el objeto viene de Minar/Talar/Desollar/Cazar

**Síntoma**: creada a mano una misión de prueba ACTIVA con `targetItemName: 'Piedra'`
(`rewardXp: 77`), y recolectada Piedra de verdad vía `POST /saves/:id/recolectar/confirmar`
(el flujo real que usa el botón de Minar en el juego) — la misión se queda `ACTIVA` para siempre,
`xp` no sube nada. El mismo objeto conseguido por saqueo/crafteo narrado sí la habría cerrado.

**Causa raíz confirmada leyendo el código**: el cierre determinista de misión "conseguir Z"
(`turnResolution.ts`, bloque `createdItemNames.length > 0` → `tx.quest.updateMany` por
`targetItemName`) vive DENTRO de `narrateAndPersistTurn` — solo se ejecuta cuando el objeto se
crea a través del flujo de turno normal (`/turn/narrate`: saqueo, despiece narrado, crafteo,
`newItem` del modelo). Los endpoints deterministas nuevos del rediseño de profesiones
(`recolectar.ts` § `/saves/:id/recolectar/:oficio/confirmar`, y por el mismo motivo
`cazar.ts` § `/saves/:id/cazar/confirmar`) crean `InventoryItem` en su propia transacción,
totalmente aparte de `turnResolution.ts` — ninguno de los dos comprueba ni actualiza `Quest` en
ningún momento (confirmado: cero referencias a `quest`/`Quest`/`targetItemName` en los dos
archivos). El crafteo (`services/crafting.ts`) SÍ sigue pasando por `narrateAndPersistTurn`, así
que no le afecta — el hueco es específico de los dos endpoints deterministas de recolección/caza
introducidos el 2026-08-07/2026-08-08.

**Alcance real**: cualquier misión futura del tipo "consígueme N de X" donde X sea algo que se
obtiene recolectando (mineral, madera, piel/despiece) o cazando quedará imposible de completar por
el camino normal del jugador — solo se cerraría si, por casualidad, ese mismo objeto también se
consigue alguna vez por saqueo/crafteo/narración libre.

**Estado**: FIJADO (2026-08-11) — bloque de cierre extraído a `closeItemQuests` (exportada de
`turnResolution.ts`), llamada también desde `recolectar.ts` § `confirmar` dentro de su propia
transacción. `cazar.ts` no se tocó en esta ronda (sin caso de prueba real que lo dispare todavía).

## 2026-08-11 (continuación) — el objeto recién crafteado sale "sin categorizar" (regresión parcial del fix de 2026-08-07)

**Síntoma**: prueba de control tras el hallazgo anterior — craftear "Bloque de piedra tallada"
(receta real, `STONE_BLOCK_RECIPE`, consume 5 Piedra) vía turno normal (`/turn/narrate`, sin pasar
por ningún endpoint dedicado). El objeto se crea bien (`removedInventoryItemIds` quita la piedra
consumida, `newInventoryItems` trae el bloque nuevo), pero con `"tipo": null` — pese a que el
catálogo real (`ItemCatalog` en Postgres, confirmado consultado directamente) sí tiene
`tipo: 'MATERIAL'` para `bloque-piedra-tallada`. Mismo síntoma exacto que el bug ya cerrado el
2026-08-07 ("objetos recién recolectados sin categorizar en el Inventario"), pero esta vez con un
objeto CRAFTEADO, no recolectado.

**Causa raíz confirmada leyendo el código**: no es un problema de datos (el `seed-catalog` está al
día) — es estructural. `catalogBySlug` (`turnResolution.ts:1669`) se construye SOLO a partir de los
`catalogSlug` que el inventario del jugador YA tenía ANTES de este turno (`inventoryCatalogSlugs`,
línea 1653) — por diseño correcto para su uso original (matchear ingredientes que el jugador ya
posee, `canCraft`/`planCraftConsumption`). El bloque que arma la respuesta del objeto CRAFTEADO
(líneas 2758-2760) reutiliza ese MISMO mapa para mirar `equipSlot`/`effectKey`/`tipo` del
`recipe.resultCatalogSlug` — pero el resultado de una receta es, por definición, algo que el
jugador normalmente NO tenía antes de craftearlo, así que `catalogBySlug.get(resultCatalogSlug)`
es casi siempre `undefined` y los tres campos caen a `null`. El propio comentario de la línea 2751
ya advierte la limitación de origen ("`catalogBySlug` (arriba) solo trae los catalogSlug que el
jugador YA tenía en inventario") pero el código de más abajo no lo tuvo en cuenta al reutilizar el
mismo mapa para el resultado.

**Por qué el fix de 2026-08-07 no lo cazó**: aquel fix añadió `tipo` a los 5 sitios que crean
objetos nuevos (saqueo/crafteo/despiece/producción/recolección) tomándolo "del catálogo cuando está
disponible" — crafteo SÍ quedó dentro de esa lista, pero la fuente de la que lee (`catalogBySlug`)
tiene este hueco estructural que un objeto recién crafteado activa casi siempre (solo se libraría si
el jugador ya tuviera otra unidad del mismo resultado en inventario antes de craftear esta).

**Efecto real**: cualquier objeto recién crafteado aparece en el panel de Inventario como "SIN
CATEGORIZAR" (icono genérico) hasta la próxima recarga completa de la partida, momento en el que
`GET /saves/:id` sí lo resuelve bien vía join — mismo efecto visual que el bug de 2026-08-07, pero
todavía vivo para el camino de crafteo.

**Estado**: FIJADO (2026-08-11) — nuevo `resultCatalogRowFor` (turnResolution.ts), resolver
memoizado que consulta el `resultCatalogSlug` directamente por `worldId_slug` contra `ItemCatalog`,
en vez de reutilizar `catalogBySlug` (que se queda tal cual para ingredientes).

## 2026-08-11 (continuación) — segunda tanda: reino, capítulo, muerte definitiva, despiece (sin bugs nuevos)

Continuación de la ronda de pruebas por API ("sigue haciendo pruebas... hasta que yo te mande
parar"). Sin hallazgos nuevos en esta tanda — todo lo probado se comporta como está diseñado, se
deja constancia para no reprobarlo sin necesidad:

- **Fundación de reino** (`POST /saves/:id/reino/fundar`): guard "sin Ayuntamiento" (400) correcto;
  bajo 3 peticiones EN PARALELO de verdad para la misma partida, solo una funda de verdad (nombre
  bloqueado "Maktor" para Gorhorn, confirmado), las otras dos devuelven el 400 limpio ya documentado
  (auditoría 2026-08-07) en vez de un 500 — la `Faction` creada aparece bien en la Enciclopedia con
  `discovered: true` desde el primer instante, tal como se diseñó.
- **Progresión de capítulo** (`chapterSummary.ts`, cada 15 turnos): forzado el umbral (14 acciones
  sembradas + 1 turno real de por medio) — dispara exactamente UN `SessionSummary` (`chapterNumber:
  1`, resumen coherente con lo ocurrido) y el hito "capitulo" (+500 XP, subida de nivel real),
  sin duplicar. `attributePointsGained: 0` en la subida a nivel 2 es correcto (`ASI_LEVELS` de
  `progression.ts` no incluye el nivel 2 — D&D solo da puntos en niveles concretos).
- **Fin de partida por muerte definitiva** (`endedAt`): con `endedAt` puesto a mano, `/turn/classify`
  responde 409 "Esta partida ha terminado" tal como documenta `docs/14-combate-y-muerte.md` § 4.4;
  `POST /saves/:id/restart` limpia `endedAt`/`condicionFisica`/`deathCount` correctamente.
- **Despiece (Desollar) — inconcluso, no reproducido**: creado a mano un `NpcState` de fauna
  (Buitre Cenizo) `INCAPACITADO`+`saqueado:false` en la ubicación actual, pero
  `GET /saves/:id/recolectar/desollador-orcos-llanuras` no lo ofrece como candidato.
  `carcassCandidatesFor` (`recolectar.ts`) depende de `detectNpcsInScene`, que a su vez mira
  menciones recientes en `sessionFacts` — un `NpcState` creado directamente en la BD, sin ningún
  turno narrado que mencionara al Buitre, no tiene ningún hecho de sesión del que colgar la
  detección. Probable comportamiento correcto (el despiece exige que el cadáver siga "en escena" de
  verdad, no solo que exista su fila), pero no se pudo confirmar sin narrar un combate real —
  pendiente de reprobar jugando en vivo en vez de por API directa.

## 2026-08-11 (continuación) — tercera tanda: sesión (pausa/cancelar/huir), habilidades generales, construcción, validación de creación

**Confirmado funcionando bien** (sin hallazgos): pausar/reanudar partida (`busyUntil` se alarga
exactamente lo pausado, probado con un tránsito real y ~5s de pausa real); cancelar un tránsito
activo (borra la fila + dobla como aviso en el diario, 404 limpio si no hay nada que cancelar);
huir antes de que empiece un combate (`POST /saves/:id/combat/flee`, tirada real, limpia
`pendingCombatNpcSlugs` en éxito, 404 limpio sin combate pendiente); CRUD de habilidades "general"
(crear, editar, borrar) con el guard real (no solo de frontend) contra editar/borrar habilidades
`isStarting`/`isDynamic` y contra crear con `category:'combate'` a mano.

**Bug real: `POST /saves` solo valida 3 de ~10 campos requeridos — cualquier otro campo ausente
revienta con 500 genérico en vez de un 400 claro**. Investigación en varios pasos: primero pareció
un problema de `attributes` (`{}` vacío, o solo 3 de las 7 claves reales, devolvían
`{"error":"Error interno del servidor"}` con HTTP 500), pero aislando campo a campo (probado con
`attributes` completo y sano de sobra, quitando solo un campo cada vez) se confirmó que el mismo
500 salta igual si falta CUALQUIERA de `characterOrigin`, `introCharacterText` (confirmados
directamente) — y por el mismo patrón de código, presumiblemente también `characterArchetype`,
`characterMotivation`, `portraitInitial`, `introWorldText` (todos destructurados de `CreateSaveBody`
y usados sin comprobar más abajo). La causa raíz real: el guard de la ruta
(`if (!worldSlug || !characterName || !attributes)`) solo cubre 3 de los ~10 campos del body —
el resto se usa tal cual, sin ningún `?.`/valor por defecto, en algún punto de la lógica de creación
(probablemente un campo `String` no-nulo de Prisma recibiendo `undefined`). Mismo patrón de fondo
ya documentado y arreglado una vez en `POST /saves/:id/attribute-points` (auditoría 2026-07-28:
"`attribute` solo se validaba a nivel de TypeScript, nunca en runtime") — aquí sigue sin cerrar, y
en el punto de entrada más importante de todos (crear personaje). **Sin corrupción de datos**
(confirmado en varias variantes: ninguna fila `Save` a medias queda en la BD tras el 500 — todo
vive en una sola transacción que revierte limpia), así que el impacto real es un mensaje de error
opaco/genérico en vez de uno útil — el formulario real de creación de personaje siempre manda todos
los campos hoy, así que en la práctica no se ha visto disparado jugando normal; el riesgo es de cara
a cualquier cliente futuro (API pública, script de importación, etc.) que no replique exactamente
el formulario actual.
**Estado**: FIJADO (2026-08-11) — `validationErrorFor` (creation.ts) cubre ahora los ~10 campos
`string` no opcionales de `CreateSaveBody`, además de validar `attributes` con las 7 claves reales
(mismo `VALID_ATTRIBUTES`/patrón ya usado en
`progression.ts`) — todo devuelto como 400 con mensaje claro antes de tocar nada más.

**Construcción (campamento base) — confirmado funcionando bien**: `Building` de la receta más
simple (`CAMPAMENTO_RECIPE`, banda "larga" → resuelto en diferido por `worldTick.ts`, protocolo
correcto de solo `classify` + esperar, sin narrar a mano, aprendido en la tanda anterior). El
edificio se creó bien (`status: 'ACTIVO'`, descripción real de la receta) y los 3 materiales
(leña/piedra/piel) se consumieron correctamente del inventario — sin rastro del bug de "sin
categorizar" de crafteo (no aplica: `Building` no es `InventoryItem`, no pasa por `catalogBySlug`).

## 2026-08-11 (continuación) — cuarta tanda: calidad de narración (petición explícita: "buscar mejoras... qué es necesario mejorar para que la narración sea de calidad")

Cambio de enfoque a petición de la usuaria: no solo lógica/mecánica, sino la PROSA en sí. Partida
nueva y limpia (`cmsoha1m200crrivbf59nvap9`) dedicada solo a esto, varios turnos leídos con
atención en vez de solo comprobados por su efecto mecánico.

**1. "Golpe fantasma" reproducido con vocabulario que SÍ debería estar cubierto — posible fallo del
reintento, no del detector**. Turno de combate real: acción "Descargo un golpe... contra 'Orco
enfurecido'", tirada mecánica real `resultado: 'ataque_falla'` (el ataque del jugador falla limpio,
`combatExchangeDisplay` lo confirma, ningún lado recibe daño — `condicionFisica` real del jugador Y
del NPC se quedan ambos en ILESO). La narración, sin embargo, dice: *"Gorhorn descarga su hacha...
en el orco, **quien se retuerce bajo el impacto** pero no cede."* — describe un impacto conectado
que la mecánica dice que no ocurrió. Lo notable: esto NO es un hueco de vocabulario nuevo — 
`COMBAT_HIT_LEAK_REGEX` (narrador.ts) YA incluye `impact[oó]` explícitamente, y `combatBothMissed`
(turnResolution.ts:1432, con un comentario que describe LITERALMENTE este mismo caso — "el
intercambio resolvió 'ataque_falla'... pero la narración describió un golpe limpio de todos modos",
arreglado el 2026-07-31) debería haber sido `true` aquí (ni el jugador ni el NPC reciben golpe este
turno). El detector debería haber disparado un reintento. Sin acceso a los logs del proceso en vivo
(este backend corre en una terminal de la usuaria, no capturado por esta sesión) no se puede
confirmar si: (a) el reintento se disparó y el modelo repitió una variante parecida en el segundo
intento también (límite real del sistema: un solo reintento, sin garantía de que el modelo pequeño
no insista), o (b) hay algún otro hueco no identificado en cómo se computan
`exchangeHappened`/`npcAttackHits`/`jugadorRecibeGolpe` para este resultado concreto tras el
rediseño de combate de esta misma sesión (aunque el camino de código parece ser el mismo
`resolveExchange` de siempre, sin tocar). **Estado**: PENDIENTE de diagnóstico — antes de tocar
código, comprobar en los logs reales del backend (`request.log`/stdout) si `hasFalseCombatHit`
llegó a disparar un reintento en este turno concreto; si sí, el problema es de fondo (reintento
único insuficiente contra un modelo local pequeño) y no tiene arreglo determinista fácil.

**2. Descolocación de tono: una acción explícitamente pacífica se narra como confrontacional**.
Acción: *"Levanto las manos vacías y le hablo con calma a 'Orco enfurecido': '¿Podemos hablar? No
busco pelea.'"* — inequívoca (manos vacías, calma, "no busco pelea"). Narración: *"Gorhorn se
planta frente a la figura y **le exige que hable**, sin apartar la mirada."* — "exige" y "sin
apartar la mirada" describen una postura confrontacional/desafiante, lo contrario del tono pedido.
No hay ningún detector determinista para esto (a diferencia de golpe/objeto/viaje falso, que
comprueban HECHOS mecánicos concretos) — el tono es más difícil de verificar por regex, pero es
justo el tipo de cosa que rompe la inmersión: el jugador escribe una acción con una intención clara
y el personaje "hace" otra cosa distinta en la narración. **Estado**: sin detector posible con el
enfoque actual (regex sobre hechos, no sobre tono) — candidato a instrucción de prompt más
explícita ("si el jugador especifica un tono/actitud concreto en su acción, la narración debe
reflejar ESE tono, no uno inventado") más que a un fix de código determinista.

**3. Diálogo sin atribuir, pegado sin transición al final de la narración**. Mismo turno que el
punto 2: tras un monólogo largo de Gistera Koh, la respuesta termina en seco con
`"¡Calla! ¿Hablar? ¡No me toques!"` sin ninguna acotación (nadie dice "gruñe el orco" ni similar) ni
transición de escena — el lector tiene que inferir que el hablante cambió del todo (de Gistera al
Orco Enfurecido). Se repite el patrón en otro turno (respuesta de Gistera mezcla comillas simples y
dobles para lo que parece ser la misma línea continua de diálogo, sin motivo aparente). Es un
defecto de forma/legibilidad, no de coherencia de hechos — ningún detector actual lo cubre.
**Estado**: sin arreglar, candidato a instrucción de prompt ("cuando cambie el hablante dentro de
la misma narración, dilo explícitamente — nunca dos líneas de diálogo seguidas sin acotación
cuando son de personajes distintos").

**Confirmado como buena señal de calidad** (no son bugs, se documentan porque contradicen la
sospecha inicial al leerlos):
- Uso correcto de lore profundo: la narración de Gistera Koh mencionó "la caída del Ketg"/"la casta
  de Ketg" sin que el jugador lo mencionara antes — parecía un nombre inventado a primera vista,
  pero es un término real y específico de `docs/rpgtarkor/areas.md`/`npcs.md` (el usurpador
  histórico que fundó la casta gobernante del Clan Serhu). Buena señal: el modelo está usando lore
  de fondo real, no solo lo que está en el contexto inmediato del turno.
- Continuidad física correcta: en el turno de combate del punto 1, describe "el metal partido
  chirría" — coherente con que el arma equipada es literalmente el "Hacha de guerra rota".
- El guardarraíl determinista de `condicionFisica` funcionó bien de fondo: el modelo propuso
  `"condicionFisica": "GRAVE"` para el jugador en el turno de ataque fallido (sin ninguna causa
  mecánica real, un salto de ILESO a GRAVE sin pasar por HERIDO) — `nextCondicionFisica` lo
  descartó correctamente y el valor persistido se quedó en ILESO. La mecánica está bien blindada
  incluso cuando el texto se equivoca; el problema de esta tanda es solo de PROSA, no de estado real
  del personaje.

**Recomendación general para la usuaria**: de los 3 hallazgos, el (1) es el único con un camino de
arreglo claro y determinista (si se confirma que el reintento sí se disparó y aun así falló, subir
a 2 reintentos como tope antes de aceptar, o añadir una frase de "última instancia" más agresiva al
prompt del segundo intento). Los (2) y (3) son de una familia distinta — calidad de prosa/tono que
no se puede cazar con una lista de palabras prohibidas, porque no hay ninguna palabra "equivocada"
en sí (a diferencia de "sangra"/"impacto"), es la interpretación completa del tono/estructura la que
falla. Si se quiere mejorar esa familia de forma sistemática, el camino más realista es reforzar el
prompt del Narrador con instrucciones más explícitas sobre tono-reflejado-en-la-acción y
atribución-de-diálogo, más que seguir añadiendo detectores post-hoc — la lista de detectores ya
cubre bien los casos de "hecho mecánico contradicho", pero tono/forma es un problema categóricamente
distinto.

## 2026-08-12 — Orco Enfurecido (ya MUERTO) narrado atacando a Gorhorn durante una cacería de Múrgol, en otra ubicación

**Síntoma**: partida `cms82odjc000qri0up7n1msni`. A las 08:36 Gorhorn remata al Orco Enfurecido
(`NpcState` real: `MUERTO`, `saqueado`, confirmado en `auditSave.ts`). A las 10:00, ya en Los
Pilares Rotos (ubicación distinta de donde murió el orco, Hondonada del Eco), el jugador escribe
"Salgo a cazar y ataco a 'Múrgol'." — sin mencionar al orco en ningún momento. La narración,
sin embargo, dice: *"El orco enfurecido se da la vuelta bruscamente... Antes de que Gorhorn pueda
reaccionar, el orco se lanza hacia él con un rugido atronador."* — el cadáver ya saqueado narrado
como si atacara de nuevo, en un turno que ni siquiera lo menciona. Mecánicamente el objetivo real
sigue siendo Múrgol en los turnos siguientes (loot/NpcState de Múrgol correctos), así que el efecto
es solo de narración, pero es justo la clase de "el mundo no respeta su propia verdad" que más le
importa a la usuaria (ver conversación de la misma sesión sobre el validador de grounding).

**Causa raíz confirmada, dos fallos en cadena**:
1. `detectNpcsInScene` (`npcScene.ts:302-315`) considera candidato a CUALQUIER NPC `kind: 'PRINCIPAL'`
   sin importar ubicación (intencional: personajes de trama pueden aparecer en cualquier sitio) —
   pero el filtro final (`matchNpcAliases` contra `haystack = [action, ...sessionFacts].join('\n')`,
   línea 313) busca el alias tanto en la ACCIÓN como en los `sessionFacts` recientes. Los propios
   hechos de la muerte del orco ("Orco enfurecido está muerto y no puede oponer resistencia", etc.)
   contienen su nombre, así que siguen hicieron `match` turnos después, sin que la acción del
   jugador lo mencionara — el cadáver "vuelve a estar en escena" solo porque se habló de su muerte
   hace poco.
2. Con el orco correctamente incluido en `possiblyResurrectedNpcNames` (turnResolution.ts:1601,
   deriva de `npcsInScene` filtrado por `MUERTO`/`INCAPACITADO`), el detector
   `hasResurrectedDeadNpc` (narrador.ts) debería haber forzado un reintento — pero
   `RESURRECTION_LEAK_REGEX` no cubre el vocabulario real que usó el modelo ("se da la vuelta
   bruscamente", "se lanza hacia él con un rugido atronador"), solo cosas como "reaparece"/"vuelve a
   atacar"/"sigue vivo". **Verificado directamente**: `hasResurrectedDeadNpc(narracionReal, ['Orco
   enfurecido'])` devuelve `false` con el texto real capturado en el log — el reintento nunca se
   disparó.

**Estado**: FIJADO (2026-08-13) — `RESURRECTION_LEAK_REGEX` (narrador.ts) ampliado con vocabulario
de iniciativa de ataque directa ("se lanza/abalanza/arroja hacia", "se da la vuelta/gira/vuelve
bruscamente", "embiste", "carga contra", "arremete"). Verificado contra el texto real capturado en
el log de esta misma partida (antes devolvía `false`, ahora `true`) y contra dos casos que NO deben
disparar (memoria legítima en pasado, mención pasiva del cadáver) — ambos siguen en `false`. Test
de regresión nuevo en `narrador.test.ts` con el texto real. El comportamiento de fondo (NPCs
`PRINCIPAL` ya muertos siguiendo siendo "candidatos" varios turnos por sus propios hechos de
muerte) se deja tal cual a propósito: es el mismo mecanismo que mantiene vivas conversaciones/
continuidad con NPCs reales sin repetir su nombre cada turno, y tocarlo podría romper casos
legítimos — no se toca salvo que este patrón se repita con otros NPCs pese a este fix.

## 2026-08-13 — Gistera Koh nombrada explícitamente en mitad de un combate, tras marcharse para siempre

Partida real de Gorhorn (`auditSave.ts`), turno 08:21: acción del jugador "Me planto y aguanto el
golpe que venga con pura resistencia física" (defensa contra el ataque del Orco Enfurecido, en
combate activo). Narración devuelta: *"Gistera Koh se aproxima a Gorhorn con una expresión de
furia en su rostro."* Gistera Koh se había marchado 5 minutos ficticios antes (08:16, "echa a andar
hacia el sur... perdiéndose pronto entre la maleza") y el hecho protegido correspondiente ya estaba
establecido: *"Gistera Koh se marchó hacia la Ciénaga Troncal en cuanto Gorhorn aceptó ayudarla —
ya no está en escena, no volverá a aparecer."*

**Causa raíz**: `hasGisteraReencuentroSinNombrar` (narrador.ts) está diseñado explícitamente para
el caso en que el texto REINTRODUCE a Gistera Koh sin nombrarla (por señales de clan+persecución —
"la exclusión por slug no puede cazar esto porque el texto nunca dice 'Gistera Koh'", comentario en
el propio código). Este caso es el complementario: el texto SÍ la nombra explícitamente. No existe
ningún detector que compruebe si el nombre literal "Gistera Koh" (o sus alias) aparece en la
narración cuando `gisteraSeHaMarchado` es `true` — la exclusión de `npcsInScene` le impide ser
candidata real, pero no impide que el modelo alucine su nombre en texto libre.

**Estado**: FIJADO (2026-08-13). `hasFalseGisteraNamedReturn(narration, gisteraSeHaMarchado)`
(narrador.ts) — límite de palabra sobre "gistera"/"gistera koh", enganchado al mismo bucle de
reintento que `hasGisteraReencuentroSinNombrar`, mismo `ctx.gisteraSeHaMarchado`. 4 tests nuevos en
`narrador.test.ts` con la frase real capturada en el log de esta misma partida.

## 2026-08-13 — "Misión completada" aparece en el log ANTES que la narración del turno que la resolvió

Misma partida. Log ordenado por `createdAt` (igual que lo consulta `/saves/:id` y `/saves/:id/diario`
en la app real, no solo el script de auditoría):
```
[08:26] (PJ) Misión completada: "Acabar con el Orco Enfurecido" — consigue Mapa de las Llanuras, +100 XP.
[08:25] (PJ) El orco enfurecido bloquea la estocada con su maza astillada... dejándolo aturdido. [+25 XP]
```
La notificación de recompensa lleva un `timeLabel` posterior (08:26) al de la narración que
mecánicamente la disparó (08:25), pero como ambos endpoints ordenan por `createdAt` (orden real de
inserción en la transacción, no por `timeLabel`/`fictionalMinutes`), el anuncio de recompensa se ve
ANTES que el propio combate que la ganó — lee al revés en el diario/log de personaje.

**Causa raíz**: dentro de la transacción de `narrateAndPersistTurn`, el `LogEntry` de recompensa de
misión (creado en `completeNpcTargetQuests`, `questResolution.ts:142`, invocado desde
`applyCombatExchangeToNpcState`/`applyExecuteTargets`) se crea ANTES que `mainLogEntry` (la
narración principal del turno, `turnResolution.ts:3727`) — mismo orden que el caso especial de la
misión de apertura ya-resuelta (`rewardEntry`, línea 3573, también antes de `mainLogEntry`).

**Estado**: FIJADO (2026-08-13). No se movió la llamada (`completeNpcTargetQuests`/`closeItemQuests`
siguen ejecutándose en el mismo punto, antes de `mainLogEntry`, por sus propias dependencias de
datos) — en su lugar, `createdAt` explícito ya no depende del reloj real en cada punto del código:
un `turnStartTime` fijo al principio de la transacción + offsets relativos (`nextBeforeMainLogCreatedAt`/
`mainLogEntryCreatedAt`/`nextAfterMainLogCreatedAt`) deciden el orden de lectura sin importar en qué
momento real se cree cada fila. Las recompensas de misión (caso general y el especial del Orco
Enfurecido ya resuelto) ahora usan `nextAfterMainLogCreatedAt`. Verificado contra la BD real:
`turn.integration.test.ts` ampliado con una comprobación explícita de `createdAt` (recompensa
después de la narración principal), 49/49 en verde.

## 2026-08-13 (continuación) — "Vendaje improvisado" usado pero nunca consumido del inventario (CONFIRMADO en BD)

**Síntoma**: partida nueva, mismo día. Turno `10:49`, acción `Uso 'Vendaje improvisado'`: *"Gorhorn
machaca otra porción de salvia del polvo y la envuelve en un pañuelo antes de aplicárselo a una
herida que aún late dolorosamente... [+25 XP]"* — la narración describe fabricar/aplicar de nuevo
(no "usar lo que ya llevaba"), sospechoso de ser la misma clase de alucinación que el bug de
`descansar`/objeto médico de 2026-08-01.

**Confirmado contra la BD real** (no solo sospecha de narración): la partida tiene exactamente 2
filas `InventoryItem` con `catalogSlug='vendaje-improvisado'`, con `createdAt` real
`11:12:54.766` y `11:23:21.686` — que corresponden EXACTAMENTE a los dos turnos de *crafteo*
("Ato un vendaje improvisado...", `10:48` y `12:30` en tiempo ficticio), no al turno de *uso*
intermedio (`10:49`). El turno de "Uso" no borró ni decrementó ninguna fila — el objeto creado a
las `10:48` debería haber desaparecido en el "Uso" de `10:49` y no lo hizo.

**Causa raíz CONFIRMADA (2026-08-13, sesión de fixes)**: reproducido con un script suelto contra
`detectMedicalItemUse` real (mismo método que recomienda este runbook) — con UNA sola unidad
("Vendaje improvisado", sin sufijo) el matching funciona bien; con 2+ unidades en la misma pila
("Vendaje improvisado (2)"), el `.includes()` contra el nombre CON sufijo de cantidad nunca
coincide con la forma en que el jugador cita el objeto ("Uso 'Vendaje improvisado'", sin el "(2)")
— el objeto deja de detectarse como usado en cuanto hay pila de 2+, y por tanto tampoco se consume.
Bug genérico, no exclusivo de `vendaje-improvisado`: afecta a CUALQUIER objeto médico/de energía en
pila de 2+ (raciones, cataplasmas...). El caso concreto de la partida auditada (pila de 1 en ese
momento) no encaja exactamente con este mecanismo — probablemente un proceso de backend
desactualizado sirviendo la partida en ese momento (mismo patrón ya visto y documentado el
2026-08-08, "+525 XP seguía viéndose: pendiente de reiniciar backend, no bug nuevo"), no reproducible
hoy contra el código actual.

**Fix aplicado**: `detectMedicalItemUse`/`detectEnergyItemUse` (`itemReference.ts`) ahora matchean
contra `baseNameOf(item.name)` (le quita el sufijo "(N)" antes de comparar) en vez del nombre crudo.
Tests nuevos en `itemReference.test.ts` cubriendo pila de 2+ para los dos detectores.

**Estado**: FIJADO.

## 2026-08-13 (continuación) — arma narrada como lanzada en un ataque cuerpo a cuerpo, sin reflejo mecánico

**Síntoma**: turno `08:23`, acción `Ataco con un golpe directo, con el arma que llevo en la mano
principal 'Orco enfurecido'` (ataque cuerpo a cuerpo): *"Gorhorn lanza su hacha de guerra rota con
fuerza hacia el orco, pero éste la esquiva con una torpezada del brazo, rebotando lejos en la pared
de arcilla."* — narra un LANZAMIENTO (arma fuera de la mano, rebotando lejos), pero el turno
`10:44` (más de dos horas ficticias después, otro combate) sigue usando "su hacha rota" con
total normalidad, sin ninguna acción de "recoger arma" entre medias. Ni el inventario ni el slot
`ARMA_PRINCIPAL` reflejan ningún cambio real — el arma nunca se soltó de verdad.

**Causa raíz**: variante nueva de la familia "arma equivocada en narración" (2026-08-01, ya FIJADA
para mano principal/secundaria) — aquí el error no es QUÉ arma usa, sino que inventa un TIPO de
acción (lanzar en vez de golpear) que la mecánica real no soporta para esta habilidad.

**Fix aplicado**: `hasFalseWeaponThrowClaim` (`narrador.ts`) — mismo patrón de
comprobación-post-hoc-más-reintento que el resto de esta familia. El juego no tiene NINGUNA
mecánica de lanzar armas (sin habilidad que lo modele, sin forma de recuperarla), así que en
combate cualquier narración de la forma "lanza {su/el/la/tu/un(a)} {arma equipada}" (el arma como
objeto directo de "lanza", no como herramienta de un golpe: "lanza un golpe/una estocada... con su
hacha" no dispara) fuerza un reintento. `ctx.equippedWeaponNamesInCombat` (turnResolution.ts) solo
se rellena en combate, con los nombres reales de `ARMA_PRINCIPAL`/`ARMA_SECUNDARIA`. Test nuevo en
`narrador.test.ts` con la frase real capturada en el log de esta misma partida.

**Estado**: FIJADO.

## 2026-08-13 (continuación) — cambio de equipo alucinado y contradictorio ("capa... como falda" → "capa... como asiento")

**Síntoma**: turno `08:32` (viajar a "los manaderos", sin que el jugador mencionara su ropa):
*"Gorhorn arranca la capa de piel de gargantúa y la atóona a su cintura como una falda, revelando
su pecho descubierto."* (nótese además el typo "atóona"). El inventario real sigue mostrando
"Capa de piel de gargantúa [ACCESORIO]" sin ningún cambio de slot en toda la partida. Más tarde,
turno `12:31` (montar un vivac): *"...usando la capa de piel de gargantua como asiento..."* — la
misma prenda, ahora usada de forma totalmente distinta, sin que ninguna de las dos descripciones
tenga respaldo mecánico real.

**Causa raíz**: alucinación de equipo no solicitado por el jugador — variante de la familia ya
conocida "objeto médico narrado sin usarse" (2026-08-01/2026-08-07), pero sobre ropa/accesorios en
vez de consumibles.

**Fix aplicado**: `hasFalseEquipmentChangeClaim` (`narrador.ts`) — a diferencia de
`hasFalseItemUse`, no hace falta comprobar la intención de este turno: equipar/desequipar es
SIEMPRE una decisión manual vía `PATCH /saves/:id/inventario/:itemId` (nunca pasa por narración),
así que cualquier cambio de vestimenta narrado es alucinación siempre, en cualquier turno. Verbos
curados (`arranca`/`ata`/`desata`/`ciñe`/`reviste`/`desviste` — deliberadamente SIN "se pone"/"se
quita", demasiado genéricos: "se pone en pie"/"se pone furioso" no tienen nada que ver con equipo)
+ nombre real de un objeto EQUIPABLE (con `equipSlot` en catálogo, para no disparar con materia
prima) en la MISMA frase. `ctx.equippableItemNames` (turnResolution.ts) se calcula en TODO turno,
sin condición. Test nuevo en `narrador.test.ts` con la frase real capturada en el log.

**Estado**: FIJADO.

## 2026-08-13 (continuación) — palabra en inglés colada en narración española ("small clearing")

**Síntoma**: turno `12:31`: *"Gorhorn se detiene en una **small clearing** y comienza a montar un
rudimentario campamento... atando las armas alrededor para formar una tipo improvisado
barricada."* — palabra en inglés suelta en medio de una narración en español, más una concordancia
rota ("una tipo... barricada").

**Causa raíz**: misma familia que "errores gramaticales sueltos del modelo" (2026-08-08, PENDIENTE,
sin detector determinista barato) — pero primera vez que se cuela una palabra en INGLÉS completa,
no solo una conjugación/palabra inventada en español. A vigilar si se repite el patrón.

**Estado**: PENDIENTE, mismo criterio que 2026-08-08 (no se propone corrector gramatical genérico
sin que se repita más).

## 2026-08-13 (continuación) — aportes en vivo de la usuaria, 6 puntos (habilidad no-daño, crafteo, tiempo, energía, recolección, viaje/caza)

Misma sesión de revisión. La usuaria reportó 6 síntomas de su propia partida en vivo, investigados
uno a uno (solo lectura, sin aplicar ningún fix todavía).

**1. Habilidades no-ATAQUE (ATURDIMIENTO/INTIMIDACION/AGUANTE) hicieron daño real** — el gate real
de "esto puede doler" en `resolveCombatExchangePhase` (`turnResolution.ts:588-983`) mira `rol`
(`'ataque'`/`'defensa'`/`'utilidad'`), NO `effect` — y `nextCondicionForAttack` (`death.ts:163-166`)
solo distingue `REMATE` como caso especial; cualquier otro `effect` (incluido `ATAQUE`, `null`,
`ATURDIMIENTO`...) empeora la condición igual si `rol==='ataque'`. Confirmado a propósito en
`death.test.ts:185-187`. Hoy TODAS las definiciones estáticas (`classAbilities.ts`,
`genericCombatAbilities.ts`, `npcCombatAbilities.ts`, `dynamicAbilities.ts`) emparejan bien
`effect` no-ATAQUE con `rol` no-`'ataque'` — pero `effect`/`rol` se leen por separado desde la fila
`SavedAction` persistida (`turnResolution.ts:1710-1714`,`1788-1791`) sin validar esa invariante al
leer; una fila desalineada (legado, migración incompleta) colaría daño real por una habilidad
"no de daño". Sin test que fuerce ese desalineamiento; tampoco hay test de "Instinto Salvaje"
(ATURDIMIENTO) pese a estar comentado.

**Confirmado y FIJADO más tarde en la misma sesión** (ver entrada "`defensor_contragolpea` hacía
daño real con CUALQUIER habilidad de defensa" más abajo): el mecanismo real no era una fila
`SavedAction` desalineada — era el resultado `defensor_contragolpea` del `OUTCOME_TABLE`
(`combatExchange.ts`) aplicando daño real en los caminos NO independientes de
`resolveCombatExchangePhase` sin comprobar `effect==='ATAQUE'` de la habilidad de defensa usada.
Cualquier esquiva/bloqueo con tirada excelente colaba un golpe de vuelta real. Ya arreglado.

**2. "El crafteo debería ser determinista, no narrado"** — **NO ES BUG**, ya lo es. `canCraft`/
`CRAFTING_RECIPES` (`crafting.ts`) deciden 100% por código (ubicación, ingredientes, requisitos,
objeto resultante) ANTES de narrar — mismo orden que combate (`resolveCraftIntentContext`,
`turnResolution.ts:2473-2481`, resuelto antes de `narrateAction` en la línea 2665; la transacción
que materializa el `InventoryItem` en 2908 usa el booleano ya calculado, línea 3212, nunca
reinterpreta la narración). La percepción probablemente viene de que la REDACCIÓN de
`narrationDo`/`narrationWant` sí deja libertad de prosa al LLM, y eso se puede sentir como si
"decidiera" aunque el objeto/stats ya estén cerrados de antemano.

**3. "Fabricar/combate no hacen pasar el tiempo"** — **percepción, no bug de 0 minutos** (aunque sí
hay margen de mejora). Combate: 1 minuto fijo por intercambio (`timedActions.ts:48`, ya arreglado
en 2026-08-02 tras un bug idéntico — antes SÍ era 0). Crafteo: sin campo de duración propio, cae en
la banda `"corta"` del clasificador → 15 min por defecto (`timedActions.ts:88`). Viajar/descansar
avanzan decenas/cientos de minutos, así que 1 minuto de combate "se siente" congelado en
comparación, aunque técnicamente si avanza.

**4. "Descansé y la energía no se recuperó" — CONFIRMADO, bug de diseño real, no solo percepción.**
Restaurar energía exige `restSucceeds` (`turnResolution.ts:2853-2854`), que solo es `true` si
`currentLocationRecord.kind` es `'refugio'` o `'asentamiento'` (`isValidRestLocationKind`,
`death.ts:237-238`) — un vivac en un `hito`/`cruce` en mitad del camino (exactamente lo que hizo la
usuaria: "monto un vivac breve... aquí mismo") mejora algo la `condicionFisica` pero deja la
`energia` intacta, sin ningún aviso de que el sitio no cualifica. Hueco de test confirmado:
`energy.test.ts` prueba la restauración aislada (pasando `restSucceeds:true` a mano) y el único
integration test de vivac en un `hito` nunca comprueba `energia`.

**Fix aplicado (2026-08-13, decisión de la usuaria: restaurar algo en cualquier sitio)**: mismo
criterio de dos escalones que ya tenía `healCeilingFor` para `condicionFisica` desde el
2026-08-11. `nextEnergia` (`energy.ts`) gana un parámetro `restAttempted` (descanso válido EN
CUALQUIER SITIO, mismo criterio que `healCeilingFor`): si es `true` y `restSucceeds` no lo es,
sube la energía hasta la MITAD del tope (nunca la baja si ya estaba por encima) — `restSucceeds`
(refugio/asentamiento real) sigue siendo el único que llega al tope entero. Wireado en
`turnResolution.ts` (el `restAttempted` que ya calculaba `healCeilingFor` se reutiliza tal cual, sin
cálculo nuevo). Tests nuevos en `energy.test.ts` (3, caso puro) y `turn.integration.test.ts` (1,
contra la BD real, cerrando el hueco de cobertura documentado arriba).

**Estado**: FIJADO. `tsc` limpio, 880 tests backend, `turn.integration.test.ts` 50/50 en verde.

**5. "Al recolectar, el número puesto es el total del inventario, no lo recién cogido" —
CONFIRMADO, bug real de redacción.** `recolectar.ts:391-395` construye el texto "recolecta en la
zona: X (N)" a partir de `s.quantity`, que en `recolectar.ts:349-360` se calcula como
`quantityOf(existingRow.name) + cantidad` cuando ya había pila previa — el TOTAL tras sumar, no lo
recién cosechado. Coincide exactamente con la evidencia real (3, luego 6, luego 9 en vez de 3, 3,
3). Fix: separar en `TouchedStack` el total de la pila (para el nombre real del `InventoryItem`,
que sigue bien) de la cantidad cosechada ESTE turno (variable local `cantidad`, ya disponible antes
de sumar) para el texto del log. **Estado**: PENDIENTE.

**6a. UX de espera al viajar — no es solo frontend, es un diseño real de backend a revisar.**
`POST /turn/classify` (`turn.ts:582-678`) YA decide de forma determinista TODO el resultado del
viaje al iniciarlo — ruta, y si habrá evento/dónde se trunca (`pickTravelInterruption`,
`travelInterruption.ts`, decidido en el momento de arrancar, no al resolver) — pero NO genera la
narración de llegada hasta que `worldTick.ts` (`resolveDueTransits`) detecta que `busyUntil` (tiempo
REAL) ya venció; hasta entonces, `/turn/classify` devuelve 409 "sigue ocupado", así que no hay forma
de saltarse la espera actuando/refrescando antes. La propuesta de la usuaria (narrar ya si no hay
evento; si hay evento, resolverlo y EDITAR el primer prompt de llegada con sus matices) es viable
pero requiere cambio real de backend: adelantar `narrateAndPersistTurn` al momento de iniciar el
viaje cuando `interruption === null`.

**Fix aplicado (2026-08-13, decisión de diseño confirmada: "calcular ya, pero ocultarlo hasta que
acabe la espera")**: `narrateAndPersistTurn` gana un parámetro opcional `notBefore: Date` — todo el
cómputo (incluida la llamada al modelo) corre exactamente igual que siempre, pero justo ANTES de
abrir la transacción que compromete el resultado en BD, si `notBefore` todavía no ha llegado,
espera (`setTimeout`) hasta esa fecha. `turn.ts`, al iniciar un viaje SIN evento
(`interruption === null`), llama (fire-and-forget, sin bloquear la respuesta HTTP) a la nueva
`startEagerTransitResolution(transitId, busyUntil)` (`worldTick.ts`) — mismo cuerpo de resolución
que ya usaba el barrido periódico (`resolveClaimedTransit`, extraído de `resolveDueTransits`),
reclamando la fila por id con una columna nueva (`CharacterTransit.narrationClaimedAt`,
independiente de `busyUntil`, que sigue siendo puramente la cuenta atrás visible del jugador) para
que el barrido periódico nunca la resuelva dos veces. `zoneContext.claimedAt` también se marca en
el mismo reclamo, para que `POST /saves/:id/transit/cancel` sepa que esta fila ya se está
resolviendo de verdad (ver ese comentario en session.ts) y no desperdicie una narración ya
generada. Con evento (`interruption !== null`) se deja la resolución diferida de siempre, sin
adelantarla — `effectiveTravel` ya incorpora el truncamiento, no hay ningún "editar el prompt
después" que hacer aparte en esta arquitectura concreta.

Verificado: `tsc` limpio, 893 tests backend (incluye cobertura nueva de
`startEagerTransitResolution` en `worldTick.test.ts`, y un test de integración contra Postgres real
en `turn.integration.test.ts` que confirma que el commit NO se hace antes de `notBefore` y que un
barrido de `resolveDueTransits()` a mitad de la espera no duplica la resolución), 3 integration
test files en verde por separado.

**Estado**: FIJADO.

**6b. Cazar varios animales de la misma especie pero solo 1 cadáver para desollar — CONFIRMADO,
desajuste real por diseño del modelo de datos.** `NpcState` para fauna `PLANTILLA` usa
`scope = Location.id`: una única fila representa TODO el encuentro con esa especie en ese sitio, no
cada individuo (`schema.prisma:1087-1121`). `cazar.ts:38-43` lo confirma explícitamente ("solo se
admite UNA presa por especie por petición"); el despiece (`harvest.ts:96-138`) consulta esa misma
fila única. La narración puede describir varias muertes de la misma especie ("7 Corretolvas"), pero
solo hay un cadáver mecánico real por especie+ubicación.

**Fix aplicado (2026-08-13, spec ampliada por la usuaria en vivo)**: "el jugador primero debe
marcar contra cuantos quiere combatir... con un cálculo determinista puede darse que salgan menos
o más de los que marcaste... y que el narrador no prometa nada que no se realice por acción". Se
descartó trackear individuos con filas separadas (habría exigido tocar el `@@unique([saveId,
npcId, scope])`) a favor de un **contador en la misma fila** (decisión explícita de la usuaria):
`NpcState` gana `groupSize`/`groupDefeated`/`corpsesLooted` (null/0/0 = encuentro solitario de
siempre, sin cambio de comportamiento para todo el código anterior a este campo).

- `cazar.ts`: con `avistados > 1`, `rollGroupEngagement` (tirada 1d6: 1-2 uno menos, 3-4 igual,
  5-6 uno más que lo elegido, topado a `[1, avistados]`) decide el tamaño REAL del grupo antes de
  devolver el `actionText` — `groupVarianceClause` añade una frase determinista cuando difiere de
  lo marcado ("aunque al acercarme, otro más se suma de repente, sin previo aviso" / "aunque al
  final solo consigo acorralar a uno de los que había marcado"), nunca decidida por el modelo.
- `turnResolution.ts` (`applyCombatExchangeToNpcState`/`applyExecuteTargets`): un golpe que deja al
  individuo ACTUAL incapacitado/muerto, con más miembros por caer, "resucita" el mismo `NpcState` a
  ILESO para el siguiente (mismo `groupDefeated` sube uno) en vez de cerrar el encuentro — el
  combate sigue de verdad, no es cosmético. Hint gemelo antes de narrar (`resolveCombatExchangePhase`
  y el bloque de "Decapitar") deja explícito si quedan más o si era el último, para que el
  Narrador nunca cierre el grupo antes de tiempo ni lo alargue de más.
- `recolectar.ts`/`harvest.ts`: el despiece de un grupo consume `corpsesLooted < groupDefeated`
  (cadáveres reales ya caídos y sin despiezar) en vez del booleano `saqueado` — permite despiece
  parcial mientras el combate contra el resto del grupo sigue abierto.
- Frontend (`HuntSelectionModal.tsx`): selector +/- por especie cuando `avistados > 1`, tope real
  en `avistados`, enviado como `cantidades` a `POST /cazar/confirmar`.

Verificado: `tsc` limpio (backend+frontend), 904 tests backend + 22 frontend, 54+2+2 integration
tests en verde por separado — incluye un test de integración nuevo contra Postgres real que
confirma el ciclo completo (cae el primer individuo → resucita a ILESO con `groupDefeated=1` →
despiece parcial consume el cadáver real → cae el último → queda INCAPACITADO de verdad).

**Estado**: FIJADO.

**Aparte (mismo hilo, diseño de combate — CORREGIDO tras una primera respuesta equivocada)**: la
usuaria preguntó si el combate debería mostrar una tirada OPUESTA real (su atributo vs el atributo
de defensa del rival, p. ej. Fuerza vs Destreza) en vez de "vs 15". Primera respuesta (INCORRECTA):
mirando solo `difficultyHintFor`/`dice.ts` (usado para tiradas sueltas fuera de intercambio), dije
que la Dificultad es un número fijo por nivel, sin relación con el atributo del rival. **Corregido**:
el intercambio de combate real (`combatExchange.ts`, `resolveExchange`/`resolveIndependentExchange`)
SÍ hace exactamente eso — cada lado tira con SU PROPIO atributo (`rollSide`), ajustado por una
"rueda de debilidades" real (`attributeWheel.ts`, `ATTRIBUTE_RING`: Fuerza→Destreza→Inteligencia→
Arcano→Constitución→Voluntad→Carisma→Fuerza; Destreza le gana a Fuerza por diseño explícito de la
usuaria, 2026-07-28) que multiplica el valor efectivo del atributo según el tipo del rival. Ya
existe `CombatExchangeBadge.tsx` (frontend) mostrando las DOS tiradas juntas ("Tú"/"Enemigo"), cada
una con su atributo/dado/bono-ya-ajustado/resultado/dificultad. **Estado**: mecánica ya existe y
funciona — ver el hallazgo siguiente para el bug real de persistencia que hace que a veces solo se
vea un lado.

## 2026-08-13 (continuación) — `combatExchangeDisplay` (las dos tiradas del intercambio) no se persiste — desaparece al recargar la partida

**Síntoma**: la usuaria confirma en vivo: "antes había 2 [tiradas, Tú/Enemigo], pero cerrar la
partida y volver a abrirla ahora sale una" — justo el badge de dos lados (`CombatExchangeBadge`)
colapsando al de un solo lado (`RollBadge`) tras recargar.

**Causa raíz CONFIRMADA**: `LogEntry` (`schema.prisma:370-410`) solo tiene una columna `roll: Json?`
para UNA tirada (`RollInfo`) — no existe ninguna columna para `CombatExchangeDisplay` (las dos
tiradas + quién ataca + resultado cruzado). `combatExchangeDisplay` viaja en la respuesta HTTP del
turno recién resuelto (`turn.ts:801,876`), pero al persistir el `LogEntry` dentro de la transacción
(`turnResolution.ts:3773-3778`) solo se guarda `roll: effectiveRoll`, donde
`effectiveRoll = combatExchangeRoll ?? roll` (línea 3747) — es decir, SOLO el lado del jugador,
nunca el objeto de dos lados completo. Al recargar desde `/saves/:id` (que lee `LogEntry` de la
BD), el frontend nunca tuvo nunca un `combatExchange` que reconstruir — solo el `roll` de un lado,
así que cae al `RollBadge` de una sola tirada.

**Petición de diseño adicional de la usuaria** (una vez arreglada la persistencia): hacer el badge
de dos lados más claro — cabecera "Atributo vs Atributo", tirada de un lado, tirada del otro,
luego los cálculos, y remate indicando quién gana el intercambio (no solo dos filas paralelas con
la frase de resultado suelta debajo, como hace hoy `CombatExchangeBadge.tsx`).

**Fix aplicado**: (1) columna `LogEntry.combatExchange Json?` nueva (migración
`20260813150000_log_entry_combat_exchange`, aplicada con `prisma migrate deploy` + `prisma
generate`, nunca `migrate dev`); persistida en `mainLogEntry.create` (`turnResolution.ts:3778`) y
devuelta en recarga vía `toFrontendLogEntry` (`routes/saves/shared.ts`, usado por `GET /saves/:id`
y `GET /saves/:id/diario`). (2) `CombatExchangeBadge.tsx` rediseñado: cabecera "Atributo vs
Atributo" con punto de color por atributo, fila de cada lado (Tú/Enemigo) con su cálculo completo,
y remate indicando quién gana el intercambio (🏆 en la fila ganadora + frase). De paso, corregido un
hueco de tipo real: `CombatExchangeOutcome` (frontend `types.ts`) no incluía `'independiente'` — el
backend SÍ lo manda para cualquier habilidad de utilidad/ANALISIS, así que el pie de resultado se
veía en blanco para esos turnos; añadida su etiqueta.

**Estado**: FIJADO. `tsc -b` limpio, 877 tests backend + 22 frontend, 3 integration test files en
verde por separado.

## 2026-08-13 (continuación) — `defensor_contragolpea` hacía daño real con CUALQUIER habilidad de defensa, no solo las de ataque

**Síntoma**: la usuaria, revisando el rediseño del badge de arriba, preguntó por el resultado
`defensor_contragolpea` y confirmó explícitamente la regla de diseño ya fijada antes: *"solo si la
habilidad especifica que hace daño en defensa debe hacerlo... solo las de ataque hacen daño"*.

**Causa raíz CONFIRMADA — bug real, no percepción**: en los dos caminos NO independientes de
`resolveCombatExchangePhase` (`turnResolution.ts`, CASO DEFENSA ~línea 753 y "NPC se defiende"
~línea 900), el resultado `defensor_contragolpea` del `OUTCOME_TABLE` (`combatExchange.ts`)
otorgaba un golpe de vuelta REAL (`npcAttackHits`/`jugadorRecibeGolpe = true`, empeora
`condicionFisica`) con solo mirar el resultado de las tiradas — sin comprobar en ningún momento si
la habilidad de defensa usada tenía `effect: 'ATAQUE'`. Confirmado por grep: NINGUNA habilidad
`rol: 'defensa'` del catálogo (`classAbilities.ts`/`genericCombatAbilities.ts`/
`npcCombatAbilities.ts`/`dynamicAbilities.ts`) tiene `effect: 'ATAQUE'` — todas son `AGUANTE` o sin
efecto — así que CUALQUIER esquiva/bloqueo con una tirada excelente colaba daño real que la propia
regla de diseño prohíbe. (El camino SÍ independiente, para Contraataque/Grito de Guerra/utilidad,
ya hacía esto bien desde el rediseño de combate 2026-08-09 — el hueco estaba solo en el camino
"simple" de ataque-vs-defensa.)

**Fix aplicado**: `npcAttackHits`/`jugadorRecibeGolpe` para `defensor_contragolpea` ahora exigen
además `effect === 'ATAQUE'` de la habilidad de defensa concreta (la del jugador en CASO DEFENSA,
la del NPC en el camino inverso) — hoy, al no existir ninguna así, el bonus queda inactivo pero
listo para cuando se añada una. `exchangeContextBlock` (`combatExchange.ts`) recibe un nuevo
parámetro `defensorPuedeContragolpear` para que la narración deje de prometer un "golpe de vuelta
que sí conecta" cuando el gate no se cumple (cae al mismo texto que `ataque_falla`) — evita el
mismo tipo de bug "narración promete daño que la mecánica no hizo" ya visto varias veces en este
runbook. Tests nuevos en `combatExchange.test.ts`.

**Estado**: FIJADO. `tsc` limpio, 877 tests backend (incluye los 2 nuevos), 3 integration test
files en verde por separado.

## 2026-08-14 — XP de recompensa de misión se narra pero no se aplica a `Save.xp` al completarse matando/decapitando al NPC objetivo

**Síntoma**: ejecutado `npx tsx src/scripts/auditSave.ts` (runbook "revisar partida") sobre la
partida real de Gorhorn. El log muestra:
```
[08:24] (PJ) Misión completada: "Acabar con el Orco Enfurecido" — consigue Mapa de las Llanuras, +100 XP.
```
y `Save.xp` en la BD es **180**. Sumando a mano todo el XP narrado del log (25+25+25+5+25+50+25
del combate/huida, **más** los 100 de la misión) da 280 — 100 de más sobre lo persistido. Sumando
SOLO el XP de combate/huida (sin la misión) da exactamente 180: el XP de la misión nunca llegó a
`Save.xp`, pese a que la narración y el `LogEntry` de recompensa dicen que sí.

**Causa raíz confirmada leyendo el código**: `completeNpcTargetQuests` (`questResolution.ts:130`)
crea el `LogEntry` de recompensa con `questRewardNarrationFor(...)` (puro texto, "+N XP" ahí es
solo un string) y devuelve `rewardXp` dentro de `QuestCompletedInfo` — pero NUNCA toca `Save.xp`,
eso le toca al caller. Sus dos callers en `turnResolution.ts` (`applyCombatExchangeToNpcState`,
línea ~1317, para el golpe que deja INCAPACITADO/MUERTO en ataque normal; `applyExecuteTargets`,
línea ~1402, para "Decapitar") solo hacen `questCompletedInfo = result.questCompletedInfo` — ninguno
de los dos suma `result.questCompletedInfo.rewardXp` a `questRewardXp` (el acumulador que sí
alimenta `xpTurno`/`applyXp`/`Save.xp`, línea 3844). Comparar con el camino de saqueo (línea 1223,
dentro de la función de loot), que sí hace `questRewardXp += rewardQuest.rewardXp!` correctamente
— y con el caso especial "misión ya resuelta antes de aceptarla" (línea 3709), que también lo suma
bien. Es decir: **el XP de misión "derrotar a X" solo se aplica de verdad si se cierra por saqueo o
por el caso especial de apertura — nunca si se cierra al asestar el golpe que incapacita/mata, ni
al decapitar**, que son los dos caminos más comunes de cerrar este tipo de misión.

**Alcance**: cualquier `Quest` con `targetNpcId` + `rewardXp` en el catálogo se ve afectada — no es
solo la misión de Gistera Koh/Orco Enfurecido de esta partida, es el mecanismo genérico.

**Fix propuesto (no aplicado todavía, pendiente de luz verde)**: en `turnResolution.ts`, sumar
`combatExchangeResult.questCompletedInfo?.rewardXp ?? 0` y `executeResult.questCompletedInfo?.rewardXp ?? 0`
a `questRewardXp` justo donde ya se asigna `questCompletedInfo = ...` en cada uno de los dos sitios
(líneas ~3171 y ~3185) — mismo patrón ya usado en el camino de saqueo. Cubrir con un test de
integración real (turno que incapacita/mata al NPC objetivo de una misión con `rewardXp`, comprobar
`Save.xp` tras el turno) para que no se repita en otro camino nuevo el día de mañana.

**Estado**: FIJADO (2026-08-14, "vamos con todos los hallazgos"). Añadido
`questRewardXp += combatExchangeResult.questCompletedInfo?.rewardXp ?? 0` y el mismo para
`executeResult` — exactamente el fix propuesto arriba. `tsc` limpio, 1888 tests backend (incluye
los nuevos), 3 integration test files en verde por separado.

## 2026-08-14 (continuación) — ronda de hallazgos en vivo tras "revisar partida": 6 puntos

Sesión de juego real inmediatamente después de la auditoría de arriba — la usuaria fue reportando
en vivo mientras jugaba. Registrados juntos por brevedad, todos FIJADOS en el mismo commit.

**1. `npcAbilityUsed`/`playerAbilityUsed` no se persistían** — bug gemelo del ya fijado el
2026-08-13 para `combatExchange`/`roll`, pero que se quedó fuera de aquel fix. Sin guardarlos,
recargar la partida perdía el badge "NPC ataca/se defiende con..." y el nombre real del NPC en el
nuevo `CombatExchangeBadge` (caía al genérico "el enemigo"). Añadidas las columnas `LogEntry.
npcAbilityUsed`/`playerAbilityUsed` (`Json?`), persistidas en `mainLogEntry` y pasadas por
`toFrontendLogEntry`.

**2. Descubrimientos de Enciclopedia no se marcaban desde Minar/Talar/Desollar/Cazar ni desde "El
mundo"** — `recordEntityDiscoveries` solo se llamaba desde el turno normal narrado
(`turnResolution.ts`), nunca desde los endpoints deterministas de profesión (`recolectar.ts`/
`cazar.ts`) ni desde la ambientación de mundo (`entorno.ts`). Añadida la llamada en los 3 sitios.

**3. Herborista ofrecía objetos narrativos, no solo hierbas** — "Restos personales de Maktor" y
"Ofrendas de los Túmulos del Honor" estaban etiquetados `metodoObtencion: EXTRACCION`, el mismo
método que las hierbas reales (raíz de fuego, salvia del polvo) — sin ninguna etiqueta específica
para "hallazgo narrativo", el pop-up de Herborista los ofrecía igual. Reclasificados a `PASIVO`
(solo aparecen al "Explorar la zona" genérico, sin oficio) — encajan mejor narrativamente y ya no
se mezclan con hierbas de verdad.

**4. Narración de "cae inconsciente" contradecía que el combate pudiera continuar** — el hint de
`narrador.ts` para el golpe que deja INCAPACITADO sugería "cae inconsciente, se desploma sin
sentido" — pero el jugador puede seguir recibiendo/dando golpes contra ese mismo NPC (o rematarlo)
en turnos siguientes, algo que alguien de verdad inconsciente no podría sufrir de forma coherente.
Reescrito el hint: INCAPACITADO (no MUERTO) ahora se pide explícitamente "consciente, sin fuerzas
para seguir luchando" (cae de rodillas, malherido, tambalea), nunca inconsciente/desmayado — MUERTO
sigue siendo el final real.

**5. "Decapitar" renombrado a "Matar"** — cambio de texto puro en los 4 sitios visibles (botón,
título del modal de selección, confirmLabel) — petición explícita, sin motivo de bug.

**6. NPC "fuera del núcleo jugable" podía aparecer en combate real — Sella Marn (Nabieus)** — la
usuaria reportó "un combate sin sentido contra un npc nabierus" justo después de rematar al Orco
Enfurecido; confirmado con datos reales: `NpcState` de su partida tenía una fila de "Sella Marn"
(`HERIDO`) sin ningún `LogEntry` que la mencionara por nombre — coherente con haber entrado en
escena por un match de alias corto ("sella") en texto que no tenía relación con ella.

**Causa raíz**: Sella Marn es `kind: PRINCIPAL` y Nabieus de "El Margen Silencioso", región marcada
"fuera del núcleo jugable actual" en decenas de sitios del catálogo — pero solo como texto
descriptivo, nunca como dato. `npcScene.ts` (`detectNpcsInScene`) daba por candidato de escena a
CUALQUIER NPC `kind: PRINCIPAL` sin comprobar región ("personajes únicos pueden aparecer en
cualquier sitio por guion") — Sella Marn además no tiene `homeLocationSlug`, así que también
colaba por la rama de itinerantes. Dos rutas distintas, la misma NPC se saltaba las dos.

**Alcance real, confirmado revisando los 9 NPC `PRINCIPAL` del catálogo**: además de Sella Marn,
4 más estaban en la misma situación sin que nada lo impidiera — Archimagistrada Yovenne Tal,
General Vrask Ombra y Kael Dorn (los 3 de "La Meseta del Orden", también "fuera del núcleo jugable
actual... Gorhorn no ha estado aquí"), y Hagar ("vive fuera del grafo v1", ya documentado así en su
propia bio). Los 4 restantes (Gistera Koh, Kort'ikar Torgash, Terk'ikar Ulkha, Orco Enfurecido) son
todos de Las Llanuras del Viento Rojo, el núcleo real — no afectados.

**Fix aplicado**: nuevo campo `Npc.nucleoJugable` (`Boolean @default(true)`, migración
`20260814100000_npc_nucleo_jugable`), marcado `false` a mano en los 5 PRINCIPAL confirmados fuera
de núcleo (`worldCatalog.ts`). `detectNpcsInScene` reordenado: el bypass de misión activa y "ya
establecido antes en esta partida" siguen ganando SIEMPRE (no hacer desaparecer retroactivamente a
alguien que la propia partida ya trajo a escena, aunque fuera por este bug), pero ni "es PRINCIPAL"
ni "itinerante sin homeLocationSlug" pueden ya saltarse `nucleoJugable === false`. Mismo gate
añadido en `recordEntityDiscoveries` (entityDiscovery.ts) — un NPC fuera de núcleo tampoco debería
poder desbloquearse en la Enciclopedia por el mismo tipo de match de alias corto.

**Estado**: FIJADO. `tsc` limpio, 1888 tests backend (6 nuevos: 3 en `npcScene.test.ts`, 1 en
`entityDiscovery.test.ts`, cubriendo exclusión + los dos bypass legítimos), 3 integration test
files en verde por separado. Catálogo resembrado (`seed-catalog.ts`), verificado contra la BD real
que los 5 quedaron en `false` y los 4 de Las Llanuras en `true`.

## 2026-08-14 (continuación) — objetos narrativos "PASIVO" salían en cualquier sitio de la región, incluida la primerísima escena

**Síntoma**: la usuaria reinició la partida y, en el primerísimo "Exploro la zona" (en La Hondonada
del Eco, la escena de apertura), el panel "Has encontrado" ofreció "Brazalete trenzado del Clan
Maktor", "Pañuelo de luto Serhu" y "Tótem de clan roto" — objetos de recuerdo del clan aniquilado de
Gorhorn, sin ninguna relación real con dónde está parado. Petición explícita: que los objetos ligados
a Maktor salgan en Los Restos de Maktor (o donde cayó el clan), y "el resto" (Ofrendas de los
Túmulos) en la zona que más encaje.

**Causa raíz**: la reclasificación de estas 6 fuentes de `EXTRACCION` a `PASIVO` (hallazgo anterior
de esta misma ronda, punto 3) las hizo salir por `selectDiscoveries` (discovery.ts), que solo
filtraba por REGIÓN (`Llanuras del Viento Rojo` entera), nunca por Location concreta — el propio
comentario original de estas dos fuentes (2026-07-20) ya decía "ligadas a Location, no a fauna/
flora", pero esa parte nunca se construyó. Las ubicaciones ya existían en el catálogo con nombre/
descripción que encajan solas: `restos-de-maktor` ("último asentamiento del Clan Maktor... antes de
su aniquilación") y `tumulos-del-honor` ("donde los clanes... entierran a quienes murieron con
honor").

**Bug real de segunda vuelta, encontrado verificando el fix a mano contra la BD real**: el primer
intento (filtrar por Location exacta dentro del cálculo de `candidates`) NO bastaba — el propio
fallback de `selectDiscoveries` ("si el filtro deja `candidates` vacío, no filtres, muestra todo")
resucitaba los objetos ligados en cualquier otro sitio en cuanto se disparaba, y hoy SIEMPRE se
dispara fuera de esos dos sitios: estas 6 filas son las ÚNICAS `HarvestYield` con `metodoObtencion:
PASIVO` que existen en todo el catálogo, así que en cualquier otra ubicación el filtro las dejaba
todas fuera → `candidates.length === 0` → fallback → vuelven a aparecer sin filtrar.

**Fix aplicado**: nuevo mapa `harvestSourceHomeLocationSlug` (worldCatalog.ts, sourceSlug → slug de
Location exacto) con las 2 fuentes. `selectDiscoveries` corta estas fuentes de la lista base
`yields` ANTES de calcular `candidates` (no dentro de su filtro), así el fallback nunca puede
resucitarlas fuera de su sitio — en La Hondonada del Eco (y cualquier otro sitio sin contenido
PASIVO propio), "Explorar la zona" ahora puede legítimamente no encontrar nada pasivo, en vez de
ofrecer siempre estos 6 objetos por defecto.

**Estado**: FIJADO. Verificado a mano contra la BD real (8 rondas en Hondonada: vacío; en Restos de
Maktor: solo objetos de Maktor; en Los Túmulos: solo ofrendas) y con 3 tests de integración nuevos
en `turn.integration.test.ts` (vía `POST /turn/classify` real, no mocks) — 57/57 en verde en ese
archivo, 1891 tests backend en total, 3 integration test files en verde por separado. **Pendiente
para otra sesión** (fuera de alcance de esta ronda): la usuaria pidió también repartir "el resto" de
los recursos PASIVO por zonas concretas donde más encajen — hoy no hay ningún otro recurso PASIVO en
el catálogo (todo lo demás es EXTRACCION/MINERIA/TALA/CAZA), así que no hay nada más que mover
todavía; queda anotado para cuando se amplíe el catálogo con más hallazgos ambientales.

## 2026-08-14 (continuación) — objetos recolectados de verdad descubiertos en BD, pero invisibles en la Enciclopedia (frontend nunca la refrescaba)

**Síntoma**: la usuaria recolectó Piedra/Mena de hierro/Leña de matorral de cuerno/Manojo de salvia
del polvo (vía Minar/Talar/Herborista, el fix del punto 2 de la ronda anterior) y reportó "todo eso
no está saliendo en la enciclopedia".

**Verificado contra la BD real primero** (antes de asumir que el fix de backend había fallado):
`DiscoveredEntity` de su partida SÍ tenía las 7 filas esperadas (`mena-de-hierro`,
`manojo-salvia-polvo`, `piedra`, `lena-matorral-cuerno` + la fauna asociada), con `discoveredAt`
posterior al fix del punto 2 — el backend funcionaba bien de verdad, el hallazgo está en el frontend.

**Causa raíz**: `useEnciclopedia` (hooks/useEnciclopedia.ts) pide `GET /world/:slug/enciclopedia`
UNA sola vez, en un `useEffect` con deps `[worldSlug, saveId]` — valores que no cambian en toda la
sesión. Hasta el 2026-08-13 esto se compensaba porque `EnciclopediaPanel.tsx` volvía a pedir por su
cuenta cada vez que se abría la pestaña — un "dedupe de doble fetch" de esa fecha quitó ese refetch
(razonable: dos hooks pidiendo lo mismo sin motivo), pero sin darle a `useEnciclopedia` ninguna forma
de refrescarse después, dejó la Enciclopedia entera congelada en el estado del momento de cargar la
partida durante el resto de la sesión — cualquier descubrimiento nuevo (recolectar, cazar, combate,
misión...) quedaba invisible hasta recargar la página entera. Regresión real de aquel refactor, no
detectada hasta ahora.

**Fix aplicado**: `useEnciclopedia` expone `refetch()` (mismo fetch de siempre, disparado por un
contador en vez de por las deps de `[worldSlug, saveId]`; la carga inicial sigue poniendo
"Cargando...", un refetch en segundo plano no). GameView.tsx lo llama en un `useEffect` que observa
`activePanel === 'enciclopedia'` — se refresca justo al abrir la pestaña, en vez de enganchar una
llamada en cada sitio que puede descubrir algo (recolectar/cazar/crafteo/narración normal — demasiados
sitios, fácil dejarse uno, que es exactamente como se coló este bug la primera vez).

**Estado**: FIJADO. `tsc -b` limpio, 22 tests frontend en verde (sin cambios, esta ruta no tenía
cobertura de test antes ni la tiene ahora — es un hook simple sin lógica de negocio propia más allá
de "pedir de nuevo").

## 2026-08-14 (continuación) — golpes_mutuos también dañaba con una habilidad defensiva sin `ATAQUE`

**Síntoma**: "me hizo daño con una habilidad defensiva y en el siguiente turno otra vez" — captura
mostrando a Múrgol usando "Lana Espesa" (defensiva) y aun así infligiendo daño real vía
`combatExchange`.

**Causa raíz**: el downgrade de `defensor_contragolpea` → `ataque_falla` cuando el defensor no tiene
una habilidad con `effect:'ATAQUE'` (fix del 2026-08-13) nunca cubrió el otro resultado posible del
mismo intercambio, `golpes_mutuos` — ese caso seguía aplicando daño incondicionalmente en ambos lados
de `turnResolution.ts` (CASO DEFENSA y "NPC se defiende"), exactamente el mismo bug de fondo sin
cerrar del todo.

**Fix aplicado**: mismo criterio, extendido a `golpes_mutuos` en los dos sitios simétricos
(`combatExchange.ts` § `exchangeContextBlock`, `turnResolution.ts` en ambas ramas) — solo el lado
cuya habilidad activa tiene `effect:'ATAQUE'` puede dañar, sea `defensor_contragolpea` o
`golpes_mutuos`.

**Estado**: FIJADO. 2 tests nuevos en `combatExchange.test.ts`; 2 tests de integración existentes en
`turn.integration.test.ts` ajustados (uno probaba la condición de carrera de "Caza en grupo" y
necesitaba resetear `pendingNpcAttack` para no colarse por la rama corregida; el otro literalmente
afirmaba el bug viejo — "el jugador no sale ILESO tras atacar repetidamente" — y su aserción se
invirtió con un comentario explicando por qué). 917 unit + 58+2+2 integration en verde.

## 2026-08-14 (continuación) — crafteo narraba con el modelo en vez de la frase determinista

**Síntoma**: "usar una habilidad de crafteo no dijimos que iba a ser determinista y no narrado?" —
recordatorio de un criterio de diseño ya decidido (mismo patrón que saqueo/despiece) que el código de
crafteo nunca llegó a aplicar del todo: el objeto se creaba de verdad, pero el texto que veía la
jugadora seguía siendo el que proponía el modelo, no una frase fija.

**Fix aplicado**: `turnResolution.ts` acumula los nombres de lo crafteado en el bucle de
`CRAFTING_RECIPES` y, si hubo al menos uno, sobreescribe `narration.narration` con
`"{personaje} craftea: {lista}."` — mismo mecanismo `narrationOverride` que ya usa el despiece.

**Estado**: FIJADO. Test de integración nuevo en `turn.integration.test.ts` (receta real "Vendaje
improvisado") verificando el texto exacto y el consumo/creación de inventario.

## 2026-08-14 (continuación) — combate "sin sentido" con Cruzavientos + reloj de mundo congelado en recolección

**Síntoma** (mensaje único con 3 partes): "revisa la partida porque sin narracion ni nada tambien me
ha aparecido un combate con cruzavientos sin sentido" + "recolectar, talar...todas las acciones no
estan contabilizando el en el reloj de mundo....toda accion lleva un tiempo" + "se logea mal la hora
como en la segunda imagen" (captura: una entrada de las 08:49 mostrada pegada justo después de la de
las 08:22, ambas con la misma etiqueta "Día 1, 08:22").

**Verificado contra la BD real primero** (`auditSave.ts` + consultas sueltas a `LogEntry`): el
combate con Cruzavientos SÍ estaba bien narrado y con `timeLabel` correcto y creciente en la propia
base de datos (08:37→08:49) — el motor determinista funcionaba bien. El síntoma era puramente de
presentación en vivo, no de datos persistidos.

**Causa raíz real, única, que explica las 3 partes del mensaje a la vez**: `GameView.tsx` solo llama
`setFictionalDate(...)` UNA vez, dentro de `syncFromSave` (carga inicial/reconexión) — cada turno
posterior en la MISMA sesión (`handleSubmit`, `submitCombatAction`/`handleCombatTurnResolved`)
sellaba su `LogEntry` local con ese mismo `fictionalDate` ya congelado, porque `/turn/narrate` nunca
devolvía la hora nueva que el propio backend ya había calculado y persistido
(`nuevaFictionalDateLabel`, `worldClock.ts`) — el dato bueno existía, pero no viajaba de vuelta al
cliente. Esto por sí solo ya explica la "hora mal logeada" en vivo. Además, `recolectar.ts` (Minar/
Talar/Desollar) nunca tocaba `WorldState.fictionalMinutes` en absoluto — esas acciones costaban CERO
tiempo de ficción, agravando el mismo síntoma (el reloj se quedaba fijo más tiempo aún) y dejando sin
sentido mecánico que recolectar/talar sean gratis en tiempo de juego.

**Fix aplicado**:
1. `narrateAndPersistTurn` (turnResolution.ts) devuelve ahora `timeLabel` (releído fresco de
   `WorldState` tras el commit) en `NarrateAndPersistResult`; `turn.ts` lo incluye en el payload
   `{type:'done'}` del streaming NDJSON.
2. `GameView.tsx`: `handleSubmit`/`submitCombatAction`→`handleCombatTurnResolved` ahora leen ese
   `timeLabel` de la respuesta (no el `fictionalDate` local obsoleto) para sellar la entrada de log
   de ESE turno, y llaman a `setFictionalDate(...)` para que el resto de la sesión ya parta del valor
   correcto.
3. `recolectar.ts`: nueva función `minutosRecoleccionFor` (10 min para 1 unidad, +2 min por unidad
   extra, tope 30 — petición explícita de la usuaria) que avanza `WorldState.fictionalMinutes` de
   verdad dentro de la misma transacción cuando `touched.size > 0`, y sella el `LogEntry` con la
   hora YA avanzada (antes usaba la hora de `save.worldState`, leída antes de la petición y nunca
   tocada). `GameView.tsx` también refresca `fictionalDate` al recibir ese `logEntry`.

**Pendiente para otra sesión** (fuera de alcance de esta ronda, no reportado explícitamente por la
usuaria esta vez): el pop-up de "Cazar" limpio (`cazar.ts`, presa única sin combate) y el flujo de
huida previa al combate (`/saves/:id/combat/flee`, session.ts) tampoco avanzan el reloj de ficción —
el segundo es coherente con su propio diseño (tirada instantánea, sin coste de tiempo por decisión
explícita 2026-07-24), el primero probablemente sí debería costar tiempo por el mismo criterio que
Minar/Talar/Desollar, pero no se ha tocado todavía.

**Estado**: FIJADO (los 3 síntomas reportados). `tsc -b` limpio en backend y frontend. 917 tests
unitarios backend + 58+2+2 de integración + 22 tests frontend, todos en verde.

## 2026-08-14 (continuación) — revisión centrada en narración: ataque a Múrgol narrado como si fuera contra Cruzavientos

**Petición**: "revisa la partida antes de que reinicie revisando la narración" — pasada de nuevo sobre
la misma partida ya auditada hoy (56 entradas, sin turnos nuevos), esta vez con foco explícito en
prosa/coherencia narrativa, no en mecánica (ya cubierta en las entradas anteriores de hoy).

**Síntoma**: turno `[Día 1, 08:39] (TÚ) "Salgo a cazar y ataco a 'Múrgol'."` resuelve con +25 XP (la
mecánica sí registra un golpe válido), pero la narración generada no menciona a Múrgol en ningún
momento: *"El Cruzavientos se mete en medio de la huida del matorral de cuerno, haciendo que las
hojas caigan sobre su piel y dejando un vistazo frío al amanecer. Su cuchillo está a punto de afilar
mientras se desplaza, listo para el próximo encuentro."* — habla de Cruzavientos y de "matorral de
cuerno" (un recurso de recolección mencionado dos turnos antes), nunca del objetivo real del ataque.
Turno relacionado, mismo tramo: `[Día 1, 08:38]` narra que, al huir, "Gorhorn... dejando que el
Múrgol se escabulle entre las sombras" — pero Múrgol sigue en combate y es atacado/analizado/rematado
en TODOS los turnos siguientes (08:39-08:47), contradiciendo que se hubiera escabullido.

**Diagnóstico**: no es un bug de código — la capa determinista (quién recibe el golpe, cuánta XP, qué
`NpcState` cambia) resolvió bien; el fallo es puramente de la prosa generada por el modelo, que se
"distrajo" con otro elemento presente en la escena (Cruzavientos, ya mencionado en el turno anterior)
en vez de nombrar al objetivo real de la acción del turno. Revisada la familia de validadores
narración-vs-mecánica de `narrador.ts` (11 detectores en cascada, `hasFalseCombatHit`/
`hasResurrectedDeadNpc`/etc.): ninguno cubre "la narración de un golpe resuelto nombra a un NPC
distinto del objetivo real" — hueco real, no cubierto hasta ahora.

**Estado**: PENDIENTE. No se ha aplicado ningún fix — reportado a la usuaria con la propuesta de un
detector nuevo (mismo patrón que los 11 ya existentes: comprobar que, cuando hay un intercambio
mecánico resuelto contra un objetivo concreto Y hay más de un NPC/fauna real en escena, el texto
generado nombre al objetivo correcto en vez de a otro presente) a la espera de luz verde.

## 2026-08-15 — rediseño de balance: la rueda de debilidades solo premia, nunca penaliza

**Contexto**: al construir la animación de dados en paralelo (`DiceRollReveal.tsx`), la usuaria vio
un intercambio real en partida — "Destreza (Gorhorn) 20 vs Fuerza (Orco enfurecido) 5" — y preguntó
por qué salía tan descompensado. Explicando el cálculo salió a la luz el diseño real: la rueda de
debilidades (`attributeWheel.ts`, `typeMultiplierFor`) multiplicaba el valor efectivo de quien
tenía ventaja de tipo por `magnitude` (p. ej. ×1.5) Y AL MISMO TIEMPO dividía el de quien tenía
desventaja por ese mismo `magnitude` (×0.67) — la diferencia real entre los dos lados de un mismo
intercambio no era ×1.5, era ×1.5×1.5 ≈ ×2.25. La usuaria: "lo que tenemos está mal... si no es muy
injusto... si lo hacemos en los dos extremos siempre saldrán diferencias demasiado notables".

**Decisión** (opción elegida de 3 propuestas): la rueda de debilidades pasa a SOLO PREMIAR, NUNCA
PENALIZAR — quien tiene ventaja de tipo sigue sacando su multiplicador normal (×1.5/×1.15 según
distancia en el anillo), pero quien tiene desventaja se queda en ×1 (neutro), exactamente igual que
si no hubiera ninguna relación en la rueda. El tipo de atributo pasa de ser algo que te pueden
quitar a ser un extra que solo puedes ganar.

**Fix aplicado**: `typeMultiplierFor` (`backend/src/services/attributeWheel.ts`) — el lado que
pierde la comparación de tipo devuelve `1` en vez de `1 / magnitude`. Mismo cambio replicado en el
puerto del frontend (`frontend/src/lib/attributeWheel.ts`, usado por "Analizar rival"). Barrido
completo de referencias para no dejar ningún punto de información desactualizado (petición
explícita: "revisa bien no dejar ningún punto de información que haga referencia a esto"):
- Comentarios en `attributeWheel.ts`/`combatExchange.ts` (backend y frontend) que describían el
  multiplicador como ">1 ventaja, <1 desventaja".
- `CombatExchangeBadge.tsx`/`DiceRollReveal.tsx` — el multiplicador coloreado verde/rojo se queda
  con la rama roja a propósito (sigue siendo correcta para `LogEntry.combatExchange` YA
  PERSISTIDA de antes de este rediseño), pero el comentario ahora aclara que ningún turno nuevo
  puede producir ya un multiplicador por debajo de 1.
- Enciclopedia § "Combate" (`combatLore.ts`, entrada "Ventajas entre atributos") — reescrita para
  no prometer que la desventaja "penaliza".
- Enciclopedia § "Atributos" → "Árbol de debilidades" (`EnciclopediaPanel.tsx`,
  `AttributeWheelDiagram`) — el texto explicativo y la tabla mostraban literalmente "×1.5 / ÷1.5"
  y "usarlo al revés lo divide"; corregidos a "×1.5 (solo quien gana)" y "no te penaliza".
- `attributeWheel.test.ts` reescrito entero (la vieja prueba "es antisimétrico... A gana, B pierde
  en la misma proporción" ya no es cierta por diseño) + 2 aserciones en `combatExchange.test.ts`
  que esperaban `valorEfectivo` reducido para el lado perdedor.

**Estado**: FIJADO. `tsc -b` limpio en backend y frontend. 922 tests unitarios backend (antes 921,
+1 neto por la reescritura de `attributeWheel.test.ts`) + 22 tests frontend, todos en verde.

## 2026-08-20 — escena de Gistera Koh: figura sin resolver en el acantilado, diálogo mal atribuido, Orco Enfurecido con caballo/armadura inventados

**Petición**: "revisa la partida, muchos errores en la narración... está inventando muchas cosas" —
tras una sesión larga arreglando el sistema de sugerencias y el bug de combate falso con Gistera
Koh (ver conversación de la misma fecha), la usuaria rejugó la escena desde el principio y pidió
revisión. `auditSave.ts` sobre `cms82odjc000qri0up7n1msni` (11 entradas de log en ese momento);
`logs/backend.log` sin líneas `[turno]`/`[lint]` útiles porque el proceso se había reiniciado
después de jugar estos turnos concretos (el `nohup ... > backend.log` de `iniciar-tarkor.sh` trunca
el log en cada arranque).

**Síntoma 1 — figura en el acantilado que nunca se resuelve**: turno `08:00`, acción "Exploro la
zona". La narración introduce DOS entidades separadas en el mismo párrafo: *"ve una figura
inquietante agazapada en lo alto de un acantilado cercano. La figura no hace ningún movimiento..."*
y, aparte, *"Una sombra se acerca a gran velocidad por la llanura... es una orca con la marca del
Clan Serhu"* (Gistera, ya prevista por el encuentro guionizado). La "figura del acantilado" no
corresponde a ningún NPC del catálogo ni al propio Orco Enfurecido (que unos turnos después aparece
"a unos kilómetros... a caballo", geografía incompatible con "agazapada en un acantilado cercano") —
invención pura del modelo, sin base en ningún hecho de sesión ni roster real. Se coló además como
`WorldState.facts` real ("Gorhorn se percata de la presencia potencialmente hostil en los
acantilados aledaños"), y no se vuelve a mencionar ni resolver en ningún turno posterior — cabo
suelto permanente.

**Síntoma 2 — diálogo mal atribuido**: turno `08:16`, tras la réplica de Gorhorn ("¿Debería ayudarte
a huir de él? Pero no tengo tiempo para aliados."), sigue sin ninguna acotación de cambio de
interlocutor: *"Porque mi padre fue traicionado por sus propios compañeros. Y sí, necesito ayuda
para acabar con el que me persigue."* Por el contenido, encaja con la historia real de Gistera Koh
(su padre adoptivo, Uhuld Koh, fue asesinado por encargo — bio de `orco-enfurecido-hondonada` en
`worldCatalog.ts`), así que probablemente es SU réplica — pero al no marcar el cambio de hablante,
se lee como si Gorhorn hablara de un padre suyo nunca establecido en su propia historia (la suya es
la caída del Clan Maktor). Misma familia ya documentada el 2026-08-01/2026-08-14 (atribución de
diálogo) — no hay ninguna "palabra equivocada" que un detector determinista pueda cazar, es la
estructura completa de el turno la que falla.

**Síntoma 3 — Orco Enfurecido con caballo y "armadura reluciente"**: turno `08:17`, tras "Yo me
encargo de tu perseguidor": *"un orco a caballo corre sin cesar en su dirección, armadura reluciente
bajo el sol matutino."* La bio de catálogo (`orco-enfurecido-hondonada`, `worldCatalog.ts`) no
menciona caballo ni armadura en ningún momento — *"calvo y de complexión corpulenta, piel beige
agrietada, sin pintura de clan visible"* es casi lo contrario de "armadura reluciente". Invención
visual sin base en su ficha.

**Diagnóstico**: los 3 son de la misma familia que la entrada del 2026-08-14 (Cruzavientos/Múrgol) —
fallos de PROSA, no de mecánica (`condicionFisica`/XP/quest se resolvieron bien en los 3 turnos,
confirmado en `auditSave.ts`). No hay detector determinista razonable para ninguno de los 3 (no son
"palabra prohibida", son invención de contenido nuevo sin base). Camino de mejora: reforzar el
prompt de `narrateAction` con una instrucción explícita de "no inventes entidades/amenazas nuevas
que no estén ya en la escena real, ni rasgos físicos que contradigan la bio del catálogo del NPC" —
mismo criterio que ya se usa para las reglas de sugerencias (`narrador.ts`), nunca aplicado antes al
lado de la narración normal (`turnResolution.ts`/`contextBlocks`).

**Fix aplicado**: la usuaria confirmó ("si") — pero el sitio correcto no era `contextBlocks`
(instrucción por turno, `turnResolution.ts`) sino el propio `Modelfile` (SYSTEM prompt horneado en
el modelo Ollama `tarkor-narrador`, `FROM qwen2.5:7b`): la regla que ya existía ("no inventes
fauna/flora/personajes con nombre... pero SÍ puedes NPCs sin nombre") era precisamente la que abría
la puerta al síntoma 1 (la "figura del acantilado" es un NPC sin nombre, permitido tal cual por esa
misma frase). Reescrita esa regla para acotar la licencia: los NPCs sin nombre solo valen como
detalle de ambientación PASAJERO, nunca como amenaza/entidad nueva que quede sin resolver. Añadidas
dos reglas nuevas: no dar rasgos físicos/equipo a un NPC con ficha propia que contradigan lo ya
establecido (síntoma 3), y marcar siempre con acotación quién habla cuando dos personajes tienen
diálogo en el mismo turno (síntoma 2). Reconstruido el modelo real (`ollama create tarkor-narrador
-f Modelfile` vía `flatpak-spawn --host`, binario en `~/.local/ollama/bin/ollama`, no en el PATH
del sandbox) y forzada su recarga (`ollama stop tarkor-narrador`, seguía cargado en memoria con el
system prompt viejo) — no hace falta reiniciar el backend, es un artefacto de Ollama aparte.
Verificado con una llamada de prueba directa a `/api/generate` tras la recarga: narración coherente,
sin entidad nueva inventada.

**Estado**: FIJADO (a nivel de prompt — sigue siendo la misma familia "tono/prosa" sin detector
determinista posible, ver diagnóstico de arriba, así que "fijado" aquí significa reforzado en el
Modelfile y verificado una vez, no blindado al 100%). Pendiente de confirmación jugando en vivo.

## 2026-08-20 (continuación) — diálogo del jugador entre comillas bloqueado como "NPC inventado"

**Petición**: "revisa la partida" de nuevo, sobre una partida nueva de la misma escena de Gistera
Koh (para comprobar en vivo el fix del Modelfile de la entrada anterior). `auditSave.ts` sobre
`cms82odjc000qri0up7n1msni` (12 entradas de log en ese momento).

**Síntoma**: turno `08:15`, acción del jugador `"Me acerco a ella y digo: 'Quien eres y a donde vas
con tanta prisa?'"` — el turno entero se bloqueó con: *"El nombre de Quien eres y a donde vas con
tanta prisa? no le suena a nada — ni persona, ni bestia, ni nada que camine sobre Helek Sirik que
Gorhorn sepa."* Ni siquiera llegó a `classifyAction`/`narrateAction` (frase determinista, sin IA).
El jugador repitió la MISMA acción sin comillas alrededor de toda la frase en el turno siguiente y
funcionó con normalidad (Gistera responde).

**Causa raíz**: `detectsFabricatedNpcClaim` (Fase 3 de `docs/18-validacion-accion-jugador.md`,
`playerActionValidation.ts`) extrae CUALQUIER texto entre comillas simples (`QUOTED_NAME_REGEX`) y
lo valida contra el catálogo de NPCs — pero disparaba con tres intenciones distintas como gatillo:
ataque, búsqueda hostil, **y diálogo**. El diseño original (`ver docs/18 § Fase 3`) pensaba en
"ataco a 'el Dragón de Fuego Eterno'" (comillas = nombre de un objetivo concreto), pero con
intención de DIÁLOGO las comillas casi siempre significan justo lo contrario: la réplica hablada
completa del propio jugador (convención ya usada en todo el resto del motor), no el nombre de a
quién se la dice. El regex agarra la PRIMERA cadena entre comillas de toda la acción sin distinguir
los dos casos, así que cualquier "digo: '...'" con una frase que no coincide con ningún NPC real
(prácticamente siempre, una pregunta no es un nombre) dispara el bloqueo. Bug de diseño real en una
pieza deliberada y ya completada (2026-08-13) — no un caso límite raro: bloquea una de las formas
más naturales de escribir diálogo en el juego.

**Fix aplicado**: quitado `detectsDialogueIntent` de la condición de disparo de
`detectsFabricatedNpcClaim` — sigue disparando con ataque/búsqueda hostil (donde comillas SÍ suelen
señalar un objetivo concreto), nunca con diálogo puro (mismo criterio "más vale dejar pasar que
bloquear con dudas" que ya usa el resto de esta familia). `detectsAbsentSceneNpcClaim` (función
hermana, Fase 1, un caso distinto: NPC real que existe pero no está en escena) mantiene intacto su
propio disparador con diálogo incluido — un `sed` de más lo tocó por error a mitad del proceso de
verificación y se revirtió antes de dar el fix por bueno; `git diff` final confirma que solo cambió
`detectsFabricatedNpcClaim`. Test de regresión añadido en `playerActionValidation.test.ts`
reproduciendo la acción real exacta; verificado con el protocolo de revertir/probar/restaurar
(revertido con `sed`, el test nuevo falla con el síntoma real reproducido, restaurado, vuelve a
pasar).

**Estado**: FIJADO. `tsc -b` limpio. 1055/1055 tests unitarios backend (antes 1054, +1 por el test
nuevo) + 72/72 de `turn.integration.test.ts` en solitario, todos en verde.

## 2026-08-20 (continuación) — el "perseguidor" de Gistera Koh nunca se detecta en escena si no se le nombra "Orco enfurecido"

**Petición**: tras la ronda anterior, la usuaria preguntó explícitamente: "y el tema de que el Orco
enfurecido aunque lo busque como 'perseguidor' no aparezca?" — señal de un turno real donde "Reviso
lo alreddores buscando al perseguidor" solo narró "un rastro fresco de botas", sin detectarlo de
verdad.

**Causa raíz**: `detectNpcsInScene` (`npcScene.ts`) compara el texto de la acción contra
`name`/`aliases` reales de catálogo — `orco-enfurecido-hondonada` solo tiene registrado `'orco
enfurecido'`. La propia escena de Gistera Koh lo mantiene A PROPÓSITO sin nombrar ("uno de los
suyos me pisa los talones", "quien la persigue" tras el fix de la entrada de arriba), así que el
jugador nunca tiene forma de escribir su nombre real para que el motor lo reconozca — un choque
directo entre dos piezas de diseño ya existentes, cada una correcta por separado.

**Decisión de diseño** (consultada con la usuaria vía pregunta explícita antes de implementar):
NO añadir "perseguidor" como alias global de catálogo — es NPC `PRINCIPAL` (candidato en CUALQUIER
escena del juego, ver `candidateNpcs` en `npcScene.ts`), así que cualquier futura trama con un
"perseguidor" genérico lo detectaría por error. En su lugar, inyección determinista ACOTADA a esta
misión concreta (mismo patrón ya usado para `travelInterruptionNpcId`, `turnResolution.ts`).

**Fix aplicado**: nuevo bloque en `turnResolution.ts` (tras la inyección de
`travelInterruptionNpcId`) — mientras la misión "Acabar con el Orco Enfurecido" sigue `ACTIVA` (ni
antes de aceptarla ni tras completarla/fallarla) Y la acción combina vocabulario real de
"perseguidor" (`persegu\w*` o el idiomatismo "pisa(n) los talones" que la propia Gistera usa) CON
una intención real de buscar/atacar (`detectsSearchIntent` de `discovery.ts`, o
`detectsAttackIntent`/`detectsHostileSearchIntent` ya existentes) — nunca con una mención de pasada
sin verbo activo ("Gistera me contó que fue perseguida" no dispara) — se inyecta al Orco Enfurecido
en `npcsInScene` igual que si se le hubiera nombrado. Su temperamento es `AGRESIVO`, así que una vez
detectado `shouldForceCombat` abre combate solo, sin depender del verbo exacto del jugador (mismo
criterio que ya rige cualquier otro NPC agresivo detectado por nombre real) — de ahí la exigencia
extra de intención real: una inyección demasiado floja habría abierto combate por una mención
puramente narrativa, un problema peor que el original.

Dos tests de integración nuevos en `turn.integration.test.ts`: buscar al "perseguidor" sin nombrarlo
abre combate contra `orco-enfurecido-hondonada` (verificado con el protocolo revertir/probar/
restaurar: sin el fix, `npcsInScene` queda vacío y el test reproduce el síntoma real), y una mención
de pasada sin intención real NO lo detecta ni abre combate.

**Estado**: FIJADO, con una segunda vuelta (jugando en vivo justo después de este fix): el combate SÍ
se abría de verdad, pero la narración libre seguía describiendo solo la búsqueda ("un rastro de
sudor y miedo... desviándose hacia una boca de cueva"), sin explicar contra quién — `npcSceneBlockFor`
le da al modelo la ficha del Orco Enfurecido como contexto informativo, pero nada le decía que ESTE
es el turno exacto en que se le descubre. Añadido un reveal determinista (mismo patrón que las fases
de Gistera Koh: nunca dejar un reveal narrativo crítico a que el modelo lo infiera solo del
contexto) que se dispara con `pursuerRevealedThisTurn` — rasgos físicos tomados tal cual de su bio
de catálogo, aquí SÍ se revela su nombre real. Test ampliado para comprobar que la narración final
menciona "Orco Enfurecido"; verificado también con revertir/probar/restaurar.

`tsc -b` limpio. 1055/1055 tests unitarios backend + 74/74 de `turn.integration.test.ts` en solitario
(antes 72, +2 nuevos) + 4/4 del resto de integración, todos en verde.

## 2026-08-20 (continuación) — sugerencia "Acepto ayudarla y busco al que me persigue": REGLA 4 comprimida + pronombre equivocado, y un bug propio de raíz verbal descubierto al arreglarlo

**Síntoma**: la usuaria, probando la sugerencia con chips nueva, señaló: "la primera sugerencia en
primera persona, debería se[r] le pe[r]sigue" — la sugerencia decía "Acepto ayudarla y busco al que
ME persigue", afirmando (por error) que a Gorhorn le persiguen a él, cuando en realidad es a Gistera
Koh. Además viola REGLA 4 (dos beats en una frase: aceptar + una segunda acción ya decidida) — el
modelo copió "me persigue" literal de la voz de Gistera (que sí habla en primera persona de sí
misma) sin adaptar el pronombre al punto de vista del jugador.

**Fix aplicado**: en vez de intentar corregir el pronombre (frágil), se descarta la sugerencia
entera — `dropSuggestionsCompressingAcceptance` (`narrador.ts`), dos reglas: (1) "y" en el tramo
inmediato tras el verbo de aceptar, sin condición de por medio (protege una aceptación CON
condición legítima, que sí puede tener una "y" más adelante en la frase); (2) contenido — si la
sugerencia empieza aceptando ayudar y en cualquier parte menciona al perseguidor, es casi con toda
seguridad la misma compresión, cazando también la variante con PUNTO en vez de "y" ("Acepto
ayudarte, Gistera Koh. Debo enfrentarme al que te persigue primero.", encontrada en la propia
verificación en vivo minutos después del primer fix).

**Bug propio encontrado durante la verificación**: al construir el filtro (2), la primera versión
usaba `persegu\w*` — la MISMA raíz ya usada en el fix anterior (`PURSUER_REFERENCE_REGEX`,
turnResolution.ts) para detectar al perseguidor por vocabulario. "Perseguir" cambia de raíz en
presente (persigo/persigues/**persigue**/**persiguen**/persiguiendo/persiguió usan "persig-", no
"persegu-") — justo las formas MÁS usadas en esta escena real ("el que la persigue", "quien me
persigue"). `persegu\w*` a secas solo cazaba el sustantivo "perseguidor" y las formas de
infinitivo/imperfecto (perseguir, perseguía), dejando fuera el verbo en presente casi siempre —
significa que el fix anterior (detectar al perseguidor buscándolo) tenía el mismo hueco sin que
nadie lo hubiera notado todavía (su verificación en vivo usó "buscando al perseguidor", el
sustantivo, que sí matcheaba por casualidad). Corregido en los DOS sitios a `pers[ei]g\w*`. Test de
regresión nuevo en `turn.integration.test.ts` con la acción "Busco a quien me persigue" (verbo, no
sustantivo) para blindar contra la reincidencia.

**Estado**: FIJADO. `tsc -b` limpio. 1061/1061 tests unitarios backend (+6 sobre la entrada anterior)
+ 75/75 de `turn.integration.test.ts` en solitario (+1) + 4/4 del resto de integración, todos en
verde.

## 2026-08-20 (continuación) — reintento cuando la ÚNICA aceptación se descarta + segundo bug de raíz verbal en "Examina"/"Examinó"

**Petición**: "las sugerencias no me convencen,,,," — captura mostrando solo 2 sugerencias (ninguna
aceptaba), tras el fix anterior de la misma tarde.

**Causa raíz 1**: `dropSuggestionsCompressingAcceptance` (recién añadido) acertaba descartando la
sugerencia mala, pero era la ÚNICA que aceptaba — el resultado final se quedaba con solo pregunta +
"exploro el entorno", reproduciendo la queja original de REGLA 1 por un camino nuevo: el modelo SÍ
intentó aceptar, solo que mal, y el filtro (correctamente) se lo comió. **Fix**: extendido el
reintento ya existente (antes solo cubría "el modelo copió el ejemplo literal") — si el diálogo
pendiente necesita respuesta Y la única aceptación se descartó por comprimir dos beats, reintenta
una vez a 0.8. Verificado en vivo (3 llamadas directas): el reintento se dispara de verdad, aunque
no siempre logra una aceptación limpia — límite real del modelo de 7B en este hardware, no un bug
de código adicional.

**Causa raíz 2, encontrada en la MISMA verificación**: la sugerencia de "explorar el entorno" salía
como "Examinó el terreno..."/"Examine el terreno..." — tercera persona de pretérito o imperativo,
2 de 2 veces seguidas, nunca "Examino" (primera persona presente correcta). Nueva red de seguridad
`dropSuggestionsWrongGrammaticalPerson` — vocabulario cerrado de la misma familia semántica
(examinar/revisar/buscar/inspeccionar/observar/explorar/registrar) en sus formas equivocadas.
Gotcha encontrado al escribir el test: el mismo problema de `\b` con vocales acentuadas ya
documentado en `enciclopediaIndex.ts` (frontend) — "Buscó"/"Exploró" nunca matcheaban con `\b` (JS
no trata "ó" como letra), arreglado con `(?![\p{L}\p{N}])` + flag `u`, mismo patrón ya establecido.

**Estado**: FIJADO. `tsc -b` limpio. 1065/1065 tests unitarios backend (+4) + 75/75 de
`turn.integration.test.ts` en solitario + 4/4 del resto de integración, todos en verde (un fallo
falso de 7 tests visto de pasada, por contención de Postgres al correr el script de verificación en
vivo A LA VEZ que la suite — desaparece al correr solo, gotcha ya conocido).

**Nota honesta para la usuaria**: verificado con 9 llamadas reales seguidas contra la partida real —
los filtros funcionan correctamente (nunca dejan pasar una compresión ni una persona gramatical
equivocada), pero el modelo de 7B sigue intentando comprimir "aceptar" con una segunda acción con
bastante frecuencia, así que en algunos turnos el resultado final se queda en 1-2 sugerencias en vez
de 3. No es un bug pendiente — es el techo real de fiabilidad de este modelo local en esta tarea
concreta; forzar 3 siempre exigiría rellenar con algo peor solo por completar el cupo.

## 2026-08-20/21 (continuación) — rediseño a sugerencias cortas + investigación 9B/4B (modelos qwen3.5 de "razonamiento")

**Contexto**: "pues esto cada vez va a peor" — captura con una única sugerencia y un dato inventado
("sus compañeros quieren verla muerta", plural, cuando Gistera dijo "uno de los suyos", singular).
Sexto bug real distinto de la misma tarde en la MISMA frase de Gistera Koh. Antes de otro parche
puntual, la usuaria preguntó por qué era tan difícil "si cualquier IA ya hace esto" y si el problema
era RAG. Diagnóstico honesto (no es RAG — `generateSuggestions` no llama a `retrieveLore` en
absoluto): sostener a la vez persona gramatical, número, pronombre, no-compresión y cobertura
aceptar/rechazar EN UNA FRASE LARGA es mucho para un modelo de 7B sin autocrítica en un solo
intento — la brecha real es de capacidad del modelo (comparado con un modelo de datacenter de
cientos de miles de millones de parámetros), no de prompt mal escrito.

**Decisión** (consultada, no aplicada a ciegas): rediseño de sugerencias de frase narrativa completa
a FRAGMENTOS CORTOS de 3-6 palabras ("Acepto ayudarla", "Pregunto por el perseguidor" — etiquetas de
acción, no párrafos). Menos palabras = menos superficie para que persona/número/pronombre se
tuerzan o se comprima una segunda acción — ataca la causa, no otro síntoma. `SUGGESTIONS_BASE_RULES`/
EJEMPLO 1/EJEMPLO 2 reescritos; `EXAMPLE_SUGGESTION_TEXTS` (anti-copia) actualizado a fragmentos
cortos equivalentes.

**Bug propio encontrado en la primera verificación**: `EXAMPLE_SUGGESTION_TEXTS` incluía "Pregunto
por el perseguidor" — con solo 2 palabras de contenido, CUALQUIER sugerencia real y correcta que
mencionara "perseguidor" (la respuesta obvia para esta escena) compartía el 100% y se descartaba
igual, por la misma familia de bug ya fijada el 2026-08-20 con `similarity()` plana. Quitado de la
lista anti-copia (se queda solo en el EJEMPLO ilustrativo del prompt, donde no hace daño).

**Resultado verificado** (6 llamadas reales tras el fix, save `cms82odjc000qri0up7n1msni`): "Acepto
ayudarla" sobrevive 6/6 veces — el problema de fondo de toda la tarde (ninguna aceptación limpia)
queda resuelto. "Pregunto por el/su perseguidor" sobrevive también. La tercera sugerencia (acción de
entorno) sigue fallando en persona gramatical con frecuencia, pero `dropSuggestionsWrongGrammaticalPerson`
la caza siempre — resultado estable de 2-3/3 sugerencias correctas, nunca una equivocada mostrada.

**Investigación 9B/4B** (petición explícita: "quizás será mejor con el modelo 9B?" / "prueba tambien
contra el 4b"): `qwen3.5:9b` y `qwen3.5:4b` ya estaban descargados en el Ollama compartido (del otro
proyecto). Primer intento con 9B: cargó (5.6GB GPU) pero ni terminó de generar "di hola" en 90s —
inviable en este hardware por RAM (solo 659MB libres con el modelo cargado). Con 4B: mismo síntoma.
Causa raíz encontrada: la familia qwen3.5 es de RAZONAMIENTO — sin `think: false` en la petición a
Ollama, genera un monólogo interno larguísimo (campo `thinking`) antes de la respuesta real,
agotando el timeout sin llegar nunca al JSON pedido. Con `think: false` añadido a
`buildRequestBody` (`lib/ollama.ts`, aplica a TODAS las llamadas, inofensivo para qwen2.5 —
verificado sin regresión): qwen3.5:4b sí responde en ~25s, calidad comparable al 7B actual en esta
tarea concreta de sugerencias (misma tanda de aciertos/fallos). qwen3.5:9b se queda sin probar en
profundidad (mismo problema de RAM que antes, aunque ahora con `think: false` probablemente cargaría
más rápido — pendiente si se quiere retomar).

**Pendiente, no decidido todavía**: `OLLAMA_MODEL_NARRADOR` sigue apuntando a `tarkor-narrador`
(qwen2.5:7b) — NO se ha cambiado el modelo de la narración principal ni de las sugerencias. Probar
4B para sugerencias es una cosa; usarlo para la narración normal (`narrateAction`, el camino que más
importa) es una decisión distinta y más grande, sin probar todavía (anacronismos, coherencia de
combate, atribución de diálogo...) — necesitaría su propia ronda de verificación antes de tocar
`env.ollamaModelNarrador` de verdad.

**Estado**: FIJADO (rediseño a fragmentos cortos) + `think: false` añadido de forma permanente
(mejora real, sin coste). `tsc -b` limpio. 1065/1065 tests unitarios backend + 75/75 de
`turn.integration.test.ts` en solitario + 4/4 del resto de integración, todos en verde.

**Actualización inmediata**: "el 4b solo para sugerencias no puede ser una opción?" — sí, y de hecho
ya era trivial: `generateSuggestions` ya tenía su propia llamada a Ollama separada de
`narrateAction`. Nueva variable `OLLAMA_MODEL_SUGERENCIAS` (`env.ts`, `.env`/`.env.example`,
default `qwen3.5:4b`) usada SOLO en `generateSuggestions` — `env.ollamaModelNarrador` (la narración
real de cada turno) sigue intacto, sin tocar. Verificado en vivo contra la partida real con la
variable ya activa por defecto (sin overrides manuales): 3 llamadas seguidas, "Acepto ayudarla"/
"Acepto ayudarte" + "Pregunto por su/tu perseguidor" correctas las 3 veces, ~24-26s por llamada
(algo más rápido que el 7B). `docs/15-instalacion.md` actualizado con el cuarto modelo a descargar
(`ollama pull qwen3.5:4b`).

## 2026-08-21 — mensaje de iniciativa + tirada de dados perdidos al recargar tras abrir combate

**Síntoma**: "la primera vez que se abre el combate y al recargar la página se está perdiendo el
mensaje de la iniciativa y la tirada de los dados". Captura mostrando el panel de combate ya abierto
tras encontrar al Orco Enfurecido (bug del "perseguidor" ya fijado, confirmado funcionando bien en
vivo de paso).

**Causa raíz** (investigado con un subagente Explore, verificado a mano antes de tocar código):
tercer bug GEMELO de dos ya fijados (`combatExchange` 2026-08-13, `npcAbilityUsed`/`playerAbilityUsed`
2026-08-14, ver comentarios de esas columnas en `schema.prisma`) — `nextInitiativeRoll`
(`InitiativeResult`, quién actúa primero en el PRÓXIMO intercambio) se calcula en
`resolveCombatExchangePhase` (`turnResolution.ts:1111`) pero solo viajaba en la respuesta NDJSON del
turno recién resuelto (`routes/turn.ts:911,993`) — nunca se guardaba en ningún `LogEntry`.
`lastInitiativeRoll` en el frontend (`GameView.tsx`) era puro estado de React, reseteado a `null` en
cada `openCombat()` y sin ningún fallback a datos recargados — al volver a montar la página, sencillamente no había manera de recuperarlo.

**Fix aplicado**: mismo patrón exacto que los dos bugs gemelos —
- Migración `20260821000000_log_entry_initiative_roll` — `LogEntry.initiativeRoll Json?` nueva.
- `turnResolution.ts` (`mainLogEntry.create`) persiste `nextInitiativeRoll` ahí.
- `routes/saves/shared.ts` (`toFrontendLogEntry`, compartida por GET /saves/:id y GET /saves/:id/diario) lo reenvía al frontend.
- `frontend/src/types.ts` — nuevo `InitiativeRollInfo` (sustituye el tipo anónimo repetido 3 veces).
- `GameView.tsx` — al recargar, si `save.combateIniciado` sigue activo, busca el último `LogEntry`
  con `initiativeRoll` en `characterLog` y rehidrata `lastInitiativeRoll` desde ahí, en vez de
  quedarse en `null` para siempre.

Test de integración nuevo (`turn.integration.test.ts`) verificado con el protocolo de revertir/
probar/restaurar: sin el fix, `LogEntry.initiativeRoll` queda `null` tras un intercambio real
(reproduce el síntoma), con el fix pasa.

**Estado**: FIJADO. `tsc -b` limpio en backend y frontend. 1065/1065 tests unitarios backend + 76/76
de `turn.integration.test.ts` en solitario (+1) + 4/4 del resto de integración + 31/31 frontend,
todos en verde.

## 2026-08-21 — despiece narrado por texto libre duplicaba botín en fauna cazada en grupo

**Contexto**: sin partida jugada activa (sin `dev-server.log` reciente) se sustituyó el runbook
habitual de "revisar partida" por una auditoría de código: 5 agentes en paralelo, cada uno acotado a
una zona de archivos backend/frontend sin solapes, buscando bugs reales de comportamiento (no deuda
técnica ni lore — esas son las auditorías 2 y 3 del mismo día). Verificación final propia (no solo el
autoinforme de cada agente): `rm -rf dist` + `tsc -b` en ambos paquetes + suite completa (2213 tests
backend + 31 frontend) + los 3 `*.integration.test.ts` en solitario, todos en verde tras aplicar los
6 fixes de abajo.

**Síntoma**: ninguno reportado por la usuaria — encontrado por lectura de código. `applyHarvest`
(camino de despiece cuando el jugador escribe la acción a mano, p. ej. "despiezo al corretolvas",
paralelo al endpoint dedicado del panel "Despiece") marcaba `NpcState.saqueado: true` tras cada
despiece, sin tocar `corpsesLooted`. Para fauna cazada en grupo (`NpcState.groupSize` no nulo) el
criterio real de "¿queda algo por despiezar?" es `corpsesLooted < groupDefeated`
(`hasPendingLoot`, `npcScene.ts`) — `saqueado` no distingue individuos dentro de un grupo. El panel
dedicado (`recolectar.ts`) ya usaba el criterio correcto; solo el camino narrado tenía el bug.

**Causa raíz**: `applyHarvest` (`turnResolution.ts`) nunca incrementaba `corpsesLooted`, así que
`detectHarvest` seguía viendo "presa pendiente" indefinidamente por esta vía — permitiendo despiezar
el mismo cadáver del grupo una y otra vez, duplicando materiales sin límite.

**Fix aplicado**: `applyHarvest` usa ahora `hasPendingLoot` (import de `npcScene.js`) para el guard
anti-carrera, e incrementa `corpsesLooted` (acotado por `groupDefeated`) igual que `recolectar.ts`
cuando el NPC tiene `groupSize`; sin grupo, se mantiene `saqueado: true` como antes.

**Estado**: FIJADO. `routes/turn.integration.test.ts` (76/76) + suite no-integración (2213/2213) en
verde tras el cambio.

## 2026-08-21 (continuación) — cazar/recolectar/fundar reino seguían funcionando tras una muerte definitiva

**Síntoma**: ninguno reportado — encontrado por lectura de código, comparando `turn.ts`/`combat/flee`
(que sí comprueban `save.endedAt` y devuelven 409 "Esta partida ha terminado") contra el resto de
rutas de acción.

**Causa raíz**: `saves/cazar.ts` (`/explorar`, `/confirmar`), `saves/recolectar.ts` (`GET /:oficio`,
`/explorar`, `/confirmar`) y `saves/reino.ts` (`/fundar`) no comprobaban `endedAt` en absoluto. El
frontend solo desactiva el composer principal cuando `endedAt` está puesto, pero el panel lateral
"Habilidades" (Cazar/Minar/Talar/Desollar) seguía accesible sin guard — tras una muerte definitiva se
podía seguir depleccionando `WorldPopulation`, creando `NpcState`, añadiendo inventario, o incluso
fundando un reino nuevo, todo en una partida que la propia UI ya da por terminada para siempre.

**Fix aplicado**: mismo guard 409 que ya usan `turn.ts`/`combat/flee`, añadido a las tres rutas.
Alcance deliberadamente parcial: `inventario.ts` (equipar), `progression.ts`
(`/attribute-points`) y `habilidades.ts` (CRUD de `SavedAction`) tienen el mismo hueco pero solo
mutan datos propios de la partida ya terminada, sin efecto en recursos compartidos del mundo — se
deja como PENDIENTE, pregunta de producto (¿debería bloquearse igual por consistencia, o es
aceptable "ordenar la mochila" tras game-over?).

**Estado**: FIJADO (los 3 endpoints con efecto en recursos compartidos). Tests nuevos en
`cazar.test.ts`/`recolectar.test.ts`/`reino.test.ts`, suite completa en verde.

## 2026-08-21 (continuación) — reiniciar partida dejaba una `Faction` fantasma que bloqueaba refundar el reino

**Síntoma**: reproducible pero no visto aún en partida real — encontrado auditando `creation.ts`.
Secuencia: fundar un reino, reiniciar la partida (`POST /saves/:id/restart`), fundar OTRO reino con
el mismo nombre exacto → `POST /reino/fundar` responde "Ya has fundado tu reino" (P2002) para una
partida que en realidad vuelve a Día 1.

**Causa raíz**: `Faction` es `saveId`-scoped, con `onDelete: Cascade` solo si se borra la fila `Save`
— cosa que `/restart` no hace (reutiliza el mismo id). El reset dejaba `Save.kingdomName: null` y
borraba `DiscoveredEntity`, pero nunca borraba la fila `Faction` en sí, así que
`factionSlug = slugify(nombre)-${save.id}` chocaba contra `@@unique([worldId, slug])` de la fila
huérfana.

**Fix aplicado**: `tx.faction.deleteMany({ where: { saveId: save.id } })` dentro de la transacción de
`/restart` (`creation.ts`).

**Estado**: FIJADO. Test de integración nuevo en `creation.integration.test.ts` (reproduce el
síntoma sin el fix, pasa con él) verificado contra Postgres real.

## 2026-08-21 (continuación) — doble submit al equipar/desequipar objetos desde el modal de detalle

**Síntoma**: ninguno reportado — encontrado por lectura de código. `DetailModal.tsx` era el único
sitio del proyecto con el patrón equipar/desequipar que no seguía el guardado `busy`/`disabled` que
ya usan `AbilityForm.tsx` y `CharacterSaves.tsx` en el resto de la app.

**Causa raíz**: `runEquipAction` no tenía guardado de "ya en curso" ni deshabilitaba los tres botones
(equipar/desequipar/sustituir) mientras la petición estaba en vuelo. Un doble clic rápido disparaba
dos llamadas concurrentes a `onEquip`/`onUnequip`, cada una con su propia foto del inventario en
closure, pudiendo dejar el inventario visualmente inconsistente.

**Fix aplicado**: estado `busy` con early-return si ya hay una acción en curso, `disabled={busy}` en
los tres botones. Sin cambio de comportamiento en el caso de un solo clic.

**Estado**: FIJADO. Sin test dedicado (el proyecto no tiene infraestructura de test de componentes
React); verificado con `tsc -b` + `vitest run` en verde.

## 2026-08-21 (continuación) — panel de combate no se abría tras resolver una caza sin combate

**Síntoma**: ninguno reportado — encontrado por lectura de código. Tras cazar una presa débil que se
resuelve sin combate mecánico (`resuelveSinCombate: true`), el panel de combate nunca se abría; el
jugador veía en su lugar el banner "⚔️ Combatir" (pensado para emboscadas reales) durante un instante,
antes de que el auto-cierre por combate-ya-resuelto lo quitara.

**Causa raíz**: `handleHuntResolved` hacía `setCombateIniciado(result.combate)` seguido
inmediatamente de `openCombat()` — `openCombat()` leía `combateIniciado` del cierre del render
actual, donde el `setState` de la línea anterior aún no se había aplicado (siempre `null`, porque
"Cazar" solo se ofrece fuera de combate), así que su guard `if (!combateIniciado) return` cortaba
la apertura del panel.

**Fix aplicado**: `openCombat` acepta ahora un `combatOverride` opcional (`combatOverride ??
combateIniciado`); `handleHuntResolved` le pasa `result.combate` explícitamente. De paso, corregido
el `onClick={openCombat}` del botón del banner "Combatir" (con el nuevo parámetro opcional, el
`MouseEvent` del clic se habría colado como `combatOverride`) a `onClick={() => openCombat()}`.

**Estado**: FIJADO. `tsc -b` limpio, 31/31 tests frontend en verde (sin test unitario propio — el
proyecto verifica este tipo de flujo de `GameView.tsx` jugando en vivo, no con test unitario).

## 2026-08-21 (continuación) — renombrado PACIFICA→CONQUISTADA (`reputation.ts`, 2026-08-15) nunca propagado al frontend

**Síntoma**: detectado por un agente de la auditoría (fuera de su zona de archivos, así que quedó
anotado en vez de arreglado hasta esta pasada final) — ninguno reportado en partida real, pero
afectaría a la UI clave del momento de fundar el primer Ayuntamiento.

**Causa raíz**: `backend/src/services/reputation.ts` renombró el resultado de fundación de reino de
`'PACIFICA'` a `'CONQUISTADA'` el 2026-08-15 (confirmado por comentario en `reputation.test.ts`), y
`turnResolution.ts` manda ese valor tal cual al frontend. Pero `frontend/src/types.ts`
(`KingdomFoundedInfo['outcome']`), `KingdomFoundingModal.tsx` (`OUTCOME_LABEL`/`OUTCOME_TONE`) y
`GameView.tsx` (`handleReabrirFundacionReino`, reconstrucción del popup tras recarga) seguían
esperando `'PACIFICA'` — ninguno de los 5 agentes de la auditoría tenía `types.ts` en su zona
exclusiva de edición, así que quedó huérfano hasta la verificación final.

**Efecto real**: al fundar una región reclamada sin hostilidad (el caso más común de fundación no
conflictiva en territorio con dueño), el popup de fundación de reino se quedaba sin etiqueta ni color
(`OUTCOME_LABEL`/`OUTCOME_TONE` devolvían `undefined` para `'CONQUISTADA'`).

**Fix aplicado**: renombrado `'PACIFICA'` → `'CONQUISTADA'` en los tres sitios.

**Estado**: FIJADO. `tsc -b` limpio en frontend tras el cambio.

## 2026-08-23 — Quio narrado en 3 ubicaciones distintas el mismo día

**Síntoma**: la partida de Gorhorn (save `cms82odjc000qri0up7n1msni`) narra a "el Quio" como fauna
ambiental presente en tres escenas del mismo Día 1, en tres lugares muy alejados entre sí:
La Hondonada del Eco (08:16, combate de apertura contra el Orco Enfurecido — *"El Quio reacciona
con un gruñido bajo"*), el Paso de los Pilares Rotos (10:46/11:38, dos intentos de huida —
*"el Quio, unido a su rutina diaria, no parece prestarle atención"*), y por fin Los Manaderos
(14:16 — *"El Quio lo observa desde la orilla del manadero"*), que es su hogar real.

**Confirmado por la usuaria en directo**: reporta el mismo síntoma con sus propias palabras ("meter
al gusano por todas partes") sin haber visto todavía este hallazgo — coincide de forma independiente.

**Causa raíz (confirmada, ligada a un pendiente de diseño YA CONOCIDO desde 2026-08-21)**: `quio`
no tiene ninguna fila en `faunaTerrainTag` ni `harvestSourceHomeLocationSlug` (confirmado por grep
en `worldCatalog.ts`) que lo ancle a Los Manaderos — y esto no es un descuido aislado, es la
práctica totalidad del catálogo (`harvestSourceRegion` ancla case todo a "Llanuras del Viento Rojo"
en conjunto, no a zonas concretas), un pendiente de diseño que la propia usuaria ya señaló el
2026-08-21 y aparcó explícitamente ("eso lo miramos si no en otro momento" — ver
`ampliar-lore-checklist.md` § Pendiente de diseño). Esta partida es la primera evidencia real
jugando de que ese aparcamiento tiene coste de inmersión real, no solo teórico.

**Estado**: PENDIENTE — ligado directamente al pendiente de diseño de anclaje por zona ya abierto,
subida de prioridad anotada ahí. Candidato de arreglo rápido y parcial: darle a `quio` un
`faunaTerrainTag` (`'humedo'`, coherente con sus vecinos de Los Manaderos), pero el arreglo real y
completo pasa por la decisión de diseño más amplia (anclar TODO el catálogo por zona, no solo Quio).

## 2026-08-23 — Cruzavientos ataca repetidamente y nunca se narra quién es (reportado en vivo por la usuaria)

**Síntoma reportado por la usuaria**: "un cruzavientos me lleva atacando y he tenido que huir de él
como 10 veces y no se narra en ningún lado" — confirmó que TODOS los "Intento huir de este combate"
del log (ver entrada de Quio arriba) son en realidad contra el Cruzavientos, "en todas las zonas por
las que he pasado y varias veces" — no solo cerca de Los Pilares Rotos, donde anida según su lore.

**Investigación**: el `Save` real (`cms82odjc000qri0up7n1msni`) NO tiene ningún `NpcState` de
Cruzavientos, ni `pendingNpcAttack`, ni `pendingCombatNpcSlugs` con nada dentro — no hay ningún
rastro persistido en la base de datos de que Cruzavientos haya sido nunca el antagonista mecánico
real de estos combates. Esto encaja con que la narración de cada "huida" (leída en el log completo)
nunca lo menciona por nombre — en su lugar describe a Quio ("el Quio... no parece prestarle
atención") o solo el entorno, nunca al propio atacante.

**Teoría más probable (no confirmada del todo, sin `dev-server.log` con diagnóstico `[turno]`
disponible para esta partida)**: mismo pendiente de diseño de anclaje por zona que el hallazgo de
Quio de arriba — si la selección de fauna "en escena"/de encuentro no filtra por ubicación real,
Cruzavientos (que sí vuela sobre gran parte de la región, pero anida solo en Pilares Rotos) puede
estar disparándose como amenaza en zonas donde no pintaría nada, y el propio texto de la huida no
recibe el nombre real del atacante como contexto — de ahí que la usuaria solo sepa que es él por lo
que ve en la interfaz (banner de combate), nunca por la prosa.

**Estado**: PENDIENTE, sin causa raíz de código confirmada al 100%. Para cerrarlo de verdad hace
falta reproducirlo con `dev-server.log` activo (ver runbook § 2) y mirar la línea `[turno]` del
momento exacto de un "Intento huir" contra Cruzavientos — ver qué `npcsInScene` devuelve y si el
nombre del atacante real llega o no al contexto de `narrateAction`. Recomendado para la próxima
sesión de juego real.

## 2026-08-23 — Ruptidar "ataca" en combate pese a ser INOFENSIVO/"No ataca"

**Síntoma**: en la misma partida, la caza de Ruptidar (11:40-11:46) se narra como combate real de
varios asaltos con golpes recibidos: *"Gorhorn se mantiene firme, conteniendo la sacudida del
ataque de Ruptidar..."* — pero la ficha real de Ruptidar en `worldCatalog.ts` dice
`ataqueNatural: 'No ataca.'` y `temperamento: 'INOFENSIVO'`.

**Causa raíz**: no investigada a fondo. Puede ser puramente narrativo (el modelo dramatiza un
combate donde mecánicamente no hay ningún ataque real del NPC) o puede que el flujo de "Salgo a
cazar y ataco a X" trate a Ruptidar igual que cualquier fauna de combate normal sin comprobar
`temperamento`/`ataqueNatural` antes de generar la narración de intercambio — a diferencia del flujo
de Desollar/recolección, que sí distingue caza de combate real.

**Estado**: PENDIENTE. A revisar: si el motor realmente permite que un `INOFENSIVO` sin
`ataqueNatural` inflija daño mecánico real al jugador (grave, sería un bug de reglas) o si es solo
narración sin consecuencia mecánica (menos grave, solo inmersión). No se pudo diferenciar sin log de
turno — recomendado comprobar en la próxima partida jugada con `dev-server.log` activo.

## 2026-08-23 — Ruptidar descrito como "insecto" con "alas rotas" (es un reptil sin alas)

**Síntoma**: el golpe de gracia a Ruptidar narra: *"El insecto se desploma con un lastimoso chirrido
de sus alas rotas."* — pero la `bio` real en `worldCatalog.ts` es explícita: *"Reptil serpentiforme
de 30 a 60 cm... coraza inerte..."*, sin alas ni relación con insectos.

**Causa raíz**: alucinación pura del modelo — la `bio` correcta SÍ existe en el catálogo (confirmado
por grep), así que si estaba en el contexto del prompt para ese turno, el modelo la ignoró. Mismo
tipo de fallo que otros ya vistos de "detalle físico inventado sin anclaje real", pero esta es la
primera vez que afecta a la especie/categoría entera de la criatura (insecto vs. reptil), no solo un
detalle suelto.

**Estado**: PENDIENTE, primer caso de este subtipo — a vigilar si se repite con otra fauna nueva.

## 2026-08-23 (continuación) — "several pasos", inglés colado en narración española (2ª vez)

**Síntoma**: dos turnos del mismo combate (08:53 y 08:54) narran *"hace que retroceda **several
pasos**"* y *"haciendo que tropiece **several pasos** atrás"* — palabra inglesa suelta en medio de
narración española, la misma familia que el caso de "small clearing" (2026-08-13).

**Causa raíz**: misma ya registrada — calidad de redacción del modelo local, sin detector
determinista barato (ver 2026-08-13 arriba).

**Estado**: PENDIENTE — segunda vez que se ve el patrón exacto de "palabra en inglés completa", y
esta vez repetido DOS veces en el mismo combate (no un caso aislado). Sigue sin proponerse un
corrector genérico, pero la recurrencia empieza a acumularse — a tener en cuenta si aparece una
tercera vez.

## 2026-08-23 (continuación) — "reptil reptilise"/"reptil reptil reptil", errores gramaticales del modelo

**Síntoma**: mismo combate contra Ruptidar, tres turnos seguidos con palabras rotas o repetidas:
*"hace que el reptil **reptilise** por el impacto"* (11:41), *"haciendo que el reptil **reptilise**
y tropieze hacia atrás"* (11:42, con "tropieze" también mal escrito), y *"deja al reptil **reptil
reptil** jadeante"* (11:45, palabra triplicada).

**Causa raíz**: misma familia que "errores gramaticales sueltos del modelo" (2026-08-08, PENDIENTE).
"Reptilise" no es una palabra española real — probablemente el modelo intentó un verbo a partir de
"reptil" ("reptar"/"replegarse") y falló de forma consistente las 2 veces que lo intentó en el mismo
combate, además de la repetición literal de "reptil reptil" en un tercer turno.

**Estado**: PENDIENTE, mismo criterio que el resto de esta familia — no se propone corrector
genérico todavía, pero 3 fallos en un solo combate de 5 turnos es una densidad alta a tener en
cuenta.

## 2026-08-23 — XP de capítulo (+500×2) verificado — NO ES BUG

**Síntoma investigado**: dos entradas del log dan `[+500 XP]` por acciones aparentemente triviales
("monto un vivac breve y descanso", "Viajo hacia Los Manaderos"), una de ellas provocando subida de
nivel — a primera vista parecía el bug histórico de "capitulo alucinado por el modelo" (2026-08-08,
ver `turnResolution.ts:4683-4694`).

**Verificación**: NO es ese bug. `HITOS_QUE_PUEDE_PROPONER_EL_MODELO` ya excluye `'capitulo'` de lo
que el modelo puede alucinar — el único camino real es `chapterDue` (determinista, backend). Los
`+500 XP` coinciden exactamente con los 2 capítulos reales que sí existen en `=== CAPÍTULOS ===`
(Cap. 1 y Cap. 2) — el sistema de XP por capítulo está funcionando exactamente como se diseñó, el
turno en el que cae `chapterDue` no tiene por qué coincidir con un momento narrativamente "grande".

**Estado**: NO ES BUG. Confirmado leyendo el propio comentario de `turnResolution.ts`, que documenta
el fix histórico de este exacto problema.
