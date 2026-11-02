# LinkedIn: banco del narrador

## es

Probamos tres modelos nuevos para el narrador de nuestro RPG con IA local, y ganó el que ya teníamos.

En Tarkor la IA corre en el equipo de quien juega, con Ollama. El narrador actual es Llama 3.1 8B. Quisimos saber si alguno de tres modelos más nuevos y pequeños (Gemma 4 e2b, Qwen 3.5 4B y Gemma 3 4B) lo mejoraba, sobre todo en una Steam Deck.

Cómo lo medimos:
- Mismo prompt, misma temperatura y mismo contexto para los cuatro, sobre 11 situaciones de juego.
- Juicio a ciegas, y cada par de textos en los dos órdenes. Si el ganador cambia al invertirlo, cuenta como empate.
- Consistencia del juez al invertir el orden: 0,939.

Resultado, en tasa de victorias: Llama 3.1 0,727, Gemma 4 e2b 0,500, Qwen 3.5 0,394, Gemma 3 0,379. Gemma 4 e2b recorta el turno de 29,3 s a 18,8 s (p50), con la misma RAM, pero pierde dos de cada tres comparaciones directas con el actual. Rechazamos los tres.

Lo que aprendimos: invertir el orden detecta un juez sesgado; más rápido no es mejor; y el fallo más común, también en el actual, venía del prompt y no del modelo. Cuando lo cambiemos, repetiremos el banco.

Es una comparación pequeña, con un juez que es otro modelo. El código es público: https://github.com/Zeldris/World-Maker-Fantasy

#IA #LocalAI #LLM #DesarrolloDeSoftware #GameDev
Imagen: medios/metricas.png

## en

We tested three new models as the narrator of our local-AI RPG, and the one we already had won.

In Tarkor the AI runs on the player's own machine, through Ollama. The current narrator is Llama 3.1 8B. We wanted to know whether any of three newer, smaller models (Gemma 4 e2b, Qwen 3.5 4B and Gemma 3 4B) could beat it, especially on a Steam Deck.

How we measured:
- Same prompt, temperature and context for all four, over 11 game situations.
- Blind judging, with every pair of texts in both orders. If the winner changes when the order flips, it counts as a tie.
- Judge consistency when the order is flipped: 0.939.

Win rates: Llama 3.1 0.727, Gemma 4 e2b 0.500, Qwen 3.5 0.394, Gemma 3 0.379. Gemma 4 e2b cuts the turn from 29.3 s to 18.8 s (p50) with the same RAM, but it loses two out of three head-to-heads against the current one. We rejected all three.

What we learned: flipping the order catches a biased judge; faster isn't better; and the most common failure, in the current model too, came from the prompt and not from the model. When we change it, we'll run the bench again.

It's a small comparison, with a judge that is another model. The code is public: https://github.com/Zeldris/World-Maker-Fantasy

#AI #LocalAI #LLM #SoftwareDevelopment #GameDev
Imagen: medios/metricas.en.png
