import type { WebSocket } from "ws";
import type { Evento, PoseJogador } from "./interface/Evento";

type Pose = Omit<PoseJogador, "usuarioId">;
type Jogador = Pose & { ws: WebSocket };

// mundo 3D: cada servidor é um andar. Tudo em memória (posição não vale a pena ir pro banco)
// servidorId -> (usuarioId -> onde a pessoa está e o socket da aba que está andando)
const andares = new Map<string, Map<string, Jogador>>();
// quem se mexeu desde o último envio, por andar
const mexeram = new Map<string, Set<string>>();

// as posições saem juntas, 10x por segundo, em vez de uma mensagem por movimento de cada um
const INTERVALO_MS = 100;
let relogio: ReturnType<typeof setInterval> | undefined;

// o cliente manda número qualquer: só aceita coordenada finita dentro do prédio
const LIMITE = 1000;

export function lerPose(msg: any): Pose | null {
    const { x, z, rot, y = 0, pitch = 0, postura = 0, item = 0 } = msg ?? {};
    const valido = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= LIMITE;
    if (!valido(x) || !valido(z) || !valido(rot) || !valido(y) || !valido(pitch)) return null;
    if (!Number.isInteger(postura) || postura < 0 || postura > 4) return null;
    if (!Number.isInteger(item) || item < 0 || item > 7) return null;
    return { x, z, y, rot, pitch, postura, item };
}

function enviar(ws: WebSocket, evento: Evento | string) {
    if (ws.readyState === ws.OPEN) ws.send(typeof evento === "string" ? evento : JSON.stringify(evento));
}

function marcar(servidorId: string, usuarioId: string) {
    const set = mexeram.get(servidorId) ?? new Set<string>();
    set.add(usuarioId);
    mexeram.set(servidorId, set);
    relogio ??= setInterval(tique, INTERVALO_MS);
}

function tique() {
    for (const [servidorId, ids] of mexeram) {
        const andar = andares.get(servidorId);
        if (!andar) continue;

        const jogadores: PoseJogador[] = [];
        for (const id of ids) {
            const j = andar.get(id);
            if (j) jogadores.push({ usuarioId: id, x: j.x, z: j.z, y: j.y, rot: j.rot, pitch: j.pitch, postura: j.postura, item: j.item });
        }
        if (jogadores.length === 0) continue;

        // a mesma string vai pra todo mundo do andar (cada cliente ignora a própria posição)
        const msg = JSON.stringify({ tipo: "MUNDO_POSICOES", servidorId, jogadores } satisfies Evento);
        andar.forEach((j) => enviar(j.ws, msg));
    }
    mexeram.clear();

    if (andares.size === 0) {
        clearInterval(relogio);
        relogio = undefined;
    }
}

export function entrarNoAndar(servidorId: string, usuarioId: string, ws: WebSocket, pose: Pose) {
    const andar = andares.get(servidorId) ?? new Map<string, Jogador>();
    // se a pessoa já estava aqui por outra aba, a aba nova assume
    andar.set(usuarioId, { ...pose, ws });
    andares.set(servidorId, andar);

    const jogadores: PoseJogador[] = [];
    andar.forEach((j, id) => {
        if (id !== usuarioId) jogadores.push({ usuarioId: id, x: j.x, z: j.z, y: j.y, rot: j.rot, pitch: j.pitch, postura: j.postura, item: j.item });
    });
    enviar(ws, { tipo: "MUNDO_ESTADO", servidorId, jogadores });

    // os outros ficam sabendo no próximo envio de posições
    marcar(servidorId, usuarioId);
}

export function moverNoAndar(servidorId: string, usuarioId: string, ws: WebSocket, pose: Pose) {
    const j = andares.get(servidorId)?.get(usuarioId);
    if (!j || j.ws !== ws) return;

    j.x = pose.x;
    j.z = pose.z;
    j.y = pose.y;
    j.rot = pose.rot;
    j.pitch = pose.pitch;
    j.postura = pose.postura;
    j.item = pose.item;
    marcar(servidorId, usuarioId);
}

export function sairDoAndar(servidorId: string, usuarioId: string, ws: WebSocket) {
    const andar = andares.get(servidorId);
    // outra aba assumiu o lugar: não tira a pessoa do andar
    if (!andar || andar.get(usuarioId)?.ws !== ws) return;

    andar.delete(usuarioId);
    mexeram.get(servidorId)?.delete(usuarioId);

    if (andar.size === 0) {
        andares.delete(servidorId);
        mexeram.delete(servidorId);
        return;
    }

    const msg = JSON.stringify({ tipo: "MUNDO_SAIU", servidorId, usuarioId } satisfies Evento);
    andar.forEach((j) => enviar(j.ws, msg));
}
