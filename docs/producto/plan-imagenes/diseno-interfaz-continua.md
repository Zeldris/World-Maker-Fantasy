# Diseño de la interfaz de creación continua (`IMG-25`)

**Qué es** (usuaria, 2026-10-27: «vete haciendo el diseño de la interfaz dándole más datos y ampliando según tengamos
los estándares»): el diseño de producto de la segunda etapa del generador. La primera etapa junta pautas
([`pautas.md`](pautas.md), `IMG-21`/`IMG-22`/`IMG-24`); esta interfaz las **consume** para llevar cada elemento de la
enciclopedia desde «sin imagen» hasta una imagen final aprobada, con su receta, sin que la usuaria tenga que ser
diseñadora: la interfaz propone y mide, ella dice sí o no mirando la candidata junto a su referencia. La tercera
etapa (`IMG-26`) saca el motor a un repo genérico: por eso cada apartado separa lo **genérico** (vale para cualquier
mundo) de lo **de Tarkor**. Este documento no es código ni crea tareas: propone (§7) cómo cortar `IMG-25` en entregas.

Parte de lo que hay: la interfaz de `CFG-43` (`image-generator/abrir.sh` → `interfaz/servidor.py` en 127.0.0.1:7861 +
`interfaz/index.html`), el almacén por elemento `generated/<tipo>/<slug>/` (`intentos/`, `prompts/`, `logs/`,
`registro.tsv`, `notas.md`, `elegidas.tsv`), `scripts/prompt_ficha.py --json`, `gradar.sh`, `medir.sh`,
`banco/montar.sh`, las decisiones D1-D10 de [`plan.md`](plan.md) y el marco de [`plan-fotorreal.md`](plan-fotorreal.md)
(regla de memoria, costes, `IMG-23`). Lo que ya investigó [`investigacion-interfaces.md`](investigacion-interfaces.md)
(InvokeAI, Midjourney, Leonardo, ComfyUI, Fooocus) no se repite: §5 lo amplía con pipelines de estudio y gestores de
assets. Ampliado el 2026-10-27 con lo que dejó la r15 ([`banco/resultados.md`](banco/resultados.md#r15--ocho-planes-corporales-con-prompts-de-un-agente-img-21-2026-10-27)):
plan corporal en la ficha, ancla por silueta (F6b), avisos F7-F9, fondo y lienzo del sujeto (P6, P7), volteo (P8),
«se lee como» antes de la nota por puntos y la regla «referencia frente a canon».

**Dimensión del problema** (datos de la sesión principal, 2026-10-27): ~940 elementos en el catálogo (fauna 53,
flora 51, location 72, zona 72, npc 75, item 230, faction 9, raza 4 + variantes, construccion ~75, crafteo ~60,
ability ~233, historia 7); referencias GPT por tipo: fauna 35, location 45, item 23, raza 18, flora 8, construccion 2,
faction 2, npc 2, y **cero** para ability, crafteo, historia, personaje y zona; solo 5 fichas visuales. Máquina: Deck,
CPU, ~14,8 GB de RAM (~9 libres), una generación a la vez, y con sd-cli en marcha no corren ni Ollama ni los tests.
Tiempos: borrador 640x256/8 pasos ~7 min, sujeto sobre verde ~4 min, final 1280x512/16 pasos ~49 min. **Una noche de
8 h da ~9 finales**: a un perfil por elemento, el catálogo entero son ~100 noches. La interfaz tiene que priorizar
(por tipo con referencia, por lo que el juego enseña primero) y hacer barato el borrador, no acelerar la final.

## 1. Flujo de punta a punta

### 1.1 Estados por elemento

Un elemento tiene **un estado por perfil** (`banner`, `fotorreal`, `icono`, `thumbnail`, `mapa`): el aullador puede
tener el banner aprobado y el icono sin ficha. El estado vive en `generated/<tipo>/<slug>/estado.json` (D7) y la
interfaz lo deriva de ahí, no de la conversación ni del nombre de los archivos.

| Estado | Qué significa | Quién lo pone | Qué queda guardado |
|---|---|---|---|
| `sin-ficha` | En el catálogo, sin `fichas/<tipo>/<slug>.json` | `elementos()` al cruzar catálogo y fichas | Nada |
| `ficha-borrador` | Ficha propuesta desde el lore (§1.3), no comprobada | El asistente de ficha o un agente | `fichas/<tipo>/<slug>.json` con `estado: borrador`, `fuentes[]` |
| `ficha-lista` | `prompt_ficha.py --json` sale 0 y sin avisos, o con avisos aceptados a mano | La interfaz al validar | Ficha + `prompts/<perfil>-<fecha>.txt` |
| `borrador-en-cola` | Borrador pedido, esperando turno | La usuaria («Borrador») | Fila en `cola.jsonl` |
| `borrador-hecho` | Hay candidata barata (640x256 o sujeto+montaje) | `generar.sh` al terminar | `intentos/…png` + `receta.json` + medida |
| `ajustar` | La usuaria pidió un cambio concreto | Comparación → «Ajustar» | Nota con el campo tocado; vuelve a `ficha-lista` |
| `final-en-cola` | Borrador con **sí**; final a 1280x512 esperando la noche | «Sí» en la comparación | Fila en `cola.jsonl` con `tanda: noche` y la receta del borrador |
| `final-hecha` | Final generada, gradada (`gradar.sh`) y medida (`medir.sh`) | `tanda.sh` | PNG gradado + `receta.json` con EMD, YAVG, SATAVG |
| `final-fallida` | La final no pasa el criterio §5 de `pautas.md` (EMD > tope o nota de forma «no») | `tanda.sh` | Igual, marcada; no se enseña como candidata, no se borra |
| `aprobada` | Sí de la usuaria sobre la final junto a su referencia; el tablero filtra por aprobadas | «Aprobar» | `elegidas.tsv`, `estado.json`, `notaForma` |
| `publicada` | Copiada a `backend/uploads/images/<tipo>/<slug>-<perfil>.png`: **sustituye** la imagen de GPT si la hay y, si no, se añade; `ImagePrompt.promptUsado` escrito. El botón pasa a «Despublicar», que devuelve la de GPT (desde `referencias/images/`, §3.2) o deja el elemento sin imagen si no había; el estado vuelve a `aprobada` | «Publicar» / «Despublicar» (usuaria, 2026-10-27) | Receta adjunta al PNG (§3.1) |
| `rehacer` | Aprobada o publicada con `pautasVersion` anterior a una pauta que afecta a su tipo | El cálculo de §4 | Igual que antes; aparece en la cola de rehacer |
| `rechazada` | Descartada con motivo; solo se ve en el filtro «Rechazadas», y solo ahí está el botón «Borrar», que la elimina del disco | «Rechazar» (borrador o final; usuaria, 2026-10-27) | Movida a `generated/<tipo>/<slug>/rechazadas/` (D7), con su receta, hasta que se borra |

### 1.2 Transiciones

```
sin-ficha ──asistente──▶ ficha-borrador ──prompt_ficha ok──▶ ficha-lista ──«Borrador»──▶ borrador-en-cola
                                ▲                                 ▲                              │ generar.sh
                                │ «Ajustar» (campo de la ficha)   │ «Ajustar» (semilla, fuerza)  ▼
                                └─────────────────────────────────┴──────────────────────── borrador-hecho
                                                                                                  │ «Sí»  «Rechazar» ─▶ rechazada
                                                                                                  ▼
 publicada ◀──«Publicar»── aprobada ◀──«Aprobar»── final-hecha ◀── gradar+medir ── final-en-cola ─(noche)─▶ sd-cli
     │                        │                        │                              ▲
     └── pauta nueva (§4) ────┴────────▶ rehacer ───────┘── «Rechazar» ─▶ rechazada   └── final-fallida ─«Reintentar»┘
```

Reglas: (1) **nunca se salta el borrador**: la final cuesta 7 borradores; (2) un «Rechazar» siempre lleva motivo de una
lista corta (forma, color, pose, compañía, luz, otra) para que §4 y las retros lo cuenten; (3) «Ajustar» no genera
nada, solo cambia la ficha o la receta y devuelve a `ficha-lista`; (4) una final que falla la medida **no se enseña
primero**: la interfaz enseña las que pasan y deja las fallidas en una pestaña, para no gastar el sí/no de la usuaria
en lo que ya se sabe que no vale; (5) publicar es reversible con «Despublicar», que restaura la imagen de GPT o ninguna; la copia de
la referencia GPT en `referencias/images/` nunca se pisa (§3.2); (6) borrar solo existe dentro de «Rechazadas».

### 1.3 La ficha visual desde el lore (cuando falta)

Hoy la ficha se escribe a mano a partir del lore. Con ~935 elementos sin ficha hace falta un **asistente** que
proponga una desde el catálogo (`GET /world/<mundo>/enciclopedia`, lo que ya lee `catalogo()`), sin LLM en la Deck
(la memoria es de sd-cli) y marcando siempre `fuentes[]` con el campo y la frase de la que sale cada rasgo. **En lo
visual manda la referencia** (`pautas.md` §5, r15): si el banner de GPT contradice el texto del lore, la ficha sigue
al banner, no lo pide en el prompt y apunta la contradicción en `contradicciones[]` (campo del lore, frase, qué
enseña el banner); la interfaz las lista para la revisión del lore, que decide la usuaria (nunca se toca
`docs/rpgtarkor/` desde aquí). D9 («el canon manda») queda para lo que el banner no enseña. El asistente es
determinista: rellena los bloques que puede y deja el resto como `propuestas[]` para que un agente de la sesión
(Claude, no Ollama) las complete en tanda, o la usuaria elija entre dos o tres opciones cerradas. La usuaria **no
revisa la ficha**: la ficha se valida con la imagen (el sí al borrador confirma la ficha; el «Ajustar» la corrige).

**El plan corporal manda en la ficha** (r15, `pautas.md` §3): la ficha de fauna gana `plan` (cuadrúpedo corredor /
pesado / pequeño, ave corredora, ave en vuelo, pez, serpiente, artrópodo, anfibio; la lista crece con las pautas) y
de él salen, sin que nadie los escriba: la **pose** (la tabla de pose por plan, P1 solo vale para cuadrúpedos), el
**lienzo del sujeto** (512x192 salvo las formas altas, P7: serpiente y cuello alzado a un lienzo alto que el montaje
escala) y el **color de fondo del sujeto** (P6: verde salvo que `colores[]` de la ficha tenga verde; entonces
magenta, o azul si tiene verde y magenta). El `ancla` **se elige por silueta** (F6b): el asistente ofrece dos o tres animales reales que ya tengan la
silueta del banner, no el más parecido en detalle, y la opción «sin ancla, plan descrito» cuando la diferencia es lo
que define a la criatura. El asistente avisa (vía `prompt_ficha.py`) si un rasgo compara una parte con otro animal
(F7, «como una cochinilla»), si un material se compara con un objeto (F8, «like the shell of an armadillo») o si el
prompt lleva una cuenta (F9: 7 placas, 4 ojos); las cuentas no se borran, se mueven a `boceto.cuentas` para la
plantilla (`IMG-24`).

| Tipo | Campos fuente (catálogo) | Bloques de la ficha que rellena | Lo que queda como propuesta |
|---|---|---|---|
| fauna | `Npc.bio`, zona, región, `sexDimorphism`, el banner GPT | `sujeto`, `rasgos[]` (frases de forma y material, sin comparar partes, F7/F8), `colores[]`, `variantes.macho/hembra`, `entorno` (paisaje de la región en `mundo.json`), `momento` por defecto del tipo; del `plan`: `pose`, lienzo y fondo del sujeto | `plan` (propuesto por palabras del lore: «vuela», «se arrastra», «nada»; lo confirma el agente o la usuaria), `ancla` por silueta (F6b, D5; dos o tres opciones o ninguna), `proporcion`, `manada`, `boceto.cuentas` (F9) |
| flora/mineral | `harvestSourceDescriptions`, zona | `sujeto`, `rasgos[]`, `entorno`, `estacion` | `ancla`, `proporcion` (escala humana), `lugar` |
| location | descripción, región, zonePoints | `sujeto`, `entorno` por capas (suelo → medio → horizonte), `luz` por región/momento | `encuadre` (gran angular por capas), `lugar` |
| item | descripción, `dimensiones`, `lugarOrigen`, material | `sujeto`, `proporcion` (de `dimensiones`), `rasgos[]`, `fondo` | `ancla` (objeto real), `pose` (apoyado/colgado/en mano) |
| raza / variante | `rasgoFisico`, cultura, región | `sujeto`, `rasgos[]`, `variantes`, `entorno` | `ancla` humana, `pose`, vestuario (lore) |
| construccion | `construction.ts`, materiales, región | `sujeto`, `rasgos[]`, `entorno`, escala humana | `encuadre`, `momento` |
| npc / personaje | bio, raza, clase, facción | hereda la ficha de la raza + `rasgos+` | pose, atrezo |
| faction | `berigLore.ts`, región, emblema | `sujeto` (emblema / escena), paleta | encuadre |
| ability / crafteo / historia / zona | solo nombre y descripción; **sin referencia GPT** | `sujeto`, `entorno` | todo lo demás; **sin criterio de parecido** hasta que haya referencias o se decida que el perfil es icono |

El estado `ficha-borrador` pasa a `ficha-lista` solo cuando `prompt_ficha.py` devuelve 0 avisos (o la usuaria acepta
los que quedan desde la pantalla §2.2, y la aceptación se guarda). Un `ReglaRota` (salida 2) bloquea la cola.

### 1.4 Del prompt al borrador y al sí/no

1. La interfaz llama a `prompt_ficha.py <ficha> --perfil <perfil> --momento … --estacion … --json` y enseña `prompt`,
   `palabras`, `recortados`, `avisos` (P2-P5 y los nuevos F7, F8, F9, P6, P8, §4) y `propuestas` (§2.2). Guarda el
   prompt exacto en `prompts/`. El prompt no lleva números de partes (F9) ni dirección («flying to the left», P8):
   los primeros van al boceto y la segunda, al montaje.
2. «Borrador» encola con la receta corta de §4 de `pautas.md`: 640x256/8 pasos, `--preview proj`, semilla aleatoria
   salvo que la usuaria la fije; si la ficha tiene `boceto`, el camino de **sujeto sobre fondo de recorte**
   (`sujeto-recorte`: color de fondo y lienzo del plan, P6/P7) + `montar.sh` (plantilla HERO/MANADA, color de
   recorte, volteo si la referencia mira al otro lado, P8) + armonización `-i` 0,5. La interfaz no conoce los
   flags: pide una **receta con nombre** (`borrador`, `sujeto-recorte`, `final`) y el motor la traduce; así una
   receta nueva en `pautas.md` no toca la interfaz.
3. Al terminar, `medir.sh <img> <tipo> <momento>` corre siempre (dura segundos) y la candidata entra en la
   comparación (§2.3) con la rejilla y las referencias del mismo tipo y momento de `gradacion.json`.
4. La usuaria decide en dos tiempos (`pautas.md` §5, r15): primero **«se lee como»** el banner, el ancla u otro
   animal (tres botones; la nota por puntos sola es generosa: el cruzavientos sacó 5/7 y era un águila calva), y
   solo si se lee como el banner sigue la nota por puntos y el **Sí** (a `final-en-cola` con la misma semilla y
   receta). «Se lee como el ancla» abre **Ajustar** con «cambiar ancla» (otra de la lista del plan, o ninguna);
   «otro animal» pide cuál y abre Ajustar sobre el rasgo que lo trajo (F7/F8). Ajustar también permite semilla,
   fuerza del boceto, un rasgo, momento o compañía; **Rechazar** lleva motivo.

### 1.5 La final en tanda de noche, gradada, medida, guardada

**Solo entran en la noche los borradores que la usuaria aprobó** (usuaria, 2026-10-27): ella da el visto bueno al
borrador de día y la tanda arranca sola de noche con esos. Un modo automático (el borrador que pasa la medida de
color y forma va solo a la final) queda para cuando `IMG-23` demuestre que el borrador predice la final (A5).

`tanda.sh` (nuevo, genérico) consume `cola.jsonl` en orden: para cada `final-en-cola`, genera 1280x512/16 pasos con
la semilla del borrador aprobado, grada con la LUT del momento (`gradar.sh`), mide (`medir.sh`), escribe
`receta.json` y el estado, y sigue mientras quede tiempo del tope (hora de fin) y memoria. Antes de arrancar aplica la
regla de memoria (§2.4). Si una final falla la medida, **no reintenta sola**: lo apunta y la usuaria decide por la
mañana (otra semilla, o aceptar que el borrador engañaba). El guardado es por elemento, con la receta completa
dentro del PNG y en `receta.json`, y la publicación al backend es un paso aparte (§3.2).

## 2. Pantallas

Dos columnas como hoy (lista | detalle), más una barra de estado del motor arriba. La lista es el tablero; el detalle
cambia de pestaña según el estado del elemento. Bocetos en ASCII; las zonas se describen, no se dibujan en píxeles.

### 2.1 Tablero (cola)

```
┌ Motor: libre · RAM libre 9,1 GB · Ollama parado · Última: cuernahoja borrador 6:48 ─ [Tanda de noche ▸] ┐
│ Filtros: tipo [fauna▾] estado [todos▾] momento [·] perfil [banner▾] con referencia [x]  buscar [____]  │
├───────────────────────────────────────┬──────────────────────────────────────────────────────────────┤
│ Elemento        Estado        Ref ETA │  (detalle: §2.2 / §2.3 / §2.5 según estado)                   │
│ aullador-rojo   borrador-hecho  5  —  │                                                              │
│ cuernahoja      final-en-cola   5  49'│                                                              │
│ cardo-brujula   ficha-lista     3  7' │                                                              │
│ hulki           ficha-borrador  2  —  │                                                              │
│ ⚠ 3 aprobadas con pautas v2 < v3 → [ver rehacer]                                                     │
│ Resumen: fauna 53 · 5 fichas · 2 aprobadas · 35 con referencia · cola: 2 borradores (14') 1 final    │
└───────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
```

- **Orden por defecto**: lo que pide decisión de la usuaria primero (`borrador-hecho`, `final-hecha`), luego lo
  encolado, luego lo que falta. Ella abre la interfaz y lo primero que ve es lo que puede decidir en dos minutos.
- **ETA** por `estimado()` (mediana de tiempos pasados por receta y tamaño, lo que ya hace `Trabajo`); el total de
  la cola se enseña en la barra y avisa si la tanda de noche no cabe en el tope.
- **Columna Ref**: nº de referencias GPT del mismo tipo y momento; 0 significa «sin criterio de parecido» y la
  interfaz lo dice en vez de medir contra nada.
- Acciones en lote sobre la selección: «Borrador» (varias fichas listas), «A la noche», «Rehacer con pautas v3».
- Genérico. Lo de Tarkor son los tipos (del enum `ImagePromptEntityType`) y los momentos (`gradacion.json`).

### 2.2 Ficha + prompt

```
┌ aullador-rojo · fauna · Pastos de la Deriva · banner ───────────────── estado: ficha-lista ┐
│ FICHA (fuentes: Npc.bio §2, guia-visual §3)   │ PROMPT (pautas v3 · fotorreal · 487/520 palabras)│
│ plan [cuadrúpedo corredor▾] → pose: perfil, cabeza ¾, los dos ojos · lienzo 512x192 · fondo verde │
│ sujeto     [lobo de pastizal, flaco…      ]   │ 1 Encuadre  lateral, media distancia, 85 mm       │
│ ancla      [maned wolf▾ · coyote · ninguna] (por silueta, F6b) │ 2 Sujeto  a maned wolf, only…    │
│ proporcion [patas 1,4× el tronco…         ]   │ 3 Rasgos    …                                     │
│ rasgos  F1 [crin rígida…] F2 [hocico…] [+]    │ …                                                 │
│ colores    [rojo óxido, ocre, negro       ]   │ 8 Style: … Mood: …                                │
│ manada     [tres a media distancia        ]   │ Avisos: ⚠ P3 anáfora «pack» ×2  ⚠ F7 «like a boar»│
│ momento [atardecer▾] estacion [seca▾] variante [macho▾]  │ ⚠ F9 «seven plates» [mover al boceto] ✓ P6 │
│ boceto [plantilla cuadrupedo-corredor.svg] fuerza [0,96] cuentas {placas: 7} │ contradicciones: 1 │
│                                               │ [Aceptar avisos] [Copiar] [Borrador ▸] [A la noche]│
└───────────────────────────────────────────────┴───────────────────────────────────────────────────┘
```

- Cada campo de la ficha enseña su **fuente** al pasar el ratón y la pauta (F1-F9, P1-P8) que lo exige; un campo
  sin fuente se marca para que el agente o la usuaria lo cierre.
- `plan` es el primer campo: al cambiarlo cambian pose, lienzo, fondo de recorte y plantilla de boceto, y la pose
  deja de ser editable (solo en modo avanzado). `colores[]` decide el fondo de recorte (P6) y lo enseña.
- `ancla` es un selector con las anclas por silueta del plan y «ninguna»; con «ninguna» el bloque Sujeto describe
  el plan corporal (F6b, remedio 🔬 hasta que r16 lo mida).
- El prompt se enseña por los 8 bloques de `pautas.md` §1, no como un párrafo: así «Ajustar» apunta a un bloque.
- Los avisos de `prompt_ficha.py` son la lista de comprobación; «Aceptar avisos» guarda quién y cuándo. El aviso
  F9 ofrece «mover al boceto»: quita el número del rasgo («a row of plates») y lo apunta en `boceto.cuentas`.
- «contradicciones: 1» abre la lista referencia frente a canon (§1.3) para la revisión del lore.
- Semilla y pasos no se editan aquí salvo en modo avanzado: la receta la elige el motor por nombre.

### 2.3 Comparación con la referencia

```
┌ aullador-rojo · borrador s=4021 · 6:52 · pautas v3 ──────────────── [◀ anterior] [siguiente ▶] ┐
│ Referencia (GPT, atardecer, 1 de 5 ▾)      │ Candidata                 [deslizar][superponer][lado]│
│ ┌──────────────────────┐                   │ ┌──────────────────────┐                             │
│ │  (banner 1280x512)    │                   │ │  (640x256 ampliada)  │  rejilla [x] 3x3 / tercios │
│ └──────────────────────┘                   │ └──────────────────────┘                             │
│ Medida: EMD Cb 5,1 ✓ (≲6)  Cr 8,9 ⚠ (≲7,5; falla >13,5)  YAVG 96 ✓  SATAVG 41 ✓  SSIM gris 0,74 ✓  │
│ 1. Se lee como:  [ el banner ]   [ el ancla (maned wolf) ]   [ otro animal: ________ ]              │
│ 2. Nota de forma (solo si se lee como el banner; propuesta por la interfaz, corrígela):             │
│   proporción [sí▾]  F1 crin [parcial▾]  F2 hocico [sí▾]  F3 cola [no▾]  pose del plan [sí▾]  compañía [sí▾]  luz [sí▾]│
│ [ Sí → final de noche ]   [ Ajustar ▾: cambiar ancla · semilla · fuerza boceto · rasgo F3 · momento · compañía ]  [ Rechazar ▾ ] │
│ Notas: ____________________________________________ (va a notas.md)                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- La referencia es una de las 5 del mismo tipo y momento de `gradacion.json`; el selector cambia entre ellas y la
  medida enseñada es la **mediana**, como `medir.sh`. Para el elemento que tiene su propio banner GPT (la mayoría
  de la fauna), ese banner va primero: es la referencia de forma; las otras cuatro son de color.
- Tres modos de ver (lado a lado, deslizar, superponer con opacidad), con teclado: es lo que la usuaria usa para
  decidir, y el deslizador es lo que mejor enseña una diferencia de silueta.
- **«Se lee como» va antes y manda** (`pautas.md` §5, r15): tres botones, uno obligatorio. «El banner» habilita la
  nota por puntos y el Sí. «El ancla» desactiva el Sí y preselecciona «cambiar ancla» en Ajustar (la lista por
  silueta del plan y «ninguna»). «Otro animal» pide el nombre, lo guarda y abre Ajustar sobre el rasgo o material
  cuya comparación lo trajo (avisos F7/F8 de ese intento). Las tres respuestas quedan en `notaForma.seLeeComo`.
- La nota de forma la **propone** la interfaz solo donde puede (luz/momento por YAVG y tinte; compañía si el
  prompt la pide; la pose, contra la fila del plan en la tabla de `pautas.md`) y deja el resto en blanco; la
  usuaria la cierra con tres valores. Se guarda en la receta y es lo que `pautas.md` §5 necesita para marcar una
  pauta ✅ («mejora en ≥2 elementos distintos»).
- Si la candidata y el banner miran a lados distintos, la interfaz ofrece «voltear» (P8, en el montaje, sin
  regenerar) antes de pedir el juicio.
- Comparar dos candidatas entre sí (misma pantalla, «vs. intento anterior») sirve para el «Ajustar»: ver si la
  semilla nueva movió lo que se pedía.

### 2.4 Tanda de noche y memoria

```
┌ Tanda de noche · hoy 23:30 → 07:30 (8 h) ────────────────────────────────────────────────────┐
│ Memoria ahora: sd-cli 0 · Ollama 4,6 GB (narrador) · backend node 0,9 GB · navegador 1,1 GB    │
│ Para arrancar hacen falta ≥ 7 000 MB libres (MIN_INICIO_MB). Hay 9 100. ¿Cerrar Ollama? [sí/no]│
│ Orden  Elemento       Receta   Semilla  Momento  ETA     Después                                │
│ 1      cuernahoja     final    8812     dia      49'     gradar · medir                        │
│ 2      aullador-rojo  final    4021     atardecer 49'    gradar · medir                        │
│ 3      cardo-brujula  final    —        dia      49'     (borrador aprobado sin semilla fija ⚠)│
│ …      total 7 finales 5 h 43' ✓ cabe · sobra 2 h 17' → [rellenar con borradores de la cola]  │
│ Al terminar: [x] gradar y medir  [ ] publicar lo que pase  [x] parar si la RAM libre < 1,5 GB  │
│ [Lanzar a las 23:30]  [Lanzar ahora]  [Quitar de la tanda]  [Subir/Bajar]                      │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Aplica la regla de la usuaria: **antes de generar, decir qué ocupa memoria y preguntar qué cerrar**. La interfaz
  lo enseña y no lanza hasta el sí; `LIBERAR_OLLAMA=1` y el vigilante de <1,5 GB siguen siendo del motor.
- Hora de fin dura: si una final no cabe, no se empieza. El hueco sobrante se rellena con borradores (7 min) para
  que la mañana traiga decisiones, no solo finales.
- **Memoria de la tanda**: cada tanda deja `tandas/<fecha>.md` con qué se generó, cuánto tardó, qué pasó la medida
  y qué falló (el formato de `banco/resultados.md`), y la interfaz lo enseña como «revisión de la mañana»: primero
  las finales que pasan, luego las fallidas, luego los borradores nuevos.
- Una tanda se puede reanudar: `cola.jsonl` es el estado; si la Deck se apaga, lo hecho está en disco.

### 2.5 Historial y recetas

```
┌ aullador-rojo · historial (7 intentos, 1 aprobada) ───────────────────────────────────────────┐
│ Fecha        Receta         Semilla Fuerza Pautas EMD Cb/Cr Se lee como  Forma    Decisión   Acciones│
│ 10-27 06:52  borrador       4021    0,96   v3     5,1/8,9   banner       6/7      sí → noche [usar ▾]│
│ 10-26 22:10  sujeto-recorte 1180    0,95   v2     6,3/7,1   ancla        —        ajustar ancla [usar ▾]│
│ 10-25 21:30  borrador       77      —      v1     9,8/12    otro: coyote —        rechazada: forma [usar ▾]│
│ [usar ▾] = reutilizar todo · sin semilla · solo prompt · solo receta   [comparar 2]  [diff prompt]│
│ Pautas aplicadas en la aprobada: F1 F2 F4 P1 P3 · pendientes de v3: F5 → [rehacer borrador]       │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- «Reutilizar» es el *recall* de InvokeAI (todo / sin semilla / solo prompt) con la receta de §3.1.
- «Diff prompt» entre dos intentos enseña qué bloque cambió: es la evidencia que piden las pautas (una frase que
  cambia, un efecto que se mide).
- `registro.tsv` y `notas.md` siguen como hoy; `receta.json` es lo nuevo y la tabla se construye de él.

## 3. Datos

### 3.1 Qué guarda cada elemento: la receta reproducible

Un `receta.json` por intento en `generated/<tipo>/<slug>/intentos/`, con el mismo nombre que el PNG, y el mismo JSON
embebido en el PNG como *text chunk* `receta` (como hace ComfyUI con `workflow`/`prompt`: el archivo se explica solo
si se mueve; se pierde al reencodar, por eso también va aparte). Campos:

| Campo | Ejemplo / dominio | Para qué |
|---|---|---|
| `elemento` | `{tipo, slug, perfil, variante, momento, estacion}` | Enlace al catálogo y al estado |
| `receta` | `borrador` · `sujeto-recorte` · `final` + `{ancho, alto, pasos, cfg, sampler}` | Reproducir; el nombre es la clave, los números la prueba |
| `plan` | `cuadrupedo-corredor` · `ave-vuelo` · `serpiente`… + `{pose: <fila de la tabla>, anclaElegida, sinAncla: bool}` | Saber de qué plan salió la pose y el ancla (F6b, P1) |
| `prompt` | texto exacto enviado + `{bloques: {encuadre, sujeto, …}, palabras, recortados, avisosAceptados}` | Reproducir y hacer el diff por bloque |
| `semilla` | entero | Reproducir y «Sí» → final con la misma |
| `sujeto` | `{lienzo: {ancho, alto}, fondoRecorte: "verde" | "magenta" | "azul", escala}` o `null` | P6 y P7: con qué fondo y lienzo se generó el sujeto |
| `boceto` | `{archivo, plantilla, hash, fuerza, strength_as_noise_level, cuentas: {placas: 7, ojos: 4}}` o `null` | Camino de sujeto sobre fondo de recorte; F9: las cuentas viven aquí |
| `montaje` | `{plantilla: HERO/MANADA, umbral: 12, colorRecorte, volteo: bool, fondo: <intento o zona aprobada>}` o `null` | D10: la zona como fondo; P8: la dirección |
| `armonizacion` | `{modo: "-i", fuerza: 0.5}` o `null` | Lo que se midió como válido (`-r` descartada) |
| `gradacion` | `{lut: "atardecer", hash}` o `null` | La LUT cambia con la calibración; el hash la fija |
| `motor` | `{sdcli, modelo, encoder, vae, flags: {backend, threads, params-backend, max-vram}}` | Qué máquina/binario; en `IMG-26` cambia |
| `pautasVersion` | `"3"` + `pautasAplicadas: ["F1","F2","P1","P3"]` | §4: saber qué rehacer |
| `fichaVersion` | hash de la ficha en ese momento | Un «Ajustar» cambia la ficha; el intento recuerda cuál vio |
| `medida` | `{emdCb, emdCr, yavg, satavg, ssimGris, referencias: [5 rutas], pasa: bool}` | Criterio §5 sin reabrir la imagen |
| `notaForma` | `{seLeeComo: "banner" | "ancla" | "otro", otroAnimal, proporcion: "sí", F1: "parcial", …, pose: "sí", compania: "sí", luz: "sí"}` | Evidencia por pauta; `seLeeComo` es lo que separa lo que vale (r15) |
| `decision` | `{valor: sí/ajustar/no, motivo, campo, fecha, quien}` | Historial y retros |
| `tiempos` | `{segundos, porPaso, vae, fecha, tanda}` | `estimado()` y `tandas/<fecha>.md` |

`estado.json` por elemento: `{perfiles: {banner: {estado, intentoActual, aprobada, publicada, pautasVersion}}, ficha:
{estado, version, fuentesSinCerrar}}`. `cola.jsonl` (genérico, en `image-generator/`): una línea por trabajo
`{id, elemento, receta, semilla, tanda: ahora/noche, prioridad, estado, creado}`; `tanda.sh` y `servidor.py` la leen y
escriben con bloqueo de archivo; es el único estado compartido entre la interfaz y la noche.

### 3.2 Relación con `FichaVisual` (`IMG-7`), `ImagePrompt` y las referencias

- **`FichaVisual`** (D1: tabla en BD que el seed no toca + export JSON versionado) es la ficha de §1.3 cuando llegue
  `IMG-7`. Hasta entonces la ficha es `fichas/<tipo>/<slug>.json` y la interfaz la lee del disco; el diseño exige
  que `servidor.py` acceda a la ficha por una función (`ficha(tipo, slug)`) para que cambiar el almacén no toque
  las pantallas. Campos que `FichaVisual` tiene que tener para este flujo: los bloques del prompt, `plan`,
  `anclas[]` (las candidatas por silueta y la elegida), `colores[]`, `variantes`, `condiciones`, `boceto` (con
  `plantilla` y `cuentas`), `fuentes[]`, `contradicciones[]` (referencia frente a canon, §1.3), `estado`,
  `version` (hash), `propuestas[]` (D3: `Propuesta` como modelo aparte si la usuaria quiere aprobarlas una a una).
- **`ImagePrompt`** (worldId, entityType, entitySlug, sizeProfile, prompt, promptUsado/At de `CFG-38`): publicar
  escribe `promptUsado` = prompt exacto de la receta y `promptUsadoAt`. La escritura va por la API del backend solo
  desde 127.0.0.1 con el token de `.env` (D4). El `sizeProfile` actual (thumbnail|banner|mapa) no cubre `fotorreal`
  ni `icono`: o el perfil `fotorreal` publica como `banner`, o el enum crece (pregunta abierta, §6).
- **Las referencias GPT** viven hoy en `backend/uploads/images/<tipo>/<slug>-banner.png`, **la misma ruta a la que
  publica el generador**, y `scripts/medir.sh` las lee de ahí (`IMAGENES=${IMAGENES:-$RAIZ/backend/uploads/images}`,
  línea 11); `servidor.py` espera además `image-generator/referencias/images/` (`IMG_REFERENCIAS`), que en el
  worktree no existe. Antes de la primera publicación hay que copiar las referencias a `referencias/images/`
  (en git, con un `referencias.tsv` que diga de qué GPT y fecha son) y que `medir.sh` y `gradacion.json` apunten
  ahí por defecto: si no, publicar un banner destruye su propia referencia y la medida compara contra la generada.
  Es la primera comprobación de la entrega E5 (§7).

### 3.3 Genérico y mundo (para `IMG-26`)

| Capa | Genérico (repo del generador) | De Tarkor (este repo) |
|---|---|---|
| Interfaz | `servidor.py` (API), `index.html`, tablero, comparación, tanda, historial; estados y transiciones de §1 | Nada: los tipos, momentos y perfiles llegan por configuración |
| Catálogo | Un **adaptador** con tres funciones: `elementos()`, `ficha(tipo, slug)`, `publicar(tipo, slug, perfil, png, prompt)` | El adaptador de WMF: `GET /world/<mundo>/enciclopedia`, `fichas/`, `backend/uploads/images/`, `ImagePrompt` |
| Pautas | `pautas.md` con versión; `prompt_ficha.py` y sus avisos; recetas con nombre; `montar.sh`, `gradar.sh`, `medir.sh`, `tanda.sh`; esquema de `receta.json`, `estado.json`, `cola.jsonl` | `mundo.json` (perfiles, regiones, luz, vetadas), `plantilla-prompt.md` en lo que es de Tarkor, `guia-visual-mundo.md` |
| Referencias y medida | El criterio (EMD Cb/Cr, YAVG/SATAVG por momento, nota de forma, SSIM) y la mediana contra N referencias | `gradacion.json` (qué referencias, qué tintes, qué LUT), las LUT calibradas, las referencias GPT |
| Planes y bocetos | La lista de planes corporales con su pose, lienzo y fondo de recorte (`pautas.md` §3), las anclas por silueta de cada plan, las plantillas SVG por plan (`IMG-24`) y el montaje con color de recorte y volteo | El `plan`, el ancla elegida, los `colores[]` y las `cuentas` de cada ficha |
| Motor | sd-cli, modelo, flags de memoria, regla de memoria y vigilante | Perfiles de la Deck (`MIN_INICIO_MB`, Ollama) |

Lo que **no** se decide ahora: si el admin React (D6, `IMG-13`) sustituye a `index.html` o lo embebe. El diseño
vale para los dos porque todo lo que la pantalla necesita sale de `/api/*` de `servidor.py`.

## 4. Cómo entra una pauta nueva

1. **Versión en `pautas.md`**: una línea `**Versión:** 3 (2026-10-27)` bajo el título, que sube cuando una pauta
   cambia de 🔬 a ✅, se añade o se retira. Cada pauta lleva su id (F1-F9, P1-P8, R1… para recetas, C1… para
   criterio) y `aplica a: fauna | flora | location | todos`, y una fila de la tabla de pose por plan cuenta como
   pauta con `aplica a: plan=<plan>`. Un script pequeño (`pautas.py --json`) saca la lista
   `{version, pautas: [{id, estado, aplicaA, desde}], planes: [{plan, pose, lienzo, estado}]}` para la interfaz;
   no se lee el Markdown desde `servidor.py`. La r15 es el ejemplo: F6b-F9 y P6-P8 nuevas, P1 reescrita (solo
   cuadrúpedos), la tabla de planes y «se lee como» en el criterio → versión 2, y todo lo aprobado con la 1 pasa a
   `rehacer` solo si su plan o su tipo lo toca (fauna, todas: P6 y F9 aplican a todas).
2. **Receta**: cada intento guarda `pautasVersion` y `pautasAplicadas` (§3.1). La interfaz calcula `rehacer` =
   aprobadas o publicadas cuyo tipo está en `aplicaA` de una pauta ✅ posterior a su versión. No se rehace por una
   pauta que no toca su tipo, ni por una 🔬.
3. **Avisos de `prompt_ficha.py`**: una pauta de prompt (P2-P5, las F que se pueden comprobar en el texto) entra
   como aviso con el mismo id y un test que falla sin la pauta (`rojo-sin-arreglo.sh`). La interfaz enseña los
   avisos con el id y el enlace a la pauta; «Aceptar avisos» queda registrado con la versión. Los que trae la r15,
   todos comprobables en el texto: **F7** un rasgo con «like a/an <animal>» o «<animal>-like» fuera del bloque
   Sujeto; **F8** un material con «like the shell/armor/… of» o un nombre de objeto; **F9** un numeral (cifra o
   palabra: «seven», «four») en rasgos; **P6** `fondoRecorte` igual a un color de `colores[]`; **P8** una dirección
   («to the left», «facing right») en el prompt. F6b no es aviso: es el selector de anclas por silueta (§2.2).
4. **Rehacer**: el tablero lista las `rehacer` y ofrece «Rehacer borrador» en lote (7 min cada uno, misma semilla
   para ver solo el efecto de la pauta). La final solo se rehace si el borrador nuevo gana en la comparación «vs.
   aprobada» (§2.3): la pauta tiene que **mejorar** la imagen aprobada, no solo cumplirse. Lo aprobado nunca se
   despublica por una pauta: sigue en el juego hasta que la nueva final se aprueba.
5. **Evidencia de vuelta**: las `notaForma` y `medida` de los intentos con `pautasAplicadas ⊇ {X}` frente a los
   anteriores son lo que `pautas.md` §5 pide para pasar X a ✅ («mejora en ≥2 elementos distintos»); el historial
   (§2.5) y `tandas/<fecha>.md` lo dan sin volver a mirar imágenes.

## 5. Referencias

Amplían [`investigacion-interfaces.md`](investigacion-interfaces.md) (que ya cubre InvokeAI, Midjourney, Leonardo,
ComfyUI y Fooocus como herramientas de generación). Lo que se tomó de cada una:

| Fuente | Qué aporta a este diseño |
|---|---|
| [Kitsu (CGWire): revisar entregas](https://mintlify.com/cgwire/kitsu/guides/supervisor/reviewing-work), [subir trabajo](https://www.mintlify.com/cgwire/kitsu/guides/artist/uploading-work), [tareas](https://www.mintlify.com/cgwire/kitsu/features/tasks), [playlists](https://blog.cg-wire.com/cube-creative-studio-sponsors-enhanced-playlists-for-kitsu) | Estados de tarea por color con una cola del supervisor («waiting for approval»); revisiones numeradas con fecha, autor y comentarios; anotaciones dibujadas sobre la vista previa; la revisión de assets se hace **de uno en uno**. De ahí §1.1, el orden del tablero (lo que pide decisión, primero) y las notas por intento. |
| [Flow Production Tracking (ShotGrid): estados](https://help.autodesk.com/cloudhelp/ENU/SG-Tutorials/files/SG_Tutorials_tu_tracking_statuses_html.html), [funciones](https://www.autodesk.com/au/products/shotgrid/features) | Versiones con notas abiertas/cerradas e historial de estado; una versión «Final Approved» cambia sola el estado del padre. De ahí que `aprobada` del perfil se propague al elemento y que el motivo de «Rechazar» sea obligatorio. |
| [ComfyUI: metadatos del workflow en el PNG](https://docs.comfy.org/development/api-development/workflow-metadata), [extracción con exiftool](https://exiftool.org/forum/index.php?msg=88564), [sd-parsers](https://github.com/d3x-at/sd-parsers), [historial de trabajos](https://docs.comfy.org/interface/job-history) | La receta embebida en el PNG como *text chunk* (y por qué también va aparte: se pierde al reencodar). El historial de trabajos con pestañas todos/completados/fallidos, cancelar uno, vaciar cola, y «abrir como workflow» = nuestro «Reutilizar». |
| [InvokeAI: cola](https://support.invoke.ai/support/solutions/articles/151000158823-queue) | Encolar al final o **al frente**, «cancelar todo salvo el actual», lotes cancelables como unidad; el *recall* (todo / prompt / semilla). De ahí la prioridad en `cola.jsonl` y §2.5. |
| [Perforce Helix DAM 2024.3](https://www.perforce.com/sites/default/files/pdfs/whats-new-helix-dam-2024-3.pdf), [7 pasos](https://www.perforce.com/products/helix-dam/setting-up/7-steps) | Revisiones asignadas, flujos de aprobación configurables, anotaciones a mano sobre la imagen y comparación de versiones. Confirma «comparar dos intentos» y que la decisión se guarde con la versión. |
| [iXie: GenAI en pipelines de juego](https://www.ixiegaming.com/?p=35282), [Virtuall: guía práctica](https://virtuall.pro/blog/ai-for-game-development-a-practical-guide-for-creative-teams), [Room 8: informe IA en 2D](https://room8group.com/wp-content/uploads/2025/01/AI-in-2d-gam-dev_-Report_final.pdf) | Las aprobaciones viven dentro del flujo, no en un chat; se registra quién, qué modelo, qué prompt, cuándo y quién aprobó; las salidas van a control de versiones. De ahí `decision`, `motor` y `pautasVersion` en la receta y que `generated/` esté en git. |
| [X4 Foundations: naves](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Manual%20and%20Guides/Objects%20in%20the%20Game%20Universe/Ships/), [facciones](https://wiki.egosoft.com/X4%20Foundations%20Wiki/Manual%20and%20Guides/Objects%20in%20the%20Game%20Universe/Factions/), [estaciones](https://www.magicgameworld.com/?p=27181), [foro: enciclopedia y blueprints](https://steamcommunity.com/app/392160/discussions/0/7051042840464392653), [foro: dónde se encuentra un objeto](https://steamcommunity.com/app/392160/discussions/0/3083250789428066557) | **X4 marca el camino**: la enciclopedia clasifica por categoría y rol (naves por tamaño y rol; módulos por producción/construcción/almacén/habitación/defensa/muelle), cada entrada enseña relaciones (recursos necesarios, dónde se encuentra, aliados y enemigos) y las entradas son estáticas: una imagen por entrada, sin variantes de momento. Para la interfaz: el tablero agrupa por tipo y la imagen del juego es **una** por perfil, las variantes de momento son del generador (`variantesTiempo`), no de la ficha del juego. |
| [BG3: diario y controles](https://eip.gg/bg3/db/basic-controls/), [Manor Lords: números con Tab](https://gamesradar.com/manor-lords-tips) | BG3 separa misiones, inspiración, historial de diálogo y tutoriales en pestañas del mismo diario, con el detalle ampliable a demanda; Manor Lords enseña los números solo al pedirlos. De ahí las pestañas por estado en el detalle y la medida (EMD, YAVG) visible pero secundaria frente a la rejilla. |
| [image-comparison (web component)](https://github.com/TonySpegel/image-comparison), [VES image compare](https://f-droid.org/en/packages/com.vincentengelsoftware.vesandroidimagecompare/) | Deslizar, superponer y lado a lado con teclado, sin dependencias; zoom sincronizado y diferencia por píxel. Es la pieza de §2.3. |

Lo que no se encontró: una descripción de la **pantalla** de la enciclopedia de X4 (lista a la izquierda, detalle a
la derecha, solo por capturas) y nada específico de enciclopedia en Manor Lords o Bellwright; Medieval Dynasty y D&D
5e no aportan a una interfaz de producción de imágenes. Queda en «sin cubrir»: Krea y los visores de comparación de
InvokeAI, ya apuntados en `investigacion-interfaces.md`.

## 6. Preguntas abiertas y «Se amplía con las pautas»

### 6.1 Preguntas abiertas

| # | Pregunta | Quién la cierra | Qué hace falta |
|---|---|---|---|
| ~~A1~~ | ✅ Cerrada (usuaria, 2026-10-27): botones «Aprobar» (filtro de aprobadas), «Publicar»/«Despublicar» (publicar sustituye a la de GPT o la añade; despublicar devuelve la de GPT o nada) y «Rechazar» (filtro de rechazadas, donde está «Borrar»). Queda de la sesión principal qué `sizeProfile` usa: el que tenga la imagen de GPT que sustituye (`banner` para los banners). | — | — |
| A2 | ¿Qué prioridad de tipos para las ~100 noches: lo que el juego enseña primero (location, fauna, item) o lo que tiene referencia? ¿Y los tipos sin referencia (ability, crafteo, historia, zona): icono, nada, o referencia nueva de GPT? | Usuaria | Conteo del tablero (E1) |
| A3 | ¿Cuánta ficha hace el asistente solo y cuánta un agente? Tras la r15 la pose, el lienzo y el fondo salen del `plan`; quedan con juicio el `plan` mismo (¿tabla de palabras del lore → plan, o agente?), el ancla por silueta (F6b: ¿lista fija de anclas por plan en `pautas.md`, o la propone el agente mirando el banner?) y `proporcion`. | Sesión principal | r16 con los remedios 🔬 de F6b (otra ancla / ninguna); una lista de anclas por plan en `pautas.md` §3 |
| A9 | ¿«Se lee como el ancla» bloquea el Sí siempre? En r15 el jusha (black bass tal cual) no vale, pero un ancla que ya es la silueta del banner (correcaminos) se lee como las dos cosas. Propuesta: el Sí solo con «el banner»; si la usuaria quiere aprobar con «el ancla», lo marca y queda contado. | Usuaria | Probar §2.3 con los 8 de r15 (E2) |
| A10 | ¿De dónde salen `colores[]` para P6: del lore (texto), del banner (color dominante medido) o los dos? Medido del banner es gratis y objetivo; el lore manda si el banner no existe. | Sesión principal | `medir.sh` con un modo «dominantes» o un script aparte |
| A11 | Lienzo alto de P7: ¿qué tamaños (512x320, 384x384) y cómo escala el montaje sin romper el SSIM ≳ 0,7? Decide la receta `sujeto-recorte` por plan. | Pautas (`IMG-21`) | r16 con la morvasa a lienzo alto |
| A4 | ¿Cuántas referencias mínimas para medir (hoy 5 de fauna por momento)? Con 2 de construccion o faction la mediana no vale. | Pautas (`IMG-22`) | Criterio por tipo de `pautas.md` §5 |
| A5 | ¿El sí/no del borrador predice el de la final? Si no (el borrador a 640x256 engaña), hace falta un paso intermedio (960x384) o aceptar más finales fallidas. | Medir | 10 pares borrador/final con la misma semilla (`IMG-23`) |
| A6 | ¿Quién escribe la nota de forma: la usuaria, un agente con visión (no en la Deck) o solo la medida? Decide cuánto cuesta cada sí/no. | Usuaria | Probar §2.3 con 5 elementos (E2) |
| A7 | ¿Dónde vive `cola.jsonl` cuando llegue `IMG-11` (cola, ETA, lotes en BD) y el admin React (`IMG-13`)? Propuesta: disco mientras la Deck sea la única máquina; BD cuando haya dos. | Sesión principal | Nada ahora; se decide en E6 |
| ~~A8~~ | ✅ Cerrada (usuaria, 2026-10-27): ¿finales solas o con visto bueno? Visto bueno al borrador; la noche genera solo las finales de los borradores aprobados. Modo automático, tras A5. | — | — |

### 6.2 Se amplía con las pautas

| Llega | Qué cambia en la interfaz |
|---|---|
| `IMG-21` planes corporales (r15, **ya en este diseño**) | Hecho en el diseño: `plan` en la ficha con pose, lienzo y fondo de recorte derivados; ancla por silueta (F6b); avisos F7-F9, P6, P8; «se lee como» antes de la nota por puntos; `contradicciones[]`. Lo que falta de `IMG-21` y cambiará detalles: los remedios 🔬 (otra ancla o ninguna → si «ninguna» funciona, el selector de ancla deja de ser obligatorio; material que crece de la piel → plantilla de frase en el asistente; magenta en `montar.sh` → el parámetro `colorRecorte`; lienzo alto → los tamaños de A11), los planes que falten (reptil, acuático grande, insecto volador) y las anclas por plan |
| `IMG-22` pautas por tipo | Encuadres y criterio por tipo (umbrales EMD distintos para location que para item; YAVG por momento y región); el tablero filtra por «criterio disponible»; la columna Ref pasa a «criterio: sí/no» |
| `IMG-23` receta final medida | Los números de `final` (pasos, tamaño, armonización) dejan de estar en el diseño y pasan al motor; `estimado()` por receta; A5 se cierra con sus pares |
| `IMG-24` ficha visual con números y plantillas por plan | `proporcion` pasa de frases a números con unidad y `boceto.cuentas` (F9: placas, ojos, puntas) deja de ser una nota y pasa a dibujar la plantilla del plan (no un SVG por criatura); «Ajustar» cambia un número y regenera el boceto; el aviso F9 «mover al boceto» pasa de apuntar a dibujar |
| `IMG-7` `FichaVisual` en BD | El adaptador lee la ficha del backend; `fuentes[]` enlazan a campos del catálogo; `Propuesta` (D3) sustituye a `propuestas[]` del JSON |
| `IMG-10`/`IMG-12` estados y zona como fondo | `estado.json` pasa a BD; `montaje.fondo` apunta a la zona aprobada (D10) y la interfaz ofrece «fondo: zona de la ficha» cuando esa zona está `aprobada` |

## 7. Propuesta de corte en entregas pequeñas

Todas sobre `servidor.py` + `index.html` (sin React hasta E6), cada una con su check y jugable en una sesión; ninguna
crea tareas de roadmap aquí, es la propuesta para que la sesión principal reparta `IMG-25`.

| Entrega | Qué entra | Lo primero de `IMG-25` | Tamaño |
|---|---|---|---|
| **E1 Estados y receta** | `estado.json`, `receta.json` (+ chunk PNG) con `plan`, `sujeto` y `notaForma.seLeeComo`, `cola.jsonl` con prioridad, tablero con filtros, orden «decisión primero» y ETA; `pautas.py --json` (pautas y planes) y `pautasVersion` en la receta; recetas con nombre en `generar.sh`, con `sujeto-recorte` tomando color y lienzo del plan | **Sí**: sin esto nada lo demás se puede medir ni rehacer. Depende de que `montar.sh` acepte color de recorte y volteo (remedio de P6/P8 en `IMG-21`, no de esta tarea) | M |
| **E2 Comparación** | Pantalla §2.3: referencias de `gradacion.json` (el banner propio primero), tres modos de ver, rejilla, medida, **«se lee como»** y luego la nota por puntos, Sí/Ajustar (con «cambiar ancla» y «voltear»)/Rechazar con motivo; «vs. intento anterior» | **Sí**: es donde la usuaria decide; cierra A6 y A9 | M |
| **E2b Ficha con plan** | En §2.2: campo `plan` con pose, lienzo y fondo derivados; selector de ancla por silueta y «ninguna»; `colores[]`; avisos F7/F8/F9/P6/P8 en `prompt_ficha.py` con sus tests; «mover al boceto» (`boceto.cuentas`); `contradicciones[]` con su lista para la revisión del lore | Tras E1, antes de E3: sin el plan, las fichas nuevas repiten los fallos de r15 | S |
| **E3 Tanda de noche** | `tanda.sh` sobre `cola.jsonl`, regla de memoria con pregunta, tope de hora, gradar+medir al terminar, `tandas/<fecha>.md`, revisión de la mañana, reanudar | Sí, tras E1-E2: es lo que convierte 49 min en noches útiles | M |
| **E4 Ficha desde el lore** | Asistente determinista por tipo (§1.3) con `fuentes[]`, estado `ficha-borrador`, campos sin fuente marcados; propone `plan` por palabras del lore y `colores[]` del banner (A10); tanda de agente para confirmar `plan`, elegir ancla por silueta y `proporcion` | Después de los remedios 🔬 de `IMG-21` (lista de anclas por plan) | L |
| **E5 Publicar** | Copia de referencias a `referencias/images/` (de ahí sale también lo que restaura «Despublicar»), `medir.sh` y `gradacion.json` apuntando ahí, `publicar()`/`despublicar()` al backend con token (D4), `promptUsado` (CFG-38) | Cuando haya una final aprobada que publicar (A1 cerrada) | S |
| **E6 Admin React** | Las mismas pantallas sobre `/api/*` en `/admin/enciclopedia` (D6, `IMG-13`); `cola` y `estado` a BD si `IMG-11` | Último; nada del diseño depende de él | L |

Lo que se recomienda **no** hacer en `IMG-25`: un editor de prompt libre (rompe la trazabilidad de la receta), un
LLM en la Deck para la ficha (la memoria es del motor), y reintentos automáticos de finales fallidas (49 min cada
uno sin decisión de la usuaria).
