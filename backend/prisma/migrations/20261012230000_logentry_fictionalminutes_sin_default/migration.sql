-- P87 (QA-27): sin valor por defecto, toda entrada del diario lleva su minuto de ficción.
ALTER TABLE "LogEntry" ALTER COLUMN "fictionalMinutes" DROP DEFAULT;
