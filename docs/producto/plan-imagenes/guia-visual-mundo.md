# Guía visual del mundo — Helek Sirik / Tarkor (`IMG-4`)

**Estado:** sacada de [`borradores/guia-visual-mundo.md`](borradores/guia-visual-mundo.md) el 2026-10-25, con las
decisiones de la usuaria de ese día ([plan](plan.md#decidido-usuaria-2026-10-25)) aplicadas. `WMF/` = la raíz del repo.
Cada hecho lleva su fuente entre paréntesis. **«[propuesta]» = inferido o inventado, no está en el repo: espera la
aprobación de la usuaria.** Lo que entra en los prompts está en `image-generator/estilo/mundo.json` y se monta con la
[plantilla](plantilla-prompt.md). Lo decidido que cambia el canon pasa a `docs/rpgtarkor/` por `ampliar-lore.md`, con
Álvaro.

## 1. Principios

1. **Fantasía con base científica**: todo fenómeno tiene una causa física visible (bioacumulación, magnetismo, vibración, adaptación); nunca «es magia» sin mecanismo (`WMF/docs/canon-opencode/00-nucleo.md`, «Mundo»). Visualmente: lo extraño se muestra con su causa (la arena imantada se peina en crestas, la piel Nabieus atrapa la luz).
2. **Mundo a medio vaciar**: unas 8.000-10.000 almas en todo Berig (`00-nucleo.md`). Los paisajes son amplios y poco construidos; la huella humanoide es pequeña (campamentos, pasarelas, tótems). [propuesta: ningún plano de multitudes ni ciudades abarrotadas]
3. **Todo es artesanal y natural**: madera de Telda, piel, hueso, asta, piedra, hierro negro. Sin pólvora ni arcabuz (`00-nucleo.md`, «Tono prohibido»).
4. **Se juega en Berig**. Nada de Vaelira: ni Kelife, ni Hebra Dorada, ni musgo bioluminiscente, ni la Costa del Azabache (`00-nucleo.md`).
5. **Colores naturales y apagados, con un acento por escena** (el estilo vigente ya pide «natural muted colours, subtle filmic grade», `WMF/backend/src/services/imagePromptGenerator.ts` const `FOTO`). [propuesta: un único acento saturado por imagen, tomado de la paleta de su región]

## 2. Cielo y luz (sin luna)

- Helek Sirik no tiene luna: tiene un **cinturón de polvo de cristal** en la atmósfera alta, de baja cohesión, que solo se nota de noche como un **brillo perlado y difuso repartido por todo el cielo**, nunca un disco nítido; hay también estrellas normales (`WMF/docs/rpgtarkor/lore-mundo/genesis.md` § «El cielo sin luna», l.146-155; `WMF/backend/src/services/imagePromptContext.ts` `MOMENTO_TEXT.noche`).
- De día el cinturón es invisible (se pierde en el resplandor del cielo) (`genesis.md` l.153). Por tanto: **cielos diurnos normales; cielos nocturnos con estrellas y velo perlado, sin luna**.
- Noche: «sombras profundas, colores apagados y fríos, sin luz solar», con fuego como luz alternativa (`imagePromptContext.ts` `MOMENTO_TEXT.noche`).
- Estaciones: 4 de 30 días; verano de luz dura y alta, otoño de luz cálida y oblicua, invierno de luz fría y apagada con posible escarcha según región (`imagePromptContext.ts` `ESTACION_TEXT`; `WMF/docs/rpgtarkor/lore-mundo/estaciones.md`).
- Polvo rojo y bruma: las Llanuras tienen «tormentas de arena magnética» y polvo rojo en el aire (`regiones/llanuras-del-viento-rojo.md` l.~20; `REGION_ESCENA`). **El Margen no tiene niebla** y el aire es nítido y quieto (`regiones/margen-silencioso.md` «No hay niebla»; `REGION_ESCENA['Margen Silencioso']`). La niebla es del Estrecho, fuera de juego.
- Luz propia por región: ver §3 (campo `luz`). Sustituye al «atardecer dramático para toda la fauna» actual (`ENTITY_TYPE_STYLE.fauna.luz`, que salió de una prueba con el múrgol, comentado en el propio código). **Decidido (D8):** la luz sale de la ficha (`prompt.luz`) y, si no la trae, de la región; ya no se fuerza el ocaso a toda la fauna.

## 3. Paleta por región

Los nombres de color son míos salvo que se indique; cada uno parte de una palabra del repo.

### Las Llanuras del Viento Rojo
Escena: estepa infinita de arcilla roja, hierba seca, sabana, volcanes lejanos (`REGION_ESCENA`; `regiones/llanuras-del-viento-rojo.md` «Descripción»).
| Color | Rol | Fuente |
|---|---|---|
| Rojo arcilla | suelo | «red clay steppe» (`REGION_ESCENA`); «tierra rojiza y arcillosa» (`llanuras...md` Descripción) |
| Amarillo pajizo anaranjado | pasto base (Pasto Solar) | «Hierba amarilla» (`llanuras...md` Pasto Solar) y «dry orange grass» (`REGION_ESCENA`): **decidido** (usuaria, 2026-10-25), ver §10 |
| Rojo sangre (solo Sabana Alta) | hierba alta | «hierba roja que llega a la cintura» (`llanuras...md` La Sabana Alta, Pasto de Sangre) |
| Rojo polvo en bruma | aire/cielo bajo | «fine red dust... haze of red dust» (`REGION_ESCENA`) |
| Negro basalto imantado | roca / acento | «rocas negras imantadas» (Las Agujas Imán, `llanuras...md`); «Rovalnica: negra con vetas rojas» |
| Oro de contraluz | luz | «warm golden rim light» (`REGION_ESCENA.luz`) |
Luz propia: sol bajo en el horizonte tras polvo rojo, nubes de ocaso (`REGION_ESCENA.luz`).

### Ciénaga Troncal
Escena: ciénaga densa de troncos y lianas, agua oscura, claros llanos de barro (`REGION_ESCENA`). Árbol dominante: Trepador Ocaso «de tono oscuro» (`cienaga-troncal.md` Descripción).
Paleta: marrón-negro de madera de Trepador Ocaso (troncos, empalizadas y pilotes: «madera oscura», `cienaga-troncal.md` El Cerco de los Pilotes); verde musgo intenso (piel Goshg «verde musgo veteado de rojo pálido», `berigLore.ts` Orcos; [propuesta: reutilizarlo para el follaje]); agua negra-verdosa («dark standing water», `REGION_ESCENA`); barro pardo («flat muddy clearings»); verde filtrado de dosel («filtered green», `REGION_ESCENA.luz`); acento: bruma cálida sobre el agua («warm haze»). Luz: húmeda y suave.

### Cristal Helado
Escena: montañas altas con casquete de hielo, tundra de roca volcánica oscura con nieve, glaciares y acantilados marinos (`REGION_ESCENA`).
Paleta: negro basalto (roca oscura volcánica, `REGION_ESCENA`); blanco nieve; azul sombra frío («cold blue shadows»); azul pálido de hielo; cristal translúcido de hielo sílice [propuesta: el repo lo llama «cristal resistente» pero no da color, `cristal-helado.md` Hielo Sílice]; piel pálida azulada de los orcos Helsig como acento humano (`berigLore.ts`). Luz: sol ártico bajo y pálido, aire nítido con brillos de hielo.

### Margen Silencioso
Escena: selva templada de coníferas de madera negra y follaje oscuro denso sobre suelo pantanoso; aire claro y quieto (`REGION_ESCENA`; `margen-silencioso.md`).
Paleta: negro de madera de conífera; verde bosque muy oscuro; verde apagado de luz bajo dosel («dim green light»); corte de sol («sharp shafts of sun»); verde corteza-y-musgo (pelaje Faerus, `berigLore.ts` faerus-margen); acento: haces de sol nítidos. Sin niebla. Luz: tenue y verde.

### Meseta del Orden
Escena: desierto de losas de piedra gris y terrazas escalonadas con simetría antinatural, hierba gris hierro escasa, murallas de piedra pulida y hierro negro (`REGION_ESCENA`; `meseta-del-orden.md`).
Paleta: gris piedra; gris hierro (Hierba del Hierro: «hojas grisáceas extremadamente duras», `meseta-del-orden.md` Hierba del Hierro); negro hierro pulido (muros del Baluarte de Goirme); cielo pálido claro; acento: brillo metálico tenue de la piel Goirnte (`berigLore.ts`). Luz: sol alto y duro, sombras nítidas.

(Vaelira queda **fuera de la guía**: prohibida en Berig, `00-nucleo.md`.)

## 4. Materiales y minerales emblemáticos

| Material | Aspecto | Fuente |
|---|---|---|
| Arcilla roja | suelo de las Llanuras | `REGION_ESCENA` |
| Arena Imán | limaduras de tormenta; en Las Agujas Imán se acumula a sotavento y las crestas las peina el viento | `llanuras...md` Arena Imán y Las Agujas Imán |
| Rocas Imanidas | concentración de Arena Imán que flota en el aire | `llanuras...md` l.~553 |
| Madera de Telda | troncos de empalizadas y vigas con resina; hoja gris | `llanuras...md` Telda Común y campamento Serhu |
| Hierba del Hierro | hojas grisáceas muy duras con mineral en su estructura | `meseta-del-orden.md` |
| Hierro negro pulido, piedra pulida | muros y obeliscos Goirntes | `meseta-del-orden.md` El Baluarte de Goirme |
| Hielo sílice | cristal duro, se talla, no se forja | `cristal-helado.md` |
| Vidrio volcánico negro, Rovalnica negra con vetas rojas | Fumarolas Negras, Filo de las Brasas | `llanuras...md` |
| Madera oscura de Trepador Ocaso | pilotes y pasarelas Goshg | `cienaga-troncal.md` |
| Obsidiana | muro del norte (RESERVADO: no mostrar) | `00-nucleo.md` «Reservado» |

## 5. Lenguaje de formas y cuerpo por raza

Siempre con el `rasgoFisico` de `WMF/backend/src/services/berigLore.ts` (`BERIG_RAZAS`). **No hay humanos** (`00-nucleo.md`).
- **Goirntes**: piel casi mineral y quitinosa, gris, tensa sobre huesos angulosos, con tenue brillo metálico al esforzarse; ojos negro obsidiana; mentón ancho en machos (`berigLore.ts` l.75). Formas: líneas rectas, simetría, ángulos (Meseta). Frontera norte: piel más clara, más ágiles (`berigLore.ts` l.116).
- **Orcos**: corpulentos, rasgos tribales (`berigLore.ts` l.127). Cuerpo adaptado al clima: Llanuras = piel beige/arcilla, músculo largo; Cristal Helado = piel pálida azulada, recios y compactos; Ciénaga = piel verde musgo veteada de rojo pálido, pies y manos anchos. Formas: troncos, pieles, estacas, tótems (insignias talladas) (`razas.md` l.95).
- **Nabieus**: cuerpos delgados, piel gris apagada «que no refleja ni absorbe la luz» (`berigLore.ts` l.224); en el canon la piel «atrapa» la luz y se lee como ausencia, sin tonalidad (`genesis.md` l.181). **Decidido:** gris casi neutro, sin brillo, que apenas se distingue de la sombra. Variante Ciénaga: manchas verde oscuro, extremidades largas, postura algo encorvada.
- **Faerus**: «piel de hojas finas, cuerpo fibroso y resistente, postura de 2 a 4 patas» (`berigLore.ts` l.243). Margen: pelaje denso y tupido en tonos de corteza y musgo; Frontera Norte: pelaje corto, rojizo y verdoso, con más rojo. **Sin túnica ni sandalias** (`00-nucleo.md`). Formas: orgánicas, de manada.
- Escala: sin cifras de altura en el repo para las razas [propuesta: ver §11].
- **Telda** (decidido): crece hasta 4-6 m; los de 1-2 m son ejemplares jóvenes, y de los viejos salen los troncos de 4-5 m de las empalizadas.

## 6. Arquitectura por cultura

- **Orcos de las Llanuras (Serhu)**: campamento circular con empalizada de 4-5 m de troncos de Telda atados con fibra, un único puente-puerta (`llanuras...md` l.232). Maktor: gran tótem de madera de ciénaga en la plaza (`clanes-orcos.md` l.379).
- **Orcos Goshg (Ciénaga)**: empalizadas de madera oscura sobre pilotes, pasarelas y canoas; salón central también sobre pilotes (`cienaga-troncal.md` El Cerco de los Pilotes).
- **Orcos Helsig (Cristal Helado)**: campamento minero fortificado con bocas de mina (`cristal-helado.md` Helske Tugh).
- **Goirntes (Meseta)**: ciudades-fortaleza geométricas de piedra pulida y hierro negro, acueductos perfectos, leyes grabadas en obeliscos (`meseta-del-orden.md` Descripción).
- **Faerus**: «poblado colgado sobre los árboles» en la selva (Hashma) (`margen-silencioso.md` Hashma); sin ciudades-fortaleza, poblados modestos (`berigLore.ts` l.246).
- **Nabieus**: sin descripción visual de arquitectura leída [propuesta: pendiente, no inventar].

## 7. Fauna y flora: reglas de familia

Las 26 familias comparten «sabor» según la Semilla que las tejió (`WMF/docs/rpgtarkor/lore-mundo/flora-fauna.md`). Reglas visuales:
- **Guelises** (depredadores de jauría), **Acechantes** (emboscada solitaria), **Corvenes** (aves de presa/carroñeras), **Zancudos** (aves terrestres/charca), **Bestiones** (grandes herbívoros de manada), **Rondines** (pequeños omnívoros): de Ferios, «instinto y caza limpia» (`flora-fauna.md`). [propuesta: cuerpos funcionales y creíbles, anatomía de animal real con rasgos de adaptación visibles]
- **Quitinos / Escamados / Nadantes** (Florial): insectos acorazados, reptiles y anfibios, fauna acuática.
- **Ordenados** (Goirme): tema simetría/orden/geometría. **Umbrias** (Kroj): sigilo, noche, silencio; criaturas que cazan en ausencia de luz y sonido (`genesis.md` § El dominio de Kroj).
- **Fauna de Sezix**: «fea, casi inquietante, cuerpos sin gracia, colores apagados» pero dócil (`genesis.md` l.174).
- **Mudos Salvaje**: animal real «con algo imposible o mítico»; **Rokrats Estallido**: sin animal base (`flora-fauna.md`).
- Flora: Heldras = pastos; Zarcos = arbustos; Veldrias = árboles; Salviras = flores de alquimia; Muscarias = líquenes/musgos; Vetrias = flora con mineral incrustado; **Brotes Salvajes** = flora normal mutada (Raíz de Fuego, Cardo Brújula) (`flora-fauna.md`).
- Flora y fauna nocturna de Kroj: «florecen o se activan de noche» (`genesis.md` l.189-190).
- **Ancla de silueta** (`prompt.ancla`): un animal real que da la silueta. **Decidido (D5):** entra en el prompt, que es interno, y nunca en texto publicado (el canon prohíbe nombrar especies nuevas como seres reales, `00-nucleo.md`).
- Lista de siluetas permitidas: [propuesta, a cerrar contigo]: cuadrúpedo ágil, cuadrúpedo corpulento de manada, ave planeadora, ave zancuda, reptil bajo, insecto acorazado, roedor pequeño.

## 8. Estilo de imagen por perfil

**Decidido (D8, usuaria, 2026-10-25): el estilo va por perfil, no por tipo.**
- `banner`: realista, fotografía cinematográfica, también en zonas (35 mm fauna, 100 mm macro flora, 24 mm paisaje,
  85 mm retrato).
- `icono` y `thumbnail` (son lo mismo): óleo con pincelada visible.
- `mapa`: punto medio entre realismo y óleo.

El estilo va al **final** del prompt (primero el sujeto) y le sigue el preámbulo (§12). Textos concretos en
`mundo.json` (`estilos`) [propuesta]. Encuadres: los de `FRAMING` en `imagePromptGenerator.ts`, con el del banner
reescrito en positivo («the whole subject fully inside the frame»).

## 9. Vetos (todos del repo salvo marca)

- Sin luna; el cielo nocturno es el velo perlado (`00-nucleo.md`, `genesis.md`).
- Sin humanos; sin pólvora ni arcabuz (`00-nucleo.md`).
- Faerus sin túnica ni sandalias (`00-nucleo.md`).
- Sin objetos hechos con partes de razas sintientes (`00-nucleo.md`).
- Sin texto, firmas ni marcas de agua en la imagen (`CIERRE` de `imagePromptGenerator.ts`); sin palabras en inglés ni rótulos (`auditoria-datos.md` §8; `00-nucleo.md` «Sin palabras en inglés» se refiere al lore).
- Sin niebla en el Margen (`margen-silencioso.md`).
- Corredor de Cauce: no añadirle materiales (moratoria) ni vivir en el Margen (`00-nucleo.md`).
- Lo RESERVADO no se muestra: muro de obsidiana, Ciudad Hundida, Archivo Cegado, Entidad Desconocida, etc. (`00-nucleo.md`).
- Cristal de la Niebla del Estrecho y todo Vaelira: fuera.

## 10. Contradicciones del canon que afectan a lo visual

Todas decididas por la usuaria el 2026-10-25 salvo 5-6 (compatibles) y 7 (ver §8).

1. **Cardo Brújula** (**decidido: gris metálico apagado con matiz violáceo**): «flor cerrada de un gris metálico apagado» (`worldCatalog.ts` l.11483, fuente de `harvestSourceDescriptions`) vs «flor cerrada de un morado apagado» (`worldCatalog.ts` l.6925, ítem `cardo-brujula`). El `.md` (`llanuras...md` l.158) no da color. 
2. **Color de la hierba de las Llanuras**: amarilla (Pasto Solar, `llanuras...md`) vs naranja seca (`REGION_ESCENA`) vs roja solo en Sabana Alta. **Decidido: amarillo pajizo anaranjado; rojo solo en la Sabana Alta.**
3. **Telda**: árbol «de 1-2 metros» (`llanuras...md` Telda Común) pero empalizadas de «4-5 metros de troncos de Telda» (l.232). **Decidido: crece hasta 4-6 m** (los de 1-2 m son jóvenes).
4. **Nabieus**: `rasgoFisico` dice «piel gris apagada» pero `genesis.md` l.181 dice «ninguna tonalidad reconocible». **Decidido: gris casi neutro, sin brillo, que apenas se distingue de la sombra.**
5. **Hulki**: `bio` habla de «piel de hojas» y «pelaje de corteza y musgo»; `rasgoFisico` Faerus del Margen solo pelaje. Compatible, se combinan (ver ficha).
6. **Real-animal en canon**: `sexDimorphism.ts` llama «Cánido» al Aullador Rojo y el `.md` compara Cuernahoja con gacela/cabra montesa; el canon prohíbe especies nuevas con nombre de ser real (`00-nucleo.md`). Resuelto por D5: sí en el prompt, nunca en texto publicado.
7. **Estilo fijo**: fauna siempre a la hora del ocaso (`ENTITY_TYPE_STYLE.fauna.luz`) vs `horaActiva` de la especie (6/53 definidas).

## 11. Escala de referencia

El repo no da alturas de razas (grep en `razas.md` sin resultados). Cifras de fauna sueltas: Aullador Rojo 90 cm (macho) / 80 cm (hembra) (`sexDimorphism.ts` l.103,109); Cuernahoja 120-180 cm (`llanuras...md`); Espina del Viento «apenas un metro» (`llanuras...md` l.69); Telda 1-2 m. 
[propuesta, a validar]: orco adulto 190 cm; Goirnte 180 cm; Nabieus 175 cm; Faerus erguido 160 cm (Hulki, vieja, algo menos). Se usan solo para dar tamaños relativos; **confírmalas o dame las tuyas**.

## 12. Preámbulo de estilo (inglés, cierra todos los prompts) [propuesta]

Dos variantes, en `mundo.json` (`preambulo`), en positivo (sin «no»: el modelo no usa prompt negativo) y sin nombrar la
luna ni el polvo de cristal, por lo que mostró el spike (nota final):

> **Día:** A grounded fantasy world with a physical, natural logic, where everything is handmade from wood, hide, bone, stone and dark iron. By day the sky is an ordinary daylight sky with a light warm haze. The mood is wild, quiet and lived-in, with muted natural colours, a subtle filmic grade and a single accent colour per scene. The image is completely textless.
>
> **Noche:** A grounded fantasy world with a physical, natural logic, where everything is handmade from wood, hide, bone, stone and dark iron. By night the sky is full of stars under a soft, even pearly glow. The mood is wild, quiet and lived-in, with deep cool shadows, muted natural colours and firelight as the only warm light. The image is completely textless.

## 13. Anclas de referencia aprobadas (pendiente)

El repo no tiene aún una imagen aprobada por tipo de escena registrada; la única referencia real es el múrgol (banner 1983x793, `backend/uploads/images/`). [propuesta: elegir una imagen de fauna al ocaso, una de paisaje y una de objeto y registrar su ruta en `estilo.json`]

> **Nota de las pruebas (spike, 2026-10-25), origen de las palabras vetadas de la [plantilla](plantilla-prompt.md#reglas) (`vetadas` de `mundo.json`, que comprueba `prompt_ficha.py`):** el preámbulo de día no nombra la luna (aunque sea para negarla, el
> modelo la pinta) ni el polvo de cristal (pone estrellas de día). Para escenas de noche, una variante aparte:
> «By night the sky is full of stars under a soft, even pearly glow», sin disco ni «moon». Palabras que el modelo
> malinterpreta y su alternativa: «moon» → no nombrarla; «crystal dust across the heavens» → «haze»; «scars» →
> «pale healed streaks»; «vetas de arena fosilizada» → «thin glinting streaks of red mineral embedded in the coat».
