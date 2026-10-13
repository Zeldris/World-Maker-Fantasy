# Reutilizables

Análisis y planes de piezas de arquitectura pensadas para Tarkor **y** para otros juegos o
aplicaciones. No van en el roadmap (decisión de la usuaria, 2026-10-13): cuando una se implemente en
Tarkor, entonces sí entra como tarea con hito.

Cada documento recoge la opción que se considera mejor para lo pedido, aunque corrija el prompt de
partida (indicación de la usuaria, 2026-10-13). Sigue el mismo orden: veredicto (si es útil y qué se
corrige del planteamiento),
la guía práctica, el plan de implementación por fases, el acoplamiento a Tarkor y cómo llevarlo a
otro proyecto.

Antes de subir un documento o un cambio en uno (`QA-71`):
- **Cada comando**, comprobado contra su fuente o marcado «(sin verificar)». La fuente puede ser la
  documentación oficial, `--help` o los archivos reales del repositorio del modelo. Lo que más falló:
  - `pip` dentro de distrobox o en SteamOS (PEP 668: pipx, uv o un venv);
  - servicios de systemd (del sistema o del usuario, comentarios en su propia línea);
  - archivos que un paso lee y ningún paso anterior crea.
- **Cada afirmación sobre el proyecto** (campos, rutas, tests, scripts), con su archivo y comprobada con
  `grep` en el código. Ejemplo: la raza de un NPC está en `worldCatalog.ts`, no en `Npc`.
- **Cómo comprobar**, cuando la web de GitHub da 503:
  - archivos de un modelo: `curl -s https://huggingface.co/api/models/<org>/<repo>` (campo `siblings`);
  - etiquetas de Ollama: `curl -s https://ollama.com/library/<modelo>/tags | grep -oE '<modelo>:[a-z0-9._-]*' | sort -u`;
  - archivos de un repositorio de GitHub: `raw.githubusercontent.com` o un `git clone` en el scratchpad.

| Documento | Qué resuelve |
|---|---|
| [01-generacion-imagenes-local.md](01-generacion-imagenes-local.md) | Assets visuales en local (Steam Deck) con FLUX.2 klein 4B y stable-diffusion.cpp, con respaldo en Colab |
| [02-voces-y-sonidos-locales.md](02-voces-y-sonidos-locales.md) | Voces por raza y sonidos de fauna en local con qwentts.cpp (Qwen3-TTS): diseñar, fijar con un audio de referencia, producir por niveles de hardware |
| [03-agente-desarrollo-local.md](03-agente-desarrollo-local.md) | Agente de desarrollo 100% local en la Steam Deck: Aider + Qwen3 14B en Ollama (Vulkan) para tareas acotadas; Devstral Small 2 solo en un equipo con GPU de la red local |
