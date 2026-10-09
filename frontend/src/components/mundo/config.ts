// Configurações do 3D (sensibilidade, campo de visão, pulo...). Ficam guardadas no navegador
// e num "store" de módulo: o Jogador lê a cada quadro sem re-renderizar, e o painel usa o hook.
import { useSyncExternalStore } from "react";
import { lerArmazenado, salvarArmazenado } from "../../lib/util";

export type ConfigMundo = {
    // mesma escala do CS2 (m_yaw 0.022): dá pra copiar a sua de lá
    sensibilidade: number;
    // movimento cru do mouse, sem a aceleração do sistema (m_rawinput)
    entradaBruta: boolean;
    inverterY: boolean;
    // campo de visão como no CS (90 = o do jogo), medido na horizontal numa tela 4:3
    fov: number;
    // a câmera atrás de você (vê o próprio boneco) em vez de nos olhos
    terceiraPessoa: boolean;
    // segurar Espaço pula sozinho ao encostar no chão
    autoBhop: boolean;
    mostrarVelocidade: boolean;
    // desenha o contorno do que bloqueia (paredes, móveis) — pra conferir as hitboxes
    mostrarHitbox: boolean;
};

export const CONFIG_PADRAO: ConfigMundo = {
    sensibilidade: 2.5,
    entradaBruta: true,
    inverterY: false,
    fov: 90,
    terceiraPessoa: false,
    autoBhop: false,
    mostrarVelocidade: false,
    mostrarHitbox: false,
};

export const LIMITES = {
    sensibilidade: { min: 0.05, max: 10 },
    fov: { min: 70, max: 110 },
} as const;

const CHAVE = "liberdade:mundo:config";

let atual: ConfigMundo = { ...CONFIG_PADRAO, ...lerArmazenado<Partial<ConfigMundo>>(CHAVE, {}) };
const ouvintes = new Set<() => void>();

export function lerConfig() {
    return atual;
}

export function mudarConfig(mudanca: Partial<ConfigMundo>) {
    atual = { ...atual, ...mudanca };
    salvarArmazenado(CHAVE, atual);
    ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
    ouvintes.add(f);
    return () => ouvintes.delete(f);
}

export function useConfigMundo() {
    return useSyncExternalStore(assinar, lerConfig);
}

// radianos por "ponto" do mouse, igual ao CS: sensibilidade × 0,022°
export const radianosPorPonto = (sensibilidade: number) => sensibilidade * 0.022 * (Math.PI / 180);

// o FOV do CS é o horizontal de uma tela 4:3; em tela larga ele abre dos lados (o vertical fica igual).
// O three usa o vertical
export const fovVertical = (fov: number) => (2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 0.75) * 180) / Math.PI;
