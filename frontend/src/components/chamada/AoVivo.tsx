import { useConnectionState, useIsMuted, useIsSpeaking, useParticipants } from "@livekit/components-react";
import { ConnectionState, Track, type Participant } from "livekit-client";
import { HeadphoneOff, MicOff } from "lucide-react";
import type { Usuario } from "../../api";
import type { MapaMembros } from "../../tipos";
import { Avatar } from "../ui/Avatar";

// quem está na sala em que VOCÊ está conectado, direto do LiveKit (tempo real, com quem está falando)
export function PessoasAoVivo({ membros, eu, surdo }: { membros: MapaMembros; eu: Usuario; surdo: boolean }) {
    const participantes = useParticipants();
    const estado = useConnectionState();

    if (estado !== ConnectionState.Connected) return null;

    return (
        <ul className="voz-pessoas">
            {participantes.map((p) => (
                <PessoaAoVivo key={p.identity} participante={p} membros={membros} eu={eu} surdo={p.isLocal && surdo} />
            ))}
        </ul>
    );
}

type PessoaProps = { participante: Participant; membros: MapaMembros; eu: Usuario; surdo: boolean };

function PessoaAoVivo({ participante, membros, eu, surdo }: PessoaProps) {
    const falando = useIsSpeaking(participante);
    const micMutado = useIsMuted({ participant: participante, source: Track.Source.Microphone });
    // antes de conectar, o participante local ainda não tem identity: usa os seus dados
    const membro = participante.isLocal ? eu : membros.get(participante.identity);
    const nome = membro?.nome ?? participante.name ?? "Convidado";

    return (
        <li className={falando ? "falando" : ""}>
            <Avatar nome={nome} url={membro?.avatarUrl} tamanho={22} falando={falando} />
            <span className="truncar">{nome}</span>
            <span className="voz-pessoa-estado">
                {micMutado && <MicOff size={13} />}
                {surdo && <HeadphoneOff size={13} />}
            </span>
        </li>
    );
}
