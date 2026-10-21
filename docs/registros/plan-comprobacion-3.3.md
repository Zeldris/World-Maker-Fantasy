# Paso 3.3 de la línea: comprobar jugando los arreglados

Reparto de los hallazgos «arreglados, sin comprobar» y «arreglados en parte» de
[`pruebas-0.3-hallazgos.md`](pruebas-0.3-hallazgos.md) en tandas de un sistema (2026-10-21), para jugar en
serie con subagentes (~60 llamadas por tanda). Escenarios: [`tools/qa/escenarios/README.md`](../../tools/qa/escenarios/README.md).
Cada tanda marca sus P con `marca-hallazgo.py` («comprobado jugando» o «reabierto») y tacha aquí su fila.
Al acabar, `marca-hallazgo.py --resumen` dice qué arreglados quedan fuera del reparto.

| Tanda | Sistema | Escenario | Hallazgos | Estado |
|---|---|---|---|---|
| 1 | Partida nueva, menús y Habilidades | partida nueva | P38, P53, P54, P57, P58, P42, P99, P100, P101, P110, P114, P126, P67, P19, P80 | |
| 2 | Descanso, acciones libres e inventario | `hondonada-inicio` | P17, P18, P72, P74, P83, P84, P85, P86, P87, P121, P141 | |
| 3 | Mapa de zona y recolección en la Hondonada | `hondonada-inicio` | P20, P21, P24, P60, P61, P62, P88, P90, P95, P108, P151, P158, P159, P160, P161, P162, P163, P168, P169 | |
| 4 | Viajar de la Hondonada al Pozo | `hondonada-inicio` | P6, P46, P47, P68, P91, P115, P170, P204, P186 (viaje), P125, P133 | |
| 5a | Mapa del Pozo y fauna | `hondonada-inicio` + viajar al Pozo | P1, P2, P39, P50, P70, P76, P79, P92, P149, P152, P171, P196 | |
| 5b | Caza de fauna en el Pozo | el de 5a | P9, P12, P15, P55, P56, P77, P78, P97, P98, P129, P148, P153 | |
| 6 | Encuentro y combate contra el orco enfurecido | `reino-dia39` | P27, P28, P29, P31, P63, P107, P3, P11, P13, P14, P94, P111, P112 | |
| 7 | Combate con capitán: panel, remate y curar | `reino-combate-capitan` | P64, P65, P69, P93, P117, P118, P131, P155 | |
| 8 | Muerte y reaparición | `reino-combate-capitan` | P82, P119, P128, P156, P157 | |
| 9 | Reino: súbditos, sucesos, rumores, asalto nocturno | `reino-dia39-recursos`; `reino-fundado` para P221 | P221, P223, P224, P236, P237 | |
| 10 | Enciclopedia y Leyendas | `reino-companero-npc` | P35, P36, P37, P41 | |
| 11 | Mapa de las Llanuras y Viajar con mapa | `reino-dia39-recursos` + `escenario.sh dar` del mapa | P32, P33, P43, P45, P116 (Paso de los Pilares Rotos) | |
| 12 | Gistera Koh y la misión del orco | `reino-dia39` (aceptar la misión jugando) | P26, P102, P103, P105, P106 | |
| 13a | Colmillo Ceniza y Hogar Ketg (viajando, como el remate D de Mundo vivo) | `reino-dia39-recursos` | P134, P136, P139, P140, P167, P173, P175, P176, P180, P181, P182, P183 | |
| 13b | Colmillo Ceniza y Hogar Ketg (segunda mitad) | el de 13a | P184, P186 (casilla del Ketg'sedsar), P189, P190, P191, P192, P193, P195, P198, P199, P200, P201, P202 | |
| 14 | Cronista y diálogos con Ollama real | `ia-gorhorn-dia42` (Ollama real) | P240, P260 | |

**No jugables** (se cierran con su razón, sin jugar): P25 (el género sale en el texto libre del narrador), P52
(efecto `moverPoblacion`, solo tests), P174 (`arrancar-juego.sh`, herramienta de pruebas), P44 (interiores de otra
partida, se ve en la base), P143 (encuentros en Hogar Ketg por azar, ya decidido).
