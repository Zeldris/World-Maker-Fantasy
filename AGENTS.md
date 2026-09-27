# Reglas para agentes (OpenCode)

## Sesiones de debate de lore

Cuando la conversación sea sobre diseño/lore del mundo (facciones, razas, construcciones,
historia, personajes, sistemas narrativos — cualquier tema de `docs/rpgtarkor/`), al llegar a una
propuesta completa (no a mitad de debate, solo cuando ya hay algo cerrado que proponer):

1. **Nunca edites directamente ningún archivo de `docs/rpgtarkor/`** ni ningún otro `.md` de
   lore ya existente. Esas ediciones las decide Álvaro tras revisar la propuesta, siguiendo el
   runbook de `docs/runbooks/ampliar-lore.md`.
2. En su lugar, **añade la propuesta a**
   `docs/borradores-opencode/propuestas-lore.md`, dentro de su categoría correspondiente (Facciones
   y diplomacia / Razas y cultura / Idiomas / Construcciones y reino / Historia y cronología /
   Fauna y flora / Personajes y NPCs / Otros). Lee el archivo completo antes de escribir y
   reescríbelo entero (todo lo que ya había + la entrada nueva) — **nunca sobrescribas ni elimines
   una entrada existente**.
3. Cada entrada nueva debe llevar cabecera con: fecha de hoy, tema tratado, y estado inicial
   `SIN REVISAR`.
4. Sé explícito en la propuesta: qué se propone exactamente, por qué (razonamiento, no solo la
   conclusión), y qué archivos de `docs/rpgtarkor/` tocaría si se aprueba — para que la revisión
   posterior sea rápida.
5. No toques código (`backend/src`, `frontend/src`) en ninguna sesión de lore salvo que se te
   pida explícitamente.

## Dónde está el canon (para el agente de lore)

Lee SIEMPRE `docs/canon-opencode/00-nucleo.md` antes de proponer nada: reglas duras, enums reales,
escala de valor y lista de comprobación. El resto de `docs/canon-opencode/` es el resumen del canon
por región y por catálogo (ver su `README.md`). Los originales completos están en `docs/rpgtarkor/`,
que manda si algo choca.

## Estilo del mundo (aplica a toda propuesta de lore)

- Mundo fantástico con base científica — coherencia interna, sin magia como comodín sin
  explicación. Todo debe estar conectado narrativamente con lo ya establecido.
- Nunca uses el nombre de una especie/planta real reconocible para fauna/flora nueva, ni siquiera
  como base de un nombre propio.
- Antes de proponer un elemento nuevo, busca un equivalente ya existente en el catálogo como
  plantilla de qué campos/nivel de detalle hacen falta.
