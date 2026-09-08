-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "zonaCaminoPendiente" JSONB;

-- AlterTable
ALTER TABLE "ZonePoint" ADD COLUMN     "pasoRuta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ruta" JSONB;
