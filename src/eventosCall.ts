import { roomService } from "./config/RoomService";

const calls = new Map<string, Set<string>>()

export function entrouNaCall(canalId: string, usuarioId: string) {
    const set = calls.get(canalId) ?? new Set<string>();

    set.add(usuarioId);
    calls.set(canalId,set);
}

export function saiuDaCall(canalId: string, usuarioId: string) {
    const set = calls.get(canalId); 

    set?.delete(usuarioId);

    if (set && set.size === 0) calls.delete(canalId);
}

// canais com alguém dentro, pela lista (pra conferir com o LiveKit)
export function canaisComGente() {
    return [...calls.keys()];
}

export function participantesDaCall(canalId: string) {
    return [...(calls.get(canalId) ?? [])];
}

// a lista acima vem dos webhooks do LiveKit e some quando o servidor reinicia (ou fica
// vazia se o webhook não chega). Se a pessoa não está nela, pergunta pro próprio LiveKit
export async function estaNaCall(canalId: string, usuarioId: string) {
    if (calls.get(canalId)?.has(usuarioId)) return true;
    const participante = await roomService.getParticipant(canalId, usuarioId).catch(() => null);
    return participante !== null;
}

export function limparCall(canalId: string) {
    calls.delete(canalId);
}