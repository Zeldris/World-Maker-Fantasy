# Estudio de prompts por categoría (IMG-54)

Un elemento por categoría hasta saber qué hace que se genere bien **solo**, antes de combinar. Método por elemento:
mismo motor y semillas; el banner de GPT solo para medir (`--medir-con`), nunca como `-r` (entrando como `-r` el
modelo lo copia: el «bueno» de pilares era el banner). Pruebas: **A** techo (prompt escrito mirando el banner, solo lo
que se ve), **B** el prompt de la base, **C1…Cn** B con una pieza cambiada, y una con todas. Variante `img54` del
elemento en `generated/`, P1 a 480x192 con klein 4B (~40 s); FLUX.3 solo con lo que ya funcione.

## Lugar: acantilados-partidos (2026-11-08, klein 4B, semillas 3 y 4)

Hoja: `generated/banco/hojas/sueltas-acant54-1.png` (filas A, B, C1, C2, C3, C4).

| Prueba | Qué cambia | Resultado | Color (emd cb/cr/y) |
|---|---|---|---|
| A techo | 125 palabras: costa de acantilados de arenisca roja, grietas con espuma, nidos, meseta de hierba a la izquierda, mar a la derecha, mediodía | **Casi el banner**: costa, arenisca roja, mar azul, nidos | 13/13/32, 11/12/40 (cielo más claro) |
| B base | — (264 palabras) | Dos bloques grises como paredes, rayas blancas, sol bajo de espaldas, volcán | 10/11/24, 11/11/19 |
| C1 luz | luz de mediodía en vez de «golden-hour» | Casi igual que B | 6/9/15, 8/13/17 |
| C2 cámara | «high aerial view» en vez de «low camera angle» | Se mira la grieta desde arriba; sigue lo demás | 10/9/24, 11/14/17 |
| C3 contenido | sin «pale healed streaks», mar en vez de volcanes | Quita las rayas; siguen los dos bloques | 10/9/23, 11/9/16 |
| C4 todo | C1+C2+C3 | Mar azul y vista alta, pero sigue siendo «una pared partida en dos» de roca gris | **3/6/19**, 4/6/19 |

**Conclusiones (lugar):**

1. **El modelo puede**: con klein 4B y un prompt que describe lo que se ve, sale casi el banner. El fallo está en el
   prompt, no en el motor.
2. **Lo que más pesa es cómo se nombra el sujeto.** «A vertical split coastal wall… two cliff faces» pinta un objeto
   (dos bloques), aunque se arregle todo lo demás (C4). Un lugar se describe como paisaje («a rugged coastline where
   sheer cliffs drop into the sea, cut by deep chasms»), nunca como una cosa con caras.
3. **El color de la roca tiene que estar.** B no lo dice y sale gris oscuro; A dice «rust-red layered sandstone».
4. **La disposición izquierda/derecha** (meseta a un lado, mar al otro) ordena la imagen mejor que los tercios.
5. **La luz de «día» tiene que ser de día** (C1/C4 bajan mucho la distancia de color), pero sola no arregla la forma.
6. **El paisaje de la región no puede tapar el del sitio**: los «low volcanic peaks» de la región se pintan aunque el
   sitio sea costa.
7. **Las reglas de las pautas se pintan**: «pale healed streaks» sale como rayas blancas aunque el lore no lo pida.
8. Menos es más: A tiene la mitad de palabras que B.

**Prueba D, sin mirar el banner** (lo que haría el generador): prompt escrito solo desde el lore con las reglas 2-8.
Hoja `generated/banco/hojas/sueltas-d54-1.png`.

- Acantilados D: costa de acantilados rojos, mar azul, nidos, hierba en la meseta: **muy cerca del banner** (luz algo
  más fuerte: y 6-11). Las reglas valen sin ver la referencia.
- Pilares D (segundo lugar): todo lo del lore está (tres pilares, puentes, estandartes, anillo de acantilados, día),
  pero **la escala no**: salen como postes de ladrillo de unos metros, no como torres de roca más altas que el cañón.
  «Pillars» y «each as tall as the cliffs» no bastan: falta decir qué parte de la imagen ocupan y la forma de la
  ruina (agujas de roca desmoronadas que se estrechan hacia arriba).

9. **La escala se dice por la imagen**, no por comparación: «rising from the bottom edge to near the top of the
   image». Y la palabra del objeto cuenta: «pillar» da poste; «rock spire / ruined tower» da la mole.
