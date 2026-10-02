import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {prisma} from "../../lib/prisma"
export const RotaAuth : FastifyPluginAsyncTypebox = async (fastify) => {

    const {MODO} = process.env;

    if(!MODO) {
        throw new Error("AUTH.TS SEM .ENV");
    }

    fastify.addHook("onRequest", async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            return rep.code(400).send({mensagem:"Erro ao validar usuário"});
        }
    })

    fastify.get("/dataUser", async (req,rep) => {
        const idUsuario = req.user.id;

        const entidade = await prisma.usuario.findUnique({where: {id:idUsuario},select: {id:true,nome:true,avatarUrl:true}});

        if(!entidade) {
            return rep.code(401).send({mensagem:"Não foi possível buscar dados do usuário"})
        }

        return rep.code(200).send(entidade);
    })

    fastify.post("/logout", async (req,rep) => {
        rep.code(204).clearCookie("authToken", {path:"/"}).redirect("/");
    })
}