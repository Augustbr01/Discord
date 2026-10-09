import { randomUUID } from "node:crypto";
import type { EstadoYoutube, ItemFilaYoutube } from "./interface/Evento";

// YouTube junto: um estado por sala de voz, em memória. Quem está na call manda comandos,
// o servidor decide o estado e todo mundo sincroniza o próprio player a partir dele
const salas = new Map<string, EstadoYoutube>();

const LIMITE_FILA = 50;
const ID_VIDEO = /^[\w-]{11}$/;

export type ComandoYoutube =
    | { acao: "TOCAR_AGORA" | "FILA"; videoId: string }
    | { acao: "PLAY" | "PAUSE" | "PROXIMO" | "PARAR" }
    | { acao: "PULAR_PARA"; segundos: number }
    | { acao: "REMOVER"; itemId: string }
    // o player de alguém chegou no fim / descobriu a duração (o primeiro que avisar vale)
    | { acao: "TERMINOU"; videoId: string }
    | { acao: "DURACAO"; videoId: string; segundos: number };

// o cliente manda qualquer coisa: só passa o que tem o formato certo
export function lerComando(msg: any): ComandoYoutube | null {
    const segundos = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 86_400;
    switch (msg?.acao) {
        case "TOCAR_AGORA":
        case "FILA":
        case "TERMINOU":
            return typeof msg.videoId === "string" && ID_VIDEO.test(msg.videoId) ? { acao: msg.acao, videoId: msg.videoId } : null;
        case "DURACAO":
            return typeof msg.videoId === "string" && segundos(msg.segundos) ? { acao: "DURACAO", videoId: msg.videoId, segundos: msg.segundos } : null;
        case "PLAY":
        case "PAUSE":
        case "PROXIMO":
        case "PARAR":
            return { acao: msg.acao };
        case "PULAR_PARA":
            return segundos(msg.segundos) ? { acao: "PULAR_PARA", segundos: msg.segundos } : null;
        case "REMOVER":
            return typeof msg.itemId === "string" ? { acao: "REMOVER", itemId: msg.itemId } : null;
        default:
            return null;
    }
}

function vazio(canalId: string): EstadoYoutube {
    return { canalId, video: null, tocando: false, posicao: 0, em: Date.now(), fila: [], ultima: null };
}

export function estadoYoutube(canalId: string) {
    return salas.get(canalId) ?? vazio(canalId);
}

// onde o vídeo está agora, em segundos
function posicaoAtual(e: EstadoYoutube) {
    return e.tocando ? e.posicao + (Date.now() - e.em) / 1000 : e.posicao;
}

// título pelo oEmbed do YouTube. null = vídeo não existe ou o dono não deixa incorporar
// (o player embutido não tocaria). Se o YouTube não responder, segue com um título genérico
async function buscarTitulo(videoId: string): Promise<string | null> {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400) return null;
        if (!res.ok) return "Vídeo do YouTube";
        const dados = await res.json() as { title?: unknown };
        return typeof dados.title === "string" && dados.title ? dados.title.slice(0, 200) : "Vídeo do YouTube";
    } catch {
        return "Vídeo do YouTube";
    }
}

function tocar(e: EstadoYoutube, item: { videoId: string; titulo: string; por: string }) {
    e.video = { videoId: item.videoId, titulo: item.titulo, por: item.por, duracao: null };
    e.tocando = true;
    e.posicao = 0;
    e.em = Date.now();
}

function proximo(e: EstadoYoutube) {
    const item = e.fila.shift();
    if (item) {
        tocar(e, item);
    } else {
        e.video = null;
        e.tocando = false;
        e.posicao = 0;
        e.em = Date.now();
    }
}

// aplica o comando e devolve o estado novo, ou uma mensagem de erro (texto).
// null = nada mudou (ex.: o segundo aviso de "terminou" do mesmo vídeo)
export async function aplicarComando(canalId: string, usuarioId: string, cmd: ComandoYoutube): Promise<EstadoYoutube | string | null> {
    let titulo: string | null = null;
    if (cmd.acao === "TOCAR_AGORA" || cmd.acao === "FILA") {
        titulo = await buscarTitulo(cmd.videoId);
        if (!titulo) return "Esse vídeo não existe ou não pode ser assistido fora do YouTube.";
    }

    // pega o estado depois do await: outro comando pode ter mudado ele nesse meio tempo
    const e = salas.get(canalId) ?? vazio(canalId);
    const agora = Date.now();

    switch (cmd.acao) {
        case "TOCAR_AGORA":
            tocar(e, { videoId: cmd.videoId, titulo: titulo!, por: usuarioId });
            break;
        case "FILA":
            if (!e.video) {
                tocar(e, { videoId: cmd.videoId, titulo: titulo!, por: usuarioId });
                break;
            }
            if (e.fila.length >= LIMITE_FILA) return `A fila já tem ${LIMITE_FILA} vídeos.`;
            e.fila.push({ id: randomUUID(), videoId: cmd.videoId, titulo: titulo!, por: usuarioId } satisfies ItemFilaYoutube);
            break;
        case "PLAY":
            if (!e.video || e.tocando) return null;
            e.tocando = true;
            e.em = agora;
            break;
        case "PAUSE":
            if (!e.video || !e.tocando) return null;
            e.posicao = posicaoAtual(e);
            e.tocando = false;
            e.em = agora;
            break;
        case "PULAR_PARA":
            if (!e.video) return null;
            e.posicao = e.video.duracao ? Math.min(cmd.segundos, e.video.duracao) : cmd.segundos;
            e.em = agora;
            break;
        case "PROXIMO":
            if (!e.video && e.fila.length === 0) return null;
            proximo(e);
            break;
        case "PARAR":
            if (!e.video && e.fila.length === 0) return null;
            e.video = null;
            e.fila = [];
            e.tocando = false;
            e.posicao = 0;
            e.em = agora;
            break;
        case "REMOVER": {
            const antes = e.fila.length;
            e.fila = e.fila.filter((i) => i.id !== cmd.itemId);
            if (e.fila.length === antes) return null;
            break;
        }
        case "TERMINOU":
            // todo mundo avisa quando acaba; só o primeiro aviso do vídeo atual conta,
            // e só se pelo relógio do servidor o vídeo já estiver mesmo no fim
            if (e.video?.videoId !== cmd.videoId) return null;
            if (e.video.duracao !== null && posicaoAtual(e) < e.video.duracao - 5) return null;
            proximo(e);
            break;
        case "DURACAO":
            if (e.video?.videoId !== cmd.videoId || e.video.duracao !== null) return null;
            e.video.duracao = cmd.segundos;
            salas.set(canalId, e);
            // não é uma ação de ninguém: não muda o "última ação"
            return e;
    }

    e.ultima = { usuarioId, acao: cmd.acao };
    salas.set(canalId, e);
    return e;
}

// a call esvaziou ou a sala foi apagada. Devolve true se tinha algo pra limpar
export function limparYoutube(canalId: string) {
    return salas.delete(canalId);
}
