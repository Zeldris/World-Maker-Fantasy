<!-- galivelop-workflow v0.5.0 -->
@AGENTS.md

## Solo para Claude Code

- Responde en el idioma del proyecto (`es`).
- Al empezar cada tarea, di en una línea qué skill y qué modelo pide el caso, con la skill `gw-selector` (y el runbook
  [`skills-y-modelos.md`](docs/runbooks/skills-y-modelos.md)). El modelo de la sesión lo elige la usuaria; los
  subagentes, el más barato que haga bien el trabajo.
- Antes de ir a `main`: `/code-review --max-findings all` del diff contra
  `origin/main`, con el criterio de `REVIEW.md` (fase 1 de las tres de `AGENTS.md`).
- Lo mecánico, a subagentes con modelos baratos (`gw-orchestrate-dealer`); la sesión principal planea, decide y revisa.
- **Compactación:** `.claude/settings.json` fija la ventana de compactación automática. Tras una compactación o un
  `/clear`, el gancho de inicio corre `python3 .claude/gw/scripts/recover.py --state`, que devuelve el estado de
  la bitácora y los últimos commits; un detalle perdido se busca con
  `python3 .claude/gw/scripts/recover.py --search "<texto>"`. Lo que tenga que sobrevivir va a `docs/records/traspaso.md`.
- **El modo automático** puede pedir permiso para editar `.claude/settings.json`, `.claude/gw.json`, `.claude/gw/scripts/` y `.githooks/`:
  pregunta a la usuaria antes de tocarlos, o deja que haga ella el cambio.
- **Sesión local (Deck):** crea sus PR con `gh` (`~/.local/bin/gh`, enlazado en el sandbox Flatpak de VS Code;
  `QA-285`, que sustituye a `QA-184`). Si `gh auth status` falla, se dice a la usuaria y no se buscan credenciales.
  La sesión de la nube usa las herramientas `mcp__github__*`.
