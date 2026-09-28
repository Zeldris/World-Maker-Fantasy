-- B28 (pruebas en la nube 2026-09-28): el arquetipo fijo del personaje predefinido decía
-- "Guerrero superviviente..." aunque la clase elegida fuera otra (Cazador, Chamán...) — se veía en
-- la cabecera de Estadísticas y le llegaba al narrador. El arquetipo pasa a ser neutro de clase;
-- la clase real vive en "Save.clase".
UPDATE "Save"
SET "characterArchetype" = 'Superviviente del clan Maktor (Orco)'
WHERE "characterArchetype" = 'Guerrero superviviente del clan Maktor (Orco)';
