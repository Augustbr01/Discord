// Quem mais está andando neste andar, pelo gateway. A posição de cada um fica num Map
// mutável (lido a cada quadro pelos bonecos); só a lista de quem está aqui vira estado.
import { useEffect, useRef, useState, type RefObject } from "react";
import { gateway } from "../../lib/gateway";
import type { PoseJogador } from "../../tipos";

// postura: 0 em pé, 1 agachado, 2 deslizando, 3 sentado
export const POSTURA = { EM_PE: 0, AGACHADO: 1, DESLIZANDO: 2, SENTADO: 3 } as const;
// o que a pessoa está segurando
export const ITEM = { NADA: 0, TABLET: 1 } as const;
// rot = pra onde olha (de lado), pitch = olhando pra cima (+) ou pra baixo (-)
export type Pose = { x: number; z: number; y: number; rot: number; pitch: number; postura: number; item: number };

// 10x por segundo, e só quando mudou
const INTERVALO_MS = 100;

const arredondar = (n: number) => Math.round(n * 100) / 100;

function normalizarAngulo(a: number) {
    return Math.atan2(Math.sin(a), Math.cos(a));
}

function compacta(p: Pose): Pose {
    return {
        x: arredondar(p.x), z: arredondar(p.z), y: arredondar(p.y),
        rot: arredondar(normalizarAngulo(p.rot)), pitch: arredondar(p.pitch),
        postura: p.postura, item: p.item,
    };
}

export function useJogadoresDoAndar(servidorId: string, euId: string, minhaPose: RefObject<Pose>) {
    const alvos = useRef(new Map<string, Pose>()).current;
    const [ids, setIds] = useState<string[]>([]);

    useEffect(() => {
        alvos.clear();
        setIds([]);
        const sincronizarIds = () => setIds([...alvos.keys()]);

        const aplicar = (jogadores: PoseJogador[], substituir: boolean) => {
            if (substituir) alvos.clear();
            let novo = substituir;
            for (const { usuarioId, x, z, y, rot, pitch, postura, item } of jogadores) {
                if (usuarioId === euId) continue;
                if (!alvos.has(usuarioId)) novo = true;
                alvos.set(usuarioId, { x, z, y: y ?? 0, rot, pitch: pitch ?? 0, postura: postura ?? POSTURA.EM_PE, item: item ?? ITEM.NADA });
            }
            if (novo) sincronizarIds();
        };

        const entrar = () => gateway.enviar({ tipo: "MUNDO_ENTRAR", servidorId, ...compacta(minhaPose.current) });
        entrar();
        // caiu e voltou: o servidor esqueceu a gente, então entra de novo
        const pararReconexao = gateway.aoReconectar(entrar);

        const pararEventos = gateway.assinar((evento) => {
            if (evento.tipo === "MUNDO_ESTADO" && evento.servidorId === servidorId) aplicar(evento.jogadores, true);
            if (evento.tipo === "MUNDO_POSICOES" && evento.servidorId === servidorId) aplicar(evento.jogadores, false);
            if (evento.tipo === "MUNDO_SAIU" && evento.servidorId === servidorId && alvos.delete(evento.usuarioId)) {
                sincronizarIds();
            }
        });

        let ultima = "";
        const relogio = window.setInterval(() => {
            const p = compacta(minhaPose.current);
            const chave = `${p.x}|${p.z}|${p.y}|${p.rot}|${p.pitch}|${p.postura}|${p.item}`;
            if (chave === ultima) return;
            ultima = chave;
            gateway.enviar({ tipo: "MUNDO_MOVER", ...p });
        }, INTERVALO_MS);

        return () => {
            window.clearInterval(relogio);
            pararReconexao();
            pararEventos();
            gateway.enviar({ tipo: "MUNDO_SAIR" });
        };
    }, [servidorId, euId, minhaPose, alvos]);

    return { alvos, ids };
}
