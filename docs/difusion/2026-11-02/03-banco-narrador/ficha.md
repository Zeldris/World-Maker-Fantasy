# Ficha: banco del narrador (2026-11-02)

La fuente de todo lo que se publica de esta pieza. Lo que no esté aquí, con su fuente, no sale en los canales.
Carpeta de la pieza: `docs/difusion/2026-11-02/03-banco-narrador/` (NN = número de la pieza del día).

Idiomas: es, en

## Canales

- x
- reddit
- linkedin

## Qué se cuenta

- **En una frase (quien lo usa):** el narrador de Tarkor sigue siendo Llama 3.1 8B: probamos tres modelos más nuevos y
  pequeños y ninguno lo mejoró; el más rápido, Gemma 4 e2b, recorta cada turno unos 10 segundos pero narra peor.
- **En una frase (técnico):** banco de calidad con juicio a ciegas en los dos órdenes (consistencia del juez 0,939):
  Llama 3.1 8B saca una tasa de victorias de 0,727 frente a 0,500, 0,394 y 0,379; Gemma 4 e2b baja el turno p50 de
  29,3 s a 18,8 s con la misma RAM.
- **Estado:** cerrado y fusionado; los tres candidatos se rechazaron y los modelos de prueba se borraron de la Deck.
  Es una comparación pequeña (11 situaciones, un prompt), no un ranking general de modelos.

## Hechos comprobados

| Dato | Fuente |
|---|---|
| Tasa de victorias (juicio a ciegas, los dos órdenes): narrador actual 0,727; Gemma 4 e2b 0,500; Qwen 3.5 4B 0,394; Gemma 3 4B 0,379 | `docs/registros/pr/claude/banco-narrador.md:6-10` |
| Consistencia del juez al invertir el orden: 0,939 (el método exige un mínimo de 0,6) | `banco-narrador.md:6`; `docs/scout/informes/2026-10-21.md:47` |
| Gemma 4 e2b es más rápido: turno p50 de 18,8 s frente a 29,3 s, con la misma RAM | `banco-narrador.md:8`; la cifra de 29,3 s es la del narrador actual: informe, línea 160 |
| La latencia se midió en una Steam Deck, con 7 turnos que cuentan de 8 (uno quedó bloqueado por el juego) | informe, líneas 156-168 |
| Los tres candidatos se rechazaron y los modelos de prueba están borrados de la Deck | `banco-narrador.md:3`; informe, línea 185 |
| El narrador actual (`tarkor-narrador-llama31`) es Llama 3.1 8B, cuantizado a 4 bits (Q4_K_M) | informe, línea 4 y tabla de disco (`llama3.1:8b-instruct-q4_K_M`); `docs/arquitectura/04-decisiones-tecnicas.md:10` |
| Los candidatos: Gemma 3 4B, Qwen 3.5 4B y Gemma 4 e2b (cuantizaciones de 4 bits) | informe, tabla de disco (líneas 143-147) |
| 11 situaciones de juego (escena, discurso, combate con tirada fijada de éxito o de fallo, viaje, descanso, órdenes al reino…) y 132 juicios | informe, líneas 16-38 |
| Mismas opciones para los cuatro: mismo SYSTEM, temperatura 0,7 y contexto de 8192 | informe, líneas 33-37 |
| Los jueces fueron dos subagentes de Claude, sin acceso a la clave de qué modelo escribió cada texto | informe, líneas 38-40 |
| Un par cuyo ganador cambia al invertir el orden cuenta como empate; un empate vale 0,5 | `banco-narrador.md:34`; informe, líneas 65-66 |
| Gemma 4 e2b pierde dos de cada tres comparaciones directas con el actual (0,32) | informe, línea 8 y cara a cara; recomendación (línea 183) |
| Entre Gemma 3 y Qwen 3.5 la diferencia es de menos de 0,15: ese orden es ruido; el método fija el ruido en ~0,15 | informe, línea 62 y líneas 8-9 |
| El fallo más común de todos los modelos, también del actual, es del prompt y no del modelo | informe, líneas 10-11 y «Fallo común» |
| Plan (no hecho): repetir el banco cuando el prompt cambie | informe, líneas 185-189 |
| El repo es público | `https://github.com/Zeldris/World-Maker-Fantasy` |

## Reddit

- **Perfil:** u/Alvaro-Garcia-Grana

## Imágenes

| Imagen | Texto alternativo | Canales |
|---|---|---|
| `medios/metricas.webp` | es: Barras con la tasa de victorias de cuatro modelos narradores: Llama 3.1 8B (el actual) 0,727; Gemma 4 e2b 0,500; Qwen 3.5 4B 0,394; Gemma 3 4B 0,379; y el turno p50, 29,3 s con Llama 3.1 y 18,8 s con Gemma 4 e2b / en: Bars with the win rate of four narrator models: Llama 3.1 8B (current) 0.727; Gemma 4 e2b 0.500; Qwen 3.5 4B 0.394; Gemma 3 4B 0.379; and the p50 turn time, 29.3 s with Llama 3.1 and 18.8 s with Gemma 4 e2b | x, reddit |
| `medios/metricas.en.webp` | en: Bars with the win rate of four narrator models: Llama 3.1 8B (current) 0.727; Gemma 4 e2b 0.500; Qwen 3.5 4B 0.394; Gemma 3 4B 0.379; and the p50 turn time, 29.3 s with Llama 3.1 and 18.8 s with Gemma 4 e2b | x, reddit |
| `medios/metricas.png` | es: Barras con la tasa de victorias de cuatro modelos narradores: Llama 3.1 8B (el actual) 0,727; Gemma 4 e2b 0,500; Qwen 3.5 4B 0,394; Gemma 3 4B 0,379; y el turno p50, 29,3 s con Llama 3.1 y 18,8 s con Gemma 4 e2b / en: Bars with the win rate of four narrator models: Llama 3.1 8B (current) 0.727; Gemma 4 e2b 0.500; Qwen 3.5 4B 0.394; Gemma 3 4B 0.379; and the p50 turn time, 29.3 s with Llama 3.1 and 18.8 s with Gemma 4 e2b | linkedin |
| `medios/metricas.en.png` | en: Bars with the win rate of four narrator models: Llama 3.1 8B (current) 0.727; Gemma 4 e2b 0.500; Qwen 3.5 4B 0.394; Gemma 3 4B 0.379; and the p50 turn time, 29.3 s with Llama 3.1 and 18.8 s with Gemma 4 e2b | linkedin |

Fuentes en `medios/fuente/` (`metricas.html` y `metricas.en.html`, 1600×900, paleta del Portal, barras a escala 0-1);
se renderizan con `node .claude/skills/gw-media-content/scripts/render.mjs docs/difusion/2026-11-02/03-banco-narrador`.

## Uso interno

Propuesta P3 de `docs/difusion/propuestas/2026-11-02.md`. Banco `QA-176`, PR en `docs/registros/pr/claude/banco-narrador.md`,
informe en `docs/scout/informes/2026-10-21.md` (propuestas P-005, P-006 y P-007, rechazadas el 2026-10-21).
Las líneas del informe que se citan arriba dan detalle que `banco-narrador.md` no trae (11 situaciones, 132 juicios,
quién juzgó, 7 turnos medidos, ruido de ~0,15): si la usuaria prefiere no publicarlos, se quitan de los textos.
`banco-narrador.md` no dice «Llama 3.1» con todas las letras (pone `llama31`); el nombre completo sale del informe.

## Publicado

| Canal | Idioma | Fecha | Enlace |
|---|---|---|---|
