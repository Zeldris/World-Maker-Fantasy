# 2026-11-26 · gw-orchestrate-dealer · pending · CR-36

## Why

36b, tanda B: Q-43 (la siembra cubre las bocas de hoy con un 25 % de margen; el resto, por obras) y Q-42 (una obra parada por hueso, cuerda u odre avisa de que eso lo traerá una caravana, `CR-64`).

## Alternatives

Importar `CATEGORIAS_ACOPIO` de partidasAcopio.ts: se duplica la lista para no crear una dependencia circular con casaDeObras. Llevar el aviso de caravana a la cola del Reino: fuera de 36b.

## Changed because

La siembra ya no lee `WorldPopulation` (máximo histórico): solo `KingdomStats` de hoy.
