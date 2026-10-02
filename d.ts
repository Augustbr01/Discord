import type { OAuth2Namespace } from "@fastify/oauth2";
import type { FastifyJWT } from "@fastify/jwt";
declare module "fastify" {
    interface FastifyInstance {
        discord : OAuth2Namespace
    }
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: {
            id: string
        },
        user: {
            id: string
        }
    }
}