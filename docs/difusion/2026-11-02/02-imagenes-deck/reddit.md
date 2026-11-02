# Reddit: banco de imágenes local en una Steam Deck

Publicación en el perfil propio (`ficha.md`, `## Reddit`). El post se sostiene solo: título descriptivo, cifras,
lo que falta y una pregunta al final.

## es

Imagen: medios/metricas.webp

**Título:** Siete rondas para acercar un generador de imágenes local en una Steam Deck a ChatGPT: lo que más cambió el resultado fue el texto de estilo, no el modelo ni el VAE (tiempos y ajustes)

Para Tarkor, un RPG con IA local en el que estamos trabajando, generamos los banners del juego en una Steam Deck. La calidad, comparada con lo que sacábamos con ChatGPT, seguía siendo muy mala, así que montamos un banco: mismo prompt y misma semilla, **una palanca cada vez**, y los tiempos apuntados. Banner de 1280x512, semilla 3 salvo donde se dice, siete rondas el 25 de octubre.

**Configuración que mejor salió:** FLUX.2 klein Q8 + estilo `cine2`, euler, 6 pasos, VAE pequeño. **~2,5 min por banner**, y aguanta con otras semillas.

| Prueba | Resultado |
|---|---|
| VAE completo frente al pequeño | 41 s frente a 22 s al decodificar; a la vista, igual (a 200 %, PSNR 29-34 dB) |
| Codificador de texto Q8 frente a Q4 | mismo tiempo (~2,6 min), sin mejora clara |
| Estilo `cine` frente a `cine2` | `cine2` (cielo ámbar/carmesí saturado, polvo encendido a contraluz, borde de luz) es el más cercano a ChatGPT, al mismo coste |
| euler frente a dpm++2m y res_multistep | prácticamente iguales; er_sde cambia la composición al azar |
| 9 pasos frente a 6 | igual y un 40 % más lento |
| Z-Image-Turbo Q4 / Q6 | ~6 y ~7 min; más fiel en fauna, más blando y pictórico; en Q6 casi la misma imagen que en Q4 |
| klein-base, cfg 3,5, 20 pasos | 15 min, sobresaturado y no mejor |

**Lo que sacamos en limpio:**

- El texto de estilo movió más el resultado que cualquier cambio de modelo, VAE, sampler o pasos, y no cuesta nada.
- Z-Image-Turbo se acerca más a la anatomía que describimos de las criaturas, pero tarda más del doble.
- Con otras semillas (7 y 11), la configuración aguanta, pero detalles como la longitud de los colmillos dependen de la semilla, no del texto: conviene generar 2-3 y elegir.

**Lo que no sabemos:** la comparación es a ojo (salvo el PSNR del VAE) y con pocas semillas. **El banco sigue en curso:** falta leer más con Z-Image y fijar el perfil por defecto.

Las rondas, los prompts y el script para repetirlas están en el repo (`docs/producto/plan-imagenes/banco/`): https://github.com/Zeldris/World-Maker-Fantasy

¿Qué texto de estilo o ajuste os ha funcionado mejor con FLUX.2 klein? ¿Alguien ha conseguido que Z-Image-Turbo salga menos blando?

## en

Imagen: medios/metricas.en.webp

**Title:** Seven rounds to bring a local image generator on a Steam Deck closer to ChatGPT: the style text moved the result more than the model or the VAE (timings and settings)

For Tarkor, an RPG with local AI we're working on, we generate the game's banners on a Steam Deck. Compared with what we got from ChatGPT, the quality was still very poor, so we built a bench: same prompt and same seed, **one lever at a time**, timings logged. 1280x512 banner, seed 3 unless stated, seven rounds on 25 October.

**Best setup:** FLUX.2 klein Q8 + `cine2` style, euler, 6 steps, small VAE. **~2.5 min per banner**, and it holds up with other seeds.

| Test | Result |
|---|---|
| Full VAE vs the small one | 41 s vs 22 s to decode; to the eye, identical (at 200%, PSNR 29-34 dB) |
| Q8 vs Q4 text encoder | same time (~2.6 min), no clear gain |
| `cine` vs `cine2` style | `cine2` (saturated amber/crimson sky, lit-up dust against the light, rim light) is the closest to ChatGPT, at the same cost |
| euler vs dpm++2m and res_multistep | practically identical; er_sde changes the composition at random |
| 9 steps vs 6 | same result, 40% slower |
| Z-Image-Turbo Q4 / Q6 | ~6 and ~7 min; more faithful on creatures, softer and more painterly; Q6 gives almost the same image as Q4 |
| klein-base, cfg 3.5, 20 steps | 15 min, oversaturated and no better |

**What we took from it:**

- The style text moved the result more than any change of model, VAE, sampler or steps, and it costs nothing.
- Z-Image-Turbo gets creature anatomy closer to what we describe, but takes more than twice as long.
- With other seeds (7 and 11) the setup holds up, but details like tusk length depend on the seed, not on the text: generate 2-3 and pick one.

**What we don't know:** the comparison is by eye (except the VAE's PSNR) and with few seeds. **The bench is still in progress:** we still need to test Z-Image further and settle the default profile.

The rounds, the prompts and the script to repeat them are in the repo (`docs/producto/plan-imagenes/banco/`): https://github.com/Zeldris/World-Maker-Fantasy

What style text or setting has worked best for you with FLUX.2 klein? Has anyone got Z-Image-Turbo to come out less soft?
