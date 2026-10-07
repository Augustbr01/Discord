import { RecordPattern, Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { MultipartFile } from "@fastify/multipart";
import { r2 } from "../config/R2Config";
import fastify from "fastify";
import sharp from "sharp";
import { devolverAvatarUrl } from "../config/DevolverFotoUrl";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "../../lib/prisma";

const arquivoImagem = Type.Unsafe<MultipartFile>(
    Type.Object({
        type: Type.Literal("file"),
        mimetype: Type.Union([
            Type.Literal("image/png"),
            Type.Literal("image/gif"),
            Type.Literal("image/jpeg"),
            Type.Literal("image/webp")
        ])
    })
)

const {R2_BUCKET,R2_URL} = process.env;

if(!R2_BUCKET || !R2_URL) {
    throw new Error("ERROR");
}

export const imagemRotas : (FastifyPluginAsyncTypebox) = async (fastify) => {

    fastify.addHook('onRequest', async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            rep.code(401).send({mensagem:"Acesso não autorizado!"});
        }
    })

    fastify.post("/atualizar/imagem", {config: {rateLimit: {timeWindow: "240 minute", max: 1}},schema: {consumes: ["multipart/form-data"],body: Type.Object({avatar:arquivoImagem})}} ,async (req,rep) => {
        const idUsuario = req.user.id;
        const buffer = await req.body.avatar.toBuffer();
        let webp : Buffer;
        try {
            webp = await sharp(buffer, {animated:true}).rotate().resize(256,256,{fit:"cover"}).webp({quality:80}).toBuffer();
        }catch(e) {
            return rep.code(400).send({mensagem:"Arquivo não é uma imagem válida!"});
        }
            
            const chave = `avatars/${idUsuario}.webp`;

            const date = Date.now();

            try {
                await r2.send(new PutObjectCommand({Bucket:R2_BUCKET,Key:chave,Body:webp,ContentType: "image/webp"}));
                const entidadeUp = await prisma.usuario.update({where: {id:idUsuario},data: {avatarUrl:`${R2_URL}${chave}?v=${date}`},select: {id:true,nome:true,avatarUrl:true}});
                return rep.code(201).send(entidadeUp);
            }catch(e) {
                return rep.code(500).send({mensagem:"Ocorreu um erro ao atualizar a imagem!"});
            }
    })

    fastify.post("/excluir/imagem", async (req,rep) => {
        const idUsuario = req.user.id;

        const chave = `avatars/${idUsuario}.webp`

        try {
            await r2.send(new DeleteObjectCommand({Bucket:R2_BUCKET,Key:chave}));
        }catch(e) {
            return rep.code(400).send({mensagem:"Ocorreu um erro ao excluir a foto!"});
        }

        try {
            const entidade = await prisma.usuario.update({where:{id:idUsuario,avatarUrl: {startsWith: R2_URL}},data: {avatarUrl: devolverAvatarUrl()},select: {id:true,nome:true,avatarUrl:true}});
            return rep.code(200).send(entidade);
        }catch(e) {
            return rep.code(400).send({mensagem:"Falha ao atualizar!"});
        }
    })
}