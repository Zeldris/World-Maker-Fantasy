# Checklist — revisión de las dos partidas reales (2026-08-26)

Hallazgos de revisar las partidas `cms82odjc...` (pausada) y `cmt95ns3f...` (en curso), jugadas antes
de aplicar el checklist de las 3 auditorías del 2026-08-25. Detalle completo de cada uno en
`revisar-partida-hallazgos.md` § "2026-08-26 — revisión de las dos partidas reales tras el checklist
de las 3 auditorías".

- [x] 1. "Ataque Básico" pega el nombre del enemigo pegado a "...mano principal" — commit pendiente
  (frontend, `useCombatFlow.ts` + test nuevo en `useCombatFlow.test.tsx`)
- [x] 2. Partida "Gorhorn" duplicada al crear personaje (React StrictMode monta el efecto dos veces)
  — commit pendiente (frontend, `GameView.tsx`, `creatingSaveRef`)
- [ ] 3. Combate real sin narración contra Quio + narración de "huir" que contradice el propio
  estado persistido — PENDIENTE, causa raíz sin confirmar al 100%, necesita reproducción
  instrumentada antes de tocar el motor de combate. El más serio de los 4.
- [x] 4. Dos ejemplos nuevos de "errores gramaticales sueltos del modelo" ("lame", "cortejar la luz
  del sol") — solo documentados, mismo criterio que el resto de esa familia (sin corrector genérico)

**No incluido aquí**: la petición de rediseñar CONVALECIENTE (capturar/matar/dejar vivir, ya no
victoria automática) — anotada en `docs/21-roadmap.md`, a desarrollar cuando se cierre este checklist.
