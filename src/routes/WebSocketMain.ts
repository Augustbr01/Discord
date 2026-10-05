import type { FastifyPluginAsync } from "fastify";

export const routeWebSocket : (FastifyPluginAsync) = async (fastify) => {

    fastify.addHook('onRequest', async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            return rep.code(400).send("acesso negado");
        }
    })

    fastify.get("/api/websocket", {websocket: true}, async (socket,req) => {
        const usuarioId = req.user.id;

        let vivo = true;

        socket.on("pong", () => {vivo = true});
        
        const hb = setInterval(() => {
            if(!vivo) return socket.terminate();
            vivo = false;
            socket.ping();
        },3000)

        socket.on("close", () => {
            clearInterval(hb);
        })
    })
}