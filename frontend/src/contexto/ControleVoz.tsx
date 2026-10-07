import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";
import { RoomAudioRenderer, useConnectionState, useTrackToggle } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { useToast } from "./Toasts";

type ControleVoz = {
    conectado: boolean;
    micLigado: boolean;
    micPendente: boolean;
    alternarMic: () => void;
    surdo: boolean;
    alternarSurdo: () => void;
};

const Ctx = createContext<ControleVoz | null>(null);

type Props = {
    // preferências guardadas no App (sobrevivem a trocar de sala)
    micPreferido: boolean;
    setMicPreferido: (ligado: boolean) => void;
    surdo: boolean;
    setSurdo: (surdo: boolean) => void;
    // mundo 3D aberto: o som sai pelo áudio espacial dele, não daqui
    audioEspacial?: boolean;
    children: ReactNode;
};

// microfone e "áudio desligado" funcionam dentro e fora da chamada:
// fora dela viram preferência (você entra já mutado), dentro dela agem na hora
export function ControleVozProvider({ micPreferido, setMicPreferido, surdo, setSurdo, audioEspacial = false, children }: Props) {
    const toast = useToast();
    const estado = useConnectionState();
    const conectado = estado === ConnectionState.Connected;

    const mic = useTrackToggle({
        source: Track.Source.Microphone,
        onDeviceError: () => {
            setMicPreferido(false);
            toast.erro("Não consegui acessar o microfone. Confira as permissões do navegador.");
        },
    });

    const micLigado = conectado ? mic.enabled : micPreferido;
    const micAntesDeSurdo = useRef(micLigado);
    const alternarFaixa = mic.toggle;

    const definirMic = useCallback((ligar: boolean) => {
        setMicPreferido(ligar);
        if (conectado) alternarFaixa(ligar);
    }, [conectado, alternarFaixa, setMicPreferido]);

    const alternarMic = useCallback(() => {
        // ligar o microfone também volta a ouvir a sala
        if (!micLigado && surdo) setSurdo(false);
        definirMic(!micLigado);
    }, [micLigado, surdo, setSurdo, definirMic]);

    const alternarSurdo = useCallback(() => {
        if (surdo) {
            setSurdo(false);
            if (micAntesDeSurdo.current) definirMic(true);
        } else {
            // quem desliga o áudio também fica mudo, e o microfone volta ao religar
            micAntesDeSurdo.current = micLigado;
            setSurdo(true);
            if (micLigado) definirMic(false);
        }
    }, [surdo, micLigado, setSurdo, definirMic]);

    const valor = useMemo<ControleVoz>(() => ({
        conectado,
        micLigado,
        micPendente: conectado && mic.pending,
        alternarMic,
        surdo,
        alternarSurdo,
    }), [conectado, micLigado, mic.pending, alternarMic, surdo, alternarSurdo]);

    return (
        <Ctx.Provider value={valor}>
            {/* volume 0 (e não muted) no 3D: o <audio> continua recebendo, só não toca */}
            <RoomAudioRenderer muted={surdo} volume={audioEspacial ? 0 : 1} />
            {children}
        </Ctx.Provider>
    );
}

export function useControleVoz() {
    const valor = useContext(Ctx);
    if (!valor) throw new Error("useControleVoz precisa estar dentro do ControleVozProvider");
    return valor;
}
