# LinkedIn: 349 llamadas en 24 horas y el archivo de traspaso leído 39 veces

Tarjeta de métricas (texto alternativo en la ficha).

## es

Medimos una sesión de agente de IA de 24 horas: 349 llamadas, 25 compactaciones de contexto y 113k de contexto medio.

Lo que más pesó no fue el código, fue releer siempre el mismo archivo. Una sola sesión, sin subagentes de trabajo, encadenó tres pull requests seguidos. El archivo con el estado que se pasan las sesiones (el traspaso) se leyó 39 veces y arrastró 305k; una única página de documentación sumó otros 144k. La causa no estaba en la tarea, sino en no cortar entre tareas.

Qué cambiamos:
- El trabajo de más de un paso se reparte a subagentes de contexto limpio; la sesión principal planea, decide y revisa.
- Al cerrar cada tarea se empieza de cero con /clear: el contexto largo es casi todo el gasto.
- Al arrancar, un script devuelve solo la fila propia del traspaso y los últimos commits; el archivo entero, solo si falta algo.

Lo que aprendimos: si el estado vive en un archivo y no en la conversación, cortar es barato y arrastrar no. Son cifras de un solo proyecto, medidas por nosotros.

¿Cuántas veces relee vuestro agente el mismo archivo? El flujo está en el repositorio: https://github.com/Zeldris/World-Maker-Fantasy

#IA #DesarrolloDeSoftware #AgentesDeIA #Productividad
Imagen: medios/metricas.png

## en

We measured a 24-hour AI agent session: 349 calls, 25 context compactions and 113k average context.

What weighed most wasn't the code, it was re-reading the same file. A single session, with no working subagents, chained three pull requests back to back. The file that carries state between sessions (the handoff) was read 39 times and dragged along 305k; one documentation page added another 144k. The cause wasn't the task, it was never cutting between tasks.

What we changed:
- Work of more than one step goes to clean-context subagents; the main session plans, decides and reviews.
- When a task closes, we start fresh with /clear: a long context is almost all of the cost.
- At startup, a script returns only the session's own row of the handoff and the latest commits; the whole file, only if something is missing.

What we learned: if state lives in a file and not in the conversation, cutting is cheap and dragging is not. These are figures from a single project, measured by us.

How often does your agent re-read the same file? The workflow is in the repository: https://github.com/Zeldris/World-Maker-Fantasy

#AI #SoftwareDevelopment #AIAgents #Productivity
Imagen: medios/metricas.en.png
