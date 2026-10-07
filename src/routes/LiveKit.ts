import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AccessToken, TrackSource } from "livekit-server-sdk"
import {prisma} from "../../lib/prisma"
import { TipoCanal } from "../../generated/prisma/enums";
export const LiveKit: (FastifyPluginAsyncTypebox) = async (fastify) => {

    fastify.addHook('onRequest', async (req,rep) => {
        try {
            await req.jwtVerify();
        } catch(e) {
            return rep.code(400).send({mensagem:"Sem autorização"});
        }
    })

    const {LIVEKIT_API_KEY,LIVEKIT_API_SECRET,LIVEKIT_URL} = process.env;

    if(! LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
        throw new Error("LIVEKIT.TS SEM .ENV");
    }

fastify.get("/livekit/token", { schema: { querystring: Type.Object({ salaId: Type.Optional(Type.String({})), hall: Type.Optional(Type.String({})) }) } }, async (req, rep) => {
    const { salaId, hall } = req.query;
    const idUsuario = req.user.id;

    // call do hall do mundo 3D: uma por servidor (hall + corredor), pra quem é membro.
    // Não é um canal: não aparece na lista de canais de quem está fora do 3D
    if(hall) {
        const membro = await prisma.usuarioServidor.findUnique({where: {usuarioId_servidorId: {usuarioId:idUsuario,servidorId:hall}},select: {usuario: {select: {nome:true}}}});
        if(!membro) return rep.code(400).send({mensagem:"Sem permissão!"});
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: idUsuario, name: membro.usuario.nome });
        at.addGrant({ roomJoin: true, room: `hall-${hall}`, canPublish: true, canSubscribe: true });
        return rep.code(200).send({ token: await at.toJwt(), url: LIVEKIT_URL });
    }
    if(!salaId) return rep.code(400).send({mensagem:"Falta a sala"});

    const sala = await prisma.canal.findFirst({where: {id:salaId,tipo: TipoCanal.VOZ, servidor: {membros: {some: {usuarioId: idUsuario}}}},select: {id:true, servidor: {select: {membros: {where: {usuarioId:idUsuario}, select: {usuario: {select: {nome: true}}}}}}}});

    if(!sala || !sala.servidor.membros[0]?.usuario) {
        return rep.code(400).send({mensagem:"Sem permissão!"});
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: idUsuario,name: sala.servidor.membros[0].usuario.nome});

    at.addGrant({ roomJoin: true, room: sala.id, canPublish: true, canSubscribe: true});

    return rep.code(200).send({ token: await at.toJwt(), url: LIVEKIT_URL });
    })
}         