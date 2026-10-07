import { useRef, useState, type CSSProperties } from "react";
import { StartAudio, isTrackReference, useConnectionState, useTracks, type TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Loader2, MessageSquare, TabletSmartphone, TvMinimalPlay, Volume2 } from "lucide-react";
import type { Usuario } from "../../api";
import { useChatSala } from "../../contexto/ChatSala";
import { fonteDaTV, useControleSala } from "../../contexto/ControleSala";
import { useControleVoz } from "../../contexto/ControleVoz";
import { useYoutubeSala } from "../../contexto/YoutubeSala";
import { useAgora } from "../../hooks/useAgora";
import { cronometro } from "../../lib/util";
import type { MapaMembros, Voz } from "../../tipos";
import { Cabecalho } from "../ui/Cabecalho";
import { Dica } from "../ui/Dica";
import { PainelControle } from "../controle/PainelControle";
import { ControlesYoutube } from "../youtube/PainelYoutube";
import { PlayerYoutube } from "../youtube/PlayerYoutube";
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
    const { surdo } = useControleVoz();
    const youtube = useYoutubeSala();
    const controle = useControleSala();
    // um painel lateral por vez: o chat da sala, ou o controle da sala (aberto na aba Controle ou YouTube)
    const [painel, setPainel] = useState<"chat" | "controle" | "youtube" | null>(null);
    const chatAberto = painel === "chat";
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
    // o destaque segue o que escolheram pra TV no controle da sala
    const fonte = fonteDaTV(controle.estado, youtube.estado, telas.filter(isTrackReference));
    // com o mundo 3D aberto o vídeo toca na TV da sala de lá (um player só)
    const videoYoutube = fonte.tipo === "youtube" && !youtube.noMundo && youtube.estado?.video ? youtube.estado : null;
    const foco = fonte.tipo === "tela" ? fonte.tela : null;
    const naFaixa = [...telas.filter((t) => t !== foco), ...cameras];
    // TV desligada: ninguém em destaque, e as telas entram na grade junto com as câmeras
    const naGrade = fonte.tipo === "nada" ? [...telas, ...cameras] : cameras;
    // volume da TV escolhido no controle da sala
    const volumeYoutube = useRef(100);
    volumeYoutube.current = controle.estado?.volume ?? 100;

    const colunas = colunasPara(naGrade.length);
    const linhas = Math.max(1, Math.ceil(naGrade.length / colunas));
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
                <Dica texto={painel === "controle" ? "Fechar" : "Controle da sala"} lado="baixo">
                    <button
                        className={`botao-icone ${painel === "controle" ? "ativo" : ""}`}
                        onClick={() => setPainel((v) => (v === "controle" ? null : "controle"))}
                        aria-pressed={painel === "controle"}
                        aria-label="Controle da sala"
                    >
                        <TabletSmartphone size={19} />
                    </button>
                </Dica>
                <Dica texto={painel === "youtube" ? "Fechar" : "Assistir junto (YouTube)"} lado="baixo">
                    <button
                        className={`botao-icone ${painel === "youtube" ? "ativo" : ""}`}
                        onClick={() => setPainel((v) => (v === "youtube" ? null : "youtube"))}
                        aria-pressed={painel === "youtube"}
                        aria-label="Assistir junto"
                    >
                        <TvMinimalPlay size={19} />
                        {youtube.estado?.video && painel !== "youtube" && <span className="ponto-novo" />}
                    </button>
                </Dica>
                <Dica texto={chatAberto ? "Fechar chat" : "Chat da sala"} lado="baixo">
                    <button
                        className={`botao-icone ${chatAberto ? "ativo" : ""}`}
                        onClick={() => setPainel((v) => (v === "chat" ? null : "chat"))}
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

                    {videoYoutube || foco ? (
                        <div className="cena-foco">
                            <div className="cena-foco-principal">
                                {videoYoutube ? (
                                    <div className="bloco bloco-youtube">
                                        <PlayerYoutube
                                            estado={videoYoutube}
                                            posicaoAgora={youtube.posicaoAgora}
                                            enviar={youtube.enviar}
                                            volume={volumeYoutube}
                                            mudo={surdo}
                                        />
                                        <ControlesYoutube compacto />
                                    </div>
                                ) : (
                                    foco && <Bloco trackRef={foco} membros={membros} eu={eu} />
                                )}
                            </div>
                            <div className="cena-faixa">
                                {naFaixa.map((t) => (
                                    <Bloco key={chave(t)} trackRef={t} membros={membros} eu={eu} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="cena-grade" style={estiloGrade} data-pessoas={naGrade.length}>
                            {naGrade.map((t) => (
                                <Bloco key={chave(t)} trackRef={t} membros={membros} eu={eu} />
                            ))}
                        </div>
                    )}

                    <StartAudio label="Clique para ativar o som da sala" className="ativar-audio" />

                    <Controles onSair={onSair} cinema={voz.canal.modelo === "CINEMA"} />
                </div>

                {chatAberto && <ChatAoVivo membros={membros} eu={eu} onFechar={() => setPainel(null)} />}
                {(painel === "controle" || painel === "youtube") && (
                    <PainelControle
                        key={painel}
                        membros={membros}
                        eu={eu}
                        telas={telas.filter(isTrackReference)}
                        abaInicial={painel}
                        onFechar={() => setPainel(null)}
                    />
                )}
            </div>
        </div>
    );
}
