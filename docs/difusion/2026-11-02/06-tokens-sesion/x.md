# X: 349 llamadas en 24 horas y el archivo de traspaso leído 39 veces

Texto alternativo de las imágenes en la ficha.

## es

**1/** Medimos una sesión de agente de IA programando 24 horas sin cortar entre tareas: 349 llamadas, 25 compactaciones, contexto medio de 113k. Lo que más pesó no fue el código: fue releer siempre lo mismo. #IA
Imagen: medios/metricas.webp

**2/** El archivo de traspaso entre sesiones se leyó 39 veces (305k). Una sola página de documentación arrastró otros 144k. El gasto venía de no cortar entre tareas.

**3/** Lo que cambiamos: repartir el trabajo a subagentes de contexto limpio y, al cerrar cada tarea, empezar de cero con /clear. El estado vive en un archivo, así que la sesión nueva no pierde nada.

**4/** Son cifras de un solo proyecto, no una regla. ¿Cuántas veces relee tu agente el mismo archivo? Así trabajamos: https://github.com/Zeldris/World-Maker-Fantasy

## en

**1/** We measured an AI agent session coding for 24 hours with no breaks between tasks: 349 calls, 25 compactions, 113k average context. What weighed most wasn't the code: it was re-reading the same thing. #LocalAI
Imagen: medios/metricas.en.webp

**2/** The handoff file between sessions was read 39 times (305k). A single documentation page dragged along another 144k. The cost came from never cutting between tasks.

**3/** What we changed: split the work across clean-context subagents and, when a task closes, start fresh with /clear. State lives in a file, so the new session loses nothing.

**4/** These are figures from one project, not a rule. How often does your agent re-read the same file? Here's how we work: https://github.com/Zeldris/World-Maker-Fantasy
