import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { receiver } from "../config/WebWookConfig";
import {prisma} from "../../lib/prisma"
import { entrouNaCall, saiuDaCall } from "../eventos";
export const routeHook : (FastifyPluginAsyncTypebox) = async (fastify) => {
    fastify.post("/livekit/webhook", async (req,rep) => {
        console.log("entrou");
        let evento;
        try {
            evento = await receiver.receive(req.body as string,req.headers.authorization);
        }catch(e) {
            console.log(e);
            return rep.code(400).send({mensagem:"ASSINATURA LIVEKIT INVÁLIDA"});
        }

        const canalId = evento.room?.name;
        const usuarioId = evento.participant?.identity;

        if(!canalId || !usuarioId) return rep.code(404).send({mensagem:"INVALIDA"});

        const {room,participant} = evento;

        if(evento.event === "participant_joined") {
            entrouNaCall(room?.name!,participant?.identity!);
        }

        if(evento.event === "participant_left") {
            saiuDaCall(room?.name!,participant?.identity!);
        }
    })
}