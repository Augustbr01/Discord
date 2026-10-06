import { useState, type CSSProperties } from "react";
import {
    StartAudio, isTrackReference, useConnectionState, useParticipants, useTracks,
    type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Loader2 } from "lucide-react";
import type { Usuario } from "../../api";
import { useChatSala } from "../../contexto/ChatSala";
import { useControleVoz } from "../../contexto/ControleVoz";
import { useAgora } from "../../hooks/useAgora";
import { cronometro } from "../../lib/util";
import type { MapaMembros, Voz } from "../../tipos";
import { AssentoAoVivo } from "./AoVivo";
import { Bloco } from "./Bloco";
import { ChatAoVivo } from "./ChatAoVivo";
import { Controles } from "./Controles";
import { Roda } from "./Roda";

type Props = {
    voz: Voz;
    eu: Usuario;
    membros: MapaMembros;
    onSair: () => void;
};

const chave = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}:${t.source}`;

// quantas colunas a grade usa pra cada número de pessoas
function colunasPara(n: number) {
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
}

export function Palco({ voz, eu, membros, onSair }: Props) {
    const estado = useConnectionState();
    const { naoLidas } = useChatSala();
    const [chatAberto, setChatAberto] = useState(false);

    // uma câmera por pessoa (placeholder quando está desligada) + as telas compartilhadas
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
    const telas = tracks.filter((t) => t.source === Track.Source.ScreenShare);
    const foco = telas[0];

    const colunas = colunasPara(cameras.length);
    const linhas = Math.max(1, Math.ceil(cameras.length / colunas));
    const estiloGrade = { "--colunas": colunas, "--linhas": linhas } as CSSProperties;

    const conectado = estado === ConnectionState.Connected;
    // ninguém com câmera nem tela: a chamada vira a roda (só avatares, quem fala se destaca)
    const algumVideo = telas.length > 0 || cameras.some((t) => isTrackReference(t) && !t.publication.isMuted);

    return (
        <div className="palco">
            <div className="palco-cena">
                {/* na roda o próprio centro já diz "Conectando…" */}
                {!conectado && algumVideo && (
                    <div className="palco-aviso">
                        <Loader2 size={15} className="girar" />
                        {estado === ConnectionState.Reconnecting ? "Reconectando…" : "Conectando à sala…"}
                    </div>
                )}

                {!algumVideo ? (
                    <RodaAoVivo voz={voz} conectado={conectado} membros={membros} eu={eu} />
                ) : foco ? (
                    <div className="cena-foco">
                        <div className="cena-foco-principal">
                            <Bloco trackRef={foco} membros={membros} eu={eu} />
                        </div>
                        <div className="cena-faixa">
                            {[...telas.slice(1), ...cameras].map((t) => (
                                <Bloco key={chave(t)} trackRef={t} membros={membros} eu={eu} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="cena-grade" style={estiloGrade} data-pessoas={cameras.length}>
                        {cameras.map((t) => (
                            <Bloco key={chave(t)} trackRef={t} membros={membros} eu={eu} />
                        ))}
                    </div>
                )}

                <StartAudio label="Clique para ativar o som da sala" className="ativar-audio" />

                <Controles
                    onSair={onSair}
                    chatAberto={chatAberto}
                    naoLidas={naoLidas}
                    onChat={() => setChatAberto((v) => !v)}
                />
            </div>

            {chatAberto && <ChatAoVivo membros={membros} eu={eu} onFechar={() => setChatAberto(false)} />}
        </div>
    );
}

// a roda com quem está conectado agora, direto do LiveKit
function RodaAoVivo({ voz, conectado, membros, eu }: { voz: Voz; conectado: boolean; membros: MapaMembros; eu: Usuario }) {
    const participantes = useParticipants();
    const { surdo } = useControleVoz();
    const agora = useAgora();

    return (
        <div className="cena-roda">
            <Roda
                quantidade={participantes.length}
                centro={
                    <>
                        <h2 className="roda-titulo">{voz.canal.nome}</h2>
                        <p className="roda-meta numeros">{conectado ? cronometro(agora - voz.desde) : "Conectando…"}</p>
                    </>
                }
            >
                {participantes.map((p, i) => (
                    <AssentoAoVivo key={p.identity} indice={i} participante={p} membros={membros} eu={eu} surdo={p.isLocal && surdo} />
                ))}
            </Roda>
        </div>
    );
}
