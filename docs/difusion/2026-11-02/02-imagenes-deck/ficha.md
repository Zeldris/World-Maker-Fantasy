# Ficha: banco de imágenes local en una Steam Deck (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/02-imagenes-deck/` (NN = número de la pieza del día).

Idiomas: es, en

## Canales

- x
- reddit
- linkedin

## Qué se cuenta

- **En una frase (quien lo usa):** quien genera imágenes con IA en local puede comparar sus tiempos y ajustes con
  siete rondas medidas en una Steam Deck: lo que más acercó el resultado a los banners de ChatGPT fue el texto de
  estilo del prompt, no el modelo ni el VAE.
- **En una frase (técnico):** banco de calidad por rondas (una palanca cada vez, mismo prompt y semilla) para un
  banner de 1280x512 con FLUX.2 klein y Z-Image-Turbo: klein Q8 + estilo `cine2`, euler, 6 pasos y VAE pequeño dan
  ~2,5 min; Z-Image-Turbo es más fiel en fauna pero tarda ~6-7 min.
- **Estado:** en curso, no cerrado. Rondas 1-7 hechas el 2026-10-25; falta fijar el perfil por defecto y leer más con
  Z-Image. Se cuenta como banco de pruebas, no como función terminada.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Configuración ganadora: klein Q8 + estilo `cine2` con polvo mate, euler, 6 pasos, VAE pequeño, ~2,5 min por banner; aguanta con otras semillas | `docs/registros/pr/claude/plan-imagenes.md:20`; `docs/producto/plan-imagenes/banco/resultados.md` (r3, r6, r7) |
| Lo que más acerca a ChatGPT es el texto de estilo, no el modelo | `docs/registros/pr/claude/plan-imagenes.md:20`; `docs/producto/roadmap-imagenes.md:52` |
| El punto de partida: la calidad del generador local, comparada con la de los banners hechos con ChatGPT, seguía siendo muy mala (la usuaria, 2026-10-25) | `docs/producto/roadmap-imagenes.md:52` |
| Siete rondas el 2026-10-25, semilla 3, banner de 1280x512, en la Steam Deck; el banco se lanza por rondas con un script | `docs/producto/plan-imagenes/banco/resultados.md` (cabecera, r1…r7); `docs/producto/roadmap-imagenes.md:52` |
| El VAE completo tarda 41 s en decodificar frente a 22 s del pequeño y a la vista es igual (a 200 %, PSNR 29-34 dB) | `docs/producto/plan-imagenes/banco/resultados.md`, r1 |
| El codificador de texto en Q8 tarda lo mismo (~2,6 min) y no mejora claramente | `docs/producto/plan-imagenes/banco/resultados.md`, r2 |
| `cine2` (cielo ámbar/carmesí saturado, polvo encendido a contraluz, borde de luz) es el estilo más cercano a ChatGPT; `cine` era luz dorada dramática y gradación cálida | `docs/producto/plan-imagenes/banco/resultados.md`, r3 |
| Z-Image-Turbo Q4: ~6 min, más fiel en fauna, más blando y pictórico; en Q6, ~7 min y casi la misma imagen (la blandura es del modelo, no de la cuantización) | `docs/producto/plan-imagenes/banco/resultados.md`, r4 y r5; `docs/registros/pr/claude/plan-imagenes.md:20` |
| dpm++2m y res_multistep, prácticamente iguales a euler; er_sde cambia la composición al azar; euler con 9 pasos igual que con 6 y un 40 % más lento | `docs/producto/plan-imagenes/banco/resultados.md`, r6 |
| Con las semillas 7 y 11 la configuración aguanta; la longitud de los colmillos de una criatura depende de la semilla, no del texto; conviene generar 2-3 semillas y elegir | `docs/producto/plan-imagenes/banco/resultados.md`, r7 |
| Primer banco: 12 pasos ≈ 6 pasos (el doble de tiempo); hires fix, más blando y peor; klein-base con cfg 3,5 y 20 pasos, 15 min, sobresaturado y no mejor | `docs/producto/roadmap-imagenes.md:52`; `docs/producto/plan-imagenes/banco/resultados.md` (cabecera) |
| Qué queda: leer pastos con Z-Image Q6, fijar el perfil por defecto y decidir cómo seguir | `docs/producto/roadmap-imagenes.md:52` |
| La comparación es a ojo (salvo el PSNR del VAE) y de una semilla casi siempre | `docs/producto/plan-imagenes/banco/resultados.md` |

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/metricas.webp` | es: Tarjeta de métricas: 2,5 min por banner con la configuración ganadora (klein Q8, 6 pasos) frente a ~6 min de Z-Image Q4, ~7 min de Z-Image Q6 y 15 min de klein-base, en una Steam Deck / en: Metrics card: 2.5 min per banner with the winning setup (klein Q8, 6 steps) versus ~6 min for Z-Image Q4, ~7 min for Z-Image Q6 and 15 min for klein-base, on a Steam Deck | x, reddit |
| `medios/metricas.en.webp` | en: Metrics card: 2.5 min per banner with the winning setup (klein Q8, 6 steps) versus ~6 min for Z-Image Q4, ~7 min for Z-Image Q6 and 15 min for klein-base, on a Steam Deck | x, reddit |
| `medios/metricas.png` | es: Tarjeta de métricas: 2,5 min por banner con la configuración ganadora (klein Q8, 6 pasos) frente a ~6 min de Z-Image Q4, ~7 min de Z-Image Q6 y 15 min de klein-base, en una Steam Deck / en: Metrics card: 2.5 min per banner with the winning setup (klein Q8, 6 steps) versus ~6 min for Z-Image Q4, ~7 min for Z-Image Q6 and 15 min for klein-base, on a Steam Deck | linkedin |
| `medios/metricas.en.png` | en: Metrics card: 2.5 min per banner with the winning setup (klein Q8, 6 steps) versus ~6 min for Z-Image Q4, ~7 min for Z-Image Q6 and 15 min for klein-base, on a Steam Deck | linkedin |

Sin imágenes generadas del banco (no están en git).

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Uso interno

Lo que sirve al equipo y no se publica: ids de tareas, ramas, PRs y notas. Nada de esto va en los canales.

- Tarea `IMG-15` (hito 0.4, en curso, 🚧). La propuesta citaba `roadmap-imagenes.md:58`; la entrada está en la línea 52.
- Fuente de las imágenes: `medios/fuente/metricas.html` y `metricas.en.html` (plantilla `metricas` de la skill con la
  paleta del Portal, 1600x900). Datos de las barras: ~2,5 (klein Q8), ~6 (Z-Image Q4), ~7 (Z-Image Q6) y 15
  (klein-base, cfg 3,5, 20 pasos) minutos por banner.
- Los banners de ChatGPT de referencia (`backend/uploads/images/`) y las imágenes del banco (`image-generator/generated/banco/`)
  no están en git: no se usan.
- Antes de publicar en Reddit: poner un enlace al repo solo al final; el perfil ya publicó que el código es público.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
