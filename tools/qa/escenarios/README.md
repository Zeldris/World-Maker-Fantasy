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
