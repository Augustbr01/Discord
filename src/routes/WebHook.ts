import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { receiver } from "../config/WebWookConfig";
import {prisma} from "../../lib/prisma"
import { entrouNaCall, mudarTela, participantesDaCall, saiuDaCall } from "../eventosCall";
import { estadoYoutube, limparYoutube } from "../youtube";
import { estadoSala, limparSala } from "../controleSala";
import { publicarParaServidor } from "./eventosConexao";
import { ehSalaDoHall } from "../sincronizarCalls";
import { statusTela } from "../interface/Evento";
import { TrackSource } from "livekit-server-sdk";
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

        if(!canalId || !usuarioId) return rep.code(200).send({mensagem:"INVALIDA"});
        // call do hall do mundo 3D: não é um canal (e não aparece pra quem está fora do 3D)
        if(ehSalaDoHall(canalId)) return rep.code(200).send();

        const servidor = await prisma.servidor.findFirst({where: {canais: {some: {id: canalId}}},select: {id:true}});

        if(!servidor) {
            return rep.code(200).send();
        }

        if(evento.event === "participant_joined") {
            entrouNaCall(canalId,usuarioId);
            await publicarParaServidor(servidor?.id,{tipo:"ENTROU_NA_CALL",canalId:canalId,usuarioId:usuarioId})
        }

        if(evento.event === "participant_left") {
            saiuDaCall(canalId,usuarioId);
            await publicarParaServidor(servidor?.id, {tipo:"SAIU_DA_CALL",canalId:canalId,usuarioId:usuarioId})

            // a call esvaziou: o vídeo e a fila do YouTube junto vão embora com ela
            if(participantesDaCall(canalId).length === 0 && limparYoutube(canalId)) {
                await publicarParaServidor(servidor.id,{tipo:"YT_ESTADO",agora:Date.now(),estado:estadoYoutube(canalId)});
            }
            // e o controle da sala volta ao padrão
            if(participantesDaCall(canalId).length === 0 && limparSala(canalId)) {
                await publicarParaServidor(servidor.id,{tipo:"SALA_ESTADO",estado:estadoSala(canalId)});
            }
        }

        const ehTela = evento.track?.source === TrackSource.SCREEN_SHARE;

        if(evento.event === "track_published" && ehTela) {
            mudarTela(canalId,usuarioId,true);
            await publicarParaServidor(servidor.id,{tipo:"TELA",canalId:canalId,usuarioId:usuarioId,statusTela:statusTela.ABRIU});
        }

        if(evento.event === "track_unpublished" && ehTela) {
            mudarTela(canalId,usuarioId,false);
            await publicarParaServidor(servidor.id,{tipo:"TELA",canalId:canalId,usuarioId:usuarioId,statusTela:statusTela.FECHOU});
        }

        return rep.code(200).send();
    })
}