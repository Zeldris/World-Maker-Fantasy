# LinkedIn: ronda de pruebas del Mundo vivo

Imagen: `juego-mapa-pozo.webp` (texto alternativo en la ficha).

## es

¿Cómo se prueba un mundo que cambia aunque nadie lo toque?

En Tarkor, nuestro RPG narrativo con IA local, nueve facciones, la fauna y tu reino siguen adelante día a día. Los
tests unitarios (ya más de 4.200) cubren las reglas, pero no dicen si jugar se siente bien. Así que ponemos a agentes
de IA a jugarlo en un navegador real, por tandas, y apuntamos todo lo que sale.

Esta semana cerramos seis tandas del «Mundo vivo». Tres cosas que aprendimos:

- **Cada tanda necesita su punto de partida.** Cuatro pasadas no cerraron casi nada porque la partida no tenía el
  estado que pedía cada prueba. Ahora cada tanda arranca de una partida guardada con ese estado exacto.
- **Las herramientas del agente tienen que decir la verdad.** Una orden decía «pulsado» sin haber pulsado nada; otra,
  que solo debía leer el combate, atacaba. Ahora fallan con el motivo, y cada una tiene su test.
- **Lo que no se ha jugado no está hecho.** De 48 tareas del Mundo vivo, 44 están ya jugadas; las otras 4 siguen en la
  lista, a la vista.

Lo contamos todo, con sus pendientes, en el Portal de Galivelop:
https://zeldris.github.io/Portal-Galivelop/

#DesarrolloDeSoftware #IA #GameDev #Testing #TypeScript

## en

How do you test a world that keeps changing even when nobody touches it?

In Tarkor, our narrative RPG with local AI, nine factions, the wildlife and your kingdom move on day by day. Unit tests
(over 4,200 of them now) cover the rules, but they can't tell you whether playing feels right. So we have AI agents
play it in a real browser, in batches, and we log everything that comes up.

This week we wrapped up six batches of the "living world". Three things we learned:

- **Every batch needs its own starting point.** Four passes closed almost nothing because the save didn't have the
  state each test needed. Now every batch starts from a saved game with exactly that state.
- **An agent's tools must tell the truth.** One command reported "clicked" without clicking anything; another, meant
  only to read the fight, attacked. Now they fail with the reason, and each one has its test.
- **If it hasn't been played, it isn't done.** Of 48 living-world tasks, 44 have been played; the other 4 stay on the
  list, in plain sight.

We share all of it, open items included, on the Galivelop Portal:
https://zeldris.github.io/Portal-Galivelop/

#SoftwareDevelopment #AI #GameDev #Testing #TypeScript
