import { useConnectionState, useIsSpeaking, useParticipants, useTrackToggle } from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import { MonitorUp, MonitorX, PhoneOff, Video, VideoOff } from "lucide-react";
import type { Usuario } from "../../api";
import { useAgora } from "../../hooks/useAgora";
import { cronometro } from "../../lib/util";
import type { MapaMembros, Voz } from "../../tipos";
import { Avatar } from "../ui/Avatar";
import { Dica } from "../ui/Dica";

const ROSTOS = 4;

type Props = {
    voz: Voz;
    eu: Usuario;
    membros: MapaMembros;
    noPalco: boolean;
    onAbrir: () => void;
    onSair: () => void;
};

// a chamada em que você está, sempre no topo (como uma ilha): quem está lá, quem fala,
// há quanto tempo, e os atalhos de câmera, tela e sair. Clicar abre o palco.
export function IlhaChamada({ voz, eu, membros, noPalco, onAbrir, onSair }: Props) {
    const estado = useConnectionState();
    const participantes = useParticipants();
    const agora = useAgora();
    const camera = useTrackToggle({ source: Track.Source.Camera, onDeviceError: () => {} });
    const tela = useTrackToggle({
        source: Track.Source.ScreenShare,
        captureOptions: { audio: true, selfBrowserSurface: "exclude" },
        onDeviceError: () => {},
    });

    const conectado = estado === ConnectionState.Connected;
    const status = conectado
        ? cronometro(agora - voz.desde)
        : estado === ConnectionState.Reconnecting ? "Reconectando…" : "Conectando…";
    const extras = participantes.length - ROSTOS;

    return (
        <div className={`ilha ${conectado ? "" : "esperando"} ${noPalco ? "no-palco" : ""}`}>
            <button className="ilha-corpo" onClick={onAbrir} aria-label={`Abrir a chamada em ${voz.canal.nome}`}>
                <span className="ilha-rostos">
                    {participantes.slice(0, ROSTOS).map((p) => (
                        <Rosto key={p.identity} participante={p} membros={membros} eu={eu} />
                    ))}
                    {extras > 0 && <span className="ilha-extras">+{extras}</span>}
                </span>
                <span className="ilha-texto">
                    <strong className="truncar">{voz.canal.nome}</strong>
                    <span className="numeros">{status}</span>
                </span>
            </button>

            <Dica texto={camera.enabled ? "Desligar câmera" : "Ligar câmera"} lado="baixo">
                <button
                    className={`ilha-botao ${camera.enabled ? "ligado" : ""}`}
                    onClick={() => camera.toggle()}
                    disabled={!conectado || camera.pending}
                    aria-label={camera.enabled ? "Desligar câmera" : "Ligar câmera"}
                >
                    {camera.enabled ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
            </Dica>
            <Dica texto={tela.enabled ? "Parar de compartilhar" : "Compartilhar tela"} lado="baixo">
                <button
                    className={`ilha-botao ilha-botao-tela ${tela.enabled ? "ligado" : ""}`}
                    onClick={() => tela.toggle()}
                    disabled={!conectado || tela.pending}
                    aria-label={tela.enabled ? "Parar de compartilhar" : "Compartilhar tela"}
                >
                    {tela.enabled ? <MonitorX size={16} /> : <MonitorUp size={16} />}
                </button>
            </Dica>
            <Dica texto="Sair da sala" lado="baixo">
                <button className="ilha-botao ilha-sair" onClick={onSair} aria-label="Sair da sala">
                    <PhoneOff size={16} />
                </button>
            </Dica>
        </div>
    );
}

function Rosto({ participante, membros, eu }: { participante: Participant; membros: MapaMembros; eu: Usuario }) {
    const falando = useIsSpeaking(participante);
    // antes de conectar, o participante local ainda não tem identity: usa os seus dados
    const membro = participante.isLocal ? eu : membros.get(participante.identity);
    const nome = membro?.nome ?? participante.name ?? "Convidado";

    return <Avatar nome={nome} url={membro?.avatarUrl} tamanho={26} falando={falando} className="ilha-rosto" />;
}
