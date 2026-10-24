# Reddit: ronda de pruebas del Mundo vivo

**Subreddits:** `r/gamedev` (en, mejor en «Screenshot Saturday» o como post de devlog), `r/LocalLLaMA` (en, por el
ángulo de agentes e IA local), `r/programacion` (es). Leer antes sus normas de autopromoción. Imágenes:
`medios/flujo-pruebas.<idioma>.webp` (el diagrama) y `juego-combate.webp` del Portal.

## es

**Título:** Ponemos a agentes de IA a jugar a nuestro RPG para probarlo: lo que aprendimos en seis tandas

Hacemos Tarkor, un RPG por texto en el que una IA local (Ollama, en tu equipo) narra y un motor con reglas y tiradas
visibles decide qué pasa. El mundo sigue solo: facciones, fauna, caravanas y tu reino avanzan cada día.

Los tests automáticos cubren las reglas, pero no si jugar funciona de verdad. Por eso hacemos rondas en las que agentes
de IA juegan en un navegador real (Playwright) y apuntan lo que sale. Esta semana: seis tandas del «Mundo vivo».

**Lo que comprobamos jugando:** combate contra grupos, viajes que se cortan a mitad, la energía de comer y beber, los
maestros de oficio y la pausa de 7 días entre asaltos al reino.

**Lo que salió mal (y nos enseñó más):**

- La orden con la que el agente leía el estado del combate… atacaba. Perdimos una partida. Ahora es de solo lectura y
  hay un test que comprueba que no pulsa nada.
- «Pulsar» respondía «pulsado» aunque no hubiera accionado nada. Ahora falla y dice por qué.
- Cuatro pasadas no cerraron casi nada porque la partida no tenía el estado que pedía cada prueba (una montura, un NPC
  herido…). Ahora cada tanda carga una partida guardada preparada con las funciones del propio juego.

Van 44 de 48 tareas jugadas y salieron 11 hallazgos nuevos.

¿Alguien más usa agentes para probar juegos? ¿Cómo evitáis que el agente «se crea» que ha hecho algo que no ha hecho?

Más del proyecto, con lo que falta: https://zeldris.github.io/Portal-Galivelop/

## en

**Title:** We have AI agents play-test our RPG: what six batches taught us

We're making Tarkor, a text RPG where a local AI (Ollama, on your machine) narrates and a rules engine with visible dice
rolls decides what happens. The world runs on its own: factions, wildlife, caravans and your kingdom move forward every
day.

Automated tests cover the rules, but not whether the game actually works when you play it. So we run rounds where AI
agents play in a real browser (Playwright) and log what comes up. This week: six batches of the "living world".

**Verified by playing:** fighting groups, journeys cut short halfway, energy from eating and drinking, trade masters,
and the 7-day pause between raids on your kingdom.

**What went wrong (and taught us the most):**

- The command the agent used to read the fight state… attacked. We lost a save. It's read-only now, and a test checks
  that it clicks nothing.
- "Click" replied "clicked" even when nothing had been triggered. Now it fails and says why.
- Four passes closed almost nothing because the save lacked the state each test needed (a mount, a wounded NPC…). Now
  every batch loads a saved game prepared with the game's own functions.

44 of 48 tasks have been played so far, and 11 new findings came out of it.

Anyone else using agents to play-test games? How do you stop the agent from "believing" it did something it didn't?

More about the project, open items included: https://zeldris.github.io/Portal-Galivelop/
