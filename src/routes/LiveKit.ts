import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { AccessToken, TrackSource } from "livekit-server-sdk"
import {prisma} from "../../lib/prisma"
export const LiveKit: (FastifyPluginAsyncTypebox) = async (fastify) => {

    fastify.addHook('onRequest', async (req,rep) => {
        try {
            await req.jwtVerify();
        } catch(e) {
            rep.code(400).send({mensagem:"Sem autorização"});
        }
    })

    const {LIVEKIT_API_KEY,LIVEKIT_API_SECRET,LIVEKIT_URL} = process.env;

    if(! LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
        throw new Error("LIVEKIT.TS SEM .ENV");
    }

fastify.get("/livekit/token", { schema: { querystring: Type.Object({ salaId: Type.String({})}) } }, async (req, rep) => {
    const { salaId} = req.query;
    const idUsuario = req.user.id;

    const sala = prisma.servidor

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity: idUsuario });

    at.addGrant({ roomJoin: true, room: salaId, canPublish: true, canSubscribe: true});

    return rep.code(200).send({ token: await at.toJwt(), url: LIVEKIT_URL });
    })
}         