-- CreateEnum
CREATE TYPE "Permissao" AS ENUM ('MEMBRO', 'ADMIN');

-- CreateTable
CREATE TABLE "usuario_servidor" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "servidorId" UUID NOT NULL,
    "permissao" "Permissao" NOT NULL DEFAULT 'MEMBRO',
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_servidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convites" (
    "id" UUID NOT NULL,
    "servidorId" UUID NOT NULL,
    "criadoPorId" UUID NOT NULL,
    "expiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" UUID NOT NULL,
    "canalId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "conteudo" VARCHAR(200) NOT NULL,
    "editadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuario_servidor_servidorId_idx" ON "usuario_servidor"("servidorId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_servidor_usuarioId_servidorId_key" ON "usuario_servidor"("usuarioId", "servidorId");

-- CreateIndex
CREATE INDEX "mensagens_canalId_criadoEm_idx" ON "mensagens"("canalId", "criadoEm");

-- CreateIndex
CREATE INDEX "canais_servidorId_idx" ON "canais"("servidorId");

-- AddForeignKey
ALTER TABLE "usuario_servidor" ADD CONSTRAINT "usuario_servidor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_servidor" ADD CONSTRAINT "usuario_servidor_servidorId_fkey" FOREIGN KEY ("servidorId") REFERENCES "servidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_servidorId_fkey" FOREIGN KEY ("servidorId") REFERENCES "servidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convites" ADD CONSTRAINT "convites_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_canalId_fkey" FOREIGN KEY ("canalId") REFERENCES "canais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
