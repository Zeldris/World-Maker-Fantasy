# Ficha: relevos entre agentes (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/09-relevos-agentes/` (NN = 09).

Idiomas: es, en

## Canales

- reddit
- linkedin
- discord

## Qué se cuenta

- **En una frase (quien lo usa):** cuatro reglas para que dos cuentas de agente de IA se pasen el trabajo y la
  siguiente sesión siga sin preguntar por dónde iba.
- **En una frase (técnico):** subir todo, subir cada 30-45 minutos con el archivo de traspaso en el mismo commit,
  acabar cada commit con `Siguiente: <paso>` y una fila de traspaso por rama de 600 caracteres como mucho.
- **Estado:** en uso en el repositorio; el `AGENTS.md` es público y se enlaza como ejemplo. Es una guía reutilizable, no una novedad del juego.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| El proyecto se trabaja por relevos desde dos cuentas de Claude; una sesión puede acabarse en cualquier momento (tokens, contenedor, cambio de cuenta) y la siguiente tiene que seguir sin perder nada y sin preguntar por dónde iba | `AGENTS.md:4-6` |
| Cada sesión corre en un contenedor temporal: lo que no está subido a GitHub no existe para la siguiente | `AGENTS.md:32` |
| El estado vive en los archivos del repositorio, no en la conversación | `AGENTS.md:36` |
| Commit y push en cada punto estable, nunca más de 30-45 minutos sin subir, y la bitácora (archivo de traspaso) en el mismo commit que el trabajo | `AGENTS.md:41-42` |
| Algo a medias o en rojo se sube igual, con `WIP:` delante y apuntando en la bitácora qué falla y por qué | `AGENTS.md:42-43` |
| La última línea de cada mensaje de commit es `Siguiente: <próximo paso concreto>` | `AGENTS.md:84` |
| Cada rama tiene una fila en la bitácora (tarea, lo que falta y siguiente paso) de 600 caracteres como máximo, comprobada por `bitacora.py` | `AGENTS.md:119-120`, `.claude/gw/scripts/bitacora.py:55` (`LIMIT = 600`) |
| Esa comprobación corre al hacer push (gancho `pre-push`, que llama a `bitacora.py check`) | `.claude/gw/scripts/prepush-ramas.sh:14`, `.githooks/pre-push` |
| El `AGENTS.md` del repositorio público está en `https://github.com/Zeldris/World-Maker-Fantasy` (rama `main`) | `git ls-remote` del repositorio: `HEAD` apunta a `refs/heads/main` |

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/relevos.webp` | es: Diagrama de cuatro pasos numerados: 1 todo subido, 2 subir cada 30-45 minutos, 3 commit con «Siguiente:», 4 una fila por rama; una flecha de vuelta dice que la sesión siguiente lo lee y sigue / en: Diagram of four numbered steps: 1 everything pushed, 2 push every 30-45 minutes, 3 commit with "Next:", 4 one row per branch; a return arrow says the next session reads it and carries on | reddit, discord |
| `medios/relevos.png` | es: Diagrama de cuatro pasos numerados: 1 todo subido, 2 subir cada 30-45 minutos, 3 commit con «Siguiente:», 4 una fila por rama; una flecha de vuelta dice que la sesión siguiente lo lee y sigue / en: Diagram of four numbered steps: 1 everything pushed, 2 push every 30-45 minutes, 3 commit with "Next:", 4 one row per branch; a return arrow says the next session reads it and carries on | linkedin |
| `medios/relevos.en.webp` | en: Diagram of four numbered steps: 1 everything pushed, 2 push every 30-45 minutes, 3 commit with "Next:", 4 one row per branch; a return arrow says the next session reads it and carries on | reddit, discord |
| `medios/relevos.en.png` | en: Diagram of four numbered steps: 1 everything pushed, 2 push every 30-45 minutes, 3 commit with "Next:", 4 one row per branch; a return arrow says the next session reads it and carries on | linkedin |

## Uso interno

Lo que sirve al equipo y no se publica: ids de tareas, ramas, PRs y notas. Nada de esto va en los canales.

- Propuesta P9 de `docs/difusion/propuestas/2026-11-02.md` (la propuesta decía r/ClaudeAI; el encargo lo cambia al perfil propio).
- Las líneas citadas en la propuesta (32, 42, 84, 119) coinciden con lo que dicen; el comentario sobre «que comprueba el push» sale del gancho `pre-push`, no de `AGENTS.md`.
- Pieza sin datos del juego: sirve aunque nadie juegue a Tarkor. Sin capturas.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
