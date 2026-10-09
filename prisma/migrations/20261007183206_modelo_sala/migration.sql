-- CreateEnum
CREATE TYPE "ModeloSala" AS ENUM ('PADRAO', 'CINEMA');

-- AlterTable
ALTER TABLE "canais" ADD COLUMN     "modelo" "ModeloSala" NOT NULL DEFAULT 'PADRAO';
