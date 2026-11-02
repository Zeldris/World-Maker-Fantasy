# X: banco de imágenes local en una Steam Deck

Hilo de 4 posts, cada uno de 280 caracteres como mucho (un enlace cuenta 23, un emoji 2). La imagen va en el
primero. Un hashtag como mucho.

## es

**1/** Queríamos que el generador de imágenes local de una Steam Deck se acercara a ChatGPT. Tras 7 rondas de pruebas, lo que más ayudó no fue cambiar de modelo: fue cambiar el texto de estilo del prompt. #LocalAI
Imagen: medios/metricas.webp

**2/** Lo que ganó: klein Q8, estilo «cine2», euler, 6 pasos y VAE pequeño. ~2,5 min por banner. Z-Image-Turbo es más fiel en fauna, pero tarda ~6-7 min.

**3/** Lo que no mejoró nada: el VAE completo (41 s frente a 22 s al decodificar y, a la vista, igual), 9 pasos (un 40 % más lentos), otros samplers y el codificador de texto en Q8.

**4/** El banco sigue en curso: falta fijar el perfil por defecto y probar más con Z-Image. Las rondas, con sus tiempos, en el repo: https://github.com/Zeldris/World-Maker-Fantasy

## en

**1/** We wanted the local image generator on a Steam Deck to get closer to ChatGPT. After 7 test rounds, what helped most wasn't switching models: it was rewriting the style text of the prompt. #LocalAI
Imagen: medios/metricas.en.webp

**2/** What won: klein Q8, "cine2" style, euler, 6 steps and the small VAE. ~2.5 min per banner. Z-Image-Turbo is more faithful on creatures, but takes ~6-7 min.

**3/** What didn't help at all: the full VAE (41 s vs 22 s to decode, and it looks the same), 9 steps (40% slower), other samplers and the Q8 text encoder.

**4/** The bench is still in progress: we have to settle the default profile and test Z-Image further. The rounds, with timings, are in the repo: https://github.com/Zeldris/World-Maker-Fantasy
