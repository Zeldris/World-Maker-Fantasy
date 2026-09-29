# Roadmap — Tarkor, Berig en alpha

**Actualizado:** 2026-09-29, comprobado contra el código ese día.
**Versión actual:** Alpha 0 · `v0.0.0-alpha` (etiqueta en `44f8ba3`).
**Siguiente hito:** `0.1` Llanuras estable. Plan de ejecución en
[plan-roadmap-0.1.md](plan-roadmap-0.1.md).
**Historial:** lo cerrado hasta Alpha 0 (el roadmap por trimestres, sus respuestas y el plan de
fases 1-13) está en [archivo/21-roadmap-2026-09-29-alpha0.md](../archivo/21-roadmap-2026-09-29-alpha0.md)
y [archivo/plan-roadmap-oct-2026-alpha0.md](../archivo/plan-roadmap-oct-2026-alpha0.md).

**Cómo se usa:**
- El roadmap va por **hitos de versión**. Cada hito se cierra entero, se verifica jugando, se
  etiqueta en git y solo entonces se empieza el siguiente.
- Al cerrar un punto se tacha aquí con su commit; el detalle va al registro correspondiente.
- **🧭 = decide Álvaro antes de empezar.** Nada marcado así se implementa sin su respuesta.
- Origen: **[A]** pedido o decidido por Álvaro · **[H]** hallazgo verificado en código · **[P]**
  propuesta de Claude.

---

## Versionado (desde el 2026-09-29, decisión de Álvaro)

Formato: **`A.P.C-etapa+commit`**, por ejemplo `0.1.37-alpha+44f8ba3`.
- **A — versión de juego:** sube en 1 con cada continente nuevo, a modo de DLC. Berig es la `0`;
  Vaelira será la `1`.
- **P — proyecto de desarrollo:** sube en 1 al cerrar cada hito de este roadmap.
- **C — commits:** número de commits desde la etiqueta del hito. Lo calcula git solo
  (`git describe --tags`), nunca se toca a mano.
- **etapa:** `alpha` (ahora), `beta` o nada cuando sea estable.
- **commit:** hash corto del commit exacto, para saber qué código se jugó.

Cada hito cerrado se etiqueta en git (`v0.1.0-alpha`, `v0.2.0-alpha`…). La versión se muestra en
el juego y la devuelve el backend, y cada partida guarda con qué versión se creó y con cuál se jugó
por última vez.

## Hitos de un vistazo

| Versión | Hito | Qué significa terminarlo | Estado |
|---|---|---|---|
| `0.0` | **Alpha 0** | Todo lo hecho hasta el 2026-09-29: Reino, zona, caza, oficios, tiradas visibles, economía y expediciones de facción, relaciones iniciales | ✅ `v0.0.0-alpha` |
| `0.1` | **Llanuras estable** | Una partida completa con Gorhorn en Las Llanuras sin nada que rompa el juego, verificada jugando | ▶ Siguiente |
| `0.2` | **Facciones vivas** | Las facciones sobreviven, deciden y actúan solas; el jugador ve y sufre las consecuencias | Pendiente |
| `0.3` | **Reino profundo** | Población que llega, forma familia y trabaja; ganadería; defensa | Pendiente |
| `0.4` | **Berig abierto: Cristal Helado** | Viajar entre regiones y jugar una segunda región completa | Pendiente |
| `0.5` | **Ciénaga Troncal** | Tercera región jugable con sus oficios y Maestros | Pendiente |
| `0.6` | **Margen Silencioso y Meseta del Orden** | Berig entero jugable | Pendiente |
| `0.7` | **Personaje propio** | Crear un personaje desde cero, sin ser Gorhorn, con cualquier raza de Berig | Pendiente |
| `0.8` | **Beta de Berig** | Instalador, rendimiento en la Steam Deck, narrador local afinado; paso a `-beta` | Pendiente |
| `1.0` | **Vaelira** | Segundo continente (DLC) | Lejano |

---

## `0.1` — Llanuras estable ▶

Regla del hito: **congelación de funcionalidades nuevas grandes**. Solo entra lo que hace falta
para que la partida en Las Llanuras sea sólida.

### Verificación jugando
- **Pasada de juego completa con Gorhorn** siguiendo un guion (primer turno y Gistera, zona y
  movimiento, caza en solitario y en grupo, cadáveres, recolección de cada oficio, combate con
  muerte y renacer, compañeros, Reino: fundar, construir, producir, taller con trabajador,
  diplomacia, mercado). Cada fallo se apunta y se arregla dentro del hito. **[P]**
- Lo que quedó sin verificar de Alpha 0: Goirnos al saquear un humanoide, Taller con trabajador,
  la ficha de flora (`44f8ba3`), la vida tras el golpe (`15d6ec2`), expediciones. **[H]**

### Huecos que se notan al jugar
- **Súbditos del Reino, versión mínima** (F9-7): llegada de pobladores desde la población de su
  raza cuando hay vivienda, comida y agua. Primera pieza de la propuesta de población. 🧭 Revisar
  antes la propuesta en `propuestas-lore.md`. **[A]**
- **El mundo vivo, visible:** noticias en el registro cuando una expedición vuelve, es
  interceptada o hay bajas, y cuando cambia la relación entre facciones. **[P]**
- **Migrar `worldAgenda.ts`** (conflicto fijo Serhu+Concordia contra Helsig+Goshg) a las
  `FactionRelation` reales. **[A]**
- **Maestro de diplomacia** (H-5, mitad hecha: ya sube por negociación). 🧭 Quién enseña y dónde. **[A]**

### Robustez
- **Versión visible y grabada en cada partida** (en curso, 2026-09-29). **[A]**
- **Partidas que sobreviven a una actualización:** copias de objetos con estadísticas antiguas
  (reequilibrio del 2026-09-29), ofertas persistidas sin campos nuevos, migraciones al arrancar. **[P]**
- **Test intermitente de combate múltiple** (registro de deuda, 2026-09-29): causa raíz. **[H]**
- **Integración continua en verde**: la CI de GitHub lleva en rojo desde que existen los tests con
  Postgres real; le falta el servicio de base de datos. **[H]**

### Rendimiento
- **Latencia real por turno en la Steam Deck** y objetivo fijado. **[A]**

**Hecho cuando:** el guion completo se juega de principio a fin sin bloqueos, la suite está verde
en CI, y la latencia está medida. Se etiqueta `v0.1.0-alpha`.

---

## `0.2` — Facciones vivas

- **Economía de supervivencia de facción**: almacén con tope por edificios, agua obligatoria,
  comida y producción activa, sueldos en Goirnos, cascada de declive hasta la extinción.
  Propuesta en `propuestas-lore.md`, 🧭 números por decidir. **[A]**
- **IA de decisión de facción** según la Inteligencia de su líder (`liderNpcId`): construir,
  expandirse, pactar, declarar la guerra, lanzar expediciones. Las carencias de supervivencia son
  sus disparadores. **[A]**
- **Motor de eventos de mundo unificado**: eventos discretos que alimentan relaciones, lore y
  misiones; función pura llamada desde el turno y desde `worldTick`. **[A]**
- **Misiones secundarias por motor** en vez de por el LLM (momento de revisitar la fusión de los
  tres `pending*Offer`). **[A]**
- **IA de combate NPC, tramo Inteligencia 20+**: retirada (decidida: huida inmediata con tirada),
  concentrar ataques en el mismo objetivo y órdenes de un capitán. **[A]**
- **Comercio de volumen Reino↔facción**: todo el catálogo, según el origen del objeto y el oficio
  de los NPC por raza y región. 🧭 Falta la fórmula. **[A]**
- Expediciones: que se vean en el mapa de mundo. **[P]**
- Pasada de rendimiento del `worldTick` con el motor completo. **[P]**

## `0.3` — Reino profundo

- **Población y reproducción al estilo Medieval Dynasty**, a tiempo real de juego: parejas, crías
  que crecen, vejez, muerte y marchas. Propuesta en `propuestas-lore.md`. 🧭 Edad adulta y vida de
  Goirntes, Nabieus y Faerus. **[A]**
- **Ganadería**: oficio de ganadero por raza y región y un corral por especie (Murgol, Corretolvas,
  Canizor, Cuernahoja; nunca el Corredor de Cauce). Propuesta en `propuestas-lore.md`. **[A]**
- Estaciones de recolección sin oficio (Leñera, Cantera, Fibrería), si hacen falta. **[P]**
- Edificios de defensa (empalizada, torre de vigía, foso) para los Cuarteles de Guerra. **[P]**
- Postura de compañero en combate (agresivo, defensivo, capturador, clemente). **[A]**
- **"Charlar con NPC" enriquecido** (Franja 4 del plan Interactuar): lore, reclutar e interrogar
  tras Clemente. 🧭 Falta la especificación. **[A]**

## `0.4` — Berig abierto: Cristal Helado

- **Viaje largo entre regiones** desde el mapa de mundo. 🧭 Hoy aparcado (la habilidad Viajar
  exige montura): decidir si se viaja a pie o se implementan antes las monturas. **[A]**
- **Cristal Helado jugable**: `ZonePoint` y grupos de fauna, recorrido de sus zonas, Maestros
  Helsig. **[A]**
- Sembrar la Casa de curas Helsig y el Obrador de piedra Serhu cuando existan sus Maestros. **[H]**

## `0.5` — Ciénaga Troncal

- Oficios de la Ciénaga (`carpintero-orcos-cienaga`, `cocinero-orcos-cienaga`, resinero) y los
  Maestros Goshg, para que sus talleres del lore sean edificios. **[A]**
- Edificios de facción Goshg en `campamento-goshg-interior`. **[H]**
- Zonas, fauna y recorrido de la región. **[A]**

## `0.6` — Margen Silencioso y Meseta del Orden

- Zonas, fauna, oficios y Maestros de las dos regiones (Keseg Sael, Feg Tusha, Concordia de
  Hierro, Los del Obelisco). **[A]**
- Opcionales de las fichas aprobadas: interior del Archivo del Refugio, `ZonePoint` del Jakut. **[A]**
- **Control de escuadrones** (patrullar, explorar), si el mundo vivo lo pide. **[A]**

## `0.7` — Personaje propio

Decisión de Álvaro (2026-09-29): antes de Vaelira hay que poder jugar con un personaje creado
desde cero, no solo con Gorhorn. Va después de tener Berig entero porque cada raza necesita su
región jugable como punto de inicio. El backend ya conserva una vía de "partida custom" de antes
de restringir el juego a Gorhorn (`routes/saves/creation.ts`); se parte de ahí.
- **Creación completa:** nombre, raza de Berig (Goirntes, orcos con su variante de clan y región,
  Nabieus, Faerus), clase respetando sus restricciones de raza, reparto de atributos, origen y
  motivación. **[A]**
- **Punto de inicio por raza y región**, con su introducción narrativa propia y su kit inicial
  (equipo, habilidades de clase y raciales, oficio de partida si procede). **[A]**
- **Reputación inicial** con las facciones según el origen elegido (un Faerus de Kegi no empieza
  igual con el Clan Serhu que un orco Serhu). **[A]**
- Enciclopedia y narrador sin suposiciones de "eres Gorhorn": revisar textos, prompts y fragmentos
  del RAG que den por hecho su historia. **[P]**
- 🧭 Puntos de atributo y límites, orígenes permitidos por raza, y si Gorhorn se queda como
  personaje de inicio rápido. **[A]**
- 🧭 **Trasfondo del personaje** (idea de Álvaro, 2026-09-29, se diseña al llegar a este hito): dos
  vías. (a) El juego genera el trasfondo automáticamente a partir de raza, origen y clase. (b) El
  jugador da sus datos y la IA local (o un motor aparte) redacta un trasfondo mínimo coherente con
  el canon. **[A]**

## `0.8` — Beta de Berig

- **Instalador** (investigación en [20-instalador-distribuible.md](../arquitectura/20-instalador-distribuible.md)). **[A]**
- **Narrador local afinado** (guía en [fine-tuning-ia-local.md](../ia/fine-tuning-ia-local.md)):
  dataset de partidas reales, con el vocabulario del lore actual ("brillo de aurora", Holdo…). **[A]**
- **Curvas dinámicas** (§ 9 del diseño X4): pasada de *grounding* sobre movimiento en zona,
  oficios, talento y energía antes de diseñar nada. **[A]**
- Rendimiento aceptable en la Steam Deck con Berig entero. **[A]**

**Hecho cuando:** Berig se juega entero, con Gorhorn o con un personaje propio; se etiqueta
`v0.8.0-beta`. Berig estable = quitar la etapa.

## `1.0` — Vaelira (DLC)

Segundo continente: Kelife, Kalisar, Jusaly, Ilvenar y sus cuatro personajes. Fuera de juego hasta
que Berig sea estable.

---

## Continuo: lore y documentación

- **Rondas de OpenCode** con la capa `canon-opencode/`. Primera prueba de control pendiente:
  `FAUNA margen`, `ITEMS llanuras` y `EVENTOS` orco, con HUECOS → ESCRIBE → REVISA. **[A]**
- **Propuestas SIN REVISAR** en [propuestas-lore.md](../borradores-opencode/propuestas-lore.md):
  población y reproducción, supervivencia de facción, ganadería, Dessa/Yerin/Riko como NPC. **[A]**
- `jakut-ger-interior`: interior (ciudadela) del Jakut Ger de los Feg Ger. 🧭 Qué hay dentro. **[H]**
- `razas.md` y `personajes.md` siguen hablando de "8 razas jugables" y "pregenerados"; solo
  Gorhorn es jugable. **[H]**
- Revisar la incoherencia de distancias: Karot Veku a ~110 km del Cruce en el mapa de Azgaar y a
  18-25 km en el grafo del juego. **[A]**
- `ampliar lore` de Las Llanuras: parado en la zona 15-17 (ver
  [ampliar-lore-checklist.md](../registros/ampliar-lore-checklist.md)). **[A]**
- Tras cada cambio de lore: fragmentos del RAG (`loreChunks.ts`) al día y `./actualizar-mundo.sh`
  en local. **[P]**
- Documentación: convención "estado arriba, historial abajo" en el resto de `mecanicas/` y
  `rpgtarkor/`. **[P]**
- Registros: pasar las entradas cerradas de `revisar-partida-hallazgos.md`,
  `checklist-pruebas-juego.md` y `deuda-tecnica-hallazgos.md` a `archivo/`. **[P]**
- Prompts de imagen por nivel de Ayuntamiento y Cuartel, con los huecos de parcela (los genera y
  sube Álvaro). **[A]**

---

## Aparcado a propósito

No son fallos. Se retoman cuando cambie su condición.

| Qué | Por qué espera |
|---|---|
| Multijugador (`/multijugador` es un marcador de posición) | Hasta que el modo en solitario esté maduro |
| Tirada real de `comerciablePct` / `cortejablePct` | Solo avisos narrativos; falta diseñar la tirada |
| `percepcionPasivaFor` sin llamador | Sin diseño que la use |
| Fase 4 de clases (`RETIRAR`, cifras de `AUMENTO`/`DEBILIDAD`/`CURAZION`) | Álvaro rellena números en `clases.md` a su ritmo |
| Armas y armaduras marcadas "PENDIENTE DE IMPLEMENTAR" en `worldCatalog.ts` | Sin receta de crafteo |
| `saquito-arena-iman`: efecto protector en Las Agujas Imán | El crafteo existe; falta el efecto |
| `silbato-hueso-caza` | Sin diseño |
| PNG reales de banners de clase | Sin proveedor de imagen para esa categoría |
| Clemencia de enemigo y duelos de honor | Espera a la IA de combate NPC (`0.2`) |
| Sub-combates fragmentados (>4 contra 4) huérfanos si el servidor cae a mitad | Reverificar con `caza.integration.test.ts` |
| Dessa, Yerin y Riko como NPC | Hasta que Álvaro escriba su lore |
| Partir el bloque de combate múltiple de `turnResolution.ts` | Muy entrelazado; solo si frena algo |

---

## Preguntas abiertas para Álvaro

1. **Propuesta de población** (bloquea los súbditos de `0.1`): ¿vale la llegada de pobladores tal
   como está propuesta?
2. **Maestro de diplomacia**: ¿quién lo enseña y dónde?
3. **Gorhorn y los Goshg**: `clanes-orcos.md` dice "sin conexión previa"; `personajes.md` y
   `cronologia.md` dicen que de joven trabajó para tribus orcas de la ciénaga. ¿Cuál se queda?
4. **Viaje largo** (bloquea `0.4`): ¿a pie, o monturas primero?
5. **Números de la economía de supervivencia y fórmula del comercio de volumen** (bloquean `0.2`).
6. **Edad adulta y esperanza de vida** de Goirntes, Nabieus y Faerus (bloquea `0.3`).
7. **Personaje propio** (bloquea `0.7`): puntos de atributo, orígenes permitidos por raza y si
   Gorhorn se queda como inicio rápido.
