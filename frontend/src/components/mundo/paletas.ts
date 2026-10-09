// Paletas dos LEDs da sala gamer: A = cor principal (sanca, tela, sofá), B = secundária
// (rack, caixas, prateleiras). Sem three aqui: o painel do controle também usa.
import type { EstadoLed, PaletaLed } from "../../tipos";

export const PALETAS: Record<PaletaLed, { nome: string; a: string; b: string }> = {
    NEON: { nome: "Neon", a: "#8b5cf6", b: "#22d3ee" },
    BRASA: { nome: "Brasa", a: "#ef4444", b: "#fb923c" },
    AURORA: { nome: "Aurora", a: "#10b981", b: "#06b6d4" },
    SAKURA: { nome: "Sakura", a: "#ec4899", b: "#a78bfa" },
    MONO: { nome: "Mono", a: "#e4e4e7", b: "#a1a1aa" },
};

export const ORDEM_PALETAS: PaletaLed[] = ["NEON", "BRASA", "AURORA", "SAKURA", "MONO"];

export const LED_PADRAO: EstadoLed = { paleta: null, ciclo: false, ligado: true };

// cada sala tem uma cor própria até alguém escolher outra no controle (o corredor fica colorido)
export function paletaPadrao(canalId: string): PaletaLed {
    let h = 2166136261;
    for (let i = 0; i < canalId.length; i++) {
        h ^= canalId.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ORDEM_PALETAS[(h >>> 0) % 4];
}

export function paletaDaSala(canalId: string, led: EstadoLed | null | undefined) {
    return PALETAS[led?.paleta ?? paletaPadrao(canalId)];
}
