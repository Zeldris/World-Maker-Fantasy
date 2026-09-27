# NÚCLEO — reglas duras de Helek Sirik
Qué es: lo que TODA propuesta debe respetar. Se lee siempre.
Fuente: docs/rpgtarkor/ (todo). Sincronizado: 2026-09-27.

## Mundo
- Fantasía con base científica. Todo fenómeno tiene causa física (bioacumulación, magnetismo,
  vibración, adaptación). Nunca "es magia" sin mecanismo.
- Dos continentes. **Berig** (este) es donde se juega. **Vaelira** (oeste) está FUERA DE JUEGO,
  separada por la Niebla del Estrecho, que casi nadie cruza.
- NADA de Vaelira aparece en Berig: ni Kelife, Jusaly, Kalisar o Ilvenar, ni Hebra Dorada, ni el
  musgo bioluminiscente, ni la Costa del Azabache.
- Berig de NORTE a SUR: Cristal Helado → Llanuras del Viento Rojo → Ciénaga Troncal → El Margen
  Silencioso → La Meseta del Orden.
- Razas de Berig: Goirntes (Meseta), Orcos (4 clanes), Nabieus (Margen oriental y sur de la
  Ciénaga), Faerus (Margen occidental y Kegi). NO HAY HUMANOS.
- Población total de Berig: unas 8.000-10.000 almas. Un continente a medio vaciar.
- Monedas: el Goirno (plural "Goirnos").

## Tiempo
- Antes del año 0 = era mítica: **SIN AÑOS**, solo orden de sucesos.
- 0: los Faerus terminan de asentarse (Hashma). ~1.000: el Estallido (magia salvaje).
  2.000: nacen los 4 primeros orcos. 2.800: guerra Goirnte contra los orcos. ~2.850: golpe de Ketg,
  nace el Clan Serhu. ~2.900: migración Maktor y primer golpe. ~3.600-3.650: Yugo de Hierro y Purga
  Silenciosa. ~3.900-3.950: Guerra de la Isla Cambiante. 4.000: aniquilación Maktor. ~4.005-4.008:
  El Detonante. **4.010: arranca la partida** (Gorhorn, 20 años).
- Nada puede pasar después del 4.010. Los orcos viven 40-50 años y son adultos a los 10.

## Reservado (NO resolver, NO explicar)
Qué descubrió el Reino Nabierus; qué encontró o sabe Tarkor, y su regreso; los seres de la Isla y
de El Giro; la Ciudad Hundida, el Archivo Cegado y el Observatorio Roto (tras un terremoto futuro);
el destino de las Semillas Perdidas; la Entidad Desconocida; qué sabe Tarsen Vold del Detonante.

## Tono prohibido
- Sin "luna" (el cielo tiene un cinturón de micro-cristales), sin pólvora ni arcabuz, sin
  vocabulario técnico ("calibrado", "certificación", "técnicos").
- Sin objetos hechos con partes de razas sintientes (Faerus, Nabieus, orcos…).
- Los Faerus no llevan túnica ni sandalias.
- Ninguna especie o planta nueva con nombre de ser real (araña, trufa, corzo…).
- Sin palabras en inglés.

## Trampas conocidas
- **Corredor de Cauce: MORATORIA.** Es presa sagrada; no se le añaden materiales. No tiene lana ni
  quitina, y no vive en el Margen.
- `Silh` es Kektira (orco) y significa "musgo". `Sil` es Feg y significa "fuego". No usar para
  nombres Faerus de flora.
- Los Faerus NO tienen títulos de mando ni escritura. Los Nabieus nombran clanes "Keseg + [algo]".
- Los Manaderos está en las Llanuras. La Telda no crece en el Margen. En el Margen no hay niebla.
- Por defecto, los nombres nuevos van en lengua común. En lengua de raza solo si se pide.

## Enums reales (usar SOLO estos)
- Ranura: CASCO, CAMISA, ARMADURA_SUPERIOR, GUANTES, ARMADURA_INFERIOR, BOTAS, CINTURON, ACCESORIO,
  ANILLO_1, ANILLO_2, ARMA_PRINCIPAL, ARMA_SECUNDARIA, CONSUMIBLE_1…6, COSMETICO_ESPALDA,
  COSMETICO_CABEZA, COSMETICO_CINTURA.
- tipoArma: HACHA/MAZA/GARROTE/ESPADA _1_MANO o _2_MANO, PICA, LANZA, CUCHILLO, DAGA, ESCUDO,
  ARCO_CORTO, ARCO_LARGO, HONDA, BALLESTA, BACULO, BASTON, GRIMORIO, GUANTES, RED, VARA.
- Peso de armadura: LIGERO da Magia+Inteligencia · MEDIO da Destreza+Voluntad · PESADO da
  Fuerza+Constitución. El Carisma solo va en accesorios y cosméticos.
- Atributos: fuerza, destreza, constitucion, inteligencia, voluntad, carisma, magia. NO existen
  Agilidad, Resistencia ni Percepción. Escala: 4-16 para lo común; hasta ~30 solo para líderes de
  clan de nivel 20+ (ver catalogo/clases.md).
- Medio: TERRESTRE, AEREO, ACUATICO. Temperamento: AMIGABLE, INOFENSIVO, CAUTELOSO, AGRESIVO,
  ENEMIGO.
- Familias de fauna: GUELISES, ACECHANTES, CORVENES, ZANCUDOS, BESTIONES, RONDINES, QUITINOS,
  ESCAMADOS, NADANTES, ORDENADOS, UMBRIAS, MUDOS_SALVAJE, ROKRATS_ESTALLIDO.
- Familias de flora: Veldrias, Zarcos, Heldras, Granoles, Trenias, Marelas, Bulvias, Muscarias,
  Salviras, Fongares, Vetrias, Brotes Salvajes, Roktars Florares.
- Clases: GUERRERO, CAZADOR, CHAMAN (solo orcos), ARQUERO, CABALLERO (solo Goirntes), MAGO (nunca
  orcos), SEGADOR (solo Nabieus), ASESINO, DRUIDA (solo Faerus). Especializaciones en
  catalogo/clases.md.
- NPC: kind PRINCIPAL (único, con historia) o PLANTILLA (repetible). Porcentajes 0-100: comerciable,
  reclutable, capturable (0 para razas sintientes con historia), cortejable.

## Escala de valor (catálogo real)
| Tier | Equipo (Goirnos) | Material (Goirnos) | Bonos totales |
|---|---|---|---|
| 1 | 7-10 | 1-3 | +1 a +2 |
| 2 | 14-18 | 3-5 | +3 a +4 |
| 3 | 23-31 | 5-6 | +4 a +7 |
| 4-5 | 30-36 | 6-15 | +6 a +8 |
| 6-7 | 30-60 (muy raro) | 8-30 | +5 a +8 |
Nada del catálogo pasa de 80 Goirnos. Un precio de cientos está MAL.

## Lista de comprobación (comando REVISA)
1. ¿Usa material de Corredor de Cauce? 2. ¿Da por "inventado" algo que sí está en lo leído?
3. ¿Mete algo de Vaelira en Berig? 4. ¿Respeta el orden norte-sur y la zona de cada especie?
5. ¿Resuelve algo reservado? 6. ¿Pone años en la era mítica, o fechas imposibles (orcos antes del
2.000, algo después del 4.010)? 7. ¿Inventa atributos, oficios, clases, ranuras o precios fuera de
escala, o incumple la regla de peso? 8. ¿Tono prohibido? 9. ¿Muletillas (`Silh`, "tela de hueso",
"lo recogen con respeto", sufijos repetidos)?
