# Spike aullador rojo (FLUX.2 klein 4B Q8, seed 3, 6 pasos, 1280x512)

Comando (vía `image-generator/scripts/generar.sh <spike> <N> <prompt> 1280 512 3 6 [-r ...]`, que aplica sd-cli con
`--cfg-scale 1.0 --sampling-method euler --flash-attn off,diffusion=on --vae-tiling --params-backend disk --max-vram vulkan0=2`,
LD_LIBRARY_PATH=bin). Todo en `/home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/spike/`.
Prompts: pA.txt, pC.txt, pD.txt; logs en logs/.

| Run | Variante | Tiempo | Salida | Cuerpo | Patas | Cresta | Cola | Colmillos | Manada | Fantasía |
|---|---|---|---|---|---|---|---|---|---|---|
| base | prompt previo, sin -r | - | generated/.../banner-s3-p6-...png | zorro normal | largas | casi ninguna | anillada | no | sí (zorros) | no |
| A | prompt nuevo | 151 s | intentos/A.png | zorro/chacal ancho, NO largo | largas, no cortas | gran abanico de púas negras con punta naranja, solo en el lomo (no llega a la cola) | peluda oscura, sin púas | un colmillo curvo | sí, difusa, no alargada | no |
| B | A + -r juego | 272 s | intentos/B.png | MUCHO más largo y bajo (cuerpo de comadreja) | cortas, bien | púas grandes, naranja brillante, hasta la cola | peluda con púas al inicio | uno visible | sí, alargada y de perfil | atmósfera del ref |
| C | A + frase de mundo | 152 s | intentos/C.png | igual que A | largas | igual que A | igual | uno | sí, difusa | luna pálida, motas, siluetas de flora seca: sí, sutil y bien |
| D | -r zona (laberinto-de-canones) | 270 s | intentos/D.png | zorro algo más alargado que A | medias | púas con punta naranja, hasta la cola | peluda | un colmillo | 3 de manada, alargados | fondo respetado |
| E | -r zona + -r criatura | 36 s | FALLO | - | - | - | - | - | - | - |

E falló: `model manager cannot make enough memory ... need 2202 MB / budget 1786 MB` (dos referencias no caben en
`--max-vram vulkan0=2`; no se subió, README lo prohíbe). sd-cli sí admite varios -r.

## Veredictos
1. **¿El prompt arregla la anatomía?** No por sí solo. A (sin -r) sigue dando un cánido normal de patas largas: el
   modelo ignora "ferret/dachshund/as long as a snake". Mejora la cresta de púas y el colmillo, pero no la proporción.
2. **¿Ayuda -r?** Sí, es lo único que arregla la proporción larga y baja (B). El prompt a secas no lo logra; la imagen
   de referencia transmite la forma. Coste: ~270 s en vez de ~150 s. Riesgo: copia también el fondo/luz del ref.
3. **¿La frase de mundo da el toque fantástico?** Sí, de forma sutil y limpia (C): luna pálida, motas luminosas,
   siluetas de flora rara; no estropea la criatura. Conviene a todas las entradas, sobre todo con -r si el ref es realista.
4. **¿Zona como referencia?** Viable (D): el fondo se respeta casi entero (cañones rojos, cielo azul) y la criatura
   se integra con su luz y su polvo, con manada al fondo. Pero la criatura sale con la anatomía de A (cánido normal, algo
   más alargado) y la zona impone su cielo/hora, no la luz baja del prompt. Con la Deck solo cabe UN -r por el tope de
   2 GB; para combinar zona + criatura hay que lanzarlo en dos pasos (1.º criatura con -r propio, 2.º colocarla en la zona
   con la imagen resultante como -r) o probar el E con más VRAM bajo supervisión del usuario.
Recomendación: -r de la propia criatura para anatomía + frase de mundo en el prompt; zona-como-fondo en segunda pasada.

## Segunda tanda (preámbulo P sin luna; seed 3, 6 pasos, 1280x512)

Prompts: pF.txt, pG.txt, pH.txt. Tiempos: F 151 s, G 150 s, H 270 s (-r intentos/G.png). Salidas: intentos/F.png, G.png, H.png.

- **F (macho, sin -r).** Muy cerca del canon: delgado, cofre estrecho, lomo inclinado, patas largas con mechones negros en los tobillos, hocico largo con colmillos amarillos curvos, pelaje rojo óxido más oscuro abajo, cresta de cerdas oscuras, gola, cicatrices, cola negra gruesa arrastrando, dos de la manada medio ocultos detrás. Fallos: las "venas de arena fosilizada" salieron como cortes/heridas rosadas en el costado (no como vetas minerales brillantes); el cielo trae estrellitas de día (el polvo de cristal se leyó como estrellas, no hay luna); las patas son largas pero no desproporcionadas del todo. Ninguna luna.
- **G (Pastos de la Deriva, sin -r).** Se lee como mundo fantástico propio: óleo con empaste, cielo de ocaso, picos volcánicos, polvo rojo, arcilla roja entre la hierba, arbustos verde intenso de hoja ancha, sin edificios ni luna. Fallos de canon: puntitos de estrellas en el cielo; la manada de cuernahojas salió como vacas moteadas rojo/blanco (canon: lomo rojo, vientre blanco, cuernos finos y largos); a la derecha una figura parece un jinete sobre un animal (zona "sin gente"); los cazadores agachados no se ven.
- **H (segunda pasada sobre G).** La zona se respeta casi pixel a pixel (cielo, luz, hierba, arbustos, picos, animales lejanos) y la criatura queda integrada en estilo pictórico y con luz coherente. Anatomía: cuerpo de cánido delgado, patas largas, cola negra, cresta oscura, colmillos amarillos; pero las cicatrices se volvieron heridas abiertas rojas por todo el cuerpo (gore), no hay manada (solo uno), y la cabeza va baja y pegada al cuerpo. Mejor que D de la primera tanda.

Veredicto: F y G con preámbulo P funcionan sin romper el canon grave (sin luna). Pendiente ajustar: quitar "crystal dust ... across the heavens" o cambiarlo por "haze" (genera estrellas), reforzar "red back, white belly" en cuernahoja, "no riders", y describir las vetas como "veins of red mineral embedded in the coat" sin la palabra scars en H. El método dos pasadas (zona y luego criatura con -r) es viable con un solo -r.
