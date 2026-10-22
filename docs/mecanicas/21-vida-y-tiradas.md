# Vida y tiradas: PV, aguante, lesiones y daño por arma (diseño, 2026-10-22)

**Estado:** diseño aprobado por la usuaria el 2026-10-21; las cifras salen de la simulación de abajo.
**Entra en el roadmap al cerrar las pruebas de juego** (regla de `CLAUDE.md`: hasta entonces no se
toca el código del juego). Sustituye en parte a [14-combate-y-muerte.md](14-combate-y-muerte.md) §1 y
§2.4, y a la decisión 3 de [06-decisiones-mecanicas.md](06-decisiones-mecanicas.md) (salud «ligera»).
Prototipo: [`tools/prototipos/vida-y-tiradas/simular.py`](../../tools/prototipos/vida-y-tiradas/simular.py).

Cada propuesta cita el juego del que sale; **X4: Foundations marca el camino** donde puede (escudo
y casco por %, subsistemas dañados, el mismo motor dentro y fuera del sector del jugador).

---

## 1. Qué cambia y por qué

Hoy la salud es una escalera de cinco peldaños (`ILESO → HERIDO → GRAVE → CONVALECIENTE → MUERTO`)
y **todo golpe que entra baja exactamente un peldaño** (`nextCondicionForAttack`, `death.ts`), da
igual que sea una daga o un hacha, un zense o un gargantúa. Consecuencias que salieron jugando y que
confirma la simulación:

- **El arma no importa:** con el sistema de hoy, daga, espada y hacha ganan el mismo duelo en
  3,4-3,5 rondas; la daga gana *más* que el hacha (74 % frente a 62 %) porque solo cuenta el
  atributo de la tirada.
- **El tamaño del rival tampoco:** un gargantúa (Fu 20, Co 22) cae en tres golpes igual que un
  zense; con suerte, una jugadora de nivel 1 lo mata el 9 % de las veces.
- **Las bajas de caza son una moneda al aire:** cualquier golpe de la bestia deja a un cazador
  HERIDO (≈25 % vuelve herido de una caza fácil de cornante, igual que de una de rondador).
- **Los súbditos no tienen salud:** `partidasCaza.aplicarBajas` solo guarda la condición de los
  compañeros; un súbdito o muere o vuelve intacto.

El sistema nuevo da **puntos de vida reales** a todos, con el daño dependiendo del arma y del
tamaño, y deja la escalera como **tramo derivado** del % de PV. El Narrador y casi todo el código
siguen leyendo el tramo, así que la migración es pequeña (§ 4).

## 2. Las reglas

### 2.1 PV y tramos (X4 casco en %, BG3, 5e «Bloodied»)

- **PV máx. humanoide** = `10 + Con + (nivel − 1) × (4 + Con // 4)`. Nivel 1 con Con 10: 20 PV;
  orco cazador de nivel 3 con Co 12: 36 PV. (5e: dado de golpe fijo por nivel + mod. de Con.)
- **PV máx. fauna** = `Con + nivel × DG(tamaño)`, con DG por tamaño 2/3/5/7/10
  (diminuta/pequeña/mediana/grande/enorme), como los bloques de monstruo de 5e. Zense (pequeña,
  nivel 1): 9 PV; cornante (grande, nivel 3): 34; gargantúa (enorme, nivel 6): 82.
- **Tramo** = % de PV actual sobre el máximo: ILESO > 75 · HERIDO 51-75 · GRAVE 26-50 ·
  CONVALECIENTE 1-25 · MUERTO 0. Los valores de `SALUD_POR_CONDICION` de hoy (100/75/50/25/0) caen
  justo dentro de cada tramo, así que la migración de partidas es directa (§ 4.1).
- **Se mantienen:** el malus por tramo (`CONDICION_MALUS` 0/2/5/10), el golpe de gracia contra un
  CONVALECIENTE y el **tope de ronda de la jugadora** (si empieza la ronda ILESO, no acaba peor que
  CONVALECIENTE: se queda a 1 PV). CONVALECIENTE sigue siendo «fuera de combate».
- **Daño masivo (5e):** llegar a 0 PV solo mata si el daño sobrante es ≥ 50 % del PV máx.; si no,
  se cae a 1 PV (CONVALECIENTE) y lo remata el golpe de gracia o el 3 % de muerte del combate de
  fondo. Sin esta regla la simulación daba un 10,5 % de cazadores muertos contra un gargantúa (hoy,
  0,7 %); con ella, 1,2 %.
- **El Narrador solo recibe el tramo** (`saludBandFor`), nunca los PV. La interfaz sí puede
  mostrar la barra de PV (X4 enseña el casco en %; BG3 los PV exactos).

### 2.2 Aguante (X4 escudo y casco)

- Capa aparte que **absorbe el daño antes que los PV** y **se rellena entera al acabar el
  combate**. `aguante = Con // 4` (Con 10: 2; Con 22: 5). Es poco a propósito: amortigua los
  golpes sueltos, no las peleas largas (con `Con // 2` la caza quedaba demasiado segura, § 5).
- Los PV **no** se recuperan solos al acabar: descansar sube hasta el **75 %** (se queda en
  HERIDO: volver a ILESO pide medicina), comer acelera el descanso y la **medicina llega al 100 %**. Los objetos médicos de
  hoy (`curaHasta`, `curaUnPaso`) se traducen a % (§ 4.2).

### 2.3 Lesiones (X4 subsistemas dañados, Bellwright, Medieval Dynasty)

Se tira lesión con un **golpe pleno que entra en PV (50 %)**, al **cruzar a GRAVE (15 %)** o al
**cruzar a CONVALECIENTE (35 %)**. Cuatro tipos para empezar:

| lesión | efecto | se cura con |
|---|---|---|
| brazo | −2 Fuerza al daño y a las tiradas de Fuerza | descanso largo o medicina |
| corte | sangrado: −1 PV por ronda en combate (no baja de 1) y −1 PV por hora fuera hasta vendarlo | venda o medicina |
| pierna | viaje más lento (×1,5 el tiempo de trayecto) y −2 a la iniciativa | descanso largo o medicina |
| costillas | aguante máximo a la mitad | descanso largo |

Las lesiones se guardan como lista y se ven en la ficha. **Súbditos y cazadores vuelven con sus PV
y sus lesiones** y se recuperan en el asentamiento a ritmo de descanso (Manor Lords: los heridos
dejan de trabajar; Bellwright: los aldeanos heridos se curan en la cama y con el sanador).

### 2.4 Tiradas (5e, BG3; X4 para la caída por subsistemas)

- **Ataque:** `d20 + atributo // 2` (el mismo bono que `rollAttributeCheck` hoy, con malus y rueda
  de tipos) contra **Defensa** = `10 + Destreza // 2 + armadura` (`statBonuses.defensa` del
  objeto). **Defenderse** suma **+5** a la Defensa hasta el siguiente turno (5e «Dodge», BG3).
  Deja de ser tirada enfrentada: el defensor no tira (5e: CA fija).
- **Resultado** por margen (ataque − Defensa), reaprovechando `outcomeForMargin`:
  - **golpe pleno:** 20 natural o margen ≥ 10 → **dobla los dados** de daño (5e crítico).
  - **golpe normal:** margen ≥ 0 (salvo 1 natural) → daño normal.
  - **parada:** margen −1 a −9 → nada.
  - **contragolpe:** 1 natural (fallo automático aunque el margen sea ≥ 0, como en 5e) o margen ≤ −10 → el defensor golpea con daño normal si tiene
    habilidad de ATAQUE (igual que hoy, `effectiveExchangeOutcome`).
- **Daño:** dado del arma + `atributo // 3`. Daga **d4**, espada **d8**, hacha **d12**, lanza
  **d8**; la daga usa Destreza, el resto Fuerza (5e «finesse»). Sin arma: d2. Pendientes de dado (hoy en el catálogo sin cifra), propuesta de 5e: maza
  (`MAZA_1_MANO`) d6, garrote (`GARROTE_1_MANO`) d4, pica (`PICA`) d10; escudo (`ESCUDO`) +2 a la
  Defensa (5e: el escudo suma +2 a la CA) y, si golpea, d4 como arma improvisada (5e). La fauna pega con su
  arma natural según tamaño: d2 / d4 / d6 / 2d6 / 2d10.
- El aguante absorbe primero (§ 2.2).

### 2.5 Habilidades con efectos numéricos (BG3, 5e)

Los efectos de `AbilityEffect` pasan de «un peldaño» a cifras: `CURAZION` cura un % de PV,
`RECUPERACION` rellena aguante, `LETAL` añade dados (y deja de matar de golpe: lo hace solo si el
daño cumple la regla de daño masivo), `DESVIAR` suma a la Defensa, `CONTRA` habilita el
contragolpe. Las cifras de cada uno se fijan al implementar el paso 6, con la misma simulación.

### 2.6 Combate de fondo y Narrador: el mismo motor (ADR 0002, X4)

`combateDeFondo.simularSubCombate` usa las mismas funciones de tirada y daño que el combate en
vivo y **deja heridas reales**: los PV y las lesiones de compañeros, súbditos y NPCs se guardan al
acabar (X4 resuelve igual el combate fuera del sector, con daño persistente). El Narrador sigue
narrando a partir del tramo y de la lesión nueva, si la hay.

## 3. Cifras iniciales

| cifra | valor | dónde vive |
|---|---|---|
| PV humanoide | `10 + Con + (nivel−1) × (4 + Con//4)` | `death.ts#pvMaximo` (nueva) |
| PV fauna | `Con + nivel × DG`, DG 2/3/5/7/10 por tamaño | ídem, con el tamaño del catálogo |
| aguante | `Con // 4`, se rellena al acabar el combate | ídem |
| tramos | >75 / 51-75 / 26-50 / 1-25 / 0 % | `death.ts#tramoPorPv` (nueva) |
| daño masivo | sobrante ≥ 50 % del PV máx. para morir | `death.ts` |
| Defensa | `10 + De//2 + armadura`; defenderse +5 | `combatExchange.ts` |
| golpe pleno / contragolpe | 20 / 1 natural o margen ±10 | `combatExchange.ts` |
| dados de arma | daga d4, espada d8, hacha d12, lanza d8, sin arma d2; pendientes: maza d6, garrote d4, pica d10, escudo +2 Defensa / d4 (5e) | catálogo (`dadoDano` en el objeto) |
| dados de fauna | d2 / d4 / d6 / 2d6 / 2d10 por tamaño | catálogo (`tamano` en la fauna) |
| bono de daño | `atributo // 3` | `combatExchange.ts` |
| lesión | pleno 50 %, a GRAVE 15 %, a CONVALECIENTE 35 % | `lesiones.ts` (nuevo) |
| sangrado | 1 PV por ronda | `lesiones.ts` |
| descanso / medicina | hasta 75 % / hasta 100 % | `death.ts#healCeilingFor` |
| muerte en combate de fondo | 3 % del que cae (sin cambio) | `combateDeFondo.ts` |

## 4. Migración

### 4.1 Campos nuevos

| modelo | campos nuevos | notas |
|---|---|---|
| `Save` | `pv Int`, `aguante Int`, `lesiones Json @default("[]")` | `salud Int` pasa a ser el % de PV (hoy se deriva del tramo); `pvMax` no se guarda, se calcula de atributos y nivel |
| `Companion` | `pv Int?`, `lesiones Json @default("[]")` | `null` = lleno (como hoy la fila perezosa) |
| `NpcState` | `pv Int?`, `lesiones Json @default("[]")` | ídem; `condicionFisicaSinceMinutes` sigue igual |
| `Subject` | `condicionFisica CondicionFisica @default(ILESO)`, `pv Int?`, `lesiones Json` | **hoy no tiene salud**: hace falta para que los súbditos vuelvan heridos |
| combatientes de grupo (`condicionFisicaGrupo`) | `pvGrupo Int?` | mismo criterio de columna separada |
| catálogo: objetos | `dadoDano` (`"1d8"`) en armas | por `tipoArma` si no lo trae |
| catálogo: fauna | `tamano` (diminuta…enorme) | hoy solo existe `FAUNA_DIMINUTA` |

Partidas existentes: `pv = pvMax × saludForCondicion(condicionFisica) / 100`, que deja a cada uno en
su mismo tramo. `aguante` = máximo; `lesiones` vacía.

**`condicionFisica` se sigue guardando**, derivada de los PV en cada escritura por una sola función
(`fijarPv`). Así los **~60 archivos del backend y ~20 del frontend que la leen no cambian**: energía,
caza, recolección, Cronista (`ganadoReino`, `aprobacion`, `memoriaNarrador`, `leyendas`, `linajes`…),
narrador, `npcScene`, `turnLootKill`, `zonaPosicion`, `viajeros`, `dailyTick`, `worldTick`, las rutas
de `saves/*` (paneles, sugerencias, zona, compañeros, misiones…) y el frontend, que solo pinta el
tramo. Solo cambian los que **escriben** salud.

### 4.2 Funciones que cambian

**`backend/src/services/death.ts`**
- `nextCondicionForAttack` → `aplicarDano(pv, aguante, dano)`: devuelve PV, aguante y tramo nuevos.
  `oneStepWorseThan` queda solo para usos que no son daño (si los hay).
- `saludForCondicion` → `% de PV`; `saludBandFor` sin cambios (lee el tramo).
- `healCeilingFor` / `applySequentialHeals` → topes en %: descanso 75 %, objeto `curaHasta` = el %
  de ese tramo (ILESO 100, HERIDO 75, GRAVE 50), `curaUnPaso` = +25 % como mucho.
- `npcRecoversFromConvaleciente` (6 h) → los NPC suben a 75 % al cumplirse; la medicina sigue
  siendo la única vía al 100 %.
- Nuevas: `pvMaximo`, `aguanteMaximo`, `tramoPorPv`, `fijarPv`.
- Sin cambios: `condicionMalus`, `limiteMuertes`, `resolveDeathOutcome`, `CONDICIONES_INTERACTUABLE`.

**`backend/src/services/combatExchange.ts`**
- `rollAttributeCheck` sigue igual para el atacante; el defensor deja de tirar: `resolveExchange`
  compara contra `defensa(participante)`.
- `outcomeForMargin` añade el 20 y el 1 naturales.
- Nueva `tirarDano(arma | fauna, atributo, pleno)`. `conGolpeDeGracia` igual.
- `rollInitiative`, `resolveIndependentExchange` (utilidades) sin cambios.

**Otros**
- `combateMultiple.ts`: aplicar golpe = `aplicarDano`; `elegirObjetivo` «más herido» pasa a % de PV.
- `combateMultipleOrquestacion.ts#topeDeRondaJugadora`: tope a 1 PV en vez de a CONVALECIENTE.
- `combateDeFondo.ts`: mismo motor; guarda PV y lesiones de los que vuelven.
- `partidasCaza.ts#aplicarBajas`: guarda PV y lesiones también de súbditos.
- `energy.ts` / descanso: rellena PV hasta 75 %.

## 5. Resultados de la simulación

```
python3 tools/prototipos/vida-y-tiradas/simular.py                          # tablas de abajo
python3 tools/prototipos/vida-y-tiradas/simular.py --presa gargantua-de-ceniza
python3 tools/prototipos/vida-y-tiradas/simular.py --cifra aguante_div=2 -n 5000 --semilla 7
```

Semilla 21, 1.000 combates por fila. Simplificaciones: sin rueda de tipos, sin habilidades ni
moral, todo es Ataque básico. Jugadora de nivel 1 con Fu 11, De 11, Co 10.

**Duelo contra un rival de 10 en todo con espada corta**

| arma | armadura | rondas hoy | % gana hoy | rondas nuevo | % gana nuevo |
|---|---|---|---|---|---|
| daga | sin | 3,4 | 74,0 | 3,2 | 66,2 |
| daga | cota +2 | 3,3 | 78,9 | 3,1 | 75,7 |
| espada | sin | 3,5 | 59,2 | 2,8 | 65,2 |
| espada | cota +2 | 3,4 | 72,1 | 2,7 | 76,8 |
| hacha | sin | 3,5 | 61,9 | 2,5 | 71,0 |
| hacha | cota +2 | 3,4 | 70,0 | 2,5 | 76,1 |

**Jugadora de nivel 1 (espada, sin armadura) contra fauna**

| fauna | ficha | rondas hoy | % gana hoy | % salud final hoy | rondas nuevo | % gana nuevo | % PV final | % con lesión | PV+aguante |
|---|---|---|---|---|---|---|---|---|---|
| débil | zense-ceniza | 3,4 | 74,5 | 67,0 | 1,8 | 96,9 | 88,9 | 5,3 | 9+1 |
| media | guchapo | 3,5 | 64,0 | 59,7 | 2,7 | 64,6 | 56,6 | 18,3 | 26+3 |
| fuerte | rondador-de-brasas | 3,4 | 49,0 | 50,0 | 2,8 | 51,3 | 44,5 | 26,1 | 21+2 |
| muy fuerte | gargantua-de-ceniza | 3,1 | 8,9 | 29,2 | 1,6 | 0,2 | 7,5 | 42,6 | 82+5 |

**3 cazadores orcos (nivel 3, lanza corta de caza) contra una bestia, combate de fondo sin moral**

| presa | sistema | rondas | % cazan | % ilesos | % heridos/graves | % caídos | % muertos | % con lesión |
|---|---|---|---|---|---|---|---|---|
| cornante | hoy | 2,0 | 99,8 | 73,4 | 25,6 | 0,9 | 0,1 | — |
| cornante | nuevo | 1,7 | 100,0 | 89,7 | 10,0 | 0,3 | 0,0 | 0,9 |
| rondador | hoy | 1,9 | 99,9 | 74,3 | 24,6 | 1,0 | 0,1 | — |
| rondador | nuevo | 1,4 | 100,0 | 98,0 | 2,0 | 0,0 | 0,0 | 0,8 |
| gargantúa | hoy | 3,3 | 86,8 | 35,6 | 42,6 | 21,1 | 0,7 | — |
| gargantúa | nuevo | 3,6 | 92,8 | 46,3 | 31,2 | 21,3 | 1,2 | 13,4 |

**Lectura y ajustes que salieron de aquí**

- El arma ya importa: sin armadura, hacha 71 %, daga 66 %, espada 65 % (la daga se sostiene
  porque ataca y hiere con Destreza), y los combates se acortan de 3,5 a 2,5-3,2 rondas. La cota +2 suma entre 5 y 12 puntos de victoria según el arma (hacha +5, daga +9,5, espada
  +11,6; hoy, +5 a +13). El 1 natural como contragolpe automático no mueve ninguna cifra con estas
  fichas: con bono +5/+6 contra Defensa ≥ 12, un 1 nunca llega a margen ≥ 0.
- La fauna se ordena sola: el zense deja de ser un riesgo (97 %), el gargantúa pasa a imposible a
  nivel 1 (0,2 %, hoy 9 %) y las peleas duras dejan lesión 1 de cada 4.
- La caza fácil es **más segura** que hoy (10 % de cazadores heridos frente a 26 %) y la dura igual
  de peligrosa pero con lesiones. Se probó: aguante `Con//2` (4 % heridos contra cornante, muy
  seguro) → `Con//4`; bono de daño `//4` → `//3`; fauna grande 1d8 → 2d6 y enorme 2d8 → 2d10; y la
  regla de daño masivo (muertos contra gargantúa 10,5 % → 1,2 %). Lo que queda abierto está en § 7.

## 6. Propuesta → juego de referencia

| propuesta | de dónde sale |
|---|---|
| PV reales; tramo por % | X4 (casco en %), BG3 (PV), 5e «Bloodied» al 50 % |
| PV de fauna por tamaño y nivel | 5e (bloques de monstruo: dado de golpe por tamaño) |
| aguante que se rellena al acabar | X4 (escudo que regenera, casco que no) |
| descanso al 75 %, medicina al 100 % | X4 (reparar casco en astillero), Medieval Dynasty (comer y dormir), BG3 (descanso corto/largo) |
| lesiones por golpe pleno o tramo | X4 (subsistemas: motores, armas), Bellwright (heridas), Medieval Dynasty |
| súbditos y cazadores vuelven heridos y se curan en el pueblo | Manor Lords, Bellwright |
| d20 + bono contra Defensa; defenderse | 5e (CA, Esquivar), BG3 |
| dados por arma; finesse de la daga | 5e, BG3 |
| crítico con 20 / dobla dados; pifia con 1 | 5e, BG3 |
| daño masivo para morir a 0 PV | 5e (muerte instantánea por daño masivo) |
| habilidades con cifras | BG3, 5e |
| combate de fondo con el mismo motor y heridas que quedan | X4 (simulación fuera del sector), ADR 0002 |

## 7. Riesgos

- **Pasar de tirada enfrentada a Defensa fija** cambia la sensación del combate (el defensor ya no
  «para» con su tirada) y deja a medias la rueda de tipos, que hoy multiplica la tirada del que gana.
- **Equilibrio que hoy no existe:** arma, armadura y tamaño pesan de verdad; los encuentros
  generados (`encuentros`, asaltos, misiones) pueden volverse injustos. El gargantúa ya es imposible
  a nivel 1: las misiones que lo sacan necesitan nivel o aviso.
- **Nombre:** el efecto de habilidad `AGUANTE` («te defiende de un ataque») choca con la capa de
  aguante.
- **Partidas guardadas:** la conversión por tramo es exacta, pero `salud` cambia de significado y
  cualquier lector que la trate como derivada del tramo verá números nuevos (p. ej. 63 %).
- **Narrador:** si se le filtra el número de PV, narrará cifras; hay que mantener solo el tramo y la
  lesión.
- **Coste de migración:** `Subject` sin salud y `condicionFisicaGrupo` en grupos son dos sitios más
  que tocar de los que el diseño original no hablaba.
- **Descanso:** la decisión del 2026-09-06 (hallazgo 11) quitó que descansar curase; este diseño lo
  devuelve hasta el 75 %.

## 8. Plan de pasos pequeños (cada uno con su test)

1. **Funciones puras** en `death.ts`: `pvMaximo`, `aguanteMaximo`, `tramoPorPv`, `aplicarDano`
   (con aguante, daño masivo y tope de ronda). *Test:* `death.test.ts` con los casos de la tabla de
   § 3 (20 PV a nivel 1 Con 10; 15 PV → HERIDO; 1 PV → CONVALECIENTE; sobrante 50 % → MUERTO).
2. **Esquema y migración**: campos de § 4.1 y conversión por tramo. *Test:* migración sobre una
   partida de cada tramo deja el mismo `condicionFisica`; `auditSave` sin diferencias.
3. **`fijarPv` como único escritor** de salud en Save/NpcState/Companion. *Test:* integración que
   recibe un golpe y comprueba `pv`, `salud` y `condicionFisica` coherentes.
4. **Catálogo:** `dadoDano` en armas y `tamano` en fauna, con valor por defecto. *Test:* validación
   del catálogo (toda arma tiene dado, toda fauna tamaño).
5. **Tiradas:** Defensa, 20/1 naturales y `tirarDano` en `combatExchange.ts`. *Test:*
   `combatExchange.test.ts` con `random` fijo (20 natural = pleno, 1 = contragolpe, dobla dados).
6. **Combate en vivo** (`combateMultiple`, `topeDeRondaJugadora`) y efectos de habilidades con
   cifras. *Test:* `combateMultiple.test.ts` y `combateMultipleOrquestacion.test.ts`; partida de
   prueba contra un zense y un rondador.
7. **Lesiones** (`lesiones.ts`): tirada, efectos y curación. *Test:* unitario por tipo; sangrado no
   baja de 1.
8. **Curación y descanso** (`healCeilingFor` a %, descanso al 75 %, NPC a las 6 h). *Test:*
   `death.test.ts` y `descansoEnfriamiento.test.ts`.
9. **Combate de fondo y caza** con el mismo motor; súbditos con PV y lesiones. *Test:*
   `combateDeFondo.test.ts` y `partidasCaza.integration.test.ts` (los cazadores vuelven con PV < máx.).
10. **Interfaz y Narrador:** barra de PV y lesiones en la ficha; el Narrador sigue recibiendo solo
    tramo y lesión. *Test:* test del bloque de contexto (sin cifras de PV) y prueba de juego.

Cada paso se juega antes de cerrarlo (regla de `CLAUDE.md` al volver al roadmap).
