# Retro de la ronda de pruebas tras el PR #60 (2026-10-17)

Lo revisado: la ronda de `QA-27` jugada justo después de fusionar el PR #60, que solo cambia el registro de
hallazgos y la bitácora (sin código).

**Estado (2026-10-17): sin propuestas nuevas; la usuaria pidió llevar el registro a `main` directamente.**

## Lo que salió

- **Efectos secundarios de arreglos ya fusionados**: P188 (las insignias de P147 por encima de menús y
  diálogos) y P197 (dos «Salir» en el menú abierto desde un edificio, de P178). Los dos se ven al primer
  vistazo jugando y ningún test los cubría. Ya lo pide CLAUDE.md: cada tarea se juega al cerrarla, antes del
  PR. El PR #60 se fusionó sin esa partida por falta de tokens; falló aplicar la regla, no falta una regla.
- **Un arreglo que vuelve** (P177): el enfriamiento de encuentros guarda solo el último. Su test cubría un
  encuentro y vuelta, no dos seguidos. Es «Un fallo que vuelve» de `REVIEW.md`: al arreglarlo, cubrir el
  camino de varios encuentros seguidos.
- **Funcionó**: las comprobaciones de P164, P172, P185 y P187 en vivo coincidieron con sus tests.
