// atalhos globais: funcionam com a janela escondida ou com outro programa (um jogo) em foco.
// São os mesmos do Discord pra mutar e desligar o áudio
import { globalShortcut } from "electron";
import type { Atalho } from "./canais";

const ATALHOS: Record<string, Atalho> = {
    "CommandOrControl+Shift+M": "mic",
    "CommandOrControl+Shift+D": "surdo",
};

export function registrarAtalhos(disparar: (atalho: Atalho) => void) {
    for (const [tecla, atalho] of Object.entries(ATALHOS)) {
        // outro programa já pegou essa combinação, ou o sistema não deixou (GNOME no Wayland só libera
        // pelo portal, e às vezes nem assim): segue sem ela, a bandeja continua alternando
        if (!globalShortcut.register(tecla, () => disparar(atalho))) {
            console.warn(`[atalhos] ${tecla} não foi registrado`);
        }
    }
}

export function liberarAtalhos() {
    globalShortcut.unregisterAll();
}
