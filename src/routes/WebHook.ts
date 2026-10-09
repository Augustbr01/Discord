import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { receiver } from "../config/WebWookConfig";
import { conferirSala, ehSalaDoHall } from "../sincronizarCalls";
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
        if(!canalId) return rep.code(200).send({mensagem:"INVALIDA"});
        // call do hall do mundo 3D: não é um canal (e não aparece pra quem está fora do 3D)
        if(ehSalaDoHall(canalId)) return rep.code(200).send();

        // entrou, saiu, abriu/fechou a tela: lê a sala no LiveKit e aplica a foto (ver
        // sincronizarCalls). Somar os eventos errava com eles fora de ordem ou repetidos
        const eventosDaCall = ["participant_joined", "participant_left", "track_published", "track_unpublished", "room_finished"];
        if (eventosDaCall.includes(evento.event)) conferirSala(canalId);

        return rep.code(200).send();
    })
}