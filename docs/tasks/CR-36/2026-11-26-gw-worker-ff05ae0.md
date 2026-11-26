# 2026-11-26 · gw-worker · pending · CR-36

## Why

Revisión de bloque CR-36b: el acopio del Reino ignoraba el tope de materiales, contaba porteadores muertos o convalecientes, listaba destinos no visitados, y el combate de fondo dejaba sin carga a la partida si caían todos y dejaba fuera a guardias más allá del 8.º.

## Alternatives

Descontar de `genericos` las bajas genéricas: no hace falta, `aplicarBajas` ya las descuenta de la fila al caer.

## Changed because

—
