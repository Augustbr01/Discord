import {
    VideoTrack, isTrackReference, useConnectionQualityIndicator, useIsMuted, useIsSpeaking,
    type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionQuality, Track } from "livekit-client";
import { MicOff, MonitorUp, WifiOff } from "lucide-react";
import type { Usuario } from "../../api";
import { avatarReal } from "../../lib/util";
import type { MapaMembros } from "../../tipos";
import { Avatar } from "../ui/Avatar";

type Props = { trackRef: TrackReferenceOrPlaceholder; membros: MapaMembros; eu: Usuario };

// um quadro da chamada: vídeo da câmera/tela ou o avatar da pessoa
export function Bloco({ trackRef, membros, eu }: Props) {
    const participante = trackRef.participant;
    const falando = useIsSpeaking(participante);
    const videoMutado = useIsMuted(trackRef);
    const micMutado = useIsMuted({ participant: participante, source: Track.Source.Microphone });
    const { quality } = useConnectionQualityIndicator({ participant: participante });

    // antes de conectar, o participante local ainda não tem identity: usa os seus dados
    const membro = participante.isLocal ? eu : membros.get(participante.identity);
    const nome = membro?.nome ?? participante.name ?? "Convidado";
    const ehTela = trackRef.source === Track.Source.ScreenShare;
    const temVideo = isTrackReference(trackRef) && !videoMutado;
    const minhaTela = ehTela && participante.isLocal;
    const fundo = avatarReal(membro?.avatarUrl);

    return (
        <div className={`bloco ${falando && !ehTela ? "falando" : ""} ${ehTela ? "bloco-tela" : ""}`}>
            {temVideo && !minhaTela ? (
                <VideoTrack trackRef={trackRef} className={participante.isLocal && !ehTela ? "espelhado" : ""} />
            ) : minhaTela ? (
                <div className="bloco-aviso">
                    <MonitorUp size={26} />
                    <strong>Você está compartilhando a tela</strong>
                    <span>Os outros estão vendo o que você escolheu mostrar.</span>
                </div>
            ) : (
                <div className="bloco-sem-video">
                    {fundo && <span className="bloco-fundo" style={{ backgroundImage: `url(${fundo})` }} />}
                    <Avatar nome={nome} url={membro?.avatarUrl} tamanho="auto" falando={falando} className="bloco-avatar" />
                </div>
            )}

            <div className="bloco-rotulo">
                {ehTela ? <MonitorUp size={14} /> : micMutado && <MicOff size={14} className="bloco-mudo" />}
                <span className="truncar">{ehTela ? `Tela de ${nome}` : nome}</span>
            </div>

            {quality === ConnectionQuality.Poor && (
                <span className="bloco-sinal" title="Conexão instável">
                    <WifiOff size={14} />
                </span>
            )}
        </div>
    );
}
