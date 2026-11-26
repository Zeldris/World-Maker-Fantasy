# 2026-11-26 · gw-orchestrate-dealer · pending · CR-36

## Why

36b, tanda A (Q-40, Q-41, Q-37): las facciones con obra parada por leña, piedra o fibra mandan un acopio de 8 porteadores (y guardias de sus soldados según el riesgo) a la zona más cercana de su región con ese recurso; en combate pelean primero los guardias.

## Alternatives

Descontar los porteadores del trabajo agregado de `factionEconomy.ts`: se deja pendiente (toca el reparto). Fijar los guardias del test de integración: el mundo de prueba trae riesgo, se comprueba 0/2/4 y el descuento de soldados.

## Changed because

`cazadoresFuera` ya solo cuenta rol «cazador»: si no, guardias y porteadores restarían cazadores en agregado. `aplicarBajas` no resta población por guardias muertos (salieron de los soldados).
