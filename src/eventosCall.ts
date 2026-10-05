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

export function participantesDaCall(canalId: string) {
    return [...(calls.get(canalId) ?? [])];
}