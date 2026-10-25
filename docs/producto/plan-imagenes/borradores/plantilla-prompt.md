# Plantilla determinista de prompt (BORRADOR)

Entrada: una ficha de `fichas-piloto.json` + el perfil (`banner`/`thumbnail`/...) + `guia-visual-mundo.md` (§3 luz/paisaje por región, §12 preámbulo).
Salida: un único párrafo en inglés, **sin LLM y sin prompt negativo**. Modelo destino: FLUX.2 Klein 4B (lenguaje natural, frases descriptivas largas; la parte más importante va al principio).
`[propuesta]` = decisión mía, no sale del repo.

## Reglas generales
1. Orden fijo de bloques B1 a B9, unidos por un espacio; cada bloque son 1-3 frases completas (nunca listas de etiquetas).
2. **Anatomía primero, estilo último** (pedido del usuario). Hoy el estilo abre el prompt (`WMF/backend/src/services/imagePromptGenerator.ts` `buildPrompt`, CFG-39); aquí se invierte. [propuesta]
3. **Frases en positivo.** Nada de «no», «sin», «not». Los vetos de la ficha (`prohibido`) se cumplen por construcción (no se nombra lo vetado) y por el preámbulo; la plantilla nunca escribe «no moon». [propuesta]
4. **Sin cifras de comparación** («six times longer»). Tamaños en cm solo si ayudan, y siempre acompañados de una referencia corporal («reaching the hip of an adult orc»). Un número aislado por prompt como máximo. [propuesta, por la nota de FLUX.2 Klein]
5. **Sin nombres propios inventados** (Aullador Rojo, Cardo Brújula, Hulki, Pastos de la Deriva): el modelo no los conoce y los lee como ruido. Se describe la cosa. Excepción: ninguna.
6. `anclaSiluetaInterna` entra al prompt **solo como forma genérica** («a lean, long-legged wild-canine build»), nunca con el nombre de un animal concreto, y nunca se escribe en la ficha publicada. [propuesta] Si el usuario prefiere el nombre real en el prompt, es un interruptor `usarAnclaLiteral`.
7. Si un campo es `null` o falta, el bloque lo omite sin dejar hueco (no se inventa). Un campo sin fuente marcado en `_fuentes` como `[propuesta]` se usa igual pero queda listado en un informe `camposPropuesta[]` para que lo revise el usuario.
8. Longitud objetivo: 110-170 palabras (el generador actual pide 90-160, `generateImagePrompt`). Si se pasa, se recorta de abajo arriba: B6, B5, B4 (nunca B1-B3).
9. Todo prompt termina con el preámbulo de estilo (`guia-visual-mundo.md` §12), que incluye «completely textless» en positivo. No se añade «No text, no signature, no watermark» (el `CIERRE` actual) porque es negativo. [propuesta]

## Bloques y campos de entrada

### Fauna (`tipo: fauna`)
| Bloque | Contenido | Campos |
|---|---|---|
| B1 Anatomía | «A {tamaño relativo} {clasificacionSilueta}, {anclaSilueta genérica}, with {cuerpo}, {cabeza}, {extremidades} and {cola}.» | `tamano`, `escalaDeReferencia`, `clasificacionSilueta`, `anclaSiluetaInterna`, `cuerpo`, `cabeza`, `extremidades`, `cola` |
| B2 Cobertura y color | «Its {coberturaTipo} is {coberturaTextura}, {paleta.cuerpo} with {paleta.vientre} underparts, {paleta.extremidades}, {paleta.ojos} eyes.» | `coberturaTipo`, `coberturaTextura`, `paleta.*` |
| B3 Rasgos distintivos | Cada elemento de `rasgoDistintivo` (máx. 3) en una frase propia; si hay sexo: se añade el `dimorfismo` del sexo pedido. | `rasgoDistintivo`, `dimorfismo[sexo]` |
| B4 Pose y escena viva | «{postura}; {unidadesEnEscena} {comportamientoVisible}.» | `postura`, `comportamientoVisible`, `unidadesEnEscena` |
| B5 Hábitat | «The setting is {entornoTipico}, {paisaje de la región}.» | `entornoTipico`, `habitat.region` -> `REGION_ESCENA.paisaje` |
| B6 Luz | «{luzCaracteristica}» (si no hay, `REGION_ESCENA.luz`; si hay `horaActiva`, la luz sale de ella) | `luzCaracteristica`, `horaActiva`, `habitat.region` |
| B7 Encuadre | Texto del perfil (ver «Perfiles») | perfil |
| B8 Estilo | medio + acabado del tipo (ver «Estilo por tipo») | `estiloRef` |
| B9 Preámbulo | texto fijo | — |

### Flora (`tipo: flora`)
B1 = forma + habito + altura relativa («a spiky, upright thistle about as tall as an adult hand span...») · B2 = `partes` con su `paleta` por parte + `textura` · B3 = `rasgoDistintivo` + `fenomenoAsociado` mostrado por su causa visible · B4 = `densidadYAgrupacion` + `sustrato` · B5 = hábitat/zona · B6 = `iluminacionTipica` · B7-B9 igual.

### Localización (`tipo: location`)
B1 = bioma + relieve + vegetacionDominante (el paisaje como sujeto) · B2 = `paletaDominante` con su rol (suelo, hierba, aire) · B3 = `estructurasCaracteristicas` o `huellaHumana` (si es vacía, se dice que el paisaje está despoblado, en positivo: «a wide open, unpeopled landscape») · B4 = `faunaFloraVisible` (máx. 2, descritas por su silueta) · B5 = `cieloClima` · B6 = `luzPorMomento[momento]` · B7 = encuadre · B8 = estilo pintura · B9.

### NPC (`tipo: npc`)
B1 = raza (`rasgoFisicoRaza` + `rasgoFisicoVariante` **siempre**, heredados) + sexo + edad + complexión · B2 = `pielOPelaje`, `cabelloPelo`, `ojos`, `rasgosFaciales` · B3 = `marcasCicatrices`, `ropaYEquipo`, `ornamentos` (si `ropaYEquipo` dice «ninguna prenda», se escribe «bare of cloth, wearing only a simple bone pendant», en positivo) · B4 = `postura` + `expresion` + `oficioVisible` · B5 = `entornoHabitual` · B6 = `luz` · B7-B9.

## Perfiles (B7)
- `banner` 1280x512 (relación 2,5:1): usa el `FRAMING.banner` actual («Wide panoramic framing with open sky or mist across the top sixth of the image, the subject slightly off-centre with room around it and nothing cropped at the edges», `imagePromptGenerator.ts:257`). [propuesta: añadir «The subject fills about half of the frame width» para que el sujeto no sea diminuto en un formato tan ancho.]
- `thumbnail`: `FRAMING.thumbnail` (l.255). `mapa`, `icono`: sin cambios.

## Estilo por tipo (B8)
Se reutiliza `ENTITY_TYPE_STYLE` y se reordena: «{estilo}. {acabado}.». La luz de `ENTITY_TYPE_STYLE.<tipo>.luz` **solo se usa si B6 está vacío** (hoy manda siempre; eso fuerza ocaso a toda la fauna). Valores vigentes:
- fauna: «Cinematic wildlife photograph, natural muted colours, subtle filmic grade. Shot on a full-frame camera with a 35mm lens, ultra detailed fur, hide and scale texture.»
- flora: «Cinematic nature photograph, natural muted colours, subtle filmic grade. Shot with a 100mm macro lens, ultra detailed botanical and mineral texture.»
- location: «Oil painting with visible brushstrokes and rich impasto, atmospheric fantasy landscape art. Soft painterly edges and rich layered colour.»
- npc: «Cinematic fantasy portrait photograph, natural muted colours, subtle filmic grade. Shot on a full-frame camera with an 85mm lens, ultra detailed skin, cloth and leather texture.» (fuente: `imagePromptGenerator.ts` l.87-153)

## B9 Preámbulo (texto fijo)
Ver `guia-visual-mundo.md` §12. Se añade tal cual como última frase.

## Pseudocódigo (para el script)
```
def construir(ficha, perfil, sexo=None, momento=None):
    b = []
    b.append(B1(ficha))            # anatomía/forma/paisaje/raza según tipo
    b.append(B2(ficha))
    b.append(B3(ficha, sexo))
    b.append(B4(ficha))
    b.append(B5(ficha))            # hábitat desde habitat.region -> REGION_ESCENA.paisaje
    b.append(B6(ficha, momento))   # luz propia > hora activa > luz de región > luz del tipo
    b.append(FRAMING[perfil])
    b.append(ESTILO[ficha.estiloRef.tipo])
    b.append(PREAMBULO)
    texto = " ".join(x for x in b if x)
    assert not re.search(r"\b(no|not|without|never)\b", texto)  # regla 3, salvo dentro del preámbulo revisado
    return texto, campos_propuesta(ficha)
```
Lo que NO hace la plantilla: no llama a ningún LLM, no consulta la BD, no elige entre variantes de la ficha (el sexo/momento se pasan como argumentos).
