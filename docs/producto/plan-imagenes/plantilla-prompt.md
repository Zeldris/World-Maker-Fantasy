# Plantilla de prompt desde la ficha (`IMG-4`, `IMG-5`)

**Estado:** sacada de [`borradores/plantilla-prompt.md`](borradores/plantilla-prompt.md) el 2026-10-25 con las
decisiones de la usuaria del [plan](plan.md#decidido-usuaria-2026-10-25). Lo marcado **[propuesta]** espera su
aprobación. La aplica `image-generator/scripts/prompt_ficha.py`; los datos están en `image-generator/estilo/mundo.json`
(lo común del mundo) y `image-generator/fichas/<tipo>/<slug>.json` (una ficha por elemento). Modelo destino: FLUX.2
Klein 4B, que no reescribe el prompt, pide frases descriptivas largas y, con cfg 1.0, ignora el prompt negativo.

## Reglas

1. **Sin LLM y sin prompt negativo.** Misma ficha, mismo perfil y misma variante dan siempre el mismo texto.
2. **El sujeto primero, el estilo al final.** Orden fijo de bloques, unidos por un espacio; cada bloque son frases
   completas, nunca listas de etiquetas.
3. **Frases en positivo.** El prompt no lleva «no», «not», «without», «never», «none», «nothing», «nobody» ni «n't»
   (`negaciones` de `mundo.json`): lo vetado se cumple sin nombrarlo.
4. **Palabras vetadas** (`vetadas` de `mundo.json`), porque el modelo las pinta mal; el script rechaza el prompt si
   aparecen y dice la alternativa:
   | Palabra | Qué pinta | En su lugar |
   |---|---|---|
   | «moon», «moonlit», «moonlight» | una luna, aunque sea para negarla | no nombrarla; de noche, «stars under a soft, even pearly glow» |
   | «crystal dust», «heavens» | estrellas de día | «a light warm haze» |
   | «scar(s)», «scarred», «wound(s)», «gash(es)» | heridas abiertas | «pale healed streaks» |
   | «fossilised/fossilized sand» | cortes rosados | «thin glinting streaks of red mineral embedded in the coat» |
5. **Sin nombres propios inventados.** El modelo no conoce «Aullador Rojo» ni «Hulki»: se describe la cosa. El script
   rechaza el prompt si contiene el `nombre` de la ficha.
6. **Animales reales, solo en el prompt** (D5): el campo `ancla` («a maned wolf, only gaunter and wilder») da la
   silueta; nunca pasa a texto publicado.
7. **Longitud** entre `longitud.min` y `longitud.max` palabras (120-280 **[propuesta]**; los prompts del spike que
   funcionaron tenían ~250). Si se pasa, se quitan bloques en este orden: B6 (luz), B5 (entorno), B4 (pose); nunca
   B1-B3. Si se queda corto, solo se avisa.
8. Un campo que falta o está vacío omite su bloque sin dejar hueco.

## Bloques

| Bloque | Sale de | Si falta |
|---|---|---|
| B1 Sujeto | `prompt.sujeto` y, si hay `prompt.ancla`, «Its silhouette recalls {ancla}.» | — (obligatorio) |
| B2 Cuerpo, cobertura y color | `prompt.cuerpo` | se omite |
| B3 Rasgos distintivos | `prompt.rasgos` (lista de frases, en orden) | se omite |
| B4 Pose y escena viva | `prompt.pose` | se omite |
| B5 Entorno | `prompt.entorno`; si la clave no está, «The setting is {paisaje de la región}.»; si está vacía, nada | ver izquierda |
| B6 Luz | `prompt.luz`; si no está, la `luz` de la región | se omite |
| B7 Encuadre | `encuadres[perfil]` | — |
| B8 Estilo | `estilos[perfil]` (D8): `base` con `{clase}` y el `acabado` de `porTipo[tipo]`; `thumbnail` es alias de `icono` | — |
| B9 Preámbulo | `preambulo[momento]` (`dia` o `noche`; por defecto, el `momento` de la ficha) | — |

**Variantes** (`variantes.<nombre>`, p. ej. `macho`, `hembra`): cada clave sustituye la del mismo nombre en `prompt`;
una clave terminada en `+` (`rasgos+`) se añade al final de la lista. Pedir una variante que no existe es un error.

**Estilo por perfil (D8, usuaria):** `banner` realista (fotografía cinematográfica, también en zonas: 35 mm fauna,
100 mm macro flora, 24 mm paisaje, 85 mm retrato); `icono` y `thumbnail` al óleo; `mapa`, punto medio entre realismo
y óleo. Los textos concretos de `estilos` son **[propuesta]**.

## Segunda pasada: la zona como fondo (D10)

Con `--fondo <ficha de zona>` el prompt es solo:
`fondo.entrada` (con `{lugar}` = `prompt.lugar` de la zona) + B1-B4 del sujeto (la primera letra de B1, en
minúscula) + `fondo.cierre` (con `{estilo}`: `photographic` en banner, `painterly` en icono, thumbnail y mapa). Sin
entorno, luz, encuadre, estilo ni preámbulo: los pone la imagen de la zona, que va como `-r` (una sola por pasada en la
Deck). Las mismas comprobaciones de las reglas 3-5 (con el nombre del sujeto y el de la zona).

## Uso

```
python3 image-generator/scripts/prompt_ficha.py <ficha.json> <perfil> [--variante macho] [--momento dia|noche] \
    [--fondo <ficha-zona.json>] [--json]
```

Imprime el prompt; con `--json`, `{"prompt", "palabras", "recortados", "avisos", "propuestas"}`. Sale con código 2 y el
motivo (palabra, regla, alternativa) si el prompt rompe una regla. Para generar:
`PROMPT_ARCHIVO=<prompt.txt> image-generator/scripts/probar.sh <tipo> <slug> <perfil> <semilla> <pasos> [-r <zona.png>]`.
