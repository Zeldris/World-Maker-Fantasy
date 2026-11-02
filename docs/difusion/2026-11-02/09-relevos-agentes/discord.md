# Discord: relevos entre agentes

Adjuntar el diagrama (texto alternativo en la ficha).

## es

Imagen: medios/relevos.webp

### 🔁 Cuatro reglas para que un relevo entre agentes no pierda nada

Una sesión de agente puede acabarse en cualquier momento (tokens, contenedor, cambio de cuenta). Así conseguimos que la siguiente siga sin preguntar por dónde iba:

- 📤 **Lo que no está subido a GitHub no existe** para la siguiente sesión.
- ⏱️ **Subir cada 30-45 minutos como mucho**, con el archivo de traspaso en el mismo commit que el trabajo.
- ➡️ **Cada commit acaba en `Siguiente: <paso>`**, con lo próximo a hacer.
- 📝 **Una fila por rama** en el archivo de traspaso, de 600 caracteres como máximo.

---

**Detalle:** lo que está a medias o en rojo se sube igual, marcado como trabajo a medias y apuntando qué falla. El límite de 600 caracteres por fila lo comprueba un script al hacer push. La idea de fondo: el estado vive en el repositorio, no en la conversación.

Nuestro `AGENTS.md` completo, como ejemplo: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

¿Cómo lo hacéis vosotros? Contadlo en el canal.

## en

Imagen: medios/relevos.en.webp

### 🔁 Four rules so an agent hand-off loses nothing

An agent session can end at any moment (tokens, container, account switch). This is how we make sure the next one carries on without asking where things stood:

- 📤 **What isn't pushed to GitHub doesn't exist** for the next session.
- ⏱️ **Push every 30-45 minutes at most**, with the hand-off file in the same commit as the work.
- ➡️ **Every commit ends with `Next: <step>`**, naming what to do next.
- 📝 **One row per branch** in the hand-off file, 600 characters at most.

---

**In detail:** half-done or red work gets pushed anyway, marked as work in progress, with a note on what fails. A script checks the 600-character limit on push. The idea underneath: state lives in the repository, not in the conversation.

Our full `AGENTS.md`, as an example: https://github.com/Zeldris/World-Maker-Fantasy/blob/main/AGENTS.md

How do you do it? Tell us in the channel.
