# Escribir la ficha visual de un elemento (`IMG-55`)

Guía para el agente que escribe el bloque `capas` de una ficha (`image-generator/fichas/<tipo>/<slug>.json`). Ese
bloque se escribe **una vez por elemento** y de él sale el banner: `scripts/capas.py --hibrida` (y el backend, en
`imagePromptCapas.ts`) lo monta así: tipo de foto + `corto` + `tamano` + `forma` + `viste` + `entorno` + `color` +
`repetir` + «A limited, muted palette of `paleta`» + «The image is completely textless.».

El motor es FLUX.2 klein 4B: **pinta cada palabra que lee**, atiende más a lo primero y se lía por encima de ~120
palabras. Por qué es así cada regla: [`receta-calidad.md`](receta-calidad.md) (rondas 1-8).

## De dónde sale

- El `canon` de la ficha y sus `fuentes` (lore de `docs/rpgtarkor/`, `docs/canon-opencode/00-nucleo.md`), la `region`
  y el `momento`. Si la ficha ya tiene `prompt`, sirve de pista, no de fuente.
- **A ciegas:** no mires el banner ni ninguna imagen generada del elemento. La ficha se juzga contra el banner después.
- No toques nada de lore: solo el bloque `capas` de la ficha.

## Campos (todos en inglés)

| Campo | Qué lleva |
|---|---|
| `corto` | **≤120 palabras**, frases simples, en este orden: sujeto y encuadre → luz → el rasgo dominante → el cuerpo parte por parte, cada parte rara con la cosa real a la que se parece → color de cada material → entorno. |
| `sujeto` | Una frase: qué es, cómo se encuadra y en qué parte de la imagen está. |
| `luz` | La luz como exposición: de dónde viene, qué queda en sombra y qué está claro. |
| `tamano` | Su tamaño comparado con cosas que están en la imagen. Nunca números. |
| `forma` | Su forma, parte por parte. |
| `viste` | Lo que lleva, por material y corte. Solo personas y pueblos; `""` en lo demás. |
| `entorno` | El sitio en capas: suelo, distancia media, horizonte. |
| `color` | El color de cada material con su suciedad o desgaste: «[color] [material], [mancha]». |
| `repetir` | Solo si hay muchos iguales (rebaño, poblado): cómo son los demás, más pequeños y difusos. Si no, `""`. |
| `paleta` | Dos o tres colores y un acento: «X, Y and Z with one accent of W». |
| `notas` | En español: «IMG-55, escrita por Claude a ciegas desde el canon» y cualquier duda. |

## Encuadre por tipo

- **location:** paisaje en capas (primer plano, distancia media, horizonte), qué hay a la izquierda y a la derecha, a
  la altura de los ojos, sin un sujeto único.
- **fauna:** el animal entero, de perfil a tres cuartos; uno solo en el centro, los demás solo en `repetir`.
- **npc / raza:** una figura de muslos arriba, a tres cuartos, en la parte izquierda.
- **item:** el objeto grande en el sitio donde se usa, con el entorno suave detrás.
- **flora:** la planta grande en su paisaje.
- **construccion:** el edificio entero en su sitio, desde la altura de los ojos, con el paisaje alrededor.

## Reglas

1. **Solo lo que se ve en una foto quieta.** Ni usos, ni costumbres, ni causas: si tienen efecto visible, se escribe
   el efecto. (Ronda 8: «se usa en infusiones» dio la salvia atada en manojo.)
2. **El sujeto, con su palabra real** si la tiene: «a knife», «a hut», «a marsh». Lo primero del `corto` dice qué
   es; si el motor no lo reconoce ahí, no lo arregla después. (Ronda 8: el cuchillo salió un cono blanco.)
3. **Cada rasgo raro, con la cosa real a la que se parece**, una vez y con su diferencia: «leaves like a willow's
   growing straight out of the skin». Un cuerpo no real se construye por partes de animales reales: «the body of a
   weasel, the legs of a badger». La analogía decide la forma, no el adjetivo.
4. **Tamaños por comparación** con lo que hay en la imagen («twice as tall as the hut beside it»). Nunca números.
5. **Nada pequeño en primer plano**: cada sustantivo se pinta grande. Lo pequeño (un nido, una runa suelta) o se
   escribe como parte de algo grande o se deja fuera.
6. **Color solo en `corto`, `color` y `paleta`.** Cada material con su suciedad. Pocas tintas y apagadas.
7. **Nombres del mundo, nunca** (personas, lugares, facciones, especies): se describe la cosa. Todo en inglés.
8. **Palabras vetadas** (las comprueba el script con su alternativa, en `estilo/capas.json`): orc, elf, dwarf, goblin,
   troll, golem; fat, belly, stocky; spires, gothic, castle; rows of windows; ink, cartoon, illustration; moon,
   moonlit, scar, wound, crystal dust; ivory-yellow; red dust o red streaks.
9. **El nombre del elemento es canon** y **el rasgo dominante es lo que lo separa de su animal o cosa real**: si se
   llama «cuernahoja», sus cuernos son de hoja y van segundos en el `corto`, antes que el cuerpo. Si el ancla es una
   gacela y el rasgo propio no va delante, sale una gacela (ronda 9). Lo que el canon no diga no se inventa; se dice
   en `notas`.
10. **Un solo sujeto**: si hay más figuras, se dice cuántas y dónde, o se quedan en `repetir`.

## Límites conocidos de klein 4B

Escríbelo igual; no se arregla con más texto: escenas oscuras (sale de día), caras de razas con colmillos (sale un
hombre con barba y colmillos curvos), caras de animales no reales (tira al animal real más cercano). Mejor describir
la cara por partes de animales reales que pedir «monstruoso».

## Comprobar

```bash
cd image-generator
python3 scripts/capas.py fichas/<tipo>/<slug>.json --hibrida        # monta el prompt y para si rompe una regla
python3 scripts/capas.py fichas/<tipo>/<slug>.json --hibrida --generar --camino <camino> --semilla 5   # genera
```

El primero tiene que salir sin errores. El segundo lo lanza la sesión principal (ocupa la GPU).
