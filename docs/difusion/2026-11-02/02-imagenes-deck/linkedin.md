# LinkedIn: banco de imágenes local en una Steam Deck

Texto alternativo de la imagen en la ficha.

## es

Siete rondas para acercar un generador de imágenes local a ChatGPT. Lo que más ayudó no fue el modelo.

En Tarkor generamos los banners del juego en una Steam Deck. La calidad quedaba lejos de lo que sacábamos con ChatGPT, así que montamos un banco: mismo prompt y semilla, una palanca cada vez, con los tiempos apuntados.

Lo que midió el banco (banner de 1280x512):

- **El texto de estilo fue lo que más acercó el resultado:** luz y color pedidos con más intención, al mismo coste.
- **Cambiar de VAE no aportó nada:** el completo tarda 41 s en decodificar frente a 22 s, y a la vista es igual.
- **Más pasos no compensan:** 9 pasos, un 40 % más lentos, no mejoran los 6.
- **Z-Image-Turbo es más fiel en fauna,** pero tarda 6-7 minutos frente a ~2,5 min de la configuración ganadora.

Aprendizaje: antes de cambiar de modelo, afinar el texto de estilo.

El banco sigue en curso: falta fijar el perfil por defecto. Los resultados y los scripts están en el repo: https://github.com/Zeldris/World-Maker-Fantasy

¿Qué palanca os ha dado más en generación local?

#IA #IAGenerativa #GameDev #LocalAI
Imagen: medios/metricas.png

## en

Seven rounds to bring a local image generator closer to ChatGPT. What helped most wasn't the model.

For Tarkor we generate the game's banners on a Steam Deck. The quality was far from what we got with ChatGPT, so we built a bench: same prompt and seed, one lever at a time, timings logged.

What the bench measured (1280x512 banner):

- **The style text moved the result the most:** light and colour asked for with more intent, at the same cost.
- **Swapping the VAE added nothing:** the full one takes 41 s to decode versus 22 s, and it looks the same.
- **More steps don't pay off:** 9 steps, 40% slower, don't beat 6.
- **Z-Image-Turbo is more faithful on creatures,** but takes 6-7 minutes versus ~2.5 min for the winning setup.

Lesson: before switching models, refine the style text.

The bench is still in progress: we have yet to settle the default profile. Results and scripts are in the repo: https://github.com/Zeldris/World-Maker-Fantasy

Which lever has given you the most in local generation?

#AI #GenerativeAI #GameDev #LocalAI
Imagen: medios/metricas.en.png
