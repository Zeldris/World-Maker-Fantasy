# Reddit: relevos entre agentes

Perfil propio (u/Alvaro-Garcia-Grana); el post se sostiene solo. Imagen: el diagrama de las cuatro reglas.

## es

Imagen: medios/relevos.webp

**Título:** Cuatro reglas para que dos cuentas de agente de IA se pasen el trabajo sin perderlo (y la sesión siguiente siga sin preguntar)

Trabajamos un proyecto por relevos entre dos cuentas de Claude. Una sesión puede acabarse en cualquier momento (tokens, contenedor, cambio de cuenta) y la siguiente tiene que seguir sin perder nada y sin preguntar por dónde iba. Esto es lo que nos ha funcionado, por si te sirve:

**1. Lo que no está subido a GitHub no existe.** Cada sesión corre en un contenedor temporal. Si el trabajo no está en el remoto, la siguiente sesión no lo tiene.

**2. Subir cada 30-45 minutos como mucho, con el archivo de traspaso en el mismo commit que el trabajo.** Así el estado y el código nunca se separan. Lo que está a medias o en rojo se sube igual, marcado como trabajo a medias y apuntando en el traspaso qué falla y por qué.

**3. Cada commit acaba en una línea `Siguiente: <paso concreto>`.** Por ejemplo, `Siguiente: añadir el test del caso sin red`. La sesión nueva lee el último commit y ya sabe por dónde seguir.

**4. Cada rama tiene una fila en el archivo de traspaso, de 600 caracteres como máximo.** Qué tarea hay en curso, qué falta y cuál es el siguiente paso. El límite obliga a resumir, y un script lo comprueba al hacer push, así que no depende de que nadie se acuerde.

**Lo que aprendimos:** el estado tiene que vivir en el repositorio, no en la conversación. Y lo que importa conviene que lo compruebe un script, no la buena voluntad de un agente.

Nuestro `AGENTS.md` completo, como ejemplo: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

¿Cómo hacéis vosotros el relevo entre sesiones o entre agentes? ¿Qué os ha faltado en el traspaso?

## en

Imagen: medios/relevos.en.webp

**Title:** Four rules so two AI agent accounts can hand work to each other without losing it (and the next session carries on without asking)

We run a project in hand-offs between two Claude accounts. A session can end at any moment (tokens, container, account switch) and the next one has to carry on without losing anything and without asking where things stood. Here's what has worked for us, in case it's useful:

**1. What isn't pushed to GitHub doesn't exist.** Every session runs in a temporary container. If the work isn't on the remote, the next session doesn't have it.

**2. Push every 30-45 minutes at most, with the hand-off file in the same commit as the work.** That way state and code never drift apart. Half-done or red work gets pushed anyway, marked as work in progress, with a note in the hand-off on what fails and why.

**3. Every commit ends with a `Next: <concrete step>` line.** For example, `Next: add the test for the offline case`. The new session reads the last commit and knows where to pick up. (In our repo the line is written in Spanish as `Siguiente:`.)

**4. Every branch has one row in the hand-off file, 600 characters at most.** The task in progress, what's left and the next step. The limit forces you to summarise, and a script checks it on push, so it doesn't depend on anyone remembering.

**What we learned:** state has to live in the repository, not in the conversation. And what matters is best checked by a script, not by an agent's good intentions.

Our full `AGENTS.md`, as an example: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

How do you hand work over between sessions or agents? What has been missing from your hand-offs?
