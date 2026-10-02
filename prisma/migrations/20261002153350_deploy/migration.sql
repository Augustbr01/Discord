-- CreateEnum
CREATE TYPE "TipoCanal" AS ENUM ('TEXTO', 'VOZ');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "discordId" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "entrou_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servidor" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "iconeUrl" TEXT,
    "donoId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Servidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Canal" (
    "id" UUID NOT NULL,
    "servidorId" UUID NOT NULL,
    "nome" VARCHAR(50) NOT NULL,
    "tipo" "TipoCanal" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Canal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_discordId_key" ON "Usuario"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_nome_key" ON "Usuario"("nome");

-- AddForeignKey
ALTER TABLE "Servidor" ADD CONSTRAINT "Servidor_donoId_fkey" FOREIGN KEY ("donoId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canal" ADD CONSTRAINT "Canal_servidorId_fkey" FOREIGN KEY ("servidorId") REFERENCES "Servidor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
