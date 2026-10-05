import type { FastifyPluginAsync } from "fastify";
import { conectar, publicarParaServidor, publicarParaUsuarios } from "./eventosConexao";

export const routeWebSocket : (FastifyPluginAsync) = async (fastify) => {

    fastify.addHook('onRequest', async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            return rep.code(400).send("acesso negado");
        }
    })

    fastify.get("/gateway", {websocket: true}, async (socket,req) => {
        const desconectar = conectar(req.user.id,socket);

        socket.on("close", () => {
            desconectar();
        })
    })
}