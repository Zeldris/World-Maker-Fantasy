# Todo lo que se mueve viaja de verdad por el mapa

Como en X4: Foundations, nada que se desplace en el mundo se resuelve «por detrás» con días y una
tirada. Expediciones, caravanas, partidas de caza o captura, patrullas, refugiados, mensajeros o
visitantes son **viajeros**: siguen una ruta real de zona en zona (los enlaces entre lugares y, dentro
de cada zona, sus celdas), avanzan cada día por ella y están donde están. La jugadora puede cruzarse
con ellos en el mapa e interactuar: preguntarles por las regiones que han atravesado, comerciar,
escoltarlos, asaltarlos o dejarlos pasar; y lo que les ocurra por el camino (un asalto, una pelea con
fauna) pasa en el sitio donde estén, en vivo si ella está y de fondo si no ([ADR 0002](0002-dos-formas-de-combate.md)).

Decisión (usuaria, 2026-10-07, ronda de `CR-61`/`CR-63`). Se descarta lo que existía: viajes abstractos
con día de salida y de vuelta y un riesgo tirado al llegar, visibles solo como una banderita entre dos
nodos del mapa de Berig. La auditoría de lo que hoy es invisible y su paso a viajeros está en `CR-64`.
