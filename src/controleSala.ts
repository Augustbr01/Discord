import type { EstadoSala, ModoLuzes } from "./interface/Evento";

// controle da sala (o "tablet" do mundo 3D): um estado por sala de voz, em memória, no
// mesmo esquema do YouTube junto. Quem está na call manda comandos; todo mundo segue o estado
const salas = new Map<string, EstadoSala>();

export type ComandoSala =
    | { acao: "TV"; modo: "AUTO" | "YOUTUBE" | "DESLIGADA" }
    | { acao: "TV_TELA"; identidade: string }
    | { acao: "VOLUME"; volume: number }
    | { acao: "SURROUND"; ligado: boolean }
    | { acao: "LUZES"; modo: ModoLuzes };

const MODOS_TV = ["AUTO", "YOUTUBE", "DESLIGADA"];
const MODOS_LUZES = ["AUTO", "ACESAS", "APAGADAS"];

// o cliente manda qualquer coisa: só passa o que tem o formato certo
export function lerComandoSala(msg: any): ComandoSala | null {
    switch (msg?.acao) {
        case "TV":
            return MODOS_TV.includes(msg.modo) ? { acao: "TV", modo: msg.modo } : null;
        case "TV_TELA":
            return typeof msg.identidade === "string" && msg.identidade.length <= 64 ? { acao: "TV_TELA", identidade: msg.identidade } : null;
        case "VOLUME":
            return typeof msg.volume === "number" && Number.isFinite(msg.volume) ? { acao: "VOLUME", volume: Math.round(Math.max(0, Math.min(100, msg.volume))) } : null;
        case "SURROUND":
            return typeof msg.ligado === "boolean" ? { acao: "SURROUND", ligado: msg.ligado } : null;
        case "LUZES":
            return MODOS_LUZES.includes(msg.modo) ? { acao: "LUZES", modo: msg.modo } : null;
        default:
            return null;
    }
}

function padrao(canalId: string): EstadoSala {
    return { canalId, tv: { modo: "AUTO", identidade: null }, volume: 80, surround: true, luzes: "AUTO", ultima: null };
}

export function estadoSala(canalId: string) {
    return salas.get(canalId) ?? padrao(canalId);
}

export function aplicarComandoSala(canalId: string, usuarioId: string, cmd: ComandoSala): EstadoSala {
    const e = salas.get(canalId) ?? padrao(canalId);
    if (cmd.acao === "TV") e.tv = { modo: cmd.modo, identidade: null };
    if (cmd.acao === "TV_TELA") e.tv = { modo: "TELA", identidade: cmd.identidade };
    if (cmd.acao === "VOLUME") e.volume = cmd.volume;
    if (cmd.acao === "SURROUND") e.surround = cmd.ligado;
    if (cmd.acao === "LUZES") e.luzes = cmd.modo;
    e.ultima = { usuarioId, acao: cmd.acao };
    salas.set(canalId, e);
    return e;
}

// a call esvaziou ou a sala foi apagada. Devolve true se tinha algo pra limpar
export function limparSala(canalId: string) {
    return salas.delete(canalId);
}
