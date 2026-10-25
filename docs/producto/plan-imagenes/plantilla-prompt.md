# Plantilla de prompt desde la ficha (`IMG-4`, `IMG-5`, `IMG-14`)

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
   rechaza el prompt si contiene el `nombre` de la ficha como palabra entera, sin distinguir mayúsculas («Ash» no salta
   con «ashes»).
6. **Animales reales, solo en el prompt** (D5): el campo `ancla` («a maned wolf, only gaunter and wilder») da la
   silueta; nunca pasa a texto publicado.
7. **Longitud** entre `longitud.min` y `longitud.max` palabras (120-320 **[propuesta]**, subido de 280 el 2026-10-25 porque recortaba la luz de Hulki y el entorno del aullador; los prompts del spike que
   funcionaron tenían ~250). Si se pasa, se quitan bloques en este orden: B6 (luz), B5 (entorno), B4 (pose); nunca
   B1-B3. Si se queda corto, solo se avisa.
8. Un campo que falta o está vacío omite su bloque sin dejar hueco.
9. **Coherencia con el momento** (`IMG-14`, **[propuesta]**): el prompt final (tras recortar) no puede nombrar el sol
   de día en una escena de noche (`sun`, `sunlit`, `sunlight`, `daylight`, `midday`, `noon`) ni las estrellas o la
   noche en una de día (`star(s)`, `starlit`, `night`); el atardecer no se comprueba. Los patrones están en
   `coherencia` de `mundo.json`, no en el código. Un momento o una estación desconocidos, una región de la
   ficha que no está en `regiones`, o una clave de `condiciones` mal escrita, también son error (regla 9) y el mensaje
   lista los valores válidos.

## Bloques

| Bloque | Sale de | Si falta |
|---|---|---|
| B1 Sujeto | `prompt.sujeto` y, si hay `prompt.ancla`, «Its silhouette recalls {ancla}.» | — (obligatorio) |
| B2 Cuerpo, cobertura y color | `prompt.cuerpo` | se omite |
| B3 Rasgos distintivos | `prompt.rasgos` (lista de frases, en orden) | se omite |
| B4 Pose y escena viva | `prompt.pose` | se omite |
| B5 Entorno | `prompt.entorno`; si la clave no está, «The setting is {paisaje de la región}.» y, con `--estacion`, la frase de `regiones[r].estaciones[estación]` detrás; si está vacía, nada | ver izquierda |
| B6 Luz | `prompt.luz` (tras variante y condiciones); si la clave no está, `regiones[r].luz[momento]`; si está vacía (`""`), nada | se omite |
| B7 Encuadre | `encuadres[perfil]` | — |
| B8 Estilo | `estilos[perfil]` (D8): `base` con `{clase}` y el `acabado` de `porTipo[tipo]`; `thumbnail` es alias de `icono` | — |
| B9 Preámbulo | `preambulo[momento]` (`dia`, `atardecer` o `noche`; por defecto, el `momento` de la ficha, y si no, `dia`) | — |

**Variantes** (`variantes.<nombre>`, p. ej. `macho`, `hembra`): cada clave sustituye la del mismo nombre en `prompt`;
una clave terminada en `+` (`rasgos+`) se añade al final de la lista. Pedir una variante que no existe es un error, y
también una clave de `variantes` o de `condiciones` que no sea un campo de `prompt` (`sujeto`, `ancla`, `cuerpo`,
`rasgos`, `pose`, `entorno`, `luz`, `lugar`).

**Condiciones** (`condiciones.<clave>`): ver la sección siguiente.

**Estilo por perfil (D8, usuaria):** `banner` realista (fotografía cinematográfica, también en zonas: 35 mm fauna,
100 mm macro flora, 24 mm paisaje, 85 mm retrato); `icono` y `thumbnail` al óleo; `mapa`, punto medio entre realismo
y óleo. Los textos concretos de `estilos` son **[propuesta]**. El `mapa`
solo vale con fichas de tipo `location` (con otro tipo, error).

## Condiciones: momento y estación (`IMG-14`)

Decidido por la usuaria (2026-10-25): el momento del día y la estación son parámetros aparte de las variantes del
sujeto (macho, hembra). El detalle de los valores, los textos y los límites son **[propuesta]** hasta su aprobación.

- **Momentos:** `dia`, `atardecer`, `noche` (`--momento`; sin él, el `momento` de la ficha y, si no, `dia`).
  **Estaciones:** `primavera`, `verano`, `otono`, `invierno` (`--estacion`, opcional; las claves internas del motor,
  `backend/src/services/worldClock.ts`; el enum del motor en mayúsculas, `PRIMAVERA`…`OTONO`, también vale y se
  normaliza). Sin estación, el prompt es el de antes.
- **`mundo.json`:** `preambulo` gana `atardecer`. Cada región tiene `luz` como objeto `{dia, atardecer, noche}` (la de
  día es la que había) y `estaciones` `{primavera, verano, otono, invierno}` con una frase de paisaje por estación,
  sacada de las glosas de [`estaciones.md`](../../rpgtarkor/lore-mundo/estaciones.md) (primavera, «la estación de las
  crecidas»; verano, «la seca»; otoño, «la cosecha», con migraciones; invierno, «la estación larga»). Lo que el canon
  no dice (casi todo fuera de las Llanuras) está escrito como frase plausible y su clave consta en la lista
  `propuestas` de la región. Una `luz` de región que sea un texto vale para todos los momentos.
- **`condiciones` en la ficha:** bloque opcional con las claves `momento:<m>`, `estacion:<e>` y la combinada
  `estacion:<e>+momento:<m>` (solo en ese orden y sin repetir; `momento:<m>+estacion:<e>` o tres partes son error). Cada valor sustituye claves de `prompt` igual que una variante (`rasgos+` añade). Una
  clave que no case con esos formatos o con un valor conocido es un error.
- **Orden de aplicación:** `prompt` → variante → estación → momento → combinada (gana la última). Una ficha con luz
  propia de día (p. ej. el cardo brújula) necesita su `momento:noche` y `momento:atardecer`, o la regla 9 la rechaza
  de noche; una zona que cambia con la estación (Pastos de la Deriva) lo cuenta en `estacion:<e>` sobre `cuerpo`.
- **B5:** la frase de estación de la región solo se añade al entorno por defecto («The setting is…»). Una ficha con
  `entorno` propio decide ella con su condición `estacion:<e>`.
- **`--fondo`:** el sujeto recibe también sus condiciones, y el prompt de fondo no cambia por la zona (la pone el
  `-r`). La zona de fondo tiene que ser de la misma condición: el `--json` devuelve `condicion`, `«<estacion|->/<momento>»`
  (p. ej. `invierno/noche`, `-/dia`), para que quien genere elija la imagen aprobada de esa condición (`IMG-12`).
- **Longitud:** más condiciones no cambian la regla 7; si una ficha se pasa, se recorta B6, B5, B4 y `recortados` lo
  dice. Con los datos de hoy (máximo de 320 palabras) solo recorta el aullador rojo
  hembra de noche en invierno (B6); el resto de fichas, variantes y condiciones caben enteras.

## Segunda pasada: la zona como fondo (D10)

Con `--fondo <ficha de zona>` el prompt es solo:
`fondo.entrada` (con `{lugar}` = `prompt.lugar` de la zona) + B1-B4 del sujeto (la primera letra de B1, en
minúscula) + `fondo.cierre` (con `{estilo}` = `estilos.<perfil>.palabra` de `mundo.json`: `photographic` en banner, `painterly` en
icono, thumbnail y mapa). La ficha de fondo tiene que ser de tipo `location` y llevar `prompt.lugar` no vacío, o es error. Sin
entorno, luz, encuadre, estilo ni preámbulo: los pone la imagen de la zona, que va como `-r` (una sola por pasada en la
Deck). Las mismas comprobaciones de las reglas 3-5 (con el nombre del sujeto y el de la zona).

## Uso

```
python3 image-generator/scripts/prompt_ficha.py <ficha.json> <perfil> [--variante macho] \
    [--momento dia|atardecer|noche] [--estacion primavera|verano|otono|invierno] [--fondo <ficha-zona.json>] [--json]
```

Imprime el prompt; con `--json`, `{"prompt", "palabras", "recortados", "avisos", "propuestas", "momento", "estacion",
"condicion"}`. Sale con código 2 y el
motivo (palabra, regla, alternativa) si el prompt rompe una regla. Para generar:
`PROMPT_ARCHIVO=<prompt.txt> image-generator/scripts/probar.sh <tipo> <slug> <perfil> <semilla> <pasos> [-r <zona.png>]`.
