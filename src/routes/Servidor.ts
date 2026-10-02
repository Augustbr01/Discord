import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {prisma} from "../../lib/prisma"
export const RotasServidor : (FastifyPluginAsyncTypebox) = async (fastify) => {

    fastify.addHook("onRequest", async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            rep.code(404).send({mensagem:"ERRO AO VALIDAR USUÁRIO"});
        }
    })

    fastify.post("/servidor/criar", {schema: {body: Type.Object({nomeServidor:Type.String({minLength: 1, maxLength: 100})})}} ,async (req,rep) => {
        const idUsuario = req.user.id;
        const {nomeServidor} = req.body;
        const entidade = await prisma.servidor.create({
            data: {
                nome: nomeServidor,
                donoId: idUsuario,
                membros: {
                    create: {
                        usuarioId: idUsuario,
                        permissao: "ADMIN"
                    }
                },
                canais: {
                    create: [
                        {nome: "Geral", tipo: "TEXTO"},
                        {nome:"Geral", tipo:"VOZ"}
                    ]
                }
            },
            select: {
                id:true,
                nome: true,
                iconeUrl:true
            }
        })

        if(!entidade) {
            return rep.code(400).send({mensagem:"Erro ao criar servidor"});
        }

        return rep.code(200).send(entidade);
    })

    fastify.get("/servidor/listar", async (req,rep) => {
        const idUsuario = req.user.id;

        const entidades = await prisma.servidor.findMany({where: {membros: {some: {usuarioId:idUsuario}}},select: {
            id:true,
            nome: true,
            iconeUrl:true
        },orderBy: {criadoEm: "asc"}});

        return rep.code(200).send(entidades);
    })

    fastify.get("/servidor/:id", {schema: {params: Type.Object({id:Type.String()})}} ,async (req,rep) => {
        const {id} = req.params;
        const idUsuario = req.user.id;

        const entidade = await prisma.servidor.findUnique({where:{id:id, membros: {some: {usuarioId:idUsuario,servidorId:id}}},select: {
            iconeUrl:true,
            id:true,
            nome:true,
            dono: {
                select: {
                    id: true,
                    nome:true,
                    avatarUrl:true
                }
            },
            membros: {
                select: {
                    permissao: true,
                    usuario: {
                        select: {
                            id:true,
                            nome:true,
                            avatarUrl:true
                        }
                    }
                },
                orderBy: {entrouEm: "asc"}
            },
            canais: {
                select: {
                    id:true,
                    nome:true,
                    tipo: true,
                },
                orderBy: {criadoEm: "asc"}
            }
        }});

        if(!entidade) {
            return rep.code(404).send({mensagem:"Erro ao buscar servidor!"});
        }

        return rep.code(200).send(entidade);
    })

    fastify.post("/servidor/convite-criar", {schema: {body: Type.Object({idServidor:Type.String(),expiraEm:Type.Optional(Type.Number())})}} ,async (req,rep) => {
        const {idServidor,expiraEm} = req.body;
        const idUsuario = req.user.id;
        
    })
}