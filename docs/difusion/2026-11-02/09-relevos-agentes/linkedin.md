# LinkedIn: relevos entre agentes

El diagrama de las cuatro reglas (texto alternativo en la ficha).

## es

Imagen: medios/relevos.png

¿Qué pasa cuando tu agente de IA se queda sin tokens a mitad de tarea?

Trabajamos por relevos con dos cuentas de agente. Una sesión puede acabarse en cualquier momento (tokens, contenedor, cambio de cuenta) y la siguiente tiene que seguir sin perder nada y sin preguntar por dónde iba. Cuatro reglas lo hacen posible:

1. **Lo que no está subido a GitHub no existe.** Cada sesión corre en un contenedor temporal: si no se sube, la siguiente no lo ve.
2. **Subir cada 30-45 minutos como mucho**, con el archivo de traspaso en el mismo commit que el trabajo. Lo que está a medias o en rojo se sube igual, marcado como trabajo a medias y apuntando qué falla.
3. **Cada commit acaba en «Siguiente: …»**, con el próximo paso concreto.
4. **Una fila por rama en el archivo de traspaso**, de 600 caracteres como máximo; un script lo comprueba al subir.

Lo que aprendimos: el estado tiene que vivir en el repositorio, no en la conversación. Y una regla que importa conviene que la compruebe un script.

Nuestro AGENTS.md completo, como ejemplo: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

¿Cómo hacéis vosotros el relevo entre sesiones?

#IA #AgentesDeIA #DesarrolloDeSoftware #Git #Productividad

## en

Imagen: medios/relevos.en.png

What happens when your AI agent runs out of tokens halfway through a task?

We work in hand-offs between two agent accounts. A session can end at any moment (tokens, container, account switch) and the next one has to carry on without losing anything and without asking where things stood. Four rules make that work:

1. **What isn't pushed to GitHub doesn't exist.** Every session runs in a temporary container: if it isn't pushed, the next one can't see it.
2. **Push every 30-45 minutes at most**, with the hand-off file in the same commit as the work. Half-done or red work gets pushed anyway, marked as work in progress, with what fails noted down.
3. **Every commit ends with "Next: …"**, naming the next concrete step.
4. **One row per branch in the hand-off file**, 600 characters at most; a script checks it on push.

What we learned: state has to live in the repository, not in the conversation. And a rule that matters is best checked by a script.

Our full AGENTS.md, as an example: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

How do you hand work over between sessions?

#AI #AIAgents #SoftwareDevelopment #Git #Productivity
