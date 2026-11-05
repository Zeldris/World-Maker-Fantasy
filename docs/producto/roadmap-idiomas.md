# Roadmap de idiomas — Tarkor

**Creado:** 2026-11-05 (usuaria). **Qué cubre:** la internacionalización del juego. Hoy solo hay español, pero
desde ahora todo texto nuevo que vea la jugadora va por clave (`t('…')`) y no escrito a mano en el código. Los
textos de antes se migran por partes en cada hito, y el inglés entra en la Beta (`0.7`), antes de Vaelira.
**Orden y hito:** los fija el [mapa de roadmaps](21-roadmap.md#mapa-de-roadmaps).

**Cómo se usa** (mismo convenio que [roadmap-front.md](roadmap-front.md)): al cerrar un punto se tacha con su
commit; **[A]** pedido por Álvaro, **[P]** propuesta de Claude; esfuerzo **S** (horas) · **M** (1-2 días) ·
**L** (varios días). 🧭 = se diseña con la usuaria antes de implementar.

La fase IDI-A se hace **ahora, como excepción** a la regla de las pruebas de juego (usuaria, 2026-11-05): es la base
que permite que todo lo que se escriba a partir de ahí ya nazca traducible. Lo demás espera a su hito.

## Qué es texto de interfaz y qué es contenido

- **Interfaz:** botones, menús, avisos, errores, ayudas, etiquetas de los paneles. Vive en archivos de idioma
  (`es`, luego `en`) y se pide por clave.
- **Contenido del mundo:** nombres y descripciones de objetos, fauna, habilidades, facciones, lugares, plantillas de
  sucesos, el lore del RAG. Vive en catálogos y semillas; su traducción se diseña aparte (`IDI-7`).
- **Lo que escribe la IA** (narrador, Cronista, Escriba): no se traduce, se genera en el idioma de la partida
  (`IDI-8`).
- **El lore canónico** (`docs/rpgtarkor/`) no lo edita un agente: su traducción la propone una sesión de lore y la
  aprueba Álvaro (`IDI-11`).

## Fase IDI-A · Base (hito `0.3`, ahora)

- **IDI-1 · Base del frontend** [A] (usuaria, 2026-11-05): librería de i18n (i18next con react-i18next salvo que
  el diseño encuentre algo mejor), archivos `es` por área, `t()` con las claves tipadas (una clave que no existe
  falla el typecheck) y el idioma fijo en `es`. Las primeras pantallas que se toquen después ya van por clave. **M**
- **IDI-2 · Base del backend** [A] (usuaria, 2026-11-05): los textos que genera el servidor para la jugadora
  (errores de la API, avisos del turno, narraciones fijas, plantillas de sucesos) con clave y parámetros. 🧭 Si el
  backend devuelve clave y parámetros y resuelve el frontend, o si resuelve él con el idioma de la partida. **M**
- **IDI-3 · Formatos y plurales** [P]: números, cantidades y fechas del calendario del juego con `Intl`, y plurales
  con las reglas del idioma (nada de `x === 1 ? 'día' : 'días'` a mano). **S**
- **IDI-4 · Regla y comprobación** [A] (usuaria, 2026-11-05: «de aquí en adelante se vaya ya variabilizando
  todo»): regla en `REVIEW.md` y un script en el check que avisa de textos literales nuevos en JSX/TSX y en los
  mensajes del backend, solo en las líneas que cambian, para no bloquear lo antiguo. **S**

**Hecho cuando:** una pantalla nueva no puede subir con textos escritos a mano sin que el check lo diga, y el juego
se ve igual que antes.

## Fase IDI-B · Migración por partes (hitos `0.4` a `0.6`)

- **IDI-5 · Textos de la interfaz que ya existen** [A] (`0.4`): por áreas (pantallas previas, HUD, paneles,
  modales, zona, Reino, combate), un commit por área, sin cambiar nada de lo que se ve. Al acabar, el script de
  `IDI-4` pasa a revisar todo el frontend, no solo lo que cambia. **L**
- **IDI-6 · Textos del backend que ya existen** [A] (`0.4`): los mensajes y plantillas que quedan escritos a mano
  en las rutas y en el motor del turno. **L**
- **IDI-7 · 🧭 Contenido de catálogos y semillas con idioma** [A] (`0.5`): cómo se guarda la traducción de nombres
  y descripciones (columna por idioma, tabla de traducciones o archivos aparte), con el español como base. **L**
- **IDI-8 · 🧭 Narrador e IA por idioma** [A] (`0.6`): prompts por idioma, fragmentos del RAG del lore en el
  idioma de la partida, y el Cronista y el Escriba que escriben en ese idioma. **L**

## Fase IDI-C · Inglés (hito `0.7`, Beta de Berig, antes de Vaelira)

- **IDI-9 · Selector de idioma** [A] (`0.7`): en Configuración; el de la interfaz se guarda por instalación y el
  del contenido, por partida (una partida empezada en español se sigue en español). **S**
- **IDI-10 · Interfaz en inglés** [A] (`0.7`): los archivos `en` completos, y el check avisa de las claves sin
  traducir. **M**
- **IDI-11 · Contenido y lore en inglés** [A] (`0.7`): catálogos, semillas y el lore del RAG. El canon de
  `docs/rpgtarkor/` lo traduce una sesión de lore como propuesta y lo aprueba Álvaro; un agente no lo edita. **L**
- **IDI-12 · Narrador en inglés probado en la Deck** [A] (`0.7`): una partida con Ollama real en inglés, que el
  narrador no mezcle idiomas ni pierda el vocabulario del mundo. Depende de la máquina: lo comprueba la usuaria en
  la Deck, no los tests. **M**

**Hecho cuando:** Berig se juega entero en inglés, de la pantalla de inicio al narrador, y cambiar de idioma no
rompe ninguna partida guardada.
