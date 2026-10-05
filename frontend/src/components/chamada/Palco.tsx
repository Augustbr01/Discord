import { useState, type CSSProperties } from "react";
import { StartAudio, useConnectionState, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Loader2, MessageSquare, Volume2 } from "lucide-react";
import type { Usuario } from "../../api";
import { useChatSala } from "../../contexto/ChatSala";
import { useAgora } from "../../hooks/useAgora";
import { cronometro } from "../../lib/util";
import type { MapaMembros, Voz } from "../../tipos";
import { Cabecalho } from "../ui/Cabecalho";
import { Dica } from "../ui/Dica";
import { Bloco } from "./Bloco";
import { ChatAoVivo } from "./ChatAoVivo";
import { Controles } from "./Controles";

type Props = {
    voz: Voz;
    eu: Usuario;
    membros: MapaMembros;
    onSair: () => void;
    onMenu: () => void;
};

const chave = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}:${t.source}`;

// quantas colunas a grade usa pra cada número de pessoas
function colunasPara(n: number) {
    if (n <= 1) return 1;
    if (n <= 4) return 2;
    if (n <= 9) return 3;
    return 4;
}

export function Palco({ voz, eu, membros, onSair, onMenu }: Props) {
    const estado = useConnectionState();
    const { naoLidas } = useChatSala();
    const [chatAberto, setChatAberto] = useState(false);
    const agora = useAgora();

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

    return (
        <div className="vista">
            <Cabecalho
                icone={<Volume2 size={20} />}
                titulo={voz.canal.nome}
                descricao={conectado ? cronometro(agora - voz.desde) : "Conectando…"}
                onMenu={onMenu}
            >
                <Dica texto={chatAberto ? "Fechar chat" : "Chat da sala"} lado="baixo">
                    <button
                        className={`botao-icone ${chatAberto ? "ativo" : ""}`}
                        onClick={() => setChatAberto((v) => !v)}
                        aria-pressed={chatAberto}
                        aria-label="Chat da sala"
                    >
                        <MessageSquare size={19} />
                        {naoLidas > 0 && !chatAberto && <span className="ponto-novo" />}
                    </button>
                </Dica>
            </Cabecalho>

            <div className="palco">
                <div className="palco-cena">
                    {!conectado && (
                        <div className="palco-aviso">
                            <Loader2 size={15} className="girar" />
                            {estado === ConnectionState.Reconnecting ? "Reconectando…" : "Conectando à sala…"}
                        </div>
                    )}

                    {foco ? (
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

                    <Controles onSair={onSair} />
                </div>

                {chatAberto && <ChatAoVivo membros={membros} eu={eu} onFechar={() => setChatAberto(false)} />}
            </div>
        </div>
    );
}
