# Roadmap del lore en el panel de administración — Tarkor

**Creado:** 2026-11-06 (usuaria), al separar del [roadmap de imágenes](roadmap-imagenes.md) lo que no es el generador.
Las tareas conservan su identificador. **Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su commit;
**[A]** pedido por Álvaro; esfuerzo **S** (horas) · **M** (1-2 días) · **L** (varios días).

- **IMG-7 · Modelo de datos: `Propuesta` y `FichaVisual`** [A] (usuaria, 2026-10-25): migración Prisma (puerta de un
  solo sentido), importador de los 3 `.md` de propuestas (~159), exportación de lo aprobado al formato de
  `propuestas-aprobadas.md`, fichas exportadas a JSON versionado, API Fastify con escritura solo desde `127.0.0.1` y
  token en `.env` (D1, D3, D4). Fase 2. **L**
- **IMG-8 · Panel admin de lore tipo CRM** [A] (usuaria, 2026-10-25): pestañas Propuestas y Fichas del
  [prototipo](plan-imagenes/prototipo/index.html) en el admin React: ver, filtrar, diff, editar y aprobar o rechazar
  en bloque las propuestas (de Claude y de OpenCode) y ver el lore ya volcado en la BD; un cambio a lore sembrado
  entra como propuesta, no se escribe en su tabla. Atajos de teclado. Depende de `IMG-7`. Fase 3. **L**
