# Reutilizables

Análisis y planes de piezas de arquitectura pensadas para Tarkor **y** para otros juegos o
aplicaciones. No van en el roadmap (decisión de la usuaria, 2026-10-13): cuando una se implemente en
Tarkor, entonces sí entra como tarea con hito.

Cada documento recoge la opción que se considera mejor para lo pedido, aunque corrija el prompt de
partida (indicación de la usuaria, 2026-10-13). Sigue el mismo orden: veredicto (si es útil y qué se
corrige del planteamiento),
la guía práctica, el plan de implementación por fases, el acoplamiento a Tarkor y cómo llevarlo a
otro proyecto.

| Documento | Qué resuelve |
|---|---|
| [01-generacion-imagenes-local.md](01-generacion-imagenes-local.md) | Assets visuales en local (Steam Deck) con FLUX.2 klein 4B y stable-diffusion.cpp, con respaldo en Colab |
| [02-voces-y-sonidos-locales.md](02-voces-y-sonidos-locales.md) | Voces por raza y sonidos de fauna en local con qwentts.cpp (Qwen3-TTS): diseñar, fijar con un audio de referencia, producir por niveles de hardware |
