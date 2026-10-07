import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTrackToggle } from "@livekit/components-react";
import { AudioPresets, ScreenSharePresets, Track } from "livekit-client";
import {
    Headphones, HeadphoneOff, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Settings2, Video, VideoOff,
} from "lucide-react";
import { useControleVoz } from "../../contexto/ControleVoz";
import { useToast } from "../../contexto/Toasts";
import { useCliqueFora } from "../../hooks/useCliqueFora";
import { estaDigitando } from "../../lib/util";
import { Dica } from "../ui/Dica";
import { Dispositivos } from "./Dispositivos";

// áudio da tela é música/filme, não voz: em estéreo (o surround do 3D separa esquerda e direita),
// sem o tratamento de voz do navegador (anti-eco, anti-ruído e ganho automático estragam música)
// e sem dtx/red (que picotam o som), com bitrate de música
const AUDIO_DA_TELA = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 };
const PUBLICAR_AUDIO_DA_TELA = { audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: false, forceStereo: true };

export const OPCOES_TELA = {
    captureOptions: { audio: AUDIO_DA_TELA, selfBrowserSurface: "exclude" as const },
    publishOptions: PUBLICAR_AUDIO_DA_TELA,
};

// cinema: além disso, tela compartilhada a 30 quadros por segundo (filme a 15 fps fica travado)
export const OPCOES_TELA_CINEMA = {
    captureOptions: { ...OPCOES_TELA.captureOptions, resolution: { width: 1920, height: 1080, frameRate: 30 } },
    publishOptions: { ...PUBLICAR_AUDIO_DA_TELA, screenShareEncoding: ScreenSharePresets.h1080fps30.encoding },
};

// barra de controles da chamada
export function Controles({ onSair, cinema = false }: { onSair: () => void; cinema?: boolean }) {
    const toast = useToast();
    const { micLigado, micPendente, alternarMic, surdo, alternarSurdo } = useControleVoz();

    const aoFalharCamera = useCallback(() => toast.erro("Não consegui acessar a câmera. Confira as permissões do navegador."), [toast]);
    const camera = useTrackToggle({ source: Track.Source.Camera, onDeviceError: aoFalharCamera });
    const tela = useTrackToggle({
        source: Track.Source.ScreenShare,
        ...(cinema ? OPCOES_TELA_CINEMA : OPCOES_TELA),
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
