# Herramientas de la Deck (`QA-188`, `QA-192`)

Atajos para jugar rondas de pruebas en la Deck, donde el host no tiene `psql`, `pg_dump` ni `pg_restore` y el driver de
Playwright va por `host.sh`. Se llaman desde la raíz, casi todos por `bash tools/qa/host.sh bash tools/qa/deck/<x>.sh …`.
Uso y reglas: [rondas-de-pruebas.md](../../../docs/runbooks/rondas-de-pruebas.md).

| Archivo | Para qué |
|---|---|
| `psql`, `pg_dump`, `pg_restore` | Van por `podman exec` al contenedor `tarkor-postgres` (`pg_restore`: sin argumentos, por stdin, o con el archivo como último argumento) |
| `_path.sh` | Solo con `source`: añade esta carpeta al final del `PATH` si falta `psql`, `pg_dump` o `pg_restore`. Lo cargan `escenario.sh`, `sql.sh`, `bench-ia.sh` y `comprobar-escenarios.sh` |
| `esc.sh <orden…>` | `escenario.sh` con esta carpeta en el `PATH` a la fuerza |
| `juego.sh [--rehacer\|--parar]` | `arrancar-juego.sh` con `IA_PERFIL=deck` e `IA_REGISTRO` absoluto en `logs/ia/<fecha>.jsonl` si no vienen puestas |
| `lanza.sh <partida>` / `relanza.sh <partida>` | Arranca el driver, espera a que responda (12-28 s, tope 60 s) y abre la partida; si ya hay un driver en el puerto, avisa y sale / mata solo el driver de este checkout, espera a que el puerto quede libre y llama a `lanza.sh`. Lentos (15-35 s): en segundo plano |
| `j.sh '<js>'`, `o.sh <ayuda> '<json>'` | JS suelto o una ayuda de `orden.sh` en el driver vivo |
| `ronda.sh` | Espera al narrador y juega una ronda de combate |
| `r.sh`, `panel.sh`, `txt.sh` | Abren una pestaña o panel y vuelcan su texto (sin captura); sin panel abierto, `r.sh` y `panel.sh` dicen «no hay panel abierto» |
| `est.sh <idPartida>` | Cifras del Reino y todos los súbditos por SQL (el id solo admite letras, cifras, `-` y `_`) |

Sin credenciales ni rutas de usuario: la raíz sale de la ubicación del script. Los resultados sueltos van a `logs/` (ignorado).
