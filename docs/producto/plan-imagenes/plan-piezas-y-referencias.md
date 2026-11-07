# Plan: piezas, luz por lugar y varias referencias

Plan del 2026-11-07. **Aprobada solo la fase 1** (`IMG-51`, `IMG-52` y las pruebas P1-P3); lo demás se decide con sus imágenes. Nace de `IMG-50` y de dos peticiones suyas:

- «No se puede hacer un puzzle si no tienes las piezas»: antes del Goirnte tiene que existir su lugar, y la luz depende de
  ese lugar.
- Además de la imagen del juego, poder adjuntar otras referencias, con un máximo, para combinar: «2 aulladores cazando
  1 múrgol, en la hondonada, con 1 orco guerrero reposando en los muros».

Las tareas llevan letra (`T1`…): T1 es `IMG-51`, T2 es `IMG-52`; las demás reciben su `IMG-*` y su hito cuando se aprueben. Hechas T1 y T2 (2026-11-07); faltan las pruebas P1-P3 y lo demás está sin empezar.

## 1. Qué podrás elegir

Cada elemento y cada escena tendrá un panel **Piezas y referencias**, en cualquier fase. Todo viene propuesto y todo se
puede cambiar:

```text
┌ Piezas y referencias ───────────────────────────────── 3 de 4 ┐
│ Lugar  [Meseta del Orden ▾]  ★ imagen · solo texto · ninguno  │
│ Luz    [La del lugar ▾]      región · ambiente · escribirla   │
│                                                               │
│ Referencias                                 Rol               │
│ 1 ▣ goirntes-meseta-macho (del juego)       [Sujeto ▾]   ✕    │
│ 2 ▣ meseta-★2                               [Lugar ▾]    ✕    │
│ 3 ▣ armadura-mia.png (adjunta)              [Equipo ▾]   ✕    │
│ [+ Del juego]  [+ De mis ★]  [+ Adjuntar]                     │
│                                                               │
│ ⚠ Falta «armadura goirnte» sin imagen ★   [Crearla] [Seguir]  │
└───────────────────────────────────────────────────────────────┘
```

| Eliges | Opciones | Por defecto |
|---|---|---|
| **Lugar** | Una imagen ★ o del juego, solo el texto de la región, o ninguno | El lugar o la región que diga su lore |
| **Luz** | La del lugar, la de la región, un ambiente (despejado, tormenta, ocaso, noche) o escrita a mano | La del lugar; sin lugar, la de la región |
| **Referencias** | Del juego, tus ★ o adjuntas, con su orden y hasta el máximo | Ninguna, como la casilla de hoy |
| **Rol de cada referencia** | Sujeto, lugar, equipo o estilo | Según su tipo; lo adjunto empieza como sujeto |
| **Piezas que faltan** | Crearlas ahora o seguir sin ellas | Ver decisión D1 |
| **Texto de cada pieza** | Heredar su prompt aprobado o no | Heredar |
| **Cómo se monta una escena** | Las rutas de §4 que superen la prueba | La que mejor salga en la prueba |

Lo que elijas queda guardado en cada intento: se ve en «Cómo se hizo» y se puede repetir, también si borras el adjunto
original, porque se guarda una copia dentro del elemento.

## 2. Lo que hay hoy

| Tema | Estado | Consecuencia |
|---|---|---|
| Referencias en `fase.py` | Una sola `--referencia`; en la Final va detrás del boceto. Apunta un solo nombre en `camino.json` | Hay que pasar a una lista |
| Varias `-r` en `sd-cli` | **Probadas con dos** (`IMG-25`). Más, sin probar | P3 lo mide |
| Máximo del modelo | La documentación de BFL da **4** para klein, el modelo de F0 y Final | La Final gasta una con el boceto |
| Interfaz | Solo la casilla «usar la imagen del juego». No hay subida de archivos | Ruta y panel nuevos |
| Biblioteca ★ | Sin hacer (`IMG-42`) | Hasta entonces, «De mis ★» no estará disponible |
| Luz | `mundo.json` fija «golden-hour» en la cola de día y atardecer, y añade la de la región al prompt | Se contradicen, y las de región tampoco casan siempre con los banners |
| Región del elemento | La tienen fauna, flora, objeto, lugar y variante de raza. **No** npc, raza general, construcción ni personaje | Hay que completar el dato |
| Piezas | No existe el concepto. El RAG trae lore parecido | De ahí viene lo ajeno, como el hielo del hacha |
| Montaje | `montar.sh`: un fondo, un sujeto y copias de él. El recorte no se guarda (`IMG-37`, `IMG-43` sin hacer) | Tres piezas distintas aún no se pueden montar |
| Desfase | `camino.json` ya marca fases desfasadas dentro de un elemento, no entre elementos | Se puede ampliar |

### Dos cosas que este plan reabre

1. **Decisión de la usuaria del 2026-11-06:** cada elemento se crea suelto y sin bloqueo por zona; por eso se descartó
   `IMG-12`, y `IMG-2` «avisa, no bloquea». La idea de las piezas encaja si solo avisa; si bloquea, vuelve `IMG-12`. Es la
   decisión D1.
2. **`IMG-1` dice que combinar sustituye a pasar `-r`, porque el modelo reinventaba el elemento**, y la pauta E3 lo confirma:
   una referencia de otro elemento solo aporta acabado y la forma vuelve a la común (r28, r29). Esas pruebas no pedían
   conservar la identidad de varias imágenes con un rol para cada una, que es lo que recomienda BFL. **Por eso lo primero es
   probarlo**: si E3 también se cumple así, las referencias seguirán sirviendo para luz y estilo, y la identidad de las piezas
   tendrá que venir del montaje.

## 3. Cómo encaja

```text
Mundo: estilo común, sin luz fija
  └─ Región: paisaje y luz de cada hora
       └─ Lugar ★: su imagen fija la luz y el fondo reales
            ├─ Raza ★: cuerpo, una vez ──┐
            ├─ Equipo ★: armadura, capa ─┼─ Personaje ★
            ├─ Fauna ★ · Flora ★ · Objeto ★
            └─ Escena: lugar + piezas + lo que pasa
```

- **Cada elemento declara sus piezas**, propuestas desde el lore (región, hogar, raza, oficio) y corregibles en el panel. Así
  sigue valiendo para creación continua: no pide un retoque a mano por elemento, aunque lo permite.
- **Las piezas llegan por dos vías:** su prompt aprobado, en lugar del RAG, y su imagen como referencia con un rol.
- **Dentro de un mismo lugar la luz también varía.** Cardo, agujas y hacha comparten región con luces cálida, carmesí y de
  tormenta, y el banner del orco de la Hondonada es gris y marrón frente al rojo de la Hondonada. Por eso el lugar da el valor
  inicial, no una regla fija.
- **Si una pieza cambia,** lo que salió de ella se marca como desfasado. Solo avisa; nunca se regenera solo.
- **El lore no se toca.** Si una pieza inventa algo que el lore no dice, como la armadura, es una decisión de imagen. Para que
  sea canon hace falta una propuesta en una sesión de lore.

## 4. Las escenas: tres rutas

Con el ejemplo pedido: Hondonada del Eco (`location`), aullador rojo y múrgol (`fauna`), orco de la Hondonada (`npc`). Todos
tienen banner, y la Hondonada tiene paredes con arcos, así que la frase de «reposando en los muros» tiene dónde ocurrir.

| Ruta | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Todo por referencias** | Prompt de la escena + referencias con rol en F0 y Final | La acción y la luz salen unidas; el aullador puede correr aunque en su imagen esté quieto | Puede reinventar las piezas (E3), fallar la cantidad («2») y perder las pequeñas |
| **B. Composición tosca + referencias** | Colocas recortes aproximados; eso es el boceto, y la Final lo sigue con las referencias | Tú decides dónde va cada uno y cuántos hay (la Final conserva el boceto, E1) | La pose inicial pesa; **4 piezas + boceto son 5 referencias** |
| **C. Montaje puro** (`IMG-43`, `IMG-1`) | Piezas ★ recortadas y armonizadas, sin rehacerlas | Identidad exacta | Sin nueva acción: cada pieza mantiene su pose. Necesita `IMG-37` e `IMG-43`, y falta saber si `--mask` protege las piezas |

Ninguna se descarta aún. Se prueban A y B porque son baratas; C ya tiene sus tareas y solo se adelanta si la identidad falla en
las otras dos.

## 5. Por fases, con puntos de decisión

### Fase 1 · Pruebas que deciden (primero, con el mínimo de código)

- **T1 · Medir la luminosidad [S]:** EMD de la luminancia junto a Cb y Cr en `medida.py`, en `camino.json` y en la pantalla.
  Hoy un Goirnte luminoso da «ok» frente a un banner casi negro.
- **T2 · Varias referencias con rol en `fase.py` [S]:** `--ref <rol>:<imagen>` repetible; lista `referencias` en `camino.json`,
  que sigue leyendo el `referencia` antiguo; prefijo «image 1 is…, image 2 is…» según el rol; rechazo por encima del máximo.

Después, las tres pruebas. Cada tanda lleva antes su pregunta de memoria y su sí.

| Prueba | Qué se hace | Qué responde | Deck (estimado) |
|---|---|---|---|
| **P1a. Orco de las llanuras, con piezas ya hechas** (usuaria, 2026-11-07) | F0 sin referencias y con campamento o choza (`lugar`) y maza (`equipo`), a igual semilla, midiendo contra su banner, que nunca va de referencia | Con las mejores piezas posibles, ¿las referencias acercan al banner? | ~10 min |
| **P1b. Goirnte por piezas** | Meseta → cuerpo → armadura → conjunto, y compararlo con su banner y con las F0 de hoy | ¿Y con piezas generadas aquí, el caso de un elemento nuevo? | ~15 min |
| **P2. La escena del ejemplo** | Rutas A y B, 2 semillas cada una | ¿Conserva la identidad? ¿Respeta «2 aulladores»? ¿Qué ruta manda? | ~30 min |
| **P3. Coste por número de referencias** | Una F0 y una Final con 1, 2, 3 y 4 referencias (en la Final, boceto incluido) | Tiempo y memoria hasta el máximo de 4 | ~20 min |

**Resultado de P1a (2026-11-07): las referencias no acercan al banner.** Prompt `r31` (el de `r20` con maza en vez de hacha, para
no contradecir la pieza), semillas 42 y 1234, en `generated/raza/orcos-llanuras-macho/`:

| Variante | EMD Y (42 / 1234) | EMD Cb | EMD Cr | Tiempo |
|---|---|---|---|---|
| Sin referencias | 43,6 / 40,9 | 1,2 / 1,7 | 2,9 / 2,9 | ~38 s |
| Choza + maza | 45,4 / 41,3 | 1,3 / 1,9 | 3,1 / 3,6 | ~59 s |
| Campamento + maza | 45,7 / 42,1 | 1,8 / 1,4 | 2,5 / 2,9 | ~58 s |

A ojo, las seis son la misma imagen clara y lechosa: ni la luz naranja de la choza ni la tormentosa del campamento, y siguen las
tiendas rojas del prompt, no las del campamento. La maza ya sale parecida sin referencia. Son dos semillas: es un indicio. La prueba
tiene un límite: el prompt también describía lugar y luz, y pudo imponerse a las referencias. P1b queda parada.

**Repetición con `r32`, sin lugar ni luz en el prompt (2026-11-07): el lugar y la luz sí llegan desde las referencias.**

| Variante | EMD Y (42 / 1234) | EMD Cb | EMD Cr | Tiempo |
|---|---|---|---|---|
| Choza + maza | 16,1 / 16,3 | 8,5 / 6,4 | 7,7 / 6,5 | ~58 s |
| Campamento + maza | 20,0 / 22,5 | 2,1 / 2,1 | 3,3 / 3,0 | ~58 s |

A ojo, el cielo naranja y las agujas son de la choza, y el cielo tormentoso y las mesas, del campamento. Por eso la choza se aleja en
color: acerca la imagen a su luz, no a la del banner. El orco no conserva sus proporciones: sale más grueso y menos realista, en algunas
se le cortan los pies y en la de campamento 1234 aparece un segundo palo. **Falta un control:** `r32` sin referencias, porque esta tanda
cambió el prompt y las referencias a la vez y no separa cuánto mejora cada cosa. P1b sigue sin lanzarse hasta verlo.

**Control (`r32` sin referencias):** sale el orco sobre fondo blanco (Y 77,5/75,3, Cb 6,5/6,6, Cr 7,0/7,3). El lugar y la
luz los ponen las referencias, y el orco grueso sale también sin ellas, así que no lo causan. De paso, `r32` da un sujeto
limpio sobre blanco, que sirve para el recorte.

#### Prueba por pasos (2026-11-07, con el sí de la usuaria)

Propuesta de la usuaria, no definitiva: fondo solo, luego orco sin equipo, luego detalles y al final el render. Se prueba
con un cambio por paso; el valle es el de `r33` (semilla 42: Y 38,9, Cb 3,2, Cr 9,3), con la cornisa de la izquierda vacía.
«Fondo intacto» es el SSIM del tercio derecho (`crop=220:192:260:0`) contra ese fondo; las medidas, Y / Cb / Cr contra el
banner del orco, con las semillas 42 y 1234.

| Paso | Cómo | Fondo intacto | Y | Cb | Cr | A ojo |
|---|---|---|---|---|---|---|
| Orco, vía A | `r34`, fondo como `--ref lugar` | 0,988 / 0,986 | 30,6 / 28,6 | 3,8 / 3,7 | 8,7 / 8,6 | Integrado, con la luz del fondo y la pose pedida; la cornisa se rehace un poco |
| Orco, vía B | `r34`, `--mask` sobre el fondo a 0,97 | 0,994 / 0,993 | 29,0 / 27,8 | 4,6 / 2,8 | 7,2 / 5,7 | Integrado; cambia la cornisa entera y en 1234 sale una cola |
| Orco, vía C | `r35` sobre verde, `montar.sh` y armonizado a 0,5 | 0,912 / 0,819 | 23,1 / 16,7 | 4,0 / 4,0 | 7,4 / 8,1 | Más dibujo 3D; el verde sale teñido de luz y hubo que limpiarlo a mano, y armonizar rehace el valle |
| Maza | `r36` sobre la A 42, `--ref sujeto` y `--ref equipo` | 0,975 / 0,977 | 31,1 / 26,6 | 4,8 / 4,8 | 10,3 / 10,3 | Solo aparece la maza, con la luz del valle aunque su referencia es de noche; el orco no cambia |
| Final corta | `r37` (prefijo F4 y «no cambies nada»), maza 42 como `-r` | — | **9,7** | **2,7** | **4,0** | La más cercana al banner hasta ahora: piel, roca y luz realistas, misma composición; pierde los colmillos y las grietas de la piel |
| Final completa | `r38` (prefijo F4 y descripción entera) | — | 22,2 | 4,7 | 7,8 | Misma composición, pero lechosa y de dibujo: el texto largo vuelve a imponerse, como en P1a |
| Rasgos en la Final | `r39` (`r37` más colmillos y piel agrietada), maza 42 como `-r` | — | 11,3 | 2,9 | 4,8 | Grietas sí; colmillos hacia los lados, como de morsa; nariz larga y algo más de render 3D |
| Rasgos, F0 | `r40` sobre la maza 42, solo cambio | — | — | — | — | 42 apenas cambia; 1234 pone colmillos y grietas, pero pierde la barba |
| Rasgos y nariz, F0 | `r41` (`r40`, nariz chata y conservar la barba) | — | — | — | — | 42: nariz bulbosa, sin grietas; 1234: nariz chata, colmillos hacia arriba, grietas y algo de barba |
| Final sobre rasgos | `r37` sin cambios, `r41` 1234 como `-r` | — | **9,8** | 3,0 | 4,3 | Conserva colmillos, grietas y nariz más ancha, con el color de `r37`; un colmillo sale blanco y deshilachado, como bigote |

Conclusiones (una semilla en la Final; se confirman con más elementos antes de reescribir el plan de fases):

- **Por pasos funciona** sin montaje: el fondo como referencia y un prompt de solo cambio («Keep… Change only… Change nothing
  else») añaden el orco y luego la maza sin rehacer lo demás. La vía C no escala (limpieza a mano) y la B no conserva más.
- **La Final con prompt corto**, que solo pide no cambiar nada y el estilo, respeta lo construido y da el mejor color medido.
  Con la descripción entera se pierde el realismo: el detalle va en los pasos, no en la Final.
- **Los rasgos van en un paso F0, no en la Final:** `r41` (solo cambio) y luego la Final corta `r37` los conserva con el
  mismo color (Y 9,8); metidos en la Final (`r39`) salen peor y empeora el color.
- **Falta:** colmillos más gruesos y cortos, otra semilla en la Final, y probar la noche o el invierno como variante
  desde el fondo aceptado. Tiempos: F0 ~16-46 s por paso, Final ~158 s.

Los tiempos parten de pocos datos: F0 ~37 s y ~48 s con una referencia; Final ~160 s con una y ~206 s con dos. Si siguiera
igual, una Final con cuatro rondaría los 5 minutos, pero eso es una extrapolación y P3 lo comprueba.

**Punto de decisión tras la fase 1**, con las imágenes delante:

- **Conserva la identidad:** sigue el plan tal como está, y `IMG-1` se reescribe.
- **No la conserva:** las referencias quedan para luz, estilo y lugar, y las escenas pasan por la ruta C. T7 se reduce mucho.
- **Las piezas tampoco acercan al banner (P1):** se para y se replantea antes de construir pantallas. Si P1a ya falla, P1b no se lanza.

### Fase 2 · La luz sale del lugar

- **T3 · Luz por capas [M]:** quitar la luz de la cola fija cuando haya lugar o región; orden lugar → región → ambiente → a
  mano; textos de `mundo.json` sin «sun» y contrastados con los banners, ambientes incluidos, y vetar «sun» en el validador.
  `prompt_ficha.py` comparte ese archivo, así que sus tests entran en la tarea. Se prueba con los cuatro elementos de hoy,
  misma semilla.

### Fase 3 · Referencias en la interfaz

- **T4 · Panel de referencias y adjuntos [M]:** servidor y pantalla, también en `?mock=1`.
  - **Adjuntar:** ruta de subida solo en la interfaz local, PNG y JPEG con tamaño máximo, comprobando que el archivo es lo que
    dice ser; copia en `generated/<tipo>/<slug>/referencias/`.
  - **Elegir:** imagen del juego (buscar en cualquier elemento), orden, rol y quitar. «De mis ★» llega con `IMG-42`.
  - **Límites a la vista:** contador «3 de 4», tiempo estimado según cuántas lleve, y en la Final aviso de que el boceto ocupa
    una, para elegir cuál se queda fuera.
  - **Lo adjunto nunca va al juego:** no se publica ni entra en los conjuntos del LoRA salvo que lo decidas.

### Fase 4 · Piezas

- **T5 · Declarar piezas [M]:** `piezas` de cada elemento, propuestas desde los datos; completar la región de npc, raza general,
  construcción y personaje; aviso de lo que falta con «Crearla», que generaliza `IMG-2` a cualquier elemento.
- **T6 · El prompt hereda de las piezas [M]:** `generateImagePrompt` recibe el texto aprobado de cada pieza y la luz elegida,
  y el RAG deja de usarse si hay piezas, lo que debería quitar la fuga. Con referencias, el modelo escribe solo lo que no
  aportan. Aquí se juzgan el gólem y los huecos mal rellenados, que pueden desaparecer con la raza como pieza.
- **T9 · Aviso de desfase entre elementos [S]:** si cambia una pieza, se marca lo que salió de ella.

### Fase 5 · Escenas

- **T7 · Elemento de tipo escena [M, o S si manda C]:** tipo `escena` en `generated/`, con texto libre de lo que pasa y sus
  piezas, y las mismas fases de siempre. Una escena ★ puede ser pieza. Depende de lo que salga en P2.
- `IMG-37`, `IMG-43`, `IMG-1` e `IMG-2` siguen como están en el bloque E, con `IMG-1` reescrita según P2.

### Fase 6 · Cierre

- **T8 · Pautas [S]:** `pautas.md` §16 (piezas, luz, referencias con rol y máximo, con su evidencia), `diseno-interfaz-continua.md`
  y `mapa-agente.md` al día. Y una prueba sin banner, para saber qué se logra con un elemento nuevo.

## 6. Relación con lo que ya existe

| Tarea | Qué le pasa |
|---|---|
| `IMG-50` | Se cierra con T1, T3 y T6, o antes si la usuaria lo prefiere |
| `IMG-12` | Sigue descartada, salvo que D1 pida bloquear |
| `IMG-2` | Pasa a formar parte de T5 |
| `IMG-1` | Se reescribe tras P2 |
| `IMG-42` | Da «De mis ★». T4 funciona sin ella, solo con juego y adjuntos |
| `IMG-37`, `IMG-43` | Necesarias para la ruta C |
| `IMG-38` | Las variantes heredan piezas y luz; su medida se hace después de T3, para no medir con la luz antigua |
| `IMG-9` | Las fichas pueden proponer piezas; no es requisito |
| `IMG-47`-`IMG-49` | Sin cambios: cuando haya biblioteca propia, sustituye a los banners GPT como referencia |

## 7. Riesgos

| Riesgo | Cómo se ve | Qué se hace |
|---|---|---|
| El modelo reinventa las piezas | P2 | Ruta C; referencias solo para luz y estilo |
| Lo pequeño desaparece o falla la cantidad | P2. BFL avisa de que «los pequeños pueden no aparecer» | Ruta B, o pedir más cerca al sujeto |
| El tiempo crece con cada referencia | P3 | Máximo menor |
| Crear piezas se encadena sin fin | P1 | Avisar y no bloquear; solo un nivel de piezas propuesto |
| Medir contra el banner no sirve para elementos nuevos | T8 | Prueba sin banner antes de sacar conclusiones generales |
| Pocas muestras | Todas | Mínimo 2 semillas en P2; lo que dependa de una sola muestra se apunta como indicio |

## 8. Decisiones de la usuaria (2026-11-07)

Las dudas de diseño visual (textos de luz, ambientes, prefijos) se resuelven con los banners.

| # | Decisión | Elegido |
|---|---|---|
| **D1** | Si falta una pieza | **Avisa** y ofrece crearla; no bloquea. `IMG-12` sigue descartada |
| **D2** | Máximo de referencias | **4 en total**. En la Final el boceto cuenta como una, así que quedan 3 más y hay que elegir cuál se queda fuera |
| **D3** | Por dónde empezar | **Solo la fase 1** y decidir el resto con las imágenes. Es el sí expreso para adelantarla a las pruebas de juego |

Consecuencia de D2: en P3 no se prueba la Final con 5, y T2 rechaza pasar de 4. La ruta B de una escena de 4 piezas deja una
fuera de las referencias; lo normal será el lugar, que ya va en el boceto.
