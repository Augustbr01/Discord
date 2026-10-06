import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
    Headphones, HeadphoneOff, MessageSquare, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Settings2, Video, VideoOff,
} from "lucide-react";
import { useControleVoz } from "../../contexto/ControleVoz";
import { useToast } from "../../contexto/Toasts";
import { useCliqueFora } from "../../hooks/useCliqueFora";
import { estaDigitando } from "../../lib/util";
import { Dica } from "../ui/Dica";
import { Dispositivos } from "./Dispositivos";

type Props = {
    onSair: () => void;
    chatAberto: boolean;
    naoLidas: number;
    onChat: () => void;
};

// barra de controles da chamada
export function Controles({ onSair, chatAberto, naoLidas, onChat }: Props) {
    const toast = useToast();
    const { micLigado, micPendente, alternarMic, surdo, alternarSurdo } = useControleVoz();

    const aoFalharCamera = useCallback(() => toast.erro("Não consegui acessar a câmera. Confira as permissões do navegador."), [toast]);
    const camera = useTrackToggle({ source: Track.Source.Camera, onDeviceError: aoFalharCamera });
    const tela = useTrackToggle({
        source: Track.Source.ScreenShare,
        captureOptions: { audio: true, selfBrowserSurface: "exclude" },
        onDeviceError: () => {},
    });

    const [configAberta, setConfigAberta] = useState(false);
    const configRef = useRef<HTMLDivElement>(null);
    const fecharConfig = useCallback(() => setConfigAberta(false), []);
    useCliqueFora(configRef, configAberta, fecharConfig);

    // atalho: M liga/desliga o microfone
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => {
            if (estaDigitando(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.toLowerCase() === "m") alternarMic();
        };
        window.addEventListener("keydown", aoTeclar);
        return () => window.removeEventListener("keydown", aoTeclar);
    }, [alternarMic]);

    return (
        <div className="controles">
            <Controle
                dica={micLigado ? "Desativar microfone (M)" : "Ativar microfone (M)"}
                desligado={!micLigado}
                pendente={micPendente}
                onClick={alternarMic}
            >
                {micLigado ? <Mic size={20} /> : <MicOff size={20} />}
            </Controle>

            <Controle dica={surdo ? "Ativar áudio" : "Desativar áudio"} desligado={surdo} onClick={alternarSurdo}>
                {surdo ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
            </Controle>

            <Controle
                dica={camera.enabled ? "Desligar câmera" : "Ligar câmera"}
                ligado={camera.enabled}
                pendente={camera.pending}
                onClick={() => camera.toggle()}
            >
                {camera.enabled ? <Video size={20} /> : <VideoOff size={20} />}
            </Controle>

            <Controle
                dica={tela.enabled ? "Parar de compartilhar" : "Compartilhar tela"}
                ligado={tela.enabled}
                pendente={tela.pending}
                onClick={() => tela.toggle()}
            >
                {tela.enabled ? <MonitorX size={20} /> : <MonitorUp size={20} />}
            </Controle>

            <div className="controles-config" ref={configRef}>
                <Controle dica="Dispositivos" ligado={configAberta} onClick={() => setConfigAberta((v) => !v)}>
                    <Settings2 size={20} />
                </Controle>
                {configAberta && (
                    <div className="menu menu-cima">
                        <Dispositivos />
                    </div>
                )}
            </div>

            <Controle dica={chatAberto ? "Fechar chat da sala" : "Chat da sala"} ligado={chatAberto} onClick={onChat}>
                <MessageSquare size={20} />
                {naoLidas > 0 && !chatAberto && <span className="ponto-novo" />}
            </Controle>

            <span className="controles-divisor" />

            <Dica texto="Sair da sala">
                <button className="controle controle-sair" onClick={onSair} aria-label="Sair da sala">
                    <PhoneOff size={20} />
                </button>
            </Dica>
        </div>
    );
}

type ControleProps = {
    dica: string;
    desligado?: boolean;
    ligado?: boolean;
    pendente?: boolean;
    onClick: () => void;
    children: ReactNode;
};

function Controle({ dica, desligado, ligado, pendente, onClick, children }: ControleProps) {
    return (
        <Dica texto={dica}>
            <button
                className={`controle ${desligado ? "controle-desligado" : ""} ${ligado ? "controle-ligado" : ""}`}
                onClick={onClick}
                disabled={pendente}
                aria-label={dica}
            >
                {children}
            </button>
        </Dica>
    );
}
