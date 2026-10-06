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
| **A — Personas que recuerdan** | `CR-14` etiquetas, `CR-15` aprobación con valores, `CR-16` recuerdos de NPC, `CR-17` buscadores de historias e hilos, `CR-42` compañeros que cuentan lo de su tierra, `CR-32` reclutamiento pacífico e informantes ([Cronista Fase 4](roadmap-cronista.md#fase-4--personas-que-recuerdan--m)) | — | ✅ 2026-10-06 (`CR-14`, `CR-15`, `CR-16`, `CR-17`, `CR-42`, `CR-32`; la escena de confianza > 80 va con la Fase F y lo que el narrador cuenta de recuerdos e hilos, con la B) |
| **B — Memoria del narrador** | `CR-21` verdad obligatoria, `CR-22` callbacks por entidad, `CR-23` puntuación de recuerdos ([Cronista Fase 6](roadmap-cronista.md#fase-6--memoria-del-narrador--m)) | A | ✅ 2026-10-06 (`CR-21`, `CR-22`, `CR-23` en `memoriaNarrador.ts`) |
| **C — Población del Reino** | `REI-118` súbditos como personas, `REI-119` llegadas, `REI-120` parejas y crías, `REI-121` salidas y muerte, `CR-52` linajes y rastros ([propuesta aprobada](../borradores-opencode/propuestas-aprobadas.md), «Ciclo vital de los pueblos») · súbditos en el panel (`REI-53`, `REI-54`) | — (vivienda del `0.1`, `CR-13`) | ✅ 2026-10-06 (`CR-52`, `REI-118`…`REI-121`, `REI-54`; queda `REI-53` en parte —territorio de residencia y estado— y la muerte de súbditos en combate, que va con `CR-37` en la Fase E; los números del hambre son provisionales para la ronda de la Fase D) |
| **D — Economía, ganadería y obras** | `CR-53` economía de supervivencia del Reino, `CR-54` de las facciones, `CR-58` factura de equipo, `CR-59` vasallaje y deuda · `CR-55` ganadería (oficio de ganadero y corrales por especie), `CR-56` usos de la fauna · estaciones sin oficio (Leñera, Cantera, Fibrería) si hacen falta · edificios de defensa · `CR-36` las facciones construyen | C | 🚧 ronda 1 aceptada (2026-10-06, decisiones abajo, portes incluidos); ~~`CR-53`~~ ✅, ~~`CR-54`~~ ✅ y ~~`CR-58`~~ ✅ 2026-10-06 |
| **E — Conflicto** | `CR-39` territorios y expansión · `CR-37` guerra contra el Reino · `CR-50` campamentos de bandidos · postura de compañero en combate · `CMB-1`…`CMB-8` | C, D (defensa) | Pendiente |
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

## Decisiones que bloquean algo

| Bloquea | Pregunta |
|---|---|
| ~~Fase D~~ | ~~Números de la economía de supervivencia y de la ganadería~~ → los propone Claude en la ronda de la Fase D y los decide la usuaria (2026-10-06, como el comercio de volumen); Álvaro los revisa después |
| Fase F | Especificación de «Charlar con NPC» |

Mientras no estén, se avanza por las fases y tareas que no dependen de ellas.

## Cierre

Todas las fases hechas (o lo bloqueado apuntado como pendiente con su motivo), CI en verde →
etiqueta `v0.3.0-alpha` (la sube Álvaro). Las pruebas de juego de este hito, en la fase única.
