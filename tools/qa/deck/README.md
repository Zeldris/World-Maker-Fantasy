# Herramientas de la Deck (`QA-188`, `QA-192`)

Atajos para jugar rondas de pruebas en la Deck, donde el host no tiene `psql`, `pg_dump` ni `pg_restore` y el driver de
Playwright va por `host.sh`. Se llaman desde la raíz, casi todos por `bash tools/qa/host.sh bash tools/qa/deck/<x>.sh …`.
Uso y reglas: [rondas-de-pruebas.md](../../../docs/runbooks/rondas-de-pruebas.md).

| Archivo | Para qué |
|---|---|
| `psql`, `pg_dump`, `pg_restore` | Van por `podman exec` al contenedor `tarkor-postgres`. `escenario.sh` pone esta carpeta delante en el `PATH` si no hay `psql` |
| `esc.sh <orden…>` | `escenario.sh` con esta carpeta en el `PATH` a la fuerza |
| `juego.sh [--rehacer\|--parar]` | `arrancar-juego.sh` con `IA_PERFIL=deck` e `IA_REGISTRO` absoluto en `logs/ia/<fecha>.jsonl` si no vienen puestas |
| `lanza.sh <partida>` / `relanza.sh <partida>` | Arranca el driver (~28 s, en segundo plano) / mata el viejo y lo arranca |
| `j.sh '<js>'`, `o.sh <ayuda> '<json>'` | JS suelto o una ayuda de `orden.sh` en el driver vivo |
| `ronda.sh` | Espera al narrador y juega una ronda de combate |
| `r.sh`, `panel.sh`, `txt.sh` | Abren una pestaña o panel y vuelcan su texto (sin captura) |
| `est.sh <idPartida>` | Cifras del Reino y súbditos por SQL |

Sin credenciales ni rutas de usuario: la raíz sale de la ubicación del script. Los resultados sueltos van a `logs/` (ignorado).
