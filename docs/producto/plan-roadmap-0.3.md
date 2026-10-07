# Plan del hito `0.3` — Reino profundo

Qué entra: fila `0.3` de [«Qué entra en cada hito»](21-roadmap.md#qué-entra-en-cada-hito) y
§ `0.3` de [21-roadmap.md](21-roadmap.md#03--reino-profundo). Este plan solo fija **el orden** y el
estado; el detalle de cada tarea está en su roadmap.

**Forma de trabajo** (la del `0.2`, decisión de la usuaria del 2026-10-02): implementación continua.
Cada tarea lleva sus tests y se sube con `tsc` + `vitest` + `oxlint` en verde. Sin pasadas de juego
por tarea; las pruebas de juego van en la fase única antes de la beta (fila `0.8`). Al cerrar una
tarea: tachada aquí y en su roadmap con `✅ fecha` y lo que quede, bitácora al día, commit + push.
Cada fase con diseño abierto empieza con su ronda de preguntas (`grilling` + `domain-modeling`,
contrastada con D&D, BG3, X4, Bellwright y Medieval Dynasty).

## Fases (en orden)

Orden aprobado por la usuaria el 2026-10-06. El orden sale de las dependencias: los recuerdos y la aprobación de los NPC son la base de la
memoria del narrador y de «Charlar con NPC»; la población del Reino necesita la vivienda (ya hecha
en el `0.1`) y es la base de la defensa y de la guerra contra el Reino. La interfaz no depende de lo
nuevo del motor y se intercala entre fases.

| Fase | Tareas | Depende de | Estado |
|---|---|---|---|
| **A — Personas que recuerdan** | `CR-14` etiquetas, `CR-15` aprobación con valores, `CR-16` recuerdos de NPC, `CR-17` buscadores de historias e hilos, `CR-42` compañeros que cuentan lo de su tierra, `CR-32` reclutamiento pacífico e informantes ([Cronista Fase 4](roadmap-cronista.md#fase-4--personas-que-recuerdan--m)) | — | ✅ 2026-10-06, retro ✅ 2026-10-07 (`CR-14`, `CR-15`, `CR-16`, `CR-17`, `CR-42`, `CR-32`; la escena de confianza > 80 va con la Fase F y lo que el narrador cuenta de recuerdos e hilos, con la B) |
| **B — Memoria del narrador** | `CR-21` verdad obligatoria, `CR-22` callbacks por entidad, `CR-23` puntuación de recuerdos ([Cronista Fase 6](roadmap-cronista.md#fase-6--memoria-del-narrador--m)) | A | ✅ 2026-10-06, retro ✅ 2026-10-07 (`CR-21`, `CR-22`, `CR-23` en `memoriaNarrador.ts`) |
| **C — Población del Reino** | `REI-118` súbditos como personas, `REI-119` llegadas, `REI-120` parejas y crías, `REI-121` salidas y muerte, `CR-52` linajes y rastros ([propuesta aprobada](../borradores-opencode/propuestas-aprobadas.md), «Ciclo vital de los pueblos») · súbditos en el panel (`REI-53`, `REI-54`) | — (vivienda del `0.1`, `CR-13`) | ✅ 2026-10-06, retro ✅ 2026-10-07 (`CR-52`, `REI-118`…`REI-121`, `REI-54`; queda `REI-53` en parte —territorio de residencia y estado— y la muerte de súbditos en combate, que va con `CR-37` en la Fase E; los números del hambre son provisionales para la ronda de la Fase D) |
| **D — Economía, ganadería y obras** | `CR-53` economía de supervivencia del Reino, `CR-54` de las facciones, `CR-58` factura de equipo, `CR-59` vasallaje y deuda · `CR-55` ganadería (oficio de ganadero y corrales por especie), `CR-56` usos de la fauna, `CR-61` comida por oficios · estaciones sin oficio (Leñera, Cantera, Fibrería) si hacen falta · edificios de defensa · `CR-36` las facciones construyen | C | 🚧 ronda 1 aceptada (2026-10-06, decisiones abajo, portes incluidos); ~~`CR-53`~~ ✅, ~~`CR-54`~~ ✅, ~~`CR-58`~~ ✅ y ~~`CR-59`~~ ✅ 2026-10-06; ronda de `CR-55` aceptada (2026-10-06, decisiones abajo; tarea nueva `CR-61`); ~~`CR-55`~~ ✅ y ~~`CR-56`~~ ✅ 2026-10-06 |
| **E — Conflicto** | ~~`CR-62`~~ ✅ 2026-10-07 combate de fondo para escaramuzas y patrullas · `CR-39` territorios y expansión · `CR-37` guerra contra el Reino · `CR-50` campamentos de bandidos · postura de compañero en combate · `CMB-1`…`CMB-8` | C, D (defensa) | Pendiente |
| **F — Hablar y comerciar con NPC** | «Charlar con NPC» enriquecido (Franja 4: lore, reclutar, interrogar tras Clemente) · `CR-51` comercio en persona con NPC y caravanas | A | 🧭 falta la especificación (ronda de diseño) |
| **G — Interfaz** (se intercala) | Reino R-B, R-C, R-D, R-E y `PAN-7` · `DiceTray` `DAD-7`…`DAD-12` (con el resto de `CFG-20`) · `HUD-1`…`HUD-5`, `HUD-7`…`HUD-11`, `HUD-13` · `NAR-1`…`NAR-8`, `NAR-10`, `NAR-11` · `PAN-1`…`PAN-6`, `PAN-11`…`PAN-14` · `UX-18` (epílogo con plantillas), `UX-19`, `UX-20` · `INT-5`…`INT-8`, `INT-10`, `INT-11` · `CFG-36` · UX-F `UX-32`…`UX-34`, `UX-39` | — | Pendiente |

## Decisiones de la Fase D (ronda 1, aceptada por la usuaria el 2026-10-06)

Contrastadas con D&D 5e (1 galón de agua al día; peón 2 sp, especialista 2 gp), BG3 (40 de
suministros por descanso), X4 (comida y medicinas sostienen la mano de obra), Bellwright (la comida
sostiene la felicidad) y Medieval Dynasty (consumo diario por aldeano, pozo como fuente, establos con
tope de pienso).

- **Q1 Agua:** cada boca bebe 1 al día. Pozo, 12 al día. Fuente natural (Los Manaderos, el Cauce, un
  territorio junto al agua), 20 al día sin construir. Sin fuente, la reserva solo baja.
- **Q2 Almacén:** el Ayuntamiento da 60 de comida y 60 de agua de base. Cada Granero, Cisterna o
  Leñera suma 120 a su categoría. Lo que sobra del tope se pierde.
- **Q3 Goirnos:** la riqueza del Reino es su tesoro en Goirnos (1 = 1), separado de la bolsa del
  personaje y con traspasos entre ambos.
- **Q4 Sueldos semanales:** trabajador 2, soldado o vigía 5, crías y visitantes 0.
- **Q5 Sin Goirnos:** la felicidad baja 3 al día. Tras 7 días sin cobrar, cada semana deserta un
  soldado, que vuelve a su pueblo.
- **Q6 Hambre y sed:** hambre, tras 3 días un 10 % diario (primero las crías); sed, tras 2 días
  un 20 % diario.
- **Q7 Extinción:** con población 0 la facción se extingue. Puede refundarse un año después (120
  días) si su pueblo conserva más de 50 personas en la región, como escisión nueva con otro nombre.
- **Q8 Facciones:** las mismas cifras, en agregado.
- **Q9 Corrales:** 6, 12 o 20 plazas según el escalón (Taller, Obrador, Gran obrador). Con un
  macho, una hembra y sitio libre nace una cría por semana.
- **Q10 Uso de cada especie** (producción, guardia, compañero de Domador, montura), con las reglas:
  - **Producción:** herbívoros pacíficos con algo renovable.
  - **Guardia:** depredadores o bestias territoriales con Fuerza + Constitución ≥ 14.
  - **Compañero:** cualquier especie domesticable que valga en combate o como explorador.
  - **Montura:** según su porte frente al jinete (Q14).
  - **Solo caza:** las especies con domesticable 0 %.
  - Producción de cada especie:
    - Múrgol, lana cada 3 días.
    - Corretolvas, plumas cada 2 días.
    - Coracelo, fibra.
    - Canizor, Cuernahoja y Gargantúa, solo al sacrificarlos.
    - El Corredor de Cauce nunca es ganado.
  - La tabla completa, en el mensaje de la ronda; se pasará al roadmap de ganadería al implementarla.
- **Q11 Forraje:** de la Fibrería (estación sin oficio, 10 al día con un trabajador) o recogiendo
  hierba.
- **Q12 Animales de guardia:** viven en el corral (no en una cama), defienden el Reino y cuentan
  como fuerza en la Fase E. Asignados a quien tenga especialidad de Domador, salen del corral y van
  con él.
- **Q13 Qué comen:** herbívoros, 1 de forraje al día; carnívoros, 1 de carne cada 2 días. Todos
  beben 1 de agua al día.
- **Q14 Monturas:** tarea nueva en el hito `0.4`.
  - **Q14a:** cada especie tiene un **porte** (altura a la cruz y peso).
  - **Q14b:** es montable para un pueblo si su altura ≥ 60 % de la del jinete y su peso ≥ 3 veces
    el del jinete con su equipo, y si su forma tiene lomo. Lo que vale para un Nabieu puede no valer
    para un orco.
  - **Q14c:** las tallas de Nabieus, Goirntes y Faerus van a Álvaro; mientras, cifras provisionales.
- **Portes y monturas** (2026-10-06): tallas provisionales de los pueblos y porte de la fauna
  montable en `propuestas-lore.md`. Gargantúa y Múrgol los montan todos; Corredor de Cauce, todos
  menos los orcos; Cuernahoja y Canizor, solo Nabieus y Faerus.
  - **Lore de la usuaria:** los Faerus apenas usan monturas, sobre todo los del Margen, que van más
    rápido sin ellas; montar es costumbre de los Faerus de las Llanuras, más civilizados. Para la
    tarea de monturas del `0.4`: un Faerus del Margen viaja a pie tan rápido como montado.
- **Q15 Para Álvaro** (`propuestas-lore.md`): si el Guchapo da agua, si el Clan Maktor monta
  Canizores, si el Corredor de Cauce puede ser montura y la talla de cada pueblo.

## Decisiones de la Fase D (rondas 2 y 3, aceptadas por la usuaria el 2026-10-06)

- **Q16 Reparto de cada facción** (conserva su total; comen todos, 1 al día; cada trabajador produce
  2 de comida y 1 Goirno al día). Estándar: 55 % trabajadores, 15 % soldados, 30 % civiles, con un
  10 % de margen de comida, así que crecen equilibradas.

  | Facción | Total | Trabajadores | Soldados | Civiles | Margen de comida |
  |---|---|---|---|---|---|
  | Clan Serhu | 720 | 359 | 208 | 153 | +1 (estancados) |
  | Clan Helsig | 360 | 198 | 54 | 108 | +39 |
  | Clan Goshg | 540 | 297 | 81 | 162 | +54 |
  | Concordia de Hierro | 1.600 | 880 | 480 | 240 | +160 |
  | Los del Obelisco | 300 | 165 | 45 | 90 | +30 |
  | Keseg Sael | 1.500 | 825 | 225 | 450 | +150 |
  | Keseg Prisilke | 500 | 275 | 75 | 150 | +50 |
  | Feg Tusha | 850 | 467 | 128 | 255 | +84 |
  | Feg Ger | 200 | 110 | 30 | 60 | +20 |

  **Los Serhu no saben crecer** (idea de la usuaria): muy guerreros (29 %) y siempre comiendo justo.
  Si pierden guerreros, el excedente lo gastan en rearmarse. Nabieus y Faerus van al 15 % estándar a
  la espera de Álvaro: ¿menos soldados entre los Nabieus, sigilosos? ¿Pelean todos los adultos
  Faerus ante una amenaza?
- **Q17 Agua de las facciones:** su fuente canónica cubre el consumo con un 10 % de margen; la
  pierden si pierden ese territorio (`CR-39`) o hay sequía.
- **Q18 Goirnos de las facciones:** las mismas reglas que el Reino (ingresos por trabajador, factura
  semanal, deserción).
- **Q19:** se encienden en las facciones la hambruna, la sed y la muerte, con el Libro; los muertos
  se restan de la población de su pueblo.
- **Q20:** las partidas ya empezadas re-siembran una vez el reparto de sus facciones.
- **Q21 Vasallaje:** mecánica general entre facciones; Serhu bajo la Concordia es el caso del canon.
  Doctrina de **rearme**: cada semana, todo excedente pasa trabajadores a guerreros hasta volver a
  comer justo.
- **Q22 Armas al señor:** el vasallo compra las armas al señor al doble de precio (el señor se
  enriquece).
- **Q23 Patrullas obligadas:** cada semana, 20 guerreros a una zona; 25 % de escaramuza con 1d6
  bajas (`ESCARAMUZA` en el Libro).
- **Q24 Romper el ciclo:** si se salda la deuda, cae el señor, el vasallo se alía con el Reino o hay
  guerra, la doctrina desaparece.
- **Q25 Factura de cada persona** (además de comida y agua):
  - Trabajador: herramienta al darlo de alta (7) y, cada semana, sueldo 2 más el desgaste de la
    herramienta (2; dura 4 semanas): **4 a la semana**.
  - Soldado o vigía: arma y armadura al darlo de alta (34) y, cada semana, sueldo 5 más el desgaste
    del arma (3; dura 6 semanas) y de la armadura (2; dura 8 semanas): **10 a la semana**.
  - Valores medios del catálogo: arma 18, armadura o ropa 16, herramienta 7.
- **Q26 Hecho en casa o comprado:** con el taller del oficio y un trabajador, el equipo se fabrica
  con materiales por la mitad de su valor y 0 Goirnos; sin taller, se compra a precio de mercado.
- **Q27 Sin equipo:** un trabajador sin herramienta produce la mitad; un soldado sin arma cuenta como
  medio en la defensa.
- **Q28 Serhu, deuda en vez de quiebra:** fabrican sus herramientas, pero las armas solo las compran
  a la Concordia, al doble. Su saldo es de unos −493 Goirnos a la semana, que se cubren **a
  crédito**. La deuda crece y la Concordia la cobra en patrullas (100 de deuda por patrulla).
  Nunca quiebran ni crecen.
- **Ingresos pasivos** (usuaria): hoy solo existen el comercio y las expediciones y saqueos de las
  facciones. Se diseñarán más (`CR-60`) para no depender solo de los trabajadores.

## Decisiones de `CR-55` ganadería (ronda aceptada por la usuaria el 2026-10-06)

Contrastadas con Medieval Dynasty (un edificio por tipo de animal, la cría sin trabajador, el
trabajador produce) y Bellwright (corral con su comida y su tope).

- **Q1/Q11 Ganadero:** oficio nuevo por pueblo y región. El oficio de código `domador-…` era el de
  ganadero con otro nombre: pasa a `ganadero-…` (orcos de Llanuras, Ciénaga y Cristal; Faerus de
  Llanuras y Margen; Nabieus de la Ciénaga) y conserva el progreso. El **Domador** es solo la
  especialización de combate (Cazador) y sus compañeros animales van en `CR-56`. Los «Corrales del
  Domador» pasan a «Corrales del Ganadero»; el Maestro Domador Serhu enseña el oficio.
- **Q2 Un corral, una especie** (la del primer animal); la Gargantúa solo en Gran obrador.
- **Q3 Al corral:** al domesticar con éxito se elige «Compañero» o «Al corral». Coracelo y
  Cuernahoja (captura 0 %) quedan fuera por ahora; comprar animales, con `CR-51`.
- **Q4/Q12 Producción por animal adulto**, cada día con ganadero (1 ganadero por cada 5 animales;
  plazas 1/2/4 por escalón): Múrgol, 1 Leche de Múrgol al día y 1 Lana cada 3 días; Corretolvas, 1
  puñado de plumas rojizas cada 2 días; Coracelo, nada hasta que Álvaro diga qué fibra da. La leche
  va a la comida y lo demás al Almacén. La orden fija de leche desaparece. Las crías nacen sin
  ganadero.
- **Q5/Q13 Etapas por categoría** (ajuste por porte; provisionales, a Álvaro):

  | Categoría | Cría | Joven | Adulto desde | Vejez desde | Esperanza |
  |---|---|---|---|---|---|
  | Bestiones (Múrgol, Cuernahoja) | 0-30 d | 30-120 d | 1 año | 12 años | 15 años |
  | Bestiones grandes (Gargantúa) | 0-120 d | 1-4 años | 4 años | 40 años | 50 años |
  | Zancudos (Corretolvas) | 0-15 d | 15-60 d | 60 d | 5 años | 6 años |
  | Acechantes (Canizor) | 0-30 d | 30-120 d | 1 año | 8 años | 10 años |
  | Rondines (Coracelo) | 0-20 d | 20-90 d | 90 d | 6 años | 8 años |

  Cría: come la mitad, la primera en morir de hambre. Joven: come entero, no produce ni cría, se
  sacrifica a mitad de rendimiento. Adulto: produce y cría. Vejez: produce la mitad, no cría, muere
  de viejo con la curva de `edades.ts`. Una cría por semana con macho y hembra adultos, plaza libre
  y el corral comido esa semana.
- **Q6 Hambre y sed** como la gente: al primer día sin comer no producen ni crían; tras 3 días un
  10 % al día (primero las crías); sed tras 2 días, un 20 % al día.
- **Q7 Forraje:** reserva del Reino. La Fibrería (estación sin oficio) da 10 al día por trabajador;
  cada pasto (Pasto Solar, Pasto de Sangre) entregado da 2. Tope del Granero, compartido con la
  comida. Herbívoros 1 al día; carnívoros 1 de comida cada 2 días; todos 1 de agua.
- **Q8 Sacrificar:** un adulto (o joven, a la mitad) da lo mismo que desollarlo; la carne a la
  comida y lo demás al Almacén; rendimiento completo con Desolladero.
- **Q9/Q14 Mismo sistema para las facciones:** ganado por especie y etapa, ganaderos sacados de los
  trabajadores (1 por 5 animales), forraje de su Fibrería, mismas crías, hambre y sacrificio. Plazas
  sembradas por canon hasta `CR-36`. Rebaño inicial: Serhu 60 Múrgol y 20 Corretolvas (recinto de
  Karot Veku); el resto sin ganado hasta Álvaro.
- **Q10 Reino › Corrales:** tarjeta por corral (especie, plazas, adultos ♂/♀, crías y días que les
  faltan, forraje y agua, producción de la semana, ganadero, «Sacrificar»).
- **Q16 El ganado sustenta** (55f; la usuaria dio libertad para ampliar el catálogo y ajustar lo que
  haga falta, 2026-10-06). Con las cifras de la ronda, un rebaño restaba comida a los Serhu (−28 al
  día) porque un ganadero con 5 Múrgol solo igualaba sus 2 pasivos. Ajustes de Claude: el Múrgol da
  **3 de leche** al día (antes 1); objeto nuevo **Huevo de Corretolvas** (1 al día por adulto, 4 de
  `curaHambre`); **pastoreo**: en una región con pasto natural (las Llanuras) los herbívoros comen la
  mitad de forraje, igual para el Reino y las facciones; las facciones **sacrifican cada semana** lo
  viejo y lo que no cabe. Resultado: los Serhu ganan unos +8 de comida al día con su rebaño, que su
  doctrina de rearme convierte en guerreros (siguen estancados). A Álvaro en `propuestas-lore.md`.
- **Q15 Fin de la comida pasiva** (usuaria: los sistemas, los mismos para todos):
  - La escala es `curaHambre`: 10 = 1 de comida (una boca al día). Todo comestible suma su valor al
    entrar en la reserva, crudo o cocinado. Crudos: carne 8, marisco 6, leche, huevo, boungo y miel
    4, trigo, bulbo y liquen 3.
  - Un plato vale lo que suman sus ingredientes por el escalón de su receta: Taller ×1,5, Obrador
    ×2, Gran obrador ×2,5 (Cuajada, Boungo asado y Panal 12; Pan 14). Ahumar no multiplica: conserva.
  - En `CR-55`: el trabajador que pasa a ganadero (o a la Fibrería) deja de dar los 2 pasivos, en el
    Reino y en las facciones; lo crudo empieza a alimentar (la leche) y la Cuajada se recalcula.
  - En `CR-61`: el resto (escala completa, platos de Obrador y Gran obrador, cocineros de facción
    que transforman 10 de crudo al día cada uno en vez del +3 fijo por Cocina, cazador y recolector
    con rendimientos reales, y fin de la comida pasiva para todos).

## Decisiones de `CR-56` usos de la fauna (ronda aceptada por la usuaria el 2026-10-06)

- **Regla de combate** (usuaria, [ADR 0002](../adr/0002-dos-formas-de-combate.md)): con la jugadora
  presente con su grupo, combate en vivo (por turnos, narrado); cualquier otro, de fondo (mismas reglas,
  determinista, sin narración). Nada de cifras en agregado ni equivalencias «bestia = N soldados».
- **Q1 Ficha de usos** (FC = Fuerza + Constitución): Múrgol producción y montura; Corretolvas
  producción; Coracelo y Guchapo, a Álvaro; Cuernahoja sacrificio y montura (Nabieus y Faerus);
  Gargantúa sacrificio, guardia y montura; Canizor guardia, compañero y montura (Nabieus y Faerus);
  Rondador de Brasas, Cruzavientos y Salamandra de Escoria guardia y compañero; Aullador Rojo
  compañero (FC 13, no llega a guardia); Zense Ceniza compañero explorador; Corredor de Cauce solo
  montura. Se ve en la Enciclopedia; el porte va con `CR-57`.
- **Q2 Guardias en el corral:** ganado de una especie de guardia; comen, beben y crían; sin ganadero.
- **Q3 Guardias como combatientes:** defienden su Reino o facción en vivo o de fondo según la regla de
  combate; llega con `CR-37`. Aquí quedan marcados como defensores.
- **Q4 «Llevar contigo»:** la jugadora Domadora con hueco de Domador libre saca del corral un adulto de
  especie de compañero; «Devolver al corral» lo devuelve.
- **Q5 Guardias de facción** (usuaria: todos los pueblos, sobre todo orcos y Faerus): Serhu 6 Canizores,
  Feg Ger 3 Canizores; Helsig, Goshg y Feg Tusha cuando haya fauna de guardia de su región (petición
  de lore con prioridad); el resto, pocas o ninguna.
- **Q6 Tarea nueva `CR-62`:** la escaramuza del narrador y la patrulla de vasallaje pasan al combate de
  fondo, antes de `CR-37`.

## Decisiones de `CR-62` combate de fondo (ronda aceptada por la usuaria el 2026-10-07)

Base: [ADR 0002](../adr/0002-dos-formas-de-combate.md) y el canon de
`docs/rpgtarkor/sistemas-combate/combate-multiple.md` § 3-4 (sub-combates deterministas con la misma
mecánica; reporte de combate autónomo).

- **Q1 Motor de fondo:** cada bando en grupos; grupo 1 contra grupo 1, grupo 2 contra grupo 2…; si un
  bando tiene menos grupos, los suyos vuelven a pelear (con sus heridas) contra los siguientes. Cada
  sub-combate con las piezas del combate en vivo: iniciativa, objetivo por Inteligencia, capitán y
  ataques concentrados, intercambio, moral y retirada. Puro y determinista con su semilla; la
  intercepción de expediciones pasa a este motor.
- **Tamaño de los sub-combates** (criterio de Claude, delegado por la usuaria): sin la jugadora, **8
  contra 8** (sin narración no hay espera y la melé es más realista); con ella, **4 contra 4** (sus
  grupos de combate y la narración). Dos constantes; `CMB-9` (`0.8`) subirá el 4 a 6-8 cuando se
  pulan los tiempos de narración (la usuaria: el 4 nace de esos tiempos).
- **Q2 Los otros grupos de la jugadora:** si pelea contra más de los que caben, su Grupo 1 juega en
  vivo y sus grupos 2, 3… luchan de fondo contra el resto; al acabar, un resumen de cada sub-combate
  de fondo (reporte de § 4, con plantilla). Último paso de `CR-62`.
- **Q3 Quién pelea por una facción:** sus NPC guerreros con nombre (no mueren en una pelea de fondo) y,
  hasta completar, soldados genéricos de su pueblo (atributos base de la raza, nivel 3, con su arma).
- **Q4 Tamaño:** escaramuza del narrador, 2d4 por bando; patrulla Serhu, 20 guerreros contra 1d6+2
  rivales (otra facción de su región o renegados).
- **Q5 Bajas:** muere el 3 % de los que caen (regla de Álvaro); los heridos se recuperan.
- **Q6 Qué queda:** suceso `ESCARAMUZA` con ganador, retirada y bajas de cada bando; la noticia; más
  presión si hay muertos; el campo de batalla como ahora.

## Decisiones de `CR-61` y `CR-63` (ronda aceptada por la usuaria el 2026-10-07)

- **La caza no es un oficio** (usuaria, como en Bellwright): son **partidas** que salen, pelean contra la
  fauna y vuelven con **piezas** que trata el desollador; la misma partida puede salir a **capturar**.
- **Todo viaja de verdad** ([ADR 0003](../adr/0003-todo-viaja-de-verdad.md)): las partidas son
  **viajeros** con ruta real por los enlaces entre lugares (un lugar al día; la zona, celda a celda),
  visibles en el mapa; si pasan por fauna agresiva o una banda, pelean allí (ADR 0002). La auditoría de
  lo demás que hoy es invisible está en `CR-64`.
- **Q2 Al cruzarte:** preguntar qué han visto (conocimiento de las zonas que atravesaron), comerciar;
  a las tuyas, darles órdenes (volver, cambiar de destino). Atacar y escoltar, con `CR-64`.
- **Q3 `CR-63`:** tus grupos de combate y súbditos con el rol nuevo «cazador» (soldados genéricos de su
  pueblo con su arma), en grupos de 4; piezas por especie que se estropean a los 3 días; captura con
  cuerdas y Jaula libre según `capturablePct`; órdenes de una vez o permanentes; las facciones cazan
  igual.
- **Q4 `CR-61`:** tareas de los súbditos trabajadores: recolector (2; primavera y verano 2,5; invierno 1),
  pescador (3, solo con agua), cocinero (+5/+10/+15 netos según su Cocina), ganadero y fibrero.
  Facciones, sin la caza: orcos 70 % recolección y 30 % cocina; Faerus 80/20; Nabieus 40 % pesca, 40 %
  recolección, 20 % cocina; Goirntes 60/20/20. Hasta `CR-63`, la caza de orcos (45 %) y Faerus (50 %)
  va en agregado a 2,5. Platos nuevos: Guiso de Múrgol y Pan de leche y miel (Obrador), Queso curado de
  Múrgol y Asado de las Llanuras (Gran obrador). Fin de la comida pasiva para todos; los Goirnos por
  trabajador se quedan.
- **Q5 Orden:** `CR-61` y luego `CR-63`; se sube todo junto a `main`.

## Decisiones de detalle de `CR-63` (ronda aceptada por la usuaria el 2026-10-07)

Referencias: Bellwright (aldeanos asignados a la caza), Medieval Dynasty (la presa pasa por quien la
desuella) y X4 (todas las naves son la misma entidad; órdenes repetidas).

- **Q1 Viajero genérico:** un modelo `Viajero` (de quién es, tipo, ruta, posición, estado, miembros,
  carga y orden) que estrena `CR-63` y reutiliza `CR-64`; las `Expedicion` pasan a viajeros en `CR-64`.
- **Q2 Avance:** cada día una **jornada** de 8 h de camino por la ruta más corta de enlaces
  (`LocationLink.minutosBase`); avanza los lugares que le alcancen y, si un tramo es más largo, se
  queda a medio camino. En el mapa de zona, en una celda entre su entrada y su objetivo.
- **Q3 Partida del Reino:** 1-4 grupos de 4 con tus compañeros y súbditos con el rol «cazador»
  (adulto, no da comida por tarea, necesita arma como un soldado, entra en la factura de `CR-58`). La
  jugadora no va dentro; si quiere cazar con ellos, caza en persona.
- **Q4 Caza al llegar:** busca la especie en los grupos de fauna de la zona y pelea de fondo (8 contra
  8); cada animal abatido es una pieza y el grupo de fauna pierde los suyos. Como mucho dos encuentros
  o hasta 4 piezas por miembro; sin la especie, vuelve de vacío y avisa; si pierde, vuelve con sus
  heridos (muere el 3 % de los caídos).
- **Q5 Piezas:** objeto del Almacén «Pieza de <especie>» con caducidad a los 3 días (sin un objeto de
  catálogo por especie). El Desolladero (ya existe) las trata con la orden «Desollar piezas»: cada
  una da lo que da hoy desollar esa especie a mano. Si se estropea, desaparece y avisa.
- **Q6 Captura:** la orden «capturar X» lleva cuerdas del Almacén y necesita una Jaula libre de su
  tamaño; probabilidad de la especie (`capturablePct`) con las reglas de atar; vuelve atado y entra en
  la Jaula; si se ha llenado, se suelta y avisa.
- **Q7 Órdenes permanentes** (órdenes repetidas de X4): «caza X en Y, vuelve, descarga y repite»;
  se para si cae alguien, si el Almacén no tiene sitio o si faltan cuerdas o Jaula. Se para o cambia
  de destino desde Reino.
- **Q8 Encuentros por el camino:** cada día, en los lugares que cruza, fauna agresiva o una banda
  (`CR-49`) según el riesgo del enlace. Sin la jugadora, de fondo con resumen; con ella en ese lugar,
  aviso con «unirte» (en vivo con su grupo 1) o «dejarlos». Escoltar y asaltar, con `CR-64`.
- **Q9 Al cruzarte:** marcador de viajero en el mapa de zona y en el de Berig; «Preguntar» (lo que ha
  visto en cada lugar, con el día, por el sistema de rumores), «Comerciar» (piezas y carga, tabla de
  precios de siempre) y, con las tuyas, órdenes (volver, cambiar de destino).
- **Q10 Facciones:** sus cazadores en partidas de 8, como mucho 4 en marcha por facción (el resto
  sigue en agregado); orden permanente a la zona de su región con más fauna cazable; sus piezas se
  desuellan solas y la carne va a su comida. Antes, un prototipo para que orcos y Faerus no pasen
  hambre con la comida llegando a golpes.
- **Q11 Pasos:** 63a viajero, rutas y avance; 63b caza, piezas y Desolladero; 63c captura; 63d órdenes
  y panel «Partidas»; 63e en los mapas y al cruzarte; 63f encuentros por el camino; 63g facciones.

## Decisiones que bloquean algo

| Bloquea | Pregunta |
|---|---|
| ~~Fase D~~ | ~~Números de la economía de supervivencia y de la ganadería~~ → los propone Claude en la ronda de la Fase D y los decide la usuaria (2026-10-06, como el comercio de volumen); Álvaro los revisa después |
| Fase F | Especificación de «Charlar con NPC» |

Mientras no estén, se avanza por las fases y tareas que no dependen de ellas.

## Cierre

Todas las fases hechas (o lo bloqueado apuntado como pendiente con su motivo), CI en verde →
etiqueta `v0.3.0-alpha` (la sube Álvaro). Las pruebas de juego de este hito, en la fase única.
