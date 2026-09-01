# Sesión jugadora — hallazgos de UX, diseño y lore/consistencia

Registro en vivo, jugando una partida real (Gorhorn, orco Cazador nivel 3, Las Llanuras del Viento
Rojo, partida de prueba `cmthl2fb4000wrixt2hckti84`) como si fuera una jugadora cualquiera — sin
buscar deliberadamente romper el motor, sin verificar funcionalidad. Distinto de
`checklist-pruebas-juego.md` (funcionalidad), `lore-hallazgos.md` (desfase doc↔código) y
`deuda-tecnica-hallazgos.md` (calidad de código interna): aquí solo cuenta lo que una jugadora
real percibiría — ¿se entiende la pantalla?, ¿la narración suena consistente con el lore?, ¿el flujo
se siente bien diseñado?

Cada entrada: qué pasó, por qué me chirría, y una sugerencia si la tengo. Sin resolver nada sobre la
marcha — solo observar y anotar.

---

## Índice

- [Curación narrada con "escudo de energía arcana" en un Cazador orco sin magia](#curación-narrada-con-escudo-de-energía-arcana-en-un-cazador-orco-sin-magia)
- [El narrador pone al personaje hablándose a sí mismo por su nombre](#el-narrador-pone-al-personaje-hablándose-a-sí-mismo-por-su-nombre)
- [Kirelon-arenoso "ciego" abre un ojo a media interacción — contradice su propia ficha y su propio cierre](#kirelon-arenoso-ciego-abre-un-ojo-a-media-interacción--contradice-su-propia-ficha-y-su-propio-cierre)
- [Modo dinámico: primera impresión jugando de verdad](#modo-dinámico-primera-impresión-jugando-de-verdad)
- [Mapa de zona y mapa regional: buena primera impresión, sin leyenda de iconos](#mapa-de-zona-y-mapa-regional-buena-primera-impresión-sin-leyenda-de-iconos)
- ["Canizor" y "Aullador Rojo" narrados como un único animal cuando son dos NPCs distintos del catálogo](#canizor-y-aullador-rojo-narrados-como-un-único-animal-cuando-son-dos-npcs-distintos-del-catálogo)
- [Concordancia de género rota: "la ataque"/"la canizor"](#concordancia-de-género-rota-la-ataquela-canizor)
- [+500 XP mostrado justo tras un fallo, sin explicar que es un hito de capítulo y no XP del propio combate](#500-xp-mostrado-justo-tras-un-fallo-sin-explicar-que-es-un-hito-de-capítulo-y-no-xp-del-propio-combate)
- [Acción de rastreo clasificada como recolección de planta — intención completamente distinta a la escrita](#acción-de-rastreo-clasificada-como-recolección-de-planta--intención-completamente-distinta-a-la-escrita)
- [Icono del botón COMBATIR inconsistente: espada en un momento, aspa roja en otro](#icono-del-botón-combatir-inconsistente-espada-en-un-momento-aspa-roja-en-otro)
- [`pendingCombatNpcSlugs` queda "fantasma" tras un combate ya RESUELTO — reproducido jugando de forma normal](#pendingcombatnpcslugs-queda-fantasma-tras-un-combate-ya-resuelto--reproducido-jugando-de-forma-normal)

---

## Curación narrada con "escudo de energía arcana" en un Cazador orco sin magia

**Qué pasó**: al descansar (Día 3, 09:13) y de nuevo al examinar las heridas justo después (09:33),
el narrador describe la curación dos veces seguidas con la misma imagen mágica: "las heridas... comienzan
a sellarse con un fino escudo de energía arcana" y luego "notando que el escudo arcáneo se ha
fortalecido alrededor de las heridas más profundas". Gorhorn es Cazador, orco, sin ninguna vertiente
arcana — es curación por descanso normal, no una habilidad ni una poción.

**Por qué chirría**: como jugadora, leer "energía arcana"/"escudo arcáneo" dos turnos seguidos me hace
dudar de si mi personaje tiene un efecto activo raro (¿me pusieron un buff sin saberlo?). Rompe la
inmersión de un Cazador que se cura descansando de forma mundana — no debería sonar a magia en
absoluto. Da la sensación de una imagen genérica reutilizada por el LLM para "curación" en general,
sin diferenciar clase/raza.

**Sugerencia**: si el prompt de narración de descanso/curación no fuerza vocabulario no-mágico para
clases sin magia, sería fácil de acotar — mismo criterio ya aplicado a otros guards de vocabulario
(ver [[tarkor_vocabulario_prosa_2026-08-31]]).

## El narrador pone al personaje hablándose a sí mismo por su nombre

**Qué pasó**: al examinar cómo se siente tras el descanso, la narración termina con Gorhorn diciendo
en voz alta, dirigiéndose a sí mismo por su propio nombre: *"Estoy bien, Gorhorn. El descanso ha sido
reparador."*

**Por qué chirría**: nadie se llama a sí mismo por su nombre al hablar solo — suena a error de
persona gramatical mal resuelto (como si el narrador hubiera confundido "el jugador se dirige a su
personaje" con "el personaje habla"). Da un efecto ligeramente cómico/artificial que rompe el tono
serio de la escena.

**Sugerencia**: revisar si el guard de persona gramatical ya documentado en el checklist (fila
"persona gramatical", genérica) cubre este caso concreto de diálogo en primera persona del propio
personaje — parece un caso nuevo, no exactamente el mismo síntoma ya descrito ahí.

## Kirelon-arenoso "ciego" abre un ojo a media interacción — contradice su propia ficha y su propio cierre

**Qué pasó**: el modo dinámico ofreció interactuar con un kirelon-arenoso cuya ficha (`targetBio`,
mostrada en el propio JSON del evento) dice explícitamente "reptil ciego... se guía por olfato y
vibración". La vuelta 2 del mini-flujo narra: *"El kirelon-arenoso abre lentamente un ojo y se dirige
hacia la ofrenda... luego vuelve a cerrar el ojo"* — y la vuelta 4 (cierre) vuelve a decir
correctamente "los ojos ciegos brillando débilmente". Es decir, la propia interacción se contradice a
sí misma: ciego al principio, abre un ojo en medio, ciego otra vez al final.

**Por qué chirría**: es justo el tipo de detalle de bestiario que un jugador que se lee la
Enciclopedia notaría de inmediato — un animal ciego "abriendo un ojo" para mirar algo no tiene
sentido, y aquí ni siquiera es consistente turno a turno dentro del mismo evento.

**Sugerencia**: el modo dinámico ya pasa `targetBio` al LLM en el contexto (se ve en el JSON de
`pendingDynamicMode`) — el hueco no es de falta de datos, sino de que el LLM no lo respeta siempre.
Candidato a guard de post-proceso si se repite con otras criaturas con rasgos sensoriales marcados
(ciego, sordo, etc.), similar a otros guards ya existentes de consistencia narrativa.

## Modo dinámico: primera impresión jugando de verdad

**Qué pasó**: tras un turno normal (examinar mis heridas), apareció una oferta real:
*"KIRELON-ARENOSO BUSCA TU ATENCIÓN — Hay algo cerca con lo que puedes interactuar"* con botones
INTERACTUAR/IGNORAR. Al aceptar, se abrió un mini-flujo de opciones múltiples (nunca texto libre) que
duró 4 vueltas y volvió solo al modo estático normal al final con un botón CONTINUAR. Jugado de
verdad, sin saber de antemano que este sistema existía.

**Lo que funciona bien como jugadora**:
- Se siente como una interrupción bienvenida, no invasiva — apareció de forma natural tras un turno
  de descanso, no en mitad de nada importante.
- El guard "Resuelve lo que tienes abierto antes de escribir una nueva acción" evita que intente
  escribir texto libre a medias del mini-flujo, lo cual habría sido confuso.
- Las opciones ofrecidas encajaban bien con el tono (observar/ofrecer comida/asustar) — se sintió
  como una decisión real, no relleno.
- El cierre (vuelta 4) fue satisfactorio y no forzado — no terminó en combate ni en nada abrupto pese
  a que elegí la opción más pasiva/evasiva en dos vueltas seguidas.

**Lo que chirría**:
- Cada vuelta tarda bastante en resolverse (varias decenas de segundos), y el único feedback visual
  es la palabra "Resolviendo..." sin animación ni indicación de progreso — como jugadora, en un par de
  vueltas dudé si se había quedado colgado.
- El nombre del evento en mayúsculas ("KIRELON-ARENOSO BUSCA TU ATENCIÓN") muestra el slug/nombre
  técnico de la criatura tal cual, sin adaptarlo a un titular más narrativo — se siente más a mensaje
  de sistema que a texto de ambientación.
- Ver el hallazgo anterior sobre la contradicción "ciego/abre un ojo" — el modo dinámico hereda el
  mismo tipo de desliz de vocabulario/coherencia que el resto de la narración.

## Mapa de zona y mapa regional: buena primera impresión, sin leyenda de iconos

**Qué pasó**: abrí el modal de Mapa (pestañas "Zona"/"Mapa") desde la barra derecha. La pestaña
"Zona" muestra La Hondonada del Eco con puntos reales de colores/formas distintas sobre la
ilustración (círculo naranja "×20", rombo naranja "×20") — es el sistema de `ZonePoint` vivo
funcionando de verdad, no solo un catálogo estático. La pestaña "Mapa" muestra el mapa regional
completo con Las Llanuras del Viento Rojo coloreada de forma distinta al resto de regiones vecinas
(Cristal Helado, Ciénaga Troncal), con el marcador del propio personaje visible sobre el territorio.
Visualmente es la parte más bonita y "viva" de toda la sesión.

**Lo que chirría**: no hay ninguna leyenda visible que explique qué significa cada forma (círculo vs.
rombo) ni el color naranja de fondo de los puntos — como jugadora nueva, entendí que "×20" es una
cantidad agrupada, pero solo porque ya sabía de antemano (por trabajo previo) que el círculo es fauna
y el rombo es recurso/flora. Sin ese contexto previo, el mapa es precioso pero un poco críptico.

**Sugerencia**: un tooltip al pasar el ratón sobre un punto, o una leyenda pequeña y discreta en una
esquina del modal, resolvería esto sin ensuciar la estética.

## "Canizor" y "Aullador Rojo" narrados como un único animal cuando son dos NPCs distintos del catálogo

**Qué pasó**: en varios turnos de esta sesión (y ya desde el turno más antiguo de la partida, Día 1)
el narrador describe la aparición de fauna con la frase *"Un Canizor Aullador Rojo se acerca..."* /
*"el Canizor se da cuenta y comienza a moverse..."*, tratándolo gramaticalmente como un solo animal
con nombre compuesto. Comprobado en el catálogo real (`Npc`/`ItemCatalog`): **"Canizor"**,
**"Aullador Rojo"** y un tercer **"Nuente"** (que nunca llegó a mencionarse en ningún texto narrado)
son tres entidades completamente distintas — de hecho los tres slugs quedaron enganchados a la vez en
`Save.pendingCombatNpcSlugs` tras un solo turno de acercamiento sigiloso a lo que la narración
presentó como "un" animal.

**Por qué chirría**: como jugadora, leí "Canizor Aullador Rojo" y entendí que era el nombre completo
de una única criatura (como "Buitre Cenizo" o "Kirelon-arenoso", que sí son nombres compuestos de un
solo NPC). Al pulsar Combatir habría descubierto de golpe que en realidad son dos o tres animales
distintos actuando a la vez — una sorpresa de la que el texto no avisa en ningún momento antes de
entrar en combate.

**Sugerencia**: si el motor decide agrupar varias entidades de fauna que comparten
`ZonePoint`/aparecen juntas en la misma frase, el prompt de narración debería dejarlo explícito
("un Canizor y un Aullador Rojo" en vez de fusionarlos en un sujeto singular) para que la jugadora
sepa de antemano cuántos rivales hay realmente antes de comprometerse a un acercamiento sigiloso o un
ataque.

## Concordancia de género rota: "la ataque"/"la canizor"

**Qué pasó**: al atacar al canizor, la narración escribió literalmente *"Gorhorn se prepara para la
ataque lanzándole su hacha a la canizor aullador"* — dos errores de concordancia de género en la
misma frase ("la ataque" en vez de "el ataque"; "la canizor" con artículo femenino, cuando en el
resto de la sesión se trata como masculino/sin artículo).

**Por qué chirría**: es un error de español básico, no de lore ni de diseño — rompe la inmersión de
golpe, más que cualquiera de los hallazgos de vocabulario mágico o de coherencia de bestiario. En una
sesión de ~10 turnos ya apareció una vez, lo que sugiere que no es rarísimo.

**Sugerencia**: candidato a guard de post-proceso tipo "detector de concordancia de género" si ya
existe infraestructura similar para otros guards de vocabulario/persona gramatical — puede que sea
más frecuente de lo que este único muestreo sugiere.

## +500 XP mostrado justo tras un fallo, sin explicar que es un hito de capítulo y no XP del propio combate

**Qué pasó**: el mismo turno del lanzamiento de hacha fallido (tirada de Destreza 2+8=10 vs 12,
"Fallo") mostró **+500 XP** en el registro, justo debajo del resultado del fallo — comparado con los
+5 XP normales de cualquier turno exitoso del resto de la sesión. Investigado a fondo (no es un bug):
es `xpHito` por "capítulo cumplido" (`XP_BY_HITO.capitulo = 500`,
`backend/src/services/progression.ts:109`), que se dispara cada 15 acciones de personaje desde el
último resumen de capítulo, completamente ajeno al éxito/fallo de la tirada de ese turno concreto —
coincidencia de contador, el turno #15 resultó ser justo ese fallo.

**Por qué chirría**: como jugadora, ver "+500 XP" pegado inmediatamente a un "Fallo" en rojo es
confuso y contraintuitivo — parece premiar el fracaso, o sugiere que hay algún cálculo roto. No hay
ningún indicio visual (ni siquiera un tooltip) de que ese bonus grande viene de un hito de progreso
de la HISTORIA (cumplir 15 acciones), no del combate. Un jugador que no investigue el código
pensaría que fallar da más recompensa que acertar.

**Sugerencia**: separar visualmente el XP de hito de capítulo del XP del turno normal — un texto
corto tipo "📖 Capítulo completado (+500 XP)" en su propia línea, en vez de fusionarlo con el
resultado del intercambio de combate. El código ya distingue `xpTirada` de `xpHito`
(`turnResolution.ts:5597-5600`); solo falta que el frontend/narración lo comunique por separado.

## Acción de rastreo clasificada como recolección de planta — intención completamente distinta a la escrita

**Qué pasó**: tras el ataque fallido, escribí *"Recojo mi hacha del suelo y sigo el rastro que ha
dejado el canizor, con cuidado de no perderlo de vista"* — una acción de rastreo/seguimiento de
fauna. El motor la clasificó y resolvió como **recolectar Raíz de fuego** (una planta), sin ninguna
relación temática con recoger un arma o seguir un rastro animal. Inmediatamente después, sin
transición narrativa que lo anticipe, el juego entró en combate (aparecieron los botones
COMBATIR/HUIR).

**Por qué chirría**: es el desajuste de clasificación de intención más grande visto en toda la
sesión — no es un matiz de vocabulario, es una acción completamente distinta a la escrita. Como
jugadora, escribí sobre rastrear un animal y el juego me hizo recolectar una planta sin avisar,
y de repente estoy en combate sin saber bien con qué (¿el canizor volvió? ¿algo nuevo apareció
mientras recolectaba?) — la cadena causal se rompe justo cuando más importaría que fuera clara (justo
antes de un combate).

**Sugerencia**: candidato a revisar el clasificador de intención para frases que combinan varias
ideas en una misma acción (recoger objeto + seguir rastro) — puede estar quedándose solo con
"rastro"/"suelo" y enganchando con la recolección más cercana en vez de con el verbo de seguimiento.

## Icono del botón COMBATIR inconsistente: espada en un momento, aspa roja en otro

**Qué pasó**: el botón de entrar en combate mostró el icono ⚔️ (espada) en un encuentro anterior de
esta misma sesión, pero en este encuentro contra el canizor aparece con ❌ (aspa roja) en su lugar,
junto al texto "DIFICULTAD: DIFÍCIL".

**Por qué chirría**: un aspa roja normalmente comunica "cancelar"/"denegado"/"no disponible" en
casi cualquier UI — verla en el botón que SÍ lleva a combate (no lo bloquea) es contraintuitivo.
Si la intención es advertir de que el combate es difícil/desaconsejado, un icono de alerta (⚠️) 
comunicaría eso sin la ambigüedad de un aspa que normalmente significa "no puedes hacer esto".

**Sugerencia**: revisar si el icono cambia a propósito según la dificultad calculada del encuentro
(en cuyo caso un color/símbolo de advertencia sería más claro que un aspa) o si es un `emoji`/clase
CSS que se está resolviendo mal en ciertos estados.

## `pendingCombatNpcSlugs` queda "fantasma" tras un combate ya RESUELTO — reproducido jugando de forma normal

**Qué pasó**: tras el combate contra el canizor/aullador rojo, la UI volvió a mostrar el composer
normal (fuera de combate, sin botones COMBATIR/HUIR) y el turno siguiente se resolvió con
normalidad. Pero `Save.pendingCombatNpcSlugs` en la base de datos real sigue mostrando
`["nuente", "canizor"]` — y los 3 `CombatEncounter` más recientes de la partida están todos en
estado `RESUELTO`, ninguno `EN_CURSO`. Es decir: el campo de "combate pendiente" no se limpió al
resolverse el combate de verdad, aunque el frontend en pantalla se comporta con normalidad (por
ahora).

**Por qué importa más que un simple cosmético**: ya había un hallazgo de sesiones anteriores
([[tarkor_crash_frontend_pendingcombatnpcslugs_2026-09-01]]) sobre este mismo campo quedando
desincronizado y causando un Error Boundary de página completa ("Algo se rompió al mostrar la
partida") — pero aquella vez el origen fue manipulación manual de datos de prueba vía SQL, sin
confirmar si podía ocurrir jugando de forma normal. **Esta vez sí ha ocurrido jugando sin tocar la
base de datos directamente** — es la primera confirmación real de que el motor mismo puede dejar
este residuo en un flujo de juego normal, no solo en pruebas manipuladas. No he conseguido
reproducir el crash del Error Boundary con este residuo concreto (la UI sigue funcionando por ahora),
pero el campo queda en un estado objetivamente incorrecto que podría disparar ese mismo crash más
adelante (ej. si el jugador vuelve a intentar interactuar con "canizor"/"nuente" y el frontend
reconstruye el combate esperando un `CombatEncounter` que ya no existe).

**Precisión adicional tras revisar `CombatParticipant`**: el último `CombatEncounter` real
(`RESUELTO`) solo tenía como participantes "canizor" (x2) y "buitre-cenizo", los tres `ILESO` (el
intercambio nunca llegó a golpear). **"nuente" no aparece en ningún `CombatParticipant` de ningún
encuentro de toda la partida** — es decir, "nuente" quedó enganchado en
`Save.pendingCombatNpcSlugs` sin haber llegado NUNCA a formar parte de un `CombatEncounter` real.
Esto apunta a un origen distinto y más concreto: algún punto donde se detecta fauna/NPC "en la
escena" y se añade al array de combate pendiente sin que corresponda todavía a un encuentro
instanciado — y luego nada lo retira si ese NPC nunca llega a engancharse a un combate de verdad.

**Sugerencia**: revisar el código que puebla `pendingCombatNpcSlugs` al detectar NPCs "en escena"
(probablemente el mismo punto que alimenta la narración "Un Canizor Aullador Rojo se acerca...") —
parece que añade slugs de forma más amplia que los que realmente llegan a instanciarse en un
`CombatEncounter`, y no hay ningún camino de limpieza para los que se quedan fuera. Prioridad más
alta que el resto de hallazgos de esta sesión — es el único que toca integridad de estado, no solo
percepción/UX.

---
