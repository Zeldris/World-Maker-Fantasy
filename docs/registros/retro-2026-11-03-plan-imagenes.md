# Retro de `claude/plan-imagenes` antes de `main` (2026-11-03)

**Estado:** presentada a la usuaria; pendiente de su decisión.

Rama de `IMG-15` a `IMG-33` (2026-10-26 → 2026-11-03, 90 commits): receta fotorreal, montaje, encuadre, gradación y
LoRA de estilo. Fuentes: la sesión `78090f77` (166 llamadas, 3 compactaciones), `/code-review` contra `origin/main`
(15 hallazgos: 4 medios, arreglados en `aa3f4eea`) y `/opt-tokens`.

## Propuestas, de más a menos grave

1. **Revisión corta al cerrar cada tarea IMG** (estándares; proyecto). Los 4 medios venían de tareas cerradas hacía
   días (`gradar.sh` de `IMG-17`, `montar.sh` de `IMG-15`, `planos.sh` de `IMG-23`) y solo salieron en la revisión
   de antes de `main`. Cambio: en el paso de cierre de tarea de `docs/runbooks/skills-y-modelos.md`, un
   `/code-review` del diff de la tarea (lo que `QA-126` ya pide para cada subagente). Riesgo: unos tokens más por
   tarea; a cambio, el fallo se arregla con el contexto aún cargado.
2. **Ramas de imágenes más cortas** (proceso; proyecto). 90 commits y 8 días sin pasar por `main` juntan los
   hallazgos y los conflictos (tres en la fusión de hoy). Cambio: en `roadmap-imagenes.md`, llevar a `main` al
   cerrar cada bloque (p. ej. receta, montaje, LoRA). Riesgo: más rondas de tres fases; se compensa con revisiones
   más pequeñas.
3. **La cadena fotorreal en `docs/mapa-agente.md`** (navegación; proyecto). La sección «Imágenes» no nombra
   `PERFIL=fotorreal`, `planos.sh`, `montar.sh`/`encuadre.py`, `gradar.sh`/`medir.sh` ni `loras/`; el README se
   leyó 15 veces y una ruta relativa a `medir.sh` falló. Cambio: una viñeta «Cadena fotorreal» con esas entradas y
   sus tests (`test_generar_perfil.py`, `test_gradar.py`, `test_montar.py`, `test_encuadre.py`). Riesgo: ninguno;
   `mapa-agente.py` comprueba las rutas.
4. **Hoja de contactos también para banners sueltos** (`/opt-tokens`; proyecto). 14 imágenes leídas una a una
   (~890k tokens arrastrados). Cambio: `hoja.sh` acepta una lista de archivos además del prefijo del banco.
   Riesgo: se ven más pequeñas; la finalista y la referencia GPT, enteras.
5. **`/clear` entre cerrar la última tarea y preparar `main`** (`/opt-tokens`; ya es regla, `QA-187`). La sesión
   siguió con suelo de ~65k y techo de 212k. Sin cambio de archivos: aplicarla.
6. **Ir a la línea en vez de releer** (`/opt-tokens`; nota en `.claude/gw/opt-tokens.md`). `roadmap-imagenes.md`
   15 lecturas, `test_generar_perfil.py` 14 (una con `cat` entero). `grep -n` a la tarea o la clase. Riesgo: ninguno.

Ya cubierto en la fase 1, sin propuesta: la coherencia de noche veta «golden-hour» y la luz del estilo va por momento;
la LUT lleva la huella de sus curvas.

## For Galivelop-workflow

- La propuesta 1 vale para cualquier proyecto: revisión corta del diff de cada tarea al cerrarla, no solo antes de
  la rama protegida.
