import {WebSocket} from "ws"
import type {Evento} from "../interface/Evento"
import { prisma } from "../../lib/prisma";
const conexoes = new Map<string,Set<WebSocket>>();

export function conectar(usuarioId: string, ws:WebSocket) {
    const set = conexoes.get(usuarioId) ?? new Set<WebSocket>();

    set.add(ws);

    conexoes.set(usuarioId,set);

    return () => {
        set.delete(ws);
        if(set.size === 0) conexoes.delete(usuarioId);
    }
}

export async function publicarParaUsuarios(ids : string[], evento: Evento) {
    const msg = JSON.stringify(evento);

    for(const id of ids) {
        conexoes.get(id)?.forEach((ws) => {
            if(ws.readyState === ws.OPEN) ws.send(msg);
        })
    }
}

export async function publicarParaServidor(servidorId: string, evento : Evento) {
    const entidades = await prisma.usuarioServidor.findMany({where: {servidorId:servidorId},select: {usuarioId:true}});

    publicarParaUsuarios(entidades.map((e) => e.usuarioId),evento);
}