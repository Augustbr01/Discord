/*
  Warnings:

  - You are about to drop the `Canal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Servidor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Usuario` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Canal" DROP CONSTRAINT "Canal_servidorId_fkey";

-- DropForeignKey
ALTER TABLE "Servidor" DROP CONSTRAINT "Servidor_donoId_fkey";

-- DropTable
DROP TABLE "Canal";

-- DropTable
DROP TABLE "Servidor";

-- DropTable
DROP TABLE "Usuario";

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "discordId" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "avatarUrl" TEXT NOT NULL,
    "email" TEXT,
    "entrou_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servidores" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "iconeUrl" TEXT,
    "donoId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canais" (
    "id" UUID NOT NULL,
    "servidorId" UUID NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "tipo" "TipoCanal" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canais_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_discordId_key" ON "usuarios"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nome_key" ON "usuarios"("nome");

-- AddForeignKey
ALTER TABLE "servidores" ADD CONSTRAINT "servidores_donoId_fkey" FOREIGN KEY ("donoId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canais" ADD CONSTRAINT "canais_servidorId_fkey" FOREIGN KEY ("servidorId") REFERENCES "servidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
