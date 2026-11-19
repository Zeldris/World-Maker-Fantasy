# Retro: actualización a Galivelop-workflow v0.8.0 (`claude/wonderful-volta-662qt8`)

Fecha: 2026-11-18. Fase 2 antes del PR a `main`: `/gw-opt-tokens` y `/retro` de la tarea (desde `b55cdf0`, 2026-11-16).

**Estado:** aprobada entera por la usuaria (2026-11-18) y aplicada como `QA-511`: P1, P3 y P4 en el proyecto; P2
queda para Galivelop-workflow en «For Galivelop-workflow».

## Medición (`measure.py --since b55cdf0`)

- Principal: 90 llamadas, 10,3 M de entrada (98 % caché), contexto medio 115k, suelo 94k, techo 135k, sin compactar.
- Suelo fijo ~80k del sistema (84 % del arranque): ya conocido (`QA-363`), solo lo baja la usuaria desconectando
  conectores que no use en sesiones de código (Claude Docs sigue conectado).
- Lo más arrastrado: la investigación de modelos de imagen hecha en la principal leyendo docs de
  `claude/imagenes-por-fases` (grep, `git show`, `banco/resultados.md`): ~0,6 M arrastrados; `git diff
  21-roadmap.md | head -60` (6,7k, 128k arrastrados); `gw-update/SKILL.md` entero (123k arrastrados).
- Subagentes: 5, todos con modelo barato (Sonnet/Haiku); bien elegidos.

## Propuestas, por gravedad

1. **Navegación (proyecto).** La guía de `main` `docs/arquitectura/reutilizables/01-generacion-imagenes-local.md`
   está desfasada respecto a `claude/imagenes-por-fases` y llevó a error. Propuesta: una línea al principio que
   diga que la vigente está en esa rama hasta su fusión. Coste: 1 línea. Riesgo: ninguno.
2. **Merge con el árbol sucio (flujo).** Al traer `main` se descartó el cambio sin guardar de
   `docs/metrics/ledger.jsonl` (se recuperó de git). Propuesta para Galivelop-workflow: el paso de traer la rama
   protegida (`QA-72`) hace commit de las métricas pendientes o se niega con el árbol sucio. Va abajo.
3. **Tokens (proyecto): docs de otra rama, por subagente.** Leer `claude/imagenes-por-fases` desde la principal
   arrastró ~0,6 M (~6 % de la tarea). Propuesta: en `skills-wmf.md` (o `gw-opt-tokens.md`), «otra rama se lee como
   otro repo: un subagente barato que devuelva el resumen con rutas y citas». Riesgo: se pierde un matiz;
   contrapeso: el encargo pide citas literales de lo que decide.
4. **Tokens (proyecto): el mapa de roadmaps.** `git diff docs/producto/21-roadmap.md` se leyó en vez de
   `python3 tools/roadmap/cobertura.py --fila <ID>`, que ya existe. Propuesta: apuntar el caso en
   `.claude/gw/gw-opt-tokens.md` (no hace falta herramienta nueva). Riesgo: ninguno.

Barrido de leves: no aplica (no cierra bloque ni versión).

## For Galivelop-workflow

- Traer la rama protegida con el árbol sucio puede descartar `docs/metrics/ledger.jsonl` (la sesión lo hizo con un
  `checkout` al resolver el merge). El flujo podría dar una orden `merge-protected` que haga commit de las métricas
  (o se niegue) antes del `git merge`.
