# Escenarios de la base de juego (`QA-102`)

Instantáneas de `tarkor_juego` en un estado concreto, para probar sin llegar jugando. `tools/qa/escenario.sh`
las guarda, las carga (con las migraciones y el catálogo de ahora) y avanza días. Cada ronda que llega a un
estado útil lo guarda aquí (`QA-105`).

| Escenario | Partida | Qué tiene | Fecha |
|---|---|---|---|
| `hondonada-inicio` | `cmvex1v0300057d0pdjlbezcj` | Gorhorn Cazador nivel 1, recién empezada, día 1 08:00 en la Hondonada del Eco (dificultad Medio) | 2026-10-19 |
| `reino-fundado` | `cmvex1v0300057d0pdjlbezcj` | Gorhorn Cazador nivel 1, día 1 08:01, Reino de los Maktor recién fundado en la Hondonada del Eco (ayuntamiento pequeño), sin súbditos | 2026-10-19 |
| `reino-dia39` | `cmvex1v0300057d0pdjlbezcj` | Gorhorn Cazador nivel 2, día 39 en la Hondonada del Eco, Reino de los Maktor con súbditos (Ruka diplomático), Mercado, orco enfurecido cerca | 2026-10-19 |
| `reino-dia39-recursos` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-dia39` más recursos (QA-143): Granero ya construido (tope de comida 180) y comida 180 (al tope), bebida 60, tesoro del Reino 251 Goirnos, bolsa 300 Goirnos; inventario con leña 40, madera 20, piedra 30, hueso largo 15, cuerda de tendón 20, cordaje trenzado 8, fibra 10, resina 6, piel 10 (para construir); Almacén con cuerdas 10, cuerda de tendón 10, piedra 10, leña 10, hueso largo 5, fibra 5 | 2026-10-20 |
| `ia-gorhorn-dia42` | `cmvgnd5ke0001rivyqqjpdezo` | Gorhorn, día 42: la partida de la ronda «IA y diálogos», con la que se miden las propuestas de `opt-ai` (`QA-160`…`QA-168`). La restaura `tools/qa/bench-ia.sh` (`QA-173`) | 2026-10-20 |
| `reino-companero-npc` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-dia39-recursos` más 2 Chozas nuevas y dos compañeros NPC reales (Tirag Susig, de Clan Serhu, y Hagar Kiugh, de Clan Helsig; sin `rolReino`, con `sourceSlug`, aprobación 50): para CR-15, CR-16, CR-42 (P289) | 2026-10-21 |
| `reino-sano-defensas` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-companero-npc` más Empalizada, Torre de vigía, Armería y Barracón, 5 súbditos orcos (3 soldados, 2 vigías), guarnición asignada y equipos de milicia comprados; sin asalto aún: para guarnición, milicia y cobertura de CR-65 y órdenes y caravanas de CR-47 | 2026-10-21 |
| `reino-guerra-vasallaje` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-sano-defensas` con Clan Serhu en TENSIÓN con el Reino y Clan Helsig en GUERRA (presión por EXPANSION_TERRITORIAL_AGRESIVA); el vasallaje de Serhu sale en el panel del Reino: para CR-37 y CR-59 | 2026-10-21 |
| `reino-hambre-sed` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-sano-defensas` con 40 días avanzados sin reponer: comida y bebida a 0, 4 días de hambre y 28 de sed (el Reino sin población nunca pasa hambre: hace falta tener súbditos): para CR-53 y CR-58 | 2026-10-21 |
| `reino-combate-capitan` | `cmvex1v0300057d0pdjlbezcj` | Como `reino-sano-defensas` con un combate ya abierto del personaje contra Ulkha Ketg (Int 20, capitán del bando), Hulki (Int 20) y herrero-serhu, abierto con `combatePersonas` en el lugar actual: para CR-45 (grupo hostil con capitán) | 2026-10-21 |
| `t13a-colmillo` | `cmvex1v0300057d0pdjlbezcj` | Como reino-dia39-recursos, en Hogar Ketg (Colmillo Ceniza), día 39 12:03, nivel 3, tras la tanda 13a-1 | 2026-10-21 |
| `t13a3-ketg` | `cmvex1v0300057d0pdjlbezcj` | Como t13a-colmillo tras las tandas 13a-2 y 13a-3: misión Ascuas de Raíz de Fuego aceptada (0/3), día 39 12:30, Hogar Ketg | 2026-10-22 |
| `t13b2-ketg` | `cmvex1v0300057d0pdjlbezcj` | Como t13a3-ketg tras las tandas 13b-1 y 13b-2: Gorhorn en Hogar Ketg junto a la Peletería, día 39 16:52, sed 100% | 2026-10-22 |
