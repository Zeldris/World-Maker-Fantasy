Pega esto en una sesión abierta en la carpeta de World-Maker-Fantasy (`cd World-Maker-Fantasy && claude`):

---

Vamos a mejorar los datos visuales de los elementos, el montaje de los prompts y el generador de imágenes, y a
montar en el admin una bandeja para revisar propuestas de lore y fichas en bloque. El trabajo previo (auditorías,
pruebas con `sd-cli`, borradores y prototipo) se hizo en solo lectura desde otra sesión y está en
`/home/deck/Desktop/Desarrollos/plan-imagenes-tarkor/`.

1. Abre una rama de trabajo según tu flujo y copia esa carpeta a `docs/producto/plan-imagenes/` (sin las PNG de
   `spike/intentos/`, que van a una ruta ignorada o se citan por nombre), y apúntalo en la bitácora.
2. Lee `plan.md` entero. Las decisiones D1-D10 y los conflictos de canon son de la usuaria: preséntaselos con la
   recomendación del plan y no empieces la fase 2 sin ellas. La fase 1 puede avanzar con lo que no dependa de ellas.
3. Crea en `docs/producto/roadmap-imagenes.md` los ítems nuevos de la sección 3 del plan.
4. Fase 1: guía visual del mundo y plantilla de prompt (desde `borradores/`), con todo lo marcado «[propuesta]»
   pendiente de aprobación; script que monta el prompt desde la ficha, con tests; los 4 pilotos con semilla fija
   para que la usuaria los apruebe. El preámbulo de estilo no puede nombrar la luna (aunque sea para negarla, el
   modelo la pinta: ver `spike/informe.md`).
5. Las fases 2-6 se reparten con `orchestrate-dealer` según el plan, con su code review por fase.

Ojo: `seed-catalog` y `reindex-lore` borran y reinsertan; nada que edite el panel puede vivir en tablas que siembran.
