# Pasos 3.2 y 3.3 de la línea: Mundo vivo sin jugar y arreglados del Reino (P275-P303)

Reparto (2026-10-22, rama `claude/pruebas-reino`, sesión local en la Deck) de lo que quedaba tras el
[reparto del 3.3](plan-comprobacion-3.3.md): las 11 tareas de Mundo vivo «sin jugar» de `matriz-pruebas.py` y los
arreglados (o arreglados en parte) P275-P303 de [`pruebas-0.3-hallazgos.md`](pruebas-0.3-hallazgos.md), casi todos
del Reino y fusionados en `main` con el PR #76. Una tanda por sistema, un subagente `sonnet`, 6-8 comprobaciones y
como mucho ~60 llamadas; al tope, `escenario.sh guardar` y la siguiente lo carga. Cada tanda devuelve sus P y tareas
y la principal marca el registro (`marca-hallazgo.py`) y la matriz, y tacha aquí su fila.

| Tanda | Sistema | Escenario | Hallazgos y tareas | Estado |
|---|---|---|---|---|
| 15 | Almacén, edificios y comida por oficios | `reino-dia39-recursos` | P275, P276, P277, P278, P279, P282, P302; CR-61, CR-55 (Jaula y Corrales) | pendiente |
| 16 | Partidas de caza y usos de la fauna | `reino-dia39-recursos` | P280, P281, P283; CR-63, CR-56 | pendiente |
| 17 | Defensa, asaltos, reparar y felicidad | `reino-sano-defensas`; `reino-hambre-sed` para P299 y P300 | P284, P285, P287, P295, P296, P301, P299, P300 | pendiente |
| 18 | Diplomacia, vasallaje, guerra y comercio | `reino-guerra-vasallaje`; `reino-sano-defensas` para P294 | P286, P297, P298, P294, P290; CR-59, CR-47 | pendiente |
| 19 | Combate, capitán y compañeros | `reino-combate-capitan`, `reino-combate-ganable`, `reino-companero-npc` | P288, P291, P292, P293, P303; CR-15, CR-16, CR-17 | pendiente |
| 20 | Sucesos y ciclo vital | `reino-dia39-recursos` + `escenario.sh avanzar` | CR-9 (efectos con sus sucesos en el diario), CR-43 (ciclo vital y escisiones) | pendiente |
