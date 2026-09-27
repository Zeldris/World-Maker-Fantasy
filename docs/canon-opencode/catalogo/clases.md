# CATÁLOGO: clases y especializaciones
Qué es: las 9 clases del juego, con sus especializaciones, razas y pesos de armadura.
Fuente: sistemas-combate/clases.md, schema.prisma, classAbilities.ts. Sincronizado: 2026-09-27.

La especialización se elige a nivel 10. Usar el valor EXACTO del enum.

| Clase | Razas | Especializaciones (enum) | Armadura | Identidad |
|---|---|---|---|---|
| GUERRERO | todas | BERSERKER, GUARDIAN, LANCERO, ESPECIALISTA | Pesado + Medio | cuerpo a cuerpo, tanque o bruiser |
| CAZADOR | todas | DOMADOR, SUPERVIVENCIA, TIRADOR, INSTINTIVO | Medio | superviviente; el Domador controla bestias |
| CHAMAN | **solo orcos** | TOTEMICO, RUNICO, CONVOCADOR, OPRESOR | Medio + Pesado | magia a través de tótems y runas, nunca en crudo |
| ARQUERO | todas | MAESTRO_ARQUERO, MAESTRO_BALLESTERO | Ligero + Medio | tirador |
| CABALLERO | **solo Goirntes** | CABALLERO_DEL_ORDEN, CABALLERO_DEL_VALOR, CABALLERO_DEL_DOLOR | Pesado (Valor: + Medio) | disciplina militar, defensa |
| MAGO | no orcos (sin clase jugable construida) | PODER_MAGIA, PODER_SEMILLA | Ligero | 7 escuelas de magia / 12 ramas de Semilla |
| SEGADOR | **solo Nabieus** | PARCA, MALDITO, ILUSTRADO, TRANSMUTADOR | Ligero + Medio | succión de vida, debilidades, remates |
| ASESINO | todas | MAESTRO_ASESINO, ASESINO_TOXICO, ASESINO_DANZANTE, ASESINO_SELECTO | Ligero | precisión, veneno, movilidad |
| DRUIDA | **solo Faerus** | CAMBIAFORMAS, AULLADOR, SALVAJE, ADAPTADO | Ligero + Medio | se transforma en fauna del Margen (Hetris, Mekiosi, Vistue); el Aullador invoca a Vaeth |

## Reglas
- Un orco NUNCA es Mago. Un Faerus NUNCA es Caballero. Ninguna raza tiene otra clase exclusiva que
  no sea la suya.
- No hay clases fuera de estas 9 (ni ARTESANO, ni SANADOR…). Los oficios son otra cosa (ver
  oficios-edificios.md).
- Atributo que usa cada arma: fuerza (hachas, mazas, garrotes, PICA, LANZA), destreza (dagas,
  cuchillos, espadas, arcos, ballesta, honda, red, guantes), constitución (ESCUDO), voluntad (VARA),
  magia (BACULO, BASTON, GRIMORIO).
- Niveles y atributos reales de NPC: soldados y guerreros comunes, nivel 2-4 con atributos de 5 a
  13; Maestros de oficio, nivel ~5 con su atributo fuerte en 16-18; políticos Goirntes (Yovenne,
  Vrask), nivel 5-7 con Int y Vol en 15-16; **líderes de clan** (Ulkha, Torgash, Brenka, Solgra,
  Doshka, Dulgren), **nivel 20-24** con su atributo fuerte en 18-32.
