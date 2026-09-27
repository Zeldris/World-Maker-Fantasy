# CATÁLOGO: fauna
Qué es: toda la fauna existente, con familia, nivel y temperamento reales, para calibrar especies nuevas y no duplicar.
Fuente: backend/src/scripts/worldCatalog.ts + regiones/*.md. Sincronizado: 2026-09-27.

## En el catálogo del juego (Llanuras del Viento Rojo)
| Especie | Familia | Nivel | Temperamento | Zona |
|---|---|---|---|---|
| Aullador Rojo | GUELISES | 1-4 | CAUTELOSO | toda la región |
| Corredor de Cauce | BESTIONES | 1-2 | INOFENSIVO | toda la región |
| Corretolvas | ZANCUDOS | 1 | INOFENSIVO | toda la región |
| Cruzavientos | CORVENES | 5-10 | AGRESIVO | Pilares Rotos |
| Gargantúa de Ceniza | BESTIONES | 6-12 | AGRESIVO | toda la región |
| Múrgol | BESTIONES | 1-5 | INOFENSIVO | toda la región |
| Rondador de Brasas | ACECHANTES | 2-6 | AGRESIVO | Filo de las Brasas |
| Salamandra de Escoria | MUDOS_SALVAJE | 3-4 | CAUTELOSO | Filo de las Brasas |
| Gesgurio | QUITINOS | 1-3 | CAUTELOSO | Hondonada del Eco |
| Kirelon Arenoso | MUDOS_SALVAJE | 8-14 | AGRESIVO | Hondonada del Eco |
| Ruptidar | ESCAMADOS | 1 | INOFENSIVO | toda la región |
| Ferike | GUELISES | 10-16 | AGRESIVO | Cruce de las Cenizas (borde de selva) |
| Guchapo | ESCAMADOS | 2-4 | CAUTELOSO | Pozo de Cauce Viejo |
| Lebude | QUITINOS | 3-7 | AGRESIVO | Pozo de Cauce Viejo |
| Escorante | QUITINOS | 2-5 | CAUTELOSO | Pozo de Cauce Viejo |
| Jusha Esmeralda | NADANTES | 1-2 | INOFENSIVO | Los Manaderos |
| Miruina | GUELISES | 4-8 | AGRESIVO | Los Manaderos |
| Quio | NADANTES | 1 | INOFENSIVO | Los Manaderos |
| Tura Jusha | ZANCUDOS | 3-6 | CAUTELOSO | Los Manaderos |
| Cuernahoja | BESTIONES | 2-5 | CAUTELOSO | Pastos de la Deriva |
| Imanio | MUDOS_SALVAJE | 3-6 | CAUTELOSO | Agujas Imán |
| Nuente | MUDOS_SALVAJE | 5-9 | CAUTELOSO | Agujas Imán |
| Towrgu | ACECHANTES | 4-12 | AGRESIVO | Sabana Alta |
| Coracelo | RONDINES | 2-8 | CAUTELOSO | Sabana Alta |
| Jashil Verde | NADANTES | 1-2 | INOFENSIVO | Playa de Ceniza Blanca |
| Jashil Rojo | NADANTES | 1-2 | INOFENSIVO | Playa de Ceniza Blanca |
| Toluh | NADANTES | 4-6 | INOFENSIVO | Playa de Ceniza Blanca |
| Negueo Turquesa | NADANTES | 1-2 | CAUTELOSO | Playa de Ceniza Blanca |
| Negueo Solar | NADANTES | 1-2 | CAUTELOSO | Playa de Ceniza Blanca |
| Bulco de Arena | NADANTES | 1 | INOFENSIVO | Playa de Ceniza Blanca |
| Terinte | RONDINES | 1-2 | CAUTELOSO | Playa de Ceniza Blanca |
| Benusa Pesquera | CORVENES | 1-2 | CAUTELOSO | Playa de Ceniza Blanca |
| Manesti Azul | NADANTES | 1-2 | INOFENSIVO | Playa de Ceniza Blanca |
| Celubia Pálida | CORVENES | 2-4 | AGRESIVO | Acantilados Partidos |
| Terkash | QUITINOS | 2-4 | AGRESIVO | Acantilados Partidos |
| Zense Ceniza | CORVENES | 1-3 | CAUTELOSO | toda la región |
| Canizor | ACECHANTES | 1-4 | CAUTELOSO | toda la región |

## Solo en el lore (sin código todavía)
| Especie | Región | Familia | Nivel | Temperamento |
|---|---|---|---|---|
| Sombras de Kroj | Margen | UMBRIAS | 3-8 | AGRESIVO |
| Hetris | Margen | ACECHANTES | 4-9 | AGRESIVO |
| Mekiosi | Margen | ACECHANTES | 7-13 | AGRESIVO |
| Vistue | Margen | GUELISES | 3-7 | AGRESIVO |
| Leshra | Margen | UMBRIAS | 2-5 | CAUTELOSO |
| Morvasa | Margen (Aguas Sordas) | ESCAMADOS | 3-6 | CAUTELOSO |
| Brozán | Margen | RONDINES | 1-2 | INOFENSIVO |
| Hoscón | Margen | CORVENES | 1-2 | INOFENSIVO |
| Cornantes | Ciénaga | BESTIONES | 3-8 | CAUTELOSO |
| Tragalodo | Ciénaga | ESCAMADOS | 8-14 | AGRESIVO |
| Borbol | Ciénaga | NADANTES | 1-2 | INOFENSIVO |
| Zancapilote | Ciénaga | ZANCUDOS | 2-5 | CAUTELOSO |
| Hielaga | Cristal Helado | BESTIONES | 1-4 | CAUTELOSO |
| Nievón | Cristal Helado | ACECHANTES | 5-11 | AGRESIVO |
| Escarchín | Cristal Helado (Lago Cristalice) | NADANTES | 1-2 | INOFENSIVO |
| Vreskal | Meseta | ORDENADOS | 1-3 | INOFENSIVO |
| Espina del Viento | Llanuras (Fosa Horadada) | peligro ambiental, sin combate | — | — |
| Vaeth | Margen | espíritu, no fauna | — | — |

## Calibración
- Presa pequeña o ambiental: nivel 1-2, INOFENSIVO o CAUTELOSO. Carroñeros: 1-3.
- Depredador medio: 2-8 (Aullador 1-4, Rondador 2-6, Towrgu 4-12). Aves de presa grandes: 5-10.
- Peligro serio: 8-16 (Kirelon 8-14, Ferike 10-16). Nada documentado por encima de 16.
- Atributos de fauna: 2-16; inteligencia y carisma bajos (2-5), magia 0 salvo las mutadas.
- Cada especie tiene 1-3 habilidades raciales (ataque, defensa, utilidad) con nombre descriptivo.
- Familias con muy pocas especies: ORDENADOS (solo el Vreskal) y ROKRATS_ESTALLIDO (ninguna).
- Recursos: piel, garras, colmillos, plumas, quitina o carne (`racion-carne` se reutiliza). Orientativo, observado en el catálogo: el tier del mejor recurso ronda la mitad del nivel máximo (Towrgu 4-12 → t4-6; Ferike 10-16 → t6-7).
