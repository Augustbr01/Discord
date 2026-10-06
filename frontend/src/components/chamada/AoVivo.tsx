import { useIsMuted, useIsSpeaking } from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import type { Usuario } from "../../api";
import type { MapaMembros } from "../../tipos";
import { Assento } from "./Roda";

// dados de quem está na chamada: antes de conectar, o participante local ainda não tem identity
export function pessoaDoParticipante(participante: Participant, membros: MapaMembros, eu: Usuario) {
    const membro = participante.isLocal ? eu : membros.get(participante.identity);
    return { nome: membro?.nome ?? participante.name ?? "Convidado", avatarUrl: membro?.avatarUrl ?? null };
}

type Props = { indice: number; participante: Participant; membros: MapaMembros; eu: Usuario; surdo: boolean };

// um assento da roda ligado ao LiveKit: quem fala e quem está mudo, em tempo real
export function AssentoAoVivo({ indice, participante, membros, eu, surdo }: Props) {
    const falando = useIsSpeaking(participante);
    const mudo = useIsMuted({ participant: participante, source: Track.Source.Microphone });
    const { nome, avatarUrl } = pessoaDoParticipante(participante, membros, eu);

    return <Assento indice={indice} nome={nome} url={avatarUrl} falando={falando} mudo={mudo} surdo={surdo} />;
}
