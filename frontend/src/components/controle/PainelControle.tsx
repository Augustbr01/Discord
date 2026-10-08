import { useState, type ReactNode } from "react";
import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { Lightbulb, LightbulbOff, MonitorUp, PowerOff, Sparkles, SunDim, TvMinimalPlay, Volume1, X } from "lucide-react";
import type { Usuario } from "../../api";
import { useControleSala } from "../../contexto/ControleSala";
import { useYoutubeSala } from "../../contexto/YoutubeSala";
import type { MapaMembros, ModoLuzes } from "../../tipos";
import { PainelYoutube } from "../youtube/PainelYoutube";
import { LED_PADRAO, ORDEM_PALETAS, PALETAS } from "../mundo/paletas";

type Aba = "controle" | "youtube";

type Props = {
    membros: MapaMembros;
    eu: Usuario;
    // telas compartilhadas na call agora (pra escolher qual vai pra TV)
    telas: TrackReference[];
    abaInicial?: Aba;
    // no lugar do controle (ex.: fora de call não tem sala pra controlar)
    aviso?: string | undefined;
    onFechar: () => void;
};

// o "tablet" da sala: o que aparece na TV, o som da TV, as luzes e o YouTube junto.
// Mexeu aqui, muda pra todo mundo da call
export function PainelControle({ membros, eu, telas, abaInicial = "controle", aviso, onFechar }: Props) {
    const { estado, enviar } = useControleSala();
    const youtube = useYoutubeSala();
    const [aba, setAba] = useState<Aba>(abaInicial);
    // enquanto arrasta, mostra o volume escolhido; só manda ao soltar
    const [volume, setVolume] = useState<number | null>(null);

    const nome = (id: string) => (id === eu.id ? "você" : membros.get(id)?.nome ?? "alguém");
    const tv = estado?.tv ?? { modo: "AUTO", identidade: null };
    const video = youtube.estado?.video;

    const soltarVolume = () => {
        if (volume !== null) enviar({ acao: "VOLUME", volume });
        setVolume(null);
    };

    return (
        <aside className="chat-sala controle-painel">
            <header className="chat-sala-topo">
                <div>
                    <strong>Controle da sala</strong>
                    <span>Todo mundo na call controla</span>
                </div>
                <button className="botao-icone" onClick={onFechar} aria-label="Fechar">
                    <X size={18} />
                </button>
            </header>

            <div className="controle-abas" role="tablist">
                <button role="tab" aria-selected={aba === "controle"} className={aba === "controle" ? "ativo" : ""} onClick={() => setAba("controle")}>
                    Controle
                </button>
                <button role="tab" aria-selected={aba === "youtube"} className={aba === "youtube" ? "ativo" : ""} onClick={() => setAba("youtube")}>
                    YouTube
                </button>
            </div>

            {aviso ? (
                <p className="controle-aviso">{aviso}</p>
            ) : aba === "youtube" ? (
                <PainelYoutube membros={membros} eu={eu} onFechar={onFechar} embutido />
            ) : estado === null ? (
                <p className="chat-sala-vazio">Carregando…</p>
            ) : (
                <div className="controle-corpo">
                    <section>
                        <span className="rotulo">Na TV</span>
                        <div className="controle-opcoes">
                            <Opcao
                                ativo={tv.modo === "AUTO"}
                                onClick={() => enviar({ acao: "TV", modo: "AUTO" })}
                                icone={<Sparkles size={18} />}
                                titulo="Automático"
                                descricao="O YouTube, ou a primeira tela compartilhada"
                            />
                            <Opcao
                                ativo={tv.modo === "YOUTUBE"}
                                desligada={!video}
                                onClick={() => enviar({ acao: "TV", modo: "YOUTUBE" })}
                                icone={<TvMinimalPlay size={18} />}
                                titulo="YouTube junto"
                                descricao={video?.titulo ?? "Nada tocando (coloque um vídeo na aba YouTube)"}
                            />
                            {/* cada tela compartilhada, com a prévia ao vivo: toque pra mandar pra TV da sala */}
                            {telas.map((t) => (
                                <Opcao
                                    key={t.publication.trackSid}
                                    ativo={tv.modo === "TELA" && tv.identidade === t.participant.identity}
                                    onClick={() => enviar({ acao: "TV_TELA", identidade: t.participant.identity })}
                                    icone={<MonitorUp size={18} />}
                                    previa={<VideoTrack trackRef={t} muted />}
                                    titulo={t.participant.isLocal ? "Sua tela" : `Tela de ${nome(t.participant.identity)}`}
                                    descricao="Compartilhando agora · mandar pra TV"
                                />
                            ))}
                            {telas.length === 0 && (
                                <small className="texto-fraco">Quando alguém da call compartilhar a tela, ela aparece aqui pra ir pra TV.</small>
                            )}
                            <Opcao
                                ativo={tv.modo === "DESLIGADA"}
                                onClick={() => enviar({ acao: "TV", modo: "DESLIGADA" })}
                                icone={<PowerOff size={18} />}
                                titulo="Desligada"
                                descricao="Ninguém na TV (as telas continuam em cima das pessoas)"
                            />
                        </div>
                    </section>

                    <section>
                        <span className="rotulo">Som da TV</span>
                        <div className="controle-volume">
                            <Volume1 size={18} />
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={volume ?? estado.volume}
                                onChange={(e) => setVolume(Number(e.target.value))}
                                onPointerUp={soltarVolume}
                                onKeyUp={soltarVolume}
                                aria-label="Volume da TV"
                            />
                            <span>{volume ?? estado.volume}%</span>
                        </div>
                        <label className="controle-alternar">
                            <input type="checkbox" checked={estado.surround} onChange={(e) => enviar({ acao: "SURROUND", ligado: e.target.checked })} />
                            <span>
                                <strong>Som surround</strong>
                                <small>No 3D, o som da tela na TV sai pelas 5 caixas da sala: cada lugar ouve diferente. O YouTube não passa pelas caixas.</small>
                            </span>
                        </label>
                    </section>

                    <section>
                        <span className="rotulo">Luzes (no 3D)</span>
                        <div className="controle-segmentos" role="radiogroup">
                            {([
                                ["AUTO", "Automático", <SunDim key="a" size={16} />],
                                ["ACESAS", "Acesas", <Lightbulb key="b" size={16} />],
                                ["APAGADAS", "Apagadas", <LightbulbOff key="c" size={16} />],
                            ] as [ModoLuzes, string, ReactNode][]).map(([modo, texto, icone]) => (
                                <button
                                    key={modo}
                                    role="radio"
                                    aria-checked={estado.luzes === modo}
                                    className={estado.luzes === modo ? "ativo" : ""}
                                    onClick={() => enviar({ acao: "LUZES", modo })}
                                >
                                    {icone} {texto}
                                </button>
                            ))}
                        </div>
                        <small className="texto-fraco">No automático, o cinema apaga quando o filme começa.</small>
                    </section>

                    <section>
                        <span className="rotulo">LEDs da sala (no 3D)</span>
                        <div className="controle-paletas" role="radiogroup" aria-label="Cor dos LEDs">
                            {ORDEM_PALETAS.map((p) => {
                                const led = estado.led ?? LED_PADRAO;
                                const ativa = led.paleta === p;
                                return (
                                    <button
                                        key={p}
                                        role="radio"
                                        aria-checked={ativa}
                                        className={ativa ? "ativo" : ""}
                                        onClick={() => enviar({ acao: "LED", paleta: p, ligado: true })}
                                        title={PALETAS[p].nome}
                                    >
                                        <span className="controle-paleta-cores" style={{ background: `linear-gradient(135deg, ${PALETAS[p].a} 50%, ${PALETAS[p].b} 50%)` }} />
                                        <span>{PALETAS[p].nome}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <label className="controle-alternar">
                            <input type="checkbox" checked={(estado.led ?? LED_PADRAO).ciclo} onChange={(e) => enviar({ acao: "LED", ciclo: e.target.checked })} />
                            <span>
                                <strong>Ciclo RGB</strong>
                                <small>As cores vão girando devagar e os LEDs "respiram".</small>
                            </span>
                        </label>
                        <label className="controle-alternar">
                            <input type="checkbox" checked={(estado.led ?? LED_PADRAO).ligado} onChange={(e) => enviar({ acao: "LED", ligado: e.target.checked })} />
                            <span>
                                <strong>LEDs ligados</strong>
                                <small>Fitas, painéis e o brilho da sala. Com a luz apagada, sobram só os LEDs e a TV.</small>
                            </span>
                        </label>
                    </section>

                    {estado.ultima && (
                        <small className="texto-fraco">Última mudança por {nome(estado.ultima.usuarioId)}</small>
                    )}
                </div>
            )}
        </aside>
    );
}

type OpcaoProps = { ativo: boolean; desligada?: boolean; onClick: () => void; icone: ReactNode; previa?: ReactNode; titulo: string; descricao: string };

function Opcao({ ativo, desligada = false, onClick, icone, previa, titulo, descricao }: OpcaoProps) {
    return (
        <button className={`controle-opcao ${ativo ? "ativo" : ""} ${previa ? "com-previa" : ""}`} onClick={onClick} disabled={desligada} aria-pressed={ativo}>
            {previa ? <span className="controle-previa">{previa}</span> : <span className="controle-opcao-icone">{icone}</span>}
            <span className="controle-opcao-texto">
                <strong className="truncar">{titulo}</strong>
                <small className="truncar">{descricao}</small>
            </span>
        </button>
    );
}
