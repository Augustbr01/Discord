// "Desmute o microfone para falar": aparece quando você fala com o microfone mutado numa call.
//
// Mutado, o LiveKit manda silêncio, então a voz não dá pra medir pela trilha da call. Aqui abre
// uma leitura local do mesmo microfone (só enquanto mutado numa call, e só se o navegador já
// tiver dado permissão — nunca pede) e mede o volume. Nada sai do navegador.
import { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import type { Room } from "livekit-client";
import { MicOff } from "lucide-react";
import { useControleVoz } from "../../contexto/ControleVoz";

const INTERVALO_MS = 80;
// voz = bem acima do ruído de fundo (e de um mínimo absoluto), na maioria das últimas leituras
const MINIMO = 0.02;
const ACIMA_DO_FUNDO = 3;
const JANELA = 6;
const PRECISA = 4;
const SOME_DEPOIS_MS = 2500;

function useFalandoMutado(ativo: boolean, room: Room) {
    const [falando, setFalando] = useState(false);

    useEffect(() => {
        if (!ativo) return;
        let parado = false;
        let fluxo: MediaStream | undefined;
        let contexto: AudioContext | undefined;
        let leitura: number | undefined;
        let esconder: number | undefined;

        (async () => {
            // sem permissão ainda: não pede (não é hora de pop-up do navegador)
            const permissao = await navigator.permissions?.query({ name: "microphone" as PermissionName }).catch(() => null);
            if (parado || (permissao && permissao.state !== "granted")) return;

            const aparelho = room.getActiveDevice("audioinput");
            fluxo = await navigator.mediaDevices.getUserMedia({
                audio: {
                    ...(aparelho && aparelho !== "default" ? { deviceId: { exact: aparelho } } : {}),
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false,
                },
            });
            if (parado) {
                fluxo.getTracks().forEach((t) => t.stop());
                return;
            }
            contexto = new AudioContext();
            await contexto.resume().catch(() => {});
            const analisador = contexto.createAnalyser();
            analisador.fftSize = 1024;
            contexto.createMediaStreamSource(fluxo).connect(analisador);
            const amostras = new Float32Array(analisador.fftSize);

            let fundo = 0.01;
            const ultimas: boolean[] = [];
            leitura = window.setInterval(() => {
                analisador.getFloatTimeDomainData(amostras);
                let soma = 0;
                for (const v of amostras) soma += v * v;
                const volume = Math.sqrt(soma / amostras.length);
                // ruído de fundo: acompanha rápido pra baixo e bem devagar pra cima (a voz não o puxa)
                fundo = volume < fundo ? volume : fundo + (volume - fundo) * 0.005;
                ultimas.push(volume > Math.max(MINIMO, fundo * ACIMA_DO_FUNDO));
                if (ultimas.length > JANELA) ultimas.shift();
                if (ultimas.filter(Boolean).length >= PRECISA) {
                    setFalando(true);
                    window.clearTimeout(esconder);
                    esconder = window.setTimeout(() => setFalando(false), SOME_DEPOIS_MS);
                }
            }, INTERVALO_MS);
        })().catch(() => {});

        return () => {
            parado = true;
            window.clearInterval(leitura);
            window.clearTimeout(esconder);
            fluxo?.getTracks().forEach((t) => t.stop());
            contexto?.close().catch(() => {});
            setFalando(false);
        };
    }, [ativo, room]);

    return falando;
}

export function AvisoMutado() {
    const { conectado, micLigado, alternarMic } = useControleVoz();
    const room = useRoomContext();
    const falando = useFalandoMutado(conectado && !micLigado, room);
    if (!falando || micLigado) return null;

    return (
        <button className="aviso-mutado" onClick={alternarMic} role="status" aria-live="polite">
            <MicOff size={16} />
            <span>Desmute o microfone para falar</span>
            <kbd>M</kbd>
        </button>
    );
}
