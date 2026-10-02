import fastify from "fastify"
import {Type, type TypeBoxTypeProvider} from "@fastify/type-provider-typebox"
import { AccessToken, TrackSource } from "livekit-server-sdk"
import { fastifyJwt } from "@fastify/jwt"
import { RotaAuth } from "./routes/Auth"
import oauth2 from "@fastify/oauth2"
import { fastifyCookie } from "@fastify/cookie"
import "dotenv/config"
const {JWT_SECRET,MODO,DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET,LIVEKIT_API_KEY,LIVEKIT_API_SECRET,LIVEKIT_URL} = process.env;

if(!JWT_SECRET || !MODO || !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    throw new Error("FALTANDO .ENV DO APP");
}

const app = fastify().withTypeProvider<TypeBoxTypeProvider>();

app.register(fastifyJwt, {secret:JWT_SECRET, cookie: {cookieName: "authToken",signed:false} ,sign: {expiresIn: "7d"}});

app.register(fastifyCookie, {parseOptions: {path: "/", httpOnly: MODO === "development" ? false : true, sameSite: "lax", maxAge: 3600 * 24 * 7}});


app.get("/livekit/token", {schema: {querystring: Type.Object({sala: Type.String({default: "teste"}),nome: Type.String({minLength: 1})})}},async (req,rep) => {
    const {sala, nome} = req.query;

    const at = new AccessToken(LIVEKIT_API_KEY,LIVEKIT_API_SECRET, {identity: nome});

    at.addGrant({roomJoin:true,room: sala, canPublish: true,canSubscribe: true,canPublishSources:[TrackSource.CAMERA,TrackSource.MICROPHONE]});


    return rep.send({token: await at.toJwt(), url: LIVEKIT_URL});
})                                                      

app.register(RotaAuth, {prefix: "/api"})

app.register(oauth2, {
    name:"discord",
    scope:["identify","email"],
    credentials: {
        client: {
            id: DISCORD_CLIENT_ID,
            secret: DISCORD_CLIENT_SECRET
        },
        auth: oauth2.DISCORD_CONFIGURATION
    },
    startRedirectPath: "/api/auth/discord",
    callbackUri: MODO === "development" ? "http://localhost:3000/api/auth/callback" : "https://discord.phelipedev.com.br/api/auth/callback"
})


app.listen({port:3000}, (error) => {
    console.log("ligou");
    if(error) {
        console.log(error);
    }
})