# Investigación: UIs y flujos de generadores de imagen (para el generador local FLUX.2 Klein 4B)

Fecha: 2026-10-25. Cobertura: InvokeAI, Midjourney, Leonardo, ComfyUI, Fooocus bien/medio verificados con fuentes primarias;
Krea y herramientas de pipeline de arte de juegos NO investigados (sin fuente; no se afirma nada de ellos).
Marcas: [V] verificado en la fuente citada; [N] no encontrado/no verificado.

## 1. Tabla de funciones útiles

| Función | Quién la tiene | Por qué nos sirve |
|---|---|---|
| Tableros/colecciones | InvokeAI boards (arrastrar, zip de tablero, "Uncategorized", tableros virtuales por fecha) [V]; Midjourney Folders (shift-clic/arrastrar en bloque, agrupar, Saved Searches) [V]; Leonardo Collections ("Add to Collection" al generar) [V parcial] | Mapea a elemento del juego (fauna/flora/zona...): un tablero por elemento, destino elegido antes de generar |
| Destacar/estrella | InvokeAI: estrella fija arriba de la galería (menú contextual o icono al pasar) [V] | Marcar "candidata" sin perder el resto; barato de implementar |
| "Elegida" única por perfil | (no es de ninguna; es nuestro dominio) | Estrella = candidata; "elegida" = una sola por (elemento, perfil) |
| Recuperar ajustes | InvokeAI: Remix (todo menos semilla), Use Prompt, Use Seed, Use All, panel Info [V] | Reintentar una variación sin reescribir; guardar metadatos junto al PNG |
| Cola/historial de trabajos | ComfyUI: pestaña Job History con estados y filtros (All/Completed/Failed), panel Assets (Generated/Imported, agrupa salidas múltiples) [V, experimental] | A 2 min/imagen la cola es central: encolar N, ver estado, cancelar, reordenar |
| Imagen de referencia / estilo | Leonardo Image Guidance: Style Reference (Low..Max), Character Reference (peso 0-2), ControlNets [V]; Fooocus Image Prompt [V]; FLUX.2 Klein multi-referencia (ver sec. 4) | Fondo de zona aprobado -> referencia para colocar criatura; coherencia de estilo |
| Presets de estilo | Fooocus Styles + prompt expansion; negative prompt por defecto en config [V] | Un preset por perfil (banner/miniatura/mapa) con sufijo de estilo del juego |
| Inpaint/outpaint/lienzo | InvokeAI Unified Canvas ("Send to Canvas") [V]; Fooocus Inpaint/Outpaint [V]; Leonardo Canvas [N] | Retocar un fallo pequeño en vez de regenerar 2 min; con Klein, edición por referencia lo sustituye en parte |
| Orden/filtro/búsqueda | Midjourney Organize: buscar, filtrar, ordenar, Saved Searches [V] | Filtrar por elemento/perfil/estado (candidata, elegida, descartada) |
| Atajos de teclado para triaje | Midjourney Style Creator: icono de hotkeys para selección rápida [V]; InvokeAI: atajos documentados solo de app/lienzo, no de galería [V] | Triaje sin ratón: flechas, 1-5 / estrella, X descartar, Enter elegir |
| Comparar lado a lado | No verificado en InvokeAI [N] | Muy útil para elegir entre 3-6 intentos; implementarlo propio (2-4 paneles con zoom sincronizado) |
| Masonry | Galerías de Leonardo/Midjourney (no verificado en docs) [N] | Con perfiles de proporciones distintas (1280x512 y 768x768), una rejilla masonry/por filas evita recortes |
| Subir resolución (upscale) | Leonardo/Midjourney (no verificado) [N] | Solo si el perfil final lo exige; coste de otra pasada, baja prioridad |
| Tema oscuro | Comúnmente en todos (no verificado) | Sesiones largas; casi gratis con variables CSS |
| Semillas por lote | Remix/Use Seed de InvokeAI [V] | Reproducir la semilla buena en otro perfil/prompt |

## 2. Flujos de triaje
- Midjourney: Organize con búsqueda/filtro/orden, carpetas con selección múltiple (shift-clic, arrastrar) y Saved Searches; calificación de imágenes en Personalize pasó de pares a "elegir de una rejilla" (docs, artículo antiguo); hotkeys en Style Creator. https://docs.midjourney.com/hc/en-us/articles/33329462451469-Organizing-Your-Creations , https://docs.midjourney.com/hc/en-us/articles/34580542725645-Using-Folders , https://docs.midjourney.com/hc/en-us/articles/41308374558221-Style-Creator , https://docs.midjourney.com/docs/personalization
- InvokeAI: la galería es el centro: estrella para fijar, arrastrar a tableros, menú contextual con Remix/Use Prompt/Use Seed/Send to Canvas. https://invoke.ai/features/gallery/ . Atajos: https://support.invoke.ai/support/solutions/articles/151000170408-keyboard-shortcuts
- Leonardo: generaciones van al feed y a la Library; se elige colección al generar. https://intercom.help/leonardo-ai/en/articles/8942360-how-to-generate-images-using-leonardo-ai
- ComfyUI: trabajo -> Job History (filtros por estado) -> panel Assets. https://docs.comfy.org/interface/job-history , https://docs.comfy.org/interface/assets
- Patrón común: generar muchos -> rejilla -> acción de un gesto (estrella/descartar/mover a tablero) -> lupa/lightbox solo para dudosas. (Síntesis propia; el lightbox de Midjourney no está documentado oficialmente en lo hallado.)

## 3. Recomendación priorizada (cada imagen = ~2 min)
1. Cola persistente con encolado en lote, estado, ETA (media móvil de los últimos tiempos reales), cancelar y reordenar; la UI nunca bloquea mientras se genera. Es lo que más rinde: el tiempo de máquina se solapa con el de revisión.
2. Triaje de un gesto con teclado en la galería (flechas, estrella, descartar, elegir) y lightbox grande; la revisión debe costar segundos para que la espera no se duplique.
3. Estado por intento: nuevo/candidata/descartada/elegida, con una sola "elegida" por (elemento, perfil); filtros por esos estados. Descartar oculta, no borra (por si hay arrepentimiento).
4. Guardar metadatos (prompt, semilla, perfil, modelo, referencias) junto a cada imagen y botones "Reutilizar todo / sin semilla / solo prompt / solo semilla" (modelo InvokeAI).
5. Presets por perfil (sufijo de estilo, tamaño, negativo/alternativa) y prompt heredado del elemento: menos intentos fallidos = menos de 2 min perdidos.
6. Referencias: usar la imagen elegida de la zona como entrada en la criatura (sec. 4); selector de referencia desde la galería.
7. Comparar 2-4 lado a lado con zoom sincronizado.
8. Después: masonry, tema oscuro, tableros extra, inpaint/lienzo, upscale (solo si hace falta).
Nota: Klein usa cfg 1.0 y 4 pasos; un "negative prompt" apenas tiene efecto con cfg 1 (inferencia: con la guía desactivada el negativo no se usa). Alternativa: describir en positivo lo que se quiere y usar el modelo base (cfg 4.0, 20 pasos, mucho más lento) solo si hace falta.

## 4. FLUX.2 Klein: multi-referencia y edición
- BFL: FLUX.2 admite edición por referencias; límite documentado: klein hasta 4 referencias (max/pro/flex 8 por API, dev recomendado 6); klein no incluye "prompt upsampling": escribir prompts largos y descriptivos; salida hasta 4 MP. https://docs.bfl.ai/flux_2
- Klein 4B: Apache 2.0, ~8 GB VRAM; 9B es no comercial; existe la variante 9B-KV que cachea la K/V de las referencias para acelerar edición multi-referencia (hasta 2.5x) -- no aplica a 4B. https://www.stablediffusiontutorials.com/2026/03/flux2-klein-9b-kv.html , https://benchmarklist.com/models/flux.2-klein/
- stable-diffusion.cpp: edición con `-r/--ref-image` + prompt de cambio; klein distilado con `--cfg-scale 1.0 --steps 4 --sampling-method euler`, `--llm` Qwen3 4B para el 4B, VAE flux2_ae; `--offload-to-cpu` en los ejemplos. La página SOLO muestra una referencia; NO documenta varias `-r` ni tiempos/VRAM. https://github.com/leejet/stable-diffusion.cpp/blob/master/docs/flux2.md  -> hay que probar a mano si repetir `-r` funciona en nuestra versión (probar con el binario local; no verificado).
- Aplicación a nosotros (inferencia, a validar): referencia 1 = fondo de zona aprobado; prompt tipo "coloca [criatura descrita] en la escena de la imagen de referencia, manteniendo el fondo". Cada referencia añade tokens/coste: esperar más de 100-200 s; probar a menor tamaño. Si solo funciona una `-r`, flujo en dos pasos o describir el criatura en el prompt.
- Leonardo, como contraste: Style/Character Reference con pesos; https://docs.leonardo.ai/docs/generate-images-using-image-guidance

## Fuentes sin cubrir
Krea, herramientas de pipeline de arte de juegos, lightbox/valoraciones de Midjourney (no documentados oficialmente en lo hallado), compare de InvokeAI, historial de Fooocus.
