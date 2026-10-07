import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { gateway } from "../lib/gateway";
import type { ComandoYoutube, EstadoYoutube } from "../tipos";
import { useToast } from "./Toasts";

type YoutubeSala = {
    // null = fora de call, ou o estado ainda não chegou
    estado: EstadoYoutube | null;
    enviar: (comando: ComandoYoutube) => void;
    // onde o vídeo deveria estar agora (segundos), pelo relógio do servidor
    posicaoAgora: () => number;
    // mundo 3D aberto: o player fica na TV da sala, não no palco (um player só por vez)
    noMundo: boolean;
};

const Ctx = createContext<YoutubeSala | null>(null);

// YouTube junto da call atual. Fica acima das telas, igual ao chat da sala:
// o estado chega pelo gateway e continua valendo enquanto você navega
export function YoutubeSalaProvider({ canalId, noMundo, children }: { canalId: string | null; noMundo: boolean; children: ReactNode }) {
    const toast = useToast();
    const [estado, setEstado] = useState<EstadoYoutube | null>(null);
    // relógio do servidor - relógio daqui (ms): cada computador pode estar com a hora diferente
    const diferenca = useRef(0);
    const estadoRef = useRef(estado);
    estadoRef.current = estado;

    useEffect(() => {
        setEstado(null);
        if (!canalId) return;

        const pedir = () => gateway.enviar({ tipo: "YT_PEDIR", canalId });
        pedir();
        const pararReconexao = gateway.aoReconectar(pedir);
        const pararEventos = gateway.assinar((evento) => {
            if (evento.tipo === "YT_ESTADO" && evento.estado.canalId === canalId) {
                diferenca.current = evento.agora - Date.now();
                setEstado(evento.estado);
            }
            if (evento.tipo === "YT_ERRO" && evento.canalId === canalId) toast.erro(evento.mensagem);
        });

        return () => {
            pararReconexao();
            pararEventos();
        };
    }, [canalId, toast]);

    const enviar = useCallback((comando: ComandoYoutube) => {
        if (canalId) gateway.enviar({ tipo: "YT_COMANDO", canalId, ...comando });
    }, [canalId]);

    const posicaoAgora = useCallback(() => {
        const e = estadoRef.current;
        if (!e) return 0;
        const pos = e.tocando ? e.posicao + (Date.now() + diferenca.current - e.em) / 1000 : e.posicao;
        return e.video?.duracao ? Math.min(pos, e.video.duracao) : pos;
    }, []);

    const valor = useMemo<YoutubeSala>(() => ({ estado, enviar, posicaoAgora, noMundo }), [estado, enviar, posicaoAgora, noMundo]);

    return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useYoutubeSala() {
    const valor = useContext(Ctx);
    if (!valor) throw new Error("useYoutubeSala precisa estar dentro do YoutubeSalaProvider");
    return valor;
}
