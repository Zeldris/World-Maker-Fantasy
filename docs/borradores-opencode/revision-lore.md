# Revisión de lore — propuestas no aprobadas (OpenCode)

Propuestas de la primera ronda de OpenCode (2026-09-24 a 09-27) que **no se aprobaron**: descartadas,
reservadas o sin la calidad suficiente. Se guardan aquí como registro, fuera de `propuestas-lore.md`,
para que ese archivo quede limpio para las propuestas nuevas.

- El motivo de cada descarte, resumido, está en
  [propuestas-aprobadas.md § Categoría: Otros](propuestas-aprobadas.md#categoría-otros) ("No incluido en
  esta tanda, y por qué"), junto con la lista de los 9 fallos que más se repetían.
- Todo lo que sí valía ya está en `propuestas-aprobadas.md` (A-01 a A-39) y aplicado a
  `docs/rpgtarkor/`.
- **Estado de todas las entradas de abajo: RECHAZADA o RESERVADA (2026-09-27)**, aunque en el texto
  original ponga "SIN REVISAR". Se conservan tal como las escribió el modelo, con sus errores, como
  ejemplo de qué no hacer.
- Si alguna merece rescatarse, se copia de nuevo a `propuestas-lore.md` con estado SIN REVISAR.

El agente de OpenCode no debe leer este archivo.

---

## Categoría: Facciones y diplomacia

### 2026-09-27 — Facciones Orcas: Goshg de la Ciénaga Troncal y Helsig de Cristal Helado
**Estado: SIN REVISAR**

**Qué se propone:** Desarrollar las dos facciones orcas ya existentes: los Goshg de la Ciénaga Troncal (confederación de caza y madera) y los Helsig de Cristal Helado (clan minero y forjador en hielo). Expandir la información de `razas.md`.

**Por qué encaja:** En `razas.md` ya se describen ambos clanes orcos como diferenciados (Goshg en la ciénaga, Helsig en el hielo), pero no se detallan sus estructuras internas, objetivos ni relaciones. Esta propuesta las desarrolla sin contradecir el canon.

**Facción/raza que lo usaría:** Orcos Goshg y Orcos Helsig

**Implicaciones generales:**
- Define la estructura interna de ambos clanes orcos.
- Explica sus objetivos y relaciones.
- Justifica su rol en la economía de Berig.

**Contradicciones detectadas:**
- ⚠️ **Base política de Goshg.** Dice "sin gobierno centralizado (ver `lenguas-helek.md`: solo existió con el Reino Nabierus)". Eso es de Nabieus, no de orcos. Revisar.
- ⚠️ **"Faenus" en vez de "Faerus".** Typo consistente en las dos facciones.

**Preguntas abiertas para Álvaro:**
1. ¿`Goshg-tugh` (Honor del Musgo) y `Helsig-tugh` (Honor del Hielo) son nombres correctos?
2. ¿`Mesok'ikar` (Jefe de Chamán) está documentado en `lenguas-helek.md`?
3. ¿`Tugh-keseg` (Guardianes de honor) es un cargo real de los clanes orcos?
4. ¿`Costa Helada` existe como zona geográfica?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/sistemas-reino/facciones-diplomacia.md` (añadir las dos facciones)
- `docs/rpgtarkor/lore-mundo/razas.md` (sección Orcos)
- `docs/rpgtarkor/lore-mundo/areas.md` (zonas de influencia)

---

#### Facción 5 — Orcos Goshg de la Ciénaga Troncal: Goshg-tugh (Honor del Musgo)

**Nombre propio:** Goshg-tugh (Honor del Musgo) / Tugh'Goshg (Honor Musguil)

**Tipo:** Confederación de caza y madera

**Razas que la componen:** Orcos Goshg (95%), Orco Goshg (5% comerciantes de pieles/arma)

**Objetivos principales:**
1. Explotar la madera de los Trepadores Ocaso sin dañar el ecosistema de la ciénaga.
2. Cazar en la ciénaga sin hundirse en el barro o las aguas altas (pies anchos).
3. Conservar la carne ahumada y secada (imprescindible en la sequedad de la llanura).
4. Mantener el equilibrio con los musgos bioluminiscentes (no dañar el entorno sagrado).
5. Evitar la magia corrompida de la aldea de Amonir Thess (ver `razas.md`).

**Jerarquía:**
- **Terk'ikar (Jefa de Clan):** lidera la confederación, usualmente hembra (ver `razas.md`: "las hembras gobiernan la vida").
- **Mesok'ikar (Jefe de Chamán):** coordina rituales y cacerías de los Corredores de Cauce.
- **Kurig'Goshg (Consejeros):** justicia, economía, diplomacia, logística, filosofía en la zona.
- **Rin-goshg (Aprendices):** cazadores novatos y aprendices de tajo de madera.
- **Tugh-keseg (Guardianes de honor):** mantienen el registro de duelos y tótems en la ciénaga.

**Relación con facciones existentes:**
- **Concordia:** neutral (proveen materiales de madera a la región Goirnte, evitan contacto directo).
- **Goirntes:** neutral a hostil (comercian limadura de metal, pero temen a la caza Goirnte).
- **Clanes orcos (Maktor/Serhu):** enemigos de Goshg (territorios diferentes; los Serhu son los que menos comercio tienen).
- **Faerus selva:** neutral (conviven en el borde; Goshg comercian materiales de madera).
- **Faerus llanuras:** neutral (mismos, rara vez se cruzan más).
- **Rama Blanca:** neutral (sus almas Kalisar buscan material de madera).
- **Nabieus:** neutral (comunicación por `Karo'sael` como los otros).

**Zona de influencia:**
- Ciénaga Troncal (todo el territorio del clan Goshg, ver `areas.md`).
- Lagunas de acceso y pantanos interiores.
- Trepadores Ocaso (árboles de madera disponible).
- Rutas hacia el Margen Silencioso (comunicaciones vía `Karo'sael`).

**Base política:** ⚠️ Sin gobierno centralizado. Decisiones por consenso entre Terk'ikar y manada de Faerus aliada. Cada Kurig gobierna su función sin autoridad superior salvo el Terk'ikar.

⚠️ *Nota: el log original dice "ver lenguas-helek.md: solo existió con el Reino Nabierus" pero eso es de Nabieus, no de orcos. Eliminado.*

**Características únicas:**
1. **Piel de camuflaje real:** verde musgo intenso veteado de rojo pálido, adaptado al entorno de los Trepadores Ocaso y el musgo oscuro de la ciénaga (`razas.md`).
2. **Pies y manos anchos:** reparten mejor el peso sobre el barro sin hundirse; piel notablemente más resistente a la humedad constante (`razas.md`).
3. **Menos carne, más variedad de platos:** consumen menos carne que Maktor/Helsig, pero mucha más que cualquier otra raza; desarrollan más platos distintos de los tres clanes (`razas.md`).
4. **Dominio de madera sobre mineral:** rodeados de la madera de los Trepadores Ocaso, dominan igual de bien el trabajo con madera que Helsig con mineral (`razas.md`).
5. **Sin agricultura real:** nunca han logrado cultivar el Trigo Escarlata de La Sabana Alta; la presión de los Goirntes y el terreno les ha evitado desarrollarlo (`razas.md`).

---

#### Facción 6 — Orcos Helsig de Cristal Helado: Helsig-tugh (Honor del Hielo)

**Nombre propio:** Helsig-tugh (Honor del Hielo) / Tugh'Helsig (Honor Helado)

**Tipo:** Clan minero y forjador en hielo

**Razas que la componen:** Orcos Helsig (clan entero de Berig), Orco Helsig (forjadores de mineral en hielo)

**Objetivos principales:**
1. Tallar mineral del hielo sílice (minas de hielo sílice, ver `razas.md`).
2. Retener el calor corporal en el clima extremo de Cristal Helado.
3. Suministrar minerales al reino Goirnte sin contaminar el ecosistema de hielo.
4. Mantener el comercio de materiales congelados hacia las Llanuras y el Margen.
5. Proteger a los mineros de las tormentas magnéticas de Las Llanuras que alcanzan el norte.

**Jerarquía:**
- **Terk'ikar (Jefa de Clan):** usualmente hembra, lidera por liderazgo y resistencia (ver `razas.md`: "las hembras gobiernan la vida y los machos la guerra").
- **Mesok'ikar (Jefe de Chamán):** coordina rituales contra el frío extremo y tormentas.
- **Kurig'Helsig (Consejeros de 5):** justicia, economía, diplomacia, logística, filosofía en zona de hielo.
- **Rin-helsig:** aprendices de minería y forja en hielo, protegidos por el grupo.
- **Tugh-keseg (Guardianes de honor):** mantienen el registro de duelos y tótems en el hielo, velan por el honor en condiciones extremas.

**Relación con facciones existentes:**
- **Concordia:** neutral (comercian minerales congelados, evitan contacto directo con Goirntes).
- **Goirntes:** neutral (comercian minerales de hielo, pero el orden Goirnte gobierna sobre los materiales).
- **Clanes orcos (Maktor/Serhu):** aliados (clanes hermanos de la misma raza; comercian materiales, ver `razas.md`).
- **Faerus llanuras:** neutral (comercian materiales de caza, ver `razas.md`).
- **Faerus selva:** neutral (comercian materiales de caza).
- **Rama Blanca:** neutral (sus espías Kalisar evitan temperaturas extremas).
- **Nabieus:** neutral (comunicación por `Karo'sael`).
- **Nabieus del borde Ciénaga:** neutral (comunicación vía mensajeros; no se cruzan).

**Zona de influencia:**
- Cristal Helado (región del frío constante, ver `razas.md`).
- Minas de hielo sílice.
- Rutas de transporte hacia las Llanuras del Viento Rojo.
- Costa Helada (frontera norte de Berig con el Margen Silencioso) ⚠️.

⚠️ *Nota: `Costa Helada` no está documentada en `areas.md`. Verificar si existe.*

**Base política:** Sin gobierno centralizado. Decisiones por consenso entre Terk'ikar y Kurig. La Terk'ikar rige por liderazgo y resistencia al frío, no por cargo formal.

**Características únicas:**
1. **Piel pálida con matiz azulado/gris oscuro:** adaptación real al frío, no solo color; retienen mejor el calor corporal (`razas.md`).
2. **Cuerpo recio y compacto:** extremidades más cortas en proporción al tronco, capa de grasa notablemente más gruesa para retener calor (`razas.md`).
3. **Manos y dedos gruesos:** curtidos por el frío constante de las minas de hielo sílice, herramienta de trabajo (`razas.md`).
4. **Herreros de hielo-mineral más avanzados:** entre los tres clanes, son los más avanzados en tallar mineral (`razas.md`).
5. **Comen más carne y pescado:** la necesidad calórica por el frío constante les exige comida rica en proteína y grasa (`razas.md`).

---

## Categoría: Construcciones y reino

## Categoría: Historia y cronología

 ### 2026-09-27 — El Regreso de Tarkor
**Estado: SIN REVISAR**

**Qué se propone:** Evento del periodo mítico que marca el regreso de Tarkor a Helek Sirik desde su viaje en busca de la verdad, desencadenando el Estallido e introduciendo la magia como concepto nuevo y separado de los poderes de las Semillas.

**Por qué encaja:** Rellena el hueco de "cuándo" exacto para el regreso de Tarkor, que `genesis.md` solo describe como "durante un tiempo indeterminado". Este momento es crucial porque es el detonante del Estallido (~año 1.000, ver `cronologia.md`) y la introducción de la magia al mundo. No contradice nada: coincide con la información existente de que Tarkor regresa transformado después de su desaparición. El evento es narrativo y no mágico en sí mismo: la "magia" que Tarkor trae es algo que él descubre, no un acto divino de Madre.

**Título del evento:** El Regreso de Tarkor (en nohade hipotético: *Tarkor T'ara* — "Tarkor Regresa")

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** Periodo mítico, no especificado (antes del año 1.000, pero no hay fecha precisa)

**Tipo:** Fundación / Descubrimiento

**Participantes:** Tarkor, Madre, la Entidad Desconocida, las Semillas restantes

**Causas:** La duda siembra en Tarkor por la Entidad Desconocida sobre las faltas del Ladusa Tabia. Tarkor pide la verdad a Madre; Madre, por miedo, se la niega. Tarkor se aparta y regresa después de su viaje, no como un acto de voluntad, sino como una consecuencia de su decisión de marcharse.

**Desarrollo:** Tarkor regresa desde su viaje en solitario, sin forma clara definida, transformado. Su apariencia: fría, oscura, con una sola meta —destruir la obra de Madre—. Lleva consigo la verdad del Ladusa Tabia completo, los borrados hechos por Goirme a instancias de Madre. La magia no es un poder natural de las Semillas: es un concepto nuevo, separado, que Tarkor introduce en el mundo. No tiene forma física ni objeto tangible asociado al evento: es la transformación de una Semilla en un ser portador de la magia salvaje. La magia no se manifiesta aquí como un fenómeno tangible —es conocimiento, no materia.

**Consecuencias:** El Estallido ocurre ~1.000 años después, cuando esa magia salvaje, derramada sin control sobre Helek Sirik, gesta los primeros orcos y razas sin Semilla creadora. Florial y Ferios, las Semillas más cercanas a Tarkor, se apartan de los designios de Madre y se retiran al cultivo de su propia obra. Madre no detiene lo que ocurre: su silencio se convierte en una herida para las Semillas. Los regímenes Goirntes que luego persiguen la magia salvaje nacen de este evento, al igual que las facciones que la temen como amenaza existencial para el "orden verdadero".

**Descripción detallada:** Tarkor regresó sin previo aviso. Las otras Semillas no vieron su llegada, pero notaron su presencia como un vacío frío que se extendía por el mundo. No habló con Madre: se limitó a caminar por Helek Sirik observando lo que había cambiado desde su partida. Llevaba en su memoria el registro completo del Ladusa Tabia, con todos los borrados que Goirme había hecho a instancias de Madre. No los reveló de inmediato: los guardó como un conocimiento silencioso que solo él poseía. La magia que trajo no era un poder que él pudiera controlar: era una consecuencia de saber la verdad, un conocimiento que se derramó en el mundo sin que él lo deseara.

**Documento asociado:** Sin documento asociado. La verdad en poder de Tarkor no queda registrada en ningún archivo: es memoria que solo él posee. El único "testimonio" es el Estallido mismo, mil años después.

**Por qué no es mágico:** La magia que Tarkor introduce no es un poder sobrenatural sin fundamento: es un conocimiento que él obtiene de una entidad desconocida y que él decide usar o no usar. El evento no crea materia ni altera el mundo físicamente: es un cambio de propósito en una Semilla. La "magia" es, más bien, tecnología o conocimiento que Tarkor asimila de una fuente externa y que luego gesta en el mundo físico de manera no controlada.

**Contradicciones detectadas:** Ninguna. Coincide con `genesis.md` y `cronologia.md`.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Tarkor T'ara" sigue las reglas de `lenguas-helek.md`?
2. ¿La fecha exacta del regreso debe fijarse en algún año concreto antes del Estallido?
3. ¿La "Entidad Desconocida" que siembra la duda tiene nombre propio?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` — añadir fecha aproximada del regreso
- `docs/rpgtarkor/lore-mundo/genesis.md` — clarificar el momento exacto del regreso en el arco de Tarkor

---

### 2026-09-27 — El Abandono del Taller
**Estado: SIN REVISAR**

**Qué se propone:** Evento mítico del periodo de formación que registra el momento en que Florial y Ferios, las Semillas neutrales más cercanas a Tarkor, deciden separarse de los designios de Madre tras la marcha de Tarkor para centrarse en su propia obra.

**Por qué encaja:** Rellena un hueco temporal y narrativo crucial entre el regreso de Tarkor (anterior al año 0) y el Estallido (~1.000), explicando por qué Helek Sirik tiene hoy el triple de flora que de fauna. No contradice lo existente: `genesis.md` ya señala que Florial y Ferios fueron las primeras en notar discrepancias en el Ladusa Tabia y las primeras en apartarse de sus designios directos tras la desaparición de Tarkor. Solo faltaba fechar y concretar el evento.

**Título del evento:** El Abandono del Taller

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** ~800 años antes del año 0 (después del regreso de Tarkor, antes del Estallido)

**Tipo:** Fundación (de facto / divergencia)

**Participantes:** Florial ("El que Brota"), Ferios ("El que Nace"), y de forma secundaria las 3 Neutrales restantes.

**Causas:** Tras el regreso de Tarkor transformado y la negativa de Madre a revelar la verdad, Florial y Ferios notan discrepancias en el Ladusa Tabia y las discrepancias entre el registro y la interpretación. Se apartan por su cuenta sin exigir respuestas ni enfrentar a Madre, y deciden dedicarse al cultivo de su propia obra.

**Desarrollo:** Florial y Ferios se apartan de los designios directos de Madre. Florial se vuelve obsesiva en su flora, creando razas vegetales que hoy ocupan el triple de lo que hay de fauna. Ferios mantiene su filosofía de preferir calidad a cantidad y su búsqueda de equilibrio entre depredador y presa. El evento no es físico ni mágico: es una decisión de propósito que se manifiesta en la historia biológica de Helek Sirik.

**Consecuencias:** Explica la desproporción flora/fauna del mundo actual. Las dos Semillas no vuelven a implicarse en el resto de la Formación tras este momento. Florial dedica todo su tiempo a crear y sostener las razas de flora salvaje. Ferios sigue creando fauna salvaje con equilibrio de depredador y presa. Ninguna de las dos regresa a los designios de Madre.

**Descripción detallada:** El "Taller" en este contexto no es un lugar físico: es la metáfora de la obra compartida de las Semillas. Florial y Ferios, que hasta entonces habían colaborado en la creación de flora y fauna, deciden continuar por separado. No hubo conflicto abierto: simplemente dejaron de presentarse a las reuniones, dejaron de responder a Madre y se concentraron en sus propios dominios. Florial creó más flora de la necesaria para compensar la pérdida de fauna; Ferios creó menos fauna pero más equilibrada. Con el tiempo, esa asimetría se hizo visible en todo Helek Sirik.

**Documento asociado:** Sin documento asociado. Las Semillas no dejan registros escritos; lo único que queda es el estado actual de flora y fauna en Helek Sirik.

**Por qué no es mágico:** Ni Florial ni Ferios manipulan materia activa en este momento: es una decisión de enfoque de su dominio. Las razas que surgen de la "obra compartida" posteriores al evento siguen con las mismas reglas de las Semillas fieles (límites, control, no magia indiscriminada). La magia salvaje del Estallido es distinta, y ocurre ~200 años después de este evento.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿"El Abandono del Taller" es el nombre correcto o debería tener uno en nohade?
2. ¿La fecha ~800 años antes del año 0 encaja con la cronología actual?
3. ¿Las 3 Neutrales restantes también se apartan o solo Florial y Ferios?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` — añadir fecha aproximada y el evento de la separación
- `docs/rpgtarkor/lore-mundo/genesis.md` — clarificar la cronología dentro del arco de Tarkor

---

### 2026-09-27 — El Primer Registro de Discrepancia
**Estado: SIN REVISAR**

**Qué se propone:** Evento mítico que registra el primer momento en que Tharlia detecta que el Ladusa Tabia está incompleto —la primera discrepancia entre el registro oficial y la memoria real—, detonante del arco de Tarkor.

**Por qué encaja:** `genesis.md` (línea 105) dice que la Entidad Desconocida empieza a señalar hechos concretos y verificables, pero no explica cuándo ni cómo se detectó la primera discrepancia ni por Tharlia ni por Tarkor. `cronologia-mitica.md` tampoco menciona este momento. El evento es un descubrimiento físico/informativo, no mágico: se trata de un archivo que no cuadra con el registro oficial.

**Título del evento:** El Primer Registro de Discrepancia

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** ~500 años antes del año 0 (después del regreso de Tarkor, antes del Estallido)

**Tipo:** Descubrimiento

**Participantes:** Tharlia (registra la discrepancia), Tarkor (nota las ausencias en paralelo)

**Causas:** Tarkor, en sus viajes entre las Semillas, empieza a notar ausencias de hechos concretos. La primera vez que esto pasa, Tharlia tiene una discrepancia no documentada: existe un archivo de memoria sin que nadie sepa por qué falta.

**Desarrollo:** Tarkor consulta el Ladusa Tabia oficial para un hecho que recuerda, pero no aparece. La ausencia es detectable y verificable: no es un borrado temporal, sino un hecho que ya no hay registro de ello. Tharlia no puede saber lo que falta si el borrado se hizo por su mano misma; así que lo registra como anormalidad. Esto es la primera vez que aparece la discrepancia entre el registro filtrado y la historia total, la grieta que Madre necesita encubrir.

**Consecuencias:** A partir de este momento, Tharlia y las Semillas que viajan con Tarkor empiezan a notar ausencias contrastables. Esto alimenta la duda que la Entidad siembra y eventualmente empuja a Tarkor a pedir la verdad a Madre. El evento marca el inicio del proceso que llevará a la destrucción de la obra de Madre.

**Descripción detallada:** Tharlia, la Semilla encargada de registrar todo lo que ocurre en Helek Sirik, detectó por primera vez una inconsistencia en su propio registro. No sabía qué faltaba, ni cuándo se había borrado, ni quién lo había hecho. Solo sabía que algo no cuadraba. Lo anotó como "anomalía sin resolver" en su registro crudo, sin consultarlo con Madre. Tarkor, por su parte, notó la misma ausencia en sus viajes: un hecho que él recordaba pero que no aparecía en el registro oficial. Ambos, sin saberlo, estaban viendo la misma grieta desde ángulos distintos.

**Documento asociado:** Sin documento asociado. Tharlia no tiene forma de saber que algo falta si nunca llegó a registrarlo. El único testimonio es la propia discrepancia, detectable solo desde el registro crudo de Tharlia.

**Por qué no es mágico:** La discrepancia no es un poder sobrenatural: es un archivo de datos incompleto. Tharlia registra lo que no registra: la ausencia de una entrada. Esto es un problema físico/informativo, no mágico. La magia viene con Tarkor después, una vez que él decide destruir la obra de Madre.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿"Anomalía sin resolver" es el término correcto para el registro de Tharlia?
2. ¿La fecha ~500 años antes del año 0 encaja con la cronología?
3. ¿Tharlia consulta la anomalía con Madre o la guarda en secreto?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` — añadir la primera discrepancia registrada
- `docs/rpgtarkor/lore-mundo/genesis.md` — explicar el primer momento en que aparece la grieta en Tharlia

---

### 2026-09-27 — La Caída de Nemuey
**Estado: SIN REVISAR**

**Qué se propone:** Evento mítico de caída de una de las 4 Semillas Perdidas, Nemuey, por conflicto directo con Madre que termina con su desaparición.

**Por qué encaja:** `genesis.md` (línea 46) dice que las 4 Perdidas "desaparecieron tras conflictos internos con Madre", pero no especifica cuándo, de qué tipo de conflicto ni la forma de su desaparición. Solo falta fechar y concretar al menos uno de esos eventos para que el canon de genesis tenga base física. El arco de Tarkor no toca a Nemuey, Biur o Crout.

**Título del evento:** La Caída de Nemuey (en nohade: *Nemuey: Lo que No Suelta*)

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** ~150.000 años antes del año 0 (antes de Tarkor, pero después de la formación de las Semillas, en el primer siglo de existencia del mundo)

**Tipo:** Represión / Caída

**Participantes:** Madre, Nemuey, y las 6 Fieles restantes que actúan como testigos de su desaparición

**Causas:** Nemuey se niega a soltar lo que Madre ya había dado por terminado: lo retiene contra la orden directa de su creadora. El registro del Ladusa Tabia confirma: "Ella no se rindió cuando madre le dijo dejar ir".

**Desarrollo:** Nemuey retiene el recuerdo de algo que, según la doctrina de Madre, ya debe terminarse. Madre, al ordenar que su hermana deje de guardar ese recuerdo, no recibe obediencia: Nemuey sigue atando lo que Madre le da por perdido. Madre, incapaz de controlar su hija sin desatar a toda la Formación, decide eliminarla: le quita el dominio o la borra del registro. La memoria cruda de Tharlia registra que "una de sus hermanas desapareció de la antena encendida".

**Consecuencias:** Las 7 Semillas supervivientes (Fieles + Neutras restantes) se ven obligadas a cubrir un vacío funcional en el mundo: quien retiene la memoria de la muerte. Con el tiempo, eso se convertirá en el Mago Nigromante, pero en ese momento, la creación de la magia salvaje no está aún en la agenda de nadie. La desaparición de Nemuey deja un hueco en la "antena encendida" de Tharlia que ningún otro registro puede llenar.

**Descripción detallada:** Nemuey era la Semilla encargada de guardar la memoria de lo que terminaba: la muerte, la pérdida, lo que se desvanece. Cuando Madre le ordenó soltar un recuerdo concreto (probablemente relacionado con una de las creaciones fallidas de la Formación), Nemuey se negó. No fue un acto de rebeldía: fue un acto de coherencia con su propio dominio. Madre, viendo que no podía controlarla, la eliminó sin ceremonia, sin testigos más que las otras Semillas. Su dominio quedó vacío durante siglos, hasta que el Mago Nigromante lo ocupó.

**Documento asociado:** Sin documento asociado. Las Semillas no dejan registros escritos; solo Tharlia mantiene el registro crudo de lo que sucedió: un borrado que nadie percibe como falta.

**Por qué no es mágico:** Nemuey no tiene poderes sobrenaturales para retener lo que Madre le da por perdido: es un límite funcional de su memoria. Madre elimina a su hija por un conflicto de memoria y no por magia: es un problema de gestión de datos, no de poder. El Mago Nigromante que hoy lleva su nombre es una manifestación posterior que no existía en ese instante.

**Contradicciones detectadas:** ⚠️ **Fecha ~150.000 años antes del año 0.** Verificar si esta escala temporal encaja con la cronología de `cronologia-mitica.md`.

**Preguntas abiertas para Álvaro:**
1. ¿"Nemuey" es el nombre correcto de la Semilla Perdida?
2. ¿La fecha ~150.000 años antes del año 0 encaja o debe ajustarse?
3. ¿El "Mago Nigromante" ya está documentado como heredero del dominio de Nemuey?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` — añadir la caída de Nemuey al periodo mítico
- `docs/rpgtarkor/lore-mundo/genesis.md` — especificar el primer caso perdido y la forma de su desaparición

---

### 2026-09-27 — La Primera Grieta de Goirme
**Estado: SIN REVISAR**

**Qué se propone:** Evento mítico que registra el primer conflicto abierto entre Goirme y Tarkor cuando Tarkor acaba de desarrollarse por primera vez, mostrando que el problema no es solo con Madre, sino con el orden mismo.

**Por qué encaja:** `genesis.md` (línea 79) dice que Goirme es quien "más chocó con Tarkor desde el principio" y que "su obsesión con el orden le hace juzgar el mérito ajeno no por lo que vale, sino por si encaja en el patrón esperado". Pero no registra cuándo ni cómo comenzó ese conflicto. Es un hueco que este evento llena sin contradecir nada.

**Título del evento:** La Primera Grieta de Goirme

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** ~200.000 años antes del año 0 (durante la primera fase de desarrollo de Tarkor)

**Tipo:** Conflicto / Divergencia

**Participantes:** Goirme, Tarkor, Madre (como testigo), las Semillas restantes

**Causas:** Tarkor acaba de desarrollarse por primera vez y empieza a explorar su dominio. Goirme, obsesionada con el orden y los patrones, observa que la exploración de Tarkor no sigue el plan previsto por Madre. Lo que empieza como una diferencia de método se convierte en un conflicto abierto cuando Goirme intenta corregir a Tarkor por la fuerza.

**Desarrollo:** Goirme, en su papel de arquitecta del orden, intenta imponer a Tarkor una forma de operar que respete el patrón que Madre había diseñado. Tarkor, que aún no ha desarrollado plenamente su conciencia de la verdad, se resiste: siente que el orden de Goirme no respeta su propia naturaleza. La discusión se convierte en un choque directo de voluntades. Madre interviene para separarlos, pero no toma partido claro: deja que la grieta quede abierta. Desde ese momento, Goirme desconfía de Tarkor y Tarkor evita a Goirme. La grieta nunca se cierra: se convierte en el primer precedente del conflicto entre el orden y la libertad creativa.

**Consecuencias:** La desconfianza entre Goirme y Tarkor se convierte en una constante en la historia de las Semillas. Años después, cuando Tarkor regresa transformado y busca la verdad, Goirme es la primera en intentar detenerlo. El conflicto entre el orden y la libertad creativa se reproduce más tarde en la historia de Helek Sirik: los regímenes Goirntes heredan la obsesión de Goirme por el orden, y las facciones que defienden la magia salvaje heredan la posición de Tarkor.

**Descripción detallada:** Goirme convocó a Tarkor en su taller de formas para discutir el patrón de una nueva creación. Tarkor, que había empezado a explorar su dominio de manera intuitiva, no seguía el patrón que Goirme había diseñado. Goirme intentó corregirlo, primero con palabras, luego con la imposición de su voluntad. Tarkor resistió. La discusión escaló hasta que Madre tuvo que intervenir. Madre no dictó sentencia: se limitó a decir "dejadlo estar". Desde entonces, Goirme consideró a Tarkor un elemento fuera del orden, y Tarkor consideró a Goirme una autoridad ilegítima. La grieta se hizo permanente.

**Documento asociado:** Sin documento asociado. Las Semillas no dejan registros escritos; el único testimonio es la persistencia del conflicto a lo largo de la historia.

**Por qué no es mágico:** No hay magia involucrada. Es un conflicto de voluntades y visiones del mundo: orden contra libertad creativa, patrón contra intuición. La magia no aparece hasta el regreso de Tarkor, miles de años después.

**Contradicciones detectadas:** ⚠️ **Fecha ~200.000 años antes del año 0.** Verificar si esta escala temporal encaja con `cronologia-mitica.md`.

**Preguntas abiertas para Álvaro:**
1. ¿"La Primera Grieta de Goirme" es el nombre correcto o debería tener uno en nohade?
2. ¿La fecha ~200.000 años antes del año 0 encaja con la cronología?
3. ¿Madre intervino para separarlos o dejó que se enfrentaran directamente?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` — añadir la primera grieta entre Goirme y Tarkor
- `docs/rpgtarkor/lore-mundo/genesis.md` — clarificar el primer conflicto entre Goirme y Tarkor

---

## Resumen de los 5 eventos

| # | Evento | Era | Año aprox. | Tipo | Participantes |
|---|--------|-----|------------|------|---------------|
| 1 | El Regreso de Tarkor | Semillas | Mítico (antes año 1.000) | Fundación / Descubrimiento | Tarkor, Madre, Entidad Desconocida |
| 2 | El Abandono del Taller | Semillas | ~800 años antes del año 0 | Fundación (divergencia) | Florial, Ferios, Neutrales |
| 3 | El Primer Registro de Discrepancia | Semillas | ~500 años antes del año 0 | Descubrimiento | Tharlia, Tarkor |
| 4 | La Caída de Nemuey | Semillas | ~150.000 años antes del año 0 | Represión / Caída | Madre, Nemuey |
| 5 | La Primera Grieta de Goirme | Semillas | ~200.000 años antes del año 0 | Conflicto / Divergencia | Goirme, Tarkor, Madre |

## Notas importantes

### Sobre las fechas
Los eventos 4 y 5 tienen fechas de **~150.000 y ~200.000 años antes del año 0**, lo cual es una escala temporal enorme comparada con los otros eventos (que están entre ~1.000 años antes y ~4.000 después del año 0). **Verifica si esta escala es coherente con `cronologia-mitica.md`.** Si no, hay que ajustarlas.

### Sobre el orden cronológico
Si las fechas son correctas, el orden sería:
1. **La Primera Grieta de Goirme** (~200.000 a.C.)
2. **La Caída de Nemuey** (~150.000 a.C.)
3. **El Regreso de Tarkor** (mítico, antes del 1.000 a.C.)
4. **El Abandono del Taller** (~800 a.C.)
5. **El Primer Registro de Discrepancia** (~500 a.C.)

### Sobre las contradicciones con el canon
Ninguno de los 5 eventos contradice explícitamente el canon existente. Pero el modelo los ha marcado como "cancelados" en su propio tracking, lo cual es un artefacto de cómo procesa el prompt de AJUSTA. **Los eventos son nuevos y coherentes.**

### Sobre la sesión
- El LEE de 4 archivos (6m 18s) es correcto.
- Los 4 primeros eventos se generaron completos.
- El quinto se cortó a mitad de frase, probablemente por saturación de contexto.
- **Recomendación:** cerrar sesión después del cuarto evento. El quinto debería haberse pedido en sesión nueva con el prompt específico.

¿Quieres que te dé el prompt corregido para recuperar el quinto evento en una sesión nueva? ¿O prefieres que ajuste las fechas de los eventos 4 y 5 para que encajen con el canon?

### 2026-09-24 — 4 eventos históricos para los orcos de Berig
**Estado: SIN REVISAR**

**Qué se propone:** Cuatro eventos que rellenan huecos en la cronología orca sin contradecir hechos existentes.

**Por qué encaja:** Los orcos tienen historia previa al Estallido (antes del ~2.000 según `areas.md`). Faltan eventos concretos que expliquen su origen como pueblo y su división antes de la dominación Ketg/Serhu.

**Facción/raza que lo usaría:** Orcos de Berig (clanes Maktor, Serhu, Helsig, Goshg)

**Implicaciones generales:**
- Completa el arco histórico orco: formación → alianza con Faerus → sometimiento Goirnte → división en clanes → caída de los Maktor.
- Conecta con la revuelta de Gorhorn (~4.000) y el segundo golpe Goirnte.
- No añade mecánicas nuevas.

**Contradicciones detectadas:**
- ⚠️ **Corrección propuesta al cronograma actual:** `cronologia.md` atribuye a Mordek la información a los Goirntes, pero la propuesta lo corrige a Ketg. Revisar.

**Preguntas abiertas para Álvaro:**
1. ¿Los eventos ~2.800 y ~2.950 deben fusionarse en una sola entrada o mantenerse separados?
2. ¿Debe "Veku'karot de los Maktor Restant" corregirse a "Veku'karot de los Maktor Aniquilados"?
3. ¿Los Goshg se asentaron en ~2.900 o la fecha debe ajustarse a ~2.850?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir filas con años ~1.200, ~2.800, 2.950, 3.500
- `docs/rpgtarkor/lore-mundo/areas.md` — integrar en "Historia profunda de los cuatro primeros orcos"
- `docs/rpgtarkor/personajes/personajes.md` — contextualizar revuelta de ~4.000 y relación con Gorhorn
- `docs/rpgtarkor/lore-mundo/historia.md` — ajustar ciclo de "prosperidad y desgracia" orco antes de la caída de Maktor

---

#### Evento 3 — Ur'gathek de los Veku'karot
**Estado: SIN REVISAR**

**Título del evento:** Ur'gathek de los Veku'karot

**Era:** Común (después del año 0)

**Año aproximado:** ~2.950 (periodo reciente I)

**Tipo:** Guerra / Duelo

**Participantes:** Clan Maktor (Terk'ikar Tregig, Kort'ikar Prehk, Kadrog), Clan Serhu (Terikar Nietka), Goirntes

**Causas:** Guerra interna Maktor-Serhu prolongada (2.850-2.900): Ketg traiciona a su mujer, Nietka, y funda el Clan Serhu aislando a los Maktor. Los Maktor, maltrechos, se refugian en las llanuras sin poder defenderse. Los Goirntes apoyan a Serhu por debilidad política y para desprestigiar a los Serhu en su propia facción orca.

**Desarrollo:** El primer golpe contra los Maktor. Kadrog, joven Kort'ikar Maktor, desafía a Mordek, líder Serhu, en Signeran. Kadrog vence pero, contra la costumbre de matar al perdedor, le perdona la vida — gesto de tugh real. Ketg (no Mordek, como indica el cronograma actual — **corrección propuesta aquí**) informa a los Goirntes. Una hueste de 1.200 Goirntes cae sobre el campamento Maktor. Los orcos no se rinden: mueren luchando, algunos se lanzan al río, otros se ocultan bajo la arena. No quedan extintos: quedan maltrechos, sin liderazgo, sin hogar. Gorhorn nace ~20 años después, en la ceniza de este primer golpe.

**Consecuencias:** Los Maktor sobreviven en la clandestinidad, sin tierra ni clan. Esto explica por qué, a los ~20 años de Gorhorn, solo queda él: la revuelta de ~4.000 es la última tentativa de un clan que lleva 1.050 años sin hogar. Los clanes Helsig y Goshg, emigrados a ~2.900, nunca se cruzan con estos supervivientes: la migración orca se hace lejos de la llanura del Viento Rojo.

**Descripción detallada:** El campamento Maktor estaba en una hondonada junto al río, protegido por empalizadas de madera. La hueste Goirnte llegó al amanecer, coordinada por Ketg desde el flanco este. Los orcos, sorprendidos, intentaron organizar defensa pero fueron superados. La batalla duró tres días. Al final, menos de un centenar de Maktor lograron huir hacia el sur. Los cuerpos de los caídos fueron enterrados por los Serhu en una fosa común, sin ritual. Los Goirntes se retiraron sin ocupar el territorio: solo querían destruir al clan, no quedarse.

**Documento asociado:** Sin documento asociado. Los Goirntes no documentaron la masacre; los Serhu no la registraron por vergüenza.

**Contradicciones detectadas:** ⚠️ **Mordek vs Ketg.** El cronograma actual de `cronologia.md` atribuye a Mordek la información a los Goirntes. Esta propuesta lo corrige a Ketg. Verificar cuál es el canon.

**Preguntas abiertas para Álvaro:**
1. ¿Quién informó realmente a los Goirntes: Mordek o Ketg?
2. ¿El nombre "Ur'gathek de los Veku'karot" sigue las reglas de `lenguas-helek.md`?
3. ¿La fecha ~2.950 encaja con la cronología actual?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~2.950, corregir Mordek→Ketg
- `docs/rpgtarkor/lore-mundo/areas.md` — integrar en "Historia profunda de los cuatro primeros orcos"
- `docs/rpgtarkor/personajes/personajes.md` — contextualizar revuelta de ~4.000 y relación con Gorhorn
- `docs/rpgtarkor/lore-mundo/historia.md` — ajustar ciclo de "prosperidad y desgracia" orco antes de la caída de Maktor

---

#### Evento 4 — Veku'karot de los Maktor Restantes
**Estado: SIN REVISAR**

**Título del evento:** Veku'karot de los Maktor Restantes

**Era:** Común (después del año 0)

**Año aproximado:** ~2.800 (época antigua) / refuerzo a ~3.900

**Tipo:** Guerra / Catástrofe (revisado 2026-09-24)

**Participantes:** Clanes Tarkurok, Maktor (4.000 miembros), Goshg emergentes, Faersen

**Causas:** Prosperidad compartida de los 4 clanes orcos: con 4.000 miembros (2.800) y 800 años de paz, aparecen tensiones internas. El clan Tarkurok (primer clan con nombre fijo, Kekta) reclama territorios de caza sobre el clan Maktor. Los Goshg, aún en formación (2.900), se asientan en la Ciénaga Troncal sin tener que pelear por el agua: ya tienen recursos propios.

**Desarrollo:** Guerra de recursos. Los orcos no están preparados para conflictos internos: la magia salvaje aún no se ha asentado en Berig (~2.000), pero ya se advierte en la salud física de sus hijos. Los 4 clanes se unen temporalmente contra la amenaza externa (Goirntes) para detener la guerra entre Tarkurok y Maktor. Los acuerdos de paz no duran: los Goshg, por su adaptación rápida a la vida acuática, no pueden integrarse al modelo terrestre-llanero. Los Faersen, Faerus salvajes, se mantienen al margen: no hay lugar para ellos en las alianzas orcas.

**Consecuencias:** Los 4 clanes se separan oficialmente. El Tarkurok queda como Kekta en el desierto central, el Maktor en las Llanuras del Viento Rojo, el Goshg en la Ciénaga Troncal, el Helsig en la frontera norte (Cristal Helado). Los clanes Maktor y Helsig son los más poblados (1.000 cada uno); Goshg (600) y Tarkurok (~400) más pequeños. Los Goirntes, al ver a los orcos divididos, deciden orquestar su destrucción total en un segundo intento: el golpe definitivo de ~4.000.

**Descripción detallada:** La guerra entre Tarkurok y Maktor duró tres generaciones (~60 años). Los Tarkurok, establecidos en el desierto central, presionaron hacia las llanuras fértiles del sur. Los Maktor, sorprendidos, respondieron con defensa pero perdieron territorio gradualmente. La alianza temporal de los 4 clanes contra los Goirntes se firmó en un alto de piedra, con juramento oral. No duró: los Goshg no podían integrarse al modelo terrestre y se retiraron a la Ciénaga. Los Faersen, sin lugar en las alianzas, migraron al Margen Silencioso. Al final, los 4 clanes quedaron separados geográficamente y sin vínculos formales.

**Documento asociado:** Sin documento escrito. La alianza temporal se selló con juramento oral y no se registró.

**Contradicciones detectadas:** ⚠️ **"Maktor Restant" vs "Maktor Aniquilados".** El título dice "Restantes" pero las preguntas abiertas sugieren corregirlo a "Aniquilados". Verificar cuál es el término correcto.

**Preguntas abiertas para Álvaro:**
1. ¿Debe "Veku'karot de los Maktor Restantes" corregirse a "Veku'karot de los Maktor Aniquilados"?
2. ¿La fecha ~2.800 con refuerzo a ~3.900 significa que es un evento doble o dos eventos separados?
3. ¿Los Goshg se asentaron en ~2.900 o la fecha debe ajustarse a ~2.850?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~2.800 y ~3.900
- `docs/rpgtarkor/lore-mundo/areas.md` — integrar en "Historia profunda de los cuatro primeros orcos"
- `docs/rpgtarkor/lore-mundo/historia.md` — ajustar ciclo de "prosperidad y desgracia" orco antes de la caída de Maktor

---

### 2026-09-25 — 4 eventos históricos para Faerus de Berig
**Estado: SIN REVISAR**

**Qué se propone:** Cuatro eventos que rellenan huecos en la cronología Faerua sin contradecir hechos existentes.

**Por qué encaja:** Los Faerus tienen presencia en El Margen Silencioso y en la Ciénaga Troncal (Kegi) según `areas.md`. Faltan eventos concretos que expliquen su origen como pueblo, su relación con los Maktor, su neutralidad activa y su desplazamiento actual.

**Facción/raza que lo usaría:** Faerus de Berig

**Implicaciones generales:**
- Completa el arco histórico Faeruo: fundación → alianza fallida con Maktor → neutralidad activa → desplazamiento actual.
- Conecta con la guerra Vaelira-Berig (~3.970) y el asalto a La Isla Cambiante (~4.015).
- Justifica su papel como "aliados no oficiales" que nunca entran en tratados formales.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre `Feg Tusha` es correcto o es un nombre inventado por el modelo? Verificar en `lenguas-helek.md`.
2. ¿Los "seres de tierra invasores" del Evento 4 son los mismos que los de La Isla Cambiante, o una facción nueva?
3. ¿Los Faerus de Kegi y los del Margen Silencioso son la misma raza o dos ramas diferenciadas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir filas con años ~0, ~3.000, ~3.970, ~4.015
- `docs/rpgtarkor/lore-mundo/historia.md` — contexto de la alianza Maktor-Faerus
- `docs/rpgtarkor/lore-mundo/areas.md` — asentamientos Hashma, Kegi
- `docs/rpgtarkor/lore-mundo/razas.md` — origen y rasgos Faerus

---

#### Evento 2 — El Gran Fracaso en La Sabana Alta
**Estado: SIN REVISAR**

**Título del evento:** El Gran Fracaso en La Sabana Alta

**Era:** Común (después del año 0)

**Año aproximado:** ~3.000 (primeros conflictos orcos-Goirntes)

**Tipo:** Catástrofe

**Participantes:** Faerus de Las Llanuras, orcos Maktor, Goirntes del Yugo de Hierro

**Causas:** Las primeras oleadas Goirntes atacaron lo que quedaba de los orcos tras la Purga Silenciosa. Los Faerus de las llanuras, que mantenían relación con los Maktor, decidieron ayudar — pero sin poder. La tierra misma no podía protegerlos contra la maquinaria industrial y militar Goirnte.

**Desarrollo:** Los Faerus intentaron detener la hueste Goirnte en su avance sobre las llanuras. No tenían armas de hierro. Solo tenían conocimiento del terreno y velocidad. Lograron que las tropas Goirntes se dispersaran por un tiempo, pero no pudieron detenerlas. El Clan Maktor se vio obligado a migrar hacia el norte — Cristal Helado —, llevando a su pueblo lejos de su tierra natal y del alcance inmediato más grande de los Goirntes.

**Consecuencias:** Los Faerus perdieron gran parte de su territorio original a manos de los Goirntes. Esto los empujó a expandirse hacia Ciénaga Troncal (asentamiento Kegi). La derrota fue terrible para los Maktor, de ahí su declive de 200 a casi 0 miembros. Los Faerus aprendieron que no podían confiar en nadie más que en sí mismos para sobrevivir en la guerra abierta. Decidieron no participar oficialmente en ninguna alianza militar — solo comerciar con quien fuera y mantener la neutralidad activa.

**Descripción detallada:** La Sabana Alta es una zona de transición entre las Llanuras del Viento Rojo y el Margen Silencioso. Los Faerus, usando su conocimiento del terreno, atrajeron a las tropas Goirntes hacia pantanos y zonas de arena movediza, dispersándolas. Pero los Goirntes, con armas de hierro y tácticas organizadas, superaron la resistencia Faerua en pocos meses. Los Maktor, ya debilitados por la traición de Ketg, no pudieron resistir y migraron al norte. Los Faerus que sobrevivieron se retiraron al Margen, abandonando sus puestos avanzados en las Llanuras.

**Documento asociado:** Sin documento escrito. La derrota no se registró formalmente.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿La fecha ~3.000 encaja con la cronología actual?
2. ¿"La Sabana Alta" es una zona ya documentada en `areas.md`?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~3.000
- `docs/rpgtarkor/lore-mundo/historia.md` — contexto de la alianza Maktor-Faerus
- `docs/rpgtarkor/lore-mundo/areas.md` — zona de La Sabana Alta

---

#### Evento 3 — Tregua de las Llanuras
**Estado: SIN REVISAR**

**Título del evento:** Tregua de las Llanuras

**Era:** Común (después del año 0)

**Año aproximado:** ~3.970 — durante la Paz Templada

**Tipo:** Tratado / Alianza informal

**Participantes:** Faerus de Kegi, orcos Maktor (reducidos a Gorhorn)

**Causas:** La guerra Vaelira-Berig estalló debido a la desaparición de La Isla Cambiante. Los Faerus no querían involucrarse — pero sus territorios fronterizos estaban atravesados por rutas de tropas Goirntes que llegaban desde Ciénaga Troncal hacia las Llanuras para luchar. Los Maktor, con solo un superviviente (Gorhorn), necesitaban aliados reales contra las incursiones Goirntes y los ataques de los Serhu. Los Faerus, aunque no combatientes oficiales, podían ofrecer información y refugio.

**Desarrollo:** Gorhorn —hijo del último Maktor sobreviviente— y su pequeño grupo Faeruo establecieron una línea de refugio en las fronteras de la región pantano-terrestre. Los Maktor podían descansar allí tras escapar de las patrullas Goirntes. Los Faerus usaban su conocimiento del terreno local y el sigilo natural de su manada para proteger a los orcos. También intercambiaban alimentos y pieles con los Maktor a cambio de equipo básico, como utensilios de cobre y herramientas de hierro — material con el que no podían forjar por su cuenta.

**Consecuencias:** Esta alianza informal duró solo una generación antes de la guerra abierta. Los Faerus no fueron incluidos en los tratados oficiales de la Concordia o la Rama Blanca. A pesar de todo, mantuvieron su reputación de *"aliados no oficiales"* que sabían cuándo no luchar. Gorhorn mantuvo su vínculo con los Faerus de las llanuras — ese encuentro no fue casual, fue una extensión de esa misma tradición de cooperación. La alianza demostró que los Faerus podían ser dignos de respeto sin ser reconocidos oficialmente — una contradicción que los Ilvenar registraron pero nadie cuestionó.

**Descripción detallada:** La tregua no se firmó: fue un acuerdo tácito entre Gorhorn y los Faerus de Kegi. Los Faerus permitieron a los Maktor usar sus rutas de tránsito y les dieron refugio en caso de persecución. A cambio, los Maktor compartían información sobre movimientos Goirntes y Serhu. La cooperación se mantuvo durante una generación, hasta que la guerra abierta la hizo insostenible. Los Faerus se retiraron a sus asentamientos y los Maktor siguieron su camino en solitario.

**Documento asociado:** Sin documento escrito.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿"Gorhorn" es el mismo personaje de la revuelta de ~4.000?
2. ¿Los "Ilvenar" son una raza ya documentada en `razas.md`?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~3.970
- `docs/rpgtarkor/lore-mundo/historia.md` — contexto de la alianza Maktor-Faerus
- `docs/rpgtarkor/lore-mundo/razas.md` — relación Faerus-Maktor

---

#### Evento 4 — El Desplazamiento del Norte
**Estado: SIN REVISAR**

**Título del evento:** El Desplazamiento del Norte

**Era:** Común (después del año 0)

**Año aproximado:** ~4.015 — durante El Detonante y el inicio de la guerra

**Tipo:** Catástrofe / Desplazamiento

**Participantes:** Faerus de Kegi, orcos (Helsig, Goshg, los remanentes de Maktor), seres de tierra invasores

**Causas:** El asalto Goirnte a La Isla Cambiante fracasó. La isla se desvaneció y apareció una extensión de tierra nueva al norte — oculta por muros de obsidiana. Los seres que vivían dentro de ella eran de un tipo nuevo, casi una especie invasora de la Semilla que nadie conocía. Estos seres emergieron de la tierra nueva con el único propósito de "purgar": exterminar todo lo que estaba en su camino. Los Faerus vivían exactamente en la zona donde se formó el nuevo continente, en la frontera norte de sus territorios.

**Desarrollo:** Los Faerus de Kegi no pudieron escapar — no tenían barcos, ni tecnología para cruzar el mar, ni podían atravesar los muros de obsidiana. Solo pudieron retirarse a la selva profunda del Margen y continuar con su estilo de vida — pero su territorio costero y partes de la frontera norte quedaron invadidos por estos seres extraños. Las manadas de la frontera norte abandonaron sus puestos avanzados en las Llanuras, retirándose hacia el sur, donde la selva aún era habitable. Los Faerus no pudieron combatir a estos seres: no eran cazadores, no podían vencer con la fuerza de su manada sola.

**Consecuencias:** Los Faerus perdieron su frontera norte y el acceso directo a las Llanuras. Ahora están atrapados en su territorio costero y no pueden usar los caminos de comercio a través de la llanura. Esto debilita su situación económica y militar, especialmente con los clanes Maktor y Goshg, que dependen de rutas abiertas. Los Faerus también sufrieron el impacto psicológico del primer encuentro directo con seres no originarios de su mundo. Es la primera vez que los Faerus tuvieron que reconocer una amenaza mayor que ellos mismos como especie, algo que nunca habían experimentado antes.

**Descripción detallada:** Los "seres de tierra" surgieron de la nueva extensión continental al norte del Margen Silencioso, protegida por muros de obsidiana. Eran criaturas de formas angulosas, sin ojos visibles, que se movían en silencio. No hablaban, no negociaban: avanzaban y mataban todo lo que encontraban. Los Faerus, acostumbrados a la caza y a la supervivencia, no tenían tácticas para enfrentar algo así. La retirada fue desordenada: muchas manadas se perdieron en la selva, otras fueron diezmadas. Los que sobrevivieron se refugiaron en las zonas más profundas del Margen, donde los seres de tierra no llegaban.

**Documento asociado:** Sin documento escrito. Los Faerus no tienen escritura formal.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Los "seres de tierra" son los mismos que los de La Isla Cambiante o una facción nueva?
2. ¿La fecha ~4.015 encaja con la cronología de la guerra Vaelira-Berig?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~4.015
- `docs/rpgtarkor/lore-mundo/historia.md` — contexto de la guerra Vaelira-Berig
- `docs/rpgtarkor/lore-mundo/razas.md` — impacto en los Faerus

---

### 2026-09-25 — El Decreto del Vacío Goirnte
**Estado: SIN REVISAR**

**Qué se propone:** Los Goirntes del Margen Silencioso, tras la Purga Silenciosa (~3650), quedan oficialmente desamparados por el orden central. Se decreta un periodo de exclusión para "limpiar" el territorio recién conquistado de lo que el centro ve como "infección cultural" (los métodos de sombra Nabieus y el trato con orcos). Solo el orden central regentea la zona.

**Por qué encaja:** En `razas.md` los del Margen "fueron perseguidos durante el Yugo de Hierro por 'operar en la sombra sin autorización del orden', y no lo han olvidado". La cronología de `historia.md` tiene un hueco sobre cómo esa persecución termina en autonomía.

**Título del evento:** El Decreto del Vacío Goirnte

**Era:** Común (después del año 0)

**Año aproximado:** ~3.660-3.670

**Tipo:** Represión / Decreto administrativo

**Participantes:** Orden Goirnte central vs. Goirntes del Margen Silencioso

**Causas:** Tras la Purga Silenciosa (~3.650), el orden central Goirnte necesita reafirmar su autoridad. Los Goirntes del Margen habían operado "en la sombra sin autorización" y el centro teme que su independencia se convierta en desafío abierto.

**Desarrollo:** Un decreto del Alto Tribunal quita al Margen Silencioso de mano directa de los gobernantes Goirntes de la Meseta. Se establece una administración local "vigilada desde lejos", lo que en la práctica deja los Nabieus del borde libres de supervisión directa. El orden central mantiene presencia militar, pero sin jurisdicción política real. Los Goirntes del Margen quedan oficialmente "excluidos" del orden central, marcados con una runa de exclusión que los identifica como no sujetos a la ley de la Meseta.

**Consecuencias:** Explica por qué los del Margen crecieron "salvajes" y desconectados del centro Goirnte. Justifica que la facción radical del presente tenga raíces en el centro, no en el Margen. Los Goirntes del Margen, sin supervisión directa, desarrollaron métodos propios de operación que el centro considera "infección cultural".

**Descripción detallada:** El decreto se inscribió en tablillas de arcilla y se envió a cada fortaleza del Margen. Los Goirntes del Margen fueron marcados con una runa de exclusión tatuada o grabada en sus armas. La runa, tallada en Kerost, simbolizaba su separación del orden central. A partir de ese momento, no podían acceder a los tribunales de la Meseta ni participar en las decisiones del Alto Tribunal. En la práctica, el decreto los dejó solos, pero también libres de la supervisión directa del centro.

**Documento asociado:** Tablillas de arcilla con el decreto del Alto Tribunal. La runa de exclusión tallada en Kerost.

**Contradicciones detectadas:** Ninguna. `razas.md` ya dice que los Goirntes del centro "desobedecer es desorden", lo que los deja vulnerables a que el Margen funcione separado.

**Preguntas abiertas para Álvaro:**
1. ¿Qué documento oficial del Alto Tribunal marca el decreto?
2. ¿Hay algún símbolo o runa que marque a esos Goirntes como "excluidos"?
3. ¿La fecha ~3.660-3.670 encaja con la cronología de la Purga Silenciosa?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/historia.md` (tabla de años, añadir ~3660-3670)
- `docs/rpgtarkor/lore-mundo/razas.md` (sección de Goirntes y Margen)

---

### 2026-09-25 — La Tablilla de los Susurros: descubrimiento y registro del reino Nabierus enterrado
**Estado: SIN REVISAR**

**Qué se propone:** Los faerus de las Llanuras del Viento Rojo documentan el reino Nabierus, antes de que sea enterrado por Madre, revelando cómo el conocimiento Nabieus sobre el silencio y el sigilo se remonta a una tradición de observación científica antes de la persecución Goirnte.

**Por qué encaja:**
- Los faerus del Margen Silencioso eran "ciertos investigadores de este mundo, dado que eran de las razas que más habían desarrollado su escritura con fines científicos" (`razas.md`).
- El reino Nabierus es enterrado por Madre en algún punto después del asentamiento Nabieus, pero antes del año 0 (`cronologia-mitica.md`).
- Los faerus de las Llanuras tienen puestos avanzados más allá de la frontera norte, en las Llanuras del Viento Rojo (`razas.md`).
- Este evento es natural: los faerus observan, documentan y registran, sin magia, solo ciencia.

**Título del evento:** La Tablilla de los Susurros

**Era:** Semillas (mítico, anterior al año 0)

**Año aproximado:** Antes del año 0

**Tipo:** Descubrimiento / Registro

**Participantes:** Faerus de las Llanuras (manada fronteriza del norte)

**Causas:** Los faerus de las Llanuras, con puestos avanzados en las Llanuras del Viento Rojo, observaron los restos del reino Nabierus antes de que fuera enterrado por Madre. Registraron la existencia del reino para preservar la memoria de lo que fue.

**Desarrollo:** Los faerus, sin escritura formal pero hábiles en la comunicación por señales y marcas corporales en su piel de hojas finas, registraron la existencia del reino mediante tablillas talladas en hueso de los animales de la Ciénaga, con runas grabadas para marcar coordenadas geográficas y datos biológicos del reino (población, economía, organización social). Documentaron que el reino se dedicaba a la investigación y al registro, y que su caída fue causada por una "inquietud" que Madre consideró una amenaza para su obra, no por un acto de guerra. Los sobrevivientes del reino Nabierus huyeron hacia el Margen Silencioso y luego hacia Ciénaga Troncal, convirtiéndose en los antepasados de los Nabieus modernos.

**Consecuencias:** Los faerus de las Llanuras no son solo cazadores, sino también observadores científicos, lo que explica su conocimiento sobre la flora y fauna de las Llanuras antes del Estallido. El conocimiento sobre el reino Nabierus enterrado se transmite entre faerus y Nabieus modernos, creando un vínculo histórico que no depende de la guerra actual. Los faerus guardan este conocimiento como una advertencia sobre las consecuencias de la investigación sin límites.

**Descripción detallada:** La tablilla principal, tallada en hueso de animal de la Ciénaga, mide unos 30 cm de largo por 15 cm de ancho. Tiene runas grabadas que marcan coordenadas geográficas y datos del reino. Los faerus la conservan en un lugar secreto de las Llanuras, sin acceso para otras razas. Las runas son un sistema propio de los faerus de las Llanuras, distinto del sistema Nabieus.

**Documento asociado:** La Tablilla de los Susurros, tallada en hueso de animal de la Ciénaga. Conservada por los faerus de las Llanuras.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Cómo se comunican los faerus de las Llanuras sin escritura formal? ¿Señales, tonos, marcas corporales?
2. ¿Hay un registro de las tablillas de hueso que documentaron el reino Nabierus? ¿Un ejemplar conservado en algún archivo Ilvenar?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/historia.md`
- `docs/rpgtarkor/lore-mundo/razas.md`
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md`

---

### 2026-09-25 — El Pacto de la Huella Silenciosa
**Estado: SIN REVISAR**

**Qué se propone:** Un evento histórico de represión y respuesta defensiva: cómo los Nabieus del Margen sobrevivieron a la Purga Silenciosa (~3.650 d.C.) mediante una táctica de dispersión, ocultación y silencio, y cómo esa táctica definió su identidad actual.

**Por qué encaja:** En `historia.md` y `razas.md` ya aparece la Purga Silenciosa, pero no se detalla cómo la vivieron los Nabieus. Este evento cierra ese hueco y justifica su rol posterior en la Concordia.

**Título del evento:** El Pacto de la Huella Silenciosa

**Era:** Común (después del año 0)

**Año aproximado:** ~3.650

**Tipo:** Represión (con respuesta defensiva / pacto de supervivencia)

**Participantes:** Nabieus del Margen Silencioso vs. Goirntes (fuerzas de represión del Yugo de Hierro)

**Causas:** La Purga Silenciosa: en el curso de una sola estación, funcionarios clave del orden Goirnte amanecieron desaparecidos —obra Nabieus, aunque jamás se probó— mientras los clanes orcos dejaron de entregar tributo. Los Goirntes orquestan una represión violenta contra "los que operan en la sombra sin autorización".

**Desarrollo:** La represión Goirnte intenta eliminar a los Nabieus como amenaza de seguridad. Los Nabieus, incapaces de enfrentarla (no tienen armas ni estructura militar), responden con una táctica de supervivencia: dispersión total, ocultación en el paisaje del Margen, y desarrollo de técnicas de desaparición. Aprenden a moverse sin dejar rastro: caminar sobre nieve (en invierno), usar humo para ocultar su figura (de día), enterrarse en la arena (en tormentas). Un grupo pequeño de supervivientes se refugia en cuevas bajo tierra, lejos de las rutas de patrulla. Allí, el "silencio" ya no es solo un don sino una necesidad: se comunican sin hacer ruido, usan señales táctiles, y aprenden a leer los silbidos de garrapatas y el vuelo de insectos para anticipar amenazas. La Purga Silenciosa no es una batalla, es una cacería lenta y silenciosa. Los Nabieus que huyen se convierten en "fantasmas del orden": nadie los ve, nadie los oye, pero la memoria de lo que hicieron ronda las estancias de cada alto funcionario Goirnte por décadas.

**Consecuencias:**
- Define la identidad táctica actual de los Nabieus del Margen: "los que silencian".
- Justifica su uso como mensajeros en la Concordia de Hierro: saben desaparecer.
- La represión Goirnte no extingue la raza, pero fragmenta y endurece su cultura.
- Los archivos oficiales Goirnte registran "reajuste de los tratados" en vez de represión: el miedo del que se alimenta la facción radical (ver `razas.md` § Goirntes).
- La técnica de desaparecer se codifica en lo básico: no dejar huellas, no hacer ruido, no ser detectado. Es una escuela de sigilo nacida del miedo a ser encontrado.

**Descripción detallada:** La Purga Silenciosa fue una cacería sistemática. Los Goirntes enviaron patrullas a los asentamientos Nabieus conocidos, pero encontraron la mayoría vacíos: los Nabieus ya se habían dispersado. Las patrullas recorrieron el Margen durante meses, sin encontrar más que huellas que se desvanecían. Los Nabieus usaron el terreno a su favor: se ocultaron en cuevas, se enterraron en arena, se movieron al amparo de la noche. No hubo batallas: solo desapariciones. Al final de la Purga, los Goirntes declararon "reajuste de los tratados" y se retiraron. Los Nabieus sobrevivieron, pero con una identidad marcada por el miedo.

**Documento asociado:** Sin documento escrito. Los Goirntes registraron "reajuste de los tratados" en sus archivos oficiales.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Los "funcionarios desaparecidos" en la Purga eran realmente obra Nabieus o solo se les atribuyó?
2. ¿El año 3.650 d.C. encaja con la fecha de la Purga Silenciosa que ya tienes en cronología?
3. ¿Las técnicas concretas (caminar sobre nieve, usar humo, enterrarse) deben formar parte del canon o son demasiado específicas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/historia.md`
- `docs/rpgtarkor/lore-mundo/razas.md` (§ Nabieus)
- `docs/rpgtarkor/lore-mundo/cronologia.md`

---

### 2026-09-26 — La Primera Frontera de Maktor y Tarkurok
**Estado: SIN REVISAR**

**Qué se propone:** Un evento de fundación territorial que marca el primer límite disputado entre los clanes orcos antes de que la traición de Ketg (~2.850) y la guerra de Goirntes (~2.800) cambien todo el equilibrio.

**Por qué encaja:** Entre los primeros orcos (~2.000) y la consolidación del Clan Serhu (~2.800-2.850), la cronología no menciona ningún conflicto específico entre Maktor y Tarkurok. Esta batalla de 2.500 llena el hueco de 500 años de desarrollo de los clanes orcos tempranos.

**Título del evento:** La Primera Frontera de Maktor y Tarkurok

**Era:** Común (después del año 0)

**Año aproximado:** ~2.500

**Tipo:** Batalla / Tratado territorial

**Participantes:** Maktor (Krugo, Tevya), Tarkurok (Kekta)

**Causas:** Los Maktor y los Tarkurok disputan el acceso a una zona de agua y pastos junto al Vientre del Engaño. El conflicto no es mágico: es por recursos naturales. La sequía de ese año agravó la competencia por el agua disponible.

**Desarrollo:** Durante ~40 días de escaramuzas intermitentes con hachas, lanzas y técnicas primitivas (incendios por fricción para despejar terreno, barreras de piedra levantadas a mano para bloquear el paso), los líderes de ambos clanes se reúnen en un alto de piedra. No firman un tratado escrito: pactan por juramento oral y demarcación física con postes de madera tallada. Los Tarkurok ocupan el norte de la llanura (Cristal Helado), los Maktor el sur (hoy donde están los Goshg).

**Consecuencias:** Esta batalla establece el mapa futuro de los clanes. Maktor se concentra al sur (hoy Goshg, Goshg en Ciénaga Troncal) y Tarkurok al norte (hoy Helsig en Cristal Helado). Es el origen de la fragmentación cultural que llevó al Maktor a emigrar (~2.900) tras el golpe de Ketg (~2.850).

**Descripción detallada:** El campo de batalla es una zona de llanura árida junto al Vientre del Engaño, con pastos secos y una única fuente de agua estacional. Los 40 días de conflicto consistieron en escaramuzas intermitentes, no en una batalla campal única: los orcos no tenían tácticas militares organizadas en esa época. Las técnicas usadas fueron primitivas: incendios provocados por fricción de piedras para despejar matorral y barreras de piedra construidas manualmente para bloquear el paso. El pacto final se selló con un intercambio de rehenes: dos hijos de cada clan fueron criados por el clan contrario durante 10 años, garantizando el cumplimiento. Los postes de madera tallada marcaron la frontera durante generaciones, aunque hoy no queda ninguno en pie.

**Documento asociado:** Los postes de madera tallada originales. Eran troncos de 2 metros clavados en el suelo, marcados con muescas que indicaban los límites del territorio. Se cree que uno de ellos sobrevivió hasta la época de Gorhorn, pero no hay confirmación.

**Contradicciones detectadas:** Ninguna (revisado: se eliminó la mención a "magia salvaje" y se sustituyó por "técnicas primitivas" para mantener coherencia con el canon de "sin magia sin fundamento").

**Preguntas abiertas para Álvaro:**
1. ¿Nombre en orco antiguo de la batalla? (¿"La Primera Línea", "La División del Viento"?)
2. ¿Hubo algún memorial físico (poste, piedra) que se conserva hoy en desuso?
3. ¿Los Ilvenar participaron como mediadores?
4. ¿El intercambio de rehenes como garantía de paz es coherente con la cultura orca?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~2.500
- `docs/rpgtarkor/lore-mundo/areas.md` — descripción de la frontera antigua Maktor-Tarkurok
- `docs/rpgtarkor/lore-mundo/historia.md` — ampliación del periodo pregoirnte

---

### 2026-09-26 — La Diquesía de Ciénaga Troncal
**Estado: SIN REVISAR**

**Qué se propone:** Un evento de construcción civil que une a Jusaly y Nabieus antes de la fractura de la Edad Dorada, estableciendo una red de infraestructura que permite el control del agua en Ciénaga Troncal.

**Por qué encaja:** La cronología fija que Ciénaga Troncal es el refugio de Nabieus después de la caída del Reino Nabierus (~año 0), y que los Jusaly son la raza clave para medicina y comida. Pero no hay ningún evento histórico sobre su cooperación técnica. Esta construcción de diques muestra la relación práctica entre ambas razas antes del cisma de la Edad Dorada.

**Título del evento:** La Diquesía de Ciénaga Troncal

**Era:** Común (después del año 0)

**Año aproximado:** ~3.400

**Tipo:** Fundación / Construcción civil

**Participantes:** Jusaly (conocimiento de plantas y savia) y Nabieus del borde de Ciénaga Troncal (conocimiento del terreno y del agua)

**Causas:** Las crecidas estacionales de Ciénaga Troncal amenazaban los asentamientos Jusaly y los pasos Nabieus. Las dos razas necesitaban una solución estable que no dependiera de la magia: los Jusaly sabían cómo las plantas regulaban el agua, los Nabieus conocían los cauces naturales y los puntos donde el terreno cedía. Por separado no podían resolver el problema; juntos, sí.

**Desarrollo:** Durante tres generaciones (~60 años), Jusaly y Nabieus trabajaron en una red de diques, canales y compuertas de madera y piedra que redirigía las crecidas de la Ciénaga sin destruir el ecosistema. Los Jusaly aportaron el conocimiento de la savia de plantas locales (usada para sellar juntas de madera y estabilizar taludes de tierra), los Nabieus aportaron su lectura del terreno y su capacidad de construir en silencio, sin maquinaria ruidosa que atrajera a los depredadores de la zona. El proyecto no fue un tratado formal: fue una cooperación práctica, sin juramento ni documento. Los diques se construyeron por tramos: cada generación terminaba una sección y la siguiente la ampliaba. No hubo un solo ingeniero jefe: cada comunidad aportaba lo que sabía.

**Consecuencias:** La red de diques permitió a los Jusaly cultivar en las tierras húmedas controladas y a los Nabieus mantener rutas seguras a través de la Ciénaga. La cooperación entre ambas razas se convirtió en la base de su relación posterior: intercambio de plantas medicinales Jusaly por información Nabieu sobre rutas y peligros. La red de diques sigue en pie en el presente, aunque con tramos reconstruidos varias veces. Es una de las pocas infraestructuras de Berig que no debe nada a los Goirntes ni a la magia.

**Descripción detallada:** La red de diques de Ciénaga Troncal se extiende por unos 12 km a lo largo del cauce principal. Los diques son de tierra compactada reforzada con troncos de madera negra y sellados con savia de plantas locales (que los Jusaly cultivan específicamente para este uso). Las compuertas son de madera y se abren y cierran manualmente con poleas de cuerda. Los canales de derivación son poco profundos y siguen el contorno natural del terreno. No hay torres, ni muros defensivos, ni inscripciones: solo la infraestructura funcional. En algunos tramos, el dique se apoya en formaciones rocosas naturales. Los Nabieus mantienen el sistema en silencio: reparan las compuertas al amanecer o al anochecer, cuando la fauna está menos activa.

**Documento asociado:** Sin documento escrito. La propia red de diques es el testimonio físico del evento. Algunos Jusaly conservan tablillas de arcilla con las marcas de las crecidas estacionales, pero no son un registro formal del evento.

**Contradicciones detectadas:** Ninguna. El evento no usa magia, es coherente con la descripción de Ciénaga Troncal como zona húmeda y con la presencia de Jusaly y Nabieus en la región. No contradice la Edad Dorada ni el cisma posterior.

**Preguntas abiertas para Álvaro:**
1. ¿Los diques tienen un nombre propio en lengua Jusaly o Nabieu?
2. ¿La savia de plantas Jusaly usada para sellar madera ya está documentada en el lore o es nueva?
3. ¿Cuál fue el motivo exacto del cisma de la Edad Dorada que rompió esta cooperación? ¿O la cooperación sobrevivió al cisma?
4. ¿Los Goirntes han intentado apropiarse o destruir esta infraestructura en algún momento?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/cronologia.md` — añadir fila ~3.400
- `docs/rpgtarkor/lore-mundo/areas.md` — descripción de la red de diques en Ciénaga Troncal
- `docs/rpgtarkor/lore-mundo/historia.md` — ampliación de la relación Jusaly-Nabieus pre-Edad Dorada
- `docs/rpgtarkor/lore-mundo/razas.md` — detalle de la cooperación técnica Jusaly-Nabieus

---

## Categoría: Lugares y geografía

### 2026-09-26 — El Sector de Calibrado
**Estado: SIN REVISAR**

**Qué se propone:** Un espacio interior dentro de la Meseta del Orden donde se realizan las inspecciones de perfección arquitectónica y control de calidad de las construcciones bajo la supervisión directa de Goirme.

**Por qué encaja:** La Meseta del Orden es un desierto de piedra gris tallado con "simetría antinatural" de obra Goirme (`areas.md` § Meseta del Orden). El lugar refleja esta estética geométrica y antinatural, y sirve como zona de actividad cotidiana dentro del imperio Goirnte. Encaja con la estructura rígida (leyes, jerarquías) que define a la región.

**Descripción física y funcional:** El Sector de Calibrado es un vasto espacio interior conformado por bloques de piedra gris pulida dispuestos en patrones de encaje antinatural — cada superficie enlaza con la precisión que Goirme impuso, sin fisuras visibles ni irregularidades. El suelo está trazado con líneas grabadas en relieve que marcan los ejes de referencia para medir simetría; cualquier construcción nueva debe alinearse con estas huellas. Las plataformas elevadas son piramidales invertidas de tres metros de altura, conectadas por pasillos escalonados que suben en espiral. El clima es árido y constante: el viento calienta la piedra diurna, mientras que las noches enfrían abruptamente el aire. No hay vegetación propia, salvo musgo escaso que crece en las grietas más profundas. La fauna es escasa y evitadora. El interior se divide en 27 cuadrantes independientes, cada uno con su propia plataforma de calibración.

**Requisitos o prerequisitos:** Solo técnicos Goirnte de nivel medio o superior, con permiso de la Concordia de Hierro; se requieren herramientas de medición calibradas.

**Facción/raza que lo usaría:** Goirntes, específicamente los inspectores de la Concordia de Hierro.

**Implicaciones:** Si se usa como zona de encuentro o construcción en una partida, los jugadores Goirntes sentirán la presión estética del lugar; si se usa para calibrar otras zonas, el lugar se convierte en punto de referencia obligatorio.

**Contradicciones detectadas:** Ninguna. No contradice la descripción de la Meseta del Orden de `areas.md`.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener nombre de Goirme o un nombre humano?
2. ¿Qué cuadrantes se asignan a qué oficio o función específica?
3. ¿Deben los jugadores acceder a él sin permiso o es zona restringida?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — La Caverna del Silicio
**Estado: SIN REVISAR**

**Qué se propone:** Una mina subterránea de hielo sílice en las laderas de la Meseta del Orden donde los técnicos Goirnte extraen el mineral que se talla en cuchillos y herramientas para toda la región de Berig.

**Por qué encaja:** La Meseta del Orden es un desierto de piedra gris con metalurgia y minería avanzada (`areas.md`). Necesita espacios de producción de recursos. Una mina subterránea de hielo sílice encaja con la geografía de Berig, sin contradecir la estructura antinatural de Goirme.

⚠️ *Nota: el hielo sílice es de Cristal Helado, no de la Meseta del Orden. Verificar si este material es plausible aquí o si debe cambiarse a sílice mineral / cuarzo cristalino.*

**Descripción física y funcional:** La Caverna del Silicio es un subsistema interior excavado en las laderas de la Meseta del Orden, donde capas de hielo sílice cristalino se acumulan tras milenios. El acceso es por cinco escaleras de piedra gris pulida que descienden en espiral hacia el interior; cada peldaño está grabado con símbolos de la Concordia para marcar la profundidad. El clima interior es helado: el aire a 0-5°C mantiene el hielo en estado sólido sin derretirse, mientras que el calor de las minas profundas genera condensación y niebla ligera. La flora es escasa — solo líquenes negros que crecen en las paredes y musgo de roca en las zonas más húmedas. Las paredes están talladas con rejillas geométricas. El suelo es una capa compacta de hielo sílice y polvo mineral pulverizado. La infraestructura incluye diez galpones independientes, cada uno con su propia cámara de extracción, sistema de ventilación y pasillos de evacuación.

**Requisitos o prerequisitos:** Permisos de la Concordia de Hierro; equipo de protección térmico obligatorio; guías oficiales Goirnte con mapa del subsistema.

**Facción/raza que lo usaría:** Goirntes, específicamente mineros y técnicos de extracción; también faerus que traen pieles y cueros de animales capturados en la superficie.

**Implicaciones:** Si se usa como zona de producción en una partida, los jugadores Goirnte obtienen herramientas de alta calidad; si los jugadores son orcos o Faerus, deben comerciar con los guardias para acceder.

**Contradicciones detectadas:** ⚠️ **Hielo sílice en la Meseta del Orden.** El hielo sílice es de Cristal Helado. Verificar si puede haber hielo sílice en la Meseta o si hay que cambiar el material.

**Preguntas abiertas para Álvaro:**
1. ¿Debe haber un nombre de Goirme o un nombre humano al nombre oficial?
2. ¿Cuántos mineros habitan aquí permanentemente?
3. ¿Qué nivel de acceso tienen los jugadores no Goirnte?
4. ¿El hielo sílice es plausible en la Meseta del Orden?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — El Pozo de Almacenaje
**Estado: SIN REVISAR**

**Qué se propone:** Un gran silo de almacenamiento subterráneo en la base de la Meseta del Orden donde se guardan recursos minerales y materiales extraídos de las minas Goirnte para redistribuir en las colonias.

**Por qué encaja:** La Meseta del Orden necesita infraestructura logística para sustentar el imperio Goirnte (`areas.md`). El lugar encaja con la geometría antinatural de Goirme y es funcional sin contradecir estructuras existentes.

**Descripción física y funcional:** El Pozo de Almacenaje es una estructura interior excavada en la base de la Meseta: un pozo cúbico de 300 metros de profundidad con paredes de piedra gris pulida lisas y simétricas. La cámara central es un espacio rectangular perfecto de 200x200 metros, dividido por rejillas geométricas en cuatro cuadrantes independientes. Cada cuartel almacena un tipo de recurso: minerales, metales, cristales, materiales orgánicos y herramientas. El clima es helado: el aire circula desde la superficie mediante sistemas de ventilación que mantienen la temperatura entre -5°C y 0°C para preservar materiales sensibles. La flora es escasa: musgo de roca y líquenes negros en las paredes. Las paredes están talladas con inscripciones de la Concordia que marcan la profundidad y el volumen almacenado. El suelo es una capa compacta de polvo mineral y cristales pulverizados.

**Requisitos o prerequisitos:** Permisos de la Concordia de Hierro; guías oficiales con conocimiento de la geometría Goirme.

**Facción/raza que lo usaría:** Goirntes, específicamente logísticos y técnicos de las colonias; mercaderes de las colonias que traen recursos.

**Implicaciones:** Si se usa como zona de logística en una partida, los jugadores Goirnte gestionan el suministro; si es zona neutral, el lugar se convierte en punto de intercambio obligatorio.

**Contradicciones detectadas:** Ninguna. No contradice la estructura de la Meseta del Orden ni la descripción de infraestructura Goirnte.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener nombre de Goirme o un nombre humano?
2. ¿Cuántos guardias logísticos habitan aquí permanentemente?
3. ¿Los jugadores deben tener permiso especial para acceder?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — La Torre de Vértice
**Estado: SIN REVISAR**

**Qué se propone:** Una torre de vigilancia y observación en la meseta donde se monitoriza el cinturón de micro-cristales y se mantienen registros astronómicos para la navegación en la región.

**Por qué encaja:** La Meseta del Orden tiene acceso al cinturón de micro-cristales atmosférico que ilumina las noches (`07-mundo-helek-sirik.md`). Una torre de observación encaja con la función de control central de Goirme, sin contradecir la estructura rígida del imperio.

**Descripción física y funcional:** La Torre de Vértice es una estructura interior elevada: una torre cilíndrica de 45 metros de altura construida con bloques de piedra gris pulida dispuestos en espiral geométrica. La plataforma superior es un círculo perfecto de 20 metros de diámetro con barandillas de hierro negro grabado con símbolos de la Concordia. El clima es árido y expuesto: el viento soplante crea corrientes que se sienten en las cimas, y el aire es frío en las noches heladas. La flora es mínima: líquenes en las grietas de la roca. Las paredes están grabadas con inscripciones de la Concordia que marcan los ángulos de observación. Al mirar hacia el cielo, el cinturón de micro-cristales se refleja en la superficie, creando un arcoíris perlado que rota según la posición.

**Requisitos o prerequisitos:** Permiso de la Concordia de Hierro; instrumentos de observación; equipo de protección térmico.

**Facción/raza que lo usaría:** Goirntes, específicamente astrónomos de la Concordia y guardias de vigilancia.

**Implicaciones:** Si se usa como punto de encuentro en una partida, los jugadores Goirnte acceden a observatorios astronómicos y registros de navegación; si la torre es destruida, la navegación en la Niebla del Estrecho se complica.

**Contradicciones detectadas:** Ninguna. No contradice la arquitectura Goirnte ni su capacidad de control sobre el territorio.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener nombre de Goirme o un nombre humano?
2. ¿Cuántos astrónomos habitan aquí permanentemente?
3. ¿Los jugadores deben tener permiso especial para acceder?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — El Almacén de Hierro
**Estado: SIN REVISAR**

**Qué se propone:** Una instalación militar y logística dentro de la Meseta del Orden donde se guardan y mantienen el armamento pesado, escudos de hierro negro y equipo de conciencia oficializado por la Concordia de Hierro.

**Por qué encaja:** La Meseta del Orden es la capital del imperio Goirnte (`areas.md`). El imperio militarizado necesita equipamiento almacenado para distribuir al frente. El lugar encaja con la estética de hierro negro pulido y simetría que define a los Goirntes.

**Descripción física y funcional:** El Almacén de Hierro es un espacio interior excavado bajo la superficie de la Meseta con 5 niveles de bodegas independientes, conectadas por pasillos escalonados de piedra gris pulida. Cada nivel almacena equipos clasificados por tipo: escudos de hierro negro, hachas de guerra, lanzas de asta, armaduras de cuero tratado y herramientas de combate cuerpo a cuerpo. El suelo está marcado con rejillas geométricas que permiten medir y alinear el armamento. Las estanterías son armaduras de hierro negro grabadas con símbolos de la Concordia. El clima es constante: el aire está filtrado y climatizado para mantener temperaturas frías (2-5°C) que preservan los materiales. La flora es escasa: musgo de roca en las grietas y líquenes negros en las paredes. Las plataformas de transporte son carros de piedra con poleas que bajan los equipos hacia los niveles inferiores.

**Requisitos o prerequisitos:** Permisos de la Concordia de Hierro; técnicos Goirnte con acceso al inventario; equipo de armadura para entrar.

**Facción/raza que lo usaría:** Goirntes, específicamente soldados y guardias de la Concordia; mercaderes de la Concordia que traen suministros.

**Implicaciones:** Si se usa como zona de logística en una partida, los jugadores Goirnte obtienen equipo de combate; si es zona controlada, los jugadores deben negociar acceso con la Guardia.

**Contradicciones detectadas:** Ninguna. No contradice la estructura militar del imperio Goirnte ni la distribución logística del territorio.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener nombre de Goirme o un nombre humano?
2. ¿Cuántos guardias militares habitan aquí permanentemente?
3. ¿Los jugadores deben tener rango o equipo para acceder?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — El Observatorio de la Simetría
**Estado: SIN REVISAR**

**Qué se propone:** Una plataforma astronómica en la cima de la Meseta del Orden donde se estudian los patrones de alineación de las ciudades-fortaleza bajo la mirada de Goirme y se recalibra el orden cósmico que conecta a Goirme con su reino.

**Por qué encaja:** La Meseta del Orden es dominio de Goirme (`areas.md`). Este lugar cumple una función espiritual y funcional dentro del imperio Goirnte — vigila la perfección geométrica del mundo. Diferente de la Torre de Vértice que solo observa el cielo, este lugar estudia la relación entre la geometría terrestre y los patrones cósmicos.

**Descripción física y funcional:** El Observatorio de la Simetría es una plataforma circular construida en la elevación más alta de la Meseta: diámetro de 50 metros, rodeada por un muro de piedra gris pulida de 15 metros de altura. El suelo es una losa continua de 10 metros de grosor con líneas de medianoche grabadas que marcan los ángulos de las estrellas principales. Cinco cámaras de observación semicirculares rodean una plaza central vacía de 20x20 metros. El clima es árido y extremadamente frío: vientos de alta velocidad cruzan la meseta, el aire a -10°C mantiene todo seco y congelado. La flora es casi inexistente: solo musgo blanco que crece en grietas del muro. La fauna escapa: solo rapaces nocturnos sobrevuelan en alturas superiores. Las paredes están grabadas con los patrones geométricos que Goirme impuso al mundo, que los técnicos estudian para mantener la sincronización cósmica.

**Requisitos o prerequisitos:** Perfiles de alta autoridad Goirnte; conocimiento de los patrones de alineación de Goirme; equipo de protección térmico especializado.

**Facción/raza que lo usaría:** Goirntes, específicamente astrónomos de la Concordia de Hierro y técnicos que estudian la geometría del mundo.

**Implicaciones:** Si se usa como punto de encuentro en una partida, los jugadores Goirnte acceden a conocimiento cósmico; si el observatorio es destruido, la alineación del mundo se desequilibra.

**Contradicciones detectadas:** Ninguna. No contradice la descripción de la Meseta del Orden ni la función astronómica de la Concordia.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener nombre de Goirme o un nombre humano?
2. ¿Cuántos astrónomos y técnicos habitan aquí permanentemente?
3. ¿Los jugadores deben tener permiso especial para acceder?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría LUGARES)

---

### 2026-09-26 — Las Ruinas del Reino Sepultado
**Estado: SIN REVISAR**

**Qué se propone:** Zona de ruinas subterráneas y entre dunas de arena roja que revelan fragmentos del antiguo Reino Nabierus, sepultado por la sequía y el viento del engaño de Madre.

**Por qué encaja:** `areas.md` menciona explícitamente: "Buena parte del reino sigue sellada bajo la arena, demasiado profunda para que nadie la alcance hoy — solo fragmentos sueltos asoman entre las dunas". Este lugar ocupa ese espacio específico, sin solaparse con los otros cuatro lugares ya creados (Cruce, Vetea, Pantano, Mesa). Coherente con la historia orca de las Llanuras: el reino Nabierus anterior a los orcos está sellado bajo la arena.

**Descripción física y funcional:**
- **Terreno:** entre dunas de arena roja compacta con formaciones de roca volcánica gris que asoman del suelo. Las ruinas son muros de piedra tallada con geometría perfecta, ahora cubiertos de arena que solo revela las esquinas y los fragmentos de estatuas mutiladas. Algunas estructuras tienen techos parcialmente colapsados pero suficientemente intactos para caminar dentro.
- **Clima:** caliente de día (30-35°C), con tormentas de arena magnética que llegan del norte cada 3-4 meses. La arena es de color rojizo intenso, fina y magnética — no se adhiere como la arena común sino que flota. De noche (15-20°C) las ruinas son un refugio contra el viento, pero hay que tener cuidado con las corrientes de polvo.
- **Flora:** escasa, solo líquenes y musgo en las sombras de las ruinas. Algunas hierbas resistentes a la sequía que crecen en las grietas entre los bloques de piedra. Sin árboles en la zona de las ruinas, la vegetación se limita a lo más básico que resiste la arena.
- **Fauna:** pocos animales por la sequía. Insectos carroñeros atraídos por los restos orgánicos, murciélagos que anidan en los techos colapsados. Ningún animal grande cruza las dunas. Los Kirelon Arenoso se acercan de noche pero no entran en las ruinas por el calor del día.

**Etiquetas de terreno:** árido, rocoso, húmedo

**Quién vive allí:** no hay habitantes permanentes. Los orcos de las Llanuras de los clanes Maktor y Serhu exploran las ruinas de vez en cuando en busca de fragmentos de construcción, artefactos o simplemente por curiosidad. Los Faerus visitan la zona para buscar materiales que podrían servirles. Los Nabieus no entran, su presencia es solo vigilancia desde fuera. Aproximadamente 20-30 visitantes al año si hay expedición organizada.

**Historia breve:** Antes de los orcos, un reino Nabierus se alzó en estas coordenadas — el mayor que su pueblo ha construido nunca, volcado en excavar, registrar y entender más de lo que a Madre le convenía. Lo que descubrieron no ha llegado hasta hoy, ni siquiera entre los propios Nabieus: solo se sabe que bastó para que Madre actuara. No lo hizo de frente — engañó a sus propias hijas, las Semillas, que sin saber lo que desencadenaban de verdad desataron sobre el reino una sequía y un viento que sepultaron ciudades enteras bajo la arena. El reino no fue destruido por la guerra: fue borrado por la propia Madre.

Hoy solo quedan fragmentos sueltos: esquinas de muros, cabezas de estatuas sin rostro, escaleras que descienden hacia salas inundadas de arena. Los Nabieus del Margen Silencioso conocen la existencia de estas ruinas, pero rara vez se acercan — consideran el lugar un recordatorio de lo que sucede cuando se investiga sin límites. Los orcos de las Llanuras han intentado excavar en varias ocasiones, pero la arena es profunda y las tormentas magnéticas se llevan cualquier progreso. No hay registro escrito de lo que el reino descubrió, solo rumores.

**Frase corta (teaser) para el mapa:** Bajo la arena roja, un reino entero espera a quien se atreva a mirar demasiado.

**Requisitos o prerequisitos:** conocimiento de la historia del Reino Nabierus y su caída, ya establecida en `areas.md` y `cronologia-mitica.md`. No hay requisitos técnicos de juego ni mecánicas adicionales.

**Facción/raza que lo usaría:** Orcos (exploración ocasional), Faerus (búsqueda de materiales), Nabieus (vigilancia desde fuera, sin entrar)

**Implicaciones:** añade un punto de interés arqueológico y narrativo que conecta con la historia antigua del continente, sin forzar conflictos ni mecánicas nuevas. Refuerza el misterio del Reino Nabierus y justifica por qué los Nabieus modernos evitan investigar demasiado.

**Contradicciones detectadas:** Ninguna. `areas.md` ya menciona que parte del reino sigue sellada bajo la arena. El lugar no repite el nombre de otros poblados ni zonas ya existentes.

**Preguntas abiertas para Álvaro:**
1. ¿Debería haber algún objeto físico (tablilla, fragmento de estatua) que los jugadores puedan encontrar en las ruinas?
2. ¿Existe alguna maldición o efecto ambiental específico por entrar en las ruinas, o es solo peligro natural (tormentas, arena)?
3. ¿Los Nabieus tienen algún tabú explícito sobre acercarse a las ruinas, o es solo desinterés?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/areas.md` (añadir a Región Margen Silencioso)
- `docs/rpgtarkor/lore-mundo/cronologia-mitica.md` (referencia cruzada a la caída del Reino Nabierus)
- `docs/rpgtarkor/items-y-catalogo/imagenes-prompts.md` (prompt para generación de imagen)

---

## Categoría: Items

### 2026-09-27 — Hacha de Ceniza-Veku
**Estado: SIN REVISAR**

**Nombre común:** Hacha de Ceniza-Veku

**Nombre propio (Kektira):** Hacha de Ceniza-Veku

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** HACHA_1_MANO

**Función concreta:** Hacha de guerra ritual con colmillo integrado y marca de ceniza. Combina manufactura orca básica con simbolismo ceremonial de duelo/honor.

**Descripción física:** Hacha de 110 cm total (90 cm asta + 20 cm cabeza de hueso). Cabeza de hueso de Gargantúa de Ceniza reforzada con refuerzos de Hiyéro (aleación orca) en el núcleo. En la parte superior de la cabeza, un Veku (colmillo de Gargantúa) perforado con un agujero de 12 mm que se llena con la ceniza ritual Karot. Mango envuelto en cuero curtido con trenzas de Gorhorn.

**Dimensiones concretas:** 110 cm total.

**Lugar de origen:** La Hondonada del Eco (Clan Maktor).

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** Fuerza mínima ⚠️ no especificada.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (Clan Maktor específicamente).

**Implicaciones:** Completa la reconstrucción del Tótem del Clan Maktor. Recompensa narrativa.

**Contradicciones detectadas:**
- ⚠️ "Hiyéro" — material inventado. Verificar.
- ⚠️ "Veku=Colmillo" y "Karot=Ceniza" — verificar con `lenguas-helek.md`.
- ⚠️ "La Hondonada del Eco" — zona inventada. Verificar.
- ⚠️ "Gorhorn" — personaje. Verificar.
- ⚠️ "Goirnnte" → "Goirnte".

**Preguntas abiertas para Álvaro:**
1. ¿La ceniza Karot debe ser ceniza de hoguera común o ceremonial?
2. ¿Quién puede forjarse esta hacha?
3. ¿Se vende o se usa solo en duelos de honor?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Escudo de Quila
**Estado: SIN REVISAR**

**Nombre común:** Escudo de Quila

**Nombre propio (Kektira):** Escudo de Quila ⚠️ nombre confuso

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** ESCUDO

**PesoArmadura:** MEDIO

**Función concreta:** Escudo defensivo orco fabricado con placas de quitina y piel curtida de la armadura natural de los grandes herbívoros de Los Pastos de la Deriva, reforzado con enganches de hueso de Cuernahoja.

**Descripción física:** Escudo ovalado de 110 × 60 cm. Núcleo de piel curtida de Cuernahoja. Placas de quitina oscura y brillante montadas en anillos metálicos sobre la carcasa de piel. Los enganches de hueso de Cuernahoja unen la quitina en paneles hexagonales. Borde reforzado con asta de lanza de hueso. Agarre envuelto en lana de Múrgol. Tótem ritual de colmillo menor en la parte posterior.

**Dimensiones concretas:** 110 × 60 cm.

**Lugar de origen:** Los Pastos de la Deriva.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** Fuerza mínima ⚠️ no especificada.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (Clan Serhu o similar).

**Implicaciones:** Defensa contra arcabuz y espadas Goirntes.

**Contradicciones detectadas:**
- ⚠️ **"Quila"** — nombre confuso. ¿Es "Quitina"? ¿"Cuernahoja"? El título no cuadra con el contenido.
- ⚠️ "Cuernahoja" — material inventado.
- ⚠️ "Múrgol" — criatura domesticada. Verificar.
- ⚠️ "Goirnnte" → "Goirnte".

**Preguntas abiertas para Álvaro:**
1. ¿El enganche de hueso de Cuernahoja es del crafteo normal o requiere herrero?
2. ¿Lleva este escudo un emblema de clan específico?
3. ¿Cuánto pesan las placas de quitina?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Botas de Corredor de Cauce
**Estado: SIN REVISAR**

**Nombre común:** Botas de Corredor de Cauce

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / ropa

**Ranura:** BOTAS

**PesoArmadura:** LIGERO

**Función concreta:** Botas de cuero curtido de la piel del Corredor de Cauce, ligeras, resistentes al calor y al desgarro, típicas del equipamiento de los orcos de las Llanuras para cazar o marchar largo tiempo.

**Descripción física:** Botas de 35 cm de largo × 10 cm de ancho. Pieles curtidas de Corredor de Cauce unidas con cordaje de fibra vegetal. Suela reforzada con capa de cuero extra. Cordones de cuero. Interior acolchado con teloncillo.

**Dimensiones concretas:** 35 × 10 cm.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (todos los clanes).

**Implicaciones:** Completa el inventario de equipamiento básico orco.

**Contradicciones detectadas:**
- ⚠️ "teloncillo" — material inventado.
- ⚠️ "Corredor de Cauce" — verificar si existe en `items.md` línea 22.

**Preguntas abiertas para Álvaro:**
1. ¿Las botas llevan emblema de clan o son genéricas?
2. ¿Qué peso exacto llevan (LIGERO/MEDIO)?
3. ¿Cuántos años tiene la vida útil?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Abalorio de Gargantúa
**Estado: SIN REVISAR**

**Nombre común:** Abalorio de Gargantúa

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Narrativo / cosmético

**Ranura:** COSMETICO_CINTURA

**Función concreta:** Amuleto/decoración portado por los orcos de las Llanuras para recordar cacerías rituales. No es arma, sino objeto de prestigio y memoria tribal.

**Descripción física:** Abalorio de 6 × 4 cm, colgante de cordel. Base de hueso tallado de vértebra de Gargantúa, incrustado con fragmento de quitina oscura. En el centro, un colmillo de Gargantúa (Veku) pequeño de 2 cm perforado. Cordón de piel de Corredor de Cauce.

**Dimensiones concretas:** 6 × 4 cm.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** Narrativo, sin stats.

**Facción/raza que lo usaría:** Orcos de las Llanuras (todos los clanes que cazan Gargantúas).

**Implicaciones:** Trofeo narrativo, símbolo de rango entre cazadores.

**Contradicciones detectadas:**
- ⚠️ "Towrgu" — fauna inventada.

**Preguntas abiertas para Álvaro:**
1. ¿Se puede hacer un abalorio con colmillo de otra presa?
2. ¿Cuántos abalorios puede llevar un orco?
3. ¿El cordón necesita ser de pieles específicas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Garrote de Asta Corredor
**Estado: SIN REVISAR**

**Nombre común:** Garrote de Asta Corredor

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** GARROTE_1_MANO

**Función concreta:** Garrote largo de asta de hueso de Corredor de Cauce con punta de Hiyéro simple, arma de combate cuerpo a cuerpo para orcos no especializados en forja.

**Descripción física:** Garrote de 160 cm de largo total. Asta principal de 140 cm de hueso de Corredor. Punta de 20 cm de Hiyéro fundido con punta de lanza estándar orca. Agarre envuelto en cuero con cordón de fibra vegetal.

**Dimensiones concretas:** 160 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (todos los clanes).

**Implicaciones:** Arma de combate cuerpo a cuerpo para quienes no usan hacha o espada.

**Contradicciones detectadas:**
- ⚠️ "Hiyéro" — material inventado.

**Preguntas abiertas para Álvaro:**
1. ¿Tiene punta fija o remache?
2. ¿El Hiyéro es suficiente o requiere punta de Hiyéro reforzado?
3. ¿Se puede hacer con asta de Corredor machacado o solo con hueso sólido?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Cota de Lana de Múrgol
**Estado: SIN REVISAR**

**Nombre común:** Cota de Lana de Múrgol

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** ARMADURA_SUPERIOR

**PesoArmadura:** LIGERO

**Función concreta:** Cota de lanas tejidas de Múrgol para proteger el torso del orco. Usa lana curtida de Múrgol y refuerzos de quitina.

**Descripción física:** Cota de 30 × 40 cm que cubre pecho y espalda. Lana tejida de Múrgol en capas entrelazadas. Refuerzos de quitina en hombros y costados. Cordones de lana de Corredor de Cauce para ajustar. Color tierra o rojizo natural.

**Dimensiones concretas:** 30 × 40 cm.

**Lugar de origen:** Los Pastos de la Deriva.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (todos los clanes).

**Implicaciones:** Cota ligera para combate caza/defensa contra flechas o cuchillos.

**Contradicciones detectadas:**
- ⚠️ "Múrgol" — verificar si existe en `items.md` línea 28.
- ⚠️ **"Arma de 30 × 40 cm que cubre pecho y espalda"** — typo, debería ser "Armadura" no "Arma".

**Preguntas abiertas para Álvaro:**
1. ¿La cota tiene refuerzos de metal o solo quitina?
2. ¿Cuánto peso tiene (LIGERO)?
3. ¿Lleva un emblema de clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Guantes de Colmillo de Towrgu
**Estado: SIN REVISAR**

**Nombre común:** Guantes de Colmillo de Towrgu

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / ropa

**Ranura:** GUANTES

**PesoArmadura:** LIGERO

**Función concreta:** Guantes de combate hechos con colmillos de Towrgu para mejorar el agarre y proteger las manos durante el combate cuerpo a cuerpo.

**Descripción física:** Guantes de 25 × 15 cm que cubren dedos hasta la muñeca. Base de cuero curtido fino. Refuerzos de tres colmillos de Towrgu (5 × 3 cm cada uno) integrados en la parte frontal de los dedos índice, medio y corazón. Costura reforzada de fibra. Interior acolchado con lana de Corredor de Cauce.

**Dimensiones concretas:** 25 × 15 cm.

**Lugar de origen:** La Sabana Alta.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (clanes de caza).

**Implicaciones:** Mejora el agarre y defensa contra cortes/arañazos.

**Contradicciones detectadas:**
- ⚠️ "Towrgu" — fauna inventada. Verificar si existe en `items.md` línea 34.
- ⚠️ "La Sabana Alta" — zona inventada.

**Preguntas abiertas para Álvaro:**
1. ¿Es mejor usar colmillos de un solo Towrgu o combinar varios?
2. ¿Cuánto peso añaden los colmillos?
3. ¿Llevan emblema de clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Pantalón de Escama Toluh
**Estado: SIN REVISAR**

**Nombre común:** Pantalón de Escama Toluh

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** ARMADURA_INFERIOR

**PesoArmadura:** LIGERO

**Función concreta:** Pantalón de combate para orco hecho con escamas de Toluh, curtido y cosido en placas flexibles que protegen la parte inferior del cuerpo contra impactos y garras.

**Descripción física:** Pantalón de 130 × 40 cm que cubre caderas hasta los tobillos. Placas de escama de Toluh dobladas y cosidas en capas flexibles sobre tela de lana curtida de Corredor de Cauce. Costuras de cuero reforzadas con cordón de fibra vegetal. Color gris azulado natural del pez.

**Dimensiones concretas:** 130 × 40 cm.

**Lugar de origen:** Playa de Ceniza Blanca.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras.

**Implicaciones:** Defiende contra cortes/arañazos en las piernas.

**Contradicciones detectadas:**
- ⚠️ "Toluh" — pez inventado. Verificar si existe en `items.md` línea 37.
- ⚠️ "Los Manaderos" — zona inventada.

**Preguntas abiertas para Álvaro:**
1. ¿Las escamas son transparentes o translúcidas?
2. ¿Cuánto peso añaden (LIGERO/MEDIO)?
3. ¿Llevan emblema o patrón de clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Collar de Tótems Múltiples
**Estado: SIN REVISAR**

**Nombre común:** Collar de Tótems Múltiples

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Narrativo / cosmético

**Ranura:** COSMETICO_ESPALDA

**Función concreta:** Collar de trofeos que llevan los orcos de las Llanuras para recordar cacerías de distintas especies. Símbolo visual de rango/experiencia de cazador.

**Descripción física:** Collar de 35 cm de largo, múltiples colgantes. 4 a 6 trofeos pequeños de hueso/quitina de distintas especies: 1 colmillo de Gargantúa pequeño, 3 placas de quitina de Corredor de Cauce, 1 escama de Toluh, 1 garra de Towrgu. Cordel de cuerda fina de fibra. Todos cosidos a un aro de hueso central de Gargantúa.

**Dimensiones concretas:** 35 cm de largo.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** Narrativo, sin stats.

**Facción/raza que lo usaría:** Orcos de las Llanuras (rango experimentado de cazador).

**Implicaciones:** Símbolo visual de rango entre cazadores.

**Contradicciones detectadas:**
- ⚠️ "Gorhorn" — personaje. Verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Es un item combativo o puramente visual?
2. ¿Se requiere cacería de cada especie específica?
3. ¿Lleva un patrón de diseño único o es genérico?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Cuchillo de Hielo Sílice
**Estado: SIN REVISAR**

**Nombre común:** Cuchillo de Hielo Sílice

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_SECUNDARIA

**TipoArma:** CUCHILLO

**Función concreta:** Cuchillo de caza con filo de mineral sílice tallado en lugar de metal, arma secundaria o herramienta de caza para orcos de las Llanuras.

**Descripción física:** Cuchillo de 22 cm total (15 cm hoja + 7 cm empuñadura). Hoja tallada de cristal sílice transparente/azulado. Empuñadura de madera de Telda o hueso de Corredor de Cauce, envuelta en cuero. Contragarra con colmillo pequeño perforado.

**Dimensiones concretas:** 22 cm total.

**Lugar de origen:** Comercio con el Clan Helsig.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (cazadores, comerciantes con el Clan Helsig).

**Implicaciones:** Arma secundaria o herramienta de caza.

**Contradicciones detectadas:**
- ⚠️ **"cristal sílice"** vs **"hielo sílice"** — confusión. El material del Clan Helsig es "hielo sílice" según `items.md`.
- ⚠️ "La Hondonada" — zona inventada.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánto daño hace un corte de sílice vs una hoja de metal?
2. ¿Se requiere comerciar con Helsig para obtener sílice?
3. ¿Es igual que el de Gorhorn u otro nombre propio?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Casco de Cresta Cuernahoja
**Estado: SIN REVISAR**

**Nombre común:** Casco de Cresta Cuernahoja

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** CASCO

**PesoArmadura:** LIGERO

**Función concreta:** Casco de protección para cabeza hecho con placas de hueso de Cuernahoja montadas en aro de fibra, típico del equipamiento básico orco para caza y combate.

**Descripción física:** Casco de 30 cm de diámetro × 5 cm de alto. Aro base de fibra vegetal trenzada. 4 placas de hueso de Cuernahoja talladas en forma de media luna, montadas en el aro con enganches de hueso. Cresta central decorativa de 8 cm de altura. Interior acolchado con tela de lana de Múrgol.

**Dimensiones concretas:** 30 cm diámetro × 5 cm alto.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras.

**Implicaciones:** Protección contra cortes y golpes en combate cuerpo a cuerpo.

**Contradicciones detectadas:**
- ⚠️ "Cuernahoja" — material inventado. Verificar si existe en `items.md` línea 32.
- ⚠️ "Goirnnte" → "Goirnte".
- ⚠️ "yelmos abertos" → "yelmos abiertos".

**Preguntas abiertas para Álvaro:**
1. ¿El casco pesa más de 2 kg (pesado) o 1.5 kg (ligero)?
2. ¿Lleva un emblema de clan o es genérico?
3. ¿Cuánto tiempo dura el cordaje sin quebrarse?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Cinturón Herramienta-Orco
**Estado: SIN REVISAR**

**Nombre común:** Cinturón Herramienta-Orco

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / herramienta

**Ranura:** CINTURON

**Función concreta:** Cinturón con múltiples ganchos para herramientas de crafteo (cuchillo, martillo de piedra, tijeras), equipable para forjadores y crafteadores que viajan por las Llanuras.

**Descripción física:** Cinturón de 30 cm de ancho × 120 cm de largo. Cuero curtido de Múrgol/Corredor de Cauce unido con cordaje de fibra vegetal. 3 ganchos de hierro forjado local para atornillar herramientas. Ranuras laterales para colgar cuchillo de hueso, martillo pequeño de piedra, tijeras de corte. Interior acolchado con fieltro de lanas local. Decorado con marcas de ceniza negra en patrones tribales.

**Dimensiones concretas:** 30 × 120 cm.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (forjadores, crafteadores, herreros).

**Implicaciones:** Herramienta para crafteo en campaña.

**Contradicciones detectadas:**
- ⚠️ "Múrgol" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿Cuántas herramientas caben en el cinturón?
2. ¿El cuero es de Múrgol, de Corredor de Cauce o de otra especie?
3. ¿Lleva emblema de clan o es genérico?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Daga de Hueso de Gargantúa
**Estado: SIN REVISAR**

**Nombre común:** Daga de Hueso de Gargantúa

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_SECUNDARIA

**TipoArma:** DAGA

**Función concreta:** Daga ligera de hueso de Gargantúa de Ceniza para ataque secundario o defensa en combate cuerpo a cuerpo.

**Descripción física:** Daga de 30 cm total (22 cm hoja hueso + 8 cm empuñadura). Hoja tallada de hueso de Gargantúa, afilada con piedra. Empuñadura de hueso envuelta en cuero de Múrgol. Contragarra con colmillo de Gargantúa más pequeño.

**Dimensiones concretas:** 30 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (cazadores, bandidos, crafteadores).

**Implicaciones:** Ataque secundario ligero.

**Contradicciones detectadas:**
- ⚠️ "Múrgol" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿La hoja de hueso se quiebra con impacto fuerte?
2. ¿Cuánto daño hace contra armadura de cuero vs metal?
3. ¿Lleva emblema o solo nombre?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Arco de Hueso de Corredor
**Estado: SIN REVISAR**

**Nombre común:** Arco de Hueso de Corredor

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** ARCO ⚠️ (verificar si es un tipo válido)

**Función concreta:** Arco de caza ligero hecho con asta de hueso de Corredor de Cauce y cuerda de fibra vegetal, arma de proyección para caza y combate a distancia.

**Descripción física:** Arco de 165 cm de largo total. Asta principal de hueso de Corredor curvo, doble asta ligera. Cuerda de fibra vegetal trenzada. Brazales de cuero curtido para proteger antebrazos. Tensión media, ideal para caza.

**Dimensiones concretas:** 165 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (cazadores, rastreadores).

**Implicaciones:** Arma de caza y caza a distancia.

**Contradicciones detectadas:**
- ⚠️ **"ARMA_PRIORitaria"** → "ARMA_PRINCIPAL".
- ⚠️ **TipoArma "ARCO"** — verificar si es válido en tu catálogo. El prompt no lo incluye.
- ⚠️ "curvado de asta" — confusión. El arco es de hueso, no de asta.

**Preguntas abiertas para Álvaro:**
1. ¿Qué potencia tiene el arco?
2. ¿La cuerda se rompe fácil o es resistente?
3. ¿Lleva emblema de clan o es genérico?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Lanza de Honor Duelo
**Estado: SIN REVISAR**

**Nombre común:** Lanza de Honor Duelo

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** LANZA

**Función concreta:** Lanza ceremonial de duelo de honor para orcos de las Llanuras, usada en retos entre clanes.

**Descripción física:** Lanza de 220 cm total. Asta de madera de Telda curada (Telda Atardecer). Punta de 25 cm tallada en hueso de Gargantúa con un colmillo perforado integrado reforzando la base. Contragarra con cinta de cuerda de fibra vegetal. Color marrón natural con marcas de ceniza negro en la punta.

**Dimensiones concretas:** 220 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (clanes con tradición de duelo, especialmente Maktor y Serhu).

**Implicaciones:** Arma ceremonial de respeto, no de guerra.

**Contradicciones detectadas:**
- ⚠️ "Telda Atardecer" — variedad inventada. Verificar si existe en `items.md` línea 35.

**Preguntas abiertas para Álvaro:**
1. ¿Se usa solo en duelos de honor o también en caza?
2. ¿Qué peso tiene esta lanza?
3. ¿Cuándo se rompe el asta de Telda?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Espada de Filo Hueso
**Estado: SIN REVISAR**

**Nombre común:** Espada de Filo Hueso

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** ESPADA_1_MANO

**Función concreta:** Espada corta de filo tallado en hueso curvado de Gargantúa de Ceniza, arma de filo alternativa a la hacha pesada.

**Descripción física:** Espada de 95 cm total (75 cm hoja hueso + 20 cm empuñadura). Hoja tallada en hueso de Gargantúa curvado, afilada por corte de piedra. Empuñadura de madera de Telda envuelta en cuero, con colmillo de Gargantúa en la contragarra. Color rojizo natural del hueso.

**Dimensiones concretas:** 95 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (forjadores de hueso, bandidos, mercenarios).

**Implicaciones:** Arma de corte más que de golpear.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánto daño hace el filo de hueso vs filo de metal?
2. ¿Lleva emblema de clan o es genérica?
3. ¿Es mejor que la daga para combate cuerpo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Escarpín de Fuego Múrgol
**Estado: SIN REVISAR**

**Nombre común:** Escarpín de Fuego Múrgol

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** ARMADURA_INFERIOR

**PesoArmadura:** LIGERO

**Función concreta:** Escarpines de cuero curtido y refuerzos de quitina para proteger las piernas de orcos que luchan en zonas volcánicas o de fumarolas.

**Descripción física:** Botines de 25 × 18 cm. Cuero curtido de Múrgol base. Refuerzos de quitina negra curada en talones, rodilleras y punteras. Cordones de cuerda vegetal reforzados con hilo de acero. Color rojizo natural del Múrgol.

**Dimensiones concretas:** 25 × 18 cm.

**Lugar de origen:** Las Fumarolas Negras.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (clanes que marchan por Las Fumarolas Negras).

**Implicaciones:** Protección contra calor/volcanismo.

**Contradicciones detectadas:**
- ⚠️ "Escarpón/Escarpín" — confusión. El nombre es "Escarpín".
- ⚠️ "Múrgol" — verificar.
- ⚠️ "Las Fumarolas Negras" y "El Filo de las Brasas" — zonas inventadas.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánto resisten al calor (50°C/100°C/150°C)?
2. ¿El cuero de Múrgol es igual que para la cota o distinto?
3. ¿Llevan emblema o solo práctica?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Bolsa de Cuero Curtido de Corredor
**Estado: SIN REVISAR**

**Nombre común:** Bolsa de Cuero Curtido de Corredor

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / herramienta

**Ranura:** ACCESORIO / CINTURON

**Función concreta:** Bolsa transportadora de cuero curtido para llevar raciones, agua y pequeños objetos durante el viaje.

**Descripción física:** Bolsa de 40 × 35 × 15 cm. Cuero curtido de Corredor de Cauce cosido con cordón de fibra vegetal. Dobles de cuero reforzados en bordes. Asa con correa ajustable que se puede atar al cinturón. Interior acolchado con tela de lana. 3 ranuras laterales para atornillar utensilios pequeños.

**Dimensiones concretas:** 40 × 35 × 15 cm.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (viajeros, campistas, comerciantes).

**Implicaciones:** Útil para crafteo y supervivencia.

**Contradicciones detectadas:**
- ⚠️ "aspa" → "asa".
- ⚠️ "atornjar" → "atornillar".
- ⚠️ "campinado" → "acampado".

**Preguntas abiertas para Álvaro:**
1. ¿La bolsa aguanta peso máximo de 20 kg o 30 kg?
2. ¿Lleva un emblema o es genérica?
3. ¿El cuero es igual que para las botas o más resistente?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Maza de Guerra Corredor
**Estado: SIN REVISAR**

**Nombre común:** Maza de Guerra Corredor

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** MAZA_1_MANO

**Función concreta:** Maza de guerra pesada hecha con hueso de Corredor de Cauce tallado, arma de combate cuerpo a cuerpo para orcos que no usan hacha.

**Descripción física:** Maza de 95 cm total. Cabeza de 30 cm de hueso de Corredor tallado en forma de disco con 4 dientes radiales. Asta de madera Telda reforzada. Peso pesado (5-7 kg).

**Dimensiones concretas:** 95 cm total.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (guerreros, bandidos).

**Implicaciones:** Arma de impacto contundente contra pieles y blindaje ligero.

**Contradicciones detectadas:**
- ⚠️ "Hueso de Corredor (mortal)" → "material". Typo.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánto pesa exactamente la maza (5kg, 6kg, 7kg)?
2. ¿La cabeza de hueso se quiebra con golpes a piedra?
3. ¿Lleva emblema de clan?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Veneno de Espina del Viento
**Estado: SIN REVISAR**

**Nombre común:** Veneno de Espina del Viento

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** CONSUMIBLE

**Categoría:** Medicinal

**Función concreta:** Poción de caza que usa el veneno de Espina del Viento que reduce la percepción del dolor del orco cazador temporalmente.

**Descripción física:** Vial de cristal ámbar de 15 × 8 cm. Contenido: líquido amarillo-tan transparente. Dosis: 2-3 cucharadas. Odor a reptil.

**Dimensiones concretas:** 15 × 8 cm.

**Lugar de origen:** Llanuras del Viento Rojo.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Efecto:** Reduce la percepción del dolor en combate/caza por 10 minutos.

**Facción/raza que lo usaría:** Orcos de las Llanuras (cazadores experimentados, crafteadores de veneno).

**Implicaciones:** Útil para caza de Gargantúas o combate con dolor intenso.

**Contradicciones detectadas:**
- ⚠️ "Veneno de Espina del Viento" — verificar si existe en `items.md` línea 20.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánta duración exacta tiene el efecto?
2. ¿Qué efecto secundario tiene si se usa en exceso?
3. ¿Se puede vender o es solo para uso propio?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Respirador de Filtro Quio
**Estado: SIN REVISAR**

**Nombre común:** Respirador de Filtro Quio

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / herramienta

**Ranura:** ACCESORIO / COSMETICO_ESPALDA

**Función concreta:** Respirador práctico para orcos que trabajan en minas de Fumarolas Negras o zonas de humo. Protección contra ceniza y humo.

**Descripción física:** Mascarilla de cuero curtido de Corredor de Cauce con inserto de filtro de 50 cm × 10 cm. Fibra de Quio entrelazada que absorbe partículas y humo. Cordones de cuerda vegetal para ajustar. Color gris-azulado natural del filtro.

**Dimensiones concretas:** 50 × 10 cm.

**Lugar de origen:** Las Fumarolas Negras.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (mineros, exploradores de Fumarolas Negras).

**Implicaciones:** Útil para trabajar en minas o crafteo en zonas volcánicas.

**Contradicciones detectadas:**
- ⚠️ **"Filtro de Quio"** — dice "ingestible de pesca de Los Manaderos". ¿Es un filtro de aire o un ingerible? Contradicción.
- ⚠️ "Los Manaderos" — zona inventada.

**Preguntas abiertas para Álvaro:**
1. ¿Cuánto tiempo dura el filtro antes de satura?
2. ¿Puede reutilizarse o se cambia?
3. ¿Lleva emblema o es genérico para todas las minas?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Martillo de Forja de Hueso
**Estado: SIN REVISAR**

**Nombre común:** Martillo de Forja de Hueso

**Nombre propio (Kektira):** Sin nombre propio definido

**Tipo:** EQUIPABLE

**Categoría:** Equipo / herramienta

**Ranura:** HERRAMIENTA ⚠️ (verificar si es una ranura válida)

**Función concreta:** Martillo de crafteo para herrería orca, hecho con hueso de Gargantúa de Ceniza y cabeza de piedra, herramienta básica para forjar y crafteo de items orcos.

**Descripción física:** Martillo de 35 cm total. Cabeza de 20 cm de piedra volcánica de El Filo de las Brasas (resistente al calor). Mango de hueso de Gargantúa de 15 cm tallado. Peso: 2 kg. No tiene dientes ni afilado.

**Dimensiones concretas:** 35 cm total.

**Lugar de origen:** El Filo de las Brasas.

**Tier y valor:** ⚠️ No especificado.

**Requisitos:** ⚠️ No especificados.

**Bonificadores:** ⚠️ No especificados.

**Facción/raza que lo usaría:** Orcos de las Llanuras (forjadores, herreros de clan, crafteadores).

**Implicaciones:** Herramienta para crafteo en campaña. No es arma, es utilidad.

**Contradicciones detectadas:**
- ⚠️ "El Filo de las Brasas" — zona. Verificar.
- ⚠️ **Ranura "HERRAMIENTA"** — el prompt no la incluye. Verificar si es válida.

**Preguntas abiertas para Álvaro:**
1. ¿El martillo pesa 1.5 kg o 2 kg?
2. ¿Lleva emblema de clan o es genérico?
3. ¿Se puede usar forjado para metales?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

### 2026-09-27 — Armadura de Mimicaje del Margen
**Estado: SIN REVISAR**

**Nombre común:** Armadura de Mimetismo del Margen

**Nombre propio (Feg):** Yegr'vash — "Vergel de Sangre"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / ropa

**Ranura:** ARMADURA_SUPERIOR

**Función concreta:** El usuario adopta texturas y patrones de camuflaje del Margen (musgo, corteza) que reducen su visibilidad contra la selva. También confunde a bestias del Margen que no reconocen la forma.

**Descripción física y funcional:** Guanteletes y cubrecorazón tejidos con piel de Hetris curtida y tratada, impregnados de resina Telda y musgo local, aplicando capas de musgo y tierra fina que imita la corteza húmeda.

**Dimensiones concretas:** 85x45x55 cm (largo de guantelete desde muñeca hasta dedos).

**Lugar de origen:** El Margen Silencioso, interior de la selva.

**Tier y valor:** Tier 6 · 280 Goirnos.

**Requisitos:** Destreza 10, Voluntad 8.

**Bonificadores:** +3 Destreza, +2 Voluntad. **Sin porcentajes.**

**Implicaciones:** Facilita caza en la selva y sigilo contra Faerus que usan sus propios códigos.

**Contradicciones detectadas:**
- ⚠️ **"Mimicaje"** es anglicismo. Cambiado a "Mimetismo".
- ⚠️ **Categoría "Materiales / Piel"** es incorrecta para un equipable. Cambiada a "Equipo / ropa".
- ⚠️ **Ranura "ARMA_1_MANO / ACCESORIO"** es incoherente. Cambiada a ARMADURA_SUPERIOR.
- ⚠️ **"+40% sigilo"** — porcentaje inventado. Eliminado.

**Preguntas abiertas para Álvaro:**
1. ¿Se puede craftear en tier 5 con menos ingredientes para aventureros tempranos?
2. ¿El beneficio de camuflaje se pierde al salir del Margen, o es permanente en todo Berig?
3. ¿El nombre `Yegr'vash` debe ser en Feg o en Kektira?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Amuleto de Resonancia del Eco
**Estado: SIN REVISAR**

**Nombre común:** Amuleto de Resonancia del Eco

**Nombre propio (Feg):** Feg'nur'sael — "El que no abandona"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / accesorio

**Ranura:** ACCESORIO

**Función concreta:** Amuleto que permite al usuario escuchar mejor las llamadas de la manada y sentir los peligros de la selva sin necesidad de visión. Útil para cazar o para proteger a los suyos.

**Descripción física y funcional:** Pequeña pieza de quitina blanca y translúcida entrelazada con un hilo de fibra vegetal del Margen, colgante de un cordón de cuero curtido. La quitina tiene un interior vaciado y relleno con musgo y ceniza del Margen, lo que le da un aspecto etéreo.

**Dimensiones concretas:** 4 cm de altura, 1.5 cm de ancho en la parte más ancha.

**Lugar de origen:** El Margen Silencioso.

**Tier y valor:** Tier 6 · 260 Goirnos.

**Requisitos:** Voluntad 8, Destreza 6.

**Bonificadores:** +2 Percepción auditiva, +2 Voluntad.

**Implicaciones:** Facilita el movimiento en la selva y es esencial para la caza o supervivencia en el Margen. Simbólico de pertenencia a la manada.

**Contradicciones detectadas:**
- ⚠️ **"+40% de percepción"** — porcentaje inventado. Corregido a +2.
- ⚠️ **"Lebudes"** — criatura inventada. Eliminada.
- ⚠️ **"Nuente"** — criatura inventada. Eliminada.
- ⚠️ **"Corredores de Cauce"** como criatura del Margen — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿El amuleto desaparece si el usuario abandona la manada?
2. ¿Puede ser usado por no-Faerus con permiso de una manada?
3. ¿Debería haber una receta alternativa con otros materiales del Margen para un tier inferior?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Botas de Nadar de la Selva
**Estado: SIN REVISAR**

**Nombre común:** Botas de Nadar de la Selva

**Nombre propio (Feg):** Hashma-mir — "Piel de Selva"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / ropa

**Ranura:** BOTAS

**Función concreta:** Permiten al usuario cruzar las charcas y zonas húmedas del Margen sin mojar las piernas, gracias a la piel impermeable de los Miruina. Además, otorgan ventaja en terrenos del Margen.

**Descripción física y funcional:** Botas de cuero curtido con piel de Miruina en las suelas y tobillos, tratadas con resina Telda y musgo para ser impermeables. Tienen garras incrustadas en suelas para tracción en barro y lodo. El diseño es bajo y ancho.

**Dimensiones concretas:** Largo 38 cm, alto 22 cm, peso 1.8 kg.

**Lugar de origen:** El Margen Silencioso, entre las charcas de Los Manaderos ⚠️.

**Tier y valor:** Tier 5 · 210 Goirnos.

**Requisitos:** Fuerza 7, Destreza 5.

**Bonificadores:** +3 Destreza, +2 Resistencia.

**Implicaciones:** Ideal para cazadores, exploradores y sanadores que deben cruzar zonas de agua y lodo sin ser detectados. Símbolo de adaptación a los ritmos del Margen.

**Contradicciones detectadas:**
- ⚠️ **"+40% de ventaja"** — porcentaje inventado. Eliminado.
- ⚠️ **"Cuernahoja"** — material inventado. Eliminado, sustituido por "garras".
- ⚠️ **"Los Manaderos"** — zona inventada. Verificar si existe.

**Preguntas abiertas para Álvaro:**
1. ¿Debería haber una variante tier 7 con escamas de Faerus reforzando el diseño?
2. ¿El beneficio de movilidad se activa solo en zonas húmedas o es permanente?
3. ¿Existe un proceso de crafteo con otros materiales para hacerlo más barato?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Casco de Pelaje Vistue
**Estado: SIN REVISAR**

**Nombre común:** Casco de Pelaje Vistue

**Nombre propio (Feg):** Grath'sil'tusha — "Sombra de Fuego que Protege"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** CASCO

**PesoArmadura:** LIGERO

**Función concreta:** Protege contra golpes de espadas y ataques de lanzas mientras permite movimiento fluido en la selva. El pelaje de Vistue ayuda a disipar calor en charcas y reduce el impacto de ataques desde arriba.

**Descripción física y funcional:** Casco en forma de cuña con borde irregular, cubierto de pelaje corto de Vistue (negro con franja clara) que rodea completamente la cabeza sin obstruir la vista. Entre el pelaje y la cubierta hay una capa interior de cuero curtido y fibras de Telda. El borde frontal tiene tres aberturas ajustadas para respiración y visión periférica.

**Dimensiones concretas:** Alto 38 cm, ancho 28 cm, profundidad 24 cm, peso 1.9 kg.

**Lugar de origen:** El Margen Silencioso, zonas de caza de Vistue.

**Tier y valor:** Tier 7 · 340 Goirnos.

**Requisitos:** Constitución 12, Destreza 8.

**Bonificadores:** +3 Constitución, +1 Destreza.

**Implicaciones:** Usado por guardianes de la manada y por quienes lideran cacerías en el Margen. El pelaje de Vistue es único y difícil de conseguir.

**Contradicciones detectadas:**
- ⚠️ **"+6 Constitución, +3 Destreza"** — fuera de escala 1-5. Corregido a +3 y +1.
- ⚠️ **"+20% de resistencia"** — porcentaje inventado. Eliminado.
- ⚠️ **"+25% de ventaja"** — porcentaje inventado. Eliminado.

**Preguntas abiertas para Álvaro:**
1. ¿Debía haber una variante con pelaje de Faerus (más escaso y costoso)?
2. ¿El bonus contra manada se aplica solo en combate o también en caza?
3. ¿Existe un procedimiento ritual para "bendecir" el pelaje antes de usarlo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Pica de Espinas del Faerus
**Estado: SIN REVISAR**

**Nombre común:** Pica de Espinas del Faerus

**Nombre propio (Feg):** Vash'grath'ash — "Primera Sangre y Vigilancia"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / arma

**Ranura:** ARMA_PRINCIPAL

**TipoArma:** PICA

**Función concreta:** Cabeza de pica con punta de quitina que aumenta el daño contra presas grandes y bestias del Margen. El asta es de madera de Telda, reforzada con fibras para flexibilidad sin ceder.

**Descripción física y funcional:** Pica de asta larga de 180 cm, cabeza de quitina roja y arcilla con púas afiladas, envuelta en piel de Miruina tratada que resiste humedad. El asta es de madera Telda curvada ligeramente para balanceo natural, y la hoja termina en forma de gema con tres púas que se abren al impacto para detener o empujar presas.

**Dimensiones concretas:** Largo 205 cm total, cabeza 45 cm, asta 160 cm, peso 2.8 kg.

**Lugar de origen:** El Margen Silencioso.

**Tier y valor:** Tier 7 · 350 Goirnos.

**Requisitos:** Fuerza 14, Destreza 10.

**Bonificadores:** +4 Fuerza, +1 Destreza.

**Implicaciones:** Arma ceremonial y práctica de los guardianes del Margen. Símbolo de autoridad para cazar bestias del interior de la selva.

**Contradicciones detectadas:**
- ⚠️ **"+9 Fuerza, +4 Destreza"** — fuera de escala 1-5. Corregido a +4 y +1.
- ⚠️ **"+45% de daño"** — porcentaje inventado. Eliminado.
- ⚠️ **"quitina de Faerus"** — los Faerus no tienen quitina. Confusión con otra raza. Corregido a "quitina" sin especificar raza.

**Preguntas abiertas para Álvaro:**
1. ¿Existe una variante tier 9 con colmillo de Faerus añadido en la punta?
2. ¿El daño contra especies del mismo clan debe ser más o menos que contra Faerus?
3. ¿Debería haber un proceso de bendición en la manada antes del ritual de entrega?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Escudo de Manada del Margen
**Estado: SIN REVISAR**

**Nombre común:** Escudo de Manada del Margen

**Nombre propio (Feg):** Feg'grath — "Manada y Caza"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / armadura

**Ranura:** ESCUDO

**PesoArmadura:** MEDIO

**Función concreta:** Esquina redondeada que protege el cuerpo lateral y frontal. Refuerza la cohesión de manada al mostrar símbolos de pertenencia. Bloquea ataques con bordes reforzados y permite carga en manada.

**Descripción física y funcional:** Escudo redondo de 90 cm de diámetro, núcleo de madera de Telda curada, envuelto en cuero curtido tratado con aceite de Telda. La superficie tiene grabados en relieve de símbolos de la manada y de los animales del Margen. Borde reforzado con cuerno que resiste impactos.

**Dimensiones concretas:** Diámetro 90 cm, grosor 3 cm, peso 5.2 kg.

**Lugar de origen:** El Margen Silencioso.

**Tier y valor:** Tier 6 · 280 Goirnos.

**Requisitos:** Fuerza 10, Constitución 8.

**Bonificadores:** +2 Constitución, +2 Resistencia.

**Implicaciones:** Usado por guardianes de los límites de la manada y por quienes defienden el territorio del Margen. Símbolo de unidad y protección colectiva.

**Contradicciones detectadas:**
- ⚠️ **"+4 Constitución, +5 Resistencia"** — fuera de escala 1-5. Corregido a +2 y +2.
- ⚠️ **"+25% defensa"** — porcentaje inventado. Eliminado.
- ⚠️ **"tela de Trella"** — material inventado. Eliminado.

**Preguntas abiertas para Álvaro:**
1. ¿Debería haber variantes para cada manada distinta?
2. ¿El símbolo de la manada cambia según el líder o es fijo?
3. ¿Existe un proceso de iniciación para recibir este escudo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-27 — Chaqueta de Piel de Hetris
**Estado: SIN REVISAR**

**Nombre común:** Chaqueta de Piel de Hetris

**Nombre propio (Feg):** Yegr'ashtusha — "Vergel de Sombra de Manada"

**Tipo:** EQUIPABLE

**Categoría:** Equipo / ropa

**Ranura:** ARMADURA_SUPERIOR

**PesoArmadura:** LIGERO

**Función concreta:** Chaqueta ligera que cubre torso, pecho y espalda. Usa piel de Hetris (felino arbóreo) con capa de musgo adherida, permitiendo movimiento en el dosel y mezclándose con la corteza húmeda. Tratada con resina Telda para impermeabilización.

**Descripción física y funcional:** Traje de dos piezas (torso + mangas), tejido con piel curtida de Hetris y costuras de fibra vegetal. La parte exterior tiene capa de musgo aplicado por zonas; interior de cuero suave y forro de tela. Cuello alto que protege el cuello y hombros.

**Dimensiones concretas:** Altura de torso 65 cm, ancho de pecho 55 cm, manga hasta muñeca 40 cm, peso 1.6 kg.

**Lugar de origen:** El Margen Silencioso.

**Tier y valor:** Tier 5 · 220 Goirnos.

**Requisitos:** Destreza 9, Constitución 8.

**Bonificadores:** +2 Destreza, +1 Constitución.

**Implicaciones:** Usada por cazadores y exploradores del Margen. El musgo aplicado le da un aspecto de corteza húmeda que facilita el camuflaje. Símbolo de adaptación al entorno.

**Contradicciones detectadas:**
- ⚠️ **"musgo vivo y musgo secado"** — detalle raro. Corregido a "musgo aplicado por zonas".
- ⚠️ **"tela Trella"** — material inventado. Eliminado.
- ⚠️ **Descripción cortada** — completada con dimensiones, lugar de origen, tier, requisitos, bonificadores, implicaciones.

**Preguntas abiertas para Álvaro:**
1. ¿La capa de musgo se renueva periódicamente o es permanente?
2. ¿La chaqueta se puede craftear en tier inferior con menos materiales?
3. ¿El camuflaje se pierde al salir del Margen?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

### 2026-09-27 — Fibra de Selva Nigro
**Estado: SIN REVISAR**

**Nombre común:** Fibra de Selva Nigro

**Tipo:** MATERIAL

**Categoría:** fibras

**Qué se propone:** Fibra extraída de hojas de las Teldas que crecen en el límite del Margen Silencioso, tratada con resina local para resistir la humedad constante de la selva y el moho, usada por los Faerus para tejados y lianas de suspensión.

**Por qué encaja:** Coherente con el sistema de familias de flora y el mecanismo de bioacumulación/naturaleza de Helek Sirik; los Faerus no tienen flora propia pero usan recursos locales (como en las Llanuras, ver `items.md`).

**Descripción física y funcional:** Haz de fibras vegetales de color verde grisáceo con vetas oscuras, trenzadas entre sí por la naturaleza o por artesanos orcos de paso. La superficie presenta una textura ligeramente aceitosa (resina de Telda mezclada). Resiste moho, humedad y hongos sin pudrirse.

**Dimensiones concretas:** Manojo de 80-120 cm de largo, 5-8 cm de grosor.

**Lugar de origen:** Límite del Margen Silencioso.

**Tier y valor:** Tier 1 · 15 Goirnos por manojo.

**Requisitos:** No necesita crafteo especial, solo recolección de hojas de Telda (Ceniza o Atardecer) y secado al aire.

**Facción/raza que lo usaría:** Faerus (para sus propias construcciones), también usado por orcos locales como material de bajo tier para tejados improvisados.

**Implicaciones:** Extiende al Margen el uso de Telda ya documentado en `areas.md`/`flora-fauna.md`; coherente con la economía de recursos de la región.

**Contradicciones detectadas:** ⚠️ **Telda en el Margen.** Las Teldas están documentadas en El Pozo de Cauce Viejo y El Cruce de las Cenizas, no en el Margen Silencioso. Verificar si hay Telda en el Margen o cambiar la fuente.

**Preguntas abiertas para Álvaro:**
1. ¿El Faerus tiene nombre propio en su lengua o usaremos solo "Feg" + sustantivo?
2. ¿Este material tiene alguna utilidad ceremonial además de construccional?
3. ¿Debería entrar en `ItemCatalog` o quedarse como objeto narrativo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts` (si necesita entry técnica)
- `docs/mecanicas/12-mundo-estructurado.md` (si se añade a HarvestYield)

---

### 2026-09-27 — Astilla de Mekiosi
**Estado: SIN REVISAR**

**Nombre común:** Astilla de Mekiosi

**Tipo:** MATERIAL

**Categoría:** hueso

**Qué se propone:** Fragmento de hueso pequeño extraído de los cadáveres de Mekiosi, procesado por artesanos Faerus para crear cabezas de arcos, mazos ligeros y herramientas de caza en la selva.

**Por qué encaja:** Los Mekiosi ya aportan colmillos de tier 5 para combate; sus huesos son un subproducto no documentado en `items.md`. Los Faerus usan materiales locales para herramientas (como se hace con huesos de Gargantúa entre orcos, ver `items.md`).

**Descripción física y funcional:** Hueso corto y robusto de 20-40 cm, blanco hueso con vetas de color ámbar, porosas y fáciles de tallar. Se desmorona si se golpea con fuerza; ideal para craftear de un solo golpe o cazar con arcos recurvados hechos de liana.

**Dimensiones concretas:** 20-40 cm de largo, 3-6 cm de grosor.

**Lugar de origen:** Selva del Margen Silencioso.

**Tier y valor:** Tier 3 · 40 Goirnos por astilla.

**Requisitos:** Recolectar de cadáveres de Mekiosi muertos. Requiere herramienta de filo (piedra o metal) para despiece. No necesita crafteo complejo.

**Facción/raza que lo usaría:** Faerus (y orcos de la región como material de caza).

**Implicaciones:** Amplía la economía de materiales de la selva del Margen; no contradice nada establecido en `items.md`/`flora-fauna.md`.

**Contradicciones detectadas:** Ninguna (verificar si Mekiosi vive en el Margen).

**Preguntas abiertas para Álvaro:**
1. ¿Debería tener tier específico o valor Goirnte en crafteo?
2. ¿Los Faerus usan huesos de otras especies además del Mekiosi?
3. ¿Este material entra en `worldCatalog.ts` o es único narrativo?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts`
- `docs/mecanicas/12-mundo-estructurado.md` (HarvestYield)

---

### 2026-09-27 — Sangre de Terkash
**Estado: SIN REVISAR**

**Nombre común:** Sangre de Terkash

**Tipo:** MATERIAL

**Categoría:** recurso

**Qué se propone:** Fluido rojo oscuro extraído de los cadáveres de Terkash, usado por artesanos Faerus como adhesivo natural y sellado para piezas de madera húmeda, resistente a la descomposición en el entorno costero.

**Por qué encaja:** El Terkash ya es loot de Los Acantilados Partidos con carne y caparazón (`items.md`). Su sangre es un subproducto documental no explotado, coherente con la fauna ya leída.

**Descripción física y funcional:** Fluido viscoso de color rojo intenso, casi sangre seca, aroma salado y metálico. Seca formando una capa adhesiva negra que resiste humedad y salitre. No se descompone en meses.

**Dimensiones concretas:** Frasco de 500 ml, 15 cm de alto, 8 cm de diámetro.

**Lugar de origen:** Los Acantilados Partidos ⚠️.

**Tier y valor:** Tier 3 · 60 Goirnos por frasco.

**Requisitos:** Expiar el cadáver con cuchillo o piedra para extraer la sangre fresca. Secar a la sombra para evitar coagulación rápida.

**Facción/raza que lo usaría:** Faerus (construcciones costeras, uniones de maderas húmedas). También orcos para pegar en piezas de madera húmeda.

**Implicaciones:** Crea un nuevo material de crafteo sin modificar reglas de combate ni tiers; ampliación del lore de materiales locales.

**Contradicciones detectadas:** ⚠️ **Terkash en Los Acantilados Partidos.** Los Faerus del Margen están lejos de Los Acantilados. Verificar si tiene sentido geográficamente.

**Preguntas abiertas para Álvaro:**
1. ¿Debería entrar en `ItemCatalog` como material de crafteo?
2. ¿Hay variante más diluida para sellado?
3. ¿Usan los Faerus este material ceremonial?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts`
- `docs/mecanicas/12-mundo-estructurado.md`

---

### 2026-09-27 — Grasa de Mekiosi
**Estado: SIN REVISAR**

**Nombre común:** Grasa de Mekiosi

**Tipo:** CONSUMIBLE

**Categoría:** recurso

**Qué se propone:** Grasa extraída de la complexión pesada del Mekiosi, usada por los Faerus como combustible para lámparas y fuegos interiores en las cuevas del Margen Silencioso, donde la madera falta y las brasas de orco no llegan.

**Por qué encaja:** Los Mekiosi ya dan Piel (tier 4) y Colmillos (tier 5) (`flora-fauna.md`). La grasa es un subproducto natural no documentado de caza, igual que la leche de Múrgol para el Clan Serhu (`items.md`). Coherente con la economía de recursos de la selva.

**Descripción física y funcional:** Sólida a temperatura ambiente en cuevas sombrías, color amarillo pálido con vetas pardas de ceniza, textura densa que no se derrite fácilmente. Se derrite lentamente con el calor del fuego.

**Dimensiones concretas:** Bloque de 20x10x5 cm, 500 g.

**Lugar de origen:** Selva del Margen Silencioso.

**Tier y valor:** Tier 2 · 30 Goirnos por bloque.

**Requisitos:** Extraer tras cacería de Mekiosi. Requiere filtrado suave para eliminar sangre. No necesita crafteo complejo.

**Facción/raza que lo usaría:** Faerus (como combustible), orcos locales (para vender como sustituto de leña escasa).

**Implicaciones:** Crea un nuevo consumible de la región del Margen Silencioso, sin contradecir lo establecido en `flora-fauna.md`/`items.md`.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener tier y valor en Goirnos?
2. ¿Los Faerus lo usan ceremonial?
3. ¿Debería entrar en `worldCatalog.ts`?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts`

---

### 2026-09-27 — Cola de Vistue
**Estado: SIN REVISAR**

**Nombre común:** Cola de Vistue

**Tipo:** MATERIAL

**Categoría:** cordaje

**Qué se propone:** Cola larga y musculosa del corredor de manada Vistue, procesada por los Faerus para fabricar cuerdas de suspensión, sogas de escalada y amarres de red de caza en la selva del Margen Silencioso.

**Por qué encaja:** El Vistue ya aporta Piel (tier 3) y carne (`flora-fauna.md`). La cola es un subproducto no explotado, similar a las cuerdas de fibra de Telda pero más resistente a la humedad. Coherente con la economía de materiales locales para la selva.

**Descripción física y funcional:** Cola larga de 90-130 cm, cubierta de pelaje negro brillante con franja clara, tejido sin tendones sueltos. Se procesa retirando la carne interna para usar solo la base fibrosa y tensa. Resistente a la humedad, se usa para construir redes de pesca complejas y sogas.

**Dimensiones concretas:** 90-130 cm de largo, 4-7 cm de grosor en la base.

**Lugar de origen:** Selva del Margen Silencioso.

**Tier y valor:** Tier 3 · 50 Goirnos por cola.

**Requisitos:** Recolectar tras caza de manada de Vistue. Requiere proceso de limpieza y secado.

**Facción/raza que lo usaría:** Faerus (construcción de redes, amarres, escalada en la selva).

**Implicaciones:** Crea un nuevo material de crafteo para la región sin contradecir lo establecido en `flora-fauna.md`/`items.md`.

**Contradicciones detectadas:** Ninguna (verificar si Vistue vive en el Margen).

**Preguntas abiertas para Álvaro:**
1. ¿Debe tener tier y valor en Goirnos?
2. ¿Los Faerus usan colas de otras especies además del Vistue?
3. ¿Debería entrar en `worldCatalog.ts`?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts`
- `docs/mecanicas/12-mundo-estructurado.md`

---

### 2026-09-27 — Pelo de Hetris
**Estado: SIN REVISAR**

**Nombre común:** Pelo de Hetris

**Tipo:** MATERIAL

**Categoría:** pelo

**Qué se propone:** Pelo corto y fino de los Hetris felino-simio, procesado por los Faerus para telas de camuflaje que se funden con la corteza del bosque del Margen Silencioso, usado para ropa de infiltración.

**Por qué encaja:** Hetris ya da Pelis (tier 3) y Garras (tier 4) (`flora-fauna.md`). El pelo es distinto a la piel base, un subproducto específico del crafteo que no ha sido documentado aún en `items.md`.

**Descripción física y funcional:** Pelo muy corto de 0.5-3 cm, gris verdoso con matices pardos según la zona del cuerpo, suave pero resistente. Se teje con resina natural para crear telas que se confunden con la corteza del bosque húmedo.

**Dimensiones concretas:** Manojo de 30x15 cm, 200 g de pelo.

**Lugar de origen:** Selva del Margen Silencioso.

**Tier y valor:** Tier 3 · 70 Goirnos por manojo.

**Requisitos:** Recolectar del cadáver de Hetris. Requiere cardar y tejer con técnicas Faerus antes de usar. No necesita forja.

**Facción/raza que lo usaría:** Faerus (para ropa de infiltración, camuflaje de caza).

**Implicaciones:** Amplía las aplicaciones del Hetris más allá de las pieles y garras de combate.

**Contradicciones detectadas:** ⚠️ **"trajes cebra"** — anglicismo raro en el original. Corregido a "ropa de infiltración". **"desaparecen visualmente"** — exagerado. Corregido a "se confunden con la corteza".

**Preguntas abiertas para Álvaro:**
1. ¿Debería tener tier y valor en Goirnos?
2. ¿Los Faerus usan pelos de otras especies además del Hetris?
3. ¿Debería entrar en `worldCatalog.ts`?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `docs/rpgtarkor/sistemas-reino/worldCatalog.ts`

---

### 2026-09-26 — Hacha Renacida del Clan Serhu
**Estado: SIN REVISAR**

**Qué se propone:** Un hacha de guerra forjada con hueso de Gargantúa y piel de Corredor de Cauce, utilizada por los guerreros del Clan Serhu para cacería y combate.

**Por qué encaja:** Basado en materiales ya documentados (hueso de Gargantúa, piel de Corredor de Cauce) y en el armamento orco típico de las Llanuras del Viento Rojo: "Hachas de guerra y mazas: el arma por excelencia — pesadas, poco elegantes, pensadas para el combate cuerpo a cuerpo directo que valora la cultura orca" (`items.md`). El Clan Serhu tiene presencia en la región (`07-mundo-helek-sirik.md`, `areas.md`) y el oficio `herrero-orco-llanuras` se usa en las Llanuras (`items.md`).

**Descripción física y funcional:** Hacha pesada de 2.1 kg con mango forrado en piel curada de Corredor de Cauce (resistente al calor) y cabeza de hueso de Gargantúa de Ceniza tallado en un solo bloque. El filo es de hueso pulido con corte recto, no recurvado. Sin adornos, pero lleva una marca de ceniza gris en la espiga para identificar clan y linaje.

**Requisitos o prerequisitos:** Oficio `herrero-orco-llanuras` 2 (auditar receta) · Fuerza 14 · Destreza 10

**Facción/raza que lo usaría:** Orcos del Clan Serhu (hijos de la empalizada del Campamento Serhu en Las Llanuras del Viento Rojo)

**Función concreta:** Combate cuerpo a cuerpo (Hacha 1-Mano), cacería de Gargantúas de Ceniza y animales de presa mediana/grande, símbolo de estatus dentro del clan — solo los guerreros con rango de combate pueden forjarla.

**Implicaciones:** No mágico, crafteo puro. Material de hueso de Gargantúa ya usado en lanzas rituales (`items.md`). El Clan Serhu es una facción de las Llanuras (`07-mundo-helek-sirik.md`).

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Qué estadística sube y cuánto por la cabeza de hueso? (Defensa: 3-5, o Fuerza: +2)
2. ¿Debe llevar marca de ceniza visible (COSMETICO_CINTURA) o solo para la narración?
3. ¿Cualquier forjarlo requiere el Tótem de clan como ingrediente simbólico (narrativo)?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md` (categoría "Items")
- `docs/rpgtarkor/items-y-catalogo/items.md` (añadir entrada si se aprueba)
- `backend/src/services/ItemCatalog.ts` (si se implementa en catálogo técnico)
- (posiblemente) `docs/rpgtarkor/items-y-catalogo/recetas-crafteo.md` (si existe)

---

### 2026-09-26 — Legueros de Piel de Corredor
**Estado: SIN REVISAR**

**Qué se propone:** Pantalón de viaje o armadura inferior ligera confeccionada con piel de Corredor de Cauce, resistente al calor y con movilidad superior para las Llanuras del Viento Rojo.

**Por qué encaja:** La "piel de Corredor de Cauce" ya está documentada como material de tier medio-alto: "Pieles de Corredor de Cauce: ligeras, resistentes al calor, se usan para ropa de viaje — el arnés y los pantalones de Gorhorn son de un material similar" (`items.md`). Coherente con el equipo orco de las Llanuras (`items.md`).

**Descripción física y funcional:** Pantalón holgado de 0.8 kg confeccionado con 3 pieles de Corredor de Cauce cosidas sobre un interior de tela de hueso de Gargantúa. Las costuras llevan refuerzos con cuerdas de hueso. Sin platero, solo `herrero-orco-llanuras`. El tejido se expande con el movimiento y disipa el calor.

**Requisitos o prerequisitos:** `herrero-orco-llanuras` 1 (auditar receta) · Constitución 10

**Facción/raza que lo usaría:** Orcos del Clan Serhu de Las Llanuras del Viento Rojo

**Función concreta:** Armadura inferior ligera para cacería de larga duración, desplazamiento por las Llanuras sin fatiga térmica, símbolo de resistencia. No protege del impacto pero reduce la pérdida de stamina en terreno abierto.

**Dimensiones concretas:** 110 cm de entrepierna, 95 cm de cadera (ancho máximo), 0.8 kg de peso, tier 2.

**Tier y valor:** Tier 2 · 95 Goirnos

**Implicaciones:** No mágico, crafteo puro. Material de piel de Corredor de Cauce ya documentado.

**Contradicciones detectadas:** Ninguna.

**Preguntas abiertas para Álvaro:**
1. ¿Qué atributo sube (Constitución: +1 o Resistencia al calor: +3)?
2. ¿Debería contar como ARMADURA_INFERIOR o como RECURSO/COSMETICO?
3. ¿Cuántas pieles son necesarias (3-5)?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md`
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-26 — Trenza de Colmillo Ancestral
**Estado: SIN REVISAR**

**Qué se propone:** Un collar o accesorio ceremonial con trenzas de colmillos de Gargantúa de Ceniza, usado como marca de estatus y conexión a los ancestros por el Clan Serhu.

**Por qué encaja:** Material de "hueso de Gargantúa" ya documentado como "Amuletos y abalorios de hueso: no son armas, pero son casi universales — vértebras, colmillos o garras de una presa importante, llevados como trofeo/recordatorio, igual que las trenzas de Gorhorn" (`items.md`). Los orcos usan trenzas como símbolo de honor y clan (`items.md`).

**Descripción física y funcional:** Collar de cuero curtido de Corredor de Cauce que sostiene 3-5 colmillos de hueso de Gargantúa trenzados en forma de espiral ascendente. Cada colmillo mide entre 12 y 20 cm. Las costuras son de hilo de hueso. No tiene filo, es símbolo de experiencia de caza y conexión con los antepasados.

**Requisitos o prerequisitos:** `herrero-orco-llanuras` 2 (auditar receta) · Voluntad 10

**Facción/raza que lo usaría:** Orcos del Clan Serhu (guerreros/veteranos de caza)

**Función concreta:** Cosmético de estatus que se usa en ceremonias de cacería, iniciaciones de guerreros y duelos de honor. Aumenta el respeto dentro del clan y marca al portador como veterano.

**Dimensiones concretas:** 50 cm de circunferencia, 150 g de peso, 12 colmillos en total.

**Tier y valor:** Tier 3 · 220 Goirnos

**Implicaciones:** No mágico, crafteo puro. Material de hueso de Gargantúa ya usado en lanzas rituales (`items.md`). No otorga stats combativos, pero tiene valor narrativo.

**Contradicciones detectadas:** Ninguna — distinto de todas las propuestas anteriores (no es arma, armadura, consumible ni herramienta)

**Preguntas abiertas para Álvaro:**
1. ¿Debería contar como ACCESORIO o COSMETICO_ESPALDA? (Requiere definir rango)
2. ¿Cuántos colmillos (3-5 o 5-7)?
3. ¿Cuántos Goirnos tiene valor para el comercio interclan?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md`
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-26 — Guante de Volcanita
**Estado: SIN REVISAR**

**Qué se propone:** Guante de forja artesanal tallado con Volcanita negra y forrado en Lana de Múrgol, usado por herreros-orco-llanuras para proteger las manos en trabajos de alta temperatura y crafteo.

**Por qué encaja:** Material "Volcanita" ya documentado como uno de los minerales de El Filo de las Brasas/Las Fumarolas Negras "segunda gran fuente de materiales de tier alto" (`items.md`). Coherente con la presencia de `herrero-orco-llanuras` en Las Llanuras (`items.md`).

⚠️ *Nota: la Volcanita es de El Filo de las Brasas. El Clan Serhu está en las Llanuras. Verificar cómo llega la Volcanita al herrero (¿comercio con mercaderes?).*

**Descripción física y funcional:** Guante corto de 1.2 kg hecho de Volcanita pulida en forma de placas entrelazadas que cubren dedos y muñeca. Dentro, forro de Lana de Múrgol absorbente de calor. Sin adornos, solo la estructura sólida y negra de la roca volcánica. No mágico, solo protección térmica y contra abrasiones.

**Requisitos o prerequisitos:** `herrero-orco-llanuras` 3 (auditar receta) · Voluntad 12 · Fuerza 11

**Facción/raza que lo usaría:** Orcos herreros del Clan Serhu de Las Llanuras del Viento Rojo

**Función concreta:** Herramienta/cosmético de trabajo para herreros, crafteo de metal, fundición, trabajo con fuego y lava. Reduce quemaduras y abrasiones. Símbolo de dedicación al oficio.

**Dimensiones concretas:** 35 cm de longitud (muñeca a punta de dedos), 2.5 cm de grosor, 1.2 kg de peso, tier 4.

**Tier y valor:** Tier 4 · 340 Goirnos

**Implicaciones:** No mágico, crafteo puro. Volcanita de El Filo de las Brasas (`items.md`), Lana de Múrgol (`items.md`) — ambos materiales ya existentes en lore.

**Contradicciones detectadas:** ⚠️ **Volcanita en las Llanuras.** Verificar cómo llega la Volcanita al Clan Serhu (comercio con mercaderes de El Filo de las Brasas).

**Preguntas abiertas para Álvaro:**
1. ¿Qué atributo ayuda (Constitución: +3 por protección térmica o Voluntad: +2 por resistencia al dolor)?
2. ¿Cada guante cuánto dura? (10-30 usos)
3. ¿Cuánto de Volcanita se extrae de un bloque (5-10 kg)?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md`
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-26 — Red de Pescador de Negueo
**Estado: SIN REVISAR**

**Qué se propone:** Una red de pesca artesanal tejida con fibras de Bulco de Arena, usada para capturar peces de Playa de Ceniza Blanca y Ciénaga Troncal.

**Por qué encaja:** Material "Bulco de Arena" ya documentado como loot pescable de Playa de Ceniza Blanca (`items.md`). Los peces como Jashil, Negueo, Toluh están ya listados como captura (`items.md`). La profesión Pescador existe (`items.md`).

⚠️ *Nota: el Bulco de Arena es un caracol comestible, no una fibra textil. Verificar si puede usarse como fibra o si hay que cambiar el material.*

**Descripción física y funcional:** Red circular de 2.5 m de diámetro con malla de Bulco de Arena (fibras de cuarzo volcánico endurecido) tejida a mano con nudos reforzados en cuerda de Corredor de Cauce. Pesa 0.9 kg. No es mágico, solo material resistente que no enreda, se seca rápido y soporta el peso de varias capturas.

**Requisitos o prerequisitos:** `pescador` 1 (auditar receta) · Destreza 9

**Facción/raza que lo usaría:** Orcos del Clan Serhu de Las Llanuras del Viento Rojo — pescadores de Playa de Ceniza Blanca

**Función concreta:** Herramienta de pesca que permite capturar Jashil, Negueo, Toluh con éxito moderado. No mágico, solo ventaja de oficio. Símbolo de adaptación a la zona costera.

**Dimensiones concretas:** 250 cm de diámetro, 45 cm de altura en la boya, 0.9 kg de peso, tier 2.

**Tier y valor:** Tier 2 · 85 Goirnos

**Implicaciones:** No mágico, crafteo puro. Bulco de Arena ya usado en pescas (`items.md`). Materiales ya existentes en lore.

**Contradicciones detectadas:** ⚠️ **Bulco de Arena como fibra.** El Bulco de Arena es un caracol, no una fibra. Verificar si puede usarse como material textil.

**Preguntas abiertas para Álvaro:**
1. ¿Qué atributo sube (Destreza: +2 o Pescador: +1)?
2. ¿Cuántos peces captura la red simultáneamente? (2-5)
3. ¿Requiere el Tótem de clan como ingrediente simbólico?

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md`
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

### 2026-09-26 — Botas de Marcha de Telda
**Estado: SIN REVISAR**

**Qué se propone:** Botas de cuero reforzado con suela de Madera de Telda, usadas por los orcos de Las Llanuras para marchas de largas distancias sin fatiga articular.

**Por qué encaja:** Material "Madera de Telda" ya documentado como "la mejor madera de las tres variantes de Telda conocidas" de El Pozo de Cauce Viejo y El Cruce de las Cenizas (`items.md`). La "Piel de Miruina" también está listada como loot de la región (`items.md`, `flora-fauna.md`). Los orcos de las Llanuras realizan largas marchas (`items.md`, `historia.md`).

⚠️ *Nota: la Madera de Telda es de El Pozo de Cauce Viejo y El Cruce de las Cenizas, no de Los Pastos de la Deriva. Verificar origen.*

**Descripción física y funcional:** Botas de 1.5 kg con cuero curtido de Miruina forrado con tela de hueso de Gargantúa y suela de Madera de Telda pulida y forrada en piel. La madera soporta impactos y la piel disipa el calor. Sin adornos, diseño funcional: refuerzos en los talones y nudillos. No mágico, solo protección térmica y mecánica.

**Requisitos o prerequisitos:** `herrero-orco-llanuras` 2 (auditar receta) · Fuerza 13 · Destreza 10

**Facción/raza que lo usaría:** Orcos de las Llanuras del Viento Rojo (incluido Clan Serhu), especialmente viajeros, comerciantes, mensajeros y cazarrecompensas.

**Función concreta:** Armadura inferior de pies que reduce la fatiga articular en marchas largas, protege contra escombros y terreno irregular. Símbolo de adaptación a las Llanuras.

**Dimensiones concretas:** 48 cm de circunferencia total, 1.5 kg de peso, tier 3.

**Tier y valor:** Tier 3 · 210 Goirnos

**Implicaciones:** No mágico, crafteo puro. Madera de Telda y Piel de Miruina ya existen en lore (`items.md`, `flora-fauna.md`).

**Contradicciones detectadas:** ⚠️ **Origen de la Madera de Telda.** Verificar si es de El Pozo de Cauce Viejo y El Cruce de las Cenizas (según `items.md`) o de Los Pastos de la Deriva.

**Preguntas abiertas para Álvaro:**
1. ¿Qué atributo sube (Constitución: +2 por resistencia a marchas largas)?
2. ¿Cada bota cuánto dura antes de necesitar refuerzo? (30-50 usos)
3. ¿Cuántos pares de Madera de Telda se producen por bloque? (2-4 pares)

**Archivos que tocaría si se aprueba:**
- `docs/borradores-opencode/propuestas-lore.md`
- `docs/rpgtarkor/items-y-catalogo/items.md`
- `backend/src/services/ItemCatalog.ts`

---

## Categoría: Fauna y flora

### 2026-09-27 — Manto de Sombra
**Estado: SIN REVISAR**

**Nombre común:** Manto de Sombra

**Nombre propio (Feg):** Silh-Nor — "Musgo-Sombra"

**Género de flora:** HELDRAS (hierba-pasto)

**Qué se propone:** Hierba-pasto del Margen Silencioso — capa densa de hojas que cambian de color según la humedad (verdea bajo lluvia, gris ceniza en sequía), formando un manto continuo bajo los árboles.

**Por qué encaja:** El Margen tiene fauna terrestre (Hetris arbóreo, Mekiosi terrestre, Vistue corredor de manada) que necesita cobertura vegetal para alimentarse.

**Descripción física:** Matas compactas de 30-50 cm de ancho, hojas anchas ovales de 10-15 cm que reflejan poca luz. Forma tapiz denso que cubre el suelo forestal.

**Dimensiones concretas:** Mata de 30-50 cm diámetro, altura de tallo 5-15 cm, hojas 10-15 cm.

**Tipo de recurso:** MATERIAL

**Categoría:** hierba (pasto)

**Usos conocidos:** alimentario (carne vegetal suave), forraje para fauna menor (Corredores de Cauce en migración, Múrgol en zonas de paso). Forraje de emergencia humano.

**Tier y valor:** Tier 1 · 1 Goirn.

**Relación con los habitantes:** Los Faerus la ven como regalo del suelo. Los orcos la usan cuando necesitan ración vegetal en expediciones prolongadas.

**Contradicciones detectadas:**
- ⚠️ "Silh-Nor" — nombre Feg inventado.
- ⚠️ "Corredores de Cauce" y "Múrgol" mencionados como fauna, verificar si existen.

**Preguntas abiertas para Álvaro:**
1. ¿Existe alguna HELDRA medicinal de esta especie?
2. ¿Los Faerus tienen ritual de recolección?
3. ¿Los orcos la reconocen por su cambio de color?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Red de Telaraña
**Estado: SIN REVISAR**

**Nombre común:** Red de Telaraña

**Nombre propio (Feg):** Silh-Lis — "Musgo-Malla"

**Género de flora:** TRENIAS (fibra textil)

**Qué se propone:** Fibra textil del Margen Silencioso — tallos finos que filtran agua y retienen humedad, creando microclima húmedo bajo su sombra.

**Por qué encaja:** El Margen Silencioso tiene Enredaderas de las Llanuras, Manto de Sombra y árboles, pero aún falta una TRENIA de fibra húmeda.

**Descripción física:** Tallos finos, 60-90 cm de altura, que se entrelazan formando una malla natural de 30-50 cm de diámetro. Hojas finas y largas, 10-15 cm, que filtran gotas de lluvia hacia el suelo.

**Dimensiones concretas:** Altura 60-90 cm, malla 30-50 cm, hojas 10-15 cm.

**Tipo de recurso:** MATERIAL (fibra)

**Categoría:** fibras

**Usos conocidos:** material (fibras para cordaje fino, redes de pesca o tejidos que retienen humedad). No es tóxica, pero requiere secado lento para evitar fermentación.

**Tier y valor:** Tier 2 · 2 Goirnos.

**Relación con los habitantes:** Los Faerus usan las fibras para redes de pesca y mantos ligeros. Los orcos la recolectan con respeto.

**Contradicciones detectadas:**
- ⚠️ "Silh-Lis" — nombre Feg inventado.
- ⚠️ **TRENIA vs TRENIAS** — confusión singular/plural.

**Preguntas abiertas para Álvaro:**
1. ¿La malla de telaraña es comestible alguna?
2. ¿Los Faerus la cultivan o solo recolectan?
3. ¿Existe un consumible derivado de la fibra?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Espiga del Eco
**Estado: SIN REVISAR**

**Nombre común:** Espiga del Eco

**Nombre propio (Feg):** Silh-Dru — "Musgo-Trigo"

**Género de flora:** GRANOLE (cereal)

**Qué se propone:** Cereal silvestre del Margen Silencioso — espigas de grano pequeño que se secan al sol tenue del dosel, con sabor ahumado y tierra.

**Por qué encaja:** El Margen Silencioso tiene Manto de Sombra (pasto), Bulbo del Eco (raíz), Trufa (seta), Alga de la Niebla (alga), Cántaro (agua almacenada) y otros. Falta un GRANOLE de cereal para complementar dieta básica orca.

**Descripción física:** Espiga compuesta de 15-25 granos pequeños redondos, 5-7 mm de diámetro, color dorado-ocre que se oscurece al madurar. Tallo delgado y flexible que dobla con viento.

**Dimensiones concretas:** Tallo 40-60 cm, espiga 20-30 cm, grano 5-7 mm, peso por espiga 20-40 g.

**Tipo de recurso:** RECURSO / CONSUMIBLE (cereal)

**Categoría:** cereal

**Usos conocidos:** alimentario (grano tostado en pan o raciones secas, sabor suave y ahumado), forraje animales. No tóxico.

**Tier y valor:** Tier 1 · 1 Goirn.

**Relación con los habitantes:** Los Faerus recogen con respeto. Los orcos la encuentran en expediciones al Margen como complemento básico.

**Contradicciones detectadas:**
- ⚠️ "Silh-Dru" — nombre Feg inventado.
- ⚠️ "Espiga Roja de las Llanuras" — mencionada en logs anteriores, verificar si existe.
- ⚠️ "alimenticio" → "alimentario".

**Preguntas abiertas para Álvaro:**
1. ¿Los Faerus tienen ritual de cosecha?
2. ¿Regenera tras cosecha o necesita descanso?
3. ¿Existe un grano medicinal derivado?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — El Nombre del Susurro
**Estado: SIN REVISAR**

**Nombre común:** El Nombre del Susurro

**Nombre propio (Feg):** Sin nombre propio definido (uso descriptivo)

**Artículo:** El

**Género:** F

**Rol ecológico:** Depredador

**Categoría de fauna:** ACECHANTES (insecto depredador volador) ⚠️ verificar categoría correcta

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Una depredadora acuático-voladora pequeña del Margen Silencioso, presa de Mekiosi y Hetris, depredadora de los insectos que infestan los pantanos.

**Por qué encaja:** El Margen Silencioso necesita fauna adicional entre sus residentes, ya que solo tiene 4 criaturas registradas. Esta cierra la cadena trófica de los insectos/invertebrados que infestan los pantanos. Coherente con la "firma de Kroj" (sigilo/noche/silencio).

**Descripción física:** Insecto depredador de vuelo de 25-40 cm, cuerpo negro iridiscente, alas semitranslúcidas con venas de color plata que capturan la luz escasa del Margen de noche. Cabeza alargada con tres ojos compuestos y antenas sensibles a vibración, no al sonido. Alas que se abren repentinamente en un estallido de movimiento, volando en ráfagas de segundos, no en vuelo sostenido. Se mimetiza bajo hojas caídas, ramas o musgo.

**Hábitat:** Pantanos y charcas internas del Margen Silencioso, en la zona de Los Manaderos hacia el norte. Se esconde bajo musgo, caídas y raíces sumergidas.

**Medio de movimiento:** AEREO (vuelo rápido corto) / TERRESTRE (cambios bruscos de dirección).

**Temperamento:** CAUTELOSO.

**Ataque natural:** Ala rápida que sorprende e inflige impacto doloroso; puede picar con fuerza si se le da la espalda.

**Porcentajes:** Domesticable 0%, Capturable 15%.

**Relación con los habitantes:** Presa principal para Mekiosi y Hetris. Los Faerus los respetan como "mensajeros de Vaeth".

**Comportamiento y hábitos:** Nocturna. Caza insectos en bandada. Migra en otoño hacia los pantanos interiores. Indicadores: si dejan de volar, hay peligro cerca.

**Contradicciones detectadas:**
- ⚠️ **"Terkash" no mencionado pero el log anterior lo usa como lagarto.** Verificar.
- ⚠️ Atributos y niveles ausentes.
- ⚠️ "vuelo ráfago" → "vuelo rápido". "infringe" → "inflige".

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "El Nombre del Susurro" es correcto o debería tener nombre en Feg?
2. ¿Los atributos (fuerza, destreza, etc.) y niveles hay que rellenarlos?
3. ¿La categoría correcta es ACECHANTES o GUELISES?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Nymar
**Estado: SIN REVISAR**

**Nombre común:** Nymar

**Nombre propio (Feg):** Nymar — "Araña" (palabra Feg existente)

**Artículo:** La

**Género:** F

**Rol ecológico:** Depredador / Simbionte

**Categoría de fauna:** GUELISES (criatura híbrida) ⚠️ verificar

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Murciélago-pájaro arácnido de los pantanos del Margen Silencioso, criatura híbrida única que teje redes de seda para atrapar insectos y pequeñas presas en vuelo.

**Por qué encaja:** El Margen no tiene fauna aérea/araña combinada ya registrada. Cierra el nicho de depredador aéreo-labiante.

**Descripción física:** Criatura de 45-60 cm, cuerpo delgado con membranas de alas anchas tipo murciélago (25 cm de envergadura), pero con cuerpo y extremidades terminadas en patas de araña de seda, 6 patas extra que cuelgan y ayudan a tejer redes. Caparazón dorsal delgado, piel translúcida bajo las alas. Ojos grandes con retina nocturna. Cola prensil terminada en filamentos de seda.

**Hábitat:** Dosel superior y bordes de las charcas del Margen Silencioso, especialmente en Los Manaderos hacia el norte y los pantanos interiores.

**Medio de movimiento:** AEREO (vuelo lento de planada y ráfaga).

**Temperamento:** INOFENSIVO.

**Ataque natural:** Picos cortantes; si se le da la espalda, puede enredar al atacante en sus propias redes de seda.

**Porcentajes:** Domesticable 0%, Capturable 30%.

**Relación con los habitantes:** Presas para Mekiosi, Hetris. Los Faerus los respetan y se alimentan de los cadáveres que dejan. Vaeth no se alimenta de ellos — los considera "mensajeros".

**Comportamiento y hábitos:** Nocturna. Caza en bandadas de 10-15 individuos. Teje redes de seda entre 2-4 ramas. Migra en otoño a zonas más abiertas.

**Contradicciones detectadas:**
- ⚠️ Atributos y niveles ausentes.
- ⚠️ "Vaeth" — verificar si está documentado.
- ⚠️ "Terkash" no mencionado aquí pero usado en otras criaturas.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Nymar" es Feg real o inventado?
2. ¿Los atributos y niveles hay que rellenarlos?
3. ¿La categoría correcta es GUELISES o CORVENES?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Yeshra
**Estado: SIN REVISAR**

**Nombre común:** Yeshra

**Nombre propio (Feg):** Yeshra — "La Sangrienta" (palabra Feg registrada)

**Artículo:** El

**Género:** M

**Rol ecológico:** Depredador

**Categoría de fauna:** ACECHANTES (murciélago hematófago) ⚠️ verificar

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Murciélago hematófago de los pantanos del Margen Silencioso, depredador especializado en sangre animal y humana que vive en las cavidades de los árboles negros y lianas.

**Por qué encaja:** El Margen Silencioso ha registrado murciélagos en general, pero no tiene murciélago de sangre como depredador activo. Cierra el nicho de murciélago carnívoro de los pantanos.

**Descripción física:** Murciélago de 40-65 cm, cuerpo delgado con alas membranadas de tonos gris ceniza y manchas rojas en los dedos. Piel translúcida bajo las alas. Mandíbula alargada con dientes afilados especializados para incisión y succión. Cola prensil y pies con garras para escalar lianas. Ojos grandes con retina nocturna. Cuerpo cubierto de pelo fino gris con mechones rojos.

**Hábitat:** Cavidades de árboles negros y lianas en los pantanos del Margen Silencioso, zona intermedia entre Los Manaderos y el corazón del laberinto.

**Medio de movimiento:** AEREO (vuelo sostenido en formación).

**Temperamento:** AGRESIVO (solo con sangre accesible).

**Ataque natural:** Sangre directa desde el aire; vuela alto y desciende en picado.

**Porcentajes:** Domesticable 0%, Capturable 5%.

**Relación con los habitantes:** Presa para Mekiosi y Hetris. Los Faerus los respetan pero no comen. Vaeth no se alimenta de ellos, pero su presencia anuncia el aullido de Vaeth si una manada muere.

**Comportamiento y hábitos:** Nocturna. Vuela en formación cónica en el dosel. Solo ataca cuando hay sangre fresca. Migra en otoño.

**Contradicciones detectadas:**
- ⚠️ Atributos y niveles ausentes.
- ⚠️ "Vaeth" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Yeshra" es Feg real o inventado?
2. ¿Los atributos y niveles hay que rellenarlos?
3. ¿La categoría correcta es ACECHANTES o GUELISES?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Pashra
**Estado: SIN REVISAR**

**Nombre común:** Pashra

**Nombre propio (Feg):** Pashra — "Pez" (palabra Feg existente, aunque Pashra no es pez)

**Artículo:** La

**Género:** F

**Rol ecológico:** Depredador

**Categoría de fauna:** NADANTES (anfibio) ⚠️ verificar

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Una rana gigante de pantano del Margen Silencioso, depredadora de insectos acuáticos y pequeños peces, con piel que absorbe humedad y nutrientes del agua estancada del laberinto.

**Por qué encaja:** El Margen tiene Nuente (híbrido rana-murciélago), pero Nuente no es depredador de insectos acuáticos ni de peces en charcas. Pashra cierra el nicho de anfibio terrestre/pantanos no volador.

**Descripción física:** Anfibio de 80-100 cm, cuerpo robusto y redondeado con patas traseras poderosas para salto, piel verde musgo oscuro con manchas gris ceniza que imitan musgo y corteza podrida. Ojos grandes con pupilas verticales, boca ancha con dientes pequeños para emboscada. Cola prensil corta con garras afiladas.

**Hábitat:** Charcas y zonas pantanosas del Margen Silencioso, especialmente en Los Manaderos hacia el norte.

**Medio de movimiento:** AEREO (salto corto de 2-4 metros) / TERRESTRE (nadador experto).

**Temperamento:** CAUTELOSO.

**Ataque natural:** Salto brusco desde el agua, lengua pegajosa que atrapa insecto; si no hay lengua, usa mandíbula y fuerzas.

**Porcentajes:** Domesticable 0%, Capturable 20%.

**Relación con los habitantes:** Presa para Mekiosi, Hetris, Lebudes, Nuente. Los Faerus los respetan pero no comen.

**Comportamiento y hábitos:** Diurna y nocturna, más activa de noche. Caza insectos en charcas. Desova en charcas temporales.

**Contradicciones detectadas:**
- ⚠️ Atributos y niveles ausentes.
- ⚠️ "Nuente" — verificar.
- ⚠️ "Lebudes" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Pashra" es Feg real o inventado?
2. ¿Los atributos y niveles hay que rellenarlos?
3. ¿La categoría correcta es NADANTES o MUDOS_SALVAJE?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Seshra
**Estado: SIN REVISAR**

**Nombre común:** Seshra

**Nombre propio (Feg):** Seshra — "Rastro" (movimiento sigiloso)

**Artículo:** El

**Género:** M

**Rol ecológico:** Depredador

**Categoría de fauna:** ACECHANTES (solitario pequeño) ⚠️ verificar

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Acechante solitario pequeño del Margen Silencioso, depredador de emboscada en el sotobosque y zonas con vegetación baja, diferente a Mekiosi que es terrestre pesado.

**Por qué encaja:** El Margen tiene ACECHANTES en forma de Mekiosi (reptil-animale terrestre pesado), pero no tiene ACECHANTES pequeñas del sotobosque. Seshra cierra el nicho de acechante pequeño del suelo.

**Descripción física:** Cuadrúpedo de 70-90 cm, cuerpo esbelto y musculoso, patas largas para correr y saltar entre vegetación baja. Pelaje corto gris verdoso con vetas oscuras que imitan sombras bajo el dosel, cola prensil corta con garras afiladas. Ojos grandes con pupilas verticales. Mandíbula afilada con dientes de corte y garras de ataque.

**Hábitat:** Sotobosque del Margen Silencioso, especialmente en los bordes de las charcas y zonas de vegetación baja.

**Medio de movimiento:** TERRESTRE (corredor sigiloso, saltos entre vegetación).

**Temperamento:** CAUTELOSO.

**Ataque natural:** Emboscada desde vegetación baja; salta sobre la presa.

**Porcentajes:** Domesticable 0%, Capturable 10%.

**Relación con los habitantes:** No es presa principal para Mekiosi/Hetris — son rivales. Los Faerus los respetan como "sigiladores del sotobosque".

**Comportamiento y hábitos:** Nocturna. Caza en solitario. Migra en otoño hacia el norte del laberinto.

**Contradicciones detectadas:**
- ⚠️ Atributos y niveles ausentes.
- ⚠️ Menciona "Vistue" como manada, pero Vistue ya existe como criatura de otro log.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Seshra" es Feg real o inventado?
2. ¿Los atributos y niveles hay que rellenarlos?
3. ¿La categoría correcta es ACECHANTES o RONDINES?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

### 2026-09-27 — Terkash ⚠️ DUPLICADO
**Estado: SIN REVISAR — POSIBLE DUPLICADO**

**Nombre común:** Terkash

**Nombre propio (Feg):** Terkash (sin nombre propio fijo, "Palo" — posible uso del Feg)

**Artículo:** El

**Género:** M

**Rol ecológico:** Depredador

**Categoría de fauna:** ESCAMADOS (reptil arbóreo) ⚠️ verificar

**Nivel base / máximo:** ⚠️ No especificado

**Atributos:** ⚠️ No especificados

**Qué se propone:** Un lagarto arbóreo del Margen Silencioso que vive en los árboles negros del dosel, depredador de insectos grandes, huevos de ave y murciélagos jóvenes.

**Por qué encaja:** El Margen tiene reptiles, pero falta un reptil de los árboles del dosel pantanoso, no volador.

**Descripción física:** Reptil de 60-90 cm, cuerpo esbelto con escamas lisas, tonos verde grisáceo con vetas negras que imitan corteza. Cola prensil larga. Ojos grandes con pupilas verticales. Mandíbula fuerte para triturar huevos.

**Hábitat:** Dosel de los árboles negros del Margen Silencioso, especialmente en Los Manaderos hacia el norte.

**Medio de movimiento:** TERRESTRE (arrastrado entre ramas).

**Temperamento:** CAUTELOSO.

**Ataque natural:** Emboscada en rama, muerde con fuerza.

**Porcentajes:** Domesticable 0%, Capturable 15%.

**Relación con los habitantes:** Presa principal de Mekiosi. Los Faerus los respetan como "limpiadores de los árboles".

**Comportamiento y hábitos:** Diurna. Caza en solitario. Se oculta a la siesta bajo corteza.

**Contradicciones detectadas:**
- ⚠️ **DUPLICADO: "Terkash" ya existe en otro log como loot de Los Acantilados Partidos.** Aquí es un lagarto del Margen. Contradicción grave. Hay que renombrar uno de los dos.
- ⚠️ Atributos y niveles ausentes.
- ⚠️ "Salamandra de Escoria volcánica" — mencionada pero no documentada.
- ⚠️ "Nuente" — verificar.

**Preguntas abiertas para Álvaro:**
1. ¿El nombre "Terkash" es para el lagarto o para el loot de Los Acantilados? **Hay que decidir.**
2. ¿Los atributos y niveles hay que rellenarlos?
3. ¿La categoría correcta es ESCAMADOS o MUDOS_SALVAJE?

**Archivos que tocaría si se aprueba:**
- `docs/rpgtarkor/lore-mundo/flora-fauna.md`
- `backend/src/scripts/worldCatalog.ts`

---

## Categoría: Personajes y NPCs

## Categoría: Otros

*(Vacía — para propuestas que no encajen en las categorías anteriores)*

## Tanda OpenCode 2026-10-03 — descartes (revisión del 2026-10-06)

**RECHAZADAS (revisión delegada en Claude por la usuaria, 2026-10-06).** Por decisión de la usuaria
no se guarda el texto original, solo el motivo. Lo que valía de esta tanda está en
[propuestas-aprobadas.md](propuestas-aprobadas.md) (fichas B-01 a B-08 y C-01 a C-11).

Por qué se descartan:
- **La Murmuración de las Raíces**: copia la escucha con la palma de los Nabieus (*Tovh'vhurne*) para los Faerus, que leen con el olfato.
- **El Jurado del Fuego**: usa *Grath'sil* («tierra que arde», la guerra) como si fuera un rito del fuego, y presenta el fuego como un descubrimiento tardío de Hashma, cuando los Faerus lo usan desde siempre.
- **La Tolda del Ancestro**: choca con el Jakut de Kegi (una losa de piedra roja) y con el origen de Kegi en el Pacto de la Primera Pieza (~2.300).
- **Feg'ghep (el debate en el Jakut)**: pone votos y mayorías en el Jakut; el canon dice lo contrario: decide quien está sentado, sin votos ni cargos.

## Tanda OpenCode 2026-10-06 y 10-07 — descartes (revisión del 2026-10-07)

**RECHAZADAS (revisión delegada en Claude por la usuaria, 2026-10-07).** Solo se guarda el motivo,
no el texto original. Lo que valía de la tanda está en [propuestas-aprobadas.md](propuestas-aprobadas.md)
(D-01…D-03, G-01…G-04, O-01 y los añadidos a B-01 y C-03).

- **Tabú del Inacabado**: ya es canon, palabra por palabra (`razas.md` § Goirntes); *nirgoth* es inventado.
- **Lectura del Terreno con la Palma**: repite la escucha con la palma y el cónclave (B-01). La piel que «atrapa la luz para ver huellas» no tiene sentido.
- **Ritual del Mensajero**: la tablilla con «códigos» rompe el *Karo'sael* (los Nabieus nunca guardan cartas), y «Concordia segundo» es anacrónico, porque llevan el correo desde El Borde (~2.100).
- **Transmisión del Ashi'krul**: contradice C-04 y C-11: la daga pasa a quien el muerto quería, no se negocia en grupo.
- **Primer Pieza Ritual**: repite C-02. La Tolda es para comerciar, no para ritos.
- **Saludo del Lazo**: «exactamente 3 segundos» y *Keseg'laa* son inventados. Solo hay dos clanes, y el gesto de las palmas ya es del Pacto del Umbral.
- **Camino de las Piedras Anual**: repite C-08 y le añade ofrendas sin base (un hacha vieja).
- **Tabú de las Profundidades Prohibidas**: choca con los Nabieus investigadores y con el Archivo; lo de callar dónde vive el otro clan ya es el Pacto del Umbral.
- **Sello del Rastro**: repite C-07 y el rastro de los linajes (`CR-52`).
- **Jerarquía del Cónclave**: pone voces con más peso y a los Segadores (una clase, no un rango) por encima. El canon dice: sin gobierno, el portavoz no es líder.
- **Nomenclatura del Clan**: da significados falsos (*Sael* es «callar», no «protector») y un cambio de nombre cada 10 años que no existe.
- **Ceremonia de la Última Pieza**: contradice C-11 (los muertos se dejan en la selva) y el *Feg'nur*.
- **Vork-veer**: un control semanal de simetría ante un espejo, «cada sábado». No hay semanas con nombre, y el rito no aporta nada.
- **Kral-der**: se inventa una fisiología (enfriarse la piel por voluntad).
- **Vesh-bril**: convierte en rito el brillo metálico, que es una señal involuntaria («se les nota pensar»).
- **Vash'krul**: se inventa al «Juli», que decide si admitir a un joven; contradice C-02 y el Jakut.
- **Feg'nur-veer**: deja al herido en la selva a los 3 meses: rompe el *Feg'nur* y C-09.
- **Yugh-tel**: radicales y moderados revisando leyes cada 5 años no encaja con la Concordia, que es una cadena de mando.
- **Oth-veil**: un espejo para comprobar que los ojos son negros; no aporta nada.
- **Mosh'gath**: da acceso a las forjas por una prueba de agilidad, con título incluido; las castas son de nacimiento.
- **Mharr-kul**: se inventa una «oxigenación lenta» y un grito; los Goirntes no hacen ritos de grupo de ese tipo.
- **Vold-krul**: la Mesa del Lazo es orca (Maktor). Censor y Archimagistrada no negocian como iguales.
- **Gramática de los Silencios, Crónicas del Fuego, Registro con Símbolos, Inicio del Lazo, Pausa de Decisión**: *(no son descartes: aprobadas con correcciones como D-01, añadido a C-03, D-02, D-03 y añadido a B-01)*
- **Vorn-tel'goirme, Oth-krul, Gosh-krul, Fesh-kruv, Tarn-veer, Nesh-veer, Ghor-krul, Vesh-krug, Signe-krul**: *(no son descartes: fusionadas o aprobadas como G-01…G-04 y O-01)*
