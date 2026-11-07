# CATÁLOGO: oficios, recetas de Reino y edificios
Qué es: qué oficios existen, quién los enseña, qué puede construir el jugador y qué edificios de
facción hay.
Fuente: worldCatalog.ts, crafting.ts, construction.ts, docs/mecanicas/17. Sincronizado: 2026-10-26 (`QA-274`).

## Oficios (usar SOLO estos)
- **Llanuras** (Maestro Serhu en Karot Veku): herrero, curtidor, peletero, desollador, ganadero,
  carpintero, sastre, herborista, primeros auxilios, alquimista, cocinero y pescador. También existen
  constructor (Reino), y minero y talador de las Llanuras, que Gorhorn ya sabe al empezar y que
  ningún Maestro enseña.
- **Ganadero** (antes «domador», `CR-55`): cría el ganado de los corrales. Lo enseña el Maestro
  Domador Serhu. El **Domador** es otra cosa: la especialización de combate del Cazador.
- **Cristal Helado** (Maestro Helsig en Helske Tugh): herrero, peletero, cocinero, minero,
  herborista, alquimista y primeros auxilios.
- **Ciénaga**: ningún Maestro todavía.
- NO existen: sanador, curandero, recolector, tallador, agricultor (este último está pensado para el
  futuro, ligado a una misión, nunca a un NPC).
- La recolección y la caza no son oficios: Recolectar, Cazar, Desollar (con herramienta), Pescar y
  Buscar (marisco, en la costa).
- Cada oficio tiene un Maestro (PRINCIPAL, enseña) y, en diseño, un trabajador PLANTILLA
  (capturable o reclutable, produce para el Reino), que todavía no existe.
- Ahumar carne no requiere oficio.

## Lo que el JUGADOR puede construir (Reino)
- **Base:** Campamento base · Choza básica · Ayuntamiento (pequeño, mediano y grande) · Tótem del
  Clan Maktor (receta especial: Tótem de clan roto + el tótem personal de Gorhorn).
- **Del poblado:** Tablón de avisos, Mercado, Pozo, Granero, Cisterna, Leñera y Fibrería · Jaula
  (pequeña, mediana y grande) · Casa de obras (normal, ampliada y grande).
- **Militares:** Cuartel Avanzado → Cuartel de Guerra o Puesto Comercial · Empalizada → Muro de
  piedra → Muralla · Torre de vigía, Armería y Barracón, cada uno en tres niveles (de madera, de
  piedra y el grande).
- **De oficio:** los catorce edificios de oficio de abajo, cada uno en tres niveles.

Nada más. Las construcciones nuevas para el jugador requieren diseño de mecánica y no son lore
suelto.

## Edificios de facción (del catálogo, no los construye el jugador)
- **Karot Veku (Serhu):** Ketg'sedsar (salón), Herrería, Curtiduría y Cocina común. En el lore, sin
  código: Herboristería, Taller de Alquimia, Corrales del Ganadero, Desolladero y Carpintería.
- **Helske Tugh (Helsig):** Helsig'sedsar, Herrería, Peletería, Cocina común, Boca de mina,
  Herboristería y Taller de alquimia.
- **Silh Makut (Goshg):** solo el Goshg'sedsar (salón). Ningún taller.
- **Faerus y Nabieus:** ningún edificio de catálogo. Tienen interiores (Jakut Tusha, Jakut Ger,
  Jeyselt), pero sin talleres.
- Patrón de nombre: "[Oficio] del Clan [X]". Los salones son "[Clan]'sedsar".

## Edificios de oficio (diseño 2026-09-28, en código)
Un edificio de producción por oficio, con 3 niveles (Taller, Obrador, Gran obrador: recetas t1-3,
t4-6 y t7-9) y 1/2/4 plazas de trabajador: Herrería, Curtiduría, Peletería, Desolladero, Corrales
del Ganadero, Carpintería, Sastrería, Herboristería, Casa de curas, Taller de alquimia, Cocina común,
Embarcadero de pesca (solo en costa), Taller de piedra y Boca de mina (solo con veta; la construye el
minero de las Llanuras). El primer nivel lo levanta quien sabe el oficio; el Obrador y el Gran
obrador, el constructor. NO proponer edificios de
oficio distintos de estos: si hace falta uno nuevo, primero hace falta el oficio.

## Materiales de construcción que existen
Madera y Hojas de Telda, Musgo Rojo (tejados), Chudos Rojizos (techado), Huesos de Gargantúa
(postes y pilares), Roca de Llanura Roja, Rovalnica, Roca Luclara (t6), Cera Lebude, resinas (Telda
Gris, Lucre Blanco, Junba, Trepador Ocaso), madera de Trepador Ocaso (pilotes y canoas), bloque de
piedra tallada, viga de madera tallada, columna de hueso y cordaje trenzado.
