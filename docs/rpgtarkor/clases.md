# Helek Sirik — Clases de combate y especializaciones

[← Volver al índice del mundo](../07-mundo-helek-sirik.md)

*Diseño de clases (2026-08-23, sesión conjunta autora/Claude): 9 clases de combate, cada una con
2-4 especializaciones elegidas a nivel 10, más las 7 escuelas de Magia y las 12 ramas de Poder de
Semilla como los dos caminos de la clase Mago, y el sistema de armas a una/dos manos + escudo.
Documento en curso — algunas especializaciones tienen ya identidad y ejemplos de habilidad
concretos, otras solo nombre.*

**APLICADO al motor (2026-08-24, Grupo 3 § Sistema de clases)** — primera pasada, solo Guerrero/
Cazador/Chamán (lo único repasado a fondo en ese momento): `Npc.clase`/`Npc.especializacion`/
`Save.clase`/`Save.especializacion` pasan a ser enums reales (antes `clase` era texto libre);
`classAbilities.ts` reescrito con tronco común + especializaciones reales para esas 3 clases — solo
los huecos marcados "✅ lista" en este documento Y verificados efecto a efecto contra el motor real
(algunas filas de Convocador/Opresor estaban mal marcadas en el propio doc, corregido en el código,
no aquí). Nuevo: enum `AbilityEffect.CONVERSION` (se resuelve entero por `preferredAttribute`, sin
infraestructura de duración) y `StartingAbility.attributeBonus`/`SavedAction.attributeBonus` (el
"bonus de atributo fijo" de "Habilidad de daño vs ataque básico" — pieza que tampoco existía,
construida en la misma pasada). Restricción de armas por clase (`WeaponCategory.VARA` nuevo,
`weaponPoolFor` en weaponAbilities.ts) aplicada de verdad al equipar, solo para estas 3 clases (el
resto sigue sin pool diseñado — ver § Restricción de armas por clase, más abajo, sin cambios).

**SEGUNDA PASADA, mismo día — el resto de clases ("aplícalo ya todo y ya lo cambiaremos en el
futuro si hago cambios en las clases")**: con las 9 clases ya cerradas de diseño (ver § Fase de
diseño cerrada, más abajo), se aplicaron también Arquero/Caballero/Segador/Asesino/Druida —
`classAbilities.ts` pasa de 33 a **136 huecos reales**, las 8 clases con tabla (MAGO se queda sin
tocar, sigue siendo solo identidad narrativa sin tronco ni tabla de niveles). Mismo criterio de
verificación efecto a efecto que la primera pasada: Maestro Arquero/Maestro Ballestero pasan de
"7/8" en este documento a **1/8 real** cada uno (el resto de filas usa DEBILIDAD/AUMENTO/CONTRA/
MULTIPLE pese a estar marcadas "✅" aquí) — mismo tipo de error que ya se había encontrado en
Convocador/Opresor. El resto de clases sí coincide con el recuento que da este documento. La
Enciclopedia (`buildClassesSection`, `routes/world.ts`) muestra ya las 8 clases construidas.
Domador/Totémico (dentro de Cazador/Chamán) y Aullador (Druida, misma familia de bloqueo) se
quedan como especialización válida casi sin ninguna habilidad real — dependen por completo de
`INVOCACION`/`COMPANERO`, combate multi-objetivo sin construir.

Los 15 NPC humanoides del catálogo tienen clase/especialización asignada — ver
`tarkor_sistema_clases_aplicado_2026-08-24` en la memoria del proyecto para el detalle completo.
**Pendiente de tu lado**: aplicar las migraciones nuevas contra tu Postgres real + `npm run
seed-catalog` para que las clases/especializaciones de los NPC lleguen a tu mundo ya sembrado.

*Todas las menciones de "combate multi-objetivo"/`MULTIPLE`/`INVOCACION`/`COMPANERO`/`CONTROL`/
`EXPULSAR` como bloqueadas en este documento se refieren a la misma pieza de infraestructura,
diseñada en [combate-multiple.md](combate-multiple.md) — varios aliados contra varios enemigos,
con iniciativa individual y tope de 4 vs. 4.*

---

## Cómo funciona el sistema

- **Nivel 1-10 — tronco común**: cada clase tiene un puñado de habilidades genéricas que CUALQUIER
  personaje de esa clase aprende, elija luego la especialización que elija.
- **Nivel 10 — se elige especialización**: a partir de aquí, las habilidades nuevas son propias de
  la rama elegida — dos Guerreros de nivel 20, uno Berserker y otro Guardián, ya no se parecen en
  combate más allá del tronco común que comparten.
- **Clases exclusivas por raza**: Chamán (orcos), Caballero (Goirntes), Segador (Nabieus) y Druida
  (Faerus) — las 4 únicas razas jugables en código hoy. Kelife, Kalisar, Jusaly e Ilvenar se
  quedan sin clase única a propósito por ahora — no son jugables todavía, no hace falta diseñarles
  clase hasta que se aborde esa raza en sí.

---

## Las 9 clases

| Clase | Exclusiva de | Especializaciones |
|---|---|---|
| **Guerrero** | — | Berserker · Guardián · Lancero · Especialista |
| **Cazador** | — | Domador · Supervivencia · Tirador · Instintivo |
| **Chamán** | Orcos | Totémico · Rúnico · Convocador · Opresor |
| **Arquero** | — | Maestro Arquero · Maestro Ballestero |
| **Caballero** | Goirntes | Caballero del Orden · Caballero del Valor · Caballero del Dolor |
| **Mago** | — | Poder Magia (7 escuelas) · Poder Semilla (12 ramas) — ver secciones propias abajo |
| **Segador** | Nabieus | Parca · Maldito · Ilustrado · Transmutador |
| **Asesino** | — | Maestro Asesino · Asesino Tóxico · Asesino Danzante · Asesino Selecto |
| **Druida** | Faerus | Cambiaformas · Aullador · Salvaje · Adaptado |

Solo Guerrero se ha repasado a fondo hasta ahora (ver su sección propia, abajo) — el resto tiene la
identidad que sigue, sin el mismo nivel de detalle todavía.

### Guerrero — resumen de identidad de cada especialización
- **Berserker**: gritos ofensivos/sobre uno mismo — miedo al rival, rabia propia, debuffs de
  combate. Daño mayoritariamente de fuerza y carisma. Utilidad = buffs pasivos para sí mismo, no
  para el grupo.
- **Guardián**: el tanque social — gritos de APOYO (buffs a aliados), consigue o redirige agro. Poco
  ataque propio.
- **Lancero**: ataque repartido entre voluntad y destreza, pocos gritos, utilidad centrada en
  inmovilizar/aturdir al rival.
- **Especialista**: habilidades de todos los atributos, individualmente más flojas que las otras 3
  ramas pero muy variadas — el generalista de la clase.

*(Ver § Guerrero — repaso a fondo, abajo, para el detalle real con tronco común y estado de cada
especialización frente al motor.)*

### Cazador
- **Domador**: controlar bestias, añadir buffs — mucha utilidad.
- **Supervivencia**: daño con efectos inmovilizadores/aturdidores, veneno, recuperación de energía
  fácil.
- **Tirador**: daño a distancia + utilidad de análisis del rival, no fallar el tiro, inmovilizar a
  rango.
- **Instintivo**: daño de destreza cuerpo a cuerpo, esquivar/atacar rápido — el campeón en
  iniciativa de la clase.

### Chamán (exclusiva de orcos)
- **Totémico**: invoca tótems con efectos positivos/negativos en área, algunos ataques mágicos a
  través de ellos.
- **Rúnico**: buffar/debilitar a un enemigo concreto o a uno mismo, gran rango de utilidad.
- **Convocador**: daño y defensa — invoca elementos sobre su propio equipo para dar efectos extra,
  el "guerrero-mago" de la clase.
- **Opresor**: subyugar, debilitar o desorientar al rival — muy centrado en utilidad y defensa.

### Arquero
- **Maestro Arquero**: daño con arco, centrado en destreza — el equivalente al Guerrero pero con
  arco y sin gritos.
- **Maestro Ballestero**: lo mismo, con ballesta.

### Caballero (exclusiva de Goirntes)
- **Caballero del Orden**: el tanque de los caballeros, escala fuerte por constitución.
- **Caballero del Valor**: utilidad y daño — para ataques dirigidos a otros o provoca para dirigir
  el agro a su gusto, además de limpiarse efectos adversos.
- **Caballero del Dolor**: daño que escala por constitución — cuanto más resistente, más fuerte.

### Segador (exclusiva de Nabieus)
- **Parca**: succión de vida, remates y debilidades — cuanto más dañado está el objetivo, más
  fuerte golpea.
- **Maldito**: debilidades, succión de energía y aturdimientos.
- **Ilustrado**: el segador "erudito" — lee el destino/las probabilidades, ventaja de información y
  control sutil más que daño bruto.
- **Transmutador**: convierte y refleja efectos — convierte debilidades en buffs y viceversa.

### Asesino
- **Maestro Asesino**: el generalista — golpes de precisión, crítico puro, el "todoterreno" de la
  clase.
- **Asesino Tóxico**: veneno — daño sostenido y debilidades que se acumulan con el tiempo.
- **Asesino Danzante**: movilidad y fluidez — esquiva constante, encadena golpes, combate ágil más
  que sigiloso.
- **Asesino Selecto**: marca a un objetivo concreto y se especializa contra él — bonificaciones/
  ejecución centradas en un rival marcado.

### Druida (exclusiva de Faerus)
- **Cambiaformas**: se transforma en formas animales distintas para adaptar su estilo de combate.
- **Aullador**: vínculo de manada — aúlla para coordinar/potenciar, cercano en espíritu a Domador de
  Cazador pero desde la naturaleza, no el adiestramiento.
- **Salvaje**: daño bruto feral — garras y colmillos, agresividad pura.
- **Adaptado**: versátil — se adapta al entorno o al rival, más equilibrado entre daño/defensa/
  utilidad que las otras 3.

---

## Atributo Magia (decisión 2026-08-23 — documentado, sin aplicar todavía)

El atributo primario que hoy se llama `arcano` en el motor pasa a llamarse **Magia** — no es solo
un cambio de nombre por claridad ("arcano" es jerga de manual, "magia" se entiende solo), también
resuelve una pregunta real: ¿debería la magia escalar con Inteligencia en vez de tener su propio
atributo? Se descartó — si Magia reutilizara Inteligencia, cualquier habilidad de Inteligencia de
una clase no mágica (ej. Lectura de Combate, de Especialista) se leería como "tiene algo de
magia" sin tenerlo. Magia se queda como atributo propio, dedicado, separado de Inteligencia.

**Un solo atributo Magia cubre las dos cosas — Poder Magia Y Poder de Semilla, la misma tirada
para ambas.** No es una simplificación forzada: ya estaba en genesis.md desde antes de esta sesión
que Tarkor, previo a su caída, "dominaba todas las artes de creación, era capaz de replicar en
menor medida todos los poderes de sus hermanas" — la magia que trae de vuelta no sustituye ese
dominio sobre el poder de las Semillas, lo hereda y lo deforma. Poder Magia (canalizarlo crudo,
derivado de todas) y Poder de Semilla (canalizarlo a través del dominio concreto de una Semilla)
son dos expresiones del mismo origen, no dos poderes distintos que necesiten atributos separados.

**Consecuencia de limpieza**: los dos atributos SECUNDARIOS `magia` y `poderSemilla`
(`secondaryAttributes.ts`, hoy puramente narrativos/de umbral) quedan redundantes y se retiran —
todo lo que medían pasa a vivir en el atributo primario Magia.

**Nota de nombres, para no confundir capas**: "Magia" es el ATRIBUTO que powers cualquier tirada
mágica; "Arcano" sigue existiendo como nombre de UNA escuela concreta dentro de Poder Magia (ver
abajo) — la más pura/sin sabor de las 7, no toda la magia. Un Mago Arcano tira con el atributo
Magia, igual que un Mago Purificador o un Mago Remodelador.

**Estado**: decisión cerrada, documentada aquí — **no aplicada al motor todavía** (`arcano` sigue
viviendo tal cual en `backend/src/services/dice.ts`/`secondaryAttributes.ts`, tu partida guardada
sigue usando ese nombre). Se aplicará cuando se construya la clase Mago de verdad, con su propia
migración.

## Mago — Poder Magia (7 escuelas)

Las 7 ramas en las que se divide la magia de Tarkor (ver
[genesis.md § Las 7 ramas de la magia de Tarkor](genesis.md#era-0--el-génesis)) — hoy solo
`arcano` existe como atributo jugable real en el motor (pendiente de renombrarse a Magia, ver
sección de arriba), las otras 6 escuelas son diseño narrativo sin mecánica propia todavía (ver
[07-mundo-helek-sirik.md § Contrato de mundo](../07-mundo-helek-sirik.md)).

- **Mago Arcano** — Daño puro, la cara más agresiva de las 7: fuerza destructiva sin filtrar por
  ningún elemento ni intención concreta.
- **Mago Salvaje** — Mutar y potenciar sin control — la misma rama que parió a los Orcos.
  Habilidades que hacen crecer, enloquecer o transformar algo (incluido el propio jugador o un
  aliado) más allá de su naturaleza normal, con riesgo real de que el efecto se descontrole.
- **Mago Elemental** — Daño y utilidad desde los 4 elementos libres (no se especializa en uno
  solo) — el generalista de Poder Magia, mismo rol que el Especialista dentro de Guerrero.
- **Mago Oscuro** — Invocar y debilitar. Tercera clase con invocaciones del documento (junto a
  Mago Brote/Mago Feral, ver Poder Semilla) — aquí las invocaciones deberían ser más agresivas/
  amenazantes que las de Brote/Feral (algo no-vivo, arrancado de la propia oscuridad). El
  "debilitar" engancha directo con el efecto `DEBILIDAD` del motor.
- **Mago Purificador** — Limpiar, curar o desorientar — no es solo el sanador pasivo, también
  golpea con luz cegadora.
- **Mago Naturaleza** — Utilidad, controla la vida a su propósito. Diferencia con Mago Brote
  (Poder Semilla, Florial): Naturaleza MUTA y usa la vida que YA hay alrededor (enredar al
  enemigo, animar la maleza existente); Brote CREA la suya propia (invocación).
- **Mago Dominio** — Controla rivales, juega con su mente — el "mago mental": aturdir, confundir,
  invertir intenciones. Comparte terreno con Mago Sentencia (Poder Semilla, Tharlia) y con Chamán
  Opresor — pendiente de diferenciarlas bien cuando lleguen las habilidades concretas de cada una.

---

## Mago — Poder Semilla (12 ramas)

Una clase por cada una de las 13 Semillas — Tarkor queda excluida (no tiene poder de semilla
propio, el suyo se transformó en la magia de arriba). Los 3 nombres de las Semillas Perdidas antes
sin nombre (Nemuey/Biur/Crout) se fijaron en esta misma sesión — ver
[genesis.md § Las 13 Semillas](genesis.md#era-0--el-génesis). Tira con el mismo atributo Magia que
Poder Magia (ver § Atributo Magia arriba) — no tiene un atributo propio separado.

**6 Fieles:**
- **Mago Remodelador** (Liania) — Transformar la materia: convertir un elemento en otro, alterar
  la composición de objetos o del propio cuerpo. La más "alquimista", variada entre daño y
  utilidad según qué transformes.
- **Mago Umbral** (Sezix) — Muerte y vacío: drenar vida, sellar heridas cerrándolas para siempre
  (ni cura ni daño, "termina" el proceso), ver/tocar lo que hay al otro lado.
- **Mago Sentencia** (Tharlia) — Juicio y orden del destino: marcar un objetivo para que su
  próximo golpe cuente doble, invertir el orden de quién actúa primero, "grabar" un efecto para
  que se repita.
- **Mago Ilusor** (Kroj) — Noche y sigilo: ocultar, confundir, atacar sin ser visto/oído — el
  silencio como arma, no solo como escondite.
- **Mago Orden** (Goirme) — Impone posición: inmovilizar, forzar a un enemigo a quedarse donde
  está, reordenar el campo de batalla a favor propio.
- **Mago Deformador** (Lerox) — La más caótica e impredecible de las 6 — su dominio es un misterio
  incluso para las otras Semillas, así que sus habilidades deberían tener un componente real de
  azar/efecto variable, no solo sabor narrativo.

**3 Neutrales:**
- **Mago Brote** (Florial, "El que Brota") — Crecimiento lento pero imparable: curación sostenida
  en el tiempo, raíces que atrapan, buffs que se acumulan turno a turno. Invoca vida vegetal
  propia que mejora por nivel (varias habilidades de invocación distintas desbloqueadas en niveles
  separados — no una que evoluciona sola): una zarza que enreda al principio, un guardián de
  raíces y savia a niveles altos.
- **Mago Feral** (Ferios, "El que Nace") — Instinto y caza: buffs de agresividad, ataques que se
  benefician de golpear primero o por sorpresa. Invoca una cría/instinto de fauna que mejora por
  nivel igual que Brote — de un pequeño depredador que distrae, a una bestia de caza real.
- **Mago Conservador** (Berd) — Domina brevemente el tiempo: ralentiza, congela un instante,
  "guarda" un turno para usarlo después. Análisis en área notable (lee a varios rivales a la vez)
  y buffs de intelecto altos — la mente como su verdadera arma.

**3 Perdidas** (nombradas en esta sesión — dominio/personalidad más allá de lo que sigue, pendiente
de desarrollar):
- **Mago Nigromante** (Nemuey) — Muerte convertida en arma, no en cierre como Sezix/Umbral:
  levantar/usar lo ya caído a tu favor.
- **Mago Vacío** (Biur) — El más afable de las 3, pero el poder más destructivo de todos: no daña
  la materia, la borra de la existencia por completo — "el barrendero". Habilidades que hacen
  desaparecer escudos, armas, partes del propio campo de batalla — nada que transformar (a
  diferencia de Mago Remodelador), simplemente deja de estar.
- **Mago Irruptor** (Crout) — Romper reglas: ignorar defensa, colarse a través de un escudo/
  inmunidad — la más agresiva y menos "limpia" de las 3.

*(Nota de infraestructura, aparte del contenido: Brote y Feral necesitan un primitivo mecánico
nuevo — "invocación que persiste en la escena y actúa por su cuenta turno a turno" — que hoy no
existe en el motor. Cuando se construya, probablemente sirva también para las invocaciones de
Chamán Totémico y Mago Oscuro.)*

---

## Armas a una mano / dos manos / escudo

**Diseño cerrado.** Cada mano equipada da su propia habilidad — nunca es "accesorio pasivo puro":

- **Arma + arma** (dual-wield, cualquier combinación, iguales o distintas) → **2 habilidades**
  ofensivas, cada una con su bonus normal.
- **Arma + escudo** → **1 habilidad ofensiva** (bonus normal) + **1 habilidad defensiva de
  constitución** (ej. "Muro Irrompible": usa el escudo para parar un ataque, +3 constitución al
  usarla).
- **Arma a dos manos** (o lanza/pica, que siempre van a dos manos) → solo **1 habilidad** posible
  (ocupa las dos manos), pero esa habilidad recibe **+1 de atributo fijo** respecto a lo que daría
  la misma habilidad a una mano — compensa tener solo 1 en vez de 2.

El número de bonus de cada habilidad **no depende del arma**, depende de la propia habilidad y
cuánta energía exige según su nivel/tier (ver siguiente sección) — el +1 de dos manos es un
modificador sobre ese número base, no una tabla aparte.

**Sorpresa al revisar el código (2026-08-23): gran parte de esto ya existe y funciona**, en
`backend/src/services/weaponAbilities.ts`:
- `ESCUDO` ya tiene atributo `constitucion` fijo.
- `weaponRoleFor` ya distingue ataque/defensa exactamente así — escudo es la única categoría que
  da habilidad de "defensa".
- Dos armas de categorías distintas (hacha + daga) ya dan 2 tarjetas de habilidad separadas.
- Dos armas de la MISMA categoría (hacha + hacha) colapsan a 1 tarjeta, pero con una reducción de
  dificultad de tirada (`DUAL_WIELD_DIFFICULTY_BONUS = 3`) en vez de duplicar el golpe — mecanismo
  ya cerrado, distinto de lo que se diseñó aquí pero ya resuelto y en uso.
- "Muro Inquebrantable" (escudo, tier avanzada) ya es prácticamente "Muro Irrompible" con otro
  nombre — el hueco/sabor ya existen.

**Lo que de verdad sigue faltando** (confirmado leyendo el código):
1. Ninguna `WeaponAbility` tiene hoy ningún campo de bonus de atributo — solo eligen qué atributo
   tira, el bonus fijo (la idea central de más abajo) no existe todavía.
2. `HACHA_1_MANO` y `HACHA_2_MANO` (y el resto de categorías con variante 2 manos) usan hoy el
   MISMO atributo sin ningún +1 de diferencia entre ellas.

---

## Habilidad de daño vs ataque básico

**El problema** (diagnóstico de la autora, confirmado leyendo el código): hoy una habilidad de
ataque como "Tajo Horizontal" no se diferencia mecánicamente de un Ataque Básico — el único cambio
real es qué atributo usa la tirada (fijado por la categoría de arma) y el multiplicador de la
rueda de debilidades. El "efecto" es idéntico salvo eso, así que no queda claro por qué una
habilidad debería costar más energía que golpear a secas.

**La solución**: cada habilidad de daño da un bonus de atributo fijo al usarla (ej. "Tajo
Horizontal" +2 de fuerza en ese ataque concreto) — el número no depende del arma, depende de la
propia habilidad y cuánta energía exige según su nivel/tier. Esto la hace mecánicamente mejor que
un Ataque Básico de verdad, y da una razón real al coste de energía más alto. Se combina con el
+1 de arma a dos manos (arriba): la versión a dos manos de una habilidad da el bonus base + 1; la
versión a una mano (repartida en 2 habilidades si hay dos armas) da el bonus base tal cual.

Falta añadir el campo de bonus a `WeaponAbility`/`StartingAbility` y aplicarlo en
`combatExchange.ts` — no hay ningún otro bloqueo de diseño, es la pieza concreta que falta
construir.

---

## Restricción de armas por clase (2026-08-24 — documentado, sin aplicar todavía)

**Objetivo** (petición explícita, "como en el WoW"): que cada clase/especialización solo pueda
equipar las categorías de arma que de verdad encajan con su identidad, no cualquier
`WeaponCategory` del catálogo. Alcance de esta pasada: **solo Guerrero, Cazador y Chamán** (las
clases con habilidades ya revisadas a fondo) — el resto de clases se documentará cuando les toque
su propio repaso. **Solo armas, no armadura**: hoy no existe ningún sistema de "peso de armadura"
(tela/cuero/malla/placa) en el motor — los `EquipSlot` de torso/piernas/etc. son solo ranuras, sin
material/tier — así que restringir armadura por clase sería una pieza de infraestructura nueva y
aparte, no cubierta aquí.

### Categoría de arma nueva: `VARA` (pendiente de dar de alta en `WeaponCategory`)

Bastón de combate cuerpo a cuerpo — el "bo" de las artes marciales, para Domador/Supervivencia.
**No confundir con `BACULO`/`BASTON`**, que ya existen en el motor y son focos **mágicos** (atributo
arcano/Magia, igual que `GRIMORIO`) — `VARA` es un arma física de golpear, sin nada de canalización
arcana. Atributo: **Voluntad** — hoy ninguna categoría de arma usa Voluntad (solo
fuerza/destreza/constitución/arcano existen en `WEAPON_CATEGORY_ATTRIBUTE`), así que esto también
abre el primer hueco de arma-Voluntad del motor.

### Guerrero — mismo pool para las 4 especializaciones

Cuerpo a cuerpo puro, nada de distancia ni de magia — coherente con "un Guerrero de verdad no tiene
magia, sin excepción" (ya establecido en Especialista, arriba):

`HACHA_1_MANO` · `HACHA_2_MANO` · `MAZA_1_MANO` · `MAZA_2_MANO` · `GARROTE_1_MANO` ·
`GARROTE_2_MANO` · `PICA` · `LANZA` · `CUCHILLO` · `DAGA` · `ESPADA_1_MANO` · `ESPADA_2_MANO` ·
`ESCUDO`

Berserker/Guardián/Lancero/Especialista comparten el mismo pool — lo que las diferencia es la
habilidad que usan, no qué pueden empuñar.

### Cazador — pool distinto por especialización

- **Tirador** — el único Cazador a distancia: `ARCO_CORTO` · `ARCO_LARGO` (solo arco, sin honda ni
  ballesta a propósito — esas dos se reservan para la futura clase Arquero, Maestro
  Arquero/Maestro Ballestero, para no solapar identidad entre clases).
- **Domador** y **Supervivencia** — ninguna de las dos usa distancia, mismo pool para ambas: `RED`
  (ya existe en el motor con flavor de "enredar antes que herir" — encaja con controlar bestias sin
  matar) · `HACHA_1_MANO` · `VARA` *(nueva, ver arriba)* · `CUCHILLO` · `DAGA` · `LANZA`.
- **Instintivo** — cuerpo a cuerpo puro, solo variantes de una mano (coherente con "esquivar/atacar
  rápido": un arma a dos manos te deja más expuesto): `ESPADA_1_MANO` · `HACHA_1_MANO` ·
  `MAZA_1_MANO` · `LANZA`.

### Chamán — mismo pool para las 4 especializaciones

Fuerza física de respaldo (hacha/maza, coherente con que los orcos "nunca fueron magos de estudio")
más los focos mágicos reales — hacha y maza limitadas a una mano, para dejar la otra libre para el
foco:

`MAZA_1_MANO` · `HACHA_1_MANO` · `BACULO` · `BASTON` · `ESCUDO` · `GRIMORIO`

---

## Armadura por clase — ligero/medio/pesado (2026-08-24, documentado — CONSTRUIDO 2026-08-31)

**Estado: aplicado.** Enum `PesoArmadura` + `ItemCatalog.pesoArmadura` (schema.prisma), función
pura `pesoArmaduraPermitidoFor(clase, especializacion)` (weaponAbilities.ts, mismo patrón que
`weaponPoolFor`) y guard real en `PATCH /saves/:id/inventario/:itemId` (mismo bloque que la
restricción de armas por clase, inventario.ts). Las 17 piezas de armadura real del catálogo
(worldCatalog.ts) clasificadas y sembradas en Postgres — donde el `statBonuses` no bastaba por sí
solo (empates, solo `defensa`, solo carisma), se usó el criterio de la descripción/lore de cada
pieza (p.ej. "armadura ligera" en el propio texto pesa más que el stat crudo). Verificado con
tests unitarios (`weaponAbilities.test.ts`) e integración del endpoint (`inventario.test.ts`).

**Objetivo**, mismo espíritu que la restricción de armas de arriba ("como en el WoW"): cada clase
solo puede equipar armadura de ciertos tramos de peso. A diferencia de las armas, esta pasada
**cubre las 9 clases de una vez** (petición explícita de la usuaria) — el diseño de habilidades
sigue en pausa donde se dejó (hasta Chamán Totémico), pero el peso de armadura es una
categorización más plana que no necesita ese mismo nivel de detalle previo.

**Qué hace falta construir** (nada de esto existe hoy): un enum nuevo `PesoArmadura` (`LIGERO` |
`MEDIO` | `PESADO`) y un campo `pesoArmadura: PesoArmadura?` en `ItemCatalog`, null salvo en
objetos `equipSlot` de armadura real. **`InventoryItem.statBonuses` NO hace falta tocarlo** — ya es
un mapa múltiple desde el 3 de agosto (`Partial<Record<Attribute | 'defensa', number>>`, sustituyó
al viejo bonus de un solo atributo), así que una pieza de armadura ya puede llevar bonus a varios
atributos a la vez con el sistema actual tal cual está.

### Ranuras que llevan peso

Solo las 6 de armadura real: `CASCO` · `ARMADURA_SUPERIOR` · `ARMADURA_INFERIOR` · `GUANTES` ·
`BOTAS` · `CINTURON`. `CAMISA` (ropa interior, no protección) y `ACCESORIO`/`ANILLO_1`/`ANILLO_2`
(joyería) se quedan fuera, sin restricción de peso — igual que en el WoW los anillos no tienen tipo
de armadura.

### Qué atributos da cada tramo

Cada pieza de armadura lleva su `statBonuses` con **como mínimo** los 2 atributos de su tramo (los
valores más altos del mapa), pudiendo añadir algún bonus extra menor a un tercer atributo distinto
por sabor de esa pieza en concreto — nunca al revés (un atributo de fuera del tramo no puede ser el
bonus principal):

- **Ligero** → **Magia** + **Inteligencia** — el caster puro de tela.
- **Medio** → **Destreza** + **Voluntad** — el explorador ágil/disciplinado.
- **Pesado** → **Fuerza** + **Constitución** — el tanque.

**Carisma queda fuera a propósito** — no depende del peso de armadura. Si algún día se le da un
vector mecánico propio, vivirá en accesorios/cosméticos (`ACCESORIO`, `ANILLO_1`/`ANILLO_2`,
`COSMETICO_*`), no en armadura por peso.

### Peso permitido por clase (las 9, borrador cerrado)

| Clase | Peso permitido | Por qué |
|---|---|---|
| **Guerrero** | Pesado + Medio | tanque/bruiser, coherente con su pool de armas cuerpo a cuerpo |
| **Cazador** | Medio | superviviente equilibrado, ni tan protegido como Guerrero ni tan ligero como Mago |
| **Chamán** | Medio + Pesado | orco físicamente fuerte aunque canalice magia vía tótem/runa |
| **Arquero** | Ligero + Medio | movilidad de tirador, nada de pesado |
| **Caballero** *(Goirntes)* | Pesado (+ Medio para Caballero del Valor, más ágil que Orden/Dolor) | el tanque de los caballeros |
| **Mago** | Ligero | el caster puro de tela, sin excepción |
| **Segador** *(Nabieus)* | Ligero + Medio | segador ágil, ni tanque ni mago puro |
| **Asesino** | Ligero | sigilo/agilidad, nunca pesado |
| **Druida** *(Faerus)* | Ligero + Medio | cambiaformas no puede ir cargado de metal |

Guerrero y Chamán ya tenían el mismo pool de armas para las 4 especializaciones cada uno — el peso
de armadura sigue el mismo criterio de clase, no de especialización (con la única excepción anotada
de Caballero del Valor, más flexible que sus 2 hermanas).

---

## Guerrero — repaso a fondo (única clase revisada hasta ahora)

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 4 | Instinto Guerrero *(renombrar)* | Inteligencia | `ANALISIS` | ✅ lista — analiza al rival |
| 8 | Golpe de Control | Fuerza | `ATAQUE` + `DEBILIDAD` | ⚠️ bloqueada (DEBILIDAD) — ataque que si impacta reduce la destreza del enemigo en 2. **Ojo**: esto sustituye a Contraataque, que SÍ está implementado y en uso hoy — hasta que DEBILIDAD exista, habría que decidir si Contraataque se queda como está o se reconstruye sin el debuff |
| 1 | **Firmeza Ferrea** *(nueva)* | Constitución | `AGUANTE` | ✅ lista — resistir un golpe por pura dureza física, sin depender de escudo — sustituye a Grito de Guerra, que pasa a Berserker |
| 6 | **Segundo Aliento** *(nueva)* | Voluntad | `RECUPERACION` | ✅ lista — recuperar energía en pleno combate — sustituye a Grito tenebroso, que pasa a Berserker |

`AGUANTE` y `RECUPERACION` ya son efectos reales e implementados en el motor (el segundo con
+15 de energía, `turnResolution.ts`) — ninguna de las dos nuevas necesita infraestructura extra.
*(Nombre "Piel Curtida" elegido a propósito distinto de "Aguante" — ese nombre ya lo usa el propio
efecto mecánico, para no confundir ability y effect.)*

### Ritmo de habilidades por especialización (decisión 2026-08-23)

El nivel 10 es solo "eliges camino" — la primera habilidad real de la especialización llega en el
siguiente nivel de ASI (ascenso de atributo, `progression.ts`), y así sucesivamente: **12, 16, 19,
24, 28, 32, 36, 40** (8 huecos), mismo ritmo que ya usan los puntos de atributo — no un calendario
aparte. Se aplica a las 4 especializaciones de Guerrero por igual.

### Berserker — completo (8 huecos)

Las 2 heredadas del tronco (Grito de Guerra/Grito tenebroso) se reasignan a los primeros huecos del
ritmo, con el resto relleno alrededor:

| Nivel | Habilidad | Atributo | Efecto | Rol | Estado |
|---|---|---|---|---|---|
| 12 | Grito de Guerra *(reasignada, antes tronco nv.1)* | Carisma | `INTIMIDACION` + `DEBILIDAD` | utilidad | ⚠️ bloqueada — `DEBILIDAD` ya está construido, pero solo en el camino de ATAQUE directo (margen decisivo ±10); esta fila es `rol: utilidad` (INTIMIDACION cancela el golpe, no ataca), y el camino de utilidad no aplica DEBILIDAD todavía |
| 16 | Grito tenebroso *(reasignada, antes tronco nv.6)* | Carisma | `DEBILIDAD` + `ATURDIMIENTO` | utilidad | ⚠️ bloqueada, mismo motivo que 12 — rol utilidad, DEBILIDAD solo funciona hoy en ataque directo |
| 19 | Última Resistencia | Constitucion | `AGUANTE`, solo si estás Convaleciente, aumenta + 10 la constitucion si estas convaleciente, sino solo + 2 | defensa | ✅ lista, sembrada en `classAbilities.ts` |
| 24 | Giro Salvaje | Fuerza | `ATAQUE` + `MULTIPLE` | ataque que se realiza sobre un enemigo , si la tirada tiene una diferencia de 6 afecta a tu objetivo y otro aleatorio, si mayor de 12 a tu objetivo y 2 aleatorios | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `MULTIPLE`+`ATAQUE` YA tiene motor real (mismo patrón que Punta Doble/Golpe Gemelo, un solo tramo simplificado) |
| 28 | Grito Desgarrador | Carisma | `CANALIZAR` + `ATURDIMIENTO` | utilidad si ganas la tirada aturde a todos los enemigos 1 turno | ⛔ `CANALIZAR` sigue sin ningún comportamiento real en el motor (solo enum) |
| 32 | Piel de Batalla | Constitución | `AGUANTE` + `CONTRA` | defensa, si tu tirada supea en 6 a la de cualquier enemigo que ataque, le devuelve el daño, si ganas por menos de 6 recibes el daño pero se genera un golpe mutuo | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `CONTRA` YA tiene motor real (mismo patrón que Vórtice Menor) |
| 36 | Instinto Berserker | Fuerza | `AUMENTO` + `RECUPERACION` + `PURIFICAR` + `LIMITADA` | utilidad | ⛔ `AUMENTO` a uno mismo desde una habilidad de rol utilidad (no ataque) sigue sin motor + `PURIFICAR` sin ningún comportamiento real |
| 40 | Golpe Devastador *(capstone)* | Fuerza | `CANALIZAR` + `ATAQUE` + `LETAL`| ataque | ⛔ `CANALIZAR` sigue sin ningún comportamiento real |

**1 de 8 huecos sembrado** (19). `DEBILIDAD`/`MULTIPLE`/`CONTRA` ya tienen motor real en el camino
de ATAQUE directo desde las Fases 2/3 (2026-08-26/27) — **24 y 32 son sembrables YA, sin tocar
motor**, solo falta darlas de alta en `classAbilities.ts` (mismo criterio de simplificación a un
único tramo que ya usan Punta Doble/Golpe Gemelo/Vórtice Menor). 12/16 (DEBILIDAD en rol utilidad)
y 36/40 (`CANALIZAR`/`PURIFICAR`, sin ningún motor) siguen bloqueadas de verdad.

### Guardián — completo (8 huecos)

"Conseguir o redirigir agro" no es solo un efecto pendiente (como `AUMENTO`), es un efecto que **no
existe en absoluto todavía** en `AbilityEffect`. Propuesta para darlo de alta: **`PROVOCACION`** —
"Fuerza al enemigo a centrar su atención/ataques en ti, redirigiendo el agro que tuviera sobre otro
objetivo." Los "gritos" de la idea original se sustituyeron por habilidades físicas de constitución
(nada de vocal/carisma en las puramente defensivas) — el liderazgo/agro que sí es carisma se queda
donde tenía sentido:

| Nivel | Habilidad | Atributo | Efecto | Rol | Estado |
|---|---|---|---|---|---|
| 12 | Muro de Batalla | Constitución | `AGUANTE` | defensa | ✅ lista, sembrada |
| 16 | Bastión Personal | Fuerza | `AGUANTE` + `PROVOCACION` | defensa | ⛔ `PROVOCACION` está en el enum (2026-08-31: no era cierto que faltara darlo de alta) pero sigue sin NINGÚN comportamiento real en el motor — el efecto inverso a OCULTACION/EXPULSAR (forzar inclusión/redirección de objetivo), sin construir |
| 19 | Desafío | Carisma | `PROVOCACION` *(nueva)* | utilidad | ⛔ mismo motivo que 16 |
| 24 | Golpe de Advertencia | Constitución | `ATURDIMIENTO` + `DEBILIDAD` | ataque | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `DEBILIDAD`+`ATAQUE`/`ATURDIMIENTO` de rol ataque YA tiene motor real (mismo tramo simplificado que Golpe Envenenado) |
| 28 | Embate de Escudo | Constitución | `ATAQUE` + `EXPULSAR `— escala por constitución, no fuerza | ataque | ✅ **lista, sembrada 2026-08-27 (Fase 3§3e)** — simplificada a un único margen/2 rondas, sin los 2 tramos 8/14 ni la tirada de 50% de volver |
| 32 | Valor Compartido | Carisma | `AUMENTO` + `MULTIPLE`| utilidad | ⛔ `AUMENTO` a ALIADOS (no a uno mismo) sigue sin motor — es el bloqueo real más grande que queda en Guerrero/Cazador/Chamán juntos, afecta a varias filas más |
| 36 | Postura Inquebrantable | Constitución | `AGUANTE` + `MULTIPLE` + | defensa | ⛔ mismo motivo que 32 — MULTIPLE aplicado a defender ALIADOS, no a atacar enemigos, es otro camino sin construir |
| 40 | Sacrificio del Guardián *(capstone)* | Constitución | `AGUANTE` + `CONTRA` + `LIMITADA` — Defiendes todos los ataques del combate a los que le ganes en valor de tirada y devuelve un ataque a todos aquellos a quien ganes en tirada, solo se puede usar 1 vez por combate | defensa | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `CONTRA`+`LIMITADA` YA tiene motor real (mismo patrón que Vórtice Menor); "todos los ataques del combate" (multi-objetivo real) es más de lo que el CONTRA actual cubre, revisar al sembrar |

**2 de 8 huecos sembrados** (12, 28). `DEBILIDAD`+ataque (24) y `CONTRA`+`LIMITADA` (40, con
matiz de alcance) son sembrables YA sin tocar motor. `PROVOCACION` (16/19) sigue en cero pese a
estar en el enum. `AUMENTO`/`MULTIPLE` a ALIADOS (32/36) son el mismo bloqueo real de fondo que
aparece repetido en varias clases — nunca se construyó el camino de "utilidad que buffa a otros",
solo "ataque que buffa/debilita a quien golpea o es golpeado".

### Lancero — 2 de 8 listas, no "completa" todavía

Mayoría voluntad/destreza, con fuerza y carisma metidos para que no sea solo esos dos atributos.
Corregidos dos typos de esta sección (`DEBLIDAD`→`DEBILIDAD`, `PROVACION`→`PROVOCACION`) y añadida
la columna Estado, que se había perdido al escribir esta tabla:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Estocada Calculada | Voluntad | `ATAQUE` + `AUMENTO` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `AUMENTO` a uno mismo desde ataque directo YA tiene motor real (mismo patrón que Golpe Runa de Cólera) |
| 16 | Barrido de Asta | Destreza | `ATURDIMIENTO` | ✅ lista, sembrada |
| 19 | Embestida de Asta | Fuerza | `ATAQUE` + `DEBILIDAD` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `DEBILIDAD`+ataque YA tiene motor real |
| 24 | Punta Doble | Destreza | `ATAQUE` + `MULTIPLE` | ✅ **lista, sembrada 2026-08-27 (Fase 3§3b)** — tramo único (diferencia 12), sin el tramo bajo (6→2 enemigos) de la ficha original |
| 28 | Empalizada | Carisma | `INTIMIDACION` + `DEBILIDAD` + `CONTRA` | ⛔ combina utilidad (INTIMIDACION) con DEBILIDAD+CONTRA — ninguno de los dos funciona todavía fuera del camino de ataque directo |
| 32 | Guardia de Asta | Constitucion | `AGUANTE` + `PROVOCACION` + `CONTRA` | ⛔ `PROVOCACION` sigue sin motor real (ver Guardián 16/19) |
| 36 | Zancada Perforante | Destreza | `ATAQUE` + `DEBILIDAD` + `MULTIPLE` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `DEBILIDAD`+`MULTIPLE` combinados YA tienen motor real (Fase 3§3a: MULTIPLE propaga el mismo ActiveEffect a los dos objetivos) |
| 40 | Lanza Certera *(capstone)* | Voluntad + Destreza | `ATAQUE` + `ATURDIMIENTO` + `LETAL` + `LIMITADA` | ✅ lista, sembrada |

**2 de 8 sembradas** (16, 24). `AUMENTO`+ataque (12), `DEBILIDAD`+ataque (19) y `DEBILIDAD`+
`MULTIPLE` combinados (36) son sembrables YA sin tocar motor — dejarían Lancero en 5/8 sin escribir
ninguna línea de motor nueva. 28 (INTIMIDACION+DEBILIDAD+CONTRA, mezcla utilidad con ataque) y 32
(`PROVOCACION`) siguen bloqueadas de verdad.

### Especialista — 4 de 8 listas

Variedad real, no solo de atributo — también de `rol` (`ataque`/`defensa`/`utilidad`, campo que ya
existe en el motor). Ningún hueco de Guerrero toca Magia, en ninguna especialización — ni siquiera
el generalista: un Guerrero de verdad no tiene magia, sin excepción. Los 8 huecos se reparten entre
los 6 atributos físicos/mentales (fuerza/destreza/constitución/inteligencia/voluntad/carisma),
constitución y destreza repetidas. Columna Estado añadida (se había perdido al escribir esta tabla):

| Nivel | Habilidad | Atributo | Efecto | Rol | Estado |
|---|---|---|---|---|---|
| 12 | Golpe Adaptado | Fuerza | `ATAQUE` | ataque | ✅ lista, sembrada |
| 16 | Golpe Calculado | Inteligencia | `ATAQUE` — golpe técnico, no de fuerza bruta | ataque | ✅ lista, sembrada |
| 19 | Golpe Desequilibrante | Destreza | `ATAQUE` + `ATURDIMIENTO` | ataque | ✅ lista, sembrada |
| 24 | Aliento de Batalla | Voluntad | `AGUANTE` + `RECUPERACION` | utilidad | ✅ lista, sembrada |
| 28 | Postura Firme | Constitución | `AGUANTE` + `PROVOCACION` + `CONTRA` | defensa | ⛔ `PROVOCACION` sigue sin motor real |
| 32 | Reflejos Entrenados | Destreza | `AGUANTE` + `AUMENTO` | defensa | ⚠️ bloqueada de verdad todavía — sin sembrar, pero **es sembrable YA**: confirmado leyendo el motor (turnResolution.ts, "CASO DEFENSA") que `AUMENTO` SÍ se aplica cuando el JUGADOR defiende con una habilidad de rol `defensa` (no solo cuando ataca), mismo mecanismo que ya usa Golpe Runa de Cólera en ataque |
| 36 | Grito Improvisado | Carisma | `INTIMIDACION` + `AUMENTO` + `MULTIPLE` | utilidad | ⛔ `AUMENTO`/`MULTIPLE` a ALIADOS desde una habilidad de rol utilidad — mismo bloqueo de fondo que Valor Compartido (Guardián 32) |
| 40 | Segunda Oportunidad *(capstone)* | Constitución | `RECUPERACION` + `CURAZION` + `LIMITADA` | utilidad | ⛔ `CURAZION` sigue sin ningún comportamiento real |

**4 de 8 sembradas** (12/16/19/24). **32 es sembrable YA** sin tocar motor (ver nota de la fila) —
dejaría Especialista en 5/8. 28 (`PROVOCACION`) y 36/40 (`AUMENTO` a aliados / `CURAZION`) siguen
bloqueadas de verdad. Reparto de rol si se siembra 32: 3 ataque / 2 defensa / 3 utilidad.

---

## Cazador — repaso a fondo

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Analisis Salvaje | Inteligencia | `ANALISIS` | ✅ lista — ya existe, se mantiene |
| 4 | Barrido Salvaje | Destreza | `ATURDIMIENTO` (reactiva, rol defensa) | ✅ lista — ya existe, se mantiene, aturde a el rival 1 turno |
| 6 | **Instinto de Supervivencia** *(nueva)* | Constitución | `AGUANTE` + `RECUPERACION` | ✅ lista — sustituye a Compañero cazador, que pasa a Domador, recupera 40 de energia |
| 8 | **Golpe Certero** *(nueva)* | Fuerza | `ATAQUE` | ✅ lista — realiza un ataque aumentando +3 de fuerza |

`Compañero cazador` (antes tronco nv.8, efecto `COMPANERO`) se reasigna a Domador — es un efecto
que hoy **no se aplica en ningún sitio del motor** (bloqueado por falta de combate multi-objetivo,
estrictamente 1v1 hoy), así que no tenía sentido dárselo gratis a Tirador/Instintivo/Supervivencia,
que nunca lo van a poder usar.

### Domador — la más bloqueada de las 9 clases hasta ahora

**Cómo se captura/tamea/equipa la mascota en sí (captura con cuerda, jaula, Felicidad, ventajas
reales del Domador sobre el resto de clases, integración con Reino) vive en su propio documento**:
[companeros-y-supervivencia.md](companeros-y-supervivencia.md) — este apartado se queda solo con
las habilidades de combate de la especialización.

**`COMPANERO` — APLICADO 2026-08-26** (Fase 1 del roadmap de efectos, ver `21-roadmap.md`): pasiva
real, reutiliza `esSlotDomador` (`companeros.ts`, ya construido de antes) — "Compañero cazador"
(nivel 12, fila de abajo) ya es una habilidad real y visible, no solo diseño. `INVOCACION` sigue
bloqueada: depende de la infraestructura de combate multi-objetivo real (Fase 3, sin construir
todavía) para que la mascota actúe según el efecto combinado dentro de un intercambio — un bloqueo
más profundo que la duración de turnos que frena a Berserker/Guardián/Supervivencia. Además, nivel
24 introduce **`MARCAR`**, un efecto que sigue sin existir en `AbilityEffect` — no catalogado
todavía, mismo caso que `PROVOCACION` en Guardián: hace falta darlo de alta antes de que esa
habilidad pueda construirse, más allá de que exista el compañero.

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Compañero cazador *(reasignada, antes tronco nv.8)* | Inteligencia | `COMPANERO`| ✅ lista, sembrada | Te desbloquea un slot de mascota, este slot no solo te permite añadir una criatura en tu poder sino que ademas te permite añadir equipo sobre la criatura. La criatura se visualizara en un tab en compañeros que será Bestiario y se le podra equipar casco, armadura y espalda (bolsa o montacargas o accesorios). Dependiendo el tamaño y el nivel se podran equipar menos o mas cosas, las piezas de mascotas solo se puede craftear no se obtienen de ninguna otra forma.
| 16 | Vínculo Salvaje | Voluntad | `AUMENTO` + RECUPERACION (a tu bestia) | ⛔ ningún efecto se aplica a un COMPAÑERO todavía — `AUMENTO`/`DEBILIDAD` solo tocan jugador↔NPC rival, sin ruta que afecte a `Companion.activeEffects` | AUmenta el attr base de tu mascota y le recupera 10 de energia
| 19 | Llamada de la Manada | Carisma | AGUANTE + `AUMENTO` + PROVOCACION + MULTIPLE + LIMITADO | ⛔ mismo motivo que 16 (compañero) + `PROVOCACION` sin motor | Tu mascota intercepta los ataques dirigidos a ti, la mascota aumenta su constitucion +4, si la difeencia es de 6 aumenta +6 la constitucion, si es de 10 la diferencia le obliga a atacarte el siguiente turno y aumenta +6 de constitucion, limitado a 2 veces por combate
| 24 | Concentración del Domador | Voluntad | `RECUPERACION`, `MARCAR` | ⛔ `MARCAR` no existe en el enum `AbilityEffect` — el único efecto de todo `clases.md` que sigue sin dar de alta siquiera (a diferencia de `PROVOCACION`, ya catalogado desde antes) | Recuperas energia y marcas un objetivo para tu presa ataque durante 3 turnos
| 28 | Adiestrar | Voluntad | `AGUANTE` + 'CONTRA' + 'DEBILIDAD' (tu bestia intercepta el golpe) | ⛔ mismo motivo que 16 (compañero) | tu compañero te defiende de un ataque aumentando en +4 su constitucion, si la diferencia es de 4 le reduce su destreza en 3 al enemigo, si la diferencia es de 8, ejecuta una contra y tambien le resta los 3 de destreza
| 32 | Grito Animal | Carisma | `ATURDIMIENTO` + `MULTIPLE` + `AUMENTO` | ⛔ mismo motivo que 16 (compañero) | Conectas con tu compañero y en un grito mutuo aunemnta +2 todos los stats durante dos turnos del compañero y a ti mismo, si sacas mas de 6 de diferencia aplica atudimiento a tu objetivo si la diferencia es de 12 se aplica el atudimiento a todos
| 36 | Manada Furiosa | destreza | CANALIZAR, `AUMENTO`, AGUANTE, PROVOCACION  (a tu bestia) | ⛔ `CANALIZAR` sin motor + mismo motivo que 16 (compañero) | Durante 2 turnos canalizas, si te atacan en esos turnos tu bestia te defiende y atra los ataques dirigidos a ti a ella, por cada ataque que aguante se multiplcara, es decir 1 ataque x2, 2 ataques, x3, 3 ataques x4.....por +3 x la cantidad de ataques en destreza que se aplicaran al final de la canalizacion a ti y a tu compañero durante 2 turnos
| 40 | Alfa de la Manada *(capstone)* | Voluntad | `COMPANERO` + `AUMENTO` | ⛔ mismo motivo que 16 (compañero) | Esta es otra habilidad pasiva, te permite tener otro compañero y un buff pasivo si estan los dos compañeros equipados de +2 a la voluntad a tus bestias, ademas te permite elegir un Alfa para que tenga un buff extra de +2 de fuerza entre tus dos compañeros.

**1 de 8 sembradas** (12). Sigue siendo la especialización más bloqueada — el bloqueo real ya NO es
"multi-objetivo" en general (confirmado 2026-08-31 que `AUMENTO` funciona en ataque Y en defensa
propia del jugador), sino específicamente que `Companion.activeEffects` (Fase 3§3a) **se LEE en
combate múltiple pero nada lo ESCRIBE todavía** — el campo existe y `effectiveAttributesConDuracion`
ya lo aplica al calcular atributos, pero ningún camino de `turnResolution.ts` empuja un nuevo
`ActiveEffect` a un compañero (solo a jugador↔NPC rival). Falta el "productor", no el "consumidor".
`MARCAR` (24) sigue siendo el único efecto de todo el documento sin dar de alta en el enum.

### Supervivencia

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Golpe Envenenado | Destreza | ATAQUE + `DEBILIDAD` (veneno) | ✅ lista, sembrada (2026-08-26, solo tramo alto: -4 destreza, 2 turnos) | Ataque que aumente en +2 la destreza, si la diferencia es de 4 resta 2 durante 2 turnos de destreza a tu objetivo, si la diferencia es de 8 resta 4
| 16 | Zancadilla | Destreza | `ATURDIMIENTO` | ✅ lista, sembrada |
| 19 | Camuflaje | Destreza | INTIMIDACION + `OCULTACION` + AUMENTO | ✅ **lista, sembrada 2026-08-27 (Fase 3§3c)** — solo OCULTACION (tramo alto, 2 turnos) real; el `AUMENTO` combinado en esta misma fila SIGUE sin construir porque su rol es `utilidad` (INTIMIDACION cancela el golpe), no `ataque`/`defensa` — mismo bloqueo que Grito Improvisado | Cancela el ataque de tu enemigo y si la tirada tiene una diferencia de 4 te oculta el siguiente turno del agro y te aumenta en +2 la destreza, si la diferencia es de 10 entonces te oculta 2 turnos y aumenta en +2 tu destreza esos 2 turnos. Si realizas un ataque esos turnos de ocultacion, la ocultacion se pierde
| 24 | Giro Toxina Paralizante | Destreza | ATAQUE +`DEBILIDAD` + `ATURDIMIENTO` + MULTIPLE + LIMITADO | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `DEBILIDAD`+`MULTIPLE`+`ATURDIMIENTO` sobre ataque directo YA tienen motor real combinado | Eecuta un ataque que te aumenta +2 la destreza, si la diferencia es de 4 le aplica al objetivo -4 de destreza y lo aturde un turno, si la diferencia es de 10 mismo efecto, pero la debilidad se propaga a todos los enemigos pero les resta -6. Limitado a 2 usos por combate
| 28 | Caparazon Gargantua | Constitución | `AGUANTE` + `DEBILIDAD` + `CONTRA` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque DEBILIDAD ya funciona en defensa del jugador (confirmado 2026-08-31) y CONTRA también | Te defiende de un ataque aumentando en +6 tu constitucion, si la diferencia es de 6 entonces le resta -6 del attr usando por tu objetivo este turno, si la diferencia es de 10 mismo efecto pero apica tambien una contra
| 32 | Trampa Improvisada | Inteligencia | `ATURDIMIENTO` + `MULTIPLE` + `LIMITADO` | ⛔ "todo el que le ataque" es un efecto de área persistente (trampa que dura 2 turnos, afecta a quien sea) — no encaja con el MULTIPLE real (propagación puntual en el turno de ataque), sin construir | Coloca trampas a su alrededor que duran 2 turnos, todo el que le ataque  se queda aturdido un turno si ganas la tirada. Limitado a 1 uso por combate
| 36 | Golpe Veneno Corrosivo | Destreza | ATAQUE + `DEBILIDAD` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque DEBILIDAD+ataque YA tiene motor real | Ataque que aumenta tu destreza en 3 ese turno y si la diferencia es de 6, le resta al enemigo -2 en todos los stats durante 1 turno, si la diferencia es de 12 en la tirada entonces le resta -6 de todos los attrs durante 1 turno
| 40 | Comunion Salvaje | Destreza | `AGUANTE` + `DESVIAR` + `DEBILIDAD` | ✅ **lista, sembrada 2026-08-27 (Fase 3§3c)** — solo DESVIAR real; la `DEBILIDAD` combinada de esta fila sigue SIN cifra en la ficha original (nunca dice qué atributo/cuánto/cuántos turnos), no hay número que sembrar todavía | Defiende de un ataque aumentando tu destreza en +6, si le superas en 8 desvia el ataque a otro enemigo aleatorio

**3 de 8 sembradas** (12, 16, 19 parcial, 40 parcial — realmente 4 filas con presencia en el motor,
2 de ellas simplificadas). 24/28/36 son sembrables YA sin tocar motor (DEBILIDAD ya cubre ataque Y
defensa del jugador). 32 necesita una mecánica de "trampa persistente" que no existe.

### Tirador — 5 de 8 listas

Columna Estado añadida (se había perdido al escribir esta tabla) y corregido el typo
`CANLIZAR`→`CANALIZAR` (24):

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Disparo Certero | Destreza | `ATAQUE` | ✅ lista, sembrada |
| 16 | Instinto de Cazador | Inteligencia | `AGUANTE` — lees la intención del rival y esquivas antes del golpe aumentando tu inteligencia en +4 | ✅ lista, sembrada |
| 19 | Tiro Inmovilizador | Destreza | `ATAQUE` + `ATURDIMIENTO` | ✅ lista, sembrada |
| 24 | Tensar al Límite | Fuerza | `ATAQUE` + `CANALIZAR` + `LETAL` — tensa el arco al máximo, más potencia por pura resistencia física | ⛔ `CANALIZAR` sigue sin ningún comportamiento real ("se cancela si te atacan antes de completarse" no tiene mecanismo de motor) |
| 28 | Concentración Absoluta | Voluntad | `ATAQUE` — paciencia y foco antes de disparar, no técnica | ✅ lista, sembrada |
| 32 | Puntería Perfecta | Destreza | `ATAQUE` — el disparo definitivo de precisión | ✅ lista, sembrada |
| 36 | Tiro Multiple | Destreza | `ATAQUE` + `MULTIPLE` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `MULTIPLE`+`ATAQUE` YA tiene motor real (mismo patrón que Punta Doble/Golpe Gemelo) |
| 40 | Disparo Definitivo *(capstone)* | Destreza | `ATAQUE` + `AGUANTE` + `CONTRA` + `LIMITADO` | ⛔ combina rol ataque Y rol defensa en la MISMA habilidad ("si es en turno de ataque... si es en defensa...") — el motor asigna un único `rol` por `SavedAction`, no hay forma de que la misma ficha se comporte distinto según quién inicia el intercambio |

**5 de 8 sembradas** (12/16/19/28/32). 36 es sembrable YA sin tocar motor. 24 (`CANALIZAR`) y 40
(rol dual ataque/defensa en una sola ficha, limitación estructural real, no solo un efecto sin
construir) siguen bloqueadas de verdad.

### Instintivo — 4 de 8 listas

Columna Estado añadida (se había perdido al escribir esta tabla):

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Barrido Instintivo | Destreza | `ATURDIMIENTO` (reactiva, rol defensa) | ✅ lista, sembrada |
| 16 | Golpe Rápido | Destreza | `ATAQUE` | ✅ lista, sembrada |
| 19 | Instinto Reactivo | Destreza | `AGUANTE` + `CONTRA` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `CONTRA`+defensa YA tiene motor real (mismo patrón que Vórtice Menor) |
| 24 | Furia Instintiva | Fuerza | `ATAQUE` + `DEBILIDAD` | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque `DEBILIDAD`+ataque YA tiene motor real |
| 28 | Instinto de Reserva | Inteligencia | `AGUANTE` + `RECUPERACION` + `MULTIPLE` | ⛔ "te defiende de TODOS los ataques dirigidos a ti" es un efecto de área en defensa, distinto del MULTIPLE real (propaga UN ataque a un objetivo extra) — sin construir |
| 32 | Golpe Gemelo | Fuerza | `ATAQUE` + `MULTIPLE` | ✅ **lista, sembrada 2026-08-31** — corregido un bug de siembra real: estaba dada de alta por error en Supervivencia nv.32 en vez de aquí (mismo nombre, mismo atributo), movida a su especialización correcta. Tramo único (siempre 2 objetivos si conecta), sin condición de margen propia de la ficha |
| 36 | Instinto Asesino | Constitución | `AGUANTE` + `ATURDIMIENTO` + `LIMITADO` — reacción primaria, pura adrenalina | ✅ lista, sembrada |
| 40 | Velocidad Letal *(capstone)* | Destreza | `ATAQUE` + `LETAL` | ✅ lista, sembrada |

**6 de 8 sembradas** (12/16/32/36/40 + Golpe Gemelo corregido en esta pasada). 19 y 24 son
sembrables YA sin tocar motor — dejarían Instintivo en 8/8 salvo 28 (mecánica de área en defensa
sin construir). Es la especialización más cerca de completarse de las 12 revisadas hoy.

---

## Chamán (exclusiva de orcos) — repaso a fondo

**Lore real, no solo mecánica** (aclarado en esta sesión, pendiente de anotar en genesis.md/
razas.md): los orcos no son magos — Magia, aunque poderosa en ellos por su origen (nacidos del
Estallido de Tarkor, la rama Salvaje), nunca fue su camino elegido; su cultura entera gira en
torno a no dejarse domar por lo que no eligieron (misma idea que la frase de cuna ya establecida:
"aún así nadie domó nuestros caminos"). El Chamán es su equivalente a Mago, pero nunca lanza la
magia directamente — la canaliza siempre a través de un objeto/foco (tótem, runa) que conecta su
magia interior con la magia ambiental del mundo. Mecánicamente usa el mismo atributo **Magia** que
Mago; la diferencia es de sabor narrativo (invocar a través de algo vs. lanzarla en crudo), no de
tirada.

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Carga Rúnica | Magia | `CONVERSION` *(nueva)* — tu ataque de este turno pasa a usar Magia en vez del atributo normal del arma | ✅ lista — efecto nuevo pero sin depender de duración de turnos |
| 4 | Tótem Veloz | Destreza | `AUMENTO` — +2 destreza durante 3 turnos | ⚠️ bloqueada de verdad todavía — sin sembrar, potencialmente sembrable YA si se le asigna `rol: ataque` o `defensa` (confirmado 2026-08-31 que AUMENTO funciona en ambos); la ficha original no fija ninguno de los dos, es una decisión de diseño pendiente, no un bloqueo de motor |
| 6 | Voluntad del Espíritu | Voluntad | `AGUANTE` — resistir un golpe sosteniendo la conexión bajo presión, no por magia en sí | ✅ lista |
| 8 | Comunión con el Entorno | Magia | `RECUPERACION` — canaliza magia ambiental del entorno para recuperar energía | ✅ lista |

`CONVERSION` es un hallazgo nuevo de esta sesión: a diferencia de casi todos los efectos nuevos
propuestos hasta ahora (`PROVOCACION` incluido), esta NO depende de la infraestructura de
duración/turnos que falta en el motor — se resuelve entera dentro del mismo intercambio, igual que
`ATAQUE`/`ATURDIMIENTO`. Solo hace falta dar de alta el nombre y enseñarle a `combatExchange.ts` a
usarlo.

### Totémico — casi tan bloqueada como Domador

"Efectos en área" necesita `MULTIPLE` (combate multi-objetivo) y "tótems que persisten" necesita
`INVOCACION` — misma familia de bloqueo que Domador. Los ataques mágicos puntuales a través de un
tótem SÍ pueden hacerse ya (no necesitan que el tótem persista en la escena):

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Tótem de Guerra | Magia | `INVOCACION` | ⛔ multi-objetivo (`INVOCACION`) | Invoca un totem que solo aguanta 1 golpe, que ataca durante 2 turnos y desaparece. NO se puede invocar mas de un totem de este tipo
| 16 | Tótem de Protección | Voluntad | `AGUANTE` + `INVOCACION` + `PROVOCACION` | ⛔ multi-objetivo + efecto nuevo (`PROVOCACION`) | Invoca un totem que solo aguanta 2 golpes y te defiende de cualquier daño hasta que desaparezca, no ataca
| 19 | Tótem Elementos | Magia | `INVOCACION` + `LIMITADO` — invoca un elemental que combina los 4 elementos en uno solo | ⛔ multi-objetivo | Aguanta 2 goles y puede defender o atacar, la mitad de las estadisticas de su invocador. Limitado a 3 usos por combate.
| 24 | Grieta Elemental | Carisma | `DEBILIDAD` + `MULTIPLE` — la ira de los espíritus invocados debilita al rival, no la magia en sí | ⚠️ bloqueada | Reduce la fuerza y la destreza en -3 a todos los enemigos
| 28 | Tótem de Clan *(si perteneces a una facción, el nombre cambia a "Tótem [nombreFacción]", ej. Tótem Maktor)* | Magia | `INVOCACION` + `MULTIPLE` + `AUMENTO` + `LIMITADO` — el efecto del tótem alcanza a más de un rival | ⛔ multi-objetivo | Invoca un totem que aguanta 1 golpe, no ataca ni se defiende (si lo atacan se destruye), y da +2 de todos los stats a todo el grupo. Limitado a 2 usos
| 32 | Tótem Temblor | Fuerza | `INVOCACION` + `ATAQUE` + `DEBILIDAD` — golpe físico del propio tótem, no mágico | ⛔ multi-objetivo (`INVOCACION`) | Invoca un totem que solo aguanta 1 golpe, que ataca durante 2 turnos y desaparece. A los enemigos que ataca este totem o el que lo destruya se resta -6 de destreza durante 2 turnos. NO se puede invocar mas de un totem de este tipo
| 36 | Tótem Ancestral | Magia | `INVOCACION` + `AGUANTE` + `PROVOCACION` + `CONTRA` + `LIMITADO` | ⛔⚠️ multi-objetivo + efecto nuevo + duración | Invoca un totem de 1 de vida que atare los ataques de su invocador y por cada defensa ganada ejecuta una contra. 2 uso por combate
| 40 | Tótems Elementales *(capstone)* | Magia | `INVOCACION` + `MULTIPLE` + `LIMITADO` — invoca un elemental de CADA uno de los 4 elementos a la vez (4 en total), no uno combinado. Cada uno aguanta 2 golpes | ⛔ multi-objetivo | Cada elemental tendra la mitad de las stats de su invocador, cada uno tendra 2 de vida y 1 uso por combate

**0 de 8 listas** — es la especialización más bloqueada de las 9 clases junto a Domador, porque
`INVOCACION` aparece en los 8 huecos sin excepción y no está implementado en absoluto (necesita un
tótem persistiendo en la escena como un tercer participante del combate, no solo multi-objetivo
puntual). El capstone (40) sí escala de forma coherente sobre el 19: a nivel 19 invocas un solo
elemental que mezcla los 4 elementos; a nivel 40 ya invocas los 4 por separado, uno de cada — mismo
criterio de "invocación que mejora por nivel con habilidades distintas" que ya usan Mago Brote/Mago
Feral (Poder Semilla). El diseño en sí no tiene ningún problema; es pura cuestión de que toda la
identidad de la rama depende de una pieza de infraestructura que aún no existe.

### Rúnico — bloqueada solo por duración, no por multi-objetivo

Todo es "a un rival EN CONCRETO o sobre ti mismo" — un solo objetivo, así que depende solo de la
infraestructura de duración de turnos (`AUMENTO`/`DEBILIDAD`), no de la de multi-combate. Menos
bloqueada que Totémico:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Runa de Fuerza | Magia | `AUMENTO` (a ti mismo) | ⚠️ bloqueada de verdad todavía — sin sembrar, potencialmente sembrable YA si se le asigna `rol: ataque` o `defensa` (ficha original no lo fija) |
| 16 | Golpe Runa de Debilidad | Magia | ATAQUE + `DEBILIDAD` (a un rival concreto) | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque DEBILIDAD+ataque YA tiene motor real |
| 19 | Runa Ilusoria | Inteligencia | INVOCACION + `AGUANTE` + PROVOCACION  | ⛔ INVOCACION solo construido para Tótem de Guerra (Convocador); PROVOCACION sin motor |
| 24 | Runa de Resistencia | Voluntad | `AGUANTE` | ✅ lista, sembrada |
| 28 | Golpe Runa de Cólera | Magia | ATAQUE + `AUMENTO`  | ✅ lista, sembrada (2026-08-26) |
| 32 | Control Rúnico | Magia | CONTROL + `DEBILIDAD` — maldición que marca a un rival concreto | ⛔ **confirmado NO sembrable con la arquitectura actual** (docs/21-roadmap.md, 27-08): combina CONTROL (solo dispara en el camino independiente/`rol: utilidad`) con DEBILIDAD (solo dispara en el camino no-independiente/ataque-defensa) — `rol` es un campo único por habilidad, ningún camino cubre los dos efectos a la vez sin reinterpretar la fila entera |
| 36 | Runa de Rayo Cadena| Inteligencia | `ATAQUE` + MULTIPLE  | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque MULTIPLE+ATAQUE YA tiene motor real |
| 40 | Intelecto Rúnico *(capstone)* | Magia | `ATAQUE` + LIMITADA — una runa predice el ataque del rival; te anticipas con un golpe básico del tipo que tiene ventaja contra él | ✅ lista, sembrada |

**3 de 8 sembradas** (24/28/40). 12/16/36 son sembrables YA sin tocar motor. 19 (INVOCACION+
PROVOCACION) y 32 (Control Rúnico, el caso confirmado de "no cabe en el modelo actual") siguen
bloqueadas de verdad — 32 en particular necesita decisión de diseño, no solo motor: o se separa en
2 habilidades, o se reinterpreta con un único rol.

### Convocador — la menos bloqueada de las 4 (guerrero-mago)

"Daño y defensa" mapea casi todo a `ATAQUE`/`AGUANTE` sobre uno mismo — objetivo único, sin
invocaciones que persistan en la escena, así que apenas toca la infraestructura pendiente:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Filo Elemental | Magia | `ATAQUE` + AUMENTO — imbuye tu arma con un elemento para el golpe | ✅ **sembrable YA** — sin sembrar todavía, `AUMENTO`+ataque tiene motor real | Ataque que aumenta tu magia en +3 y que si la diferencia es de 6 aumenta tu magia en +4 en el siguiente turno
| 16 | Armadura de Piedra | Constitución | `AGUANTE` + DEBILIDAD — invoca tierra sobre tu propio equipo | ✅ **sembrable YA** — sin sembrar todavía, DEBILIDAD+defensa YA funciona (confirmado 2026-08-31) | Te defiendes si la tirada tiene una diferencia de mas de 4 entonces le aplica -4 de destreza
| 19 | Golpe de Trueno | Fuerza | `ATAQUE` + MULTIPLE — descarga eléctrica concentrada en un golpe físico | ✅ **sembrable YA** — sin sembrar todavía, MULTIPLE+ataque tiene motor real | Ataca sumando +4 de fuerza y si la tirada se diferencia en mas de 10 entonces hace daño en area 
| 24 | Escudo de Escarcha | Constitución | `AGUANTE` + DEBILIDAD  — el hielo refuerza tu resistencia unos turnos | ✅ **sembrable YA** — mismo motivo que 16, DEBILIDAD ya funciona en defensa | Te dfientes de un ataque aumentando +4 la constitucion y restas -3 de destreza a quien te ataca si ganas la tirada
| 28 | Puño Ígneo | Magia | `ATAQUE` + ATURDIMIENTO — golpe de fuego consecutivo | ✅ lista, sembrada | ATaca sumando +4 a la magi ay si la diferencia es de 8 o mas etonces aurde al enemigo 1 turno
| 32 | Vórtice Menor | Destreza | `AGUANTE` + CONTRA — un torbellino te ayuda a esquivar | ✅ lista, sembrada |
| 36 | Cuerpo Elemental | Magia | AGUANTE + ATAQUE +`AUMENTO` — te conviertes brevemente en un ser elemental | ⛔ combina rol ataque Y rol defensa en la MISMA habilidad, mismo bloqueo estructural que Disparo Definitivo (Tirador 40) — el motor asigna un único `rol` por ficha |
| 40 | Furia de los Elementos *(capstone)* | Magia | `ATAQUE` + CANALIZAR + LETAL + LIMITADO — combina los 4 elementos en un golpe devastador final | ⛔ `CANALIZAR` sigue sin ningún comportamiento real |

**2 de 8 sembradas** (28, 32) — bastante menos que el "6 de 8" original, pero la especialización
CON MÁS margen de las 12 revisadas hoy: **12/16/19/24 son sembrables YA sin tocar motor**, dejando
Convocador en 6/8 real de golpe si se siembran. Solo 36 (rol dual) y 40 (`CANALIZAR`) siguen
bloqueadas de verdad.

### Opresor — la más bloqueada de las 4 (encaja con "subyugar/debilitar")

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Grillete Rúnico | Magia | `ATURDIMIENTO` — una runa te retiene un turno | ✅ lista, sembrada |
| 16 | Opresión Mental | Magia | `CONTROL` — tomas el control del rival durante 2 turnos | ✅ **lista, sembrada — mejorada 2026-08-27 (Fase 3§3a)**: en combate múltiple real (`CombatEncounter`, ≥2 enemigos vivos del bando controlado), el controlado ataca de verdad a un aliado propio durante 2 rondas — el efecto REAL de la ficha, no solo el fallback de robar iniciativa (que se mantiene solo en 1v1 clásico, sin nadie a quien redirigir) |
| 19 | Cadena de Sombras | Magia | ATAQUE + `DEBILIDAD` — runas oscuras atan y debilitan al rival | ⚠️ bloqueada de verdad todavía — sin sembrar, aunque DEBILIDAD+ataque YA tiene motor real |
| 24 | Golpe Sometedor | Fuerza | ATAQUE + `ATURDIMIENTO` — golpe físico que aturde | ✅ lista, sembrada |
| 28 | Voz que Doblega | Carisma | `MULTIPLE` + CONTROL — tu voz impone temor y desorienta | ⛔ "controla a 2 enemigos ALEATORIAMENTE" es CONTROL multi-objetivo real (Fase 3§3a solo redirige a UN controlado, no controla 2 a la vez) — más allá de lo que el motor cubre hoy |
| 32 | Runa de Sujeción | Voluntad | 'MULTIPLE' + `ATURDIMIENTO` — inmoviliza brevemente al rival | ⛔ "inmoviliza a TODOS los rivales" es un efecto de área en aturdimiento, distinto del MULTIPLE real (propagación puntual de UN ataque) — sin construir |
| 36 | Grieta de Voluntad | Magia | MULTIPLE + `DEBILIDAD` — quiebra la voluntad del rival | ⛔ mismo motivo que 32 — "resta a TODOS los rivales" es área, no el MULTIPLE puntual real |
| 40 | Sometimiento Total *(capstone)* | Magia | 'ATAQUE' + `MULTIPLE` + 'CONTROL' + `DEBILIDAD` + LIMITADO — un golpe rúnico definitivo que aturde y debilita a la vez | ⛔ combina 4 efectos, varios de área — más allá de lo que el motor cubre hoy |

**3 de 8 sembradas** (12, 16 mejorada, 24). 19 es sembrable YA sin tocar motor, dejando Opresor en
4/8. 28/32/36/40 comparten el mismo bloqueo real: describen efectos de ÁREA verdaderos ("a todos
los rivales", "2 enemigos aleatoriamente") que van más allá de lo que `MULTIPLE` cubre hoy
(propagación puntual a UN objetivo extra desde un ataque directo) — necesitan diseño de mecánica
de área propia, no solo sembrar con el `MULTIPLE` ya construido.

**Chamán completo (recuento real, 2026-08-31): Totémico 0/8, Rúnico 3/8, Convocador 2/8 (6/8
sembrable ya), Opresor 3/8 (4/8 sembrable ya)** — sustituye el recuento del 2026-08-25, que ya
estaba desactualizado por las Fases 2/3 del 2026-08-26/27.

---

## Arquero — repaso a fondo

Solo 2 especializaciones nombradas (Maestro Arquero / Maestro Ballestero), casi espejo mecánico
entre sí ("lo mismo, con ballesta"). Las categorías de arma `ARCO_CORTO`/`ARCO_LARGO`/`BALLESTA` ya
existen en el motor con destreza y sus propias `WeaponAbility` — el tronco/especialización de aquí
se apila encima, igual que con Guerrero.

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Vista de Halcón | Inteligencia | `ANALISIS` | ✅ lista |
| 4 | Reflejos de Cazador | Destreza | `AGUANTE` | ✅ lista | aumenta la desteza +2 y te defiendes
| 6 | Tiro de Aliento Estable | Voluntad | ATAQUE + `RECUPERACION` | ✅ lista | Atqiue con voluntad que si tiene una diferencia de 4 recuera la enerigia gastada por esta habilidad + 10
| 8 | Tiro de Precisión | Destreza | `ATAQUE` (reactiva, tipo Contraataque) | ✅ lista | ataque que aumenta +4 de destreza

### Maestro Arquero — completa, casi sin bloqueos

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Flecha Certera | Destreza | `ATAQUE` + DEBILIDAD | ✅ lista |
| 16 | Tiro Inmovilizador | Destreza | ATAQUE + `ATURDIMIENTO` — clava al rival en el sitio | ✅ lista |
| 19 | Paso calculado | Inteligencia | `AGUANTE` + CONTRA — corrige distancia y viento para un tiro preciso | ✅ lista |
| 24 | Postura de Tirador | Constitución | `ATAQUE` + AUMENTO | ✅ lista |
| 28 | Disparo Perforante | Fuerza | `ATAQUE` + DEBILIDAD — tensa el arco al máximo, tiro de fuerza bruta | ✅ lista |
| 32 | Tiro multiple | Destreza | `ATAQUE` + MULTIPLE | ✅ lista |
| 36 | Tiro en Cadena | Destreza | ATAQUE + `AUMENTO` — concentración que mejora la precisión varios turnos | ⚠️ bloqueada |
| 40 | Flecha del Ocaso *(capstone)* | Destreza | `ATAQUE` + CANLIZAR + LETAL — el tiro definitivo, máximo daño posible | ✅ lista |

**7 de 8 listas** — la especialización menos bloqueada de toda la sesión hasta ahora. Destreza
mayoría (4/8) con inteligencia/constitución/fuerza/voluntad repartidas.

### Maestro Ballestero — misma tabla, reflavorizada

Mismo atributo/efecto/nivel que Maestro Arquero en los 8 huecos, solo cambia el arma y el texto de
sabor (arco → ballesta): Perno Certero (12), Perno Inmovilizador (16), Cálculo de Viento (19,
idéntica), Postura de Tirador (24, idéntica), Perno Perforante (28), Segundo Aliento del Cazador
(32, idéntica), Recarga en Cadena (36), Perno del Ocaso *(capstone, 40)*. Mismo balance: **7 de 8
listas**, mismo bloqueo (36, `AUMENTO`).

---

## Caballero (exclusiva de Goirntes) — repaso a fondo

Clase nueva del todo en el motor, sin abilities previas que preservar. Igual que Guerrero, ningún
hueco de Caballero toca Magia en ninguna especialización.

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Juramento del Caballero | Voluntad | `AGUANTE` — la firmeza del voto resiste un golpe | ✅ lista |
| 4 | Golpe de Honor | Fuerza | `ATAQUE` | ✅ lista |
| 6 | Resistencia Templada | Constitución | `RECUPERACION` | ✅ lista |
| 8 | Mirada Autoritaria | Carisma | `ANALISIS` — lee al rival con la autoridad de su rango | ✅ lista |

### Caballero del Orden — el tanque, escala fuerte por constitución

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Muralla de Acero | Constitución | `AGUANTE` | ✅ lista |
| 16 | Golpe de Escudo | Constitución | `ATAQUE` — escala por constitución, no fuerza | ✅ lista |
| 19 | Voluntad Inquebrantable | Voluntad | `AGUANTE` | ✅ lista |
| 24 | Golpe Pesado | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Bastión Viviente | Constitución | `AGUANTE` | ✅ lista |
| 32 | Grito de Hierro | Carisma | `ATURDIMIENTO` | ✅ lista |
| 36 | Piel de Roca | Constitución | `AUMENTO` — refuerzo temporal de resistencia | ⚠️ bloqueada |
| 40 | Fortaleza Inquebrantable *(capstone)* | Constitución | `AGUANTE` + `AUMENTO` | ⚠️ bloqueada |

**6 de 8 listas** (12/16/19/24/28/32). Constitución sube a 5/8 (12/16/28/36/40) — coherente con la
identidad de tanque puro. Voluntad/fuerza/carisma repartidas en el resto.

### Caballero del Valor — la más bloqueada de las 3

Gira en torno a `PROVOCACION` (agro, ya propuesta para Guardián) y `RETIRAR` (limpiarse un efecto
adverso) — los dos efectos menos maduros hoy:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Grito de Valentía | Carisma | `PROVOCACION` — fuerza al rival a centrarse en ti | ⛔ necesita el efecto nuevo |
| 16 | Manto de Purificación | Voluntad | `RETIRAR` — te limpias un efecto adverso | ⚠️ bloqueada |
| 19 | Golpe Justiciero | Fuerza | `ATAQUE` | ✅ lista |
| 24 | Escudo del Valor | Constitución | `AGUANTE` | ✅ lista |
| 28 | Grito de Coraje | Carisma | `PROVOCACION` — redirige hacia ti el golpe dirigido a un aliado concreto | ⛔ necesita el efecto nuevo |
| 32 | Purga de Honor | Voluntad | `RETIRAR` | ⚠️ bloqueada |
| 36 | Golpe de Justicia | Fuerza | `ATAQUE` | ✅ lista |
| 40 | Sacrificio del Valiente *(capstone)* | Constitución | `AGUANTE` + `PROVOCACION` — te llevas el golpe dirigido a un aliado | ⛔⚠️ las dos cosas |

**3 de 8 listas** (19/24/36). Reparto perfecto 2/2/2/2 entre carisma, voluntad, fuerza y
constitución.

### Caballero del Dolor — daño que escala por constitución

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Golpe del Dolor | Constitución | `ATAQUE` — el daño escala con tu propia resistencia | ✅ lista |
| 16 | Resistencia al Sufrimiento | Constitución | `AGUANTE` | ✅ lista |
| 19 | Furia Contenida | Fuerza | `ATAQUE` | ✅ lista |
| 24 | Sangre Hirviendo | Constitución | `AUMENTO` — cuanto más dañado, más fuerte temporalmente | ⚠️ bloqueada |
| 28 | Grito de Batalla | Carisma | `ATURDIMIENTO` | ✅ lista |
| 32 | Última Gota | Voluntad | `RECUPERACION` — la voluntad tira del cuerpo pese al dolor | ✅ lista |
| 36 | Golpe Inquebrantable | Constitución | `ATAQUE` | ✅ lista |
| 40 | Dolor Convertido en Fuerza *(capstone)* | Constitución | `ATAQUE` — el golpe definitivo, máximo cuanto más resistente eres | ✅ lista |

**7 de 8 listas** (12/16/19/28/32/36/40) — solo "Sangre Hirviendo" espera. Constitución mayoría
(5/8: 12/16/24/36/40) con fuerza/carisma/voluntad repartidas.

**Caballero completo**: Orden 6/8, Valor 3/8, Dolor 7/8.

---

## Segador (exclusiva de Nabieus) — repaso a fondo

Clase nueva del todo en el motor. Ningún hueco toca Magia, igual que Guerrero/Caballero.

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Vista de la Parca | Inteligencia | `ANALISIS` — lee el destino del rival, detecta su debilidad | ✅ lista |
| 4 | Paso Fúnebre | Destreza | `AGUANTE` — esquiva como una sombra | ✅ lista |
| 6 | Aliento Postrero | Voluntad | `RECUPERACION` | ✅ lista |
| 8 | Guadaña Certera | Fuerza | `ATAQUE` | ✅ lista |

### Parca — succión de vida, remates y debilidades

Más fuerte cuanto más dañado está el objetivo. Bloqueada sobre todo por `CURAZION` (succión de
vida) y `DEBILIDAD`, ambos pendientes de la infraestructura de duración:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Golpe Segador | Fuerza | `ATAQUE` — más daño cuanto más herido esté el rival | ✅ lista |
| 16 | Toque de la Parca | Voluntad | `DEBILIDAD` | ⚠️ bloqueada |
| 19 | Sed de Vida | Constitución | `ATAQUE` + `CURAZION` — roba vida al golpear | ⚠️ bloqueada |
| 24 | Corte Final | Destreza | `ATAQUE` — ejecución rápida y precisa | ✅ lista |
| 28 | Marca de la Guadaña | Inteligencia | `DEBILIDAD` | ⚠️ bloqueada |
| 32 | Robo de Vitalidad | Constitución | `CURAZION` | ⚠️ bloqueada |
| 36 | Golpe Agonizante | Fuerza | `ATAQUE` — escala con el daño ya infligido | ✅ lista |
| 40 | Último Suspiro *(capstone)* | Fuerza | `ATAQUE` + `CURAZION` — golpe definitivo que además te cura por el daño hecho | ⚠️ bloqueada |

**3 de 8 listas** (12/24/36). Fuerza mayoría (3/8: 12/36/40) con constitución/destreza/voluntad/
inteligencia repartidas.

### Maldito — debilidades, succión de energía y aturdimientos

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Maldición Susurrada | Voluntad | `DEBILIDAD` | ⚠️ bloqueada |
| 16 | Golpe Aturdidor | Destreza | `ATURDIMIENTO` | ✅ lista |
| 19 | Robo de Energía | Inteligencia | `RECUPERACION` — le arrebatas energía al rival | ✅ lista |
| 24 | Grillete Maldito | Fuerza | `ATURDIMIENTO` | ✅ lista |
| 28 | Susurro Debilitante | Carisma | `DEBILIDAD` | ⚠️ bloqueada |
| 32 | Cadena de Maldiciones | Voluntad | `ATURDIMIENTO` | ✅ lista |
| 36 | Maldición Profunda | Inteligencia | `DEBILIDAD` | ⚠️ bloqueada |
| 40 | Maldición Final *(capstone)* | Voluntad | `DEBILIDAD` + `ATURDIMIENTO` | ⚠️ bloqueada |

**4 de 8 listas** (16/19/24/32). Voluntad mayoría (3/8: 12/32/40) con inteligencia/destreza/fuerza/
carisma repartidas.

### Ilustrado — erudito: lee el destino/probabilidades, control sutil

El tronco ya tiene el único `ANALISIS` de la clase, así que aquí la "lectura de probabilidades" se
representa con `CONVERSION` (elegir el atributo ideal del golpe según lo predicho), sin repetir
análisis:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Cálculo del Destino | Inteligencia | `CONVERSION` — eliges el atributo de tu golpe según lo que has predicho | ✅ lista |
| 16 | Paso Predicho | Destreza | `AGUANTE` — anticipas el golpe y lo evitas | ✅ lista |
| 19 | Ventaja Calculada | Inteligencia | `ATAQUE` — aprovechas una abertura calculada | ✅ lista |
| 24 | Giro del Destino | Carisma | `DEBILIDAD` — tuerces la suerte del rival en tu favor | ⚠️ bloqueada |
| 28 | Predicción Precisa | Inteligencia | `CONVERSION` | ✅ lista |
| 32 | Golpe de la Fortuna | Voluntad | `ATAQUE` | ✅ lista |
| 36 | Manipulación del Azar | Carisma | `DEBILIDAD` | ⚠️ bloqueada |
| 40 | Destino Sellado *(capstone)* | Inteligencia | `CONVERSION` + `ATAQUE` — el golpe definitivo, siempre con el atributo perfecto | ✅ lista |

**6 de 8 listas** (12/16/19/28/32/40). Inteligencia mayoría (4/8: 12/19/28/40) con destreza/carisma/
voluntad repartidas.

### Transmutador — convierte y refleja efectos, la más dependiente de toda la sesión

Necesita que ya exista un buff/debuff activo (duración de turnos) para poder convertirlo o
reflejarlo — depende de todo lo demás antes de poder existir:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Toque Alquímico | Inteligencia | `ATAQUE` — imbuye tu golpe con un elemento inestable | ✅ lista |
| 16 | Espejo Maldito | Voluntad | `REFLEJAR` — devuelve un efecto negativo al rival | ⚠️ bloqueada |
| 19 | Transmutación Menor | Inteligencia | `CONVERSION` — convierte una debilidad propia en un pequeño beneficio | ⚠️ bloqueada (necesita que exista la debilidad primero) |
| 24 | Golpe Inestable | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Espejo de Poder | Voluntad | `REFLEJAR` | ⚠️ bloqueada |
| 32 | Alquimia Vital | Constitución | `CURAZION` — transmuta el daño recibido en energía | ⚠️ bloqueada |
| 36 | Transmutación Mayor | Inteligencia | `CONVERSION` — convierte un buff del rival en debilidad, y viceversa | ⚠️ bloqueada |
| 40 | Equilibrio Roto *(capstone)* | Inteligencia | `CONVERSION` + `REFLEJAR` — invierte todos los efectos activos entre ambos combatientes | ⚠️ bloqueada |

**Solo 2 de 8 listas** (12/24) — la más bloqueada de Segador. Inteligencia mayoría (4/8: 12/19/36/40)
con voluntad/fuerza/constitución repartidas.

**Segador completo**: Parca 3/8, Maldito 4/8, Ilustrado 6/8, Transmutador 2/8.

---

## Asesino — repaso a fondo

Clase nueva del todo en el motor. Ningún hueco toca Magia.

### Tronco común (nivel 1-10)

Destreza se repite a propósito (define a la clase), igual que Chamán repitió Magia en el suyo:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Estudio del Blanco | Inteligencia | `ANALISIS` | ✅ lista |
| 4 | Reflejos de Sombra | Destreza | `AGUANTE` | ✅ lista |
| 6 | Respiración Silenciosa | Voluntad | `RECUPERACION` | ✅ lista |
| 8 | Golpe Certero | Destreza | `ATAQUE` (reactiva) | ✅ lista |

### Maestro Asesino — generalista: precisión, crítico puro

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Golpe Preciso | Destreza | `ATAQUE` | ✅ lista |
| 16 | Punto Vital | Inteligencia | `ATAQUE` — golpe calculado a un punto crítico | ✅ lista |
| 19 | Paso Sombrío | Destreza | `AGUANTE` | ✅ lista |
| 24 | Golpe Doble | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Instinto Asesino | Voluntad | `ATURDIMIENTO` | ✅ lista |
| 32 | Filo Perfecto | Destreza | `AUMENTO` — afila tu técnica temporalmente | ⚠️ bloqueada |
| 36 | Ejecución Precisa | Constitución | `ATAQUE` — control absoluto del cuerpo en el golpe final | ✅ lista |
| 40 | Golpe Maestro *(capstone)* | Destreza | `ATAQUE` — precisión máxima | ✅ lista |

**7 de 8 listas** (12/16/19/24/28/36/40). Destreza mayoría (4/8: 12/19/32/40) con inteligencia/
fuerza/voluntad/constitución repartidas una vez cada una.

### Asesino Tóxico — veneno: daño sostenido y debilidades acumulativas

Depende mucho de `DEBILIDAD`:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Filo Envenenado | Destreza | `DEBILIDAD` | ⚠️ bloqueada |
| 16 | Golpe Tóxico | Destreza | `ATAQUE` | ✅ lista |
| 19 | Veneno Paralizante | Inteligencia | `DEBILIDAD` + `ATURDIMIENTO` | ⚠️ bloqueada |
| 24 | Resistencia a Toxinas | Constitución | `AGUANTE` | ✅ lista |
| 28 | Veneno Corrosivo | Voluntad | `DEBILIDAD` | ⚠️ bloqueada |
| 32 | Golpe Letal | Fuerza | `ATAQUE` | ✅ lista |
| 36 | Toxina Acumulada | Inteligencia | `DEBILIDAD` — se intensifica con cada golpe | ⚠️ bloqueada |
| 40 | Última Dosis *(capstone)* | Destreza | `ATAQUE` + `DEBILIDAD` | ⚠️ bloqueada |

**3 de 8 listas** (16/24/32). Destreza mayoría (3/8: 12/16/40) con inteligencia/constitución/
voluntad/fuerza repartidas.

### Asesino Danzante — movilidad y fluidez, ágil más que sigiloso

Mapea casi todo a `AGUANTE`/`ATAQUE`, ambos ya listos:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Paso de Danza | Destreza | `AGUANTE` | ✅ lista |
| 16 | Golpe Fluido | Destreza | `ATAQUE` | ✅ lista |
| 19 | Giro Evasivo | Constitución | `AGUANTE` | ✅ lista |
| 24 | Cadena de Golpes | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Ritmo de Combate | Voluntad | `RECUPERACION` | ✅ lista |
| 32 | Danza Mortal | Destreza | `ATAQUE` | ✅ lista |
| 36 | Esquiva Perfecta | Inteligencia | `AGUANTE` — predices el golpe y lo esquivas | ✅ lista |
| 40 | Vals del Filo *(capstone)* | Destreza | `ATAQUE` + `AGUANTE` | ✅ lista |

**8 de 8 listas.** Destreza mayoría (4/8: 12/16/32/40) con constitución/fuerza/voluntad/inteligencia
repartidas.

### Asesino Selecto — marca a un rival y se especializa contra él

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Marca del Cazador | Inteligencia | `AUMENTO` — bonus permanente contra el objetivo marcado mientras dure el combate | ⚠️ bloqueada |
| 16 | Golpe Marcado | Destreza | `ATAQUE` — daño extra contra el objetivo marcado | ✅ lista |
| 19 | Instinto de Caza | Voluntad | `AGUANTE` | ✅ lista |
| 24 | Golpe Selecto | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Ventaja del Cazador | Inteligencia | `AUMENTO` | ⚠️ bloqueada |
| 32 | Golpe Certero | Destreza | `ATAQUE` | ✅ lista |
| 36 | Sentencia | Constitución | `ATURDIMIENTO` | ✅ lista |
| 40 | Ejecución del Elegido *(capstone)* | Destreza | `ATAQUE` — daño masivo solo contra el objetivo marcado | ✅ lista |

**6 de 8 listas** (16/19/24/32/36/40). Destreza mayoría (3/8: 16/32/40) con inteligencia/voluntad/
fuerza/constitución repartidas.

**Asesino completo**: Maestro Asesino 7/8, Tóxico 3/8, Danzante 8/8, Selecto 6/8.

---

## Druida (exclusiva de Faerus) — repaso a fondo

Clase nueva del todo en el motor. Ningún hueco toca Magia.

### Tronco común (nivel 1-10)

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 1 | Instinto Natural | Inteligencia | `ANALISIS` | ✅ lista |
| 4 | Reflejos Salvajes | Destreza | `AGUANTE` | ✅ lista |
| 6 | Aliento del Bosque | Voluntad | `RECUPERACION` | ✅ lista |
| 8 | Zarpazo | Fuerza | `ATAQUE` | ✅ lista |

### Cambiaformas — se transforma en fauna real de territorio Faerus

Nombres de fauna real ya establecida (Llanuras del Viento Rojo/El Margen Silencioso, zonas Faerus),
sin animales del mundo real — ver [flora-fauna.md § El Margen Silencioso](flora-fauna.md#fauna--el-margen-silencioso-interior-de-la-selva-añadido-2026-08-23)
para Hetris/Mekiosi/Vistue. Los dos últimos huecos no atan a ninguna forma concreta, transformación
parcial genérica:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Forma de Ferike | Fuerza | `ATAQUE` — garra desgarradora | ✅ lista |
| 16 | Forma de Hetris | Destreza | `ATAQUE` | ✅ lista |
| 19 | Forma de Gargantúa | Constitución | `AGUANTE` — placas óseas, resistencia bruta | ✅ lista |
| 24 | Forma de Vistue | Voluntad | `RECUPERACION` | ✅ lista |
| 28 | Forma de Mekiosi | Fuerza | `ATAQUE` | ✅ lista |
| 32 | Garras Primigenias | Destreza | `ATURDIMIENTO` — transformación parcial, sin forma concreta | ✅ lista |
| 36 | Instinto Bestial | Constitución | `AGUANTE` — sentidos e instintos afilados, sin forma concreta | ✅ lista |
| 40 | Forma Ancestral *(capstone)* | Fuerza | `CONVERSION` + `ATAQUE` — todas las formas a la vez | ✅ lista |

**8 de 8 listas.** Fuerza mayoría (3/8: 12/28/40) con destreza/constitución/voluntad repartidas.

### Aullador — vínculo de manada, tan bloqueada como Domador

No usa `COMPANERO` (eso es adiestramiento, cosa de Domador) — todo pasa por `INVOCACION`, incluido
el capstone, que invoca a **Vaeth, el Eco de la Manada** (ver
[flora-fauna.md § El Margen Silencioso](flora-fauna.md#fauna--el-margen-silencioso-interior-de-la-selva-añadido-2026-08-23)),
no fauna cazable sino un espíritu ligado al propio silencio de la región:

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Llamada de la Manada | Carisma | `INVOCACION` | ⛔ multi-objetivo |
| 16 | Aullido de Coordinación | Voluntad | `AUMENTO` (a la bestia invocada) | ⚠️⛔ duración + multi-objetivo |
| 19 | Eco de la Manada | Inteligencia | `INVOCACION` — un espíritu menor de la manada | ⛔ multi-objetivo |
| 24 | Aullido de Guerra | Fuerza | `ATURDIMIENTO` | ✅ lista |
| 28 | Instinto de Manada | Constitución | `AGUANTE` | ✅ lista |
| 32 | Llamada Feroz | Voluntad | `AUMENTO` | ⚠️ bloqueada |
| 36 | Aullido Ancestral | Carisma | `DEBILIDAD` — desmoraliza al rival | ⚠️ bloqueada |
| 40 | Invocación del Ancestro *(capstone)* | Carisma | `INVOCACION` — invoca a Vaeth, el Eco de la Manada | ⛔ multi-objetivo |

**Solo 2 de 8 listas** (24/28). Carisma mayoría (3/8: 12/36/40) con voluntad/inteligencia/fuerza/
constitución repartidas.

### Salvaje — daño bruto feral, garras y colmillos

| Nivel | Habilidad | Atributo | Efecto | Estado |
|---|---|---|---|---|
| 12 | Garras Desgarradoras | Fuerza | `ATAQUE` | ✅ lista |
| 16 | Mordisco Feroz | Destreza | `ATAQUE` | ✅ lista |
| 19 | Instinto Asesino | Constitución | `ATURDIMIENTO` | ✅ lista |
| 24 | Embestida Salvaje | Fuerza | `ATAQUE` | ✅ lista |
| 28 | Furia Primal | Voluntad | `RECUPERACION` | ✅ lista |
| 32 | Zarpazo Doble | Destreza | `ATAQUE` | ✅ lista |
| 36 | Colmillos Afilados | Fuerza | `ATAQUE` | ✅ lista |
| 40 | Furia Desatada *(capstone)* | Fuerza | `ATAQUE` + `ATURDIMIENTO` | ✅ lista |

**8 de 8 listas.** Fuerza mayoría (4/8: 12/24/36/40) con destreza/constitución/voluntad repartidas.

### Adaptado — versátil, la más equilibrada de las 4

6 atributos distintos en 8 huecos, coherente con la identidad de "se adapta a lo que haga falta":

| Nivel | Habilidad | Atributo | Efecto | Rol | Estado |
|---|---|---|---|---|---|
| 12 | Golpe Adaptado | Fuerza | `ATAQUE` | ataque | ✅ lista |
| 16 | Piel Cambiante | Constitución | `AGUANTE` | defensa | ✅ lista |
| 19 | Adaptación Rápida | Inteligencia | `CONVERSION` — tu golpe adopta el atributo que mejor contrarresta al rival | utilidad | ✅ lista |
| 24 | Instinto Adaptativo | Voluntad | `RECUPERACION` | utilidad | ✅ lista |
| 28 | Contragolpe Natural | Destreza | `ATAQUE` (reactivo) | ataque | ✅ lista |
| 32 | Reflejos Cambiantes | Destreza | `AGUANTE` | defensa | ✅ lista |
| 36 | Aullido Adaptativo | Carisma | `ATURDIMIENTO` | utilidad | ✅ lista |
| 40 | Forma Perfecta *(capstone)* | Fuerza | `CONVERSION` + `ATAQUE` | ataque | ✅ lista |

**8 de 8 listas.** 3 ataque / 2 defensa / 3 utilidad, la especialización más repartida en atributos
de toda la sesión.

**Druida completo**: Cambiaformas 8/8, Aullador 2/8, Salvaje 8/8, Adaptado 8/8.

---

## Las 9 clases, resumen final de bloqueo

Repaso a fondo completo (tronco + especializaciones) de las 9 clases. Recuento de huecos listos
sobre 8 por especialización:

| Clase | Especializaciones (listas/8) |
|---|---|
| Guerrero | Berserker 1, Guardián 1, Lancero 2, Especialista 4 |
| Cazador | Domador 0, Supervivencia 1, Tirador 5, Instintivo 4 |
| Chamán | Totémico 3, Rúnico 2, Convocador 1, Opresor 2 |
| Arquero | Maestro Arquero 7, Maestro Ballestero 7 |
| Caballero | Orden 6, Valor 3, Dolor 7 |
| Segador | Parca 3, Maldito 4, Ilustrado 6, Transmutador 2 |
| Asesino | Maestro Asesino 7, Tóxico 3, Danzante 8, Selecto 6 |
| Druida | Cambiaformas 8, Aullador 2, Salvaje 8, Adaptado 8 |

Patrón consistente en las 34 especializaciones: lo bloqueado es siempre `AUMENTO`/`DEBILIDAD`/
`CANALIZAR`/`RETIRAR`/`CURAZION`/`REFLEJAR` (duración de turnos) o `INVOCACION`/`COMPANERO`/
`MULTIPLE`/`CONTROL` (combate multi-objetivo) o `PROVOCACION` (efecto todavía sin dar de alta) —
nunca falta de diseño. Todo lo demás (`ATAQUE`/`ATURDIMIENTO`/`AGUANTE`/`ANALISIS`/`RECUPERACION`/
`CONVERSION`) ya funciona hoy en el motor tal cual está escrito aquí.

**Corrección 2026-08-23 (verificación independiente contra el motor real):** el enum `AbilityEffect`
real tiene 2 valores más ya implementados que esta pasada no llegó a usar en ninguna de las 34
tablas — `LETAL` (turnResolution.ts, condición de muerte instantánea) y `LIMITADA` (tope de usos
por combate, `maxUsesPerCombat`/`NpcState.abilityUsesThisEncounter`). Ninguna habilidad de arriba
está mal clasificada por su culpa (ninguna los necesitaba), pero alguna futura especialización
podría usarlos como ✅ listos en vez de inventar un efecto bloqueado — tenerlo en cuenta en la
siguiente pasada de diseño de clases.

*(Documentación de las 9 clases completa. Pendiente: aplicar al motor cuando se decida, y anotar en
genesis.md/razas.md la pieza de lore del Chamán — ver sección Chamán arriba.)*

---

## Fase de diseño cerrada (2026-08-24)

**Las 9 clases se dan por cerradas por ahora** (petición explícita: "vamos a dar las clases de
momento por cerradas todas, no solo las que edité yo") — incluye Chamán Rúnico/Convocador/Opresor y
las 5 clases sin repasar a fondo (Arquero/Caballero/Mago/Segador/Asesino/Druida), no solo las que la
autora reescribió con el formato de tiradas graduadas. En el futuro se retomará para hacer las
habilidades de todas más complejas (mismo patrón de umbrales por diferencia que ya tienen Guerrero/
Cazador/Chamán Totémico) — hasta entonces, esto es la versión de referencia.

## NPCs existentes y su clase (documentado, sin aplicar salvo Gorhorn)

Petición explícita: revisar todos los NPC con stats reales (`backend/src/scripts/worldCatalog.ts`,
15 en total, los mismos de [npcs.md](npcs.md)) y asignarles la clase de las 9 que mejor encaje. **La
columna "clase real" es la que ya existe hoy en el catálogo y SÍ tiene efecto en combate** (el motor
ya usa `NpcState.clase` para darle a un NPC enemigo las habilidades de `classAbilities.ts` — hoy
limitado a Guerrero/Cazador, las únicas que el motor conoce). **La columna "clase aspiracional" es
solo diseño**, mismo criterio que el resto de este documento — no se toca el catálogo real salvo
donde se indica.

| NPC | Raza | Clase real (motor hoy) | Clase aspiracional | Especialización sugerida | Nota |
|---|---|---|---|---|---|
| Gistera Koh | orcos | Cazador | Cazador (se mantiene) | Supervivencia | fugitiva superviviente, encaja tal cual |
| Guerrero orco expulsado | orcos | Guerrero | Guerrero (se mantiene) | Berserker | "impredecible según cómo se le aborde" |
| Cazadora Serhu | orcos | `'Cazadora'` ⚠️ | Cazador | Instintivo | **typo real en catálogo** — `'Cazadora'` no es un valor de `Clase` válido (el tipo es `'Guerrero' \| 'Cazador'`), hoy no le da NINGUNA habilidad de clase en combate; destreza dominante, lanza, sin arco → Instintivo, no Tirador |
| Torgash Ketg | orcos | Guerrero | Guerrero (se mantiene) | **Guardián**, no genérico | fuerza+constitución+voluntad muy altas parejas, "prefiere pactar a duelar" — tanque/líder, no rabia |
| Mercader de paso | orcos | — | — | — | no combatiente, correcto dejarlo así |
| Oficial de la Concordia | goirntes | Guerrero | **Caballero** (exclusiva Goirnte) | Caballero del Orden | disciplina/orden Goirnte encaja mejor que Guerrero genérico — recomendación, no aplicada |
| Orco enfurecido | orcos | Guerrero | Guerrero (se mantiene) | Berserker | rabia descontrolada, ataca sin hablar |
| Peregrino de los Túmulos | orcos | — | — | — | no combatiente, `INOFENSIVO` |
| Soldado de la Concordia | goirntes | Guerrero | **Caballero** | Caballero del Orden | mismo razonamiento que el Oficial |
| Ulkha Ketg | orcos | — | **Chamán** (nuevo, exclusiva orcos) | Totémico | comunión con las Gargántuas ya establecida en su lore — hueco real sin cubrir hasta ahora |
| Yovenne Tal | goirntes | — | — | — | política/legal pura, correcto dejarla sin clase |
| Vrask Ombra | goirntes | — | **Caballero** (nuevo) | Caballero del Valor | General sin ninguna clase asignada era un hueco real, a diferencia de Yovenne (puramente política) |
| Kael Dorn | goirntes | — | — | — | roto/escondido, `INOFENSIVO`, no combatiente |
| Hagar Kiugh | orcos | — | — | — | minero, `INOFENSIVO` pese a fuerza alta — fuerza física ≠ entrenamiento de combate |
| Sella Marn | nabieus | — | *(sin asignar, ver nota)* | — | única Nabieus con stats — Segador (su clase exclusiva) no encaja temáticamente con una traficante de información; se deja sin clase a propósito, revisar si algún día se necesita que combata |

**Resumen de recomendaciones que cambian algo respecto al catálogo real** (todas sin aplicar,
documentación pura): Oficial/Soldado de la Concordia pasarían de Guerrero a Caballero; Ulkha Ketg y
Vrask Ombra pasarían de sin clase a Chamán/Caballero respectivamente. El typo `'Cazadora'` de
Cazadora Serhu es un bug real menor (hoy la deja sin ninguna habilidad de clase en combate) — no
corregido a propósito, fuera del alcance de "cambiar ya" que solo cubre a Gorhorn.

**Superado por una pasada posterior (2026-08-24, Grupo 3 § Sistema de clases, "todos los NPC deben
tener una clase asignada al acabar esta implementación")**: esta tabla es la recomendación previa a
esa instrucción explícita — la pasada real que se aplicó fue más estricta (los 15 NPC humanoides
del catálogo SÍ tienen clase/especialización real hoy, incluidos los que esta tabla marcaba "no
combatiente, correcto dejarlo así": Mercader de paso, Peregrino de los Túmulos, Kael Dorn, Hagar
Kiugh, Yovenne Tal y Sella Marn) y en varios casos difiere de la especialización sugerida aquí
(razonada de nuevo contra la bio/personality real de cada NPC en el momento de aplicarla, no
copiada de esta tabla) — ver `tarkor_sistema_clases_aplicado_2026-08-24` en la memoria del proyecto
para el detalle NPC a NPC realmente aplicado. El typo `'Cazadora'` SÍ se corrigió en esa pasada.

## Gorhorn deja de ser dual-clase (2026-08-24, APLICADO al motor)

A diferencia de todo lo anterior, este cambio **sí se aplicó de verdad**: `classAbilityUnlocksFor`
(`classAbilities.ts`) filtraba antes solo por nivel, dando a Gorhorn las habilidades de clase de
Guerrero Y Cazador a la vez ("variante especial"). Ahora filtra también por `clase: 'Cazador'`, como
tendría que hacer cualquier personaje de una sola clase futuro — Gorhorn pierde las 4 de Guerrero
(Grito de Guerra, Detectar Puntos Débiles, Grito tenebroso, Contraataque) y se queda con las 3 de
Cazador (Analisis Salvaje, Barrido Salvaje, Compañero cazador). Tests actualizados
(`classAbilities.test.ts`), `tsc -b` limpio, 12/12 en verde.

La usuaria va a probar la rama **Domador** con él — pero esa especialización en sí sigue siendo solo
diseño (`§ Cazador — Domador` arriba), el motor hoy no tiene ningún concepto de especialización más
allá de la lista plana de 3 habilidades de Cazador. "Probar Domador" hoy significa jugar a Gorhorn
como Cazador puro, sin las ramas de nivel 10+ todavía construidas.
