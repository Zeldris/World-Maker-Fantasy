# Reddit: banco del narrador

Publicación en el perfil propio (u/Alvaro-Garcia-Grana). La imagen va con el post (texto alternativo en la ficha).

## es

**Título:** Narrador local para un RPG: Llama 3.1 8B (0,727) gana a Gemma 4 e2b, Qwen 3.5 4B y Gemma 3 4B en un juicio a ciegas en los dos órdenes
Imagen: medios/metricas.webp

Hacemos Tarkor, un RPG narrativo cuya IA corre en local con Ollama. El narrador actual es Llama 3.1 8B (4 bits, Q4_K_M) con un Modelfile propio. Quisimos saber si alguno de tres modelos más nuevos y pequeños lo mejoraba, sobre todo en una Steam Deck. Spoiler: no.

**Método**
- Los cuatro modelos con el mismo prompt de sistema, temperatura 0,7 y contexto de 8192, sobre 11 situaciones de juego (una escena, un discurso, combates con la tirada fijada de éxito o de fallo, un viaje, un descanso, órdenes al reino…). Salen 132 juicios.
- Juicio a ciegas con una rúbrica. Los jueces fueron dos subagentes de Claude sin acceso a la clave de qué modelo escribió cada texto.
- Cada par de textos se juzga en los dos órdenes. Si el ganador cambia al invertirlo, cuenta como empate (un empate vale 0,5).
- Consistencia del juez al invertir el orden: 0,939 (el método pide al menos 0,6).

**Tasa de victorias**
- Llama 3.1 8B (el actual): 0,727
- Gemma 4 e2b: 0,500
- Qwen 3.5 4B: 0,394
- Gemma 3 4B: 0,379

Entre Gemma 3 y Qwen 3.5 la diferencia (menos de 0,15) es ruido, así que ese orden no vale. Gemma 4 e2b pierde dos de cada tres comparaciones directas con el actual.

**Latencia, en una Steam Deck:** el turno p50 baja de 29,3 s con Llama 3.1 a 18,8 s con Gemma 4 e2b, con la misma RAM. Son 7 turnos medidos, así que tómalo con cuidado. Fue el candidato que más se acercó y el único cuya latencia medimos en la Deck, pero narra peor y lo rechazamos. Los tres candidatos se rechazaron y borramos los modelos de prueba.

**Lo que no sabemos**
- Son 11 situaciones, un solo prompt (el nuestro, en español) y un juez que es otro modelo.
- El fallo más común, también en el actual, venía del prompt y no del modelo. Cuando lo cambiemos, repetiremos el banco: puede cambiar el orden.

**Preguntas:** ¿usáis jueces LLM con inversión de orden en vuestros bancos pequeños? ¿Qué más haríais para fiarse de 11 casos?

El código es público: https://github.com/Zeldris/World-Maker-Fantasy

## en

**Title:** Local narrator for an RPG: Llama 3.1 8B (0.727) beats Gemma 4 e2b, Qwen 3.5 4B and Gemma 3 4B in blind judging in both orders
Imagen: medios/metricas.en.webp

We're building Tarkor, a narrative RPG whose AI runs locally on Ollama. The current narrator is Llama 3.1 8B (4-bit, Q4_K_M) with our own Modelfile. We wanted to know whether any of three newer, smaller models could beat it, especially on a Steam Deck. Spoiler: none did.

**Method**
- All four models with the same system prompt, temperature 0.7 and a context of 8192, over 11 game situations (a scene, a speech, fights with the roll fixed to success or failure, a journey, a rest, orders to the kingdom…). That gives 132 judgments.
- Blind judging with a rubric. The judges were two Claude subagents with no access to the key of which model wrote which text.
- Each pair of texts is judged in both orders. If the winner changes when the order is flipped, it counts as a tie (a tie is worth 0.5).
- Judge consistency when the order is flipped: 0.939 (the method requires at least 0.6).

**Win rate**
- Llama 3.1 8B (current): 0.727
- Gemma 4 e2b: 0.500
- Qwen 3.5 4B: 0.394
- Gemma 3 4B: 0.379

Between Gemma 3 and Qwen 3.5 the gap (under 0.15) is noise, so that order means nothing. Gemma 4 e2b loses two out of three head-to-heads against the current model.

**Latency, on a Steam Deck:** the p50 turn drops from 29.3 s with Llama 3.1 to 18.8 s with Gemma 4 e2b, with the same RAM. That's 7 measured turns, so take it with a grain of salt. It came closest and was the only candidate whose latency we measured on the Deck, but it narrates worse and we rejected it. All three candidates were rejected and we deleted the test models.

**What we don't know**
- It's 11 situations, one prompt (ours, in Spanish) and a judge that is another model.
- The most common failure, in the current model too, came from the prompt and not from the model. When we change it, we'll run the bench again: the order may change.

**Questions:** do you use LLM judges with order flipping in your small benches? What else would you do to trust 11 cases?

The code is public: https://github.com/Zeldris/World-Maker-Fantasy
