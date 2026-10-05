import { Type, type FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import {prisma} from "../../lib/prisma"
import { Permissao,TipoCanal } from "../../generated/prisma/enums";
import { participantesDaCall } from "../eventosCall";
export const RotasServidor : (FastifyPluginAsyncTypebox) = async (fastify) => {

    fastify.addHook("onRequest", async (req,rep) => {
        try {
            await req.jwtVerify();
        }catch(e) {
            return rep.code(404).send({mensagem:"ERRO AO VALIDAR USUÁRIO"});
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

        const pessoasVoz = Object.fromEntries(entidade.canais.filter((a) => a.tipo === TipoCanal.VOZ).map((c) => [c.id,participantesDaCall(c.id)]));

        return rep.code(200).send({...entidade,pessoasVoz});
    })

    fastify.post("/servidor/convite-criar", {schema: {body: Type.Object({idServidor:Type.String(),expiraEm:Type.Optional(Type.Integer({minimum: 60, maximum: 60 * 60 * 24 * 30}))})}} ,async (req,rep) => {
        const {idServidor,expiraEm} = req.body;
        const idUsuario = req.user.id;

        const entidade = await prisma.usuarioServidor.findUnique({where: {usuarioId_servidorId: {usuarioId:idUsuario,servidorId:idServidor}, permissao: Permissao.ADMIN}});

        if(!entidade) {
            return rep.code(401).send({mensagem:"Você não possui permissão"});
        }

        const convite = await prisma.convite.create({data: {
            servidorId: idServidor,
            criadoPorId: idUsuario,
            expiraEm: !expiraEm ? null : new Date(Date.now() + (expiraEm * 1000))
        },select: {
            id:true,
            criadoEm:true,
            expiraEm:true
        }})

        return rep.code(200).send(convite);
    })

    fastify.post("/servidor/sala-criar", {schema: {body: Type.Object({servidorId: Type.String(),tipoSala: Type.Enum(TipoCanal),nomeCanal: Type.String({minLength: 1, maxLength: 50})})}},async (req,rep) => {
        const {servidorId,tipoSala,nomeCanal} = req.body;
        const idUsuario = req.user.id;

        const servidor = await prisma.servidor.findFirst({where:{id:servidorId, membros: {some: {usuarioId: idUsuario, permissao: Permissao.ADMIN}}}});

        if(!servidor) {
            return rep.code(404).send({mensagem:"erro"});
        }

        const canal = await prisma.canal.create({data: {
            servidorId:servidorId,
            nome:nomeCanal,
            tipo:tipoSala
        },select: {
            id:true,
            nome:true,
            tipo:true
        }})
        return rep.code(201).send(canal);
    })

    fastify.post("/servidor/convite/:id",{schema: {params: Type.Object({id: Type.String()})}},async (req,rep) => {
        const idUsuario = req.user.id;
        const {id} = req.params;

        const entidade = await prisma.convite.findFirst({where: {id:id, OR: [{expiraEm:null},{expiraEm: {gt: new Date()}}]}, select: {servidorId: true,servidor: {select: {membros: {where: {usuarioId:idUsuario}}}}}});
        
        if(!entidade) {
            return rep.code(400).send({mensagem:"Código inválido ou expirado"});
        }

        if(entidade.servidor.membros.length > 0) {
            return rep.code(400).send({mensagem:"Você já é membro deste servidor"});
        }

        const criado = await prisma.usuarioServidor.create({data: {
            usuarioId:idUsuario,
            servidorId:entidade.servidorId
        }, select: {
            servidor: {
                select: {
                    id:true,
                    nome:true,
                    iconeUrl:true
                }
            }
        }})

        return rep.code(200).send(criado);
    })
}